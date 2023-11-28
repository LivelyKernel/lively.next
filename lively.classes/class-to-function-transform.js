import { Path } from 'lively.lang';
import { parse, stringify, query, nodes, BaseVisitor as Visitor } from 'lively.ast';
import { queryNodes } from 'lively.ast/lib/query.js';

let {
  assign,
  member,
  id,
  funcCall,
  literal,
  objectLiteral,
  varDecl,
  funcExpr,
  returnStmt,
  binaryExpr,
  ifStmt,
  block
} = nodes;

function isFunctionNode (node) {
  return node.type === 'ArrowFunctionExpression' ||
       node.type === 'FunctionExpression' ||
       node.type === 'FunctionDeclaration';
}

const firstIdRe = /^[^_a-z]/i;
const trailingIdRe = /[^_a-z0-9]/ig;
function ensureIdentifier (name) {
  return name
    .replace(firstIdRe, '_')
    .replace(trailingIdRe, '_');
}

function classFieldsInitialization (nodes) {
  return nodes.map(({ key, value }) => {
    let name = key.name;
    if (key.type === 'PrivateIdentifier') name = '_' + name;
    return assign(member('this', name), value);
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/**
 * Transforms a class definition to a function like:
 * function CLASS() {
 *   var firstArg = arguments[0];
 *   if (firstArg && firstArg[Symbol.for("lively-instance-restorer")]) {
 *     // for deserializing instances just do nothing
 *   } else {
 *     this._privateField1 = field1Value;
 *     this._field2 = field2Value;
 *     // automatically call the initialize method
 *     this[Symbol.for("lively-instance-initialize")].apply(this, arguments);
 *   }
 * }
 * @param {string} name - The name of the class that is being defined.
 * @param {object[]} fields - The set of custom class fields that were defined by the code.
 */
function constructorTemplate (name, fields) {
  return funcExpr({ id: name ? id(name) : null }, ['__first_arg__'],
    ifStmt(
      binaryExpr(
        id('__first_arg__'),
        '&&',
        member('__first_arg__', funcCall(member('Symbol', 'for'), literal('lively-instance-restorer')), true)),
      block(),
      block(
        ...classFieldsInitialization(fields),
        returnStmt(
          funcCall(
            member(
              member('this', funcCall(member('Symbol', 'for'), literal('lively-instance-initialize')), true),
              'apply'), id('this'), id('arguments'))))));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isTransformedClassVarDeclSymbol = Symbol();
const methodKindSymbol = Symbol();
const tempLivelyClassVar = '__lively_class__';
const tempLivelyClassHolderVar = '__lively_classholder__';

function splitExportDefaultWithClass (node, classHolder, path, options) {
  return !node.declaration || !node.declaration[isTransformedClassVarDeclSymbol]
    ? node
    : [node.declaration, {
        declaration: node.declaration.declarations[0].id,
        type: 'ExportDefaultDeclaration'
      }];
}

function replaceSuper (node, state, path, options) {
  // just super
  console.assert(node.type === 'Super');

  let { currentMethod } = state;
  if (!currentMethod) {
    console.warn(`[lively.classes] Trying to transform es6 class but got super call outside a method! ${stringify(node)} in ${path.join('.')}`);
  }

  let [parentReferencedAs, referencedAs] = path.slice(-2);
  if ((parentReferencedAs === 'callee' && referencedAs === 'object') || referencedAs === 'callee') { return node; } // deal with this in replaceSuperCall

  let methodHolder = currentMethod && currentMethod[methodKindSymbol] === 'static'
    ? funcCall(member('Object', 'getPrototypeOf'), id(tempLivelyClassVar))
    : funcCall(member('Object', 'getPrototypeOf'), member(id(tempLivelyClassVar), 'prototype'));

  return methodHolder;
}

function replaceSuperMethodCall (node, state, path, options) {
  // like super.foo()
  console.assert(node.type === 'CallExpression');
  console.assert(node.callee.object.type === 'Super');

  return funcCall(
    member(
      funcCall(
        member(options.functionNode, '_get'),
        replaceSuper(node.callee.object, state, path.concat(['callee', 'object']), options),
        literal(node.callee.property.value || node.callee.property.name),
        id('this')),
      'call'),
    id('this'), ...node.arguments);
}

function replaceDirectSuperCall (node, state, path, options) {
  // like super()
  console.assert(node.type === 'CallExpression');
  console.assert(node.callee.type === 'Super');
  const f = funcCall(
    member(
      funcCall(
        member(options.functionNode, '_get'),
        replaceSuper(node.callee, state, path.concat(['callee']), options),
        funcCall(member('Symbol', 'for'), literal('lively-instance-initialize')),
        id('this')),
      'call'),
    id('this'), ...node.arguments);
  return assign(id('_this'), f);
}

function replaceSuperGetter (node, state, path, options) {
  console.assert(node.type === 'MemberExpression');
  console.assert(node.object.type === 'Super');
  return funcCall(
    member(options.functionNode, '_get'),
    replaceSuper(node.object, state, path.concat(['object']), options),
    literal(node.property.value || node.property.name),
    id('this'));
}

function replaceSuperSetter (node, state, path, options) {
  console.assert(node.type === 'AssignmentExpression');
  console.assert(node.left.object.type === 'Super');

  return funcCall(
    member(options.functionNode, '_set'),
    replaceSuper(node.left.object, state, path.concat(['left', 'object']), options),
    literal(node.left.property.value || node.left.property.name),
    node.right,
    id('this'));
}

function checkForDirectSuperCall (body) {
  return queryNodes(body, '// CallExpression [ /:callee \'*\' [ type() ==  \'Super\']]').length > 0;
}

function insertThisReturn (functionBody) {
  if (!checkForDirectSuperCall(functionBody)) {
    return functionBody;
  }
  return {
    // block
    ...functionBody,
    body: [
      varDecl(id('_this')),
      ...functionBody.body,
      returnStmt(id('_this'))
    ]
  };
}

function replaceClass (node, state, path, options) {
  console.assert(node.type === 'ClassDeclaration' || node.type === 'ClassExpression');

  let { body: { body }, superClass, id: classId, type, start, end } = node;
  let { addClassNameGetter = true } = options;
  let instanceProps = id('undefined');
  let classProps = id('undefined');
  let className = classId ? classId.name : 'anonymous_class';
  let evalId = options.evalId;
  let sourceAccessorName = options.sourceAccessorName;
  let loc = node['x-lively-object-meta'] || { start, end };
  const validMemberIdentifiers = ['Literal', 'Identifier', 'PrivateIdentifier', 'MemberExpression', 'CallExpression'];

  let { inst, clazz, fields } = body.reduce((props, propNode) => {
    let decl; let { key, kind, value, static: classSide, type } = propNode;

    if (!validMemberIdentifiers.includes(key.type)) {
      console.warn(`Unexpected key in classToFunctionTransform! ${JSON.stringify(key)} -> ${stringify(propNode)}`);
    }

    // all of the cases below may contain code blocks, that potentially reference private identifiers
    // which we translate to underscore vars. These need to be transformed as well.
    if (kind === 'method') {
      // The name is just for debugging purposes when it appears in
      // native debuggers. We have to be careful about it b/c it shadows
      // outer functions / vars, something that is totally not apparent for a user
      // of the class syntax. That's the reason for making it a little cryptic
      const isMemberExpr = key.type === 'MemberExpression';
      let methodName = key.name || key.value || Path('property.name').get(key);
      let methodId;
      if (isMemberExpr) {
        methodId = id(className + '_' + stringify(key.property).replaceAll('.', '_') + '_');
      } else methodId = id(className + '_' + ensureIdentifier(methodName || Path('arguments.0.value').get(key)) + '_');
      let props = [
        'key', !isMemberExpr && methodName ? literal(methodName) : key,
        'value', { ...value, id: methodId, [methodKindSymbol]: classSide ? 'static' : 'proto' }];

      decl = objectLiteral(props);
    } else if (kind === 'get' || kind === 'set') {
      decl = objectLiteral([
        'key', literal(key.name || key.value || Path('property.name').get(key)),
        kind, Object.assign({}, value, { id: id(kind), [methodKindSymbol]: classSide ? 'static' : 'proto' })]);
    } else if (kind === 'constructor') {
      let props = [
        'key', funcCall(member('Symbol', 'for'), literal('lively-instance-initialize')),
        'value', {
          ...value,
          id: id(className + '_initialize_'),
          [methodKindSymbol]: 'proto',
          body: insertThisReturn(value.body)
        }];
      decl = objectLiteral(props);
    } else if (type === 'PropertyDefinition') {
      // collect these for class field initializiation
      props.fields.push(propNode);
    } else {
      console.warn(`[lively.classes] classToFunctionTransform encountered unknown class property with kind ${kind}, ignoring it, ${JSON.stringify(propNode)} -> ${stringify(propNode)}`);
    }
    if (decl) (classSide ? props.clazz : props.inst).push(decl);
    return props;
  }, {
    inst: [],
    fields: [],
    clazz: addClassNameGetter
      ? [
          // explicitly add in a static property to ensure the class name is accessible also in google closure env
          parse(`({ key: Symbol.for("__LivelyClassName__"), get: function get() { return "${className}"; } })`).body[0].expression
        ]
      : []
  });

  if (inst.length) instanceProps = { type: 'ArrayExpression', elements: inst };
  if (clazz.length) classProps = { type: 'ArrayExpression', elements: clazz };

  let scope = options.scope;
  let superClassReferencedAs;
  let superClassRef;

  if (superClass && options.currentModuleAccessor) {
    if (options.classHolder === superClass.object) {
      superClassRef = superClass;
      superClassReferencedAs = superClass.property.name;
    } else {
      let found = scope && scope.resolvedRefMap && scope.resolvedRefMap.get(superClass);
      let isTopLevel = found && found.decl && scope.decls && scope.decls.find(([decl]) => decl === found.decl);
      if (isTopLevel) {
        superClassRef = superClass;
        superClassReferencedAs = superClass.name;
      }
    }
  }

  let superClassSpec = superClassRef
    ? objectLiteral(['referencedAs', literal(superClassReferencedAs), 'value', superClassRef])
    : superClass || id('undefined');

  // For persistent storage and retrieval of pre-existing classes in "classHolder" object
  let { useClassHolder = classId && (type === 'ClassDeclaration' || type === 'ClassExpression') } = options; // if the class is assigned this will not work

  let locKeyVals = ['start', literal(loc.start), 'end', literal(loc.end)];
  if (typeof evalId !== 'undefined') locKeyVals.push('evalId', literal(evalId));
  if (sourceAccessorName) locKeyVals.push('moduleSource', nodes.id(sourceAccessorName));
  let locNode = objectLiteral(locKeyVals);

  let classCreator =
    funcCall(
      funcExpr({}, ['superclass'],
        varDecl(tempLivelyClassHolderVar, state.classHolder),
        varDecl(tempLivelyClassVar,
          useClassHolder
            ? {
                type: 'ConditionalExpression',
                test: binaryExpr(
                  funcCall(member(tempLivelyClassHolderVar, 'hasOwnProperty'), literal(classId.name)),
                  '&&',
                  binaryExpr(
                    {
                      argument: member(tempLivelyClassHolderVar, classId),
                      operator: 'typeof',
                      prefix: true,
                      type: 'UnaryExpression'
                    }, '===', literal('function'))),
                consequent: member(tempLivelyClassHolderVar, classId),
                alternate: assign(
                  member(tempLivelyClassHolderVar, classId),
                  constructorTemplate(classId.name, fields))
              }
            : classId ? constructorTemplate(classId.name, fields) : constructorTemplate(null, fields)),
        ifStmt(funcCall(member(id('Object'), id('isFrozen')), id(tempLivelyClassHolderVar)), block(returnStmt(id(tempLivelyClassVar))), false),
        returnStmt(
          funcCall(
            options.functionNode,
            id(tempLivelyClassVar),
            id('superclass'),
            instanceProps, classProps,
            useClassHolder ? id(tempLivelyClassHolderVar) : id('null'),
            options.currentModuleAccessor || id('undefined'),
            locNode
          ))),
      superClassSpec);

  if (type === 'ClassExpression') return classCreator;

  let result = classCreator;

  if (options.declarationWrapper && state.classHolder === options.classHolder /* i.e. toplevel */) {
    result = funcCall(
      options.declarationWrapper,
      literal(classId.name),
      literal('class'),
      result,
      options.classHolder,
      locNode);
  }

  // since it is a declaration and we removed the class construct we need to add a var-decl
  result = varDecl(classId, result, 'var');
  result[isTransformedClassVarDeclSymbol] = true;

  return result;
}

function replacePrivateIdentifier (node) {
  return { ...node, type: 'Identifier', name: '_' + node.name };
}

/**
 * Custom AST transform visitor that applies all the different transformations
 * we need to implement the custom lively class notation.
 */
class ClassReplaceVisitor extends Visitor {
  accept (node, state, path) {
    if (isFunctionNode(node)) {
      state = {
        ...state,
        classHolder: objectLiteral([]),
        currentMethod: node[methodKindSymbol] ? node : state.currentMethod
      };
    }

    if (node.type === 'ClassExpression' || node.type === 'ClassDeclaration') {
      if (node._skipClassHolder) state.options.useClassHolder = false;
      node = replaceClass(node, state, path, state.options);
      delete state.options.useClassHolder;
    }

    if (node.type === 'VariableDeclarator' && (node.init?.type === 'ClassExpression' || node.init?.type === 'ClassDeclaration')) {
      node.init._skipClassHolder = true;
    }

    if (node.type === 'AssignmentExpression' && (node.right?.type === 'ClassExpression' || node.right?.type === 'ClassDeclaration')) {
      node.right._skipClassHolder = true;
    }

    if (node.type === 'PrivateIdentifier') node = replacePrivateIdentifier(node);

    if (node.type === 'Super') { node = replaceSuper(node, state, path, state.options); }

    if (node.type === 'MemberExpression' && node.object && node.object.type === 'Super') { node = replaceSuperGetter(node, state, path, state.options); }

    if (node.type === 'AssignmentExpression' && node.left.type === 'MemberExpression' && node.left.object.type === 'Super') { node = replaceSuperSetter(node, state, path, state.options); }

    if (node.type === 'CallExpression' && node.callee.type === 'Super') { node = replaceDirectSuperCall(node, state, path, state.options); }

    if (node.type === 'CallExpression' && node.callee.object && node.callee.object.type === 'Super') { node = replaceSuperMethodCall(node, state, path, state.options); }

    node = super.accept(node, state, path);

    if (node.type === 'ExportDefaultDeclaration') {
      return splitExportDefaultWithClass(node, state, path, state.options);
    }

    return node;
  }

  static run (parsed, options) {
    let v = new this();
    let classHolder = options.classHolder || objectLiteral([]);
    return v.accept(parsed, { options, classHolder }, []);
  }
}

/**
 * From
 *   class Foo extends SuperFoo { m() { return 2 + super.m() }}
 * produces something like
 *   createOrExtend({}, {referencedAs: "SuperFoo", value: SuperFoo}, "Foo2", [{
 *     key: "m",
 *     value: function m() {
 *       return 2 + this.constructor[superclassSymbol].prototype.m.call(this);
 *     }
 *   }])
 * @param {string|object} sourceOrAst - The sourcecode or AST to apply the transformation to.
 * @param { object } options
 * @parma { object } options.functionNode
 * @param { string } options.classHolder
 */
export function classToFunctionTransform (sourceOrAst, options) {
  let parsed = typeof sourceOrAst === 'string' ? parse(sourceOrAst) : sourceOrAst;
  options.scope = query.resolveReferences(query.scopes(parsed));

  let replaced = ClassReplaceVisitor.run(parsed, options);

  return replaced;
}
