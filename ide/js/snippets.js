import { Snippet } from "../../text/snippets.js";


var _snippets = [

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // # typeof tests
  ["typef", 'typeof ${0:object} === "function"$1'],
  ["types", 'typeof ${0:object} === "string"$1'],
  ["typen", 'typeof ${0:object} === "number"$1'],
  ["typeu", 'typeof ${0:object} === "undefined"$1'],
  ["typenu", 'typeof ${0:object} !== "undefined"$1'],

// ["afun", ],
// async function ${1?:functionName}(${2}) {${0}}
// ["afn", ],
// async function(${1}) {${0}}
// ["af", ],
// async ${1:(${2:arg})} => ${0}
// ["fun*", ],
// function* ${1?:functionName}(${2}) {${0}}
// ["fn*", ],
// regex /((=)\s*|(:)\s*|(\()|\b)/fn\*/
// function*($2) {${0:$TM_SELECTED_TEXT}}${M2?;}${M3?,}

  ["import", 'import { ${0:name} } from "${1:module}";'],
  ["importd", 'import ${0:name} from "${1:module}";'],
  ["import*", 'import * as ${0:name} from "${1:module}";'],
  
// ["export", ],
// regex /\b/expo?r?t?/
// export { ${0:name} };
// # strings
// ["$", ],
// \${${0:code}}
// ["destr_assign", ],
// regex /(var|let|const)(\s+)?/{\s*/}?/
// ${M1?:var}${M2?: }{${1:prop}} = ${0:expr}

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // classes
  
  ["subclass", 'class ${0:name} extends ${1:base} {\n  constructor(${2:args}) {\n    super(${3:args})\n    $4\n  }\n}'],
  ["class", 'class ${0:name} {\n  constructor(${1:args}) {\n    $2\n  }\n}'],

  // control flow
  ["switch", `switch (\${0:expression}) {
  case '\${2:case}':
    \${3:// code}
    break;
    \$4
    default:
    \${1:// code}
}`],

  ["try", "try {${0:/* code */}} catch (e) {}"],

  ["do", "do {${1:/* code */}} while (${0:/* condition */});"],
  
  
  ["fori", 'for (var ${0:prop} in ${1:obj}) {\n  ${2:obj[prop]}\n}'],
  ["foro", 'for (let ${0:value} of ${1:iterable}) {\n  ${2:value}\n}'],
  
  
  ["for-", 'for (var ${0:i} = ${1:list}.length; ${2:i}--; ) {\n  $3\n}'],
  
  ["for", 'for (var ${0:i} = 0; ${1:i} < ${3:list}.length; ${2:i}++) {\n  $4\n}'],


  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // js vocabulary
  ["Prom", "new Promise((resolve, reject) => {$0})"],
  ["keys", "Object.keys($0)"],
  ["assign", "Object.assign(${0:dest}, ${1:source})"],

  ["forE", "forEach(${0:ea} => $1)"],
  ["map", "map(${0:ea} => $1)"],
  ["reduce", "reduce((${1:all}, ${2:ea}) => {$3}, ${0:init})"],
  ["last", "arr.last(${0:list})"],
  ["pluck", "arr.pluck(${0:list}, \"${1:key}\")"],
  ["sortBy", "arr.sortBy(${0:list}, ($1) => $2)"],
  ["join", 'join("\\n")'],

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // # addScript
  // regex /(\.?[^\.\s]+|^\s*)/\.?addSc?r?i?p?t?/
  // ${M1?:${1:morph}}.addScript(function ${2:scriptName}(${3}) {${0}});

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // lively.bindings.connect
  ["con", "connect(${0:source}, '${1:sourceAttr}', ${2:target}, '${3:targetAttr}');"],
  ["once", "once(${0:source}, '${1:sourceAttr}', ${2:target}, '${3:targetAttr}');"],
  ["sig", "signal(${0:source}, '${1:sourceAttr}', ${2:value});"],

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // # lively.lang

  ["ll",  "lively.lang."],
  ["lls", "lively.lang.string."],
  ["lla", "lively.lang.arr."],
  ["llo", "lively.lang.obj."],
  ["llf", "lively.lang.fun."],
  ["llp", "lively.lang.promise."],

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // morphic stuff

  ["withA", "withAllSubmorphsDo(ea => { return ${0:ea}; })"],
  ["$w", "$world"],
  ["$m", "$morph('${0:name}')"],
  ["get", 'get("${0:name}")'],

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // string stuff
  ["$", "${$0}"],
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // console, debugging
  ["cl", "console.log($0)"],
  ["cw", "console.warn($0)"],
  ["ce", "console.error($0)"],
  ["s", "show(`$0`);"],

  ["l2lC", 'import L2LClient from "lively.2lively/client.js";\nvar l2lClient = L2LClient.default();$0'],
  
  // functions
  ["fun", "function ${0:functionName}($1) {$2}"],
  ["fn", "function($0) {$1}"],
  ["f", "($0) => $1"],

  ["aw", "await $0"],

]

export var snippets = _snippets.map(([trigger, expansion]) => new Snippet({trigger, expansion}));

// # setTimeout function
// snippet setTimeout
// regex /\b/st|timeout|setTimeo?u?t?/
// setTimeout(function() {${0:$TM_SELECTED_TEXT}}, ${1:100});
// 
// snippet setInterval
// regex /\b/int|setI?n?t?e?r?v?a?l?/
// var i = setInterval(function() {${0:$TM_SELECTED_TEXT}}, ${1:1000});
// clearInterval(i);
// 
// 
// 
// # session snippet
// snippet getS
// var s = lively.net.SessionTracker.getSession();
// 
// snippet shell
// var {code, output} = await lively.shell.run("${1:command}");
// 

// 
// # hasOwnProperty
// snippet has
// hasOwnProperty(${1})
// 
// # block comment
// snippet /*
// /*
//  * ${1:description}
//  */
// 
// # JSON.parse
// snippet jsonp
// JSON.parse(${1:jstr});
// 
// # JSON.stringify
// snippet jsons
// JSON.stringify(${1:object});
// 

// 
// # mocha / chai / expect
// snippet describe
// regex /^\s*/desc?r?i?b?e?/
// describe("${1:test-subject}", () => {
// ${0}
// });
// snippet it
// it("${1:tested-action}", () => {
// ${0}
// });
// 
// snippet beforeEach
// regex /^\s*/before?E?a?c?h?/
// beforeEach(${1:done} => {
// ${0}
// });
// 
// snippet afterEach
// regex /^\s*/after?E?a?c?h?/
// afterEach(() => {
// ${0}
// });
// 
// 

// 
// #
// # $world snippets
// snippet prompt
// \$world.prompt("${1:query text}", input => {
// if (!input) return;
// ${0}
// }, {useLastInput: true, input: "${2:initial input}", historyId: "${3:prompt-id}"});
// snippet confirm
// \$world.confirm("${1:query text}", input => {
// if (!input) return;
// ${0}
// });
// 
// 
