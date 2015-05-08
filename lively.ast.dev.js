(function(b){function a(b,d){if({}.hasOwnProperty.call(a.cache,b))return a.cache[b];var e=a.resolve(b);if(!e)throw new Error('Failed to resolve module '+b);var c={id:b,require:a,filename:b,exports:{},loaded:!1,parent:d,children:[]};d&&d.children.push(c);var f=b.slice(0,b.lastIndexOf('/')+1);return a.cache[b]=c.exports,e.call(c.exports,c,c.exports,f,b),c.loaded=!0,a.cache[b]=c.exports}a.modules={},a.cache={},a.resolve=function(b){return{}.hasOwnProperty.call(a.modules,b)?a.modules[b]:void 0},a.define=function(b,c){a.modules[b]=c};var c=function(a){return a='/',{title:'browser',version:'v0.10.26',browser:!0,env:{},argv:[],nextTick:b.setImmediate||function(a){setTimeout(a,0)},cwd:function(){return a},chdir:function(b){a=b}}}();a.define('/tools/entry-point.js',function(c,d,e,f){!function(){'use strict';b.escodegen=a('/escodegen.js',c),escodegen.browser=!0}()}),a.define('/escodegen.js',function(d,c,e,f){!function(k,e,af,N,_,m,J,n,F,y,Z,ae,S,ad,i,f,W,ac,L,aa,s,Y,B,C,x,a9,a7,v,E,G,V,Q,q,U,P,g,R,a6,X,l,z,K,a5,a4){'use strict';function ap(a){return o.Expression.hasOwnProperty(a.type)}function a3(a){return o.Statement.hasOwnProperty(a.type)}function a2(){return{indent:null,base:null,parse:null,comment:!1,format:{indent:{style:'    ',base:0,adjustMultilineComment:!1},newline:'\n',space:' ',json:!1,renumber:!1,hexadecimal:!1,quotes:'single',escapeless:!1,compact:!1,parentheses:!0,semicolons:!0,safeConcatenation:!1,preserveBlankLines:!1},moz:{comprehensionExpressionStartsWithAssignment:!1,starlessGenerator:!1},sourceMap:null,sourceMapRoot:null,sourceMapWithCode:!1,directive:!1,raw:!0,verbatim:null,sourceCode:null}}function H(b,a){var c='';for(a|=0;a>0;a>>>=1,b+=b)a&1&&(c+=b);return c}function am(a){return/[\r\n]/g.test(a)}function r(b){var a=b.length;return a&&m.code.isLineTerminator(b.charCodeAt(a-1))}function a0(c,b){var a;for(a in b)b.hasOwnProperty(a)&&(c[a]=b[a]);return c}function T(b,d){function e(a){return typeof a==='object'&&a instanceof Object&&!(a instanceof RegExp)}var a,c;for(a in d)d.hasOwnProperty(a)&&(c=d[a],e(c)?e(b[a])?T(b[a],c):b[a]=T({},c):b[a]=c);return b}function ao(c){var b,e,a,f,d;if(c!==c)throw new Error('Numeric literal whose value is NaN');if(c<0||c===0&&1/c<0)throw new Error('Numeric literal whose value is negative');if(c===1/0)return y?'null':Z?'1e400':'1e+400';if(b=''+c,!Z||b.length<3)return b;e=b.indexOf('.'),!y&&b.charCodeAt(0)===48&&e===1&&(e=0,b=b.slice(1)),a=b,b=b.replace('e+','e'),f=0,(d=a.indexOf('e'))>0&&(f=+a.slice(d+1),a=a.slice(0,d)),e>=0&&(f-=a.length-e-1,a=+(a.slice(0,e)+a.slice(e+1))+''),d=0;while(a.charCodeAt(a.length+d-1)===48)--d;return d!==0&&(f-=d,a=a.slice(0,d)),f!==0&&(a+='e'+f),(a.length<b.length||ae&&c>1e12&&Math.floor(c)===c&&(a='0x'+c.toString(16)).length<b.length)&&+a===c&&(b=a),b}function a8(a,b){return(a&-2)===8232?(b?'u':'\\u')+(a===8232?'2028':'2029'):a===10||a===13?(b?'':'\\')+(a===10?'n':'r'):String.fromCharCode(a)}function aq(d){var g,a,h,e,i,b,f,c;if(a=d.toString(),d.source){if(g=a.match(/\/([^/]*)$/),!g)return a;for(h=g[1],a='',f=!1,c=!1,e=0,i=d.source.length;e<i;++e)b=d.source.charCodeAt(e),c?(a+=a8(b,c),c=!1):(f?b===93&&(f=!1):b===47?a+='\\':b===91&&(f=!0),a+=a8(b,c),c=b===92);return'/'+a+'/'+h}return a}function ar(a,c){var b;return a===8?'\\b':a===12?'\\f':a===9?'\\t':(b=a.toString(16).toUpperCase(),y||a>255?'\\u'+'0000'.slice(b.length)+b:a===0&&!m.code.isDecimalDigit(c)?'\\0':a===11?'\\x0B':'\\x'+'00'.slice(b.length)+b)}function ai(a){if(a===92)return'\\\\';if(a===10)return'\\n';if(a===13)return'\\r';if(a===8232)return'\\u2028';if(a===8233)return'\\u2029';throw new Error('Incorrectly classified character')}function aj(d){var a,e,c,b;for(b=S==='double'?'"':"'",a=0,e=d.length;a<e;++a){if(c=d.charCodeAt(a),c===39){b='"';break}if(c===34){b="'";break}c===92&&++a}return b+d+b}function ak(d){var b='',c,g,a,h=0,i=0,e,f;for(c=0,g=d.length;c<g;++c){if(a=d.charCodeAt(c),a===39)++h;else if(a===34)++i;else if(a===47&&y)b+='\\';else if(m.code.isLineTerminator(a)||a===92){b+=ai(a);continue}else if(y&&a<32||!(y||ad||a>=32&&a<=126)){b+=ar(a,d.charCodeAt(c+1));continue}b+=String.fromCharCode(a)}if(e=!(S==='double'||S==='auto'&&i<h),f=e?"'":'"',!(e?h:i))return f+b+f;for(d=b,b=f,c=0,g=d.length;c<g;++c)a=d.charCodeAt(c),(a===39&&e||a===34&&!e)&&(b+='\\'),b+=String.fromCharCode(a);return b+f}function a1(d){var a,e,b,c='';for(a=0,e=d.length;a<e;++a)b=d[a],c+=J(b)?a1(b):b;return c}function j(b,a){if(!B)return J(b)?a1(b):b;if(a==null)if(b instanceof N)return b;else a={};return a.loc==null?new N(null,null,B,b,a.name||null):new N(a.loc.start.line,a.loc.start.column,B===!0?a.loc.source||null:B,b,a.name||null)}function w(){return f?f:' '}function h(c,d){var e,g,a,b;return e=j(c).toString(),e.length===0?[d]:(g=j(d).toString(),g.length===0?[c]:(a=e.charCodeAt(e.length-1),b=g.charCodeAt(0),(a===43||a===45)&&a===b||m.code.isIdentifierPart(a)&&m.code.isIdentifierPart(b)||a===47&&b===105?[c,w(),d]:m.code.isWhiteSpace(a)||m.code.isLineTerminator(a)||m.code.isWhiteSpace(b)||m.code.isLineTerminator(b)?[c,d]:[c,f,d]))}function u(a){return[n,a]}function p(b){var a;a=n,n+=F,b(n),n=a}function as(b){var a;for(a=b.length-1;a>=0;--a)if(m.code.isLineTerminator(b.charCodeAt(a)))break;return b.length-1-a}function ah(k,i){var b,a,e,g,d,c,f,h;for(b=k.split(/\r\n|[\r\n]/),c=Number.MAX_VALUE,a=1,e=b.length;a<e;++a){g=b[a],d=0;while(d<g.length&&m.code.isWhiteSpace(g.charCodeAt(d)))++d;c>d&&(c=d)}for(i!==void 0?(f=n,b[1][c]==='*'&&(i+=' '),n=i):(c&1&&--c,f=n),a=1,e=b.length;a<e;++a)h=j(u(b[a].slice(c))),b[a]=B?h.join(''):h;return n=f,b.join('\n')}function D(a,c){if(a.type==='Line')if(r(a.value))return'//'+a.value;else{var b='//'+a.value;return x||(b+='\n'),b}return s.format.indent.adjustMultilineComment&&/[\n\r]/.test(a.value)?ah('/*'+a.value+'*/',c):'/*'+a.value+'*/'}function $(d,a){var c,g,b,q,p,m,l,i,f,o,h,s,t,e;if(d.leadingComments&&d.leadingComments.length>0){if(q=a,x){for(b=d.leadingComments[0],a=[],i=b.extendedRange,f=b.range,h=C.substring(i[0],f[0]),e=(h.match(/\n/g)||[]).length,e>0?(a.push(H('\n',e)),a.push(u(D(b)))):(a.push(h),a.push(D(b))),o=f,c=1,g=d.leadingComments.length;c<g;c++)b=d.leadingComments[c],f=b.range,s=C.substring(o[1],f[0]),e=(s.match(/\n/g)||[]).length,a.push(H('\n',e)),a.push(u(D(b))),o=f;t=C.substring(f[1],i[1]),e=(t.match(/\n/g)||[]).length,a.push(H('\n',e))}else for(b=d.leadingComments[0],a=[],L&&d.type===k.Program&&d.body.length===0&&a.push('\n'),a.push(D(b)),r(j(a).toString())||a.push('\n'),c=1,g=d.leadingComments.length;c<g;++c)b=d.leadingComments[c],l=[D(b)],r(j(l).toString())||l.push('\n'),a.push(u(l));a.push(u(q))}if(d.trailingComments)if(x)b=d.trailingComments[0],i=b.extendedRange,f=b.range,h=C.substring(i[0],f[0]),e=(h.match(/\n/g)||[]).length,e>0?(a.push(H('\n',e)),a.push(u(D(b)))):(a.push(h),a.push(D(b)));else for(p=!r(j(a).toString()),m=H(' ',as(j([n,a,F]).toString())),c=0,g=d.trailingComments.length;c<g;++c)b=d.trailingComments[c],p?(c===0?a=[a,F]:a=[a,m],a.push(D(b,m))):a=[a,u(D(b))],c!==g-1&&!r(j(a).toString())&&(a=[a,'\n']);return a}function I(c,d,e){var a,b=0;for(a=c;a<d;a++)C[a]==='\n'&&b++;for(a=1;a<b;a++)e.push(i)}function t(a,b,c){return b<c?['(',a,')']:a}function ab(d){var a,c,b;for(b=d.split(/\r\n|\n/),a=1,c=b.length;a<c;a++)b[a]=i+n+b[a];return b}function an(c,d){var a,b,f;return a=c[s.verbatim],typeof a==='string'?b=t(ab(a),e.Sequence,d):(b=ab(a.content),f=a.precedence!=null?a.precedence:e.Sequence,b=t(b,f,d)),j(b,c)}function o(){}function A(a){return j(a.name,a)}function M(a,b){return a.async?'async'+(b?w():f):''}function O(b){var a=b.generator&&!s.moz.starlessGenerator;return a?'*'+f:''}function ag(b){var a=b.value;return a.async?M(a,!b.computed):O(a)?'*':''}function at(a){var b;if(b=new o,a3(a))return b.generateStatement(a,l);if(ap(a))return b.generateExpression(a,e.Sequence,g);throw new Error('Unknown node type: '+a.type)}function al(k,e){var h=a2(),j,g;return e!=null?(typeof e.indent==='string'&&(h.format.indent.style=e.indent),typeof e.base==='number'&&(h.format.indent.base=e.base),e=T(h,e),F=e.format.indent.style,typeof e.base==='string'?n=e.base:n=H(F,e.format.indent.base)):(e=h,F=e.format.indent.style,n=H(F,e.format.indent.base)),y=e.format.json,Z=e.format.renumber,ae=y?!1:e.format.hexadecimal,S=y?'double':e.format.quotes,ad=e.format.escapeless,i=e.format.newline,f=e.format.space,e.format.compact&&(i=f=F=n=''),W=e.format.parentheses,ac=e.format.semicolons,L=e.format.safeConcatenation,aa=e.directive,Y=y?null:e.parse,B=e.sourceMap,C=e.sourceCode,x=e.format.preserveBlankLines&&C!==null,s=e,B&&(c.browser?N=b.sourceMap.SourceNode:N=a('/node_modules/source-map/lib/source-map.js',d).SourceNode),j=at(k),B?(g=j.toStringWithSourceMap({file:e.file,sourceRoot:e.sourceMapRoot}),e.sourceContent&&g.map.setSourceContent(e.sourceMap,e.sourceContent),e.sourceMapWithCode?g:g.map.toString()):(g={code:j.toString(),map:null},e.sourceMapWithCode?g:g.code)}_=a('/node_modules/estraverse/estraverse.js',d),m=a('/node_modules/esutils/lib/utils.js',d),k=_.Syntax,e={Sequence:0,Yield:1,Await:1,Assignment:1,Conditional:2,ArrowFunction:2,LogicalOR:3,LogicalAND:4,BitwiseOR:5,BitwiseXOR:6,BitwiseAND:7,Equality:8,Relational:9,BitwiseSHIFT:10,Additive:11,Multiplicative:12,Unary:13,Postfix:14,Call:15,New:16,TaggedTemplate:17,Member:18,Primary:19},af={'||':e.LogicalOR,'&&':e.LogicalAND,'|':e.BitwiseOR,'^':e.BitwiseXOR,'&':e.BitwiseAND,'==':e.Equality,'!=':e.Equality,'===':e.Equality,'!==':e.Equality,is:e.Equality,isnt:e.Equality,'<':e.Relational,'>':e.Relational,'<=':e.Relational,'>=':e.Relational,'in':e.Relational,'instanceof':e.Relational,'<<':e.BitwiseSHIFT,'>>':e.BitwiseSHIFT,'>>>':e.BitwiseSHIFT,'+':e.Additive,'-':e.Additive,'*':e.Multiplicative,'%':e.Multiplicative,'/':e.Multiplicative},v=1,E=2,G=4,V=8,Q=16,q=32,U=E|G,P=v|E,g=v|E|G,R=v,a6=G,X=v|G,l=v,z=v|q,K=0,a5=v|Q,a4=v|V,J=Array.isArray,J||(J=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),o.prototype.maybeBlock=function(a,c){var d,b,e=this;return b=!s.comment||!a.leadingComments,a.type===k.BlockStatement&&b?[f,this.generateStatement(a,c)]:a.type===k.EmptyStatement&&b?';':(p(function(){d=[i,u(e.generateStatement(a,c))]}),d)},o.prototype.maybeBlockSuffix=function(c,a){var b=r(j(a).toString());return c.type===k.BlockStatement&&!(s.comment&&c.leadingComments)&&!b?[a,f]:b?[a,n]:[a,i,n]},o.prototype.generatePattern=function(a,b,c){return a.type===k.Identifier?A(a):this.generateExpression(a,b,c)},o.prototype.generateFunctionParams=function(a){var c,d,b,h;if(h=!1,a.type===k.ArrowFunctionExpression&&!a.rest&&(!a.defaults||a.defaults.length===0)&&a.params.length===1&&a.params[0].type===k.Identifier)b=[M(a,!0),A(a.params[0])];else{for(b=a.type===k.ArrowFunctionExpression?[M(a,!1)]:[],b.push('('),a.defaults&&(h=!0),c=0,d=a.params.length;c<d;++c)h&&a.defaults[c]?b.push(this.generateAssignment(a.params[c],a.defaults[c],'=',e.Assignment,g)):b.push(this.generatePattern(a.params[c],e.Assignment,g)),c+1<d&&b.push(','+f);a.rest&&(a.params.length&&b.push(','+f),b.push('...'),b.push(A(a.rest))),b.push(')')}return b},o.prototype.generateFunctionBody=function(b){var a,c;return a=this.generateFunctionParams(b),b.type===k.ArrowFunctionExpression&&(a.push(f),a.push('=>')),b.expression?(a.push(f),c=this.generateExpression(b.body,e.Assignment,g),c.toString().charAt(0)==='{'&&(c=['(',c,')']),a.push(c)):a.push(this.maybeBlock(b.body,a4)),a},o.prototype.generateIterationForStatement=function(d,b,i){var a=['for'+f+'('],c=this;return p(function(){b.left.type===k.VariableDeclaration?p(function(){a.push(b.left.kind+w()),a.push(c.generateStatement(b.left.declarations[0],K))}):a.push(c.generateExpression(b.left,e.Call,g)),a=h(a,d),a=[h(a,c.generateExpression(b.right,e.Sequence,g)),')']}),a.push(this.maybeBlock(b.body,i)),a},o.prototype.generatePropertyKey=function(c,b){var a=[];return b&&a.push('['),a.push(this.generateExpression(c,e.Sequence,g)),b&&a.push(']'),a},o.prototype.generateAssignment=function(c,d,g,b,a){return e.Assignment<b&&(a|=v),t([this.generateExpression(c,e.Call,a),f+g+f,this.generateExpression(d,e.Assignment,a)],e.Assignment,b)},o.prototype.semicolon=function(a){return!ac&&a&q?'':';'},o.Statement={BlockStatement:function(a,f){var c,d,b=['{',i],e=this;return p(function(){a.body.length===0&&x&&(c=a.range,c[1]-c[0]>2)&&(d=C.substring(c[0]+1,c[1]-1),d[0]==='\n'&&(b=['{']),b.push(d));var g,h,m,k;for(k=l,f&V&&(k|=Q),g=0,h=a.body.length;g<h;++g)x&&(g===0&&(a.body[0].leadingComments&&(c=a.body[0].leadingComments[0].extendedRange,d=C.substring(c[0],c[1]),d[0]==='\n'&&(b=['{'])),a.body[0].leadingComments||I(a.range[0],a.body[0].range[0],b)),g>0&&!(a.body[g-1].trailingComments||a.body[g].leadingComments)&&I(a.body[g-1].range[1],a.body[g].range[0],b)),g===h-1&&(k|=q),a.body[g].leadingComments&&x?m=e.generateStatement(a.body[g],k):m=u(e.generateStatement(a.body[g],k)),b.push(m),r(j(m).toString())||(x&&g<h-1?a.body[g+1].leadingComments||b.push(i):b.push(i)),x&&g===h-1&&(a.body[g].trailingComments||I(a.body[g].range[1],a.range[1],b))}),b.push(u('}')),b},BreakStatement:function(a,b){return a.label?'break '+a.label.name+this.semicolon(b):'break'+this.semicolon(b)},ContinueStatement:function(a,b){return a.label?'continue '+a.label.name+this.semicolon(b):'continue'+this.semicolon(b)},ClassBody:function(b,d){var a=['{',i],c=this;return p(function(h){var d,f;for(d=0,f=b.body.length;d<f;++d)a.push(h),a.push(c.generateExpression(b.body[d],e.Sequence,g)),d+1<f&&a.push(i)}),r(j(a).toString())||a.push(i),a.push(n),a.push('}'),a},ClassDeclaration:function(b,d){var a,c;return a=['class '+b.id.name],b.superClass&&(c=h('extends',this.generateExpression(b.superClass,e.Assignment,g)),a=h(a,c)),a.push(f),a.push(this.generateStatement(b.body,z)),a},DirectiveStatement:function(a,b){return s.raw&&a.raw?a.raw+this.semicolon(b):aj(a.directive)+this.semicolon(b)},DoWhileStatement:function(b,c){var a=h('do',this.maybeBlock(b.body,l));return a=this.maybeBlockSuffix(b.body,a),h(a,['while'+f+'(',this.generateExpression(b.test,e.Sequence,g),')'+this.semicolon(c)])},CatchClause:function(a,d){var b,c=this;return p(function(){var d;b=['catch'+f+'(',c.generateExpression(a.param,e.Sequence,g),')'],a.guard&&(d=c.generateExpression(a.guard,e.Sequence,g),b.splice(2,0,' if ',d))}),b.push(this.maybeBlock(a.body,l)),b},DebuggerStatement:function(b,a){return'debugger'+this.semicolon(a)},EmptyStatement:function(a,b){return';'},ExportDeclaration:function(b,c){var a=['export'],d,m=this;return d=c&q?z:l,b['default']?(a=h(a,'default'),a3(b.declaration)?a=h(a,this.generateStatement(b.declaration,d)):a=h(a,this.generateExpression(b.declaration,e.Assignment,g)+this.semicolon(c)),a):b.declaration?h(a,this.generateStatement(b.declaration,d)):(b.specifiers&&(b.specifiers.length===0?a=h(a,'{'+f+'}'):b.specifiers[0].type===k.ExportBatchSpecifier?a=h(a,this.generateExpression(b.specifiers[0],e.Sequence,g)):(a=h(a,'{'),p(function(f){var c,d;for(a.push(i),c=0,d=b.specifiers.length;c<d;++c)a.push(f),a.push(m.generateExpression(b.specifiers[c],e.Sequence,g)),c+1<d&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n+'}')),b.source?a=h(a,['from'+f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(c)]):a.push(this.semicolon(c))),a)},ExpressionStatement:function(c,d){function f(b){var a;return b.slice(0,5)!=='class'?!1:(a=b.charCodeAt(5),a===123||m.code.isWhiteSpace(a)||m.code.isLineTerminator(a))}function h(b){var a;return b.slice(0,8)!=='function'?!1:(a=b.charCodeAt(8),a===40||m.code.isWhiteSpace(a)||a===42||m.code.isLineTerminator(a))}function i(b){var c,a,d;if(b.slice(0,5)!=='async')return!1;if(!m.code.isWhiteSpace(b.charCodeAt(5)))return!1;for(a=6,d=b.length;a<d;++a)if(!m.code.isWhiteSpace(b.charCodeAt(a)))break;return a===d?!1:b.slice(a,a+8)!=='function'?!1:(c=b.charCodeAt(a+8),c===40||m.code.isWhiteSpace(c)||c===42||m.code.isLineTerminator(c))}var a,b;return a=[this.generateExpression(c.expression,e.Sequence,g)],b=j(a).toString(),b.charCodeAt(0)===123||f(b)||h(b)||i(b)||aa&&d&Q&&c.expression.type===k.Literal&&typeof c.expression.value==='string'?a=['(',a,')'+this.semicolon(d)]:a.push(this.semicolon(d)),a},ImportDeclaration:function(b,d){var a,c,l=this;return b.specifiers.length===0?['import',f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(d)]:(a=['import'],c=0,b.specifiers[c].type===k.ImportDefaultSpecifier&&(a=h(a,[this.generateExpression(b.specifiers[c],e.Sequence,g)]),++c),b.specifiers[c]&&(c!==0&&a.push(','),b.specifiers[c].type===k.ImportNamespaceSpecifier?a=h(a,[f,this.generateExpression(b.specifiers[c],e.Sequence,g)]):(a.push(f+'{'),b.specifiers.length-c===1?(a.push(f),a.push(this.generateExpression(b.specifiers[c],e.Sequence,g)),a.push(f+'}'+f)):(p(function(h){var d,f;for(a.push(i),d=c,f=b.specifiers.length;d<f;++d)a.push(h),a.push(l.generateExpression(b.specifiers[d],e.Sequence,g)),d+1<f&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n+'}'+f)))),a=h(a,['from'+f,this.generateExpression(b.source,e.Sequence,g),this.semicolon(d)]),a)},VariableDeclarator:function(a,c){var b=c&v?g:U;return a.init?[this.generateExpression(a.id,e.Assignment,b),f,'=',f,this.generateExpression(a.init,e.Assignment,b)]:this.generatePattern(a.id,e.Assignment,b)},VariableDeclaration:function(c,h){function j(){for(b=c.declarations[0],s.comment&&b.leadingComments?(a.push('\n'),a.push(u(e.generateStatement(b,d)))):(a.push(w()),a.push(e.generateStatement(b,d))),g=1,k=c.declarations.length;g<k;++g)b=c.declarations[g],s.comment&&b.leadingComments?(a.push(','+i),a.push(u(e.generateStatement(b,d)))):(a.push(','+f),a.push(e.generateStatement(b,d)))}var a,g,k,b,d,e=this;return a=[c.kind],d=h&v?l:K,c.declarations.length>1?p(j):j(),a.push(this.semicolon(h)),a},ThrowStatement:function(a,b){return[h('throw',this.generateExpression(a.argument,e.Sequence,g)),this.semicolon(b)]},TryStatement:function(b,f){var a,c,d,e;if(a=['try',this.maybeBlock(b.block,l)],a=this.maybeBlockSuffix(b.block,a),b.handlers)for(c=0,d=b.handlers.length;c<d;++c)a=h(a,this.generateStatement(b.handlers[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(b.handlers[c].body,a));else{for(e=b.guardedHandlers||[],c=0,d=e.length;c<d;++c)a=h(a,this.generateStatement(e[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(e[c].body,a));if(b.handler)if(J(b.handler))for(c=0,d=b.handler.length;c<d;++c)a=h(a,this.generateStatement(b.handler[c],l)),(b.finalizer||c+1!==d)&&(a=this.maybeBlockSuffix(b.handler[c].body,a));else a=h(a,this.generateStatement(b.handler,l)),b.finalizer&&(a=this.maybeBlockSuffix(b.handler.body,a))}return b.finalizer&&(a=h(a,['finally',this.maybeBlock(b.finalizer,l)])),a},SwitchStatement:function(c,n){var a,d,b,h,k,m=this;if(p(function(){a=['switch'+f+'(',m.generateExpression(c.discriminant,e.Sequence,g),')'+f+'{'+i]}),c.cases)for(k=l,b=0,h=c.cases.length;b<h;++b)b===h-1&&(k|=q),d=u(this.generateStatement(c.cases[b],k)),a.push(d),r(j(d).toString())||a.push(i);return a.push(u('}')),a},SwitchCase:function(c,o){var a,f,b,d,n,m=this;return p(function(){for(c.test?a=[h('case',m.generateExpression(c.test,e.Sequence,g)),':']:a=['default:'],b=0,d=c.consequent.length,d&&c.consequent[0].type===k.BlockStatement&&(f=m.maybeBlock(c.consequent[0],l),a.push(f),b=1),b!==d&&!r(j(a).toString())&&a.push(i),n=l;b<d;++b)b===d-1&&o&q&&(n|=q),f=u(m.generateStatement(c.consequent[b],n)),a.push(f),b+1!==d&&!r(j(f).toString())&&a.push(i)}),a},IfStatement:function(b,j){var a,c,d,i=this;return p(function(){a=['if'+f+'(',i.generateExpression(b.test,e.Sequence,g),')']}),d=j&q,c=l,d&&(c|=q),b.alternate?(a.push(this.maybeBlock(b.consequent,l)),a=this.maybeBlockSuffix(b.consequent,a),b.alternate.type===k.IfStatement?a=h(a,['else ',this.generateStatement(b.alternate,c)]):a=h(a,h('else',this.maybeBlock(b.alternate,c)))):a.push(this.maybeBlock(b.consequent,c)),a},ForStatement:function(b,d){var a,c=this;return p(function(){a=['for'+f+'('],b.init?b.init.type===k.VariableDeclaration?a.push(c.generateStatement(b.init,K)):(a.push(c.generateExpression(b.init,e.Sequence,U)),a.push(';')):a.push(';'),b.test?(a.push(f),a.push(c.generateExpression(b.test,e.Sequence,g)),a.push(';')):a.push(';'),b.update?(a.push(f),a.push(c.generateExpression(b.update,e.Sequence,g)),a.push(')')):a.push(')')}),a.push(this.maybeBlock(b.body,d&q?z:l)),a},ForInStatement:function(a,b){return this.generateIterationForStatement('in',a,b&q?z:l)},ForOfStatement:function(a,b){return this.generateIterationForStatement('of',a,b&q?z:l)},LabeledStatement:function(a,b){return[a.label.name+':',this.maybeBlock(a.body,b&q?z:l)]},Program:function(b,g){var c,e,a,d,f;for(d=b.body.length,c=[L&&d>0?'\n':''],f=a5,a=0;a<d;++a)!L&&a===d-1&&(f|=q),x&&(a===0&&(b.body[0].leadingComments||I(b.range[0],b.body[a].range[0],c)),a>0&&!(b.body[a-1].trailingComments||b.body[a].leadingComments)&&I(b.body[a-1].range[1],b.body[a].range[0],c)),e=u(this.generateStatement(b.body[a],f)),c.push(e),a+1<d&&!r(j(e).toString())&&(x?b.body[a+1].leadingComments||c.push(i):c.push(i)),x&&a===d-1&&(b.body[a].trailingComments||I(b.body[a].range[1],b.range[1],c));return c},FunctionDeclaration:function(a,b){return[M(a,!0),'function',O(a)||w(),A(a.id),this.generateFunctionBody(a)]},ReturnStatement:function(a,b){return a.argument?[h('return',this.generateExpression(a.argument,e.Sequence,g)),this.semicolon(b)]:['return'+this.semicolon(b)]},WhileStatement:function(b,d){var a,c=this;return p(function(){a=['while'+f+'(',c.generateExpression(b.test,e.Sequence,g),')']}),a.push(this.maybeBlock(b.body,d&q?z:l)),a},WithStatement:function(b,d){var a,c=this;return p(function(){a=['with'+f+'(',c.generateExpression(b.object,e.Sequence,g),')']}),a.push(this.maybeBlock(b.body,d&q?z:l)),a}},a0(o.prototype,o.Statement),o.Expression={SequenceExpression:function(d,g,h){var b,a,c;for(e.Sequence<g&&(h|=v),b=[],a=0,c=d.expressions.length;a<c;++a)b.push(this.generateExpression(d.expressions[a],e.Assignment,h)),a+1<c&&b.push(','+f);return t(b,e.Sequence,g)},AssignmentExpression:function(a,b,c){return this.generateAssignment(a.left,a.right,a.operator,b,c)},ArrowFunctionExpression:function(a,b,c){return t(this.generateFunctionBody(a),e.ArrowFunction,b)},ConditionalExpression:function(b,c,a){return e.Conditional<c&&(a|=v),t([this.generateExpression(b.test,e.LogicalOR,a),f+'?'+f,this.generateExpression(b.consequent,e.Assignment,a),f+':'+f,this.generateExpression(b.alternate,e.Assignment,a)],e.Conditional,c)},LogicalExpression:function(a,b,c){return this.BinaryExpression(a,b,c)},BinaryExpression:function(a,g,e){var c,d,b,f;return d=af[a.operator],d<g&&(e|=v),b=this.generateExpression(a.left,d,e),f=b.toString(),f.charCodeAt(f.length-1)===47&&m.code.isIdentifierPart(a.operator.charCodeAt(0))?c=[b,w(),a.operator]:c=h(b,a.operator),b=this.generateExpression(a.right,d+1,e),a.operator==='/'&&b.toString().charAt(0)==='/'||a.operator.slice(-1)==='<'&&b.toString().slice(0,3)==='!--'?(c.push(w()),c.push(b)):c=h(c,b),a.operator==='in'&&!(e&v)?['(',c,')']:t(c,d,g)},CallExpression:function(c,h,i){var a,b,d;for(a=[this.generateExpression(c.callee,e.Call,P)],a.push('('),b=0,d=c['arguments'].length;b<d;++b)a.push(this.generateExpression(c['arguments'][b],e.Assignment,g)),b+1<d&&a.push(','+f);return a.push(')'),i&E?t(a,e.Call,h):['(',a,')']},NewExpression:function(d,l,j){var a,c,b,i,k;if(c=d['arguments'].length,k=j&G&&!W&&c===0?X:R,a=h('new',this.generateExpression(d.callee,e.New,k)),!(j&G)||W||c>0){for(a.push('('),b=0,i=c;b<i;++b)a.push(this.generateExpression(d['arguments'][b],e.Assignment,g)),b+1<i&&a.push(','+f);a.push(')')}return t(a,e.New,l)},MemberExpression:function(c,f,d){var a,b;return a=[this.generateExpression(c.object,e.Call,d&E?P:R)],c.computed?(a.push('['),a.push(this.generateExpression(c.property,e.Sequence,d&E?g:X)),a.push(']')):(c.object.type===k.Literal&&typeof c.object.value==='number'&&(b=j(a).toString(),b.indexOf('.')<0&&!/[eExX]/.test(b)&&m.code.isDecimalDigit(b.charCodeAt(b.length-1))&&!(b.length>=2&&b.charCodeAt(0)===48)&&a.push('.')),a.push('.'),a.push(A(c.property))),t(a,e.Member,f)},UnaryExpression:function(d,l,n){var a,b,i,k,c;return b=this.generateExpression(d.argument,e.Unary,g),f===''?a=h(d.operator,b):(a=[d.operator],d.operator.length>2?a=h(a,b):(k=j(a).toString(),c=k.charCodeAt(k.length-1),i=b.toString().charCodeAt(0),(c===43||c===45)&&c===i||m.code.isIdentifierPart(c)&&m.code.isIdentifierPart(i)?(a.push(w()),a.push(b)):a.push(b))),t(a,e.Unary,l)},YieldExpression:function(b,c,d){var a;return b.delegate?a='yield*':a='yield',b.argument&&(a=h(a,this.generateExpression(b.argument,e.Yield,g))),t(a,e.Yield,c)},AwaitExpression:function(a,c,d){var b=h(a.delegate?'await*':'await',this.generateExpression(a.argument,e.Await,g));return t(b,e.Await,c)},UpdateExpression:function(a,b,c){return a.prefix?t([a.operator,this.generateExpression(a.argument,e.Unary,g)],e.Unary,b):t([this.generateExpression(a.argument,e.Postfix,g),a.operator],e.Postfix,b)},FunctionExpression:function(a,c,d){var b=[M(a,!0),'function'];return a.id?(b.push(O(a)||w()),b.push(A(a.id))):b.push(O(a)||f),b.push(this.generateFunctionBody(a)),b},ExportBatchSpecifier:function(a,b,c){return'*'},ArrayPattern:function(a,b,c){return this.ArrayExpression(a,b,c)},ArrayExpression:function(c,h,k){var a,b,d=this;return c.elements.length?(b=c.elements.length>1,a=['[',b?i:''],p(function(k){var h,j;for(h=0,j=c.elements.length;h<j;++h)c.elements[h]?(a.push(b?k:''),a.push(d.generateExpression(c.elements[h],e.Assignment,g))):(b&&a.push(k),h+1===j&&a.push(',')),h+1<j&&a.push(','+(b?i:f))}),b&&!r(j(a).toString())&&a.push(i),a.push(b?n:''),a.push(']'),a):'[]'},ClassExpression:function(b,d,i){var a,c;return a=['class'],b.id&&(a=h(a,this.generateExpression(b.id,e.Sequence,g))),b.superClass&&(c=h('extends',this.generateExpression(b.superClass,e.Assignment,g)),a=h(a,c)),a.push(f),a.push(this.generateStatement(b.body,z)),a},MethodDefinition:function(a,d,e){var b,c;return a['static']?b=['static'+f]:b=[],a.kind==='get'||a.kind==='set'?c=[h(a.kind,this.generatePropertyKey(a.key,a.computed)),this.generateFunctionBody(a.value)]:c=[ag(a),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)],h(b,c)},Property:function(a,b,c){return a.kind==='get'||a.kind==='set'?[a.kind,w(),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)]:a.shorthand?this.generatePropertyKey(a.key,a.computed):a.method?[ag(a),this.generatePropertyKey(a.key,a.computed),this.generateFunctionBody(a.value)]:[this.generatePropertyKey(a.key,a.computed),':'+f,this.generateExpression(a.value,e.Assignment,g)]},ObjectExpression:function(b,k,l){var d,a,c,h=this;return b.properties.length?(d=b.properties.length>1,p(function(){c=h.generateExpression(b.properties[0],e.Sequence,g)}),d||am(j(c).toString())?(p(function(k){var f,j;if(a=['{',i,k,c],d)for(a.push(','+i),f=1,j=b.properties.length;f<j;++f)a.push(k),a.push(h.generateExpression(b.properties[f],e.Sequence,g)),f+1<j&&a.push(','+i)}),r(j(a).toString())||a.push(i),a.push(n),a.push('}'),a):['{',f,c,f,'}']):'{}'},ObjectPattern:function(c,o,q){var a,d,l,b,h,m=this;if(!c.properties.length)return'{}';if(b=!1,c.properties.length===1)h=c.properties[0],h.value.type!==k.Identifier&&(b=!0);else for(d=0,l=c.properties.length;d<l;++d)if(h=c.properties[d],!h.shorthand){b=!0;break}return a=['{',b?i:''],p(function(j){var d,h;for(d=0,h=c.properties.length;d<h;++d)a.push(b?j:''),a.push(m.generateExpression(c.properties[d],e.Sequence,g)),d+1<h&&a.push(','+(b?i:f))}),b&&!r(j(a).toString())&&a.push(i),a.push(b?n:''),a.push('}'),a},ThisExpression:function(a,b,c){return'this'},Identifier:function(a,b,c){return A(a)},ImportDefaultSpecifier:function(a,b,c){return A(a.id)},ImportNamespaceSpecifier:function(b,c,d){var a=['*'];return b.id&&a.push(f+'as'+w()+A(b.id)),a},ImportSpecifier:function(a,b,c){return this.ExportSpecifier(a,b,c)},ExportSpecifier:function(a,c,d){var b=[a.id.name];return a.name&&b.push(w()+'as'+w()+A(a.name)),b},Literal:function(a,c,d){var b;if(a.hasOwnProperty('raw')&&Y&&s.raw)try{if(b=Y(a.raw).body[0].expression,b.type===k.Literal&&b.value===a.value)return a.raw}catch(a){}return a.value===null?'null':typeof a.value==='string'?ak(a.value):typeof a.value==='number'?ao(a.value):typeof a.value==='boolean'?a.value?'true':'false':aq(a.value)},GeneratorExpression:function(a,b,c){return this.ComprehensionExpression(a,b,c)},ComprehensionExpression:function(b,l,m){var a,d,i,c,j=this;return a=b.type===k.GeneratorExpression?['(']:['['],s.moz.comprehensionExpressionStartsWithAssignment&&(c=this.generateExpression(b.body,e.Assignment,g),a.push(c)),b.blocks&&p(function(){for(d=0,i=b.blocks.length;d<i;++d)c=j.generateExpression(b.blocks[d],e.Sequence,g),d>0||s.moz.comprehensionExpressionStartsWithAssignment?a=h(a,c):a.push(c)}),b.filter&&(a=h(a,'if'+f),c=this.generateExpression(b.filter,e.Sequence,g),a=h(a,['(',c,')'])),s.moz.comprehensionExpressionStartsWithAssignment||(c=this.generateExpression(b.body,e.Assignment,g),a=h(a,c)),a.push(b.type===k.GeneratorExpression?')':']'),a},ComprehensionBlock:function(b,c,d){var a;return b.left.type===k.VariableDeclaration?a=[b.left.kind,w(),this.generateStatement(b.left.declarations[0],K)]:a=this.generateExpression(b.left,e.Call,g),a=h(a,b.of?'of':'in'),a=h(a,this.generateExpression(b.right,e.Sequence,g)),['for'+f+'(',a,')']},SpreadElement:function(a,b,c){return['...',this.generateExpression(a.argument,e.Assignment,g)]},TaggedTemplateExpression:function(b,d,f){var a=P;f&E||(a=R);var c=[this.generateExpression(b.tag,e.Call,a),this.generateExpression(b.quasi,e.Primary,a6)];return t(c,e.TaggedTemplate,d)},TemplateElement:function(a,b,c){return a.value.raw},TemplateLiteral:function(c,h,i){var a,b,d;for(a=['`'],b=0,d=c.quasis.length;b<d;++b)a.push(this.generateExpression(c.quasis[b],e.Primary,g)),b+1<d&&(a.push('${'+f),a.push(this.generateExpression(c.expressions[b],e.Sequence,g)),a.push(f+'}'));return a.push('`'),a},ModuleSpecifier:function(a,b,c){return this.Literal(a,b,c)}},a0(o.prototype,o.Expression),o.prototype.generateExpression=function(a,c,e){var b,d;return d=a.type||k.Property,s.verbatim&&a.hasOwnProperty(s.verbatim)?an(a,c):(b=this[d](a,c,e),s.comment&&(b=$(a,b)),j(b,a))},o.prototype.generateStatement=function(b,d){var a,c;return a=this[b.type](b,d),s.comment&&(a=$(b,a)),c=j(a).toString(),b.type===k.Program&&!L&&i===''&&c.charAt(c.length-1)==='\n'&&(a=B?j(a).replaceRight(/\s+$/,''):c.replace(/\s+$/,'')),j(a,b)},a9={indent:{style:'',base:0},renumber:!0,hexadecimal:!0,quotes:'auto',escapeless:!0,compact:!0,parentheses:!1,semicolons:!1},a7=a2().format,c.version=a('/package.json',d).version,c.generate=al,c.attachComments=_.attachComments,c.Precedence=T({},e),c.browser=!1,c.FORMAT_MINIFY=a9,c.FORMAT_DEFAULTS=a7}()}),a.define('/package.json',function(a,b,c,d){a.exports={name:'escodegen',description:'ECMAScript code generator',homepage:'http://github.com/estools/escodegen',main:'escodegen.js',bin:{esgenerate:'./bin/esgenerate.js',escodegen:'./bin/escodegen.js'},files:['LICENSE.BSD','LICENSE.source-map','README.md','bin','escodegen.js','package.json'],version:'1.6.1',engines:{node:'>=0.10.0'},maintainers:[{name:'Yusuke Suzuki',email:'utatane.tea@gmail.com',web:'http://github.com/Constellation'}],repository:{type:'git',url:'http://github.com/estools/escodegen.git'},dependencies:{estraverse:'^1.9.1',esutils:'^1.1.6',esprima:'^1.2.2',optionator:'^0.5.0'},optionalDependencies:{'source-map':'~0.1.40'},devDependencies:{'acorn-6to5':'^0.11.1-25',bluebird:'^2.3.11','bower-registry-client':'^0.2.1',chai:'^1.10.0','commonjs-everywhere':'^0.9.7','esprima-moz':'*',gulp:'^3.8.10','gulp-eslint':'^0.2.0','gulp-mocha':'^2.0.0',semver:'^4.1.0'},licenses:[{type:'BSD',url:'http://github.com/estools/escodegen/raw/master/LICENSE.BSD'}],scripts:{test:'gulp travis','unit-test':'gulp test',lint:'gulp lint',release:'node tools/release.js','build-min':'./node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js',build:'./node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js'}}}),a.define('/node_modules/source-map/lib/source-map.js',function(b,c,d,e){c.SourceMapGenerator=a('/node_modules/source-map/lib/source-map/source-map-generator.js',b).SourceMapGenerator,c.SourceMapConsumer=a('/node_modules/source-map/lib/source-map/source-map-consumer.js',b).SourceMapConsumer,c.SourceNode=a('/node_modules/source-map/lib/source-map/source-node.js',b).SourceNode}),a.define('/node_modules/source-map/lib/source-map/source-node.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,i,f){function a(a,c,d,e,f){this.children=[],this.sourceContents={},this.line=a==null?null:a,this.column=c==null?null:c,this.source=d==null?null:d,this.name=f==null?null:f,this[b]=!0,e!=null&&this.add(e)}var g=e('/node_modules/source-map/lib/source-map/source-map-generator.js',f).SourceMapGenerator,c=e('/node_modules/source-map/lib/source-map/util.js',f),d=/(\r?\n)/,h=/\r\n|[\s\S]/g,b='$$$isSourceNode$$$';a.fromStringWithSourceMap=function b(n,m,j){function l(b,d){if(b===null||b.source===undefined)f.add(d);else{var e=j?c.join(j,b.source):b.source;f.add(new a(b.originalLine,b.originalColumn,e,d,b.name))}}var f=new a,e=n.split(d),k=function(){var a=e.shift(),b=e.shift()||'';return a+b},i=1,h=0,g=null;return m.eachMapping(function(a){if(g!==null)if(i<a.generatedLine){var c='';l(g,k()),i++,h=0}else{var b=e[0],c=b.substr(0,a.generatedColumn-h);e[0]=b.substr(a.generatedColumn-h),h=a.generatedColumn,l(g,c),g=a;return}while(i<a.generatedLine)f.add(k()),i++;if(h<a.generatedColumn){var b=e[0];f.add(b.substr(0,a.generatedColumn)),e[0]=b.substr(a.generatedColumn),h=a.generatedColumn}g=a},this),e.length>0&&(g&&l(g,k()),f.add(e.join(''))),m.sources.forEach(function(a){var b=m.sourceContentFor(a);b!=null&&(j!=null&&(a=c.join(j,a)),f.setSourceContent(a,b))}),f},a.prototype.add=function a(c){if(Array.isArray(c))c.forEach(function(a){this.add(a)},this);else if(c[b]||typeof c==='string')c&&this.children.push(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.prepend=function a(c){if(Array.isArray(c))for(var d=c.length-1;d>=0;d--)this.prepend(c[d]);else if(c[b]||typeof c==='string')this.children.unshift(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.walk=function a(e){var c;for(var d=0,f=this.children.length;d<f;d++)c=this.children[d],c[b]?c.walk(e):c!==''&&e(c,{source:this.source,line:this.line,column:this.column,name:this.name})},a.prototype.join=function a(e){var b,c,d=this.children.length;if(d>0){for(b=[],c=0;c<d-1;c++)b.push(this.children[c]),b.push(e);b.push(this.children[c]),this.children=b}return this},a.prototype.replaceRight=function a(d,e){var c=this.children[this.children.length-1];return c[b]?c.replaceRight(d,e):typeof c==='string'?this.children[this.children.length-1]=c.replace(d,e):this.children.push(''.replace(d,e)),this},a.prototype.setSourceContent=function a(b,d){this.sourceContents[c.toSetString(b)]=d},a.prototype.walkSourceContents=function a(g){for(var d=0,e=this.children.length;d<e;d++)this.children[d][b]&&this.children[d].walkSourceContents(g);var f=Object.keys(this.sourceContents);for(var d=0,e=f.length;d<e;d++)g(c.fromSetString(f[d]),this.sourceContents[f[d]])},a.prototype.toString=function a(){var b='';return this.walk(function(a){b+=a}),b},a.prototype.toStringWithSourceMap=function a(l){var b={code:'',line:1,column:0},c=new g(l),e=!1,f=null,i=null,j=null,k=null;return this.walk(function(g,a){b.code+=g,a.source!==null&&a.line!==null&&a.column!==null?((f!==a.source||i!==a.line||j!==a.column||k!==a.name)&&c.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name}),f=a.source,i=a.line,j=a.column,k=a.name,e=!0):e&&(c.addMapping({generated:{line:b.line,column:b.column}}),f=null,e=!1),g.match(h).forEach(function(g,h,i){d.test(g)?(b.line++,b.column=0,h+1===i.length?(f=null,e=!1):e&&c.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name})):b.column+=g.length})}),this.walkSourceContents(function(a,b){c.setSourceContent(a,b)}),{code:b.code,map:c}},i.SourceNode=a})}),a.define('/node_modules/source-map/lib/source-map/util.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(o,a,p){function m(b,a,c){if(a in b)return b[a];else if(arguments.length===3)return c;else throw new Error('"'+a+'" is a required argument.')}function b(b){var a=b.match(f);return a?{scheme:a[1],auth:a[2],host:a[3],port:a[4],path:a[5]}:null}function c(a){var b='';return a.scheme&&(b+=a.scheme+':'),b+='//',a.auth&&(b+=a.auth+'@'),a.host&&(b+=a.host),a.port&&(b+=':'+a.port),a.path&&(b+=a.path),b}function g(i){var a=i,d=b(i);if(d){if(!d.path)return i;a=d.path}var j=a.charAt(0)==='/',e=a.split(/\/+/);for(var h,g=0,f=e.length-1;f>=0;f--)h=e[f],h==='.'?e.splice(f,1):h==='..'?g++:g>0&&(h===''?(e.splice(f+1,g),g=0):(e.splice(f,2),g--));return a=e.join('/'),a===''&&(a=j?'/':'.'),d?(d.path=a,c(d)):a}function h(h,d){h===''&&(h='.'),d===''&&(d='.');var f=b(d),a=b(h);if(a&&(h=a.path||'/'),f&&!f.scheme)return a&&(f.scheme=a.scheme),c(f);if(f||d.match(e))return d;if(a&&!a.host&&!a.path)return a.host=d,c(a);var i=d.charAt(0)==='/'?d:g(h.replace(/\/+$/,'')+'/'+d);return a?(a.path=i,c(a)):i}function j(a,c){a===''&&(a='.'),a=a.replace(/\/$/,'');var d=b(a);return c.charAt(0)=='/'&&d&&d.path=='/'?c.slice(1):c.indexOf(a+'/')===0?c.substr(a.length+1):c}function k(a){return'$'+a}function l(a){return a.substr(1)}function d(c,d){var a=c||'',b=d||'';return(a>b)-(a<b)}function n(b,c,e){var a;return a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a||e?a:(a=d(b.name,c.name),a?a:(a=b.generatedLine-c.generatedLine,a?a:b.generatedColumn-c.generatedColumn))))}function i(b,c,e){var a;return a=b.generatedLine-c.generatedLine,a?a:(a=b.generatedColumn-c.generatedColumn,a||e?a:(a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a?a:d(b.name,c.name)))))}a.getArg=m;var f=/^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/,e=/^data:.+\,.+$/;a.urlParse=b,a.urlGenerate=c,a.normalize=g,a.join=h,a.relative=j,a.toSetString=k,a.fromSetString=l,a.compareByOriginalPositions=n,a.compareByGeneratedPositions=i})}),a.define('/node_modules/source-map/node_modules/amdefine/amdefine.js',function(b,f,g,d){'use strict';function e(e,i){'use strict';function q(b){var a,c;for(a=0;b[a];a+=1)if(c=b[a],c==='.')b.splice(a,1),a-=1;else if(c==='..')if(a===1&&(b[2]==='..'||b[0]==='..'))break;else a>0&&(b.splice(a-1,2),a-=2)}function j(b,c){var a;return b&&b.charAt(0)==='.'&&c&&(a=c.split('/'),a=a.slice(0,a.length-1),a=a.concat(b.split('/')),q(a),b=a.join('/')),b}function p(a){return function(b){return j(b,a)}}function o(c){function a(a){b[c]=a}return a.fromText=function(a,b){throw new Error('amdefine does not implement load.fromText')},a}function m(c,h,l){var m,f,a,j;if(c)f=b[c]={},a={id:c,uri:d,exports:f},m=g(i,f,a,c);else{if(k)throw new Error('amdefine with no module ID cannot be called more than once per file.');k=!0,f=e.exports,a=e,m=g(i,f,a,e.id)}h&&(h=h.map(function(a){return m(a)})),typeof l==='function'?j=l.apply(a.exports,h):j=l,j!==undefined&&(a.exports=j,c&&(b[c]=a.exports))}function l(b,a,c){Array.isArray(b)?(c=a,a=b,b=undefined):typeof b!=='string'&&(c=b,b=a=undefined),a&&!Array.isArray(a)&&(c=a,a=undefined),a||(a=['require','exports','module']),b?f[b]=[b,a,c]:m(b,a,c)}var f={},b={},k=!1,n=a('path',e),g,h;return g=function(b,d,a,e){function f(f,g){if(typeof f==='string')return h(b,d,a,f,e);f=f.map(function(c){return h(b,d,a,c,e)}),c.nextTick(function(){g.apply(null,f)})}return f.toUrl=function(b){return b.indexOf('.')===0?j(b,n.dirname(a.filename)):b},f},i=i||function a(){return e.require.apply(e,arguments)},h=function(d,e,i,a,c){var k=a.indexOf('!'),n=a,q,l;if(k===-1)if(a=j(a,c),a==='require')return g(d,e,i,c);else if(a==='exports')return e;else if(a==='module')return i;else if(b.hasOwnProperty(a))return b[a];else if(f[a])return m.apply(null,f[a]),b[a];else if(d)return d(n);else throw new Error('No module with ID: '+a);else return q=a.substring(0,k),a=a.substring(k+1,a.length),l=h(d,e,i,q,c),l.normalize?a=l.normalize(a,p(c)):a=j(a,c),b[a]?b[a]:(l.load(a,g(d,e,i,c),o(a),{}),b[a])},l.require=function(a){return b[a]?b[a]:f[a]?(m.apply(null,f[a]),b[a]):void 0},l.amd={},l}b.exports=e}),a.define('/node_modules/source-map/lib/source-map/source-map-generator.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,g,f){function b(b){b||(b={}),this._file=a.getArg(b,'file',null),this._sourceRoot=a.getArg(b,'sourceRoot',null),this._sources=new d,this._names=new d,this._mappings=[],this._sourcesContents=null}var c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f),a=e('/node_modules/source-map/lib/source-map/util.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet;b.prototype._version=3,b.fromSourceMap=function c(d){var e=d.sourceRoot,f=new b({file:d.file,sourceRoot:e});return d.eachMapping(function(b){var c={generated:{line:b.generatedLine,column:b.generatedColumn}};b.source!=null&&(c.source=b.source,e!=null&&(c.source=a.relative(e,c.source)),c.original={line:b.originalLine,column:b.originalColumn},b.name!=null&&(c.name=b.name)),f.addMapping(c)}),d.sources.forEach(function(b){var a=d.sourceContentFor(b);a!=null&&f.setSourceContent(b,a)}),f},b.prototype.addMapping=function b(f){var g=a.getArg(f,'generated'),c=a.getArg(f,'original',null),d=a.getArg(f,'source',null),e=a.getArg(f,'name',null);this._validateMapping(g,c,d,e),d!=null&&!this._sources.has(d)&&this._sources.add(d),e!=null&&!this._names.has(e)&&this._names.add(e),this._mappings.push({generatedLine:g.line,generatedColumn:g.column,originalLine:c!=null&&c.line,originalColumn:c!=null&&c.column,source:d,name:e})},b.prototype.setSourceContent=function b(e,d){var c=e;this._sourceRoot!=null&&(c=a.relative(this._sourceRoot,c)),d!=null?(this._sourcesContents||(this._sourcesContents={}),this._sourcesContents[a.toSetString(c)]=d):this._sourcesContents&&(delete this._sourcesContents[a.toSetString(c)],Object.keys(this._sourcesContents).length===0&&(this._sourcesContents=null))},b.prototype.applySourceMap=function b(e,j,g){var f=j;if(j==null){if(e.file==null)throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map\'s "file" property. Both were omitted.');f=e.file}var c=this._sourceRoot;c!=null&&(f=a.relative(c,f));var h=new d,i=new d;this._mappings.forEach(function(b){if(b.source===f&&b.originalLine!=null){var d=e.originalPositionFor({line:b.originalLine,column:b.originalColumn});d.source!=null&&(b.source=d.source,g!=null&&(b.source=a.join(g,b.source)),c!=null&&(b.source=a.relative(c,b.source)),b.originalLine=d.line,b.originalColumn=d.column,d.name!=null&&(b.name=d.name))}var j=b.source;j!=null&&!h.has(j)&&h.add(j);var k=b.name;k!=null&&!i.has(k)&&i.add(k)},this),this._sources=h,this._names=i,e.sources.forEach(function(b){var d=e.sourceContentFor(b);d!=null&&(g!=null&&(b=a.join(g,b)),c!=null&&(b=a.relative(c,b)),this.setSourceContent(b,d))},this)},b.prototype._validateMapping=function a(b,c,d,e){if(b&&'line'in b&&'column'in b&&b.line>0&&b.column>=0&&!c&&!d&&!e)return;else if(b&&'line'in b&&'column'in b&&c&&'line'in c&&'column'in c&&b.line>0&&b.column>=0&&c.line>0&&c.column>=0&&d)return;else throw new Error('Invalid mapping: '+JSON.stringify({generated:b,source:d,original:c,name:e}))},b.prototype._serializeMappings=function b(){var h=0,g=1,j=0,k=0,i=0,l=0,e='',d;this._mappings.sort(a.compareByGeneratedPositions);for(var f=0,m=this._mappings.length;f<m;f++){if(d=this._mappings[f],d.generatedLine!==g){h=0;while(d.generatedLine!==g)e+=';',g++}else if(f>0){if(!a.compareByGeneratedPositions(d,this._mappings[f-1]))continue;e+=','}e+=c.encode(d.generatedColumn-h),h=d.generatedColumn,d.source!=null&&(e+=c.encode(this._sources.indexOf(d.source)-l),l=this._sources.indexOf(d.source),e+=c.encode(d.originalLine-1-k),k=d.originalLine-1,e+=c.encode(d.originalColumn-j),j=d.originalColumn,d.name!=null&&(e+=c.encode(this._names.indexOf(d.name)-i),i=this._names.indexOf(d.name)))}return e},b.prototype._generateSourcesContent=function b(d,c){return d.map(function(b){if(!this._sourcesContents)return null;c!=null&&(b=a.relative(c,b));var d=a.toSetString(b);return Object.prototype.hasOwnProperty.call(this._sourcesContents,d)?this._sourcesContents[d]:null},this)},b.prototype.toJSON=function a(){var b={version:this._version,sources:this._sources.toArray(),names:this._names.toArray(),mappings:this._serializeMappings()};return this._file!=null&&(b.file=this._file),this._sourceRoot!=null&&(b.sourceRoot=this._sourceRoot),this._sourcesContents&&(b.sourcesContent=this._generateSourcesContent(b.sources,b.sourceRoot)),b},b.prototype.toString=function a(){return JSON.stringify(this)},g.SourceMapGenerator=b})}),a.define('/node_modules/source-map/lib/source-map/array-set.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,d,e){function a(){this._array=[],this._set={}}var b=c('/node_modules/source-map/lib/source-map/util.js',e);a.fromArray=function b(e,g){var d=new a;for(var c=0,f=e.length;c<f;c++)d.add(e[c],g);return d},a.prototype.add=function a(c,f){var d=this.has(c),e=this._array.length;(!d||f)&&this._array.push(c),d||(this._set[b.toSetString(c)]=e)},a.prototype.has=function a(c){return Object.prototype.hasOwnProperty.call(this._set,b.toSetString(c))},a.prototype.indexOf=function a(c){if(this.has(c))return this._set[b.toSetString(c)];throw new Error('"'+c+'" is not in the set.')},a.prototype.at=function a(b){if(b>=0&&b<this._array.length)return this._array[b];throw new Error('No element indexed by '+b)},a.prototype.toArray=function a(){return this._array.slice()},d.ArraySet=a})}),a.define('/node_modules/source-map/lib/source-map/base64-vlq.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(j,f,h){function i(a){return a<0?(-a<<1)+1:(a<<1)+0}function g(b){var c=(b&1)===1,a=b>>1;return c?-a:a}var c=j('/node_modules/source-map/lib/source-map/base64.js',h),a=5,d=1<<a,e=d-1,b=d;f.encode=function d(j){var g='',h,f=i(j);do h=f&e,f>>>=a,f>0&&(h|=b),g+=c.encode(h);while(f>0);return g},f.decode=function d(i,l){var f=0,m=i.length,j=0,k=0,n,h;do{if(f>=m)throw new Error('Expected more digits in base 64 VLQ value.');h=c.decode(i.charAt(f++)),n=!!(h&b),h&=e,j+=h<<k,k+=a}while(n);l.value=g(j),l.rest=i.slice(f)}})}),a.define('/node_modules/source-map/lib/source-map/base64.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(d,c,e){var a={},b={};'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function(c,d){a[c]=d,b[d]=c}),c.encode=function a(c){if(c in b)return b[c];throw new TypeError('Must be between 0 and 63: '+c)},c.decode=function b(c){if(c in a)return a[c];throw new TypeError('Not a valid base 64 digit: '+c)}})}),a.define('/node_modules/source-map/lib/source-map/source-map-consumer.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,h,f){function b(e){var b=e;typeof e==='string'&&(b=JSON.parse(e.replace(/^\)\]\}'/,'')));var f=a.getArg(b,'version'),c=a.getArg(b,'sources'),g=a.getArg(b,'names',[]),h=a.getArg(b,'sourceRoot',null),i=a.getArg(b,'sourcesContent',null),j=a.getArg(b,'mappings'),k=a.getArg(b,'file',null);if(f!=this._version)throw new Error('Unsupported version: '+f);c=c.map(a.normalize),this._names=d.fromArray(g,!0),this._sources=d.fromArray(c,!0),this.sourceRoot=h,this.sourcesContent=i,this._mappings=j,this.file=k}var a=e('/node_modules/source-map/lib/source-map/util.js',f),g=e('/node_modules/source-map/lib/source-map/binary-search.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet,c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f);b.fromSourceMap=function c(f){var e=Object.create(b.prototype);return e._names=d.fromArray(f._names.toArray(),!0),e._sources=d.fromArray(f._sources.toArray(),!0),e.sourceRoot=f._sourceRoot,e.sourcesContent=f._generateSourcesContent(e._sources.toArray(),e.sourceRoot),e.file=f._file,e.__generatedMappings=f._mappings.slice().sort(a.compareByGeneratedPositions),e.__originalMappings=f._mappings.slice().sort(a.compareByOriginalPositions),e},b.prototype._version=3,Object.defineProperty(b.prototype,'sources',{get:function(){return this._sources.toArray().map(function(b){return this.sourceRoot!=null?a.join(this.sourceRoot,b):b},this)}}),b.prototype.__generatedMappings=null,Object.defineProperty(b.prototype,'_generatedMappings',{get:function(){return this.__generatedMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__generatedMappings}}),b.prototype.__originalMappings=null,Object.defineProperty(b.prototype,'_originalMappings',{get:function(){return this.__originalMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__originalMappings}}),b.prototype._nextCharIsMappingSeparator=function a(c){var b=c.charAt(0);return b===';'||b===','},b.prototype._parseMappings=function b(m,n){var j=1,g=0,i=0,h=0,k=0,l=0,d=m,e={},f;while(d.length>0)if(d.charAt(0)===';')j++,d=d.slice(1),g=0;else if(d.charAt(0)===',')d=d.slice(1);else{if(f={},f.generatedLine=j,c.decode(d,e),f.generatedColumn=g+e.value,g=f.generatedColumn,d=e.rest,d.length>0&&!this._nextCharIsMappingSeparator(d)){if(c.decode(d,e),f.source=this._sources.at(k+e.value),k+=e.value,d=e.rest,d.length===0||this._nextCharIsMappingSeparator(d))throw new Error('Found a source, but no line and column');if(c.decode(d,e),f.originalLine=i+e.value,i=f.originalLine,f.originalLine+=1,d=e.rest,d.length===0||this._nextCharIsMappingSeparator(d))throw new Error('Found a source and line, but no column');c.decode(d,e),f.originalColumn=h+e.value,h=f.originalColumn,d=e.rest,d.length>0&&!this._nextCharIsMappingSeparator(d)&&(c.decode(d,e),f.name=this._names.at(l+e.value),l+=e.value,d=e.rest)}this.__generatedMappings.push(f),typeof f.originalLine==='number'&&this.__originalMappings.push(f)}this.__generatedMappings.sort(a.compareByGeneratedPositions),this.__originalMappings.sort(a.compareByOriginalPositions)},b.prototype._findMapping=function a(b,e,c,d,f){if(b[c]<=0)throw new TypeError('Line must be greater than or equal to 1, got '+b[c]);if(b[d]<0)throw new TypeError('Column must be greater than or equal to 0, got '+b[d]);return g.search(b,e,f)},b.prototype.computeColumnSpans=function a(){for(var b=0;b<this._generatedMappings.length;++b){var c=this._generatedMappings[b];if(b+1<this._generatedMappings.length){var d=this._generatedMappings[b+1];if(c.generatedLine===d.generatedLine){c.lastGeneratedColumn=d.generatedColumn-1;continue}}c.lastGeneratedColumn=Infinity}},b.prototype.originalPositionFor=function b(g){var e={generatedLine:a.getArg(g,'line'),generatedColumn:a.getArg(g,'column')},f=this._findMapping(e,this._generatedMappings,'generatedLine','generatedColumn',a.compareByGeneratedPositions);if(f>=0){var c=this._generatedMappings[f];if(c.generatedLine===e.generatedLine){var d=a.getArg(c,'source',null);return d!=null&&this.sourceRoot!=null&&(d=a.join(this.sourceRoot,d)),{source:d,line:a.getArg(c,'originalLine',null),column:a.getArg(c,'originalColumn',null),name:a.getArg(c,'name',null)}}}return{source:null,line:null,column:null,name:null}},b.prototype.sourceContentFor=function b(c){if(!this.sourcesContent)return null;if(this.sourceRoot!=null&&(c=a.relative(this.sourceRoot,c)),this._sources.has(c))return this.sourcesContent[this._sources.indexOf(c)];var d;if(this.sourceRoot!=null&&(d=a.urlParse(this.sourceRoot))){var e=c.replace(/^file:\/\//,'');if(d.scheme=='file'&&this._sources.has(e))return this.sourcesContent[this._sources.indexOf(e)];if((!d.path||d.path=='/')&&this._sources.has('/'+c))return this.sourcesContent[this._sources.indexOf('/'+c)]}throw new Error('"'+c+'" is not in the SourceMap.')},b.prototype.generatedPositionFor=function b(e){var c={source:a.getArg(e,'source'),originalLine:a.getArg(e,'line'),originalColumn:a.getArg(e,'column')};this.sourceRoot!=null&&(c.source=a.relative(this.sourceRoot,c.source));var f=this._findMapping(c,this._originalMappings,'originalLine','originalColumn',a.compareByOriginalPositions);if(f>=0){var d=this._originalMappings[f];return{line:a.getArg(d,'generatedLine',null),column:a.getArg(d,'generatedColumn',null),lastColumn:a.getArg(d,'lastGeneratedColumn',null)}}return{line:null,column:null,lastColumn:null}},b.prototype.allGeneratedPositionsFor=function b(g){var d={source:a.getArg(g,'source'),originalLine:a.getArg(g,'line'),originalColumn:Infinity};this.sourceRoot!=null&&(d.source=a.relative(this.sourceRoot,d.source));var f=[],e=this._findMapping(d,this._originalMappings,'originalLine','originalColumn',a.compareByOriginalPositions);if(e>=0){var c=this._originalMappings[e];while(c&&c.originalLine===d.originalLine)f.push({line:a.getArg(c,'generatedLine',null),column:a.getArg(c,'generatedColumn',null),lastColumn:a.getArg(c,'lastGeneratedColumn',null)}),c=this._originalMappings[--e]}return f.reverse()},b.GENERATED_ORDER=1,b.ORIGINAL_ORDER=2,b.prototype.eachMapping=function c(h,i,j){var f=i||null,g=j||b.GENERATED_ORDER,d;switch(g){case b.GENERATED_ORDER:d=this._generatedMappings;break;case b.ORIGINAL_ORDER:d=this._originalMappings;break;default:throw new Error('Unknown order of iteration.')}var e=this.sourceRoot;d.map(function(b){var c=b.source;return c!=null&&e!=null&&(c=a.join(e,c)),{source:c,generatedLine:b.generatedLine,generatedColumn:b.generatedColumn,originalLine:b.originalLine,originalColumn:b.originalColumn,name:b.name}}).forEach(h,f)},h.SourceMapConsumer=b})}),a.define('/node_modules/source-map/lib/source-map/binary-search.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,b,d){function a(c,d,e,f,g){var b=Math.floor((d-c)/2)+c,h=g(e,f[b],!0);return h===0?b:h>0?d-b>1?a(b,d,e,f,g):b:b-c>1?a(c,b,e,f,g):c<0?-1:c}b.search=function b(d,c,e){return c.length===0?-1:a(-1,c.length,d,c,e)}})}),a.define('/node_modules/esutils/lib/utils.js',function(b,c,d,e){!function(){'use strict';c.ast=a('/node_modules/esutils/lib/ast.js',b),c.code=a('/node_modules/esutils/lib/code.js',b),c.keyword=a('/node_modules/esutils/lib/keyword.js',b)}()}),a.define('/node_modules/esutils/lib/keyword.js',function(b,c,d,e){!function(d){'use strict';function i(a){switch(a){case'implements':case'interface':case'package':case'private':case'protected':case'public':case'static':case'let':return!0;default:return!1}}function g(a,b){return!b&&a==='yield'?!1:c(a,b)}function c(a,b){if(b&&i(a))return!0;switch(a.length){case 2:return a==='if'||a==='in'||a==='do';case 3:return a==='var'||a==='for'||a==='new'||a==='try';case 4:return a==='this'||a==='else'||a==='case'||a==='void'||a==='with'||a==='enum';case 5:return a==='while'||a==='break'||a==='catch'||a==='throw'||a==='const'||a==='yield'||a==='class'||a==='super';case 6:return a==='return'||a==='typeof'||a==='delete'||a==='switch'||a==='export'||a==='import';case 7:return a==='default'||a==='finally'||a==='extends';case 8:return a==='function'||a==='continue'||a==='debugger';case 10:return a==='instanceof';default:return!1}}function f(a,b){return a==='null'||a==='true'||a==='false'||g(a,b)}function h(a,b){return a==='null'||a==='true'||a==='false'||c(a,b)}function j(a){return a==='eval'||a==='arguments'}function e(b){var c,e,a;if(b.length===0)return!1;if(a=b.charCodeAt(0),!d.isIdentifierStart(a)||a===92)return!1;for(c=1,e=b.length;c<e;++c)if(a=b.charCodeAt(c),!d.isIdentifierPart(a)||a===92)return!1;return!0}function l(a,b){return e(a)&&!f(a,b)}function k(a,b){return e(a)&&!h(a,b)}d=a('/node_modules/esutils/lib/code.js',b),b.exports={isKeywordES5:g,isKeywordES6:c,isReservedWordES5:f,isReservedWordES6:h,isRestrictedWord:j,isIdentifierName:e,isIdentifierES5:l,isIdentifierES6:k}}()}),a.define('/node_modules/esutils/lib/code.js',function(a,b,c,d){!function(b,c){'use strict';function d(a){return a>=48&&a<=57}function e(a){return d(a)||97<=a&&a<=102||65<=a&&a<=70}function f(a){return a>=48&&a<=55}function g(a){return a===32||a===9||a===11||a===12||a===160||a>=5760&&c.indexOf(a)>=0}function h(a){return a===10||a===13||a===8232||a===8233}function i(a){return a>=97&&a<=122||a>=65&&a<=90||a===36||a===95||a===92||a>=128&&b.NonAsciiIdentifierStart.test(String.fromCharCode(a))}function j(a){return a>=97&&a<=122||a>=65&&a<=90||a>=48&&a<=57||a===36||a===95||a===92||a>=128&&b.NonAsciiIdentifierPart.test(String.fromCharCode(a))}b={NonAsciiIdentifierStart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԧԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠࢢ-ࢬऄ-हऽॐक़-ॡॱ-ॷॹ-ॿঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚗꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꪀ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]'),NonAsciiIdentifierPart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮ̀-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁ҃-҇Ҋ-ԧԱ-Ֆՙա-և֑-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-٩ٮ-ۓە-ۜ۟-۪ۨ-ۼۿܐ-݊ݍ-ޱ߀-ߵߺࠀ-࠭ࡀ-࡛ࢠࢢ-ࢬࣤ-ࣾऀ-ॣ०-९ॱ-ॷॹ-ॿঁ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-ৱਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹ਼ਾ-ੂੇੈੋ-੍ੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હ઼-ૅે-ૉો-્ૐૠ-ૣ૦-૯ଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହ଼-ୄେୈୋ-୍ୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-்ௐௗ௦-௯ఁ-ఃఅ-ఌఎ-ఐఒ-నప-ళవ-హఽ-ౄె-ైొ-్ౕౖౘౙౠ-ౣ౦-౯ಂಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹ಼-ೄೆ-ೈೊ-್ೕೖೞೠ-ೣ೦-೯ೱೲംഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൎൗൠ-ൣ൦-൯ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆ්ා-ුූෘ-ෟෲෳก-ฺเ-๎๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆ່-ໍ໐-໙ໜ-ໟༀ༘༙༠-༩༹༵༷༾-ཇཉ-ཬཱ-྄྆-ྗྙ-ྼ࿆က-၉ၐ-ႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፝-፟ᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-᜔ᜠ-᜴ᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-៓ៗៜ៝០-៩᠋-᠍᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤜᤠ-ᤫᤰ-᤻᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧙ᨀ-ᨛᨠ-ᩞ᩠-᩿᩼-᪉᪐-᪙ᪧᬀ-ᭋ᭐-᭙᭫-᭳ᮀ-᯳ᰀ-᰷᱀-᱉ᱍ-ᱽ᳐-᳔᳒-ᳶᴀ-ᷦ᷼-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ‌‍‿⁀⁔ⁱⁿₐ-ₜ⃐-⃥⃜⃡-⃰ℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯ⵿-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〯〱-〵〸-〼ぁ-ゖ゙゚ゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟ-꛱ꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠧꡀ-ꡳꢀ-꣄꣐-꣙꣠-ꣷꣻ꤀-꤭ꤰ-꥓ꥠ-ꥼꦀ-꧀ꧏ-꧙ꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩻꪀ-ꫂꫛ-ꫝꫠ-ꫯꫲ-꫶ꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯪ꯬꯭꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻ︀-️︠-︦︳︴﹍-﹏ﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚ＿ａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]')},c=[5760,6158,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8239,8287,12288,65279],a.exports={isDecimalDigit:d,isHexDigit:e,isOctalDigit:f,isWhiteSpace:g,isLineTerminator:h,isIdentifierStart:i,isIdentifierPart:j}}()}),a.define('/node_modules/esutils/lib/ast.js',function(a,b,c,d){!function(){'use strict';function d(a){if(a==null)return!1;switch(a.type){case'ArrayExpression':case'AssignmentExpression':case'BinaryExpression':case'CallExpression':case'ConditionalExpression':case'FunctionExpression':case'Identifier':case'Literal':case'LogicalExpression':case'MemberExpression':case'NewExpression':case'ObjectExpression':case'SequenceExpression':case'ThisExpression':case'UnaryExpression':case'UpdateExpression':return!0}return!1}function e(a){if(a==null)return!1;switch(a.type){case'DoWhileStatement':case'ForInStatement':case'ForStatement':case'WhileStatement':return!0}return!1}function b(a){if(a==null)return!1;switch(a.type){case'BlockStatement':case'BreakStatement':case'ContinueStatement':case'DebuggerStatement':case'DoWhileStatement':case'EmptyStatement':case'ExpressionStatement':case'ForInStatement':case'ForStatement':case'IfStatement':case'LabeledStatement':case'ReturnStatement':case'SwitchStatement':case'ThrowStatement':case'TryStatement':case'VariableDeclaration':case'WhileStatement':case'WithStatement':return!0}return!1}function f(a){return b(a)||a!=null&&a.type==='FunctionDeclaration'}function c(a){switch(a.type){case'IfStatement':return a.alternate!=null?a.alternate:a.consequent;case'LabeledStatement':case'ForStatement':case'ForInStatement':case'WhileStatement':case'WithStatement':return a.body}return null}function g(b){var a;if(b.type!=='IfStatement')return!1;if(b.alternate==null)return!1;a=b.consequent;do{if(a.type==='IfStatement'&&a.alternate==null)return!0;a=c(a)}while(a);return!1}a.exports={isExpression:d,isStatement:b,isIterationStatement:e,isSourceElement:f,isProblematicIfStatement:g,trailingStatement:c}}()}),a.define('/node_modules/estraverse/estraverse.js',function(b,a,c,d){!function(c,b){'use strict';typeof define==='function'&&define.amd?define(['exports'],b):a!==void 0?b(a):b(c.estraverse={})}(this,function a(d){'use strict';function s(){}function p(d){var c={},a,b;for(a in d)d.hasOwnProperty(a)&&(b=d[a],typeof b==='object'&&b!==null?c[a]=p(b):c[a]=b);return c}function y(b){var c={},a;for(a in b)b.hasOwnProperty(a)&&(c[a]=b[a]);return c}function x(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?a=b:(c=d+1,a-=b+1);return c}function t(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?(c=d+1,a-=b+1):a=b;return c}function u(a,b){return l(b).forEach(function(c){a[c]=b[c]}),a}function i(a,b){this.parent=a,this.key=b}function e(a,b,c,d){this.node=a,this.path=b,this.wrap=c,this.ref=d}function b(){}function k(a){return a==null?!1:typeof a==='object'&&typeof a.type==='string'}function q(a,b){return(a===m.ObjectExpression||a===m.ObjectPattern)&&'properties'===b}function o(c,d){var a=new b;return a.traverse(c,d)}function w(c,d){var a=new b;return a.replace(c,d)}function z(a,c){var b;return b=x(c,function b(c){return c.range[0]>a.range[0]}),a.extendedRange=[a.range[0],a.range[1]],b!==c.length&&(a.extendedRange[1]=c[b].range[0]),b-=1,b>=0&&(a.extendedRange[0]=c[b].range[1]),a}function v(d,e,h){var a=[],g,f,c,b;if(!d.range)throw new Error('attachComments needs range information');if(!h.length){if(e.length){for(c=0,f=e.length;c<f;c+=1)g=p(e[c]),g.extendedRange=[0,d.range[0]],a.push(g);d.leadingComments=a}return d}for(c=0,f=e.length;c<f;c+=1)a.push(z(p(e[c]),h));return b=0,o(d,{enter:function(c){var d;while(b<a.length){if(d=a[b],d.extendedRange[1]>c.range[0])break;d.extendedRange[1]===c.range[0]?(c.leadingComments||(c.leadingComments=[]),c.leadingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?j.Break:a[b].extendedRange[0]>c.range[1]?j.Skip:void 0}}),b=0,o(d,{leave:function(c){var d;while(b<a.length){if(d=a[b],c.range[1]<d.extendedRange[0])break;c.range[1]===d.extendedRange[0]?(c.trailingComments||(c.trailingComments=[]),c.trailingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?j.Break:a[b].extendedRange[0]>c.range[1]?j.Skip:void 0}}),d}var m,h,j,n,r,l,c,g,f;return h=Array.isArray,h||(h=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),s(y),s(t),r=Object.create||function(){function a(){}return function(b){return a.prototype=b,new a}}(),l=Object.keys||function(c){var a=[],b;for(b in c)a.push(b);return a},m={AssignmentExpression:'AssignmentExpression',ArrayExpression:'ArrayExpression',ArrayPattern:'ArrayPattern',ArrowFunctionExpression:'ArrowFunctionExpression',AwaitExpression:'AwaitExpression',BlockStatement:'BlockStatement',BinaryExpression:'BinaryExpression',BreakStatement:'BreakStatement',CallExpression:'CallExpression',CatchClause:'CatchClause',ClassBody:'ClassBody',ClassDeclaration:'ClassDeclaration',ClassExpression:'ClassExpression',ComprehensionBlock:'ComprehensionBlock',ComprehensionExpression:'ComprehensionExpression',ConditionalExpression:'ConditionalExpression',ContinueStatement:'ContinueStatement',DebuggerStatement:'DebuggerStatement',DirectiveStatement:'DirectiveStatement',DoWhileStatement:'DoWhileStatement',EmptyStatement:'EmptyStatement',ExportBatchSpecifier:'ExportBatchSpecifier',ExportDeclaration:'ExportDeclaration',ExportSpecifier:'ExportSpecifier',ExpressionStatement:'ExpressionStatement',ForStatement:'ForStatement',ForInStatement:'ForInStatement',ForOfStatement:'ForOfStatement',FunctionDeclaration:'FunctionDeclaration',FunctionExpression:'FunctionExpression',GeneratorExpression:'GeneratorExpression',Identifier:'Identifier',IfStatement:'IfStatement',ImportDeclaration:'ImportDeclaration',ImportDefaultSpecifier:'ImportDefaultSpecifier',ImportNamespaceSpecifier:'ImportNamespaceSpecifier',ImportSpecifier:'ImportSpecifier',Literal:'Literal',LabeledStatement:'LabeledStatement',LogicalExpression:'LogicalExpression',MemberExpression:'MemberExpression',MethodDefinition:'MethodDefinition',ModuleSpecifier:'ModuleSpecifier',NewExpression:'NewExpression',ObjectExpression:'ObjectExpression',ObjectPattern:'ObjectPattern',Program:'Program',Property:'Property',ReturnStatement:'ReturnStatement',SequenceExpression:'SequenceExpression',SpreadElement:'SpreadElement',SwitchStatement:'SwitchStatement',SwitchCase:'SwitchCase',TaggedTemplateExpression:'TaggedTemplateExpression',TemplateElement:'TemplateElement',TemplateLiteral:'TemplateLiteral',ThisExpression:'ThisExpression',ThrowStatement:'ThrowStatement',TryStatement:'TryStatement',UnaryExpression:'UnaryExpression',UpdateExpression:'UpdateExpression',VariableDeclaration:'VariableDeclaration',VariableDeclarator:'VariableDeclarator',WhileStatement:'WhileStatement',WithStatement:'WithStatement',YieldExpression:'YieldExpression'},n={AssignmentExpression:['left','right'],ArrayExpression:['elements'],ArrayPattern:['elements'],ArrowFunctionExpression:['params','defaults','rest','body'],AwaitExpression:['argument'],BlockStatement:['body'],BinaryExpression:['left','right'],BreakStatement:['label'],CallExpression:['callee','arguments'],CatchClause:['param','body'],ClassBody:['body'],ClassDeclaration:['id','body','superClass'],ClassExpression:['id','body','superClass'],ComprehensionBlock:['left','right'],ComprehensionExpression:['blocks','filter','body'],ConditionalExpression:['test','consequent','alternate'],ContinueStatement:['label'],DebuggerStatement:[],DirectiveStatement:[],DoWhileStatement:['body','test'],EmptyStatement:[],ExportBatchSpecifier:[],ExportDeclaration:['declaration','specifiers','source'],ExportSpecifier:['id','name'],ExpressionStatement:['expression'],ForStatement:['init','test','update','body'],ForInStatement:['left','right','body'],ForOfStatement:['left','right','body'],FunctionDeclaration:['id','params','defaults','rest','body'],FunctionExpression:['id','params','defaults','rest','body'],GeneratorExpression:['blocks','filter','body'],Identifier:[],IfStatement:['test','consequent','alternate'],ImportDeclaration:['specifiers','source'],ImportDefaultSpecifier:['id'],ImportNamespaceSpecifier:['id'],ImportSpecifier:['id','name'],Literal:[],LabeledStatement:['label','body'],LogicalExpression:['left','right'],MemberExpression:['object','property'],MethodDefinition:['key','value'],ModuleSpecifier:[],NewExpression:['callee','arguments'],ObjectExpression:['properties'],ObjectPattern:['properties'],Program:['body'],Property:['key','value'],ReturnStatement:['argument'],SequenceExpression:['expressions'],SpreadElement:['argument'],SwitchStatement:['discriminant','cases'],SwitchCase:['test','consequent'],TaggedTemplateExpression:['tag','quasi'],TemplateElement:[],TemplateLiteral:['quasis','expressions'],ThisExpression:[],ThrowStatement:['argument'],TryStatement:['block','handlers','handler','guardedHandlers','finalizer'],UnaryExpression:['argument'],UpdateExpression:['argument'],VariableDeclaration:['declarations'],VariableDeclarator:['id','init'],WhileStatement:['test','body'],WithStatement:['object','body'],YieldExpression:['argument']},c={},g={},f={},j={Break:c,Skip:g,Remove:f},i.prototype.replace=function a(b){this.parent[this.key]=b},i.prototype.remove=function a(){return h(this.parent)?(this.parent.splice(this.key,1),!0):(this.replace(null),!1)},b.prototype.path=function a(){function e(b,a){if(h(a))for(c=0,g=a.length;c<g;++c)b.push(a[c]);else b.push(a)}var b,f,c,g,d,i;if(!this.__current.path)return null;for(d=[],b=2,f=this.__leavelist.length;b<f;++b)i=this.__leavelist[b],e(d,i.path);return e(d,this.__current.path),d},b.prototype.type=function(){var a=this.current();return a.type||this.__current.wrap},b.prototype.parents=function a(){var b,d,c;for(c=[],b=1,d=this.__leavelist.length;b<d;++b)c.push(this.__leavelist[b].node);return c},b.prototype.current=function a(){return this.__current.node},b.prototype.__execute=function a(c,d){var e,b;return b=undefined,e=this.__current,this.__current=d,this.__state=null,c&&(b=c.call(this,d.node,this.__leavelist[this.__leavelist.length-1].node)),this.__current=e,b},b.prototype.notify=function a(b){this.__state=b},b.prototype.skip=function(){this.notify(g)},b.prototype['break']=function(){this.notify(c)},b.prototype.remove=function(){this.notify(f)},b.prototype.__initialize=function(b,a){this.visitor=a,this.root=b,this.__worklist=[],this.__leavelist=[],this.__current=null,this.__state=null,this.__fallback=a.fallback==='iteration',this.__keys=n,a.keys&&(this.__keys=u(r(this.__keys),a.keys))},b.prototype.traverse=function a(v,u){var i,r,b,o,s,m,n,p,f,j,d,t;this.__initialize(v,u),t={},i=this.__worklist,r=this.__leavelist,i.push(new e(v,null,null,null)),r.push(new e(null,null,null,null));while(i.length){if(b=i.pop(),b===t){if(b=r.pop(),m=this.__execute(u.leave,b),this.__state===c||m===c)return;continue}if(b.node){if(m=this.__execute(u.enter,b),this.__state===c||m===c)return;if(i.push(t),r.push(b),this.__state===g||m===g)continue;if(o=b.node,s=b.wrap||o.type,j=this.__keys[s],!j)if(this.__fallback)j=l(o);else throw new Error('Unknown node type '+s+'.');p=j.length;while((p-=1)>=0){if(n=j[p],d=o[n],!d)continue;if(h(d)){f=d.length;while((f-=1)>=0){if(!d[f])continue;if(q(s,j[p]))b=new e(d[f],[n,f],'Property',null);else if(k(d[f]))b=new e(d[f],[n,f],null,null);else continue;i.push(b)}}else k(d)&&i.push(new e(d,n,null,null))}}}},b.prototype.replace=function a(w,x){function z(b){var c,d,a,e;if(b.ref.remove()){d=b.ref.key,e=b.ref.parent,c=n.length;while(c--)if(a=n[c],a.ref&&a.ref.parent===e){if(a.ref.key<d)break;--a.ref.key}}}var n,v,p,t,d,b,u,m,o,j,y,s,r;this.__initialize(w,x),y={},n=this.__worklist,v=this.__leavelist,s={root:w},b=new e(w,null,null,new i(s,'root')),n.push(b),v.push(b);while(n.length){if(b=n.pop(),b===y){if(b=v.pop(),d=this.__execute(x.leave,b),d!==undefined&&d!==c&&d!==g&&d!==f&&b.ref.replace(d),(this.__state===f||d===f)&&z(b),this.__state===c||d===c)return s.root;continue}if(d=this.__execute(x.enter,b),d!==undefined&&d!==c&&d!==g&&d!==f&&(b.ref.replace(d),b.node=d),(this.__state===f||d===f)&&(z(b),b.node=null),this.__state===c||d===c)return s.root;if(p=b.node,!p)continue;if(n.push(y),v.push(b),this.__state===g||d===g)continue;if(t=b.wrap||p.type,o=this.__keys[t],!o)if(this.__fallback)o=l(p);else throw new Error('Unknown node type '+t+'.');u=o.length;while((u-=1)>=0){if(r=o[u],j=p[r],!j)continue;if(h(j)){m=j.length;while((m-=1)>=0){if(!j[m])continue;if(q(t,o[u]))b=new e(j[m],[r,m],'Property',new i(j,m));else if(k(j[m]))b=new e(j[m],[r,m],null,new i(j,m));else continue;n.push(b)}}else k(j)&&n.push(new e(j,r,null,new i(p,r)))}}return s.root},d.version='1.8.1-dev',d.Syntax=m,d.traverse=o,d.replace=w,d.attachComments=v,d.VisitorKeys=n,d.VisitorOption=j,d.Controller=b,d.cloneEnvironment=function(){return a({})},d})}),a('/tools/entry-point.js')}.call(this,this))
;
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.acorn = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
module.exports = require('acorn-jsx');
},{"acorn-jsx":"acorn-jsx"}],2:[function(require,module,exports){
'use strict';

module.exports = function(acorn) {
  var tt = acorn.tokTypes;
  var tc = acorn.tokContexts;

  tc.j_oTag = new acorn.TokContext('<tag', false);
  tc.j_cTag = new acorn.TokContext('</tag', false);
  tc.j_expr = new acorn.TokContext('<tag>...</tag>', true, true);

  tt.jsxName = new acorn.TokenType('jsxName');
  tt.jsxText = new acorn.TokenType('jsxText', {beforeExpr: true});
  tt.jsxTagStart = new acorn.TokenType('jsxTagStart');
  tt.jsxTagEnd = new acorn.TokenType('jsxTagEnd');

  tt.jsxTagStart.updateContext = function() {
    this.context.push(tc.j_expr); // treat as beginning of JSX expression
    this.context.push(tc.j_oTag); // start opening tag context
    this.exprAllowed = false;
  };
  tt.jsxTagEnd.updateContext = function(prevType) {
    var out = this.context.pop();
    if (out === tc.j_oTag && prevType === tt.slash || out === tc.j_cTag) {
      this.context.pop();
      this.exprAllowed = this.curContext() === tc.j_expr;
    } else {
      this.exprAllowed = true;
    }
  };

  var pp = acorn.Parser.prototype;

  // Reads inline JSX contents token.

  pp.jsx_readToken = function() {
    var out = '', chunkStart = this.pos;
    for (;;) {
      if (this.pos >= this.input.length)
        this.raise(this.start, 'Unterminated JSX contents');
      var ch = this.input.charCodeAt(this.pos);

      switch (ch) {
      case 60: // '<'
      case 123: // '{'
        if (this.pos === this.start) {
          if (ch === 60 && this.exprAllowed) {
            ++this.pos;
            return this.finishToken(tt.jsxTagStart);
          }
          return this.getTokenFromCode(ch);
        }
        out += this.input.slice(chunkStart, this.pos);
        return this.finishToken(tt.jsxText, out);

      case 38: // '&'
        out += this.input.slice(chunkStart, this.pos);
        out += this.jsx_readEntity();
        chunkStart = this.pos;
        break;

      default:
        if (acorn.isNewLine(ch)) {
          out += this.input.slice(chunkStart, this.pos);
          out += this.jsx_readNewLine(true);
          chunkStart = this.pos;
        } else {
          ++this.pos;
        }
      }
    }
  };

  pp.jsx_readNewLine = function(normalizeCRLF) {
    var ch = this.input.charCodeAt(this.pos);
    var out;
    ++this.pos;
    if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
      ++this.pos;
      out = normalizeCRLF ? '\n' : '\r\n';
    } else {
      out = String.fromCharCode(ch);
    }
    if (this.options.locations) {
      ++this.curLine;
      this.lineStart = this.pos;
    }

    return out;
  };

  pp.jsx_readString = function(quote) {
    var out = '', chunkStart = ++this.pos;
    for (;;) {
      if (this.pos >= this.input.length)
        this.raise(this.start, 'Unterminated string constant');
      var ch = this.input.charCodeAt(this.pos);
      if (ch === quote) break;
      if (ch === 38) { // '&'
        out += this.input.slice(chunkStart, this.pos);
        out += this.jsx_readEntity();
        chunkStart = this.pos;
      } else if (acorn.isNewLine(ch)) {
        out += this.input.slice(chunkStart, this.pos);
        out += this.jsx_readNewLine(false);
        chunkStart = this.pos;
      } else {
        ++this.pos;
      }
    }
    out += this.input.slice(chunkStart, this.pos++);
    return this.finishToken(tt.string, out);
  };

  var XHTMLEntities = {
    quot: '\u0022',
    amp: '&',
    apos: '\u0027',
    lt: '<',
    gt: '>',
    nbsp: '\u00A0',
    iexcl: '\u00A1',
    cent: '\u00A2',
    pound: '\u00A3',
    curren: '\u00A4',
    yen: '\u00A5',
    brvbar: '\u00A6',
    sect: '\u00A7',
    uml: '\u00A8',
    copy: '\u00A9',
    ordf: '\u00AA',
    laquo: '\u00AB',
    not: '\u00AC',
    shy: '\u00AD',
    reg: '\u00AE',
    macr: '\u00AF',
    deg: '\u00B0',
    plusmn: '\u00B1',
    sup2: '\u00B2',
    sup3: '\u00B3',
    acute: '\u00B4',
    micro: '\u00B5',
    para: '\u00B6',
    middot: '\u00B7',
    cedil: '\u00B8',
    sup1: '\u00B9',
    ordm: '\u00BA',
    raquo: '\u00BB',
    frac14: '\u00BC',
    frac12: '\u00BD',
    frac34: '\u00BE',
    iquest: '\u00BF',
    Agrave: '\u00C0',
    Aacute: '\u00C1',
    Acirc: '\u00C2',
    Atilde: '\u00C3',
    Auml: '\u00C4',
    Aring: '\u00C5',
    AElig: '\u00C6',
    Ccedil: '\u00C7',
    Egrave: '\u00C8',
    Eacute: '\u00C9',
    Ecirc: '\u00CA',
    Euml: '\u00CB',
    Igrave: '\u00CC',
    Iacute: '\u00CD',
    Icirc: '\u00CE',
    Iuml: '\u00CF',
    ETH: '\u00D0',
    Ntilde: '\u00D1',
    Ograve: '\u00D2',
    Oacute: '\u00D3',
    Ocirc: '\u00D4',
    Otilde: '\u00D5',
    Ouml: '\u00D6',
    times: '\u00D7',
    Oslash: '\u00D8',
    Ugrave: '\u00D9',
    Uacute: '\u00DA',
    Ucirc: '\u00DB',
    Uuml: '\u00DC',
    Yacute: '\u00DD',
    THORN: '\u00DE',
    szlig: '\u00DF',
    agrave: '\u00E0',
    aacute: '\u00E1',
    acirc: '\u00E2',
    atilde: '\u00E3',
    auml: '\u00E4',
    aring: '\u00E5',
    aelig: '\u00E6',
    ccedil: '\u00E7',
    egrave: '\u00E8',
    eacute: '\u00E9',
    ecirc: '\u00EA',
    euml: '\u00EB',
    igrave: '\u00EC',
    iacute: '\u00ED',
    icirc: '\u00EE',
    iuml: '\u00EF',
    eth: '\u00F0',
    ntilde: '\u00F1',
    ograve: '\u00F2',
    oacute: '\u00F3',
    ocirc: '\u00F4',
    otilde: '\u00F5',
    ouml: '\u00F6',
    divide: '\u00F7',
    oslash: '\u00F8',
    ugrave: '\u00F9',
    uacute: '\u00FA',
    ucirc: '\u00FB',
    uuml: '\u00FC',
    yacute: '\u00FD',
    thorn: '\u00FE',
    yuml: '\u00FF',
    OElig: '\u0152',
    oelig: '\u0153',
    Scaron: '\u0160',
    scaron: '\u0161',
    Yuml: '\u0178',
    fnof: '\u0192',
    circ: '\u02C6',
    tilde: '\u02DC',
    Alpha: '\u0391',
    Beta: '\u0392',
    Gamma: '\u0393',
    Delta: '\u0394',
    Epsilon: '\u0395',
    Zeta: '\u0396',
    Eta: '\u0397',
    Theta: '\u0398',
    Iota: '\u0399',
    Kappa: '\u039A',
    Lambda: '\u039B',
    Mu: '\u039C',
    Nu: '\u039D',
    Xi: '\u039E',
    Omicron: '\u039F',
    Pi: '\u03A0',
    Rho: '\u03A1',
    Sigma: '\u03A3',
    Tau: '\u03A4',
    Upsilon: '\u03A5',
    Phi: '\u03A6',
    Chi: '\u03A7',
    Psi: '\u03A8',
    Omega: '\u03A9',
    alpha: '\u03B1',
    beta: '\u03B2',
    gamma: '\u03B3',
    delta: '\u03B4',
    epsilon: '\u03B5',
    zeta: '\u03B6',
    eta: '\u03B7',
    theta: '\u03B8',
    iota: '\u03B9',
    kappa: '\u03BA',
    lambda: '\u03BB',
    mu: '\u03BC',
    nu: '\u03BD',
    xi: '\u03BE',
    omicron: '\u03BF',
    pi: '\u03C0',
    rho: '\u03C1',
    sigmaf: '\u03C2',
    sigma: '\u03C3',
    tau: '\u03C4',
    upsilon: '\u03C5',
    phi: '\u03C6',
    chi: '\u03C7',
    psi: '\u03C8',
    omega: '\u03C9',
    thetasym: '\u03D1',
    upsih: '\u03D2',
    piv: '\u03D6',
    ensp: '\u2002',
    emsp: '\u2003',
    thinsp: '\u2009',
    zwnj: '\u200C',
    zwj: '\u200D',
    lrm: '\u200E',
    rlm: '\u200F',
    ndash: '\u2013',
    mdash: '\u2014',
    lsquo: '\u2018',
    rsquo: '\u2019',
    sbquo: '\u201A',
    ldquo: '\u201C',
    rdquo: '\u201D',
    bdquo: '\u201E',
    dagger: '\u2020',
    Dagger: '\u2021',
    bull: '\u2022',
    hellip: '\u2026',
    permil: '\u2030',
    prime: '\u2032',
    Prime: '\u2033',
    lsaquo: '\u2039',
    rsaquo: '\u203A',
    oline: '\u203E',
    frasl: '\u2044',
    euro: '\u20AC',
    image: '\u2111',
    weierp: '\u2118',
    real: '\u211C',
    trade: '\u2122',
    alefsym: '\u2135',
    larr: '\u2190',
    uarr: '\u2191',
    rarr: '\u2192',
    darr: '\u2193',
    harr: '\u2194',
    crarr: '\u21B5',
    lArr: '\u21D0',
    uArr: '\u21D1',
    rArr: '\u21D2',
    dArr: '\u21D3',
    hArr: '\u21D4',
    forall: '\u2200',
    part: '\u2202',
    exist: '\u2203',
    empty: '\u2205',
    nabla: '\u2207',
    isin: '\u2208',
    notin: '\u2209',
    ni: '\u220B',
    prod: '\u220F',
    sum: '\u2211',
    minus: '\u2212',
    lowast: '\u2217',
    radic: '\u221A',
    prop: '\u221D',
    infin: '\u221E',
    ang: '\u2220',
    and: '\u2227',
    or: '\u2228',
    cap: '\u2229',
    cup: '\u222A',
    'int': '\u222B',
    there4: '\u2234',
    sim: '\u223C',
    cong: '\u2245',
    asymp: '\u2248',
    ne: '\u2260',
    equiv: '\u2261',
    le: '\u2264',
    ge: '\u2265',
    sub: '\u2282',
    sup: '\u2283',
    nsub: '\u2284',
    sube: '\u2286',
    supe: '\u2287',
    oplus: '\u2295',
    otimes: '\u2297',
    perp: '\u22A5',
    sdot: '\u22C5',
    lceil: '\u2308',
    rceil: '\u2309',
    lfloor: '\u230A',
    rfloor: '\u230B',
    lang: '\u2329',
    rang: '\u232A',
    loz: '\u25CA',
    spades: '\u2660',
    clubs: '\u2663',
    hearts: '\u2665',
    diams: '\u2666'
  };

  var hexNumber = /^[\da-fA-F]+$/;
  var decimalNumber = /^\d+$/;

  pp.jsx_readEntity = function() {
    var str = '', count = 0, entity;
    var ch = this.input[this.pos];
    if (ch !== '&')
      this.raise(this.pos, 'Entity must start with an ampersand');
    var startPos = ++this.pos;
    while (this.pos < this.input.length && count++ < 10) {
      ch = this.input[this.pos++];
      if (ch === ';') {
        if (str[0] === '#') {
          if (str[1] === 'x') {
            str = str.substr(2);
            if (hexNumber.test(str))
              entity = String.fromCharCode(parseInt(str, 16));
          } else {
            str = str.substr(1);
            if (decimalNumber.test(str))
              entity = String.fromCharCode(parseInt(str, 10));
          }
        } else {
          entity = XHTMLEntities[str];
        }
        break;
      }
      str += ch;
    }
    if (!entity) {
      this.pos = startPos;
      return '&';
    }
    return entity;
  };


  // Read a JSX identifier (valid tag or attribute name).
  //
  // Optimized version since JSX identifiers can't contain
  // escape characters and so can be read as single slice.
  // Also assumes that first character was already checked
  // by isIdentifierStart in readToken.

  pp.jsx_readWord = function() {
    var ch, start = this.pos;
    do {
      ch = this.input.charCodeAt(++this.pos);
    } while (acorn.isIdentifierChar(ch) || ch === 45); // '-'
    return this.finishToken(tt.jsxName, this.input.slice(start, this.pos));
  };

  // Transforms JSX element name to string.

  function getQualifiedJSXName(object) {
    if (object.type === 'JSXIdentifier')
      return object.name;

    if (object.type === 'JSXNamespacedName')
      return object.namespace.name + ':' + object.name.name;

    if (object.type === 'JSXMemberExpression')
      return getQualifiedJSXName(object.object) + '.' +
      getQualifiedJSXName(object.property);
  }

  // Parse next token as JSX identifier

  pp.jsx_parseIdentifier = function() {
    var node = this.startNode();
    if (this.type === tt.jsxName)
      node.name = this.value;
    else if (this.type.keyword)
      node.name = this.type.keyword;
    else
      this.unexpected();
    this.next();
    return this.finishNode(node, 'JSXIdentifier');
  };

  // Parse namespaced identifier.

  pp.jsx_parseNamespacedName = function() {
    var start = this.markPosition();
    var name = this.jsx_parseIdentifier();
    if (!this.eat(tt.colon)) return name;
    var node = this.startNodeAt(start);
    node.namespace = name;
    node.name = this.jsx_parseIdentifier();
    return this.finishNode(node, 'JSXNamespacedName');
  };

  // Parses element name in any form - namespaced, member
  // or single identifier.

  pp.jsx_parseElementName = function() {
    var start = this.markPosition();
    var node = this.jsx_parseNamespacedName();
    while (this.eat(tt.dot)) {
      var newNode = this.startNodeAt(start);
      newNode.object = node;
      newNode.property = this.jsx_parseIdentifier();
      node = this.finishNode(newNode, 'JSXMemberExpression');
    }
    return node;
  };

  // Parses any type of JSX attribute value.

  pp.jsx_parseAttributeValue = function() {
    switch (this.type) {
    case tt.braceL:
      var node = this.jsx_parseExpressionContainer();
      if (node.expression.type === 'JSXEmptyExpression')
        this.raise(node.start, 'JSX attributes must only be assigned a non-empty expression');
      return node;

    case tt.jsxTagStart:
    case tt.string:
      return this.parseExprAtom();

    default:
      this.raise(this.start, 'JSX value should be either an expression or a quoted JSX text');
    }
  };

  // JSXEmptyExpression is unique type since it doesn't actually parse anything,
  // and so it should start at the end of last read token (left brace) and finish
  // at the beginning of the next one (right brace).

  pp.jsx_parseEmptyExpression = function() {
    var tmp = this.start;
    this.start = this.lastTokEnd;
    this.lastTokEnd = tmp;

    tmp = this.startLoc;
    this.startLoc = this.lastTokEndLoc;
    this.lastTokEndLoc = tmp;

    return this.finishNode(this.startNode(), 'JSXEmptyExpression');
  };

  // Parses JSX expression enclosed into curly brackets.


  pp.jsx_parseExpressionContainer = function() {
    var node = this.startNode();
    this.next();
    node.expression = this.type === tt.braceR
      ? this.jsx_parseEmptyExpression()
      : this.parseExpression();
    this.expect(tt.braceR);
    return this.finishNode(node, 'JSXExpressionContainer');
  };

  // Parses following JSX attribute name-value pair.

  pp.jsx_parseAttribute = function() {
    var node = this.startNode();
    if (this.eat(tt.braceL)) {
      this.expect(tt.ellipsis);
      node.argument = this.parseMaybeAssign();
      this.expect(tt.braceR);
      return this.finishNode(node, 'JSXSpreadAttribute');
    }
    node.name = this.jsx_parseNamespacedName();
    node.value = this.eat(tt.eq) ? this.jsx_parseAttributeValue() : null;
    return this.finishNode(node, 'JSXAttribute');
  };

  // Parses JSX opening tag starting after '<'.

  pp.jsx_parseOpeningElementAt = function(start) {
    var node = this.startNodeAt(start);
    node.attributes = [];
    node.name = this.jsx_parseElementName();
    while (this.type !== tt.slash && this.type !== tt.jsxTagEnd)
      node.attributes.push(this.jsx_parseAttribute());
    node.selfClosing = this.eat(tt.slash);
    this.expect(tt.jsxTagEnd);
    return this.finishNode(node, 'JSXOpeningElement');
  };

  // Parses JSX closing tag starting after '</'.

  pp.jsx_parseClosingElementAt = function(start) {
    var node = this.startNodeAt(start);
    node.name = this.jsx_parseElementName();
    this.expect(tt.jsxTagEnd);
    return this.finishNode(node, 'JSXClosingElement');
  };

  // Parses entire JSX element, including it's opening tag
  // (starting after '<'), attributes, contents and closing tag.

  pp.jsx_parseElementAt = function(start) {
    var node = this.startNodeAt(start);
    var children = [];
    var openingElement = this.jsx_parseOpeningElementAt(start);
    var closingElement = null;

    if (!openingElement.selfClosing) {
      contents: for (;;) {
        switch (this.type) {
        case tt.jsxTagStart:
          start = this.markPosition();
          this.next();
          if (this.eat(tt.slash)) {
            closingElement = this.jsx_parseClosingElementAt(start);
            break contents;
          }
          children.push(this.jsx_parseElementAt(start));
          break;

        case tt.jsxText:
          children.push(this.parseExprAtom());
          break;

        case tt.braceL:
          children.push(this.jsx_parseExpressionContainer());
          break;

        default:
          this.unexpected();
        }
      }
      if (getQualifiedJSXName(closingElement.name) !== getQualifiedJSXName(openingElement.name))
        this.raise(
          closingElement.start,
          'Expected corresponding JSX closing tag for <' + getQualifiedJSXName(openingElement.name) + '>');
    }

    node.openingElement = openingElement;
    node.closingElement = closingElement;
    node.children = children;
    return this.finishNode(node, 'JSXElement');
  };

  // Parses entire JSX element from current position.

  pp.jsx_parseElement = function() {
    var start = this.markPosition();
    this.next();
    return this.jsx_parseElementAt(start);
  };

  acorn.plugins.jsx = function(instance) {
    instance.extend('parseExprAtom', function(inner) {
      return function(refShortHandDefaultPos) {
        if (this.type === tt.jsxText)
          return this.parseLiteral(this.value);
        else if (this.type === tt.jsxTagStart)
          return this.jsx_parseElement();
        else
          return inner.call(this, refShortHandDefaultPos);
      };
    });

    instance.extend('readToken', function(inner) {
      return function(code) {
        var context = this.curContext();

        if (context === tc.j_expr) return this.jsx_readToken();

        if (context === tc.j_oTag || context === tc.j_cTag) {
          if (acorn.isIdentifierStart(code)) return this.jsx_readWord();

          if (code == 62) {
            ++this.pos;
            return this.finishToken(tt.jsxTagEnd);
          }

          if ((code === 34 || code === 39) && context == tc.j_oTag)
            return this.jsx_readString(code);
        }

        if (code === 60 && this.exprAllowed) {
          ++this.pos;
          return this.finishToken(tt.jsxTagStart);
        }
        return inner.call(this, code);
      };
    });

    instance.extend('updateContext', function(inner) {
      return function(prevType) {
        if (this.type == tt.braceL) {
          var curContext = this.curContext();
          if (curContext == tc.j_oTag) this.context.push(tc.b_expr);
          else if (curContext == tc.j_expr) this.context.push(tc.b_tmpl);
          else inner.call(this, prevType);
          this.exprAllowed = true;
        } else if (this.type === tt.slash && prevType === tt.jsxTagStart) {
          this.context.length -= 2; // do not consider JSX expr -> JSX open tag -> ... anymore
          this.context.push(tc.j_cTag); // reconsider as closing tag context
          this.exprAllowed = false;
        } else {
          return inner.call(this, prevType);
        }
      };
    });
  };

  return acorn;
};

},{}],3:[function(require,module,exports){
(function (global){
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.acorn = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){


// The main exported interface (under `self.acorn` when in the
// browser) is a `parse` function that takes a code string and
// returns an abstract syntax tree as specified by [Mozilla parser
// API][api].
//
// [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

"use strict";

exports.parse = parse;

// This function tries to parse a single expression at a given
// offset in a string. Useful for parsing mixed-language formats
// that embed JavaScript expressions.

exports.parseExpressionAt = parseExpressionAt;

// Acorn is organized as a tokenizer and a recursive-descent parser.
// The `tokenize` export provides an interface to the tokenizer.

exports.tokenizer = tokenizer;
exports.__esModule = true;
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

var _state = _dereq_("./state");

var Parser = _state.Parser;

var _options = _dereq_("./options");

var getOptions = _options.getOptions;

_dereq_("./parseutil");

_dereq_("./statement");

_dereq_("./lval");

_dereq_("./expression");

exports.Parser = _state.Parser;
exports.plugins = _state.plugins;
exports.defaultOptions = _options.defaultOptions;

var _location = _dereq_("./location");

exports.SourceLocation = _location.SourceLocation;
exports.getLineInfo = _location.getLineInfo;
exports.Node = _dereq_("./node").Node;

var _tokentype = _dereq_("./tokentype");

exports.TokenType = _tokentype.TokenType;
exports.tokTypes = _tokentype.types;

var _tokencontext = _dereq_("./tokencontext");

exports.TokContext = _tokencontext.TokContext;
exports.tokContexts = _tokencontext.types;

var _identifier = _dereq_("./identifier");

exports.isIdentifierChar = _identifier.isIdentifierChar;
exports.isIdentifierStart = _identifier.isIdentifierStart;
exports.Token = _dereq_("./tokenize").Token;

var _whitespace = _dereq_("./whitespace");

exports.isNewLine = _whitespace.isNewLine;
exports.lineBreak = _whitespace.lineBreak;
exports.lineBreakG = _whitespace.lineBreakG;
var version = "1.0.3";exports.version = version;

function parse(input, options) {
  var p = parser(options, input);
  var startPos = p.options.locations ? [p.pos, p.curPosition()] : p.pos;
  p.nextToken();
  return p.parseTopLevel(p.options.program || p.startNodeAt(startPos));
}

function parseExpressionAt(input, pos, options) {
  var p = parser(options, input, pos);
  p.nextToken();
  return p.parseExpression();
}

function tokenizer(input, options) {
  return parser(options, input);
}

function parser(options, input) {
  return new Parser(getOptions(options), String(input));
}

},{"./expression":2,"./identifier":3,"./location":4,"./lval":5,"./node":6,"./options":7,"./parseutil":8,"./state":9,"./statement":10,"./tokencontext":11,"./tokenize":12,"./tokentype":13,"./whitespace":15}],2:[function(_dereq_,module,exports){
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

var tt = _dereq_("./tokentype").types;

var Parser = _dereq_("./state").Parser;

var reservedWords = _dereq_("./identifier").reservedWords;

var has = _dereq_("./util").has;

var pp = Parser.prototype;

// Check if property name clashes with already added.
// Object/class getters and setters are not allowed to clash —
// either with each other or with an init property — and in
// strict mode, init properties are also not allowed to be repeated.

pp.checkPropClash = function (prop, propHash) {
  if (this.options.ecmaVersion >= 6) return;
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
  var kind = prop.kind || "init",
      other = undefined;
  if (has(propHash, name)) {
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
  var start = this.markPosition();
  var expr = this.parseMaybeAssign(noIn, refShorthandDefaultPos);
  if (this.type === tt.comma) {
    var node = this.startNodeAt(start);
    node.expressions = [expr];
    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn, refShorthandDefaultPos));
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};

// Parse an assignment expression. This includes applications of
// operators like `+=`.

pp.parseMaybeAssign = function (noIn, refShorthandDefaultPos) {
  if (this.type == tt._yield && this.inGenerator) return this.parseYield();

  var failOnShorthandAssign = undefined;
  if (!refShorthandDefaultPos) {
    refShorthandDefaultPos = { start: 0 };
    failOnShorthandAssign = true;
  } else {
    failOnShorthandAssign = false;
  }
  var start = this.markPosition();
  var left = this.parseMaybeConditional(noIn, refShorthandDefaultPos);
  if (this.type.isAssign) {
    var node = this.startNodeAt(start);
    node.operator = this.value;
    node.left = this.type === tt.eq ? this.toAssignable(left) : left;
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
  var start = this.markPosition();
  var expr = this.parseExprOps(noIn, refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  if (this.eat(tt.question)) {
    var node = this.startNodeAt(start);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    this.expect(tt.colon);
    node.alternate = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "ConditionalExpression");
  }
  return expr;
};

// Start the precedence parser.

pp.parseExprOps = function (noIn, refShorthandDefaultPos) {
  var start = this.markPosition();
  var expr = this.parseMaybeUnary(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  return this.parseExprOp(expr, start, -1, noIn);
};

// Parse binary operators with the operator precedence parsing
// algorithm. `left` is the left-hand side of the operator.
// `minPrec` provides context that allows the function to stop and
// defer further parser to one of its callers when it encounters an
// operator that has a lower precedence than the set it is parsing.

pp.parseExprOp = function (left, leftStart, minPrec, noIn) {
  var prec = this.type.binop;
  if (prec != null && (!noIn || this.type !== tt._in)) {
    if (prec > minPrec) {
      var node = this.startNodeAt(leftStart);
      node.left = left;
      node.operator = this.value;
      var op = this.type;
      this.next();
      var start = this.markPosition();
      node.right = this.parseExprOp(this.parseMaybeUnary(), start, prec, noIn);
      this.finishNode(node, op === tt.logicalOR || op === tt.logicalAND ? "LogicalExpression" : "BinaryExpression");
      return this.parseExprOp(node, leftStart, minPrec, noIn);
    }
  }
  return left;
};

// Parse unary operators, both prefix and postfix.

pp.parseMaybeUnary = function (refShorthandDefaultPos) {
  if (this.type.prefix) {
    var node = this.startNode(),
        update = this.type === tt.incDec;
    node.operator = this.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary();
    if (refShorthandDefaultPos && refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);
    if (update) this.checkLVal(node.argument);else if (this.strict && node.operator === "delete" && node.argument.type === "Identifier") this.raise(node.start, "Deleting local variable in strict mode");
    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  }
  var start = this.markPosition();
  var expr = this.parseExprSubscripts(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  while (this.type.postfix && !this.canInsertSemicolon()) {
    var node = this.startNodeAt(start);
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
  var start = this.markPosition();
  var expr = this.parseExprAtom(refShorthandDefaultPos);
  if (refShorthandDefaultPos && refShorthandDefaultPos.start) return expr;
  return this.parseSubscripts(expr, start);
};

pp.parseSubscripts = function (base, start, noCalls) {
  if (this.eat(tt.dot)) {
    var node = this.startNodeAt(start);
    node.object = base;
    node.property = this.parseIdent(true);
    node.computed = false;
    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
  } else if (this.eat(tt.bracketL)) {
    var node = this.startNodeAt(start);
    node.object = base;
    node.property = this.parseExpression();
    node.computed = true;
    this.expect(tt.bracketR);
    return this.parseSubscripts(this.finishNode(node, "MemberExpression"), start, noCalls);
  } else if (!noCalls && this.eat(tt.parenL)) {
    var node = this.startNodeAt(start);
    node.callee = base;
    node.arguments = this.parseExprList(tt.parenR, false);
    return this.parseSubscripts(this.finishNode(node, "CallExpression"), start, noCalls);
  } else if (this.type === tt.backQuote) {
    var node = this.startNodeAt(start);
    node.tag = base;
    node.quasi = this.parseTemplate();
    return this.parseSubscripts(this.finishNode(node, "TaggedTemplateExpression"), start, noCalls);
  }return base;
};

// Parse an atomic expression — either a single token that is an
// expression, an expression started by a keyword like `function` or
// `new`, or an expression wrapped in punctuation like `()`, `[]`,
// or `{}`.

pp.parseExprAtom = function (refShorthandDefaultPos) {
  var node = undefined;
  switch (this.type) {
    case tt._this:
    case tt._super:
      var type = this.type === tt._this ? "ThisExpression" : "Super";
      node = this.startNode();
      this.next();
      return this.finishNode(node, type);

    case tt._yield:
      if (this.inGenerator) this.unexpected();

    case tt.name:
      var start = this.markPosition();
      var id = this.parseIdent(this.type !== tt.name);
      if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
        return this.parseArrowExpression(this.startNodeAt(start), [id]);
      }
      return id;

    case tt.regexp:
      var value = this.value;
      node = this.parseLiteral(value.value);
      node.regex = { pattern: value.pattern, flags: value.flags };
      return node;

    case tt.num:case tt.string:
      return this.parseLiteral(this.value);

    case tt._null:case tt._true:case tt._false:
      node = this.startNode();
      node.value = this.type === tt._null ? null : this.type === tt._true;
      node.raw = this.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");

    case tt.parenL:
      return this.parseParenAndDistinguishExpression();

    case tt.bracketL:
      node = this.startNode();
      this.next();
      // check whether this is array comprehension or regular array
      if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
        return this.parseComprehension(node, false);
      }
      node.elements = this.parseExprList(tt.bracketR, true, true, refShorthandDefaultPos);
      return this.finishNode(node, "ArrayExpression");

    case tt.braceL:
      return this.parseObj(false, refShorthandDefaultPos);

    case tt._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, false);

    case tt._class:
      return this.parseClass(this.startNode(), false);

    case tt._new:
      return this.parseNew();

    case tt.backQuote:
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
  this.expect(tt.parenL);
  var val = this.parseExpression();
  this.expect(tt.parenR);
  return val;
};

pp.parseParenAndDistinguishExpression = function () {
  var start = this.markPosition(),
      val = undefined;
  if (this.options.ecmaVersion >= 6) {
    this.next();

    if (this.options.ecmaVersion >= 7 && this.type === tt._for) {
      return this.parseComprehension(this.startNodeAt(start), true);
    }

    var innerStart = this.markPosition(),
        exprList = [],
        first = true;
    var refShorthandDefaultPos = { start: 0 },
        spreadStart = undefined,
        innerParenStart = undefined;
    while (this.type !== tt.parenR) {
      first ? first = false : this.expect(tt.comma);
      if (this.type === tt.ellipsis) {
        spreadStart = this.start;
        exprList.push(this.parseRest());
        break;
      } else {
        if (this.type === tt.parenL && !innerParenStart) {
          innerParenStart = this.start;
        }
        exprList.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
      }
    }
    var innerEnd = this.markPosition();
    this.expect(tt.parenR);

    if (!this.canInsertSemicolon() && this.eat(tt.arrow)) {
      if (innerParenStart) this.unexpected(innerParenStart);
      return this.parseArrowExpression(this.startNodeAt(start), exprList);
    }

    if (!exprList.length) this.unexpected(this.lastTokStart);
    if (spreadStart) this.unexpected(spreadStart);
    if (refShorthandDefaultPos.start) this.unexpected(refShorthandDefaultPos.start);

    if (exprList.length > 1) {
      val = this.startNodeAt(innerStart);
      val.expressions = exprList;
      this.finishNodeAt(val, "SequenceExpression", innerEnd);
    } else {
      val = exprList[0];
    }
  } else {
    val = this.parseParenExpression();
  }

  if (this.options.preserveParens) {
    var par = this.startNodeAt(start);
    par.expression = val;
    return this.finishNode(par, "ParenthesizedExpression");
  } else {
    return val;
  }
};

// New's precedence is slightly tricky. It must allow its argument
// to be a `[]` or dot subscript expression, but not a call — at
// least, not without wrapping it in parentheses. Thus, it uses the

var empty = [];

pp.parseNew = function () {
  var node = this.startNode();
  var meta = this.parseIdent(true);
  if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
    node.meta = meta;
    node.property = this.parseIdent(true);
    if (node.property.name !== "target") this.raise(node.property.start, "The only valid meta property for new is new.target");
    return this.finishNode(node, "MetaProperty");
  }
  var start = this.markPosition();
  node.callee = this.parseSubscripts(this.parseExprAtom(), start, true);
  if (this.eat(tt.parenL)) node.arguments = this.parseExprList(tt.parenR, false);else node.arguments = empty;
  return this.finishNode(node, "NewExpression");
};

// Parse template expression.

pp.parseTemplateElement = function () {
  var elem = this.startNode();
  elem.value = {
    raw: this.input.slice(this.start, this.end),
    cooked: this.value
  };
  this.next();
  elem.tail = this.type === tt.backQuote;
  return this.finishNode(elem, "TemplateElement");
};

pp.parseTemplate = function () {
  var node = this.startNode();
  this.next();
  node.expressions = [];
  var curElt = this.parseTemplateElement();
  node.quasis = [curElt];
  while (!curElt.tail) {
    this.expect(tt.dollarBraceL);
    node.expressions.push(this.parseExpression());
    this.expect(tt.braceR);
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
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this.expect(tt.comma);
      if (this.afterTrailingComma(tt.braceR)) break;
    } else first = false;

    var prop = this.startNode(),
        isGenerator = undefined,
        start = undefined;
    if (this.options.ecmaVersion >= 6) {
      prop.method = false;
      prop.shorthand = false;
      if (isPattern || refShorthandDefaultPos) start = this.markPosition();
      if (!isPattern) isGenerator = this.eat(tt.star);
    }
    this.parsePropertyName(prop);
    if (this.eat(tt.colon)) {
      prop.value = isPattern ? this.parseMaybeDefault() : this.parseMaybeAssign(false, refShorthandDefaultPos);
      prop.kind = "init";
    } else if (this.options.ecmaVersion >= 6 && this.type === tt.parenL) {
      if (isPattern) this.unexpected();
      prop.kind = "init";
      prop.method = true;
      prop.value = this.parseMethod(isGenerator);
    } else if (this.options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" && (prop.key.name === "get" || prop.key.name === "set") && (this.type != tt.comma && this.type != tt.braceR)) {
      if (isGenerator || isPattern) this.unexpected();
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      prop.value = this.parseMethod(false);
    } else if (this.options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
      prop.kind = "init";
      if (isPattern) {
        if (this.isKeyword(prop.key.name) || this.strict && (reservedWords.strictBind(prop.key.name) || reservedWords.strict(prop.key.name)) || !this.options.allowReserved && this.isReservedWord(prop.key.name)) this.raise(prop.key.start, "Binding " + prop.key.name);
        prop.value = this.parseMaybeDefault(start, prop.key);
      } else if (this.type === tt.eq && refShorthandDefaultPos) {
        if (!refShorthandDefaultPos.start) refShorthandDefaultPos.start = this.start;
        prop.value = this.parseMaybeDefault(start, prop.key);
      } else {
        prop.value = prop.key;
      }
      prop.shorthand = true;
    } else this.unexpected();

    this.checkPropClash(prop, propHash);
    node.properties.push(this.finishNode(prop, "Property"));
  }
  return this.finishNode(node, isPattern ? "ObjectPattern" : "ObjectExpression");
};

pp.parsePropertyName = function (prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(tt.bracketL)) {
      prop.computed = true;
      prop.key = this.parseMaybeAssign();
      this.expect(tt.bracketR);
      return;
    } else {
      prop.computed = false;
    }
  }
  prop.key = this.type === tt.num || this.type === tt.string ? this.parseExprAtom() : this.parseIdent(true);
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
  this.expect(tt.parenL);
  node.params = this.parseBindingList(tt.parenR, false, false);
  var allowExpressionBody = undefined;
  if (this.options.ecmaVersion >= 6) {
    node.generator = isGenerator;
    allowExpressionBody = true;
  } else {
    allowExpressionBody = false;
  }
  this.parseFunctionBody(node, allowExpressionBody);
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
  var isExpression = allowExpression && this.type !== tt.braceL;

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
      this.expect(tt.comma);
      if (allowTrailingComma && this.afterTrailingComma(close)) break;
    } else first = false;

    if (allowEmpty && this.type === tt.comma) {
      elts.push(null);
    } else {
      if (this.type === tt.ellipsis) elts.push(this.parseSpread(refShorthandDefaultPos));else elts.push(this.parseMaybeAssign(false, refShorthandDefaultPos));
    }
  }
  return elts;
};

// Parse the next token as an identifier. If `liberal` is true (used
// when parsing properties), it will also convert keywords into
// identifiers.

pp.parseIdent = function (liberal) {
  var node = this.startNode();
  if (liberal && this.options.allowReserved == "never") liberal = false;
  if (this.type === tt.name) {
    if (!liberal && (!this.options.allowReserved && this.isReservedWord(this.value) || this.strict && reservedWords.strict(this.value) && (this.options.ecmaVersion >= 6 || this.input.slice(this.start, this.end).indexOf("\\") == -1))) this.raise(this.start, "The keyword '" + this.value + "' is reserved");
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
  if (this.type == tt.semi || this.canInsertSemicolon() || this.type != tt.star && !this.type.startsExpr) {
    node.delegate = false;
    node.argument = null;
  } else {
    node.delegate = this.eat(tt.star);
    node.argument = this.parseMaybeAssign();
  }
  return this.finishNode(node, "YieldExpression");
};

// Parses array and generator comprehensions.

pp.parseComprehension = function (node, isGenerator) {
  node.blocks = [];
  while (this.type === tt._for) {
    var block = this.startNode();
    this.next();
    this.expect(tt.parenL);
    block.left = this.parseBindingAtom();
    this.checkLVal(block.left, true);
    this.expectContextual("of");
    block.right = this.parseExpression();
    this.expect(tt.parenR);
    node.blocks.push(this.finishNode(block, "ComprehensionBlock"));
  }
  node.filter = this.eat(tt._if) ? this.parseParenExpression() : null;
  node.body = this.parseExpression();
  this.expect(isGenerator ? tt.parenR : tt.bracketR);
  node.generator = isGenerator;
  return this.finishNode(node, "ComprehensionExpression");
};

},{"./identifier":3,"./state":9,"./tokentype":13,"./util":14}],3:[function(_dereq_,module,exports){


// Test whether a given character code starts an identifier.

"use strict";

exports.isIdentifierStart = isIdentifierStart;

// Test whether a given character is part of an identifier.

exports.isIdentifierChar = isIdentifierChar;
exports.__esModule = true;
// This is a trick taken from Esprima. It turns out that, on
// non-Chrome browsers, to check whether a string is in a set, a
// predicate containing a big ugly `switch` statement is faster than
// a regular expression, and on Chrome the two are about on par.
// This function uses `eval` (non-lexical) to produce such a
// predicate from a space-separated string of words.
//
// It starts by sorting the words by length.

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
    if (arr.length == 1) {
      return f += "return str === " + JSON.stringify(arr[0]) + ";";
    }f += "switch(str){";
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
  var pos = 65536;
  for (var i = 0; i < set.length; i += 2) {
    pos += set[i];
    if (pos > code) {
      return false;
    }pos += set[i + 1];
    if (pos >= code) {
      return true;
    }
  }
}
function isIdentifierStart(code, astral) {
  if (code < 65) {
    return code === 36;
  }if (code < 91) {
    return true;
  }if (code < 97) {
    return code === 95;
  }if (code < 123) {
    return true;
  }if (code <= 65535) {
    return code >= 170 && nonASCIIidentifierStart.test(String.fromCharCode(code));
  }if (astral === false) {
    return false;
  }return isInAstralSet(code, astralIdentifierStartCodes);
}

function isIdentifierChar(code, astral) {
  if (code < 48) {
    return code === 36;
  }if (code < 58) {
    return true;
  }if (code < 65) {
    return false;
  }if (code < 91) {
    return true;
  }if (code < 97) {
    return code === 95;
  }if (code < 123) {
    return true;
  }if (code <= 65535) {
    return code >= 170 && nonASCIIidentifier.test(String.fromCharCode(code));
  }if (astral === false) {
    return false;
  }return isInAstralSet(code, astralIdentifierStartCodes) || isInAstralSet(code, astralIdentifierCodes);
}

},{}],4:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

// The `getLineInfo` function is mostly useful when the
// `locations` option is off (for performance reasons) and you
// want to find the line/column position for a given character
// offset. `input` should be the code string that the offset refers
// into.

exports.getLineInfo = getLineInfo;
exports.__esModule = true;

var Parser = _dereq_("./state").Parser;

var lineBreakG = _dereq_("./whitespace").lineBreakG;

// These are used when `options.locations` is on, for the
// `startLoc` and `endLoc` properties.

var Position = exports.Position = (function () {
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

var SourceLocation = exports.SourceLocation = function SourceLocation(p, start, end) {
  _classCallCheck(this, SourceLocation);

  this.start = start;
  this.end = end;
  if (p.sourceFile !== null) this.source = p.sourceFile;
};

function getLineInfo(input, offset) {
  for (var line = 1, cur = 0;;) {
    lineBreakG.lastIndex = cur;
    var match = lineBreakG.exec(input);
    if (match && match.index < offset) {
      ++line;
      cur = match.index + match[0].length;
    } else {
      return new Position(line, offset - cur);
    }
  }
}

var pp = Parser.prototype;

// This function is used to raise exceptions on parse errors. It
// takes an offset integer (into the current `input`) to indicate
// the location of the error, attaches the position to the end
// of the error message, and then raises a `SyntaxError` with that
// message.

pp.raise = function (pos, message) {
  var loc = getLineInfo(this.input, pos);
  message += " (" + loc.line + ":" + loc.column + ")";
  var err = new SyntaxError(message);
  err.pos = pos;err.loc = loc;err.raisedAt = this.pos;
  throw err;
};

pp.curPosition = function () {
  return new Position(this.curLine, this.pos - this.lineStart);
};

pp.markPosition = function () {
  return this.options.locations ? [this.start, this.startLoc] : this.start;
};

},{"./state":9,"./whitespace":15}],5:[function(_dereq_,module,exports){
"use strict";

var tt = _dereq_("./tokentype").types;

var Parser = _dereq_("./state").Parser;

var reservedWords = _dereq_("./identifier").reservedWords;

var has = _dereq_("./util").has;

var pp = Parser.prototype;

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
        } else {
          this.raise(node.left.end, "Only '=' operator can be used for specifying default value.");
        }
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
  node.argument = this.type === tt.name || this.type === tt.bracketL ? this.parseBindingAtom() : this.unexpected();
  return this.finishNode(node, "RestElement");
};

// Parses lvalue (assignable) atom.

pp.parseBindingAtom = function () {
  if (this.options.ecmaVersion < 6) return this.parseIdent();
  switch (this.type) {
    case tt.name:
      return this.parseIdent();

    case tt.bracketL:
      var node = this.startNode();
      this.next();
      node.elements = this.parseBindingList(tt.bracketR, true, true);
      return this.finishNode(node, "ArrayPattern");

    case tt.braceL:
      return this.parseObj(true);

    default:
      this.unexpected();
  }
};

pp.parseBindingList = function (close, allowEmpty, allowTrailingComma) {
  var elts = [],
      first = true;
  while (!this.eat(close)) {
    if (first) first = false;else this.expect(tt.comma);
    if (allowEmpty && this.type === tt.comma) {
      elts.push(null);
    } else if (allowTrailingComma && this.afterTrailingComma(close)) {
      break;
    } else if (this.type === tt.ellipsis) {
      elts.push(this.parseRest());
      this.expect(close);
      break;
    } else {
      elts.push(this.parseMaybeDefault());
    }
  }
  return elts;
};

// Parses assignment pattern around given atom if possible.

pp.parseMaybeDefault = function (startPos, left) {
  startPos = startPos || this.markPosition();
  left = left || this.parseBindingAtom();
  if (!this.eat(tt.eq)) return left;
  var node = this.startNodeAt(startPos);
  node.operator = "=";
  node.left = left;
  node.right = this.parseMaybeAssign();
  return this.finishNode(node, "AssignmentPattern");
};

// Verify that a node is an lval — something that can be assigned
// to.

pp.checkLVal = function (expr, isBinding, checkClashes) {
  switch (expr.type) {
    case "Identifier":
      if (this.strict && (reservedWords.strictBind(expr.name) || reservedWords.strict(expr.name))) this.raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
      if (checkClashes) {
        if (has(checkClashes, expr.name)) this.raise(expr.start, "Argument name clash in strict mode");
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

    default:
      this.raise(expr.start, (isBinding ? "Binding" : "Assigning to") + " rvalue");
  }
};

},{"./identifier":3,"./state":9,"./tokentype":13,"./util":14}],6:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;

var Parser = _dereq_("./state").Parser;

var SourceLocation = _dereq_("./location").SourceLocation;

// Start an AST node, attaching a start offset.

var pp = Parser.prototype;

var Node = exports.Node = function Node() {
  _classCallCheck(this, Node);
};

pp.startNode = function () {
  var node = new Node();
  node.start = this.start;
  if (this.options.locations) node.loc = new SourceLocation(this, this.startLoc);
  if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
  if (this.options.ranges) node.range = [this.start, 0];
  return node;
};

pp.startNodeAt = function (pos) {
  var node = new Node(),
      start = pos;
  if (this.options.locations) {
    node.loc = new SourceLocation(this, start[1]);
    start = pos[0];
  }
  node.start = start;
  if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
  if (this.options.ranges) node.range = [start, 0];
  return node;
};

// Finish an AST node, adding `type` and `end` properties.

pp.finishNode = function (node, type) {
  node.type = type;
  node.end = this.lastTokEnd;
  if (this.options.locations) node.loc.end = this.lastTokEndLoc;
  if (this.options.ranges) node.range[1] = this.lastTokEnd;
  return node;
};

// Finish node at given position

pp.finishNodeAt = function (node, type, pos) {
  if (this.options.locations) {
    node.loc.end = pos[1];pos = pos[0];
  }
  node.type = type;
  node.end = pos;
  if (this.options.ranges) node.range[1] = pos;
  return node;
};

},{"./location":4,"./state":9}],7:[function(_dereq_,module,exports){


// Interpret and default an options object

"use strict";

exports.getOptions = getOptions;
exports.__esModule = true;

var _util = _dereq_("./util");

var has = _util.has;
var isArray = _util.isArray;

var SourceLocation = _dereq_("./location").SourceLocation;

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
};exports.defaultOptions = defaultOptions;

function getOptions(opts) {
  var options = {};
  for (var opt in defaultOptions) {
    options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
  }if (isArray(options.onToken)) {
    (function () {
      var tokens = options.onToken;
      options.onToken = function (token) {
        return tokens.push(token);
      };
    })();
  }
  if (isArray(options.onComment)) options.onComment = pushComment(options, options.onComment);

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
    if (options.locations) comment.loc = new SourceLocation(this, startLoc, endLoc);
    if (options.ranges) comment.range = [start, end];
    array.push(comment);
  };
}

},{"./location":4,"./util":14}],8:[function(_dereq_,module,exports){
"use strict";

var tt = _dereq_("./tokentype").types;

var Parser = _dereq_("./state").Parser;

var lineBreak = _dereq_("./whitespace").lineBreak;

var pp = Parser.prototype;

// ## Parser utilities

// Test whether a statement node is the string literal `"use strict"`.

pp.isUseStrict = function (stmt) {
  return this.options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" && stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
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
  return this.type === tt.name && this.value === name;
};

// Consumes contextual keyword if possible.

pp.eatContextual = function (name) {
  return this.value === name && this.eat(tt.name);
};

// Asserts that following token is given contextual keyword.

pp.expectContextual = function (name) {
  if (!this.eatContextual(name)) this.unexpected();
};

// Test whether a semicolon can be inserted at the current position.

pp.canInsertSemicolon = function () {
  return this.type === tt.eof || this.type === tt.braceR || lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
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
  if (!this.eat(tt.semi) && !this.insertSemicolon()) this.unexpected();
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

},{"./state":9,"./tokentype":13,"./whitespace":15}],9:[function(_dereq_,module,exports){
"use strict";

exports.Parser = Parser;
exports.__esModule = true;

var _identifier = _dereq_("./identifier");

var reservedWords = _identifier.reservedWords;
var keywords = _identifier.keywords;

var _tokentype = _dereq_("./tokentype");

var tt = _tokentype.types;
var lineBreak = _tokentype.lineBreak;

function Parser(options, input, startPos) {
  this.options = options;
  this.loadPlugins(this.options.plugins);
  this.sourceFile = this.options.sourceFile || null;
  this.isKeyword = keywords[this.options.ecmaVersion >= 6 ? 6 : 5];
  this.isReservedWord = reservedWords[this.options.ecmaVersion];
  this.input = input;

  // Set up token state

  // The current position of the tokenizer in the input.
  if (startPos) {
    this.pos = startPos;
    this.lineStart = Math.max(0, this.input.lastIndexOf("\n", startPos));
    this.curLine = this.input.slice(0, this.lineStart).split(lineBreak).length;
  } else {
    this.pos = this.lineStart = 0;
    this.curLine = 1;
  }

  // Properties of the current token:
  // Its type
  this.type = tt.eof;
  // For tokens that include more information than their type, the value
  this.value = null;
  // Its start and end offset
  this.start = this.end = this.pos;
  // And, if locations are used, the {line, column} object
  // corresponding to those offsets
  this.startLoc = this.endLoc = null;

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

  // Flags to track whether we are in a function, a generator.
  this.inFunction = this.inGenerator = false;
  // Labels in scope.
  this.labels = [];

  // If enabled, skip leading hashbang line.
  if (this.pos === 0 && this.options.allowHashBang && this.input.slice(0, 2) === "#!") this.skipLineComment(2);
}

Parser.prototype.extend = function (name, f) {
  this[name] = f(this[name]);
};

// Registered plugins

var plugins = {};

exports.plugins = plugins;
Parser.prototype.loadPlugins = function (plugins) {
  for (var _name in plugins) {
    var plugin = exports.plugins[_name];
    if (!plugin) throw new Error("Plugin '" + _name + "' not found");
    plugin(this, plugins[_name]);
  }
};

},{"./identifier":3,"./tokentype":13}],10:[function(_dereq_,module,exports){
"use strict";

var tt = _dereq_("./tokentype").types;

var Parser = _dereq_("./state").Parser;

var lineBreak = _dereq_("./whitespace").lineBreak;

var pp = Parser.prototype;

// ### Statement parsing

// Parse a program. Initializes the parser, reads any number of
// statements, and wraps them in a Program node.  Optionally takes a
// `program` argument.  If present, the statements will be appended
// to its body instead of creating a new node.

pp.parseTopLevel = function (node) {
  var first = true;
  if (!node.body) node.body = [];
  while (this.type !== tt.eof) {
    var stmt = this.parseStatement(true, true);
    node.body.push(stmt);
    if (first && this.isUseStrict(stmt)) this.setStrict(true);
    first = false;
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
    case tt._break:case tt._continue:
      return this.parseBreakContinueStatement(node, starttype.keyword);
    case tt._debugger:
      return this.parseDebuggerStatement(node);
    case tt._do:
      return this.parseDoStatement(node);
    case tt._for:
      return this.parseForStatement(node);
    case tt._function:
      if (!declaration && this.options.ecmaVersion >= 6) this.unexpected();
      return this.parseFunctionStatement(node);
    case tt._class:
      if (!declaration) this.unexpected();
      return this.parseClass(node, true);
    case tt._if:
      return this.parseIfStatement(node);
    case tt._return:
      return this.parseReturnStatement(node);
    case tt._switch:
      return this.parseSwitchStatement(node);
    case tt._throw:
      return this.parseThrowStatement(node);
    case tt._try:
      return this.parseTryStatement(node);
    case tt._let:case tt._const:
      if (!declaration) this.unexpected(); // NOTE: falls through to _var
    case tt._var:
      return this.parseVarStatement(node, starttype);
    case tt._while:
      return this.parseWhileStatement(node);
    case tt._with:
      return this.parseWithStatement(node);
    case tt.braceL:
      return this.parseBlock();
    case tt.semi:
      return this.parseEmptyStatement(node);
    case tt._export:
    case tt._import:
      if (!this.options.allowImportExportEverywhere) {
        if (!topLevel) this.raise(this.start, "'import' and 'export' may only appear at the top level");
        if (!this.inModule) this.raise(this.start, "'import' and 'export' may appear only with 'sourceType: module'");
      }
      return starttype === tt._import ? this.parseImport(node) : this.parseExport(node);

    // If the statement does not start with a statement keyword or a
    // brace, it's an ExpressionStatement or LabeledStatement. We
    // simply start parsing an expression, and afterwards, if the
    // next token is a colon and the expression was a simple
    // Identifier node, we switch to interpreting it as a label.
    default:
      var maybeName = this.value,
          expr = this.parseExpression();
      if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) return this.parseLabeledStatement(node, maybeName, expr);else return this.parseExpressionStatement(node, expr);
  }
};

pp.parseBreakContinueStatement = function (node, keyword) {
  var isBreak = keyword == "break";
  this.next();
  if (this.eat(tt.semi) || this.insertSemicolon()) node.label = null;else if (this.type !== tt.name) this.unexpected();else {
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
  this.expect(tt._while);
  node.test = this.parseParenExpression();
  if (this.options.ecmaVersion >= 6) this.eat(tt.semi);else this.semicolon();
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
  this.expect(tt.parenL);
  if (this.type === tt.semi) return this.parseFor(node, null);
  if (this.type === tt._var || this.type === tt._let || this.type === tt._const) {
    var _init = this.startNode(),
        varKind = this.type;
    this.next();
    this.parseVar(_init, true, varKind);
    this.finishNode(_init, "VariableDeclaration");
    if ((this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) && _init.declarations.length === 1 && !(varKind !== tt._var && _init.declarations[0].init)) return this.parseForIn(node, _init);
    return this.parseFor(node, _init);
  }
  var refShorthandDefaultPos = { start: 0 };
  var init = this.parseExpression(true, refShorthandDefaultPos);
  if (this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of")) {
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
  node.alternate = this.eat(tt._else) ? this.parseStatement(false) : null;
  return this.finishNode(node, "IfStatement");
};

pp.parseReturnStatement = function (node) {
  if (!this.inFunction && !this.options.allowReturnOutsideFunction) this.raise(this.start, "'return' outside of function");
  this.next();

  // In `return` (and `break`/`continue`), the keywords with
  // optional arguments, we eagerly look for a semicolon or the
  // possibility to insert one.

  if (this.eat(tt.semi) || this.insertSemicolon()) node.argument = null;else {
    node.argument = this.parseExpression();this.semicolon();
  }
  return this.finishNode(node, "ReturnStatement");
};

pp.parseSwitchStatement = function (node) {
  this.next();
  node.discriminant = this.parseParenExpression();
  node.cases = [];
  this.expect(tt.braceL);
  this.labels.push(switchLabel);

  // Statements under must be grouped (by label) in SwitchCase
  // nodes. `cur` is used to keep the node that we are currently
  // adding statements to.

  for (var cur, sawDefault; this.type != tt.braceR;) {
    if (this.type === tt._case || this.type === tt._default) {
      var isCase = this.type === tt._case;
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
      this.expect(tt.colon);
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
  if (lineBreak.test(this.input.slice(this.lastTokEnd, this.start))) this.raise(this.lastTokEnd, "Illegal newline after throw");
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
  if (this.type === tt._catch) {
    var clause = this.startNode();
    this.next();
    this.expect(tt.parenL);
    clause.param = this.parseBindingAtom();
    this.checkLVal(clause.param, true);
    this.expect(tt.parenR);
    clause.guard = null;
    clause.body = this.parseBlock();
    node.handler = this.finishNode(clause, "CatchClause");
  }
  node.guardedHandlers = empty;
  node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
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
  }var kind = this.type.isLoop ? "loop" : this.type === tt._switch ? "switch" : null;
  this.labels.push({ name: maybeName, kind: kind });
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
  this.expect(tt.braceL);
  while (!this.eat(tt.braceR)) {
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
  this.expect(tt.semi);
  node.test = this.type === tt.semi ? null : this.parseExpression();
  this.expect(tt.semi);
  node.update = this.type === tt.parenR ? null : this.parseExpression();
  this.expect(tt.parenR);
  node.body = this.parseStatement(false);
  this.labels.pop();
  return this.finishNode(node, "ForStatement");
};

// Parse a `for`/`in` and `for`/`of` loop, which are almost
// same from parser's perspective.

pp.parseForIn = function (node, init) {
  var type = this.type === tt._in ? "ForInStatement" : "ForOfStatement";
  this.next();
  node.left = init;
  node.right = this.parseExpression();
  this.expect(tt.parenR);
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
    decl.id = this.parseBindingAtom();
    this.checkLVal(decl.id, true);
    if (this.eat(tt.eq)) {
      decl.init = this.parseMaybeAssign(isFor);
    } else if (kind === tt._const && !(this.type === tt._in || this.options.ecmaVersion >= 6 && this.isContextual("of"))) {
      this.unexpected();
    } else if (decl.id.type != "Identifier" && !(isFor && (this.type === tt._in || this.isContextual("of")))) {
      this.raise(this.lastTokEnd, "Complex binding patterns require an initialization value");
    } else {
      decl.init = null;
    }
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
    if (!this.eat(tt.comma)) break;
  }
  return node;
};

// Parse a function declaration or literal (depending on the
// `isStatement` parameter).

pp.parseFunction = function (node, isStatement, allowExpressionBody) {
  this.initFunction(node);
  if (this.options.ecmaVersion >= 6) node.generator = this.eat(tt.star);
  if (isStatement || this.type === tt.name) node.id = this.parseIdent();
  this.expect(tt.parenL);
  node.params = this.parseBindingList(tt.parenR, false, false);
  this.parseFunctionBody(node, allowExpressionBody);
  return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
};

// Parse a class declaration or literal (depending on the
// `isStatement` parameter).

pp.parseClass = function (node, isStatement) {
  this.next();
  node.id = this.type === tt.name ? this.parseIdent() : isStatement ? this.unexpected() : null;
  node.superClass = this.eat(tt._extends) ? this.parseExprSubscripts() : null;
  var classBody = this.startNode();
  classBody.body = [];
  this.expect(tt.braceL);
  while (!this.eat(tt.braceR)) {
    if (this.eat(tt.semi)) continue;
    var method = this.startNode();
    var isGenerator = this.eat(tt.star);
    this.parsePropertyName(method);
    if (this.type !== tt.parenL && !method.computed && method.key.type === "Identifier" && method.key.name === "static") {
      if (isGenerator) this.unexpected();
      method["static"] = true;
      isGenerator = this.eat(tt.star);
      this.parsePropertyName(method);
    } else {
      method["static"] = false;
    }
    method.kind = "method";
    if (!method.computed && !isGenerator) {
      if (method.key.type === "Identifier") {
        if (this.type !== tt.parenL && (method.key.name === "get" || method.key.name === "set")) {
          method.kind = method.key.name;
          this.parsePropertyName(method);
        } else if (!method["static"] && method.key.name === "constructor") {
          method.kind = "constructor";
        }
      } else if (!method["static"] && method.key.type === "Literal" && method.key.value === "constructor") {
        method.kind = "constructor";
      }
    }
    method.value = this.parseMethod(isGenerator);
    classBody.body.push(this.finishNode(method, "MethodDefinition"));
  }
  node.body = this.finishNode(classBody, "ClassBody");
  return this.finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
};

// Parses module export declaration.

pp.parseExport = function (node) {
  this.next();
  // export * from '...'
  if (this.eat(tt.star)) {
    this.expectContextual("from");
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
    this.semicolon();
    return this.finishNode(node, "ExportAllDeclaration");
  }
  if (this.eat(tt._default)) {
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
  if (this.type.keyword) {
    node.declaration = this.parseStatement(true);
    node.specifiers = [];
    node.source = null;
  } else {
    // export { x, y as z } [from '...']
    node.declaration = null;
    node.specifiers = this.parseExportSpecifiers();
    if (this.eatContextual("from")) {
      node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
    } else {
      node.source = null;
    }
    this.semicolon();
  }
  return this.finishNode(node, "ExportNamedDeclaration");
};

// Parses a comma-separated list of module exports.

pp.parseExportSpecifiers = function () {
  var nodes = [],
      first = true;
  // export { x, y as z } [from '...']
  this.expect(tt.braceL);
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this.expect(tt.comma);
      if (this.afterTrailingComma(tt.braceR)) break;
    } else first = false;

    var node = this.startNode();
    node.local = this.parseIdent(this.type === tt._default);
    node.exported = this.eatContextual("as") ? this.parseIdent(true) : node.local;
    nodes.push(this.finishNode(node, "ExportSpecifier"));
  }
  return nodes;
};

// Parses import declaration.

pp.parseImport = function (node) {
  this.next();
  // import '...'
  if (this.type === tt.string) {
    node.specifiers = empty;
    node.source = this.parseExprAtom();
    node.kind = "";
  } else {
    node.specifiers = this.parseImportSpecifiers();
    this.expectContextual("from");
    node.source = this.type === tt.string ? this.parseExprAtom() : this.unexpected();
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};

// Parses a comma-separated list of module imports.

pp.parseImportSpecifiers = function () {
  var nodes = [],
      first = true;
  if (this.type === tt.name) {
    // import defaultObj, { x, y as z } from '...'
    var node = this.startNode();
    node.local = this.parseIdent();
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportDefaultSpecifier"));
    if (!this.eat(tt.comma)) return nodes;
  }
  if (this.type === tt.star) {
    var node = this.startNode();
    this.next();
    this.expectContextual("as");
    node.local = this.parseIdent();
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportNamespaceSpecifier"));
    return nodes;
  }
  this.expect(tt.braceL);
  while (!this.eat(tt.braceR)) {
    if (!first) {
      this.expect(tt.comma);
      if (this.afterTrailingComma(tt.braceR)) break;
    } else first = false;

    var node = this.startNode();
    node.imported = this.parseIdent(true);
    node.local = this.eatContextual("as") ? this.parseIdent() : node.imported;
    this.checkLVal(node.local, true);
    nodes.push(this.finishNode(node, "ImportSpecifier"));
  }
  return nodes;
};

},{"./state":9,"./tokentype":13,"./whitespace":15}],11:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;
// The algorithm used to determine whether a regexp can appear at a
// given point in the program is loosely based on sweet.js' approach.
// See https://github.com/mozilla/sweet.js/wiki/design

var Parser = _dereq_("./state").Parser;

var tt = _dereq_("./tokentype").types;

var lineBreak = _dereq_("./whitespace").lineBreak;

var TokContext = exports.TokContext = function TokContext(token, isExpr, preserveSpace, override) {
  _classCallCheck(this, TokContext);

  this.token = token;
  this.isExpr = isExpr;
  this.preserveSpace = preserveSpace;
  this.override = override;
};

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
var pp = Parser.prototype;

pp.initialContext = function () {
  return [types.b_stat];
};

pp.braceIsBlock = function (prevType) {
  var parent = undefined;
  if (prevType === tt.colon && (parent = this.curContext()).token == "{") return !parent.isExpr;
  if (prevType === tt._return) return lineBreak.test(this.input.slice(this.lastTokEnd, this.start));
  if (prevType === tt._else || prevType === tt.semi || prevType === tt.eof) return true;
  if (prevType == tt.braceL) return this.curContext() === types.b_stat;
  return !this.exprAllowed;
};

pp.updateContext = function (prevType) {
  var update = undefined,
      type = this.type;
  if (type.keyword && prevType == tt.dot) this.exprAllowed = false;else if (update = type.updateContext) update.call(this, prevType);else this.exprAllowed = type.beforeExpr;
};

// Token-specific context update code

tt.parenR.updateContext = tt.braceR.updateContext = function () {
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

tt.braceL.updateContext = function (prevType) {
  this.context.push(this.braceIsBlock(prevType) ? types.b_stat : types.b_expr);
  this.exprAllowed = true;
};

tt.dollarBraceL.updateContext = function () {
  this.context.push(types.b_tmpl);
  this.exprAllowed = true;
};

tt.parenL.updateContext = function (prevType) {
  var statementParens = prevType === tt._if || prevType === tt._for || prevType === tt._with || prevType === tt._while;
  this.context.push(statementParens ? types.p_stat : types.p_expr);
  this.exprAllowed = true;
};

tt.incDec.updateContext = function () {};

tt._function.updateContext = function () {
  if (this.curContext() !== types.b_stat) this.context.push(types.f_expr);
  this.exprAllowed = false;
};

tt.backQuote.updateContext = function () {
  if (this.curContext() === types.q_tmpl) this.context.pop();else this.context.push(types.q_tmpl);
  this.exprAllowed = false;
};

// tokExprAllowed stays unchanged

},{"./state":9,"./tokentype":13,"./whitespace":15}],12:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;

var _identifier = _dereq_("./identifier");

var isIdentifierStart = _identifier.isIdentifierStart;
var isIdentifierChar = _identifier.isIdentifierChar;

var _tokentype = _dereq_("./tokentype");

var tt = _tokentype.types;
var keywordTypes = _tokentype.keywords;

var Parser = _dereq_("./state").Parser;

var SourceLocation = _dereq_("./location").SourceLocation;

var _whitespace = _dereq_("./whitespace");

var lineBreak = _whitespace.lineBreak;
var lineBreakG = _whitespace.lineBreakG;
var isNewLine = _whitespace.isNewLine;
var nonASCIIwhitespace = _whitespace.nonASCIIwhitespace;

// Object type used to represent tokens. Note that normally, tokens
// simply exist as properties on the parser object. This is only
// used for the onToken callback and the external tokenizer.

var Token = exports.Token = function Token(p) {
  _classCallCheck(this, Token);

  this.type = p.type;
  this.value = p.value;
  this.start = p.start;
  this.end = p.end;
  if (p.options.locations) this.loc = new SourceLocation(p, p.startLoc, p.endLoc);
  if (p.options.ranges) this.range = [p.start, p.end];
};

// ## Tokenizer

var pp = Parser.prototype;

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
        done: token.type === tt.eof,
        value: token
      };
    } };
};

// Toggle strict mode. Re-reads the next number or string to please
// pedantic tests (`"use strict"; 010;` should fail).

pp.setStrict = function (strict) {
  this.strict = strict;
  if (this.type !== tt.num && this.type !== tt.string) return;
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
  if (this.pos >= this.input.length) return this.finishToken(tt.eof);

  if (curContext.override) return curContext.override(this);else this.readToken(this.fullCharCodeAtPos());
};

pp.readToken = function (code) {
  // Identifier or keyword. '\uXXXX' sequences are allowed in
  // identifiers, so '\' also dispatches to that.
  if (isIdentifierStart(code, this.options.ecmaVersion >= 6) || code === 92 /* '\' */) return this.readWord();

  return this.getTokenFromCode(code);
};

pp.fullCharCodeAtPos = function () {
  var code = this.input.charCodeAt(this.pos);
  if (code <= 55295 || code >= 57344) return code;
  var next = this.input.charCodeAt(this.pos + 1);
  return (code << 10) + next - 56613888;
};

pp.skipBlockComment = function () {
  var startLoc = this.options.onComment && this.options.locations && this.curPosition();
  var start = this.pos,
      end = this.input.indexOf("*/", this.pos += 2);
  if (end === -1) this.raise(this.pos - 2, "Unterminated comment");
  this.pos = end + 2;
  if (this.options.locations) {
    lineBreakG.lastIndex = start;
    var match = undefined;
    while ((match = lineBreakG.exec(this.input)) && match.index < this.pos) {
      ++this.curLine;
      this.lineStart = match.index + match[0].length;
    }
  }
  if (this.options.onComment) this.options.onComment(true, this.input.slice(start + 2, end), start, this.pos, startLoc, this.options.locations && this.curPosition());
};

pp.skipLineComment = function (startSkip) {
  var start = this.pos;
  var startLoc = this.options.onComment && this.options.locations && this.curPosition();
  var ch = this.input.charCodeAt(this.pos += startSkip);
  while (this.pos < this.input.length && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
    ++this.pos;
    ch = this.input.charCodeAt(this.pos);
  }
  if (this.options.onComment) this.options.onComment(false, this.input.slice(start + startSkip, this.pos), start, this.pos, startLoc, this.options.locations && this.curPosition());
};

// Called at the start of the parse and after every token. Skips
// whitespace and comments, and.

pp.skipSpace = function () {
  while (this.pos < this.input.length) {
    var ch = this.input.charCodeAt(this.pos);
    if (ch === 32) {
      // ' '
      ++this.pos;
    } else if (ch === 13) {
      ++this.pos;
      var next = this.input.charCodeAt(this.pos);
      if (next === 10) {
        ++this.pos;
      }
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
    } else if (ch === 10 || ch === 8232 || ch === 8233) {
      ++this.pos;
      if (this.options.locations) {
        ++this.curLine;
        this.lineStart = this.pos;
      }
    } else if (ch > 8 && ch < 14) {
      ++this.pos;
    } else if (ch === 47) {
      // '/'
      var next = this.input.charCodeAt(this.pos + 1);
      if (next === 42) {
        // '*'
        this.skipBlockComment();
      } else if (next === 47) {
        // '/'
        this.skipLineComment(2);
      } else break;
    } else if (ch === 160) {
      // '\xa0'
      ++this.pos;
    } else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
      ++this.pos;
    } else {
      break;
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
    return this.finishToken(tt.ellipsis);
  } else {
    ++this.pos;
    return this.finishToken(tt.dot);
  }
};

pp.readToken_slash = function () {
  // '/'
  var next = this.input.charCodeAt(this.pos + 1);
  if (this.exprAllowed) {
    ++this.pos;return this.readRegexp();
  }
  if (next === 61) return this.finishOp(tt.assign, 2);
  return this.finishOp(tt.slash, 1);
};

pp.readToken_mult_modulo = function (code) {
  // '%*'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(tt.assign, 2);
  return this.finishOp(code === 42 ? tt.star : tt.modulo, 1);
};

pp.readToken_pipe_amp = function (code) {
  // '|&'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) return this.finishOp(code === 124 ? tt.logicalOR : tt.logicalAND, 2);
  if (next === 61) return this.finishOp(tt.assign, 2);
  return this.finishOp(code === 124 ? tt.bitwiseOR : tt.bitwiseAND, 1);
};

pp.readToken_caret = function () {
  // '^'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(tt.assign, 2);
  return this.finishOp(tt.bitwiseXOR, 1);
};

pp.readToken_plus_min = function (code) {
  // '+-'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === code) {
    if (next == 45 && this.input.charCodeAt(this.pos + 2) == 62 && lineBreak.test(this.input.slice(this.lastTokEnd, this.pos))) {
      // A `-->` line comment
      this.skipLineComment(3);
      this.skipSpace();
      return this.nextToken();
    }
    return this.finishOp(tt.incDec, 2);
  }
  if (next === 61) return this.finishOp(tt.assign, 2);
  return this.finishOp(tt.plusMin, 1);
};

pp.readToken_lt_gt = function (code) {
  // '<>'
  var next = this.input.charCodeAt(this.pos + 1);
  var size = 1;
  if (next === code) {
    size = code === 62 && this.input.charCodeAt(this.pos + 2) === 62 ? 3 : 2;
    if (this.input.charCodeAt(this.pos + size) === 61) return this.finishOp(tt.assign, size + 1);
    return this.finishOp(tt.bitShift, size);
  }
  if (next == 33 && code == 60 && this.input.charCodeAt(this.pos + 2) == 45 && this.input.charCodeAt(this.pos + 3) == 45) {
    if (this.inModule) unexpected();
    // `<!--`, an XML-style comment that should be interpreted as a line comment
    this.skipLineComment(4);
    this.skipSpace();
    return this.nextToken();
  }
  if (next === 61) size = this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2;
  return this.finishOp(tt.relational, size);
};

pp.readToken_eq_excl = function (code) {
  // '=!'
  var next = this.input.charCodeAt(this.pos + 1);
  if (next === 61) return this.finishOp(tt.equality, this.input.charCodeAt(this.pos + 2) === 61 ? 3 : 2);
  if (code === 61 && next === 62 && this.options.ecmaVersion >= 6) {
    // '=>'
    this.pos += 2;
    return this.finishToken(tt.arrow);
  }
  return this.finishOp(code === 61 ? tt.eq : tt.prefix, 1);
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
      ++this.pos;return this.finishToken(tt.parenL);
    case 41:
      ++this.pos;return this.finishToken(tt.parenR);
    case 59:
      ++this.pos;return this.finishToken(tt.semi);
    case 44:
      ++this.pos;return this.finishToken(tt.comma);
    case 91:
      ++this.pos;return this.finishToken(tt.bracketL);
    case 93:
      ++this.pos;return this.finishToken(tt.bracketR);
    case 123:
      ++this.pos;return this.finishToken(tt.braceL);
    case 125:
      ++this.pos;return this.finishToken(tt.braceR);
    case 58:
      ++this.pos;return this.finishToken(tt.colon);
    case 63:
      ++this.pos;return this.finishToken(tt.question);

    case 96:
      // '`'
      if (this.options.ecmaVersion < 6) break;
      ++this.pos;
      return this.finishToken(tt.backQuote);

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
      return this.finishOp(tt.prefix, 1);
  }

  this.raise(this.pos, "Unexpected character '" + codePointToString(code) + "'");
};

pp.finishOp = function (type, size) {
  var str = this.input.slice(this.pos, this.pos + size);
  this.pos += size;
  return this.finishToken(type, str);
};

var regexpUnicodeSupport = false;
try {
  new RegExp("￿", "u");regexpUnicodeSupport = true;
} catch (e) {}

// Parse a regular expression. Some context-awareness is necessary,
// since a '/' inside a '[]' set does not end the expression.

pp.readRegexp = function () {
  var escaped = undefined,
      inClass = undefined,
      start = this.pos;
  for (;;) {
    if (this.pos >= this.input.length) this.raise(start, "Unterminated regular expression");
    var ch = this.input.charAt(this.pos);
    if (lineBreak.test(ch)) this.raise(start, "Unterminated regular expression");
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
      tmp = tmp.replace(/\\u([a-fA-F0-9]{4})|\\u\{([0-9a-fA-F]+)\}|[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
    }
  }
  // Detect invalid regular expressions.
  try {
    new RegExp(tmp);
  } catch (e) {
    if (e instanceof SyntaxError) this.raise(start, "Error parsing regular expression: " + e.message);
    this.raise(e);
  }
  // Get a regular expression object for this pattern-flag pair, or `null` in
  // case the current environment doesn't support the flags it uses.
  var value = undefined;
  try {
    value = new RegExp(content, mods);
  } catch (err) {
    value = null;
  }
  return this.finishToken(tt.regexp, { pattern: content, flags: mods, value: value });
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
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");
  return this.finishToken(tt.num, val);
};

// Read an integer, octal integer, or floating-point number.

pp.readNumber = function (startsWithDot) {
  var start = this.pos,
      isFloat = false,
      octal = this.input.charCodeAt(this.pos) === 48;
  if (!startsWithDot && this.readInt(10) === null) this.raise(start, "Invalid number");
  if (this.input.charCodeAt(this.pos) === 46) {
    ++this.pos;
    this.readInt(10);
    isFloat = true;
  }
  var next = this.input.charCodeAt(this.pos);
  if (next === 69 || next === 101) {
    // 'eE'
    next = this.input.charCodeAt(++this.pos);
    if (next === 43 || next === 45) ++this.pos; // '+-'
    if (this.readInt(10) === null) this.raise(start, "Invalid number");
    isFloat = true;
  }
  if (isIdentifierStart(this.fullCharCodeAtPos())) this.raise(this.pos, "Identifier directly after number");

  var str = this.input.slice(start, this.pos),
      val = undefined;
  if (isFloat) val = parseFloat(str);else if (!octal || str.length === 1) val = parseInt(str, 10);else if (/[89]/.test(str) || this.strict) this.raise(start, "Invalid number");else val = parseInt(str, 8);
  return this.finishToken(tt.num, val);
};

// Read a string value, interpreting backslash-escapes.

pp.readCodePoint = function () {
  var ch = this.input.charCodeAt(this.pos),
      code = undefined;

  if (ch === 123) {
    if (this.options.ecmaVersion < 6) this.unexpected();
    ++this.pos;
    code = this.readHexChar(this.input.indexOf("}", this.pos) - this.pos);
    ++this.pos;
    if (code > 1114111) this.unexpected();
  } else {
    code = this.readHexChar(4);
  }
  return code;
};

function codePointToString(code) {
  // UTF-16 Decoding
  if (code <= 65535) {
    return String.fromCharCode(code);
  }return String.fromCharCode((code - 65536 >> 10) + 55296, (code - 65536 & 1023) + 56320);
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
      out += this.readEscapedChar();
      chunkStart = this.pos;
    } else {
      if (isNewLine(ch)) this.raise(this.start, "Unterminated string constant");
      ++this.pos;
    }
  }
  out += this.input.slice(chunkStart, this.pos++);
  return this.finishToken(tt.string, out);
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
      if (this.pos === this.start && this.type === tt.template) {
        if (ch === 36) {
          this.pos += 2;
          return this.finishToken(tt.dollarBraceL);
        } else {
          ++this.pos;
          return this.finishToken(tt.backQuote);
        }
      }
      out += this.input.slice(chunkStart, this.pos);
      return this.finishToken(tt.template, out);
    }
    if (ch === 92) {
      // '\'
      out += this.input.slice(chunkStart, this.pos);
      out += this.readEscapedChar();
      chunkStart = this.pos;
    } else if (isNewLine(ch)) {
      out += this.input.slice(chunkStart, this.pos);
      ++this.pos;
      if (ch === 13 && this.input.charCodeAt(this.pos) === 10) {
        ++this.pos;
        out += "\n";
      } else {
        out += String.fromCharCode(ch);
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

pp.readEscapedChar = function () {
  var ch = this.input.charCodeAt(++this.pos);
  var octal = /^[0-7]+/.exec(this.input.slice(this.pos, this.pos + 3));
  if (octal) octal = octal[0];
  while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, -1);
  if (octal === "0") octal = null;
  ++this.pos;
  if (octal) {
    if (this.strict) this.raise(this.pos - 2, "Octal literal in strict mode");
    this.pos += octal.length - 1;
    return String.fromCharCode(parseInt(octal, 8));
  } else {
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
      case 48:
        return "\u0000"; // 0 -> '\0'
      case 13:
        if (this.input.charCodeAt(this.pos) === 10) ++this.pos; // '\r\n'
      case 10:
        // ' \n'
        if (this.options.locations) {
          this.lineStart = this.pos;++this.curLine;
        }
        return "";
      default:
        return String.fromCharCode(ch);
    }
  }
};

// Used to read character escape sequences ('\x', '\u', '\U').

pp.readHexChar = function (len) {
  var n = this.readInt(16, len);
  if (n === null) this.raise(this.start, "Bad character escape sequence");
  return n;
};

// Used to signal to callers of `readWord1` whether the word
// contained any escape sequences. This is needed because words with
// escape sequences must not be interpreted as keywords.

var containsEsc;

// Read an identifier, and return it as a string. Sets `containsEsc`
// to whether the word contained a '\u' escape.
//
// Incrementally adds only escaped chars, adding other chunks as-is
// as a micro-optimization.

pp.readWord1 = function () {
  containsEsc = false;
  var word = "",
      first = true,
      chunkStart = this.pos;
  var astral = this.options.ecmaVersion >= 6;
  while (this.pos < this.input.length) {
    var ch = this.fullCharCodeAtPos();
    if (isIdentifierChar(ch, astral)) {
      this.pos += ch <= 65535 ? 1 : 2;
    } else if (ch === 92) {
      // "\"
      containsEsc = true;
      word += this.input.slice(chunkStart, this.pos);
      var escStart = this.pos;
      if (this.input.charCodeAt(++this.pos) != 117) // "u"
        this.raise(this.pos, "Expecting Unicode escape sequence \\uXXXX");
      ++this.pos;
      var esc = this.readCodePoint();
      if (!(first ? isIdentifierStart : isIdentifierChar)(esc, astral)) this.raise(escStart, "Invalid Unicode escape");
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
  var type = tt.name;
  if ((this.options.ecmaVersion >= 6 || !containsEsc) && this.isKeyword(word)) type = keywordTypes[word];
  return this.finishToken(type, word);
};

},{"./identifier":3,"./location":4,"./state":9,"./tokentype":13,"./whitespace":15}],13:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

exports.__esModule = true;
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

var TokenType = exports.TokenType = function TokenType(label) {
  var conf = arguments[1] === undefined ? {} : arguments[1];

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
  var options = arguments[1] === undefined ? {} : arguments[1];

  options.keyword = name;
  keywords[name] = types["_" + name] = new TokenType(name, options);
}

kw("break");
kw("case", beforeExpr);
kw("catch");
kw("continue");
kw("debugger");
kw("default");
kw("do", { isLoop: true });
kw("else", beforeExpr);
kw("finally");
kw("for", { isLoop: true });
kw("function");
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

},{}],14:[function(_dereq_,module,exports){
"use strict";

exports.isArray = isArray;

// Checks if an object has a property.

exports.has = has;
exports.__esModule = true;

function isArray(obj) {
  return Object.prototype.toString.call(obj) === "[object Array]";
}

function has(obj, propName) {
  return Object.prototype.hasOwnProperty.call(obj, propName);
}

},{}],15:[function(_dereq_,module,exports){
"use strict";

exports.isNewLine = isNewLine;
exports.__esModule = true;
// Matches a whole line break (where CRLF is considered a single
// line break). Used to count lines.

var lineBreak = /\r\n?|\n|\u2028|\u2029/;
exports.lineBreak = lineBreak;
var lineBreakG = new RegExp(lineBreak.source, "g");

exports.lineBreakG = lineBreakG;

function isNewLine(code) {
  return code === 10 || code === 13 || code === 8232 || code == 8233;
}

var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
exports.nonASCIIwhitespace = nonASCIIwhitespace;

},{}]},{},[1])(1)
});
}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"acorn-jsx":[function(require,module,exports){
'use strict';

module.exports = require('./inject')(require('acorn'));

},{"./inject":2,"acorn":3}]},{},[1])("acorn-jsx")
});;
(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}(g.acorn || (g.acorn = {})).walk = f()}})(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
"use strict";

var _classCallCheck = function (instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } };

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

exports.simple = simple;

// An ancestor walk builds up an array of ancestor nodes (including
// the current node) and passes them to the callback as the state parameter.
exports.ancestor = ancestor;

// A recursive walk is one where your functions override the default
// walkers. They can modify and replace the state parameter that's
// threaded through the walk, and can opt how and whether to walk
// their child nodes (by calling their third argument on these
// nodes).
exports.recursive = recursive;

// Find a node with a given start, end, and type (all are optional,
// null can be used as wildcard). Returns a {node, state} object, or
// undefined when it doesn't find a matching node.
exports.findNodeAt = findNodeAt;

// Find the innermost node of a given type that contains the given
// position. Interface similar to findNodeAt.
exports.findNodeAround = findNodeAround;

// Find the outermost matching node after a given position.
exports.findNodeAfter = findNodeAfter;

// Find the outermost matching node before a given position.
exports.findNodeBefore = findNodeBefore;

// Used to create a custom walker. Will fill in all missing node
// type properties with the defaults.
exports.make = make;
exports.__esModule = true;

function simple(node, visitors, base, state) {
  if (!base) base = exports.base;(function c(node, st, override) {
    var type = override || node.type,
        found = visitors[type];
    base[type](node, st, c);
    if (found) found(node, st);
  })(node, state);
}

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

function recursive(node, state, funcs, base) {
  var visitor = funcs ? exports.make(funcs, base) : base;(function c(node, st, override) {
    visitor[override || node.type](node, st, c);
  })(node, state);
}

function makeTest(test) {
  if (typeof test == "string") {
    return function (type) {
      return type == test;
    };
  } else if (!test) {
    return function () {
      return true;
    };
  } else {
    return test;
  }
}

var Found = function Found(node, state) {
  _classCallCheck(this, Found);

  this.node = node;this.state = state;
};

function findNodeAt(node, start, end, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      var type = override || node.type;
      if ((start == null || node.start <= start) && (end == null || node.end >= end)) base[type](node, st, c);
      if (test(type, node) && (start == null || node.start == start) && (end == null || node.end == end)) throw new Found(node, st);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) {
      return e;
    }throw e;
  }
}

function findNodeAround(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      var type = override || node.type;
      if (node.start > pos || node.end < pos) {
        return;
      }base[type](node, st, c);
      if (test(type, node)) throw new Found(node, st);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) {
      return e;
    }throw e;
  }
}

function findNodeAfter(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  try {
    ;(function c(node, st, override) {
      if (node.end < pos) {
        return;
      }var type = override || node.type;
      if (node.start >= pos && test(type, node)) throw new Found(node, st);
      base[type](node, st, c);
    })(node, state);
  } catch (e) {
    if (e instanceof Found) {
      return e;
    }throw e;
  }
}

function findNodeBefore(node, pos, test, base, state) {
  test = makeTest(test);
  if (!base) base = exports.base;
  var max = undefined;(function c(node, st, override) {
    if (node.start > pos) {
      return;
    }var type = override || node.type;
    if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node)) max = new Found(node, st);
    base[type](node, st, c);
  })(node, state);
  return max;
}

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
base.ThrowStatement = base.SpreadElement = base.RestElement = function (node, st, c) {
  return c(node.argument, st, "Expression");
};
base.TryStatement = function (node, st, c) {
  c(node.block, st, "Statement");
  if (node.handler) c(node.handler.body, st, "ScopeBody");
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
    var decl = node.declarations[i];
    if (decl.init) c(decl.init, st, "Expression");
  }
};

base.Function = function (node, st, c) {
  return c(node.body, st, "ScopeBody");
};
base.ScopeBody = function (node, st, c) {
  return c(node, st, "Statement");
};

base.Expression = skipThrough;
base.ThisExpression = base.Super = base.MetaProperty = ignore;
base.ArrayExpression = base.ArrayPattern = function (node, st, c) {
  for (var i = 0; i < node.elements.length; ++i) {
    var elt = node.elements[i];
    if (elt) c(elt, st, "Expression");
  }
};
base.ObjectExpression = base.ObjectPattern = function (node, st, c) {
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
base.BinaryExpression = base.AssignmentExpression = base.AssignmentPattern = base.LogicalExpression = function (node, st, c) {
  c(node.left, st, "Expression");
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
  return c(node.declaration, st);
};
base.ImportDeclaration = function (node, st, c) {
  for (var i = 0; i < node.specifiers.length; i++) {
    c(node.specifiers[i], st);
  }
};
base.ImportSpecifier = base.ImportDefaultSpecifier = base.ImportNamespaceSpecifier = base.Identifier = base.Literal = ignore;

base.TaggedTemplateExpression = function (node, st, c) {
  c(node.tag, st, "Expression");
  c(node.quasi, st);
};
base.ClassDeclaration = base.ClassExpression = function (node, st, c) {
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

var _interopRequireWildcard = function (obj) { return obj && obj.__esModule ? obj : { "default": obj }; };

exports.parse_dammit = parse_dammit;
exports.__esModule = true;
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

var acorn = _interopRequireWildcard(_dereq_(".."));

var _state = _dereq_("./state");

var LooseParser = _state.LooseParser;

_dereq_("./tokenize");

_dereq_("./parseutil");

_dereq_("./statement");

_dereq_("./expression");

exports.LooseParser = _state.LooseParser;

acorn.defaultOptions.tabSize = 4;

function parse_dammit(input, options) {
  var p = new LooseParser(input, options);
  p.next();
  return p.parseTopLevel();
}

acorn.parse_dammit = parse_dammit;
acorn.LooseParser = LooseParser;

},{"..":2,"./expression":3,"./parseutil":4,"./state":5,"./statement":6,"./tokenize":7}],2:[function(_dereq_,module,exports){
"use strict";

module.exports = typeof acorn != "undefined" ? acorn : _dereq_("./acorn");

},{}],3:[function(_dereq_,module,exports){
"use strict";

var LooseParser = _dereq_("./state").LooseParser;

var isDummy = _dereq_("./parseutil").isDummy;

var tt = _dereq_("..").tokTypes;

var lp = LooseParser.prototype;

lp.checkLVal = function (expr, binding) {
  if (!expr) return expr;
  switch (expr.type) {
    case "Identifier":
      return expr;

    case "MemberExpression":
      return binding ? this.dummyIdent() : expr;

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
  if (this.tok.type === tt.comma) {
    var node = this.startNodeAt(start);
    node.expressions = [expr];
    while (this.eat(tt.comma)) node.expressions.push(this.parseMaybeAssign(noIn));
    return this.finishNode(node, "SequenceExpression");
  }
  return expr;
};

lp.parseParenExpression = function () {
  this.pushCx();
  this.expect(tt.parenL);
  var val = this.parseExpression();
  this.popCx();
  this.expect(tt.parenR);
  return val;
};

lp.parseMaybeAssign = function (noIn) {
  var start = this.storeCurrentPos();
  var left = this.parseMaybeConditional(noIn);
  if (this.tok.type.isAssign) {
    var node = this.startNodeAt(start);
    node.operator = this.tok.value;
    node.left = this.tok.type === tt.eq ? this.toAssignable(left) : this.checkLVal(left);
    this.next();
    node.right = this.parseMaybeAssign(noIn);
    return this.finishNode(node, "AssignmentExpression");
  }
  return left;
};

lp.parseMaybeConditional = function (noIn) {
  var start = this.storeCurrentPos();
  var expr = this.parseExprOps(noIn);
  if (this.eat(tt.question)) {
    var node = this.startNodeAt(start);
    node.test = expr;
    node.consequent = this.parseMaybeAssign();
    node.alternate = this.expect(tt.colon) ? this.parseMaybeAssign(noIn) : this.dummyIdent();
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
  if (prec != null && (!noIn || this.tok.type !== tt._in)) {
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
        update = this.tok.type === tt.incDec;
    node.operator = this.tok.value;
    node.prefix = true;
    this.next();
    node.argument = this.parseMaybeUnary(noIn);
    if (update) node.argument = this.checkLVal(node.argument);
    return this.finishNode(node, update ? "UpdateExpression" : "UnaryExpression");
  } else if (this.tok.type === tt.ellipsis) {
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
      if (this.tok.type == tt.dot && this.curIndent == startIndent) --startIndent;else return base;
    }

    if (this.eat(tt.dot)) {
      var node = this.startNodeAt(start);
      node.object = base;
      if (this.curLineStart != line && this.curIndent <= startIndent && this.tokenStartsLine()) node.property = this.dummyIdent();else node.property = this.parsePropertyAccessor() || this.dummyIdent();
      node.computed = false;
      base = this.finishNode(node, "MemberExpression");
    } else if (this.tok.type == tt.bracketL) {
      this.pushCx();
      this.next();
      var node = this.startNodeAt(start);
      node.object = base;
      node.property = this.parseExpression();
      node.computed = true;
      this.popCx();
      this.expect(tt.bracketR);
      base = this.finishNode(node, "MemberExpression");
    } else if (!noCalls && this.tok.type == tt.parenL) {
      var node = this.startNodeAt(start);
      node.callee = base;
      node.arguments = this.parseExprList(tt.parenR);
      base = this.finishNode(node, "CallExpression");
    } else if (this.tok.type == tt.backQuote) {
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
    case tt._this:
    case tt._super:
      var type = this.tok.type === tt._this ? "ThisExpression" : "Super";
      node = this.startNode();
      this.next();
      return this.finishNode(node, type);

    case tt.name:
      var start = this.storeCurrentPos();
      var id = this.parseIdent();
      return this.eat(tt.arrow) ? this.parseArrowExpression(this.startNodeAt(start), [id]) : id;

    case tt.regexp:
      node = this.startNode();
      var val = this.tok.value;
      node.regex = { pattern: val.pattern, flags: val.flags };
      node.value = val.value;
      node.raw = this.input.slice(this.tok.start, this.tok.end);
      this.next();
      return this.finishNode(node, "Literal");

    case tt.num:case tt.string:
      node = this.startNode();
      node.value = this.tok.value;
      node.raw = this.input.slice(this.tok.start, this.tok.end);
      this.next();
      return this.finishNode(node, "Literal");

    case tt._null:case tt._true:case tt._false:
      node = this.startNode();
      node.value = this.tok.type === tt._null ? null : this.tok.type === tt._true;
      node.raw = this.tok.type.keyword;
      this.next();
      return this.finishNode(node, "Literal");

    case tt.parenL:
      var parenStart = this.storeCurrentPos();
      this.next();
      var inner = this.parseExpression();
      this.expect(tt.parenR);
      if (this.eat(tt.arrow)) {
        return this.parseArrowExpression(this.startNodeAt(parenStart), inner.expressions || (isDummy(inner) ? [] : [inner]));
      }
      if (this.options.preserveParens) {
        var par = this.startNodeAt(parenStart);
        par.expression = inner;
        inner = this.finishNode(par, "ParenthesizedExpression");
      }
      return inner;

    case tt.bracketL:
      node = this.startNode();
      node.elements = this.parseExprList(tt.bracketR, true);
      return this.finishNode(node, "ArrayExpression");

    case tt.braceL:
      return this.parseObj();

    case tt._class:
      return this.parseClass();

    case tt._function:
      node = this.startNode();
      this.next();
      return this.parseFunction(node, false);

    case tt._new:
      return this.parseNew();

    case tt._yield:
      node = this.startNode();
      this.next();
      if (this.semicolon() || this.canInsertSemicolon() || this.tok.type != tt.star && !this.tok.type.startsExpr) {
        node.delegate = false;
        node.argument = null;
      } else {
        node.delegate = this.eat(tt.star);
        node.argument = this.parseMaybeAssign();
      }
      return this.finishNode(node, "YieldExpression");

    case tt.backQuote:
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
  if (this.options.ecmaVersion >= 6 && this.eat(tt.dot)) {
    node.meta = meta;
    node.property = this.parseIdent(true);
    return this.finishNode(node, "MetaProperty");
  }
  var start = this.storeCurrentPos();
  node.callee = this.parseSubscripts(this.parseExprAtom(), start, true, startIndent, line);
  if (this.tok.type == tt.parenL) {
    node.arguments = this.parseExprList(tt.parenR);
  } else {
    node.arguments = [];
  }
  return this.finishNode(node, "NewExpression");
};

lp.parseTemplateElement = function () {
  var elem = this.startNode();
  elem.value = {
    raw: this.input.slice(this.tok.start, this.tok.end),
    cooked: this.tok.value
  };
  this.next();
  elem.tail = this.tok.type === tt.backQuote;
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
    if (this.expect(tt.braceR)) {
      curElt = this.parseTemplateElement();
    } else {
      curElt = this.startNode();
      curElt.value = { cooked: "", raw: "" };
      curElt.tail = true;
    }
    node.quasis.push(curElt);
  }
  this.expect(tt.backQuote);
  return this.finishNode(node, "TemplateLiteral");
};

lp.parseObj = function () {
  var node = this.startNode();
  node.properties = [];
  this.pushCx();
  var indent = this.curIndent + 1,
      line = this.curLineStart;
  this.eat(tt.braceL);
  if (this.curIndent + 1 < indent) {
    indent = this.curIndent;line = this.curLineStart;
  }
  while (!this.closes(tt.braceR, indent, line)) {
    var prop = this.startNode(),
        isGenerator = undefined,
        start = undefined;
    if (this.options.ecmaVersion >= 6) {
      start = this.storeCurrentPos();
      prop.method = false;
      prop.shorthand = false;
      isGenerator = this.eat(tt.star);
    }
    this.parsePropertyName(prop);
    if (isDummy(prop.key)) {
      if (isDummy(this.parseMaybeAssign())) this.next();this.eat(tt.comma);continue;
    }
    if (this.eat(tt.colon)) {
      prop.kind = "init";
      prop.value = this.parseMaybeAssign();
    } else if (this.options.ecmaVersion >= 6 && (this.tok.type === tt.parenL || this.tok.type === tt.braceL)) {
      prop.kind = "init";
      prop.method = true;
      prop.value = this.parseMethod(isGenerator);
    } else if (this.options.ecmaVersion >= 5 && prop.key.type === "Identifier" && !prop.computed && (prop.key.name === "get" || prop.key.name === "set") && (this.tok.type != tt.comma && this.tok.type != tt.braceR)) {
      prop.kind = prop.key.name;
      this.parsePropertyName(prop);
      prop.value = this.parseMethod(false);
    } else {
      prop.kind = "init";
      if (this.options.ecmaVersion >= 6) {
        if (this.eat(tt.eq)) {
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
    this.eat(tt.comma);
  }
  this.popCx();
  if (!this.eat(tt.braceR)) {
    // If there is no closing brace, make the node span to the start
    // of the next token (this is useful for Tern)
    this.last.end = this.tok.start;
    if (this.options.locations) this.last.loc.end = this.tok.loc.start;
  }
  return this.finishNode(node, "ObjectExpression");
};

lp.parsePropertyName = function (prop) {
  if (this.options.ecmaVersion >= 6) {
    if (this.eat(tt.bracketL)) {
      prop.computed = true;
      prop.key = this.parseExpression();
      this.expect(tt.bracketR);
      return;
    } else {
      prop.computed = false;
    }
  }
  var key = this.tok.type === tt.num || this.tok.type === tt.string ? this.parseExprAtom() : this.parseIdent();
  prop.key = key || this.dummyIdent();
};

lp.parsePropertyAccessor = function () {
  if (this.tok.type === tt.name || this.tok.type.keyword) return this.parseIdent();
};

lp.parseIdent = function () {
  var name = this.tok.type === tt.name ? this.tok.value : this.tok.type.keyword;
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
  params = this.parseExprList(tt.parenR);
  return this.toAssignableList(params, true);
};

lp.parseMethod = function (isGenerator) {
  var node = this.startNode();
  this.initFunction(node);
  node.params = this.parseFunctionParams();
  node.generator = isGenerator || false;
  node.expression = this.options.ecmaVersion >= 6 && this.tok.type !== tt.braceL;
  node.body = node.expression ? this.parseMaybeAssign() : this.parseBlock();
  return this.finishNode(node, "FunctionExpression");
};

lp.parseArrowExpression = function (node, params) {
  this.initFunction(node);
  node.params = this.toAssignableList(params, true);
  node.expression = this.tok.type !== tt.braceL;
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
    if (this.eat(tt.comma)) {
      elts.push(allowEmpty ? null : this.dummyIdent());
      continue;
    }
    var elt = this.parseMaybeAssign();
    if (isDummy(elt)) {
      if (this.closes(close, indent, line)) break;
      this.next();
    } else {
      elts.push(elt);
    }
    this.eat(tt.comma);
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

},{"..":2,"./parseutil":4,"./state":5}],4:[function(_dereq_,module,exports){
"use strict";

exports.isDummy = isDummy;
exports.__esModule = true;

var LooseParser = _dereq_("./state").LooseParser;

var _ = _dereq_("..");

var Node = _.Node;
var SourceLocation = _.SourceLocation;
var lineBreak = _.lineBreak;
var isNewLine = _.isNewLine;
var tt = _.tokTypes;

var lp = LooseParser.prototype;

lp.startNode = function () {
  var node = new Node();
  node.start = this.tok.start;
  if (this.options.locations) node.loc = new SourceLocation(this.toks, this.tok.loc.start);
  if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
  if (this.options.ranges) node.range = [this.tok.start, 0];
  return node;
};

lp.storeCurrentPos = function () {
  return this.options.locations ? [this.tok.start, this.tok.loc.start] : this.tok.start;
};

lp.startNodeAt = function (pos) {
  var node = new Node();
  if (this.options.locations) {
    node.start = pos[0];
    node.loc = new SourceLocation(this.toks, pos[1]);
    pos = pos[0];
  } else {
    node.start = pos;
  }
  if (this.options.directSourceFile) node.sourceFile = this.options.directSourceFile;
  if (this.options.ranges) node.range = [pos, 0];
  return node;
};

lp.finishNode = function (node, type) {
  node.type = type;
  node.end = this.last.end;
  if (this.options.locations) node.loc.end = this.last.loc.end;
  if (this.options.ranges) node.range[1] = this.last.end;
  return node;
};

lp.dummyIdent = function () {
  var dummy = this.startNode();
  dummy.name = "✖";
  return this.finishNode(dummy, "Identifier");
};

function isDummy(node) {
  return node.name == "✖";
}

lp.eat = function (type) {
  if (this.tok.type === type) {
    this.next();
    return true;
  } else {
    return false;
  }
};

lp.isContextual = function (name) {
  return this.tok.type === tt.name && this.tok.value === name;
};

lp.eatContextual = function (name) {
  return this.tok.value === name && this.eat(tt.name);
};

lp.canInsertSemicolon = function () {
  return this.tok.type === tt.eof || this.tok.type === tt.braceR || lineBreak.test(this.input.slice(this.last.end, this.tok.start));
};

lp.semicolon = function () {
  return this.eat(tt.semi);
};

lp.expect = function (type) {
  if (this.eat(type)) return true;
  for (var i = 1; i <= 2; i++) {
    if (this.lookAhead(i).type == type) {
      for (var j = 0; j < i; j++) {
        this.next();
      }return true;
    }
  }
};

lp.pushCx = function () {
  this.context.push(this.curIndent);
};
lp.popCx = function () {
  this.curIndent = this.context.pop();
};

lp.lineEnd = function (pos) {
  while (pos < this.input.length && !isNewLine(this.input.charCodeAt(pos))) ++pos;
  return pos;
};

lp.indentationAfter = function (pos) {
  for (var count = 0;; ++pos) {
    var ch = this.input.charCodeAt(pos);
    if (ch === 32) ++count;else if (ch === 9) count += this.options.tabSize;else return count;
  }
};

lp.closes = function (closeTok, indent, line, blockHeuristic) {
  if (this.tok.type === closeTok || this.tok.type === tt.eof) return true;
  return line != this.curLineStart && this.curIndent < indent && this.tokenStartsLine() && (!blockHeuristic || this.nextLineStart >= this.input.length || this.indentationAfter(this.nextLineStart) < indent);
};

lp.tokenStartsLine = function () {
  for (var p = this.tok.start - 1; p >= this.curLineStart; --p) {
    var ch = this.input.charCodeAt(p);
    if (ch !== 9 && ch !== 32) return false;
  }
  return true;
};

},{"..":2,"./state":5}],5:[function(_dereq_,module,exports){
"use strict";

exports.LooseParser = LooseParser;
exports.__esModule = true;

var _ = _dereq_("..");

var tokenizer = _.tokenizer;
var SourceLocation = _.SourceLocation;
var tt = _.tokTypes;

function LooseParser(input, options) {
  this.toks = tokenizer(input, options);
  this.options = this.toks.options;
  this.input = this.toks.input;
  this.tok = this.last = { type: tt.eof, start: 0, end: 0 };
  if (this.options.locations) {
    var here = this.toks.curPosition();
    this.tok.loc = new SourceLocation(this.toks, here, here);
  }
  this.ahead = []; // Tokens ahead
  this.context = []; // Indentation contexted
  this.curIndent = 0;
  this.curLineStart = 0;
  this.nextLineStart = this.lineEnd(this.curLineStart) + 1;
}

},{"..":2}],6:[function(_dereq_,module,exports){
"use strict";

var LooseParser = _dereq_("./state").LooseParser;

var isDummy = _dereq_("./parseutil").isDummy;

var _ = _dereq_("..");

var getLineInfo = _.getLineInfo;
var tt = _.tokTypes;

var lp = LooseParser.prototype;

lp.parseTopLevel = function () {
  var node = this.startNodeAt(this.options.locations ? [0, getLineInfo(this.input, 0)] : 0);
  node.body = [];
  while (this.tok.type !== tt.eof) node.body.push(this.parseStatement());
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
    case tt._break:case tt._continue:
      this.next();
      var isBreak = starttype === tt._break;
      if (this.semicolon() || this.canInsertSemicolon()) {
        node.label = null;
      } else {
        node.label = this.tok.type === tt.name ? this.parseIdent() : null;
        this.semicolon();
      }
      return this.finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

    case tt._debugger:
      this.next();
      this.semicolon();
      return this.finishNode(node, "DebuggerStatement");

    case tt._do:
      this.next();
      node.body = this.parseStatement();
      node.test = this.eat(tt._while) ? this.parseParenExpression() : this.dummyIdent();
      this.semicolon();
      return this.finishNode(node, "DoWhileStatement");

    case tt._for:
      this.next();
      this.pushCx();
      this.expect(tt.parenL);
      if (this.tok.type === tt.semi) return this.parseFor(node, null);
      if (this.tok.type === tt._var || this.tok.type === tt._let || this.tok.type === tt._const) {
        var _init = this.parseVar(true);
        if (_init.declarations.length === 1 && (this.tok.type === tt._in || this.isContextual("of"))) {
          return this.parseForIn(node, _init);
        }
        return this.parseFor(node, _init);
      }
      var init = this.parseExpression(true);
      if (this.tok.type === tt._in || this.isContextual("of")) return this.parseForIn(node, this.toAssignable(init));
      return this.parseFor(node, init);

    case tt._function:
      this.next();
      return this.parseFunction(node, true);

    case tt._if:
      this.next();
      node.test = this.parseParenExpression();
      node.consequent = this.parseStatement();
      node.alternate = this.eat(tt._else) ? this.parseStatement() : null;
      return this.finishNode(node, "IfStatement");

    case tt._return:
      this.next();
      if (this.eat(tt.semi) || this.canInsertSemicolon()) node.argument = null;else {
        node.argument = this.parseExpression();this.semicolon();
      }
      return this.finishNode(node, "ReturnStatement");

    case tt._switch:
      var blockIndent = this.curIndent,
          line = this.curLineStart;
      this.next();
      node.discriminant = this.parseParenExpression();
      node.cases = [];
      this.pushCx();
      this.expect(tt.braceL);

      var cur = undefined;
      while (!this.closes(tt.braceR, blockIndent, line, true)) {
        if (this.tok.type === tt._case || this.tok.type === tt._default) {
          var isCase = this.tok.type === tt._case;
          if (cur) this.finishNode(cur, "SwitchCase");
          node.cases.push(cur = this.startNode());
          cur.consequent = [];
          this.next();
          if (isCase) cur.test = this.parseExpression();else cur.test = null;
          this.expect(tt.colon);
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
      this.eat(tt.braceR);
      return this.finishNode(node, "SwitchStatement");

    case tt._throw:
      this.next();
      node.argument = this.parseExpression();
      this.semicolon();
      return this.finishNode(node, "ThrowStatement");

    case tt._try:
      this.next();
      node.block = this.parseBlock();
      node.handler = null;
      if (this.tok.type === tt._catch) {
        var clause = this.startNode();
        this.next();
        this.expect(tt.parenL);
        clause.param = this.toAssignable(this.parseExprAtom(), true);
        this.expect(tt.parenR);
        clause.guard = null;
        clause.body = this.parseBlock();
        node.handler = this.finishNode(clause, "CatchClause");
      }
      node.finalizer = this.eat(tt._finally) ? this.parseBlock() : null;
      if (!node.handler && !node.finalizer) return node.block;
      return this.finishNode(node, "TryStatement");

    case tt._var:
    case tt._let:
    case tt._const:
      return this.parseVar();

    case tt._while:
      this.next();
      node.test = this.parseParenExpression();
      node.body = this.parseStatement();
      return this.finishNode(node, "WhileStatement");

    case tt._with:
      this.next();
      node.object = this.parseParenExpression();
      node.body = this.parseStatement();
      return this.finishNode(node, "WithStatement");

    case tt.braceL:
      return this.parseBlock();

    case tt.semi:
      this.next();
      return this.finishNode(node, "EmptyStatement");

    case tt._class:
      return this.parseClass(true);

    case tt._import:
      return this.parseImport();

    case tt._export:
      return this.parseExport();

    default:
      var expr = this.parseExpression();
      if (isDummy(expr)) {
        this.next();
        if (this.tok.type === tt.eof) return this.finishNode(node, "EmptyStatement");
        return this.parseStatement();
      } else if (starttype === tt.name && expr.type === "Identifier" && this.eat(tt.colon)) {
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
  this.expect(tt.braceL);
  var blockIndent = this.curIndent,
      line = this.curLineStart;
  node.body = [];
  while (!this.closes(tt.braceR, blockIndent, line, true)) node.body.push(this.parseStatement());
  this.popCx();
  this.eat(tt.braceR);
  return this.finishNode(node, "BlockStatement");
};

lp.parseFor = function (node, init) {
  node.init = init;
  node.test = node.update = null;
  if (this.eat(tt.semi) && this.tok.type !== tt.semi) node.test = this.parseExpression();
  if (this.eat(tt.semi) && this.tok.type !== tt.parenR) node.update = this.parseExpression();
  this.popCx();
  this.expect(tt.parenR);
  node.body = this.parseStatement();
  return this.finishNode(node, "ForStatement");
};

lp.parseForIn = function (node, init) {
  var type = this.tok.type === tt._in ? "ForInStatement" : "ForOfStatement";
  this.next();
  node.left = init;
  node.right = this.parseExpression();
  this.popCx();
  this.expect(tt.parenR);
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
    decl.init = this.eat(tt.eq) ? this.parseMaybeAssign(noIn) : null;
    node.declarations.push(this.finishNode(decl, "VariableDeclarator"));
  } while (this.eat(tt.comma));
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
  if (this.tok.type === tt.name) node.id = this.parseIdent();else if (isStatement) node.id = this.dummyIdent();else node.id = null;
  node.superClass = this.eat(tt._extends) ? this.parseExpression() : null;
  node.body = this.startNode();
  node.body.body = [];
  this.pushCx();
  var indent = this.curIndent + 1,
      line = this.curLineStart;
  this.eat(tt.braceL);
  if (this.curIndent + 1 < indent) {
    indent = this.curIndent;line = this.curLineStart;
  }
  while (!this.closes(tt.braceR, indent, line)) {
    if (this.semicolon()) continue;
    var method = this.startNode(),
        isGenerator = undefined,
        start = undefined;
    if (this.options.ecmaVersion >= 6) {
      method["static"] = false;
      isGenerator = this.eat(tt.star);
    }
    this.parsePropertyName(method);
    if (isDummy(method.key)) {
      if (isDummy(this.parseMaybeAssign())) this.next();this.eat(tt.comma);continue;
    }
    if (method.key.type === "Identifier" && !method.computed && method.key.name === "static" && (this.tok.type != tt.parenL && this.tok.type != tt.braceL)) {
      method["static"] = true;
      isGenerator = this.eat(tt.star);
      this.parsePropertyName(method);
    } else {
      method["static"] = false;
    }
    if (this.options.ecmaVersion >= 5 && method.key.type === "Identifier" && !method.computed && (method.key.name === "get" || method.key.name === "set") && this.tok.type !== tt.parenL && this.tok.type !== tt.braceL) {
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
  if (!this.eat(tt.braceR)) {
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
    node.generator = this.eat(tt.star);
  }
  if (this.tok.type === tt.name) node.id = this.parseIdent();else if (isStatement) node.id = this.dummyIdent();
  node.params = this.parseFunctionParams();
  node.body = this.parseBlock();
  return this.finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
};

lp.parseExport = function () {
  var node = this.startNode();
  this.next();
  if (this.eat(tt.star)) {
    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
    return this.finishNode(node, "ExportAllDeclaration");
  }
  if (this.eat(tt._default)) {
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
  if (this.tok.type === tt.string) {
    node.specifiers = [];
    node.source = this.parseExprAtom();
    node.kind = "";
  } else {
    var elt = undefined;
    if (this.tok.type === tt.name && this.tok.value !== "from") {
      elt = this.startNode();
      elt.local = this.parseIdent();
      this.finishNode(elt, "ImportDefaultSpecifier");
      this.eat(tt.comma);
    }
    node.specifiers = this.parseImportSpecifierList();
    node.source = this.eatContextual("from") ? this.parseExprAtom() : null;
    if (elt) node.specifiers.unshift(elt);
  }
  this.semicolon();
  return this.finishNode(node, "ImportDeclaration");
};

lp.parseImportSpecifierList = function () {
  var elts = [];
  if (this.tok.type === tt.star) {
    var elt = this.startNode();
    this.next();
    if (this.eatContextual("as")) elt.local = this.parseIdent();
    elts.push(this.finishNode(elt, "ImportNamespaceSpecifier"));
  } else {
    var indent = this.curIndent,
        line = this.curLineStart,
        continuedLine = this.nextLineStart;
    this.pushCx();
    this.eat(tt.braceL);
    if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
    while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
      var elt = this.startNode();
      if (this.eat(tt.star)) {
        if (this.eatContextual("as")) elt.local = this.parseIdent();
        this.finishNode(elt, "ImportNamespaceSpecifier");
      } else {
        if (this.isContextual("from")) break;
        elt.imported = this.parseIdent();
        elt.local = this.eatContextual("as") ? this.parseIdent() : elt.imported;
        this.finishNode(elt, "ImportSpecifier");
      }
      elts.push(elt);
      this.eat(tt.comma);
    }
    this.eat(tt.braceR);
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
  this.eat(tt.braceL);
  if (this.curLineStart > continuedLine) continuedLine = this.curLineStart;
  while (!this.closes(tt.braceR, indent + (this.curLineStart <= continuedLine ? 1 : 0), line)) {
    if (this.isContextual("from")) break;
    var elt = this.startNode();
    elt.local = this.parseIdent();
    elt.exported = this.eatContextual("as") ? this.parseIdent() : elt.local;
    this.finishNode(elt, "ExportSpecifier");
    elts.push(elt);
    this.eat(tt.comma);
  }
  this.eat(tt.braceR);
  this.popCx();
  return elts;
};

},{"..":2,"./parseutil":4,"./state":5}],7:[function(_dereq_,module,exports){
"use strict";

var _ = _dereq_("..");

var tt = _.tokTypes;
var Token = _.Token;
var isNewLine = _.isNewLine;
var SourceLocation = _.SourceLocation;
var getLineInfo = _.getLineInfo;
var lineBreakG = _.lineBreakG;

var LooseParser = _dereq_("./state").LooseParser;

var lp = LooseParser.prototype;

function isSpace(ch) {
  return ch < 14 && ch > 8 || ch === 32 || ch === 160 || isNewLine(ch);
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
      if (this.toks.type === tt.dot && this.input.substr(this.toks.end, 1) === "." && this.options.ecmaVersion >= 6) {
        this.toks.end++;
        this.toks.type = tt.ellipsis;
      }
      return new Token(this.toks);
    } catch (e) {
      if (!(e instanceof SyntaxError)) throw e;

      // Try to skip some text, based on the error message, and then continue
      var msg = e.message,
          pos = e.raisedAt,
          replace = true;
      if (/unterminated/i.test(msg)) {
        pos = this.lineEnd(e.pos + 1);
        if (/string/.test(msg)) {
          replace = { start: e.pos, end: pos, type: tt.string, value: this.input.slice(e.pos + 1, pos) };
        } else if (/regular expr/i.test(msg)) {
          var re = this.input.slice(e.pos, pos);
          try {
            re = new RegExp(re);
          } catch (e) {}
          replace = { start: e.pos, end: pos, type: tt.regexp, value: re };
        } else if (/template/.test(msg)) {
          replace = { start: e.pos, end: pos,
            type: tt.template,
            value: this.input.slice(e.pos, pos) };
        } else {
          replace = false;
        }
      } else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number/i.test(msg)) {
        while (pos < this.input.length && !isSpace(this.input.charCodeAt(pos))) ++pos;
      } else if (/character escape|expected hexadecimal/i.test(msg)) {
        while (pos < this.input.length) {
          var ch = this.input.charCodeAt(pos++);
          if (ch === 34 || ch === 39 || isNewLine(ch)) break;
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
      if (replace === true) replace = { start: pos, end: pos, type: tt.name, value: "✖" };
      if (replace) {
        if (this.options.locations) replace.loc = new SourceLocation(this.toks, getLineInfo(this.input, replace.start), getLineInfo(this.input, replace.end));
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
    this.toks.lineStart = lineBreakG.lastIndex = 0;
    var match = undefined;
    while ((match = lineBreakG.exec(this.input)) && match.index < pos) {
      ++this.toks.curLine;
      this.toks.lineStart = match.index + match[0].length;
    }
  }
};

lp.lookAhead = function (n) {
  while (n > this.ahead.length) this.ahead.push(this.readToken());
  return this.ahead[n - 1];
};

},{"..":2,"./state":5}]},{},[1])(1)
});;
var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS && module.require("lively.lang");
var escodegen = isCommonJS ? require("escodegen") : escodegen;
var acorn = !isCommonJS && Global.acorn;
if (!acorn && isCommonJS) {
    acorn = require("acorn-jsx");
    acorn.walk = require("acorn-jsx/node_modules/acorn/dist/walk");
    acorn.parse_dammit = require("acorn-jsx/node_modules/acorn/dist/acorn_loose").parse_dammit;
}

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: isCommonJS ? (Global.lively || {}) : (Global.lively || (Global.lively = {})),
  "lively.lang": lang,
  "lively.ast": {},
  escodegen: escodegen,
  acorn: acorn
}

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
    module.exports = env["lively.ast"];
  }

})(function(acorn, lively, lang, exports) {

  exports.acorn = acorn;

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
    options.ecmaVersion = 6;
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

  exports.acorn = acorn;

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
  source = typeof ast === 'string' ? ast : source;
  ast = typeof ast === 'string' ? acorn.parse(ast) : ast;
  completeSrc = !!completeSrc;
  return acorn.walk.forEachNode(ast, function(node) {
    if (node.source && !forceNewSource) return;
    node.source = completeSrc ?
      source : source.slice(node.start, node.end);
  });
};

acorn.walk.inspect = function(ast, source) {
  source = typeof ast === 'string' ? ast : null;
  ast = typeof ast === 'string' ? acorn.parse(ast) : ast;
  source && acorn.walk.addSource(ast, source);
  return lang.obj.inspect(ast);
};

acorn.walk.withParentInfo = function(ast, iterator, options) {
  // options = {visitAllNodes: BOOL}
  options = options || {};
  function makeScope(parentScope) {
    var scope = {id: Strings.newUUID(), parentScope: parentScope, containingScopes: []};
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
  var visitors = Object.extend({
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
    var found, targetReached = false, bodyNodes, lastStatement;
    acorn.withMozillaAstDo(ast, {}, function(next, node, depth, state, path) {
      if (targetReached || node.astIndex < target.astIndex) return;
      if (node.type === "Program" || node.type === "BlockStatement") {
        bodyNodes = node.body;
      } else if (node.type === "SwitchCase") {
        bodyNodes = node.consequent;
      }
      if (bodyNodes) {
        var nodeIdxInProgramNode = bodyNodes.indexOf(node);
        if (nodeIdxInProgramNode > -1) lastStatement = node;
      }
      if (!targetReached && (node === target || node.astIndex === target.astIndex)) {
        targetReached = true; found = options.asPath ? path : lastStatement;
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
    try {
      if (!this['visit' + node.type]) throw new Error("No AST visit handler for type " + node.type);
      return this['visit' + node.type](node, depth, scope, path);
    } catch (e) { console.error(e.stack) }
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
    // if (path.slice(-3)[0] !== "declarations") scope.refs.push(node);
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

  // visitObjectPattern: function(node, depth, scope, path) {
  //   var retVal;

  //   node.properties.forEach(function(ea, i) {
  //     // ea.key is of type node
  //     retVal = this.accept(ea.key, depth, scope, path.concat(["properties", i, "key"]));
      
  //     debugger;
  //     if (path.slice(-3)[0] === "declarations")
  //       scope.varDecls.push(ea.key);
  //     // if (path.slice(-3)[0] === "declarations")
  //     //   scope.varDecls.push(ea.key);
  //     // scope.params.push(ea.key);

  //     // ea.value is of type node
  //     retVal = this.accept(ea.value, depth, scope, path.concat(["properties", i, "value"]));
  //   }, this);
  //   return retVal;
  // },

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
  }

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

  patternIds: function(pattern) {
    return chain(pattern.properties)
      .pluck("value")
      .flatmap(function(ea) {
        if (ea.type === "Identifier") return [ea];
        if (ea.type === "ObjectPattern") return helpers.patternIds(ea);
        return [];
      }).value();
  },

  declIds: function(nodes) {
    return chain(nodes).flatmap(function(ea) {
      if (!ea) return null;
      if (ea.type === "ObjectPattern") {
        return helpers.patternIds(ea);
      }
      if (ea.type === "Identifier") { return [ea]; }
      return null;
    })
    .compact().value();
  },

  varDeclIds: function(scope) {
    return helpers.declIds(
      chain(scope.varDecls)
        .pluck('declarations')
        .flatten()
        .pluck('id')
        .value());
  }

}

exports.query = {

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
        exports.query.findJsLintGlobalDeclarations(
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
    if (typeof ast === "string") ast = exports.parse(ast, {withComments: true});

    var q           = exports.query,
        scope       = exports.query.scopes(ast),
        useComments = options && !!options.jslintGlobalComment,
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

//# sourceMappingURL=lively.ast.dev.js.map