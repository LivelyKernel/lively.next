/*global System*/

import { stringify, transform, nodes, query } from "lively.ast";
import { arr } from "lively.lang";


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function computeImportReplacements(modSpec) {
  let replacements = [], locals = [];
  for (let depModule in modSpec.dependencies) {
    let {varName, imports} = modSpec.dependencies[depModule];
    locals.push(varName);
    for (let imported of imports) {
      let {refs, decls} = query.findReferencesAndDeclsInScope(query.scopes(modSpec.parsed), imported.local);
      for (let ref of refs) {
        replacements.push({
          target: ref,
          replacementFunc: (node, source, wasChanged) =>
            [nodes.member(nodes.id(varName), ref.name)]
        });
      }
    }
  }
  return {locals, replacements};
}

function exportTransformSpecs(modSpec) {
  let exported = [];

  for (let node of modSpec.parsed.body) {
    let {type, declaration, specifiers} = node;
    if (type !== "ExportNamedDeclaration" && type !== "ExportDefaultDeclaration")
      continue;

    let exportTransform = {node, replacement: [], ids: []};
    exported.push(exportTransform);

    if (type === "ExportNamedDeclaration" && specifiers) {
      for (let {local, exported} of specifiers)
        exportTransform.ids.push({local, exported});
      continue;
    }

    if (type === "ExportNamedDeclaration" && declaration) {
      exportTransform.replacement = [declaration];
      switch (declaration.type) {
        case 'VariableDeclaration':
          for (let id of query.helpers.declIds(declaration.declarations.map(ea => ea.id))) {
            exportTransform.ids.push({local: id, exported: id});
          }
          break;
        case 'ClassDeclaration': case 'FunctionDeclaration':
          exportTransform.ids.push({local: declaration.id, exported: declaration.id});
          break;
      }
      continue;
    }

    if (type === "ExportDefaultDeclaration" && declaration) {
      exportTransform.replacement = [declaration];
      let local;
      switch (declaration.type) {
        case 'Identifier': local = declaration; break;
        case 'ClassDeclaration': case 'FunctionDeclaration': local = declaration.id; break;
        default:
          throw new Error(`Strange default export declaration: ${declaration.type}`);
      }
      exportTransform.ids.push({local, exported: {type: "Identifier", name: "default"}});
      continue;
    }
  }

  return exported;
}

export function transformToModuleFunction(modSpec) {
  let {replacements: importReplacements, locals: imported} = computeImportReplacements(modSpec),
      exportTransformData = exportTransformSpecs(modSpec);

  let replaced = transform.replaceNodes([

        // replace references of imported objects with import transform var names
        ...importReplacements,

        // remove import decls completely
        ...modSpec.parsed.body.filter(ea => ea.type === "ImportDeclaration")
                              .map(target => ({target, replacementFunc: () => []})),

        // remove exports
        ...exportTransformData.map(({node, replacement}) =>
           ({target: node, replacementFunc: () => replacement}))
      ], modSpec.source);

  
  let exportGetters = arr.flatmap(exportTransformData, ({ids}) =>
    ids.map(({local, exported}) =>
      nodes.funcCall(
        nodes.member("__exports__", "__defineGetter__"),
        nodes.funcExpr({arrow: true}, [], nodes.returnStmt(local)))));

  // let importDecls = 
  // let exportReturn = nodes.returnStmt(
  //   nodes.objectLiteral(
  //     arr.flatmap(exportTransformData, ({ids}) =>
  //       arr.flatmap(ids, ({local, exported}) =>
  //         [nodes.literal(exported.name), local]))));

  return `function(__imports__, __exports__) {\n`
       + `${exportGetters.map(stringify).join("\n")}`
       + `${replaced.source}\n`
       + `\n}`;
}