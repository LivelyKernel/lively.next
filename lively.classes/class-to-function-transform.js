import { Path, arr } from 'lively.lang';
import { parse, stringify, query, nodes, BaseVisitor as Visitor } from 'lively.ast';
import { queryNodes } from 'lively.ast/lib/query.js';
const acornNodes = {
  exportDefaultDecl: (declaration) => {
    return {
      declaration,
      type: 'ExportDefaultDeclaration'
    };
  },
  conditional: nodes.conditional,
  binaryExpr: (op, left, right) => nodes.binaryExpr(left, op, right),
  logicalExpr: (op, left, right) => nodes.binaryExpr(left, op, right),
  unaryExpr: (operator, argument) => {
    return { type: 'UnaryExpression', operator, argument };
  },
  arrayExpr: (elements) => {
    return {
      elements, type: 'ArrayExpression'
    };
  },
  ifStmt: nodes.ifStmt,
  funcCall: (func, args) => nodes.funcCall(func, ...args),
  id: (name) => nodes.id(name),
  assign: (operator, left, right) => nodes.assign(left, right),
  member: nodes.member,
  block: (stmts) => nodes.block(...stmts),
  literal: (val) => nodes.literal(val),
  property: (kind, key, val) => nodes.prop(key, val),
  returnStmt: nodes.returnStmt,
  arrowFuncExpr: (args, body, generator, isAsync) => nodes.funcExpr({ arrow: true, expression: false, generator, isAsync }, args, ...body.body),
  funcExpr: (id, args, body, generator, isAsync) => nodes.funcExpr({ id, expression: false, generator, isAsync }, args, ...body.body),
  objectLiteral: (props) => nodes.objectLiteral(props.map(prop => [prop.key, prop.value]).flat()),
  varDecl: nodes.varDecl,
  declaration: (kind, declarations) => ({
    type: 'VariableDeclaration',
    kind: kind || 'var',
    declarations: declarations || []
  }),
  declarator: (id, init) => ({
    type: 'VariableDeclarator', id, init
  }),
  parse
};

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

function classFieldsInitialization (nodes, options) {
  const { assign, member, id } = options.nodes;
  return nodes.map(({ key, value }) => {
    let name = key.name;
    if (key.type === 'PrivateIdentifier') name = '_' + name;
    return assign('=', member(id('this'), id(name)), value === null ? id('null') : value);
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

function constructorTemplate (name, fields, options) {
  const n = options.nodes;
  return n.funcExpr(name ? n.id(name) : null, [n.id('__first_arg__')],
    n.block([n.ifStmt(
      n.logicalExpr(
        '&&',
        n.id('__first_arg__'),
        n.member(n.id('__first_arg__'), n.funcCall(n.member(n.id('Symbol'), n.id('for')), [n.literal('lively-instance-restorer')]), true)),
      n.block([]),
      n.block(
        [...classFieldsInitialization(fields, options),
          n.returnStmt(
            n.funcCall(
              n.member(
                n.member(n.id('this'), n.funcCall(n.member(n.id('Symbol'), n.id('for')), [n.literal('lively-instance-initialize')]), true),
                n.id('apply')), [n.id('this'), n.id('arguments')]))]))]));
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

const isTransformedClassVarDeclSymbol = Symbol();
const methodKindSymbol = Symbol();
const tempLivelyClassVar = '__lively_class__';
const tempLivelyClassHolderVar = '__lively_classholder__';

function splitExportDefaultWithClass (node, classHolder, options) {
  const n = options.nodes;
  return !node.declaration || !node.declaration[isTransformedClassVarDeclSymbol]
    ? node
    : [node.declaration, n.exportDefaultDecl(node.declaration.declarations[0].id)];
}

function replaceSuper (node, state, path, options) {
  // just super
  console.assert(node.type === 'Super');
  const n = options.nodes;

  let { currentMethod } = state;
  if (!currentMethod) {
    console.warn(`[lively.classes] Trying to transform es6 class but got super call outside a method! ${stringify(node)} in ${path.join('.')}`);
  }

  let [parentReferencedAs, referencedAs] = path.slice(-2);
  if ((parentReferencedAs === 'callee' && referencedAs === 'object') || referencedAs === 'callee') { return node; } // deal with this in replaceSuperCall

  let methodHolder = currentMethod && currentMethod[methodKindSymbol] === 'static'
    ? n.funcCall(n.member(n.id('Object'), n.id('getPrototypeOf')), [n.id(tempLivelyClassVar)])
    : n.funcCall(n.member(n.id('Object'), n.id('getPrototypeOf')), [n.member(n.id(tempLivelyClassVar), n.id('prototype'))]);

  return methodHolder;
}

function replaceSuperMethodCall (node, state, path, options) {
  // like super.foo()
  console.assert(node.type === 'CallExpression');
  console.assert(node.callee.object.type === 'Super');
  const n = options.nodes;
  return n.funcCall(
    n.member(
      n.funcCall(
        n.member(options.functionNode, n.id('_get')),
        [replaceSuper(node.callee.object, state, path.concat(['callee', 'object']), options),
          n.literal(node.callee.property.value || node.callee.property.name),
          n.id('this')]),
      n.id('call')),
    [n.id('this'), ...node.arguments]);
}

function replaceDirectSuperCall (node, state, path, options) {
  // like super()
  console.assert(node.type === 'CallExpression');
  console.assert(node.callee.type === 'Super');
  const n = options.nodes;
  const f = n.funcCall(
    n.member(
      n.funcCall(
        n.member(options.functionNode, n.id('_get')),
        [replaceSuper(node.callee, state, path.concat(['callee']), options),
          n.funcCall(n.member(n.id('Symbol'), n.id('for')), [n.literal('lively-instance-initialize')]),
          n.id('this')]),
      n.id('call')),
    [n.id('this'), ...node.arguments]);
  return n.assign('=', n.id('_this'), f);
}

function replaceSuperGetter (node, state, path, options) {
  console.assert(node.type === 'MemberExpression');
  console.assert(node.object.type === 'Super');
  const n = options.nodes;
  return n.funcCall(
    n.member(options.functionNode, n.id('_get')),
    [replaceSuper(node.object, state, path.concat(['object']), options),
      n.literal(node.property.value || node.property.name),
      n.id('this')]);
}

function replaceSuperSetter (node, state, path, options) {
  console.assert(node.type === 'AssignmentExpression');
  console.assert(node.left.object.type === 'Super');
  const n = options.nodes;
  return n.funcCall(
    n.member(options.functionNode, n.id('_set')),
    [replaceSuper(node.left.object, state, path.concat(['left', 'object']), options),
      n.literal(node.left.property.value || node.left.property.name),
      node.right,
      n.id('this')]);
}

function checkForDirectSuperCall (body) {
  return queryNodes(body, '// CallExpression [ /:callee \'*\' [ type() ==  \'Super\']]').length > 0;
}

function insertThisReturn (functionBody, options) {
  if (!checkForDirectSuperCall(functionBody)) {
    return functionBody;
  }
  const n = options.nodes;
  return {
    // block
    ...functionBody,
    body: [
      n.varDecl(n.id('_this')),
      ...functionBody.body,
      n.returnStmt(n.id('_this'))
    ]
  };
}

function replaceClass (node, state, options) {
  console.assert(node.type === 'ClassDeclaration' || node.type === 'ClassExpression');
  const n = options.nodes;
  let { body: { body }, superClass, id: classId, type, start, end } = node;
  let { addClassNameGetter = true } = options;
  let instanceProps = n.id('undefined');
  let classProps = n.id('undefined');
  let className = classId ? classId.name : 'anonymous_class';
  let evalId = options.evalId;
  let sourceAccessorName = options.sourceAccessorName;
  let loc = { start, end, ...node['x-lively-object-meta'] || {} };
  const validMemberIdentifiers = ['Literal', 'StringLiteral', 'Identifier', 'PrivateIdentifier', 'MemberExpression', 'CallExpression'];

  let { inst, clazz, fields } = body.reduce((props, propNode) => {
    let decl; let { key, kind, value, static: classSide, type } = propNode;
    if (!value) value = propNode;

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
        methodId = n.id(className + '_' + stringify(key.property).replaceAll('.', '_') + '_');
      } else methodId = n.id(className + '_' + ensureIdentifier(methodName || Path('arguments.0.value').get(key)) + '_');

      let props = [
        n.property('init', n.id('key'), !isMemberExpr && methodName ? n.literal(methodName) : key),

        n.property('init', n.id('value'), (value = n.funcExpr(methodId, value.params, value.body, value.generator, value.async), value[methodKindSymbol] = classSide ? 'static' : 'proto', value))];

      decl = n.objectLiteral(props);
    } else if (kind === 'get' || kind === 'set') {
      decl = n.objectLiteral([
        n.property('init', n.id('key'), n.literal(key.name || key.value || Path('property.name').get(key))),
        n.property('init', n.id(kind), (value = n.funcExpr(n.id(kind), value.params, value.body, value.generator, value.async), value[methodKindSymbol] = classSide ? 'static' : 'proto', value))]);
    } else if (kind === 'constructor') {
      let props = [
        n.property('init', n.id('key'), n.funcCall(n.member(n.id('Symbol'), n.id('for')), [n.literal('lively-instance-initialize')])),
        n.property('init', n.id('value'), (value = n.funcExpr(
          n.id(className + '_initialize_'),
          value.params,
          insertThisReturn(value.body, options),
          value.generator, value.async
        ), value[methodKindSymbol] = 'proto', value))];
      decl = n.objectLiteral(props);
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
          n.parse(`({ key: Symbol.for("__LivelyClassName__"), get: function get() { return "${className}"; } })`).body[0].expression
        ]
      : []
  });

  if (inst.length) instanceProps = n.arrayExpr(inst);
  if (clazz.length) classProps = n.arrayExpr(clazz);

  let scope = options.scope;
  let superClassReferencedAs;
  let superClassRef;

  if (superClass && options.currentModuleAccessor) {
    if (options.classHolder === superClass.object) {
      superClassRef = superClass;
      superClassReferencedAs = superClass.property.name;
    } else {
      let found = scope?.resolvedRefMap?.get(superClass);
      let isTopLevel = found?.decl && scope.decls?.find(([decl]) => decl === found.decl);
      if (isTopLevel) {
        superClassRef = superClass;
        superClassReferencedAs = superClass.name;
      }
    }
  }

  let superClassSpec = superClassRef
  // this is inserting incorrect nodes into the ast since scope ist always acorn nodes
    ? n.objectLiteral([n.property('init', n.id('referencedAs'), n.literal(superClassReferencedAs)), n.property('init', n.id('value'), superClassRef)])
    : superClass || n.id('undefined');

  // For persistent storage and retrieval of pre-existing classes in "classHolder" object
  let { useClassHolder = classId && (type === 'ClassDeclaration' || type === 'ClassExpression') } = options; // if the class is assigned this will not work

  let locKeyVals = [n.property('init', n.id('start'), n.literal(loc.start)), n.property('init', n.id('end'), n.literal(loc.end))];
  if (typeof evalId !== 'undefined') locKeyVals.push(n.property('init', n.id('evalId'), n.literal(evalId)));
  if (sourceAccessorName) locKeyVals.push(n.property('init', n.id('moduleSource'), nodes.id(sourceAccessorName)));
  let locNode = n.objectLiteral(locKeyVals);
  let funcParts = [[n.id('superclass')],
    n.block([
      n.varDecl(n.id(tempLivelyClassHolderVar), state.classHolder),
      ...useClassHolder
        ? [n.varDecl(n.id(tempLivelyClassVar),
            n.conditional(
              n.logicalExpr(
                '&&',
                n.funcCall(n.member(n.id(tempLivelyClassHolderVar), n.id('hasOwnProperty')), [n.literal(classId.name)]),
                n.binaryExpr(
                  '===',
                  n.unaryExpr('typeof', n.member(n.id(tempLivelyClassHolderVar), classId), true),
                  n.literal('function'))),
              n.member(n.id(tempLivelyClassHolderVar), classId),
              n.assign(
                '=',
                n.member(n.id(tempLivelyClassHolderVar), classId),
                constructorTemplate(classId.name, fields, options)))
          )]
        : classId
          ? [n.varDecl(classId, constructorTemplate(classId.name, fields, options)), n.varDecl(n.id(tempLivelyClassVar), classId)]
          : [n.varDecl(n.id(tempLivelyClassVar), constructorTemplate(null, fields, options))],
      n.ifStmt(n.funcCall(n.member(n.id('Object'), n.id('isFrozen')), [n.id(tempLivelyClassHolderVar)]), n.block([n.returnStmt(n.id(tempLivelyClassVar))]), null),
      n.returnStmt(
        n.funcCall(
          options.functionNode,
          [n.id(tempLivelyClassVar),
            n.id('superclass'),
            instanceProps, classProps,
            useClassHolder ? n.id(tempLivelyClassHolderVar) : n.id('null'),
            options.currentModuleAccessor || n.id('undefined'),
            locNode]
        ))])];

  if (type === 'ClassExpression') return n.funcCall(n.arrowFuncExpr(...funcParts), [superClassSpec]);

  let result = n.funcCall(n.funcExpr(null, ...funcParts), [superClassSpec]);

  if (options.declarationWrapper && state.classHolder === options.classHolder /* i.e. toplevel */) {
    result = n.funcCall(
      options.declarationWrapper,
      [n.literal(classId.name),
        n.literal('class'),
        result,
        options.classHolder,
        locNode]);
  }

  // since it is a declaration and we removed the class construct we need to add a var-decl
  result = n.varDecl(classId, result, 'var');
  result[isTransformedClassVarDeclSymbol] = true;

  return result;
}

function replacePrivateIdentifier (node, options) {
  return options.nodes.id('_' + node.name);
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
        classHolder: nodes.objectLiteral([]),
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
export function classToFunctionTransformBabel (path, state, options) {
  function getPropPath (path) {
    const propPath = [path.name];
    while (path = path.parent) {
      propPath.push(String(path.name));
    }
    return propPath;
  }

  function handleFunctionDefinition (path, state) {
    const { nodes: n } = options;
    const { classHolder, currentMethodStack, currentMethod } = state;
    currentMethodStack.push(path.node[methodKindSymbol] ? path.node : currentMethod);
    state.currentMethod = arr.last(currentMethodStack);
  }

  function handleClass (path, state) {
    const { node } = path;
    if (node._skipClassHolder) options.useClassHolder = false;

    path.replaceWith(replaceClass(node, state, options));
    path.traverse(this.visitor, state);
    delete options.useClassHolder;
  }

  const currentMethodStack = [];
  Object.assign(state, {
    classHolder: options.classHolder || options.nodes.objectLiteral([]),
    currentMethodStack
  });

  path.traverse({
    'ArrowFunctionExpression|FunctionDeclaration|FunctionExpression': {
      enter: handleFunctionDefinition,
      exit (path, state) {
        state.currentMethodStack.pop();
        state.currentMethod = arr.last(state.currentMethodStack);
      }
    },

    ClassExpression (path, state) {
      handleClass.bind(this)(path, state);
    },

    ClassDeclaration (path, state) {
      handleClass.bind(this)(path, state);
    },

    VariableDeclarator (path, state) {
      const { node } = path;
      if (node.init?.type === 'ClassExpression' || node.init?.type === 'ClassDeclaration') {
        node.init._skipClassHolder = true;
      }
    },

    AssignmentExpression (path, state) {
      const { node } = path;
      if (node.right?.type === 'ClassExpression' || node.right?.type === 'ClassDeclaration') {
        node.right._skipClassHolder = true;
      }
      if (node.left.type === 'MemberExpression' && node.left.object.type === 'Super') {
        path.replaceWith(replaceSuperSetter(node, state, getPropPath(path), options));
      }
    },

    PrivateName (path, state) {
      path.replaceWith(replacePrivateIdentifier(path.node, options));
      path.skip();
    },

    Super (path, state) {
      path.replaceWith(replaceSuper(path.node, state, getPropPath(path), options));
      path.skip();
    },

    MemberExpression (path, state) {
      const { node } = path;
      if (node.object?.type === 'Super') {
        path.replaceWith(replaceSuperGetter(node, state, getPropPath(path), options));
      }
    },

    CallExpression (path, state) {
      const { node } = path;
      if (node.callee.type === 'Super') {
        path.replaceWith(replaceDirectSuperCall(node, state, getPropPath(path), options));
      }
      if (node.callee.object && node.callee.object.type === 'Super') {
        path.replaceWith(replaceSuperMethodCall(node, state, getPropPath(path), options));
      }
    },

    ExportDefaultDeclaration (path, state) {
      const { node } = path;
      const { nodes: n } = options;
      if (node.declaration.type === 'ClassDeclaration') {
        path.insertAfter([replaceClass(node.declaration, state, options), n.exportDefaultDecl(node.declaration.id)]);
        path.remove();
      }
    }
  }, state);
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
  if (!options.nodes) options = { ...options, nodes: acornNodes };

  let replaced = ClassReplaceVisitor.run(parsed, options);

  return replaced;
}
