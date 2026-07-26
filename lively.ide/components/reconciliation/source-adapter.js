import { parse } from 'lively.ast';
import {
  ComponentDocument,
  ComponentNode,
  ComponentNodeProvenanceKind,
  addedNodeProvenance,
  explicitProperty,
  inheritedNodeProvenance,
  localNodeProvenance,
  opaqueProperty,
  resizePolicyLayoutReference,
  sourceComponentReference,
  tilingLayoutModel
} from './component-document.js';
import {
  ComponentImportKind,
  componentImportBinding
} from './import-bindings.js';
import { validateComponentDocument } from './invariants.js';

export const ComponentSourceDiagnosticKind = Object.freeze({
  SYNTAX_ERROR: 'syntax-error',
  COMPONENT_NOT_FOUND: 'component-not-found',
  UNSUPPORTED_COMPONENT_CALL: 'unsupported-component-call',
  UNSUPPORTED_COMPONENT_SPEC: 'unsupported-component-spec',
  UNSUPPORTED_PROPERTY: 'unsupported-property',
  DUPLICATE_PROPERTY: 'duplicate-property',
  INVALID_NODE_NAME: 'invalid-node-name',
  INVALID_ORDERING_REFERENCE: 'invalid-ordering-reference',
  UNRESOLVED_PART_COMPONENT: 'unresolved-part-component',
  UNSUPPORTED_SUBMORPH_STRUCTURE: 'unsupported-submorph-structure',
  OPAQUE_SUBMORPH_STRUCTURE: 'opaque-submorph-structure',
  DERIVED_STRUCTURE_REQUIRES_PARENT: 'derived-structure-requires-parent',
  UNMODELED_LAYOUT_REFERENCE: 'unmodeled-layout-reference'
});

export const ComponentSourceDiagnosticSeverity = Object.freeze({
  ERROR: 'error',
  WARNING: 'warning'
});

function rangeOf (node) {
  if (!node || !Number.isInteger(node.start) || !Number.isInteger(node.end)) return null;
  return Object.freeze({ start: node.start, end: node.end });
}

function diagnostic (kind, message, node = null, details = {}) {
  return Object.freeze({
    kind,
    severity: ComponentSourceDiagnosticSeverity.ERROR,
    message,
    range: rangeOf(node),
    ...details
  });
}

function result (document, diagnostics) {
  return Object.freeze({
    supported: !!document && !diagnostics.some(({ severity }) =>
      severity === ComponentSourceDiagnosticSeverity.ERROR),
    document,
    diagnostics: Object.freeze(diagnostics)
  });
}

function variableDeclaratorNamed (moduleAst, exportName) {
  for (const statement of moduleAst.body) {
    const declaration = statement.type === 'ExportNamedDeclaration'
      ? statement.declaration
      : statement;
    if (declaration?.type !== 'VariableDeclaration') continue;
    const declarator = declaration.declarations.find(({ id }) =>
      id.type === 'Identifier' && id.name === exportName);
    if (declarator) return declarator;
  }
  return null;
}

function propertyName (property) {
  if (property.computed) return null;
  if (property.key?.type === 'Identifier') return property.key.name;
  if (property.key?.type === 'Literal' && typeof property.key.value === 'string') {
    return property.key.value;
  }
  return null;
}

function staticValue (node) {
  if (!node) return { known: false };
  if (node.type === 'Literal' && !node.regex &&
      (node.value === null || ['string', 'number', 'boolean'].includes(typeof node.value))) {
    return { known: true, value: node.value };
  }
  if (node.type === 'UnaryExpression' && ['+', '-'].includes(node.operator)) {
    const argument = staticValue(node.argument);
    if (argument.known && typeof argument.value === 'number') {
      return {
        known: true,
        value: node.operator === '-' ? -argument.value : +argument.value
      };
    }
  }
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return { known: true, value: node.quasis[0].value.cooked };
  }
  if (node.type === 'ArrayExpression' && node.elements.every(Boolean)) {
    const elements = node.elements.map(staticValue);
    if (elements.every(({ known }) => known)) {
      return { known: true, value: elements.map(({ value }) => value) };
    }
  }
  if (node.type === 'ObjectExpression') {
    const entries = [];
    for (const property of node.properties) {
      if (property.type !== 'Property' || property.kind !== 'init' || property.method) {
        return { known: false };
      }
      const key = propertyName(property);
      const value = staticValue(property.value);
      if (key === null || !value.known) return { known: false };
      entries.push([key, value.value]);
    }
    return { known: true, value: Object.fromEntries(entries) };
  }
  return { known: false };
}

function importBindingsOf (moduleAst) {
  const bindings = [];
  for (const statement of moduleAst.body) {
    if (statement.type !== 'ImportDeclaration') continue;
    for (const specifier of statement.specifiers) {
      const kind = specifier.type === 'ImportSpecifier'
        ? ComponentImportKind.NAMED
        : specifier.type === 'ImportDefaultSpecifier'
          ? ComponentImportKind.DEFAULT
          : ComponentImportKind.NAMESPACE;
      const imported = kind === ComponentImportKind.NAMED
        ? specifier.imported.name
        : undefined;
      bindings.push(componentImportBinding({
        kind,
        moduleId: statement.source.value,
        imported,
        local: specifier.local.name
      }));
    }
  }
  return Object.freeze(bindings);
}

function importInsertionIndexOf (moduleAst) {
  const imports = moduleAst.body.filter(statement => statement.type === 'ImportDeclaration');
  if (imports.length) return imports[imports.length - 1].end;
  return moduleAst.body[0]?.start || 0;
}

function nodeIdFor (componentId, path) {
  return path.length
    ? `${componentId}:node:${path.join('.')}`
    : `${componentId}:root`;
}

function staticTilingResizePolicies (layoutNode) {
  if (layoutNode?.type !== 'NewExpression' ||
      layoutNode.callee?.type !== 'Identifier' ||
      layoutNode.callee.name !== 'TilingLayout') return null;
  if (layoutNode.arguments.length === 0) {
    return Object.freeze({ policies: Object.freeze([]), policiesNode: null });
  }
  if (layoutNode.arguments.length !== 1 ||
      layoutNode.arguments[0]?.type !== 'ObjectExpression') return null;
  const resizePolicyProperties = layoutNode.arguments[0].properties.filter(property =>
    property.type === 'Property' && property.kind === 'init' && !property.method &&
    propertyName(property) === 'resizePolicies');
  if (resizePolicyProperties.length === 0) {
    return Object.freeze({ policies: Object.freeze([]), policiesNode: null });
  }
  if (resizePolicyProperties.length !== 1) return null;
  const policiesNode = resizePolicyProperties[0].value;
  if (policiesNode.type !== 'ArrayExpression' || policiesNode.elements.some(node => !node)) {
    return null;
  }
  const policies = [];
  for (const entry of policiesNode.elements) {
    if (entry.type !== 'ArrayExpression' || entry.elements.length < 2 ||
        entry.elements.some(node => !node)) return null;
    const target = staticValue(entry.elements[0]);
    if (!target.known || typeof target.value !== 'string' || !target.value) return null;
    policies.push(Object.freeze({
      targetName: target.value,
      targetNode: entry.elements[0],
      entryNode: entry
    }));
  }
  return Object.freeze({
    policies: Object.freeze(policies),
    policiesNode
  });
}

function layoutExpressionTemplate (source, layoutNode, policiesNode) {
  const expression = source.slice(layoutNode.start, layoutNode.end);
  if (!policiesNode) return expression;
  const start = policiesNode.start - layoutNode.start;
  const end = policiesNode.end - layoutNode.start;
  return `${expression.slice(0, start)}<component-resize-policies>${expression.slice(end)}`;
}

function resizePolicyExpressionTemplate (source, policy) {
  const expression = source.slice(policy.entryNode.start, policy.entryNode.end);
  const start = policy.targetNode.start - policy.entryNode.start;
  const end = policy.targetNode.end - policy.entryNode.start;
  return `${expression.slice(0, start)}<component-layout-target>${expression.slice(end)}`;
}

export function parseComponentSource ({
  source,
  moduleId,
  exportName,
  componentId = `${moduleId}#${exportName}`,
  parentDocument = null,
  resolveComponentDocument = null
}) {
  if (typeof source !== 'string') throw new Error('Component source must be a string');
  if (typeof moduleId !== 'string' || !moduleId) throw new Error('Component source requires a moduleId');
  if (typeof exportName !== 'string' || !exportName) {
    throw new Error('Component source requires an exportName');
  }
  if (typeof componentId !== 'string' || !componentId) {
    throw new Error('Component source requires a componentId');
  }
  if (parentDocument !== null && !(parentDocument instanceof ComponentDocument)) {
    throw new Error('Component source parentDocument must be a ComponentDocument');
  }
  if (resolveComponentDocument !== null && typeof resolveComponentDocument !== 'function') {
    throw new Error('Component source resolveComponentDocument must be a function');
  }

  const diagnostics = [];
  let moduleAst;
  try {
    moduleAst = parse(source);
  } catch (error) {
    diagnostics.push(diagnostic(
      ComponentSourceDiagnosticKind.SYNTAX_ERROR,
      error.message,
      error
    ));
    return result(null, diagnostics);
  }

  const declarator = variableDeclaratorNamed(moduleAst, exportName);
  if (!declarator) {
    diagnostics.push(diagnostic(
      ComponentSourceDiagnosticKind.COMPONENT_NOT_FOUND,
      `Could not find component declaration ${exportName}`
    ));
    return result(null, diagnostics);
  }

  const componentCall = declarator.init;
  if (componentCall?.type !== 'CallExpression' ||
      componentCall.callee.type !== 'Identifier' ||
      componentCall.callee.name !== 'component' ||
      ![1, 2].includes(componentCall.arguments.length)) {
    diagnostics.push(diagnostic(
      ComponentSourceDiagnosticKind.UNSUPPORTED_COMPONENT_CALL,
      `${exportName} must be initialized by component(spec) or component(parent, spec)`,
      componentCall || declarator
    ));
    return result(null, diagnostics);
  }

  const derived = componentCall.arguments.length === 2;
  const parentNode = derived ? componentCall.arguments[0] : null;
  const specNode = componentCall.arguments[derived ? 1 : 0];
  if (specNode.type !== 'ObjectExpression') {
    diagnostics.push(diagnostic(
      ComponentSourceDiagnosticKind.UNSUPPORTED_COMPONENT_SPEC,
      'Component specifications must be object expressions',
      specNode
    ));
    return result(null, diagnostics);
  }

  const nodeIdToAstLocation = {};
  const nodeSpecLocations = {};
  const propertyLocations = {};
  const originalExpressions = {};
  const suppressionLocations = {};
  const orderingNames = {};
  const orderingLocations = {};
  const layoutModels = [];
  const layoutReferenceLocations = {};
  const opaqueSubmorphExpressions = {};

  const inheritedNode = (node, idFor = candidate => candidate.id, path = []) =>
    new ComponentNode({
      id: idFor(node, path),
      name: node.name,
      provenance: inheritedNodeProvenance({
        suppressed: node.provenance.kind === ComponentNodeProvenanceKind.INHERITED &&
          node.provenance.suppressed,
        baseName: node.provenance.baseName || node.name
      }),
      partComponent: node.partComponent,
      typeExpression: node.typeExpression,
      properties: node.properties,
      children: node.children.map((child, index) =>
        inheritedNode(child, idFor, [...path, index]))
    });

  const withoutTarget = node => {
    if (node?.type !== 'CallExpression' ||
        node.callee?.type !== 'Identifier' || node.callee.name !== 'without' ||
        node.arguments.length !== 1) return null;
    const target = staticValue(node.arguments[0]);
    return target.known && typeof target.value === 'string' && target.value
      ? target.value
      : null;
  };

  const helperCall = (node, name) => node?.type === 'CallExpression' &&
    node.callee?.type === 'Identifier' && node.callee.name === name;

  const replacementTarget = node => {
    if (!helperCall(node, 'replace') || node.arguments.length !== 2) return null;
    const target = staticValue(node.arguments[0]);
    return target.known && typeof target.value === 'string' && target.value
      ? target.value
      : null;
  };

  const partDocumentFor = (expression, path) => {
    if (!resolveComponentDocument) return null;
    const resolved = resolveComponentDocument(Object.freeze({
      expression,
      moduleId,
      exportName,
      path: Object.freeze(path.slice())
    }));
    if (resolved !== null && resolved !== undefined && !(resolved instanceof ComponentDocument)) {
      throw new Error(`Resolved part ${expression} must be a ComponentDocument or null`);
    }
    return resolved || null;
  };

  const staticNodeName = objectNode => {
    if (objectNode?.type !== 'ObjectExpression') return null;
    const property = objectNode.properties.find(candidate =>
      candidate.type === 'Property' && propertyName(candidate) === 'name');
    const parsedName = staticValue(property?.value);
    return parsedName.known && typeof parsedName.value === 'string' && parsedName.value
      ? parsedName.value
      : null;
  };

  let parseNode;

  const resolveOrdering = (children, additions, submorphsNode) => {
    const resolved = children.slice();
    let pending = additions.slice();
    while (pending.length) {
      const deferred = [];
      let progress = false;
      for (const child of pending) {
        const beforeName = orderingNames[child.id] || null;
        if (!beforeName) {
          resolved.push(child);
          progress = true;
          continue;
        }
        const beforeIndex = resolved.findIndex(candidate => candidate.name === beforeName);
        if (beforeIndex < 0) {
          deferred.push(child);
          continue;
        }
        const before = resolved[beforeIndex];
        resolved.splice(beforeIndex, 0, child.with({
          provenance: addedNodeProvenance({ beforeId: before.id })
        }));
        progress = true;
      }
      if (!progress) {
        for (const child of deferred) {
          const sourceIndex = additions.findIndex(candidate => candidate.id === child.id);
          const resolvedIds = new Set(resolved.map(candidate => candidate.id));
          const nextResolvedAddition = additions.slice(sourceIndex + 1)
            .find(candidate => resolvedIds.has(candidate.id));
          const insertionIndex = nextResolvedAddition
            ? resolved.findIndex(candidate => candidate.id === nextResolvedAddition.id)
            : resolved.length;
          resolved.splice(insertionIndex, 0, child.with({
            provenance: addedNodeProvenance({
              beforeName: orderingNames[child.id]
            })
          }));
        }
        break;
      }
      pending = deferred;
    }
    return resolved;
  };

  const parseResolvedChildren = (
    submorphsNode,
    inheritedChildren,
    path,
    ownerId,
    allowUnknownOverrides = false
  ) => {
    let children = inheritedChildren.slice();
    if (!submorphsNode) return children;
    if (submorphsNode.type !== 'ArrayExpression' ||
        submorphsNode.elements.some(node => !node)) {
      diagnostics.push(diagnostic(
        ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
        'Resolved submorph overrides must be a dense array expression',
        submorphsNode
      ));
      return children;
    }

    const additions = [];
    for (let index = 0; index < submorphsNode.elements.length; index++) {
      const element = submorphsNode.elements[index];
      const suppressedName = withoutTarget(element);
      if (suppressedName) {
        let targetIndex = children.findIndex(child => child.name === suppressedName);
        if (targetIndex < 0) {
          children.push(new ComponentNode({
            id: `${ownerId}:inherited:${encodeURIComponent(suppressedName)}`,
            name: suppressedName,
            provenance: inheritedNodeProvenance()
          }));
          targetIndex = children.length - 1;
        }
        const target = children[targetIndex];
        children[targetIndex] = target.with({
          provenance: inheritedNodeProvenance({
            ...target.provenance,
            suppressed: true
          })
        });
        suppressionLocations[target.id] = rangeOf(element);
        continue;
      }

      if (helperCall(element, 'add')) {
        const addition = parseNode(element, [...path, index]);
        if (addition) additions.push(addition);
        continue;
      }

      const overrideName = staticNodeName(element);
      const replacedName = replacementTarget(element);
      if (helperCall(element, 'replace') && !replacedName) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
          'replace(name, spec) requires a non-empty static inherited name and a spec',
          element
        ));
        continue;
      }
      const targetName = replacedName || overrideName;
      let targetIndex = children.findIndex(child =>
        (child.provenance.baseName || child.name) === targetName);
      if (!targetName || (targetIndex < 0 && !derived && !allowUnknownOverrides)) {
        const knownNames = children.map(child =>
          child.provenance.baseName || child.name);
        const entrySource = element?.start !== undefined && element?.end !== undefined
          ? source.slice(element.start, element.end)
          : null;
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
          `Resolved submorph entry ${JSON.stringify(targetName)}` +
            `${entrySource ? ` (${JSON.stringify(entrySource)})` : ''} must override a known name ` +
            `(${knownNames.map(name => JSON.stringify(name)).join(', ') || 'none'}) or use add/without`,
          element
        ));
        continue;
      }
      if (targetIndex < 0) {
        children.push(new ComponentNode({
          id: `${ownerId}:inherited:${encodeURIComponent(targetName)}`,
          name: targetName,
          provenance: inheritedNodeProvenance({
            suppressed: !allowUnknownOverrides,
            baseName: targetName
          })
        }));
        targetIndex = children.length - 1;
      }
      const target = children[targetIndex];
      const override = parseNode(
        element,
        [...path, index],
        false,
        target,
        allowUnknownOverrides
      );
      if (override) children[targetIndex] = override;
    }
    return resolveOrdering(children, additions, submorphsNode);
  };

  parseNode = (
    nodeExpression,
    path,
    isRoot = false,
    inheritedBase = null,
    allowUnknownDescendantOverrides = false
  ) => {
    let objectNode = nodeExpression;
    let provenance = localNodeProvenance();
    let partComponent = null;
    let partDocument = null;
    let orderingName = null;

    if (!isRoot && helperCall(objectNode, 'replace')) {
      if (!replacementTarget(objectNode)) return null;
      objectNode = objectNode.arguments[1];
    }

    if (!isRoot && helperCall(objectNode, 'add')) {
      if (![1, 2].includes(objectNode.arguments.length)) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
          'add(spec) accepts an optional static sibling name as its second argument',
          objectNode
        ));
        return null;
      }
      if (objectNode.arguments.length === 2) {
        const parsedOrderingName = staticValue(objectNode.arguments[1]);
        if (!parsedOrderingName.known || typeof parsedOrderingName.value !== 'string' ||
            !parsedOrderingName.value) {
          diagnostics.push(diagnostic(
            ComponentSourceDiagnosticKind.INVALID_ORDERING_REFERENCE,
            'add ordering anchors must be non-empty static sibling names',
            objectNode.arguments[1]
          ));
          return null;
        }
        orderingName = parsedOrderingName.value;
      }
      provenance = addedNodeProvenance();
      objectNode = objectNode.arguments[0];
    }

    if (!isRoot && helperCall(objectNode, 'part')) {
      if (![1, 2].includes(objectNode.arguments.length) ||
          objectNode.arguments[0]?.type === 'SpreadElement') {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
          'part(component) accepts one optional object override',
          objectNode
        ));
        return null;
      }
      partComponent = sourceComponentReference(source.slice(
        objectNode.arguments[0].start,
        objectNode.arguments[0].end
      ));
      partDocument = partDocumentFor(partComponent.expression, path);
      if (objectNode.arguments.length === 1 && !partDocument) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNRESOLVED_PART_COMPONENT,
          'A part without a named override requires a resolved component document',
          objectNode
        ));
        return null;
      }
      objectNode = objectNode.arguments[1] || null;
    }

    if (objectNode !== null && objectNode?.type !== 'ObjectExpression') {
      diagnostics.push(diagnostic(
        ComponentSourceDiagnosticKind.UNSUPPORTED_SUBMORPH_STRUCTURE,
        'Component nodes must be object specifications, part calls, or add calls',
        objectNode
      ));
      return null;
    }

    const propertiesByName = new Map();
    for (const property of objectNode?.properties || []) {
      if (property.type !== 'Property' || property.kind !== 'init' || property.method) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_PROPERTY,
          'Spread, accessor, and method properties are not supported in component specifications',
          property
        ));
        continue;
      }
      const name = propertyName(property);
      if (name === null) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNSUPPORTED_PROPERTY,
          'Computed component property names are not supported',
          property
        ));
        continue;
      }
      if (propertiesByName.has(name)) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.DUPLICATE_PROPERTY,
          `Duplicate component property ${name}`,
          property,
          { property: name }
        ));
        continue;
      }
      propertiesByName.set(name, property);
    }

    const nameProperty = propertiesByName.get('name');
    const parsedName = staticValue(nameProperty?.value);
    const name = nameProperty
      ? parsedName.value
      : inheritedBase?.name || partDocument?.root.name || (isRoot ? exportName : null);
    if (typeof name !== 'string' || !name) {
      diagnostics.push(diagnostic(
        ComponentSourceDiagnosticKind.INVALID_NODE_NAME,
        'Component node names must be non-empty static strings',
        nameProperty?.value || objectNode || nodeExpression
      ));
      return null;
    }

    const nodeId = inheritedBase?.id || nodeIdFor(componentId, path);
    nodeIdToAstLocation[nodeId] = rangeOf(nodeExpression);
    if (objectNode) nodeSpecLocations[nodeId] = rangeOf(objectNode);
    propertyLocations[nodeId] = {};
    originalExpressions[nodeId] = {};
    if (orderingName) {
      orderingNames[nodeId] = orderingName;
      orderingLocations[nodeId] = rangeOf(nodeExpression.arguments[1]);
    }

    const semanticProperties = {
      ...(inheritedBase?.properties || partDocument?.root.properties || {})
    };
    for (const [propertyName, property] of propertiesByName) {
      propertyLocations[nodeId][propertyName] = Object.freeze({
        ...rangeOf(property),
        value: rangeOf(property.value)
      });
      originalExpressions[nodeId][propertyName] = source.slice(
        property.value.start,
        property.value.end
      );
      if (['name', 'type', 'submorphs'].includes(propertyName)) continue;
      const parsedValue = staticValue(property.value);
      semanticProperties[propertyName] = parsedValue.known
        ? explicitProperty(parsedValue.value)
        : opaqueProperty(originalExpressions[nodeId][propertyName]);
    }

    let children = [];
    const submorphsProperty = propertiesByName.get('submorphs');
    if (derived && isRoot && parentDocument) {
      children = parseResolvedChildren(
        submorphsProperty?.value,
        parentDocument.root.children.map(child => inheritedNode(child)),
        path,
        nodeId
      );
    } else if (inheritedBase || partDocument) {
      const baseChildren = inheritedBase
        ? inheritedBase.children
        : partDocument.root.children.map((child, index) => inheritedNode(
            child,
            (_candidate, inheritedPath) =>
              `${nodeId}:inherited:${inheritedPath.join('.')}`,
            [index]
          ));
      children = parseResolvedChildren(
        submorphsProperty?.value,
        baseChildren,
        path,
        nodeId,
        allowUnknownDescendantOverrides
      );
    } else if (partComponent && submorphsProperty) {
      children = parseResolvedChildren(
        submorphsProperty.value,
        [],
        path,
        nodeId,
        true
      );
    } else if (submorphsProperty) {
      const submorphsNode = submorphsProperty.value;
      if (submorphsNode.type !== 'ArrayExpression' || submorphsNode.elements.some(node => !node)) {
        opaqueSubmorphExpressions[nodeId] = rangeOf(submorphsNode);
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.OPAQUE_SUBMORPH_STRUCTURE,
          'Dynamic submorphs are opaque; the owning node remains editable but generated descendants are not projectional targets',
          submorphsNode,
          { severity: ComponentSourceDiagnosticSeverity.WARNING, ownerId: nodeId }
        ));
      } else if (derived && isRoot && submorphsNode.elements.length) {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.DERIVED_STRUCTURE_REQUIRES_PARENT,
          'Derived submorph overrides require a resolved parent component document',
          submorphsNode
        ));
      } else {
        children = submorphsNode.elements
          .map((child, index) => parseNode(child, [...path, index]))
          .filter(Boolean);
        const additions = children.filter(child =>
          child.provenance.kind === ComponentNodeProvenanceKind.ADDED);
        const ordinaryChildren = children.filter(child =>
          child.provenance.kind !== ComponentNodeProvenanceKind.ADDED);
        children = resolveOrdering(ordinaryChildren, additions, submorphsNode);
      }
    }

    const typeProperty = propertiesByName.get('type');
    const layoutProperty = propertiesByName.get('layout');
    if (layoutProperty) {
      const parsedLayout = staticTilingResizePolicies(layoutProperty.value);
      if (parsedLayout) {
        const { policies, policiesNode } = parsedLayout;
        const targets = [];
        const references = [];
        let modeled = true;
        for (const policy of policies) {
          const target = children.find(child => child.name === policy.targetName);
          if (!target || targets.includes(target.id)) {
            modeled = false;
            diagnostics.push(diagnostic(
              ComponentSourceDiagnosticKind.UNMODELED_LAYOUT_REFERENCE,
              !target
                ? `Could not resolve layout resize policy target ${policy.targetName}`
                : `Duplicate layout resize policy target ${policy.targetName}`,
              policy.targetNode,
              {
                severity: ComponentSourceDiagnosticSeverity.WARNING,
                ownerId: nodeId,
                targetName: policy.targetName
              }
            ));
            continue;
          }
          targets.push(target.id);
          references.push(resizePolicyLayoutReference({
            targetId: target.id,
            expressionTemplate: resizePolicyExpressionTemplate(source, policy)
          }));
        }
        if (modeled) {
          layoutModels.push(tilingLayoutModel({
            ownerId: nodeId,
            expressionTemplate: layoutExpressionTemplate(
              source,
              layoutProperty.value,
              policiesNode
            ),
            references
          }));
          layoutReferenceLocations[nodeId] = Object.freeze(Object.fromEntries(
            policies.map((policy, index) => [references[index].targetId, Object.freeze({
              kind: references[index].kind,
              target: rangeOf(policy.targetNode),
              entry: rangeOf(policy.entryNode)
            })])
          ));
        }
      } else if (layoutProperty.value?.type === 'NewExpression' &&
                 layoutProperty.value.callee?.type === 'Identifier' &&
                 layoutProperty.value.callee.name === 'TilingLayout') {
        diagnostics.push(diagnostic(
          ComponentSourceDiagnosticKind.UNMODELED_LAYOUT_REFERENCE,
          'TilingLayout resize policies must use a static array to support projection',
          layoutProperty.value,
          { severity: ComponentSourceDiagnosticSeverity.WARNING, ownerId: nodeId }
        ));
      }
    }
    return new ComponentNode({
      id: nodeId,
      name,
      provenance: inheritedBase
        ? inheritedNodeProvenance({
            ...inheritedBase.provenance,
            hasLocalOverrides: true
          })
        : provenance,
      partComponent: partComponent || inheritedBase?.partComponent || null,
      typeExpression: typeProperty
        ? source.slice(typeProperty.value.start, typeProperty.value.end)
        : inheritedBase?.typeExpression || partDocument?.root.typeExpression || null,
      properties: semanticProperties,
      children
    });
  };

  const root = parseNode(specNode, [], true);
  if (!root || diagnostics.some(({ severity }) =>
    severity === ComponentSourceDiagnosticSeverity.ERROR)) {
    return result(null, diagnostics);
  }

  const document = new ComponentDocument({
    componentId,
    moduleId,
    exportName,
    parentComponent: parentNode
      ? sourceComponentReference(source.slice(parentNode.start, parentNode.end))
      : null,
    root,
    layoutModels,
    sourceMetadata: {
      componentRange: rangeOf(componentCall),
      declarationRange: rangeOf(declarator),
      specRange: rangeOf(specNode),
      nodeIdToAstLocation,
      nodeSpecLocations,
      propertyLocations,
      originalExpressions,
      suppressionLocations,
      orderingLocations,
      layoutReferenceLocations,
      opaqueSubmorphExpressions,
      parentDocument,
      resolveComponentDocument,
      importBindings: importBindingsOf(moduleAst),
      importDeclarationCount: moduleAst.body.filter(statement =>
        statement.type === 'ImportDeclaration').length,
      importInsertionIndex: importInsertionIndexOf(moduleAst)
    }
  });
  const invariantDiagnostics = validateComponentDocument(document);
  if (invariantDiagnostics.length) {
    diagnostics.push(...invariantDiagnostics.map(invariant => Object.freeze({
      ...invariant,
      severity: ComponentSourceDiagnosticSeverity.ERROR,
      range: nodeIdToAstLocation[invariant.nodeId] || null
    })));
    return result(null, diagnostics);
  }
  return result(document, diagnostics);
}
