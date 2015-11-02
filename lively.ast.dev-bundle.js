(function(b){function a(b,d){if({}.hasOwnProperty.call(a.cache,b))return a.cache[b];var e=a.resolve(b);if(!e)throw new Error('Failed to resolve module '+b);var c={id:b,require:a,filename:b,exports:{},loaded:!1,parent:d,children:[]};d&&d.children.push(c);var f=b.slice(0,b.lastIndexOf('/')+1);return a.cache[b]=c.exports,e.call(c.exports,c,c.exports,f,b),c.loaded=!0,a.cache[b]=c.exports}a.modules={},a.cache={},a.resolve=function(b){return{}.hasOwnProperty.call(a.modules,b)?a.modules[b]:void 0},a.define=function(b,c){a.modules[b]=c};var c=function(a){return a='/',{title:'browser',version:'v0.10.26',browser:!0,env:{},argv:[],nextTick:b.setImmediate||function(a){setTimeout(a,0)},cwd:function(){return a},chdir:function(b){a=b}}}();a.define('/tools/entry-point.js',function(c,d,e,f){!function(){'use strict';b.escodegen=a('/escodegen.js',c),escodegen.browser=!0}()}),a.define('/escodegen.js',function(d,c,e,f){!function(k,e,af,N,_,m,J,n,F,y,Z,ae,S,ad,i,f,W,ac,L,aa,s,Y,B,C,x,a9,a7,v,E,G,V,Q,q,U,P,g,R,a6,X,l,z,K,a5,a4){'use strict';function ap(a){return o.Expression.hasOwnProperty(a.type)}function a3(a){return o.Statement.hasOwnProperty(a.type)}function a2(){return{indent:null,base:null,parse:null,comment:!1,format:{indent:{style:'    ',base:0,adjustMultilineComment:!1},newline:'\n',space:' ',json:!1,renumber:!1,hexadecimal:!1,quotes:'single',escapeless:!1,compact:!1,parentheses:!0,semicolons:!0,safeConcatenation:!1,preserveBlankLines:!1},moz:{comprehensionExpressionStartsWithAssignment:!1,starlessGenerator:!1},sourceMap:null,sourceMapRoot:null,sourceMapWithCode:!1,directive:!1,raw:!0,verbatim:null,sourceCode:null}}function H(b,a){var c='';for(a|=0;a>0;a>>>=1,b+=b)a&1&&(c+=b);return c}function am(a){return/[\r\n]/g.test(a)}function r(b){var a=b.length;return a&&m.code.isLineTerminator(b.charCodeAt(a-1))}function a0(c,b){var a;for(a in b)b.hasOwnProperty(a)&&(c[a]=b[a]);return c}function T(b,d){function e(a){return typeof a==='object'&&a instanceof Object&&!(a instanceof RegExp)}var a,c;for(a in d)d.hasOwnProperty(a)&&(c=d[a],e(c)?e(b[a])?T(b[a],c):b[a]=T({},c):b[a]=c);return b}function ao(c){var b,e,a,f,d;if(c!==c)throw new Error('Numeric literal whose value is NaN');if(c<0||c===0&&1/c<0)throw new Error('Numeric literal whose value is negative');if(c===1/0)return y?'null':Z?'1e400':'1e+400';if(b=''+c,!Z||b.length<3)return b;e=b.indexOf('.'),!y&&b.charCodeAt(0)===48&&e===1&&(e=0,b=b.slice(1)),a=b,b=b.replace('e+','e'),f=0,(d=a.indexOf('e'))>0&&(f=+a.slice(d+1),a=a.slice(0,d)),e>=0&&(f-=a.length-e-1,a=+(a.slice(0,e)+a.slice(e+1))+''),d=0;while(a.charCodeAt(a.length+d-1)===48)--d;return d!==0&&(f-=d,a=a.slice(0,d)),f!==0&&(a+='e'+f),(a.length<b.length||ae&&c>1e12&&Math.floor(c)===c&&(a='0x'+c.toString(16)).length<b.length)&&+a===c&&(b=a),b}function a8(a,b){return(a&-2)===8232?(b?'u':'\\u')+(a===8232?'2028':'2029'):a===10||a===13?(b?'':'\\')+(a===10?'n':'r'):String.fromCharCode(a)}function aq(d){var g,a,h,e,i,b,f,c;if(a=d.toString(),d.source){if(g=a.match(/\/([^/]*)$/),!g)return a;for(h=g[1],a='',f=!1,c=!1,e=0,i=d.source.length;e<i;++e)b=d.source.charCodeAt(e),c?(a+=a8(b,c),c=!1):(f?b===93&&(f=!1):b===47?a+='\\':b===91&&(f=!0),a+=a8(b,c),c=b===92);return'/'+a+'/'+h}return a}function ar(a,c){var b;return a===8?'\\b':a===12?'\\f':a===9?'\\t':(b=a.toString(16).toUpperCase(),y||a>255?'\\u'+'0000'.slice(b.length)+b:a===0&&!m.code.isDecimalDigit(c)?'\\0':a===11?'\\x0B':'\\x'+'00'.slice(b.length)+b)}function ai(a){if(a===92)return'\\\\';if(a===10)return'\\n';if(a===13)return'\\r';if(a===8232)return'\\u2028';if(a===8233)return'\\u2029';throw new Error('Incorrectly classified character')}function aj(d){var a,e,c,b;for(b=S==='double'?'"':"'",a=0,e=d.length;a<e;++a){if(c=d.charCodeAt(a),c===39){b='"';break}if(c===34){b="'";break}c===92&&++a}return b+d+b}function ak(d){var b='',c,g,a,h=0,i=0,e,f;for(c=0,g=d.length;c<g;++c){if(a=d.charCodeAt(c),a===39)++h;else if(a===34)++i;else if(a===47&&y)b+='\\';else if(m.code.isLineTerminator(a)||a===92){b+=ai(a);continue}else if(y&&a<32||!(y||ad||a>=32&&a<=126)){b+=ar(a,d.charCodeAt(c+1));continue}b+=String.fromCharCode(a)}if(e=!(S==='double'||S==='auto'&&i<h),f=e?"'":'"',!(e?h:i))return f+b+f;for(d=b,b=f,c=0,g=d.length;c<g;++c)a=d.charCodeAt(c),(a===39&&e||a===34&&!e)&&(b+='\\'),b+=String.fromCharCode(a);return b+f}function a1(d){var a,e,b,c='';for(a=0,e=d.length;a<e;++a)b=d[a],c+=J(b)?a1(b):b;return c}function j(b,a){if(!B)return J(b)?a1(b):b;if(a==null)if(b instanceof N)return b;else a={};return a.loc==null?new N(null,null,B,b,a.name||null):new N(a.loc.start.line,a.loc.start.column,B===!0?a.loc.source||null:B,b,a.name||null)}function w(){return f?f:' '}function h(c,d){var e,g,a,b;return e=j(c).toString(),e.length===0?[d]:(g=j(d).toString(),g.length===0?[c]:(a=e.charCodeAt(e.length-1),b=g.charCodeAt(0),(a===43||a===45)&&a===b||m.code.isIdentifierPart(a)&&m.code.isIdentifierPart(b)||a===47&&b===105?[c,w(),d]:m.code.isWhiteSpace(a)||m.code.isLineTerminator(a)||m.code.isWhiteSpace(b)||m.code.isLineTerminator(b)?[c,d]:[c,f,d]))}function u(a){return[n,a]}function p(b){var a;a=n,n+=F,b(n),n=a}function as(b){var a;for(a=b.length-1;a>=0;--a)if(m.code.isLineTerminator(b.charCodeAt(a)))break;return b.length-1-a}function ah(k,i){var b,a,e,g,d,c,f,h;for(b=k.split(/\r\n|[\r\n]/),c=Number.MAX_VALUE,a=1,e=b.length;a<e;++a){g=b[a],d=0;while(d<g.length&&m.code.isWhiteSpace(g.charCodeAt(d)))++d;c>d&&(c=d)}for(i!==void 0?(f=n,b[1][c]==='*'&&(i+=' '),n=i):(c&1&&--c,f=n),a=1,e=b.length;a<e;++a)h=j(u(b[a].slice(c))),b[a]=B?h.join(''):h;return n=f,b.join('\n')}function D(a,c){if(a.type==='Line')if(r(a.value))return'//'+a.value;else{var b='//'+a.value;return x||(b+='\n'),b}return s.format.indent.adjustMultilineComment&&/[\n\r]/.test(a.value)?ah('/*'+a.value+'*/',c):'/*'+a.value+'*/'}function $(d,a){var c,g,b,q,p,m,l,i,f,o,h,s,t,e;if(d.leadingComments&&d.leadingComments.length>0){if(q=a,x){for(b=d.leadingComments[0],a=[],i=b.extendedRange,f=b.range,h=C.substring(i[0],f[0]),e=(h.match(/\n/g)||[]).length,e>0?(a.push(H('\n',e)),a.push(u(D(b)))):(a.push(h),a.push(D(b))),o=f,c=1,g=d.leadingComments.length;c<g;c++)b=d.leadingComments[c],f=b.range,s=C.substring(o[1],f[0]),e=(s.match(/\n/g)||[]).length,a.push(H('\n',e)),a.push(u(D(b))),o=f;t=C.substring(f[1],i[1]),e=(t.match(/\n/g)||[]).length,a.push(H('\n',e))}else for(b=d.leadingComments[0],a=[],L&&d.type===k.Program&&d.body.length===0&&a.push('\n'),a.push(D(b)),r(j(a).toString())||a.push('\n'),c=1,g=d.leadingComments.length;c<g;++c)b=d.leadingComments[c],l=[D(b)],r(j(l).toString())||l.push('\n'),a.push(u(l));a.push(u(q))}if(d.trailingComments)if(x)b=d.trailingComments[0],i=b.extendedRange,f=b.range,h=C.substring(i[0],f[0]),e=(h.match(/\n/g)||[]).length,e>0?(a.push(H('\n',e)),a.push(u(D(b)))):(a.push(h),a.push(D(b)));else for(p=!r(j(a).toString()),m=H(' ',as(j([n,a,F]).toString())),c=0,g=d.trailingComments.length;c<g;++c)b=d.trailingComments[c],p?(c===0?a=[a,F]:a=[a,m],a.push(D(b,m))):a=[a,u(D(b))],c!==g-1&&!r(j(a).toString())&&(a=[a,'\n']);return a}function I(c,d,e){var a,b=0;for(a=c;a<d;a++)C[a]==='\n'&&b++;for(a=1;a<b;a++)e.push(i)}function t(a,b,c){return b<c?['(',a,')']:a}function ab(d){var a,c,b;for(b=d.split(/\r\n|\n/),a=1,c=b.length;a<c;a++)b[a]=i+n+b[a];return b}function an(c,d){var a,b,f;return a=c[s.verbatim],typeof a==='string'?b=t(ab(a),e.Sequence,d):(b=ab(a.content),f=a.precedence!=null?a.precedence:e.Sequence,b=t(b,f,d)),j(b,c)}function o(){}function A(a){return j(a.name,a)}function M(a,b){return a.async?'async'+(b?w():f):''}function O(b){var a=b.generator&&!s.moz.starlessGenerator;return a?'*'+f:''}function ag(b){var a=b.value;return a.async?M(a,!b.computed):O(a)?'*':''}function at(a){var b;if(b=new o,a3(a))return b.generateStatement(a,l);if(ap(a))return b.generateExpression(a,e.Sequence,g);throw new Error('Unknown node type: '+a.type)}function al(k,e){var h=a2(),j,g;return e!=null?(typeof e.indent==='string'&&(h.format.indent.style=e.indent),typeof e.base==='number'&&(h.format.indent.base=e.base),e=T(h,e),F=e.format.indent.style,typeof e.base==='string'?n=e.base:n=H(F,e.format.indent.base)):(e=h,F=e.format.indent.style,n=H(F,e.format.indent.base)),y=e.format.json,Z=e.format.renumber,ae=y?!1:e.format.hexadecimal,S=y?'double':e.format.quotes,ad=e.format.escapeless,i=e.format.newline,f=e.format.space,e.format.compact&&(i=f=F=n=''),W=e.format.parentheses,ac=e.format.semicolons,L=e.format.safeConcatenation,aa=e.directive,Y=y?null:e.parse,B=e.sourceMap,C=e.sourceCode,x=e.format.preserveBlankLines&&C!==null,s=e,B&&(c.browser?N=b.sourceMap.SourceNode:N=a('/node_modules/source-map/lib/source-map.js',d).SourceNode),j=at(k),B?(g=j.toStringWithSourceMap({file:e.file,sourceRoot:e.sourceMapRoot}),e.sourceContent&&g.map.setSourceContent(e.sourceMap,e.sourceContent),e.sourceMapWithCode?g:g.map.toString()):(g={code:j.toString(),map:null},e.sourceMapWithCode?g:g.code)}_=a('/node_modules/estraverse/estraverse.js',d),m=a('/node_modules/esutils/lib/utils.js',d),k=_.Syntax,e={Sequence:0,Yield:1,Await:1,Assignment:1,Conditional:2,ArrowFunction:2,LogicalOR:3,LogicalAND:4,BitwiseOR:5,BitwiseXOR:6,BitwiseAND:7,Equality:8,Relational:9,BitwiseSHIFT:10,Additive:11,Multiplicative:12,Unary:13,Postfix:14,Call:15,New:16,TaggedTemplate:17,Member:18,Primary:19},af={'||':e.LogicalOR,'&&':e.LogicalAND,'|':e.BitwiseOR,'^':e.BitwiseXOR,'&':e.BitwiseAND,'==':e.Equality,'!=':e.Equality,'===':e.Equality,'!==':e.Equality,is:e.Equality,isnt:e.Equality,'<':e.Relational,'>':e.Relational,'<=':e.Relational,'>=':e.Relational,'in':e.Relational,'instanceof':e.Relational,'<<':e.BitwiseSHIFT,'>>':e.BitwiseSHIFT,'>>>':e.BitwiseSHIFT,'+':e.Additive,'-':e.Additive,'*':e.Multiplicative,'%':e.Multiplicative,'/':e.Multiplicative},v=1,E=2,G=4,V=8,Q=16,q=32,U=E|G,P=v|E,g=v|E|G,R=v,a6=G,X=v|G,l=v,z=v|q,K=0,a5=v|Q,a4=v|V,J=Array.isArray,J||(J=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),o.prototype.maybeBlock=function(a,c){var d,b,e=this;return b=!s.comment||!a.leadingComments,a.type===k.BlockStatement&&b?[f,this.generateStatement(a,c)]:a.type===k.EmptyStatement&&b?';':(p(function(){d=[i,u(e.generateStatement(a,c))]}),d)},o.prototype.maybeBlockSuffix=function(c,a){var b=r(j(a).toString());return c.type===k.BlockStatement&&!(s.comment&&c.leadingComments)&&!b?[a,f]:b?[a,n]:[a,i,n]},o.prototype.generatePattern=function(a,b,c){return a.type===k.Identifier?A(a):this.generateExpression(a,b,c)},o.prototype.generateFunctionParams=function(a){var c,d,b,h;if(h=!1,a.type===k.ArrowFunctionExpression&&!a.rest&&(!a.defaults||a.defaults.length===0)&&a.params.length===1&&a.params[0].type===k.Identifier)b=[M(a,!0),A(a.params[0])];else{for(b=a.type===k.ArrowFunctionExpression?[M(a,!1)]:[],b.push('('),a.defaults&&(h=!0),c=0,d=a.params.length;c<d;++c)h&&a.defaults[c]?b.push(this.generateAssignment(a.params[c],a.defaults[c],'=',e.Assignment,g)):b.push(this.generatePattern(a.params[c],e.Assignment,g)),c+1<d&&b.push(','+f);a.rest&&(a.params.length&&b.push(','+f),b.push('...'),b.push(A(a.rest))),b.push(')')}return b},o.prototype.generateFunctionBody=function(b){var a,c;return a=this.generateFunctionParams(b),b.type===k.ArrowFunctionExpression&&(a.push(f),a.push('=>')),b.expression?(a.push(f),c=this.generateExpression(b.body,e.Assignment,g),c.toString().charAt(0)==='{'&&(c=['(',c,')']),a.push(c)):a.push(this.maybeBlock(b.body,a4)),a},o.prototype.generateIterationForStatement=function(d,b,i){var a=['for'+f+'('],c=this;return p(function(){b.left.type===k.VariableDeclaration?p(function(){a.push(b.left.kind+w()),a.push(c.generateStatement(b.left.declarations[0],K))}):a.push(c.generateExpression(b.left,e.Call,g)),a=h(a,d),a=[h(a,c.generateExpression(b.right,e.Sequence,g)),')']}),a.push(this.maybeBlock(b.body,i)),a},o.prototype.generatePropertyKey=function(c,b){var a=[];return b&&a.push('['),a.push(this.generateExpression(c,e.Sequence,g)),b&&a.push(']'),a},o.prototype.generateAssignment=function(c,d,g,b,a){return e.Assignment<b&&(a|=v),t([this.generateExpression(c,e.Call,a),f+g+f,this.generateExpression(d,e.Assignment,a)],e.Assignment,b)},o.prototype.semicolon=function(a){return!ac&&a&q?'':';'},o.Statement={BlockStatement:function(a,f){var c,d,b=['{',i],e=this;return p(function(){a.body.length===0&&x&&(c=a.range,c[1]-c[0]>2)&&(d=C.substring(c[0]+1,c[1]-1),d[0]==='\n'&&(b=['{']),b.push(d));var g,h,m,k;for(k=l,f&V&&(k|=Q),g=0,h=a.body.length;g<h;++g)x&&(g===0&&(a.body[0].leadingComments&&(c=a.body[0].leadingComments[0].extendedRange,d=C.substring(c[0],c[1]),d[0]==='\n'&&(b=['{'])),a.body[0].leadingComments||I(a.range[0],a.body[0].range[0],b)),g>0&&!(a.body[g-1].trailingComments||a.body[g].leadingComments)&&I(a.body[g-1].range[1],a.body[g].range[0],b)),g===h-1&&(k|=q),a.body[g].leadingComments&&x?m=e.generateStatement(a.body[g],k):m=u(e.generateStatement(a.body[g],k)),b.push(m),r(j(m).toString())||(x&&g<h-1?a.body[g+1].leadingComments||b.push(i):b.push(i)),x&&g===h-1&&(a.body[g].trailingComments||I(a.body[g].range[1],a.range[1],b))}),b.push(u('}')),b},BreakStatement:function(a,b){return a.label?'break '+a.label.name+this.semicolon(b):'break'+this.semicolon(b)},ContinueStatement:function(a,b){return a.label?'continue '+a.label.name+this.semicolon(b):'continue'+this.semicolon(b)},ClassBody:function(b,d){var a=['{',i],c=this;return p(function(h){var d,f;for(d=0,f=b.body.length;d<f;++d)a.push(h),a.push(c.generateExpression(b.body[d],e.Sequence,g)),d+1<f&&a.push(i)}),r(j(a).toString())||a.push(i),a.push(n),a.push('}'),a},ClassDeclaration:function(b,d){var a,c;return a=['class '+b.id.name],b.superClass&&(c=h('extends',this.generateExpression(b.superClass,e.Assignment,g)),a=h(a,c)),a.push(f),a.push(this.generateStatement(b.body,z)),a},DirectiveStatement:function(a,b){return s.raw&&a.raw?a.raw+this.semicolon(b):aj(a.directive)+this.semicolon(b)},DoWhileStatement:function(b,c){var a=h('do',this.maybeBlock(b.body,l));return a=this.maybeBlockSuffix(b.body,a),h(a,['while'+f+'(',this.generateExpression(b.test,e.Sequence,g),')'+this.semicolon(c)])},CatchClause:function(a,d){var b,c=this;return p(function(){var d;b=['catch'+f+'(',c.generateExpression(a.param,e.Sequence,g),')'],a.guard&&(d=c.generateExpression(a.guard,e.Sequence,g),b.splice(2,0,' if ',d))}),b.push(this.maybeBlock(a.body,l)),b},DebuggerStatement:function(b,a){return'debugger'+this.semicolon(a)},EmptyStatement:function(a,b){return';'},ExportDeclaration:function(b,c){var a=['export'],d,m=this;return d=c&q?z:l,b['default']?(a=h(a,'default'),a3(b.declaration)?a=h(a,this.generateStatement(b.declaration,d)):a=h(a,this.generateExpression(b.declaration,e.Assignment,g)+this.semicolon(c)),a):b.declaration?h(a,this.generateStatement(b.declaration,d)):(b.specifiers&&(b.specifiers.length===0?a=h(a,'{'+f+'}'):b.specifiers[0].type===k.ExportBatchSpecifier?a=h(a,this.generateExpression(b.specifiers[0],e.Sequence,g)):(a=h(a,'{'),p(function(f){var c,d;for(a.push(i),c=0,d=b.specifiers.length;c<d;++c)a.push(f),a.push(m.generateExpression(b.specifiers[c],e.Sequence,g)),c+1<d&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n+'}')),b.source?a=h(a,['from'+f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(c)]):a.push(this.semicolon(c))),a)},ExpressionStatement:function(c,d){function f(b){var a;return b.slice(0,5)!=='class'?!1:(a=b.charCodeAt(5),a===123||m.code.isWhiteSpace(a)||m.code.isLineTerminator(a))}function h(b){var a;return b.slice(0,8)!=='function'?!1:(a=b.charCodeAt(8),a===40||m.code.isWhiteSpace(a)||a===42||m.code.isLineTerminator(a))}function i(b){var c,a,d;if(b.slice(0,5)!=='async')return!1;if(!m.code.isWhiteSpace(b.charCodeAt(5)))return!1;for(a=6,d=b.length;a<d;++a)if(!m.code.isWhiteSpace(b.charCodeAt(a)))break;return a===d?!1:b.slice(a,a+8)!=='function'?!1:(c=b.charCodeAt(a+8),c===40||m.code.isWhiteSpace(c)||c===42||m.code.isLineTerminator(c))}var a,b;return a=[this.generateExpression(c.expression,e.Sequence,g)],b=j(a).toString(),b.charCodeAt(0)===123||f(b)||h(b)||i(b)||aa&&d&Q&&c.expression.type===k.Literal&&typeof c.expression.value==='string'?a=['(',a,')'+this.semicolon(d)]:a.push(this.semicolon(d)),a},ImportDeclaration:function(b,d){var a,c,l=this;return b.specifiers.length===0?['import',f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(d)]:(a=['import'],c=0,b.specifiers[c].type===k.ImportDefaultSpecifier&&(a=h(a,[this.generateExpression(b.specifiers[c],e.Sequence,g)]),++c),b.specifiers[c]&&(c!==0&&a.push(','),b.specifiers[c].type===k.ImportNamespaceSpecifier?a=h(a,[f,this.generateExpression(b.specifiers[c],e.Sequence,g)]):(a.push(f+'{'),b.specifiers.length-c===1?(a.push(f),a.push(this.generateExpression(b.specifiers[c],e.Sequence,g)),a.push(f+'}'+f)):(p(function(h){var d,f;for(a.push(i),d=c,f=b.specifiers.length;d<f;++d)a.push(h),a.push(l.generateExpression(b.specifiers[d],e.Sequence,g)),d+1<f&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n+'}'+f)))),a=h(a,['from'+f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(d)]),a)},VariableDeclarator:function(a,c){var b=c&v?g:U;return a.init?[this.generateExpression(a.id,e.Assignment,b),f,'=',f,this.generateExpression(a.init,e.Assignment,b)]:this.generatePattern(a.id,e.Assignment,b)},VariableDeclaration:function(c,h){function j(){for(b=c.declarations[0],s.comment&&b.leadingComments?(a.push('\n'),a.push(u(e.generateStatement(b,d)))):(a.push(w()),a.push(e.generateStatement(b,d))),g=1,k=c.declarations.length;g<k;++g)b=c.declarations[g],s.comment&&b.leadingComments?(a.push(','+i),a.push(u(e.generateStatement(b,d)))):(a.push(','+f),a.push(e.generateStatement(b,d)))}var a,g,k,b,d,e=this;return a=[c.kind],d=h&v?l:K,c.declarations.length>1?p(j):j(),a.push(this.semicolon(h)),a},ThrowStatement:function(a,b){return[h('throw',this.generateExpression(a.argument,e.Sequence,g)),this.semicolon(b)]},TryStatement:function(b,f){var a,c,d,e;if(a=['try',this.maybeBlock(b.block,l)],a=this.maybeBlockSuffix(b.block,a),b.handlers)for(c=0,d=b.handlers.length;c<d;++c)a=h(a,this.generateStatement(b.handlers[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(b.handlers[c].body,a));else{for(e=b.guardedHandlers||[],c=0,d=e.length;c<d;++c)a=h(a,this.generateStatement(e[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(e[c].body,a));if(b.handler)if(J(b.handler))for(c=0,d=b.handler.length;c<d;++c)a=h(a,this.generateStatement(b.handler[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(b.handler[c].body,a));else a=h(a,this.generateStatement(b.handler,l)),b.finalizer&&(a=this.maybeBlockSuffix(b.handler.body,a))}return b.finalizer&&(a=h(a,['finally',this.maybeBlock(b.finalizer,l)])),a},SwitchStatement:function(c,n){var a,d,b,h,k,m=this;if(p(function(){a=['switch'+f+'(',m.generateExpression(c.discriminant,e.Sequence,g),')'+f+'{'+i]}),c.cases)for(k=l,b=0,h=c.cases.length;b<h;++b)b===h-1&&(k|=q),d=u(this.generateStatement(c.cases[b],k)),a.push(d),r(j(d).toString())||a.push(i);return a.push(u('}')),a},SwitchCase:function(c,o){var a,f,b,d,n,m=this;return p(function(){for(c.test?a=[h('case',m.generateExpression(c.test,e.Sequence,g)),':']:a=['default:'],b=0,d=c.consequent.length,d&&c.consequent[0].type===k.BlockStatement&&(f=m.maybeBlock(c.consequent[0],l),a.push(f),b=1),b!==d&&!r(j(a).toString())&&a.push(i),n=l;b<d;++b)b===d-1&&o&q&&(n|=q),f=u(m.generateStatement(c.consequent[b],n)),a.push(f),b+1!==d&&!r(j(f).toString())&&a.push(i)}),a},IfStatement:function(b,j){var a,c,d,i=this;return p(function(){a=['if'+f+'(',i.generateExpression(b.test,e.Sequence,g),')']}),d=j&q,c=l,d&&(c|=q),b.alternate?(a.push(this.maybeBlock(b.consequent,l)),a=this.maybeBlockSuffix(b.consequent,a),b.alternate.type===k.IfStatement?a=h(a,['else ',this.generateStatement(b.alternate,c)]):a=h(a,h('else',this.maybeBlock(b.alternate,c)))):a.push(this.maybeBlock(b.consequent,c)),a},ForStatement:function(b,d){var a,c=this;return p(function(){a=['for'+f+'('],b.init?b.init.type===k.VariableDeclaration?a.push(c.generateStatement(b.init,K)):(a.push(c.generateExpression(b.init,e.Sequence,U)),a.push(';')):a.push(';'),b.test?(a.push(f),a.push(c.generateExpression(b.test,e.Sequence,g)),a.push(';')):a.push(';'),b.update?(a.push(f),a.push(c.generateExpression(b.update,e.Sequence,g)),a.push(')')):a.push(')')}),a.push(this.maybeBlock(b.body,d&q?z:l)),a},ForInStatement:function(a,b){return this.generateIterationForStatement('in',a,b&q?z:l)},ForOfStatement:function(a,b){return this.generateIterationForStatement('of',a,b&q?z:l)},LabeledStatement:function(a,b){return[a.label.name+':',this.maybeBlock(a.body,b&q?z:l)]},Program:function(b,g){var c,e,a,d,f;for(d=b.body.length,c=[L&&d>0?'\n':''],f=a5,a=0;a<d;++a)!L&&a===d-1&&(f|=q),x&&(a===0&&(b.body[0].leadingComments||I(b.range[0],b.body[a].range[0],c)),a>0&&!(b.body[a-1].trailingComments||b.body[a].leadingComments)&&I(b.body[a-1].range[1],b.body[a].range[0],c)),e=u(this.generateStatement(b.body[a],f)),c.push(e),a+1<d&&!r(j(e).toString())&&(x?b.body[a+1].leadingComments||c.push(i):c.push(i)),x&&a===d-1&&(b.body[a].trailingComments||I(b.body[a].range[1],b.range[1],c));return c},FunctionDeclaration:function(a,b){return[M(a,!0),'function',O(a)||w(),A(a.id),this.generateFunctionBody(a)]},ReturnStatement:function(a,b){return a.argument?[h('return',this.generateExpression(a.argument,e.Sequence,g)),this.semicolon(b)]:['return'+this.semicolon(b)]},WhileStatement:function(b,d){var a,c=this;return p(function(){a=['while'+f+'(',c.generateExpression(b.test,e.Sequence,g),')']}),a.push(this.maybeBlock(b.body,d&q?z:l)),a},WithStatement:function(b,d){var a,c=this;return p(function(){a=['with'+f+'(',c.generateExpression(b.object,e.Sequence,g),')']}),a.push(this.maybeBlock(b.body,d&q?z:l)),a}},a0(o.prototype,o.Statement),o.Expression={SequenceExpression:function(d,g,h){var b,a,c;for(e.Sequence<g&&(h|=v),b=[],a=0,c=d.expressions.length;a<c;++a)b.push(this.generateExpression(d.expressions[a],e.Assignment,h)),a+1<c&&b.push(','+f);return t(b,e.Sequence,g)},AssignmentExpression:function(a,b,c){return this.generateAssignment(a.left,a.right,a.operator,b,c)},ArrowFunctionExpression:function(a,b,c){return t(this.generateFunctionBody(a),e.ArrowFunction,b)},ConditionalExpression:function(b,c,a){return e.Conditional<c&&(a|=v),t([this.generateExpression(b.test,e.LogicalOR,a),f+'?'+f,this.generateExpression(b.consequent,e.Assignment,a),f+':'+f,this.generateExpression(b.alternate,e.Assignment,a)],e.Conditional,c)},LogicalExpression:function(a,b,c){return this.BinaryExpression(a,b,c)},BinaryExpression:function(a,g,e){var c,d,b,f;return d=af[a.operator],d<g&&(e|=v),b=this.generateExpression(a.left,d,e),f=b.toString(),f.charCodeAt(f.length-1)===47&&m.code.isIdentifierPart(a.operator.charCodeAt(0))?c=[b,w(),a.operator]:c=h(b,a.operator),b=this.generateExpression(a.right,d+1,e),a.operator==='/'&&b.toString().charAt(0)==='/'||a.operator.slice(-1)==='<'&&b.toString().slice(0,3)==='!--'?(c.push(w()),c.push(b)):c=h(c,b),a.operator==='in'&&!(e&v)?['(',c,')']:t(c,d,g)},CallExpression:function(c,h,i){var a,b,d;for(a=[this.generateExpression(c.callee,e.Call,P)],a.push('('),b=0,d=c['arguments'].length;b<d;++b)a.push(this.generateExpression(c['arguments'][b],e.Assignment,g)),b+1<d&&a.push(','+f);return a.push(')'),i&E?t(a,e.Call,h):['(',a,')']},NewExpression:function(d,l,j){var a,c,b,i,k;if(c=d['arguments'].length,k=j&G&&!W&&c===0?X:R,a=h('new',this.generateExpression(d.callee,e.New,k)),!(j&G)||W||c>0){for(a.push('('),b=0,i=c;b<i;++b)a.push(this.generateExpression(d['arguments'][b],e.Assignment,g)),b+1<i&&a.push(','+f);a.push(')')}return t(a,e.New,l)},MemberExpression:function(c,f,d){var a,b;return a=[this.generateExpression(c.object,e.Call,d&E?P:R)],c.computed?(a.push('['),a.push(this.generateExpression(c.property,e.Sequence,d&E?g:X)),a.push(']')):(c.object.type===k.Literal&&typeof c.object.value==='number'&&(b=j(a).toString(),b.indexOf('.')<0&&!/[eExX]/.test(b)&&m.code.isDecimalDigit(b.charCodeAt(b.length-1))&&!(b.length>=2&&b.charCodeAt(0)===48)&&a.push('.')),a.push('.'),a.push(A(c.property))),t(a,e.Member,f)},UnaryExpression:function(d,l,n){var a,b,i,k,c;return b=this.generateExpression(d.argument,e.Unary,g),f===''?a=h(d.operator,b):(a=[d.operator],d.operator.length>2?a=h(a,b):(k=j(a).toString(),c=k.charCodeAt(k.length-1),i=b.toString().charCodeAt(0),(c===43||c===45)&&c===i||m.code.isIdentifierPart(c)&&m.code.isIdentifierPart(i)?(a.push(w()),a.push(b)):a.push(b))),t(a,e.Unary,l)},YieldExpression:function(b,c,d){var a;return b.delegate?a='yield*':a='yield',b.argument&&(a=h(a,this.generateExpression(b.argument,e.Yield,g))),t(a,e.Yield,c)},AwaitExpression:function(a,c,d){var b=h(a.delegate?'await*':'await',this.generateExpression(a.argument,e.Await,g));return t(b,e.Await,c)},UpdateExpression:function(a,b,c){return a.prefix?t([a.operator,this.generateExpression(a.argument,e.Unary,g)],e.Unary,b):t([this.generateExpression(a.argument,e.Postfix,g),a.operator],e.Postfix,b)},FunctionExpression:function(a,c,d){var b=[M(a,!0),'function'];return a.id?(b.push(O(a)||w()),b.push(A(a.id))):b.push(O(a)||f),b.push(this.generateFunctionBody(a)),b},ExportBatchSpecifier:function(a,b,c){return'*'},ArrayPattern:function(a,b,c){return this.ArrayExpression(a,b,c)},ArrayExpression:function(c,h,k){var a,b,d=this;return c.elements.length?(b=c.elements.length>1,a=['[',b?i:''],p(function(k){var h,j;for(h=0,j=c.elements.length;h<j;++h)c.elements[h]?(a.push(b?k:''),a.push(d.generateExpression(c.elements[h],e.Assignment,g))):(b&&a.push(k),h+1===j&&a.push(',')),h+1<j&&a.push(','+(b?i:f))}),b&&!r(j(a).toString())&&a.push(i),a.push(b?n:''),a.push(']'),a):'[]'},ClassExpression:function(b,d,i){var a,c;return a=['class'],b.id&&(a=h(a,this.generateExpression(b.id,e.Sequence,g))),b.superClass&&(c=h('extends',this.generateExpression(b.superClass,e.Assignment,g)),a=h(a,c)),a.push(f),a.push(this.generateStatement(b.body,z)),a},MethodDefinition:function(a,d,e){var b,c;return a['static']?b=['static'+f]:b=[],a.kind==='get'||a.kind==='set'?c=[h(a.kind,this.generatePropertyKey(a.key,a.computed)),this.generateFunctionBody(a.value)]:c=[ag(a),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)],h(b,c)},Property:function(a,b,c){return a.kind==='get'||a.kind==='set'?[a.kind,w(),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)]:a.shorthand?this.generatePropertyKey(a.key,a.computed):a.method?[ag(a),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)]:[this.generatePropertyKey(a.key,a.computed),':'+f,this.generateExpression(a.value,e.Assignment,g)]},ObjectExpression:function(b,k,l){var d,a,c,h=this;return b.properties.length?(d=b.properties.length>1,p(function(){c=h.generateExpression(b.properties[0],e.Sequence,g)}),d||am(j(c).toString())?(p(function(k){var f,j;if(a=['{',i,k,c],d)for(a.push(','+i),f=1,j=b.properties.length;f<j;++f)a.push(k),a.push(h.generateExpression(b.properties[f],e.Sequence,g)),f+1<j&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n),a.push('}'),a):['{',f,c,f,'}']):'{}'},ObjectPattern:function(c,o,q){var a,d,l,b,h,m=this;if(!c.properties.length)return'{}';if(b=!1,c.properties.length===1)h=c.properties[0],h.value.type!==k.Identifier&&(b=!0);else for(d=0,l=c.properties.length;d<l;++d)if(h=c.properties[d],!h.shorthand){b=!0;break}return a=['{',b?i:''],p(function(j){var d,h;for(d=0,h=c.properties.length;d<h;++d)a.push(b?j:''),a.push(m.generateExpression(c.properties[d],e.Sequence,g)),d+1<h&&a.push(','+(b?i:f))}),b&&!r(j(a).toString())&&a.push(i),a.push(b?n:''),a.push('}'),a},ThisExpression:function(a,b,c){return'this'},Identifier:function(a,b,c){return A(a)},ImportDefaultSpecifier:function(a,b,c){return A(a.id)},ImportNamespaceSpecifier:function(b,c,d){var a=['*'];return b.id&&a.push(f+'as'+w()+A(b.id)),a},ImportSpecifier:function(a,b,c){return this.ExportSpecifier(a,b,c)},ExportSpecifier:function(a,c,d){var b=[a.id.name];return a.name&&b.push(w()+'as'+w()+A(a.name)),b},Literal:function(a,c,d){var b;if(a.hasOwnProperty('raw')&&Y&&s.raw)try{if(b=Y(a.raw).body[0].expression,b.type===k.Literal&&b.value===a.value)return a.raw}catch(a){}return a.value===null?'null':typeof a.value==='string'?ak(a.value):typeof a.value==='number'?ao(a.value):typeof a.value==='boolean'?a.value?'true':'false':aq(a.value)},GeneratorExpression:function(a,b,c){return this.ComprehensionExpression(a,b,c)},ComprehensionExpression:function(b,l,m){var a,d,i,c,j=this;return a=b.type===k.GeneratorExpression?['(']:['['],s.moz.comprehensionExpressionStartsWithAssignment&&(c=this.generateExpression(b.body,e.Assignment,g),a.push(c)),b.blocks&&p(function(){for(d=0,i=b.blocks.length;d<i;++d)c=j.generateExpression(b.blocks[d],e.Sequence,g),d>0||s.moz.comprehensionExpressionStartsWithAssignment?a=h(a,c):a.push(c)}),b.filter&&(a=h(a,'if'+f),c=this.generateExpression(b.filter,e.Sequence,g),a=h(a,['(',c,')'])),s.moz.comprehensionExpressionStartsWithAssignment||(c=this.generateExpression(b.body,e.Assignment,g),a=h(a,c)),a.push(b.type===k.GeneratorExpression?')':']'),a},ComprehensionBlock:function(b,c,d){var a;return b.left.type===k.VariableDeclaration?a=[b.left.kind,w(),this.generateStatement(b.left.declarations[0],K)]:a=this.generateExpression(b.left,e.Call,g),a=h(a,b.of?'of':'in'),a=h(a,this.generateExpression(b.right,e.Sequence,g)),['for'+f+'(',a,')']},SpreadElement:function(a,b,c){return['...',this.generateExpression(a.argument,e.Assignment,g)]},TaggedTemplateExpression:function(b,d,f){var a=P;f&E||(a=R);var c=[this.generateExpression(b.tag,e.Call,a),this.generateExpression(b.quasi,e.Primary,a6)];return t(c,e.TaggedTemplate,d)},TemplateElement:function(a,b,c){return a.value.raw},TemplateLiteral:function(c,h,i){var a,b,d;for(a=['`'],b=0,d=c.quasis.length;b<d;++b)a.push(this.generateExpression(c.quasis[b],e.Primary,g)),b+1<d&&(a.push('${'+f),a.push(this.generateExpression(c.expressions[b],e.Sequence,g)),a.push(f+'}'));return a.push('`'),a},ModuleSpecifier:function(a,b,c){return this.Literal(a,b,c)}},a0(o.prototype,o.Expression),o.prototype.generateExpression=function(a,c,e){var b,d;return d=a.type||k.Property,s.verbatim&&a.hasOwnProperty(s.verbatim)?an(a,c):(b=this[d](a,c,e),s.comment&&(b=$(a,b)),j(b,a))},o.prototype.generateStatement=function(b,d){var a,c;return a=this[b.type](b,d),s.comment&&(a=$(b,a)),c=j(a).toString(),b.type===k.Program&&!L&&i===''&&c.charAt(c.length-1)==='\n'&&(a=B?j(a).replaceRight(/\s+$/,''):c.replace(/\s+$/,'')),j(a,b)},a9={indent:{style:'',base:0},renumber:!0,hexadecimal:!0,quotes:'auto',escapeless:!0,compact:!0,parentheses:!1,semicolons:!1},a7=a2().format,c.version=a('/package.json',d).version,c.generate=al,c.attachComments=_.attachComments,c.Precedence=T({},e),c.browser=!1,c.FORMAT_MINIFY=a9,c.FORMAT_DEFAULTS=a7}()}),a.define('/package.json',function(a,b,c,d){a.exports={name:'escodegen',description:'ECMAScript code generator',homepage:'http://github.com/estools/escodegen',main:'escodegen.js',bin:{esgenerate:'./bin/esgenerate.js',escodegen:'./bin/escodegen.js'},files:['LICENSE.BSD','LICENSE.source-map','README.md','bin','escodegen.js','package.json'],version:'1.6.1',engines:{node:'>=0.10.0'},maintainers:[{name:'Yusuke Suzuki',email:'utatane.tea@gmail.com',web:'http://github.com/Constellation'}],repository:{type:'git',url:'http://github.com/estools/escodegen.git'},dependencies:{estraverse:'^1.9.1',esutils:'^1.1.6',esprima:'^1.2.2',optionator:'^0.5.0'},optionalDependencies:{'source-map':'~0.1.40'},devDependencies:{'acorn-6to5':'^0.11.1-25',bluebird:'^2.3.11','bower-registry-client':'^0.2.1',chai:'^1.10.0','commonjs-everywhere':'^0.9.7','esprima-moz':'*',gulp:'^3.8.10','gulp-eslint':'^0.2.0','gulp-mocha':'^2.0.0',semver:'^4.1.0'},licenses:[{type:'BSD',url:'http://github.com/estools/escodegen/raw/master/LICENSE.BSD'}],scripts:{test:'gulp travis','unit-test':'gulp test',lint:'gulp lint',release:'node tools/release.js','build-min':'./node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js',build:'./node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js'}}}),a.define('/node_modules/source-map/lib/source-map.js',function(b,c,d,e){c.SourceMapGenerator=a('/node_modules/source-map/lib/source-map/source-map-generator.js',b).SourceMapGenerator,c.SourceMapConsumer=a('/node_modules/source-map/lib/source-map/source-map-consumer.js',b).SourceMapConsumer,c.SourceNode=a('/node_modules/source-map/lib/source-map/source-node.js',b).SourceNode}),a.define('/node_modules/source-map/lib/source-map/source-node.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,i,f){function a(a,c,d,e,f){this.children=[],this.sourceContents={},this.line=a==null?null:a,this.column=c==null?null:c,this.source=d==null?null:d,this.name=f==null?null:f,this[b]=!0,e!=null&&this.add(e)}var g=e('/node_modules/source-map/lib/source-map/source-map-generator.js',f).SourceMapGenerator,c=e('/node_modules/source-map/lib/source-map/util.js',f),d=/(\r?\n)/,h=/\r\n|[\s\S]/g,b='$$$isSourceNode$$$';a.fromStringWithSourceMap=function b(n,m,j){function l(b,d){if(b===null||b.source===undefined)f.add(d);else{var e=j?c.join(j,b.source):b.source;f.add(new a(b.originalLine,b.originalColumn,e,d,b.name))}}var f=new a,e=n.split(d),k=function(){var a=e.shift(),b=e.shift()||'';return a+b},i=1,h=0,g=null;return m.eachMapping(function(a){if(g!==null)if(i<a.generatedLine){var c='';l(g,k()),i++,h=0}else{var b=e[0],c=b.substr(0,a.generatedColumn-h);e[0]=b.substr(a.generatedColumn-h),h=a.generatedColumn,l(g,c),g=a;return}while(i<a.generatedLine)f.add(k()),i++;if(h<a.generatedColumn){var b=e[0];f.add(b.substr(0,a.generatedColumn)),e[0]=b.substr(a.generatedColumn),h=a.generatedColumn}g=a},this),e.length>0&&(g&&l(g,k()),f.add(e.join(''))),m.sources.forEach(function(a){var b=m.sourceContentFor(a);b!=null&&(j!=null&&(a=c.join(j,a)),f.setSourceContent(a,b))}),f},a.prototype.add=function a(c){if(Array.isArray(c))c.forEach(function(a){this.add(a)},this);else if(c[b]||typeof c==='string')c&&this.children.push(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.prepend=function a(c){if(Array.isArray(c))for(var d=c.length-1;d>=0;d--)this.prepend(c[d]);else if(c[b]||typeof c==='string')this.children.unshift(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.walk=function a(e){var c;for(var d=0,f=this.children.length;d<f;d++)c=this.children[d],c[b]?c.walk(e):c!==''&&e(c,{source:this.source,line:this.line,column:this.column,name:this.name})},a.prototype.join=function a(e){var b,c,d=this.children.length;if(d>0){for(b=[],c=0;c<d-1;c++)b.push(this.children[c]),b.push(e);b.push(this.children[c]),this.children=b}return this},a.prototype.replaceRight=function a(d,e){var c=this.children[this.children.length-1];return c[b]?c.replaceRight(d,e):typeof c==='string'?this.children[this.children.length-1]=c.replace(d,e):this.children.push(''.replace(d,e)),this},a.prototype.setSourceContent=function a(b,d){this.sourceContents[c.toSetString(b)]=d},a.prototype.walkSourceContents=function a(g){for(var d=0,e=this.children.length;d<e;d++)this.children[d][b]&&this.children[d].walkSourceContents(g);var f=Object.keys(this.sourceContents);for(var d=0,e=f.length;d<e;d++)g(c.fromSetString(f[d]),this.sourceContents[f[d]])},a.prototype.toString=function a(){var b='';return this.walk(function(a){b+=a}),b},a.prototype.toStringWithSourceMap=function a(l){var b={code:'',line:1,column:0},c=new g(l),e=!1,f=null,i=null,j=null,k=null;return this.walk(function(g,a){b.code+=g,a.source!==null&&a.line!==null&&a.column!==null?((f!==a.source||i!==a.line||j!==a.column||k!==a.name)&&c.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name}),f=a.source,i=a.line,j=a.column,k=a.name,e=!0):e&&(c.addMapping({generated:{line:b.line,column:b.column}}),f=null,e=!1),g.match(h).forEach(function(g,h,i){d.test(g)?(b.line++,b.column=0,h+1===i.length?(f=null,e=!1):e&&c.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name})):b.column+=g.length})}),this.walkSourceContents(function(a,b){c.setSourceContent(a,b)}),{code:b.code,map:c}},i.SourceNode=a})}),a.define('/node_modules/source-map/lib/source-map/util.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(o,a,p){function m(b,a,c){if(a in b)return b[a];else if(arguments.length===3)return c;else throw new Error('"'+a+'" is a required argument.')}function b(b){var a=b.match(f);return a?{scheme:a[1],auth:a[2],host:a[3],port:a[4],path:a[5]}:null}function c(a){var b='';return a.scheme&&(b+=a.scheme+':'),b+='//',a.auth&&(b+=a.auth+'@'),a.host&&(b+=a.host),a.port&&(b+=':'+a.port),a.path&&(b+=a.path),b}function g(i){var a=i,d=b(i);if(d){if(!d.path)return i;a=d.path}var j=a.charAt(0)==='/',e=a.split(/\/+/);for(var h,g=0,f=e.length-1;f>=0;f--)h=e[f],h==='.'?e.splice(f,1):h==='..'?g++:g>0&&(h===''?(e.splice(f+1,g),g=0):(e.splice(f,2),g--));return a=e.join('/'),a===''&&(a=j?'/':'.'),d?(d.path=a,c(d)):a}function h(h,d){h===''&&(h='.'),d===''&&(d='.');var f=b(d),a=b(h);if(a&&(h=a.path||'/'),f&&!f.scheme)return a&&(f.scheme=a.scheme),c(f);if(f||d.match(e))return d;if(a&&!a.host&&!a.path)return a.host=d,c(a);var i=d.charAt(0)==='/'?d:g(h.replace(/\/+$/,'')+'/'+d);return a?(a.path=i,c(a)):i}function j(a,c){a===''&&(a='.'),a=a.replace(/\/$/,'');var d=b(a);return c.charAt(0)=='/'&&d&&d.path=='/'?c.slice(1):c.indexOf(a+'/')===0?c.substr(a.length+1):c}function k(a){return'$'+a}function l(a){return a.substr(1)}function d(c,d){var a=c||'',b=d||'';return(a>b)-(a<b)}function n(b,c,e){var a;return a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a||e?a:(a=d(b.name,c.name),a?a:(a=b.generatedLine-c.generatedLine,a?a:b.generatedColumn-c.generatedColumn))))}function i(b,c,e){var a;return a=b.generatedLine-c.generatedLine,a?a:(a=b.generatedColumn-c.generatedColumn,a||e?a:(a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a?a:d(b.name,c.name)))))}a.getArg=m;var f=/^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/,e=/^data:.+\,.+$/;a.urlParse=b,a.urlGenerate=c,a.normalize=g,a.join=h,a.relative=j,a.toSetString=k,a.fromSetString=l,a.compareByOriginalPositions=n,a.compareByGeneratedPositions=i})}),a.define('/node_modules/source-map/node_modules/amdefine/amdefine.js',function(b,f,g,d){'use strict';function e(e,i){'use strict';function q(b){var a,c;for(a=0;b[a];a+=1)if(c=b[a],c==='.')b.splice(a,1),a-=1;else if(c==='..')if(a===1&&(b[2]==='..'||b[0]==='..'))break;else a>0&&(b.splice(a-1,2),a-=2)}function j(b,c){var a;return b&&b.charAt(0)==='.'&&c&&(a=c.split('/'),a=a.slice(0,a.length-1),a=a.concat(b.split('/')),q(a),b=a.join('/')),b}function p(a){return function(b){return j(b,a)}}function o(c){function a(a){b[c]=a}return a.fromText=function(a,b){throw new Error('amdefine does not implement load.fromText')},a}function m(c,h,l){var m,f,a,j;if(c)f=b[c]={},a={id:c,uri:d,exports:f},m=g(i,f,a,c);else{if(k)throw new Error('amdefine with no module ID cannot be called more than once per file.');k=!0,f=e.exports,a=e,m=g(i,f,a,e.id)}h&&(h=h.map(function(a){return m(a)})),typeof l==='function'?j=l.apply(a.exports,h):j=l,j!==undefined&&(a.exports=j,c&&(b[c]=a.exports))}function l(b,a,c){Array.isArray(b)?(c=a,a=b,b=undefined):typeof b!=='string'&&(c=b,b=a=undefined),a&&!Array.isArray(a)&&(c=a,a=undefined),a||(a=['require','exports','module']),b?f[b]=[b,a,c]:m(b,a,c)}var f={},b={},k=!1,n=a('path',e),g,h;return g=function(b,d,a,e){function f(f,g){if(typeof f==='string')return h(b,d,a,f,e);f=f.map(function(c){return h(b,d,a,c,e)}),c.nextTick(function(){g.apply(null,f)})}return f.toUrl=function(b){return b.indexOf('.')===0?j(b,n.dirname(a.filename)):b},f},i=i||function a(){return e.require.apply(e,arguments)},h=function(d,e,i,a,c){var k=a.indexOf('!'),n=a,q,l;if(k===-1)if(a=j(a,c),a==='require')return g(d,e,i,c);else if(a==='exports')return e;else if(a==='module')return i;else if(b.hasOwnProperty(a))return b[a];else if(f[a])return m.apply(null,f[a]),b[a];else if(d)return d(n);else throw new Error('No module with ID: '+a);else return q=a.substring(0,k),a=a.substring(k+1,a.length),l=h(d,e,i,q,c),l.normalize?a=l.normalize(a,p(c)):a=j(a,c),b[a]?b[a]:(l.load(a,g(d,e,i,c),o(a),{}),b[a])},l.require=function(a){return b[a]?b[a]:f[a]?(m.apply(null,f[a]),b[a]):void 0},l.amd={},l}b.exports=e}),a.define('/node_modules/source-map/lib/source-map/source-map-generator.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,g,f){function b(b){b||(b={}),this._file=a.getArg(b,'file',null),this._sourceRoot=a.getArg(b,'sourceRoot',null),this._sources=new d,this._names=new d,this._mappings=[],this._sourcesContents=null}var c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f),a=e('/node_modules/source-map/lib/source-map/util.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet;b.prototype._version=3,b.fromSourceMap=function c(d){var e=d.sourceRoot,f=new b({file:d.file,sourceRoot:e});return d.eachMapping(function(b){var c={generated:{line:b.generatedLine,column:b.generatedColumn}};b.source!=null&&(c.source=b.source,e!=null&&(c.source=a.relative(e,c.source)),c.original={line:b.originalLine,column:b.originalColumn},b.name!=null&&(c.name=b.name)),f.addMapping(c)}),d.sources.forEach(function(b){var a=d.sourceContentFor(b);a!=null&&f.setSourceContent(b,a)}),f},b.prototype.addMapping=function b(f){var g=a.getArg(f,'generated'),c=a.getArg(f,'original',null),d=a.getArg(f,'source',null),e=a.getArg(f,'name',null);this._validateMapping(g,c,d,e),d!=null&&!this._sources.has(d)&&this._sources.add(d),e!=null&&!this._names.has(e)&&this._names.add(e),this._mappings.push({generatedLine:g.line,generatedColumn:g.column,originalLine:c!=null&&c.line,originalColumn:c!=null&&c.column,source:d,name:e})},b.prototype.setSourceContent=function b(e,d){var c=e;this._sourceRoot!=null&&(c=a.relative(this._sourceRoot,c)),d!=null?(this._sourcesContents||(this._sourcesContents={}),this._sourcesContents[a.toSetString(c)]=d):this._sourcesContents&&(delete this._sourcesContents[a.toSetString(c)],Object.keys(this._sourcesContents).length===0&&(this._sourcesContents=null))},b.prototype.applySourceMap=function b(e,j,g){var f=j;if(j==null){if(e.file==null)throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map\'s "file" property. Both were omitted.');f=e.file}var c=this._sourceRoot;c!=null&&(f=a.relative(c,f));var h=new d,i=new d;this._mappings.forEach(function(b){if(b.source===f&&b.originalLine!=null){var d=e.originalPositionFor({line:b.originalLine,column:b.originalColumn});d.source!=null&&(b.source=d.source,g!=null&&(b.source=a.join(g,b.source)),c!=null&&(b.source=a.relative(c,b.source)),b.originalLine=d.line,b.originalColumn=d.column,d.name!=null&&(b.name=d.name))}var j=b.source;j!=null&&!h.has(j)&&h.add(j);var k=b.name;k!=null&&!i.has(k)&&i.add(k)},this),this._sources=h,this._names=i,e.sources.forEach(function(b){var d=e.sourceContentFor(b);d!=null&&(g!=null&&(b=a.join(g,b)),c!=null&&(b=a.relative(c,b)),this.setSourceContent(b,d))},this)},b.prototype._validateMapping=function a(b,c,d,e){if(b&&'line'in b&&'column'in b&&b.line>0&&b.column>=0&&!c&&!d&&!e)return;else if(b&&'line'in b&&'column'in b&&c&&'line'in c&&'column'in c&&b.line>0&&b.column>=0&&c.line>0&&c.column>=0&&d)return;else throw new Error('Invalid mapping: '+JSON.stringify({generated:b,source:d,original:c,name:e}))},b.prototype._serializeMappings=function b(){var h=0,g=1,j=0,k=0,i=0,l=0,e='',d;this._mappings.sort(a.compareByGeneratedPositions);for(var f=0,m=this._mappings.length;f<m;f++){if(d=this._mappings[f],d.generatedLine!==g){h=0;while(d.generatedLine!==g)e+=';',g++}else if(f>0){if(!a.compareByGeneratedPositions(d,this._mappings[f-1]))continue;e+=','}e+=c.encode(d.generatedColumn-h),h=d.generatedColumn,d.source!=null&&(e+=c.encode(this._sources.indexOf(d.source)-l),l=this._sources.indexOf(d.source),e+=c.encode(d.originalLine-1-k),k=d.originalLine-1,e+=c.encode(d.originalColumn-j),j=d.originalColumn,d.name!=null&&(e+=c.encode(this._names.indexOf(d.name)-i),i=this._names.indexOf(d.name)))}return e},b.prototype._generateSourcesContent=function b(d,c){return d.map(function(b){if(!this._sourcesContents)return null;c!=null&&(b=a.relative(c,b));var d=a.toSetString(b);return Object.prototype.hasOwnProperty.call(this._sourcesContents,d)?this._sourcesContents[d]:null},this)},b.prototype.toJSON=function a(){var b={version:this._version,sources:this._sources.toArray(),names:this._names.toArray(),mappings:this._serializeMappings()};return this._file!=null&&(b.file=this._file),this._sourceRoot!=null&&(b.sourceRoot=this._sourceRoot),this._sourcesContents&&(b.sourcesContent=this._generateSourcesContent(b.sources,b.sourceRoot)),b},b.prototype.toString=function a(){return JSON.stringify(this)},g.SourceMapGenerator=b})}),a.define('/node_modules/source-map/lib/source-map/array-set.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,d,e){function a(){this._array=[],this._set={}}var b=c('/node_modules/source-map/lib/source-map/util.js',e);a.fromArray=function b(e,g){var d=new a;for(var c=0,f=e.length;c<f;c++)d.add(e[c],g);return d},a.prototype.add=function a(c,f){var d=this.has(c),e=this._array.length;(!d||f)&&this._array.push(c),d||(this._set[b.toSetString(c)]=e)},a.prototype.has=function a(c){return Object.prototype.hasOwnProperty.call(this._set,b.toSetString(c))},a.prototype.indexOf=function a(c){if(this.has(c))return this._set[b.toSetString(c)];throw new Error('"'+c+'" is not in the set.')},a.prototype.at=function a(b){if(b>=0&&b<this._array.length)return this._array[b];throw new Error('No element indexed by '+b)},a.prototype.toArray=function a(){return this._array.slice()},d.ArraySet=a})}),a.define('/node_modules/source-map/lib/source-map/base64-vlq.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(j,f,h){function i(a){return a<0?(-a<<1)+1:(a<<1)+0}function g(b){var c=(b&1)===1,a=b>>1;return c?-a:a}var c=j('/node_modules/source-map/lib/source-map/base64.js',h),a=5,d=1<<a,e=d-1,b=d;f.encode=function d(j){var g='',h,f=i(j);do h=f&e,f>>>=a,f>0&&(h|=b),g+=c.encode(h);while(f>0);return g},f.decode=function d(i,l){var f=0,m=i.length,j=0,k=0,n,h;do{if(f>=m)throw new Error('Expected more digits in base 64 VLQ value.');h=c.decode(i.charAt(f++)),n=!!(h&b),h&=e,j+=h<<k,k+=a}while(n);l.value=g(j),l.rest=i.slice(f)}})}),a.define('/node_modules/source-map/lib/source-map/base64.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(d,c,e){var a={},b={};'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function(c,d){a[c]=d,b[d]=c}),c.encode=function a(c){if(c in b)return b[c];throw new TypeError('Must be between 0 and 63: '+c)},c.decode=function b(c){if(c in a)return a[c];throw new TypeError('Not a valid base 64 digit: '+c)}})}),a.define('/node_modules/source-map/lib/source-map/source-map-consumer.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,h,f){function b(e){var b=e;typeof e==='string'&&(b=JSON.parse(e.replace(/^\)\]\}'/,'')));var f=a.getArg(b,'version'),c=a.getArg(b,'sources'),g=a.getArg(b,'names',[]),h=a.getArg(b,'sourceRoot',null),i=a.getArg(b,'sourcesContent',null),j=a.getArg(b,'mappings'),k=a.getArg(b,'file',null);if(f!=this._version)throw new Error('Unsupported version: '+f);c=c.map(a.normalize),this._names=d.fromArray(g,!0),this._sources=d.fromArray(c,!0),this.sourceRoot=h,this.sourcesContent=i,this._mappings=j,this.file=k}var a=e('/node_modules/source-map/lib/source-map/util.js',f),g=e('/node_modules/source-map/lib/source-map/binary-search.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet,c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f);b.fromSourceMap=function c(f){var e=Object.create(b.prototype);return e._names=d.fromArray(f._names.toArray(),!0),e._sources=d.fromArray(f._sources.toArray(),!0),e.sourceRoot=f._sourceRoot,e.sourcesContent=f._generateSourcesContent(e._sources.toArray(),e.sourceRoot),e.file=f._file,e.__generatedMappings=f._mappings.slice().sort(a.compareByGeneratedPositions),e.__originalMappings=f._mappings.slice().sort(a.compareByOriginalPositions),e},b.prototype._version=3,Object.defineProperty(b.prototype,'sources',{get:function(){return this._sources.toArray().map(function(b){return this.sourceRoot!=null?a.join(this.sourceRoot,b):b},this)}}),b.prototype.__generatedMappings=null,Object.defineProperty(b.prototype,'_generatedMappings',{get:function(){return this.__generatedMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__generatedMappings}}),b.prototype.__originalMappings=null,Object.defineProperty(b.prototype,'_originalMappings',{get:function(){return this.__originalMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__originalMappings}}),b.prototype._nextCharIsMappingSeparator=function a(c){var b=c.charAt(0);return b===';'||b===','},b.prototype._parseMappings=function b(m,n){var j=1,g=0,i=0,h=0,k=0,l=0,d=m,e={},f;while(d.length>0)if(d.charAt(0)===';')j++,d=d.slice(1),g=0;else if(d.charAt(0)===',')d=d.slice(1);else{if(f={},f.generatedLine=j,c.decode(d,e),f.generatedColumn=g+e.value,g=f.generatedColumn,d=e.rest,d.length>0&&!this._nextCharIsMappingSeparator(d)){if(c.decode(d,e),f.source=this._sources.at(k+e.value),k+=e.value,d=e.rest,d.length===0||this._nextCharIsMappingSeparator(d))throw new Error('Found a source, but no line and column');if(c.decode(d,e),f.originalLine=i+e.value,i=f.originalLine,f.originalLine+=1,d=e.rest,d.length===0||this._nextCharIsMappingSeparator(d))throw new Error('Found a source and line, but no column');c.decode(d,e),f.originalColumn=h+e.value,h=f.originalColumn,d=e.rest,d.length>0&&!this._nextCharIsMappingSeparator(d)&&(c.decode(d,e),f.name=this._names.at(l+e.value),l+=e.value,d=e.rest)}this.__generatedMappings.push(f),typeof f.originalLine==='number'&&this.__originalMappings.push(f)}this.__generatedMappings.sort(a.compareByGeneratedPositions),this.__originalMappings.sort(a.compareByOriginalPositions)},b.prototype._findMapping=function a(b,e,c,d,f){if(b[c]<=0)throw new TypeError('Line must be greater than or equal to 1, got '+b[c]);if(b[d]<0)throw new TypeError('Column must be greater than or equal to 0, got '+b[d]);return g.search(b,e,f)},b.prototype.computeColumnSpans=function a(){for(var b=0;b<this._generatedMappings.length;++b){var c=this._generatedMappings[b];if(b+1<this._generatedMappings.length){var d=this._generatedMappings[b+1];if(c.generatedLine===d.generatedLine){c.lastGeneratedColumn=d.generatedColumn-1;continue}}c.lastGeneratedColumn=Infinity}},b.prototype.originalPositionFor=function b(g){var e={generatedLine:a.getArg(g,'line'),generatedColumn:a.getArg(g,'column')},f=this._findMapping(e,this._generatedMappings,'generatedLine','generatedColumn',a.compareByGeneratedPositions);if(f>=0){var c=this._generatedMappings[f];if(c.generatedLine===e.generatedLine){var d=a.getArg(c,'source',null);return d!=null&&this.sourceRoot!=null&&(d=a.join(this.sourceRoot,d)),{source:d,line:a.getArg(c,'originalLine',null),column:a.getArg(c,'originalColumn',null),name:a.getArg(c,'name',null)}}}return{source:null,line:null,column:null,name:null}},b.prototype.sourceContentFor=function b(c){if(!this.sourcesContent)return null;if(this.sourceRoot!=null&&(c=a.relative(this.sourceRoot,c)),this._sources.has(c))return this.sourcesContent[this._sources.indexOf(c)];var d;if(this.sourceRoot!=null&&(d=a.urlParse(this.sourceRoot))){var e=c.replace(/^file:\/\//,'');if(d.scheme=='file'&&this._sources.has(e))return this.sourcesContent[this._sources.indexOf(e)];if((!d.path||d.path=='/')&&this._sources.has('/'+c))return this.sourcesContent[this._sources.indexOf('/'+c)]}throw new Error('"'+c+'" is not in the SourceMap.')},b.prototype.generatedPositionFor=function b(e){var c={source:a.getArg(e,'source'),originalLine:a.getArg(e,'line'),originalColumn:a.getArg(e,'column')};this.sourceRoot!=null&&(c.source=a.relative(this.sourceRoot,c.source));var f=this._findMapping(c,this._originalMappings,'originalLine','originalColumn',a.compareByOriginalPositions);if(f>=0){var d=this._originalMappings[f];return{line:a.getArg(d,'generatedLine',null),column:a.getArg(d,'generatedColumn',null),lastColumn:a.getArg(d,'lastGeneratedColumn',null)}}return{line:null,column:null,lastColumn:null}},b.prototype.allGeneratedPositionsFor=function b(g){var d={source:a.getArg(g,'source'),originalLine:a.getArg(g,'line'),originalColumn:Infinity};this.sourceRoot!=null&&(d.source=a.relative(this.sourceRoot,d.source));var f=[],e=this._findMapping(d,this._originalMappings,'originalLine','originalColumn',a.compareByOriginalPositions);if(e>=0){var c=this._originalMappings[e];while(c&&c.originalLine===d.originalLine)f.push({line:a.getArg(c,'generatedLine',null),column:a.getArg(c,'generatedColumn',null),lastColumn:a.getArg(c,'lastGeneratedColumn',null)}),c=this._originalMappings[--e]}return f.reverse()},b.GENERATED_ORDER=1,b.ORIGINAL_ORDER=2,b.prototype.eachMapping=function c(h,i,j){var f=i||null,g=j||b.GENERATED_ORDER,d;switch(g){case b.GENERATED_ORDER:d=this._generatedMappings;break;case b.ORIGINAL_ORDER:d=this._originalMappings;break;default:throw new Error('Unknown order of iteration.')}var e=this.sourceRoot;d.map(function(b){var c=b.source;return c!=null&&e!=null&&(c=a.join(e,c)),{source:c,generatedLine:b.generatedLine,generatedColumn:b.generatedColumn,originalLine:b.originalLine,originalColumn:b.originalColumn,name:b.name}}).forEach(h,f)},h.SourceMapConsumer=b})}),a.define('/node_modules/source-map/lib/source-map/binary-search.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,b,d){function a(c,d,e,f,g){var b=Math.floor((d-c)/2)+c,h=g(e,f[b],!0);return h===0?b:h>0?d-b>1?a(b,d,e,f,g):b:b-c>1?a(c,b,e,f,g):c<0?-1:c}b.search=function b(d,c,e){return c.length===0?-1:a(-1,c.length,d,c,e)}})}),a.define('/node_modules/esutils/lib/utils.js',function(b,c,d,e){!function(){'use strict';c.ast=a('/node_modules/esutils/lib/ast.js',b),c.code=a('/node_modules/esutils/lib/code.js',b),c.keyword=a('/node_modules/esutils/lib/keyword.js',b)}()}),a.define('/node_modules/esutils/lib/keyword.js',function(b,c,d,e){!function(d){'use strict';function i(a){switch(a){case'implements':case'interface':case'package':case'private':case'protected':case'public':case'static':case'let':return!0;default:return!1}}function g(a,b){return!b&&a==='yield'?!1:c(a,b)}function c(a,b){if(b&&i(a))return!0;switch(a.length){case 2:return a==='if'||a==='in'||a==='do';case 3:return a==='var'||a==='for'||a==='new'||a==='try';case 4:return a==='this'||a==='else'||a==='case'||a==='void'||a==='with'||a==='enum';case 5:return a==='while'||a==='break'||a==='catch'||a==='throw'||a==='const'||a==='yield'||a==='class'||a==='super';case 6:return a==='return'||a==='typeof'||a==='delete'||a==='switch'||a==='export'||a==='import';case 7:return a==='default'||a==='finally'||a==='extends';case 8:return a==='function'||a==='continue'||a==='debugger';case 10:return a==='instanceof';default:return!1}}function f(a,b){return a==='null'||a==='true'||a==='false'||g(a,b)}function h(a,b){return a==='null'||a==='true'||a==='false'||c(a,b)}function j(a){return a==='eval'||a==='arguments'}function e(b){var c,e,a;if(b.length===0)return!1;if(a=b.charCodeAt(0),!d.isIdentifierStart(a)||a===92)return!1;for(c=1,e=b.length;c<e;++c)if(a=b.charCodeAt(c),!d.isIdentifierPart(a)||a===92)return!1;return!0}function l(a,b){return e(a)&&!f(a,b)}function k(a,b){return e(a)&&!h(a,b)}d=a('/node_modules/esutils/lib/code.js',b),b.exports={isKeywordES5:g,isKeywordES6:c,isReservedWordES5:f,isReservedWordES6:h,isRestrictedWord:j,isIdentifierName:e,isIdentifierES5:l,isIdentifierES6:k}}()}),a.define('/node_modules/esutils/lib/code.js',function(a,b,c,d){!function(b,c){'use strict';function d(a){return a>=48&&a<=57}function e(a){return d(a)||97<=a&&a<=102||65<=a&&a<=70}function f(a){return a>=48&&a<=55}function g(a){return a===32||a===9||a===11||a===12||a===160||a>=5760&&c.indexOf(a)>=0}function h(a){return a===10||a===13||a===8232||a===8233}function i(a){return a>=97&&a<=122||a>=65&&a<=90||a===36||a===95||a===92||a>=128&&b.NonAsciiIdentifierStart.test(String.fromCharCode(a))}function j(a){return a>=97&&a<=122||a>=65&&a<=90||a>=48&&a<=57||a===36||a===95||a===92||a>=128&&b.NonAsciiIdentifierPart.test(String.fromCharCode(a))}b={NonAsciiIdentifierStart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԧԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠࢢ-ࢬऄ-हऽॐक़-ॡॱ-ॷॹ-ॿঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚗꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꪀ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]'),NonAsciiIdentifierPart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮ̀-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁ҃-҇Ҋ-ԧԱ-Ֆՙա-և֑-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-٩ٮ-ۓە-ۜ۟-۪ۨ-ۼۿܐ-݊ݍ-ޱ߀-ߵߺࠀ-࠭ࡀ-࡛ࢠࢢ-ࢬࣤ-ࣾऀ-ॣ०-९ॱ-ॷॹ-ॿঁ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-ৱਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹ਼ਾ-ੂੇੈੋ-੍ੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હ઼-ૅે-ૉો-્ૐૠ-ૣ૦-૯ଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହ଼-ୄେୈୋ-୍ୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-்ௐௗ௦-௯ఁ-ఃఅ-ఌఎ-ఐఒ-నప-ళవ-హఽ-ౄె-ైొ-్ౕౖౘౙౠ-ౣ౦-౯ಂಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹ಼-ೄೆ-ೈೊ-್ೕೖೞೠ-ೣ೦-೯ೱೲംഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൎൗൠ-ൣ൦-൯ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆ්ා-ුූෘ-ෟෲෳก-ฺเ-๎๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆ່-ໍ໐-໙ໜ-ໟༀ༘༙༠-༩༹༵༷༾-ཇཉ-ཬཱ-྄྆-ྗྙ-ྼ࿆က-၉ၐ-ႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፝-፟ᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-᜔ᜠ-᜴ᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-៓ៗៜ៝០-៩᠋-᠍᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤜᤠ-ᤫᤰ-᤻᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧙ᨀ-ᨛᨠ-ᩞ᩠-᩿᩼-᪉᪐-᪙ᪧᬀ-ᭋ᭐-᭙᭫-᭳ᮀ-᯳ᰀ-᰷᱀-᱉ᱍ-ᱽ᳐-᳔᳒-ᳶᴀ-ᷦ᷼-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ‌‍‿⁀⁔ⁱⁿₐ-ₜ⃐-⃥⃜⃡-⃰ℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯ⵿-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〯〱-〵〸-〼ぁ-ゖ゙゚ゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟ-꛱ꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠧꡀ-ꡳꢀ-꣄꣐-꣙꣠-ꣷꣻ꤀-꤭ꤰ-꥓ꥠ-ꥼꦀ-꧀ꧏ-꧙ꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩻꪀ-ꫂꫛ-ꫝꫠ-ꫯꫲ-꫶ꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯪ꯬꯭꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻ︀-️︠-︦︳︴﹍-﹏ﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚ＿ａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]')},c=[5760,6158,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8239,8287,12288,65279],a.exports={isDecimalDigit:d,isHexDigit:e,isOctalDigit:f,isWhiteSpace:g,isLineTerminator:h,isIdentifierStart:i,isIdentifierPart:j}}()}),a.define('/node_modules/esutils/lib/ast.js',function(a,b,c,d){!function(){'use strict';function d(a){if(a==null)return!1;switch(a.type){case'ArrayExpression':case'AssignmentExpression':case'BinaryExpression':case'CallExpression':case'ConditionalExpression':case'FunctionExpression':case'Identifier':case'Literal':case'LogicalExpression':case'MemberExpression':case'NewExpression':case'ObjectExpression':case'SequenceExpression':case'ThisExpression':case'UnaryExpression':case'UpdateExpression':return!0}return!1}function e(a){if(a==null)return!1;switch(a.type){case'DoWhileStatement':case'ForInStatement':case'ForStatement':case'WhileStatement':return!0}return!1}function b(a){if(a==null)return!1;switch(a.type){case'BlockStatement':case'BreakStatement':case'ContinueStatement':case'DebuggerStatement':case'DoWhileStatement':case'EmptyStatement':case'ExpressionStatement':case'ForInStatement':case'ForStatement':case'IfStatement':case'LabeledStatement':case'ReturnStatement':case'SwitchStatement':case'ThrowStatement':case'TryStatement':case'VariableDeclaration':case'WhileStatement':case'WithStatement':return!0}return!1}function f(a){return b(a)||a!=null&&a.type==='FunctionDeclaration'}function c(a){switch(a.type){case'IfStatement':return a.alternate!=null?a.alternate:a.consequent;case'LabeledStatement':case'ForStatement':case'ForInStatement':case'WhileStatement':case'WithStatement':return a.body}return null}function g(b){var a;if(b.type!=='IfStatement')return!1;if(b.alternate==null)return!1;a=b.consequent;do{if(a.type==='IfStatement'&&a.alternate==null)return!0;a=c(a)}while(a);return!1}a.exports={isExpression:d,isStatement:b,isIterationStatement:e,isSourceElement:f,isProblematicIfStatement:g,trailingStatement:c}}()}),a.define('/node_modules/estraverse/estraverse.js',function(b,a,c,d){!function(c,b){'use strict';typeof define==='function'&&define.amd?define(['exports'],b):a!==void 0?b(a):b(c.estraverse={})}(this,function a(d){'use strict';function s(){}function p(d){var c={},a,b;for(a in d)d.hasOwnProperty(a)&&(b=d[a],typeof b==='object'&&b!==null?c[a]=p(b):c[a]=b);return c}function y(b){var c={},a;for(a in b)b.hasOwnProperty(a)&&(c[a]=b[a]);return c}function x(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?a=b:(c=d+1,a-=b+1);return c}function t(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?(c=d+1,a-=b+1):a=b;return c}function u(a,b){return l(b).forEach(function(c){a[c]=b[c]}),a}function i(a,b){this.parent=a,this.key=b}function e(a,b,c,d){this.node=a,this.path=b,this.wrap=c,this.ref=d}function b(){}function k(a){return a==null?!1:typeof a==='object'&&typeof a.type==='string'}function q(a,b){return(a===m.ObjectExpression||a===m.ObjectPattern)&&'properties'===b}function o(c,d){var a=new b;return a.traverse(c,d)}function w(c,d){var a=new b;return a.replace(c,d)}function z(a,c){var b;return b=x(c,function b(c){return c.range[0]>a.range[0]}),a.extendedRange=[a.range[0],a.range[1]],b!==c.length&&(a.extendedRange[1]=c[b].range[0]),b-=1,b>=0&&(a.extendedRange[0]=c[b].range[1]),a}function v(d,e,h){var a=[],g,f,c,b;if(!d.range)throw new Error('attachComments needs range information');if(!h.length){if(e.length){for(c=0,f=e.length;c<f;c+=1)g=p(e[c]),g.extendedRange=[0,d.range[0]],a.push(g);d.leadingComments=a}return d}for(c=0,f=e.length;c<f;c+=1)a.push(z(p(e[c]),h));return b=0,o(d,{enter:function(c){var d;while(b<a.length){if(d=a[b],d.extendedRange[1]>c.range[0])break;d.extendedRange[1]===c.range[0]?(c.leadingComments||(c.leadingComments=[]),c.leadingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?j.Break:a[b].extendedRange[0]>c.range[1]?j.Skip:void 0}}),b=0,o(d,{leave:function(c){var d;while(b<a.length){if(d=a[b],c.range[1]<d.extendedRange[0])break;c.range[1]===d.extendedRange[0]?(c.trailingComments||(c.trailingComments=[]),c.trailingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?j.Break:a[b].extendedRange[0]>c.range[1]?j.Skip:void 0}}),d}var m,h,j,n,r,l,c,g,f;return h=Array.isArray,h||(h=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),s(y),s(t),r=Object.create||function(){function a(){}return function(b){return a.prototype=b,new a}}(),l=Object.keys||function(c){var a=[],b;for(b in c)a.push(b);return a},m={AssignmentExpression:'AssignmentExpression',ArrayExpression:'ArrayExpression',ArrayPattern:'ArrayPattern',ArrowFunctionExpression:'ArrowFunctionExpression',AwaitExpression:'AwaitExpression',BlockStatement:'BlockStatement',BinaryExpression:'BinaryExpression',BreakStatement:'BreakStatement',CallExpression:'CallExpression',CatchClause:'CatchClause',ClassBody:'ClassBody',ClassDeclaration:'ClassDeclaration',ClassExpression:'ClassExpression',ComprehensionBlock:'ComprehensionBlock',ComprehensionExpression:'ComprehensionExpression',ConditionalExpression:'ConditionalExpression',ContinueStatement:'ContinueStatement',DebuggerStatement:'DebuggerStatement',DirectiveStatement:'DirectiveStatement',DoWhileStatement:'DoWhileStatement',EmptyStatement:'EmptyStatement',ExportBatchSpecifier:'ExportBatchSpecifier',ExportDeclaration:'ExportDeclaration',ExportSpecifier:'ExportSpecifier',ExpressionStatement:'ExpressionStatement',ForStatement:'ForStatement',ForInStatement:'ForInStatement',ForOfStatement:'ForOfStatement',FunctionDeclaration:'FunctionDeclaration',FunctionExpression:'FunctionExpression',GeneratorExpression:'GeneratorExpression',Identifier:'Identifier',IfStatement:'IfStatement',ImportDeclaration:'ImportDeclaration',ImportDefaultSpecifier:'ImportDefaultSpecifier',ImportNamespaceSpecifier:'ImportNamespaceSpecifier',ImportSpecifier:'ImportSpecifier',Literal:'Literal',LabeledStatement:'LabeledStatement',LogicalExpression:'LogicalExpression',MemberExpression:'MemberExpression',MethodDefinition:'MethodDefinition',ModuleSpecifier:'ModuleSpecifier',NewExpression:'NewExpression',ObjectExpression:'ObjectExpression',ObjectPattern:'ObjectPattern',Program:'Program',Property:'Property',ReturnStatement:'ReturnStatement',SequenceExpression:'SequenceExpression',SpreadElement:'SpreadElement',SwitchStatement:'SwitchStatement',SwitchCase:'SwitchCase',TaggedTemplateExpression:'TaggedTemplateExpression',TemplateElement:'TemplateElement',TemplateLiteral:'TemplateLiteral',ThisExpression:'ThisExpression',ThrowStatement:'ThrowStatement',TryStatement:'TryStatement',UnaryExpression:'UnaryExpression',UpdateExpression:'UpdateExpression',VariableDeclaration:'VariableDeclaration',VariableDeclarator:'VariableDeclarator',WhileStatement:'WhileStatement',WithStatement:'WithStatement',YieldExpression:'YieldExpression'},n={AssignmentExpression:['left','right'],ArrayExpression:['elements'],ArrayPattern:['elements'],ArrowFunctionExpression:['params','defaults','rest','body'],AwaitExpression:['argument'],BlockStatement:['body'],BinaryExpression:['left','right'],BreakStatement:['label'],CallExpression:['callee','arguments'],CatchClause:['param','body'],ClassBody:['body'],ClassDeclaration:['id','body','superClass'],ClassExpression:['id','body','superClass'],ComprehensionBlock:['left','right'],ComprehensionExpression:['blocks','filter','body'],ConditionalExpression:['test','consequent','alternate'],ContinueStatement:['label'],DebuggerStatement:[],DirectiveStatement:[],DoWhileStatement:['body','test'],EmptyStatement:[],ExportBatchSpecifier:[],ExportDeclaration:['declaration','specifiers','source'],ExportSpecifier:['id','name'],ExpressionStatement:['expression'],ForStatement:['init','test','update','body'],ForInStatement:['left','right','body'],ForOfStatement:['left','right','body'],FunctionDeclaration:['id','params','defaults','rest','body'],FunctionExpression:['id','params','defaults','rest','body'],GeneratorExpression:['blocks','filter','body'],Identifier:[],IfStatement:['test','consequent','alternate'],ImportDeclaration:['specifiers','source'],ImportDefaultSpecifier:['id'],ImportNamespaceSpecifier:['id'],ImportSpecifier:['id','name'],Literal:[],LabeledStatement:['label','body'],LogicalExpression:['left','right'],MemberExpression:['object','property'],MethodDefinition:['key','value'],ModuleSpecifier:[],NewExpression:['callee','arguments'],ObjectExpression:['properties'],ObjectPattern:['properties'],Program:['body'],Property:['key','value'],ReturnStatement:['argument'],SequenceExpression:['expressions'],SpreadElement:['argument'],SwitchStatement:['discriminant','cases'],SwitchCase:['test','consequent'],TaggedTemplateExpression:['tag','quasi'],TemplateElement:[],TemplateLiteral:['quasis','expressions'],ThisExpression:[],ThrowStatement:['argument'],TryStatement:['block','handlers','handler','guardedHandlers','finalizer'],UnaryExpression:['argument'],UpdateExpression:['argument'],VariableDeclaration:['declarations'],VariableDeclarator:['id','init'],WhileStatement:['test','body'],WithStatement:['object','body'],YieldExpression:['argument']},c={},g={},f={},j={Break:c,Skip:g,Remove:f},i.prototype.replace=function a(b){this.parent[this.key]=b},i.prototype.remove=function a(){return h(this.parent)?(this.parent.splice(this.key,1),!0):(this.replace(null),!1)},b.prototype.path=function a(){function e(b,a){if(h(a))for(c=0,g=a.length;c<g;++c)b.push(a[c]);else b.push(a)}var b,f,c,g,d,i;if(!this.__current.path)return null;for(d=[],b=2,f=this.__leavelist.length;b<f;++b)i=this.__leavelist[b],e(d,i.path);return e(d,this.__current.path),d},b.prototype.type=function(){var a=this.current();return a.type||this.__current.wrap},b.prototype.parents=function a(){var b,d,c;for(c=[],b=1,d=this.__leavelist.length;b<d;++b)c.push(this.__leavelist[b].node);return c},b.prototype.current=function a(){return this.__current.node},b.prototype.__execute=function a(c,d){var e,b;return b=undefined,e=this.__current,this.__current=d,this.__state=null,c&&(b=c.call(this,d.node,this.__leavelist[this.__leavelist.length-1].node)),this.__current=e,b},b.prototype.notify=function a(b){this.__state=b},b.prototype.skip=function(){this.notify(g)},b.prototype['break']=function(){this.notify(c)},b.prototype.remove=function(){this.notify(f)},b.prototype.__initialize=function(b,a){this.visitor=a,this.root=b,this.__worklist=[],this.__leavelist=[],this.__current=null,this.__state=null,this.__fallback=a.fallback==='iteration',this.__keys=n,a.keys&&(this.__keys=u(r(this.__keys),a.keys))},b.prototype.traverse=function a(v,u){var i,r,b,o,s,m,n,p,f,j,d,t;this.__initialize(v,u),t={},i=this.__worklist,r=this.__leavelist,i.push(new e(v,null,null,null)),r.push(new e(null,null,null,null));while(i.length){if(b=i.pop(),b===t){if(b=r.pop(),m=this.__execute(u.leave,b),this.__state===c||m===c)return;continue}if(b.node){if(m=this.__execute(u.enter,b),this.__state===c||m===c)return;if(i.push(t),r.push(b),this.__state===g||m===g)continue;if(o=b.node,s=b.wrap||o.type,j=this.__keys[s],!j)if(this.__fallback)j=l(o);else throw new Error('Unknown node type '+s+'.');p=j.length;while((p-=1)>=0){if(n=j[p],d=o[n],!d)continue;if(h(d)){f=d.length;while((f-=1)>=0){if(!d[f])continue;if(q(s,j[p]))b=new e(d[f],[n,f],'Property',null);else if(k(d[f]))b=new e(d[f],[n,f],null,null);else continue;i.push(b)}}else k(d)&&i.push(new e(d,n,null,null))}}}},b.prototype.replace=function a(w,x){function z(b){var c,d,a,e;if(b.ref.remove()){d=b.ref.key,e=b.ref.parent,c=n.length;while(c--)if(a=n[c],a.ref&&a.ref.parent===e){if(a.ref.key<d)break;--a.ref.key}}}var n,v,p,t,d,b,u,m,o,j,y,s,r;this.__initialize(w,x),y={},n=this.__worklist,v=this.__leavelist,s={root:w},b=new e(w,null,null,new i(s,'root')),n.push(b),v.push(b);while(n.length){if(b=n.pop(),b===y){if(b=v.pop(),d=this.__execute(x.leave,b),d!==undefined&&d!==c&&d!==g&&d!==f&&b.ref.replace(d),(this.__state===f||d===f)&&z(b),this.__state===c||d===c)return s.root;continue}if(d=this.__execute(x.enter,b),d!==undefined&&d!==c&&d!==g&&d!==f&&(b.ref.replace(d),b.node=d),(this.__state===f||d===f)&&(z(b),b.node=null),this.__state===c||d===c)return s.root;if(p=b.node,!p)continue;if(n.push(y),v.push(b),this.__state===g||d===g)continue;if(t=b.wrap||p.type,o=this.__keys[t],!o)if(this.__fallback)o=l(p);else throw new Error('Unknown node type '+t+'.');u=o.length;while((u-=1)>=0){if(r=o[u],j=p[r],!j)continue;if(h(j)){m=j.length;while((m-=1)>=0){if(!j[m])continue;if(q(t,o[u]))b=new e(j[m],[r,m],'Property',new i(j,m));else if(k(j[m]))b=new e(j[m],[r,m],null,new i(j,m));else continue;n.push(b)}}else k(j)&&n.push(new e(j,r,null,new i(p,r)))}}return s.root},d.version='1.8.1-dev',d.Syntax=m,d.traverse=o,d.replace=w,d.attachComments=v,d.VisitorKeys=n,d.VisitorOption=j,d.Controller=b,d.cloneEnvironment=function(){return a({})},d})}),a('/tools/entry-point.js')}.call(this,this))
;
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.acorn = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// A recursive descent parser operates by defining functions for all
// syntactic elements, and recursively calling those, each function
// advancing the input stream and returning an AST node. Precedence
// of constructs (for example, the fact that `!x[1]` means `!(x[1])`
// instead of `(!x)[1]` is handled by the fact that the parser
// function that parses unary prefix operators is called first, and
// in turn calls the function that parses `[]` subscripts — that
// way, it'll receive the node for `x[1]` already parsed, and wraps
// *that* in the unary operator node.
//
// Acorn uses an [operator precedence parser][opp] to handle binary
// operator precedence, because it is much more compact than using
// the technique outlined above, which uses different, nesting
// functions to specify precedence, for all of the ten binary
// precedence levels that JavaScript defines.
//
// [opp]: http://en.wikipedia.org/wiki/Operator-precedence_parser

"use strict";

var _tokentype = _dereq_("./tokentype");

var _state = _dereq_("./state");

var _identifier = _dereq_("./identifier");

var _util = _dereq_("./util");

var pp = _state.Parser.prototype;

// Check if property name clashes with already added.
// Object/class getters and setters are not allowed to clash —
// either with each other or with an init property — and in
// strict mode, init properties are also not allowed to be repeated.

pp.checkPropClash = function (prop, propHash) {
  if (this.options.ecmaVersion >= 6 && (prop.computed || prop.method || prop.shorthand)) return;
  var key = prop.key,
      name = undefined;
  switch (key.type) {
    case "Identifier":
      name = key.name;break;
    case "Literal":
      name = String(key.value);break;
    default:
      return;
  }
  var kind = prop.kind;
  if (this.options.ecmaVersion >= 6) {
    if (name === "__proto__" && kind === "init") {
      if (propHash.proto) this.raise(key.start, "Redefinition of __proto__ property");
      propHash.proto = true;
    }
    return;
  }
  var other = undefined;
  if (_util.has(propHash, name)) {
    other = propHash[name];
    var isGetSet = kind !== "init";
    if ((this.strict || isGetSet) && other[kind] || !(isGetSet ^ other.init)) this.raise(key.start, "Redefinition of property");
  } else {
    other = propHash[name] = {
      init: false,
      get: false,
      set: false
    };
  }
  other[kind] = true;
};

// ### Expression parsing

// These nest, from the most general expression type at the top to
// 'atomic', nondivisible expression types at the bottom. Most of
// the functions will simply let the function(s) below them parse,
// and, *if* the syntactic construct they handle is present, wrap
// the AST node that the inner parser gave them in another node.

// Parse a full expression. The optional arguments are used to
// forbid the `in` operator (in for loops initalization expressions)
// and provide reference for storing '=' operator inside shorthand
// property assignment in contexts where both object expression
// and object pattern might appear (so it's possible to raise
// delayed syntax error at correct position).

pp.parseExpression = function (noIn, refShorthandDefaultPos) {
  var startPos = this.start,
      startLoc = this.startLoc;
  var expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);
  if (this.type === _tokentype.types.comma) {
    var node = this.startNodeAt(startPos, startLoc);
    node.expressions = [expr];
    while (this.eat(_tokentype.types.comma)) node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};

// Parse an assignment expression. This includes applications of
// operators like `+=`.

pp.parseMaybeAssign = function (noIn, refShorthandDefaultPos, afterLeftParse) {
  if (this.type == _tokentype.types._yield && this.inGenerator) return this.parseYield();

  var failOnShorthandAssign = undefined;
  if (!refShorthandDefaultPos) {
    refShorthandDefaultPos = { start: 0 };
    failOnShorthandAssign = true;
  } else {
    failOnShorthandAssign = false;
  }
  var startPos = this.start,
      startLoc = this.startLoc;
  if (this.type == _tokentype.types.parenL || this.type == _tokentype.types.name) this.potentialArrowAt = this.start;
  var left = this.parseMaybeConditional(noIn, refShorthandDefaultPos);
  if (afterLeftParse) left = afterLeftParse.call(this, left, startPos, startLoc);
  if (this.type.isAssign) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    node.left = this.type === _tokentype.types.eq ? this.toAssignable(left) : left;
    refShorthandDefaultPos.start = 0; // reset because shorthand default was used correctly
    this.checkLVal(left);
    this.next();
    node.right = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "AssignmentExpression");
  } else if (failOnShorthandAssign && refShorthandDefaultPos.start) {
    this.unexpected(refShorthandDefaultPos.start);
  }
  return left;
};

// Parse a ternary conditional (`?:`) operator.

pp.parseMaybeConditional = function (noIn, refShorthandDefaultPos) {
  var startPos = this.start,
      startLoc = this.startLoc;
  var expr = this.parseExprOps(noIn, refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  if (this.eat(_tokentype.types.question)) {
    var node = this.startNodeAt(startPos, startLoc);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(_tokentype.types.colon);
    node.alternate = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};

// Start the precedence parser.

pp.parseExprOps = function (noIn, refShorthandDefaultPos) {
  var startPos = this.start,
      startLoc = this.startLoc;
  var expr = this.parseMaybeUnary(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  return this.parseExprOp(expr, startPos, startLoc, -1, noIn);
};

// Parse binary operators with the operator precedence parsing
// algorithm. `left` is the left-hand side of the operator.
// `minPrec` provides context that allows the function to stop and
// defer further parser to one of its callers when it encounters an
// operator that has a lower precedence than the set it is parsing.

pp.parseExprOp = function (left, leftStartPos, leftStartLoc, minPrec, noIn) {
  var prec = this.type.binop;
  if (prec != null && (!noIn || this.type !== _tokentype.types._in)) {
    if (prec > minPrec) {
      var node = this.startNodeAt(leftStartPos, leftStartLoc);
      node.left = left;
      node.operator = this.value;
      var op = this.type;
      this.next();
      var startPos = this.start,
          startLoc = this.startLoc;
      node.right = this.parseExprOp(this.parseMaybeUnary(), startPos, startLoc, prec, noIn);
      this.finishNode(node, op === _tokentype.types.logicalOR || op === _tokentype.types.logicalAND ? "LogicalExpression" : "BinaryExpression");
      return this.parseExprOp(node, leftStartPos, leftStartLoc, minPrec, noIn);
    }
  }
  return left;
};

// Parse unary operators, both prefix and postfix.

pp.parseMaybeUnary = function (refShorthandDefaultPos) {
  if (this.type.prefix) {
    var node = this.startNode(),
        update = this.type === _tokentype.types.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary();
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);
    if (update) this.checkLVal(node.argument);else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") this.raise(node.start, "Deleting local variable in strict mode");
    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  }
  var startPos = this.start,
      startLoc = this.startLoc;
  var expr = this.parseExprSubscripts(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  while (this.type.postfix && !this.canInsertSemicolon()) {
    var node = this.startNodeAt(startPos, startLoc);
    node.operator = this.value;
    node.prefix = false;
    node.argument = expr;
    this.checkLVal(expr);
    this.next();
    expr = this.finishNode(node, "UpdateExpression");
  }
  return expr;
};

// Parse call, dot, and `[]`-subscript expressions.

pp.parseExprSubscripts = function (refShorthandDefaultPos) {
  var startPos = this.start,
      startLoc = this.startLoc;
  var expr = this.parseExprAtom(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  return this.parseSubscripts(expr, startPos, startLoc);
};

pp.parseSubscripts = function (base, startPos, startLoc, noCalls) {
  for (;;) {
    if (this.eat(_tokentype.types.dot)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseIdent(true);
      node.computed = false;
      base = this.finishNode(node, "MemberExpression");
    } else if (this.eat(_tokentype.types.bracketL)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.object = base;
      node.property = this.parseExpression();
      node.computed = true;
      this.expect(_tokentype.types.bracketR);
      base = this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.eat(_tokentype.types.parenL)) {
      var node = this.startNodeAt(startPos, startLoc);
      node.callee = base;
      node.arguments = this.parseExprList(_tokentype.types.parenR, false);
      base = this.finishNode(node, "CallExpression");
    } else if (this.type === _tokentype.types.backQuote) {
      var node = this.startNodeAt(startPos, startLoc);
      node.tag = base;
      node.quasi = this.parseTemplate();
      base = this.finishNode(node, "TaggedTemplateExpression");
    } else {
      return base;
    }
  }
};

// Parse an atomic expression — either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

pp.parseExprAtom = function (refShorthandDefaultPos) {
  var node = undefined,
      canBeArrow = this.potentialArrowAt == this.start;
  switch (this.type) {
    case _tokentype.types._super:
      if (!this.inFunction) this.raise(this.start, "'super' outside of function or class");
    case _tokentype.types._this:
      var type = this.type === _tokentype.types._this ? "ThisExpression" : "Super";
      node = this.startNode();
      this.next();
      return this.finishNode(node, type);

    case _tokentype.types._yield:
      if (this.inGenerator) this.unexpected();

    case _tokentype.types.name:
      var startPos = this.start,
          startLoc = this.startLoc;
      var id = this.parseIdent(this.type !== _tokentype.types.name);
      if (canBeArrow && !this.canInsertSemicolon() && this.eat(_tokentype.types.arrow)) return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), [id]);
      return id;

    case _tokentype.types.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;

    case _tokentype.types.num:case _tokentype.types.string:
      return this.parseLiteral(this.value);

    case _tokentype.types._null:case _tokentype.types._true:case _tokentype.types._false:
      node = this.startNode();
      node.value = this.type === _tokentype.types._null ? null : this.type === _tokentype.types._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");

    case _tokentype.types.parenL:
      return this.parseParenAndDistinguishExpression(canBeArrow);

    case _tokentype.types.bracketL:
      node = this.startNode();
      this.next();
      // check whether this is array comprehension or regular array
      if (this.options.ecmaVersion >= 7 && this.type === _tokentype.types._for) {
        return this.parseComprehension(node, false);
      }
      node.elements = this.parseExprList(_tokentype.types.bracketR, true, true, refShorthandDefaultPos);
      return this.finishNode(node, "ArrayExpression");

    case _tokentype.types.braceL:
      return this.parseObj(false, refShorthandDefaultPos);

    case _tokentype.types._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, false);

    case _tokentype.types._class:
      return this.parseClass(this.startNode(), false);

    case _tokentype.types._new:
      return this.parseNew();

    case _tokentype.types.backQuote:
      return this.parseTemplate();

    default:
      this.unexpected();
  }
};

pp.parseLiteral = function (value) {
  var node = this.startNode();
  node.value = value;
  node.raw = this.input.slice(this.start, this.end);
  this.next();
  return this.finishNode(node, "Literal");
};

pp.parseParenExpression = function () {
  this.expect(_tokentype.types.parenL);
  var val = this.parseExpression();
  this.expect(_tokentype.types.parenR);
  return val;
};

pp.parseParenAndDistinguishExpression = function (canBeArrow) {
  var startPos = this.start,
      startLoc = this.startLoc,
      val = undefined;
  if (this.options.ecmaVersion >= 6) {
    this.next();

    if (this.options.ecmaVersion >= 7 && this.type === _tokentype.types._for) {
      return this.parseComprehension(this.startNodeAt(startPos, startLoc), true);
    }

    var innerStartPos = this.start,
        innerStartLoc = this.startLoc;
    var exprList = [],
        first = true;
    var refShorthandDefaultPos = { start: 0 },
        spreadStart = undefined,
        innerParenStart = undefined;
    while (this.type !== _tokentype.types.parenR) {
      first ? first = false : this.expect(_tokentype.types.comma);
      if (this.type === _tokentype.types.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseParenItem(this.parseRest()));
        break;
      } else {
        if (this.type === _tokentype.types.parenL && !innerParenStart) {
          innerParenStart = this.start;
        }
        exprList.push(this.parseMaybeAssign(false, refShorthandDefaultPos, this.parseParenItem));
      }
    }
    var innerEndPos = this.start,
        innerEndLoc = this.startLoc;
    this.expect(_tokentype.types.parenR);

    if (canBeArrow && !this.canInsertSemicolon() && this.eat(_tokentype.types.arrow)) {
      if (innerParenStart) this.unexpected(innerParenStart);
      return this.parseParenArrowList(startPos, startLoc, exprList);
    }

    if (!exprList.length) this.unexpected(this.lastTokStart);
    if (spreadStart) this.unexpected(spreadStart);
    if (refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStartPos, innerStartLoc);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEndPos, innerEndLoc);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }

  if (this.options.preserveParens) {
    var par = this.startNodeAt(startPos, startLoc);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};

pp.parseParenItem = function (item) {
  return item;
};

pp.parseParenArrowList = function (startPos, startLoc, exprList) {
  return this.parseArrowExpression(this.startNodeAt(startPos, startLoc), exprList);
};

// New's precedence is slightly tricky. It must allow its argument
// to be a `[]` or dot subscript expression, but not a call — at
// least, not without wrapping it in parentheses. Thus, it uses the

var empty = [];

pp.parseNew = function () {
  var node = this.startNode();
  var meta = this.parseIdent(true);
  if (this.options.ecmaVersion >= 6 && this.eat(_tokentype.types.dot)) {
    node.meta = meta;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") this.raise(node.property.start, "The only valid meta property for new is new.target");
    return this.finishNode(node, "MetaProperty");
  }
  var startPos = this.start,
      startLoc = this.startLoc;
  node.callee = this.parseSubscripts(this.parseExprAtom(), startPos, startLoc, true);
  if (this.eat(_tokentype.types.parenL)) node.arguments = this.parseExprList(_tokentype.types.parenR, false);else node.arguments = empty;
  return this.finishNode(node, "NewExpression");
};

// Parse template expression.

pp.parseTemplateElement = function () {
  var elem = this.startNode();
  elem.value = {
    raw: this.input.slice(this.start, this.end).replace(/\r\n?/g, "\n"),
    cooked: this.value
  };
  this.next();
  elem.tail = this.type === _tokentype.types.backQuote;
  return this.finishNode(elem, "TemplateElement");
};

pp.parseTemplate = function () {
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement();
  node.quasis = [curElt];
  while (!curElt.tail) {
    this.expect(_tokentype.types.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(_tokentype.types.braceR);
    node.quasis.push(curElt = this.parseTemplateElement());
  }
  this.next();
  return this.finishNode(node, "TemplateLiteral");
};

// Parse an object literal or binding pattern.

pp.parseObj = function (isPattern, refShorthandDefaultPos) {
  var node = this.startNode(),
      first = true,
      propHash = {};
  node.properties = [];
  this.next();
  while (!this.eat(_tokentype.types.braceR)) {
    if (!first) {
      this.expect(_tokentype.types.comma);
      if (this.afterTrailingComma(_tokentype.types.braceR)) break;
    } else first = false;

    var prop = this.startNode(),
        isGenerator = undefined,
        startPos = undefined,
        startLoc = undefined;
    if (this.options.ecmaVersion >= 6) {
      prop.method = false;
      prop.shorthand = false;
      if (isPattern || refShorthandDefaultPos) {
        startPos = this.start;
        startLoc = this.startLoc;
      }
      if (!isPattern) isGenerator = this.eat(_tokentype.types.star);
    }
    this.parsePropertyName(prop);
    this.parsePropertyValue(prop, isPattern, isGenerator, startPos, startLoc, refShorthandDefaultPos);
    this.checkPropClash(prop, propHash);
    node.properties.push(this.finishNode(prop, "Property"));
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};

pp.parsePropertyValue = function (prop, isPattern, isGenerator, startPos, startLoc, refShorthandDefaultPos) {
  if (this.eat(_tokentype.types.colon)) {
    prop.value = isPattern ? this.parseMaybeDefault(this.start, this.startLoc) : this.parseMaybeAssign(false, refShorthandDefaultPos);
    prop.kind = "init";
  } else if (this.options.ecmaVersion >= 6 && this.type === _tokentype.types.parenL) {
    if (isPattern) this.unexpected();
    prop.kind = "init";
    prop.method = true;
    prop.value = this.parseMethod(isGenerator);
  } else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type != _tokentype.types.comma && this.type != _tokentype.types.braceR)) {
    if (isGenerator || isPattern) this.unexpected();
    prop.kind = prop.key.name;
    this.parsePropertyName(prop);
    prop.value = this.parseMethod(false);
    var paramCount = prop.kind === "get" ? 0 : 1;
    if (prop.value.params.length !== paramCount) {
      var start = prop.value.start;
      if (prop.kind === "get") this.raise(start, "getter should have no params");else this.raise(start, "setter should have exactly one param");
    }
  } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
    prop.kind = "init";
    if (isPattern) {
      if (this.isKeyword(prop.key.name) || this.strict && (_identifier.reservedWords.strictBind(prop.key.name) || _identifier.reservedWords.strict(prop.key.name)) || !this.options.allowReserved && this.isReservedWord(prop.key.name)) this.raise(prop.key.start, "Binding " + prop.key.name);
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    } else if (this.type === _tokentype.types.eq && refShorthandDefaultPos) {
      if (!refShorthandDefaultPos.start) refShorthandDefaultPos.start = this.start;
      prop.value = this.parseMaybeDefault(startPos, startLoc, prop.key);
    } else {
      prop.value = prop.key;
    }
    prop.shorthand = true;
  } else this.unexpected();
};

pp.parsePropertyName = function (prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(_tokentype.types.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(_tokentype.types.bracketR);
      return prop.key;
    } else {
      prop.computed = false;
    }
  }
  return prop.key = this.type === _tokentype.types.num || this.type === _tokentype.types.string ? this.parseExprAtom() : this.parseIdent(true);
};

// Initialize empty function node.

pp.initFunction = function (node) {
  node.id = null;
  if (this.options.ecmaVersion >= 6) {
    node.generator = false;
    node.expression = false;
  }
};

// Parse object or class method.

pp.parseMethod = function (isGenerator) {
  var node = this.startNode();
  this.initFunction(node);
  this.expect(_tokentype.types.parenL);
  node.params = this.parseBindingList(_tokentype.types.parenR, false, false);
  var allowExpressionBody = undefined;
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
  }
  this.parseFunctionBody(node, false);
  return this.finishNode(node, "FunctionExpression");
};

// Parse arrow function expression with given parameters.

pp.parseArrowExpression = function (node, params) {
  this.initFunction(node);
  node.params = this.toAssignableList(params, true);
  this.parseFunctionBody(node, true);
  return this.finishNode(node, "ArrowFunctionExpression");
};

// Parse function body and check parameters.

pp.parseFunctionBody = function (node, allowExpression) {
  var isExpression = allowExpression && this.type !== _tokentype.types.braceL;

  if (isExpression) {
    node.body = this.parseMaybeAssign();
    node.expression = true;
  } else {
    // Start a new scope with regard to labels and the `inFunction`
    // flag (restore them to their old value afterwards).
    var oldInFunc = this.inFunction,
        oldInGen = this.inGenerator,
        oldLabels = this.labels;
    this.inFunction = true;this.inGenerator = node.generator;this.labels = [];
    node.body = this.parseBlock(true);
    node.expression = false;
    this.inFunction = oldInFunc;this.inGenerator = oldInGen;this.labels = oldLabels;
  }

  // If this is a strict mode function, verify that argument names
  // are not repeated, and it does not try to bind the words `eval`
  // or `arguments`.
  if (this.strict || !isExpression && node.body.body.length && this.isUseStrict(node.body.body[0])) {
    var nameHash = {},
        oldStrict = this.strict;
    this.strict = true;
    if (node.id) this.checkLVal(node.id, true);
    for (var i = 0; i < node.params.length; i++) {
      this.checkLVal(node.params[i], true, nameHash);
    }this.strict = oldStrict;
  }
};

// Parses a comma-separated list of expressions, and returns them as
// an array. `close` is the token type that ends the list, and
// `allowEmpty` can be turned on to allow subsequent commas with
// nothing in between them to be parsed as `null` (which is needed
// for array literals).

pp.parseExprList = function (close, allowTrailingComma, allowEmpty, refShorthandDefaultPos) {
  var elts = [],
      first = true;
  while (!this.eat(close)) {
    if (!first) {
      this.expect(_tokentype.types.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) break;
    } else first = false;

    var elt = undefined;
    if (allowEmpty && this.type === _tokentype.types.comma) elt = null;else if (this.type === _tokentype.types.ellipsis) elt = this.parseSpread(refShorthandDefaultPos);else elt = this.parseMaybeAssign(false, refShorthandDefaultPos);
    elts.push(elt);
  }
  return elts;
};

// Parse the next token as an identifier. If `liberal` is true (used
// when parsing properties), it will also convert keywords into
// identifiers.

pp.parseIdent = function (liberal) {
  var node = this.startNode();
  if (liberal && this.options.allowReserved == "never") liberal = false;
  if (this.type === _tokentype.types.name) {
    if (!liberal && (!this.options.allowReserved && this.isReservedWord(this.value) || this.strict && _identifier.reservedWords.strict(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf("\\") == -1))) this.raise(this.start, "The keyword '" + this.value + "' is reserved");
    node.name = this.value;
  } else if (liberal && this.type.keyword) {
    node.name = this.type.keyword;
  } else {
    this.unexpected();
  }
  this.next();
  return this.finishNode(node, "Identifier");
};

// Parses yield expression inside generator.

pp.parseYield = function () {
  var node = this.startNode();
  this.next();
  if (this.type == _tokentype.types.semi || this.canInsertSemicolon() || this.type != _tokentype.types.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(_tokentype.types.star);
    node.argument = this.parseMaybeAssign();
  }
  return this.finishNode(node, "YieldExpression");
};

// Parses array and generator comprehensions.

pp.parseComprehension = function (node, isGenerator) {
  node.blocks = [];
  while (this.type === _tokentype.types._for) {
    var block = this.startNode();
    this.next();
    this.expect(_tokentype.types.parenL);
    block.left = this.parseBindingAtom();
    this.checkLVal(block.left, true);
    this.expectContextual("of");
    block.right = this.parseExpression();
    this.expect(_tokentype.types.parenR);
    node.blocks.push(this.finishNode(block, "ComprehensionBlock"));
  }
  node.filter = this.eat(_tokentype.types._if) ? this.parseParenExpression() : null;
  node.body = this.parseExpression();
  this.expect(isGenerator ? _tokentype.types.parenR : _tokentype.types.bracketR);
  node.generator = isGenerator;
  return this.finishNode(node, "ComprehensionExpression");
};

},{"./identifier":2,"./state":10,"./tokentype":14,"./util":15}],2:[function(_dereq_,module,exports){
// This is a trick taken from Esprima. It turns out that, on
// non-Chrome browsers, to check whether a string is in a set, a
// predicate containing a big ugly `switch` statement is faster than
// a regular expression, and on Chrome the two are about on par.
// This function uses `eval` (non-lexical) to produce such a
// predicate from a space-separated string of words.
//
// It starts by sorting the words by length.

"use strict";

exports.__esModule = true;
exports.isIdentifierStart = isIdentifierStart;
exports.isIdentifierChar = isIdentifierChar;
function makePredicate(words) {
  words = words.split(" ");
  var f = "",
      cats = [];
  out: for (var i = 0; i < words.length; ++i) {
    for (var j = 0; j < cats.length; ++j) {
      if (cats[j][0].length == words[i].length) {
        cats[j].push(words[i]);
        continue out;
      }
    }cats.push([words[i]]);
  }
  function compareTo(arr) {
    if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
    f += "switch(str){";
    for (var i = 0; i < arr.length; ++i) {
      f += "case " + JSON.stringify(arr[i]) + ":";
    }f += "return true}return false;";
  }

  // When there are more than three length categories, an outer
  // switch first dispatches on the lengths, to save on comparisons.

  if (cats.length > 3) {
    cats.sort(function (a, b) {
      return b.length - a.length;
    });
    f += "switch(str.length){";
    for (var i = 0; i < cats.length; ++i) {
      var cat = cats[i];
      f += "case " + cat[0].length + ":";
      compareTo(cat);
    }
    f += "}"

    // Otherwise, simply generate a flat `switch` statement.

    ;
  } else {
    compareTo(words);
  }
  return new Function("str", f);
}

// Reserved word lists for various dialects of the language

var reservedWords = {
  3: makePredicate("abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile"),
  5: makePredicate("class enum extends super const export import"),
  6: makePredicate("enum await"),
  strict: makePredicate("implements interface let package private protected public static yield"),
  strictBind: makePredicate("eval arguments")
};

exports.reservedWords = reservedWords;
// And the keywords

var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

var keywords = {
  5: makePredicate(ecma5AndLessKeywords),
  6: makePredicate(ecma5AndLessKeywords + " let const class extends export import yield super")
};

exports.keywords = keywords;
// ## Character categories

// Big ugly regular expressions that match characters in the
// whitespace, identifier, and identifier-start categories. These
// are only applied when a character is found to actually have a
// code point above 128.
// Generated by `tools/generate-identifier-regex.js`.

var nonASCIIidentifierStartChars = "ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽͿΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԯԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠ-ࢲऄ-हऽॐक़-ॡॱ-ঀঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛸᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤞᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕ℘-ℝℤΩℨK-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ々-〇〡-〩〱-〵〸-〼ぁ-ゖ゛-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚝꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞭꞰꞱꟷ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꧠ-ꧤꧦ-ꧯꧺ-ꧾꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꩾ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꬰ-ꭚꭜ-ꭟꭤꭥꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ";
var nonASCIIidentifierChars = "‌‍·̀-ͯ·҃-֑҇-ׇֽֿׁׂׅׄؐ-ًؚ-٩ٰۖ-ۜ۟-۪ۤۧۨ-ۭ۰-۹ܑܰ-݊ަ-ް߀-߉߫-߳ࠖ-࠙ࠛ-ࠣࠥ-ࠧࠩ-࡙࠭-࡛ࣤ-ःऺ-़ा-ॏ॑-ॗॢॣ०-९ঁ-ঃ়া-ৄেৈো-্ৗৢৣ০-৯ਁ-ਃ਼ਾ-ੂੇੈੋ-੍ੑ੦-ੱੵઁ-ઃ઼ા-ૅે-ૉો-્ૢૣ૦-૯ଁ-ଃ଼ା-ୄେୈୋ-୍ୖୗୢୣ୦-୯ஂா-ூெ-ைொ-்ௗ௦-௯ఀ-ఃా-ౄె-ైొ-్ౕౖౢౣ౦-౯ಁ-ಃ಼ಾ-ೄೆ-ೈೊ-್ೕೖೢೣ೦-೯ഁ-ഃാ-ൄെ-ൈൊ-്ൗൢൣ൦-൯ංඃ්ා-ුූෘ-ෟ෦-෯ෲෳัิ-ฺ็-๎๐-๙ັິ-ູົຼ່-ໍ໐-໙༘༙༠-༩༹༵༷༾༿ཱ-྄྆྇ྍ-ྗྙ-ྼ࿆ါ-ှ၀-၉ၖ-ၙၞ-ၠၢ-ၤၧ-ၭၱ-ၴႂ-ႍႏ-ႝ፝-፟፩-፱ᜒ-᜔ᜲ-᜴ᝒᝓᝲᝳ឴-៓៝០-៩᠋-᠍᠐-᠙ᢩᤠ-ᤫᤰ-᤻᥆-᥏ᦰ-ᧀᧈᧉ᧐-᧚ᨗ-ᨛᩕ-ᩞ᩠-᩿᩼-᪉᪐-᪙᪰-᪽ᬀ-ᬄ᬴-᭄᭐-᭙᭫-᭳ᮀ-ᮂᮡ-ᮭ᮰-᮹᯦-᯳ᰤ-᰷᱀-᱉᱐-᱙᳐-᳔᳒-᳨᳭ᳲ-᳴᳸᳹᷀-᷵᷼-᷿‿⁀⁔⃐-⃥⃜⃡-⃰⳯-⵿⳱ⷠ-〪ⷿ-゙゚〯꘠-꘩꙯ꙴ-꙽ꚟ꛰꛱ꠂ꠆ꠋꠣ-ꠧꢀꢁꢴ-꣄꣐-꣙꣠-꣱꤀-꤉ꤦ-꤭ꥇ-꥓ꦀ-ꦃ꦳-꧀꧐-꧙ꧥ꧰-꧹ꨩ-ꨶꩃꩌꩍ꩐-꩙ꩻ-ꩽꪰꪲ-ꪴꪷꪸꪾ꪿꫁ꫫ-ꫯꫵ꫶ꯣ-ꯪ꯬꯭꯰-꯹ﬞ︀-️︠-︭︳︴﹍-﹏０-９＿";

var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

nonASCIIidentifierStartChars = nonASCIIidentifierChars = null;

// These are a run-length and offset encoded representation of the
// >0xffff code points that are a valid part of identifiers. The
// offset starts at 0x10000, and each pair of numbers represents an
// offset to the next range, and then a size of the range. They were
// generated by tools/generate-identifier-regex.js
var astralIdentifierStartCodes = [0, 11, 2, 25, 2, 18, 2, 1, 2, 14, 3, 13, 35, 122, 70, 52, 268, 28, 4, 48, 48, 31, 17, 26, 6, 37, 11, 29, 3, 35, 5, 7, 2, 4, 43, 157, 99, 39, 9, 51, 157, 310, 10, 21, 11, 7, 153, 5, 3, 0, 2, 43, 2, 1, 4, 0, 3, 22, 11, 22, 10, 30, 98, 21, 11, 25, 71, 55, 7, 1, 65, 0, 16, 3, 2, 2, 2, 26, 45, 28, 4, 28, 36, 7, 2, 27, 28, 53, 11, 21, 11, 18, 14, 17, 111, 72, 955, 52, 76, 44, 33, 24, 27, 35, 42, 34, 4, 0, 13, 47, 15, 3, 22, 0, 38, 17, 2, 24, 133, 46, 39, 7, 3, 1, 3, 21, 2, 6, 2, 1, 2, 4, 4, 0, 32, 4, 287, 47, 21, 1, 2, 0, 185, 46, 82, 47, 21, 0, 60, 42, 502, 63, 32, 0, 449, 56, 1288, 920, 104, 110, 2962, 1070, 13266, 568, 8, 30, 114, 29, 19, 47, 17, 3, 32, 20, 6, 18, 881, 68, 12, 0, 67, 12, 16481, 1, 3071, 106, 6, 12, 4, 8, 8, 9, 5991, 84, 2, 70, 2, 1, 3, 0, 3, 1, 3, 3, 2, 11, 2, 0, 2, 6, 2, 64, 2, 3, 3, 7, 2, 6, 2, 27, 2, 3, 2, 4, 2, 0, 4, 6, 2, 339, 3, 24, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 30, 2, 24, 2, 7, 4149, 196, 1340, 3, 2, 26, 2, 1, 2, 0, 3, 0, 2, 9, 2, 3, 2, 0, 2, 0, 7, 0, 5, 0, 2, 0, 2, 0, 2, 2, 2, 1, 2, 0, 3, 0, 2, 0, 2, 0, 2, 0, 2, 0, 2, 1, 2, 0, 3, 3, 2, 6, 2, 3, 2, 3, 2, 0, 2, 9, 2, 16, 6, 2, 2, 4, 2, 16, 4421, 42710, 42, 4148, 12, 221, 16355, 541];
var astralIdentifierCodes = [509, 0, 227, 0, 150, 4, 294, 9, 1368, 2, 2, 1, 6, 3, 41, 2, 5, 0, 166, 1, 1306, 2, 54, 14, 32, 9, 16, 3, 46, 10, 54, 9, 7, 2, 37, 13, 2, 9, 52, 0, 13, 2, 49, 13, 16, 9, 83, 11, 168, 11, 6, 9, 8, 2, 57, 0, 2, 6, 3, 1, 3, 2, 10, 0, 11, 1, 3, 6, 4, 4, 316, 19, 13, 9, 214, 6, 3, 8, 112, 16, 16, 9, 82, 12, 9, 9, 535, 9, 20855, 9, 135, 4, 60, 6, 26, 9, 1016, 45, 17, 3, 19723, 1, 5319, 4, 4, 5, 9, 7, 3, 6, 31, 3, 149, 2, 1418, 49, 4305, 6, 792618, 239];

// This has a complexity linear to the value of the code. The
// assumption is that looking up astral identifier characters is
// rare.
function isInAstralSet(code, set) {
  var pos = 0x10000;
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) return false;
    pos += set[i + 1];
    if (pos >= code) return true;
  }
}

// Test whether a given character code starts an identifier.

function isIdentifierStart(code, astral) {
  if (code < 65) return code === 36;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code <= 0xffff) return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  if (astral === false) return false;
  return isInAstralSet(code, astralIdentifierStartCodes);
}

// Test whether a given character is part of an identifier.

function isIdentifierChar(code, astral) {
  if (code < 48) return code === 36;
  if (code < 58) return true;
  if (code < 65) return false;
  if (code < 91) return true;
  if (code < 97) return code === 95;
  if (code < 123) return true;
  if (code <= 0xffff) return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  if (astral === false) return false;
  return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}

},{}],3:[function(_dereq_,module,exports){
// Acorn is a tiny, fast JavaScript parser written in JavaScript.
//
// Acorn was written by Marijn Haverbeke, Ingvar Stepanyan, and
// various contributors and released under an MIT license.
//
// Git repositories for Acorn are available at
//
//     http://marijnhaverbeke.nl/git/acorn
//     https://github.com/marijnh/acorn.git
//
// Please use the [github bug tracker][ghbt] to report issues.
//
// [ghbt]: https://github.com/marijnh/acorn/issues
//
// This file defines the main parser interface. The library also comes
// with a [error-tolerant parser][dammit] and an
// [abstract syntax tree walker][walk], defined in other files.
//
// [dammit]: acorn_loose.js
// [walk]: util/walk.js

"use strict";

exports.__esModule = true;
exports.parse = parse;
exports.parseExpressionAt = parseExpressionAt;
exports.tokenizer = tokenizer;

var _state = _dereq_("./state");

var _options = _dereq_("./options");

_dereq_("./parseutil");

_dereq_("./statement");

_dereq_("./lval");

_dereq_("./expression");

_dereq_("./location");

exports.Parser = _state.Parser;
exports.plugins = _state.plugins;
exports.defaultOptions = _options.defaultOptions;

var _locutil = _dereq_("./locutil");

exports.Position = _locutil.Position;
exports.SourceLocation = _locutil.SourceLocation;
exports.getLineInfo = _locutil.getLineInfo;

var _node = _dereq_("./node");

exports.Node = _node.Node;

var _tokentype = _dereq_("./tokentype");

exports.TokenType = _tokentype.TokenType;
exports.tokTypes = _tokentype.types;

var _tokencontext = _dereq_("./tokencontext");

exports.TokContext = _tokencontext.TokContext;
exports.tokContexts = _tokencontext.types;

var _identifier = _dereq_("./identifier");

exports.isIdentifierChar = _identifier.isIdentifierChar;
exports.isIdentifierStart = _identifier.isIdentifierStart;

var _tokenize = _dereq_("./tokenize");

exports.Token = _tokenize.Token;

var _whitespace = _dereq_("./whitespace");

exports.isNewLine = _whitespace.isNewLine;
exports.lineBreak = _whitespace.lineBreak;
exports.lineBreakG = _whitespace.lineBreakG;
var version = "2.4.0";

exports.version = version;
// The main exported interface (under `self.acorn` when in the
// browser) is a `parse` function that takes a code string and
// returns an abstract syntax tree as specified by [Mozilla parser
// API][api].
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

function parse(input, options) {
  return new _state.Parser(options, input).parse();
}

// This function tries to parse a single expression at a given
// offset in a string. Useful for parsing mixed-language formats
// that embed JavaScript expressions.

function parseExpressionAt(input, pos, options) {
  var p = new _state.Parser(options, input, pos);
  p.nextToken();
  return p.parseExpression();
}

// Acorn is organized as a tokenizer and a recursive-descent parser.
// The `tokenize` export provides an interface to the tokenizer.

function tokenizer(input, options) {
  return new _state.Parser(options, input);
}

},{"./expression":1,"./identifier":2,"./location":4,"./locutil":5,"./lval":6,"./node":7,"./options":8,"./parseutil":9,"./state":10,"./statement":11,"./tokencontext":12,"./tokenize":13,"./tokentype":14,"./whitespace":16}],4:[function(_dereq_,module,exports){
"use strict";

var _state = _dereq_("./state");

var _locutil = _dereq_("./locutil");

var pp = _state.Parser.prototype;

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

pp.raise = function (pos, message) {
  var loc = _locutil.getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  var err = new SyntaxError(message);
  err.pos = pos;err.loc = loc;err.raisedAt = this.pos;
  throw err;
};

pp.curPosition = function () {
  if (this.options.locations) {
    return new _locutil.Position(this.curLine, this.pos - this.lineStart);
  }
};

},{"./locutil":5,"./state":10}],5:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
exports.getLineInfo = getLineInfo;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _whitespace = _dereq_("./whitespace");

// These are used when `options.locations` is on, for the
// `startLoc` and `endLoc` properties.

var Position = (function () {
  function Position(line, col) {
    _classCallCheck(this, Position);

    this.line = line;
    this.column = col;
  }

  Position.prototype.offset = function offset(n) {
    return new Position(this.line, this.column + n);
  };

  return Position;
})();

exports.Position = Position;

var SourceLocation = function SourceLocation(p, start, end) {
  _classCallCheck(this, SourceLocation);

  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) this.source = p.sourceFile;
};

exports.SourceLocation = SourceLocation;

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

function getLineInfo(input, offset) {
  for (var line = 1, cur = 0;;) {
    _whitespace.lineBreakG.lastIndex = cur;
    var match = _whitespace.lineBreakG.exec(input);
    if (match && match.index < offset) {
      ++line;
      cur = match.index + match[0].length;
    } else {
      return new Position(line, offset - cur);
    }
  }
}

},{"./whitespace":16}],6:[function(_dereq_,module,exports){
"use strict";

var _tokentype = _dereq_("./tokentype");

var _state = _dereq_("./state");

var _identifier = _dereq_("./identifier");

var _util = _dereq_("./util");

var pp = _state.Parser.prototype;

// Convert existing expression atom to assignable pattern
// if possible.

pp.toAssignable = function (node, isBinding) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "Identifier":
      case "ObjectPattern":
      case "ArrayPattern":
      case "AssignmentPattern":
        break;

      case "ObjectExpression":
        node.type = "ObjectPattern";
        for (var i = 0; i < node.properties.length; i++) {
          var prop = node.properties[i];
          if (prop.kind !== "init") this.raise(prop.key.start, "Object pattern can't contain getter or setter");
          this.toAssignable(prop.value, isBinding);
        }
        break;

      case "ArrayExpression":
        node.type = "ArrayPattern";
        this.toAssignableList(node.elements, isBinding);
        break;

      case "AssignmentExpression":
        if (node.operator === "=") {
          node.type = "AssignmentPattern";
          delete node.operator;
        } else {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
        break;

      case "ParenthesizedExpression":
        node.expression = this.toAssignable(node.expression, isBinding);
        break;

      case "MemberExpression":
        if (!isBinding) break;

      default:
        this.raise(node.start, "Assigning to rvalue");
    }
  }
  return node;
};

// Convert list of expression atoms to binding list.

pp.toAssignableList = function (exprList, isBinding) {
  var end = exprList.length;
  if (end) {
    var last = exprList[end - 1];
    if (last && last.type == "RestElement") {
      --end;
    } else if (last && last.type == "SpreadElement") {
      last.type = "RestElement";
      var arg = last.argument;
      this.toAssignable(arg, isBinding);
      if (arg.type !== "Identifier" && arg.type !== "MemberExpression" && arg.type !== "ArrayPattern") this.unexpected(arg.start);
      --end;
    }
  }
  for (var i = 0; i < end; i++) {
    var elt = exprList[i];
    if (elt) this.toAssignable(elt, isBinding);
  }
  return exprList;
};

// Parses spread element.

pp.parseSpread = function (refShorthandDefaultPos) {
  var node = this.startNode();
  this.next();
  node.argument = this.parseMaybeAssign(refShorthandDefaultPos);
  return this.finishNode(node, "SpreadElement");
};

pp.parseRest = function () {
  var node = this.startNode();
  this.next();
  node.argument = this.type === _tokentype.types.name || this.type === _tokentype.types.bracketL ? this.parseBindingAtom() : this.unexpected();
  return this.finishNode(node, "RestElement");
};

// Parses lvalue (assignable) atom.

pp.parseBindingAtom = function () {
  if (this.options.ecmaVersion < 6) return this.parseIdent();
  switch (this.type) {
    case _tokentype.types.name:
      return this.parseIdent();

    case _tokentype.types.bracketL:
      var node = this.startNode();
      this.next();
      node.elements = this.parseBindingList(_tokentype.types.bracketR, true, true);
      return this.finishNode(node, "ArrayPattern");

    case _tokentype.types.braceL:
      return this.parseObj(true);

    default:
      this.unexpected();
  }
};

pp.parseBindingList = function (close, allowEmpty, allowTrailingComma) {
  var elts = [],
      first = true;
  while (!this.eat(close)) {
    if (first) first = false;else this.expect(_tokentype.types.comma);
    if (allowEmpty && this.type === _tokentype.types.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === _tokentype.types.ellipsis) {
      var rest = this.parseRest();
      this.parseBindingListItem(rest);
      elts.push(rest);
      this.expect(close);
      break;
    } else {
      var elem = this.parseMaybeDefault(this.start, this.startLoc);
      this.parseBindingListItem(elem);
      elts.push(elem);
    }
  }
  return elts;
};

pp.parseBindingListItem = function (param) {
  return param;
};

// Parses assignment pattern around given atom if possible.

pp.parseMaybeDefault = function (startPos, startLoc, left) {
  left = left || this.parseBindingAtom();
  if (this.options.ecmaVersion < 6 || !this.eat(_tokentype.types.eq)) return left;
  var node = this.startNodeAt(startPos, startLoc);
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};

// Verify that a node is an lval — something that can be assigned
// to.

pp.checkLVal = function (expr, isBinding, checkClashes) {
  switch (expr.type) {
    case "Identifier":
      if (this.strict && (_identifier.reservedWords.strictBind(expr.name) || _identifier.reservedWords.strict(expr.name))) this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      if (checkClashes) {
        if (_util.has(checkClashes, expr.name)) this.raise(expr.start, "Argument name clash in strict mode");
        checkClashes[expr.name] = true;
      }
      break;

    case "MemberExpression":
      if (isBinding) this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " member expression");
      break;

    case "ObjectPattern":
      for (var i = 0; i < expr.properties.length; i++) {
        this.checkLVal(expr.properties[i].value, isBinding, checkClashes);
      }break;

    case "ArrayPattern":
      for (var i = 0; i < expr.elements.length; i++) {
        var elem = expr.elements[i];
        if (elem) this.checkLVal(elem, isBinding, checkClashes);
      }
      break;

    case "AssignmentPattern":
      this.checkLVal(expr.left, isBinding, checkClashes);
      break;

    case "RestElement":
      this.checkLVal(expr.argument, isBinding, checkClashes);
      break;

    case "ParenthesizedExpression":
      this.checkLVal(expr.expression, isBinding, checkClashes);
      break;

    default:
      this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
  }
};

},{"./identifier":2,"./state":10,"./tokentype":14,"./util":15}],7:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _state = _dereq_("./state");

var _locutil = _dereq_("./locutil");

var Node = function Node(parser, pos, loc) {
  _classCallCheck(this, Node);

  this.type = "";
  this.start = pos;
  this.end = 0;
  if (parser.options.locations) this.loc = new _locutil.SourceLocation(parser, loc);
  if (parser.options.directSourceFile) this.sourceFile = parser.options.directSourceFile;
  if (parser.options.ranges) this.range = [pos, 0];
};

exports.Node = Node;

// Start an AST node, attaching a start offset.

var pp = _state.Parser.prototype;

pp.startNode = function () {
  return new Node(this, this.start, this.startLoc);
};

pp.startNodeAt = function (pos, loc) {
  return new Node(this, pos, loc);
};

// Finish an AST node, adding `type` and `end` properties.

function finishNodeAt(node, type, pos, loc) {
  node.type = type;
  node.end = pos;
  if (this.options.locations) node.loc.end = loc;
  if (this.options.ranges) node.range[1] = pos;
  return node;
}

pp.finishNode = function (node, type) {
  return finishNodeAt.call(this, node, type, this.lastTokEnd, this.lastTokEndLoc);
};

// Finish node at given position

pp.finishNodeAt = function (node, type, pos, loc) {
  return finishNodeAt.call(this, node, type, pos, loc);
};

},{"./locutil":5,"./state":10}],8:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
exports.getOptions = getOptions;

var _util = _dereq_("./util");

var _locutil = _dereq_("./locutil");

// A second optional argument can be given to further configure
// the parser process. These options are recognized:

var defaultOptions = {
  // `ecmaVersion` indicates the ECMAScript version to parse. Must
  // be either 3, or 5, or 6. This influences support for strict
  // mode, the set of reserved words, support for getters and
  // setters and other features.
  ecmaVersion: 5,
  // Source type ("script" or "module") for different semantics
  sourceType: "script",
  // `onInsertedSemicolon` can be a callback that will be called
  // when a semicolon is automatically inserted. It will be passed
  // th position of the comma as an offset, and if `locations` is
  // enabled, it is given the location as a `{line, column}` object
  // as second argument.
  onInsertedSemicolon: null,
  // `onTrailingComma` is similar to `onInsertedSemicolon`, but for
  // trailing commas.
  onTrailingComma: null,
  // By default, reserved words are not enforced. Disable
  // `allowReserved` to enforce them. When this option has the
  // value "never", reserved words and keywords can also not be
  // used as property names.
  allowReserved: true,
  // When enabled, a return at the top level is not considered an
  // error.
  allowReturnOutsideFunction: false,
  // When enabled, import/export statements are not constrained to
  // appearing at the top of the program.
  allowImportExportEverywhere: false,
  // When enabled, hashbang directive in the beginning of file
  // is allowed and treated as a line comment.
  allowHashBang: false,
  // When `locations` is on, `loc` properties holding objects with
  // `start` and `end` properties in `{line, column}` form (with
  // line being 1-based and column 0-based) will be attached to the
  // nodes.
  locations: false,
  // A function can be passed as `onToken` option, which will
  // cause Acorn to call that function with object in the same
  // format as tokenize() returns. Note that you are not
  // allowed to call the parser from the callback—that will
  // corrupt its internal state.
  onToken: null,
  // A function can be passed as `onComment` option, which will
  // cause Acorn to call that function with `(block, text, start,
  // end)` parameters whenever a comment is skipped. `block` is a
  // boolean indicating whether this is a block (`/* */`) comment,
  // `text` is the content of the comment, and `start` and `end` are
  // character offsets that denote the start and end of the comment.
  // When the `locations` option is on, two more parameters are
  // passed, the full `{line, column}` locations of the start and
  // end of the comments. Note that you are not allowed to call the
  // parser from the callback—that will corrupt its internal state.
  onComment: null,
  // Nodes have their start and end characters offsets recorded in
  // `start` and `end` properties (directly on the node, rather than
  // the `loc` object, which holds line/column data. To also add a
  // [semi-standardized][range] `range` property holding a `[start,
  // end]` array with the same numbers, set the `ranges` option to
  // `true`.
  //
  // [range]: https://bugzilla.mozilla.org/show_bug.cgi?id=745678
  ranges: false,
  // It is possible to parse multiple files into a single AST by
  // passing the tree produced by parsing the first file as
  // `program` option in subsequent parses. This will add the
  // toplevel forms of the parsed file to the `Program` (top) node
  // of an existing parse tree.
  program: null,
  // When `locations` is on, you can pass this to record the source
  // file in every node's `loc` object.
  sourceFile: null,
  // This value, if given, is stored in every node, whether
  // `locations` is on or off.
  directSourceFile: null,
  // When enabled, parenthesized expressions are represented by
  // (non-standard) ParenthesizedExpression nodes
  preserveParens: false,
  plugins: {}
};

exports.defaultOptions = defaultOptions;
// Interpret and default an options object

function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && _util.has(opts, opt) ? opts[opt] : defaultOptions[opt];
  }if (_util.isArray(options.onToken)) {
    (function () {
      var tokens = options.onToken;
      options.onToken = function (token) {
        return tokens.push(token);
      };
    })();
  }
  if (_util.isArray(options.onComment)) options.onComment = pushComment(options, options.onComment);

  return options;
}

function pushComment(options, array) {
  return function (block, text, start, end, startLoc, endLoc) {
    var comment = {
      type: block ? "Block" : "Line",
      value: text,
      start: start,
      end: end
    };
    if (options.locations) comment.loc = new _locutil.SourceLocation(this, startLoc, endLoc);
    if (options.ranges) comment.range = [start, end];
    array.push(comment);
  };
}

},{"./locutil":5,"./util":15}],9:[function(_dereq_,module,exports){
"use strict";

var _tokentype = _dereq_("./tokentype");

var _state = _dereq_("./state");

var _whitespace = _dereq_("./whitespace");

var pp = _state.Parser.prototype;

// ## Parser utilities

// Test whether a statement node is the string literal `"use strict"`.

pp.isUseStrict = function (stmt) {
  return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && stmt.expression.raw.slice(1, -1) === "use strict";
};

// Predicate that tests whether the next token is of the given
// type, and if yes, consumes it as a side effect.

pp.eat = function (type) {
  if (this.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};

// Tests whether parsed token is a contextual keyword.

pp.isContextual = function (name) {
  return this.type === _tokentype.types.name && this.value === name;
};

// Consumes contextual keyword if possible.

pp.eatContextual = function (name) {
  return this.value === name && this.eat(_tokentype.types.name);
};

// Asserts that following token is given contextual keyword.

pp.expectContextual = function (name) {
  if (!this.eatContextual(name)) this.unexpected();
};

// Test whether a semicolon can be inserted at the current position.

pp.canInsertSemicolon = function () {
  return this.type === _tokentype.types.eof || this.type === _tokentype.types.braceR || _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
};

pp.insertSemicolon = function () {
  if (this.canInsertSemicolon()) {
    if (this.options.onInsertedSemicolon) this.options.onInsertedSemicolon(this.lastTokEnd, this.lastTokEndLoc);
    return true;
  }
};

// Consume a semicolon, or, failing that, see if we are allowed to
// pretend that there is a semicolon at this position.

pp.semicolon = function () {
  if (!this.eat(_tokentype.types.semi) && !this.insertSemicolon()) this.unexpected();
};

pp.afterTrailingComma = function (tokType) {
  if (this.type == tokType) {
    if (this.options.onTrailingComma) this.options.onTrailingComma(this.lastTokStart, this.lastTokStartLoc);
    this.next();
    return true;
  }
};

// Expect a token of a given type. If found, consume it, otherwise,
// raise an unexpected token error.

pp.expect = function (type) {
  this.eat(type) || this.unexpected();
};

// Raise an unexpected token error.

pp.unexpected = function (pos) {
  this.raise(pos != null ? pos : this.start, "Unexpected token");
};

},{"./state":10,"./tokentype":14,"./whitespace":16}],10:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _identifier = _dereq_("./identifier");

var _tokentype = _dereq_("./tokentype");

var _whitespace = _dereq_("./whitespace");

var _options = _dereq_("./options");

// Registered plugins
var plugins = {};

exports.plugins = plugins;

var Parser = (function () {
  function Parser(options, input, startPos) {
    _classCallCheck(this, Parser);

    this.options = _options.getOptions(options);
    this.sourceFile = this.options.sourceFile;
    this.isKeyword = _identifier.keywords[this.options.ecmaVersion >= 6 ? 6 : 5];
    this.isReservedWord = _identifier.reservedWords[this.options.ecmaVersion];
    this.input = String(input);

    // Used to signal to callers of `readWord1` whether the word
    // contained any escape sequences. This is needed because words with
    // escape sequences must not be interpreted as keywords.
    this.containsEsc = false;

    // Load plugins
    this.loadPlugins(this.options.plugins);

    // Set up token state

    // The current position of the tokenizer in the input.
    if (startPos) {
      this.pos = startPos;
      this.lineStart = Math.max(0, this.input.lastIndexOf("\n", startPos));
      this.curLine = this.input.slice(0, this.lineStart).split(_whitespace.lineBreak).length;
    } else {
      this.pos = this.lineStart = 0;
      this.curLine = 1;
    }

    // Properties of the current token:
    // Its type
    this.type = _tokentype.types.eof;
    // For tokens that include more information than their type, the value
    this.value = null;
    // Its start and end offset
    this.start = this.end = this.pos;
    // And, if locations are used, the {line, column} object
    // corresponding to those offsets
    this.startLoc = this.endLoc = this.curPosition();

    // Position information for the previous token
    this.lastTokEndLoc = this.lastTokStartLoc = null;
    this.lastTokStart = this.lastTokEnd = this.pos;

    // The context stack is used to superficially track syntactic
    // context to predict whether a regular expression is allowed in a
    // given position.
    this.context = this.initialContext();
    this.exprAllowed = true;

    // Figure out if it's a module code.
    this.strict = this.inModule = this.options.sourceType === "module";

    // Used to signify the start of a potential arrow function
    this.potentialArrowAt = -1;

    // Flags to track whether we are in a function, a generator.
    this.inFunction = this.inGenerator = false;
    // Labels in scope.
    this.labels = [];

    // If enabled, skip leading hashbang line.
    if (this.pos === 0 && this.options.allowHashBang && this.input.slice(0, 2) === "#!") this.skipLineComment(2);
  }

  Parser.prototype.extend = function extend(name, f) {
    this[name] = f(this[name]);
  };

  Parser.prototype.loadPlugins = function loadPlugins(pluginConfigs) {
    for (var _name in pluginConfigs) {
      var plugin = plugins[_name];
      if (!plugin) throw new Error("Plugin '" + _name + "' not found");
      plugin(this, pluginConfigs[_name]);
    }
  };

  Parser.prototype.parse = function parse() {
    var node = this.options.program || this.startNode();
    this.nextToken();
    return this.parseTopLevel(node);
  };

  return Parser;
})();

exports.Parser = Parser;

},{"./identifier":2,"./options":8,"./tokentype":14,"./whitespace":16}],11:[function(_dereq_,module,exports){
"use strict";

var _tokentype = _dereq_("./tokentype");

var _state = _dereq_("./state");

var _whitespace = _dereq_("./whitespace");

var pp = _state.Parser.prototype;

// ### Statement parsing

// Parse a program. Initializes the parser, reads any number of
// statements, and wraps them in a Program node.  Optionally takes a
// `program` argument.  If present, the statements will be appended
// to its body instead of creating a new node.

pp.parseTopLevel = function (node) {
  var first = true;
  if (!node.body) node.body = [];
  while (this.type !== _tokentype.types.eof) {
    var stmt = this.parseStatement(true, true);
    node.body.push(stmt);
    if (first) {
      if (this.isUseStrict(stmt)) this.setStrict(true);
      first = false;
    }
  }
  this.next();
  if (this.options.ecmaVersion >= 6) {
    node.sourceType = this.options.sourceType;
  }
  return this.finishNode(node, "Program");
};

var loopLabel = { kind: "loop" },
    switchLabel = { kind: "switch" };

// Parse a single statement.
//
// If expecting a statement and finding a slash operator, parse a
// regular expression literal. This is to handle cases like
// `if (foo) /blah/.exec(foo)`, where looking at the previous token
// does not help.

pp.parseStatement = function (declaration, topLevel) {
  var starttype = this.type,
      node = this.startNode();

  // Most types of statements are recognized by the keyword they
  // start with. Many are trivial to parse, some require a bit of
  // complexity.

  switch (starttype) {
    case _tokentype.types._break:case _tokentype.types._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case _tokentype.types._debugger:
      return this.parseDebuggerStatement(node);
    case _tokentype.types._do:
      return this.parseDoStatement(node);
    case _tokentype.types._for:
      return this.parseForStatement(node);
    case _tokentype.types._function:
      if (!declaration && this.options.ecmaVersion >= 6) this.unexpected();
      return this.parseFunctionStatement(node);
    case _tokentype.types._class:
      if (!declaration) this.unexpected();
      return this.parseClass(node, true);
    case _tokentype.types._if:
      return this.parseIfStatement(node);
    case _tokentype.types._return:
      return this.parseReturnStatement(node);
    case _tokentype.types._switch:
      return this.parseSwitchStatement(node);
    case _tokentype.types._throw:
      return this.parseThrowStatement(node);
    case _tokentype.types._try:
      return this.parseTryStatement(node);
    case _tokentype.types._let:case _tokentype.types._const:
      if (!declaration) this.unexpected(); // NOTE: falls through to _var
    case _tokentype.types._var:
      return this.parseVarStatement(node, starttype);
    case _tokentype.types._while:
      return this.parseWhileStatement(node);
    case _tokentype.types._with:
      return this.parseWithStatement(node);
    case _tokentype.types.braceL:
      return this.parseBlock();
    case _tokentype.types.semi:
      return this.parseEmptyStatement(node);
    case _tokentype.types._export:
    case _tokentype.types._import:
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) this.raise(this.start, "'import' and 'export' may only appear at the top level");
        if (!this.inModule) this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
      }
      return starttype === _tokentype.types._import ? this.parseImport(node) : this.parseExport(node);

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    default:
      var maybeName = this.value,
          expr = this.parseExpression();
      if (starttype === _tokentype.types.name && expr.type === "Identifier" && this.eat(_tokentype.types.colon)) return this.parseLabeledStatement(node, maybeName, expr);else return this.parseExpressionStatement(node, expr);
  }
};

pp.parseBreakContinueStatement = function (node, keyword) {
  var isBreak = keyword == "break";
  this.next();
  if (this.eat(_tokentype.types.semi) || this.insertSemicolon()) node.label = null;else if (this.type !== _tokentype.types.name) this.unexpected();else {
    node.label = this.parseIdent();
    this.semicolon();
  }

  // Verify that there is an actual destination to break or
  // continue to.
  for (var i = 0; i < this.labels.length; ++i) {
    var lab = this.labels[i];
    if (node.label == null || lab.name === node.label.name) {
      if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
      if (node.label && isBreak) break;
    }
  }
  if (i === this.labels.length) this.raise(node.start, "Unsyntactic " + keyword);
  return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
};

pp.parseDebuggerStatement = function (node) {
  this.next();
  this.semicolon();
  return this.finishNode(node, "DebuggerStatement");
};

pp.parseDoStatement = function (node) {
  this.next();
  this.labels.push(loopLabel);
  node.body = this.parseStatement(false);
  this.labels.pop();
  this.expect(_tokentype.types._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) this.eat(_tokentype.types.semi);else this.semicolon();
  return this.finishNode(node, "DoWhileStatement");
};

// Disambiguating between a `for` and a `for`/`in` or `for`/`of`
// loop is non-trivial. Basically, we have to parse the init `var`
// statement or expression, disallowing the `in` operator (see
// the second parameter to `parseExpression`), and then check
// whether the next token is `in` or `of`. When there is no init
// part (semicolon immediately after the opening parenthesis), it
// is a regular `for` loop.

pp.parseForStatement = function (node) {
  this.next();
  this.labels.push(loopLabel);
  this.expect(_tokentype.types.parenL);
  if (this.type === _tokentype.types.semi) return this.parseFor(node, null);
  if (this.type === _tokentype.types._var || this.type === _tokentype.types._let || this.type === _tokentype.types._const) {
    var _init = this.startNode(),
        varKind = this.type;
    this.next();
    this.parseVar(_init, true, varKind);
    this.finishNode(_init, "VariableDeclaration");
    if ((this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && _init.declarations.length === 1 && !(varKind !== _tokentype.types._var && _init.declarations[0].init)) return this.parseForIn(node, _init);
    return this.parseFor(node, _init);
  }
  var refShorthandDefaultPos = { start: 0 };
  var init = this.parseExpression(true, refShorthandDefaultPos);
  if (this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
    this.toAssignable(init);
    this.checkLVal(init);
    return this.parseForIn(node, init);
  } else if (refShorthandDefaultPos.start) {
    this.unexpected(refShorthandDefaultPos.start);
  }
  return this.parseFor(node, init);
};

pp.parseFunctionStatement = function (node) {
  this.next();
  return this.parseFunction(node, true);
};

pp.parseIfStatement = function (node) {
  this.next();
  node.test = this.parseParenExpression();
  node.consequent = this.parseStatement(false);
  node.alternate = this.eat(_tokentype.types._else) ? this.parseStatement(false) : null;
  return this.finishNode(node, "IfStatement");
};

pp.parseReturnStatement = function (node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction) this.raise(this.start, "'return' outside of function");
  this.next();

  // In `return` (and `break`/`continue`), the keywords with
  // optional arguments, we eagerly look for a semicolon or the
  // possibility to insert one.

  if (this.eat(_tokentype.types.semi) || this.insertSemicolon()) node.argument = null;else {
    node.argument = this.parseExpression();this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};

pp.parseSwitchStatement = function (node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(_tokentype.types.braceL);
  this.labels.push(switchLabel);

  // Statements under must be grouped (by label) in SwitchCase
  // nodes. `cur` is used to keep the node that we are currently
  // adding statements to.

  for (var cur, sawDefault = false; this.type != _tokentype.types.braceR;) {
    if (this.type === _tokentype.types._case || this.type === _tokentype.types._default) {
      var isCase = this.type === _tokentype.types._case;
      if (cur) this.finishNode(cur, "SwitchCase");
      node.cases.push(cur = this.startNode());
      cur.consequent = [];
      this.next();
      if (isCase) {
        cur.test = this.parseExpression();
      } else {
        if (sawDefault) this.raise(this.lastTokStart, "Multiple default clauses");
        sawDefault = true;
        cur.test = null;
      }
      this.expect(_tokentype.types.colon);
    } else {
      if (!cur) this.unexpected();
      cur.consequent.push(this.parseStatement(true));
    }
  }
  if (cur) this.finishNode(cur, "SwitchCase");
  this.next(); // Closing brace
  this.labels.pop();
  return this.finishNode(node, "SwitchStatement");
};

pp.parseThrowStatement = function (node) {
  this.next();
  if (_whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) this.raise(this.lastTokEnd, "Illegal newline after throw");
  node.argument = this.parseExpression();
  this.semicolon();
  return this.finishNode(node, "ThrowStatement");
};

// Reused empty array added for node fields that are always empty.

var empty = [];

pp.parseTryStatement = function (node) {
  this.next();
  node.block = this.parseBlock();
  node.handler = null;
  if (this.type === _tokentype.types._catch) {
    var clause = this.startNode();
    this.next();
    this.expect(_tokentype.types.parenL);
    clause.param = this.parseBindingAtom();
    this.checkLVal(clause.param, true);
    this.expect(_tokentype.types.parenR);
    clause.guard = null;
    clause.body = this.parseBlock();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.guardedHandlers = empty;
  node.finalizer = this.eat(_tokentype.types._finally) ? this.parseBlock() : null;
  if (!node.handler && !node.finalizer) this.raise(node.start, "Missing catch or finally clause");
  return this.finishNode(node, "TryStatement");
};

pp.parseVarStatement = function (node, kind) {
  this.next();
  this.parseVar(node, false, kind);
  this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};

pp.parseWhileStatement = function (node) {
  this.next();
  node.test = this.parseParenExpression();
  this.labels.push(loopLabel);
  node.body = this.parseStatement(false);
  this.labels.pop();
  return this.finishNode(node, "WhileStatement");
};

pp.parseWithStatement = function (node) {
  if (this.strict) this.raise(this.start, "'with' in strict mode");
  this.next();
  node.object = this.parseParenExpression();
  node.body = this.parseStatement(false);
  return this.finishNode(node, "WithStatement");
};

pp.parseEmptyStatement = function (node) {
  this.next();
  return this.finishNode(node, "EmptyStatement");
};

pp.parseLabeledStatement = function (node, maybeName, expr) {
  for (var i = 0; i < this.labels.length; ++i) {
    if (this.labels[i].name === maybeName) this.raise(expr.start, "Label '" + maybeName + "' is already declared");
  }var kind = this.type.isLoop ? "loop" : this.type === _tokentype.types._switch ? "switch" : null;
  for (var i = this.labels.length - 1; i >= 0; i--) {
    var label = this.labels[i];
    if (label.statementStart == node.start) {
      label.statementStart = this.start;
      label.kind = kind;
    } else break;
  }
  this.labels.push({ name: maybeName, kind: kind, statementStart: this.start });
  node.body = this.parseStatement(true);
  this.labels.pop();
  node.label = expr;
  return this.finishNode(node, "LabeledStatement");
};

pp.parseExpressionStatement = function (node, expr) {
  node.expression = expr;
  this.semicolon();
  return this.finishNode(node, "ExpressionStatement");
};

// Parse a semicolon-enclosed block of statements, handling `"use
// strict"` declarations when `allowStrict` is true (used for
// function bodies).

pp.parseBlock = function (allowStrict) {
  var node = this.startNode(),
      first = true,
      oldStrict = undefined;
  node.body = [];
  this.expect(_tokentype.types.braceL);
  while (!this.eat(_tokentype.types.braceR)) {
    var stmt = this.parseStatement(true);
    node.body.push(stmt);
    if (first && allowStrict && this.isUseStrict(stmt)) {
      oldStrict = this.strict;
      this.setStrict(this.strict = true);
    }
    first = false;
  }
  if (oldStrict === false) this.setStrict(false);
  return this.finishNode(node, "BlockStatement");
};

// Parse a regular `for` loop. The disambiguation code in
// `parseStatement` will already have parsed the init statement or
// expression.

pp.parseFor = function (node, init) {
  node.init = init;
  this.expect(_tokentype.types.semi);
  node.test = this.type === _tokentype.types.semi ? null : this.parseExpression();
  this.expect(_tokentype.types.semi);
  node.update = this.type === _tokentype.types.parenR ? null : this.parseExpression();
  this.expect(_tokentype.types.parenR);
  node.body = this.parseStatement(false);
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};

// Parse a `for`/`in` and `for`/`of` loop, which are almost
// same from parser's perspective.

pp.parseForIn = function (node, init) {
  var type = this.type === _tokentype.types._in ? "ForInStatement" : "ForOfStatement";
  this.next();
  node.left = init;
  node.right = this.parseExpression();
  this.expect(_tokentype.types.parenR);
  node.body = this.parseStatement(false);
  this.labels.pop();
  return this.finishNode(node, type);
};

// Parse a list of variable declarations.

pp.parseVar = function (node, isFor, kind) {
  node.declarations = [];
  node.kind = kind.keyword;
  for (;;) {
    var decl = this.startNode();
    this.parseVarId(decl);
    if (this.eat(_tokentype.types.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (kind === _tokentype.types._const && !(this.type === _tokentype.types._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (decl.id.type != "Identifier" && !(isFor && (this.type === _tokentype.types._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(_tokentype.types.comma)) break;
  }
  return node;
};

pp.parseVarId = function (decl) {
  decl.id = this.parseBindingAtom();
  this.checkLVal(decl.id, true);
};

// Parse a function declaration or literal (depending on the
// `isStatement` parameter).

pp.parseFunction = function (node, isStatement, allowExpressionBody) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) node.generator = this.eat(_tokentype.types.star);
  if (isStatement || this.type === _tokentype.types.name) node.id = this.parseIdent();
  this.parseFunctionParams(node);
  this.parseFunctionBody(node, allowExpressionBody);
  return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
};

pp.parseFunctionParams = function (node) {
  this.expect(_tokentype.types.parenL);
  node.params = this.parseBindingList(_tokentype.types.parenR, false, false);
};

// Parse a class declaration or literal (depending on the
// `isStatement` parameter).

pp.parseClass = function (node, isStatement) {
  this.next();
  this.parseClassId(node, isStatement);
  this.parseClassSuper(node);
  var classBody = this.startNode();
  var hadConstructor = false;
  classBody.body = [];
  this.expect(_tokentype.types.braceL);
  while (!this.eat(_tokentype.types.braceR)) {
    if (this.eat(_tokentype.types.semi)) continue;
    var method = this.startNode();
    var isGenerator = this.eat(_tokentype.types.star);
    var isMaybeStatic = this.type === _tokentype.types.name && this.value === "static";
    this.parsePropertyName(method);
    method["static"] = isMaybeStatic && this.type !== _tokentype.types.parenL;
    if (method["static"]) {
      if (isGenerator) this.unexpected();
      isGenerator = this.eat(_tokentype.types.star);
      this.parsePropertyName(method);
    }
    method.kind = "method";
    var isGetSet = false;
    if (!method.computed) {
      var key = method.key;

      if (!isGenerator && key.type === "Identifier" && this.type !== _tokentype.types.parenL && (key.name === "get" || key.name === "set")) {
        isGetSet = true;
        method.kind = key.name;
        key = this.parsePropertyName(method);
      }
      if (!method["static"] && (key.type === "Identifier" && key.name === "constructor" || key.type === "Literal" && key.value === "constructor")) {
        if (hadConstructor) this.raise(key.start, "Duplicate constructor in the same class");
        if (isGetSet) this.raise(key.start, "Constructor can't have get/set modifier");
        if (isGenerator) this.raise(key.start, "Constructor can't be a generator");
        method.kind = "constructor";
        hadConstructor = true;
      }
    }
    this.parseClassMethod(classBody, method, isGenerator);
    if (isGetSet) {
      var paramCount = method.kind === "get" ? 0 : 1;
      if (method.value.params.length !== paramCount) {
        var start = method.value.start;
        if (method.kind === "get") this.raise(start, "getter should have no params");else this.raise(start, "setter should have exactly one param");
      }
    }
  }
  node.body = this.finishNode(classBody, "ClassBody");
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};

pp.parseClassMethod = function (classBody, method, isGenerator) {
  method.value = this.parseMethod(isGenerator);
  classBody.body.push(this.finishNode(method, "MethodDefinition"));
};

pp.parseClassId = function (node, isStatement) {
  node.id = this.type === _tokentype.types.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
};

pp.parseClassSuper = function (node) {
  node.superClass = this.eat(_tokentype.types._extends) ? this.parseExprSubscripts() : null;
};

// Parses module export declaration.

pp.parseExport = function (node) {
  this.next();
  // export * from '...'
  if (this.eat(_tokentype.types.star)) {
    this.expectContextual("from");
    node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
    this.semicolon();
    return this.finishNode(node, "ExportAllDeclaration");
  }
  if (this.eat(_tokentype.types._default)) {
    // export default ...
    var expr = this.parseMaybeAssign();
    var needsSemi = true;
    if (expr.type == "FunctionExpression" || expr.type == "ClassExpression") {
      needsSemi = false;
      if (expr.id) {
        expr.type = expr.type == "FunctionExpression" ? "FunctionDeclaration" : "ClassDeclaration";
      }
    }
    node.declaration = expr;
    if (needsSemi) this.semicolon();
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  // export var|const|let|function|class ...
  if (this.shouldParseExportStatement()) {
    node.declaration = this.parseStatement(true);
    node.specifiers = [];
    node.source = null;
  } else {
    // export { x, y as z } [from '...']
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers();
    if (this.eatContextual("from")) {
      node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
    } else {
      node.source = null;
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};

pp.shouldParseExportStatement = function () {
  return this.type.keyword;
};

// Parses a comma-separated list of module exports.

pp.parseExportSpecifiers = function () {
  var nodes = [],
      first = true;
  // export { x, y as z } [from '...']
  this.expect(_tokentype.types.braceL);
  while (!this.eat(_tokentype.types.braceR)) {
    if (!first) {
      this.expect(_tokentype.types.comma);
      if (this.afterTrailingComma(_tokentype.types.braceR)) break;
    } else first = false;

    var node = this.startNode();
    node.local = this.parseIdent(this.type === _tokentype.types._default);
    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
    nodes.push(this.finishNode(node, "ExportSpecifier"));
  }
  return nodes;
};

// Parses import declaration.

pp.parseImport = function (node) {
  this.next();
  // import '...'
  if (this.type === _tokentype.types.string) {
    node.specifiers = empty;
    node.source = this.parseExprAtom();
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === _tokentype.types.string ? this.parseExprAtom() : this.unexpected();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};

// Parses a comma-separated list of module imports.

pp.parseImportSpecifiers = function () {
  var nodes = [],
      first = true;
  if (this.type === _tokentype.types.name) {
    // import defaultObj, { x, y as z } from '...'
    var node = this.startNode();
    node.local = this.parseIdent();
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
    if (!this.eat(_tokentype.types.comma)) return nodes;
  }
  if (this.type === _tokentype.types.star) {
    var node = this.startNode();
    this.next();
    this.expectContextual("as");
    node.local = this.parseIdent();
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportNamespaceSpecifier"));
    return nodes;
  }
  this.expect(_tokentype.types.braceL);
  while (!this.eat(_tokentype.types.braceR)) {
    if (!first) {
      this.expect(_tokentype.types.comma);
      if (this.afterTrailingComma(_tokentype.types.braceR)) break;
    } else first = false;

    var node = this.startNode();
    node.imported = this.parseIdent(true);
    node.local = this.eatContextual("as") ? this.parseIdent() : node.imported;
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportSpecifier"));
  }
  return nodes;
};

},{"./state":10,"./tokentype":14,"./whitespace":16}],12:[function(_dereq_,module,exports){
// The algorithm used to determine whether a regexp can appear at a
// given point in the program is loosely based on sweet.js' approach.
// See https://github.com/mozilla/sweet.js/wiki/design

"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _state = _dereq_("./state");

var _tokentype = _dereq_("./tokentype");

var _whitespace = _dereq_("./whitespace");

var TokContext = function TokContext(token, isExpr, preserveSpace, override) {
  _classCallCheck(this, TokContext);

  this.token = token;
  this.isExpr = !!isExpr;
  this.preserveSpace = !!preserveSpace;
  this.override = override;
};

exports.TokContext = TokContext;
var types = {
  b_stat: new TokContext("{", false),
  b_expr: new TokContext("{", true),
  b_tmpl: new TokContext("${", true),
  p_stat: new TokContext("(", false),
  p_expr: new TokContext("(", true),
  q_tmpl: new TokContext("`", true, true, function (p) {
    return p.readTmplToken();
  }),
  f_expr: new TokContext("function", true)
};

exports.types = types;
var pp = _state.Parser.prototype;

pp.initialContext = function () {
  return [types.b_stat];
};

pp.braceIsBlock = function (prevType) {
  if (prevType === _tokentype.types.colon) {
    var _parent = this.curContext();
    if (_parent === types.b_stat || _parent === types.b_expr) return !_parent.isExpr;
  }
  if (prevType === _tokentype.types._return) return _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  if (prevType === _tokentype.types._else || prevType === _tokentype.types.semi || prevType === _tokentype.types.eof || prevType === _tokentype.types.parenR) return true;
  if (prevType == _tokentype.types.braceL) return this.curContext() === types.b_stat;
  return !this.exprAllowed;
};

pp.updateContext = function (prevType) {
  var update = undefined,
      type = this.type;
  if (type.keyword && prevType == _tokentype.types.dot) this.exprAllowed = false;else if (update = type.updateContext) update.call(this, prevType);else this.exprAllowed = type.beforeExpr;
};

// Token-specific context update code

_tokentype.types.parenR.updateContext = _tokentype.types.braceR.updateContext = function () {
  if (this.context.length == 1) {
    this.exprAllowed = true;
    return;
  }
  var out = this.context.pop();
  if (out === types.b_stat && this.curContext() === types.f_expr) {
    this.context.pop();
    this.exprAllowed = false;
  } else if (out === types.b_tmpl) {
    this.exprAllowed = true;
  } else {
    this.exprAllowed = !out.isExpr;
  }
};

_tokentype.types.braceL.updateContext = function (prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};

_tokentype.types.dollarBraceL.updateContext = function () {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};

_tokentype.types.parenL.updateContext = function (prevType) {
  var statementParens = prevType === _tokentype.types._if || prevType === _tokentype.types._for || prevType === _tokentype.types._with || prevType === _tokentype.types._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};

_tokentype.types.incDec.updateContext = function () {};

_tokentype.types._function.updateContext = function () {
  if (this.curContext() !== types.b_stat) this.context.push(types.f_expr);
  this.exprAllowed = false;
};

_tokentype.types.backQuote.updateContext = function () {
  if (this.curContext() === types.q_tmpl) this.context.pop();else this.context.push(types.q_tmpl);
  this.exprAllowed = false;
};

// tokExprAllowed stays unchanged

},{"./state":10,"./tokentype":14,"./whitespace":16}],13:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _identifier = _dereq_("./identifier");

var _tokentype = _dereq_("./tokentype");

var _state = _dereq_("./state");

var _locutil = _dereq_("./locutil");

var _whitespace = _dereq_("./whitespace");

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

var Token = function Token(p) {
  _classCallCheck(this, Token);

  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations) this.loc = new _locutil.SourceLocation(p, p.startLoc, p.endLoc);
  if (p.options.ranges) this.range = [p.start, p.end];
};

exports.Token = Token;

// ## Tokenizer

var pp = _state.Parser.prototype;

// Are we running under Rhino?
var isRhino = typeof Packages == "object" && Object.prototype.toString.call(Packages) == "[object JavaPackage]";

// Move to the next token

pp.next = function () {
  if (this.options.onToken) this.options.onToken(new Token(this));

  this.lastTokEnd = this.end;
  this.lastTokStart = this.start;
  this.lastTokEndLoc = this.endLoc;
  this.lastTokStartLoc = this.startLoc;
  this.nextToken();
};

pp.getToken = function () {
  this.next();
  return new Token(this);
};

// If we're in an ES6 environment, make parsers iterable
if (typeof Symbol !== "undefined") pp[Symbol.iterator] = function () {
  var self = this;
  return { next: function next() {
      var token = self.getToken();
      return {
        done: token.type === _tokentype.types.eof,
        value: token
      };
    } };
};

// Toggle strict mode. Re-reads the next number or string to please
// pedantic tests (`"use strict"; 010;` should fail).

pp.setStrict = function (strict) {
  this.strict = strict;
  if (this.type !== _tokentype.types.num && this.type !== _tokentype.types.string) return;
  this.pos = this.start;
  if (this.options.locations) {
    while (this.pos < this.lineStart) {
      this.lineStart = this.input.lastIndexOf("\n", this.lineStart - 2) + 1;
      --this.curLine;
    }
  }
  this.nextToken();
};

pp.curContext = function () {
  return this.context[this.context.length - 1];
};

// Read a single token, updating the parser object's token-related
// properties.

pp.nextToken = function () {
  var curContext = this.curContext();
  if (!curContext || !curContext.preserveSpace) this.skipSpace();

  this.start = this.pos;
  if (this.options.locations) this.startLoc = this.curPosition();
  if (this.pos >= this.input.length) return this.finishToken(_tokentype.types.eof);

  if (curContext.override) return curContext.override(this);else this.readToken(this.fullCharCodeAtPos());
};

pp.readToken = function (code) {
  // Identifier or keyword. '\uXXXX' sequences are allowed in
  // identifiers, so '\' also dispatches to that.
  if (_identifier.isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */) return this.readWord();

  return this.getTokenFromCode(code);
};

pp.fullCharCodeAtPos = function () {
  var code = this.input.charCodeAt(this.pos);
  if (code <= 0xd7ff || code >= 0xe000) return code;
  var next = this.input.charCodeAt(this.pos + 1);
  return (code << 10) + next - 0x35fdc00;
};

pp.skipBlockComment = function () {
  var startLoc = this.options.onComment && this.curPosition();
  var start = this.pos,
      end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) this.raise(this.pos - 2, "Unterminated comment");
  this.pos = end + 2;
  if (this.options.locations) {
    _whitespace.lineBreakG.lastIndex = start;
    var match = undefined;
    while ((match = _whitespace.lineBreakG.exec(this.input)) && match.index < this.pos) {
      ++this.curLine;
      this.lineStart = match.index + match[0].length;
    }
  }
  if (this.options.onComment) this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.curPosition());
};

pp.skipLineComment = function (startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
    ++this.pos;
    ch = this.input.charCodeAt(this.pos);
  }
  if (this.options.onComment) this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.curPosition());
};

// Called at the start of the parse and after every token. Skips
// whitespace and comments, and.

pp.skipSpace = function () {
  loop: while (this.pos < this.input.length) {
    var ch = this.input.charCodeAt(this.pos);
    switch (ch) {
      case 32:case 160:
        // ' '
        ++this.pos;
        break;
      case 13:
        if (this.input.charCodeAt(this.pos + 1) === 10) {
          ++this.pos;
        }
      case 10:case 8232:case 8233:
        ++this.pos;
        if (this.options.locations) {
          ++this.curLine;
          this.lineStart = this.pos;
        }
        break;
      case 47:
        // '/'
        switch (this.input.charCodeAt(this.pos + 1)) {
          case 42:
            // '*'
            this.skipBlockComment();
            break;
          case 47:
            this.skipLineComment(2);
            break;
          default:
            break loop;
        }
        break;
      default:
        if (ch > 8 && ch < 14 || ch >= 5760 && _whitespace.nonASCIIwhitespace.test(String.fromCharCode(ch))) {
          ++this.pos;
        } else {
          break loop;
        }
    }
  }
};

// Called at the end of every token. Sets `end`, `val`, and
// maintains `context` and `exprAllowed`, and skips the space after
// the token, so that the next one's `start` will point at the
// right position.

pp.finishToken = function (type, val) {
  this.end = this.pos;
  if (this.options.locations) this.endLoc = this.curPosition();
  var prevType = this.type;
  this.type = type;
  this.value = val;

  this.updateContext(prevType);
};

// ### Token reading

// This is the function that is called to fetch the next token. It
// is somewhat obscure, because it works in character codes rather
// than characters, and because operator parsing has been inlined
// into it.
//
// All in the name of speed.
//
pp.readToken_dot = function () {
  var next = this.input.charCodeAt(this.pos + 1);
  if (next >= 48 && next <= 57) return this.readNumber(true);
  var next2 = this.input.charCodeAt(this.pos + 2);
  if (this.options.ecmaVersion >= 6 && next === 46 && next2 === 46) {
    // 46 = dot '.'
    this.pos += 3;
    return this.finishToken(_tokentype.types.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(_tokentype.types.dot);
  }
};

pp.readToken_slash = function () {
  // '/'
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;return this.readRegexp();
  }
  if (next === 61) return this.finishOp(_tokentype.types.assign, 2);
  return this.finishOp(_tokentype.types.slash, 1);
};

pp.readToken_mult_modulo = function (code) {
  // '%*'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(_tokentype.types.assign, 2);
  return this.finishOp(code === 42 ? _tokentype.types.star : _tokentype.types.modulo, 1);
};

pp.readToken_pipe_amp = function (code) {
  // '|&'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) return this.finishOp(code === 124 ? _tokentype.types.logicalOR : _tokentype.types.logicalAND, 2);
  if (next === 61) return this.finishOp(_tokentype.types.assign, 2);
  return this.finishOp(code === 124 ? _tokentype.types.bitwiseOR : _tokentype.types.bitwiseAND, 1);
};

pp.readToken_caret = function () {
  // '^'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(_tokentype.types.assign, 2);
  return this.finishOp(_tokentype.types.bitwiseXOR, 1);
};

pp.readToken_plus_min = function (code) {
  // '+-'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && _whitespace.lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
      // A `-->` line comment
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(_tokentype.types.incDec, 2);
  }
  if (next === 61) return this.finishOp(_tokentype.types.assign, 2);
  return this.finishOp(_tokentype.types.plusMin, 1);
};

pp.readToken_lt_gt = function (code) {
  // '<>'
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) return this.finishOp(_tokentype.types.assign, size + 1);
    return this.finishOp(_tokentype.types.bitShift, size);
  }
  if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
    if (this.inModule) this.unexpected();
    // `<!--`, an XML-style comment that should be interpreted as a line comment
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) size = this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2;
  return this.finishOp(_tokentype.types.relational, size);
};

pp.readToken_eq_excl = function (code) {
  // '=!'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(_tokentype.types.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    // '=>'
    this.pos += 2;
    return this.finishToken(_tokentype.types.arrow);
  }
  return this.finishOp(code === 61 ? _tokentype.types.eq : _tokentype.types.prefix, 1);
};

pp.getTokenFromCode = function (code) {
  switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46:
      // '.'
      return this.readToken_dot();

    // Punctuation tokens.
    case 40:
      ++this.pos;return this.finishToken(_tokentype.types.parenL);
    case 41:
      ++this.pos;return this.finishToken(_tokentype.types.parenR);
    case 59:
      ++this.pos;return this.finishToken(_tokentype.types.semi);
    case 44:
      ++this.pos;return this.finishToken(_tokentype.types.comma);
    case 91:
      ++this.pos;return this.finishToken(_tokentype.types.bracketL);
    case 93:
      ++this.pos;return this.finishToken(_tokentype.types.bracketR);
    case 123:
      ++this.pos;return this.finishToken(_tokentype.types.braceL);
    case 125:
      ++this.pos;return this.finishToken(_tokentype.types.braceR);
    case 58:
      ++this.pos;return this.finishToken(_tokentype.types.colon);
    case 63:
      ++this.pos;return this.finishToken(_tokentype.types.question);

    case 96:
      // '`'
      if (this.options.ecmaVersion < 6) break;
      ++this.pos;
      return this.finishToken(_tokentype.types.backQuote);

    case 48:
      // '0'
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 120 || next === 88) return this.readRadixNumber(16); // '0x', '0X' - hex number
      if (this.options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) return this.readRadixNumber(8); // '0o', '0O' - octal number
        if (next === 98 || next === 66) return this.readRadixNumber(2); // '0b', '0B' - binary number
      }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49:case 50:case 51:case 52:case 53:case 54:case 55:case 56:case 57:
      // 1-9
      return this.readNumber(false);

    // Quotes produce strings.
    case 34:case 39:
      // '"', "'"
      return this.readString(code);

    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.

    case 47:
      // '/'
      return this.readToken_slash();

    case 37:case 42:
      // '%*'
      return this.readToken_mult_modulo(code);

    case 124:case 38:
      // '|&'
      return this.readToken_pipe_amp(code);

    case 94:
      // '^'
      return this.readToken_caret();

    case 43:case 45:
      // '+-'
      return this.readToken_plus_min(code);

    case 60:case 62:
      // '<>'
      return this.readToken_lt_gt(code);

    case 61:case 33:
      // '=!'
      return this.readToken_eq_excl(code);

    case 126:
      // '~'
      return this.finishOp(_tokentype.types.prefix, 1);
  }

  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};

pp.finishOp = function (type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};

// Parse a regular expression. Some context-awareness is necessary,
// since a '/' inside a '[]' set does not end the expression.

function tryCreateRegexp(src, flags, throwErrorAt) {
  try {
    return new RegExp(src, flags);
  } catch (e) {
    if (throwErrorAt !== undefined) {
      if (e instanceof SyntaxError) this.raise(throwErrorAt, "Error parsing regular expression: " + e.message);
      this.raise(e);
    }
  }
}

var regexpUnicodeSupport = !!tryCreateRegexp("￿", "u");

pp.readRegexp = function () {
  var _this = this;

  var escaped = undefined,
      inClass = undefined,
      start = this.pos;
  for (;;) {
    if (this.pos >= this.input.length) this.raise(start, "Unterminated regular expression");
    var ch = this.input.charAt(this.pos);
    if (_whitespace.lineBreak.test(ch)) this.raise(start, "Unterminated regular expression");
    if (!escaped) {
      if (ch === "[") inClass = true;else if (ch === "]" && inClass) inClass = false;else if (ch === "/" && !inClass) break;
      escaped = ch === "\\";
    } else escaped = false;
    ++this.pos;
  }
  var content = this.input.slice(start, this.pos);
  ++this.pos;
  // Need to use `readWord1` because '\uXXXX' sequences are allowed
  // here (don't ask).
  var mods = this.readWord1();
  var tmp = content;
  if (mods) {
    var validFlags = /^[gmsiy]*$/;
    if (this.options.ecmaVersion >= 6) validFlags = /^[gmsiyu]*$/;
    if (!validFlags.test(mods)) this.raise(start, "Invalid regular expression flag");
    if (mods.indexOf("u") >= 0 && !regexpUnicodeSupport) {
      // Replace each astral symbol and every Unicode escape sequence that
      // possibly represents an astral symbol or a paired surrogate with a
      // single ASCII symbol to avoid throwing on regular expressions that
      // are only valid in combination with the `/u` flag.
      // Note: replacing with the ASCII symbol `x` might cause false
      // negatives in unlikely scenarios. For example, `[\u{61}-b]` is a
      // perfectly valid pattern that is equivalent to `[a-b]`, but it would
      // be replaced by `[x-b]` which throws an error.
      tmp = tmp.replace(/\\u\{([0-9a-fA-F]+)\}/g, function (match, code, offset) {
        code = Number("0x" + code);
        if (code > 0x10FFFF) _this.raise(start + offset + 3, "Code point out of bounds");
        return "x";
      });
      tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
    }
  }
  // Detect invalid regular expressions.
  var value = null;
  // Rhino's regular expression parser is flaky and throws uncatchable exceptions,
  // so don't do detection if we are running under Rhino
  if (!isRhino) {
    tryCreateRegexp(tmp, undefined, start);
    // Get a regular expression object for this pattern-flag pair, or `null` in
    // case the current environment doesn't support the flags it uses.
    value = tryCreateRegexp(content, mods);
  }
  return this.finishToken(_tokentype.types.regexp, { pattern: content, flags: mods, value: value });
};

// Read an integer in the given radix. Return null if zero digits
// were read, the integer value otherwise. When `len` is given, this
// will return `null` unless the integer has exactly `len` digits.

pp.readInt = function (radix, len) {
  var start = this.pos,
      total = 0;
  for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
    var code = this.input.charCodeAt(this.pos),
        val = undefined;
    if (code >= 97) val = code - 97 + 10; // a
    else if (code >= 65) val = code - 65 + 10; // A
    else if (code >= 48 && code <= 57) val = code - 48; // 0-9
    else val = Infinity;
    if (val >= radix) break;
    ++this.pos;
    total = total * radix + val;
  }
  if (this.pos === start || len != null && this.pos - start !== len) return null;

  return total;
};

pp.readRadixNumber = function (radix) {
  this.pos += 2; // 0x
  var val = this.readInt(radix);
  if (val == null) this.raise(this.start + 2, "Expected number in radix " + radix);
  if (_identifier.isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");
  return this.finishToken(_tokentype.types.num, val);
};

// Read an integer, octal integer, or floating-point number.

pp.readNumber = function (startsWithDot) {
  var start = this.pos,
      isFloat = false,
      octal = this.input.charCodeAt(this.pos) === 48;
  if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number");
  var next = this.input.charCodeAt(this.pos);
  if (next === 46) {
    // '.'
    ++this.pos;
    this.readInt(10);
    isFloat = true;
    next = this.input.charCodeAt(this.pos);
  }
  if (next === 69 || next === 101) {
    // 'eE'
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) ++this.pos; // '+-'
    if (this.readInt(10) === null) this.raise(start, "Invalid number");
    isFloat = true;
  }
  if (_identifier.isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");

  var str = this.input.slice(start, this.pos),
      val = undefined;
  if (isFloat) val = parseFloat(str);else if (!octal || str.length === 1) val = parseInt(str, 10);else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number");else val = parseInt(str, 8);
  return this.finishToken(_tokentype.types.num, val);
};

// Read a string value, interpreting backslash-escapes.

pp.readCodePoint = function () {
  var ch = this.input.charCodeAt(this.pos),
      code = undefined;

  if (ch === 123) {
    if (this.options.ecmaVersion < 6) this.unexpected();
    var codePos = ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 0x10FFFF) this.raise(codePos, "Code point out of bounds");
  } else {
    code = this.readHexChar(4);
  }
  return code;
};

function codePointToString(code) {
  // UTF-16 Decoding
  if (code <= 0xFFFF) return String.fromCharCode(code);
  code -= 0x10000;
  return String.fromCharCode((code >> 10) + 0xD800, (code & 1023) + 0xDC00);
}

pp.readString = function (quote) {
  var out = "",
      chunkStart = ++this.pos;
  for (;;) {
    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated string constant");
    var ch = this.input.charCodeAt(this.pos);
    if (ch === quote) break;
    if (ch === 92) {
      // '\'
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(false);
      chunkStart = this.pos;
    } else {
      if (_whitespace.isNewLine(ch)) this.raise(this.start, "Unterminated string constant");
      ++this.pos;
    }
  }
  out += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(_tokentype.types.string, out);
};

// Reads template string tokens.

pp.readTmplToken = function () {
  var out = "",
      chunkStart = this.pos;
  for (;;) {
    if (this.pos >= this.input.length) this.raise(this.start, "Unterminated template");
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 96 || ch === 36 && this.input.charCodeAt(this.pos + 1) === 123) {
      // '`', '${'
      if (this.pos === this.start && this.type === _tokentype.types.template) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(_tokentype.types.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(_tokentype.types.backQuote);
        }
      }
      out += this.input.slice(chunkStart, this.pos);
      return this.finishToken(_tokentype.types.template, out);
    }
    if (ch === 92) {
      // '\'
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar(true);
      chunkStart = this.pos;
    } else if (_whitespace.isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      switch (ch) {
        case 13:
          if (this.input.charCodeAt(this.pos) === 10) ++this.pos;
        case 10:
          out += "\n";
          break;
        default:
          out += String.fromCharCode(ch);
          break;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
      chunkStart = this.pos;
    } else {
      ++this.pos;
    }
  }
};

// Used to read escaped characters

pp.readEscapedChar = function (inTemplate) {
  var ch = this.input.charCodeAt(++this.pos);
  ++this.pos;
  switch (ch) {
    case 110:
      return "\n"; // 'n' -> '\n'
    case 114:
      return "\r"; // 'r' -> '\r'
    case 120:
      return String.fromCharCode(this.readHexChar(2)); // 'x'
    case 117:
      return codePointToString(this.readCodePoint()); // 'u'
    case 116:
      return "\t"; // 't' -> '\t'
    case 98:
      return "\b"; // 'b' -> '\b'
    case 118:
      return "\u000b"; // 'v' -> '\u000b'
    case 102:
      return "\f"; // 'f' -> '\f'
    case 13:
      if (this.input.charCodeAt(this.pos) === 10) ++this.pos; // '\r\n'
    case 10:
      // ' \n'
      if (this.options.locations) {
        this.lineStart = this.pos;++this.curLine;
      }
      return "";
    default:
      if (ch >= 48 && ch <= 55) {
        var octalStr = this.input.substr(this.pos - 1, 3).match(/^[0-7]+/)[0];
        var octal = parseInt(octalStr, 8);
        if (octal > 255) {
          octalStr = octalStr.slice(0, -1);
          octal = parseInt(octalStr, 8);
        }
        if (octal > 0 && (this.strict || inTemplate)) {
          this.raise(this.pos - 2, "Octal literal in strict mode");
        }
        this.pos += octalStr.length - 1;
        return String.fromCharCode(octal);
      }
      return String.fromCharCode(ch);
  }
};

// Used to read character escape sequences ('\x', '\u', '\U').

pp.readHexChar = function (len) {
  var codePos = this.pos;
  var n = this.readInt(16, len);
  if (n === null) this.raise(codePos, "Bad character escape sequence");
  return n;
};

// Read an identifier, and return it as a string. Sets `this.containsEsc`
// to whether the word contained a '\u' escape.
//
// Incrementally adds only escaped chars, adding other chunks as-is
// as a micro-optimization.

pp.readWord1 = function () {
  this.containsEsc = false;
  var word = "",
      first = true,
      chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (_identifier.isIdentifierChar(ch, astral)) {
      this.pos += ch <= 0xffff ? 1 : 2;
    } else if (ch === 92) {
      // "\"
      this.containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) != 117) // "u"
        this.raise(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first ? _identifier.isIdentifierStart : _identifier.isIdentifierChar)(esc, astral)) this.raise(escStart, "Invalid Unicode escape");
      word += codePointToString(esc);
      chunkStart = this.pos;
    } else {
      break;
    }
    first = false;
  }
  return word + this.input.slice(chunkStart, this.pos);
};

// Read an identifier or keyword token. Will check for reserved
// words when necessary.

pp.readWord = function () {
  var word = this.readWord1();
  var type = _tokentype.types.name;
  if ((this.options.ecmaVersion >= 6 || !this.containsEsc) && this.isKeyword(word)) type = _tokentype.keywords[word];
  return this.finishToken(type, word);
};

},{"./identifier":2,"./locutil":5,"./state":10,"./tokentype":14,"./whitespace":16}],14:[function(_dereq_,module,exports){
// ## Token types

// The assignment of fine-grained, information-carrying type objects
// allows the tokenizer to store the information it has about a
// token in a way that is very cheap for the parser to look up.

// All token type variables start with an underscore, to make them
// easy to recognize.

// The `beforeExpr` property is used to disambiguate between regular
// expressions and divisions. It is set on all token types that can
// be followed by an expression (thus, a slash after them would be a
// regular expression).
//
// `isLoop` marks a keyword as starting a loop, which is important
// to know when parsing a label, in order to allow or disallow
// continue jumps to that label.

"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var TokenType = function TokenType(label) {
  var conf = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  _classCallCheck(this, TokenType);

  this.label = label;
  this.keyword = conf.keyword;
  this.beforeExpr = !!conf.beforeExpr;
  this.startsExpr = !!conf.startsExpr;
  this.isLoop = !!conf.isLoop;
  this.isAssign = !!conf.isAssign;
  this.prefix = !!conf.prefix;
  this.postfix = !!conf.postfix;
  this.binop = conf.binop || null;
  this.updateContext = null;
};

exports.TokenType = TokenType;

function binop(name, prec) {
  return new TokenType(name, { beforeExpr: true, binop: prec });
}
var beforeExpr = { beforeExpr: true },
    startsExpr = { startsExpr: true };

var types = {
  num: new TokenType("num", startsExpr),
  regexp: new TokenType("regexp", startsExpr),
  string: new TokenType("string", startsExpr),
  name: new TokenType("name", startsExpr),
  eof: new TokenType("eof"),

  // Punctuation token types.
  bracketL: new TokenType("[", { beforeExpr: true, startsExpr: true }),
  bracketR: new TokenType("]"),
  braceL: new TokenType("{", { beforeExpr: true, startsExpr: true }),
  braceR: new TokenType("}"),
  parenL: new TokenType("(", { beforeExpr: true, startsExpr: true }),
  parenR: new TokenType(")"),
  comma: new TokenType(",", beforeExpr),
  semi: new TokenType(";", beforeExpr),
  colon: new TokenType(":", beforeExpr),
  dot: new TokenType("."),
  question: new TokenType("?", beforeExpr),
  arrow: new TokenType("=>", beforeExpr),
  template: new TokenType("template"),
  ellipsis: new TokenType("...", beforeExpr),
  backQuote: new TokenType("`", startsExpr),
  dollarBraceL: new TokenType("${", { beforeExpr: true, startsExpr: true }),

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator.
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  eq: new TokenType("=", { beforeExpr: true, isAssign: true }),
  assign: new TokenType("_=", { beforeExpr: true, isAssign: true }),
  incDec: new TokenType("++/--", { prefix: true, postfix: true, startsExpr: true }),
  prefix: new TokenType("prefix", { beforeExpr: true, prefix: true, startsExpr: true }),
  logicalOR: binop("||", 1),
  logicalAND: binop("&&", 2),
  bitwiseOR: binop("|", 3),
  bitwiseXOR: binop("^", 4),
  bitwiseAND: binop("&", 5),
  equality: binop("==/!=", 6),
  relational: binop("</>", 7),
  bitShift: binop("<</>>", 8),
  plusMin: new TokenType("+/-", { beforeExpr: true, binop: 9, prefix: true, startsExpr: true }),
  modulo: binop("%", 10),
  star: binop("*", 10),
  slash: binop("/", 10)
};

exports.types = types;
// Map keyword names to token types.

var keywords = {};

exports.keywords = keywords;
// Succinct definitions of keyword token types
function kw(name) {
  var options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];

  options.keyword = name;
  keywords[name] = types["_" + name] = new TokenType(name, options);
}

kw("break");
kw("case", beforeExpr);
kw("catch");
kw("continue");
kw("debugger");
kw("default", beforeExpr);
kw("do", { isLoop: true });
kw("else", beforeExpr);
kw("finally");
kw("for", { isLoop: true });
kw("function", startsExpr);
kw("if");
kw("return", beforeExpr);
kw("switch");
kw("throw", beforeExpr);
kw("try");
kw("var");
kw("let");
kw("const");
kw("while", { isLoop: true });
kw("with");
kw("new", { beforeExpr: true, startsExpr: true });
kw("this", startsExpr);
kw("super", startsExpr);
kw("class");
kw("extends", beforeExpr);
kw("export");
kw("import");
kw("yield", { beforeExpr: true, startsExpr: true });
kw("null", startsExpr);
kw("true", startsExpr);
kw("false", startsExpr);
kw("in", { beforeExpr: true, binop: 7 });
kw("instanceof", { beforeExpr: true, binop: 7 });
kw("typeof", { beforeExpr: true, prefix: true, startsExpr: true });
kw("void", { beforeExpr: true, prefix: true, startsExpr: true });
kw("delete", { beforeExpr: true, prefix: true, startsExpr: true });

},{}],15:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
exports.isArray = isArray;
exports.has = has;

function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
}

// Checks if an object has a property.

function has(obj, propName) {
  return Object.prototype.hasOwnProperty.call(obj, propName);
}

},{}],16:[function(_dereq_,module,exports){
// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

"use strict";

exports.__esModule = true;
exports.isNewLine = isNewLine;
var lineBreak = /\r\n?|\n|\u2028|\u2029/;
exports.lineBreak = lineBreak;
var lineBreakG = new RegExp(lineBreak.source, "g");

exports.lineBreakG = lineBreakG;

function isNewLine(code) {
  return code === 10 || code === 13 || code === 0x2028 || code == 0x2029;
}

var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
exports.nonASCIIwhitespace = nonASCIIwhitespace;

},{}]},{},[3])(3)
});;
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.acorn || (g.acorn = {})).walk = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
// AST walker module for Mozilla Parser API compatible trees

// A simple walk is one where you simply specify callbacks to be
// called on specific nodes. The last two arguments are optional. A
// simple use would be
//
//     walk.simple(myTree, {
//         Expression: function(node) { ... }
//     });
//
// to do something with all expressions. All Parser API node types
// can be used to identify node types, as well as Expression,
// Statement, and ScopeBody, which denote categories of nodes.
//
// The base argument can be used to pass a custom (recursive)
// walker, and state can be used to give this walked an initial
// state.

"use strict";

exports.__esModule = true;
exports.simple = simple;
exports.ancestor = ancestor;
exports.recursive = recursive;
exports.findNodeAt = findNodeAt;
exports.findNodeAround = findNodeAround;
exports.findNodeAfter = findNodeAfter;
exports.findNodeBefore = findNodeBefore;
exports.make = make;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function simple(node, visitors, base, state, override) {
  if (!base) base = exports.base;(function c(node, st, override) {
    var type = override || node.type,
        found = visitors[type];
    base[type](node, st, c);
    if (found) found(node, st);
  })(node, state, override);
}

// An ancestor walk builds up an array of ancestor nodes (including
// the current node) and passes them to the callback as the state parameter.

function ancestor(node, visitors, base, state) {
  if (!base) base = exports.base;
  if (!state) state = [];(function c(node, st, override) {
    var type = override || node.type,
        found = visitors[type];
    if (node != st[st.length - 1]) {
      st = st.slice();
      st.push(node);
    }
    base[type](node, st, c);
    if (found) found(node, st);
  })(node, state);
}

// A recursive walk is one where your functions override the default
// walkers. They can modify and replace the state parameter that's
// threaded through the walk, and can opt how and whether to walk
// their child nodes (by calling their third argument on these
// nodes).

function recursive(node, state, funcs, base, override) {
  var visitor = funcs ? exports.make(funcs, base) : base;(function c(node, st, override) {
    visitor[override || node.type](node, st, c);
  })(node, state, override);
}

function makeTest(test) {
  if (typeof test == "string") return function (type) {
    return type == test;
  };else if (!test) return function () {
    return true;
  };else return test;
}

var Found = function Found(node, state) {
  _classCallCheck(this, Found);

  this.node = node;this.state = state;
};

// Find a node with a given start, end, and type (all are optional,
// null can be used as wildcard). Returns a {node, state} object, or
// undefined when it doesn't find a matching node.

function findNodeAt(node, start, end, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      var type = override || node.type;
      if ((start == null || node.start <= start) && (end == null || node.end >= end)) base[type](node, st, c);
      if ((start == null || node.start == start) && (end == null || node.end == end) && test(type, node)) throw new Found(node, st);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) return e;
    throw e;
  }
}

// Find the innermost node of a given type that contains the given
// position. Interface similar to findNodeAt.

function findNodeAround(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      var type = override || node.type;
      if (node.start > pos || node.end < pos) return;
      base[type](node, st, c);
      if (test(type, node)) throw new Found(node, st);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) return e;
    throw e;
  }
}

// Find the outermost matching node after a given position.

function findNodeAfter(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      if (node.end < pos) return;
      var type = override || node.type;
      if (node.start >= pos && test(type, node)) throw new Found(node, st);
      base[type](node, st, c);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) return e;
    throw e;
  }
}

// Find the outermost matching node before a given position.

function findNodeBefore(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  var max = undefined;(function c(node, st, override) {
    if (node.start > pos) return;
    var type = override || node.type;
    if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node)) max = new Found(node, st);
    base[type](node, st, c);
  })(node, state);
  return max;
}

// Used to create a custom walker. Will fill in all missing node
// type properties with the defaults.

function make(funcs, base) {
  if (!base) base = exports.base;
  var visitor = {};
  for (var type in base) visitor[type] = base[type];
  for (var type in funcs) visitor[type] = funcs[type];
  return visitor;
}

function skipThrough(node, st, c) {
  c(node, st);
}
function ignore(_node, _st, _c) {}

// Node walkers.

var base = {};

exports.base = base;
base.Program = base.BlockStatement = function (node, st, c) {
  for (var i = 0; i < node.body.length; ++i) {
    c(node.body[i], st, "Statement");
  }
};
base.Statement = skipThrough;
base.EmptyStatement = ignore;
base.ExpressionStatement = base.ParenthesizedExpression = function (node, st, c) {
  return c(node.expression, st, "Expression");
};
base.IfStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Statement");
  if (node.alternate) c(node.alternate, st, "Statement");
};
base.LabeledStatement = function (node, st, c) {
  return c(node.body, st, "Statement");
};
base.BreakStatement = base.ContinueStatement = ignore;
base.WithStatement = function (node, st, c) {
  c(node.object, st, "Expression");
  c(node.body, st, "Statement");
};
base.SwitchStatement = function (node, st, c) {
  c(node.discriminant, st, "Expression");
  for (var i = 0; i < node.cases.length; ++i) {
    var cs = node.cases[i];
    if (cs.test) c(cs.test, st, "Expression");
    for (var j = 0; j < cs.consequent.length; ++j) {
      c(cs.consequent[j], st, "Statement");
    }
  }
};
base.ReturnStatement = base.YieldExpression = function (node, st, c) {
  if (node.argument) c(node.argument, st, "Expression");
};
base.ThrowStatement = base.SpreadElement = function (node, st, c) {
  return c(node.argument, st, "Expression");
};
base.TryStatement = function (node, st, c) {
  c(node.block, st, "Statement");
  if (node.handler) {
    c(node.handler.param, st, "Pattern");
    c(node.handler.body, st, "ScopeBody");
  }
  if (node.finalizer) c(node.finalizer, st, "Statement");
};
base.WhileStatement = base.DoWhileStatement = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForStatement = function (node, st, c) {
  if (node.init) c(node.init, st, "ForInit");
  if (node.test) c(node.test, st, "Expression");
  if (node.update) c(node.update, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForInStatement = base.ForOfStatement = function (node, st, c) {
  c(node.left, st, "ForInit");
  c(node.right, st, "Expression");
  c(node.body, st, "Statement");
};
base.ForInit = function (node, st, c) {
  if (node.type == "VariableDeclaration") c(node, st);else c(node, st, "Expression");
};
base.DebuggerStatement = ignore;

base.FunctionDeclaration = function (node, st, c) {
  return c(node, st, "Function");
};
base.VariableDeclaration = function (node, st, c) {
  for (var i = 0; i < node.declarations.length; ++i) {
    c(node.declarations[i], st);
  }
};
base.VariableDeclarator = function (node, st, c) {
  c(node.id, st, "Pattern");
  if (node.init) c(node.init, st, "Expression");
};

base.Function = function (node, st, c) {
  if (node.id) c(node.id, st, "Pattern");
  for (var i = 0; i < node.params.length; i++) {
    c(node.params[i], st, "Pattern");
  }c(node.body, st, node.expression ? "ScopeExpression" : "ScopeBody");
};
// FIXME drop these node types in next major version
// (They are awkward, and in ES6 every block can be a scope.)
base.ScopeBody = function (node, st, c) {
  return c(node, st, "Statement");
};
base.ScopeExpression = function (node, st, c) {
  return c(node, st, "Expression");
};

base.Pattern = function (node, st, c) {
  if (node.type == "Identifier") c(node, st, "VariablePattern");else if (node.type == "MemberExpression") c(node, st, "MemberPattern");else c(node, st);
};
base.VariablePattern = ignore;
base.MemberPattern = skipThrough;
base.RestElement = function (node, st, c) {
  return c(node.argument, st, "Pattern");
};
base.ArrayPattern = function (node, st, c) {
  for (var i = 0; i < node.elements.length; ++i) {
    var elt = node.elements[i];
    if (elt) c(elt, st, "Pattern");
  }
};
base.ObjectPattern = function (node, st, c) {
  for (var i = 0; i < node.properties.length; ++i) {
    c(node.properties[i].value, st, "Pattern");
  }
};

base.Expression = skipThrough;
base.ThisExpression = base.Super = base.MetaProperty = ignore;
base.ArrayExpression = function (node, st, c) {
  for (var i = 0; i < node.elements.length; ++i) {
    var elt = node.elements[i];
    if (elt) c(elt, st, "Expression");
  }
};
base.ObjectExpression = function (node, st, c) {
  for (var i = 0; i < node.properties.length; ++i) {
    c(node.properties[i], st);
  }
};
base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
base.SequenceExpression = base.TemplateLiteral = function (node, st, c) {
  for (var i = 0; i < node.expressions.length; ++i) {
    c(node.expressions[i], st, "Expression");
  }
};
base.UnaryExpression = base.UpdateExpression = function (node, st, c) {
  c(node.argument, st, "Expression");
};
base.BinaryExpression = base.LogicalExpression = function (node, st, c) {
  c(node.left, st, "Expression");
  c(node.right, st, "Expression");
};
base.AssignmentExpression = base.AssignmentPattern = function (node, st, c) {
  c(node.left, st, "Pattern");
  c(node.right, st, "Expression");
};
base.ConditionalExpression = function (node, st, c) {
  c(node.test, st, "Expression");
  c(node.consequent, st, "Expression");
  c(node.alternate, st, "Expression");
};
base.NewExpression = base.CallExpression = function (node, st, c) {
  c(node.callee, st, "Expression");
  if (node.arguments) for (var i = 0; i < node.arguments.length; ++i) {
    c(node.arguments[i], st, "Expression");
  }
};
base.MemberExpression = function (node, st, c) {
  c(node.object, st, "Expression");
  if (node.computed) c(node.property, st, "Expression");
};
base.ExportNamedDeclaration = base.ExportDefaultDeclaration = function (node, st, c) {
  if (node.declaration) c(node.declaration, st);
  if (node.source) c(node.source, st, "Expression");
};
base.ExportAllDeclaration = function (node, st, c) {
  c(node.source, st, "Expression");
};
base.ImportDeclaration = function (node, st, c) {
  for (var i = 0; i < node.specifiers.length; i++) {
    c(node.specifiers[i], st);
  }c(node.source, st, "Expression");
};
base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;

base.TaggedTemplateExpression = function (node, st, c) {
  c(node.tag, st, "Expression");
  c(node.quasi, st);
};
base.ClassDeclaration = base.ClassExpression = function (node, st, c) {
  return c(node, st, "Class");
};
base.Class = function (node, st, c) {
  if (node.id) c(node.id, st, "Pattern");
  if (node.superClass) c(node.superClass, st, "Expression");
  for (var i = 0; i < node.body.body.length; i++) {
    c(node.body.body[i], st);
  }
};
base.MethodDefinition = base.Property = function (node, st, c) {
  if (node.computed) c(node.key, st, "Expression");
  c(node.value, st, "Expression");
};
base.ComprehensionExpression = function (node, st, c) {
  for (var i = 0; i < node.blocks.length; i++) {
    c(node.blocks[i].right, st, "Expression");
  }c(node.body, st, "Expression");
};

},{}]},{},[1])(1)
});;
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.acorn || (g.acorn = {})).loose = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

module.exports = typeof acorn != 'undefined' ? acorn : require("./acorn");

},{}],2:[function(_dereq_,module,exports){
"use strict";

var _state = _dereq_("./state");

var _parseutil = _dereq_("./parseutil");

var _ = _dereq_("..");

var lp = _state.LooseParser.prototype;

lp.checkLVal = function (expr, binding) {
  if (!expr) return expr;
  switch (expr.type) {
    case "Identifier":
      return expr;

    case "MemberExpression":
      return binding ? this.dummyIdent() : expr;

    case "ParenthesizedExpression":
      expr.expression = this.checkLVal(expr.expression, binding);
      return expr;

    // FIXME recursively check contents
    case "ObjectPattern":
    case "ArrayPattern":
    case "RestElement":
    case "AssignmentPattern":
      if (this.options.ecmaVersion >= 6) return expr;

    default:
      return this.dummyIdent();
  }
};

lp.parseExpression = function (noIn) {
  var start = this.storeCurrentPos();
  var expr = this.parseMaybeAssign(noIn);
  if (this.tok.type === _.tokTypes.comma) {
    var node = this.startNodeAt(start);
    node.expressions = [expr];
    while (this.eat(_.tokTypes.comma)) node.expressions.push(this.parseMaybeAssign(noIn));
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};

lp.parseParenExpression = function () {
  this.pushCx();
  this.expect(_.tokTypes.parenL);
  var val = this.parseExpression();
  this.popCx();
  this.expect(_.tokTypes.parenR);
  return val;
};

lp.parseMaybeAssign = function (noIn) {
  var start = this.storeCurrentPos();
  var left = this.parseMaybeConditional(noIn);
  if (this.tok.type.isAssign) {
    var node = this.startNodeAt(start);
    node.operator = this.tok.value;
    node.left = this.tok.type === _.tokTypes.eq ? this.toAssignable(left) : this.checkLVal(left);
    this.next();
    node.right = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "AssignmentExpression");
  }
  return left;
};

lp.parseMaybeConditional = function (noIn) {
  var start = this.storeCurrentPos();
  var expr = this.parseExprOps(noIn);
  if (this.eat(_.tokTypes.question)) {
    var node = this.startNodeAt(start);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    node.alternate = this.expect(_.tokTypes.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};

lp.parseExprOps = function (noIn) {
  var start = this.storeCurrentPos();
  var indent = this.curIndent,
      line = this.curLineStart;
  return this.parseExprOp(this.parseMaybeUnary(noIn), start, -1, noIn, indent, line);
};

lp.parseExprOp = function (left, start, minPrec, noIn, indent, line) {
  if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) return left;
  var prec = this.tok.type.binop;
  if (prec != null && (!noIn || this.tok.type !== _.tokTypes._in)) {
    if (prec > minPrec) {
      var node = this.startNodeAt(start);
      node.left = left;
      node.operator = this.tok.value;
      this.next();
      if (this.curLineStart != line && this.curIndent < indent && this.tokenStartsLine()) {
        node.right = this.dummyIdent();
      } else {
        var rightStart = this.storeCurrentPos();
        node.right = this.parseExprOp(this.parseMaybeUnary(noIn), rightStart, prec, noIn, indent, line);
      }
      this.finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
      return this.parseExprOp(node, start, minPrec, noIn, indent, line);
    }
  }
  return left;
};

lp.parseMaybeUnary = function (noIn) {
  if (this.tok.type.prefix) {
    var node = this.startNode(),
        update = this.tok.type === _.tokTypes.incDec;
    node.operator = this.tok.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(noIn);
    if (update) node.argument = this.checkLVal(node.argument);
    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (this.tok.type === _.tokTypes.ellipsis) {
    var node = this.startNode();
    this.next();
    node.argument = this.parseMaybeUnary(noIn);
    return this.finishNode(node, "SpreadElement");
  }
  var start = this.storeCurrentPos();
  var expr = this.parseExprSubscripts();
  while (this.tok.type.postfix && !this.canInsertSemicolon()) {
    var node = this.startNodeAt(start);
    node.operator = this.tok.value;
    node.prefix = false;
    node.argument = this.checkLVal(expr);
    this.next();
    expr = this.finishNode(node, "UpdateExpression");
  }
  return expr;
};

lp.parseExprSubscripts = function () {
  var start = this.storeCurrentPos();
  return this.parseSubscripts(this.parseExprAtom(), start, false, this.curIndent, this.curLineStart);
};

lp.parseSubscripts = function (base, start, noCalls, startIndent, line) {
  for (;;) {
    if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) {
      if (this.tok.type == _.tokTypes.dot && this.curIndent == startIndent) --startIndent;else return base;
    }

    if (this.eat(_.tokTypes.dot)) {
      var node = this.startNodeAt(start);
      node.object = base;
      if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) node.property = this.dummyIdent();else node.property = this.parsePropertyAccessor() || this.dummyIdent();
      node.computed = false;
      base = this.finishNode(node, "MemberExpression");
    } else if (this.tok.type == _.tokTypes.bracketL) {
      this.pushCx();
      this.next();
      var node = this.startNodeAt(start);
      node.object = base;
      node.property = this.parseExpression();
      node.computed = true;
      this.popCx();
      this.expect(_.tokTypes.bracketR);
      base = this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.tok.type == _.tokTypes.parenL) {
      var node = this.startNodeAt(start);
      node.callee = base;
      node.arguments = this.parseExprList(_.tokTypes.parenR);
      base = this.finishNode(node, "CallExpression");
    } else if (this.tok.type == _.tokTypes.backQuote) {
      var node = this.startNodeAt(start);
      node.tag = base;
      node.quasi = this.parseTemplate();
      base = this.finishNode(node, "TaggedTemplateExpression");
    } else {
      return base;
    }
  }
};

lp.parseExprAtom = function () {
  var node = undefined;
  switch (this.tok.type) {
    case _.tokTypes._this:
    case _.tokTypes._super:
      var type = this.tok.type === _.tokTypes._this ? "ThisExpression" : "Super";
      node = this.startNode();
      this.next();
      return this.finishNode(node, type);

    case _.tokTypes.name:
      var start = this.storeCurrentPos();
      var id = this.parseIdent();
      return this.eat(_.tokTypes.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;

    case _.tokTypes.regexp:
      node = this.startNode();
      var val = this.tok.value;
      node.regex = { pattern: val.pattern, flags: val.flags };
      node.value = val.value;
      node.raw = this.input.slice(this.tok.start, this.tok.end);
      this.next();
      return this.finishNode(node, "Literal");

    case _.tokTypes.num:case _.tokTypes.string:
      node = this.startNode();
      node.value = this.tok.value;
      node.raw = this.input.slice(this.tok.start, this.tok.end);
      this.next();
      return this.finishNode(node, "Literal");

    case _.tokTypes._null:case _.tokTypes._true:case _.tokTypes._false:
      node = this.startNode();
      node.value = this.tok.type === _.tokTypes._null ? null : this.tok.type === _.tokTypes._true;
      node.raw = this.tok.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");

    case _.tokTypes.parenL:
      var parenStart = this.storeCurrentPos();
      this.next();
      var inner = this.parseExpression();
      this.expect(_.tokTypes.parenR);
      if (this.eat(_.tokTypes.arrow)) {
        return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (_parseutil.isDummy(inner) ? [] : [inner]));
      }
      if (this.options.preserveParens) {
        var par = this.startNodeAt(parenStart);
        par.expression = inner;
        inner = this.finishNode(par, "ParenthesizedExpression");
      }
      return inner;

    case _.tokTypes.bracketL:
      node = this.startNode();
      node.elements = this.parseExprList(_.tokTypes.bracketR, true);
      return this.finishNode(node, "ArrayExpression");

    case _.tokTypes.braceL:
      return this.parseObj();

    case _.tokTypes._class:
      return this.parseClass();

    case _.tokTypes._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, false);

    case _.tokTypes._new:
      return this.parseNew();

    case _.tokTypes._yield:
      node = this.startNode();
      this.next();
      if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != _.tokTypes.star && !this.tok.type.startsExpr) {
        node.delegate = false;
        node.argument = null;
      } else {
        node.delegate = this.eat(_.tokTypes.star);
        node.argument = this.parseMaybeAssign();
      }
      return this.finishNode(node, "YieldExpression");

    case _.tokTypes.backQuote:
      return this.parseTemplate();

    default:
      return this.dummyIdent();
  }
};

lp.parseNew = function () {
  var node = this.startNode(),
      startIndent = this.curIndent,
      line = this.curLineStart;
  var meta = this.parseIdent(true);
  if (this.options.ecmaVersion >= 6 && this.eat(_.tokTypes.dot)) {
    node.meta = meta;
    node.property = this.parseIdent(true);
    return this.finishNode(node, "MetaProperty");
  }
  var start = this.storeCurrentPos();
  node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
  if (this.tok.type == _.tokTypes.parenL) {
    node.arguments = this.parseExprList(_.tokTypes.parenR);
  } else {
    node.arguments = [];
  }
  return this.finishNode(node, "NewExpression");
};

lp.parseTemplateElement = function () {
  var elem = this.startNode();
  elem.value = {
    raw: this.input.slice(this.tok.start, this.tok.end).replace(/\r\n?/g, "\n"),
    cooked: this.tok.value
  };
  this.next();
  elem.tail = this.tok.type === _.tokTypes.backQuote;
  return this.finishNode(elem, "TemplateElement");
};

lp.parseTemplate = function () {
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement();
  node.quasis = [curElt];
  while (!curElt.tail) {
    this.next();
    node.expressions.push(this.parseExpression());
    if (this.expect(_.tokTypes.braceR)) {
      curElt = this.parseTemplateElement();
    } else {
      curElt = this.startNode();
      curElt.value = { cooked: "", raw: "" };
      curElt.tail = true;
    }
    node.quasis.push(curElt);
  }
  this.expect(_.tokTypes.backQuote);
  return this.finishNode(node, "TemplateLiteral");
};

lp.parseObj = function () {
  var node = this.startNode();
  node.properties = [];
  this.pushCx();
  var indent = this.curIndent + 1,
      line = this.curLineStart;
  this.eat(_.tokTypes.braceL);
  if (this.curIndent + 1 < indent) {
    indent = this.curIndent;line = this.curLineStart;
  }
  while (!this.closes(_.tokTypes.braceR, indent, line)) {
    var prop = this.startNode(),
        isGenerator = undefined,
        start = undefined;
    if (this.options.ecmaVersion >= 6) {
      start = this.storeCurrentPos();
      prop.method = false;
      prop.shorthand = false;
      isGenerator = this.eat(_.tokTypes.star);
    }
    this.parsePropertyName(prop);
    if (_parseutil.isDummy(prop.key)) {
      if (_parseutil.isDummy(this.parseMaybeAssign())) this.next();this.eat(_.tokTypes.comma);continue;
    }
    if (this.eat(_.tokTypes.colon)) {
      prop.kind = "init";
      prop.value = this.parseMaybeAssign();
    } else if (this.options.ecmaVersion >= 6 && (this.tok.type === _.tokTypes.parenL || this.tok.type === _.tokTypes.braceL)) {
      prop.kind = "init";
      prop.method = true;
      prop.value = this.parseMethod(isGenerator);
    } else if (this.options.ecmaVersion >= 5 && prop.key.type === "Identifier" && !prop.computed && (prop.key.name === "get" || prop.key.name === "set") && (this.tok.type != _.tokTypes.comma && this.tok.type != _.tokTypes.braceR)) {
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      prop.value = this.parseMethod(false);
    } else {
      prop.kind = "init";
      if (this.options.ecmaVersion >= 6) {
        if (this.eat(_.tokTypes.eq)) {
          var assign = this.startNodeAt(start);
          assign.operator = "=";
          assign.left = prop.key;
          assign.right = this.parseMaybeAssign();
          prop.value = this.finishNode(assign, "AssignmentExpression");
        } else {
          prop.value = prop.key;
        }
      } else {
        prop.value = this.dummyIdent();
      }
      prop.shorthand = true;
    }
    node.properties.push(this.finishNode(prop, "Property"));
    this.eat(_.tokTypes.comma);
  }
  this.popCx();
  if (!this.eat(_.tokTypes.braceR)) {
    // If there is no closing brace, make the node span to the start
    // of the next token (this is useful for Tern)
    this.last.end = this.tok.start;
    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
  }
  return this.finishNode(node, "ObjectExpression");
};

lp.parsePropertyName = function (prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(_.tokTypes.bracketL)) {
      prop.computed = true;
      prop.key = this.parseExpression();
      this.expect(_.tokTypes.bracketR);
      return;
    } else {
      prop.computed = false;
    }
  }
  var key = this.tok.type === _.tokTypes.num || this.tok.type === _.tokTypes.string ? this.parseExprAtom() : this.parseIdent();
  prop.key = key || this.dummyIdent();
};

lp.parsePropertyAccessor = function () {
  if (this.tok.type === _.tokTypes.name || this.tok.type.keyword) return this.parseIdent();
};

lp.parseIdent = function () {
  var name = this.tok.type === _.tokTypes.name ? this.tok.value : this.tok.type.keyword;
  if (!name) return this.dummyIdent();
  var node = this.startNode();
  this.next();
  node.name = name;
  return this.finishNode(node, "Identifier");
};

lp.initFunction = function (node) {
  node.id = null;
  node.params = [];
  if (this.options.ecmaVersion >= 6) {
    node.generator = false;
    node.expression = false;
  }
};

// Convert existing expression atom to assignable pattern
// if possible.

lp.toAssignable = function (node, binding) {
  if (this.options.ecmaVersion >= 6 && node) {
    switch (node.type) {
      case "ObjectExpression":
        node.type = "ObjectPattern";
        var props = node.properties;
        for (var i = 0; i < props.length; i++) {
          this.toAssignable(props[i].value, binding);
        }break;

      case "ArrayExpression":
        node.type = "ArrayPattern";
        this.toAssignableList(node.elements, binding);
        break;

      case "SpreadElement":
        node.type = "RestElement";
        node.argument = this.toAssignable(node.argument, binding);
        break;

      case "AssignmentExpression":
        node.type = "AssignmentPattern";
        delete node.operator;
        break;
    }
  }
  return this.checkLVal(node, binding);
};

lp.toAssignableList = function (exprList, binding) {
  for (var i = 0; i < exprList.length; i++) {
    exprList[i] = this.toAssignable(exprList[i], binding);
  }return exprList;
};

lp.parseFunctionParams = function (params) {
  params = this.parseExprList(_.tokTypes.parenR);
  return this.toAssignableList(params, true);
};

lp.parseMethod = function (isGenerator) {
  var node = this.startNode();
  this.initFunction(node);
  node.params = this.parseFunctionParams();
  node.generator = isGenerator || false;
  node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== _.tokTypes.braceL;
  node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
  return this.finishNode(node, "FunctionExpression");
};

lp.parseArrowExpression = function (node, params) {
  this.initFunction(node);
  node.params = this.toAssignableList(params, true);
  node.expression = this.tok.type !== _.tokTypes.braceL;
  node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
  return this.finishNode(node, "ArrowFunctionExpression");
};

lp.parseExprList = function (close, allowEmpty) {
  this.pushCx();
  var indent = this.curIndent,
      line = this.curLineStart,
      elts = [];
  this.next(); // Opening bracket
  while (!this.closes(close, indent + 1, line)) {
    if (this.eat(_.tokTypes.comma)) {
      elts.push(allowEmpty ? null : this.dummyIdent());
      continue;
    }
    var elt = this.parseMaybeAssign();
    if (_parseutil.isDummy(elt)) {
      if (this.closes(close, indent, line)) break;
      this.next();
    } else {
      elts.push(elt);
    }
    this.eat(_.tokTypes.comma);
  }
  this.popCx();
  if (!this.eat(close)) {
    // If there is no closing brace, make the node span to the start
    // of the next token (this is useful for Tern)
    this.last.end = this.tok.start;
    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
  }
  return elts;
};

},{"..":1,"./parseutil":4,"./state":5}],3:[function(_dereq_,module,exports){
// Acorn: Loose parser
//
// This module provides an alternative parser (`parse_dammit`) that
// exposes that same interface as `parse`, but will try to parse
// anything as JavaScript, repairing syntax error the best it can.
// There are circumstances in which it will raise an error and give
// up, but they are very rare. The resulting AST will be a mostly
// valid JavaScript AST (as per the [Mozilla parser API][api], except
// that:
//
// - Return outside functions is allowed
//
// - Label consistency (no conflicts, break only to existing labels)
//   is not enforced.
//
// - Bogus Identifier nodes with a name of `"✖"` are inserted whenever
//   the parser got too confused to return anything meaningful.
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API
//
// The expected use for this is to *first* try `acorn.parse`, and only
// if that fails switch to `parse_dammit`. The loose parser might
// parse badly indented code incorrectly, so **don't** use it as
// your default parser.
//
// Quite a lot of acorn.js is duplicated here. The alternative was to
// add a *lot* of extra cruft to that file, making it less readable
// and slower. Copying and editing the code allowed me to make
// invasive changes and simplifications without creating a complicated
// tangle.

"use strict";

exports.__esModule = true;
exports.parse_dammit = parse_dammit;

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj["default"] = obj; return newObj; } }

var _ = _dereq_("..");

var acorn = _interopRequireWildcard(_);

var _state = _dereq_("./state");

_dereq_("./tokenize");

_dereq_("./statement");

_dereq_("./expression");

exports.LooseParser = _state.LooseParser;

acorn.defaultOptions.tabSize = 4;

function parse_dammit(input, options) {
  var p = new _state.LooseParser(input, options);
  p.next();
  return p.parseTopLevel();
}

acorn.parse_dammit = parse_dammit;
acorn.LooseParser = _state.LooseParser;

},{"..":1,"./expression":2,"./state":5,"./statement":6,"./tokenize":7}],4:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;
exports.isDummy = isDummy;

function isDummy(node) {
  return node.name == "✖";
}

},{}],5:[function(_dereq_,module,exports){
"use strict";

exports.__esModule = true;

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var _ = _dereq_("..");

var LooseParser = (function () {
  function LooseParser(input, options) {
    _classCallCheck(this, LooseParser);

    this.toks = _.tokenizer(input, options);
    this.options = this.toks.options;
    this.input = this.toks.input;
    this.tok = this.last = { type: _.tokTypes.eof, start: 0, end: 0 };
    if (this.options.locations) {
      var here = this.toks.curPosition();
      this.tok.loc = new _.SourceLocation(this.toks, here, here);
    }
    this.ahead = []; // Tokens ahead
    this.context = []; // Indentation contexted
    this.curIndent = 0;
    this.curLineStart = 0;
    this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
  }

  LooseParser.prototype.startNode = function startNode() {
    return new _.Node(this.toks, this.tok.start, this.options.locations ? this.tok.loc.start : null);
  };

  LooseParser.prototype.storeCurrentPos = function storeCurrentPos() {
    return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start;
  };

  LooseParser.prototype.startNodeAt = function startNodeAt(pos) {
    if (this.options.locations) {
      return new _.Node(this.toks, pos[0], pos[1]);
    } else {
      return new _.Node(this.toks, pos);
    }
  };

  LooseParser.prototype.finishNode = function finishNode(node, type) {
    node.type = type;
    node.end = this.last.end;
    if (this.options.locations) node.loc.end = this.last.loc.end;
    if (this.options.ranges) node.range[1] = this.last.end;
    return node;
  };

  LooseParser.prototype.dummyIdent = function dummyIdent() {
    var dummy = this.startNode();
    dummy.name = "✖";
    return this.finishNode(dummy, "Identifier");
  };

  LooseParser.prototype.dummyString = function dummyString() {
    var dummy = this.startNode();
    dummy.value = dummy.raw = "✖";
    return this.finishNode(dummy, "Literal");
  };

  LooseParser.prototype.eat = function eat(type) {
    if (this.tok.type === type) {
      this.next();
      return true;
    } else {
      return false;
    }
  };

  LooseParser.prototype.isContextual = function isContextual(name) {
    return this.tok.type === _.tokTypes.name && this.tok.value === name;
  };

  LooseParser.prototype.eatContextual = function eatContextual(name) {
    return this.tok.value === name && this.eat(_.tokTypes.name);
  };

  LooseParser.prototype.canInsertSemicolon = function canInsertSemicolon() {
    return this.tok.type === _.tokTypes.eof || this.tok.type === _.tokTypes.braceR || _.lineBreak.test(this.input.slice(this.last.end, this.tok.start));
  };

  LooseParser.prototype.semicolon = function semicolon() {
    return this.eat(_.tokTypes.semi);
  };

  LooseParser.prototype.expect = function expect(type) {
    if (this.eat(type)) return true;
    for (var i = 1; i <= 2; i++) {
      if (this.lookAhead(i).type == type) {
        for (var j = 0; j < i; j++) {
          this.next();
        }return true;
      }
    }
  };

  LooseParser.prototype.pushCx = function pushCx() {
    this.context.push(this.curIndent);
  };

  LooseParser.prototype.popCx = function popCx() {
    this.curIndent = this.context.pop();
  };

  LooseParser.prototype.lineEnd = function lineEnd(pos) {
    while (pos < this.input.length && !_.isNewLine(this.input.charCodeAt(pos))) ++pos;
    return pos;
  };

  LooseParser.prototype.indentationAfter = function indentationAfter(pos) {
    for (var count = 0;; ++pos) {
      var ch = this.input.charCodeAt(pos);
      if (ch === 32) ++count;else if (ch === 9) count += this.options.tabSize;else return count;
    }
  };

  LooseParser.prototype.closes = function closes(closeTok, indent, line, blockHeuristic) {
    if (this.tok.type === closeTok || this.tok.type === _.tokTypes.eof) return true;
    return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
  };

  LooseParser.prototype.tokenStartsLine = function tokenStartsLine() {
    for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
      var ch = this.input.charCodeAt(p);
      if (ch !== 9 && ch !== 32) return false;
    }
    return true;
  };

  return LooseParser;
})();

exports.LooseParser = LooseParser;

},{"..":1}],6:[function(_dereq_,module,exports){
"use strict";

var _state = _dereq_("./state");

var _parseutil = _dereq_("./parseutil");

var _ = _dereq_("..");

var lp = _state.LooseParser.prototype;

lp.parseTopLevel = function () {
  var node = this.startNodeAt(this.options.locations ? [0, _.getLineInfo(this.input, 0)] : 0);
  node.body = [];
  while (this.tok.type !== _.tokTypes.eof) node.body.push(this.parseStatement());
  this.last = this.tok;
  if (this.options.ecmaVersion >= 6) {
    node.sourceType = this.options.sourceType;
  }
  return this.finishNode(node, "Program");
};

lp.parseStatement = function () {
  var starttype = this.tok.type,
      node = this.startNode();

  switch (starttype) {
    case _.tokTypes._break:case _.tokTypes._continue:
      this.next();
      var isBreak = starttype === _.tokTypes._break;
      if (this.semicolon() || this.canInsertSemicolon()) {
        node.label = null;
      } else {
        node.label = this.tok.type === _.tokTypes.name ? this.parseIdent() : null;
        this.semicolon();
      }
      return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

    case _.tokTypes._debugger:
      this.next();
      this.semicolon();
      return this.finishNode(node, "DebuggerStatement");

    case _.tokTypes._do:
      this.next();
      node.body = this.parseStatement();
      node.test = this.eat(_.tokTypes._while) ? this.parseParenExpression() : this.dummyIdent();
      this.semicolon();
      return this.finishNode(node, "DoWhileStatement");

    case _.tokTypes._for:
      this.next();
      this.pushCx();
      this.expect(_.tokTypes.parenL);
      if (this.tok.type === _.tokTypes.semi) return this.parseFor(node, null);
      if (this.tok.type === _.tokTypes._var || this.tok.type === _.tokTypes._let || this.tok.type === _.tokTypes._const) {
        var _init = this.parseVar(true);
        if (_init.declarations.length === 1 && (this.tok.type === _.tokTypes._in || this.isContextual("of"))) {
          return this.parseForIn(node, _init);
        }
        return this.parseFor(node, _init);
      }
      var init = this.parseExpression(true);
      if (this.tok.type === _.tokTypes._in || this.isContextual("of")) return this.parseForIn(node, this.toAssignable(init));
      return this.parseFor(node, init);

    case _.tokTypes._function:
      this.next();
      return this.parseFunction(node, true);

    case _.tokTypes._if:
      this.next();
      node.test = this.parseParenExpression();
      node.consequent = this.parseStatement();
      node.alternate = this.eat(_.tokTypes._else) ? this.parseStatement() : null;
      return this.finishNode(node, "IfStatement");

    case _.tokTypes._return:
      this.next();
      if (this.eat(_.tokTypes.semi) || this.canInsertSemicolon()) node.argument = null;else {
        node.argument = this.parseExpression();this.semicolon();
      }
      return this.finishNode(node, "ReturnStatement");

    case _.tokTypes._switch:
      var blockIndent = this.curIndent,
          line = this.curLineStart;
      this.next();
      node.discriminant = this.parseParenExpression();
      node.cases = [];
      this.pushCx();
      this.expect(_.tokTypes.braceL);

      var cur = undefined;
      while (!this.closes(_.tokTypes.braceR, blockIndent, line, true)) {
        if (this.tok.type === _.tokTypes._case || this.tok.type === _.tokTypes._default) {
          var isCase = this.tok.type === _.tokTypes._case;
          if (cur) this.finishNode(cur, "SwitchCase");
          node.cases.push(cur = this.startNode());
          cur.consequent = [];
          this.next();
          if (isCase) cur.test = this.parseExpression();else cur.test = null;
          this.expect(_.tokTypes.colon);
        } else {
          if (!cur) {
            node.cases.push(cur = this.startNode());
            cur.consequent = [];
            cur.test = null;
          }
          cur.consequent.push(this.parseStatement());
        }
      }
      if (cur) this.finishNode(cur, "SwitchCase");
      this.popCx();
      this.eat(_.tokTypes.braceR);
      return this.finishNode(node, "SwitchStatement");

    case _.tokTypes._throw:
      this.next();
      node.argument = this.parseExpression();
      this.semicolon();
      return this.finishNode(node, "ThrowStatement");

    case _.tokTypes._try:
      this.next();
      node.block = this.parseBlock();
      node.handler = null;
      if (this.tok.type === _.tokTypes._catch) {
        var clause = this.startNode();
        this.next();
        this.expect(_.tokTypes.parenL);
        clause.param = this.toAssignable(this.parseExprAtom(), true);
        this.expect(_.tokTypes.parenR);
        clause.guard = null;
        clause.body = this.parseBlock();
        node.handler = this.finishNode(clause, "CatchClause");
      }
      node.finalizer = this.eat(_.tokTypes._finally) ? this.parseBlock() : null;
      if (!node.handler && !node.finalizer) return node.block;
      return this.finishNode(node, "TryStatement");

    case _.tokTypes._var:
    case _.tokTypes._let:
    case _.tokTypes._const:
      return this.parseVar();

    case _.tokTypes._while:
      this.next();
      node.test = this.parseParenExpression();
      node.body = this.parseStatement();
      return this.finishNode(node, "WhileStatement");

    case _.tokTypes._with:
      this.next();
      node.object = this.parseParenExpression();
      node.body = this.parseStatement();
      return this.finishNode(node, "WithStatement");

    case _.tokTypes.braceL:
      return this.parseBlock();

    case _.tokTypes.semi:
      this.next();
      return this.finishNode(node, "EmptyStatement");

    case _.tokTypes._class:
      return this.parseClass(true);

    case _.tokTypes._import:
      return this.parseImport();

    case _.tokTypes._export:
      return this.parseExport();

    default:
      var expr = this.parseExpression();
      if (_parseutil.isDummy(expr)) {
        this.next();
        if (this.tok.type === _.tokTypes.eof) return this.finishNode(node, "EmptyStatement");
        return this.parseStatement();
      } else if (starttype === _.tokTypes.name && expr.type === "Identifier" && this.eat(_.tokTypes.colon)) {
        node.body = this.parseStatement();
        node.label = expr;
        return this.finishNode(node, "LabeledStatement");
      } else {
        node.expression = expr;
        this.semicolon();
        return this.finishNode(node, "ExpressionStatement");
      }
  }
};

lp.parseBlock = function () {
  var node = this.startNode();
  this.pushCx();
  this.expect(_.tokTypes.braceL);
  var blockIndent = this.curIndent,
      line = this.curLineStart;
  node.body = [];
  while (!this.closes(_.tokTypes.braceR, blockIndent, line, true)) node.body.push(this.parseStatement());
  this.popCx();
  this.eat(_.tokTypes.braceR);
  return this.finishNode(node, "BlockStatement");
};

lp.parseFor = function (node, init) {
  node.init = init;
  node.test = node.update = null;
  if (this.eat(_.tokTypes.semi) && this.tok.type !== _.tokTypes.semi) node.test = this.parseExpression();
  if (this.eat(_.tokTypes.semi) && this.tok.type !== _.tokTypes.parenR) node.update = this.parseExpression();
  this.popCx();
  this.expect(_.tokTypes.parenR);
  node.body = this.parseStatement();
  return this.finishNode(node, "ForStatement");
};

lp.parseForIn = function (node, init) {
  var type = this.tok.type === _.tokTypes._in ? "ForInStatement" : "ForOfStatement";
  this.next();
  node.left = init;
  node.right = this.parseExpression();
  this.popCx();
  this.expect(_.tokTypes.parenR);
  node.body = this.parseStatement();
  return this.finishNode(node, type);
};

lp.parseVar = function (noIn) {
  var node = this.startNode();
  node.kind = this.tok.type.keyword;
  this.next();
  node.declarations = [];
  do {
    var decl = this.startNode();
    decl.id = this.options.ecmaVersion >= 6 ? this.toAssignable(this.parseExprAtom(), true) : this.parseIdent();
    decl.init = this.eat(_.tokTypes.eq) ? this.parseMaybeAssign(noIn) : null;
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
  } while (this.eat(_.tokTypes.comma));
  if (!node.declarations.length) {
    var decl = this.startNode();
    decl.id = this.dummyIdent();
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
  }
  if (!noIn) this.semicolon();
  return this.finishNode(node, "VariableDeclaration");
};

lp.parseClass = function (isStatement) {
  var node = this.startNode();
  this.next();
  if (this.tok.type === _.tokTypes.name) node.id = this.parseIdent();else if (isStatement) node.id = this.dummyIdent();else node.id = null;
  node.superClass = this.eat(_.tokTypes._extends) ? this.parseExpression() : null;
  node.body = this.startNode();
  node.body.body = [];
  this.pushCx();
  var indent = this.curIndent + 1,
      line = this.curLineStart;
  this.eat(_.tokTypes.braceL);
  if (this.curIndent + 1 < indent) {
    indent = this.curIndent;line = this.curLineStart;
  }
  while (!this.closes(_.tokTypes.braceR, indent, line)) {
    if (this.semicolon()) continue;
    var method = this.startNode(),
        isGenerator = undefined;
    if (this.options.ecmaVersion >= 6) {
      method["static"] = false;
      isGenerator = this.eat(_.tokTypes.star);
    }
    this.parsePropertyName(method);
    if (_parseutil.isDummy(method.key)) {
      if (_parseutil.isDummy(this.parseMaybeAssign())) this.next();this.eat(_.tokTypes.comma);continue;
    }
    if (method.key.type === "Identifier" && !method.computed && method.key.name === "static" && (this.tok.type != _.tokTypes.parenL && this.tok.type != _.tokTypes.braceL)) {
      method["static"] = true;
      isGenerator = this.eat(_.tokTypes.star);
      this.parsePropertyName(method);
    } else {
      method["static"] = false;
    }
    if (this.options.ecmaVersion >= 5 && method.key.type === "Identifier" && !method.computed && (method.key.name === "get" || method.key.name === "set") && this.tok.type !== _.tokTypes.parenL && this.tok.type !== _.tokTypes.braceL) {
      method.kind = method.key.name;
      this.parsePropertyName(method);
      method.value = this.parseMethod(false);
    } else {
      if (!method.computed && !method["static"] && !isGenerator && (method.key.type === "Identifier" && method.key.name === "constructor" || method.key.type === "Literal" && method.key.value === "constructor")) {
        method.kind = "constructor";
      } else {
        method.kind = "method";
      }
      method.value = this.parseMethod(isGenerator);
    }
    node.body.body.push(this.finishNode(method, "MethodDefinition"));
  }
  this.popCx();
  if (!this.eat(_.tokTypes.braceR)) {
    // If there is no closing brace, make the node span to the start
    // of the next token (this is useful for Tern)
    this.last.end = this.tok.start;
    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
  }
  this.semicolon();
  this.finishNode(node.body, "ClassBody");
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};

lp.parseFunction = function (node, isStatement) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) {
    node.generator = this.eat(_.tokTypes.star);
  }
  if (this.tok.type === _.tokTypes.name) node.id = this.parseIdent();else if (isStatement) node.id = this.dummyIdent();
  node.params = this.parseFunctionParams();
  node.body = this.parseBlock();
  return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
};

lp.parseExport = function () {
  var node = this.startNode();
  this.next();
  if (this.eat(_.tokTypes.star)) {
    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
    return this.finishNode(node, "ExportAllDeclaration");
  }
  if (this.eat(_.tokTypes._default)) {
    var expr = this.parseMaybeAssign();
    if (expr.id) {
      switch (expr.type) {
        case "FunctionExpression":
          expr.type = "FunctionDeclaration";break;
        case "ClassExpression":
          expr.type = "ClassDeclaration";break;
      }
    }
    node.declaration = expr;
    this.semicolon();
    return this.finishNode(node, "ExportDefaultDeclaration");
  }
  if (this.tok.type.keyword) {
    node.declaration = this.parseStatement();
    node.specifiers = [];
    node.source = null;
  } else {
    node.declaration = null;
    node.specifiers = this.parseExportSpecifierList();
    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};

lp.parseImport = function () {
  var node = this.startNode();
  this.next();
  if (this.tok.type === _.tokTypes.string) {
    node.specifiers = [];
    node.source = this.parseExprAtom();
    node.kind = "";
  } else {
    var elt = undefined;
    if (this.tok.type === _.tokTypes.name && this.tok.value !== "from") {
      elt = this.startNode();
      elt.local = this.parseIdent();
      this.finishNode(elt, "ImportDefaultSpecifier");
      this.eat(_.tokTypes.comma);
    }
    node.specifiers = this.parseImportSpecifierList();
    node.source = this.eatContextual("from") ? this.parseExprAtom() : this.dummyString();
    if (elt) node.specifiers.unshift(elt);
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};

lp.parseImportSpecifierList = function () {
  var elts = [];
  if (this.tok.type === _.tokTypes.star) {
    var elt = this.startNode();
    this.next();
    if (this.eatContextual("as")) elt.local = this.parseIdent();
    elts.push(this.finishNode(elt, "ImportNamespaceSpecifier"));
  } else {
    var indent = this.curIndent,
        line = this.curLineStart,
        continuedLine = this.nextLineStart;
    this.pushCx();
    this.eat(_.tokTypes.braceL);
    if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
    while (!this.closes(_.tokTypes.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
      var elt = this.startNode();
      if (this.eat(_.tokTypes.star)) {
        if (this.eatContextual("as")) elt.local = this.parseIdent();
        this.finishNode(elt, "ImportNamespaceSpecifier");
      } else {
        if (this.isContextual("from")) break;
        elt.imported = this.parseIdent();
        if (_parseutil.isDummy(elt.imported)) break;
        elt.local = this.eatContextual("as") ? this.parseIdent() : elt.imported;
        this.finishNode(elt, "ImportSpecifier");
      }
      elts.push(elt);
      this.eat(_.tokTypes.comma);
    }
    this.eat(_.tokTypes.braceR);
    this.popCx();
  }
  return elts;
};

lp.parseExportSpecifierList = function () {
  var elts = [];
  var indent = this.curIndent,
      line = this.curLineStart,
      continuedLine = this.nextLineStart;
  this.pushCx();
  this.eat(_.tokTypes.braceL);
  if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
  while (!this.closes(_.tokTypes.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
    if (this.isContextual("from")) break;
    var elt = this.startNode();
    elt.local = this.parseIdent();
    if (_parseutil.isDummy(elt.local)) break;
    elt.exported = this.eatContextual("as") ? this.parseIdent() : elt.local;
    this.finishNode(elt, "ExportSpecifier");
    elts.push(elt);
    this.eat(_.tokTypes.comma);
  }
  this.eat(_.tokTypes.braceR);
  this.popCx();
  return elts;
};

},{"..":1,"./parseutil":4,"./state":5}],7:[function(_dereq_,module,exports){
"use strict";

var _ = _dereq_("..");

var _state = _dereq_("./state");

var lp = _state.LooseParser.prototype;

function isSpace(ch) {
  return ch < 14 && ch > 8 || ch === 32 || ch === 160 || _.isNewLine(ch);
}

lp.next = function () {
  this.last = this.tok;
  if (this.ahead.length) this.tok = this.ahead.shift();else this.tok = this.readToken();

  if (this.tok.start >= this.nextLineStart) {
    while (this.tok.start >= this.nextLineStart) {
      this.curLineStart = this.nextLineStart;
      this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
    }
    this.curIndent = this.indentationAfter(this.curLineStart);
  }
};

lp.readToken = function () {
  for (;;) {
    try {
      this.toks.next();
      if (this.toks.type === _.tokTypes.dot && this.input.substr(this.toks.end, 1) === "." && this.options.ecmaVersion >= 6) {
        this.toks.end++;
        this.toks.type = _.tokTypes.ellipsis;
      }
      return new _.Token(this.toks);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;

      // Try to skip some text, based on the error message, and then continue
      var msg = e.message,
          pos = e.raisedAt,
          replace = true;
      if (/unterminated/i.test(msg)) {
        pos = this.lineEnd(e.pos + 1);
        if (/string/.test(msg)) {
          replace = { start: e.pos, end: pos, type: _.tokTypes.string, value: this.input.slice(e.pos + 1, pos) };
        } else if (/regular expr/i.test(msg)) {
          var re = this.input.slice(e.pos, pos);
          try {
            re = new RegExp(re);
          } catch (e) {}
          replace = { start: e.pos, end: pos, type: _.tokTypes.regexp, value: re };
        } else if (/template/.test(msg)) {
          replace = { start: e.pos, end: pos,
            type: _.tokTypes.template,
            value: this.input.slice(e.pos, pos) };
        } else {
          replace = false;
        }
      } else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number|expected number in radix/i.test(msg)) {
        while (pos < this.input.length && !isSpace(this.input.charCodeAt(pos))) ++pos;
      } else if (/character escape|expected hexadecimal/i.test(msg)) {
        while (pos < this.input.length) {
          var ch = this.input.charCodeAt(pos++);
          if (ch === 34 || ch === 39 || _.isNewLine(ch)) break;
        }
      } else if (/unexpected character/i.test(msg)) {
        pos++;
        replace = false;
      } else if (/regular expression/i.test(msg)) {
        replace = true;
      } else {
        throw e;
      }
      this.resetTo(pos);
      if (replace === true) replace = { start: pos, end: pos, type: _.tokTypes.name, value: "✖" };
      if (replace) {
        if (this.options.locations) replace.loc = new _.SourceLocation(this.toks, _.getLineInfo(this.input, replace.start), _.getLineInfo(this.input, replace.end));
        return replace;
      }
    }
  }
};

lp.resetTo = function (pos) {
  this.toks.pos = pos;
  var ch = this.input.charAt(pos - 1);
  this.toks.exprAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) || /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(this.input.slice(pos - 10, pos));

  if (this.options.locations) {
    this.toks.curLine = 1;
    this.toks.lineStart = _.lineBreakG.lastIndex = 0;
    var match = undefined;
    while ((match = _.lineBreakG.exec(this.input)) && match.index < pos) {
      ++this.toks.curLine;
      this.toks.lineStart = match.index + match[0].length;
    }
  }
};

lp.lookAhead = function (n) {
  while (n > this.ahead.length) this.ahead.push(this.readToken());
  return this.ahead[n - 1];
};

},{"..":1,"./state":5}]},{},[3])(3)
});;
/*global window, process, global*/


;(function(Global) {

  var globalInterfaceSpec = [
    {action: "installMethods", target: "Array",              sources: ["arr"],    methods: ["from","genN","range","withN"]},
    {action: "installMethods", target: "Array.prototype",    sources: ["arr"],    methods: ["all","any","batchify","clear","clone","collect","compact","delimWith","detect","doAndContinue","each","equals","filterByKey","findAll","first","flatten","forEachShowingProgress","grep","groupBy","groupByKey","histogram","include","inject","intersect","invoke","last","mapAsync", "mapAsyncSeries", "mask","max","min","mutableCompact","nestedDelay","partition","pluck","pushAll","pushAllAt","pushAt","pushIfNotIncluded","reMatches","reject","rejectByKey","remove","removeAt","replaceAt","rotate","shuffle","size","sortBy","sortByKey","sum","swap","toArray","toTuples","union","uniq","uniqBy","without","withoutAll","zip"], alias: [["select", "filter"],["find","detect"]]},
    {action: "installMethods", target: "Date",               sources: ["date"],   methods: [/*"parse"*/]},
    {action: "installMethods", target: "Date.prototype",     sources: ["date"],   methods: ["equals","format","relativeTo"]},
    {action: "installMethods", target: "Function",           sources: ["fun"],    methods: ["fromString"]},
    {action: "installMethods", target: "Function.prototype", sources: ["fun"],    methods: [/*"addProperties",*/"addToObject","argumentNames","asScript","asScriptOf","binds","curry","delay","functionNames","localFunctionNames","getOriginal","getVarMapping","logCalls","logCompletion","logErrors","qualifiedMethodName","setProperty","traceCalls","wrap"]},
    {action: "installMethods", target: "Number",             sources: ["num"],    methods: []},
    {action: "installMethods", target: "Number.prototype",   sources: ["num"],    methods: ["detent","randomSmallerInteger","roundTo","toDegrees","toRadians"]},
    {action: "installMethods", target: "Object",             sources: ["obj"],    methods: ["addScript","clone","deepCopy","extend","inherit","isArray","isBoolean","isElement","isEmpty","isFunction","isNumber","isObject","isRegExp","isString","isUndefined","merge","mergePropertyInHierarchy","values","valuesInPropertyHierarchy"]},
    {action: "installMethods", target: "Object.prototype",   sources: ["obj"],    methods: []},
    {action: "installMethods", target: "String.prototype",   sources: ["string"], methods: ["camelize","capitalize","digitValue","empty","endsWith","hashCode","include","pad","regExpEscape","startsWith","startsWithVowel","succ","times","toArray","toQueryParams","truncate"]},
    {action: "installMethods", target: "Function.prototype", sources: ["class"],  methods: ["create","addMethods","isSubclassOf","superclasses","categoryNameFor","remove"], alias: [["subclass", "create"]]},

    {action: "installObject", target: "Numbers",                source: "num",        methods: ["average","between","convertLength","humanReadableByteSize","median","normalRandom","parseLength","random","sort"]},
    {action: "installObject", target: "Properties",             source: "properties", methods: ["all","allOwnPropertiesOrFunctions","allProperties","any","forEachOwn","hash","nameFor","own","ownValues","values"]},
    {action: "installObject", target: "Strings",                source: "string",     methods: ["camelCaseString","createDataURI","diff","format","formatFromArray","indent","lineIndexComputer","lines","md5","newUUID","nonEmptyLines","pad","paragraphs","peekLeft","peekRight","print","printNested","printTable","printTree","quote","reMatches","removeSurroundingWhitespaces","stringMatch","tableize","tokens","unescapeCharacterEntities","withDecimalPrecision"]},
    {action: "installObject", target: "Objects",                source: "obj",        methods: ["asObject", "equals","inspect","isMutableType","safeToString","shortPrintStringOf","typeStringOf"]},
    {action: "installObject", target: "Functions",              source: "fun",        methods: ["all","compose","composeAsync","createQueue","debounce","debounceNamed","either","extractBody","flip","notYetImplemented","once","own","throttle","throttleNamed","timeToRun","timeToRunN","waitFor","workerWithCallbackQueue","wrapperChain"]},
    {action: "installObject", target: "Grid",                   source: "grid"},
    {action: "installObject", target: "Interval",               source: "interval"},
    {action: "installObject", target: "lively.ArrayProjection", source: "arrayProjection"},
    {action: "installObject", target: "lively.Closure",         source: "Closure"},
    {action: "installObject", target: "lively.Grouping",        source: "Group"},
    {action: "installObject", target: "lively.PropertyPath",    source: "Path"},
    {action: "installObject", target: "lively.Worker",          source: "worker"},
    {action: "installObject", target: "lively.Class",           source: "classHelper"}
  ];

  var isNode = typeof process !== 'undefined'
            && process.versions && process.versions.node;

  var livelyLang = createLivelyLangObject();
  if (isNode) module.exports = livelyLang;
  else {
    livelyLang._prevLivelyGlobal = Global.lively;
    if (!Global.lively) Global.lively = {};
    if (!Global.lively.lang) Global.lively.lang = livelyLang;
    else {
      for (var name in livelyLang)
        Global.lively.lang[name] = livelyLang[name];
    }
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function createLivelyLangObject() {
    return {
      chain: chain,
      noConflict: noConflict,
      installGlobals: installGlobals,
      uninstallGlobals: uninstallGlobals,
      globalInterfaceSpec: globalInterfaceSpec,
      deprecatedLivelyPatches: deprecatedLivelyPatches
    };
  }

  function chain(object) {
    if (!object) return object;

    var chained;
    if (Array.isArray(object)) return createChain(livelyLang.arr, object);
    if (object.constructor.name === "Date") return createChain(livelyLang.date, object);
    switch (typeof object) {
      case 'string': return createChain(livelyLang.string, object);
      case 'object': return createChain(livelyLang.obj, object);
      case 'function': return createChain(livelyLang.fun, object);
      case 'number': return createChain(livelyLang.num, object);
    }
    throw new Error("Chain for object " + object + " (" + object.constructor.name + ") no supported");
  }

  function createChain(interfaceObj, obj) {
    return Object.keys(interfaceObj).reduce(function(chained, methodName) {
      chained[methodName] = function(/*args*/) {
        var args = Array.prototype.slice.call(arguments),
            result = interfaceObj[methodName].apply(null, [obj].concat(args));
        return chain(result);
      }
      return chained;
    }, {value: function() { return obj; }});
  }

  function noConflict() {
    if (!isNode) {
      var keepLivelyNS = livelyLang._prevLivelyGlobal;
      if (!keepLivelyNS) delete Global.lively
      else delete Global.lively.lang
    }
    return livelyLang;
  }

  function installGlobals() {
    globalInterfaceSpec.forEach(function(ea) {
      if (ea.action === "installMethods") {
        var targetPath = livelyLang.Path(ea.target);
        if (!targetPath.isIn(Global)) targetPath.set(Global, {}, true);
        var sourcePath = livelyLang.Path(ea.sources[0]);
        ea.methods.forEach(function(name) {
          installProperty(
            sourcePath.concat([name]),
            targetPath.concat([name]));
        });
        if (ea.alias)
          ea.alias.forEach(function(mapping) {
            installProperty(
              sourcePath.concat([mapping[1]]),
              targetPath.concat([mapping[0]]));
          });

      } else if (ea.action === "installObject") {
        var targetPath = livelyLang.Path(ea.target);
        var source = livelyLang.Path(ea.source).get(livelyLang);
        targetPath.set(Global, source, true);

      } else throw new Error("Cannot deal with global setup action: " + ea.action);
    });
  }

  function installProperty(sourcePath, targetPath) {
    if (!sourcePath.isIn(livelyLang)) {
      var err = new Error("property not provided by lively.lang: " + sourcePath);
      console.error(err.stack || err);
      throw err;
    }

    var prop = sourcePath.get(livelyLang);
    if (typeof prop === "function" && targetPath.slice(-2, -1).toString() === "prototype") {
      var origFunc = prop;
      prop = function(/*this and args*/) {
        var args = Array.prototype.slice.call(arguments);
        args.unshift(this);
        return origFunc.apply(null, args);
      };
      prop.toString = function() { return origFunc.toString(); };
    }
    targetPath.set(Global, prop, true);
  }

  function uninstallGlobals() {
    globalInterfaceSpec.forEach(function(ea) {
      if (ea.action === "installMethods") {
        var p = livelyLang.Path(ea.target)
        var source = livelyLang.Path(ea.source).get(livelyLang);
        var target = p.get(Global);
        if (!target) return;
        ea.methods
          .filter(function(name) { return source === target[name]; })
          .forEach(function(name) { delete target[name]; });
        if (ea.alias)
          ea.alias
            .filter(function(name) { return source === target[name]; })
            .forEach(function(mapping) { delete target[mapping[0]]; });

      } else if (ea.action === "installObject") {
        var p = livelyLang.Path(ea.target);
        p.del(Global);

      } else throw new Error("Cannot deal with global setup action: " + ea.action);
    })
  }

  function deprecatedLivelyPatches() {
    livelyLang.installGlobals();

    Global.$A = Array.from;

    // We need to redefine Function.evalJS here b/c the original definition is
    // in a JS 'use strict' block. However, not all function sources we pass in
    // #evalJS from Lively adhere to the strictness rules. To allow those
    // functions for now we define the creator again outside of a strictness block.
    Function.evalJS = livelyLang.fun.evalJS = function(src) { return eval(src); }
    livelyLang.Path.type = livelyLang.PropertyPath;
    livelyLang.Path.prototype.serializeExpr = function () {
      // ignore-in-doc
      return 'lively.PropertyPath(' + livelyLang.obj.inspect(this.parts()) + ')';
    }

    livelyLang.Closure.type = "lively.Closure";
    livelyLang.fun.methodChain = livelyLang.fun.wrapperChain;

    if (typeof JSON !== "undefined") JSON.prettyPrint = function(jso) { return JSON.stringify(jso, null, 2); };

    Global.NativeArrayFunctions = livelyLang.arrNative;
  }

})(typeof window !== "undefined" ? window : global);
;/*global process, require*/

/*
 * A simple node.js-like cross-platform event emitter implementation.
 */
;(function(exports) {
"use strict";

var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;

// A simple node.js-like cross-platform event emitter implementation that can
// be used as a mixin. Emitters support the methods: `on(eventName, handlerFunc)`,
// `once(eventName, handlerFunc)`, `emit(eventName, eventData)`,
// `removeListener(eventName, handlerFunc)`, `removeAllListeners(eventName)`
// Example:
// var emitter = events.makeEmitter({});
// var log = [];
// emitter.on("test", function() { log.push("listener1"); });
// emitter.once("test", function() { log.push("listener2"); });
// emitter.emit("test");
// emitter.emit("test");
// log // => ["listener1","listener2","listener1"]
// emitter.removeAllListeners("test");
// emitter.emit("test");
// log // => is still ["listener1","listener2","listener1"]

var events = exports.events = {

  makeEmitter: isNode ? function(obj) {
    if (obj.on && obj.removeListener) return obj;
    var events = require("events");
    require("util")._extend(obj, events.EventEmitter.prototype);
    events.EventEmitter.call(obj);
    return obj;
  } : function(obj) {
    if (obj.on && obj.removeListener) return obj;

    obj.listeners = {};

    obj.on = function(type, handler) {
      if (!handler) return;
      if (!obj.listeners[type]) obj.listeners[type] = [];
      obj.listeners[type].push(handler);
    }

    obj.once = function(type, handler) {
      if (!handler) return;
      function onceHandler(/*ignore-in-docs args*/) {
        obj.removeListener(type, onceHandler);
        handler.apply(this, arguments);
      }
      obj.on(type, onceHandler);
    }

    obj.removeListener = function(type, handler) {
      if (!obj.listeners[type]) return;
      obj.listeners[type] = obj.listeners[type].filter(function(h) {
        return h !== handler; });
    }

    obj.removeAllListeners = function(type) {
      if (!obj.listeners[type]) return;
      obj.listeners[type] = [];
    }

    obj.emit = function(/*type and args*/) {
      var args = Array.prototype.slice.call(arguments);
      var type = args.shift();
      var handlers = obj.listeners[type];
      if (!handlers || !handlers.length) return;
      handlers.forEach(function(handler) {
        try { handler.apply(null, args) } catch (e) {
          console.error("Error in event handler: %s", e.stack || String(e));
        }
      });
    }

    return obj;
  }
};

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global*/

/*
 * Utility functions that help to inspect, enumerate, and create JS objects
 */
;(function(exports) {
"use strict";

// -=-=-=-=-=-=-=-=-
// internal helper
// -=-=-=-=-=-=-=-=-

// serveral methods in lib/object.js are inspired or derived from
// Prototype JavaScript framework, version 1.6.0_rc1
// (c) 2005-2007 Sam Stephenson
// Prototype is freely distributable under the terms of an MIT-style license.
// For details, see the Prototype web site: http://www.prototypejs.org/

function print(object) {
  if (object && obj.isArray(object)) { return '[' + object.map(print) + ']'; }
  if (typeof object !== "string") { return String(object); }
  var result = String(object);
  result = result.replace(/\n/g, '\\n\\\n');
  result = result.replace(/(")/g, '\\$1');
  result = '\"' + result + '\"';
  return result;
}

function argumentNames(func) {
  if (func.superclass) return [];
  var names = func.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/)[1].
      replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '').
      replace(/\s+/g, '').split(',');
  return names.length == 1 && !names[0] ? [] : names;
}

function indent(str, indentString, depth) {
  if (!depth || depth <= 0) return str;
  while (depth > 0) { depth--; str = indentString + str; }
  return str;
}

// show-in-doc
var obj = exports.obj = {

  // -=-=-=-=-
  // testing
  // -=-=-=-=-

  isArray: function(obj) { /*show-in-doc*/ return obj && Array.isArray(obj); },

  isElement: function(object) { /*show-in-doc*/ return object && object.nodeType == 1; },

  isFunction: function(object) { /*show-in-doc*/ return object instanceof Function; },

  isBoolean: function(object) { /*show-in-doc*/ return typeof object == "boolean"; },

  isString: function(object) { /*show-in-doc*/ return typeof object == "string"; },

  isNumber: function(object) { /*show-in-doc*/ return typeof object == "number"; },

  isUndefined: function(object) { /*show-in-doc*/ return typeof object == "undefined"; },

  isRegExp: function(object) { /*show-in-doc*/ return object instanceof RegExp; },

  isObject: function(object) { /*show-in-doc*/ return typeof object == "object"; },

  isPrimitive: function(obj) {
    // show-in-doc
    if (!obj) return true;
    switch (typeof obj) {
      case "string":
      case "number":
      case "boolean": return true;
    }
    return false;
  },

  isEmpty: function(object) {
    /*show-in-doc*/
    for (var key in object)
      if (object.hasOwnProperty(key)) return false;
    return true;
  },

  equals: function(a, b) {
    // Is object `a` structurally equivalent to object `b`? Deep comparison.
    if (!a && !b) return true;
    if (!a || !b) return false;
    switch (a.constructor) {
      case String:
      case Date:
      case Boolean:
      case Number: return a == b;
    };
    if (typeof a.isEqualNode === "function") return a.isEqualNode(b);
    if (typeof a.equals === "function") return a.equals(b);
    return cmp(a, b) && cmp(b, a);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function cmp(left, right) {
      for (var name in left) {
        if (typeof left[name] === "function") continue;
         if (!obj.equals(left[name], right[name])) return false;
      }
      return true;
    }
  },

  // -=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-

  keys: Object.keys || function(object) {
    // like Object.keys
    var keys = [];
    for (var property in object) keys.push(property);
    return keys;
  },

  values: function(object) {
    // Example:
    // var obj1 = {x: 22}, obj2 = {x: 23, y: {z: 3}};
    // obj2.__proto__ = obj1;
    // obj.values(obj1) // => [22]
    // obj.values(obj2) // => [23,{z: 3}]
    return object ? Object.keys(object).map(function(k) { return object[k]; }) : [];
  },

  addScript: function (object, funcOrString, optName, optMapping) {
    var func = exports.fun.fromString(funcOrString);
    return exports.fun.asScriptOf(func, object, optName, optMapping);
  },

  // -=-=-=-=-
  // mutation
  // -=-=-=-=-
  extend: function(destination, source) {
    // Add all properties of `source` to `destination`.
    // Example:
    // var dest = {x: 22}, src = {x: 23, y: 24}
    // obj.extend(dest, src);
    // dest // => {x: 23,y: 24}

    var currentCategoryNames = null;
    for (var i = 1; i < arguments.length; i++) {
      if (typeof arguments[i] == "string") {
        var catName = arguments[i];
        if (!destination.categories) destination.categories = {};
        if (!destination.categories[catName]) destination.categories[catName] = [];
        currentCategoryNames = destination.categories[catName];
        continue;
      }

      var source = arguments[i];
      for (var property in source) {
          var getter = source.__lookupGetter__(property),
              setter = source.__lookupSetter__(property);
          if (getter) destination.__defineGetter__(property, getter);
          if (setter) destination.__defineSetter__(property, setter);
          if (getter || setter) continue;
          var sourceObj = source[property];
          destination[property] = sourceObj;
          if (currentCategoryNames) currentCategoryNames.push(property);
          if (typeof sourceObj === "function") {
            if ((!sourceObj.name || (sourceObj.name.length == 0)) && !sourceObj.displayName) sourceObj.displayName = property;
            // remember the module that contains the definition
            if (typeof lively !== 'undefined' && lively.Module && lively.Module.current)
              sourceObj.sourceModule = lively.Module.current();
          }
      }
    }

    return destination;
  },

  // -=-=-=-=-
  // clone
  // -=-=-=-=-

  clone: function(object) {
    // Shallow copy
    if (obj.isPrimitive(object)) return object;
    if (Array.isArray(object)) return Array.prototype.slice.call(object);
    var clone = {};
    for (var key in object) {
      if (object.hasOwnProperty(key))
        clone[key] = object[key];
    }
    return clone;
  },

  extract: function(object, properties, mapFunc) {
    // Takes a list of properties and returns a new object with those
    // properties shallow-copied from object
    var copied = {};
    for (var i = 0; i < properties.length; i++) {
      if (properties[i] in object)
        copied[properties[i]] = mapFunc ?
          mapFunc(properties[i], object[properties[i]]) : object[properties[i]];
    }
    return copied;
  },

  // -=-=-=-=-=-
  // inspection
  // -=-=-=-=-=-
  inspect: function inspect(object, options, depth) {
    // Prints a human-readable representation of `obj`. The printed
    // representation will be syntactically correct JavaScript but will not
    // necessarily evaluate to a structurally identical object. `inspect` is
    // meant to be used while interactivively exploring JavaScript programs and
    // state.
    //
    // `options` can be {
    //   printFunctionSource: BOOLEAN,
    //   escapeKeys: BOOLEAN,
    //   maxDepth: NUMBER,
    //   customPrinter: FUNCTION 
    // }
    options = options || {};
    depth = depth || 0;
    
    if (options.customPrinter) {
      var ignoreSignal = options._ignoreSignal || (options._ignoreSignal = {});
      var customInspected = options.customPrinter(object, ignoreSignal);
      if (customInspected !== ignoreSignal) return customInspected
    }
    if (!object) return print(object);

    // print function
    if (typeof object === 'function') {
      return options.printFunctionSource ? String(object) :
        'function' + (object.name ? ' ' + object.name : '')
        + '(' + argumentNames(object).join(',') + ') {/*...*/}';
    }

    // print "primitive"
    switch (object.constructor) {
      case String:
      case Boolean:
      case RegExp:
      case Number: return print(object);
    };

    if (typeof object.serializeExpr === 'function')
      return object.serializeExpr();

    var isArray = object && Array.isArray(object),
        openBr = isArray ? '[' : '{', closeBr = isArray ? ']' : '}';
    if (options.maxDepth && depth >= options.maxDepth)
      return openBr + '/*...*/' + closeBr;

    var printedProps = [];
    if (isArray) {
      printedProps = object.map(function(ea) { return inspect(ea, options, depth + 1); });
    } else {
      printedProps = Object.keys(object)
        .sort(function(a, b) {
          var aIsFunc = typeof object[a] === 'function',
              bIsFunc = typeof object[b] === 'function';
          if (aIsFunc === bIsFunc) {
            if (a < b) return -1;
            if (a > b) return 1;
            return 0;
          }
          return aIsFunc ? 1 : -1;
        })
        .map(function(key, i) {
          if (isArray) inspect(object[key], options, depth + 1);
          var printedVal = inspect(object[key], options, depth + 1);
          return options.escapeKeys ?
            Strings.print(key) : key + ": " + printedVal;
        });
    }

    if (printedProps.length === 0) { return openBr + closeBr; }

    var printedPropsJoined = printedProps.join(', '),
        useNewLines = (!isArray || options.newLineInArrays)
          && (!options.minLengthForNewLine
          || printedPropsJoined.length >= options.minLengthForNewLine),
        ind = indent('', options.indent || '  ', depth),
        propIndent = indent('', options.indent || '  ', depth + 1),
        startBreak = useNewLines && !isArray ? '\n' + propIndent : '',
        eachBreak = useNewLines ? '\n' + propIndent : '',
        endBreak = useNewLines && !isArray ? '\n' + ind : '';
    if (useNewLines) printedPropsJoined = printedProps.join(',' + eachBreak);
    return openBr + startBreak + printedPropsJoined + endBreak + closeBr;
  },

  // -=-=-=-=-
  // merging
  // -=-=-=-=-
  merge: function(objs) {
    // `objs` can be a list of objects. The return value will be a new object,
    // containing all properties of all objects. If the same property exist in
    // multiple objects, the right-most property takes precedence.
    //
    // Like `extend` but will not mutate objects in `objs`.

    // if objs are arrays just concat them
    // if objs are real objs then merge propertdies
    if (arguments.length > 1) {
      return obj.merge(Array.prototype.slice.call(arguments));
    }

    if (Array.isArray(objs[0])) { // test for all?
      return Array.prototype.concat.apply([], objs);
    }

    return objs.reduce(function(merged, ea) {
      for (var name in ea)
        if (ea.hasOwnProperty(name))
            merged[name] = ea[name];
      return merged;
    }, {});
  },

  // -=-=-=-=-=-=-
  // inheritance
  // -=-=-=-=-=-=-
  inherit: function(obj) { return Object.create(obj); },

  valuesInPropertyHierarchy: function(obj, name) {
    // Lookup all properties named name in the proto hierarchy of obj.
    // Example:
    // var a = {foo: 3}, b = Object.create(a), c = Object.create(b);
    // c.foo = 4;
    // obj.valuesInPropertyHierarchy(c, "foo") // => [3,4]
    var result = [], lookupObj = obj;
    while (lookupObj) {
      if (lookupObj.hasOwnProperty(name)) result.unshift(lookupObj[name])
      lookupObj = Object.getPrototypeOf(lookupObj);
    }
    return result;
  },

  mergePropertyInHierarchy: function(obj, propName) {
    // like `merge` but automatically gets all definitions of the value in the
    // prototype chain and merges those.
    // Example:
    // var o1 = {x: {foo: 23}}, o2 = {x: {foo: 24, bar: 15}}, o3 = {x: {baz: "zork"}};
    // o2.__proto__ = o1; o3.__proto__ = o2;
    // obj.mergePropertyInHierarchy(o3, "x");
    // // => {bar: 15, baz: "zork",foo: 24}
    return this.merge(this.valuesInPropertyHierarchy(obj, propName));
  },

  deepCopy: function (object) {
    // Recursively traverses `object` and its properties to create a copy.
    if (!object || typeof object !== "object") return object;
    var result = Array.isArray(object) ? Array(object.length) : {};
    for (var key in object) {
      if (object.hasOwnProperty(key))
        result[key] = obj.deepCopy(object[key]);
    }
    return result;
  },

  // -=-=-=-=-=-=-=-=-
  // stringification
  // -=-=-=-=-=-=-=-=-
  typeStringOf: function(obj) {
    // ignore-in-doc
    if (obj === null) return "null";
    if (typeof obj === "undefined") return "undefined";
    return obj.constructor.name;
  },

  shortPrintStringOf: function(obj) {
    // ignore-in-doc
    // primitive values
    if (!this.isMutableType(obj)) return this.safeToString(obj);

    // constructed objects
    if (obj.constructor.name !== 'Object' && !Array.isArray(obj)) {
      if(obj.constructor.name)
        return obj.constructor.name ?
          obj.constructor.name :
          Object.prototype.toString.call(obj).split(" ")[1].split("]")[0];
    }

    // arrays or plain objects
    var typeString = "";

    function displayTypeAndLength(obj, collectionType, firstBracket, secondBracket) {
      if (obj.constructor.name === collectionType) {
        typeString += firstBracket;
        if (obj.length || Object.keys(obj).length) typeString += "...";
        typeString += secondBracket;
      }
    }
    displayTypeAndLength(obj, "Object", "{", "}");
    displayTypeAndLength(obj, "Array", "[", "]");
    return typeString;
  },

  isMutableType: function(obj) {
    // Is `obj` a value or mutable type?
    var immutableTypes = ["null", "undefined", "Boolean", "Number", "String"];
    return immutableTypes.indexOf(this.typeStringOf(obj)) === -1;
  },

  safeToString: function(obj) {
    // Like `toString` but catches errors.
    try {
      return (obj ? obj.toString() : String(obj)).replace('\n','');
    } catch (e) { return '<error printing object>'; }
  },

  asObject: function(obj) {
    switch (typeof obj) {
      case 'string':
        return new String(obj);
      case 'boolean':
        return new Boolean(obj);
      case 'number':
        return new Number(obj);
      default:
        return obj;
    }
  }
};

// ignore-in-doc
// -=-=-=-=-=-
// properties
// -=-=-=-=-=-
var properties = exports.properties = {

  all: function(object, predicate) {
    // ignore-in-doc
    var a = [];
    for (var name in object) {
      if ((object.__lookupGetter__(name) || typeof object[name] !== 'function')
        && (predicate ? predicate(name, object) : true))
        a.push(name);
    }
    return a;
  },

  allOwnPropertiesOrFunctions: function(obj, predicate) {
    // ignore-in-doc
    return Object.getOwnPropertyNames(obj).reduce(function(result, name) {
      if (predicate ? predicate(obj, name) : true) result.push(name);
      return result;
    }, []);
  },

  own: function(object) {
    // ignore-in-doc
    var a = [];
    for (var name in object) {
      if (object.hasOwnProperty(name) && (object.__lookupGetter__(name)
        || object[name] !== 'function'))
        a.push(name);
    }
    return a;
  },

  forEachOwn: function(object, func, context) {
    // ignore-in-doc
    var result = [];
    for (var name in object) {
      if (!object.hasOwnProperty(name)) continue;
      var value = object[name];
      if (value !== 'function') {
        result.push(func.call(context || this, name, value));
      }
    }
    return result;
  },

  nameFor: function(object, value) {
    // ignore-in-doc
    for (var name in object) {
      if (object[name] === value) return name;
    }
    return undefined;
  },

  values: function(obj) {
    // ignore-in-doc
    var values = [];
    for (var name in obj) values.push(obj[name]);
    return values;
  },

  ownValues: function(obj) {
    // ignore-in-doc
    var values = [];
    for (var name in obj) {
      if (obj.hasOwnProperty(name)) values.push(obj[name]);
    }
    return values;
  },

  any: function(obj, predicate) {
    // ignore-in-doc
    for (var name in obj) {
      if (predicate(obj, name)) return true;
    }
    return false;
  },

  allProperties: function(obj, predicate) {
    // ignore-in-doc
    var result = [];
    for (var name in obj) {
      if (predicate ? predicate(obj, name) : true)
        result.push(name);
    }
    return result;
  },

  hash: function(obj) {
    // ignore-in-doc
    // Using the property names of `obj` to generate a hash value.
    return Object.keys(obj).sort().join('').hashCode();
  }

};

// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// js object path accessor
// -=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// A `Path` is an objectified chain of property names (kind of a "complex"
// getter and setter). Path objects can make access and writes into deeply nested
// structures more convenient. `Path` provide "safe" get and set operations and
// can be used for debugging by providing a hook that allows users to find out
// when get/set operations happen.
var Path = exports.Path = function Path(p, splitter) {
  if (p instanceof Path) return p;
  if (!(this instanceof Path)) return new Path(p, splitter);
  if (splitter) this.setSplitter(splitter);
  return this.fromPath(p);
}

obj.extend(Path, {
  superclass: Object,
  type: 'Path',
  categories: {}
});

obj.extend(Path.prototype, {

  isPathAccessor: true,
  splitter: '.',

  fromPath: function(path) {
    // ignore-in-doc
    if (obj.isString(path) && path !== '' && path !== this.splitter) {
      this._parts = path.split(this.splitter);
      this._path = path;
    } else if (obj.isArray(path)) {
      this._parts = [].concat(path);
      this._path = path.join(this.splitter);
    } else {
      this._parts = [];
      this._path = '';
    }
    return this;
  },

  setSplitter: function(splitter) {
    // ignore-in-doc
    if (splitter) this.splitter = splitter;
    return this;
  },

  parts: function() { /*key names as array*/ return this._parts; },

  size: function() { /*show-in-doc*/ return this._parts.length; },

  slice: function(n, m) { /*show-in-doc*/ return Path(this.parts().slice(n, m)); },

  normalizePath: function() {
    // ignore-in-doc
    // FIXME: define normalization
    return this._path;
  },

  isRoot: function(obj) { return this._parts.length === 0; },

  isIn: function(obj) {
    // Does the Path resolve to a value when applied to `obj`?
    if (this.isRoot()) return true;
    var parent = this.get(obj, -1);
    return parent && parent.hasOwnProperty(this._parts[this._parts.length-1]);
  },

  equals: function(obj) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path(["foo", 1, "bar", "baz"]);
    // // Path's can be both created via strings or pre-parsed with keys in a list.
    // p1.equals(p2) // => true
    return obj && obj.isPathAccessor && this.parts().equals(obj.parts());
  },

  isParentPathOf: function(otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1.bar");
    // p2.isParentPathOf(p1) // => true
    // p1.isParentPathOf(p2) // => false
    otherPath = otherPath && otherPath.isPathAccessor ?
      otherPath : Path(otherPath);
    var parts = this.parts(),
        otherParts = otherPath.parts();
    for(var i = 0; i < parts.length; i ++) {
      if (parts[i] != otherParts[i]) return false
    }
    return true
  },

  relativePathTo: function(otherPath) {
    // Example:
    // var p1 = Path("foo.1.bar.baz"), p2 = Path("foo.1");
    // p2.relativePathTo(p1) // => Path(["bar","baz"])
    // p1.relativePathTo(p2) // => undefined
    otherPath = Path(otherPath);
    return this.isParentPathOf(otherPath) ?
      otherPath.slice(this.size(), otherPath.size()) : undefined;
  },

  del: function(obj) {
    if (this.isRoot()) return false;
    var parent = obj
    for (var i = 0; i < this._parts.length-1; i++) {
      var part = this._parts[i];
      if (parent.hasOwnProperty(part)) {
        parent = parent[part];
      } else return false;
    }
    return delete parent[this._parts[this._parts.length-1]];
  },

  withParentAndKeyDo: function(obj, ensure, doFunc) {
    // Deeply resolve path in `obj`, not fully, however, only to the parent
    // element of the last part of path. Take the parent, the key (the last
    // part of path) and pass it to `doFunc`. When `ensure` is true, create
    // objects along path it path does not resolve
    if (this.isRoot()) return doFunc(null, null);
    var parent = obj;
    for (var i = 0; i < this._parts.length-1; i++) {
      var part = this._parts[i];
      if (parent.hasOwnProperty(part) && (typeof parent[part] === "object" || typeof parent[part] === "function")) {
        parent = parent[part];
      } else if (ensure) {
        parent = parent[part] = {};
      } else {
        return doFunc(null, part);
      }
    }
    return doFunc(parent, this._parts[this._parts.length-1]);
  },

  set: function(obj, val, ensure) {
    // Deeply resolve path in `obj` and set the resulting property to `val`. If
    // `ensure` is true, create nested structure in between as necessary.
    // Example:
    // var o1 = {foo: {bar: {baz: 42}}};
    // var path = Path("foo.bar.baz");
    // path.set(o1, 43)
    // o1 // => {foo: {bar: {baz: 43}}}
    // var o2 = {foo: {}};
    // path.set(o2, 43, true)
    // o2 // => {foo: {bar: {baz: 43}}}
    return this.withParentAndKeyDo(obj, ensure,
      function(parent, key) { return parent ? parent[key] = val : undefined; });
  },

  defineProperty: function(obj, propertySpec, ensure) {
    // like `Path>>set`, however uses Objeect.defineProperty
    return this.withParentAndKeyDo(obj, ensure,
      function(parent, key) {
        return parent ?
          Object.defineProperty(parent, key, propertySpec) :
          undefined;
      });
  },

  get: function(obj, n) {
    // show-in-doc
    var parts = n ? this._parts.slice(0, n) : this._parts;
    return parts.reduce(function(current, pathPart) {
      return current ? current[pathPart] : current; }, obj);
  },

  concat: function(p, splitter) {
    // show-in-doc
    return Path(this.parts().concat(Path(p, splitter).parts()));
  },

  toString: function() { return this.normalizePath(); },

  serializeExpr: function() {
    // ignore-in-doc
    return 'Path(' + Objects.inspect(this.parts()) + ')';
  },

  watch: function(options) {
    // React or be notified on reads or writes to a path in a `target`. Options:
    // ```js
    // {
    //   target: OBJECT,
    //   uninstall: BOOLEAN,
    //   onGet: FUNCTION,
    //   onSet: FUNCTION,
    //   haltWhenChanged: BOOLEAN,
    //   verbose: BOOLEAN
    // }
    // ```
    // Example:
    // // Quite useful for debugging to find out what call-sites change an object.
    // var o = {foo: {bar: 23}};
    // Path("foo.bar").watch({target: o, verbose: true});
    // o.foo.bar = 24; // => You should see: "[object Object].bar changed: 23 -> 24"
    if (!options || this.isRoot()) return;
    var target = options.target,
        parent = this.get(target, -1),
        propName = exports.arr.last(this.parts()),
        newPropName = 'propertyWatcher$' + propName,
        watcherIsInstalled = parent && parent.hasOwnProperty(newPropName),
        uninstall = options.uninstall,
        haltWhenChanged = options.haltWhenChanged,
        showStack = options.showStack,
        getter = parent.__lookupGetter__(propName),
        setter = parent.__lookupSetter__(propName);
    if (!target || !propName || !parent) return;
    if (uninstall) {
      if (!watcherIsInstalled) return;
      delete parent[propName];
      parent[propName] = parent[newPropName];
      delete parent[newPropName];
      var msg = 'Watcher for ' + parent + '.' + propName + ' uninstalled';
      show(msg);
      return;
    }
    if (watcherIsInstalled) {
      var msg = 'Watcher for ' + parent + '.' + propName + ' already installed';
      show(msg);
      return;
    }
    if (getter || setter) {
      var msg = parent + '["' + propName + '"] is a getter/setter, watching not support';
      console.log(msg);
      if (typeof show === "undefined") show(msg);
      return;
    }
    // observe slots, for debugging
    parent[newPropName] = parent[propName];
    parent.__defineSetter__(propName, function(v) {
      var oldValue = parent[newPropName];
      if (options.onSet) options.onSet(v, oldValue);
      var msg = parent + "." + propName + " changed: " + oldValue + " -> " + v;
      if (showStack) msg += '\n' + (typeof lively !== "undefined" ?
                           lively.printStack() : console.trace());
      if (options.verbose) {
        console.log(msg);
        if (typeof show !== 'undefined') show(msg);
      }
      if (haltWhenChanged) debugger;
      return parent[newPropName] = v;
    });
    parent.__defineGetter__(propName, function() {
      if (options.onGet) options.onGet(parent[newPropName]);
      return parent[newPropName];
    });
    var msg = 'Watcher for ' + parent + '.' + propName + ' installed';
    console.log(msg);
    if (typeof show !== 'undefined') show(msg);
  },

  debugFunctionWrapper: function(options) {
    // ignore-in-doc
    // options = {target, [haltWhenChanged, showStack, verbose, uninstall]}
    var target = options.target,
      parent = this.get(target, -1),
      funcName = this.parts().last(),
      uninstall = options.uninstall,
      haltWhenChanged = options.haltWhenChanged === undefined ? true : options.haltWhenChanged,
      showStack = options.showStack,
      func = parent && funcName && parent[funcName],
      debuggerInstalled = func && func.isDebugFunctionWrapper;
    if (!target || !funcName || !func || !parent) return;
    if (uninstall) {
      if (!debuggerInstalled) return;
      parent[funcName] = parent[funcName].debugTargetFunction;
      var msg = 'Uninstalled debugFunctionWrapper for ' + parent + '.' + funcName;
      console.log(msg);
      if (typeof show !== 'undefined') show(msg);
      show(msg);
      return;
    }
    if (debuggerInstalled) {
      var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' already installed';
      console.log(msg);
      if (typeof show !== 'undefined') show(msg);
      return;
    }
    var debugFunc = parent[funcName] = func.wrap(function(proceed) {
      var args = Array.from(arguments);
      if (haltWhenChanged) debugger;
      if (showStack) show(lively.printStack());
      if (options.verbose) show(funcName + ' called');
      return args.shift().apply(parent, args);
    });
    debugFunc.isDebugFunctionWrapper = true;
    debugFunc.debugTargetFunction = func;
    var msg = 'debugFunctionWrapper for ' + parent + '.' + funcName + ' installed';
    console.log(msg);
    if (typeof show !== 'undefined') show(msg);
  }

});

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;
/*
 * Methods to make working with arrays more convenient and collection-like
 * abstractions for groups, intervals, grids.
 */
;(function(exports) {
"use strict";


// Pure JS implementations of native Array methods.
var arrNative = exports.arrNative = {

  sort: function(sortFunc) {
    // show-in-doc
    if (!sortFunc) {
      sortFunc = function(x,y) {
        if (x < y) return -1;
        if (x > y) return 1;
        return 0;
      };
    }
    var len = this.length, sorted = [];
    for (var i = 0; i < this.length; i++) {
      var inserted = false;
      for (var j = 0; j < sorted.length; j++) {
        if (1 === sortFunc(sorted[j], this[i])) {
          inserted = true;
          sorted[j+1] = sorted[j];
          sorted[j] = this[i];
          break;
        }
      }
      if (!inserted) sorted.push(this[i]);
    }
    return sorted;
  },

  filter: function(iterator, context) {
    // show-in-doc
    var results = [];
    for (var i = 0; i < this.length; i++) {
      if (!this.hasOwnProperty(i)) continue;
      var value = this[i];
      if (iterator.call(context, value, i)) results.push(value);
    }
    return results;
  },

  forEach: function(iterator, context) {
    // show-in-doc
    for (var i = 0, len = this.length; i < len; i++) {
      iterator.call(context, this[i], i, this); }
  },

  some: function(iterator, context) {
    // show-in-doc
    return this.detect(iterator, context) !== undefined;
  },

  every: function(iterator, context) {
    // show-in-doc
    var result = true;
    for (var i = 0, len = this.length; i < len; i++) {
      result = result && !! iterator.call(context, this[i], i);
      if (!result) break;
    }
    return result;
  },

  map: function(iterator, context) {
    // show-in-doc
    var results = [];
    this.forEach(function(value, index) {
      results.push(iterator.call(context, value, index));
    });
    return results;
  },

  reduce: function(iterator, memo, context) {
    // show-in-doc
    var start = 0;
    if (!arguments.hasOwnProperty(1)) { start = 1; memo = this[0]; }
    for (var i = start; i < this.length; i++)
      memo = iterator.call(context, memo, this[i], i, this);
    return memo;
  },

  reduceRight: function(iterator, memo, context) {
    // show-in-doc
    var start = this.length-1;
    if (!arguments.hasOwnProperty(1)) { start--; memo = this[this.length-1]; }
    for (var i = start; i >= 0; i--)
      memo = iterator.call(context, memo, this[i], i, this);
    return memo;
  }

};

// variety of functions for Arrays
var arr = exports.arr = {

  // -=-=-=-=-=-=-=-
  // array creations
  // -=-=-=-=-=-=-=-

  range: function(begin, end, step) {
    // Examples:
    //   arr.range(0,5) // => [0,1,2,3,4,5]
    //   arr.range(0,10,2) // => [0,2,4,6,8,10]
    step = step || 1
    var result = [];
    for (var i = begin; i <= end; i += step)
      result.push(i);
    return result;
  },

  from: function(iterable) {
    // Makes JS arrays out of array like objects like `arguments` or DOM `childNodes`
    if (!iterable) return [];
    if (Array.isArray(iterable)) return iterable;
    if (iterable.toArray) return iterable.toArray();
    var length = iterable.length,
        results = new Array(length);
    while (length--) results[length] = iterable[length];
    return results;
  },

  withN: function(n, obj) {
    // Example:
    //   arr.withN(3, "Hello") // => ["Hello","Hello","Hello"]
    var result = new Array(n);
    while (n > 0) result[--n] = obj;
    return result;
  },

  genN: function(n, generator) {
    // Number -> Function -> Array
    // Takes a generator function that is called for each `n`.
    // Example:
    //   arr.genN(3, num.random) // => [46,77,95]
    var result = new Array(n);
    while (n > 0) result[--n] = generator(n);
    return result;
  },

  // -=-=-=-=-
  // filtering
  // -=-=-=-=-

  filter: function(array, iterator, context) {
    // [a] -> (a -> Boolean) -> c? -> [a]
    // Calls `iterator` for each element in `array` and returns a subset of it
    // including the elements for which `iterator` returned a truthy value.
    // Like `Array.prototype.filter`.
    return array.filter(iterator, context);
  },

  detect: function(arr, iterator, context) {
    // [a] -> (a -> Boolean) -> c? -> a
    // returns the first occurrence of an element in `arr` for which iterator
    // returns a truthy value
    for (var value, i = 0, len = arr.length; i < len; i++) {
      value = arr[i];
      if (iterator.call(context, value, i)) return value;
    }
    return undefined;
  },

  filterByKey: function(arr, key) {
    // [a] -> String -> [a]
    // Example:
    //   var objects = [{x: 3}, {y: 4}, {x:5}]
    //   arr.filterByKey(objects, "x") // => [{x: 3},{x: 5}]
    return arr.filter(function(ea) { return !!ea[key]; });
  },

  grep: function(arr, filter, context) {
    // [a] -> String|RegExp -> [a]
    // `filter` can be a String or RegExp. Will stringify each element in
    // Example:
    // ["Hello", "World", "Lively", "User"].grep("l") // => ["Hello","World","Lively"]
    if (typeof filter === 'string') filter = new RegExp(filter, 'i');
    return arr.filter(filter.test.bind(filter))
  },

  mask: function(array, mask) {
    // select every element in array for which array's element is truthy
    // Example: [1,2,3].mask([false, true, false]) => [2]
    return array.filter(function(_, i) { return !!mask[i]; });
  },

  reject: function(array, func, context) {
    // show-in-doc
    function iterator(val, i) { return !func.call(context, val, i); }
    return array.filter(iterator);
  },

  rejectByKey: function(array, key) {
    // show-in-doc
    return array.filter(function(ea) { return !ea[key]; });
  },

  without: function(array, elem) {
    // non-mutating
    // Example:
    // arr.without([1,2,3,4,5,6], 3) // => [1,2,4,5,6]
    return array.filter(function(value) { return value !== elem; });
  },

  withoutAll: function(array, otherArr) {
    // non-mutating
    // Example:
    // arr.withoutAll([1,2,3,4,5,6], [3,4]) // => [1,2,5,6]
    return array.filter(function(value) {
      return otherArr.indexOf(value) === -1;
    });
  },

  uniq: function(array, sorted) {
    // non-mutating
    // Removes duplicates from array.
    return array.reduce(function(a, value, index) {
      if (0 === index || (sorted ? a.last() != value : a.indexOf(value) === -1))
        a.push(value);
      return a;
    }, []);
  },

  uniqBy: function(array, comparator, context) {
    // like `arr.uniq` but with custom equality: `comparator(a,b)` returns
    // BOOL. True if a and be should be regarded equal, false otherwise.
    var result = arr.clone(array);
    for (var i = 0; i < result.length; i++) {
      var item = array[i];
      for (var j = i+1; j < result.length; j++) {
        if (comparator.call(context, item, result[j])) {
          arr.removeAt(result, j); j--;
        }
      }
    }
    return result;
  },

  compact: function(array) {
    // removes falsy values
    // Example:
    // arr.compact([1,2,undefined,4,0]) // => [1,2,4]
    return array.filter(function(ea) { return !!ea; });
  },

  mutableCompact: function(array) {
    // fix gaps that were created with 'delete'
    var i = 0, j = 0, len = array.length;
    while (i < len) {
      if (array.hasOwnProperty(i)) array[j++] = array[i];
      i++;
    }
    while (j++ < len) array.pop();
    return array;
  },

  // -=-=-=-=-
  // iteration
  // -=-=-=-=-

  forEach: function(array, iterator, context) {
    // [a] -> (a -> Undefined) -> c? -> Undefined
    // `iterator` is called on each element in `array` for side effects. Like
    // `Array.prototype.forEach`.
    return array.forEach(iterator, context);
  },

  zip: function(/*arr, arr2, arr3*/) {
    // Takes any number of lists as arguments. Combines them elment-wise.
    // Example:
    // arr.zip([1,2,3], ["a", "b", "c"], ["A", "B"])
    // // => [[1,"a","A"],[2,"b","B"],[3,"c",undefined]]
    var args = arr.from(arguments),
        array = args.shift(),
        iterator = typeof arr.last(args) === 'function' ?
          args.pop() : function(x) { return x; },
        collections = [array].concat(args).map(arr.from);
    return array.map(function(value, index) {
      return iterator(arr.pluck(collections, index), index); });
  },

  flatten: function flatten(array) {
    // Turns a nested collection into a flat one.
    // Example:
    // arr.flatten([1, [2, [3,4,5], [6]], 7,8])
    // // => [1,2,3,4,5,6,7,8]
    return array.reduce(function(flattened, value) {
      return flattened.concat(Array.isArray(value) ?
        flatten(value) : [value]);
    }, []);
  },

  flatmap: function(array, it, ctx) {
    // the simple version
    // Array.prototype.concat.apply([], array.map(it, ctx));
    // causes stack overflows with really big arrays
    var results = [];
    for (var i = 0; i < array.length; i++) {
      results.push.apply(results, it.call(ctx, array[i], i));
    }
    return results;
  },

  interpose: function(array, delim) {
    // Injects delim between elements of array
    // Example:
    // lively.lang.arr.interpose(["test", "abc", 444], "aha"));
    // // => ["test","aha","abc","aha",444]
    return array.reduce(function(xs, x) {
      if (xs.length > 0) xs.push(delim)
      xs.push(x); return xs;
    }, []);
  },

  delimWith: function(array, delim) {
    // ignore-in-doc
    return arr.interpose(array, delim);
  },

  // -=-=-=-=-
  // mapping
  // -=-=-=-=-

  map: function(array, iterator, context) {
    // [a] -> (a -> b) -> c? -> [b]
    // Applies `iterator` to each element of `array` and returns a new Array
    // with the results of those calls. Like `Array.prototype.some`.
    return array.map(iterator, context);
  },

  invoke: function(array, method, arg1, arg2, arg3, arg4, arg5, arg6) {
    // Calls `method` on each element in `array`, passing all arguments. Often
    // a handy way to avoid verbose `map` calls.
    // Example: arr.invoke(["hello", "world"], "toUpperCase") // => ["HELLO","WORLD"]
    return array.map(function(ea) {
      return ea[method](arg1, arg2, arg3, arg4, arg5, arg6);
    });
  },

  pluck: function(array, property) {
    // Returns `property` or undefined from each element of array. For quick
    // `map`s and similar to `invoke`.
    // Example: arr.pluck(["hello", "world"], 0) // => ["h","w"]
    return array.map(function(ea) { return ea[property]; });
  },

  // -=-=-=-=-
  // folding
  // -=-=-=-=-

  reduce: function(array, iterator, memo, context) {
    // Array -> Function -> Object? -> Object? -> Object?
    // Applies `iterator` to each element of `array` and returns a new Array
    // with the results of those calls. Like `Array.prototype.some`.
    return array.reduce(iterator, memo, context);
  },

  reduceRight: function(array, iterator, memo, context) {
    // show-in-doc
    return array.reduceRight(iterator, memo, context);
  },

  // -=-=-=-=-
  // testing
  // -=-=-=-=-

  isArray: Array.isArray,

  include: function(array, object) {
    // Example: arr.include([1,2,3], 2) // => true
    return array.indexOf(object) !== -1;
  },

  some: function(array, iterator, context) {
    // [a] -> (a -> Boolean) -> c? -> Boolean
    // Returns true if there is at least one abject in `array` for which
    // `iterator` returns a truthy result. Like `Array.prototype.some`.
    return array.some(iterator, context);
  },

  every: function(array, iterator, context) {
    // [a] -> (a -> Boolean) -> c? -> Boolean
    // Returns true if for all abjects in `array` `iterator` returns a truthy
    // result. Like `Array.prototype.every`.
    return array.every(iterator, context);
  },

  equals: function(array, otherArray) {
    // Returns true iff each element in `array` is equal (`==`) to its
    // corresponding element in `otherArray`
    var len = array.length;
    if (!otherArray || len !== otherArray.length) return false;
    for (var i = 0; i < len; i++) {
      if (array[i] && otherArray[i] && array[i].equals && otherArray[i].equals) {
        if (!array[i].equals(otherArray[i])) {
          return false;
        } else {
          continue;
        }
      }
      if (array[i] != otherArray[i]) return false;
    }
    return true;
  },

  // -=-=-=-=-
  // sorting
  // -=-=-=-=-

  sort: function(array, sortFunc) {
    // [a] -> (a -> Number)? -> [a]
    // Just `Array.prototype.sort`
    return array.sort(sortFunc);
  },

  sortBy: function(array, iterator, context) {
    // Example:
    // arr.sortBy(["Hello", "Lively", "User"], function(ea) {
    //   return ea.charCodeAt(ea.length-1); }) // => ["Hello","User","Lively"]
    return arr.pluck(
      array.map(function(value, index) {
        return {value: value,criteria: iterator.call(context, value, index)};
      }).sort(function(left, right) {
        var a = left.criteria, b = right.criteria;
        return a < b ? -1 : a > b ? 1 : 0;
      }), 'value');
  },

  sortByKey: function(array, key) {
    // Example:
    // lively.lang.arr.sortByKey([{x: 3}, {x: 2}, {x: 8}], "x")
    // // => [{x: 2},{x: 3},{x: 8}]
    return arr.sortBy(array, function(ea) { return ea[key]; });
  },

  reverse: function(array) { return array.reverse(); },

  reversed: function(array) { return arr.clone(array).reverse(); },

  // -=-=-=-=-=-=-=-=-=-=-=-=-
  // RegExp / String matching
  // -=-=-=-=-=-=-=-=-=-=-=-=-

  reMatches: function(arr, re, stringifier) {
    // convert each element in arr into a string and apply re to match it.
    // result might include null items if re did not match (usful for masking)
    // Example:
    //   var morphs = $world.withAllSubmorphsDo(function(x) { return x; ;
    //   morphs.mask(morphs.reMatches(/code/i))
    stringifier = stringifier || String
    return arr.map(function(ea) { return stringifier(ea).match(re); });
  },

  // -=-=-=-=-=-
  // accessors
  // -=-=-=-=-=-

  first: function(array) { return array[0]; },

  last: function(array) { return array[array.length - 1]; },

  // -=-=-=-=-=-=-=-
  // Set operations
  // -=-=-=-=-=-=-=-

  intersect: function(array1, array2) {
    // set-like intersection
    return arr.uniq(array1).filter(function(item) {
      return array2.indexOf(item) > -1; });
  },

  union: function(array1, array2) {
    // set-like union
    var result = arr.clone(array1);
    for (var i = 0; i < array2.length; i++) {
      var item = array2[i];
      if (result.indexOf(item) === -1) result.push(item);
    }
    return result;
  },

  pushAt: function(array, item, index) {
    // inserts `item` at `index`, mutating
    array.splice(index, 0, item);
  },

  removeAt: function(array, index) {
    // inserts item at `index`, mutating
    array.splice(index, 1);
  },

  remove: function(array, item) {
    // removes first occurrence of item in `array`, mutating
    var index = array.indexOf(item);
    if (index >= 0) arr.removeAt(array, index);
    return item;
  },

  pushAll: function(array, items) {
    // appends all `items`, mutating
    for (var i = 0; i < items.length; i++)
      array.push(items[i]);
    return array;
  },

  pushAllAt: function(array, items, idx) {
    // inserts all `items` at `idx`, mutating
    array.splice.apply(array, [idx, 0].concat(items))
  },

  pushIfNotIncluded: function(array, item) {
    // only appends `item` if its not already in `array`, mutating
    if (!arr.include(array, item)) array.push(item);
  },

  replaceAt: function(array, item, index) {
    // mutating
    array.splice(index, 1, item); },

  clear: function(array) {
    // removes all items, mutating
    array.length = 0; return array;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-
  // asynchronous iteration
  // -=-=-=-=-=-=-=-=-=-=-=-
  doAndContinue: function(array, iterator, endFunc, context) {
    // Iterates over array but instead of consecutively calling iterator,
    // iterator gets passed in the invocation for the next iteration step
    // as a function as first parameter. This allows to wait arbitrarily
    // between operation steps, great for managing dependencies between tasks.
    // Related is [`fun.composeAsync`]().
    // Example:
    // arr.doAndContinue([1,2,3,4], function(next, n) {
    //   alert("At " + n);
    //   setTimeout(next, 100);
    // }, function() { alert("Done"); })
    // // If the elements are functions you can leave out the iterator:
    // arr.doAndContinue([
    //   function(next) { alert("At " + 1); next(); },
    //   function(next) { alert("At " + 2); next(); }
    // ], null, function() { alert("Done"); });
    endFunc = endFunc || Functions.Null;
    context = context || (typeof window !== 'undefined' ? window : global);
    iterator = iterator || function(next, ea, idx) { ea.call(context, next, idx); };
    return array.reduceRight(function(nextFunc, ea, idx) {
      return function() { iterator.call(context, nextFunc, ea, idx); }
    }, endFunc)();
  },

  nestedDelay: function(array, iterator, waitSecs, endFunc, context, optSynchronChunks) {
    // Calls `iterator` for every element in `array` and waits between iterator
    // calls `waitSecs`. Eventually `endFunc` is called. When passing a number n
    // as `optSynchronChunks`, only every nth iteration is delayed.
    endFunc = endFunc || function() {};
    return array.clone().reverse().reduce(function(nextFunc, ea, idx) {
      return function() {
        iterator.call(context || (typeof window !== 'undefined' ? window : global), ea, idx);
        // only really delay every n'th call optionally
        if (optSynchronChunks && (idx % optSynchronChunks !== 0)) {
          nextFunc()
        } else {
          nextFunc.delay(waitSecs);
        }
      }
    }, endFunc)();
  },

  forEachShowingProgress: function(/*array, progressBar, iterator, labelFunc, whenDoneFunc, context or spec*/) {
    // ignore-in-doc
    var args = Array.from(arguments),
      array = args.shift(),
      steps = array.length,
      progressBar, iterator, labelFunc, whenDoneFunc, context,
      progressBarAdded = false;

    // init args
    if (args.length === 1) {
      progressBar = args[0].progressBar;
      iterator = args[0].iterator;
      labelFunc = args[0].labelFunction;
      whenDoneFunc = args[0].whenDone;
      context = args[0].context;
    } else {
      progressBar = args[0];
      iterator = args[1];
      labelFunc = args[2];
      whenDoneFunc = args[3];
      context = args[4];
    }
    if (!context) context = typeof window !== 'undefined' ? window : global;
    if (!labelFunc) labelFunc = function(x) { return x; };

    // init progressbar
    if (!progressBar) {
      progressBarAdded = true;
      var Global = typeof window !== 'undefined' ? window : global;
      var world = Global.lively && lively.morphic && lively.morphic.World.current();
      progressBar = world ? world.addProgressBar() : {
        setValue: function(val) {},
        setLabel: function() {},
        remove: function() {}
      };
    }
    progressBar.setValue(0);

    // nest functions so that the iterator calls the next after a delay
    (array.reduceRight(function(nextFunc, item, idx) {
      return function() {
        try {
          progressBar.setValue(idx / steps);
          if (labelFunc) progressBar.setLabel(labelFunc.call(context, item, idx));
          iterator.call(context, item, idx);
        } catch (e) {
          console.error(
            'Error in forEachShowingProgress at %s (%s)\n%s\n%s',
            idx, item, e, e.stack);
        }
        nextFunc.delay(0);
      };
    }, function() {
      progressBar.setValue(1);
      if (progressBarAdded) (function() { progressBar.remove(); }).delay(0);
      if (whenDoneFunc) whenDoneFunc.call(context);
    }))();

    return array;
  },

  swap: function(array, index1, index2) {
    // mutating
    // Example:
    // var a = [1,2,3,4];
    // arr.swap(a, 3, 1);
    // a // => [1,4,3,2]
    if (index1 < 0) index1 = array.length + index1;
    if (index2 < 0) index2 = array.length + index2;
    var temp = array[index1];
    array[index1] = array[index2];
    array[index2] = temp;
    return array;
  },

  rotate: function(array, times) {
    // non-mutating
    // Example:
    // arr.rotate([1,2,3]) // => [2,3,1]
    times = times || 1;
    return array.slice(times).concat(array.slice(0,times));
  },

  // -=-=-=-=-
  // grouping
  // -=-=-=-=-

  groupBy: function(array, iterator, context) {
    // Applies `iterator` to each element in `array`, and puts the return value
    // into a collection (the group) associated to it's stringified representation
    // (the "hash").
    // See [`Group.prototype`] for available operations on groups.
    // Example:
    // Example 1: Groups characters by how often they occur in a string:
    // var chars = arr.from("Hello World");
    // arr.groupBy(arr.uniq(chars), function(c) {
    //   return arr.count(chars, c); })
    // // => {
    // //   "1": ["H","e"," ","W","r","d"],
    // //   "2": ["o"],
    // //   "3": ["l"]
    // // }
    // // Example 2: Group numbers by a custom qualifier:
    // arr.groupBy([3,4,1,7,4,3,8,4], function(n) {
    //   if (n <= 3) return "small";
    //   if (n <= 7) return "medium";
    //   return "large";
    // });
    // // => {
    // //   large: [8],
    // //   medium: [4,7,4,4],
    // //   small: [3,1,3]
    // // }
    return Group.fromArray(array, iterator, context);
  },

  groupByKey: function(array, key) {
    // var objects = [{x: }]
    // arr.groupBy(arr.uniq(chars), function(c) {
    //   return arr.count(chars, c); })
    // // => {
    // //   "1": ["H","e"," ","W","r","d"],
    // //   "2": ["o"],
    // //   "3": ["l"]
    // // }
    return arr.groupBy(array, function(ea) { return ea[key]; });
  },

  partition: function(array, iterator, context) {
    // Example:
    // var array = [1,2,3,4,5,6];
    // arr.partition(array, function(ea) { return ea > 3; })
    // // => [[1,2,3,4],[5,6]]
    iterator = iterator || function(x) { return x; };
    var trues = [], falses = [];
    array.forEach(function(value, index) {
      (iterator.call(context, value, index) ? trues : falses).push(value);
    });
    return [trues, falses];
  },

  batchify: function(array, constrainedFunc, context) {
    // Takes elements and fits them into subarrays (= batches) so that for
    // each batch constrainedFunc returns true. Note that contrained func
    // should at least produce 1-length batches, otherwise an error is raised
    // Example:
    // // Assume you have list of things that have different sizes and you want to
    // // create sub-arrays of these things, with each sub-array having if possible
    // // less than a `batchMaxSize` of combined things in it:
    // var sizes = [
    //   Math.pow(2, 15), // 32KB
    //   Math.pow(2, 29), // 512MB
    //   Math.pow(2, 29), // 512MB
    //   Math.pow(2, 27), // 128MB
    //   Math.pow(2, 26), // 64MB
    //   Math.pow(2, 26), // 64MB
    //   Math.pow(2, 24), // 16MB
    //   Math.pow(2, 26)] // 64MB
    // var batchMaxSize = Math.pow(2, 28)/*256MB*/;
    // function batchConstrained(batch) {
    //   return batch.length == 1 || batch.sum() < batchMaxSize;
    // }
    // var batches = sizes.batchify(batchConstrained);
    // batches.pluck('length') // => [4,1,1,2]
    // batches.map(arr.sum).map(num.humanReadableByteSize) // => ["208.03MB","512MB","512MB","128MB"]

    return findBatches([], array);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function extractBatch(batch, sizes) {
      // ignore-in-doc
      // Array -> Array -> Array[Array,Array]
      // case 1: no sizes to distribute, we are done
      if (!sizes.length) return [batch, []];
      var first = sizes[0], rest = sizes.slice(1);
      // if batch is empty we have to take at least one
      // if batch and first still fits, add first
      var candidate = batch.concat([first]);
      if (constrainedFunc.call(context, candidate)) return extractBatch(candidate, rest);
      // otherwise leave first out for now
      var batchAndSizes = extractBatch(batch, rest);
      return [batchAndSizes[0], [first].concat(batchAndSizes[1])];
    }

    function findBatches(batches, sizes) {
      if (!sizes.length) return batches;
      var extracted = extractBatch([], sizes);
      if (!extracted[0].length)
        throw new Error('Batchify constrained does not ensure consumption '
                + 'of at least one item per batch!');
      return findBatches(batches.concat([extracted[0]]), extracted[1]);
    }
  },

  toTuples: function(array, tupleLength) {
    // Creates sub-arrays with length `tupleLength`
    // Example:
    // arr.toTuples(["H","e","l","l","o"," ","W","o","r","l","d"], 4)
    // // => [["H","e","l","l"],["o"," ","W","o"],["r","l","d"]]
    tupleLength = tupleLength || 1;
    return arr.range(0,Math.ceil(array.length/tupleLength)-1).map(function(n) {
      return array.slice(n*tupleLength, n*tupleLength+tupleLength);
    }, array);
  },

  take: function(arr, n) { return arr.slice(0, n); },

  drop: function(arr, n) { return arr.slice(n); },
  
  takeWhile: function(arr, fun, context) {
    var i = 0;;
    for (; i < arr.length; i++)
      if (!fun.call(context, arr[i], i)) break;
    return arr.slice(0, i);
  },

  dropWhile: function(arr, fun, context) {
    var i = 0;;
    for (; i < arr.length; i++)
      if (!fun.call(context, arr[i], i)) break;
    return arr.slice(i);
  },

  // -=-=-=-=-=-
  // randomness
  // -=-=-=-=-=-

  shuffle: function(array) {
    // Ramdomize the order of elements of array. Does not mutate array.
    // Example:
    // arr.shuffle([1,2,3,4,5]) // => [3,1,2,5,4]
    var unusedIndexes = arr.range(0, array.length-1);
    return array.reduce(function(shuffled, ea, i) {
      var shuffledIndex = unusedIndexes.splice(Math.round(Math.random() * (unusedIndexes.length-1)), 1);
      shuffled[shuffledIndex] = ea;
      return shuffled;
    }, Array(array.length));
  },

  // -=-=-=-=-=-=-=-
  // Number related
  // -=-=-=-=-=-=-=-

  max: function(array, iterator, context) {
    // Example:
    //   var array = [{x:3,y:2}, {x:5,y:1}, {x:1,y:5}];
    //   arr.max(array, function(ea) { return ea.x; }) // => {x: 5, y: 1}
    iterator = iterator || function(x) { return x; };
    var result;
    array.reduce(function(max, ea, i) {
      var val = iterator.call(context, ea, i);
      if (typeof val !== "number" || val <= max) return max;
      result = ea; return val;
    }, -Infinity);
    return result;
  },

  min: function(array, iterator, context) {
    // Similar to `arr.max`.
    iterator = iterator || function(x) { return x; };
    return arr.max(array, function(ea, i) {
      return -iterator.call(context, ea, i); });
  },

  sum: function(array) {
    // show-in-doc
    var sum = 0;
    for (var i = 0; i < array.length; i++) sum += array[i];
    return sum;
  },

  count: function(array, item) {
    return array.reduce(function(count, ea) {
      return ea === item ? count + 1 : count; }, 0);
  },

  size: function(array) { return array.length; },

  histogram: function(data, binSpec) {
    // ignore-in-doc
    // Without a `binSpec` argument partition the data
    // var numbers = arr.genN(10, num.random);
    // var numbers = arr.withN(10, "a");
    // => [65,73,34,94,92,31,27,55,95,48]
    // => [[65,73],[34,94],[92,31],[27,55],[95,48]]
    // => [[82,50,16],[25,43,77],[40,64,31],[51,39,13],[17,34,87],[51,33,30]]
    if (typeof binSpec === 'undefined' || typeof binSpec === 'number') {
      var binNumber = binSpec || (function sturge() {
        return Math.ceil(Math.log(data.length) / Math.log(2) + 1);
      })(data);
      var binSize = Math.ceil(Math.round(data.length / binNumber));
      return arr.range(0, binNumber-1).map(function(i) {
        return data.slice(i*binSize, (i+1)*binSize);
      });
    } else if (binSpec instanceof Array) {
      // ignore-in-doc
      // bins specifies n threshold values that will create n-1 bins.
      // Each data value d is placed inside a bin i if:
      // threshold[i] >= d && threshold[i+1] < d
      var thresholds = binSpec;
      return data.reduce(function(bins, d) {
        if (d < thresholds[1]) { bins[0].push(d); return bins; }
        for (var i = 1; i < thresholds.length; i++) {
          if (d >= thresholds[i] && (!thresholds[i+1] || d <= thresholds[i+1])) {
            bins[i].push(d); return bins;
          }
        }
        throw new Error(Strings.format('Histogram creation: Cannot group data %s into thresholds %o', d, thresholds));
      }, arr.range(1,thresholds.length).map(function() { return []; }))
    }
  },

  // -=-=-=-=-
  // Copying
  // -=-=-=-=-

  clone: function(array) {
    // shallow copy
    return [].concat(array);
  },

  // -=-=-=-=-=-
  // conversion
  // -=-=-=-=-=-

  toArray: function(array) { return arr.from(array); },

  // -=-=-=-=-=-
  // DEPRECATED
  // -=-=-=-=-=-

  each: function(arr, iterator, context) {
    return arr.forEach(iterator, context);
  },

  all: function(arr, iterator, context) {
    return arr.every(iterator, context);
  },

  any: function(arr, iterator, context) {
    return arr.some(iterator, context);
  },

  collect: function(arr, iterator, context) {
    return arr.map(iterator, context);
  },

  findAll: function(arr, iterator, context) {
    return arr.filter(iterator, context);
  },

  inject: function(array, memo, iterator, context) {
    if (context) iterator = iterator.bind(context);
    return array.reduce(iterator, memo);
  },

  // asynch methods
  mapAsyncSeries: function(array, iterator, callback) {
    // Apply `iterator` over `array`. Unlike `mapAsync` the invocation of
    // the iterator happens step by step in the order of the items of the array
    // and not concurrently.

    // ignore-in-doc
    // Could simply be:
    // return exports.arr.mapAsync(array, {parallel: 1}, iterator, callback);
    // but the version below is 2x faster

    var result = [], callbackTriggered = false;
    return array.reduceRight(function(nextFunc, ea, idx) {
      if (callbackTriggered) return;
      return function(err, eaResult) {
        if (err) return maybeDone(err);
        if (idx > 0) result.push(eaResult);
        try {
          iterator(ea, idx, exports.fun.once(nextFunc));
        } catch (e) { maybeDone(e); }
      }
    }, function(err, eaResult) {
      result.push(eaResult);
      maybeDone(err, true);
    })();

    function maybeDone(err, finalCall) {
      if (callbackTriggered || (!err && !finalCall)) return;
      callbackTriggered = true;
      try { callback(err, result); } catch (e) {
        console.error("Error in mapAsyncSeries - callback invocation error:\n" + (e.stack || e));
      }
    }
  },

  mapAsync: function(array, options, iterator, callback) {
    // Apply `iterator` over `array`. In each iterator gets a callback as third
    // argument that should be called when the iteration is done. After all
    // iterators have called their callbacks, the main `callback` function is
    // invoked with the result array.
    // Example:
    // lively.lang.arr.mapAsync([1,2,3,4],
    //   function(n, i, next) { setTimeout(function() { next(null, n + i); }, 20); },
    //   function(err, result) { /* result => [1,3,5,7] */ });

    if (typeof options === "function") {
      callback = iterator;
      iterator = options;
      options = null;
    }
    options = options || {};
    
    if (!array.length) return callback && callback(null, []);
    
    if (!options.parallel) options.parallel = Infinity;

    var results = [], completed = [],
        callbackTriggered = false,
        lastIteratorIndex = 0,
        nActive = 0;

    var iterators = array.map(function(item, i) {
      return function() {
        nActive++;
        try {
          iterator(item, i, exports.fun.once(function(err, result) {
            results[i] = err || result;
            maybeDone(i, err);
          }));
        } catch (e) { maybeDone(i, e); }
      }
    });

    return activate();

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function activate() {
      while (nActive < options.parallel && lastIteratorIndex < array.length)
        iterators[lastIteratorIndex++]();
    }

    function maybeDone(idx, err) {
      if (completed.indexOf(idx) > -1) return;
      completed.push(idx);
      nActive--;
      if (callbackTriggered) return;
      if (!err && completed.length < array.length) { activate(); return; }
      callbackTriggered = true;
      try { callback && callback(err, results); } catch (e) {
        console.error("Error in mapAsync - main callback invocation error:\n" + (e.stack || e));
      }
    }
  },
}

// show-in-doc
// A Grouping is created by arr.groupBy and maps keys to Arrays.
var Group = exports.Group = function Group() {}

Group.by = exports.arr.groupBy;

Group.fromArray = function(array, hashFunc, context) {
  // Example:
  // Group.fromArray([1,2,3,4,5,6], function(n) { return n % 2; })
  // // => {"0": [2,4,6], "1": [1,3,5]}
  var grouping = new Group();
  for (var i = 0, len = array.length; i < len; i++) {
    var hash = hashFunc.call(context, array[i], i);
    if (!grouping[hash]) grouping[hash] = [];
    grouping[hash].push(array[i]);
  }
  return grouping;
}

Group.prototype.toArray = function() {
  // Example:
  // var group = arr.groupBy([1,2,3,4,5], function(n) { return n % 2; })
  // group.toArray(); // => [[2,4],[1,3,5]]
  return this.reduceGroups(function(all, _, group) {
    return all.concat([group]); }, []);
}

Group.prototype.forEach = function(iterator, context) {
  // Iteration for each item in each group, called like `iterator(groupKey, groupItem)`
  var groups = this;
  Object.keys(groups).forEach(function(groupName) {
    groups[groupName].forEach(iterator.bind(context, groupName));
  });
  return groups;
}

Group.prototype.forEachGroup = function(iterator, context) {
  // Iteration for each group, called like `iterator(groupKey, group)`
  var groups = this;
  Object.keys(groups).forEach(function(groupName) {
    iterator.call(context, groupName, groups[groupName]);
  });
  return groups;
}

Group.prototype.map = function(iterator, context) {
  // Map for each item in each group, called like `iterator(groupKey, group)`
  var result = new Group();
  this.forEachGroup(function(groupName, group) {
    result[groupName] = group.map(iterator.bind(context, groupName));
  });
  return result;
}

Group.prototype.mapGroups = function(iterator, context) {
  // Map for each group, called like `iterator(groupKey, group)`
  var result = new Group();
  this.forEachGroup(function(groupName, group) {
    result[groupName] = iterator.call(context, groupName, group);
  });
  return result;
}

Group.prototype.keys = function() {
  // show-in-docs
  return Object.keys(this);
}

Group.prototype.reduceGroups = function(iterator, carryOver, context) {
  // Reduce/fold for each group, called like `iterator(carryOver, groupKey, group)`
  this.forEachGroup(function(groupName, group) {
    carryOver = iterator.call(context, carryOver, groupName, group); });
  return carryOver;
}

Group.prototype.count = function() {
  // counts the elements of each group
  return this.reduceGroups(function(groupCount, groupName, group) {
    groupCount[groupName] = group.length;
    return groupCount;
  }, {});
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// A grid is a two-dimaensional array, representing a table-like data
var grid = exports.grid = {

  get: function(grid, nRow, nCol) {
    var row = grid[nRow];
    return row ? row[nCol] : undefined;
  },

  set: function(grid, nRow, nCol, obj) {
    var row = grid[nRow];
    if (row) row[nCol] = obj;
    return obj;
  },

  getRow: function(grid, nRow) {
    return grid[nRow];
  },

  setRow: function(grid, nRow, newRow) {
    return grid[nRow] = newRow;
  },


  getCol: function(grid, nCol) {
    return grid.reduce(function(col, row) {
      col.push(row[nCol]); return col; }, []);
  },

  setCol: function(grid, nCol, newCol) {
    return grid.map(function(row, i) {
      return row[nCol] ? row[nCol] = newCol[i] : undefined;
    });
  },

  create: function(rows, columns, initialObj) {
    // Example:
    // grid.create(3, 2, "empty")
    // // => [["empty","empty"],
    // //     ["empty","empty"],
    // //     ["empty","empty"]]
    var result = new Array(rows);
    while (rows > 0) result[--rows] = arr.withN(columns, initialObj);
    return result;
  },

  mapCreate: function(rows, cols, func, context) {
    // like `grid.create` but takes generator function for cells
    var result = new Array(rows);
    for (var i = 0; i < rows; i++) {
      result[i] = new Array(cols);
      for (var j = 0; j < cols; j ++) {
        result[i][j] = func.call(context || this, i, j);
      }
    }
    return result;
  },

  forEach: function(grid, func, context) {
    // iterate, `func` is called as `func(cellValue, i, j)`
    grid.forEach(function(row, i) {
      row.forEach(function(val, j) {
        func.call(context || this, val, i, j);
      });
    })
  },

  map: function(grid, func, context) {
    // map, `func` is called as `func(cellValue, i, j)`
    var result = new Array(grid.length);
    grid.forEach(function(row, i) {
      result[i] = new Array(row.length);
      row.forEach(function(val, j) {
        result[i][j] = func.call(context || this, val, i, j);
      });
    });
    return result;
  },

  toObjects: function(grid) {
    // The first row of the grid defines the propNames
    // for each following row create a new object with those porperties
    // mapped to the cells of the row as values
    // Example:
    // grid.toObjects([['a', 'b'],[1,2],[3,4]])
    // // => [{a:1,b:2},{a:3,b:4}]
    var props = grid[0], objects = new Array(grid.length-1);
    for (var i = 1; i < grid.length; i++) {
      var obj = objects[i-1] = {};
      for (var j = 0; j < props.length; j++) obj[props[j]] = grid[i][j];
    }
    return objects;
  },

  tableFromObjects: function(objects, valueForUndefined) {
    // Reverse operation to `grid.toObjects`. Useful for example to convert objectified
    // SQL result sets into tables that can be printed via Strings.printTable.
    // Objects are key/values like [{x:1,y:2},{x:3},{z:4}]. Keys are interpreted as
    // column names and objects as rows.
    // Example:
    // grid.tableFromObjects([{x:1,y:2},{x:3},{z:4}])
    // // => [["x","y","z"],
    // //    [1,2,null],
    // //    [3,null,null],
    // //    [null,null,4]]

    if (!Array.isArray(objects)) objects = [objects];
    var table = [[]], columns = table[0],
      rows = objects.reduce(function(rows, ea) {
        return rows.concat([Object.keys(ea).reduce(function(row, col) {
          var colIdx = columns.indexOf(col);
          if (colIdx === -1) { colIdx = columns.length; columns.push(col); }
          row[colIdx] = ea[col];
          return row;
        }, [])]);
      }, []);
    valueForUndefined = arguments.length === 1 ? null : valueForUndefined;
    rows.forEach(function(row) {
      // fill cells with no value with null
      for (var i = 0; i < columns.length; i++)
        if (!row[i]) row[i] = valueForUndefined;
    });
    return table.concat(rows);
  },

  benchmark: function() {
    // ignore-in-doc
    var results = [], t;

    var g = grid.create(1000, 200, 1),
        addNum = 0;
        t = lively.lang.fun.timeToRunN(function() {
    grid.forEach(g, function(n) { addNum += n; }) }, 10);
    results.push(exports.string.format('grid.forEach: %ims', t));

    var mapResult;
    t  = Functions.timeToRunN(function() {
      mapResult = grid.map(grid, function(n, i, j) {
        return i+j + Math.round(Math.random() * 100); });
    }, 10);
    results.push(exports.string.format('grid.map: %ims', t));

    var mapResult2 = grid.create(1000, 2000);
    t  = Functions.timeToRunN(function() {
      mapResult2 = new Array(1000);
      for (var i = 0; i < 1000; i++) mapResult2[i] = new Array(2000);
      grid.forEach(g, function(n, i, j) { mapResult2[i][j] = i+j + Math.round(Math.random() * 100); });
    }, 10);

    results.push('grid.map with forEach: ' + t + 'ms');

    results.push('--= 2012-09-22 =--\n'
          + "grid.forEach: 14.9ms\n"
          + "grid.map: 19.8ms\n"
          + "grid.map with forEach: 38.7ms\n");
    return results.join('\n');
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// Intervals are arrays whose first two elements are numbers and the
// first element should be less or equal the second element, see
// [`interval.isInterval`](). This abstraction is useful when working with text
// ranges in rich text, for example.
var interval = exports.interval = {

  isInterval: function(object) {
    // Example:
    // interval.isInterval([1,12]) // => true
    // interval.isInterval([1,12, {property: 23}]) // => true
    // interval.isInterval([1]) // => false
    // interval.isInterval([12, 1]) // => false
    return Array.isArray(object)
        && object.length >= 2
        && object[0] <= object[1];
  },

  sort: function(intervals) {
    // Sorts intervals according to rules defined in [`interval.compare`]().
    return intervals.sort(interval.compare);
  },

  compare: function(a, b) {
    // How [`interval.sort`]() compares.
    // We assume that `a[0] <= a[1] and b[0] <= b[1]` according to `isInterval`
    // ```
    // -3: a < b and non-overlapping, e.g [1,2] and [3,4]
    // -2: a < b and intervals border at each other, e.g [1,3] and [3,4]
    // -1: a < b and overlapping, e.g, [1,3] and [2,4] or [1,3] and [1,4]
    //  0: a = b, e.g. [1,2] and [1,2]
    //  1: a > b and overlapping, e.g. [2,4] and [1,3]
    //  2: a > b and share border, e.g [1,4] and [0,1]
    //  3: a > b and non-overlapping, e.g [2,4] and [0,1]
    // ```
    if (a[0] < b[0]) { // -3 || -2 || -1
      if (a[1] < b[0]) return -3;
      if (a[1] === b[0]) return -2;
      return -1;
    }
    if (a[0] === b[0]) { // -1 || 0 || 1
      if (a[1] === b[1]) return 0;
      return a[1] < b[1] ? -1 : 1;
    }
    // we know a[0] > b[0], 1 || 2 || 3
    return -1 * interval.compare(b, a);
  },

  coalesce: function(interval1, interval2, optMergeCallback) {
    // Turns two interval into one iff compare(interval1, interval2) ∈ [-2,
    // -1,0,1, 2] (see [`inerval.compare`]()).
    // Otherwise returns null. Optionally uses merge function.
    // Examples:
    //   interval.coalesce([1,4], [5,7]) // => null
    //   interval.coalesce([1,2], [1,2]) // => [1,2]
    //   interval.coalesce([1,4], [3,6]) // => [1,6]
    //   interval.coalesce([3,6], [4,5]) // => [3,6]
    var cmpResult = this.compare(interval1, interval2);
    switch (cmpResult) {
      case -3:
      case  3: return null;
      case  0:
        optMergeCallback && optMergeCallback(interval1, interval2, interval1);
        return interval1;
      case  2:
      case  1: var temp = interval1; interval1 = interval2; interval2 = temp; // swap
      case -2:
      case -1:
        var coalesced = [interval1[0], Math.max(interval1[1], interval2[1])];
        optMergeCallback && optMergeCallback(interval1, interval2, coalesced);
        return coalesced;
      default: throw new Error("Interval compare failed");
    }
  },

  coalesceOverlapping: function(intervals, mergeFunc) {
    // Like `coalesce` but accepts an array of intervals.
    // Example:
    //   interval.coalesceOverlapping([[9,10], [1,8], [3, 7], [15, 20], [14, 21]])
    //   // => [[1,8],[9,10],[14,21]]
    var condensed = [], len = intervals.length;
    while (len > 0) {
      var ival = intervals.shift(); len--;
      for (var i = 0; i < len; i++) {
        var otherInterval = intervals[i],
            coalesced = interval.coalesce(ival, otherInterval, mergeFunc);
        if (coalesced) {
          ival = coalesced;
          intervals.splice(i, 1);
          len--; i--;
        }
      }
      condensed.push(ival);
    }
    return this.sort(condensed);
  },

  mergeOverlapping: function(intervalsA, intervalsB, mergeFunc) {
    var result = [];
    while (intervalsA.length > 0) {
      var intervalA = intervalsA.shift();

      var toMerge = intervalsB.map(function(intervalB) {
        var cmp = interval.compare(intervalA, intervalB);
        return cmp === -1 || cmp === 0 || cmp === 1;
      });

      result.push(mergeFunc(intervalA, toMerge[0]))

      result.push(intervalA);

    }
    return result;
  },

  intervalsInRangeDo: function(start, end, intervals, iterator, mergeFunc, context) {
      // Merges and iterates through sorted intervals. Will "fill up"
      // intervals. This is currently used for computing text chunks in
      // lively.morphic.TextCore.
      // Example:
      // interval.intervalsInRangeDo(
      //   2, 10, [[0, 1], [5,8], [2,4]],
      //   function(i, isNew) { i.push(isNew); return i; })
      // // => [[2,4,false],[4,5,true],[5,8,false],[8,10,true]]

    context = context || (typeof window !== 'undefined' ? window : global);
    // need to be sorted for the algorithm below
    intervals = this.sort(intervals);
    var free = [], nextInterval, collected = [];
    // merged intervals are already sorted, simply "negate" the interval array;
    while ((nextInterval = intervals.shift())) {
      if (nextInterval[1] < start) continue;
      if (nextInterval[0] < start) {
        nextInterval = Array.prototype.slice.call(nextInterval);
        nextInterval[0] = start;
      };
      var nextStart = end < nextInterval[0] ? end : nextInterval[0];
      if (start < nextStart) {
        collected.push(iterator.call(context, [start, nextStart], true));
      };
      if (end < nextInterval[1]) {
        nextInterval = Array.prototype.slice.call(nextInterval);
        nextInterval[1] = end;
      }
      // special case, the newly constructed interval has length 0,
      // happens when intervals contains doubles at the start
      if (nextInterval[0] === nextInterval[1]) {
        var prevInterval;
        if (mergeFunc && (prevInterval = collected.slice(-1)[0])) {
          // arguments: a, b, merged, like in the callback of #merge
          mergeFunc.call(context, prevInterval, nextInterval, prevInterval);
        }
      } else {
        collected.push(iterator.call(context, nextInterval, false));
      }
      start = nextInterval[1];
      if (start >= end) break;
    }
    if (start < end) collected.push(iterator.call(context, [start, end], true));
    return collected;
  },

  intervalsInbetween: function(start, end, intervals) {
    // Computes "free" intervals between the intervals given in range start - end
    // currently used for computing text chunks in lively.morphic.TextCore
    // Example:
    // interval.intervalsInbetween(0, 10,[[1,4], [5,8]])
    // // => [[0,1],[4,5],[8,10]]
    return interval
      .intervalsInRangeDo(start, end,
        interval.coalesceOverlapping(Array.prototype.slice.call(intervals)),
        function(interval, isNew) { return isNew ? interval : null })
      .filter(function(ea) { return !!ea });
  },

  mapToMatchingIndexes:  function(intervals, intervalsToFind) {
    // Returns an array of indexes of the items in intervals that match
    // items in `intervalsToFind`.
    // Note: We expect intervals and intervals to be sorted according to [`interval.compare`]()!
    // This is the optimized version of:
    // ```
    // return intervalsToFind.collect(function findOne(toFind) {
    //    var startIdx, endIdx;
    //    var start = intervals.detect(function(ea, i) {
    //       startIdx = i; return ea[0] === toFind[0]; });
    //    if (start === undefined) return [];
    //    var end = intervals.detect(function(ea, i) {
    //       endIdx = i; return ea[1] === toFind[1]; });
    //    if (end === undefined) return [];
    //    return Array.range(startIdx, endIdx);
    // });
    // ```

    var startIntervalIndex = 0, endIntervalIndex, currentInterval;
    return intervalsToFind.map(function(toFind) {
      while ((currentInterval = intervals[startIntervalIndex])) {
        if (currentInterval[0] < toFind[0]) { startIntervalIndex++; continue };
        break;
      }
      if (currentInterval && currentInterval[0] === toFind[0]) {
        endIntervalIndex = startIntervalIndex;
        while ((currentInterval = intervals[endIntervalIndex])) {
          if (currentInterval[1] < toFind[1]) { endIntervalIndex++; continue };
          break;
        }
        if (currentInterval && currentInterval[1] === toFind[1]) {
          return arr.range(startIntervalIndex, endIntervalIndex);
        }
      }
      return [];
    });
  },

  benchmark: function() {
    // ignore-in-doc
    // Used for developing the code above. If you change the code, please
    // make sure that you don't worsen the performance!
    // See also lively.lang.tests.ExtensionTests.IntervallTest
    function benchmarkFunc(name, args, n) {
      return Strings.format(
        '%s: %sms',
        name,
        Functions.timeToRunN(function() { interval[name].apply(interval, args, 100000) }, n));
    }
    return [
      "Friday, 20. July 2012:",
      "coalesceOverlapping: 0.0003ms",
      "intervalsInbetween: 0.002ms",
      "mapToMatchingIndexes: 0.02ms",
      'vs.\n' + new Date() + ":",
      benchmarkFunc("coalesceOverlapping", [[[9,10], [1,8], [3, 7], [15, 20], [14, 21]]], 100000),
      benchmarkFunc("intervalsInbetween", [0, 10, [[8, 10], [0, 2], [3, 5]]], 100000),
      benchmarkFunc("mapToMatchingIndexes", [Array.range(0, 1000).collect(function(n) { return [n, n+1] }), [[4,8], [500,504], [900,1004]]], 1000)
    ].join('\n');
  }
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

// show-in-doc
// Accessor to sub-ranges of arrays. This is used, for example, for rendering
// large lists or tables in which only a part of the items should be used for
// processing or rendering. An array projection provides convenient access and
// can apply operations to sub-ranges.
var arrayProjection = exports.arrayProjection = {

  create: function(array, length, optStartIndex) {
    // Example:
    // arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 1)
    // // => { array: [/*...*/], from: 1, to: 5 }
    var startIndex = optStartIndex || 0
    if (startIndex + length > array.length)
      startIndex -= startIndex + length - array.length;
    return {array: array, from: startIndex, to: startIndex+length}
  },

  toArray: function(projection) {
    // show-in-doc
    return projection.array.slice(projection.from, projection.to);
  },

  originalToProjectedIndex: function(projection, index) {
    // Maps index from original Array to projection.
    // Example:
    //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
    //   arrayProjection.originalToProjectedIndex(proj, 1) // => null
    //   arrayProjection.originalToProjectedIndex(proj, 3) // => 0
    //   arrayProjection.originalToProjectedIndex(proj, 5) // => 2
    if (index < projection.from || index >= projection.to) return null;
    return index - projection.from;
  },

  projectedToOriginalIndex: function(projection, index) {
    // Inverse to `originalToProjectedIndex`.
    // Example:
    //   var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
    //   arrayProjection.projectedToOriginalIndex(proj, 1) // => 4
    if (index < 0  || index > projection.to - projection.from) return null;
    return projection.from + index;
  },

  transformToIncludeIndex: function(projection, index) {
    // Computes how the projection needs to shift minimally (think "scroll"
    // down or up) so that index becomes "visible" in projection.
    // Example:
    // var proj = arrayProjection.create([1,2,3,4,5,6,7,8,9], 4, 3);
    // arrayProjection.transformToIncludeIndex(proj, 1)
    // // => { array: [/*...*/], from: 1, to: 5 }
    if (!(index in projection.array)) return null;
    var delta = 0;
    if (index < projection.from) delta = -projection.from+index;
    if (index >= projection.to) delta = index-projection.to+1;
    if (delta === 0) return projection;
    return arrayProjection.create(
      projection.array,
      projection.to-projection.from,
      projection.from+delta);
  }
}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;
/*
 * Methods for traversing and transforming tree structures.
 */
;(function(exports) {
"use strict";

var tree = exports.tree = {

  prewalk: function(treeNode, iterator, childGetter) {
    iterator(treeNode);
    (childGetter(treeNode) || []).forEach(function(ea) {
      tree.prewalk(ea, iterator, childGetter); });
  },

  postwalk: function(treeNode, iterator, childGetter) {
    (childGetter(treeNode) || []).forEach(function(ea) {
      tree.postwalk(ea, iterator, childGetter); });
    iterator(treeNode);
  },

  detect: function(treeNode, testFunc, childGetter) {
    // Traverses a `treeNode` recursively and returns the first node for which
    // `testFunc` returns true. `childGetter` is a function to retrieve the
    // children from a node.
    if (testFunc(treeNode)) return treeNode;
    var found;
    exports.arr.detect(childGetter(treeNode) || [],
      function(ea) { return found = tree.detect(ea, testFunc, childGetter); });
    return found;
  },

  filter: function(treeNode, testFunc, childGetter) {
    // Traverses a `treeNode` recursively and returns all nodes for which
    // `testFunc` returns true. `childGetter` is a function to retrieve the
    // children from a node.
    var result = [];
    if (testFunc(treeNode)) result.push(treeNode);
    return result.concat(
      exports.arr.flatten((childGetter(treeNode) || []).map(function(n) {
        return tree.filter(n, testFunc, childGetter); })));
  },

  map: function(treeNode, mapFunc, childGetter) {
    // Traverses a `treeNode` recursively and call `mapFunc` on each node. The
    // return values of all mapFunc calls is the result. `childGetter` is a
    // function to retrieve the children from a node.
    var result = [mapFunc(treeNode)];
    return result.concat(
      exports.arr.flatten((childGetter(treeNode) || []).map(function(n) {
        return tree.map(n, mapFunc, childGetter); })));
  },

  
  mapTree: function(treeNode, mapFunc, childGetter) {
    // Traverses the tree and creates a structurally identical tree but with
    // mapped nodes
    var mappedNodes = (childGetter(treeNode) || []).map(function(n) {
      return tree.mapTree(n, mapFunc, childGetter);
    })
    return mapFunc(treeNode, mappedNodes);
  },
}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global*/

/*
Computation over graphs. Unless otherwise specified a graph is a simple JS
object whose properties are interpreted as nodes that refer to arrays whose
elements describe edges. Example:

```js
var testGraph = {
  "a": ["b", "c"],
  "b": ["c", "d", "e", "f"],
  "d": ["c", "f"],
  "e": ["a", "f"],
  "f": []
}
```
*/

;(function(exports) {
"use strict";

var obj = exports.obj;
var arr = exports.arr;

// show-in-doc
var graph = exports.graph = {

  clone: function(graph) {
    // return a copy of graph map
    var cloned = {};
    for (var id in graph)
      cloned[id] = graph[id].slice();
    return cloned;
  },

  without: function(graph, ids) {
    // return a copy of graph map with ids removed
    var cloned = {};
    for (var id in graph) {
      if (ids.indexOf(id) > -1) continue;
      cloned[id] = graph[id].filter(function(id) {
        return ids.indexOf(id) === -1; });
    }
    return cloned;
  },

  hull: function(graphMap, id, ignore, maxDepth) {
    // Takes a graph in object format and a start id and then traverses the
    // graph and gathers all nodes that can be reached from that start id.
    // Returns a list of those nodes.
    // Optionally use `ignore` list to filter out certain nodes that shouldn't
    // be considered and maxDepth to stop early. By default a maxDepth of 20 is
    // used.
    // Example:
    // var testGraph = {
    // "a": ["b", "c"],
    // "b": ["c", "d", "e", "f"],
    // "d": ["c", "f"],
    // "e": ["a", "f"],
    // "f": []
    // }
    // graph.hull(testGraph, "d") // => ["c", "f"]
    // graph.hull(testGraph, "e") // => ['a', 'f', 'b', 'c', 'd', 'e']
    // graph.hull(testGraph, "e", ["b"]) // =? ["a", "f", "c"]
    return arr.uniq(
            arr.flatten(
              obj.values(
                graph.subgraphReachableBy(
                  graphMap, id, ignore, maxDepth))))
  },

  subgraphReachableBy: function(graphMap, id, ignore, maxDepth) {
    // show-in-doc
    // Like hull but returns subgraph map of `graphMap`
    // Example:
    // graph.subgraphReachableBy(testGraph, "e", [], 2);
    // // => {e: [ 'a', 'f' ], a: [ 'b', 'c' ], f: []}
    maxDepth = maxDepth || 10;
    if (ignore) graphMap = graph.without(graphMap, ignore);
    var ids = [id], step = 0, subgraph = {};
    while (ids.length && step++ < maxDepth) {
      ids = ids.reduce(function(ids, id) {
        return subgraph[id] ?
          ids : ids.concat(subgraph[id] = graphMap[id] || []);
      }, []);
    }
    return subgraph;
  }
};

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global clearTimeout, setTimeout*/

/*
 * Abstractions around first class functions like augmenting and inspecting
 * functions as well as to control function calls like dealing with asynchronous
 * control flows.
 */

;(function(exports) {
"use strict";

// show-in-doc
var fun = exports.fun = {

  // -=-=-=-=-=-=-=-=-
  // static functions
  // -=-=-=-=-=-=-=-=-

  get Empty() { /*`function() {}`*/ return function() {}; },
  get K() { /*`function(arg) { return arg; }`*/ return function(arg) { return arg; }; },
  get Null() { /*`function() { return null; }`*/ return function() { return null; }; },
  get False() { /*`function() { return false; }`*/ return function() { return false; }; },
  get True() { /*`function() { return true; }`*/ return function() { return true; }; },
  get notYetImplemented() { return function() { throw new Error('Not yet implemented'); }; },

  // -=-=-=-=-=-
  // accessing
  // -=-=-=-=-=-
  all: function(object) {
    // Returns all property names of `object` that reference a function.
    // Example:
    // var obj = {foo: 23, bar: function() { return 42; }};
    // fun.all(obj) // => ["bar"]
    var a = [];
    for (var name in object) {
      if (!object.__lookupGetter__(name)
       && typeof object[name] === 'function') a.push(name);
    }
    return a;
  },

  own: function(object) {
    // Returns all local (non-prototype) property names of `object` that
    // reference a function.
    // Example:
    // var obj1 = {foo: 23, bar: function() { return 42; }};
    // var obj2 = {baz: function() { return 43; }};
    // obj2.__proto__ = obj1
    // fun.own(obj2) // => ["baz"]
    // /*vs.*/ fun.all(obj2) // => ["baz","bar"]
    var a = [];
    for (var name in object) {
      if (!object.__lookupGetter__(name)
       && object.hasOwnProperty(name)
       && typeof object[name] === 'function') a.push(name);
    }
    return a;
  },

  // -=-=-=-=-=-
  // inspection
  // -=-=-=-=-=-

  argumentNames: function(f) {
    // Example:
    // fun.argumentNames(function(arg1, arg2) {}) // => ["arg1","arg2"]
    // fun.argumentNames(function(/*var args*/) {}) // => []
    if (f.superclass) return []; // it's a class...
    var headerMatch = f.toString().match(/^[\s\(]*function[^(]*\(([^)]*)\)/);
    if (!headerMatch || !headerMatch[1]) return [];
    var names = headerMatch[1]
      .replace(/\/\/.*?[\r\n]|\/\*(?:.|[\r\n])*?\*\//g, '')
      .replace(/\s+/g, '').split(',');
    return names.length == 1 && !names[0] ? [] : names;
  },

  qualifiedMethodName: function(f) {
    // ignore-in-doc
    var objString = "";
    if (f.declaredClass) {
      objString += f.declaredClass + '>>';
    } else if (f.declaredObject) {
      objString += f.declaredObject + '.';
    }
    return objString + (f.methodName || f.displayName || f.name || "anonymous");
  },

  extractBody: function(func) {
    // Returns the body of func as string, removing outer function code and
    // superflous indent. Useful when you have to stringify code but not want
    // to construct strings by hand.
    // Example:
    // fun.extractBody(function(arg) {
    //   var x = 34;
    //   alert(2 + arg);
    // }) => "var x = 34;\nalert(2 + arg);"
    var codeString = String(func)
        .replace(/^function[^\{]+\{\s*/, '')
        .replace(/\}$/, '')
        .trim();
    var indent = codeString.split(/\n|\r/)
        .map(function(line) { var m = line.match(/^\s*/); return m && m[0]; })
        .filter(function(ea) { return !!ea; })
        .reduce(function(indent, ea) { return ea.length < indent.length ? ea : indent; });
    return codeString.replace(new RegExp("^" + indent, 'gm'), '');
  },

  // -=-=-=-
  // timing
  // -=-=-=-

  timeToRun: function(func) {
    // returns synchronous runtime of calling `func` in ms
    // Example:
    // fun.timeToRun(function() { new WebResource("http://google.de").beSync().get() });
    // // => 278 (or something else...)
    var startTime = Date.now();
    func();
    return Date.now() - startTime;
  },

  timeToRunN: function(func, n) {
    // Like `timeToRun` but calls function `n` times instead of once. Returns
    // the average runtime of a call in ms.
    var startTime = Date.now();
    for (var i = 0; i < n; i++) func();
    return (Date.now() - startTime) / n;
  },

  delay: function(func, timeout/*, arg1...argN*/) {
    // Delays calling `func` for `timeout` seconds(!).
    // Example:
    // (function() { alert("Run in the future!"); }).delay(1);
    var args = Array.prototype.slice.call(arguments),
        __method = args.shift(),
        timeout = args.shift() * 1000;
    return setTimeout(function delayed() {
      return __method.apply(__method, args);
    }, timeout);
  },

  // these last two methods are Underscore.js 1.3.3 and are slightly adapted
  // Underscore.js license:
  // (c) 2009-2012 Jeremy Ashkenas, DocumentCloud Inc.
  // Underscore is distributed under the MIT license.

  throttle: function(func, wait) {
    // Exec func at most once every wait ms even when called more often
    // useful to calm down eagerly running updaters and such.
    // Example:
    // var i = 0;
    // var throttled = fun.throttle(function() { alert(++i + '-' + Date.now()) }, 500);
    // Array.range(0,100).forEach(function(n) { throttled() });
    var context, args, timeout, throttling, more, result,
        whenDone = fun.debounce(wait, function() { more = throttling = false; });
    return function() {
      context = this; args = arguments;
      var later = function() {
        timeout = null;
        if (more) func.apply(context, args);
        whenDone();
      };
      if (!timeout) timeout = setTimeout(later, wait);
      if (throttling) {
        more = true;
      } else {
        result = func.apply(context, args);
      }
      whenDone();
      throttling = true;
      return result;
    };
  },

  debounce: function(wait, func, immediate) {
    // Call `func` after `wait` milliseconds elapsed since the last invocation.
    // Unlike `throttle` an invocation will restart the wait period. This is
    // useful if you have a stream of events that you want to wait for to finish
    // and run a subsequent function afterwards. When you pass arguments to the
    // debounced functions then the arguments from the last call will be use for
    // the invocation.
    //
    // With `immediate` set to true, immediately call `func` but when called again during `wait` before
    // wait ms are done nothing happens. E.g. to not exec a user invoked
    // action twice accidentally.
    // Example:
    // var start = Date.now();
    // var f = fun.debounce(200, function(arg1) {
    //   alert("running after " + (Date.now()-start) + "ms with arg " + arg1);
    // });
    // f("call1");
    // fun.delay(f.curry("call2"), 0.1);
    // fun.delay(f.curry("call3"), 0.15);
    // // => Will eventually output: "running after 352ms with arg call3"
    var timeout;
    return function() {
      var context = this, args = arguments;
      var later = function() {
        timeout = null;
        if (!immediate) func.apply(context, args);
      };
      if (immediate && !timeout) func.apply(context, args);
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  throttleNamed: function(name, wait, func) {
    // Like `throttle` but remembers the throttled function once created and
    // repeated calls to `throttleNamed` with the identical name will use the same
    // throttled function. This allows to throttle functions in a central place
    // that might be called various times in different contexts without having to
    // manually store the throttled function.
    var store = fun._throttledByName || (fun._throttledByName = {});
    if (store[name]) return store[name];
    function throttleNamedWrapper() {
      // ignore-in-doc, cleaning up
      fun.debounceNamed(name, wait, function() { delete store[name]; })();
      func.apply(this, arguments);
    }
    return store[name] = fun.throttle(throttleNamedWrapper, wait);
  },

  debounceNamed: function(name, wait, func, immediate) {
    // Like `debounce` but remembers the debounced function once created and
    // repeated calls to `debounceNamed` with the identical name will use the same
    // debounced function. This allows to debounce functions in a central place
    // that might be called various times in different contexts without having to
    // manually store the debounced function.
    var store = fun._debouncedByName || (fun._debouncedByName = {});
    if (store[name]) return store[name];
    function debounceNamedWrapper() {
      // ignore-in-doc, cleaning up
      delete store[name];
      func.apply(this, arguments);
    }
    return store[name] = fun.debounce(wait, debounceNamedWrapper, immediate);
  },

  createQueue: function(id, workerFunc) {
    // A simple queue with an attached asynchronous `workerFunc` to process
    // queued tasks. Calling `createQueue` will return an object with the
    // following interface:
    // ```js
    // {
    //   push: function(task) {/**/},
    //   pushAll: function(tasks) {/**/},
    //   handleError: function(err) {}, // Overwrite to handle errors
    //   dran: function() {}, // Overwrite to react when the queue empties
    // }
    // Example:
    // var sum = 0;
    // var q = fun.createQueue("example-queue", function(arg, thenDo) { sum += arg; thenDo(); });
    // q.pushAll([1,2,3]);
    // queues will be remembered by their name
    // fun.createQueue("example-queue").push(4);
    // sum // => 6

    var store = fun._queues || (fun._queues = {});

    var queue = store[id] || (store[id] = {
        _workerActive: false,
        worker: workerFunc, tasks: [],
        drain: null, // can be overwritten by a function
        push: function(task) {
          queue.tasks.push(task);
          queue.activateWorker();
        },
        pushAll: function(tasks) {
          tasks.forEach(function(ea) { queue.tasks.push(ea); });
          queue.activateWorker();
        },
        pushNoActivate: function(task) {
          queue.tasks.push(task);
        },
        handleError: function(err) {
          // can be overwritten
          err && console.error('Error in queue: ' + err);
        },
        activateWorker: function() {
          function callback(err) { queue.handleError(err); queue.activateWorker(); }
          var tasks = queue.tasks, active = queue._workerActive;
          if (tasks.length === 0) {
            if (active) {
              queue._workerActive = false;
              if (typeof queue.drain === 'function') queue.drain();
            }
            delete store[id];
          } else {
            if (!active) queue._workerActive = true;
            try {
              queue.worker(tasks.shift(), callback);
            } catch(err) { callback(err); }
          }
        }
    });

    return queue;
  },

  workerWithCallbackQueue: function(id, workerFunc, optTimeout) {
    // This functions helps when you have a long running computation that
    // multiple call sites (independent from each other) depend on. This
    // function does the housekeeping to start the long running computation
    // just once and returns an object that allows to schedule callbacks
    // once the workerFunc is done.
    // Example:
    // var worker = fun.workerWithCallbackQueue("example",
    //   function slowFunction(thenDo) {
    //     var theAnswer = 42;
    //     setTimeout(function() { thenDo(null, theAnswer); });
    //   });
    // // all "call sites" depend on `slowFunction` but don't have to know about
    // // each other
    // worker.whenDone(function callsite1(err, theAnswer) { alert("callback1: " + theAnswer); })
    // worker.whenDone(function callsite2(err, theAnswer) { alert("callback2: " + theAnswer); })
    // fun.workerWithCallbackQueue("example").whenDone(function callsite3(err, theAnswer) { alert("callback3: " + theAnswer); })
    // // => Will eventually show: callback1: 42, callback2: 42 and callback3: 42


    // ignore-in-doc
    // This is how it works:
    // If `id` does not exist, workerFunc is called, otherwise ignored.
    // workerFunc is expected to call thenDoFunc with arguments: error, arg1, ..., argN
    // if called subsequently before workerFunc is done, the other thenDoFunc
    // will "pile up" and called with the same arguments as the first
    // thenDoFunc once workerFunc is done
    var store = fun._queueUntilCallbacks || (fun._queueUntilCallbacks = {}),
        queueCallbacks = store[id],
        isRunning = !!queueCallbacks;

    if (isRunning) return queueCallbacks;

    var callbacksRun = false, canceled = false;

    function cleanup() {
      if (timeoutProc) clearTimeout(timeoutProc);
      callbacksRun = true;
      delete store[id];
    }

    function runCallbacks(args) {
      if (callbacksRun) return;
      cleanup();
      queueCallbacks.callbacks.forEach(function(cb) {
        try { cb.apply(null, args); } catch (e) {
          console.error(
              "Error when invoking callbacks in queueUntil ["
            + id + "]:\n"
            + (String(e.stack || e)));
        }
      });
    }

    // timeout
    if (optTimeout) {
      var timeoutProc = setTimeout(function() {
        if (callbacksRun) return;
        runCallbacks([new Error("timeout")]);
      }, optTimeout);
    }

    // init the store
    queueCallbacks = store[id] = {
      callbacks: [],
      cancel: function() {
        canceled = true;
        cleanup();
      },
      whenDone: function(cb) {
        queueCallbacks.callbacks.push(cb);
        return queueCallbacks;
      }
    };

    // call worker, but delay so we can immediately return
    setTimeout(function() {
      if (canceled) return;
      try {
        workerFunc(function(/*args*/) { runCallbacks(arguments); });
      } catch (e) { runCallbacks([e]); }
    }, 0);

    return queueCallbacks;
  },

  composeAsync: function(/*functions*/) {
    // Composes functions that are asynchronous and expecting continuations to
    // be called in node.js callback style (error is first argument, real
    // arguments follow).
    // A call like `fun.composeAsync(f,g,h)(arg1, arg2)` has a flow of control like:
    //  `f(arg1, arg2, thenDo1)` -> `thenDo1(err, fResult)`
    // -> `g(fResult, thenDo2)` -> `thenDo2(err, gResult)` ->
    // -> `h(fResult, thenDo3)` -> `thenDo2(err, hResult)`
    // Example:
    // fun.composeAsync(
    //   function(a,b, thenDo) { thenDo(null, a+b); },
    //   function(x, thenDo) { thenDo(x*4); }
    //  )(3,2, function(err, result) { alert(result); });

    var toArray = Array.prototype.slice,
        functions = toArray.call(arguments),
        endCallback, intermediateResult;

    return functions.reverse().reduce(function(prevFunc, func) {
      var nextActivated = false;
      return function() {
        var args = toArray.call(arguments);

        // ignore-in-doc
        // the last arg needs to be function, discard all non-args
        // following it. This allows to have an optional callback func that can
        // even be `undefined`, e.g. when calling this func from a callsite
        // using var args;
        if (!endCallback) {
          while (args.length && typeof args[args.length-1] !== 'function') args.pop();
          endCallback = typeof args[args.length-1] === 'function' ?
            args.pop() : function() {};
        }

        function next(/*err and args*/) {
          nextActivated = true;
          var args = toArray.call(arguments),
              err = args.shift();
          if (err) endCallback && endCallback(err);
          else prevFunc.apply(null, args);
        }

        try {
          func.apply(this, args.concat([next]));
        } catch (e) {
          console.error('composeAsync: ', e.stack || e);
          !nextActivated && endCallback && endCallback(e);
        }
      };
    }, function() {
      endCallback.apply(
        null,
        [null].concat(toArray.call(arguments)));
    });
  },

  compose: function(/*functions*/) {
    // Composes synchronousefunctions:
    // `fun.compose(f,g,h)(arg1, arg2)` = `h(g(f(arg1, arg2)))`
    // Example:
      // fun.compose(
      //   function(a,b) { return a+b; },
      //   function(x) {return x*4}
      // )(3,2) // => 20

    var functions = Array.prototype.slice.call(arguments);
    return functions.reverse().reduce(
      function(prevFunc, func) {
        return function() {
          return prevFunc(func.apply(this, arguments));
        }
      }, function(x) { return x; });
  },

  flip: function(f) {
    // Swaps the first two args
    // Example:
    // fun.flip(function(a, b, c) {
    //   return a + b + c; })(' World', 'Hello', '!') // => "Hello World!"
    return function flipped(/*args*/) {
      var args = Array.prototype.slice.call(arguments),
        flippedArgs = [args[1], args[0]].concat(args.slice(2));
      return f.apply(null, flippedArgs);
    }
  },

  waitFor: function(timeoutMs, waitTesterFunc, thenDo) {
    // Wait for waitTesterFunc to return true, then run thenDo, passing
    // failure/timout err as first parameter. A timout occurs after
    // timeoutMs. During the wait period waitTesterFunc might be called
    // multiple times.
    var start = Date.now();
    var timeStep = 50;
    if (!thenDo) {
      thenDo = waitTesterFunc;
      waitTesterFunc = timeoutMs;
      timeoutMs = undefined;
    }
    (function test() {
      if (waitTesterFunc()) return thenDo();
      if (timeoutMs) {
        var duration = Date.now() - start,
            timeLeft = timeoutMs - duration;
        if (timeLeft <= 0) return thenDo(new Error('timeout'));
        if (timeLeft < timeStep) timeStep = timeLeft;
      }
      setTimeout(test, timeStep);
    })();
  },

  waitForAll: function(options, funcs, thenDo) {
    // Wait for multiple asynchronous functions. Once all have called the
    // continuation, call `thenDo`.
    // options can be: `{timeout: NUMBER}` (how long to wait in milliseconds).

    if (!thenDo) { thenDo = funcs; funcs = options; options = null; }
    options = options || {};

    var results = funcs.map(function() { return null; });
    if (!funcs.length) { thenDo(null, results); return; }

    var leftFuncs = Array.prototype.slice.call(funcs);

    funcs.forEach(function(f, i) {
      try {
        f(function(/*err and args*/) {
          var args = Array.prototype.slice.call(arguments);
          var err = args.shift();
          markAsDone(f, i, err, args);
        });
      } catch (e) { markAsDone(f, i, e, null); }
    });

    if (options.timeout) {
      setTimeout(function() {
        if (!leftFuncs.length) return;
        var missing = results
          .map(function(ea, i) { return ea === null && i; })
          .filter(function(ea) { return typeof ea === 'number'; })
          .join(', ');
        var err = new Error("waitForAll timed out, functions at " + missing + " not done");
        markAsDone(null, null, err, null);
      }, options.timeout);
    }

    function markAsDone(f, i, err, result) {
      if (!leftFuncs.length) return;

      var waitForAllErr = null;
      var fidx = leftFuncs.indexOf(f);
      (fidx > -1) && leftFuncs.splice(fidx, 1);
      if (err) {
        leftFuncs.length = 0;
        waitForAllErr = new Error("in waitForAll at"
          + (typeof i === 'number' ? " " + i : "")
          + ": \n" + (err.stack || String(err)));
      } else if (result) results[i] = result;
      if (!leftFuncs.length) setTimeout(function() {
        thenDo(waitForAllErr, results);
      }, 0);
    }
  },

  // -=-=-=-=-
  // wrapping
  // -=-=-=-=-

  curry: function(func, arg1, arg2, argN/*func and curry args*/) {
    // Return a version of `func` with args applied.
    // Example:
    // var add1 = (function(a, b) { return a + b; }).curry(1);
    // add1(3) // => 4

    if (arguments.length <= 1) return arguments[0];
    var args = Array.prototype.slice.call(arguments),
        func = args.shift();
    function wrappedFunc() {
      return func.apply(this, args.concat(Array.prototype.slice.call(arguments)));
    }
    wrappedFunc.isWrapper = true;
    wrappedFunc.originalFunction = func;
    return wrappedFunc;
  },

  wrap: function(func, wrapper) {
    // A `wrapper` is another function that is being called with the arguments
    // of `func` and a proceed function that, when called, runs the originally
    // wrapped function.
    // Example:
    // function original(a, b) { return a+b }
    // var wrapped = fun.wrap(original, function logWrapper(proceed, a, b) {
    //   alert("original called with " + a + "and " + b);
    //   return proceed(a, b);
    // })
    // wrapped(3,4) // => 7 and a message will pop up
    var __method = func;
    var wrappedFunc = function wrapped() {
      var args = Array.prototype.slice.call(arguments);
      var wrapperArgs = wrapper.isWrapper ?
        args : [__method.bind(this)].concat(args);
      return wrapper.apply(this, wrapperArgs);
    }
    wrappedFunc.isWrapper = true;
    wrappedFunc.originalFunction = __method;
    return wrappedFunc;
  },

  getOriginal: function(func) {
    // Get the original function that was augmented by `wrap`. `getOriginal`
    // will traversed as many wrappers as necessary.
    while (func.originalFunction) func = func.originalFunction;
    return func;
  },

  wrapperChain: function(method) {
      // Function wrappers used for wrapping, cop, and other method
      // manipulations attach a property "originalFunction" to the wrapper. By
      // convention this property references the wrapped method like wrapper
      // -> cop wrapper -> real method.
      // tThis method gives access to the linked list starting with the outmost
      // wrapper.
      var result = [];
      do {
          result.push(method);
          method = method.originalFunction;
      } while (method);
      return result;
  },

  replaceMethodForOneCall: function(obj, methodName, replacement) {
    // Change an objects method for a single invocation.
    // Example:
    // var obj = {foo: function() { return "foo"}};
    // lively.lang.fun.replaceMethodForOneCall(obj, "foo", function() { return "bar"; });
    // obj.foo(); // => "bar"
    // obj.foo(); // => "foo"
    replacement.originalFunction = obj[methodName];
    var reinstall = obj.hasOwnProperty(methodName);
    obj[methodName] = function() {
      if (reinstall) obj[methodName] = replacement.originalFunction
      else delete obj[methodName];
      return replacement.apply(this, arguments);
    };
    return obj;
  },

  once: function(func) {
    // Ensure that `func` is only executed once. Multiple calls will not call
    // `func` again but will return the original result.
    if (!func) return undefined;
    if (typeof func !== 'function')
      throw new Error("fun.once() expecting a function");
    var invoked = false, result;
    return function() {
      if (invoked) return result;
      invoked = true;
      return result = func.apply(this, arguments);
    }
  },

  either: function(/*funcs*/) {
    // Accepts multiple functions and returns an array of wrapped
    // functions. Those wrapped functions ensure that only one of the original
    // function is run (the first on to be invoked).
    //
    // This is useful if you have multiple asynchronous choices of how the
    // control flow might continue but want to ensure that a continuation
    // is  only triggered once, like in a timeout situation:
    //
    // ```js
    // function outerFunction(callback) {
    //   function timeoutAction() { callback(new Error('timeout!')); }
    //   function otherAction() { callback(null, "All OK"); }
    //   setTimeout(timeoutAction, 200);
    //   doSomethingAsync(otherAction);
    // }
    // ```
    //
    // To ensure that `callback` only runs once you would normally have to write boilerplate like this:
    //
    // ```js
    // var ran = false;
    // function timeoutAction() { if (ran) return; ran = true; callback(new Error('timeout!')); }
    // function otherAction() { if (ran) return; ran = true; callback(null, "All OK"); }
    // ```
    //
    // Since this can get tedious an error prone, especially if more than two choices are involved, `either` can be used like this:
    // Example:
    // function outerFunction(callback) {
    //   var actions = fun.either(
    //     function() { callback(new Error('timeout!')); },
    //     function() { callback(null, "All OK"); });
    //   setTimeout(actions[0], 200);
    //   doSomethingAsync(actions[1]);
    // }
    var funcs = Array.prototype.slice.call(arguments), wasCalled = false;
    return funcs.map(function(func) {
      return function() {
        if (wasCalled) return undefined;
        wasCalled = true;
        return func.apply(this, arguments);
      }
    });
  },

  eitherNamed: function(name, func) {
    // Works like [`either`](#) but usage does not require to wrap all
    // functions at once:
    // Example:
    // var log = "", name = "either-example-" + Date.now();
    // function a() { log += "aRun"; };
    // function b() { log += "bRun"; };
    // function c() { log += "cRun"; };
    // setTimeout(fun.eitherNamed(name, a), 100);
    // setTimeout(fun.eitherNamed(name, b), 40);
    // setTimeout(fun.eitherNamed(name, c), 80);
    // setTimeout(function() { alert(log); /* => "bRun" */ }, 150);
    var funcs = Array.prototype.slice.call(arguments);
    var registry = fun._eitherNameRegistry || (fun._eitherNameRegistry = {});
    var name = funcs.shift();
    var eitherCall = registry[name] || (registry[name] = {wasCalled: false, callsLeft: 0});
    eitherCall.callsLeft++;
    return function() {
      eitherCall.callsLeft--;
      // cleanup the storage if all registered functions fired
      if (eitherCall.callsLeft <= 0) delete registry[name];
      if (eitherCall.wasCalled) return undefined;
      eitherCall.wasCalled = true;
      return func.apply(this, arguments);
    }
  },

  // -=-=-=-=-
  // creation
  // -=-=-=-=-
  evalJS: function(src) { return eval(src); },

  fromString: function(funcOrString) {
    // Example:
    // fun.fromString("function() { return 3; }")() // => 3
    return fun.evalJS('(' + funcOrString.toString() + ');');
  },

  asScript: function(func, optVarMapping) {
    // Lifts `func` to become a `Closure`, that is that free variables referenced
    // in `func` will be bound to the values of an object that can be passed in as
    // the second parameter. Keys of this object are mapped to the free variables.
    //
    // Please see [`Closure`](#) for a more detailed explanation and examples.
    return Closure.fromFunction(func, optVarMapping).recreateFunc();
  },

  asScriptOf: function(f, obj, optName, optMapping) {
    // Like `asScript` but makes `f` a method of `obj` as `optName` or the name
    // of the function.
    var name = optName || f.name;
    if (!name) {
      throw Error("Function that wants to be a script needs a name: " + this);
    }
    var proto = Object.getPrototypeOf(obj),
        mapping = {"this": obj};
    if (optMapping) mapping = exports.obj.merge([mapping, optMapping]);
    if (proto && proto[name]) {
      var superFunc = function() {
        try {
          // FIXME super is supposed to be static
          return Object.getPrototypeOf(obj)[name].apply(obj, arguments);
        } catch (e) {
          if (typeof $world !== undefined) $world.logError(e, 'Error in $super call')
          else alert('Error in $super call: ' + e + '\n' + e.stack);
          return null;
        }
      };
      mapping["$super"] = Closure.fromFunction(superFunc, {
        "obj": obj,
        name: name
      }).recreateFunc();
    }
    return fun.addToObject(fun.asScript(f, mapping), obj, name);
  },

  // -=-=-=-=-=-=-=-=-
  // closure related
  // -=-=-=-=-=-=-=-=-
  addToObject: function(f, obj, name) {
    // ignore-in-doc
    f.displayName = name;

    var methodConnections = obj.attributeConnections ?
      obj.attributeConnections.filter(function(con) {
        return con.getSourceAttrName() === 'update'; }) : [];

    if (methodConnections)
      methodConnections.forEach(function(ea) { ea.disconnect(); });

    obj[name] = f;

    if (typeof exports.obj) f.declaredObject = exports.obj.safeToString(obj);

    // suppport for tracing
    if (typeof lively !== "undefined" && exports.obj && lively.Tracing && lively.Tracing.stackTracingEnabled) {
      lively.Tracing.instrumentMethod(obj, name, {
        declaredObject: exports.obj.safeToString(obj)
      });
    }

    if (methodConnections)
      methodConnections.forEach(function(ea) { ea.connect(); });

    return f;
  },

  binds: function(f, varMapping) {
    // ignore-in-doc
    // convenience function
    return Closure.fromFunction(f, varMapping || {}).recreateFunc();
  },

  setLocalVarValue: function(f, name, value) {
    // ignore-in-doc
    if (f.hasLivelyClosure) f.livelyClosure.funcProperties[name] = value;
  },

  getVarMapping: function(f) {
    // ignore-in-doc
    if (f.hasLivelyClosure) return f.livelyClosure.varMapping;
    if (f.isWrapper) return f.originalFunction.varMapping;
    if (f.varMapping) return f.varMapping;
    return {};
  },

  setProperty: function(func, name, value) {
    func[name] = value;
    if (func.hasLivelyClosure) func.livelyClosure.funcProperties[name] = value;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-
  // class-related functions
  // -=-=-=-=-=-=-=-=-=-=-=-=-
  functionNames: function(klass) {
    // Treats passed function as class (constructor).
    // Example:
    // var Klass1 = function() {}
    // Klass1.prototype.foo = function(a, b) { return a + b; };
    // Klass1.prototype.bar = function(a) { return this.foo(a, 3); };
    // Klass1.prototype.baz = 23;
    // fun.functionNames(Klass1); // => ["bar","foo"]

    var result = [], lookupObj = klass.prototype;
    while (lookupObj) {
      result = Object.keys(lookupObj).reduce(function(result, name) {
        if (typeof lookupObj[name] === 'function' && result.indexOf(name) === -1)
          result.push(name);
        return result;
      }, result);
      lookupObj = Object.getPrototypeOf(lookupObj);
    }
    return result;
  },

  localFunctionNames: function(func) {
    return Object.keys(func.prototype)
      .filter(function(name) { return typeof func.prototype[name] === 'function'; });
  },

  // -=-=-=-=-=-=-=-=-=-=-
  // tracing and logging
  // -=-=-=-=-=-=-=-=-=-=-

  logErrors: function(func, prefix) {
    var advice = function logErrorsAdvice(proceed /*,args*/ ) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        try {
          return proceed.apply(func, args);
        } catch (er) {
          if (typeof lively !== "undefined" && lively.morphic && lively.morphic.World && lively.morphic.World.current()) {
            lively.morphic.World.current().logError(er)
            throw er;
          }

          if (prefix) console.warn("ERROR: %s.%s(%s): err: %s %s", func, prefix, args, er, er.stack || "");
          else console.warn("ERROR: %s %s", er, er.stack || "");
          if (typeof logStack !== "undefined") logStack();
          if (typeof printObject !== "undefined") console.warn("details: " + printObject(er));
          throw er;
        }
      }

    advice.methodName = "$logErrorsAdvice";
    var result = fun.wrap(func, advice);
    result.originalFunction = func;
    result.methodName = "$logErrorsWrapper";
    return result;
  },

  logCompletion: function(func, module) {
    var advice = function logCompletionAdvice(proceed) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        try {
          var result = proceed.apply(func, args);
        } catch (er) {
          console.warn('failed to load ' + module + ': ' + er);
          if (typeof lively !== 'undefined' && lively.lang.Execution)
            lively.lang.Execution.showStack();
          throw er;
        }
        console.log('completed ' + module);
        return result;
      }

    advice.methodName = "$logCompletionAdvice::" + module;

    var result = fun.wrap(func, advice);
    result.methodName = "$logCompletionWrapper::" + module;
    result.originalFunction = func;
    return result;
  },

  logCalls: function(func, isUrgent) {
    var original = func,
      advice = function logCallsAdvice(proceed) {
        var args = Array.prototype.slice.call(arguments);
        args.shift(), result = proceed.apply(func, args);
        if (isUrgent) {
          console.warn('%s(%s) -> %s', fun.qualifiedMethodName(original), args, result);
        } else {
          console.log('%s(%s) -> %s', fun.qualifiedMethodName(original), args, result);
        }
        return result;
      }

    advice.methodName = "$logCallsAdvice::" + fun.qualifiedMethodName(func);

    var result = fun.wrap(func, advice);
    result.originalFunction = func;
    result.methodName = "$logCallsWrapper::" + fun.qualifiedMethodName(func);
    return result;
  },

  traceCalls: function(func, stack) {
    var advice = function traceCallsAdvice(proceed) {
        var args = Array.prototype.slice.call(arguments);
        args.shift();
        stack.push(args);
        var result = proceed.apply(func, args);
        stack.pop();
        return result;
      };
    return fun.wrap(func, advice);
  },

  webkitStack: function() {
    // this won't work in every browser
    try {
      throw new Error()
    } catch (e) {
      // remove "Error" and this function from stack, rewrite it nicely
      return String(e.stack)
        .split(/\n/)
        .slice(2)
        .map(function(line) { return line.replace(/^\s*at\s*([^\s]+).*/, '$1'); })
        .join('\n');
    }
  }

};


function Closure() {
  // A `Closure` is a representation of a JavaScript function that controls what
  // values are bound to out-of-scope variables. By default JavaScript has no
  // reflection capabilities over closed values in functions. When needing to
  // serialize execution or when behavior should become part of the state of a
  // system it is often necessary to have first-class control over this language
  // aspect.
  //
  // Typically closures aren't created directly but with the help of [`asScriptOf`](#)
  //
  // Example:
  // function func(a) { return a + b; }
  // var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
  // closureFunc(4) // => 7
  // var closure = closureFunc.livelyClosure // => {
  // //   varMapping: { b: 3 },
  // //   originalFunc: function func(a) {/*...*/}
  // // }
  // closure.lookup("b") // => 3
  // closure.getFuncSource() // => "function func(a) { return a + b; }"
  this.initialize.apply(this, arguments);
}

exports.Closure = Closure;

exports.obj.extend(Closure, {
  superclass: Object,
  type: 'Closure',
  categories: {}
});

Closure.prototype.isLivelyClosure = true;

// -=-=-=-=-=-=-=-
// serialization
// -=-=-=-=-=-=-=-
Closure.prototype.doNotSerialize = ['originalFunc'];

// -=-=-=-=-=-=-
// initializing
// -=-=-=-=-=-=-
Closure.prototype.initialize = function(func, varMapping, source, funcProperties) {
  this.originalFunc = func;
  this.varMapping = varMapping || {};
  this.source = source;
  this.setFuncProperties(func || funcProperties);
}

Closure.prototype.setFuncSource = function(src) { /*show-in-doc*/ this.source = src };

Closure.prototype.getFuncSource = function() { /*show-in-doc*/ return this.source || String(this.originalFunc); }

Closure.prototype.hasFuncSource = function() { /*show-in-doc*/ return this.source && true }

Closure.prototype.getFunc = function() { /*show-in-doc*/ return this.originalFunc || this.recreateFunc(); }

Closure.prototype.getFuncProperties = function() {
  // ignore-in-doc
  // a function may have state attached
  if (!this.funcProperties) this.funcProperties = {};
  return this.funcProperties;
}

Closure.prototype.setFuncProperties = function(obj) {
  // ignore-in-doc
  var props = this.getFuncProperties();
  for (var name in obj) {
    // The AST implementation assumes that Function objects are some
    // kind of value object. When their identity changes cached state
    // should not be carried over to new function instances. This is a
    // pretty intransparent way to invalidate attributes that are used
    // for caches.
    // @cschuster, can you please fix this by making invalidation more
    // explicit?
    if (obj.hasOwnProperty(name) && name != "_cachedAst") {
      props[name] = obj[name];
    }
  }
}

Closure.prototype.lookup = function(name) { /*show-in-doc*/ return this.varMapping[name]; }

Closure.prototype.parameterNames = function(methodString) {
  // ignore-in-doc
  var parameterRegex = /function\s*\(([^\)]*)\)/,
      regexResult = parameterRegex.exec(methodString);
  if (!regexResult || !regexResult[1]) return [];
  var parameterString = regexResult[1];
  if (parameterString.length == 0) return [];
  var parameters = parameterString.split(',').map(function(str) {
    return exports.string.removeSurroundingWhitespaces(str);
  }, this);
  return parameters;
}

Closure.prototype.firstParameter = function(src) {
  // ignore-in-doc
  return this.parameterNames(src)[0] || null;
}

// -=-=-=-=-=-=-=-=-=-
// function creation
// -=-=-=-=-=-=-=-=-=-
Closure.prototype.recreateFunc = function() {
  // Creates a real function object
  return this.recreateFuncFromSource(this.getFuncSource(), this.originalFunc);
}

Closure.prototype.recreateFuncFromSource = function(funcSource, optFunc) {
  // ignore-in-doc
  // what about objects that are copied by value, e.g. numbers?
  // when those are modified after the originalFunc we captured
  // varMapping then we will have divergent state
  var closureVars = [],
      thisFound = false,
      specificSuperHandling = this.firstParameter(funcSource) === '$super';
  for (var name in this.varMapping) {
    if (!this.varMapping.hasOwnProperty(name)) continue;
    if (name == 'this') {
      thisFound = true;
      continue;
    }
    closureVars.push(name + '=this.varMapping["' + name + '"]');
  }

  // ignore-in-doc
  // FIXME: problem with rewriting variables when _2 is rewritten by eval below
  // if (this.originalFunc && this.originalFunc.livelyDebuggingEnabled) {
  //     var scopeObject = this.originalFunc._cachedScopeObject,
  //   depth = -1,
  //   path = ''
  //     while (scopeObject && scopeObject != Global) {
  //   depth++;
  //   scopeObject = scopeObject[2]; // descend in scope
  //     }
  //     scopeObject = this.originalFunc._cachedScopeObject;
  //     var path = 'this.originalFunc._cachedScopeObject';
  //     for (var i = depth; i >= 0; i--) {
  //   closureVars.push('_' + depth + '=' + path + '[1]');
  //   closureVars.push('__' + depth + '=' + path);
  //   path += '[2]';
  //     }
  // }

  var src = closureVars.length > 0 ? 'var ' + closureVars.join(',') + ';\n' : '';
  if (specificSuperHandling) src += '(function superWrapperForClosure() { return ';
  src += '(' + funcSource + ')';
  if (specificSuperHandling) src += '.apply(this, [$super.bind(this)].concat(Array.from(arguments))) })';

  // ignore-in-doc
  // FIXME!!!
  if (typeof lively !== 'undefined' && lively.Config && lively.Config.loadRewrittenCode) {
      module('lively.ast.Rewriting').load(true);
      var namespace = '[runtime]';
      if (optFunc && optFunc.sourceModule)
        namespace = new URL(optFunc.sourceModule.findUri()).relativePathFrom(URL.root);
      var fnAst = lively.ast.acorn.parse(src),
          rewrittenAst = lively.ast.Rewriting.rewrite(fnAst, lively.ast.Rewriting.getCurrentASTRegistry(), namespace),
          retVal = rewrittenAst.body[0].block.body.last();

      // ignore-in-doc
      // FIXME: replace last ExpressionStatement with ReturnStatement
      retVal.type = 'ReturnStatement';
      retVal.argument = retVal.expression;
      delete retVal.expression;

      src = '(function() { ' + escodegen.generate(rewrittenAst) + '}).bind(this)();';
  }

  try {
    var func = fun.evalJS.call(this, src) || this.couldNotCreateFunc(src);
    this.addFuncProperties(func);
    this.originalFunc = func;
    if (typeof lively !== 'undefined' && lively.Config && lively.Config.loadRewrittenCode) {
      func._cachedAst.source = funcSource;
      // FIXME: adjust start and end of FunctionExpression (because of brackets)
      func._cachedAst.start++;
      func._cachedAst.end--;
    }
    return func;
  } catch (e) {
      var msg = 'Cannot create function ' + e + ' src: ' + src;
      console.error(msg);
      throw new Error(msg);
  }
}

Closure.prototype.addFuncProperties = function(func) {
  // ignore-in-doc
  var props = this.getFuncProperties();
  for (var name in props) {
    if (props.hasOwnProperty(name)) func[name] = props[name];
  }
  this.addClosureInformation(func);
}

Closure.prototype.couldNotCreateFunc = function(src) {
  // ignore-in-doc
  var msg = 'Could not recreate closure from source: \n' + src;
  console.error(msg);
  return function() { throw new Error(msg); };
}

// -=-=-=-=-=-
// conversion
// -=-=-=-=-=-
Closure.prototype.asFunction = function() {
  /*ignore-in-doc*/
  return this.recreateFunc();
}

// -=-=-=-=-=-=-=-=-=-=-=-
// function modification
// -=-=-=-=-=-=-=-=-=-=-=-
Closure.prototype.addClosureInformation = function(f) {
  /*ignore-in-doc-in-doc*/
  f.hasLivelyClosure = true;
  f.livelyClosure = this;
  return f;
}

Closure.fromFunction = function(func, varMapping) {
  /*show-in-doc*/
  return new Closure(func, varMapping || {});
}

Closure.fromSource = function(source, varMapping) {
  /*show-in-doc*/
  return new Closure(null, varMapping || {}, source);
}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global*/

// String utility methods for printing, parsing, and converting strings.
;(function(exports) {

// show-in-doc
var string = exports.string = {

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // printing and formatting strings
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  format: function strings$format() {
    // String+ -> String
    // Takes a variable number of arguments. The first argument is the format
    // string. Placeholders in the format string are marked with `"%s"`.
    // Example:
    //   lively.lang.string.format("Hello %s!", "Lively User"); // => "Hello Lively User!"
    return string.formatFromArray(Array.prototype.slice.call(arguments));
  },

  formatFromArray: function strings$formatFromArray(objects) {
    var self = objects.shift();
    if (!self) { console.log("Error in Strings>>formatFromArray, first arg is undefined"); };

    function appendText(object, string) { return "" + object; }

    function appendInteger(value, string) { return value.toString(); }

    function appendFloat(value, string, precision) {
      if (precision > -1) return value.toFixed(precision);
      else return value.toString();
    }

    function appendObject(value, string) { return exports.obj.inspect(value); }

    var appenderMap = {s: appendText, d: appendInteger, i: appendInteger, f: appendFloat, o: appendObject};
    var reg = /((^%|[^\\]%)(\d+)?(\.)([a-zA-Z]))|((^%|[^\\]%)([a-zA-Z]))/;

    function parseFormat(fmt) {
      var oldFmt = fmt;
      var parts = [];

      for (var m = reg.exec(fmt); m; m = reg.exec(fmt)) {
        var type = m[8] || m[5],
          appender = type in appenderMap ? appenderMap[type] : appendObject,
          precision = m[3] ? parseInt(m[3]) : (m[4] == "." ? -1 : 0);
        parts.push(fmt.substr(0, m[0][0] == "%" ? m.index : m.index + 1));
        parts.push({appender: appender, precision: precision});

        fmt = fmt.substr(m.index + m[0].length);
      }
      if (fmt)
        parts.push(fmt.toString());

      return parts;
    };

    var parts = parseFormat(self),
      str = "",
      objIndex = 0;

    for (var i = 0; i < parts.length; ++i) {
      var part = parts[i];
      if (part && typeof(part) == "object") {
        var object = objects[objIndex++];
        str += (part.appender || appendText)(object, str, part.precision);
      } else {
        str += appendText(part, str);
      }
    }
    return str;
  },

  indent: function (str, indentString, depth) {
    // String -> String -> String? -> String
    // Example:
    //   string.indent("Hello", "  ", 2) // => "    Hello"
    if (!depth || depth <= 0) return str;
    while (depth > 0) { depth--; str = indentString + str; }
    return str;
  },

  removeSurroundingWhitespaces: function(str) {
    // Example:
    //   string.removeSurroundingWhitespaces("  hello\n  world  ") // => "hello\nworld"
    function removeTrailingWhitespace(s) {
      while (s.length > 0 && /\s|\n|\r/.test(s[s.length - 1]))
        s = s.substring(0, s.length - 1);
      return s;
    }
    function removeLeadingWhitespace(string) {
      return string.replace(/^[\n\s]*(.*)/, '$1');
    }
    return removeLeadingWhitespace(removeTrailingWhitespace(str));
  },

  quote: function(str) {
    // Example:
    //   string.print("fo\"o") // => "\"fo\\\"o\""
    return '"' + str.replace(/"/g, '\\"') + '"';
  },

  print: function print(obj) {
    // Prints Arrays and escapes quotations. See `obj.inspect` for how to
    // completely print / inspect JavaScript data strcutures
    // Example:
    //   string.print([[1,2,3], "string", {foo: 23}])
    //      // => [[1,2,3],"string",[object Object]]
    if (obj && Array.isArray(obj)) return '[' + obj.map(print) + ']';
    if (typeof obj !== "string") return String(obj);
    var result = String(obj);
    result = result.replace(/\n/g, '\\n\\\n');
    result = result.replace(/(")/g, '\\$1');
    result = '\"' + result + '\"';
    return result;
  },

  printNested: function(list, depth) {
    // Example:
    //   string.printNested([1,2,[3,4,5]]) // => "1\n2\n  3\n  4\n  5\n"
    depth = depth || 0;
    var s = ""
    list.forEach(function(ea) {
      if (ea instanceof Array) {
        s += string.printNested(ea, depth + 1)
      } else {
        s +=  string.indent(ea +"\n", '  ', depth);
      }
    })
    return s
  },

  pad: function(string, n, left) {
    // Examples:
    // string.pad("Foo", 2) // => "Foo  "
    // string.pad("Foo", 2, true) // => "  Foo"
    return left ? ' '.times(n) + string : string + ' '.times(n);
  },

  printTable: function(tableArray, options) {
    // Array -> Object? -> String
    // Takes a 2D Array and prints a table string. Kind of the reverse
    // operation to `strings.tableize`
    // Example:
    //   string.printTable([["aaa", "b", "c"], ["d", "e","f"]])
    //    // =>
    //    // aaa b c
    //    // d   e f
    var columnWidths = [],
      separator = (options && options.separator) || ' ',
      alignLeftAll = !options || !options.align || options.align === 'left',
      alignRightAll = options && options.align === 'right';
    function alignRight(columnIndex) {
      if (alignLeftAll) return false;
      if (alignRightAll) return true;
      return options
        && Object.isArray(options.align)
        && options.align[columnIndex] === 'right';
    }
    tableArray.forEach(function(row) {
      row.forEach(function(cellVal, i) {
        if (columnWidths[i] === undefined) columnWidths[i] = 0;
        columnWidths[i] = Math.max(columnWidths[i], String(cellVal).length);
      });
    });
    return tableArray.collect(function(row) {
      return row.collect(function(cellVal, i) {
        var cellString = String(cellVal);
        return string.pad(cellString,
                   columnWidths[i] - cellString.length,
                   alignRight(i));
      }).join(separator);
    }).join('\n');
  },

  printTree: function(rootNode, nodePrinter, childGetter, indent) {
    // Object -> Function -> Function -> Number? -> String
    // A generic function to print a tree representation from a nested data structure.
    // Receives three arguments:
    // - `rootNode` an object representing the root node of the tree
    // - `nodePrinter` is a function that gets a tree node and should return stringified version of it
    // - `childGetter` is a function that gets a tree node and should return a list of child nodes
    // Example:
    // var root = {name: "a", subs: [{name: "b", subs: [{name: "c"}]}, {name: "d"}]};
    // string.printTree(root, function(n) { return n.name; }, function(n) { return n.subs; });
    // // =>
    // // a
    // // |-b
    // // | \-c
    // // \-d

    var nodeList = [];
    indent = indent || '  ';
    iterator(0, 0, rootNode);
    return nodeList.join('\n');
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function iterator(depth, index, node) {
      // ignore-in-doc
      // 1. Create stringified representation of node
      nodeList[index] = (string.times(indent, depth)) + nodePrinter(node, depth);
      var children = childGetter(node, depth),
        childIndex = index + 1;
      if (!children || !children.length) return childIndex;
      // 2. If there are children then assemble those linear inside nodeList
      // The childIndex is the pointer of the current items of childList into
      // nodeList.
      var lastIndex = childIndex,
        lastI = children.length - 1;
      children.forEach(function(ea, i) {
        childIndex = iterator(depth+1, childIndex, ea);
        // 3. When we have printed the recursive version then augment the
        // printed version of the direct children with horizontal slashes
        // directly in front of the represented representation
        var isLast = lastI === i,
          cs = nodeList[lastIndex].split(''),
          fromSlash = (depth*indent.length)+1,
          toSlash = (depth*indent.length)+indent.length;
        for (var i = fromSlash; i < toSlash; i++) cs[i] = '-';
        if (isLast) cs[depth*indent.length] = '\\';
        nodeList[lastIndex] = cs.join('');
        // 4. For all children (direct and indirect) except for the
        // last one (itself and all its children) add vertical bars in
        // front of each at position of the current nodes depth. This
        // makes is much easier to see which child node belongs to which
        // parent
        if (!isLast)
          nodeList.slice(lastIndex, childIndex).forEach(function(ea, i) {
            var cs2 = ea.split('');
            cs2[depth*indent.length] = '|';
            nodeList[lastIndex+i] = cs2.join(''); });
        lastIndex = childIndex;
      });
      return childIndex;
    }
  },

  toArray: function(s) {
    // Example:
    // string.toArray("fooo") // => ["f","o","o","o"]
    return s.split('');
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // parsing strings into other entities
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  lines: function(str) {
    // Example: string.lines("foo\nbar\n\rbaz") // => ["foo","bar","baz"]
    return str.split(/\n\r?/);
  },

  paragraphs: function(string, options) {
    // Examples:
    // var text = "Hello, this is a pretty long sentence\nthat even includes new lines."
    //         + "\n\n\nThis is a sentence in  a new paragraph.";
    // string.paragraphs(text) // => [
    //   // "Hello, this is a pretty long sentence\nthat even includes new lines.",
    //   // "This is a sentence in  a new paragraph."]
    // string.paragraphs(text, {keepEmptyLines: true}) // => [
    //   // "Hello, this is a pretty long sentence\n that even includes new lines.",
    //   // "\n ",
    //   // "This is a sentence in  a new paragraph."]
    var sep = options ? options.sep : '\n\n';
    if (!options || !options.keepEmptyLines) return string.split(new RegExp(sep + '+'));
    function isWhiteSpace(s) { return (/^\s*$/).test(s); }
    return string.split('\n').concat('').reduce(function(parasAndLast, line) {
      var paras = parasAndLast[0], last = parasAndLast[1];
      if (isWhiteSpace(last) === isWhiteSpace(line)) {
        last += '\n' + line;
      } else {
         last.length && paras.push(last); last = line;
      }
      return [paras, last];
    }, [[], ''])[0];
  },

  nonEmptyLines: function(str) {
    // Example: string.nonEmptyLines("foo\n\nbar\n") // => ["foo","bar"]
    return string.lines(str).compact();
  },

  tokens: function(str, regex) {
    // Example:
    // string.tokens(' a b c') => ['a', 'b', 'c']
    return str.split(regex || /\s+/).filter(function(tok) {
      return !(/^\s*$/).test(tok); });
  },

  tableize: function(s, options) {
    // String -> Object? -> Array
    // Takes a String representing a "table" and parses it into a 2D-Array (as
    // accepted by the `collection.Grid` methods or `string.printTable`)
    // ```js
    // options = {
    //     convertTypes: BOOLEAN, // automatically convert to Numbers, Dates, ...?
    //     cellSplitter: REGEXP // how to recognize "cells", by default just spaces
    // }
    // ```
    // Examples:
    // string.tableize('a b c\nd e f')
    // // => [["a","b","c"],["d","e","f"]]
    // // can also parse csv like
    // var csv = '"Symbol","Name","LastSale",\n'
    //         + '"FLWS","1-800 FLOWERS.COM, Inc.","5.65",\n'
    //         + '"FCTY","1st Century Bancshares, Inc","5.65",'
    // string.tableize(csv, {cellSplitter: /^\s*"|","|",?\s*$/g})
    // // => [["Symbol","Name","LastSale"],
    // //     ["FLWS","1-800 FLOWERS.COM, Inc.",5.65],
    // //     ["FCTY","1st Century Bancshares, Inc",5.65]]

    options = options || {};
    var splitter = options.cellSplitter || /\s+/,
        emptyStringRe = /^\s*$/,
        convertTypes = options.hasOwnProperty('convertTypes') ? !!options.convertTypes : true,
        lines = string.lines(s), table = [];
    for (var i = 0; i < lines.length; i++) {
      var tokens = string.tokens(lines[i], splitter);
      if (convertTypes) {
        tokens = tokens.map(function(tok) {
          if (tok.match(emptyStringRe)) return tok;
          var num = Number(tok);
          if (!isNaN(num)) return num;
          var date = new Date(tok);
          if (!isNaN(+date)) return date;
          return tok.trim();
        });
      }
      if (tokens.length > 0) table.push(tokens);
    }
    return table;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // (un)escape / encoding / decoding
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  unescapeCharacterEntities: function(s) {
    // Converts [character entities](http://dev.w3.org/html5/html-author/charref)
    // into utf-8 strings
    // Example:
    //   string.unescapeCharacterEntities("foo &amp;&amp; bar") // => "foo && bar"
    if (typeof document === 'undefined') throw new Error("Cannot unescapeCharacterEntities");
    var div = document.createElement('div');
    div.innerHTML = s;
    return div.textContent;
  },

  toQueryParams: function(s, separator) {
    // Example:
    // string.toQueryParams("http://example.com?foo=23&bar=test")
    //   // => {bar: "test", foo: "23"}
    var match = s.trim().match(/([^?#]*)(#.*)?$/);
    if (!match) return {};

    var hash = match[1].split(separator || '&').inject({}, function(hash, pair) {
      if ((pair = pair.split('='))[0]) {
        var key = decodeURIComponent(pair.shift());
        var value = pair.length > 1 ? pair.join('=') : pair[0];
        if (value != undefined) value = decodeURIComponent(value);

        if (key in hash) {
          if (!Array.isArray(hash[key])) hash[key] = [hash[key]];
          hash[key].push(value);
        } else hash[key] = value;
      }
      return hash;
    });
    return hash;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-
  // file system path support
  // -=-=-=-=-=-=-=-=-=-=-=-=-
  joinPath: function(/*paths*/) {
    // Joins the strings passed as paramters together so that ea string is
    // connected via a single "/".
    // Example:
    // string.joinPath("foo", "bar") // => "foo/bar";
    var args = Array.prototype.slice.call(arguments);
    return args.reduce(function(path, ea) {
      return typeof ea === "string" ?
        path.replace(/\/*$/, "") + "/" + ea.replace(/^\/*/, "") : path;
    });
  },

  // -=-=-=-=-=-=-=-=-
  // ids and hashing
  // -=-=-=-=-=-=-=-=-

  newUUID: function() {
    // Example:
    //   string.newUUID() // => "3B3E74D0-85EA-45F2-901C-23ECF3EAB9FB"
    var id = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8);
      return v.toString(16);
    }).toUpperCase();
    return id;
  },

  createDataURI: function(content, mimeType) {
    // String -> String -> String
    // Takes some string representing content and a mime type.
    // For a list of mime types see: [http://www.iana.org/assignments/media-types/media-types.xhtml]()
    // More about data URIs: [https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs]()
    // Example:
    //   window.open(string.createDataURI('<h1>test</h1>', 'text/html'));
    mimeType = mimeType || "text/plain";
    return "data:" + mimeType
       + ";base64," + btoa(content);
  },

  hashCode: function(s) {
    // [http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/]()
    // Example: string.hashCode("foo") // => 101574
    var hash = 0, len = s.length;
    if (len == 0) return hash;
    for (var i = 0; i < len; i++) {
      var c = s.charCodeAt(i);
      hash = ((hash<<5)-hash) + c;
      hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
  },

  md5: function (string) {
    // © Joseph Myers [http://www.myersdaily.org/joseph/javascript/md5-text.html]()
    // Example:
    //   string.md5("foo") // => "acbd18db4cc2f85cedef654fccc4a4d8"

    /* ignore-in-doc
		this function is much faster,
		so if possible we use it. Some IEs
		are the only ones I know of that
		need the idiotic second function,
		generated by an if clause.  */
    // var add32 = hex(md51("hello")) === "5d41402abc4b2a76b9719d911017c592" ?
    //   function add32(a, b) { return (a + b) & 0xFFFFFFFF; } :
		var add32 = function add32(x, y) {
			var lsw = (x & 0xFFFF) + (y & 0xFFFF),
			msw = (x >> 16) + (y >> 16) + (lsw >> 16);
			return (msw << 16) | (lsw & 0xFFFF);
		}

  	function cmn(q, a, b, x, s, t) {
			a = add32(add32(a, q), add32(x, t));
			return add32((a << s) | (a >>> (32 - s)), b);
		}

		function ff(a, b, c, d, x, s, t) {
			return cmn((b & c) | ((~b) & d), a, b, x, s, t);
		}

		function gg(a, b, c, d, x, s, t) {
			return cmn((b & d) | (c & (~d)), a, b, x, s, t);
		}

		function hh(a, b, c, d, x, s, t) {
			return cmn(b ^ c ^ d, a, b, x, s, t);
		}

		function ii(a, b, c, d, x, s, t) {
			return cmn(c ^ (b | (~d)), a, b, x, s, t);
		}

		function md5cycle(x, k) {
			var a = x[0], b = x[1], c = x[2], d = x[3];

			a = ff(a, b, c, d, k[0], 7, -680876936);
			d = ff(d, a, b, c, k[1], 12, -389564586);
			c = ff(c, d, a, b, k[2], 17,  606105819);
			b = ff(b, c, d, a, k[3], 22, -1044525330);
			a = ff(a, b, c, d, k[4], 7, -176418897);
			d = ff(d, a, b, c, k[5], 12,  1200080426);
			c = ff(c, d, a, b, k[6], 17, -1473231341);
			b = ff(b, c, d, a, k[7], 22, -45705983);
			a = ff(a, b, c, d, k[8], 7,  1770035416);
			d = ff(d, a, b, c, k[9], 12, -1958414417);
			c = ff(c, d, a, b, k[10], 17, -42063);
			b = ff(b, c, d, a, k[11], 22, -1990404162);
			a = ff(a, b, c, d, k[12], 7,  1804603682);
			d = ff(d, a, b, c, k[13], 12, -40341101);
			c = ff(c, d, a, b, k[14], 17, -1502002290);
			b = ff(b, c, d, a, k[15], 22,  1236535329);

			a = gg(a, b, c, d, k[1], 5, -165796510);
			d = gg(d, a, b, c, k[6], 9, -1069501632);
			c = gg(c, d, a, b, k[11], 14,  643717713);
			b = gg(b, c, d, a, k[0], 20, -373897302);
			a = gg(a, b, c, d, k[5], 5, -701558691);
			d = gg(d, a, b, c, k[10], 9,  38016083);
			c = gg(c, d, a, b, k[15], 14, -660478335);
			b = gg(b, c, d, a, k[4], 20, -405537848);
			a = gg(a, b, c, d, k[9], 5,  568446438);
			d = gg(d, a, b, c, k[14], 9, -1019803690);
			c = gg(c, d, a, b, k[3], 14, -187363961);
			b = gg(b, c, d, a, k[8], 20,  1163531501);
			a = gg(a, b, c, d, k[13], 5, -1444681467);
			d = gg(d, a, b, c, k[2], 9, -51403784);
			c = gg(c, d, a, b, k[7], 14,  1735328473);
			b = gg(b, c, d, a, k[12], 20, -1926607734);

			a = hh(a, b, c, d, k[5], 4, -378558);
			d = hh(d, a, b, c, k[8], 11, -2022574463);
			c = hh(c, d, a, b, k[11], 16,  1839030562);
			b = hh(b, c, d, a, k[14], 23, -35309556);
			a = hh(a, b, c, d, k[1], 4, -1530992060);
			d = hh(d, a, b, c, k[4], 11,  1272893353);
			c = hh(c, d, a, b, k[7], 16, -155497632);
			b = hh(b, c, d, a, k[10], 23, -1094730640);
			a = hh(a, b, c, d, k[13], 4,  681279174);
			d = hh(d, a, b, c, k[0], 11, -358537222);
			c = hh(c, d, a, b, k[3], 16, -722521979);
			b = hh(b, c, d, a, k[6], 23,  76029189);
			a = hh(a, b, c, d, k[9], 4, -640364487);
			d = hh(d, a, b, c, k[12], 11, -421815835);
			c = hh(c, d, a, b, k[15], 16,  530742520);
			b = hh(b, c, d, a, k[2], 23, -995338651);

			a = ii(a, b, c, d, k[0], 6, -198630844);
			d = ii(d, a, b, c, k[7], 10,  1126891415);
			c = ii(c, d, a, b, k[14], 15, -1416354905);
			b = ii(b, c, d, a, k[5], 21, -57434055);
			a = ii(a, b, c, d, k[12], 6,  1700485571);
			d = ii(d, a, b, c, k[3], 10, -1894986606);
			c = ii(c, d, a, b, k[10], 15, -1051523);
			b = ii(b, c, d, a, k[1], 21, -2054922799);
			a = ii(a, b, c, d, k[8], 6,  1873313359);
			d = ii(d, a, b, c, k[15], 10, -30611744);
			c = ii(c, d, a, b, k[6], 15, -1560198380);
			b = ii(b, c, d, a, k[13], 21,  1309151649);
			a = ii(a, b, c, d, k[4], 6, -145523070);
			d = ii(d, a, b, c, k[11], 10, -1120210379);
			c = ii(c, d, a, b, k[2], 15,  718787259);
			b = ii(b, c, d, a, k[9], 21, -343485551);

			x[0] = add32(a, x[0]);
			x[1] = add32(b, x[1]);
			x[2] = add32(c, x[2]);
			x[3] = add32(d, x[3]);

		}

		function md51(s) {
			var n = s.length,
			state = [1732584193, -271733879, -1732584194, 271733878], i;
			for (i=64; i<=n; i+=64) {
				md5cycle(state, md5blk(s.substring(i-64, i)));
			}
			s = s.substring(i-64);
			var tail = [0,0,0,0, 0,0,0,0, 0,0,0,0, 0,0,0,0], sl=s.length;
			for (i=0; i<sl; i++) 	tail[i>>2] |= s.charCodeAt(i) << ((i%4) << 3);
			tail[i>>2] |= 0x80 << ((i%4) << 3);
			if (i > 55) {
				md5cycle(state, tail);
				i=16;
				while (i--) { tail[i] = 0 }
	//			for (i=0; i<16; i++) tail[i] = 0;
			}
			tail[14] = n*8;
			md5cycle(state, tail);
			return state;
		}

		/* ignore-in-doc
		 * there needs to be support for Unicode here,
		 * unless we pretend that we can redefine the MD-5
		 * algorithm for multi-byte characters (perhaps
		 * by adding every four 16-bit characters and
		 * shortening the sum to 32 bits). Otherwise
		 * I suggest performing MD-5 as if every character
		 * was two bytes--e.g., 0040 0025 = @%--but then
		 * how will an ordinary MD-5 sum be matched?
		 * There is no way to standardize text to something
		 * like UTF-8 before transformation; speed cost is
		 * utterly prohibitive. The JavaScript standard
		 * itself needs to look at this: it should start
		 * providing access to strings as preformed UTF-8
		 * 8-bit unsigned value arrays.
		 */
		function md5blk(s) {
		  // ignore-in-doc
		  /* I figured global was faster.   */
			var md5blks = [], i; 	/* Andy King said do it this way. */
			for (i=0; i<64; i+=4) {
			md5blks[i>>2] = s.charCodeAt(i)
			+ (s.charCodeAt(i+1) << 8)
			+ (s.charCodeAt(i+2) << 16)
			+ (s.charCodeAt(i+3) << 24);
			}
			return md5blks;
		}

		var hex_chr = '0123456789abcdef'.split('');

		function rhex(n)
		{
			var s='', j=0;
			for(; j<4; j++)	s += hex_chr[(n >> (j * 8 + 4)) & 0x0F]	+ hex_chr[(n >> (j * 8)) & 0x0F];
			return s;
		}

		function hex(x) {
			var l=x.length;
			for (var i=0; i<l; i++)	x[i] = rhex(x[i]);
			return x.join('');
		}

		return hex(md51(string));
	},

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-
  // matching strings / regexps
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-

  reMatches: function(string, re) {
    // Different to the native `match` function this method returns an object
    // with `start`, `end`, and `match` fields
    // Example:
    //   string.reMatches("Hello World", /o/g)
    //   // => [{start: 4, end: 5, match: "o"},{start: 7, end: 8, match: "o"}]
    var matches = [];
    string.replace(re, function(match, idx) {
      matches.push({match: match, start: idx, end: idx + match.length}); });
    return matches;
  },

  stringMatch: function(s, patternString, options) {
    // returns `{matched: true}` if success otherwise
    // `{matched: false, error: EXPLANATION, pattern: STRING|RE, pos: NUMBER}`
    // Example:
    //   string.stringMatch("foo 123 bar", "foo __/[0-9]+/__ bar") // => {matched: true}
    //   string.stringMatch("foo aaa bar", "foo __/[0-9]+/__ bar")
    //     // => {
    //     //   error: "foo <--UNMATCHED-->aaa bar",
    //     //   matched: false,
    //     //   pattern: /[0-9]+/,
    //     //   pos: 4
    //     // }
    options = options || {};
    if (!!options.normalizeWhiteSpace) s = s.replace(/\s+/g, ' ');
    if (!!options.ignoreIndent) {
      s = s.replace(/^\s+/gm, '');
      patternString = patternString.replace(/^\s+/gm, '');
    }
    return s == patternString ?
      {matched: true} : embeddedReMatch(s , patternString);

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    function splitInThree(string, start, end, startGap, endGap) {
      // ignore-in-doc
      // split string at start and end
      // return (0, start), (start, end), (end, ...)
      startGap = startGap || 0; endGap = endGap || 0;
      return [string.slice(0, start),
          string.slice(start+startGap, end-endGap),
          string.slice(end)]
    }

    function matchStringForward(s, pattern) {
      // ignore-in-doc
      // try to match pattern at beginning of string. if matched, return
      // result object with {
      //   match: STRING,
      //   REST: STRING -- remaining string after pattern was consumed
      // }
      if (pattern.constructor !== RegExp) {
        var idx = s.indexOf(pattern);
        if (idx === 0) return {match: pattern, rest: s.slice(pattern.length)}
        // no match
        for (var i = 0; i < pattern.length; i++) // figure out where we failed
          if (pattern[i] != s[i])
            return {match: null, pos: i};
        return {match: null};
      }
      var matches = string.reMatches(s, pattern);
      // show(matches)
      // show(string.slice(matches[0].end));
      return (!matches || !matches.length || matches[0].start !== 0) ?
        {match: null} :
        {match: matches[0].match, rest: s.slice(matches[0].end)};
    }

    function matchStringForwardWithAllPatterns(s, patterns) {
      // ignore-in-doc
      // like matchStringForward, just apply list of patterns
      var pos = 0;
      for (var i = 0; i < patterns.length; i++) {
        var p = patterns[i],
          result = matchStringForward(s, p);
        if (!result.match) return {matched: false, pos: pos + (result.pos || 0), pattern: p}
        pos += result.match.length;
        s = result.rest;
      }
      return s.length ? {matched: false, pos: pos} : {matched: true}
    }

    function splitIntoPatterns(matcher) {
      var starts = string.reMatches(matcher, /__\//g),
          ends = string.reMatches(matcher, /\/__/g);
      if (starts.length !== ends.length) {
        throw new Error("pattern invalid: "
                + matcher
                + " cannot be split into __/.../__ embedded RegExps"
                + "\nstarts: " + JSON.stringify(starts)
                + '\nvs ends:\n' + JSON.stringify(ends));
      }
      var consumed = 0;
      return starts.reduce(function(patterns, start, i) {
        var end = ends[i];
        var matcher = patterns.pop();
        var splitted = splitInThree(
          matcher,
          start.start-consumed,
          end.end-consumed,
          3, 3);
        if (splitted[0].length) {
          patterns.push(splitted[0]);
          consumed += splitted[0].length;
        }
        try {
          if (splitted[1].length) {
            patterns.push(new RegExp(splitted[1]));
            consumed += splitted[1].length + 3 + 3;
          }
        } catch(e) {
          throw new Error("Cannot create pattern re from: " + exports.obj.inspect(splitted))
        }
        if (splitted[2].length) { patterns.push(splitted[2]); }
        return patterns;
      }, [matcher]);
    }

    function embeddedReMatch(s, patternString) {
      // ignore-in-doc
      // the main match func
      var patterns = splitIntoPatterns(patternString)
      var result = matchStringForwardWithAllPatterns(s, patterns);
      if (result.matched) return result;
      result.error = s.slice(0, result.pos) + '<--UNMATCHED-->' + s.slice(result.pos)
      return result;
    }
  },

  peekRight: function(s, start, needle) {
    // Finds the next occurence of `needle` (String or RegExp). Returns delta
    // index.
    // Example:
    // string.peekRight("Hello World", 0, /o/g) // => 4
    // string.peekRight("Hello World", 5, /o/) // => 2
    s = s.slice(start);
    if (typeof needle === 'string') {
      var idx = s.indexOf(needle);
      return idx === -1 ? null : idx + start;
    } else if (needle.constructor === RegExp) {
      var matches = string.reMatches(s, needle);
      return matches[0] ? matches[0].start : null;
    }
    return null;
  },

  peekLeft: function(s, start, needle) {
    // Similar to `peekRight`
    s = s.slice(0, start);
    if (typeof needle === 'string') {
      var idx = s.lastIndexOf(needle);
      return idx === -1 ? null : idx;
    } else if (needle.constructor === RegExp) {
      var matches = string.reMatches(s, needle);
      return exports.arr.last(matches) ? exports.arr.last(matches).start : null;
    }
    return null;
  },

  lineIndexComputer: function(s) {
    // String -> Function
    // For converting character positions to line numbers.
    // Returns a function accepting char positions. If the char pos is outside
    // of the line ranges -1 is returned.
    // Example:
    // var idxComp = string.lineIndexComputer("Hello\nWorld\n\nfoo");
    // idxComp(3) // => 0 (index 3 is "l")
    // idxComp(6) // => 1 (index 6 is "W")
    // idxComp(12) // => 2 (index 12 is "\n")

    // ignore-in-doc
    // line ranges: list of numbers, each line has two entries:
    // i -> start of line, i+1 -> end of line
    var lineRanges = string.lines(s).reduce(function(lineIndexes, line) {
      var lastPos = lineIndexes.slice(-1)[0] || -1;
      return lineIndexes.concat([lastPos+1, lastPos + 1 + line.length]);
    }, []);
    // ignore-in-doc
    // FIXME, this is O(n). Make cumputation more efficient, binary lookup?
    return function(pos) {
      for (var line = 0; line < lineRanges.length; line+=2)
        if (pos >= lineRanges[line] && pos <= lineRanges[line+1])
          return line / 2;
      return -1;
    }
  },

  lineNumberToIndexesComputer: function(s) {
    // String -> Function
    // For converting line numbers to [startIndex, endIndex]
    // Example:
    // var idxComp = string.lineNumberToIndexesComputer("Hello\nWorld\n\nfoo");
    // idxComp(1) // => [6,12]

    var lineRanges = string.lines(s).reduce(function(akk, line) {
      var start = akk.indexCount, end = akk.indexCount + line.length+1;
      akk.lineRanges.push([start, end]);
      akk.indexCount = end;
      return akk;
    }, {lineRanges: [], indexCount: 0}).lineRanges;
    return function(lineNo) { return lineRanges[lineNo]; }
  },

  // -=-=-=-=-
  // diffing
  // -=-=-=-=-

  diff: function(s1, s2) {
    if (typeof JsDiff === "undefined") return 'diff not supported';
    return JsDiff.convertChangesToXML(JsDiff.diffWordsWithSpace(s1, s2));
  },

  // -=-=-=-=-
  // testing
  // -=-=-=-=-

  empty: function(s) {
    // show-in-doc
    return s == '';
  },

  include: function(s, pattern) {
    // Example:
    // string.include("fooo!", "oo") // => true
    return s.indexOf(pattern) > -1;
  },

  startsWith: function(s, pattern) {
    // Example:
    // string.startsWith("fooo!", "foo") // => true
    return s.indexOf(pattern) === 0;
  },

  startsWithVowel: function(s) {
    // show-in-doc
    var c = s[0];
    return c === 'A' || c === 'E' || c === 'I' || c === 'O' || c === 'U'
      || c === 'a' || c === 'e' || c === 'i' || c === 'o' || c === 'u' || false;
  },

  endsWith: function(s, pattern) {
    // Example:
    // string.endsWith("fooo!", "o!") // => true
    var d = s.length - pattern.length;
    return d >= 0 && s.lastIndexOf(pattern) === d;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // string conversion and manipulation
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  withDecimalPrecision: function(str, precision) {
    // String -> Number -> String
    // Example: string.withDecimalPrecision("1.12345678", 3) // => "1.123"
    var floatValue = parseFloat(str);
    return isNaN(floatValue) ? str : floatValue.toFixed(precision);
  },

  capitalize: function(s) {
    // Example:
    // string.capitalize("foo bar") // => "Foo bar"
    return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  },

  camelCaseString: function(s) {
    // Spaces to camels, including first char
    // Example: string.camelCaseString("foo bar baz") // => "FooBarBaz"
    return s.split(" ").invoke('capitalize').join("")
  },

  camelize: function(s) {
    // Dashes to camels, excluding first char
    // Example: string.camelize("foo-bar-baz") // => "fooBarBaz"
    var parts = s.split('-'),
        len = parts.length;
    if (len == 1) return parts[0];

    var camelized = s.charAt(0) == '-' ?
        parts[0].charAt(0).toUpperCase() + parts[0].substring(1) : parts[0];
    for (var i = 1; i < len; i++)
      camelized += parts[i].charAt(0).toUpperCase() + parts[i].substring(1);
    return camelized;
  },

  truncate: function(s, length, truncation) {
    // Enforces that s is not more then `length` characters long.
    // Example:
    // string.truncate("123456789", 5) // => "12..."
    length = length || 30;
    truncation = truncation === undefined ? '...' : truncation;
    return s.length > length ?
      s.slice(0, length - truncation.length) + truncation : String(s);
  },

  regExpEscape: function(s) {
    // For creating RegExps from strings and not worrying about proper escaping
    // of RegExp special characters to literally match those.
    // Example:
    // var re = new RegExp(string.regExpEscape("fooo{20}"));
    // re.test("fooo") // => false
    // re.test("fooo{20}") // => true
    return s.replace(/([-()\[\]{}+?*.$\^|,:#<!\\])/g, '\\$1')
            .replace(/\x08/g, '\\x08');
  },

  succ: function(s) {
    // Uses char code.
    // Example:
    // string.succ("a") // => "b"
    // string.succ("Z") // => "["
    return s.slice(0, s.length - 1) + String.fromCharCode(s.charCodeAt(s.length - 1) + 1);
  },

  digitValue: function(s) {
    // ignore-in-doc
    return s.charCodeAt(0) - "0".charCodeAt(0);
  },

  times: function(s, count) {
    // Example:
    // string.times("test", 3) // => "testtesttest"
    return count < 1 ? '' : new Array(count + 1).join(s);
  },

  applyChange: function(string, change) {
    // change is of the form
    // `{start: Number, end: Number, lines: [String], action: "insert"|"remove"}`
    if (change.action === "insert") {
      return string.slice(0, change.start)
           + change.lines.join("\n")
           + string.slice(change.start);
    } else if (change.action === "remove") {
        return string.slice(0, change.start)
             + string.slice(change.end);
    }
    return string;
  },

  applyChanges: function(s, changes) {
    return changes.reduce(function(result, change) {
      return string.applyChange(s, change);
    }, s);
  }

}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*
 * Utility functions for JS Numbers.
 */
;(function(exports) {
"use strict";

var num = exports.num = {

  random: function(min, max) {
    // random number between (and including) `min` and `max`
    min = min || 0;
    max  = max || 100;
    return Math.round(Math.random() * (max-min) + min)
  },

  normalRandom: (function(mean, stdDev) {
    // returns randomized numbers in a normal distribution that can be
    // controlled ising the `mean` and `stdDev` parameters
    var spare, isSpareReady = false;
    return function(mean, stdDev) {
      if (isSpareReady) {
        isSpareReady = false;
        return spare * stdDev + mean;
      } else {
        var u, v, s;
        do {
          u = Math.random() * 2 - 1;
          v = Math.random() * 2 - 1;
          s = u * u + v * v;
        } while (s >= 1 || s == 0);
        var mul = Math.sqrt(-2.0 * Math.log(s) / s);
        spare = v * mul;
        isSpareReady = true;
        return mean + stdDev * u * mul;
      }
    }
  })(),

  randomSmallerInteger: function (n) { return Math.floor(Math.random() * n); },

  humanReadableByteSize: function(n) {
    // interpret `n` as byte size and print a more readable version
    // Example:
    //   num.humanReadableByteSize(Math.pow(2,32)) // => "4096MB"
    function round(n) { return Math.round(n * 100) / 100 }
    if (n < 1000) return String(round(n)) + 'B'
    n = n / 1024;
    if (n < 1000) return String(round(n)) + 'KB'
    n = n / 1024;
    return String(round(n)) + 'MB'
  },

  average: function(numbers) {
    // show-in-doc
    return numbers.reduce(function(sum, n) { return sum + n; }, 0) / numbers.length;
  },

  median: function(numbers) {
    // show-in-doc
    var sorted = numbers.sort(function(a,b) { return b - a; }),
        len = numbers.length;
    return len % 2 === 0 ?
      0.5 * (sorted[len/2-1] + sorted[len/2]) :
      sorted[(len-1)/2];
  },

  between: function(x, a, b, eps) {
    // is `a` <= `x` <= `y`?
    eps = eps || 0;
    var min, max;
    if (a < b) { min = a, max = b }
    else { max = a, min = b }
    return (max - x + eps >= 0) && (min - x - eps <= 0);
  },

  sort: function(arr) {
    // numerical sort, JavaScript native `sort` function is lexical by default.
    return arr.sort(function(a,b) { return a-b; });
  },

  parseLength: function(string, toUnit) {
    // This converts the length value to pixels or the specified `toUnit`.
    // length converstion, supported units are: mm, cm, in, px, pt, pc
    // Examples:
    // num.parseLength('3cm') // => 113.38582677165354
    // num.parseLength('3cm', "in") // => 1.1811023622047243
    toUnit = toUnit || 'px'
    var match = string.match(/([0-9\.]+)\s*(.*)/);
    if (!match || !match[1]) return undefined;
    var length = parseFloat(match[1]),
      fromUnit = match[2];
    return exports.num.convertLength(length, fromUnit, toUnit);
  },

  convertLength: (function() {
    // ignore-in-doc
    // num.convertLength(20, 'px', 'pt').roundTo(0.01)
    function toCm(n, unit) {
      // as defined in http://www.w3.org/TR/css3-values/#absolute-lengths
      if (unit === 'cm') return n;
      else if (unit === 'mm') return n*0.1;
      else if (unit === 'in') return n*2.54;
      else if (unit === 'px') return n*toCm(1/96, 'in');
      else if (unit === 'pt') return n*toCm(1/72, 'in');
      else if (unit === 'pc') return n*toCm(12, 'pt');
    }
    return function to(length, fromUnit, toUnit) {
      if (fromUnit === toUnit) return length;
      else if (toUnit === "cm") return toCm(length, fromUnit);
      else if (fromUnit === "cm") return length / toCm(1, toUnit);
      else return to(to(length, fromUnit, 'cm'), 'cm', toUnit);
    }
  })(),

  roundTo: function(n, quantum) {
    // `quantum` is something like 0.01,

    // for JS rounding to work we need the reciprocal
    quantum = 1 / quantum;
    return Math.round(n * quantum) / quantum;
  },

  detent: function(n, detent, grid, snap) {
    // This function is useful to implement smooth transitions and snapping.
    // Map all values that are within detent/2 of any multiple of grid to
    // that multiple. Otherwise, if snap is true, return self, meaning that
    // the values in the dead zone will never be returned. If snap is
    // false, then expand the range between dead zone so that it covers the
    // range between multiples of the grid, and scale the value by that
    // factor.
    // Examples:
    // // With snapping:
    // num.detent(0.11, 0.2, 0.5, true) // => 0.11
    // num.detent(0.39, 0.2, 0.5, true) // => 0.39
    // num.detent(0.55, 0.2, 0.5, true)  // => 0.5
    // num.detent(0.61, 0.2, 0.5, true)   // => 0.61
    // // Smooth transitions without snapping:
    // num.detent(0.1,  0.2, 0.5) // => 0
    // num.detent(0.11,  0.2, 0.5) // => 0.0166666
    // num.detent(0.34,  0.2, 0.5)  // => 0.4
    // num.detent(0.39,  0.2, 0.5) // => 0.4833334
    // num.detent(0.4,  0.2, 0.5) // => 0.5
    // num.detent(0.6,  0.2, 0.5) // => 0.5
    var r1 = exports.num.roundTo(n, grid); // Nearest multiple of grid
    if (Math.abs(n - r1) < detent / 2) return r1; // Snap to that multiple...
    if (snap) return n // ...and return n
    // or compute nearest end of dead zone
    var r2 = n < r1 ? r1 - (detent / 2) : r1 + (detent / 2);
    // and scale values between dead zones to fill range between multiples
    return r1 + ((n - r2) * grid / (grid - detent));
  },

  toDegrees: function(n) {
    // Example:
    // num.toDegrees(Math.PI/2) // => 90
    return (n * 180 / Math.PI) % 360;
  },

  toRadians: function(n) {
    // Example:
    // num.toRadians(180) // => 3.141592653589793
    return n / 180 * Math.PI;
  }

}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*
 * Util functions to print and work with JS date objects.
 */
;(function(exports) {
"use strict";

  var dateFormat = (function setupDateFormat() {

    /*
     * Date Format 1.2.3
     * (c) 2007-2009 Steven Levithan <stevenlevithan.com>
     * MIT license
     *
     * Includes enhancements by Scott Trenda <scott.trenda.net>
     * and Kris Kowal <cixar.com/~kris.kowal/>
     *
     * Accepts a date, a mask, or a date and a mask.
     * Returns a formatted version of the given date.
     * The date defaults to the current date/time.
     * The mask defaults to dateFormat.masks.default.
     */

    // http://blog.stevenlevithan.com/archives/date-time-format

    var dateFormat = (function() {
        var	token = /d{1,4}|m{1,4}|yy(?:yy)?|([HhMsTt])\1?|[LloSZ]|"[^"]*"|'[^']*'/g,
            timezone = /\b(?:[PMCEA][SDP]T|(?:Pacific|Mountain|Central|Eastern|Atlantic) (?:Standard|Daylight|Prevailing) Time|(?:GMT|UTC)(?:[-+]\d{4})?)\b/g,
            timezoneClip = /[^-+\dA-Z]/g,
            pad = function (val, len) {
                val = String(val);
                len = len || 2;
                while (val.length < len) val = "0" + val;
                return val;
            };

        // Regexes and supporting functions are cached through closure
        return function (date, mask, utc) {
            var dF = dateFormat;

            // You can't provide utc if you skip other args (use the "UTC:" mask prefix)
            if (arguments.length == 1 && Object.prototype.toString.call(date) == "[object String]" && !/\d/.test(date)) {
                mask = date;
                date = undefined;
            }

            // Passing date through Date applies Date.parse, if necessary
            date = date ? new Date(date) : new Date;
            if (isNaN(date)) throw SyntaxError("invalid date");

            mask = String(dF.masks[mask] || mask || dF.masks["default"]);

            // Allow setting the utc argument via the mask
            if (mask.slice(0, 4) == "UTC:") {
                mask = mask.slice(4);
                utc = true;
            }

            var	_ = utc ? "getUTC" : "get",
                d = date[_ + "Date"](),
            D = date[_ + "Day"](),
                m = date[_ + "Month"](),
            y = date[_ + "FullYear"](),
                H = date[_ + "Hours"](),
            M = date[_ + "Minutes"](),
                s = date[_ + "Seconds"](),
            L = date[_ + "Milliseconds"](),
                o = utc ? 0 : date.getTimezoneOffset(),
                flags = {
                    d:    d,
                dd:   pad(d),
                    ddd:  dF.i18n.dayNames[D],
                    dddd: dF.i18n.dayNames[D + 7],
                    m:    m + 1,
                    mm:   pad(m + 1),
                    mmm:  dF.i18n.monthNames[m],
                    mmmm: dF.i18n.monthNames[m + 12],
                    yy:   String(y).slice(2),
                yyyy: y,
                    h:    H % 12 || 12,
                    hh:   pad(H % 12 || 12),
                    H:    H,
                HH:   pad(H),
                    M:    M,
                MM:   pad(M),
                    s:    s,
                ss:   pad(s),
                    l:    pad(L, 3),
                    L:    pad(L > 99 ? Math.round(L / 10) : L),
                    t:    H < 12 ? "a"  : "p",
                    tt:   H < 12 ? "am" : "pm",
                    T:    H < 12 ? "A"  : "P",
                    TT:   H < 12 ? "AM" : "PM",
                    Z:    utc ? "UTC" : (String(date).match(timezone) || [""]).pop().replace(timezoneClip, ""),
                    o:    (o > 0 ? "-" : "+") + pad(Math.floor(Math.abs(o) / 60) * 100 + Math.abs(o) % 60, 4),
                    S:    ["th", "st", "nd", "rd"][d % 10 > 3 ? 0 : (d % 100 - d % 10 != 10) * d % 10]
                };

            return mask.replace(token, function ($0) {
                return $0 in flags ? flags[$0] : $0.slice(1, $0.length - 1);
            });
        };
    })();

    // Some common format strings
    dateFormat.masks = {
        "default":      "ddd mmm dd yyyy HH:MM:ss",
        shortDate:      "m/d/yy",
        mediumDate:     "mmm d, yyyy",
        longDate:       "mmmm d, yyyy",
        fullDate:       "dddd, mmmm d, yyyy",
        shortTime:      "h:MM TT",
        mediumTime:     "h:MM:ss TT",
        longTime:       "h:MM:ss TT Z",
        isoDate:        "yyyy-mm-dd",
        isoTime:        "HH:MM:ss",
        isoDateTime:    "yyyy-mm-dd'T'HH:MM:ss",
        isoUtcDateTime: "UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"
    };

    // Internationalization strings
    dateFormat.i18n = {
        dayNames: [
            "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",
            "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
        ],
        monthNames: [
            "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
            "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
        ]
    };

    return dateFormat;

  })(); // end of setupDateFormat

exports.date = {

  format: (function(date, mask, utc) {
    // Custom date / time stringifier. Provides default masks:
    //
    // Mask           | Pattern
    // ---------------|--------------------------------
    // default        | `"ddd mmm dd yyyy HH:MM:ss"`
    // shortDate      | `"m/d/yy"`
    // mediumDate     | `"mmm d, yyyy"`
    // longDate       | `"mmmm d, yyyy"`
    // fullDate       | `"dddd, mmmm d, yyyy"`
    // shortTime      | `"h:MM TT"`
    // mediumTime     | `"h:MM:ss TT"`
    // longTime       | `"h:MM:ss TT Z"`
    // isoDate        | `"yyyy-mm-dd"`
    // isoTime        | `"HH:MM:ss"`
    // isoDateTime    | `"yyyy-mm-dd'T'HH:MM:ss"`
    // isoUtcDateTime | `"UTC:yyyy-mm-dd'T'HH:MM:ss'Z'"`
    //
    // and internationalized strings via `date.format.i18n.dayNames`
    // and `date.format.i18n.dayNames`
    // Examples:
    //   date.format(new Date(), date.format.masks.longTime) // => "7:13:31 PM PDT"
    //   date.format(new Date(), "yyyy/mm/dd") // => "2014/10/09"
    return dateFormat;
  })(),

  equals: function(date, otherDate) {
    // show-in-doc
    return otherDate
      && otherDate instanceof Date
      && otherDate.getTime() === date.getTime();
  },

  relativeTo: function(date, otherDate) {
    // Prints a human readable difference of two Date objects. The older date
    // goes first.
    // Examples:
    //   var now = new Date();
    //   date.relativeTo(new Date(now-2000), now) // => "2 secs"
    //   date.relativeTo(new Date("10/11/2014"), new Date("10/12/2014")) // => "1 day"
    if (!(otherDate instanceof Date)) return '';
    if (otherDate < date) return '';
    if (otherDate === date) return 'now';
    var minuteString = 'min',
        secondString = 'sec',
        hourString   = 'hour',
        dayString    = 'day',
        diff         = otherDate - date,
        totalSecs    = Math.round(diff/1000),
        secs         = totalSecs % 60,
        mins         = Math.floor(totalSecs/60)%60,
        hours        = Math.floor(totalSecs/60/60)%24,
        days         = Math.floor(totalSecs/60/60/24),
        parts        = [];
    if (days > 0) {
      parts.push(days);
      if (days > 1) dayString += 's';
      parts.push(dayString);
    }
    if (hours > 0 && days < 2) {
      parts.push(hours);
      if (hours > 1) hourString += 's';
      parts.push(hourString);
    }
    if (mins > 0 && hours < 3 && days === 0) {
      parts.push(mins);
      if (mins > 1) minuteString += 's';
      parts.push(minuteString);
    }
    if (secs > 0 && mins < 3 && hours === 0 && days === 0) {
      parts.push(secs);
      if (secs > 1) secondString += 's';
      parts.push(secondString);
    }
    return parts.join(' ');
  }

};

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global process, global*/

/*
 * A lightweight class system that allows change classes at runtime.
 */

;(function(exports) {
"use strict";

var isNode = typeof process !== 'undefined' && process.versions && process.versions.node;
var Global = typeof window !== "undefined" ? window : global;

// ignore-in-doc
var classHelper = exports.classHelper = {

  anonymousCounter: 0,

  defaultCategoryName: 'default category',

  initializerTemplate: typeof lively !== "undefined" && lively.Config && lively.Config.loadRewrittenCode ?
    (function CLASS(){ classHelper.initializer.apply(this, arguments) }).toStringRewritten().replace(/__0/g, 'Global').replace(/__1/g, '__1') :
    (function CLASS(){ classHelper.initializer.apply(this, arguments) }).toString(),

  newInitializer: function(name) {
    // ignore-in-doc
    // this hack ensures that class instances have a name
    var src = classHelper.initializerTemplate.replace(/function\s*(CLASS)?\(\)/, 'function ' + name + '()');
    if (typeof lively !== "undefined" && lively.Config && lively.Config.loadRewrittenCode) {
      var idx = src.match('.*storeFrameInfo\([^\)]*, ([0-9]+)\)')[2];
      src = '__createClosure("core/lively/Base.js", ' + idx + ', Global, ' + src + ');';
    } else src += ' ' + name;
    var initializer = eval(src);
    initializer.displayName = name;
    return initializer;
  },

  initializer: function initializer() {
    // ignore-in-doc
    var firstArg = arguments[0];
    if (firstArg && firstArg.isInstanceRestorer) {
      // for deserializing instances just do nothing
    } else {
      // automatically call the initialize method
      this.initialize.apply(this, arguments);
    }
  },

  isValidIdentifier: (function() {
    // ignore-in-doc
    // As defined in the Ecmascript standard (http://www.ecma-international.org/ecma-262/5.1/#sec-7.6)
    // JS identifiers can consist out of several unicode character classes.
    // The code below was generated using the MIT licensed CSET library, see http://inimino.org/~inimino/blog/javascript_cset
    // The code to produce the regexps:
    // FIXME rk 2014-12-21 removed default to allow for lively namespaces
    var tester = /^(?!(?:do|if|in|for|let|new|try|var|case|else|enum|eval|false|null|this|true|void|with|break|catch|class|const|super|throw|while|yield|delete|export|import|public|return|static|switch|typeof|extends|finally|package|private|continue|debugger|function|arguments|interface|protected|implements|instanceof)$)[$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc][$A-Z\_a-z\xaa\xb5\xba\xc0-\xd6\xd8-\xf6\xf8-\u02c1\u02c6-\u02d1\u02e0-\u02e4\u02ec\u02ee\u0370-\u0374\u0376\u0377\u037a-\u037d\u0386\u0388-\u038a\u038c\u038e-\u03a1\u03a3-\u03f5\u03f7-\u0481\u048a-\u0527\u0531-\u0556\u0559\u0561-\u0587\u05d0-\u05ea\u05f0-\u05f2\u0620-\u064a\u066e\u066f\u0671-\u06d3\u06d5\u06e5\u06e6\u06ee\u06ef\u06fa-\u06fc\u06ff\u0710\u0712-\u072f\u074d-\u07a5\u07b1\u07ca-\u07ea\u07f4\u07f5\u07fa\u0800-\u0815\u081a\u0824\u0828\u0840-\u0858\u08a0\u08a2-\u08ac\u0904-\u0939\u093d\u0950\u0958-\u0961\u0971-\u0977\u0979-\u097f\u0985-\u098c\u098f\u0990\u0993-\u09a8\u09aa-\u09b0\u09b2\u09b6-\u09b9\u09bd\u09ce\u09dc\u09dd\u09df-\u09e1\u09f0\u09f1\u0a05-\u0a0a\u0a0f\u0a10\u0a13-\u0a28\u0a2a-\u0a30\u0a32\u0a33\u0a35\u0a36\u0a38\u0a39\u0a59-\u0a5c\u0a5e\u0a72-\u0a74\u0a85-\u0a8d\u0a8f-\u0a91\u0a93-\u0aa8\u0aaa-\u0ab0\u0ab2\u0ab3\u0ab5-\u0ab9\u0abd\u0ad0\u0ae0\u0ae1\u0b05-\u0b0c\u0b0f\u0b10\u0b13-\u0b28\u0b2a-\u0b30\u0b32\u0b33\u0b35-\u0b39\u0b3d\u0b5c\u0b5d\u0b5f-\u0b61\u0b71\u0b83\u0b85-\u0b8a\u0b8e-\u0b90\u0b92-\u0b95\u0b99\u0b9a\u0b9c\u0b9e\u0b9f\u0ba3\u0ba4\u0ba8-\u0baa\u0bae-\u0bb9\u0bd0\u0c05-\u0c0c\u0c0e-\u0c10\u0c12-\u0c28\u0c2a-\u0c33\u0c35-\u0c39\u0c3d\u0c58\u0c59\u0c60\u0c61\u0c85-\u0c8c\u0c8e-\u0c90\u0c92-\u0ca8\u0caa-\u0cb3\u0cb5-\u0cb9\u0cbd\u0cde\u0ce0\u0ce1\u0cf1\u0cf2\u0d05-\u0d0c\u0d0e-\u0d10\u0d12-\u0d3a\u0d3d\u0d4e\u0d60\u0d61\u0d7a-\u0d7f\u0d85-\u0d96\u0d9a-\u0db1\u0db3-\u0dbb\u0dbd\u0dc0-\u0dc6\u0e01-\u0e30\u0e32\u0e33\u0e40-\u0e46\u0e81\u0e82\u0e84\u0e87\u0e88\u0e8a\u0e8d\u0e94-\u0e97\u0e99-\u0e9f\u0ea1-\u0ea3\u0ea5\u0ea7\u0eaa\u0eab\u0ead-\u0eb0\u0eb2\u0eb3\u0ebd\u0ec0-\u0ec4\u0ec6\u0edc-\u0edf\u0f00\u0f40-\u0f47\u0f49-\u0f6c\u0f88-\u0f8c\u1000-\u102a\u103f\u1050-\u1055\u105a-\u105d\u1061\u1065\u1066\u106e-\u1070\u1075-\u1081\u108e\u10a0-\u10c5\u10c7\u10cd\u10d0-\u10fa\u10fc-\u1248\u124a-\u124d\u1250-\u1256\u1258\u125a-\u125d\u1260-\u1288\u128a-\u128d\u1290-\u12b0\u12b2-\u12b5\u12b8-\u12be\u12c0\u12c2-\u12c5\u12c8-\u12d6\u12d8-\u1310\u1312-\u1315\u1318-\u135a\u1380-\u138f\u13a0-\u13f4\u1401-\u166c\u166f-\u167f\u1681-\u169a\u16a0-\u16ea\u16ee-\u16f0\u1700-\u170c\u170e-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176c\u176e-\u1770\u1780-\u17b3\u17d7\u17dc\u1820-\u1877\u1880-\u18a8\u18aa\u18b0-\u18f5\u1900-\u191c\u1950-\u196d\u1970-\u1974\u1980-\u19ab\u19c1-\u19c7\u1a00-\u1a16\u1a20-\u1a54\u1aa7\u1b05-\u1b33\u1b45-\u1b4b\u1b83-\u1ba0\u1bae\u1baf\u1bba-\u1be5\u1c00-\u1c23\u1c4d-\u1c4f\u1c5a-\u1c7d\u1ce9-\u1cec\u1cee-\u1cf1\u1cf5\u1cf6\u1d00-\u1dbf\u1e00-\u1f15\u1f18-\u1f1d\u1f20-\u1f45\u1f48-\u1f4d\u1f50-\u1f57\u1f59\u1f5b\u1f5d\u1f5f-\u1f7d\u1f80-\u1fb4\u1fb6-\u1fbc\u1fbe\u1fc2-\u1fc4\u1fc6-\u1fcc\u1fd0-\u1fd3\u1fd6-\u1fdb\u1fe0-\u1fec\u1ff2-\u1ff4\u1ff6-\u1ffc\u2071\u207f\u2090-\u209c\u2102\u2107\u210a-\u2113\u2115\u2119-\u211d\u2124\u2126\u2128\u212a-\u212d\u212f-\u2139\u213c-\u213f\u2145-\u2149\u214e\u2160-\u2188\u2c00-\u2c2e\u2c30-\u2c5e\u2c60-\u2ce4\u2ceb-\u2cee\u2cf2\u2cf3\u2d00-\u2d25\u2d27\u2d2d\u2d30-\u2d67\u2d6f\u2d80-\u2d96\u2da0-\u2da6\u2da8-\u2dae\u2db0-\u2db6\u2db8-\u2dbe\u2dc0-\u2dc6\u2dc8-\u2dce\u2dd0-\u2dd6\u2dd8-\u2dde\u2e2f\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303c\u3041-\u3096\u309d-\u309f\u30a1-\u30fa\u30fc-\u30ff\u3105-\u312d\u3131-\u318e\u31a0-\u31ba\u31f0-\u31ff\u3400-\u4db5\u4e00-\u9fcc\ua000-\ua48c\ua4d0-\ua4fd\ua500-\ua60c\ua610-\ua61f\ua62a\ua62b\ua640-\ua66e\ua67f-\ua697\ua6a0-\ua6ef\ua717-\ua71f\ua722-\ua788\ua78b-\ua78e\ua790-\ua793\ua7a0-\ua7aa\ua7f8-\ua801\ua803-\ua805\ua807-\ua80a\ua80c-\ua822\ua840-\ua873\ua882-\ua8b3\ua8f2-\ua8f7\ua8fb\ua90a-\ua925\ua930-\ua946\ua960-\ua97c\ua984-\ua9b2\ua9cf\uaa00-\uaa28\uaa40-\uaa42\uaa44-\uaa4b\uaa60-\uaa76\uaa7a\uaa80-\uaaaf\uaab1\uaab5\uaab6\uaab9-\uaabd\uaac0\uaac2\uaadb-\uaadd\uaae0-\uaaea\uaaf2-\uaaf4\uab01-\uab06\uab09-\uab0e\uab11-\uab16\uab20-\uab26\uab28-\uab2e\uabc0-\uabe2\uac00-\ud7a3\ud7b0-\ud7c6\ud7cb-\ud7fb\uf900-\ufa6d\ufa70-\ufad9\ufb00-\ufb06\ufb13-\ufb17\ufb1d\ufb1f-\ufb28\ufb2a-\ufb36\ufb38-\ufb3c\ufb3e\ufb40\ufb41\ufb43\ufb44\ufb46-\ufbb1\ufbd3-\ufd3d\ufd50-\ufd8f\ufd92-\ufdc7\ufdf0-\ufdfb\ufe70-\ufe74\ufe76-\ufefc\uff21-\uff3a\uff41-\uff5a\uff66-\uffbe\uffc2-\uffc7\uffca-\uffcf\uffd2-\uffd7\uffda-\uffdc0-9\u0300-\u036f\u0483-\u0487\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7\u0610-\u061a\u064b-\u0669\u0670\u06d6-\u06dc\u06df-\u06e4\u06e7\u06e8\u06ea-\u06ed\u06f0-\u06f9\u0711\u0730-\u074a\u07a6-\u07b0\u07c0-\u07c9\u07eb-\u07f3\u0816-\u0819\u081b-\u0823\u0825-\u0827\u0829-\u082d\u0859-\u085b\u08e4-\u08fe\u0900-\u0903\u093a-\u093c\u093e-\u094f\u0951-\u0957\u0962\u0963\u0966-\u096f\u0981-\u0983\u09bc\u09be-\u09c4\u09c7\u09c8\u09cb-\u09cd\u09d7\u09e2\u09e3\u09e6-\u09ef\u0a01-\u0a03\u0a3c\u0a3e-\u0a42\u0a47\u0a48\u0a4b-\u0a4d\u0a51\u0a66-\u0a71\u0a75\u0a81-\u0a83\u0abc\u0abe-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acd\u0ae2\u0ae3\u0ae6-\u0aef\u0b01-\u0b03\u0b3c\u0b3e-\u0b44\u0b47\u0b48\u0b4b-\u0b4d\u0b56\u0b57\u0b62\u0b63\u0b66-\u0b6f\u0b82\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcd\u0bd7\u0be6-\u0bef\u0c01-\u0c03\u0c3e-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55\u0c56\u0c62\u0c63\u0c66-\u0c6f\u0c82\u0c83\u0cbc\u0cbe-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5\u0cd6\u0ce2\u0ce3\u0ce6-\u0cef\u0d02\u0d03\u0d3e-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57\u0d62\u0d63\u0d66-\u0d6f\u0d82\u0d83\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2\u0df3\u0e31\u0e34-\u0e3a\u0e47-\u0e4e\u0e50-\u0e59\u0eb1\u0eb4-\u0eb9\u0ebb\u0ebc\u0ec8-\u0ecd\u0ed0-\u0ed9\u0f18\u0f19\u0f20-\u0f29\u0f35\u0f37\u0f39\u0f3e\u0f3f\u0f71-\u0f84\u0f86\u0f87\u0f8d-\u0f97\u0f99-\u0fbc\u0fc6\u102b-\u103e\u1040-\u1049\u1056-\u1059\u105e-\u1060\u1062-\u1064\u1067-\u106d\u1071-\u1074\u1082-\u108d\u108f-\u109d\u135d-\u135f\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17b4-\u17d3\u17dd\u17e0-\u17e9\u180b-\u180d\u1810-\u1819\u18a9\u1920-\u192b\u1930-\u193b\u1946-\u194f\u19b0-\u19c0\u19c8\u19c9\u19d0-\u19d9\u1a17-\u1a1b\u1a55-\u1a5e\u1a60-\u1a7c\u1a7f-\u1a89\u1a90-\u1a99\u1b00-\u1b04\u1b34-\u1b44\u1b50-\u1b59\u1b6b-\u1b73\u1b80-\u1b82\u1ba1-\u1bad\u1bb0-\u1bb9\u1be6-\u1bf3\u1c24-\u1c37\u1c40-\u1c49\u1c50-\u1c59\u1cd0-\u1cd2\u1cd4-\u1ce8\u1ced\u1cf2-\u1cf4\u1dc0-\u1de6\u1dfc-\u1dff\u200c\u200d\u203f\u2040\u2054\u20d0-\u20dc\u20e1\u20e5-\u20f0\u2cef-\u2cf1\u2d7f\u2de0-\u2dff\u302a-\u302f\u3099\u309a\ua620-\ua629\ua66f\ua674-\ua67d\ua69f\ua6f0\ua6f1\ua802\ua806\ua80b\ua823-\ua827\ua880\ua881\ua8b4-\ua8c4\ua8d0-\ua8d9\ua8e0-\ua8f1\ua900-\ua909\ua926-\ua92d\ua947-\ua953\ua980-\ua983\ua9b3-\ua9c0\ua9d0-\ua9d9\uaa29-\uaa36\uaa43\uaa4c\uaa4d\uaa50-\uaa59\uaa7b\uaab0\uaab2-\uaab4\uaab7\uaab8\uaabe\uaabf\uaac1\uaaeb-\uaaef\uaaf5\uaaf6\uabe3-\uabea\uabec\uabed\uabf0-\uabf9\ufb1e\ufe00-\ufe0f\ufe20-\ufe26\ufe33\ufe34\ufe4d-\ufe4f\uff10-\uff19\uff3f]*$/
    return function(string) { return tester.test(string); }
  })(),

  isClass: function(object) {
    if (object === Object
      || object === Array
      || object === Function
      || object === String
      || object === Boolean
      || object === Date
      || object === RegExp
      || object === Number) {
      return true;
    }
    return (object instanceof Function) && (object.superclass !== undefined);
  },

  className: function(cl) {
    if (cl === Object) return "Object"
    if (cl === Array) return "Array"
    if (cl === Function) return "Function"
    if (cl === String) return "String"
    if (cl === Boolean) return "Boolean"
    if (cl === Date) return "Date"
    if (cl === RegExp) return "RegExp"
    if (cl === Number) return "Number"
    return cl.type;
  },

  forName: function forName(name) {
    // ignore-in-doc
    // lookup the class object given the qualified name
    var ns = classHelper.namespaceFor(name),
      shortName = classHelper.unqualifiedNameFor(name);
    return ns[shortName];
  },

  deleteObjectNamed: function(name) {
    var ns = classHelper.namespaceFor(name),
      shortName = classHelper.unqualifiedNameFor(name);
    delete ns[shortName];
  },

  unqualifiedNameFor: function(name) {
    // ignore-in-doc
    var lastDot = name.lastIndexOf('.'), // lastDot may be -1
        unqualifiedName = name.substring(lastDot + 1);
    if (!classHelper.isValidIdentifier(unqualifiedName)) throw new Error('not a name ' + unqualifiedName);
    return unqualifiedName;
  },

  namespaceFor: function(className) {
    // ignore-in-doc
    // get the namespace object given the qualified name
    var lastDot = className ? className.lastIndexOf('.') : -1;
    if (lastDot < 0) return Global;
    var nsName = className.slice(0, lastDot);
    if (typeof lively !== "undefined" && lively.module) return lively.module(nsName);
    var path = exports.Path(nsName),
        ns = path.get(Global);
    return ns || path.set(Global, {}, true);
  },

  withAllClassNames: function(scope, callback) {
    for (var name in scope) {
      try {
        if (classHelper.isClass(scope[name])) callback(name);
      } catch (er) { /*FF exceptions*/ }
    }
    callback("Object");
    callback("Global");
  },

  getConstructor: function(object) {
    var c = object.constructor;
    return (c && c.getOriginal) ? c.getOriginal() : c;
  },

  getPrototype: function(object) {
    return this.getConstructor(object).prototype;
  },

  applyPrototypeMethod: function(methodName, target, args) {
    var method = this.getPrototype(target);
    if (!method) throw new Error("method " + methodName + " not found");
    return method.apply(this, args);
  },

  getSuperConstructor: function(object) {
    return this.getConstructor(object).superclass;
  },

  getSuperPrototype: function(object) {
    var sup = this.getSuperConstructor(object);
    return sup && sup.prototype;
  },

  addPins: function(cls, spec) {
    // ignore-in-doc
    if (Global.Relay) {
      classHelper.addMixin(cls, Relay.newDelegationMixin(spec).prototype);
      return;
    }
    // ignore-in-doc
    // this is for refactoring away from Relay and friends
    if (!Object.isArray(spec)) throw new Error('Cannot deal with non-Array spec in addPins');
    function unstripName(name) { return name.replace(/[\+|\-]?(.*)/, '$1') };
    function needsSetter(name) { return !exports.string.startsWith(name, '-') };
    function needsGetter(name) { return !exports.string.startsWith(name, '+') };
    var mixinSpec = {};
    spec.forEach(function(specString) {
      var name = unstripName(specString);
      if (needsSetter(specString))
        mixinSpec['set' + name] = function(value) { return this['_' + name] = value }
      if (needsGetter(specString))
        mixinSpec['get' + name] = function() { return this['_' + name] }
    })
    classHelper.addMixin(cls, mixinSpec);
  },

  addMixin: function(cls, source) {
    var spec = {};
    for (var prop in source) {
      var value = source[prop];
      switch (prop) {
        case "constructor": case "initialize": case "deserialize": case "copyFrom":
        case "toString": case "definition": case "description":
          break;
        default:
          if (cls.prototype[prop] === undefined) // do not override existing values!
            spec[prop] = value;
      }
    }
    cls.addMethods(spec);
  }

};

// Methods for creating and modifying class objects.
exports.class
= {

  create: function(/*... */) {
    // Main method of the class system.
    // First argument can be the superclass or if no super class is specified
    // Object is the superclass. Second arg is the class name. The following
    // argument can be a JavaScript object whose keys and values will be
    // installed as attributes/methods of the class.
    // 
    // Note that when a class with the same name already exists it will be
    // modified so that interactive development is possible. To completely
    // remove a class use `lively.lang.class.remove(TheClass)`
    // Example:
    // lively.lang.class.create("NewClass", {
    //   method: function() { return 23; }
    // });
    // var instance = new NewClass();
    // instance.method() // => 23
    // //
    // // Alternatively class with superclass as first argument
    // lively.lang.class.create(NewClass, "NewClass2", {
    //   method: function($super) { return $super() + 2; }
    // });
    // var instance = new NewClass2();
    // instance.method() // => 25

    var args = exports.arr.from(arguments),
        superclass = args.shift(),
        className,
        targetScope = Global,
        shortName = null;

    if (!superclass || typeof superclass === "string") {
      className = superclass;
      superclass = Object;
    } else className = args.shift();

    if (className) {
      targetScope = classHelper.namespaceFor(className);
      shortName = classHelper.unqualifiedNameFor(className);
    }  else {
      shortName = "anonymous_" + (classHelper.anonymousCounter++);
      className = shortName;
    }

    var klass;
    if (className && targetScope[shortName] && (targetScope[shortName].superclass === superclass)) {
      // preserve the class to allow using the subclass construct in interactive development
      klass = targetScope[shortName];
    } else {
      klass = classHelper.newInitializer(shortName);
      klass.superclass = superclass;
      var protoclass = function() { }; // that's the constructor of the new prototype object
      protoclass.prototype = superclass.prototype;
      klass.prototype = new protoclass();
      klass.prototype.constructor = klass;
      klass.type = className; // KP: .name would be better but js ignores .name on anonymous functions
      klass.displayName = className; // for debugging, because name can not be assigned
      if (className) targetScope[shortName] = klass; // otherwise it's anonymous

      // remember the module that contains the class def
      if (typeof lively !== "undefined" && lively.Module && lively.Module.current)
        klass.sourceModule = lively.Module.current();

      // add a more appropriate toString implementation
      klass.toString = function() {
        var initCategory = exports.arr.detect(
                            Object.keys(klass.categories || {}),
                            function(category) {
                              return klass.categories[category].indexOf("initialize") > -1;
                            }) || "default category";
        return exports.string.format(
          'lively.lang.class.create(%s, "%s",\n"%s", {\n  initialize: %s\n}/*...*/)',
          klass.superclass.type || klass.superclass.name,
          klass.type, initCategory,
          klass.prototype.initialize);
      }
    };

    // the remaining args should be category strings or source objects
    exports.class.addMethods.apply(Global, [klass].concat(args));

    if (!klass.prototype.initialize)
      klass.prototype.initialize = function() {};

    return klass;
  },

  addMethods: function(/*...*/) {
    // Takes an exiting class and adds/replaces its methods by the supplied JS
    // object.

    var klass = arguments[0],
        args = arguments,
        category = classHelper.defaultCategoryName,
        traits = [];
    for (var i = 1; i < args.length; i++) {
      if (typeof args[i] === 'string') {
        category = args[i];
      } else if (Global.RealTrait && args[i] instanceof RealTrait) {
        // FIXME Traits are optional and defined in lively.Traits
        // This should go somewhere into lively.Traits...
        // we apply traits afterwards because they can override behavior
        traits.push(args[i]);
      } else {
        exports.class.addCategorizedMethods(klass, category,
          args[i] instanceof Function ? (args[i])() : args[i]);
      }
    }
    for (i = 0; i < traits.length; i++) traits[i].applyTo(klass);

    return klass;
  },

  addCategorizedMethods: function(klass, categoryName, source) {
    // first parameter is a category name
    // copy all the methods and properties from {source} into the
    // prototype property of the receiver, which is intended to be
    // a class constructor.    Method arguments named '$super' are treated
    // specially, see Prototype.js documentation for "classHelper.create()" for details.
    // derived from classHelper.Methods.addMethods() in prototype.js

    // prepare the categories
    if (!klass.categories) klass.categories = {};
    if (!klass.categories[categoryName]) klass.categories[categoryName] = [];
    var currentCategoryNames = klass.categories[categoryName];

    if (!source)
      throw dbgOn(new Error('no source in addCategorizedMethods!'));

    var ancestor = klass.superclass && klass.superclass.prototype;

    var className = klass.type || "Anonymous";

    for (var property in source) {

      if (property === 'constructor') continue;

      var getter = source.__lookupGetter__(property);
      if (getter) klass.prototype.__defineGetter__(property, getter);
      var setter = source.__lookupSetter__(property);
      if (setter) klass.prototype.__defineSetter__(property, setter);
      if (getter || setter) continue;

      currentCategoryNames.push(property);

      var value = source[property];
      // weirdly, RegExps are functions in Safari, so testing for
      // Object.isFunction on regexp field values will return true.
      // But they're not full-blown functions and don't
      // inherit argumentNames from Function.prototype

      var hasSuperCall = ancestor && typeof value === 'function' &&
          exports.fun.argumentNames(value)[0] == "$super";
      if (hasSuperCall) {
        // wrapped in a function to save the value of 'method' for advice
        (function() {
          var method = value;
          var advice = (function(m) {
            var cs = function callSuper() {
              var method = ancestor[m];
              if (!method) {
                throw new Error(exports.string.format('Trying to call super of' +
                  '%s>>%s but super method non existing in %s',
                  className, m, ancestor.constructor.type));
              }
              return method.apply(this, arguments);
            };
            cs.varMapping = {ancestor: ancestor, m: m};
            cs.isSuperCall = true;
            return cs;
          })(property);
  
          advice.methodName = "$super:" + (klass.superclass ? klass.superclass.type + ">>" : "") + property;
  
          value = exports.obj.extend(exports.fun.wrap(advice, method), {
            valueOf:  function() { return method; },
            toString: function() { return method.toString(); },
            originalFunction: method,
            methodName: advice.methodName,
            isSuperWrapper: true
          });
          // for lively.Closures
          method.varMapping = {$super: advice};
        })();
      }

      klass.prototype[property] = value;

      if (property === "formals") { // rk FIXME remove the cruft
        // special property (used to be pins, but now called formals to disambiguate old and new style
        classHelper.addPins(klass, value);
      } else if (typeof value === 'function') {
        // remember name for profiling in WebKit
        value.displayName = className + "$" + property;

        // remember where it was defined
        if (typeof lively !== "undefined" && lively.Module && lively.Module.current)
          value.sourceModule = lively.Module.current();

        for (; value; value = value.originalFunction) {
          value.declaredClass = klass.prototype.constructor.type;
          value.methodName = property;
        }
      }
    } // end of for (var property in source)

    return klass;
  },

  addProperties: function(klass, spec, recordType) {
    // ignore-in-doc
    classHelper.addMixin(klass, recordType.prototype.create(spec).prototype);
  },

  isSubclassOf: function(klassA, klassB) {
    // Is `klassA` a descendent of klassB?
    return exports.class.superclasses(klassA).indexOf(klassB) > -1;
  },

  superclasses: function(klass) {
    // show-in-doc
    if (!klass.superclass) return [];
    if (klass.superclass === Object) return [Object];
    return exports.class.superclasses(klass.superclass).concat([klass.superclass]);
  },

  categoryNameFor: function(klass, propName) {
    // ignore-in-doc
    for (var categoryName in klass.categories) {
      if (klass.categories[categoryName].indexOf(propName) > -1)
        return categoryName;
    }
    return null;
  },

  remove: function(klass) {
    // Remove `klass`, modifies the namespace the class is installed in.
    var ownerNamespace = classHelper.namespaceFor(klass.type),
        ownName = classHelper.unqualifiedNameFor(klass.type);
    delete ownerNamespace[ownName];
  }
}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global clearTimeout, setTimeout, clearInterval, setInterval*/

/*
 * A pluggable interface to provide asynchronous, actor-like message
 * communication between JavaScript systems. Provides a unified message protocol
 * and send / receive methods.
 */
;(function(exports) {
"use strict";

var arr = exports.arr;
if (!arr) throw new Error("messenger.js needs collection.js!")

var fun = exports.fun;
if (!fun) throw new Error("messenger.js needs function.js!")

var string = exports.string;
if (!string) throw new Error("messenger.js needs string.js!")

var events = exports.events;
if (!events) throw new Error("messenger.js needs events.js!")

var obj = exports.obj;
if (!obj) throw new Error("messenger.js needs object.js!")

var OFFLINE = 'offline';
var ONLINE = 'online';
var CONNECTING = 'connecting';

/*

A messenger is an object that provides a common, message-based interface. Messengers expect you to provide an implementation of a small number of methods: `send`, `listen`, `close`, and `isOnline`. A messenger will then provide a unified interface for sending and receiving messages. Common boilerplate functionality such as queuing messages, error handling, dealing with instable connections, heartbeats, etc. is handled by the messenger object automatically (and can be parameterized).

This allows to use a single interface across a range of heterogeneous objects without having to implement every detail of the abstraction repeatedly. This is especially valuable when dealing with asynchronous or remote communication (web workers, XHR requests, WebSockets, node.js processes, ...).

To see a minimal example of how to use messengers for the local communication between JavaScript objects [see this example](#messenger-example).

A more sophisticated example of messengers is [the worker implementation](worker.js) which provides an actor-like worker interface that uses web workers in web browsers and child_process.fork in node.js.

```js
var msger = lively.lang.messenger.create({
  send: function(msg, onSendDone) { console.log(msg); onSendDone(); },
  listen: function(thenDo) { thenDo(); },
  close: function(thenDo) { thenDo(); },
  isOnline: function() { return true }
});
```

#### Messenger interface

The interface methods are build to enable an user to send and receive
messages. Each messenger provides the following methods:

##### msger.id()

Each msger has an id that can either be defined by the user when the
msger is created or is automatically assigned. The id should be unique for each
messenger in a messenger network. It is used as the `target` attribute to
address messages and internally in the messaging implementation for routing.
See the [message protocol](#messenger-message-protocol) description for more info.

##### msger.isOnline()

Can the msger send and receive messages right now?

##### msger.heartbeatEnabled()

Does the msger send automated heartbeat messages?

##### msger.listen(optionalCallback)

Brings the messenger "online": Starts listening for messages and brings it
into a state to send messages. `optionalCallback` is a function that is called
when listening begins. It should accept one argument `error` that is null if no
error occured when listening was started, an Error object otherwise.

##### msger.send(msg, onReceiveFunc)

Sends a message. The message should be structured according to the [message
protocol](#messenger-message-protocol). `onReceiveFunc` is triggered when the `msg` is being
answered. `onReceiveFunc` should take two arguments: `error` and `answer`.
`answer` is itself a message object.

##### msger.sendTo(target, action, data, onReceiveFunc)

A simpler `send`, the `msg` object is automatically assembled. `target`
should be an id of the receiver and `action` a string naming the service that
should be triggered on the receiver.

##### msger.answer(msg, data, expectMore, whenSend)

Assembles an answer message for `msg` that includes `data`. `expectMore`
should be truthy when multiple answers should be send (a streaming response,
see the [messaging protocol](#messenger-message-protocol)).

##### msger.close(thenDo)

Stops listening.

##### msger.whenOnline(thenDo)

Registers a callback that is triggered as soon as a listen attempt succeeds
(or when the messenger is listening already then it succeeds immediately).

##### msger.outgoingMessages()

Returns the messages that are currently inflight or not yet send.

##### msger.addServices(serviceSpec)

Add services to the messenger. `serviceSpec` should be  JS object whose keys
correspond to message actions:

```js
msg.addServices({
  helloWorld: function(msg, messenger) {
    messenger.answer(msg, "received a message!");
  }
});
```

See the examples below for more information.

##### *[event]* msger.on("message")

To allow users to receive messages that were not initiated by a send,
messengers are [event emitters](events.js) that emit `"message"` events
whenever they receive a new message.

The messenger object is used to create new messenger interfaces and ties
them to a specific implementation. Please see [worker.js]() for examples of
how web workers and node.js processes are wrapped to provide a cross-platform
interface to a worker abstraction.


#### <a name="messenger-message-protocol"></a>Message protocol

A message is a JSON object with the following fields:

```js
var messageSchema = {

    // REQUIRED selector for service lookup. By convention action gets
    // postfixed with "Result" for response messages
    action: STRING,

    // REQUIRED target of the message, the id of the receiver
    target: UUID,

    // OPTIONAL arguments
    data: OBJECT,

    // OPTIONAL identifier of the message, will be provided if not set by user
    messageId: UUID,

    // OPTIONAL sender of the message, will be provided if not set by user
    sender: UUID,

    // OPTIONAL identifier of a message that this message answers, will be provided
    inResponseTo: UUID,

    // OPTIONAL if message is an answer. Can be interpreted by the receiver as
    // a streaming response. Lively participants (tracker and clients) will
    // trigger data bindings and fire callbacks for a message for every streaming
    // response
    expectMoreResponses: BOOL,

    // EXPERIMENTAL UUIDs of trackers/sessions handlers that forwarded this
    // message
    route: ARRAY
}
```

The `sendTo` and `answer` methods of messengers will automatically create these
messages. If the user invokes the `send` method then a JS object according to
the schema above should be passed as the first argument.

#### <a name="messenger-example"></a>Messenger examples

The following code implements what is needed to use a messenger to communicate
between any number of local JavaScript objects. Instead of dispatching methods using
a local list of messengers you will most likely use an existing networking /
messaging mechanism.

See the [worker](#) and [its implementation](worker.js) for a real use case in
which forking processes in the browser using Web Workers and in node.js using
child_process.fork is unified.

```js
// spec that defines message sending in terms of receivers in the messengers list
var messengers = [];
var messengerSpec = {
  send: function(msg, onSendDone) {
    var err = null, recv = arr.detect(messengers, function(ea) {
          return ea.id() === msg.target; });
    if (recv) recv.onMessage(msg);
    else err = new Error("Could not find receiver " + msg.target);
    onSendDone(err);
  },
  listen: function(thenDo) { arr.pushIfNotIncluded(messengers, this); },
  close: function(thenDo) { arr.remove(messengers, this); },
  isOnline: function() { return arr.include(messengers, this); }
};

// Create the messengers and add a simple "service"
var msger1 = messenger.create(messengerSpec);
var msger2 = messenger.create(messengerSpec);
msger2.addServices({
  add: function(msg, msger) { msger.answer(msg, {result: msg.data.a + msg.data.b}); }
});

// turn'em on...
msger1.listen();
msger2.listen();

// ...and action!
msger1.sendTo(msger2.id(), 'add', {a: 3, b: 4},
  function(err, answer) { alert(answer.data.result); });
```

*/


var messenger = exports.messenger = {
  
  OFFLINE: OFFLINE,
  ONLINE: ONLINE,
  CONNECTING: CONNECTING,

  create: function(spec) {

    var expectedMethods = [
      {name: "send", args: ['msg', 'callback']},
      {name: "listen", args: ['messenger', 'callback']},
      {name: "close", args: ['messenger', 'callback']},
      {name: "isOnline", args: []}
    ];
    expectedMethods.forEach(function(exp) {
      if (spec[exp.name]) return;
        var msg = "message implementation needs function "
                + exp.name + "(" + (exp.args.join(',')) + ")";
        throw new Error(msg);
    });

    var heartbeatInterval = spec.sendHeartbeat && (spec.heartbeatInterval || 1000);
    var ignoreUnknownMessages = spec.hasOwnProperty("ignoreUnknownMessages") ? spec.ignoreUnknownMessages : false;

    var messenger = {

      _outgoing: [],
      _inflight: [],
      _id: spec.id || string.newUUID(),
      _ignoreUnknownMessages: ignoreUnknownMessages,
      _services: {},
      _messageCounter: 0,
      _messageResponseCallbacks: {},
      _whenOnlineCallbacks: [],
      _statusWatcherProc: null,
      _startHeartbeatProcessProc: null,
      _listenInProgress: null,
      _heartbeatInterval: heartbeatInterval,
      _status: OFFLINE,

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
      _runWhenOnlineCallbacks: function() {
        var cbs = arr.clone(messenger._whenOnlineCallbacks);
        messenger._whenOnlineCallbacks = [];
        cbs.forEach(function(ea) {
          try { ea.call(null, null, messenger); } catch (e) {
            console.error("error in _runWhenOnlineCallbacks: %s", e);
          }
        });
      },

      _ensureStatusWatcher: function() {
        if (messenger._statusWatcherProc) return;
        messenger._statusWatcherProc = setInterval(function() {
          if (messenger.isOnline() && messenger._whenOnlineCallbacks.length)
            messenger._runWhenOnlineCallbacks();
          var prevStatus = messenger._status;
          messenger._status = messenger.isOnline() ? ONLINE : OFFLINE;
          if (messenger._status !== ONLINE && messenger._statusWatcherProc) {
            messenger.reconnect();
          }
          if (messenger._status !== prevStatus && messenger.onStatusChange) {
            messenger.onStatusChange();
          }
        }, 20);
      },

      _addMissingData: function(msg) {
        if (!msg.target) throw new Error("Message needs target!");
        if (!msg.action) throw new Error("Message needs action!");
        if (!msg.data) msg.data = null;
        if (!msg.messageId) msg.messageId = string.newUUID();
        msg.sender = messenger.id();
        msg.messageIndex = messenger._messageCounter++;
        return msg;
      },

      _queueSend: function(msg, onReceiveFunc) {
        if (onReceiveFunc && typeof onReceiveFunc !== 'function')
          throw new Error("Expecing a when send callback, got: " + onReceiveFunc);
        messenger._outgoing.push([msg, onReceiveFunc]);
      },

      _deliverMessageQueue: function() {
        if (!spec.allowConcurrentSends && messenger._inflight.length) return;

        var queued = messenger._outgoing.shift();
        if (!queued) return;

        messenger._inflight.push(queued);
        if (messenger.isOnline()) deliver(queued);
        else messenger.whenOnline(function() { deliver(queued); });
        startTimeoutProc(queued);

        if (spec.allowConcurrentSends && messenger._outgoing.length)
          messenger._deliverMessageQueue();

        // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

        function deliver(queued) {
          // ignore-in-doc
          if (messenger._inflight.indexOf(queued) === -1) return; // timed out
          var msg = queued[0], callback = queued[1];
          if (callback)
            messenger._messageResponseCallbacks[msg.messageId] = callback;

          spec.send.call(messenger, msg, function(err) {
            arr.remove(messenger._inflight, queued);
            if (err) onSendError(err, queued);
            messenger._deliverMessageQueue();
          });
        }

        function startTimeoutProc(queued) {
          if (typeof spec.sendTimeout !== 'number') return;
          setTimeout(function() {
            if (messenger._inflight.indexOf(queued) === -1) return; // delivered
            arr.remove(messenger._inflight, queued);
            onSendError(new Error('Timeout sending message'), queued);
            messenger._deliverMessageQueue();
          }, spec.sendTimeout);
        }

        function onSendError(err, queued) {
          var msg = queued[0], callback = queued[1];
          delete messenger._messageResponseCallbacks[msg.messageId];
          console.error(err);
          callback && callback(err);
        }
      },

      _startHeartbeatProcess: function() {
        if (messenger._startHeartbeatProcessProc) return;
        messenger._startHeartbeatProcessProc = setTimeout(function() {
          spec.sendHeartbeat.call(messenger, function(err, result) {
            messenger._startHeartbeatProcessProc = null;
            messenger._startHeartbeatProcess();
          })
        }, messenger._heartbeatInterval);
      },

      // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

      id: function() { return messenger._id; },

      isOnline: function() { return spec.isOnline.call(messenger); },

      heartbeatEnabled: function() {
        return typeof messenger._heartbeatInterval === 'number';
      },

      listen: function(thenDo) {
        if (messenger._listenInProgress) return;
        messenger._listenInProgress = true;
        messenger._ensureStatusWatcher();
        return spec.listen.call(messenger, function(err) {
          messenger._listenInProgress = null;
          thenDo && thenDo(err);
          if (messenger.heartbeatEnabled())
            messenger._startHeartbeatProcess();
        });
        return messenger;
      },

      reconnect: function() {
        if (messenger._status === ONLINE) return;
        messenger.listen();
        return messenger;
      },

      send: function(msg, onReceiveFunc) {
        messenger._addMissingData(msg);
        messenger._queueSend(msg, onReceiveFunc);
        messenger._deliverMessageQueue();
        return msg;
      },

      sendTo: function(target, action, data, onReceiveFunc) {
        var msg = {target: target, action: action, data: data};
        return messenger.send(msg, onReceiveFunc);
      },

      onMessage: function(msg) {
        messenger.emit("message", msg);
        if (msg.inResponseTo) {
          var cb = messenger._messageResponseCallbacks[msg.inResponseTo];
          if (cb && !msg.expectMoreResponses) delete messenger._messageResponseCallbacks[msg.inResponseTo];
          if (cb) cb(null, msg);
        } else {
          var action = messenger._services[msg.action];
          if (action) {
            try {
              action.call(null, msg, messenger);
            } catch (e) {
              console.error("Error invoking service: " + e);
              messenger.answer(msg, {error: String(e)});
            }
          } else if (!messenger._ignoreUnknownMessages) {
            var err = new Error("messageNotUnderstood: " + msg.action);
            messenger.answer(msg, {error: String(err)});
          }
        }
      },

      answer: function(msg, data, expectMore, whenSend) {
        if (typeof expectMore === 'function') {
          whenSend = expectMore; expectMore = false; }
        var answer = {
          target: msg.sender,
          action: msg.action + 'Result',
          inResponseTo: msg.messageId,
          data: data};
        if (expectMore) answer.expectMoreResponses = true;
        return messenger.send(answer, whenSend);
      },

      close: function(thenDo) {
        clearInterval(messenger._statusWatcherProc);
        messenger._statusWatcherProc = null;
        spec.close.call(messenger, function(err) {
          messenger._status = OFFLINE;
          thenDo && thenDo(err);
        });
        return messenger;
      },

      whenOnline: function(thenDo) {
        messenger._whenOnlineCallbacks.push(thenDo);
        if (messenger.isOnline()) messenger._runWhenOnlineCallbacks();
        return messenger;
      },

      outgoingMessages: function() {
        return arr.pluck(messenger._inflight.concat(messenger._outgoing), 0);
      },

      addServices: function(serviceSpec) {
        obj.extend(messenger._services, serviceSpec);
        return messenger;
      }
    }

    if (spec.services) messenger.addServices(spec.services);
    events.makeEmitter(messenger);

    return messenger;
  }

};

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));
;/*global require, Worker, URL, webkitURL, Blob, BlobBuilder, process, require*/

/*
 * A platform-independent worker interface that will spawn new processes per
 * worker (if the platform you use it on supports it).
 */
;(function(exports) {
"use strict";

var isNodejs = typeof module !== 'undefined' && module.require;

// ignore-in-doc
// Code in worker setup is evaluated in the context of workers, it will get to
// workers in a stringified form(!).
var WorkerSetup = {

  loadDependenciesBrowser: function loadDependenciesBrowser(options) {
    importScripts.apply(this, options.scriptsToLoad || []);
  },

  loadDependenciesNodejs: function loadDependenciesNodejs(options) {
    var lv = global.lively || (global.lively = {});
    lv.lang = require(require("path").join(options.libLocation, "index"));
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // yoshiki and robert, 05/08/13: Inserted code that sets up the lively context
  // and globals of Lively and other required objects:
  initBrowserGlobals: function initBrowserGlobals(options) {
    remoteWorker.send = function(msg) { postMessage(msg); };
    Global = this;
    Global.window = Global;
    Global.console = Global.console || (function() {
      var c = {};
      ['log', 'error', 'warn'].forEach(function(name) {
        c[name] = function(/*args*/) {
          var string = arguments[0];
          for (var i = 1; i < arguments.length; i++)
            string = string.replace('%s', arguments[i]);
          remoteWorker.send({
            type: name,
            message: ['[', name.toUpperCase(), '] ', string].join('')
          });
        };
      });
      return c;
    })();
  },

  initOnMessageHandler: function initOnMessageHandler(options) {
    if (remoteWorker.on) remoteWorker.on('message', onMessage);
    else remoteWorker.onmessage = onMessage;

    function onMessage(msg) {
      msg = msg.data.data ? msg.data : msg;
      if (remoteWorker.messenger) remoteWorker.messenger.onMessage(msg);
      else if (msg.action == "close") {
        remoteWorker.send({type: "closed", workerReady: false});
        remoteWorker.close();
        return;
      }
    }
  },

  initWorkerInterface: function initWorkerInterface(options) {
    remoteWorker.callStringifiedFunction = function(stringifiedFunc, args, thenDo) {
      // ignore-in-doc
      // runs stringified function and passing args. stringifiedFunc might
      // be asynchronous if it takes an addaitional argument. In this case a
      // callback to call when the work is done is passed, otherwise thenDo
      // will be called immediatelly after creating and calling the function

      var func;
      try { func = eval('(' + stringifiedFunc + ')'); } catch (e) {
        thenDo(new Error("Cannot create function from string: " + e.stack || e));
        return;
      }

      // ignore-in-doc
      // when it takes one more arg then we assume that this is the callback
      // to be called by the run func when it considers to be done
      var usesCallback = func.length === args.length + 1;
      var whenDone = lively.lang.fun.once(function(err, result) {
        remoteWorker.isBusy = false; thenDo(err, result); })
      remoteWorker.isBusy = true;

      if (usesCallback) args.push(whenDone);

      try { var result = func.apply(remoteWorker, args.concat([whenDone])); } catch (e) {
        whenDone(e, null); return;
      }

      if (!usesCallback) whenDone(null, result);
    }

    remoteWorker.httpRequest = function (options) {
      if (!options.url) {
        console.log("Error, httpRequest needs url");
        return;
      }
      var req = new XMLHttpRequest(),
          method = options.method || 'GET';
      function handleStateChange() {
        if (req.readyState === 4) {
          // req.status
          options.done && options.done(req);
        }
      }
      req.onreadystatechange = handleStateChange;
      req.open(method, options.url);
      req.send();
    }

    remoteWorker.terminateIfNotBusyIn = function(ms) {
      setTimeout(function() {
        if (remoteWorker.isBusy) { remoteWorker.terminateIfNotBusyIn(ms); return; }
        remoteWorker.send({type: "closed", workerReady: false});
        remoteWorker.close();
      }, ms);
    }
  },

  // ignore-in-doc
  // setting up the worker messenger interface, this is how the worker
  // should be communicated with
  initWorkerMessenger: function initWorkerMessenger(options) {
    if (!options.useMessenger) return null;
    if (!lively.lang.messenger)
      throw new Error("worker.create requires messenger.js to be loaded!")
    if (!lively.lang.events)
      throw new Error("worker.create requires events.js to be loaded!")

    return remoteWorker.messenger = lively.lang.messenger.create({
      services: {

        remoteEval: function(msg, messenger) {
          var result;
          try { result = eval(msg.data.expr); } catch (e) {
            result = e.stack || e; }
          messenger.answer(msg, {result: String(result)});
        },

        run: function(msg, messenger) {
          var funcString = msg.data.func,
              args = msg.data.args;
          if (!funcString) { messenger.answer(msg, {error: 'no funcString'}); return; }
          remoteWorker.callStringifiedFunction(funcString, args, function(err, result) {
            messenger.answer(msg, {error: err ? String(err) : null, result: result});
          });
        },

        close: function(msg, messenger) {
          messenger.answer(msg, {status: "OK"});
          remoteWorker.send({type: "closed", workerReady: false});
          remoteWorker.close();
        }
      },

      isOnline: function() { return true; },
      send: function(msg, whenSend) { remoteWorker.send(msg); whenSend(); },
      listen: function(whenListening) { whenListening(); },
      close: function(whenClosed) { remoteWorker.send({type: "closed", workerReady: false}); remoteWorker.close(); }

    });
  }

}

var BrowserWorker = {

  create: function(options) {
    // ignore-in-doc
    // this function instantiates a browser worker object. We provide a
    // messenger-based interface to the pure Worker. Please use create to get an
    // improved interface to a worker

    options = options || {};

    // ignore-in-doc
    // figure out where the other lang libs can be loaded from
    if (!options.libLocation && !options.scriptsToLoad) {
      var workerScript = document.querySelector("script[src$=\"worker.js\"]");
      if (!workerScript) throw new Error("Cannot find library path to start worker. Use worker.create({libLocation: \"...\"}) to explicitly define the path!");
      options.libLocation = workerScript.src.replace(/worker.js$/, '');
    }

    var workerSetupCode = String(workerSetupFunction).replace("__FUNCTIONDECLARATIONS__", [
      WorkerSetup.initBrowserGlobals,
      WorkerSetup.loadDependenciesBrowser,
      WorkerSetup.initOnMessageHandler,
      WorkerSetup.initWorkerInterface,
      WorkerSetup.initWorkerMessenger
    ].join('\n'));
    var workerCode = '(' + workerSetupCode + ')();';
    var worker = new Worker(makeDataURI(workerCode));
    init(options, worker);
    return worker;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // ignore-in-doc
    // This code is triggered in the UI process directly after the
    // creation of the worker and sends the setup message to the worker
    // for initializing it.
    function init(options, worker) {
      exports.events.makeEmitter(worker);

      if (!options.scriptsToLoad) {
        options.scriptsToLoad = [
          'base.js',
          'events.js',
          'object.js',
          'collection.js',
          'function.js',
          'string.js',
          'number.js',
          'date.js',
          'messenger.js',
          'worker.js'].map(function(ea) {
            return options.libLocation + ea; });
      }

      var workerOptions = Object.keys(options).reduce(function(opts, key) {
        if (typeof options[key] !== 'function') opts[key] = options[key];
        return opts;
      }, {});

      worker.onmessage = function(evt) {
        if (evt.data.workerReady !== undefined) {
          worker.ready = !!evt.data.workerReady;
          if (worker.ready) worker.emit("ready");
          else worker.emit("close");
        } else worker.emit('message', evt.data);
      }

      worker.errors = [];
      worker.onerror = function(evt) {
        console.error(evt);
        worker.errors.push(evt);
        worker.emit("error", evt)
      }

      worker.postMessage({action: 'setup', options: workerOptions});
    }

    // ignore-in-doc
    // This code is run inside the worker and bootstraps the messenger
    // interface. It also installs a console.log method since since this is not
    // available by default.
    function workerSetupFunction() {
      var remoteWorker = self;
      remoteWorker.onmessage = function(evt) {
        if (evt.data.action !== "setup") {
          throw new Error("expected setup to be first message but got " + JSON.stringify(evt.data))
        }
        var options = evt.data.options || {};
        initBrowserGlobals(options);
        loadDependenciesBrowser(options);
        initOnMessageHandler(options);
        initWorkerInterface(options);
        initWorkerMessenger(options);
        postMessage({workerReady: true});
      }
      __FUNCTIONDECLARATIONS__
    }

    function makeDataURI(codeToInclude) {
      // ignore-in-doc
      // see http://stackoverflow.com/questions/10343913/how-to-create-a-web-worker-from-a-string
      var blob;
      try {
        blob = new Blob([codeToInclude], {type : "text/javascript"});
      } catch (e) { /* ignore-in-doc Backwards-compatibility*/
        window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;
        blob = new BlobBuilder();
        blob.append(codeToInclude);
        blob = blob.getBlob();
      }
      var urlInterface = typeof webkitURL !== 'undefined' ? webkitURL : URL;
      return urlInterface.createObjectURL(blob);
    }

  }

}

var NodejsWorker = {

  debug: false,
  initCodeFileCreated: false,

  create: function(options) {
    options = options || {};

    // ignore-in-doc
    // figure out where the other lang libs can be loaded from
    // if (!options.libLocation && !options.scriptsToLoad) {
    //   var workerScript = document.querySelector("script[src$=\"worker.js\"]");
    //   if (!workerScript) throw new Error("Cannot find library path to start worker. Use worker.create({libLocation: \"...\"}) to explicitly define the path!");
    //   options.libLocation = workerScript.src.replace(/worker.js$/, '');
    // }

    var workerProc;
    var worker = exports.events.makeEmitter({
      ready: false,
      errors: [],

      postMessage: function(msg) {
        if (!workerProc) {
          worker.emit("error", new Error('nodejs worker process not yet created'));
          return;
        }
        if (!worker.ready) {
          worker.emit("error", new Error('nodejs worker process not ready or already closed'));
          return;
        }
        workerProc.send(msg);
      }
    });

    NodejsWorker.startWorker(options, function(err, _workerProc) {
      if (err) { worker.ready = false; worker.emit("error", err); return; }

      workerProc = _workerProc;

      workerProc.on('message', function(m) {
        NodejsWorker.debug && console.log('[WORKER PARENT] got message:', m);
        worker.emit("message", m);
      });

      workerProc.on('close', function() {
        console.log("[WORKER PARENT] worker closed");
        worker.emit("close");
      });

      workerProc.on('error', function(err) {
        console.log("[WORKER PARENT] error ", err);
        worker.errors.push(err);
        worker.emit("error", err);
      });

      worker.ready = true;
      worker.emit("ready");
    });

    return worker;
  },

  // this code is run in the context of the worker process
  workerSetupFunction: function workerSetupFunction() {
    var remoteWorker = process;
    var debug = true;
    var close = false;

    debug && console.log("[WORKER] Starting init");
    // ignore-in-doc
    // process.on('message', function(m) {
    //   debug && console.log('[WORKER] got message:', m);
    //   if (m.action === 'ping') process.send({action: 'pong', data: m});
    //   else if (m.action === 'close') close = true;
    //   else if (m.action === 'setup') setup(m.data);
    //   else console.error('[WORKER] unknown message: ', m);
    // });

    remoteWorker.on("message", function(msg) {
      if (msg.action !== "setup") {
        throw new Error("expected setup to be first message but got " + JSON.stringify(msg.data))
      }
      remoteWorker.removeAllListeners("message");
      var options = msg.data.options || {};
      debug && console.log("[WORKER] running setup with options", options);
      loadDependenciesNodejs(options);
      initOnMessageHandler(options);
      initWorkerInterface(options);
      initWorkerMessenger(options);
      remoteWorker.send({workerReady: true});
    })
    __FUNCTIONDECLARATIONS__
  },

  ensureInitCodeFile: function(options, initCode, thenDo) {
    var path = require("path");
    var os = require("os");
    var fs = require("fs");

    var workerTmpDir = path.join(os.tmpDir(), 'lively-nodejs-workers/');
    var fn = path.join(workerTmpDir, 'nodejs-worker-init.js');

    if (!NodejsWorker.initCodeFileCreated) NodejsWorker.createWorkerCodeFile(options, fn, initCode, thenDo);
    else fs.exists(fn, function(exists) {
      if (exists) thenDo(null, fn);
      else NodejsWorker.createWorkerCodeFile(options, fn, initCode, thenDo);
    });
  },

  createWorkerCodeFile: function(options, fileName, initCode, thenDo) {
    var path = require("path");
    var fs = require("fs");
    var exec = require("child_process").exec;

    exec("mkdir -p " + path.dirname(fileName), function(code, out, err) {
      if (code) {
        thenDo(new Error(["[WORKER PARENT] Could not create worker temp dir:", out, err].join('\n')))
        return;
      }
      fs.writeFile(fileName, initCode, function(err) {
        NodejsWorker.debug && console.log('worker code file %s created', fileName);
        NodejsWorker.initCodeFileCreated = true;
        thenDo(err, fileName); });
    });
  },

  startWorker: function(options, thenDo) {
    var util = require("util");
    var fork = require("child_process").fork;

    var workerSetupCode = String(NodejsWorker.workerSetupFunction).replace("__FUNCTIONDECLARATIONS__", [
      WorkerSetup.loadDependenciesNodejs,
      WorkerSetup.initOnMessageHandler,
      WorkerSetup.initWorkerInterface,
      WorkerSetup.initWorkerMessenger
    ].join('\n'));

    var initCode = util.format("(%s)();\n", workerSetupCode);
    NodejsWorker.ensureInitCodeFile(options, initCode, function(err, codeFileName) {
      if (err) return thenDo(err);
      var worker = fork(codeFileName, {});
      NodejsWorker.debug && console.log('worker forked');
      worker.on('message', function(m) {
        if (m.action === 'pong') console.log("[WORKER pong] ", m);
        else if (m.action === 'log') console.log("[Message from WORKER] ", m.data);
      });
      worker.once('message', function(m) {
        NodejsWorker.debug && console.log('worker setup done');
        thenDo(null, worker, m);
      });
      worker.on('close', function() {
        NodejsWorker.debug && console.log("[WORKER PARENT] worker closed");
      });
      worker.send({action: "setup", data: {options: options}});
      global.WORKER = worker;
    });
  }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// the worker interface, usable both in browser and node.js contexts
// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

/*
Worker objects allow to fork processes in both Web and node.js JavaScript
environments. They provide this mechanism using web workers in the browser and
node.js child processes in node.js. The interface is unified for all platforms.
 */
var worker = exports.worker = {

  fork: function(options, workerFunc, thenDo) {
    // Fork automatically starts a worker and calls `workerFunc`. `workerFunc`
    // gets as a last paramter a callback, that, when invoked with an error and
    // result object, ends the worker execution.
    //
    // Options are the same as in `create` except for an `args` property that
    // can be an array of objects. These objects will be passed to `workerFunc`
    // as arguments.
    //
    // Note: `workerFunc` will not be able to capture outside variables (create a
    // closure).
    //
    // Example:
    // // When running this inside a browser: Note how the UI does not block.
    // worker.fork({args: [40]},
    //   function(n, thenDo) {
    //     function fib(n) { return n <= 1 ? n : fib(n-1) + fib(n-2); }
    //     thenDo(null, fib(n));
    //   },
    //   function(err, result) { show(err ? err.stack : result); })

    if (!thenDo) { thenDo = workerFunc; workerFunc = options; options = null; }
    options = options || {};
    var args = options.args || [];
    var w = worker.create(options);
    w.run.apply(w, [workerFunc].concat(args).concat(thenDo));
    return w;
  },

  create: function(options) {
    // Explicitly creates a first-class worker. Options:
    // ```js
    // {
    //   workerId: STRING, // optional, id for worker, will be auto assigned if not provided
    //   libLocation: STRING, // optional, path to where the lively.lang lib is located. Worker will try to find it automatically if not provided.
    //   scriptsToLoad: ARRAY // optional, list of path/urls to load. Overwrites `libLocation`
    // }
    // ```
    //
    // Example:
    // // this is just a helper function
    // function resultHandler(err, result) { alert(err ? String(err) : result); }
    //
    // // 1. Create the worker
    // var worker = lively.lang.worker.create({libLocation: baseURL});
    //
    // // 2. You can evaluate arbitrary JS code
    // worker.eval("1+2", function(err, result) { show(err ? String(err) : result); });
    //
    // // 3. Arbitrary functions can be called inside the worker context.
    // //    Note: functions shouldn't be closures / capture local state!) and passing
    // //    in arguments!
    // worker.run(
    //   function(a, b, thenDo) { setTimeout(function() { thenDo(null, a+b); }, 300); },
    //   19, 4, resultHandler);
    //
    // // 4. You can also install your own messenger services...
    // worker.run(
    //   function(thenDo) {
    //     self.messenger.addServices({
    //       foo: function(msg, messenger) { messenger.answer(msg, "bar!"); }
    //     });
    //     thenDo(null, "Service installed!");
    //   }, resultHandler);
    //
    // // ... and call them via the messenger interface
    // worker.sendTo("worker", "foo", {}, resultHandler);
    //
    // // 5. afterwards: shut it down
    // worker.close(function(err) { err && show(String(err)); alertOK("worker shutdown"); })

    options = options || {};
    options.useMessenger = true;

    if (!exports.messenger)
      throw new Error("worker.create requires messenger.js to be loaded!")
    if (!exports.events)
      throw new Error("worker.create requires events.js to be loaded!")
    if (!exports.obj)
      throw new Error("worker.create requires object.js to be loaded!")

    var workerId = options.workerId || exports.string.newUUID();

    var messenger = exports.messenger.create({
      sendTimeout: 5000,

      send: function(msg, whenSend) {
        messenger.worker.postMessage(msg);
        whenSend();
      },

      listen: function(whenListening) {
        var w = messenger.worker = isNodejs ? NodejsWorker.create(options) : BrowserWorker.create(options);
        w.on("message", function(msg) { messenger.onMessage(msg); });
        w.on('ready', function() { NodejsWorker.debug && console.log("WORKER READY!!!"); });
        w.on('close', function() { NodejsWorker.debug && console.log("WORKER CLOSED...!!!") ;});
        w.once('ready', whenListening);
      },

      close: function(whenClosed) {
        if (!messenger.worker.ready) return whenClosed(null);
        return messenger.sendTo(workerId, 'close', {}, function(err, answer) {
          err = err || answer.data.error;
          err && console.error("Error in worker messenger close: " + err.stack || err);
          if (err) whenClosed(err);
          else {
            var closed = false;
            messenger.worker.once('close', function() { closed = true; });
            exports.fun.waitFor(1000, function() { return !!closed; }, whenClosed);
          }
        });
      },

      isOnline: function() { return messenger.worker && messenger.worker.ready; }

    });

    exports.obj.extend(messenger, {

      eval: function(code, thenDo) {
        messenger.sendTo(workerId, "remoteEval", {expr: code}, function(err, answer) {
          thenDo(err, answer ? answer.data.result : null);
        });
      },

      run: function(/*runFunc, arg1, ... argN, thenDo*/) {
        var args = Array.prototype.slice.call(arguments),
            workerFunc = args.shift(),
            thenDo = args.pop();
        if (typeof workerFunc !== "function") throw new Error("run: no function that should run in worker passed");
        if (typeof thenDo !== "function") throw new Error("run: no callback passed");

        return messenger.sendTo(workerId, 'run',  {func: String(workerFunc), args: args}, function(err, answer) {
          thenDo(err || answer.data.error, answer ? answer.data.result : null);
        });
      }

    });

    messenger.listen();

    return messenger;
  }
}

})(typeof module !== "undefined" && module.require && typeof process !== "undefined" ?
  require('./base') :
  (typeof lively !== "undefined" && lively.lang ?
     lively.lang : {}));

//;
var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS && module.require("lively.lang");
var escodegen = isCommonJS ? require("escodegen") : escodegen;
var acorn = !isCommonJS && Global.acorn;
if (!acorn && isCommonJS) {
    // acorn = require("acorn-jsx");
    acorn = require("acorn");
    acorn.walk = require("acorn/dist/walk");
    acorn.parse_dammit = require("acorn/dist/acorn_loose").parse_dammit;
    Global.acorn = acorn;
}

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: isCommonJS ? (Global.lively || {}) : (Global.lively || (Global.lively = {})),
  "lively.lang": lang,
  "lively.ast": (Global.lively && Global.lively.ast) || {},
  escodegen: escodegen,
  acorn: acorn
};

env.lively.ast = env['lively.ast'];

if (isCommonJS) lang.obj.extend(module.exports, env);
else env.lively['lively.lang_env'] = env;


;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("./env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env["lively.lang"], env["lively.ast"]);
  if (env.isCommonJS) {
    require("./lib/acorn-extension");
    require("./lib/mozilla-ast-visitors");
    require("./lib/mozilla-ast-visitor-interface");
    require("./lib/query");
    require("./lib/transform");
    require("./lib/comments");
    require("./lib/code-categorizer");
    module.exports = env["lively.ast"];
  }

})(function(acorn, lively, lang, exports) {

  if (exports.acorn) exports.acorn = lang.obj.extend(exports.acorn, acorn);
  else exports.acorn = acorn;

  exports.parse = function(source, options) {
    // proxy function to acorn.parse.
    // Note that we will implement useful functionality on top of the pure
    // acorn interface and make it available here (such as more convenient
    // comment parsing). For using the pure acorn interface use the acorn
    // global.
    // See https://github.com/marijnh/acorn for full acorn doc and parse options.
    // options: {
    //   addSource: BOOL, -- add source property to each node
    //   addAstIndex: BOOL, -- each node gets an index  number
    //   withComments: BOOL, -- adds comment objects to Program/BlockStatements:
    //              {isBlock: BOOL, text: STRING, node: NODE,
    //               start: INTEGER, end: INTEGER, line: INTEGER, column: INTEGER}
    //   ecmaVersion: 3|5|6,
    //   allowReturnOutsideFunction: BOOL, -- Default is false
    //   locations: BOOL -- Default is false
    // }

    options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;
    if (options.withComments) {
      // record comments
      delete options.withComments;
      var comments = [];
      options.onComment = function(isBlock, text, start, end, line, column) {
        comments.push({
          isBlock: isBlock,
          text: text, node: null,
          start: start, end: end,
          line: line, column: column
        });
      };
    }

    var ast = options.addSource ?
      acorn.walk.addSource(source, options) : // FIXME
      acorn.parse(source, options);

    if (options.addAstIndex && !ast.hasOwnProperty('astIndex')) acorn.walk.addAstIndex(ast);

    if (ast && comments) attachCommentsToAST({ast: ast, comments: comments, nodesWithComments: []});

    return ast;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function attachCommentsToAST(commentData) {
      // for each comment: assign the comment to a block-level AST node
      commentData = mergeComments(assignCommentsToBlockNodes(commentData));
      ast.allComments = commentData.comments;
    }

    function assignCommentsToBlockNodes(commentData) {
      comments.forEach(function(comment) {
        var node = lang.arr.detect(
          exports.nodesAt(comment.start, ast).reverse(),
          function(node) { return node.type === 'BlockStatement' || node.type === 'Program'; });
        if (!node) node = ast;
        if (!node.comments) node.comments = [];
        node.comments.push(comment);
        commentData.nodesWithComments.push(node);
      });
      return commentData;
    }

    function mergeComments(commentData) {
      // coalesce non-block comments (multiple following lines of "// ...") into one comment.
      // This only happens if line comments aren't seperated by newlines
      commentData.nodesWithComments.forEach(function(blockNode) {
        lang.arr.clone(blockNode.comments).reduce(function(coalesceData, comment) {
          if (comment.isBlock) {
            coalesceData.lastComment = null;
            return coalesceData;
          }

          if (!coalesceData.lastComment) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }

          // if the comments are seperated by a statement, don't merge
          var last = coalesceData.lastComment;
          var nodeInbetween = lang.arr.detect(blockNode.body, function(node) { return node.start >= last.end && node.end <= comment.start; });
          if (nodeInbetween) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }

          // if the comments are seperated by a newline, don't merge
          var codeInBetween = source.slice(last.end, comment.start);
          if (/[\n\r][\n\r]+/.test(codeInBetween)) {
            coalesceData.lastComment = comment;
            return coalesceData;
          }

          // merge comments into one
          last.text += "\n" + comment.text;
          last.end = comment.end;
          lang.arr.remove(blockNode.comments, comment);
          lang.arr.remove(commentData.comments, comment);
          return coalesceData;
        }, {lastComment: null});
      });
      return commentData;
    }

  },

  exports.parseFunction = function(source, options) {
    options = options || {};
    options.ecmaVersion = 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

    var src = '(' + source + ')',
      ast = acorn.parse(src);
    /*if (options.addSource) */acorn.walk.addSource(ast, src);
    return ast.body[0].expression;
  },

  exports.parseLikeOMeta = function(src, rule) {
    // only an approximation, _like_ OMeta
    var self = this;
    function parse(source) {
      return acorn.walk.toLKObjects(self.parse(source));
    }

    var ast;
    switch (rule) {
    case 'expr':
    case 'stmt':
    case 'functionDef':
      ast = parse(src);
      if (ast.isSequence && (ast.children.length == 1)) {
        ast = ast.children[0];
        ast.setParent(undefined);
      }
      break;
    case 'memberFragment':
      src = '({' + src + '})'; // to make it valid
      ast = parse(src);
      ast = ast.children[0].properties[0];
      ast.setParent(undefined);
      break;
    case 'categoryFragment':
    case 'traitFragment':
      src = '[' + src + ']'; // to make it valid
      ast = parse(src);
      ast = ast.children[0];
      ast.setParent(undefined);
      break;
    default:
      ast = parse(src);
    }
    ast.source = src;
    return ast;
  },

  exports.fuzzyParse = function(source, options) {
    // options: verbose, addSource, type
    options = options || {};
    options.ecmaVersion = options.ecmaVersion || 6;
    options.sourceType = options.sourceType || "module";
    options.plugins = options.plugins || {};
    if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

    var ast, safeSource, err;
    if (options.type === 'LabeledStatement') { safeSource = '$={' + source + '}'; }
    try {
      // we only parse to find errors
      ast = exports.parse(safeSource || source, options);
      if (safeSource) ast = null; // we parsed only for finding errors
      else if (options.addSource) acorn.walk.addSource(ast, source);
    } catch (e) { err = e; }
    if (err && err.raisedAt !== undefined) {
      if (safeSource) { // fix error pos
        err.pos -= 3; err.raisedAt -= 3; err.loc.column -= 3; }
      var parseErrorSource = '';
      parseErrorSource += source.slice(err.raisedAt - 20, err.raisedAt);
      parseErrorSource += '<-error->';
      parseErrorSource += source.slice(err.raisedAt, err.raisedAt + 20);
      options.verbose && show('parse error: ' + parseErrorSource);
      err.parseErrorSource = parseErrorSource;
    } else if (err && options.verbose) {
      show('' + err + err.stack);
    }
    if (!ast) {
      ast = acorn.parse_dammit(source, options);
      if (options.addSource) acorn.walk.addSource(ast, source);
      ast.isFuzzy = true;
      ast.parseError = err;
    }
    return ast;
  },

  exports.nodesAt = function(pos, ast) {
    ast = typeof ast === 'string' ? this.parse(ast) : ast;
    return acorn.walk.findNodesIncluding(ast, pos);
  }
});
;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.escodegen, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, escodegen, lively, lang, exports) {

  if (exports.acorn) exports.acorn = lang.obj.extend(exports.acorn, acorn);
  else exports.acorn = acorn;

// -=-=-=-=-=-=-=-=-=-=-=-
// from lively.ast.acorn
// -=-=-=-=-=-=-=-=-=-=-=-
acorn.walk.forEachNode = function(ast, func, state, options) {
  // note: func can get called with the same node for different
  // visitor callbacks!
  // func args: node, state, depth, type
  options = options || {};
  var traversal = options.traversal || 'preorder'; // also: postorder
  
  var visitors = lang.obj.clone(options.visitors ? options.visitors : acorn.walk.visitors.withMemberExpression);
  var iterator = traversal === 'preorder' ?
    function(orig, type, node, depth, cont) { func(node, state, depth, type); return orig(node, depth+1, cont); } :
    function(orig, type, node, depth, cont) { var result = orig(node, depth+1, cont); func(node, state, depth, type); return result; };
  Object.keys(visitors).forEach(function(type) {
    var orig = visitors[type];
    visitors[type] = function(node, depth, cont) { return iterator(orig, type, node, depth, cont); };
  });
  acorn.walk.recursive(ast, 0, null, visitors);
  return ast;
};

acorn.walk.matchNodes = function(ast, visitor, state, options) {
  function visit(node, state, depth, type) {
    if (visitor[node.type]) visitor[node.type](node, state, depth, type);
  }
  return acorn.walk.forEachNode(ast, visit, state, options);
};

acorn.walk.findNodesIncluding = function(ast, pos, test, base) {
  var nodes = [];
  base = base || lang.obj.clone(acorn.walk.visitors.withMemberExpression);
  Object.keys(base).forEach(function(name) {
    var orig = base[name];
    base[name] = function(node, state, cont) {
      lang.arr.pushIfNotIncluded(nodes, node);
      return orig(node, state, cont);
    }
  });
  base["Property"] = function (node, st, c) {
    lang.arr.pushIfNotIncluded(nodes, node);
    c(node.key, st, "Expression");
    c(node.value, st, "Expression");
  }
  base["LabeledStatement"] = function (node, st, c) {
    node.label && c(node.label, st, "Expression");
    c(node.body, st, "Statement");
  }
  acorn.walk.findNodeAround(ast, pos, test, base);
  return nodes;
};

acorn.walk.addSource = function(ast, source, completeSrc, forceNewSource) {
  var options = options || {};
  options.ecmaVersion = options.ecmaVersion || 6;
  options.sourceType = options.sourceType || "module";
  options.plugins = options.plugins || {};
  if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

  source = typeof ast === 'string' ? ast : source;
  ast = typeof ast === 'string' ? acorn.parse(ast, options) : ast;
  completeSrc = !!completeSrc;
  return acorn.walk.forEachNode(ast, function(node) {
    if (node.source && !forceNewSource) return;
    node.source = completeSrc ?
      source : source.slice(node.start, node.end);
  });
};

acorn.walk.inspect = function(ast, source) {
  var options = options || {};
  options.ecmaVersion = options.ecmaVersion || 6;
  options.sourceType = options.sourceType || "module";
  options.plugins = options.plugins || {};
  if (options.plugins.hasOwnProperty("jsx")) options.plugins.jsx = options.plugins.jsx;

  source = typeof ast === 'string' ? ast : null;
  ast = typeof ast === 'string' ? acorn.parse(ast) : ast;
  source && acorn.walk.addSource(ast, source);
  return lang.obj.inspect(ast);
};

acorn.walk.withParentInfo = function(ast, iterator, options) {
  // options = {visitAllNodes: BOOL}
  options = options || {};
  function makeScope(parentScope) {
    var scope = {id: lang.string.newUUID(), parentScope: parentScope, containingScopes: []};
    parentScope && parentScope.containingScopes.push(scope);
    return scope;
  }
  var visitors = acorn.walk.make({
    Function: function(node, st, c) {
      if (st && st.scope) st.scope = makeScope(st.scope);
      c(node.body, st, "ScopeBody");
    },
    VariableDeclarator: function(node, st, c) {
      // node.id && c(node.id, st, 'Identifier');
      node.init && c(node.init, st, 'Expression');
    },
    VariableDeclaration: function(node, st, c) {
      for (var i = 0; i < node.declarations.length; ++i) {
        var decl = node.declarations[i];
        if (decl) c(decl, st, "VariableDeclarator");
      }
    },
    ObjectExpression: function(node, st, c) {
      for (var i = 0; i < node.properties.length; ++i) {
        var prop = node.properties[i];
        c(prop.key, st, "Expression");
        c(prop.value, st, "Expression");
      }
    },
    MemberExpression: function(node, st, c) {
      c(node.object, st, "Expression");
      c(node.property, st, "Expression");
    }
  });
  var lastActiveProp, getters = [];
  acorn.walk.forEachNode(ast, function(node) {
    lang.arr.withoutAll(Object.keys(node), ['end', 'start', 'type', 'source', 'raw']).forEach(function(propName) {
      if (node.__lookupGetter__(propName)) return; // already defined
      var val = node[propName];
      node.__defineGetter__(propName, function() { lastActiveProp = propName; return val; });
      getters.push([node, propName, node[propName]]);
    });
  }, null, {visitors: visitors});
  var result = [];
  Object.keys(visitors).forEach(function(type) {
    var orig = visitors[type];
    visitors[type] = function(node, state, cont) {
      if (type === node.type || options.visitAllNodes) {
        result.push(iterator.call(null, node, {scope: state.scope, depth: state.depth, parent: state.parent, type: type, propertyInParent: lastActiveProp}));
        return orig(node, {scope: state.scope, parent: node, depth: state.depth+1}, cont);
      } else {
        return orig(node, state, cont);
      }
    }
  });
  acorn.walk.recursive(ast, {scope: makeScope(), parent: null, propertyInParent: '', depth: 0}, null, visitors);
  getters.forEach(function(nodeNameVal) {
    delete nodeNameVal[0][nodeNameVal[1]];
    nodeNameVal[0][nodeNameVal[1]] = nodeNameVal[2];
  });
  return result;
};

acorn.walk.toLKObjects = function(ast) {
  if (!!!ast.type) throw new Error('Given AST is not an Acorn AST.');
  function newUndefined(start, end) {
    start = start || -1;
    end = end || -1;
    return new lively.ast.Variable([start, end], 'undefined');
  }
  var visitors = {
    Program: function(n, c) {
      return new lively.ast.Sequence([n.start, n.end], n.body.map(c))
    },
    FunctionDeclaration: function(n, c) {
      var args = n.params.map(function(param) {
        return new lively.ast.Variable(
          [param.start, param.end], param.name
        );
      });
      var fn = new lively.ast.Function(
        [n.id.end, n.end], c(n.body), args
      );
      return new lively.ast.VarDeclaration(
        [n.start, n.end], n.id.name, fn
      );
    },
    BlockStatement: function(n, c) {
      var children = n.body.map(c);
      return new lively.ast.Sequence([n.start + 1, n.end], children);
    },
    ExpressionStatement: function(n, c) {
      return c(n.expression); // just skip it
    },
    CallExpression: function(n, c) {
      if ((n.callee.type == 'MemberExpression') &&
        (n.type != 'NewExpression')) { // reused in NewExpression
        // Send
        var property; // property
        var r = n.callee.object; // reciever
        if (n.callee.computed) {
          // object[property] => Expression
          property = c(n.callee.property)
        } else {
          // object.property => Identifier
          property = new lively.ast.String(
            [n.callee.property.start, n.callee.property.end],
            n.callee.property.name
          );
        }
        return new lively.ast.Send(
          [n.start, n.end], property, c(r), n.arguments.map(c)
        );
      } else {
        return new lively.ast.Call(
          [n.start, n.end],
          c(n.callee),
          n.arguments.map(c)
        );
      }
    },
    MemberExpression: function(n, c) {
      var slotName;
      if (n.computed) {
        // object[property] => Expression
        slotName = c(n.property)
      } else {
        // object.property => Identifier
        slotName = new lively.ast.String(
          [n.property.start, n.property.end], n.property.name
        );
      }
      return new lively.ast.GetSlot(
        [n.start, n.end], slotName, c(n.object)
      );
    },
    NewExpression: function(n, c) {
      return new lively.ast.New(
        [n.start, n.end], this.CallExpression(n, c)
      );
    },
    VariableDeclaration: function(n, c) {
      var start = n.declarations[0] ? n.declarations[0].start - 1 : n.start;
      return new lively.ast.Sequence(
        [start, n.end], n.declarations.map(c)
      );
    },
    VariableDeclarator: function(n, c) {
      var value = n.init ? c(n.init) : newUndefined(n.start -1, n.start - 1);
      return new lively.ast.VarDeclaration(
        [n.start - 1, n.end], n.id.name, value
      );
    },
    FunctionExpression: function(n, c) {
      var args = n.params.map(function(param) {
        return new lively.ast.Variable(
          [param.start, param.end], param.name
        );
      });
      return new lively.ast.Function(
        [n.start, n.end], c(n.body), args
      );
    },
    IfStatement: function(n, c) {
      return new lively.ast.If(
        [n.start, n.end],
        c(n.test),
        c(n.consequent),
        n.alternate ? c(n.alternate) :
          newUndefined(n.consequent.end, n.consequent.end)
      );
    },
    ConditionalExpression: function(n, c) {
      return new lively.ast.Cond(
        [n.start, n.end], c(n.test), c(n.consequent), c(n.alternate)
      );
    },
    SwitchStatement: function(n, c) {
      return new lively.ast.Switch(
        [n.start, n.end], c(n.discriminant), n.cases.map(c)
      );
    },
    SwitchCase: function(n, c) {
      var start = n.consequent.length > 0 ? n.consequent[0].start : n.end;
      var end = n.consequent.length > 0 ? n.consequent[n.consequent.length - 1].end : n.end;
      var seq = new lively.ast.Sequence([start, end], n.consequent.map(c));
      if (n.test != null) {
        return new lively.ast.Case([n.start, n.end], c(n.test), seq);
      } else {
        return new lively.ast.Default([n.start, n.end], seq);
      }
    },
    BreakStatement: function(n, c) {
      var label;
      if (n.label == null) {
        label = new lively.ast.Label([n.end, n.end], '');
      } else {
        label = new lively.ast.Label(
          [n.label.start, n.label.end], n.label.name
        );
      }
      return new lively.ast.Break([n.start, n.end], label);
    },
    ContinueStatement: function(n, c) {
      var label;
      if (n.label == null) {
        label = new lively.ast.Label([n.end, n.end], '');
      } else {
        label = new lively.ast.Label(
          [n.label.start, n.label.end], n.label.name
        );
      }
      return new lively.ast.Continue([n.start, n.end], label);
    },
    TryStatement: function(n, c) {
      var errVar, catchSeq;
      if (n.handler) {
        catchSeq = c(n.handler.body);
        errVar = c(n.handler.param);
      } else {
        catchSeq = newUndefined(n.block.end + 1, n.block.end + 1);
        errVar = newUndefined(n.block.end + 1, n.block.end + 1);
      }
      var finallySeq = n.finalizer ?
        c(n.finalizer) : newUndefined(n.end, n.end);
      return new lively.ast.TryCatchFinally(
        [n.start, n.end], c(n.block), errVar, catchSeq, finallySeq
      );
    },
    ThrowStatement: function(n, c) {
      return new lively.ast.Throw([n.start, n.end], c(n.argument));
    },
    ForStatement: function(n, c) {
      var init = n.init ? c(n.init) : newUndefined(4, 4);
      var cond = n.test ? c(n.test) :
        newUndefined(init.pos[1] + 1, init.pos[1] + 1);
      var upd = n.update ? c(n.update) :
        newUndefined(cond.pos[1] + 1, cond.pos[1] + 1);
      return new lively.ast.For(
        [n.start, n.end], init, cond, c(n.body), upd
      );
    },
    ForInStatement: function(n, c) {
      var left = n.left.type == 'VariableDeclaration' ?
        c(n.left.declarations[0]) : c(n.left);
      return new lively.ast.ForIn(
        [n.start, n.end], left, c(n.right), c(n.body)
      );
    },
    WhileStatement: function(n, c) {
      return new lively.ast.While(
        [n.start, n.end], c(n.test), c(n.body)
      );
    },
    DoWhileStatement: function(n, c) {
      return new lively.ast.DoWhile(
        [n.start, n.end], c(n.body), c(n.test)
      );
    },
    WithStatement: function(n ,c) {
      return new lively.ast.With([n.start, n.end], c(n.object), c(n.body));
    },
    UnaryExpression: function(n, c) {
      return new lively.ast.UnaryOp(
        [n.start, n.end], n.operator, c(n.argument)
      );
    },
    BinaryExpression: function(n, c) {
      return new lively.ast.BinaryOp(
        [n.start, n.end], n.operator, c(n.left), c(n.right)
      );
    },
    AssignmentExpression: function(n, c) {
      if (n.operator == '=') {
        return new lively.ast.Set(
          [n.start, n.end], c(n.left), c(n.right)
        );
      } else {
        return new lively.ast.ModifyingSet(
          [n.start, n.end],
          c(n.left), n.operator.substr(0, n.operator.length - 1), c(n.right)
        );
      }
    },
    UpdateExpression: function(n, c) {
      if (n.prefix) {
        return new lively.ast.PreOp(
          [n.start, n.end], n.operator, c(n.argument)
        );
      } else {
        return new lively.ast.PostOp(
          [n.start, n.end], n.operator, c(n.argument)
        );
      }
    },
    ReturnStatement: function(n, c) {
      return new lively.ast.Return(
        [n.start, n.end],
        n.argument ? c(n.argument) : newUndefined(n.end, n.end)
      );
    },
    Identifier: function(n, c) {
      return new lively.ast.Variable([n.start, n.end], n.name);
    },
    Literal: function(n, c) {
      if (Object.isNumber(n.value)) {
        return new lively.ast.Number([n.start, n.end], n.value);
      } else if (Object.isBoolean(n.value)) {
        return new lively.ast.Variable(
          [n.start, n.end], n.value.toString()
        );
      } else if (typeof n.value === 'string') {
        return new lively.ast.String(
          [n.start, n.end], n.value
        );
      } else if (Object.isRegExp(n.value)) {
        var flags = n.raw.substr(n.raw.lastIndexOf('/') + 1);
        return new lively.ast.Regex(
          [n.start, n.end], n.value.source, flags
        );
      } else if (n.value === null) {
        return new lively.ast.Variable([n.start, n.end], 'null');
      }
      throw new Error('Case of Literal not handled!');
    },
    ObjectExpression: function(n, c) {
      var props = n.properties.map(function(prop) {
        var propName = prop.key.type == 'Identifier' ?
          prop.key.name :
          prop.key.value;
        if (prop.kind == 'init') {
          return new lively.ast.ObjProperty(
            [prop.key.start, prop.value.end], propName, c(prop.value)
          );
        } else if (prop.kind == 'get') {
          return new lively.ast.ObjPropertyGet(
            [prop.key.start, prop.value.end], propName,
            c(prop.value.body)
          );
        } else if (prop.kind == 'set') {
          return new lively.ast.ObjPropertySet(
            [prop.key.start, prop.value.end], propName,
            c(prop.value.body), c(prop.value.params[0])
          );
        } else {
          throw new Error('Case of ObjectExpression not handled!');
        }
      });
      return new lively.ast.ObjectLiteral(
        [n.start, n.end], props
      );
    },
    ArrayExpression: function(n, c) {
      return new lively.ast.ArrayLiteral([n.start, n.end], n.elements.map(c));
    },
    SequenceExpression: function(n, c) {
      return new lively.ast.Sequence(
        [n.start, n.end], n.expressions.map(c)
      );
    },
    EmptyStatement: function(n, c) {
      return newUndefined(n.start, n.end);
    },
    ThisExpression: function(n, c) {
      return new lively.ast.This([n.start, n.end]);
    },
    DebuggerStatement: function(n, c) {
      return new lively.ast.Debugger([n.start, n.end]);
    },
    LabeledStatement: function(n, c) {
      return new lively.ast.LabelDeclaration(
        [n.start, n.end], n.label.name, c(n.body)
      );
    }
  }
  visitors.LogicalExpression = visitors.BinaryExpression;
  function c(node) {
    return visitors[node.type](node, c);
  }
  return c(ast);
};

acorn.walk.copy = function(ast, override) {
  var visitors = lang.obj.extend({
    Program: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'Program',
        body: n.body.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    FunctionDeclaration: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'FunctionDeclaration',
        id: c(n.id), params: n.params.map(c), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    BlockStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'BlockStatement',
        body: n.body.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    ExpressionStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ExpressionStatement',
        expression: c(n.expression),
        source: n.source, astIndex: n.astIndex
      };
    },
    CallExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'CallExpression',
        callee: c(n.callee), arguments: n.arguments.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    MemberExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'MemberExpression',
        object: c(n.object), property: c(n.property), computed: n.computed,
        source: n.source, astIndex: n.astIndex
      };
    },
    NewExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'NewExpression',
        callee: c(n.callee), arguments: n.arguments.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    VariableDeclaration: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'VariableDeclaration',
        declarations: n.declarations.map(c), kind: n.kind,
        source: n.source, astIndex: n.astIndex
      };
    },
    VariableDeclarator: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'VariableDeclarator',
        id: c(n.id), init: c(n.init),
        source: n.source, astIndex: n.astIndex
      };
    },
    FunctionExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'FunctionExpression',
        id: c(n.id), params: n.params.map(c), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    IfStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'IfStatement',
        test: c(n.test), consequent: c(n.consequent),
        alternate: c(n.alternate),
        source: n.source, astIndex: n.astIndex
      };
    },
    ConditionalExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ConditionalExpression',
        test: c(n.test), consequent: c(n.consequent),
        alternate: c(n.alternate),
        source: n.source, astIndex: n.astIndex
      };
    },
    SwitchStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'SwitchStatement',
        discriminant: c(n.discriminant), cases: n.cases.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    SwitchCase: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'SwitchCase',
        test: c(n.test), consequent: n.consequent.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    BreakStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'BreakStatement',
        label: n.label,
        source: n.source, astIndex: n.astIndex
      };
    },
    ContinueStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ContinueStatement',
        label: n.label,
        source: n.source, astIndex: n.astIndex
      };
    },
    TryStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'TryStatement',
        block: c(n.block), handler: c(n.handler), finalizer: c(n.finalizer),
        guardedHandlers: n.guardedHandlers.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    CatchClause: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'CatchClause',
        param: c(n.param), guard: c(n.guard), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    ThrowStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ThrowStatement',
        argument: c(n.argument),
        source: n.source, astIndex: n.astIndex
      };
    },
    ForStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ForStatement',
        init: c(n.init), test: c(n.test), update: c(n.update),
        body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    ForInStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ForInStatement',
        left: c(n.left), right: c(n.right), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    WhileStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'WhileStatement',
        test: c(n.test), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    DoWhileStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'DoWhileStatement',
        test: c(n.test), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    WithStatement: function(n ,c) {
      return {
        start: n.start, end: n.end, type: 'WithStatement',
        object: c(n.object), body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    },
    UnaryExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'UnaryExpression',
        argument: c(n.argument), operator: n.operator, prefix: n.prefix,
        source: n.source, astIndex: n.astIndex
      };
    },
    BinaryExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'BinaryExpression',
        left: c(n.left), operator: n.operator, right: c(n.right),
        source: n.source, astIndex: n.astIndex
      };
    },
    LogicalExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'LogicalExpression',
        left: c(n.left), operator: n.operator, right: c(n.right),
        source: n.source, astIndex: n.astIndex
      };
    },
    AssignmentExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'AssignmentExpression',
        left: c(n.left), operator: n.operator, right: c(n.right),
        source: n.source, astIndex: n.astIndex
      };
    },
    UpdateExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'UpdateExpression',
        argument: c(n.argument), operator: n.operator, prefix: n.prefix,
        source: n.source, astIndex: n.astIndex
      };
    },
    ReturnStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ReturnStatement',
        argument: c(n.argument),
        source: n.source, astIndex: n.astIndex
      };
    },
    Identifier: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'Identifier',
        name: n.name,
        source: n.source, astIndex: n.astIndex
      };
    },
    Literal: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'Literal',
        value: n.value, raw: n.raw /* Acorn-specific */,
        source: n.source, astIndex: n.astIndex
      };
    },
    ObjectExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ObjectExpression',
        properties: n.properties.map(function(prop) {
          return {
            key: c(prop.key), value: c(prop.value), kind: prop.kind
          };
        }),
        source: n.source, astIndex: n.astIndex
      };
    },
    ArrayExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ArrayExpression',
        elements: n.elements.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    SequenceExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'SequenceExpression',
        expressions: n.expressions.map(c),
        source: n.source, astIndex: n.astIndex
      };
    },
    EmptyStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'EmptyStatement',
        source: n.source, astIndex: n.astIndex
      };
    },
    ThisExpression: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'ThisExpression',
        source: n.source, astIndex: n.astIndex
      };
    },
    DebuggerStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'DebuggerStatement',
        source: n.source, astIndex: n.astIndex
      };
    },
    LabeledStatement: function(n, c) {
      return {
        start: n.start, end: n.end, type: 'LabeledStatement',
        label: n.label, body: c(n.body),
        source: n.source, astIndex: n.astIndex
      };
    }
  }, override || {});

  function c(node) {
    if (node === null) return null;
    return visitors[node.type](node, c);
  }
  return c(ast);
}

acorn.walk.findSiblings = function(ast, node, beforeOrAfter) {
  if (!node) return [];
  var nodes = acorn.walk.findNodesIncluding(ast, node.start),
    idx = nodes.indexOf(node),
    parents = nodes.slice(0, idx),
    parentWithBody = lang.arr.detect(parents.reverse(), function(p) { return Array.isArray(p.body); }),
    siblingsWithNode = parentWithBody.body;
  if (!beforeOrAfter) return lang.arr.without(siblingsWithNode, node);
  var nodeIdxInSiblings = siblingsWithNode.indexOf(node);
  return beforeOrAfter === 'before' ?
    siblingsWithNode.slice(0, nodeIdxInSiblings) :
    siblingsWithNode.slice(nodeIdxInSiblings + 1);
}

// // cached visitors that are used often
acorn.walk.visitors = {
  stopAtFunctions: acorn.walk.make({
    'Function': function() { /* stop descent */ }
  }),

  withMemberExpression: acorn.walk.make({
    MemberExpression: function(node, st, c) {
      c(node.object, st, "Expression");
      c(node.property, st, "Expression");
    }
  })
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-
// from lively.ast.AstHelper
// -=-=-=-=-=-=-=-=-=-=-=-=-=-
;(function extendAcornWalk2() {

  acorn.walk.findNodeByAstIndex = function(ast, astIndexToFind, addIndex) {
    addIndex = addIndex == null ? true : !!addIndex;
    if (!ast.astIndex && addIndex) acorn.walk.addAstIndex(ast);
    // we need to visit every node, acorn.walk.forEachNode is highly
    // inefficient, the compilled Mozilla visitors are a better fit
    var found = null;
    acorn.withMozillaAstDo(ast, null, function(next, node, state) {
      if (found) return;
      var idx = node.astIndex;
      if (idx < astIndexToFind) return;
      if (node.astIndex === astIndexToFind) { found = node; return; }
      next();
    });
    return found;
  };

  // FIXME: global (and temporary) findNodeByAstIndex is used by __getClosure and defined in Rewriting.js
  // Global.findNodeByAstIndex = acorn.walk.findNodeByAstIndex;

  acorn.walk.findStatementOfNode = function(options, ast, target) {
    // Can also be called with just ast and target. options can be {asPath: BOOLEAN}.
    // Find the statement that a target node is in. Example:
    // let source be "var x = 1; x + 1;" and we are looking for the
    // Identifier "x" in "x+1;". The second statement is what will be found.
    if (!target) { target = ast; ast = options; options = null }
    if (!options) options = {}
    if (!ast.astIndex) acorn.walk.addAstIndex(ast);
    var found, targetReached = false;
    var statements = [
          // ES5
          'EmptyStatement', 'BlockStatement', 'ExpressionStatement', 'IfStatement',
          'LabeledStatement', 'BreakStatement', 'ContinueStatement', 'WithStatement', 'SwitchStatement',
          'ReturnStatement', 'ThrowStatement', 'TryStatement', 'WhileStatement', 'DoWhileStatement',
          'ForStatement', 'ForInStatement', 'DebuggerStatement', 'FunctionDeclaration',
          'VariableDeclaration',
          // ES2015:
          'ClassDeclaration'
        ];
    acorn.withMozillaAstDo(ast, {}, function(next, node, depth, state, path) {
      if (targetReached || node.astIndex < target.astIndex) return;
      if (node === target || node.astIndex === target.astIndex) {
        targetReached = true;
        if (options.asPath)
          found = path;
        else {
          var p = lang.Path(path);
          do {
            found = p.get(ast);
            p = p.slice(0, p.size() - 1);
          } while ((statements.indexOf(found.type) == -1) && (p.size() > 0));
        }
      }
      !targetReached && next();
    });
    return found;
  };

  acorn.walk.addAstIndex = function(ast) {
    // we need to visit every node, acorn.walk.forEachNode is highly
    // inefficient, the compilled Mozilla visitors are a better fit
    acorn.withMozillaAstDo(ast, {index: 0}, function(next, node, state) {
      next(); node.astIndex = state.index++;
    });
    return ast;
  };

})();

});
;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

exports.MozillaAST = {};

exports.MozillaAST.BaseVisitor = lang.class.create(Object, "lively.ast.MozillaAST.BaseVisitor",
// This code was generated with:
// lively.ast.MozillaAST.createVisitorCode({pathAsParameter: true, asLivelyClass: true, parameters: ["depth","state"], name: "lively.ast.MozillaAST.BaseVisitor", useReturn: true, openWindow: true});
"visiting", {
  accept: function(node, depth, state, path) {
    path = path || [];
    return this['visit' + node.type](node, depth, state, path);
  },

  visitProgram: function(node, depth, state, path) {
    var retVal;
    node.body.forEach(function(ea, i) {
      // ea is of type Statement
      retVal = this.accept(ea, depth, state, path.concat(["body", i]));
    }, this);
    return retVal;
  },

  visitFunction: function(node, depth, state, path) {
    var retVal;
    if (node.id) {
      // id is a node of type Identifier
      retVal = this.accept(node.id, depth, state, path.concat(["id"]));
    }

    node.params.forEach(function(ea, i) {
      // ea is of type Pattern
      retVal = this.accept(ea, depth, state, path.concat(["params", i]));
    }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitStatement: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitEmptyStatement: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitBlockStatement: function(node, depth, state, path) {
    var retVal;
    node.body.forEach(function(ea, i) {
      // ea is of type Statement
      retVal = this.accept(ea, depth, state, path.concat(["body", i]));
    }, this);
    return retVal;
  },

  visitExpressionStatement: function(node, depth, state, path) {
    var retVal;
    // expression is a node of type Expression
    retVal = this.accept(node.expression, depth, state, path.concat(["expression"]));
    return retVal;
  },

  visitIfStatement: function(node, depth, state, path) {
    var retVal;
    // test is a node of type Expression
    retVal = this.accept(node.test, depth, state, path.concat(["test"]));

    // consequent is a node of type Statement
    retVal = this.accept(node.consequent, depth, state, path.concat(["consequent"]));

    if (node.alternate) {
      // alternate is a node of type Statement
      retVal = this.accept(node.alternate, depth, state, path.concat(["alternate"]));
    }
    return retVal;
  },

  visitLabeledStatement: function(node, depth, state, path) {
    var retVal;
    // label is a node of type Identifier
    retVal = this.accept(node.label, depth, state, path.concat(["label"]));

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitBreakStatement: function(node, depth, state, path) {
    var retVal;
    if (node.label) {
      // label is a node of type Identifier
      retVal = this.accept(node.label, depth, state, path.concat(["label"]));
    }
    return retVal;
  },

  visitContinueStatement: function(node, depth, state, path) {
    var retVal;
    if (node.label) {
      // label is a node of type Identifier
      retVal = this.accept(node.label, depth, state, path.concat(["label"]));
    }
    return retVal;
  },

  visitWithStatement: function(node, depth, state, path) {
    var retVal;
    // object is a node of type Expression
    retVal = this.accept(node.object, depth, state, path.concat(["object"]));

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitSwitchStatement: function(node, depth, state, path) {
    var retVal;
    // discriminant is a node of type Expression
    retVal = this.accept(node.discriminant, depth, state, path.concat(["discriminant"]));

    node.cases.forEach(function(ea, i) {
      // ea is of type SwitchCase
      retVal = this.accept(ea, depth, state, path.concat(["cases", i]));
    }, this);

    // node.lexical has a specific type that is boolean
    if (node.lexical) {/*do stuff*/}
    return retVal;
  },

  visitReturnStatement: function(node, depth, state, path) {
    var retVal;
    if (node.argument) {
      // argument is a node of type Expression
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    }
    return retVal;
  },

  visitThrowStatement: function(node, depth, state, path) {
    var retVal;
    // argument is a node of type Expression
    retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    return retVal;
  },

  visitTryStatement: function(node, depth, state, path) {
    var retVal;
    // block is a node of type BlockStatement
    retVal = this.accept(node.block, depth, state, path.concat(["block"]));

    if (node.handler) {
      // handler is a node of type CatchClause
      retVal = this.accept(node.handler, depth, state, path.concat(["handler"]));
    }

    if (node.guardedHandlers) {
      node.guardedHandlers.forEach(function(ea, i) {
        // ea is of type CatchClause
        retVal = this.accept(ea, depth, state, path.concat(["guardedHandlers", i]));
      }, this);
    }

    if (node.finalizer) {
      // finalizer is a node of type BlockStatement
      retVal = this.accept(node.finalizer, depth, state, path.concat(["finalizer"]));
    }
    return retVal;
  },

  visitWhileStatement: function(node, depth, state, path) {
    var retVal;
    // test is a node of type Expression
    retVal = this.accept(node.test, depth, state, path.concat(["test"]));

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitDoWhileStatement: function(node, depth, state, path) {
    var retVal;
    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // test is a node of type Expression
    retVal = this.accept(node.test, depth, state, path.concat(["test"]));
    return retVal;
  },

  visitForStatement: function(node, depth, state, path) {
    var retVal;
    if (node.init) {
      // init is a node of type VariableDeclaration
      retVal = this.accept(node.init, depth, state, path.concat(["init"]));
    }

    if (node.test) {
      // test is a node of type Expression
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
    }

    if (node.update) {
      // update is a node of type Expression
      retVal = this.accept(node.update, depth, state, path.concat(["update"]));
    }

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitForInStatement: function(node, depth, state, path) {
    var retVal;
    // left is a node of type VariableDeclaration
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.each has a specific type that is boolean
    if (node.each) {/*do stuff*/}
    return retVal;
  },

  visitForOfStatement: function(node, depth, state, path) {
    var retVal;
    // left is a node of type VariableDeclaration
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitLetStatement: function(node, depth, state, path) {
    var retVal;
    node.head.forEach(function(ea, i) {
      // ea is of type VariableDeclarator
      retVal = this.accept(ea, depth, state, path.concat(["head", i]));
    }, this);

    // body is a node of type Statement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitDebuggerStatement: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitDeclaration: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitFunctionDeclaration: function(node, depth, state, path) {
    var retVal;
    // id is a node of type Identifier
    retVal = this.accept(node.id, depth, state, path.concat(["id"]));

    node.params.forEach(function(ea, i) {
      // ea is of type Pattern
      retVal = this.accept(ea, depth, state, path.concat(["params", i]));
    }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitVariableDeclaration: function(node, depth, state, path) {
    var retVal;
    node.declarations.forEach(function(ea, i) {
      // ea is of type VariableDeclarator
      retVal = this.accept(ea, depth, state, path.concat(["declarations", i]));
    }, this);

    // node.kind is "var" or "let" or "const"
    return retVal;
  },

  visitVariableDeclarator: function(node, depth, state, path) {
    var retVal;
    // id is a node of type Pattern
    retVal = this.accept(node.id, depth, state, path.concat(["id"]));

    if (node.init) {
      // init is a node of type Expression
      retVal = this.accept(node.init, depth, state, path.concat(["init"]));
    }
    return retVal;
  },

  visitExpression: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitThisExpression: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitArrayExpression: function(node, depth, state, path) {
    var retVal;
    node.elements.forEach(function(ea, i) {
      if (ea) {
        // ea can be of type Expression or
        retVal = this.accept(ea, depth, state, path.concat(["elements", i]));
      }
    }, this);
    return retVal;
  },

  visitObjectExpression: function(node, depth, state, path) {
    var retVal;
    node.properties.forEach(function(ea, i) {
      // ea is of type Property
      retVal = this.accept(ea, depth, state, path.concat(["properties", i]));
    }, this);
    return retVal;
  },

  visitProperty: function(node, depth, state, path) {
    var retVal;
    // key is a node of type Literal
    retVal = this.accept(node.key, depth, state, path.concat(["key"]));

    // value is a node of type Expression
    retVal = this.accept(node.value, depth, state, path.concat(["value"]));

    // node.kind is "init" or "get" or "set"
    return retVal;
  },

  visitFunctionExpression: function(node, depth, state, path) {
    var retVal;
    if (node.id) {
      // id is a node of type Identifier
      retVal = this.accept(node.id, depth, state, path.concat(["id"]));
    }

    node.params.forEach(function(ea, i) {
      // ea is of type Pattern
      retVal = this.accept(ea, depth, state, path.concat(["params", i]));
    }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitArrowExpression: function(node, depth, state, path) {
    var retVal;
    node.params.forEach(function(ea, i) {
      // ea is of type Pattern
      retVal = this.accept(ea, depth, state, path.concat(["params", i]));
    }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitArrowFunctionExpression: function(node, depth, state, path) {
    var retVal;
    node.params.forEach(function(ea, i) {
      // ea is of type Pattern
      retVal = this.accept(ea, depth, state, path.concat(["params", i]));
    }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, state, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, state, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitSequenceExpression: function(node, depth, state, path) {
    var retVal;
    node.expressions.forEach(function(ea, i) {
      // ea is of type Expression
      retVal = this.accept(ea, depth, state, path.concat(["expressions", i]));
    }, this);
    return retVal;
  },

  visitUnaryExpression: function(node, depth, state, path) {
    var retVal;
    // node.operator is an UnaryOperator enum:
    // "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"

    // node.prefix has a specific type that is boolean
    if (node.prefix) {/*do stuff*/}

    // argument is a node of type Expression
    retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    return retVal;
  },

  visitBinaryExpression: function(node, depth, state, path) {
    var retVal;
    // node.operator is an BinaryOperator enum:
    // "==" | "!=" | "===" | "!==" | | "<" | "<=" | ">" | ">=" | | "<<" | ">>" | ">>>" | | "+" | "-" | "*" | "/" | "%" | | "|" | "^" | "&" | "in" | | "instanceof" | ".."

    // left is a node of type Expression
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));
    return retVal;
  },

  visitAssignmentExpression: function(node, depth, state, path) {
    var retVal;
    // node.operator is an AssignmentOperator enum:
    // "=" | "+=" | "-=" | "*=" | "/=" | "%=" | | "<<=" | ">>=" | ">>>=" | | "|=" | "^=" | "&="

    // left is a node of type Pattern
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));
    return retVal;
  },

  visitUpdateExpression: function(node, depth, state, path) {
    var retVal;
    // node.operator is an UpdateOperator enum:
    // "++" | "--"

    // argument is a node of type Expression
    retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));

    // node.prefix has a specific type that is boolean
    if (node.prefix) {/*do stuff*/}
    return retVal;
  },

  visitLogicalExpression: function(node, depth, state, path) {
    var retVal;
    // node.operator is an LogicalOperator enum:
    // "||" | "&&"

    // left is a node of type Expression
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));
    return retVal;
  },

  visitConditionalExpression: function(node, depth, state, path) {
    var retVal;
    // test is a node of type Expression
    retVal = this.accept(node.test, depth, state, path.concat(["test"]));

    // alternate is a node of type Expression
    retVal = this.accept(node.alternate, depth, state, path.concat(["alternate"]));

    // consequent is a node of type Expression
    retVal = this.accept(node.consequent, depth, state, path.concat(["consequent"]));
    return retVal;
  },

  visitNewExpression: function(node, depth, state, path) {
    var retVal;
    // callee is a node of type Expression
    retVal = this.accept(node.callee, depth, state, path.concat(["callee"]));

    node.arguments.forEach(function(ea, i) {
      // ea is of type Expression
      retVal = this.accept(ea, depth, state, path.concat(["arguments", i]));
    }, this);
    return retVal;
  },

  visitCallExpression: function(node, depth, state, path) {
    var retVal;
    // callee is a node of type Expression
    retVal = this.accept(node.callee, depth, state, path.concat(["callee"]));

    node.arguments.forEach(function(ea, i) {
      // ea is of type Expression
      retVal = this.accept(ea, depth, state, path.concat(["arguments", i]));
    }, this);
    return retVal;
  },

  visitMemberExpression: function(node, depth, state, path) {
    var retVal;
    // object is a node of type Expression
    retVal = this.accept(node.object, depth, state, path.concat(["object"]));

    // property is a node of type Identifier
    retVal = this.accept(node.property, depth, state, path.concat(["property"]));

    // node.computed has a specific type that is boolean
    if (node.computed) {/*do stuff*/}
    return retVal;
  },

  visitYieldExpression: function(node, depth, state, path) {
    var retVal;
    if (node.argument) {
      // argument is a node of type Expression
      retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    }
    return retVal;
  },

  visitComprehensionExpression: function(node, depth, state, path) {
    var retVal;
    // body is a node of type Expression
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    node.blocks.forEach(function(ea, i) {
      // ea is of type ComprehensionBlock or ComprehensionIf
      retVal = this.accept(ea, depth, state, path.concat(["blocks", i]));
    }, this);

    if (node.filter) {
      // filter is a node of type Expression
      retVal = this.accept(node.filter, depth, state, path.concat(["filter"]));
    }
    return retVal;
  },

  visitGeneratorExpression: function(node, depth, state, path) {
    var retVal;
    // body is a node of type Expression
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));

    node.blocks.forEach(function(ea, i) {
      // ea is of type ComprehensionBlock or ComprehensionIf
      retVal = this.accept(ea, depth, state, path.concat(["blocks", i]));
    }, this);

    if (node.filter) {
      // filter is a node of type Expression
      retVal = this.accept(node.filter, depth, state, path.concat(["filter"]));
    }
    return retVal;
  },

  visitLetExpression: function(node, depth, state, path) {
    var retVal;
    node.head.forEach(function(ea, i) {
      if (ea) {
        // ea can be of type VariableDeclarator or
        retVal = this.accept(ea, depth, state, path.concat(["head", i]));
      }
    }, this);

    // body is a node of type Expression
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitPattern: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitObjectPattern: function(node, depth, state, path) {
    var retVal;
    node.properties.forEach(function(ea, i) {
      // ea.key is of type node
      retVal = this.accept(ea.key, depth, state, path.concat(["properties", i, "key"]));
      // ea.value is of type node
      retVal = this.accept(ea.value, depth, state, path.concat(["properties", i, "value"]));
    }, this);
    return retVal;
  },

  visitArrayPattern: function(node, depth, state, path) {
    var retVal;
    node.elements.forEach(function(ea, i) {
      if (ea) {
        // ea can be of type Pattern or
        retVal = this.accept(ea, depth, state, path.concat(["elements", i]));
      }
    }, this);
    return retVal;
  },

  // intermediate addition until this becomes part of the official Mozilla AST spec
  // interface RestElement <: Pattern {
  //     type: "RestElement";
  //     argument: Pattern;
  // }
  visitRestElement: function(node, depth, state, path) {
    var retVal;
    // argument is a node of type Pattern
    retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    return retVal;
  },

  visitSwitchCase: function(node, depth, state, path) {
    var retVal;
    if (node.test) {
      // test is a node of type Expression
      retVal = this.accept(node.test, depth, state, path.concat(["test"]));
    }

    node.consequent.forEach(function(ea, i) {
      // ea is of type Statement
      retVal = this.accept(ea, depth, state, path.concat(["consequent", i]));
    }, this);
    return retVal;
  },

  visitCatchClause: function(node, depth, state, path) {
    var retVal;
    // param is a node of type Pattern
    retVal = this.accept(node.param, depth, state, path.concat(["param"]));

    if (node.guard) {
      // guard is a node of type Expression
      retVal = this.accept(node.guard, depth, state, path.concat(["guard"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitComprehensionBlock: function(node, depth, state, path) {
    var retVal;
    // left is a node of type Pattern
    retVal = this.accept(node.left, depth, state, path.concat(["left"]));

    // right is a node of type Expression
    retVal = this.accept(node.right, depth, state, path.concat(["right"]));

    // node.each has a specific type that is boolean
    if (node.each) {/*do stuff*/}
    return retVal;
  },

  visitComprehensionIf: function(node, depth, state, path) {
    var retVal;
    // test is a node of type Expression
    retVal = this.accept(node.test, depth, state, path.concat(["test"]));
    return retVal;
  },

  visitIdentifier: function(node, depth, state, path) {
    var retVal;
    // node.name has a specific type that is string
    return retVal;
  },

  visitLiteral: function(node, depth, state, path) {
    var retVal;
    if (node.value) {
      // node.value has a specific type that is string or boolean or number or RegExp
    }
    return retVal;
  },

  visitClassDeclaration: function(node, depth, state, path) {
    var retVal;
    // id is a node of type Identifier
    retVal = this.accept(node.id, depth, state, path.concat(["id"]));

    if (node.superClass) {
      // superClass is a node of type Identifier
      retVal = this.accept(node.superClass, depth, state, path.concat(["superClass"]));
    }

    // body is a node of type ClassBody
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitClassBody: function(node, depth, state, path) {
    var retVal;
    node.body.forEach(function(ea, i) {
      // ea is of type MethodDefinition
      retVal = this.accept(ea, depth, state, path.concat(["body", i]));
    }, this);
    return retVal;
  },

  visitMethodDefinition: function(node, depth, state, path) {
    var retVal;
    // node.static has a specific type that is boolean
    if (node.static) {/*do stuff*/}

    // node.computed has a specific type that is boolean
    if (node.computed) {/*do stuff*/}

    // node.kind is ""

    // key is a node of type Identifier
    retVal = this.accept(node.key, depth, state, path.concat(["key"]));

    // value is a node of type FunctionExpression
    retVal = this.accept(node.value, depth, state, path.concat(["value"]));
    return retVal;
  },

  visitJSXIdentifier: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitJSXMemberExpression: function(node, depth, state, path) {
    var retVal;
    // object is a node of type JSXMemberExpression
    retVal = this.accept(node.object, depth, state, path.concat(["object"]));

    // property is a node of type JSXIdentifier
    retVal = this.accept(node.property, depth, state, path.concat(["property"]));
    return retVal;
  },

  visitJSXNamespacedName: function(node, depth, state, path) {
    var retVal;
    // namespace is a node of type JSXIdentifier
    retVal = this.accept(node.namespace, depth, state, path.concat(["namespace"]));

    // name is a node of type JSXIdentifier
    retVal = this.accept(node.name, depth, state, path.concat(["name"]));
    return retVal;
  },

  visitJSXEmptyExpression: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitJSXBoundaryElement: function(node, depth, state, path) {
    var retVal;
    // name is a node of type JSXIdentifier
    retVal = this.accept(node.name, depth, state, path.concat(["name"]));
    return retVal;
  },

  visitJSXOpeningElement: function(node, depth, state, path) {
    var retVal;
    node.attributes.forEach(function(ea, i) {
      // ea is of type JSXAttribute or JSXSpreadAttribute
      retVal = this.accept(ea, depth, state, path.concat(["attributes", i]));
    }, this);

    // node.selfClosing has a specific type that is boolean
    if (node.selfClosing) {/*do stuff*/}
    return retVal;
  },

  visitJSXClosingElement: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitJSXAttribute: function(node, depth, state, path) {
    var retVal;
    // name is a node of type JSXIdentifier
    retVal = this.accept(node.name, depth, state, path.concat(["name"]));

    if (node.value) {
      // value is a node of type Literal
      retVal = this.accept(node.value, depth, state, path.concat(["value"]));
    }
    return retVal;
  },

  visitSpreadElement: function(node, depth, state, path) {
    var retVal;
    // argument is a node of type Expression
    retVal = this.accept(node.argument, depth, state, path.concat(["argument"]));
    return retVal;
  },

  visitJSXSpreadAttribute: function(node, depth, state, path) {
    var retVal;
    return retVal;
  },

  visitJSXElement: function(node, depth, state, path) {
    var retVal;
    // openingElement is a node of type JSXOpeningElement
    retVal = this.accept(node.openingElement, depth, state, path.concat(["openingElement"]));

    node.children.forEach(function(ea, i) {
      // ea is of type Literal or JSXExpressionContainer or JSXElement
      retVal = this.accept(ea, depth, state, path.concat(["children", i]));
    }, this);

    if (node.closingElement) {
      // closingElement is a node of type JSXClosingElement
      retVal = this.accept(node.closingElement, depth, state, path.concat(["closingElement"]));
    }
    return retVal;
  },

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // https://github.com/estree/estree
  // rk 2015-10-31

  visitTemplateLiteral: function(node, depth, state, path) {
    var retVal;
    node.quasis.forEach(function(ea, i) {
      // ea is of type TemplateElement
      retVal = this.accept(ea, depth, state, path.concat(["quasis", i]));
    }, this);
    node.expressions.forEach(function(ea, i) {
      // ea is of type Expression
      retVal = this.accept(ea, depth, state, path.concat(["expressions", i]));
    }, this);
    return retVal;
  },

  visitTaggedTemplateExpression: function(node, depth, state, path) {
    var retVal;
    // tag is of type Expression
    retVal = this.accept(node.tag, depth, state, path.concat(["tag"]));
    // quasi is of type TemplateLiteral
    retVal = this.accept(node.quasi, depth, state, path.concat(["quasi"]));
    return retVal;
  },

  visitTemplateElement: function(node, depth, state, path) {
    // node.tail is of type boolean
    // node.value is {cooked: string;raw: string;}
  }

});

exports.MozillaAST.PrinterVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, 'lively.ast.PrinterVisitor', {

  accept: function($super, node, state, tree, path) {
    var pathString = path
      .map(function(ea) { return typeof ea === 'string' ? '.' + ea : '[' + ea + ']'})
      .join('')
    var myChildren = [];
    $super(node, state, myChildren, path);
    tree.push({
      node: node,
      path: pathString,
      index: state.index++,
      children: myChildren
    });
  }

});

exports.MozillaAST.ComparisonVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, "lively.ast.ComparisonVisitor",
"comparison", {

  recordNotEqual: function(node1, node2, state, msg) {
    state.comparisons.errors.push({
      node1: node1, node2: node2,
      path: state.completePath, msg: msg
    });
  },

  compareType: function(node1, node2, state) {
    return this.compareField('type', node1, node2, state);
  },

  compareField: function(field, node1, node2, state) {
    node2 = lively.PropertyPath(state.completePath.join('.')).get(node2);
    if (node1 && node2 && node1[field] === node2[field]) return true;
    if ((node1 && node1[field] === '*') || (node2 && node2[field] === '*')) return true;
    var fullPath = state.completePath.join('.') + '.' + field, msg;
    if (!node1) msg = "node1 on " + fullPath + " not defined";
    else if (!node2) msg = 'node2 not defined but node1 (' + fullPath + ') is: '+ node1[field];
    else msg = fullPath + ' is not equal: ' + node1[field] + ' vs. ' + node2[field];
    this.recordNotEqual(node1, node2, state, msg);
    return false;
  }

},
"visiting", {

  accept: function(node1, node2, state, path) {
    var patternNode = lively.PropertyPath(path.join('.')).get(node2);
    if (node1 === '*' || patternNode === '*') return;
    var nextState = {
      completePath: path,
      comparisons: state.comparisons
    };
    if (this.compareType(node1, node2, nextState))
      this['visit' + node1.type](node1, node2, nextState, path);
  },

  visitFunction: function($super, node1, node2, state, path) {
    // node1.generator has a specific type that is boolean
    if (node1.generator) { this.compareField("generator", node1, node2, state); }

    // node1.expression has a specific type that is boolean
    if (node1.expression) { this.compareField("expression", node1, node2, state); }

    $super(node1, node2, state, path);
  },

  visitSwitchStatement: function($super, node1, node2, state, path) {
    // node1.lexical has a specific type that is boolean
    if (node1.lexical) { this.compareField("lexical", node1, node2, state); }

    $super(node1, node2, state, path);
  },

  visitForInStatement: function($super, node1, node2, state, path) {
    // node1.each has a specific type that is boolean
    if (node1.each) { this.compareField("each", node1, node2, state); }

    $super(node1, node2, state, path);
  },

  visitFunctionDeclaration: function($super, node1, node2, state, path) {
    // node1.generator has a specific type that is boolean
    if (node1.generator) { this.compareField("generator", node1, node2, state); }

    // node1.expression has a specific type that is boolean
    if (node1.expression) { this.compareField("expression", node1, node2, state); }

    $super(node1, node2, state, path);
  },

  visitVariableDeclaration: function($super, node1, node2, state, path) {
    // node1.kind is "var" or "let" or "const"
    this.compareField("kind", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitUnaryExpression: function($super, node1, node2, state, path) {
    // node1.operator is an UnaryOperator enum:
    // "-" | "+" | "!" | "~" | "typeof" | "void" | "delete"
    this.compareField("operator", node1, node2, state);

    // node1.prefix has a specific type that is boolean
    if (node1.prefix) { this.compareField("prefix", node1, node2, state); }

    $super(node1, node2, state, path);
  },

  visitBinaryExpression: function($super, node1, node2, state, path) {
    // node1.operator is an BinaryOperator enum:
    // "==" | "!=" | "===" | "!==" | | "<" | "<=" | ">" | ">=" | | "<<" | ">>" | ">>>" | | "+" | "-" | "*" | "/" | "%" | | "|" | "^" | "&" | "in" | | "instanceof" | ".."
    this.compareField("operator", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitAssignmentExpression: function($super, node1, node2, state, path) {
    // node1.operator is an AssignmentOperator enum:
    // "=" | "+=" | "-=" | "*=" | "/=" | "%=" | | "<<=" | ">>=" | ">>>=" | | "|=" | "^=" | "&="
    this.compareField("operator", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitUpdateExpression: function($super, node1, node2, state, path) {
    // node1.operator is an UpdateOperator enum:
    // "++" | "--"
    this.compareField("operator", node1, node2, state);
    // node1.prefix has a specific type that is boolean
    if (node1.prefix) { this.compareField("prefix", node1, node2, state); }
    $super(node1, node2, state, path);
  },

  visitLogicalExpression: function($super, node1, node2, state, path) {
    // node1.operator is an LogicalOperator enum:
    // "||" | "&&"
    this.compareField("operator", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitMemberExpression: function($super, node1, node2, state, path) {
    // node1.computed has a specific type that is boolean
    if (node1.computed) { this.compareField("computed", node1, node2, state); }
    $super(node1, node2, state, path);
  },

  visitComprehensionBlock: function($super, node1, node2, state, path) {
    // node1.each has a specific type that is boolean
    if (node1.each) { this.compareField("each", node1, node2, state); }
    $super(node1, node2, state, path);
  },

  visitIdentifier: function($super, node1, node2, state, path) {
    // node1.name has a specific type that is string
    this.compareField("name", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitLiteral: function($super, node1, node2, state, path) {
    this.compareField("value", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitClassDeclaration: function($super, node1, node2, state, path) {
    this.compareField("id", node1, node2, state);
    if (node1.superClass) {
      this.compareField("superClass", node1, node2, state);
    }
    this.compareField("body", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitClassBody: function($super, node1, node2, state, path) {
    this.compareField("body", node1, node2, state);
    $super(node1, node2, state, path);
  },

  visitMethodDefinition: function($super, node1, node2, state, path) {
    this.compareField("static", node1, node2, state);
    this.compareField("computed", node1, node2, state);
    this.compareField("kind", node1, node2, state);
    this.compareField("key", node1, node2, state);
    this.compareField("value", node1, node2, state);
    $super(node1, node2, state, path);
  }
});

exports.MozillaAST.ScopeVisitor = lang.class.create(exports.MozillaAST.BaseVisitor, "lively.ast.ScopeVisitor",
'scope specific', {
  newScope: function(scopeNode, parentScope) {
    var scope = {
      node: scopeNode,
      varDecls: [],
      varDeclPaths: [],
      funcDecls: [],
      classDecls: [],
      methodDecls: [],
      refs: [],
      params: [],
      catches: [],
      subScopes: []
    }
    if (parentScope) parentScope.subScopes.push(scope);
    return scope;
  }
},
'visiting', {

  accept: function (node, depth, scope, path) {
    path = path || [];
    if (!this['visit' + node.type]) throw new Error("No AST visit handler for type " + node.type);
    return this['visit' + node.type](node, depth, scope, path);
  },

  visitVariableDeclaration: function ($super, node, depth, scope, path) {
    scope.varDecls.push(node);
    scope.varDeclPaths.push(path);
    return $super(node, depth, scope, path);
  },

  visitVariableDeclarator: function (node, depth, scope, path) {
    var retVal;

    // ignore id
    // scope.varDeclPaths.push(path);
    // if (node.id.type === "Identifier") {
    //   scope.varDecls.push(node);
    // }
    // retVal = this.accept(node.id, depth, scope, path.concat(["id"]));

    if (node.init) {
      retVal = this.accept(node.init, depth, scope, path.concat(["init"]));
    }
    return retVal;
  },

  visitFunction: function (node, depth, scope, path) {
    var newScope = this.newScope(node, scope);
    newScope.params = Array.prototype.slice.call(node.params);
    return newScope;
  },

  visitFunctionDeclaration: function ($super, node, depth, scope, path) {
    scope.funcDecls.push(node);
    var newScope = this.visitFunction(node, depth, scope, path);

    // don't visit id and params
    var retVal;
    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
      }, this);
    }
    if (node.rest) {
      retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
    }
    retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));
    return retVal;
  },

  visitFunctionExpression: function ($super, node, depth, scope, path) {
    var newScope = this.visitFunction(node, depth, scope, path);

    // don't visit id and params
    var retVal;
    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
    }
    retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));
    return retVal;

  },

  visitArrowFunctionExpression: function($super, node, depth, scope, path) {
    var newScope = this.visitFunction(node, depth, scope, path);

    var retVal;
    // ignore params
    // node.params.forEach(function(ea, i) {
    //   // ea is of type Pattern
    //   retVal = this.accept(ea, depth, scope, path.concat(["params", i]));
    // }, this);

    if (node.defaults) {
      node.defaults.forEach(function(ea, i) {
        // ea is of type Expression
        retVal = this.accept(ea, depth, newScope, path.concat(["defaults", i]));
      }, this);
    }

    if (node.rest) {
      // rest is a node of type Identifier
      retVal = this.accept(node.rest, depth, newScope, path.concat(["rest"]));
    }

    // body is a node of type BlockStatement
    retVal = this.accept(node.body, depth, newScope, path.concat(["body"]));

    // node.generator has a specific type that is boolean
    if (node.generator) {/*do stuff*/}

    // node.expression has a specific type that is boolean
    if (node.expression) {/*do stuff*/}
    return retVal;
  },

  visitIdentifier: function ($super, node, depth, scope, path) {
    scope.refs.push(node);
    return $super(node, depth, scope, path);
  },

  visitMemberExpression: function (node, depth, state, path) {
    // only visit property part when prop is computed so we don't gather
    // prop ids
    var retVal;
    retVal = this.accept(node.object, depth, state, path.concat(["object"]));
    if (node.computed) {
      retVal = this.accept(node.property, depth, state, path.concat(["property"]));
    }
    return retVal;
  },

  visitProperty: function(node, depth, state, path) {
    var retVal;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
    // no keys for scope
    // key is a node of type Literal
    // retVal = this.accept(node.key, depth, state, path.concat(["key"]));

    // value is a node of type Expression
    retVal = this.accept(node.value, depth, state, path.concat(["value"]));

    // node.kind is "init" or "get" or "set"
    return retVal;
  },

  visitTryStatement: function (node, depth, scope, path) {
    var retVal;
    // block is a node of type Blockscopement
    retVal = this.accept(node.block, depth, scope, path.concat(["block"]));

    if (node.handler) {
      // handler is a node of type CatchClause
      retVal = this.accept(node.handler, depth, scope, path.concat(["handler"]));
      scope.catches.push(node.handler.param);
    }

    node.guardedHandlers && node.guardedHandlers.forEach(function(ea, i) {
      retVal = this.accept(ea, depth, scope, path.concat(["guardedHandlers", i]));
    }, this);

    if (node.finalizer) {
      retVal = this.accept(node.finalizer, depth, scope, path.concat(["finalizer"]));
    }
    return retVal;
  },

  visitLabeledStatement: function (node, depth, state, path) {
    var retVal;
    // ignore label
    retVal = this.accept(node.body, depth, state, path.concat(["body"]));
    return retVal;
  },

  visitClassDeclaration: function(node, depth, scope, path) {
    scope.classDecls.push(node);

    var retVal;
    // id is a node of type Identifier
    // retVal = this.accept(node.id, depth, state, path.concat(["id"]));

    if (node.superClass) {
      this.accept(node.superClass, depth, scope, path.concat(["superClass"]));
    }

    // body is a node of type ClassBody
    retVal = this.accept(node.body, depth, scope, path.concat(["body"]));
    return retVal;
  },

  visitMethodDefinition: function(node, depth, scope, path) {
    var retVal;

    // don't visit key Identifier for now
    // retVal = this.accept(node.key, depth, scope, path.concat(["key"]));

    // value is a node of type FunctionExpression
    retVal = this.accept(node.value, depth, scope, path.concat(["value"]));
    return retVal;
  },

  visitBreakStatement: function(node, depth, scope, path) { return null; },
  visitContinueStatement: function(node, depth, scope, path) { return null; }

});

});
;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.escodegen, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, escodegen, lively, lang, exports) {

var methods = {

  withMozillaAstDo: function(ast, state, func) {
    // simple interface to mozilla AST visitor. function gets passed three
    // arguments:
    // acceptNext, -- continue visiting
    // node, -- current node being visited
    // state -- state variable that is passed along
    var vis = new exports.MozillaAST.BaseVisitor(),
        origAccept = vis.accept;
    vis.accept = function(node, depth, st, path) {
      var next = function() { origAccept.call(vis, node, depth, st, path); }
      return func(next, node, st, depth, path);
    }
    return vis.accept(ast, 0, state, []);
  },

  printAst: function(astOrSource, options) {
    options = options || {};
    var printSource = options.printSource || false,
      printPositions = options.printPositions || false,
      printIndex = options.printIndex || false,
      source, ast, tree = [];

    if (typeof astOrSource === "string") {
      source = astOrSource;
      ast = lively.ast.acorn.parse(astOrSource);
    } else { ast = astOrSource; source = options.source || ast.source; }

    if (printSource && !ast.source) { // ensure that nodes have source attached
      if (!source) {
        source = escodegen.generate(ast);
        ast = exports.acorn.parse(source);
      }
      acorn.walk.addSource(ast, source);
    }

    function printFunc(ea) {
      var string = ea.path + ':' + ea.node.type, additional = [];
      if (printIndex) { additional.push(ea.index); }
      if (printPositions) { additional.push(ea.node.start + '-' + ea.node.end); }
      if (printSource) {
        var src = ea.node.source || source.slice(ea.node.start, ea.node.end),
          printed = Strings.print(src.truncate(60).replace(/\n/g, '').replace(/\s+/g, ' '));
        additional.push(printed);
      }
      if (additional.length) { string += '(' + additional.join(',') + ')'; }
      return string;
    }

    new exports.PrinterVisitor().accept(ast, {index: 0}, tree, []);
    return Strings.printTree(tree[0], printFunc, function(ea) { return ea.children; }, '  ');
  },

  compareAst: function(node1, node2) {
    if (!node1 || !node2) throw new Error('node' + (node1 ? '1' : '2') + ' not defined');
    var state = {completePath: [], comparisons: {errors: []}};
    new exports.ComparisonVisitor().accept(node1, node2, state, []);
    return !state.comparisons.errors.length ? null : state.comparisons.errors.pluck('msg');
  },

  pathToNode: function(ast, index, options) {
    options = options || {};
    if (!ast.astIndex) acorn.walk.addAstIndex(ast);
    var vis = new exports.MozillaAST.BaseVisitor(), found = null;
    (vis.accept = function (node, pathToHere, state, path) {
      if (found) return;
      var fullPath = pathToHere.concat(path);
      if (node.astIndex === index) {
        var pathString = fullPath
          .map(function(ea) { return typeof ea === 'string' ? '.' + ea : '[' + ea + ']'})
          .join('');
        found = {pathString: pathString, path: fullPath, node: node};
      }
      return this['visit' + node.type](node, fullPath, state, path);
    }).call(vis,ast, [], {}, []);
    return found;
  },

  rematchAstWithSource: function(ast, source, addLocations, subTreePath) {
    addLocations = !!addLocations;
    var ast2 = exports.parse(source, addLocations ? { locations: true } : undefined),
        visitor = new exports.MozillaAST.BaseVisitor();
    if (subTreePath) ast2 = lang.Path(subTreePath).get(ast2);

    visitor.accept = function(node, depth, state, path) {
      path = path || [];
      var node2 = path.reduce(function(node, pathElem) {
        return node[pathElem];
      }, ast);
      node2.start = node.start;
      node2.end = node.end;
      if (addLocations) node2.loc = node.loc;
      return this['visit' + node.type](node, depth, state, path);
    }

    visitor.accept(ast2);
  },

  stringify: function(ast, options) {
    return escodegen.generate(ast, options)
  }

}

lang.obj.extend(exports, methods);

// FIXME! Don't extend acorn object!
lang.obj.extend(acorn, methods);

});
;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

var arr = lang.arr, chain = lang.chain;

var helpers = {

  declIds: function(nodes) {
    return arr.flatmap(nodes, function(ea) {
      if (!ea) return [];
      if (ea.type === "Identifier") return [ea];
      if (ea.type === "RestElement") return [ea.argument];
      if (ea.type === "ObjectPattern")
        return helpers.declIds(arr.pluck(ea.properties, "value"));
      if (ea.type === "ArrayPattern")
        return helpers.declIds(ea.elements);
      return [];
    });
  },

  varDeclIds: function(scope) {
    return helpers.declIds(
      chain(scope.varDecls)
        .pluck('declarations')
        .flatten()
        .pluck('id')
        .value());
  },

  objPropertiesAsList: function objPropertiesAsList(objExpr, path, onlyLeafs) {
    // takes an obj expr like {x: 23, y: [{z: 4}]} an returns the key and value
    // nodes as a list
    return arr.flatmap(objExpr.properties, function(prop) {
      var key = prop.key.name
      // var result = [{key: path.concat([key]), value: prop.value}];
      var result = [];
      var thisNode = {key: path.concat([key]), value: prop.value};
      switch (prop.value.type) {
        case "ArrayExpression": case "ArrayPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(arr.flatmap(prop.value.elements, function(el, i) {
            return objPropertiesAsList(el, path.concat([key, i]), onlyLeafs); }));
          break;
        case "ObjectExpression": case "ObjectPattern":
          if (!onlyLeafs) result.push(thisNode);
          result = result.concat(objPropertiesAsList(prop.value, path.concat([key]), onlyLeafs));
          break;
        default: result.push(thisNode);
      }
      return result;
    });
  }
}

exports.query = {

  helpers: helpers,

  knownGlobals: [
     "true", "false", "null", "undefined", "arguments",
     "Object", "Function", "String", "Array", "Date", "Boolean", "Number", "RegExp",
     "Error", "EvalError", "RangeError", "ReferenceError", "SyntaxError", "TypeError", "URIError",
     "Math", "NaN", "Infinity", "Intl", "JSON",
     "parseFloat", "parseInt", "isNaN", "isFinite", "eval", "alert",
     "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent",
     "window", "document", "console",
     "Node", "HTMLCanvasElement", "Image", "Class",
     "Global", "Functions", "Objects", "Strings",
     "module", "lively", "pt", "rect", "rgb", "$super", "$morph", "$world", "show"],

  scopes: function(ast) {
    var vis = new exports.MozillaAST.ScopeVisitor();
    var scope = vis.newScope(ast, null);
    vis.accept(ast, 0, scope, []);
    return scope;
  },

  nodesAtIndex: function(ast, index) {
    return acorn.withMozillaAstDo(ast, [], function(next, node, found) {
      if (node.start <= index && index <= node.end) { found.push(node); next(); }
      return found;
    });
  },

  scopesAtIndex: function(ast, index) {
    return lang.tree.filter(
      exports.query.scopes(ast),
      function(scope) {
        var n = scope.node;
        var start = n.start, end = n.end;
        if (n.type === 'FunctionDeclaration') {
          start = n.params.length ? n.params[0].start : n.body.start;
          end = n.body.end;
        }
        return start <= index && index <= end;
      },
      function(s) { return s.subScopes; });
  },

  scopeAtIndex: function(ast, index) {
    return arr.last(exports.query.scopesAtIndex(ast, index));
  },

  scopesAtPos: function(pos, ast) {
    // DEPRECATED
    // FIXME "scopes" should actually not referer to a node but to a scope
    // object, see exports.query.scopes!
    return acorn.nodesAt(pos, ast).filter(function(node) {
      return node.type === 'Program'
        || node.type === 'FunctionDeclaration'
        || node.type === 'FunctionExpression'
    });
  },

  nodesInScopeOf: function(node) {
    // DEPRECATED
    // FIXME "scopes" should actually not referer to a node but to a scope
    // object, see exports.query.scopes!
    return acorn.withMozillaAstDo(node, {root: node, result: []}, function(next, node, state) {
      state.result.push(node);
      if (node !== state.root
      && (node.type === 'Program'
       || node.type === 'FunctionDeclaration'
       || node.type === 'FunctionExpression')) return state;
      next();
      return state;
    }).result;
  },

  _declaredVarNames: function(scope, useComments) {
    return (scope.node.id && scope.node.id.name ?
        [scope.node.id && scope.node.id.name] : [])
      .concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value())
      .concat(arr.pluck(helpers.declIds(scope.params), 'name'))
      .concat(arr.pluck(scope.catches, 'name'))
      .concat(arr.pluck(helpers.varDeclIds(scope), 'name'))
      .concat(chain(scope.classDecls).pluck('id').pluck('name').value())
      .concat(!useComments ? [] :
        exports.query._findJsLintGlobalDeclarations(
          scope.node.type === 'Program' ?
            scope.node : scope.node.body));
  },


  _findJsLintGlobalDeclarations: function(node) {
    if (!node || !node.comments) return [];
    return arr.flatten(
      node.comments
        .filter(function(ea) { return ea.text.trim().match(/^global/) })
        .map(function(ea) {
          return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
        }));
  },

  topLevelDeclsAndRefs: function(ast, options) {
    options = options || {};
    options.withComments = true;

    if (typeof ast === "string") ast = exports.parse(ast, options);

    var q           = exports.query,
        scope       = exports.query.scopes(ast),
        useComments = !!options.jslintGlobalComment,
        declared    = q._declaredVarNames(scope, useComments),
        refs        = scope.refs.concat(arr.flatten(scope.subScopes.map(findUndeclaredReferences))),
        undeclared  = chain(refs).pluck('name').withoutAll(declared).value();

    return {
      scope:           scope,
      varDecls:        scope.varDecls,
      funcDecls:       scope.funcDecls,
      declaredNames:   declared,
      undeclaredNames: undeclared,
      refs:            refs
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function findUndeclaredReferences(scope) {
      var names = q._declaredVarNames(scope, useComments);
      return scope.subScopes
        .map(findUndeclaredReferences)
        .reduce(function(refs, ea) { return refs.concat(ea); }, scope.refs)
        .filter(function(ref) { return names.indexOf(ref.name) === -1; });
    }

  },

  findGlobalVarRefs: function(ast, options) {
    var q = exports.query,
        topLevel = q.topLevelDeclsAndRefs(ast, options),
        noGlobals = topLevel.declaredNames.concat(q.knownGlobals);
    return topLevel.refs.filter(function(ea) {
      return noGlobals.indexOf(ea.name) === -1; })
  },

  findNodesIncludingLines: function(ast, code, lines, options) {
    if (!code && !ast) throw new Error("Need at least ast or code");
    code = code ? code : acorn.stringify(ast);
    ast = ast && ast.loc ? ast : exports.parse(code, {locations: true});
    return acorn.withMozillaAstDo(ast, [], function(next, node, found) {
    if (lines.every(function(line) {
      return lang.num.between(line, node.loc.start.line, node.loc.end.line); })) {
      arr.pushIfNotIncluded(found, node); next(); }
    return found;
    });
  },

  findReferencesAndDeclsInScope: function(scope, name) {
    return arr.flatten( // all references
      lang.tree.map(
        scope,
        function(scope) {
          return scope.refs.concat(varDeclIdsOf(scope))
            .filter(function(ref) { return ref.name === name; });
        },
        function(s) {
          return s.subScopes.filter(function(subScope) {
            return varDeclIdsOf(subScope).every(function(id) {
              return  id.name !== name; }); });
        }));

    function varDeclIdsOf(scope) {
      return scope.params
        .concat(arr.pluck(scope.funcDecls, 'id'))
        .concat(helpers.varDeclIds(scope));
    }
  },

  findDeclarationClosestToIndex: function(ast, name, index) {
    // var scopes = lively.ast
    function varDeclIdsOf(scope) {
      return scope.params
        .concat(arr.pluck(scope.funcDecls, 'id'))
        .concat(helpers.varDeclIds(scope));
    }
    var found = null;
    arr.detect(
      exports.query.scopesAtIndex(ast, index).reverse(),
      function(scope) {
        var decls = varDeclIdsOf(scope),
            idx = arr.pluck(decls, 'name').indexOf(name);
        if (idx === -1) return false;
        found = decls[idx]; return true;
      });
    return found;
  }

};

});
;
/*global window, process, global*/

;(function(run) {
 var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
 run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

var chain = lang.chain, arr = lang.arr, str = lang.string;

exports.transform = {

  helper: {
    // currently this is used by the replacement functions below but
    // I don't wan't to make it part of our AST API

    _node2string: function(node) {
      return node.source || exports.stringify(node)
    },

    _findIndentAt: function(string, pos) {
      var bol = str.peekLeft(string, pos, /\s+$/),
        indent = typeof bol === 'number' ? string.slice(bol, pos) : '';
      if (indent[0] === '\n') indent = indent.slice(1);
      return indent;
    },

    _applyChanges: function(changes, source) {
      return changes.reduce(function(source, change) {
        if (change.type === 'del') {
          return source.slice(0, change.pos) + source.slice(change.pos + change.length);
        } else if (change.type === 'add') {
          return source.slice(0, change.pos) + change.string + source.slice(change.pos);
        }
        throw new Error('Uexpected change ' + Objects.inspect(change));
      }, source);
    },

    _compareNodesForReplacement: function(nodeA, nodeB) {
      // equals
      if (nodeA.start === nodeB.start && nodeA.end === nodeB.end) return 0;
      // a "left" of b
      if (nodeA.end <= nodeB.start) return -1;
      // a "right" of b
      if (nodeA.start >= nodeB.end) return 1;
      // a contains b
      if (nodeA.start <= nodeB.start && nodeA.end >= nodeB.end) return 1;
      // b contains a
      if (nodeB.start <= nodeA.start && nodeB.end >= nodeA.end) return -1;
      throw new Error('Comparing nodes');
    },

    memberExpression: function(keys) {
      // var keys = ["foo", "bar", [0], "baz"];
      // escodegen.generate(this.ast.transform.helper.memberExpression(keys)); // => foo.bar[0].baz
      var memberExpression = keys.slice(1).reduce(function(memberExpr, key) {
        return {
          computed: typeof key !== "string",
          object: memberExpr,
          property: nodeForKey(key),
          type: "MemberExpression"
        }
      }, nodeForKey(keys[0]))
      return memberExpression;
      return {
        type: "ExpressionStatement",
        expression: memberExpression
      };

      function nodeForKey(key) {
        return typeof key === "string" ?
          {name: key, type: "Identifier"} :
          {raw: String(key), type: "Literal", value: key}
      }
    },

    replaceNode: function(target, replacementFunc, sourceOrChanges) {
      // parameters:
      //   - target: ast node
      //   - replacementFunc that gets this node and its source snippet
      //     handed and should produce a new ast node.
      //   - sourceOrChanges: If its a string -- the source code to rewrite
      //                      If its and object -- {changes: ARRAY, source: STRING}

      var sourceChanges = typeof sourceOrChanges === 'object' ?
        sourceOrChanges : {changes: [], source: sourceOrChanges},
        insideChangedBefore = false,
        pos = sourceChanges.changes.reduce(function(pos, change) {
          // fixup the start and end indices of target using the del/add
          // changes already applied
          if (pos.end < change.pos) return pos;

          var isInFront = change.pos < pos.start;
          insideChangedBefore = insideChangedBefore
                   || change.pos >= pos.start && change.pos <= pos.end;

          if (change.type === 'add') return {
            start: isInFront ? pos.start + change.string.length : pos.start,
            end: pos.end + change.string.length
          };

          if (change.type === 'del') return {
            start: isInFront ? pos.start - change.length : pos.start,
            end: pos.end - change.length
          };

          throw new Error('Cannot deal with change ' + Objects.inspect(change));
        }, {start: target.start, end: target.end});

      var helper = exports.transform.helper,
        source = sourceChanges.source,
        replacement = replacementFunc(target, source.slice(pos.start, pos.end), insideChangedBefore),
        replacementSource = Array.isArray(replacement) ?
          replacement.map(helper._node2string).join('\n' + helper._findIndentAt(source, pos.start)):
          replacementSource = helper._node2string(replacement);

      var changes = [{type: 'del', pos: pos.start, length: pos.end - pos.start},
             {type: 'add', pos: pos.start, string: replacementSource}];

      return {
        changes: sourceChanges.changes.concat(changes),
        source: this._applyChanges(changes, source)
      };
    },

    replaceNodes: function(targetAndReplacementFuncs, sourceOrChanges) {
      // replace multiple AST nodes, order rewriting from inside out and
      // top to bottom so that nodes to rewrite can overlap or be contained
      // in each other
      return targetAndReplacementFuncs.sort(function(a, b) {
        return exports.transform.helper._compareNodesForReplacement(a.target, b.target);
      }).reduce(function(sourceChanges, ea) {
        return exports.transform.helper.replaceNode(ea.target, ea.replacementFunc, sourceChanges);
      }, typeof sourceOrChanges === 'object' ?
        sourceOrChanges : {changes: [], source: sourceOrChanges});
    }

  },

  replace: function(astOrSource, targetNode, replacementFunc, options) {
    // replaces targetNode in astOrSource with what replacementFunc returns
    // (one or multiple ast nodes)
    // Example:
    // var ast = exports.parse('foo.bar("hello");')
    // exports.transform.replace(
    //     ast, ast.body[0].expression,
    //     function(node, source) {
    //         return {type: "CallExpression",
    //             callee: {name: node.arguments[0].value, type: "Identifier"},
    //             arguments: [{value: "world", type: "Literal"}]
    //         }
    //     });
    // => {
    //      source: "hello('world');",
    //      changes: [{pos: 0,length: 16,type: "del"},{pos: 0,string: "hello('world')",type: "add"}]
    //    }

    var ast = typeof astOrSource === 'object' ? astOrSource : null,
      source = typeof astOrSource === 'string' ?
        astOrSource : (ast.source || exports.stringify(ast)),
      result = exports.transform.helper.replaceNode(targetNode, replacementFunc, source);

    return result;
  },

  replaceTopLevelVarDeclAndUsageForCapturing: function(astOrSource, assignToObj, options) {
    /* replaces var and function declarations with assignment statements.
    * Example:
       exports.transform.replaceTopLevelVarDeclAndUsageForCapturing(
         "var x = 3, y = 2, z = 4",
         {name: "A", type: "Identifier"}, ['z']).source;
       // => "A.x = 3; A.y = 2; z = 4"
    */

    var ignoreUndeclaredExcept = (options && options.ignoreUndeclaredExcept) || null
    var whitelist = (options && options.include) || null;
    var blacklist = (options && options.exclude) || [];
    var recordDefRanges = options && options.recordDefRanges;

    var ast = typeof astOrSource === 'object' ?
        astOrSource : exports.parse(astOrSource),
      source = typeof astOrSource === 'string' ?
        astOrSource : (ast.source || exports.stringify(ast)),
      topLevel = exports.query.topLevelDeclsAndRefs(ast);

    if (ignoreUndeclaredExcept) {
      blacklist = arr.withoutAll(topLevel.undeclaredNames, ignoreUndeclaredExcept).concat(blacklist);
    }

    // 1. find those var declarations that should not be rewritten. we
    // currently ignore var declarations in for loops and the error parameter
    // declaration in catch clauses
    var scope = topLevel.scope;
    arr.pushAll(blacklist, arr.pluck(scope.catches, "name"));
    var forLoopDecls = scope.varDecls.filter(function(decl, i) {
      var path = lang.Path(scope.varDeclPaths[i]),
          parent = path.slice(0,-1).get(ast);
      return parent.type === "ForStatement";
    });
    arr.pushAll(blacklist, chain(forLoopDecls).pluck("declarations").flatten().pluck("id").pluck("name").value());

    // 2. make all references declared in the toplevel scope into property
    // reads of assignToObj
    // Example "var foo = 3; 99 + foo;" -> "var foo = 3; 99 + Global.foo;"
    var result = exports.transform.helper.replaceNodes(
      topLevel.refs
        .filter(shouldRefBeCaptured)
        .map(function(ref) {
         return {
          target: ref,
          replacementFunc: function(ref) { return member(ref, assignToObj); }
         };
        }), source);

    // 3. turn var declarations into assignments to assignToObj
    // Example: "var foo = 3; 99 + foo;" -> "Global.foo = 3; 99 + foo;"
    result = exports.transform.helper.replaceNodes(
      arr.withoutAll(topLevel.varDecls, forLoopDecls)
        .map(function(decl) {
          return {
            target: decl,
            replacementFunc: function(declNode, s, wasChanged) {
              if (wasChanged) {
                var scopes = exports.query.scopes(exports.parse(s, {addSource: true}));
                declNode = scopes.varDecls[0]
              }

              return declNode.declarations.map(function(ea) {
                var init = {
                 operator: "||",
                 type: "LogicalExpression",
                 left: {computed: true, object: assignToObj,property: {type: "Literal", value: ea.id.name},type: "MemberExpression"},
                 right: {name: "undefined", type: "Identifier"}
                }
                return shouldDeclBeCaptured(ea) ?
                  assign(ea.id, ea.init || init) : varDecl(ea); });
            }
          }
        }), result);

    // 4. assignments for function declarations in the top level scope are
    // put in front of everything else:
    // "return bar(); function bar() { return 23 }" -> "Global.bar = bar; return bar(); function bar() { return 23 }"
    if (topLevel.funcDecls.length) {
      var globalFuncs = topLevel.funcDecls
        .filter(shouldDeclBeCaptured)
        .map(function(decl) {
          var funcId = {type: "Identifier", name: decl.id.name};
          return exports.stringify(assign(funcId, funcId));
        }).join('\n');


      var change = {type: 'add', pos: 0, string: globalFuncs};
      result = {
        source: globalFuncs + '\n' + result.source,
        changes: result.changes.concat([change])
      }
    }

    // 5. def ranges so that we know at which source code positions the
    // definitions are
    if (recordDefRanges)
      result.defRanges = chain(scope.varDecls)
        .pluck("declarations").flatten().value()
        .concat(scope.funcDecls)
        .reduce(function(defs, decl) {
          if (!defs[decl.id.name]) defs[decl.id.name] = []
          defs[decl.id.name].push({type: decl.type, start: decl.start, end: decl.end});
          return defs;
        }, {});

    result.ast = ast;

    return result;

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function shouldRefBeCaptured(ref) {
      return blacklist.indexOf(ref.name) === -1
        && (!whitelist || whitelist.indexOf(ref.name) > -1);
    }

    function shouldDeclBeCaptured(decl) { return shouldRefBeCaptured(decl.id); }

    function assign(id, value) {
      return {
       type: "ExpressionStatement", expression: {
        type: "AssignmentExpression", operator: "=",
        right: value || {type: "Identifier", name: 'undefined'},
        left: {
          type: "MemberExpression", computed: false,
          object: assignToObj, property: id
        }
       }
      }
    }

    function varDecl(declarator) {
      return {
       declarations: [declarator],
       kind: "var", type: "VariableDeclaration"
      }
    }

    function member(prop, obj) {
      return {
        type: "MemberExpression", computed: false,
        object: obj, property: prop
      }
    }
  },

  oneDeclaratorPerVarDecl: function(astOrSource) {
    // exports.transform.oneDeclaratorPerVarDecl(
    //    "var x = 3, y = (function() { var y = 3, x = 2; })(); ").source

    var ast = typeof astOrSource === 'object' ?
        astOrSource : exports.parse(astOrSource),
      source = typeof astOrSource === 'string' ?
        astOrSource : (ast.source || exports.stringify(ast)),
      scope = exports.query.scopes(ast),
      varDecls = (function findVarDecls(scope) {
        return arr.flatten(scope.varDecls
          .concat(scope.subScopes.map(findVarDecls)));
      })(scope);

    var targetsAndReplacements = varDecls.map(function(decl) {
      return {
        target: decl,
        replacementFunc: function(declNode, s, wasChanged) {
          if (wasChanged) {
            // reparse node if necessary, e.g. if init was changed before like in
            // var x = (function() { var y = ... })();
            declNode = exports.parse(s).body[0];
          }

          return declNode.declarations.map(function(ea) {
            return {
              type: "VariableDeclaration",
              kind: "var", declarations: [ea]
            }
          });
        }
      }
    });

    return exports.transform.helper.replaceNodes(targetsAndReplacements, source);
  },

  oneDeclaratorForVarsInDestructoring: function(astOrSource) {
    var ast = typeof astOrSource === 'object' ?
        astOrSource : exports.parse(astOrSource),
      source = typeof astOrSource === 'string' ?
        astOrSource : (ast.source || exports.stringify(ast)),
      scope = exports.query.scopes(ast),
      varDecls = (function findVarDecls(scope) {
        return arr.flatten(scope.varDecls
          .concat(scope.subScopes.map(findVarDecls)));
      })(scope);

    var targetsAndReplacements = varDecls.map(function(decl) {
      return {
        target: decl,
        replacementFunc: function(declNode, s, wasChanged) {
          if (wasChanged) {
            // reparse node if necessary, e.g. if init was changed before like in
            // var x = (function() { var y = ... })();
            declNode = exports.parse(s).body[0];
          }

          return arr.flatmap(declNode.declarations, function(declNode) {
            var extractedId = {type: "Identifier", name: "__temp"},
                extractedInit = {
                  type: "VariableDeclaration", kind: "var",
                  declarations: [{type: "VariableDeclarator", id: extractedId, init: declNode.init}]
                }

            var propDecls = arr.pluck(exports.query.helpers.objPropertiesAsList(declNode.id, [], false), "key")
              .map(function(keyPath) {
                return {
                  type: "VariableDeclaration", kind: "var",
                  declarations: [{
                    type: "VariableDeclarator", kind: "var",
                    id: {type: "Identifier", name: arr.last(keyPath)},
                    init: exports.transform.helper.memberExpression([extractedId.name].concat(keyPath))}]
                }
              });

            return [extractedInit].concat(propDecls);
          });
        }
      }
    });

    return exports.transform.helper.replaceNodes(targetsAndReplacements, source);
  },

  returnLastStatement: function(source, opts) {
    opts = opts || {};
    var parse = exports.parse,
      ast = parse(source, {ecmaVersion: 6}),
      last = ast.body.pop(),
      newLastsource = 'return ' + source.slice(last.start, last.end);
    if (!opts.asAST) return source.slice(0, last.start) + newLastsource;

    var newLast = parse(newLastsource, {allowReturnOutsideFunction: true, ecmaVersion: 6}).body.slice(-1)[0];
    ast.body.push(newLast);
    ast.end += 'return '.length;
    return ast;
  },

  wrapInFunction: function(code, opts) {
    opts = opts || {};
    var transformed = exports.transform.returnLastStatement(code, opts);
    return opts.asAST ?  {
     type: "Program",
     body: [{
      type: "ExpressionStatement",
      expression: {
       body: {body: transformed.body, type: "BlockStatement"},
       params: [],
       type: "FunctionExpression"
      },
     }]
    } : "function() {\n" + transformed + "\n}";
  }

};

});
;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

var arr = lang.arr, chain = lang.chain, obj = lang.obj,
    path = lang.Path, str = lang.string;

exports.comments = {
  getCommentPrecedingNode: function(ast, node) {
    var statementPath = acorn.walk.findStatementOfNode({asPath: true}, ast, node),
        blockPath = statementPath.slice(0, -2),
        block = path(blockPath).get(ast);
    return !block.comments || !block.comments.length ? null :
      chain(exports.comments.extractComments(ast))
        .reversed()
        .detect(function(ea) { return ea.followingNode === node; })
        .value();
  },

  extractComments: function(astOrCode, optCode) {
    var parsed = typeof astOrCode === "string" ?
          exports.parse(astOrCode, {withComments: true}) : astOrCode,
        code = optCode ? optCode : (typeof astOrCode === "string" ?
          astOrCode : exports.stringify(astOrCode)),
        parsedComments = arr.sortBy(
          commentsWithPathsAndNodes(parsed),
          function(c) { return c.comment.start; });

    return parsedComments.map(function(c, i) {

      // 1. a method comment like "x: function() {\n//foo\n ...}"?
      if (isInObjectMethod(c)) {
        return obj.merge([c, c.comment,
          {type: 'method', comment: c.comment.text},
          methodAttributesOf(c)]);
      }

      if (isInComputedMethod(c)) {
        return obj.merge([c, c.comment,
          {type: 'method', comment: c.comment.text},
          computedMethodAttributesOf(c)]);
      }

      // 2. function statement comment like "function foo() {\n//foo\n ...}"?
      if (isInFunctionStatement(c)) {
        return obj.merge([c, c.comment,
          {type: 'function', comment: c.comment.text},
          functionAttributesOf(c)]);
      }

      // 3. assigned method like "foo.bar = function(x) {/*comment*/};"
      if (isInAssignedMethod(c)) {
        return obj.merge([c, c.comment,
          {type: 'method', comment: c.comment.text},
          methodAttributesOfAssignment(c)]);
      }

      // 4. comment preceding another node?
      var followingNode = followingNodeOf(c);
      if (!followingNode) return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);

      // is there another comment in front of the node>
      var followingComment = parsedComments[i+1];
      if (followingComment && followingComment.comment.start <= followingNode.start)
        return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);

      // 3. an obj var comment like "// foo\nvar obj = {...}"?
      if (isSingleObjVarDeclaration(followingNode)) {
        return obj.merge([c, c.comment, {followingNode:followingNode},
          {type: 'object',comment: c.comment.text},
          objAttributesOf(followingNode)])
      }

      // 4. Is it a simple var declaration like "// foo\nvar obj = 23"?
      if (isSingleVarDeclaration(followingNode)) {
        return obj.merge([c, c.comment, {followingNode:followingNode},
          {type: 'var',comment: c.comment.text},
          objAttributesOf(followingNode)])
      }

      return obj.merge([c, c.comment, {followingNode:followingNode}, unknownComment(c)]);
    });

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function commentsWithPathsAndNodes(ast) {
      var comments = [];
      lively.ast.acorn.withMozillaAstDo(ast, comments, function(next, node, comments, depth, path) {
        if (node.comments) {
          arr.pushAll(comments,
            node.comments.map(function(comment) {
              return {path: path, comment: comment, node: node}; }));
        }
        next();
      });
      return comments;
    }

    function followingNodeOf(comment) {
      return arr.detect(comment.node.body, function(node) {
        return node.start > comment.comment.end; });
    }

    function unknownComment(comment) {
      return {type: "unknown", comment: comment.comment.text}
    }
    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function isInFunctionStatement(comment) {
      var node = path(comment.path.slice(0,-1)).get(parsed);
      return node && node.type === "FunctionDeclaration";
    }

    function functionAttributesOf(comment) {
      var funcNode = path(comment.path.slice(0,-1)).get(parsed),
        name = funcNode.id ? funcNode.id.name : "<error: no name for function>";
      return {name: name, args: arr.pluck(funcNode.params, "name")};
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    function isInObjectMethod(comment) {
      return arr.equals(comment.path.slice(-2), ["value", "body"]) // obj expr
    }

    function isInAssignedMethod(comment) {
      return arr.equals(comment.path.slice(-2), ["right", "body"]); // asignment
    }

    function methodAttributesOf(comment) {
      var methodNode = path(comment.path.slice(0, -2)).get(parsed),
        name = methodNode.key ? methodNode.key.name : "<error: no name for method>";

      // if it's someting like "var obj = {foo: function() {...}};"
      var p = comment.path.slice();
      var objectName = "<error: no object found for method>";

      while (p.length && arr.last(p) !== 'init') p.pop();
      if (p.length) {
        objectName = path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
      }

      // if it's someting like "exports.obj = {foo: function() {...}};"
      if (str.startsWith(objectName, "<error")) {
        p = comment.path.slice();
        while (p.length && arr.last(p) !== 'right') p.pop();
        if (p.length) {
          var assignNode = path(p.slice(0, -1).concat(["left"])).get(parsed);
          objectName = code.slice(assignNode.start, assignNode.end);
        }
      }

      // if it's someting like "Object.extend(Foo.prototype, {m: function() {/*some comment*/ return 23; }})"
      if (str.startsWith(objectName, "<error")) {
        p = comment.path.slice();
        var callExpr = path(p.slice(0, -6)).get(parsed),
          isCall = callExpr && callExpr.type === "CallExpression",
          firstArg = isCall && callExpr.arguments[0];
        if (firstArg) objectName = code.slice(firstArg.start, firstArg.end);
      }

      return {
        name: name,
        args: arr.pluck(methodNode.value.params, "name"),
        objectName: objectName
      }
    }

    function methodAttributesOfAssignment(comment) {
      var node = path(comment.path.slice(0,-1)).get(parsed)
      if (node.type !== "FunctionExpression"
       && node.type !== "FunctionDeclaration") return {};

      var statement = acorn.walk.findStatementOfNode(parsed, node);
      if (statement.type !== "ExpressionStatement"
       || statement.expression.type !== "AssignmentExpression") return {};

      var objName = code.slice(
        statement.expression.left.object.start,
        statement.expression.left.object.end);

      var methodName = code.slice(
        statement.expression.left.property.start,
        statement.expression.left.property.end);

      return {
        name: methodName,
        objectName: objName,
        args: arr.pluck(node.params, "name")
      };
    }

    function isInComputedMethod(comment) {
      var path = comment.path.slice(-5);
      arr.removeAt(path, 1);
      return arr.equals(path, ["properties","value","callee","body"]);
    }

    function computedMethodAttributesOf(comment) {
      var name, args, pathToProp;

      pathToProp = comment.path.slice(0, -3);
      var propertyNode = path(pathToProp).get(parsed);
      if (propertyNode && propertyNode.type === "Property") {
        // if it is a function immediatelly called
        args = arr.pluck(propertyNode.value.callee.params, "name");
        name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
      }

      if (!name) {
        // if it is an object member function
        pathToProp = comment.path.slice(0, -2);
        propertyNode = path(pathToProp).get(parsed);
        if (propertyNode && propertyNode.type === "Property") {
        args = arr.pluck(propertyNode.value.params, "name");
        name = propertyNode.key ? propertyNode.key.name : "<error: no name for method>";
        }
      }

      if (!name) {
        name = "<error: no name for method>";
        args = [];
        pathToProp = comment.path
      }

      // if it's someting like "var obj = {foo: function() {...}};"
      var p = arr.clone(pathToProp);
      var objectName = "<error: no object found for method>";

      while (p.length && arr.last(p) !== 'init') p.pop();
      if (p.length) {
        objectName = path(p.slice(0, -1).concat(["id", "name"])).get(parsed);
      }

      // if it's someting like "exports.obj = {foo: function() {...}};"
      if (str.startsWith(objectName, "<error")) {
        var p = arr.clone(pathToProp);
        while (p.length && arr.last(p) !== 'right') p.pop();
        if (p.length) {
          var assignNode = path(p.slice(0, -1).concat(["left"])).get(parsed);
          objectName = code.slice(assignNode.start, assignNode.end);
        }
      }

      // if it's someting like "Object.extend(Foo.prototype, {m: function() {/*some comment*/ return 23; }})"
      if (str.startsWith(objectName, "<error")) {
        var p = arr.clone(pathToProp);
        var callExpr = path(p.slice(0, -4)).get(parsed),
          isCall = callExpr && callExpr.type === "CallExpression",
          firstArg = isCall && callExpr.arguments[0];
        if (firstArg) objectName = code.slice(firstArg.start, firstArg.end);
      }

      return {name: name, args: args, objectName: objectName}
    }

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // like "var foo = {/*...*/}" or  "var foo = bar = {/*...*/};"
    function isSingleObjVarDeclaration(node) {
      // should be a var declaration with one declarator with a value
      // being an JS object
      return isSingleVarDeclaration(node)
        && (node.declarations[0].init.type === "ObjectExpression"
         || isObjectAssignment(node.declarations[0].init));
    }

    function isSingleVarDeclaration(node) {
      return node && node.type === 'VariableDeclaration'
        && node.declarations.length === 1;
    }

    function objAttributesOf(node) {
      return {name: node.declarations[0].id.name};
    };

    // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

    // like "foo = {/*...*/}"
    function isObjectAssignment(node) {
      if (node.type !== "AssignmentExpression") return false;
      if (node.right.type === "ObjectExpression") return true;
      if (node.right.type === "AssignmentExpression") return isObjectAssignment(node.right);;
      return false;
    }
  }

}

});;
/*global window, process, global*/

;(function(run) {
  var env = typeof module !== "undefined" && module.require ? module.require("../env") : lively['lively.lang_env'];
  run(env.acorn, env.lively, env['lively.lang'], env['lively.ast']);
})(function(acorn, lively, lang, exports) {

var arr = lang.arr, chain = lang.chain, obj = lang.obj,
    p = lang.Path, str = lang.string;

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers

function objectKeyValsAsDefs(objectExpression) {
  return objectExpression.properties.map(function(prop) {
    return {
      name: prop.key.name || prop.key.value,
      type: prop.value.type === "FunctionExpression" ? "method" : "property",
      node: prop
    };
  });
}

function classDef(node) {
  if (p("expression.callee.property.name").get(node) !== "subclass") return null;
  var def = {
    type: "lively-class-definition",
    name: p("expression.arguments.0.value").get(node),
    node: node
  };
  var props = lively.lang.arr.flatmap(
    node.expression.arguments,
    function(argNode) {
      if (argNode.type !== "ObjectExpression") return [];
      return objectKeyValsAsDefs(argNode).map(function(ea) {
        ea.type = "lively-class-instance-" + ea.type;
        ea.parent = def;
        return ea;
      })
    });
  return [def].concat(props);
}

function extendDef(node) {
  if (p("expression.callee.property.name").get(node) !== "extend"
   || p("expression.arguments.0.type").get(node) !== "ObjectExpression") return null;
  var name = p("expression.arguments.0.name").get(node);
  if (!name) return null;
  var def = {
    name: name, node: node,
    type: "lively-extend-definition"
  };
  var props = (objectKeyValsAsDefs(p("expression.arguments.1").get(node)) || [])
    .map(function(d) { d.parent = def; return d; });
  return [def].concat(props);
}

function varDefs(node) {
  if (node.type !== "VariableDeclaration") return null;
  return lively.lang.arr.flatmap(
    withVarDeclIds(node),
    function(ea) {
      return lively.lang.arr.flatmap(
        ea.ids,
        function(id) {
          var def = {name: id.name, node: ea.node, type: "var-decl"};
          if (!def.node.init) return [def];
          var node = def.node.init;
          while (node.type === "AssignmentExpression") node = node.right;
          if (node.type === "ObjectExpression") {
            return [def].concat(objectKeyValsAsDefs(node).map(function(ea) {
              ea.type = "object-" + ea.type; ea.parent = def; return ea; }));
          }
          var objDefs = someObjectExpressionCall(node);
          if (objDefs) return [def].concat(objDefs.map(function(d) { d.parent = def; return d; }))
          return [def];
        });
      });
}

function funcDef(node) {
  if (node.type !== "FunctionStatement"
   && node.type !== "FunctionDeclaration") return null;
  return [{
    name: node.id.name,
    node: node,
    type: "function-decl"
  }];
}

function someObjectExpressionCall(node) {
  if (node.type === "ExpressionStatement") node = node.expression;
  if (node.type !== "CallExpression") return null;
  var objArg = node.arguments.detect(function(a) { return a.type === "ObjectExpression"; });
  if (!objArg) return null;
  return objectKeyValsAsDefs(objArg);
}

function moduleDef(node, options) {
  if (!isModuleDeclaration(node)) return null;
  var decls = findDecls(p("expression.arguments.0").get(node), options),
      parent = {node: node, name: p("expression.callee.object.callee.object.arguments.0.value").get(node)};
  decls.forEach(function(decl) { return decl.parent = parent; });
  return decls;
}

function functionWrapper(node, options) {
  if (!isFunctionWrapper(node)) return null
  var decls;
  // Is it a function wrapper passed as arg?
  // like ;(function(run) {... })(function(exports) {...})      
  var argFunc = p("expression.arguments.0").get(node);
  if (argFunc
   && argFunc.type === "FunctionExpression"
   && str.lines(argFunc.source || "").length > 5) {
    // lively.debugNextMethodCall(lively.ast.CodeCategorizer, "findDecls");
    decls = findDecls(argFunc, options);
  } else {
    decls = findDecls(p("expression.callee").get(node), options);
  }
  var parent = {node: node, name: p("expression.callee.id.name").get(node)};
  decls.forEach(function(decl) { return decl.parent || (decl.parent = parent) });
  return decls;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

function isModuleDeclaration(node) {
  return p("expression.callee.object.callee.object.callee.name").get(node) === "module"
      && p("expression.callee.property.name").get(node) === "toRun";
}

function isFunctionWrapper(node) {
  return p("expression.type").get(node) === "CallExpression"
      && p("expression.callee.type").get(node) === "FunctionExpression";
}

function declIds(idNodes) {
  return lively.lang.arr.flatmap(idNodes, function(ea) {
    if (!ea) return [];
    if (ea.type === "Identifier") return [ea];
    if (ea.type === "RestElement") return [ea.argument];
    if (ea.type === "ObjectPattern")
      return declIds(lively.lang.arr.pluck(ea.properties, "value"));
    if (ea.type === "ArrayPattern")
      return declIds(ea.elements);
    return [];
  });
}

function withVarDeclIds(varNode) {
  return varNode.declarations.map(function(declNode) {
    if (!declNode.source && declNode.init)
      declNode.source = declNode.id.name + " = " + declNode.init.source
    return {node: declNode, ids: declIds([declNode.id])};
  });
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// main method
function findDecls(ast, options) {
  // lively.debugNextMethodCall(lively.ast.codeCategorizer, "findDecls")

  options = options || lively.lang.obj.merge({hideOneLiners: false}, options);

  if (typeof ast === "string")
    ast = lively.ast.parse(ast, {addSource: true});

  var topLevelNodes = ast.type === "Program" ? ast.body : ast.body.body,
      defs = lively.lang.arr.flatmap(topLevelNodes,
        function(n) {
          return moduleDef(n, options)
              || functionWrapper(n, options)
              || varDefs(n)
              || funcDef(n)
              || classDef(n)
              || extendDef(n)
              || someObjectExpressionCall(n);
        });

  if (options.hideOneLiners && ast.source) {
    defs = defs.reduce(function(defs, def) {
      if (def.parent && defs.indexOf(def.parent) > -1) defs.push(def)
      else if ((def.node.source || "").indexOf("\n") > -1) defs.push(def)
      return defs;
    }, []);
  }

  if (options.hideOneLiners && ast.loc)
    defs = defs.filter(function(def) {
      return !def.node.loc || (def.node.loc.start.line !== def.node.loc.end.line);
    });

  return defs;
}

exports.codeCategorizer = {
  findDecls: findDecls
}

});

//# sourceMappingURL=lively.ast.dev-bundle.js.map