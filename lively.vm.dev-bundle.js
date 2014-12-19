(function(b){function a(b,d){if({}.hasOwnProperty.call(a.cache,b))return a.cache[b];var e=a.resolve(b);if(!e)throw new Error('Failed to resolve module '+b);var c={id:b,require:a,filename:b,exports:{},loaded:!1,parent:d,children:[]};d&&d.children.push(c);var f=b.slice(0,b.lastIndexOf('/')+1);return a.cache[b]=c.exports,e.call(c.exports,c,c.exports,f,b),c.loaded=!0,a.cache[b]=c.exports}a.modules={},a.cache={},a.resolve=function(b){return{}.hasOwnProperty.call(a.modules,b)?a.modules[b]:void 0},a.define=function(b,c){a.modules[b]=c};var c=function(a){return a='/',{title:'browser',version:'v0.10.26',browser:!0,env:{},argv:[],nextTick:b.setImmediate||function(a){setTimeout(a,0)},cwd:function(){return a},chdir:function(b){a=b}}}();a.define('/tools/entry-point.js',function(c,d,e,f){!function(){'use strict';b.escodegen=a('/escodegen.js',c),escodegen.browser=!0}()}),a.define('/escodegen.js',function(d,c,e,f){!function(e,f,a0,D,_,q,B,l,y,v,K,Z,I,X,j,h,J,N,F,T,o,L,w,S,R){'use strict';function a5(a){switch(a.type){case e.AssignmentExpression:case e.ArrayExpression:case e.ArrayPattern:case e.BinaryExpression:case e.CallExpression:case e.ConditionalExpression:case e.ClassExpression:case e.ExportBatchSpecifier:case e.ExportSpecifier:case e.FunctionExpression:case e.Identifier:case e.ImportSpecifier:case e.Literal:case e.LogicalExpression:case e.MemberExpression:case e.MethodDefinition:case e.NewExpression:case e.ObjectExpression:case e.ObjectPattern:case e.Property:case e.SequenceExpression:case e.ThisExpression:case e.UnaryExpression:case e.UpdateExpression:case e.YieldExpression:return!0}return!1}function ah(a){switch(a.type){case e.BlockStatement:case e.BreakStatement:case e.CatchClause:case e.ContinueStatement:case e.ClassDeclaration:case e.ClassBody:case e.DirectiveStatement:case e.DoWhileStatement:case e.DebuggerStatement:case e.EmptyStatement:case e.ExpressionStatement:case e.ForStatement:case e.ForInStatement:case e.ForOfStatement:case e.FunctionDeclaration:case e.IfStatement:case e.LabeledStatement:case e.ModuleDeclaration:case e.Program:case e.ReturnStatement:case e.SwitchStatement:case e.SwitchCase:case e.ThrowStatement:case e.TryStatement:case e.VariableDeclaration:case e.VariableDeclarator:case e.WhileStatement:case e.WithStatement:return!0}return!1}function P(){return{indent:null,base:null,parse:null,comment:!1,format:{indent:{style:'    ',base:0,adjustMultilineComment:!1},newline:'\n',space:' ',json:!1,renumber:!1,hexadecimal:!1,quotes:'single',escapeless:!1,compact:!1,parentheses:!0,semicolons:!0,safeConcatenation:!1},moz:{comprehensionExpressionStartsWithAssignment:!1,starlessGenerator:!1},sourceMap:null,sourceMapRoot:null,sourceMapWithCode:!1,directive:!1,raw:!0,verbatim:null}}function M(b,a){var c='';for(a|=0;a>0;a>>>=1,b+=b)a&1&&(c+=b);return c}function a6(a){return/[\r\n]/g.test(a)}function p(b){var a=b.length;return a&&q.code.isLineTerminator(b.charCodeAt(a-1))}function G(b,d){function e(a){return typeof a==='object'&&a instanceof Object&&!(a instanceof RegExp)}var a,c;for(a in d)d.hasOwnProperty(a)&&(c=d[a],e(c)?e(b[a])?G(b[a],c):b[a]=G({},c):b[a]=c);return b}function a3(c){var b,e,a,f,d;if(c!==c)throw new Error('Numeric literal whose value is NaN');if(c<0||c===0&&1/c<0)throw new Error('Numeric literal whose value is negative');if(c===1/0)return v?'null':K?'1e400':'1e+400';if(b=''+c,!K||b.length<3)return b;e=b.indexOf('.'),!v&&b.charCodeAt(0)===48&&e===1&&(e=0,b=b.slice(1)),a=b,b=b.replace('e+','e'),f=0,(d=a.indexOf('e'))>0&&(f=+a.slice(d+1),a=a.slice(0,d)),e>=0&&(f-=a.length-e-1,a=+(a.slice(0,e)+a.slice(e+1))+''),d=0;while(a.charCodeAt(a.length+d-1)===48)--d;return d!==0&&(f-=d,a=a.slice(0,d)),f!==0&&(a+='e'+f),(a.length<b.length||Z&&c>1e12&&Math.floor(c)===c&&(a='0x'+c.toString(16)).length<b.length)&&+a===c&&(b=a),b}function V(a,b){return(a&-2)===8232?(b?'u':'\\u')+(a===8232?'2028':'2029'):a===10||a===13?(b?'':'\\')+(a===10?'n':'r'):String.fromCharCode(a)}function a1(d){var g,a,h,e,i,b,f,c;if(a=d.toString(),d.source){if(g=a.match(/\/([^/]*)$/),!g)return a;for(h=g[1],a='',f=!1,c=!1,e=0,i=d.source.length;e<i;++e)b=d.source.charCodeAt(e),c?(a+=V(b,c),c=!1):(f?b===93&&(f=!1):b===47?a+='\\':b===91&&(f=!0),a+=V(b,c),c=b===92);return'/'+a+'/'+h}return a}function a8(b,d){var c,a='\\';switch(b){case 8:a+='b';break;case 12:a+='f';break;case 9:a+='t';break;default:c=b.toString(16).toUpperCase();v||b>255?a+='u'+'0000'.slice(c.length)+c:b===0&&!q.code.isDecimalDigit(d)?a+='0':b===11?a+='x0B':a+='x'+'00'.slice(c.length)+c;break}return a}function ad(b){var a='\\';switch(b){case 92:a+='\\';break;case 10:a+='n';break;case 13:a+='r';break;case 8232:a+='u2028';break;case 8233:a+='u2029';break;default:throw new Error('Incorrectly classified character')}return a}function ae(d){var a,e,c,b;for(b=I==='double'?'"':"'",a=0,e=d.length;a<e;++a){if(c=d.charCodeAt(a),c===39){b='"';break}if(c===34){b="'";break}c===92&&++a}return b+d+b}function af(d){var b='',c,g,a,h=0,i=0,e,f;for(c=0,g=d.length;c<g;++c){if(a=d.charCodeAt(c),a===39)++h;else if(a===34)++i;else if(a===47&&v)b+='\\';else if(q.code.isLineTerminator(a)||a===92){b+=ad(a);continue}else if(v&&a<32||!(v||X||a>=32&&a<=126)){b+=a8(a,d.charCodeAt(c+1));continue}b+=String.fromCharCode(a)}if(e=!(I==='double'||I==='auto'&&i<h),f=e?"'":'"',!(e?h:i))return f+b+f;for(d=b,b=f,c=0,g=d.length;c<g;++c)a=d.charCodeAt(c),(a===39&&e||a===34&&!e)&&(b+='\\'),b+=String.fromCharCode(a);return b+f}function O(d){var a,e,b,c='';for(a=0,e=d.length;a<e;++a)b=d[a],c+=B(b)?O(b):b;return c}function k(b,a){if(!w)return B(b)?O(b):b;if(a==null)if(b instanceof D)return b;else a={};return a.loc==null?new D(null,null,w,b,a.name||null):new D(a.loc.start.line,a.loc.start.column,w===!0?a.loc.source||null:w,b,a.name||null)}function s(){return h?h:' '}function i(c,d){var e,f,a,b;return e=k(c).toString(),e.length===0?[d]:(f=k(d).toString(),f.length===0?[c]:(a=e.charCodeAt(e.length-1),b=f.charCodeAt(0),(a===43||a===45)&&a===b||q.code.isIdentifierPart(a)&&q.code.isIdentifierPart(b)||a===47&&b===105?[c,s(),d]:q.code.isWhiteSpace(a)||q.code.isLineTerminator(a)||q.code.isWhiteSpace(b)||q.code.isLineTerminator(b)?[c,d]:[c,h,d]))}function u(a){return[l,a]}function n(c){var a,b;return a=l,l+=y,b=c.call(this,l),l=a,b}function a9(b){var a;for(a=b.length-1;a>=0;--a)if(q.code.isLineTerminator(b.charCodeAt(a)))break;return b.length-1-a}function ac(j,i){var b,a,e,g,d,c,f,h;for(b=j.split(/\r\n|[\r\n]/),c=Number.MAX_VALUE,a=1,e=b.length;a<e;++a){g=b[a],d=0;while(d<g.length&&q.code.isWhiteSpace(g.charCodeAt(d)))++d;c>d&&(c=d)}for(i!==void 0?(f=l,b[1][c]==='*'&&(i+=' '),l=i):(c&1&&--c,f=l),a=1,e=b.length;a<e;++a)h=k(u(b[a].slice(c))),b[a]=w?h.join(''):h;return l=f,b.join('\n')}function H(a,b){return a.type==='Line'?p(a.value)?'//'+a.value:'//'+a.value+'\n':o.format.indent.adjustMultilineComment&&/[\n\r]/.test(a.value)?ac('/*'+a.value+'*/',b):'/*'+a.value+'*/'}function Q(b,a){var c,f,d,i,j,h,g;if(b.leadingComments&&b.leadingComments.length>0){for(i=a,d=b.leadingComments[0],a=[],F&&b.type===e.Program&&b.body.length===0&&a.push('\n'),a.push(H(d)),p(k(a).toString())||a.push('\n'),c=1,f=b.leadingComments.length;c<f;++c)d=b.leadingComments[c],g=[H(d)],p(k(g).toString())||g.push('\n'),a.push(u(g));a.push(u(i))}if(b.trailingComments)for(j=!p(k(a).toString()),h=M(' ',a9(k([l,a,y]).toString())),c=0,f=b.trailingComments.length;c<f;++c)d=b.trailingComments[c],j?(c===0?a=[a,y]:a=[a,h],a.push(H(d,h))):a=[a,u(H(d))],c!==f-1&&!p(k(a).toString())&&(a=[a,'\n']);return a}function r(a,b,c){return b<c?['(',a,')']:a}function t(a,f,c){var d,b;return b=!o.comment||!a.leadingComments,a.type===e.BlockStatement&&b?[h,m(a,{functionBody:c})]:a.type===e.EmptyStatement&&b?';':(n(function(){d=[j,u(m(a,{semicolonOptional:f,functionBody:c}))]}),d)}function z(c,a){var b=p(k(a).toString());return c.type===e.BlockStatement&&!(o.comment&&c.leadingComments)&&!b?[a,h]:b?[a,l]:[a,j,l]}function U(d){var a,c,b;for(b=d.split(/\r\n|\n/),a=1,c=b.length;a<c;a++)b[a]=j+l+b[a];return b}function a4(c,d){var a,b,e;return a=c[o.verbatim],typeof a==='string'?b=r(U(a),f.Sequence,d.precedence):(b=U(a.content),e=a.precedence!=null?a.precedence:f.Sequence,b=r(b,e,d.precedence)),k(b,c)}function A(a){return k(a.name,a)}function W(a,c){var b;return a.type===e.Identifier?b=A(a):b=g(a,{precedence:c.precedence,allowIn:c.allowIn,allowCall:!0}),b}function a7(a){var c,d,b,g;if(g=!1,a.type===e.ArrowFunctionExpression&&!a.rest&&(!a.defaults||a.defaults.length===0)&&a.params.length===1&&a.params[0].type===e.Identifier)b=[A(a.params[0])];else{for(b=['('],a.defaults&&(g=!0),c=0,d=a.params.length;c<d;++c)g&&a.defaults[c]?b.push($(a.params[c],a.defaults[c],'=',{precedence:f.Assignment,allowIn:!0,allowCall:!0})):b.push(W(a.params[c],{precedence:f.Assignment,allowIn:!0,allowCall:!0})),c+1<d&&b.push(','+h);a.rest&&(a.params.length&&b.push(','+h),b.push('...'),b.push(A(a.rest,{precedence:f.Assignment,allowIn:!0,allowCall:!0}))),b.push(')')}return b}function x(b){var a,c;return a=a7(b),b.type===e.ArrowFunctionExpression&&(a.push(h),a.push('=>')),b.expression?(a.push(h),c=g(b.body,{precedence:f.Assignment,allowIn:!0,allowCall:!0}),c.toString().charAt(0)==='{'&&(c=['(',c,')']),a.push(c)):a.push(t(b.body,!1,!0)),a}function Y(c,b,d){var a=['for'+h+'('];return n(function(){b.left.type===e.VariableDeclaration?n(function(){a.push(b.left.kind+s()),a.push(m(b.left.declarations[0],{allowIn:!1}))}):a.push(g(b.left,{precedence:f.Call,allowIn:!0,allowCall:!0})),a=i(a,c),a=[i(a,g(b.right,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),')']}),a.push(t(b.body,d)),a}function aa(c,i,d){function f(){for(b=c.declarations[0],o.comment&&b.leadingComments?(a.push('\n'),a.push(u(m(b,{allowIn:d})))):(a.push(s()),a.push(m(b,{allowIn:d}))),e=1,g=c.declarations.length;e<g;++e)b=c.declarations[e],o.comment&&b.leadingComments?(a.push(','+j),a.push(u(m(b,{allowIn:d})))):(a.push(','+h),a.push(m(b,{allowIn:d})))}var a,e,g,b;return a=[c.kind],c.declarations.length>1?n(f):f(),a.push(i),a}function ab(b){var a=['{',j];return n(function(h){var c,d;for(c=0,d=b.body.length;c<d;++c)a.push(h),a.push(g(b.body[c],{precedence:f.Sequence,allowIn:!0,allowCall:!0,type:e.Property})),c+1<d&&a.push(j)}),p(k(a).toString())||a.push(j),a.push(l),a.push('}'),a}function E(a){var b;if(a.hasOwnProperty('raw')&&L&&o.raw)try{if(b=L(a.raw).body[0].expression,b.type===e.Literal&&b.value===a.value)return a.raw}catch(a){}return a.value===null?'null':typeof a.value==='string'?af(a.value):typeof a.value==='number'?a3(a.value):typeof a.value==='boolean'?a.value?'true':'false':a1(a.value)}function C(c,b,d){var a=[];return b&&a.push('['),a.push(g(c,d)),b&&a.push(']'),a}function $(d,e,i,c){var a,b;return b=c.precedence,a=c.allowIn||f.Assignment<b,r([g(d,{precedence:f.Call,allowIn:a,allowCall:!0}),h+i+h,g(e,{precedence:f.Assignment,allowIn:a,allowCall:!0})],f.Assignment,b)}function g(b,y){var a,v,G,B,d,t,c,u,D,z,I,w,F,K,H,L;if(v=y.precedence,w=y.allowIn,F=y.allowCall,G=b.type||y.type,o.verbatim&&b.hasOwnProperty(o.verbatim))return a4(b,y);switch(G){case e.SequenceExpression:a=[];w|=f.Sequence<v;for(d=0,t=b.expressions.length;d<t;++d)a.push(g(b.expressions[d],{precedence:f.Assignment,allowIn:w,allowCall:!0})),d+1<t&&a.push(','+h);a=r(a,f.Sequence,v);break;case e.AssignmentExpression:a=$(b.left,b.right,b.operator,y);break;case e.ArrowFunctionExpression:w|=f.ArrowFunction<v;a=r(x(b),f.ArrowFunction,v);break;case e.ConditionalExpression:w|=f.Conditional<v;a=r([g(b.test,{precedence:f.LogicalOR,allowIn:w,allowCall:!0}),h+'?'+h,g(b.consequent,{precedence:f.Assignment,allowIn:w,allowCall:!0}),h+':'+h,g(b.alternate,{precedence:f.Assignment,allowIn:w,allowCall:!0})],f.Conditional,v);break;case e.LogicalExpression:case e.BinaryExpression:B=a0[b.operator];w|=B<v;c=g(b.left,{precedence:B,allowIn:w,allowCall:!0});z=c.toString();z.charCodeAt(z.length-1)===47&&q.code.isIdentifierPart(b.operator.charCodeAt(0))?a=[c,s(),b.operator]:a=i(c,b.operator);c=g(b.right,{precedence:B+1,allowIn:w,allowCall:!0});b.operator==='/'&&c.toString().charAt(0)==='/'||b.operator.slice(-1)==='<'&&c.toString().slice(0,3)==='!--'?(a.push(s()),a.push(c)):a=i(a,c);b.operator==='in'&&!w?a=['(',a,')']:a=r(a,B,v);break;case e.CallExpression:a=[g(b.callee,{precedence:f.Call,allowIn:!0,allowCall:!0,allowUnparenthesizedNew:!1})];a.push('(');for(d=0,t=b['arguments'].length;d<t;++d)a.push(g(b['arguments'][d],{precedence:f.Assignment,allowIn:!0,allowCall:!0})),d+1<t&&a.push(','+h);a.push(')');F?a=r(a,f.Call,v):a=['(',a,')'];break;case e.NewExpression:t=b['arguments'].length;K=y.allowUnparenthesizedNew===undefined||y.allowUnparenthesizedNew;a=i('new',g(b.callee,{precedence:f.New,allowIn:!0,allowCall:!1,allowUnparenthesizedNew:K&&!J&&t===0}));if(!K||J||t>0){for(a.push('('),d=0;d<t;++d)a.push(g(b['arguments'][d],{precedence:f.Assignment,allowIn:!0,allowCall:!0})),d+1<t&&a.push(','+h);a.push(')')}a=r(a,f.New,v);break;case e.MemberExpression:a=[g(b.object,{precedence:f.Call,allowIn:!0,allowCall:F,allowUnparenthesizedNew:!1})];b.computed?(a.push('['),a.push(g(b.property,{precedence:f.Sequence,allowIn:!0,allowCall:F})),a.push(']')):(b.object.type===e.Literal&&typeof b.object.value==='number'&&(c=k(a).toString(),c.indexOf('.')<0&&!/[eExX]/.test(c)&&q.code.isDecimalDigit(c.charCodeAt(c.length-1))&&!(c.length>=2&&c.charCodeAt(0)===48)&&a.push('.')),a.push('.'),a.push(A(b.property)));a=r(a,f.Member,v);break;case e.UnaryExpression:c=g(b.argument,{precedence:f.Unary,allowIn:!0,allowCall:!0});h===''?a=i(b.operator,c):(a=[b.operator],b.operator.length>2?a=i(a,c):(z=k(a).toString(),D=z.charCodeAt(z.length-1),I=c.toString().charCodeAt(0),(D===43||D===45)&&D===I||q.code.isIdentifierPart(D)&&q.code.isIdentifierPart(I)?(a.push(s()),a.push(c)):a.push(c)));a=r(a,f.Unary,v);break;case e.YieldExpression:b.delegate?a='yield*':a='yield';b.argument&&(a=i(a,g(b.argument,{precedence:f.Yield,allowIn:!0,allowCall:!0})));a=r(a,f.Yield,v);break;case e.UpdateExpression:b.prefix?a=r([b.operator,g(b.argument,{precedence:f.Unary,allowIn:!0,allowCall:!0})],f.Unary,v):a=r([g(b.argument,{precedence:f.Postfix,allowIn:!0,allowCall:!0}),b.operator],f.Postfix,v);break;case e.FunctionExpression:L=b.generator&&!o.moz.starlessGenerator;a=L?'function*':'function';b.id?a=[a,L?h:s(),A(b.id),x(b)]:a=[a+h,x(b)];break;case e.ExportBatchSpecifier:a='*';break;case e.ArrayPattern:case e.ArrayExpression:if(!b.elements.length){a='[]';break}u=b.elements.length>1;a=['[',u?j:''];n(function(c){for(d=0,t=b.elements.length;d<t;++d)b.elements[d]?(a.push(u?c:''),a.push(g(b.elements[d],{precedence:f.Assignment,allowIn:!0,allowCall:!0}))):(u&&a.push(c),d+1===t&&a.push(',')),d+1<t&&a.push(','+(u?j:h))});u&&!p(k(a).toString())&&a.push(j);a.push(u?l:'');a.push(']');break;case e.ClassExpression:a=['class'];b.id&&(a=i(a,g(b.id,{allowIn:!0,allowCall:!0})));b.superClass&&(c=i('extends',g(b.superClass,{precedence:f.Assignment,allowIn:!0,allowCall:!0})),a=i(a,c));a.push(h);a.push(m(b.body,{semicolonOptional:!0,directiveContext:!1}));break;case e.MethodDefinition:b['static']?a=['static'+h]:a=[];b.kind==='get'||b.kind==='set'?a=i(a,[i(b.kind,C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),x(b.value)]):(c=[C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),x(b.value)],b.value.generator?(a.push('*'),a.push(c)):a=i(a,c));break;case e.Property:b.kind==='get'||b.kind==='set'?a=[b.kind,s(),C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),x(b.value)]:b.shorthand?a=C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0}):b.method?(a=[],b.value.generator&&a.push('*'),a.push(C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),a.push(x(b.value))):a=[C(b.key,b.computed,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),':'+h,g(b.value,{precedence:f.Assignment,allowIn:!0,allowCall:!0})];break;case e.ObjectExpression:if(!b.properties.length){a='{}';break}u=b.properties.length>1;n(function(){c=g(b.properties[0],{precedence:f.Sequence,allowIn:!0,allowCall:!0,type:e.Property})});if(!(u||a6(k(c).toString()))){a=['{',h,c,h,'}'];break}n(function(h){if(a=['{',j,h,c],u)for(a.push(','+j),d=1,t=b.properties.length;d<t;++d)a.push(h),a.push(g(b.properties[d],{precedence:f.Sequence,allowIn:!0,allowCall:!0,type:e.Property})),d+1<t&&a.push(','+j)});p(k(a).toString())||a.push(j);a.push(l);a.push('}');break;case e.ObjectPattern:if(!b.properties.length){a='{}';break}u=!1;if(b.properties.length===1)H=b.properties[0],H.value.type!==e.Identifier&&(u=!0);else for(d=0,t=b.properties.length;d<t;++d)if(H=b.properties[d],!H.shorthand){u=!0;break}a=['{',u?j:''];n(function(c){for(d=0,t=b.properties.length;d<t;++d)a.push(u?c:''),a.push(g(b.properties[d],{precedence:f.Sequence,allowIn:!0,allowCall:!0})),d+1<t&&a.push(','+(u?j:h))});u&&!p(k(a).toString())&&a.push(j);a.push(u?l:'');a.push('}');break;case e.ThisExpression:a='this';break;case e.Identifier:a=A(b);break;case e.ImportSpecifier:case e.ExportSpecifier:a=[b.id.name];b.name&&a.push(s()+'as'+s()+b.name.name);break;case e.Literal:a=E(b);break;case e.GeneratorExpression:case e.ComprehensionExpression:a=G===e.GeneratorExpression?['(']:['['];o.moz.comprehensionExpressionStartsWithAssignment&&(c=g(b.body,{precedence:f.Assignment,allowIn:!0,allowCall:!0}),a.push(c));b.blocks&&n(function(){for(d=0,t=b.blocks.length;d<t;++d)c=g(b.blocks[d],{precedence:f.Sequence,allowIn:!0,allowCall:!0}),d>0||o.moz.comprehensionExpressionStartsWithAssignment?a=i(a,c):a.push(c)});b.filter&&(a=i(a,'if'+h),c=g(b.filter,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),a=i(a,['(',c,')']));o.moz.comprehensionExpressionStartsWithAssignment||(c=g(b.body,{precedence:f.Assignment,allowIn:!0,allowCall:!0}),a=i(a,c));a.push(G===e.GeneratorExpression?')':']');break;case e.ComprehensionBlock:b.left.type===e.VariableDeclaration?c=[b.left.kind,s(),m(b.left.declarations[0],{allowIn:!1})]:c=g(b.left,{precedence:f.Call,allowIn:!0,allowCall:!0});c=i(c,b.of?'of':'in');c=i(c,g(b.right,{precedence:f.Sequence,allowIn:!0,allowCall:!0}));a=['for'+h+'(',c,')'];break;case e.SpreadElement:a=['...',g(b.argument,{precedence:f.Assignment,allowIn:!0,allowCall:!0})];break;case e.TaggedTemplateExpression:a=[g(b.tag,{precedence:f.Call,allowIn:!0,allowCall:F,allowUnparenthesizedNew:!1}),g(b.quasi,{precedence:f.Primary})];a=r(a,f.TaggedTemplate,v);break;case e.TemplateElement:a=b.value.raw;break;case e.TemplateLiteral:a=['`'];for(d=0,t=b.quasis.length;d<t;++d)a.push(g(b.quasis[d],{precedence:f.Primary,allowIn:!0,allowCall:!0})),d+1<t&&(a.push('${'+h),a.push(g(b.expressions[d],{precedence:f.Sequence,allowIn:!0,allowCall:!0})),a.push(h+'}'));a.push('`');break;default:throw new Error('Unknown expression type: '+b.type)}return o.comment&&(a=Q(b,a)),k(a,b)}function ag(b,d){var a,c;return b.specifiers.length===0?['import',h,E(b.source),d]:(a=['import'],c=0,b.specifiers[0]['default']&&(a=i(a,[b.specifiers[0].id.name]),++c),b.specifiers[c]&&(c!==0&&a.push(','),a.push(h+'{'),b.specifiers.length-c===1?(a.push(h),a.push(g(b.specifiers[c],{precedence:f.Sequence,allowIn:!0,allowCall:!0})),a.push(h+'}'+h)):(n(function(h){var d,e;for(a.push(j),d=c,e=b.specifiers.length;d<e;++d)a.push(h),a.push(g(b.specifiers[d],{precedence:f.Sequence,allowIn:!0,allowCall:!0})),d+1<e&&a.push(','+j)}),p(k(a).toString())||a.push(j),a.push(l+'}'+h))),a=i(a,['from'+h,E(b.source),d]),a)}function m(b,y){var c,q,a,v,G,D,r,d,H,C;v=!0,d=';',G=!1,D=!1,y&&(v=y.allowIn===undefined||y.allowIn,!N&&y.semicolonOptional===!0&&(d=''),G=y.functionBody,D=y.directiveContext);switch(b.type){case e.BlockStatement:a=['{',j];n(function(){for(c=0,q=b.body.length;c<q;++c)r=u(m(b.body[c],{semicolonOptional:c===q-1,directiveContext:G})),a.push(r),p(k(r).toString())||a.push(j)});a.push(u('}'));break;case e.BreakStatement:b.label?a='break '+b.label.name+d:a='break'+d;break;case e.ContinueStatement:b.label?a='continue '+b.label.name+d:a='continue'+d;break;case e.ClassBody:a=ab(b);break;case e.ClassDeclaration:a=['class '+b.id.name];b.superClass&&(r=i('extends',g(b.superClass,{precedence:f.Assignment,allowIn:!0,allowCall:!0})),a=i(a,r));a.push(h);a.push(m(b.body,{semicolonOptional:!0,directiveContext:!1}));break;case e.DirectiveStatement:o.raw&&b.raw?a=b.raw+d:a=ae(b.directive)+d;break;case e.DoWhileStatement:a=i('do',t(b.body));a=z(b.body,a);a=i(a,['while'+h+'(',g(b.test,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')'+d]);break;case e.CatchClause:n(function(){var c;a=['catch'+h+'(',g(b.param,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')'],b.guard&&(c=g(b.guard,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),a.splice(2,0,' if ',c))});a.push(t(b.body));break;case e.DebuggerStatement:a='debugger'+d;break;case e.EmptyStatement:a=';';break;case e.ExportDeclaration:a=['export'];if(b['default']){a=i(a,'default'),a=i(a,g(b.declaration,{precedence:f.Assignment,allowIn:!0,allowCall:!0})+d);break}if(b.specifiers){b.specifiers.length===0?a=i(a,'{'+h+'}'):b.specifiers[0].type===e.ExportBatchSpecifier?a=i(a,g(b.specifiers[0],{precedence:f.Sequence,allowIn:!0,allowCall:!0})):(a=i(a,'{'),n(function(e){var c,d;for(a.push(j),c=0,d=b.specifiers.length;c<d;++c)a.push(e),a.push(g(b.specifiers[c],{precedence:f.Sequence,allowIn:!0,allowCall:!0})),c+1<d&&a.push(','+j)}),p(k(a).toString())||a.push(j),a.push(l+'}')),b.source?a=i(a,['from'+h,E(b.source),d]):a.push(d);break}b.declaration&&(a=i(a,m(b.declaration,{semicolonOptional:d===''})));break;case e.ExpressionStatement:a=[g(b.expression,{precedence:f.Sequence,allowIn:!0,allowCall:!0})];r=k(a).toString();r.charAt(0)==='{'||r.slice(0,5)==='class'&&' {'.indexOf(r.charAt(5))>=0||r.slice(0,8)==='function'&&'* ('.indexOf(r.charAt(8))>=0||T&&D&&b.expression.type===e.Literal&&typeof b.expression.value==='string'?a=['(',a,')'+d]:a.push(d);break;case e.ImportDeclaration:a=ag(b,d);break;case e.VariableDeclarator:b.init?a=[g(b.id,{precedence:f.Assignment,allowIn:v,allowCall:!0}),h,'=',h,g(b.init,{precedence:f.Assignment,allowIn:v,allowCall:!0})]:a=W(b.id,{precedence:f.Assignment,allowIn:v});break;case e.VariableDeclaration:a=aa(b,d,v);break;case e.ThrowStatement:a=[i('throw',g(b.argument,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),d];break;case e.TryStatement:a=['try',t(b.block)];a=z(b.block,a);if(b.handlers)for(c=0,q=b.handlers.length;c<q;++c)a=i(a,m(b.handlers[c])),(b.finalizer||c+1!==q)&&(a=z(b.handlers[c].body,a));else{for(C=b.guardedHandlers||[],c=0,q=C.length;c<q;++c)a=i(a,m(C[c])),(b.finalizer||c+1!==q)&&(a=z(C[c].body,a));if(b.handler)if(B(b.handler))for(c=0,q=b.handler.length;c<q;++c)a=i(a,m(b.handler[c])),(b.finalizer||c+1!==q)&&(a=z(b.handler[c].body,a));else a=i(a,m(b.handler)),b.finalizer&&(a=z(b.handler.body,a))}b.finalizer&&(a=i(a,['finally',t(b.finalizer)]));break;case e.SwitchStatement:n(function(){a=['switch'+h+'(',g(b.discriminant,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')'+h+'{'+j]});if(b.cases)for(c=0,q=b.cases.length;c<q;++c)r=u(m(b.cases[c],{semicolonOptional:c===q-1})),a.push(r),p(k(r).toString())||a.push(j);a.push(u('}'));break;case e.SwitchCase:n(function(){for(b.test?a=[i('case',g(b.test,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),':']:a=['default:'],c=0,q=b.consequent.length,q&&b.consequent[0].type===e.BlockStatement&&(r=t(b.consequent[0]),a.push(r),c=1),c!==q&&!p(k(a).toString())&&a.push(j);c<q;++c)r=u(m(b.consequent[c],{semicolonOptional:c===q-1&&d===''})),a.push(r),c+1!==q&&!p(k(r).toString())&&a.push(j)});break;case e.IfStatement:n(function(){a=['if'+h+'(',g(b.test,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')']});b.alternate?(a.push(t(b.consequent)),a=z(b.consequent,a),b.alternate.type===e.IfStatement?a=i(a,['else ',m(b.alternate,{semicolonOptional:d===''})]):a=i(a,i('else',t(b.alternate,d==='')))):a.push(t(b.consequent,d===''));break;case e.ForStatement:n(function(){a=['for'+h+'('],b.init?b.init.type===e.VariableDeclaration?a.push(m(b.init,{allowIn:!1})):(a.push(g(b.init,{precedence:f.Sequence,allowIn:!1,allowCall:!0})),a.push(';')):a.push(';'),b.test?(a.push(h),a.push(g(b.test,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),a.push(';')):a.push(';'),b.update?(a.push(h),a.push(g(b.update,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),a.push(')')):a.push(')')});a.push(t(b.body,d===''));break;case e.ForInStatement:a=Y('in',b,d==='');break;case e.ForOfStatement:a=Y('of',b,d==='');break;case e.LabeledStatement:a=[b.label.name+':',t(b.body,d==='')];break;case e.ModuleDeclaration:a=['module',s(),b.id.name,s(),'from',h,E(b.source),d];break;case e.Program:q=b.body.length;a=[F&&q>0?'\n':''];for(c=0;c<q;++c)r=u(m(b.body[c],{semicolonOptional:!F&&c===q-1,directiveContext:!0})),a.push(r),c+1<q&&!p(k(r).toString())&&a.push(j);break;case e.FunctionDeclaration:H=b.generator&&!o.moz.starlessGenerator;a=[H?'function*':'function',H?h:s(),A(b.id),x(b)];break;case e.ReturnStatement:b.argument?a=[i('return',g(b.argument,{precedence:f.Sequence,allowIn:!0,allowCall:!0})),d]:a=['return'+d];break;case e.WhileStatement:n(function(){a=['while'+h+'(',g(b.test,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')']});a.push(t(b.body,d===''));break;case e.WithStatement:n(function(){a=['with'+h+'(',g(b.object,{precedence:f.Sequence,allowIn:!0,allowCall:!0}),')']});a.push(t(b.body,d===''));break;default:throw new Error('Unknown statement type: '+b.type)}return o.comment&&(a=Q(b,a)),r=k(a).toString(),b.type===e.Program&&!F&&j===''&&r.charAt(r.length-1)==='\n'&&(a=w?k(a).replaceRight(/\s+$/,''):r.replace(/\s+$/,'')),k(a,b)}function ai(a){if(ah(a))return m(a);if(a5(a))return g(a,{precedence:f.Sequence,allowIn:!0,allowCall:!0});throw new Error('Unknown node type: '+a.type)}function a2(k,e){var g=P(),i,f;return e!=null?(typeof e.indent==='string'&&(g.format.indent.style=e.indent),typeof e.base==='number'&&(g.format.indent.base=e.base),e=G(g,e),y=e.format.indent.style,typeof e.base==='string'?l=e.base:l=M(y,e.format.indent.base)):(e=g,y=e.format.indent.style,l=M(y,e.format.indent.base)),v=e.format.json,K=e.format.renumber,Z=v?!1:e.format.hexadecimal,I=v?'double':e.format.quotes,X=e.format.escapeless,j=e.format.newline,h=e.format.space,e.format.compact&&(j=h=y=l=''),J=e.format.parentheses,N=e.format.semicolons,F=e.format.safeConcatenation,T=e.directive,L=v?null:e.parse,w=e.sourceMap,o=e,w&&(c.browser?D=b.sourceMap.SourceNode:D=a('/node_modules/source-map/lib/source-map.js',d).SourceNode),i=ai(k),w?(f=i.toStringWithSourceMap({file:e.file,sourceRoot:e.sourceMapRoot}),e.sourceContent&&f.map.setSourceContent(e.sourceMap,e.sourceContent),e.sourceMapWithCode?f:f.map.toString()):(f={code:i.toString(),map:null},e.sourceMapWithCode?f:f.code)}_=a('/node_modules/estraverse/estraverse.js',d),q=a('/node_modules/esutils/lib/utils.js',d),e={AssignmentExpression:'AssignmentExpression',ArrayExpression:'ArrayExpression',ArrayPattern:'ArrayPattern',ArrowFunctionExpression:'ArrowFunctionExpression',BlockStatement:'BlockStatement',BinaryExpression:'BinaryExpression',BreakStatement:'BreakStatement',CallExpression:'CallExpression',CatchClause:'CatchClause',ClassBody:'ClassBody',ClassDeclaration:'ClassDeclaration',ClassExpression:'ClassExpression',ComprehensionBlock:'ComprehensionBlock',ComprehensionExpression:'ComprehensionExpression',ConditionalExpression:'ConditionalExpression',ContinueStatement:'ContinueStatement',DirectiveStatement:'DirectiveStatement',DoWhileStatement:'DoWhileStatement',DebuggerStatement:'DebuggerStatement',EmptyStatement:'EmptyStatement',ExportBatchSpecifier:'ExportBatchSpecifier',ExportDeclaration:'ExportDeclaration',ExportSpecifier:'ExportSpecifier',ExpressionStatement:'ExpressionStatement',ForStatement:'ForStatement',ForInStatement:'ForInStatement',ForOfStatement:'ForOfStatement',FunctionDeclaration:'FunctionDeclaration',FunctionExpression:'FunctionExpression',GeneratorExpression:'GeneratorExpression',Identifier:'Identifier',IfStatement:'IfStatement',ImportSpecifier:'ImportSpecifier',ImportDeclaration:'ImportDeclaration',Literal:'Literal',LabeledStatement:'LabeledStatement',LogicalExpression:'LogicalExpression',MemberExpression:'MemberExpression',MethodDefinition:'MethodDefinition',ModuleDeclaration:'ModuleDeclaration',NewExpression:'NewExpression',ObjectExpression:'ObjectExpression',ObjectPattern:'ObjectPattern',Program:'Program',Property:'Property',ReturnStatement:'ReturnStatement',SequenceExpression:'SequenceExpression',SpreadElement:'SpreadElement',SwitchStatement:'SwitchStatement',SwitchCase:'SwitchCase',TaggedTemplateExpression:'TaggedTemplateExpression',TemplateElement:'TemplateElement',TemplateLiteral:'TemplateLiteral',ThisExpression:'ThisExpression',ThrowStatement:'ThrowStatement',TryStatement:'TryStatement',UnaryExpression:'UnaryExpression',UpdateExpression:'UpdateExpression',VariableDeclaration:'VariableDeclaration',VariableDeclarator:'VariableDeclarator',WhileStatement:'WhileStatement',WithStatement:'WithStatement',YieldExpression:'YieldExpression'},f={Sequence:0,Yield:1,Assignment:1,Conditional:2,ArrowFunction:2,LogicalOR:3,LogicalAND:4,BitwiseOR:5,BitwiseXOR:6,BitwiseAND:7,Equality:8,Relational:9,BitwiseSHIFT:10,Additive:11,Multiplicative:12,Unary:13,Postfix:14,Call:15,New:16,TaggedTemplate:17,Member:18,Primary:19},a0={'||':f.LogicalOR,'&&':f.LogicalAND,'|':f.BitwiseOR,'^':f.BitwiseXOR,'&':f.BitwiseAND,'==':f.Equality,'!=':f.Equality,'===':f.Equality,'!==':f.Equality,is:f.Equality,isnt:f.Equality,'<':f.Relational,'>':f.Relational,'<=':f.Relational,'>=':f.Relational,'in':f.Relational,'instanceof':f.Relational,'<<':f.BitwiseSHIFT,'>>':f.BitwiseSHIFT,'>>>':f.BitwiseSHIFT,'+':f.Additive,'-':f.Additive,'*':f.Multiplicative,'%':f.Multiplicative,'/':f.Multiplicative},B=Array.isArray,B||(B=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),S={indent:{style:'',base:0},renumber:!0,hexadecimal:!0,quotes:'auto',escapeless:!0,compact:!0,parentheses:!1,semicolons:!1},R=P().format,c.version=a('/package.json',d).version,c.generate=a2,c.attachComments=_.attachComments,c.Precedence=G({},f),c.browser=!1,c.FORMAT_MINIFY=S,c.FORMAT_DEFAULTS=R}()}),a.define('/package.json',function(a,b,c,d){a.exports={name:'escodegen',description:'ECMAScript code generator',homepage:'http://github.com/Constellation/escodegen',main:'escodegen.js',bin:{esgenerate:'./bin/esgenerate.js',escodegen:'./bin/escodegen.js'},version:'1.4.1',engines:{node:'>=0.10.0'},maintainers:[{name:'Yusuke Suzuki',email:'utatane.tea@gmail.com',web:'http://github.com/Constellation'}],repository:{type:'git',url:'http://github.com/Constellation/escodegen.git'},dependencies:{estraverse:'^1.5.1',esutils:'^1.1.4',esprima:'^1.2.2'},optionalDependencies:{'source-map':'~0.1.37'},devDependencies:{'esprima-moz':'*',semver:'^3.0.1',bluebird:'^2.2.2','jshint-stylish':'^0.4.0',chai:'^1.9.1','gulp-mocha':'^1.0.0','gulp-eslint':'^0.1.8',gulp:'^3.8.6','bower-registry-client':'^0.2.1','gulp-jshint':'^1.8.0','commonjs-everywhere':'^0.9.7'},licenses:[{type:'BSD',url:'http://github.com/Constellation/escodegen/raw/master/LICENSE.BSD'}],scripts:{test:'gulp travis','unit-test':'gulp test',lint:'gulp lint',release:'node tools/release.js','build-min':'./node_modules/.bin/cjsify -ma path: tools/entry-point.js > escodegen.browser.min.js',build:'./node_modules/.bin/cjsify -a path: tools/entry-point.js > escodegen.browser.js'}}}),a.define('/node_modules/source-map/lib/source-map.js',function(b,c,d,e){c.SourceMapGenerator=a('/node_modules/source-map/lib/source-map/source-map-generator.js',b).SourceMapGenerator,c.SourceMapConsumer=a('/node_modules/source-map/lib/source-map/source-map-consumer.js',b).SourceMapConsumer,c.SourceNode=a('/node_modules/source-map/lib/source-map/source-node.js',b).SourceNode}),a.define('/node_modules/source-map/lib/source-map/source-node.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(d,h,e){function a(a,b,c,d,e){this.children=[],this.sourceContents={},this.line=a==null?null:a,this.column=b==null?null:b,this.source=c==null?null:c,this.name=e==null?null:e,d!=null&&this.add(d)}var f=d('/node_modules/source-map/lib/source-map/source-map-generator.js',e).SourceMapGenerator,b=d('/node_modules/source-map/lib/source-map/util.js',e),c=/(\r?\n)/,g=/\r\n|[\s\S]/g;a.fromStringWithSourceMap=function d(n,m,j){function l(c,d){if(c===null||c.source===undefined)f.add(d);else{var e=j?b.join(j,c.source):c.source;f.add(new a(c.originalLine,c.originalColumn,e,d,c.name))}}var f=new a,e=n.split(c),k=function(){var a=e.shift(),b=e.shift()||'';return a+b},i=1,h=0,g=null;return m.eachMapping(function(a){if(g!==null)if(i<a.generatedLine){var c='';l(g,k()),i++,h=0}else{var b=e[0],c=b.substr(0,a.generatedColumn-h);e[0]=b.substr(a.generatedColumn-h),h=a.generatedColumn,l(g,c),g=a;return}while(i<a.generatedLine)f.add(k()),i++;if(h<a.generatedColumn){var b=e[0];f.add(b.substr(0,a.generatedColumn)),e[0]=b.substr(a.generatedColumn),h=a.generatedColumn}g=a},this),e.length>0&&(g&&l(g,k()),f.add(e.join(''))),m.sources.forEach(function(a){var c=m.sourceContentFor(a);c!=null&&(j!=null&&(a=b.join(j,a)),f.setSourceContent(a,c))}),f},a.prototype.add=function b(c){if(Array.isArray(c))c.forEach(function(a){this.add(a)},this);else if(c instanceof a||typeof c==='string')c&&this.children.push(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.prepend=function b(c){if(Array.isArray(c))for(var d=c.length-1;d>=0;d--)this.prepend(c[d]);else if(c instanceof a||typeof c==='string')this.children.unshift(c);else throw new TypeError('Expected a SourceNode, string, or an array of SourceNodes and strings. Got '+c);return this},a.prototype.walk=function b(e){var c;for(var d=0,f=this.children.length;d<f;d++)c=this.children[d],c instanceof a?c.walk(e):c!==''&&e(c,{source:this.source,line:this.line,column:this.column,name:this.name})},a.prototype.join=function a(e){var b,c,d=this.children.length;if(d>0){for(b=[],c=0;c<d-1;c++)b.push(this.children[c]),b.push(e);b.push(this.children[c]),this.children=b}return this},a.prototype.replaceRight=function b(d,e){var c=this.children[this.children.length-1];return c instanceof a?c.replaceRight(d,e):typeof c==='string'?this.children[this.children.length-1]=c.replace(d,e):this.children.push(''.replace(d,e)),this},a.prototype.setSourceContent=function a(c,d){this.sourceContents[b.toSetString(c)]=d},a.prototype.walkSourceContents=function c(g){for(var d=0,e=this.children.length;d<e;d++)this.children[d]instanceof a&&this.children[d].walkSourceContents(g);var f=Object.keys(this.sourceContents);for(var d=0,e=f.length;d<e;d++)g(b.fromSetString(f[d]),this.sourceContents[f[d]])},a.prototype.toString=function a(){var b='';return this.walk(function(a){b+=a}),b},a.prototype.toStringWithSourceMap=function a(l){var b={code:'',line:1,column:0},d=new f(l),e=!1,h=null,i=null,j=null,k=null;return this.walk(function(f,a){b.code+=f,a.source!==null&&a.line!==null&&a.column!==null?((h!==a.source||i!==a.line||j!==a.column||k!==a.name)&&d.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name}),h=a.source,i=a.line,j=a.column,k=a.name,e=!0):e&&(d.addMapping({generated:{line:b.line,column:b.column}}),h=null,e=!1),f.match(g).forEach(function(f,g,i){c.test(f)?(b.line++,b.column=0,g+1===i.length?(h=null,e=!1):e&&d.addMapping({source:a.source,original:{line:a.line,column:a.column},generated:{line:b.line,column:b.column},name:a.name})):b.column+=f.length})}),this.walkSourceContents(function(a,b){d.setSourceContent(a,b)}),{code:b.code,map:d}},h.SourceNode=a})}),a.define('/node_modules/source-map/lib/source-map/util.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(o,a,p){function m(b,a,c){if(a in b)return b[a];else if(arguments.length===3)return c;else throw new Error('"'+a+'" is a required argument.')}function b(b){var a=b.match(f);return a?{scheme:a[1],auth:a[2],host:a[3],port:a[4],path:a[5]}:null}function c(a){var b='';return a.scheme&&(b+=a.scheme+':'),b+='//',a.auth&&(b+=a.auth+'@'),a.host&&(b+=a.host),a.port&&(b+=':'+a.port),a.path&&(b+=a.path),b}function g(i){var a=i,d=b(i);if(d){if(!d.path)return i;a=d.path}var j=a.charAt(0)==='/',e=a.split(/\/+/);for(var h,g=0,f=e.length-1;f>=0;f--)h=e[f],h==='.'?e.splice(f,1):h==='..'?g++:g>0&&(h===''?(e.splice(f+1,g),g=0):(e.splice(f,2),g--));return a=e.join('/'),a===''&&(a=j?'/':'.'),d?(d.path=a,c(d)):a}function h(h,d){h===''&&(h='.'),d===''&&(d='.');var f=b(d),a=b(h);if(a&&(h=a.path||'/'),f&&!f.scheme)return a&&(f.scheme=a.scheme),c(f);if(f||d.match(e))return d;if(a&&!a.host&&!a.path)return a.host=d,c(a);var i=d.charAt(0)==='/'?d:g(h.replace(/\/+$/,'')+'/'+d);return a?(a.path=i,c(a)):i}function j(a,c){a===''&&(a='.'),a=a.replace(/\/$/,'');var d=b(a);return c.charAt(0)=='/'&&d&&d.path=='/'?c.slice(1):c.indexOf(a+'/')===0?c.substr(a.length+1):c}function k(a){return'$'+a}function l(a){return a.substr(1)}function d(c,d){var a=c||'',b=d||'';return(a>b)-(a<b)}function n(b,c,e){var a;return a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a||e?a:(a=d(b.name,c.name),a?a:(a=b.generatedLine-c.generatedLine,a?a:b.generatedColumn-c.generatedColumn))))}function i(b,c,e){var a;return a=b.generatedLine-c.generatedLine,a?a:(a=b.generatedColumn-c.generatedColumn,a||e?a:(a=d(b.source,c.source),a?a:(a=b.originalLine-c.originalLine,a?a:(a=b.originalColumn-c.originalColumn,a?a:d(b.name,c.name)))))}a.getArg=m;var f=/^(?:([\w+\-.]+):)?\/\/(?:(\w+:\w+)@)?([\w.]*)(?::(\d+))?(\S*)$/,e=/^data:.+\,.+$/;a.urlParse=b,a.urlGenerate=c,a.normalize=g,a.join=h,a.relative=j,a.toSetString=k,a.fromSetString=l,a.compareByOriginalPositions=n,a.compareByGeneratedPositions=i})}),a.define('/node_modules/source-map/node_modules/amdefine/amdefine.js',function(b,f,g,d){'use strict';function e(e,i){'use strict';function q(b){var a,c;for(a=0;b[a];a+=1)if(c=b[a],c==='.')b.splice(a,1),a-=1;else if(c==='..')if(a===1&&(b[2]==='..'||b[0]==='..'))break;else a>0&&(b.splice(a-1,2),a-=2)}function j(b,c){var a;return b&&b.charAt(0)==='.'&&c&&(a=c.split('/'),a=a.slice(0,a.length-1),a=a.concat(b.split('/')),q(a),b=a.join('/')),b}function p(a){return function(b){return j(b,a)}}function o(c){function a(a){b[c]=a}return a.fromText=function(a,b){throw new Error('amdefine does not implement load.fromText')},a}function m(c,h,l){var m,f,a,j;if(c)f=b[c]={},a={id:c,uri:d,exports:f},m=g(i,f,a,c);else{if(k)throw new Error('amdefine with no module ID cannot be called more than once per file.');k=!0,f=e.exports,a=e,m=g(i,f,a,e.id)}h&&(h=h.map(function(a){return m(a)})),typeof l==='function'?j=l.apply(a.exports,h):j=l,j!==undefined&&(a.exports=j,c&&(b[c]=a.exports))}function l(b,a,c){Array.isArray(b)?(c=a,a=b,b=undefined):typeof b!=='string'&&(c=b,b=a=undefined),a&&!Array.isArray(a)&&(c=a,a=undefined),a||(a=['require','exports','module']),b?f[b]=[b,a,c]:m(b,a,c)}var f={},b={},k=!1,n=a('path',e),g,h;return g=function(b,d,a,e){function f(f,g){if(typeof f==='string')return h(b,d,a,f,e);f=f.map(function(c){return h(b,d,a,c,e)}),c.nextTick(function(){g.apply(null,f)})}return f.toUrl=function(b){return b.indexOf('.')===0?j(b,n.dirname(a.filename)):b},f},i=i||function a(){return e.require.apply(e,arguments)},h=function(d,e,i,a,c){var k=a.indexOf('!'),n=a,q,l;if(k===-1)if(a=j(a,c),a==='require')return g(d,e,i,c);else if(a==='exports')return e;else if(a==='module')return i;else if(b.hasOwnProperty(a))return b[a];else if(f[a])return m.apply(null,f[a]),b[a];else if(d)return d(n);else throw new Error('No module with ID: '+a);else return q=a.substring(0,k),a=a.substring(k+1,a.length),l=h(d,e,i,q,c),l.normalize?a=l.normalize(a,p(c)):a=j(a,c),b[a]?b[a]:(l.load(a,g(d,e,i,c),o(a),{}),b[a])},l.require=function(a){return b[a]?b[a]:f[a]?(m.apply(null,f[a]),b[a]):void 0},l.amd={},l}b.exports=e}),a.define('/node_modules/source-map/lib/source-map/source-map-generator.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,g,f){function b(b){b||(b={}),this._file=a.getArg(b,'file',null),this._sourceRoot=a.getArg(b,'sourceRoot',null),this._sources=new d,this._names=new d,this._mappings=[],this._sourcesContents=null}var c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f),a=e('/node_modules/source-map/lib/source-map/util.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet;b.prototype._version=3,b.fromSourceMap=function c(d){var e=d.sourceRoot,f=new b({file:d.file,sourceRoot:e});return d.eachMapping(function(b){var c={generated:{line:b.generatedLine,column:b.generatedColumn}};b.source!=null&&(c.source=b.source,e!=null&&(c.source=a.relative(e,c.source)),c.original={line:b.originalLine,column:b.originalColumn},b.name!=null&&(c.name=b.name)),f.addMapping(c)}),d.sources.forEach(function(b){var a=d.sourceContentFor(b);a!=null&&f.setSourceContent(b,a)}),f},b.prototype.addMapping=function b(f){var g=a.getArg(f,'generated'),c=a.getArg(f,'original',null),d=a.getArg(f,'source',null),e=a.getArg(f,'name',null);this._validateMapping(g,c,d,e),d!=null&&!this._sources.has(d)&&this._sources.add(d),e!=null&&!this._names.has(e)&&this._names.add(e),this._mappings.push({generatedLine:g.line,generatedColumn:g.column,originalLine:c!=null&&c.line,originalColumn:c!=null&&c.column,source:d,name:e})},b.prototype.setSourceContent=function b(e,d){var c=e;this._sourceRoot!=null&&(c=a.relative(this._sourceRoot,c)),d!=null?(this._sourcesContents||(this._sourcesContents={}),this._sourcesContents[a.toSetString(c)]=d):(delete this._sourcesContents[a.toSetString(c)],Object.keys(this._sourcesContents).length===0&&(this._sourcesContents=null))},b.prototype.applySourceMap=function b(e,j,g){var f=j;if(j==null){if(e.file==null)throw new Error('SourceMapGenerator.prototype.applySourceMap requires either an explicit source file, or the source map\'s "file" property. Both were omitted.');f=e.file}var c=this._sourceRoot;c!=null&&(f=a.relative(c,f));var h=new d,i=new d;this._mappings.forEach(function(b){if(b.source===f&&b.originalLine!=null){var d=e.originalPositionFor({line:b.originalLine,column:b.originalColumn});d.source!=null&&(b.source=d.source,g!=null&&(b.source=a.join(g,b.source)),c!=null&&(b.source=a.relative(c,b.source)),b.originalLine=d.line,b.originalColumn=d.column,d.name!=null&&b.name!=null&&(b.name=d.name))}var j=b.source;j!=null&&!h.has(j)&&h.add(j);var k=b.name;k!=null&&!i.has(k)&&i.add(k)},this),this._sources=h,this._names=i,e.sources.forEach(function(b){var d=e.sourceContentFor(b);d!=null&&(g!=null&&(b=a.join(g,b)),c!=null&&(b=a.relative(c,b)),this.setSourceContent(b,d))},this)},b.prototype._validateMapping=function a(b,c,d,e){if(b&&'line'in b&&'column'in b&&b.line>0&&b.column>=0&&!c&&!d&&!e)return;else if(b&&'line'in b&&'column'in b&&c&&'line'in c&&'column'in c&&b.line>0&&b.column>=0&&c.line>0&&c.column>=0&&d)return;else throw new Error('Invalid mapping: '+JSON.stringify({generated:b,source:d,original:c,name:e}))},b.prototype._serializeMappings=function b(){var h=0,g=1,j=0,k=0,i=0,l=0,e='',d;this._mappings.sort(a.compareByGeneratedPositions);for(var f=0,m=this._mappings.length;f<m;f++){if(d=this._mappings[f],d.generatedLine!==g){h=0;while(d.generatedLine!==g)e+=';',g++}else if(f>0){if(!a.compareByGeneratedPositions(d,this._mappings[f-1]))continue;e+=','}e+=c.encode(d.generatedColumn-h),h=d.generatedColumn,d.source!=null&&(e+=c.encode(this._sources.indexOf(d.source)-l),l=this._sources.indexOf(d.source),e+=c.encode(d.originalLine-1-k),k=d.originalLine-1,e+=c.encode(d.originalColumn-j),j=d.originalColumn,d.name!=null&&(e+=c.encode(this._names.indexOf(d.name)-i),i=this._names.indexOf(d.name)))}return e},b.prototype._generateSourcesContent=function b(d,c){return d.map(function(b){if(!this._sourcesContents)return null;c!=null&&(b=a.relative(c,b));var d=a.toSetString(b);return Object.prototype.hasOwnProperty.call(this._sourcesContents,d)?this._sourcesContents[d]:null},this)},b.prototype.toJSON=function a(){var b={version:this._version,sources:this._sources.toArray(),names:this._names.toArray(),mappings:this._serializeMappings()};return this._file!=null&&(b.file=this._file),this._sourceRoot!=null&&(b.sourceRoot=this._sourceRoot),this._sourcesContents&&(b.sourcesContent=this._generateSourcesContent(b.sources,b.sourceRoot)),b},b.prototype.toString=function a(){return JSON.stringify(this)},g.SourceMapGenerator=b})}),a.define('/node_modules/source-map/lib/source-map/array-set.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,d,e){function a(){this._array=[],this._set={}}var b=c('/node_modules/source-map/lib/source-map/util.js',e);a.fromArray=function b(e,g){var d=new a;for(var c=0,f=e.length;c<f;c++)d.add(e[c],g);return d},a.prototype.add=function a(c,f){var d=this.has(c),e=this._array.length;(!d||f)&&this._array.push(c),d||(this._set[b.toSetString(c)]=e)},a.prototype.has=function a(c){return Object.prototype.hasOwnProperty.call(this._set,b.toSetString(c))},a.prototype.indexOf=function a(c){if(this.has(c))return this._set[b.toSetString(c)];throw new Error('"'+c+'" is not in the set.')},a.prototype.at=function a(b){if(b>=0&&b<this._array.length)return this._array[b];throw new Error('No element indexed by '+b)},a.prototype.toArray=function a(){return this._array.slice()},d.ArraySet=a})}),a.define('/node_modules/source-map/lib/source-map/base64-vlq.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(j,f,h){function i(a){return a<0?(-a<<1)+1:(a<<1)+0}function g(b){var c=(b&1)===1,a=b>>1;return c?-a:a}var c=j('/node_modules/source-map/lib/source-map/base64.js',h),a=5,d=1<<a,e=d-1,b=d;f.encode=function d(j){var g='',h,f=i(j);do h=f&e,f>>>=a,f>0&&(h|=b),g+=c.encode(h);while(f>0);return g},f.decode=function d(i){var f=0,l=i.length,j=0,k=0,m,h;do{if(f>=l)throw new Error('Expected more digits in base 64 VLQ value.');h=c.decode(i.charAt(f++)),m=!!(h&b),h&=e,j+=h<<k,k+=a}while(m);return{value:g(j),rest:i.slice(f)}}})}),a.define('/node_modules/source-map/lib/source-map/base64.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(d,c,e){var a={},b={};'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.split('').forEach(function(c,d){a[c]=d,b[d]=c}),c.encode=function a(c){if(c in b)return b[c];throw new TypeError('Must be between 0 and 63: '+c)},c.decode=function b(c){if(c in a)return a[c];throw new TypeError('Not a valid base 64 digit: '+c)}})}),a.define('/node_modules/source-map/lib/source-map/source-map-consumer.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(e,h,f){function b(c){var b=c;typeof c==='string'&&(b=JSON.parse(c.replace(/^\)\]\}'/,'')));var e=a.getArg(b,'version'),f=a.getArg(b,'sources'),g=a.getArg(b,'names',[]),h=a.getArg(b,'sourceRoot',null),i=a.getArg(b,'sourcesContent',null),j=a.getArg(b,'mappings'),k=a.getArg(b,'file',null);if(e!=this._version)throw new Error('Unsupported version: '+e);this._names=d.fromArray(g,!0),this._sources=d.fromArray(f,!0),this.sourceRoot=h,this.sourcesContent=i,this._mappings=j,this.file=k}var a=e('/node_modules/source-map/lib/source-map/util.js',f),g=e('/node_modules/source-map/lib/source-map/binary-search.js',f),d=e('/node_modules/source-map/lib/source-map/array-set.js',f).ArraySet,c=e('/node_modules/source-map/lib/source-map/base64-vlq.js',f);b.fromSourceMap=function c(f){var e=Object.create(b.prototype);return e._names=d.fromArray(f._names.toArray(),!0),e._sources=d.fromArray(f._sources.toArray(),!0),e.sourceRoot=f._sourceRoot,e.sourcesContent=f._generateSourcesContent(e._sources.toArray(),e.sourceRoot),e.file=f._file,e.__generatedMappings=f._mappings.slice().sort(a.compareByGeneratedPositions),e.__originalMappings=f._mappings.slice().sort(a.compareByOriginalPositions),e},b.prototype._version=3,Object.defineProperty(b.prototype,'sources',{get:function(){return this._sources.toArray().map(function(b){return this.sourceRoot!=null?a.join(this.sourceRoot,b):b},this)}}),b.prototype.__generatedMappings=null,Object.defineProperty(b.prototype,'_generatedMappings',{get:function(){return this.__generatedMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__generatedMappings}}),b.prototype.__originalMappings=null,Object.defineProperty(b.prototype,'_originalMappings',{get:function(){return this.__originalMappings||(this.__generatedMappings=[],this.__originalMappings=[],this._parseMappings(this._mappings,this.sourceRoot)),this.__originalMappings}}),b.prototype._parseMappings=function b(n,o){var j=1,h=0,i=0,m=0,k=0,l=0,g=/^[,;]/,d=n,f,e;while(d.length>0)if(d.charAt(0)===';')j++,d=d.slice(1),h=0;else if(d.charAt(0)===',')d=d.slice(1);else{if(f={},f.generatedLine=j,e=c.decode(d),f.generatedColumn=h+e.value,h=f.generatedColumn,d=e.rest,d.length>0&&!g.test(d.charAt(0))){if(e=c.decode(d),f.source=this._sources.at(k+e.value),k+=e.value,d=e.rest,d.length===0||g.test(d.charAt(0)))throw new Error('Found a source, but no line and column');if(e=c.decode(d),f.originalLine=i+e.value,i=f.originalLine,f.originalLine+=1,d=e.rest,d.length===0||g.test(d.charAt(0)))throw new Error('Found a source and line, but no column');e=c.decode(d),f.originalColumn=m+e.value,m=f.originalColumn,d=e.rest,d.length>0&&!g.test(d.charAt(0))&&(e=c.decode(d),f.name=this._names.at(l+e.value),l+=e.value,d=e.rest)}this.__generatedMappings.push(f),typeof f.originalLine==='number'&&this.__originalMappings.push(f)}this.__generatedMappings.sort(a.compareByGeneratedPositions),this.__originalMappings.sort(a.compareByOriginalPositions)},b.prototype._findMapping=function a(b,e,c,d,f){if(b[c]<=0)throw new TypeError('Line must be greater than or equal to 1, got '+b[c]);if(b[d]<0)throw new TypeError('Column must be greater than or equal to 0, got '+b[d]);return g.search(b,e,f)},b.prototype.originalPositionFor=function b(f){var e={generatedLine:a.getArg(f,'line'),generatedColumn:a.getArg(f,'column')},c=this._findMapping(e,this._generatedMappings,'generatedLine','generatedColumn',a.compareByGeneratedPositions);if(c&&c.generatedLine===e.generatedLine){var d=a.getArg(c,'source',null);return d!=null&&this.sourceRoot!=null&&(d=a.join(this.sourceRoot,d)),{source:d,line:a.getArg(c,'originalLine',null),column:a.getArg(c,'originalColumn',null),name:a.getArg(c,'name',null)}}return{source:null,line:null,column:null,name:null}},b.prototype.sourceContentFor=function b(c){if(!this.sourcesContent)return null;if(this.sourceRoot!=null&&(c=a.relative(this.sourceRoot,c)),this._sources.has(c))return this.sourcesContent[this._sources.indexOf(c)];var d;if(this.sourceRoot!=null&&(d=a.urlParse(this.sourceRoot))){var e=c.replace(/^file:\/\//,'');if(d.scheme=='file'&&this._sources.has(e))return this.sourcesContent[this._sources.indexOf(e)];if((!d.path||d.path=='/')&&this._sources.has('/'+c))return this.sourcesContent[this._sources.indexOf('/'+c)]}throw new Error('"'+c+'" is not in the SourceMap.')},b.prototype.generatedPositionFor=function b(e){var c={source:a.getArg(e,'source'),originalLine:a.getArg(e,'line'),originalColumn:a.getArg(e,'column')};this.sourceRoot!=null&&(c.source=a.relative(this.sourceRoot,c.source));var d=this._findMapping(c,this._originalMappings,'originalLine','originalColumn',a.compareByOriginalPositions);return d?{line:a.getArg(d,'generatedLine',null),column:a.getArg(d,'generatedColumn',null)}:{line:null,column:null}},b.GENERATED_ORDER=1,b.ORIGINAL_ORDER=2,b.prototype.eachMapping=function c(h,i,j){var f=i||null,g=j||b.GENERATED_ORDER,d;switch(g){case b.GENERATED_ORDER:d=this._generatedMappings;break;case b.ORIGINAL_ORDER:d=this._originalMappings;break;default:throw new Error('Unknown order of iteration.')}var e=this.sourceRoot;d.map(function(b){var c=b.source;return c!=null&&e!=null&&(c=a.join(e,c)),{source:c,generatedLine:b.generatedLine,generatedColumn:b.generatedColumn,originalLine:b.originalLine,originalColumn:b.originalColumn,name:b.name}}).forEach(h,f)},h.SourceMapConsumer=b})}),a.define('/node_modules/source-map/lib/source-map/binary-search.js',function(c,d,e,f){if(typeof b!=='function')var b=a('/node_modules/source-map/node_modules/amdefine/amdefine.js',c)(c,a);b(function(c,b,d){function a(c,e,f,d,g){var b=Math.floor((e-c)/2)+c,h=g(f,d[b],!0);return h===0?d[b]:h>0?e-b>1?a(b,e,f,d,g):d[b]:b-c>1?a(c,b,f,d,g):c<0?null:d[c]}b.search=function b(d,c,e){return c.length>0?a(-1,c.length,d,c,e):null}})}),a.define('/node_modules/esutils/lib/utils.js',function(b,c,d,e){!function(){'use strict';c.ast=a('/node_modules/esutils/lib/ast.js',b),c.code=a('/node_modules/esutils/lib/code.js',b),c.keyword=a('/node_modules/esutils/lib/keyword.js',b)}()}),a.define('/node_modules/esutils/lib/keyword.js',function(b,c,d,e){!function(d){'use strict';function i(a){switch(a){case'implements':case'interface':case'package':case'private':case'protected':case'public':case'static':case'let':return!0;default:return!1}}function g(a,b){return!b&&a==='yield'?!1:c(a,b)}function c(a,b){if(b&&i(a))return!0;switch(a.length){case 2:return a==='if'||a==='in'||a==='do';case 3:return a==='var'||a==='for'||a==='new'||a==='try';case 4:return a==='this'||a==='else'||a==='case'||a==='void'||a==='with'||a==='enum';case 5:return a==='while'||a==='break'||a==='catch'||a==='throw'||a==='const'||a==='yield'||a==='class'||a==='super';case 6:return a==='return'||a==='typeof'||a==='delete'||a==='switch'||a==='export'||a==='import';case 7:return a==='default'||a==='finally'||a==='extends';case 8:return a==='function'||a==='continue'||a==='debugger';case 10:return a==='instanceof';default:return!1}}function f(a,b){return a==='null'||a==='true'||a==='false'||g(a,b)}function h(a,b){return a==='null'||a==='true'||a==='false'||c(a,b)}function j(a){return a==='eval'||a==='arguments'}function e(b){var c,e,a;if(b.length===0)return!1;if(a=b.charCodeAt(0),!d.isIdentifierStart(a)||a===92)return!1;for(c=1,e=b.length;c<e;++c)if(a=b.charCodeAt(c),!d.isIdentifierPart(a)||a===92)return!1;return!0}function l(a,b){return e(a)&&!f(a,b)}function k(a,b){return e(a)&&!h(a,b)}d=a('/node_modules/esutils/lib/code.js',b),b.exports={isKeywordES5:g,isKeywordES6:c,isReservedWordES5:f,isReservedWordES6:h,isRestrictedWord:j,isIdentifierName:e,isIdentifierES5:l,isIdentifierES6:k}}()}),a.define('/node_modules/esutils/lib/code.js',function(a,b,c,d){!function(b){'use strict';function c(a){return a>=48&&a<=57}function d(a){return c(a)||97<=a&&a<=102||65<=a&&a<=70}function e(a){return a>=48&&a<=55}function f(a){return a===32||a===9||a===11||a===12||a===160||a>=5760&&[5760,6158,8192,8193,8194,8195,8196,8197,8198,8199,8200,8201,8202,8239,8287,12288,65279].indexOf(a)>=0}function g(a){return a===10||a===13||a===8232||a===8233}function h(a){return a===36||a===95||a>=65&&a<=90||a>=97&&a<=122||a===92||a>=128&&b.NonAsciiIdentifierStart.test(String.fromCharCode(a))}function i(a){return a===36||a===95||a>=65&&a<=90||a>=97&&a<=122||a>=48&&a<=57||a===92||a>=128&&b.NonAsciiIdentifierPart.test(String.fromCharCode(a))}b={NonAsciiIdentifierStart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԧԱ-Ֆՙա-ևא-תװ-ײؠ-يٮٯٱ-ۓەۥۦۮۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴߵߺࠀ-ࠕࠚࠤࠨࡀ-ࡘࢠࢢ-ࢬऄ-हऽॐक़-ॡॱ-ॷॹ-ॿঅ-ঌএঐও-নপ-রলশ-হঽৎড়ঢ়য়-ৡৰৱਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલળવ-હઽૐૠૡଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହଽଡ଼ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘౙౠౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠೡೱೲഅ-ഌഎ-ഐഒ-ഺഽൎൠൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะาำเ-ๆກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ະາຳຽເ-ໄໆໜ-ໟༀཀ-ཇཉ-ཬྈ-ྌက-ဪဿၐ-ၕၚ-ၝၡၥၦၮ-ၰၵ-ႁႎႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᢰ-ᣵᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦫᧁ-ᧇᨀ-ᨖᨠ-ᩔᪧᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮᮯᮺ-ᯥᰀ-ᰣᱍ-ᱏᱚ-ᱽᳩ-ᳬᳮ-ᳱᳵᳶᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₜℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳮⳲⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-〇〡-〩〱-〵〸-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘟꘪꘫꙀ-ꙮꙿ-ꚗꚠ-ꛯꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꣲ-ꣷꣻꤊ-ꤥꤰ-ꥆꥠ-ꥼꦄ-ꦲꧏꨀ-ꨨꩀ-ꩂꩄ-ꩋꩠ-ꩶꩺꪀ-ꪯꪱꪵꪶꪹ-ꪽꫀꫂꫛ-ꫝꫠ-ꫪꫲ-ꫴꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯢ가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]'),NonAsciiIdentifierPart:new RegExp('[ªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮ̀-ʹͶͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁ҃-҇Ҋ-ԧԱ-Ֆՙա-և֑-ׇֽֿׁׂׅׄא-תװ-ײؐ-ؚؠ-٩ٮ-ۓە-ۜ۟-۪ۨ-ۼۿܐ-݊ݍ-ޱ߀-ߵߺࠀ-࠭ࡀ-࡛ࢠࢢ-ࢬࣤ-ࣾऀ-ॣ०-९ॱ-ॷॹ-ॿঁ-ঃঅ-ঌএঐও-নপ-রলশ-হ়-ৄেৈো-ৎৗড়ঢ়য়-ৣ০-ৱਁ-ਃਅ-ਊਏਐਓ-ਨਪ-ਰਲਲ਼ਵਸ਼ਸਹ਼ਾ-ੂੇੈੋ-੍ੑਖ਼-ੜਫ਼੦-ੵઁ-ઃઅ-ઍએ-ઑઓ-નપ-રલળવ-હ઼-ૅે-ૉો-્ૐૠ-ૣ૦-૯ଁ-ଃଅ-ଌଏଐଓ-ନପ-ରଲଳଵ-ହ଼-ୄେୈୋ-୍ୖୗଡ଼ଢ଼ୟ-ୣ୦-୯ୱஂஃஅ-ஊஎ-ஐஒ-கஙசஜஞடணதந-பம-ஹா-ூெ-ைொ-்ௐௗ௦-௯ఁ-ఃఅ-ఌఎ-ఐఒ-నప-ళవ-హఽ-ౄె-ైొ-్ౕౖౘౙౠ-ౣ౦-౯ಂಃಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹ಼-ೄೆ-ೈೊ-್ೕೖೞೠ-ೣ೦-೯ೱೲംഃഅ-ഌഎ-ഐഒ-ഺഽ-ൄെ-ൈൊ-ൎൗൠ-ൣ൦-൯ൺ-ൿංඃඅ-ඖක-නඳ-රලව-ෆ්ා-ුූෘ-ෟෲෳก-ฺเ-๎๐-๙ກຂຄງຈຊຍດ-ທນ-ຟມ-ຣລວສຫອ-ູົ-ຽເ-ໄໆ່-ໍ໐-໙ໜ-ໟༀ༘༙༠-༩༹༵༷༾-ཇཉ-ཬཱ-྄྆-ྗྙ-ྼ࿆က-၉ၐ-ႝႠ-ჅჇჍა-ჺჼ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ፝-፟ᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙿᚁ-ᚚᚠ-ᛪᛮ-ᛰᜀ-ᜌᜎ-᜔ᜠ-᜴ᝀ-ᝓᝠ-ᝬᝮ-ᝰᝲᝳក-៓ៗៜ៝០-៩᠋-᠍᠐-᠙ᠠ-ᡷᢀ-ᢪᢰ-ᣵᤀ-ᤜᤠ-ᤫᤰ-᤻᥆-ᥭᥰ-ᥴᦀ-ᦫᦰ-ᧉ᧐-᧙ᨀ-ᨛᨠ-ᩞ᩠-᩿᩼-᪉᪐-᪙ᪧᬀ-ᭋ᭐-᭙᭫-᭳ᮀ-᯳ᰀ-᰷᱀-᱉ᱍ-ᱽ᳐-᳔᳒-ᳶᴀ-ᷦ᷼-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ‌‍‿⁀⁔ⁱⁿₐ-ₜ⃐-⃥⃜⃡-⃰ℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎⅠ-ↈⰀ-Ⱞⰰ-ⱞⱠ-ⳤⳫ-ⳳⴀ-ⴥⴧⴭⴰ-ⵧⵯ⵿-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⷠ-ⷿⸯ々-〇〡-〯〱-〵〸-〼ぁ-ゖ゙゚ゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆺㇰ-ㇿ㐀-䶵一-鿌ꀀ-ꒌꓐ-ꓽꔀ-ꘌꘐ-ꘫꙀ-꙯ꙴ-꙽ꙿ-ꚗꚟ-꛱ꜗ-ꜟꜢ-ꞈꞋ-ꞎꞐ-ꞓꞠ-Ɦꟸ-ꠧꡀ-ꡳꢀ-꣄꣐-꣙꣠-ꣷꣻ꤀-꤭ꤰ-꥓ꥠ-ꥼꦀ-꧀ꧏ-꧙ꨀ-ꨶꩀ-ꩍ꩐-꩙ꩠ-ꩶꩺꩻꪀ-ꫂꫛ-ꫝꫠ-ꫯꫲ-꫶ꬁ-ꬆꬉ-ꬎꬑ-ꬖꬠ-ꬦꬨ-ꬮꯀ-ꯪ꯬꯭꯰-꯹가-힣ힰ-ퟆퟋ-ퟻ豈-舘並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּסּףּפּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻ︀-️︠-︦︳︴﹍-﹏ﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚ＿ａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]')},a.exports={isDecimalDigit:c,isHexDigit:d,isOctalDigit:e,isWhiteSpace:f,isLineTerminator:g,isIdentifierStart:h,isIdentifierPart:i}}()}),a.define('/node_modules/esutils/lib/ast.js',function(a,b,c,d){!function(){'use strict';function d(a){if(a==null)return!1;switch(a.type){case'ArrayExpression':case'AssignmentExpression':case'BinaryExpression':case'CallExpression':case'ConditionalExpression':case'FunctionExpression':case'Identifier':case'Literal':case'LogicalExpression':case'MemberExpression':case'NewExpression':case'ObjectExpression':case'SequenceExpression':case'ThisExpression':case'UnaryExpression':case'UpdateExpression':return!0}return!1}function e(a){if(a==null)return!1;switch(a.type){case'DoWhileStatement':case'ForInStatement':case'ForStatement':case'WhileStatement':return!0}return!1}function b(a){if(a==null)return!1;switch(a.type){case'BlockStatement':case'BreakStatement':case'ContinueStatement':case'DebuggerStatement':case'DoWhileStatement':case'EmptyStatement':case'ExpressionStatement':case'ForInStatement':case'ForStatement':case'IfStatement':case'LabeledStatement':case'ReturnStatement':case'SwitchStatement':case'ThrowStatement':case'TryStatement':case'VariableDeclaration':case'WhileStatement':case'WithStatement':return!0}return!1}function f(a){return b(a)||a!=null&&a.type==='FunctionDeclaration'}function c(a){switch(a.type){case'IfStatement':return a.alternate!=null?a.alternate:a.consequent;case'LabeledStatement':case'ForStatement':case'ForInStatement':case'WhileStatement':case'WithStatement':return a.body}return null}function g(b){var a;if(b.type!=='IfStatement')return!1;if(b.alternate==null)return!1;a=b.consequent;do{if(a.type==='IfStatement'&&a.alternate==null)return!0;a=c(a)}while(a);return!1}a.exports={isExpression:d,isStatement:b,isIterationStatement:e,isSourceElement:f,isProblematicIfStatement:g,trailingStatement:c}}()}),a.define('/node_modules/estraverse/estraverse.js',function(b,a,c,d){!function(c,b){'use strict';typeof define==='function'&&define.amd?define(['exports'],b):a!==void 0?b(a):b(c.estraverse={})}(this,function(e){'use strict';function m(){}function l(d){var c={},a,b;for(a in d)d.hasOwnProperty(a)&&(b=d[a],typeof b==='object'&&b!==null?c[a]=l(b):c[a]=b);return c}function s(b){var c={},a;for(a in b)b.hasOwnProperty(a)&&(c[a]=b[a]);return c}function r(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?a=b:(c=d+1,a-=b+1);return c}function q(e,f){var b,a,c,d;a=e.length,c=0;while(a)b=a>>>1,d=c+b,f(e[d])?(c=d+1,a-=b+1):a=b;return c}function h(a,b){this.parent=a,this.key=b}function d(a,b,c,d){this.node=a,this.path=b,this.wrap=c,this.ref=d}function b(){}function k(c,d){var a=new b;return a.traverse(c,d)}function p(c,d){var a=new b;return a.replace(c,d)}function n(a,c){var b;return b=r(c,function b(c){return c.range[0]>a.range[0]}),a.extendedRange=[a.range[0],a.range[1]],b!==c.length&&(a.extendedRange[1]=c[b].range[0]),b-=1,b>=0&&(a.extendedRange[0]=c[b].range[1]),a}function o(d,e,i){var a=[],h,g,c,b;if(!d.range)throw new Error('attachComments needs range information');if(!i.length){if(e.length){for(c=0,g=e.length;c<g;c+=1)h=l(e[c]),h.extendedRange=[0,d.range[0]],a.push(h);d.leadingComments=a}return d}for(c=0,g=e.length;c<g;c+=1)a.push(n(l(e[c]),i));return b=0,k(d,{enter:function(c){var d;while(b<a.length){if(d=a[b],d.extendedRange[1]>c.range[0])break;d.extendedRange[1]===c.range[0]?(c.leadingComments||(c.leadingComments=[]),c.leadingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?f.Break:a[b].extendedRange[0]>c.range[1]?f.Skip:void 0}}),b=0,k(d,{leave:function(c){var d;while(b<a.length){if(d=a[b],c.range[1]<d.extendedRange[0])break;c.range[1]===d.extendedRange[0]?(c.trailingComments||(c.trailingComments=[]),c.trailingComments.push(d),a.splice(b,1)):b+=1}return b===a.length?f.Break:a[b].extendedRange[0]>c.range[1]?f.Skip:void 0}}),d}var i,g,f,j,a,c;i={AssignmentExpression:'AssignmentExpression',ArrayExpression:'ArrayExpression',ArrayPattern:'ArrayPattern',ArrowFunctionExpression:'ArrowFunctionExpression',BlockStatement:'BlockStatement',BinaryExpression:'BinaryExpression',BreakStatement:'BreakStatement',CallExpression:'CallExpression',CatchClause:'CatchClause',ClassBody:'ClassBody',ClassDeclaration:'ClassDeclaration',ClassExpression:'ClassExpression',ConditionalExpression:'ConditionalExpression',ContinueStatement:'ContinueStatement',DebuggerStatement:'DebuggerStatement',DirectiveStatement:'DirectiveStatement',DoWhileStatement:'DoWhileStatement',EmptyStatement:'EmptyStatement',ExpressionStatement:'ExpressionStatement',ForStatement:'ForStatement',ForInStatement:'ForInStatement',FunctionDeclaration:'FunctionDeclaration',FunctionExpression:'FunctionExpression',Identifier:'Identifier',IfStatement:'IfStatement',Literal:'Literal',LabeledStatement:'LabeledStatement',LogicalExpression:'LogicalExpression',MemberExpression:'MemberExpression',MethodDefinition:'MethodDefinition',NewExpression:'NewExpression',ObjectExpression:'ObjectExpression',ObjectPattern:'ObjectPattern',Program:'Program',Property:'Property',ReturnStatement:'ReturnStatement',SequenceExpression:'SequenceExpression',SwitchStatement:'SwitchStatement',SwitchCase:'SwitchCase',ThisExpression:'ThisExpression',ThrowStatement:'ThrowStatement',TryStatement:'TryStatement',UnaryExpression:'UnaryExpression',UpdateExpression:'UpdateExpression',VariableDeclaration:'VariableDeclaration',VariableDeclarator:'VariableDeclarator',WhileStatement:'WhileStatement',WithStatement:'WithStatement',YieldExpression:'YieldExpression'},g=Array.isArray,g||(g=function a(b){return Object.prototype.toString.call(b)==='[object Array]'}),m(s),m(q),j={AssignmentExpression:['left','right'],ArrayExpression:['elements'],ArrayPattern:['elements'],ArrowFunctionExpression:['params','defaults','rest','body'],BlockStatement:['body'],BinaryExpression:['left','right'],BreakStatement:['label'],CallExpression:['callee','arguments'],CatchClause:['param','body'],ClassBody:['body'],ClassDeclaration:['id','body','superClass'],ClassExpression:['id','body','superClass'],ConditionalExpression:['test','consequent','alternate'],ContinueStatement:['label'],DebuggerStatement:[],DirectiveStatement:[],DoWhileStatement:['body','test'],EmptyStatement:[],ExpressionStatement:['expression'],ForStatement:['init','test','update','body'],ForInStatement:['left','right','body'],ForOfStatement:['left','right','body'],FunctionDeclaration:['id','params','defaults','rest','body'],FunctionExpression:['id','params','defaults','rest','body'],Identifier:[],IfStatement:['test','consequent','alternate'],Literal:[],LabeledStatement:['label','body'],LogicalExpression:['left','right'],MemberExpression:['object','property'],MethodDefinition:['key','value'],NewExpression:['callee','arguments'],ObjectExpression:['properties'],ObjectPattern:['properties'],Program:['body'],Property:['key','value'],ReturnStatement:['argument'],SequenceExpression:['expressions'],SwitchStatement:['discriminant','cases'],SwitchCase:['test','consequent'],ThisExpression:[],ThrowStatement:['argument'],TryStatement:['block','handlers','handler','guardedHandlers','finalizer'],UnaryExpression:['argument'],UpdateExpression:['argument'],VariableDeclaration:['declarations'],VariableDeclarator:['id','init'],WhileStatement:['test','body'],WithStatement:['object','body'],YieldExpression:['argument']},a={},c={},f={Break:a,Skip:c},h.prototype.replace=function a(b){this.parent[this.key]=b},b.prototype.path=function a(){function e(b,a){if(g(a))for(c=0,h=a.length;c<h;++c)b.push(a[c]);else b.push(a)}var b,f,c,h,d,i;if(!this.__current.path)return null;for(d=[],b=2,f=this.__leavelist.length;b<f;++b)i=this.__leavelist[b],e(d,i.path);return e(d,this.__current.path),d},b.prototype.parents=function a(){var b,d,c;for(c=[],b=1,d=this.__leavelist.length;b<d;++b)c.push(this.__leavelist[b].node);return c},b.prototype.current=function a(){return this.__current.node},b.prototype.__execute=function a(c,d){var e,b;return b=undefined,e=this.__current,this.__current=d,this.__state=null,c&&(b=c.call(this,d.node,this.__leavelist[this.__leavelist.length-1].node)),this.__current=e,b},b.prototype.notify=function a(b){this.__state=b},b.prototype.skip=function(){this.notify(c)},b.prototype['break']=function(){this.notify(a)},b.prototype.__initialize=function(a,b){this.visitor=b,this.root=a,this.__worklist=[],this.__leavelist=[],this.__current=null,this.__state=null},b.prototype.traverse=function b(u,r){var h,o,e,t,n,l,m,p,k,q,f,s;this.__initialize(u,r),s={},h=this.__worklist,o=this.__leavelist,h.push(new d(u,null,null,null)),o.push(new d(null,null,null,null));while(h.length){if(e=h.pop(),e===s){if(e=o.pop(),l=this.__execute(r.leave,e),this.__state===a||l===a)return;continue}if(e.node){if(l=this.__execute(r.enter,e),this.__state===a||l===a)return;if(h.push(s),o.push(e),this.__state===c||l===c)continue;t=e.node,n=e.wrap||t.type,q=j[n],p=q.length;while((p-=1)>=0){if(m=q[p],f=t[m],!f)continue;if(!g(f)){h.push(new d(f,m,null,null));continue}k=f.length;while((k-=1)>=0){if(!f[k])continue;(n===i.ObjectExpression||n===i.ObjectPattern)&&'properties'===q[p]?e=new d(f[k],[m,k],'Property',null):e=new d(f[k],[m,k],null,null),h.push(e)}}}}},b.prototype.replace=function b(u,v){var m,r,o,t,f,e,q,l,s,k,w,p,n;this.__initialize(u,v),w={},m=this.__worklist,r=this.__leavelist,p={root:u},e=new d(u,null,null,new h(p,'root')),m.push(e),r.push(e);while(m.length){if(e=m.pop(),e===w){if(e=r.pop(),f=this.__execute(v.leave,e),f!==undefined&&f!==a&&f!==c&&e.ref.replace(f),this.__state===a||f===a)return p.root;continue}if(f=this.__execute(v.enter,e),f!==undefined&&f!==a&&f!==c&&(e.ref.replace(f),e.node=f),this.__state===a||f===a)return p.root;if(o=e.node,!o)continue;if(m.push(w),r.push(e),this.__state===c||f===c)continue;t=e.wrap||o.type,s=j[t],q=s.length;while((q-=1)>=0){if(n=s[q],k=o[n],!k)continue;if(!g(k)){m.push(new d(k,n,null,new h(o,n)));continue}l=k.length;while((l-=1)>=0){if(!k[l])continue;t===i.ObjectExpression&&'properties'===s[q]?e=new d(k[l],[n,l],'Property',new h(k,l)):e=new d(k[l],[n,l],null,new h(k,l)),m.push(e)}}}return p.root},e.version='1.5.1-dev',e.Syntax=i,e.traverse=k,e.replace=p,e.attachComments=o,e.VisitorKeys=j,e.VisitorOption=f,e.Controller=b})}),a('/tools/entry-point.js')}.call(this,this))
;
// Acorn is a tiny, fast JavaScript parser written in JavaScript.
//
// Acorn was written by Marijn Haverbeke and various contributors and
// released under an MIT license. The Unicode regexps (for identifiers
// and whitespace) were taken from [Esprima](http://esprima.org) by
// Ariya Hidayat.
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

(function(root, mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports); // CommonJS
  if (typeof define == "function" && define.amd) return define(["exports"], mod); // AMD
  mod(root.acorn || (root.acorn = {})); // Plain browser env
})(this, function(exports) {
  "use strict";

  exports.version = "0.11.1";

  // The main exported interface (under `self.acorn` when in the
  // browser) is a `parse` function that takes a code string and
  // returns an abstract syntax tree as specified by [Mozilla parser
  // API][api], with the caveat that inline XML is not recognized.
  //
  // [api]: https://developer.mozilla.org/en-US/docs/SpiderMonkey/Parser_API

  var options, input, inputLen, sourceFile;

  exports.parse = function(inpt, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    initTokenState();
    var startPos = options.locations ? [tokPos, curPosition()] : tokPos;
    initParserState();
    return parseTopLevel(options.program || startNodeAt(startPos));
  };

  // A second optional argument can be given to further configure
  // the parser process. These options are recognized:

  var defaultOptions = exports.defaultOptions = {
    // `ecmaVersion` indicates the ECMAScript version to parse. Must
    // be either 3, or 5, or 6. This influences support for strict
    // mode, the set of reserved words, support for getters and
    // setters and other features.
    ecmaVersion: 5,
    // Turn on `strictSemicolons` to prevent the parser from doing
    // automatic semicolon insertion.
    strictSemicolons: false,
    // When `allowTrailingCommas` is false, the parser will not allow
    // trailing commas in array and object literals.
    allowTrailingCommas: true,
    // By default, reserved words are not enforced. Enable
    // `forbidReserved` to enforce them. When this option has the
    // value "everywhere", reserved words and keywords can also not be
    // used as property names.
    forbidReserved: false,
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
    preserveParens: false
  };

  // This function tries to parse a single expression at a given
  // offset in a string. Useful for parsing mixed-language formats
  // that embed JavaScript expressions.

  exports.parseExpressionAt = function(inpt, pos, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    initTokenState(pos);
    initParserState();
    return parseExpression();
  };

  var isArray = function (obj) {
    return Object.prototype.toString.call(obj) === "[object Array]";
  };

  function setOptions(opts) {
    options = {};
    for (var opt in defaultOptions)
      options[opt] = opts && has(opts, opt) ? opts[opt] : defaultOptions[opt];
    sourceFile = options.sourceFile || null;
    if (isArray(options.onToken)) {
      var tokens = options.onToken;
      options.onToken = function (token) {
        tokens.push(token);
      };
    }
    if (isArray(options.onComment)) {
      var comments = options.onComment;
      options.onComment = function (block, text, start, end, startLoc, endLoc) {
        var comment = {
          type: block ? 'Block' : 'Line',
          value: text,
          start: start,
          end: end
        };
        if (options.locations) {
          comment.loc = new SourceLocation();
          comment.loc.start = startLoc;
          comment.loc.end = endLoc;
        }
        if (options.ranges)
          comment.range = [start, end];
        comments.push(comment);
      };
    }
    isKeyword = options.ecmaVersion >= 6 ? isEcma6Keyword : isEcma5AndLessKeyword;
  }

  // The `getLineInfo` function is mostly useful when the
  // `locations` option is off (for performance reasons) and you
  // want to find the line/column position for a given character
  // offset. `input` should be the code string that the offset refers
  // into.

  var getLineInfo = exports.getLineInfo = function(input, offset) {
    for (var line = 1, cur = 0;;) {
      lineBreak.lastIndex = cur;
      var match = lineBreak.exec(input);
      if (match && match.index < offset) {
        ++line;
        cur = match.index + match[0].length;
      } else break;
    }
    return {line: line, column: offset - cur};
  };

  function Token() {
    this.type = tokType;
    this.value = tokVal;
    this.start = tokStart;
    this.end = tokEnd;
    if (options.locations) {
      this.loc = new SourceLocation();
      this.loc.end = tokEndLoc;
      // TODO: remove in next major release
      this.startLoc = tokStartLoc;
      this.endLoc = tokEndLoc;
    }
    if (options.ranges)
      this.range = [tokStart, tokEnd];
  }

  exports.Token = Token;

  // Acorn is organized as a tokenizer and a recursive-descent parser.
  // The `tokenize` export provides an interface to the tokenizer.
  // Because the tokenizer is optimized for being efficiently used by
  // the Acorn parser itself, this interface is somewhat crude and not
  // very modular. Performing another parse or call to `tokenize` will
  // reset the internal state, and invalidate existing tokenizers.

  exports.tokenize = function(inpt, opts) {
    input = String(inpt); inputLen = input.length;
    setOptions(opts);
    initTokenState();
    skipSpace();

    function getToken(forceRegexp) {
      lastEnd = tokEnd;
      readToken(forceRegexp);
      return new Token();
    }
    getToken.jumpTo = function(pos, reAllowed) {
      tokPos = pos;
      if (options.locations) {
        tokCurLine = 1;
        tokLineStart = lineBreak.lastIndex = 0;
        var match;
        while ((match = lineBreak.exec(input)) && match.index < pos) {
          ++tokCurLine;
          tokLineStart = match.index + match[0].length;
        }
      }
      tokRegexpAllowed = reAllowed;
      skipSpace();
    };
    getToken.noRegexp = function() {
      tokRegexpAllowed = false;
    };
    getToken.options = options;
    return getToken;
  };

  // State is kept in (closure-)global variables. We already saw the
  // `options`, `input`, and `inputLen` variables above.

  // The current position of the tokenizer in the input.

  var tokPos;

  // The start and end offsets of the current token.

  var tokStart, tokEnd;

  // When `options.locations` is true, these hold objects
  // containing the tokens start and end line/column pairs.

  var tokStartLoc, tokEndLoc;

  // The type and value of the current token. Token types are objects,
  // named by variables against which they can be compared, and
  // holding properties that describe them (indicating, for example,
  // the precedence of an infix operator, and the original name of a
  // keyword token). The kind of value that's held in `tokVal` depends
  // on the type of the token. For literals, it is the literal value,
  // for operators, the operator name, and so on.

  var tokType, tokVal;

  // Internal state for the tokenizer. To distinguish between division
  // operators and regular expressions, it remembers whether the last
  // token was one that is allowed to be followed by an expression.
  // (If it is, a slash is probably a regexp, if it isn't it's a
  // division operator. See the `parseStatement` function for a
  // caveat.)

  var tokRegexpAllowed;

  // When `options.locations` is true, these are used to keep
  // track of the current line, and know when a new line has been
  // entered.

  var tokCurLine, tokLineStart;

  // These store the position of the previous token, which is useful
  // when finishing a node and assigning its `end` position.

  var lastStart, lastEnd, lastEndLoc;

  // This is the parser's state. `inFunction` is used to reject
  // `return` statements outside of functions, `inGenerator` to
  // reject `yield`s outside of generators, `labels` to verify
  // that `break` and `continue` have somewhere to jump to, and
  // `strict` indicates whether strict mode is on.

  var inFunction, inGenerator, labels, strict;

  // This counter is used for checking that arrow expressions did
  // not contain nested parentheses in argument list.

  var metParenL;

  // This is used by the tokenizer to track the template strings it is
  // inside, and count the amount of open braces seen inside them, to
  // be able to switch back to a template token when the } to match ${
  // is encountered. It will hold an array of integers.

  var templates;

  function initParserState() {
    lastStart = lastEnd = tokPos;
    if (options.locations) lastEndLoc = curPosition();
    inFunction = inGenerator = strict = false;
    labels = [];
    skipSpace();
    readToken();
  }

  // This function is used to raise exceptions on parse errors. It
  // takes an offset integer (into the current `input`) to indicate
  // the location of the error, attaches the position to the end
  // of the error message, and then raises a `SyntaxError` with that
  // message.

  function raise(pos, message) {
    var loc = getLineInfo(input, pos);
    message += " (" + loc.line + ":" + loc.column + ")";
    var err = new SyntaxError(message);
    err.pos = pos; err.loc = loc; err.raisedAt = tokPos;
    throw err;
  }

  // Reused empty array added for node fields that are always empty.

  var empty = [];

  // ## Token types

  // The assignment of fine-grained, information-carrying type objects
  // allows the tokenizer to store the information it has about a
  // token in a way that is very cheap for the parser to look up.

  // All token type variables start with an underscore, to make them
  // easy to recognize.

  // These are the general types. The `type` property is only used to
  // make them recognizeable when debugging.

  var _num = {type: "num"}, _regexp = {type: "regexp"}, _string = {type: "string"};
  var _name = {type: "name"}, _eof = {type: "eof"};

  // Keyword tokens. The `keyword` property (also used in keyword-like
  // operators) indicates that the token originated from an
  // identifier-like word, which is used when parsing property names.
  //
  // The `beforeExpr` property is used to disambiguate between regular
  // expressions and divisions. It is set on all token types that can
  // be followed by an expression (thus, a slash after them would be a
  // regular expression).
  //
  // `isLoop` marks a keyword as starting a loop, which is important
  // to know when parsing a label, in order to allow or disallow
  // continue jumps to that label.

  var _break = {keyword: "break"}, _case = {keyword: "case", beforeExpr: true}, _catch = {keyword: "catch"};
  var _continue = {keyword: "continue"}, _debugger = {keyword: "debugger"}, _default = {keyword: "default"};
  var _do = {keyword: "do", isLoop: true}, _else = {keyword: "else", beforeExpr: true};
  var _finally = {keyword: "finally"}, _for = {keyword: "for", isLoop: true}, _function = {keyword: "function"};
  var _if = {keyword: "if"}, _return = {keyword: "return", beforeExpr: true}, _switch = {keyword: "switch"};
  var _throw = {keyword: "throw", beforeExpr: true}, _try = {keyword: "try"}, _var = {keyword: "var"};
  var _let = {keyword: "let"}, _const = {keyword: "const"};
  var _while = {keyword: "while", isLoop: true}, _with = {keyword: "with"}, _new = {keyword: "new", beforeExpr: true};
  var _this = {keyword: "this"};
  var _class = {keyword: "class"}, _extends = {keyword: "extends", beforeExpr: true};
  var _export = {keyword: "export"}, _import = {keyword: "import"};
  var _yield = {keyword: "yield", beforeExpr: true};

  // The keywords that denote values.

  var _null = {keyword: "null", atomValue: null}, _true = {keyword: "true", atomValue: true};
  var _false = {keyword: "false", atomValue: false};

  // Some keywords are treated as regular operators. `in` sometimes
  // (when parsing `for`) needs to be tested against specifically, so
  // we assign a variable name to it for quick comparing.

  var _in = {keyword: "in", binop: 7, beforeExpr: true};

  // Map keyword names to token types.

  var keywordTypes = {"break": _break, "case": _case, "catch": _catch,
                      "continue": _continue, "debugger": _debugger, "default": _default,
                      "do": _do, "else": _else, "finally": _finally, "for": _for,
                      "function": _function, "if": _if, "return": _return, "switch": _switch,
                      "throw": _throw, "try": _try, "var": _var, "let": _let, "const": _const,
                      "while": _while, "with": _with,
                      "null": _null, "true": _true, "false": _false, "new": _new, "in": _in,
                      "instanceof": {keyword: "instanceof", binop: 7, beforeExpr: true}, "this": _this,
                      "typeof": {keyword: "typeof", prefix: true, beforeExpr: true},
                      "void": {keyword: "void", prefix: true, beforeExpr: true},
                      "delete": {keyword: "delete", prefix: true, beforeExpr: true},
                      "class": _class, "extends": _extends,
                      "export": _export, "import": _import, "yield": _yield};

  // Punctuation token types. Again, the `type` property is purely for debugging.

  var _bracketL = {type: "[", beforeExpr: true}, _bracketR = {type: "]"}, _braceL = {type: "{", beforeExpr: true};
  var _braceR = {type: "}"}, _parenL = {type: "(", beforeExpr: true}, _parenR = {type: ")"};
  var _comma = {type: ",", beforeExpr: true}, _semi = {type: ";", beforeExpr: true};
  var _colon = {type: ":", beforeExpr: true}, _dot = {type: "."}, _question = {type: "?", beforeExpr: true};
  var _arrow = {type: "=>", beforeExpr: true}, _template = {type: "template"}, _templateContinued = {type: "templateContinued"};
  var _ellipsis = {type: "...", prefix: true, beforeExpr: true};

  // Operators. These carry several kinds of properties to help the
  // parser use them properly (the presence of these properties is
  // what categorizes them as operators).
  //
  // `binop`, when present, specifies that this operator is a binary
  // operator, and will refer to its precedence.
  //
  // `prefix` and `postfix` mark the operator as a prefix or postfix
  // unary operator. `isUpdate` specifies that the node produced by
  // the operator should be of type UpdateExpression rather than
  // simply UnaryExpression (`++` and `--`).
  //
  // `isAssign` marks all of `=`, `+=`, `-=` etcetera, which act as
  // binary operators with a very low precedence, that should result
  // in AssignmentExpression nodes.

  var _slash = {binop: 10, beforeExpr: true}, _eq = {isAssign: true, beforeExpr: true};
  var _assign = {isAssign: true, beforeExpr: true};
  var _incDec = {postfix: true, prefix: true, isUpdate: true}, _prefix = {prefix: true, beforeExpr: true};
  var _logicalOR = {binop: 1, beforeExpr: true};
  var _logicalAND = {binop: 2, beforeExpr: true};
  var _bitwiseOR = {binop: 3, beforeExpr: true};
  var _bitwiseXOR = {binop: 4, beforeExpr: true};
  var _bitwiseAND = {binop: 5, beforeExpr: true};
  var _equality = {binop: 6, beforeExpr: true};
  var _relational = {binop: 7, beforeExpr: true};
  var _bitShift = {binop: 8, beforeExpr: true};
  var _plusMin = {binop: 9, prefix: true, beforeExpr: true};
  var _modulo = {binop: 10, beforeExpr: true};

  // '*' may be multiply or have special meaning in ES6
  var _star = {binop: 10, beforeExpr: true};

  // Provide access to the token types for external users of the
  // tokenizer.

  exports.tokTypes = {bracketL: _bracketL, bracketR: _bracketR, braceL: _braceL, braceR: _braceR,
                      parenL: _parenL, parenR: _parenR, comma: _comma, semi: _semi, colon: _colon,
                      dot: _dot, ellipsis: _ellipsis, question: _question, slash: _slash, eq: _eq,
                      name: _name, eof: _eof, num: _num, regexp: _regexp, string: _string,
                      arrow: _arrow, template: _template, templateContinued: _templateContinued, star: _star,
                      assign: _assign};
  for (var kw in keywordTypes) exports.tokTypes["_" + kw] = keywordTypes[kw];

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
    var f = "", cats = [];
    out: for (var i = 0; i < words.length; ++i) {
      for (var j = 0; j < cats.length; ++j)
        if (cats[j][0].length == words[i].length) {
          cats[j].push(words[i]);
          continue out;
        }
      cats.push([words[i]]);
    }
    function compareTo(arr) {
      if (arr.length == 1) return f += "return str === " + JSON.stringify(arr[0]) + ";";
      f += "switch(str){";
      for (var i = 0; i < arr.length; ++i) f += "case " + JSON.stringify(arr[i]) + ":";
      f += "return true}return false;";
    }

    // When there are more than three length categories, an outer
    // switch first dispatches on the lengths, to save on comparisons.

    if (cats.length > 3) {
      cats.sort(function(a, b) {return b.length - a.length;});
      f += "switch(str.length){";
      for (var i = 0; i < cats.length; ++i) {
        var cat = cats[i];
        f += "case " + cat[0].length + ":";
        compareTo(cat);
      }
      f += "}";

    // Otherwise, simply generate a flat `switch` statement.

    } else {
      compareTo(words);
    }
    return new Function("str", f);
  }

  // The ECMAScript 3 reserved word list.

  var isReservedWord3 = makePredicate("abstract boolean byte char class double enum export extends final float goto implements import int interface long native package private protected public short static super synchronized throws transient volatile");

  // ECMAScript 5 reserved words.

  var isReservedWord5 = makePredicate("class enum extends super const export import");

  // The additional reserved words in strict mode.

  var isStrictReservedWord = makePredicate("implements interface let package private protected public static yield");

  // The forbidden variable names in strict mode.

  var isStrictBadIdWord = makePredicate("eval arguments");

  // And the keywords.

  var ecma5AndLessKeywords = "break case catch continue debugger default do else finally for function if return switch throw try var while with null true false instanceof typeof void delete new in this";

  var isEcma5AndLessKeyword = makePredicate(ecma5AndLessKeywords);

  var isEcma6Keyword = makePredicate(ecma5AndLessKeywords + " let const class extends export import yield");

  var isKeyword = isEcma5AndLessKeyword;

  // ## Character categories

  // Big ugly regular expressions that match characters in the
  // whitespace, identifier, and identifier-start categories. These
  // are only applied when a character is found to actually have a
  // code point above 128.
  // Generated by `tools/generate-identifier-regex.js`.

  var nonASCIIwhitespace = /[\u1680\u180e\u2000-\u200a\u202f\u205f\u3000\ufeff]/;
  var nonASCIIidentifierStartChars = "\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC";
  var nonASCIIidentifierChars = "\u0300-\u036F\u0483-\u0487\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u0610-\u061A\u064B-\u0669\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED\u06F0-\u06F9\u0711\u0730-\u074A\u07A6-\u07B0\u07C0-\u07C9\u07EB-\u07F3\u0816-\u0819\u081B-\u0823\u0825-\u0827\u0829-\u082D\u0859-\u085B\u08E4-\u0903\u093A-\u093C\u093E-\u094F\u0951-\u0957\u0962\u0963\u0966-\u096F\u0981-\u0983\u09BC\u09BE-\u09C4\u09C7\u09C8\u09CB-\u09CD\u09D7\u09E2\u09E3\u09E6-\u09EF\u0A01-\u0A03\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A66-\u0A71\u0A75\u0A81-\u0A83\u0ABC\u0ABE-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AE2\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B3C\u0B3E-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B62\u0B63\u0B66-\u0B6F\u0B82\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C3E-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C62\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0CBC\u0CBE-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CE2\u0CE3\u0CE6-\u0CEF\u0D01-\u0D03\u0D3E-\u0D44\u0D46-\u0D48\u0D4A-\u0D4D\u0D57\u0D62\u0D63\u0D66-\u0D6F\u0D82\u0D83\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E50-\u0E59\u0EB1\u0EB4-\u0EB9\u0EBB\u0EBC\u0EC8-\u0ECD\u0ED0-\u0ED9\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E\u0F3F\u0F71-\u0F84\u0F86\u0F87\u0F8D-\u0F97\u0F99-\u0FBC\u0FC6\u102B-\u103E\u1040-\u1049\u1056-\u1059\u105E-\u1060\u1062-\u1064\u1067-\u106D\u1071-\u1074\u1082-\u108D\u108F-\u109D\u135D-\u135F\u1712-\u1714\u1732-\u1734\u1752\u1753\u1772\u1773\u17B4-\u17D3\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u18A9\u1920-\u192B\u1930-\u193B\u1946-\u194F\u19B0-\u19C0\u19C8\u19C9\u19D0-\u19D9\u1A17-\u1A1B\u1A55-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AB0-\u1ABD\u1B00-\u1B04\u1B34-\u1B44\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1B82\u1BA1-\u1BAD\u1BB0-\u1BB9\u1BE6-\u1BF3\u1C24-\u1C37\u1C40-\u1C49\u1C50-\u1C59\u1CD0-\u1CD2\u1CD4-\u1CE8\u1CED\u1CF2-\u1CF4\u1CF8\u1CF9\u1DC0-\u1DF5\u1DFC-\u1DFF\u200C\u200D\u203F\u2040\u2054\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2CEF-\u2CF1\u2D7F\u2DE0-\u2DFF\u302A-\u302F\u3099\u309A\uA620-\uA629\uA66F\uA674-\uA67D\uA69F\uA6F0\uA6F1\uA802\uA806\uA80B\uA823-\uA827\uA880\uA881\uA8B4-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F1\uA900-\uA909\uA926-\uA92D\uA947-\uA953\uA980-\uA983\uA9B3-\uA9C0\uA9D0-\uA9D9\uA9E5\uA9F0-\uA9F9\uAA29-\uAA36\uAA43\uAA4C\uAA4D\uAA50-\uAA59\uAA7B-\uAA7D\uAAB0\uAAB2-\uAAB4\uAAB7\uAAB8\uAABE\uAABF\uAAC1\uAAEB-\uAAEF\uAAF5\uAAF6\uABE3-\uABEA\uABEC\uABED\uABF0-\uABF9\uFB1E\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFF10-\uFF19\uFF3F";
  var nonASCIIidentifierStart = new RegExp("[" + nonASCIIidentifierStartChars + "]");
  var nonASCIIidentifier = new RegExp("[" + nonASCIIidentifierStartChars + nonASCIIidentifierChars + "]");

  // Whether a single character denotes a newline.

  var newline = /[\n\r\u2028\u2029]/;

  function isNewLine(code) {
    return code === 10 || code === 13 || code === 0x2028 || code == 0x2029;
  }

  // Matches a whole line break (where CRLF is considered a single
  // line break). Used to count lines.

  var lineBreak = /\r\n|[\n\r\u2028\u2029]/g;

  // Test whether a given character code starts an identifier.

  var isIdentifierStart = exports.isIdentifierStart = function(code) {
    if (code < 65) return code === 36;
    if (code < 91) return true;
    if (code < 97) return code === 95;
    if (code < 123)return true;
    return code >= 0xaa && nonASCIIidentifierStart.test(String.fromCharCode(code));
  };

  // Test whether a given character is part of an identifier.

  var isIdentifierChar = exports.isIdentifierChar = function(code) {
    if (code < 48) return code === 36;
    if (code < 58) return true;
    if (code < 65) return false;
    if (code < 91) return true;
    if (code < 97) return code === 95;
    if (code < 123)return true;
    return code >= 0xaa && nonASCIIidentifier.test(String.fromCharCode(code));
  };

  // ## Tokenizer

  // These are used when `options.locations` is on, for the
  // `tokStartLoc` and `tokEndLoc` properties.

  function Position(line, col) {
    this.line = line;
    this.column = col;
  }

  Position.prototype.offset = function(n) {
    return new Position(this.line, this.column + n);
  }

  function curPosition() {
    return new Position(tokCurLine, tokPos - tokLineStart);
  }

  // Reset the token state. Used at the start of a parse.

  function initTokenState(pos) {
    if (pos) {
      tokPos = pos;
      tokLineStart = Math.max(0, input.lastIndexOf("\n", pos));
      tokCurLine = input.slice(0, tokLineStart).split(newline).length;
    } else {
      tokCurLine = 1;
      tokPos = tokLineStart = 0;
    }
    tokRegexpAllowed = true;
    metParenL = 0;
    templates = [];
    if (tokPos === 0 && options.allowHashBang && input.slice(0, 2) === '#!') {
      skipLineComment(2);
    }
  }

  // Called at the end of every token. Sets `tokEnd`, `tokVal`, and
  // `tokRegexpAllowed`, and skips the space after the token, so that
  // the next one's `tokStart` will point at the right position.

  function finishToken(type, val, shouldSkipSpace) {
    tokEnd = tokPos;
    if (options.locations) tokEndLoc = curPosition();
    tokType = type;
    if (shouldSkipSpace !== false) skipSpace();
    tokVal = val;
    tokRegexpAllowed = type.beforeExpr;
    if (options.onToken) {
      options.onToken(new Token());
    }
  }

  function skipBlockComment() {
    var startLoc = options.onComment && options.locations && curPosition();
    var start = tokPos, end = input.indexOf("*/", tokPos += 2);
    if (end === -1) raise(tokPos - 2, "Unterminated comment");
    tokPos = end + 2;
    if (options.locations) {
      lineBreak.lastIndex = start;
      var match;
      while ((match = lineBreak.exec(input)) && match.index < tokPos) {
        ++tokCurLine;
        tokLineStart = match.index + match[0].length;
      }
    }
    if (options.onComment)
      options.onComment(true, input.slice(start + 2, end), start, tokPos,
                        startLoc, options.locations && curPosition());
  }

  function skipLineComment(startSkip) {
    var start = tokPos;
    var startLoc = options.onComment && options.locations && curPosition();
    var ch = input.charCodeAt(tokPos+=startSkip);
    while (tokPos < inputLen && ch !== 10 && ch !== 13 && ch !== 8232 && ch !== 8233) {
      ++tokPos;
      ch = input.charCodeAt(tokPos);
    }
    if (options.onComment)
      options.onComment(false, input.slice(start + startSkip, tokPos), start, tokPos,
                        startLoc, options.locations && curPosition());
  }

  // Called at the start of the parse and after every token. Skips
  // whitespace and comments, and.

  function skipSpace() {
    while (tokPos < inputLen) {
      var ch = input.charCodeAt(tokPos);
      if (ch === 32) { // ' '
        ++tokPos;
      } else if (ch === 13) {
        ++tokPos;
        var next = input.charCodeAt(tokPos);
        if (next === 10) {
          ++tokPos;
        }
        if (options.locations) {
          ++tokCurLine;
          tokLineStart = tokPos;
        }
      } else if (ch === 10 || ch === 8232 || ch === 8233) {
        ++tokPos;
        if (options.locations) {
          ++tokCurLine;
          tokLineStart = tokPos;
        }
      } else if (ch > 8 && ch < 14) {
        ++tokPos;
      } else if (ch === 47) { // '/'
        var next = input.charCodeAt(tokPos + 1);
        if (next === 42) { // '*'
          skipBlockComment();
        } else if (next === 47) { // '/'
          skipLineComment(2);
        } else break;
      } else if (ch === 160) { // '\xa0'
        ++tokPos;
      } else if (ch >= 5760 && nonASCIIwhitespace.test(String.fromCharCode(ch))) {
        ++tokPos;
      } else {
        break;
      }
    }
  }

  // ### Token reading

  // This is the function that is called to fetch the next token. It
  // is somewhat obscure, because it works in character codes rather
  // than characters, and because operator parsing has been inlined
  // into it.
  //
  // All in the name of speed.
  //
  // The `forceRegexp` parameter is used in the one case where the
  // `tokRegexpAllowed` trick does not work. See `parseStatement`.

  function readToken_dot() {
    var next = input.charCodeAt(tokPos + 1);
    if (next >= 48 && next <= 57) return readNumber(true);
    var next2 = input.charCodeAt(tokPos + 2);
    if (options.ecmaVersion >= 6 && next === 46 && next2 === 46) { // 46 = dot '.'
      tokPos += 3;
      return finishToken(_ellipsis);
    } else {
      ++tokPos;
      return finishToken(_dot);
    }
  }

  function readToken_slash() { // '/'
    var next = input.charCodeAt(tokPos + 1);
    if (tokRegexpAllowed) {++tokPos; return readRegexp();}
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_slash, 1);
  }

  function readToken_mult_modulo(code) { // '%*'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(code === 42 ? _star : _modulo, 1);
  }

  function readToken_pipe_amp(code) { // '|&'
    var next = input.charCodeAt(tokPos + 1);
    if (next === code) return finishOp(code === 124 ? _logicalOR : _logicalAND, 2);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(code === 124 ? _bitwiseOR : _bitwiseAND, 1);
  }

  function readToken_caret() { // '^'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_bitwiseXOR, 1);
  }

  function readToken_plus_min(code) { // '+-'
    var next = input.charCodeAt(tokPos + 1);
    if (next === code) {
      if (next == 45 && input.charCodeAt(tokPos + 2) == 62 &&
          newline.test(input.slice(lastEnd, tokPos))) {
        // A `-->` line comment
        skipLineComment(3);
        skipSpace();
        return readToken();
      }
      return finishOp(_incDec, 2);
    }
    if (next === 61) return finishOp(_assign, 2);
    return finishOp(_plusMin, 1);
  }

  function readToken_lt_gt(code) { // '<>'
    var next = input.charCodeAt(tokPos + 1);
    var size = 1;
    if (next === code) {
      size = code === 62 && input.charCodeAt(tokPos + 2) === 62 ? 3 : 2;
      if (input.charCodeAt(tokPos + size) === 61) return finishOp(_assign, size + 1);
      return finishOp(_bitShift, size);
    }
    if (next == 33 && code == 60 && input.charCodeAt(tokPos + 2) == 45 &&
        input.charCodeAt(tokPos + 3) == 45) {
      // `<!--`, an XML-style comment that should be interpreted as a line comment
      skipLineComment(4);
      skipSpace();
      return readToken();
    }
    if (next === 61)
      size = input.charCodeAt(tokPos + 2) === 61 ? 3 : 2;
    return finishOp(_relational, size);
  }

  function readToken_eq_excl(code) { // '=!', '=>'
    var next = input.charCodeAt(tokPos + 1);
    if (next === 61) return finishOp(_equality, input.charCodeAt(tokPos + 2) === 61 ? 3 : 2);
    if (code === 61 && next === 62 && options.ecmaVersion >= 6) { // '=>'
      tokPos += 2;
      return finishToken(_arrow);
    }
    return finishOp(code === 61 ? _eq : _prefix, 1);
  }

  function getTokenFromCode(code) {
    switch (code) {
    // The interpretation of a dot depends on whether it is followed
    // by a digit or another two dots.
    case 46: // '.'
      return readToken_dot();

    // Punctuation tokens.
    case 40: ++tokPos; return finishToken(_parenL);
    case 41: ++tokPos; return finishToken(_parenR);
    case 59: ++tokPos; return finishToken(_semi);
    case 44: ++tokPos; return finishToken(_comma);
    case 91: ++tokPos; return finishToken(_bracketL);
    case 93: ++tokPos; return finishToken(_bracketR);
    case 123:
      ++tokPos;
      if (templates.length) ++templates[templates.length - 1];
      return finishToken(_braceL);
    case 125:
      ++tokPos;
      if (templates.length && --templates[templates.length - 1] === 0)
        return readTemplateString(_templateContinued);
      else
        return finishToken(_braceR);
    case 58: ++tokPos; return finishToken(_colon);
    case 63: ++tokPos; return finishToken(_question);

    case 96: // '`'
      if (options.ecmaVersion >= 6) {
        ++tokPos;
        return readTemplateString(_template);
      }

    case 48: // '0'
      var next = input.charCodeAt(tokPos + 1);
      if (next === 120 || next === 88) return readRadixNumber(16); // '0x', '0X' - hex number
      if (options.ecmaVersion >= 6) {
        if (next === 111 || next === 79) return readRadixNumber(8); // '0o', '0O' - octal number
        if (next === 98 || next === 66) return readRadixNumber(2); // '0b', '0B' - binary number
      }
    // Anything else beginning with a digit is an integer, octal
    // number, or float.
    case 49: case 50: case 51: case 52: case 53: case 54: case 55: case 56: case 57: // 1-9
      return readNumber(false);

    // Quotes produce strings.
    case 34: case 39: // '"', "'"
      return readString(code);

    // Operators are parsed inline in tiny state machines. '=' (61) is
    // often referred to. `finishOp` simply skips the amount of
    // characters it is given as second argument, and returns a token
    // of the type given by its first argument.

    case 47: // '/'
      return readToken_slash();

    case 37: case 42: // '%*'
      return readToken_mult_modulo(code);

    case 124: case 38: // '|&'
      return readToken_pipe_amp(code);

    case 94: // '^'
      return readToken_caret();

    case 43: case 45: // '+-'
      return readToken_plus_min(code);

    case 60: case 62: // '<>'
      return readToken_lt_gt(code);

    case 61: case 33: // '=!'
      return readToken_eq_excl(code);

    case 126: // '~'
      return finishOp(_prefix, 1);
    }

    return false;
  }

  function readToken(forceRegexp) {
    if (!forceRegexp) tokStart = tokPos;
    else tokPos = tokStart + 1;
    if (options.locations) tokStartLoc = curPosition();
    if (forceRegexp) return readRegexp();
    if (tokPos >= inputLen) return finishToken(_eof);

    var code = input.charCodeAt(tokPos);

    // Identifier or keyword. '\uXXXX' sequences are allowed in
    // identifiers, so '\' also dispatches to that.
    if (isIdentifierStart(code) || code === 92 /* '\' */) return readWord();

    var tok = getTokenFromCode(code);

    if (tok === false) {
      // If we are here, we either found a non-ASCII identifier
      // character, or something that's entirely disallowed.
      var ch = String.fromCharCode(code);
      if (ch === "\\" || nonASCIIidentifierStart.test(ch)) return readWord();
      raise(tokPos, "Unexpected character '" + ch + "'");
    }
    return tok;
  }

  function finishOp(type, size) {
    var str = input.slice(tokPos, tokPos + size);
    tokPos += size;
    finishToken(type, str);
  }

  var regexpUnicodeSupport = false;
  try { new RegExp("\uffff", "u"); regexpUnicodeSupport = true; }
  catch(e) {}

  // Parse a regular expression. Some context-awareness is necessary,
  // since a '/' inside a '[]' set does not end the expression.

  function readRegexp() {
    var content = "", escaped, inClass, start = tokPos;
    for (;;) {
      if (tokPos >= inputLen) raise(start, "Unterminated regular expression");
      var ch = input.charAt(tokPos);
      if (newline.test(ch)) raise(start, "Unterminated regular expression");
      if (!escaped) {
        if (ch === "[") inClass = true;
        else if (ch === "]" && inClass) inClass = false;
        else if (ch === "/" && !inClass) break;
        escaped = ch === "\\";
      } else escaped = false;
      ++tokPos;
    }
    var content = input.slice(start, tokPos);
    ++tokPos;
    // Need to use `readWord1` because '\uXXXX' sequences are allowed
    // here (don't ask).
    var mods = readWord1();
    var tmp = content;
    if (mods) {
      var validFlags = /^[gmsiy]*$/;
      if (options.ecmaVersion >= 6) validFlags = /^[gmsiyu]*$/;
      if (!validFlags.test(mods)) raise(start, "Invalid regular expression flag");
      if (mods.indexOf('u') >= 0 && !regexpUnicodeSupport) {
        // Replace each astral symbol and every Unicode code point
        // escape sequence that represents such a symbol with a single
        // ASCII symbol to avoid throwing on regular expressions that
        // are only valid in combination with the `/u` flag.
        tmp = tmp
          .replace(/\\u\{([0-9a-fA-F]{5,6})\}/g, "x")
          .replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, "x");
      }
    }
    // Detect invalid regular expressions.
    try {
      new RegExp(tmp);
    } catch (e) {
      if (e instanceof SyntaxError) raise(start, "Error parsing regular expression: " + e.message);
      raise(e);
    }
    // Get a regular expression object for this pattern-flag pair, or `null` in
    // case the current environment doesn't support the flags it uses.
    try {
      var value = new RegExp(content, mods);
    } catch (err) {
      value = null;
    }
    return finishToken(_regexp, {pattern: content, flags: mods, value: value});
  }

  // Read an integer in the given radix. Return null if zero digits
  // were read, the integer value otherwise. When `len` is given, this
  // will return `null` unless the integer has exactly `len` digits.

  function readInt(radix, len) {
    var start = tokPos, total = 0;
    for (var i = 0, e = len == null ? Infinity : len; i < e; ++i) {
      var code = input.charCodeAt(tokPos), val;
      if (code >= 97) val = code - 97 + 10; // a
      else if (code >= 65) val = code - 65 + 10; // A
      else if (code >= 48 && code <= 57) val = code - 48; // 0-9
      else val = Infinity;
      if (val >= radix) break;
      ++tokPos;
      total = total * radix + val;
    }
    if (tokPos === start || len != null && tokPos - start !== len) return null;

    return total;
  }

  function readRadixNumber(radix) {
    tokPos += 2; // 0x
    var val = readInt(radix);
    if (val == null) raise(tokStart + 2, "Expected number in radix " + radix);
    if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");
    return finishToken(_num, val);
  }

  // Read an integer, octal integer, or floating-point number.

  function readNumber(startsWithDot) {
    var start = tokPos, isFloat = false, octal = input.charCodeAt(tokPos) === 48;
    if (!startsWithDot && readInt(10) === null) raise(start, "Invalid number");
    if (input.charCodeAt(tokPos) === 46) {
      ++tokPos;
      readInt(10);
      isFloat = true;
    }
    var next = input.charCodeAt(tokPos);
    if (next === 69 || next === 101) { // 'eE'
      next = input.charCodeAt(++tokPos);
      if (next === 43 || next === 45) ++tokPos; // '+-'
      if (readInt(10) === null) raise(start, "Invalid number");
      isFloat = true;
    }
    if (isIdentifierStart(input.charCodeAt(tokPos))) raise(tokPos, "Identifier directly after number");

    var str = input.slice(start, tokPos), val;
    if (isFloat) val = parseFloat(str);
    else if (!octal || str.length === 1) val = parseInt(str, 10);
    else if (/[89]/.test(str) || strict) raise(start, "Invalid number");
    else val = parseInt(str, 8);
    return finishToken(_num, val);
  }

  // Read a string value, interpreting backslash-escapes.

  function readCodePoint() {
    var ch = input.charCodeAt(tokPos), code;

    if (ch === 123) {
      if (options.ecmaVersion < 6) unexpected();
      ++tokPos;
      code = readHexChar(input.indexOf('}', tokPos) - tokPos);
      ++tokPos;
      if (code > 0x10FFFF) unexpected();
    } else {
      code = readHexChar(4);
    }

    // UTF-16 Encoding
    if (code <= 0xFFFF) {
      return String.fromCharCode(code);
    }
    var cu1 = ((code - 0x10000) >> 10) + 0xD800;
    var cu2 = ((code - 0x10000) & 1023) + 0xDC00;
    return String.fromCharCode(cu1, cu2);
  }

  function readString(quote) {
    ++tokPos;
    var out = "";
    for (;;) {
      if (tokPos >= inputLen) raise(tokStart, "Unterminated string constant");
      var ch = input.charCodeAt(tokPos);
      if (ch === quote) {
        ++tokPos;
        return finishToken(_string, out);
      }
      if (ch === 92) { // '\'
        out += readEscapedChar();
      } else {
        ++tokPos;
        if (newline.test(String.fromCharCode(ch))) {
          raise(tokStart, "Unterminated string constant");
        }
        out += String.fromCharCode(ch); // '\'
      }
    }
  }

  function readTemplateString(type) {
    if (type == _templateContinued) templates.pop();
    var out = "", start = tokPos;;
    for (;;) {
      if (tokPos >= inputLen) raise(tokStart, "Unterminated template");
      var ch = input.charAt(tokPos);
      if (ch === "`" || ch === "$" && input.charCodeAt(tokPos + 1) === 123) { // '`', '${'
        var raw = input.slice(start, tokPos);
        ++tokPos;
        if (ch == "$") { ++tokPos; templates.push(1); }
        return finishToken(type, {cooked: out, raw: raw});
      }

      if (ch === "\\") { // '\'
        out += readEscapedChar();
      } else {
        ++tokPos;
        if (newline.test(ch)) {
          if (ch === "\r" && input.charCodeAt(tokPos) === 10) {
            ++tokPos;
            ch = "\n";
          }
          if (options.locations) {
            ++tokCurLine;
            tokLineStart = tokPos;
          }
        }
        out += ch;
      }
    }
  }

  // Used to read escaped characters

  function readEscapedChar() {
    var ch = input.charCodeAt(++tokPos);
    var octal = /^[0-7]+/.exec(input.slice(tokPos, tokPos + 3));
    if (octal) octal = octal[0];
    while (octal && parseInt(octal, 8) > 255) octal = octal.slice(0, -1);
    if (octal === "0") octal = null;
    ++tokPos;
    if (octal) {
      if (strict) raise(tokPos - 2, "Octal literal in strict mode");
      tokPos += octal.length - 1;
      return String.fromCharCode(parseInt(octal, 8));
    } else {
      switch (ch) {
        case 110: return "\n"; // 'n' -> '\n'
        case 114: return "\r"; // 'r' -> '\r'
        case 120: return String.fromCharCode(readHexChar(2)); // 'x'
        case 117: return readCodePoint(); // 'u'
        case 116: return "\t"; // 't' -> '\t'
        case 98: return "\b"; // 'b' -> '\b'
        case 118: return "\u000b"; // 'v' -> '\u000b'
        case 102: return "\f"; // 'f' -> '\f'
        case 48: return "\0"; // 0 -> '\0'
        case 13: if (input.charCodeAt(tokPos) === 10) ++tokPos; // '\r\n'
        case 10: // ' \n'
          if (options.locations) { tokLineStart = tokPos; ++tokCurLine; }
          return "";
        default: return String.fromCharCode(ch);
      }
    }
  }

  // Used to read character escape sequences ('\x', '\u', '\U').

  function readHexChar(len) {
    var n = readInt(16, len);
    if (n === null) raise(tokStart, "Bad character escape sequence");
    return n;
  }

  // Used to signal to callers of `readWord1` whether the word
  // contained any escape sequences. This is needed because words with
  // escape sequences must not be interpreted as keywords.

  var containsEsc;

  // Read an identifier, and return it as a string. Sets `containsEsc`
  // to whether the word contained a '\u' escape.
  //
  // Only builds up the word character-by-character when it actually
  // containeds an escape, as a micro-optimization.

  function readWord1() {
    containsEsc = false;
    var word, first = true, start = tokPos;
    for (;;) {
      var ch = input.charCodeAt(tokPos);
      if (isIdentifierChar(ch)) {
        if (containsEsc) word += input.charAt(tokPos);
        ++tokPos;
      } else if (ch === 92) { // "\"
        if (!containsEsc) word = input.slice(start, tokPos);
        containsEsc = true;
        if (input.charCodeAt(++tokPos) != 117) // "u"
          raise(tokPos, "Expecting Unicode escape sequence \\uXXXX");
        ++tokPos;
        var esc = readHexChar(4);
        var escStr = String.fromCharCode(esc);
        if (!escStr) raise(tokPos - 1, "Invalid Unicode escape");
        if (!(first ? isIdentifierStart(esc) : isIdentifierChar(esc)))
          raise(tokPos - 4, "Invalid Unicode escape");
        word += escStr;
      } else {
        break;
      }
      first = false;
    }
    return containsEsc ? word : input.slice(start, tokPos);
  }

  // Read an identifier or keyword token. Will check for reserved
  // words when necessary.

  function readWord() {
    var word = readWord1();
    var type = _name;
    if (!containsEsc && isKeyword(word))
      type = keywordTypes[word];
    return finishToken(type, word);
  }

  // ## Parser

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

  // ### Parser utilities

  // Continue to the next token.

  function next() {
    lastStart = tokStart;
    lastEnd = tokEnd;
    lastEndLoc = tokEndLoc;
    readToken();
  }

  // Enter strict mode. Re-reads the next token to please pedantic
  // tests ("use strict"; 010; -- should fail).

  function setStrict(strct) {
    strict = strct;
    tokPos = tokStart;
    if (options.locations) {
      while (tokPos < tokLineStart) {
        tokLineStart = input.lastIndexOf("\n", tokLineStart - 2) + 1;
        --tokCurLine;
      }
    }
    skipSpace();
    readToken();
  }

  // Start an AST node, attaching a start offset.

  function Node() {
    this.type = null;
    this.start = tokStart;
    this.end = null;
  }

  exports.Node = Node;

  function SourceLocation() {
    this.start = tokStartLoc;
    this.end = null;
    if (sourceFile !== null) this.source = sourceFile;
  }

  function startNode() {
    var node = new Node();
    if (options.locations)
      node.loc = new SourceLocation();
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [tokStart, 0];
    return node;
  }

  // Sometimes, a node is only started *after* the token stream passed
  // its start position. The functions below help storing a position
  // and creating a node from a previous position.

  function storeCurrentPos() {
    return options.locations ? [tokStart, tokStartLoc] : tokStart;
  }

  function startNodeAt(pos) {
    var node = new Node(), start = pos;
    if (options.locations) {
      node.loc = new SourceLocation();
      node.loc.start = start[1];
      start = pos[0];
    }
    node.start = start;
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [start, 0];

    return node;
  }

  // Finish an AST node, adding `type` and `end` properties.

  function finishNode(node, type) {
    node.type = type;
    node.end = lastEnd;
    if (options.locations)
      node.loc.end = lastEndLoc;
    if (options.ranges)
      node.range[1] = lastEnd;
    return node;
  }

  function finishNodeAt(node, type, pos) {
    if (options.locations) { node.loc.end = pos[1]; pos = pos[0]; }
    node.type = type;
    node.end = pos;
    if (options.ranges)
      node.range[1] = pos;
    return node;
  }

  // Test whether a statement node is the string literal `"use strict"`.

  function isUseStrict(stmt) {
    return options.ecmaVersion >= 5 && stmt.type === "ExpressionStatement" &&
      stmt.expression.type === "Literal" && stmt.expression.value === "use strict";
  }

  // Predicate that tests whether the next token is of the given
  // type, and if yes, consumes it as a side effect.

  function eat(type) {
    if (tokType === type) {
      next();
      return true;
    } else {
      return false;
    }
  }

  // Test whether a semicolon can be inserted at the current position.

  function canInsertSemicolon() {
    return !options.strictSemicolons &&
      (tokType === _eof || tokType === _braceR || newline.test(input.slice(lastEnd, tokStart)));
  }

  // Consume a semicolon, or, failing that, see if we are allowed to
  // pretend that there is a semicolon at this position.

  function semicolon() {
    if (!eat(_semi) && !canInsertSemicolon()) unexpected();
  }

  // Expect a token of a given type. If found, consume it, otherwise,
  // raise an unexpected token error.

  function expect(type) {
    eat(type) || unexpected();
  }

  // Raise an unexpected token error.

  function unexpected(pos) {
    raise(pos != null ? pos : tokStart, "Unexpected token");
  }

  // Checks if hash object has a property.

  function has(obj, propName) {
    return Object.prototype.hasOwnProperty.call(obj, propName);
  }
  // Convert existing expression atom to assignable pattern
  // if possible.

  function toAssignable(node, allowSpread, checkType) {
    if (options.ecmaVersion >= 6 && node) {
      switch (node.type) {
        case "Identifier":
        case "MemberExpression":
          break;

        case "ObjectExpression":
          node.type = "ObjectPattern";
          for (var i = 0; i < node.properties.length; i++) {
            var prop = node.properties[i];
            if (prop.kind !== "init") unexpected(prop.key.start);
            toAssignable(prop.value, false, checkType);
          }
          break;

        case "ArrayExpression":
          node.type = "ArrayPattern";
          for (var i = 0, lastI = node.elements.length - 1; i <= lastI; i++) {
            toAssignable(node.elements[i], i === lastI, checkType);
          }
          break;

        case "SpreadElement":
          if (allowSpread) {
            toAssignable(node.argument, false, checkType);
            checkSpreadAssign(node.argument);
          } else {
            unexpected(node.start);
          }
          break;

        default:
          if (checkType) unexpected(node.start);
      }
    }
    return node;
  }

  // Checks if node can be assignable spread argument.

  function checkSpreadAssign(node) {
    if (node.type !== "Identifier" && node.type !== "ArrayPattern")
      unexpected(node.start);
  }

  // Verify that argument names are not repeated, and it does not
  // try to bind the words `eval` or `arguments`.

  function checkFunctionParam(param, nameHash) {
    switch (param.type) {
      case "Identifier":
        if (isStrictReservedWord(param.name) || isStrictBadIdWord(param.name))
          raise(param.start, "Defining '" + param.name + "' in strict mode");
        if (has(nameHash, param.name))
          raise(param.start, "Argument name clash in strict mode");
        nameHash[param.name] = true;
        break;

      case "ObjectPattern":
        for (var i = 0; i < param.properties.length; i++)
          checkFunctionParam(param.properties[i].value, nameHash);
        break;

      case "ArrayPattern":
        for (var i = 0; i < param.elements.length; i++) {
          var elem = param.elements[i];
          if (elem) checkFunctionParam(elem, nameHash);
        }
        break;
    }
  }

  // Check if property name clashes with already added.
  // Object/class getters and setters are not allowed to clash —
  // either with each other or with an init property — and in
  // strict mode, init properties are also not allowed to be repeated.

  function checkPropClash(prop, propHash) {
    if (options.ecmaVersion >= 6) return;
    var key = prop.key, name;
    switch (key.type) {
      case "Identifier": name = key.name; break;
      case "Literal": name = String(key.value); break;
      default: return;
    }
    var kind = prop.kind || "init", other;
    if (has(propHash, name)) {
      other = propHash[name];
      var isGetSet = kind !== "init";
      if ((strict || isGetSet) && other[kind] || !(isGetSet ^ other.init))
        raise(key.start, "Redefinition of property");
    } else {
      other = propHash[name] = {
        init: false,
        get: false,
        set: false
      };
    }
    other[kind] = true;
  }

  // Verify that a node is an lval — something that can be assigned
  // to.

  function checkLVal(expr, isBinding) {
    switch (expr.type) {
      case "Identifier":
        if (strict && (isStrictBadIdWord(expr.name) || isStrictReservedWord(expr.name)))
          raise(expr.start, (isBinding ? "Binding " : "Assigning to ") + expr.name + " in strict mode");
        break;

      case "MemberExpression":
        if (isBinding) raise(expr.start, "Binding to member expression");
        break;

      case "ObjectPattern":
        for (var i = 0; i < expr.properties.length; i++)
          checkLVal(expr.properties[i].value, isBinding);
        break;

      case "ArrayPattern":
        for (var i = 0; i < expr.elements.length; i++) {
          var elem = expr.elements[i];
          if (elem) checkLVal(elem, isBinding);
        }
        break;

      case "SpreadElement":
        break;

      default:
        raise(expr.start, "Assigning to rvalue");
    }
  }

  // ### Statement parsing

  // Parse a program. Initializes the parser, reads any number of
  // statements, and wraps them in a Program node.  Optionally takes a
  // `program` argument.  If present, the statements will be appended
  // to its body instead of creating a new node.

  function parseTopLevel(node) {
    var first = true;
    if (!node.body) node.body = [];
    while (tokType !== _eof) {
      var stmt = parseStatement(true);
      node.body.push(stmt);
      if (first && isUseStrict(stmt)) setStrict(true);
      first = false;
    }

    lastStart = tokStart;
    lastEnd = tokEnd;
    lastEndLoc = tokEndLoc;
    return finishNode(node, "Program");
  }

  var loopLabel = {kind: "loop"}, switchLabel = {kind: "switch"};

  // Parse a single statement.
  //
  // If expecting a statement and finding a slash operator, parse a
  // regular expression literal. This is to handle cases like
  // `if (foo) /blah/.exec(foo);`, where looking at the previous token
  // does not help.

  function parseStatement(topLevel) {
    if (tokType === _slash || tokType === _assign && tokVal == "/=")
      readToken(true);

    var starttype = tokType, node = startNode();

    // Most types of statements are recognized by the keyword they
    // start with. Many are trivial to parse, some require a bit of
    // complexity.

    switch (starttype) {
    case _break: case _continue: return parseBreakContinueStatement(node, starttype.keyword);
    case _debugger: return parseDebuggerStatement(node);
    case _do: return parseDoStatement(node);
    case _for: return parseForStatement(node);
    case _function: return parseFunctionStatement(node);
    case _class: return parseClass(node, true);
    case _if: return parseIfStatement(node);
    case _return: return parseReturnStatement(node);
    case _switch: return parseSwitchStatement(node);
    case _throw: return parseThrowStatement(node);
    case _try: return parseTryStatement(node);
    case _var: case _let: case _const: return parseVarStatement(node, starttype.keyword);
    case _while: return parseWhileStatement(node);
    case _with: return parseWithStatement(node);
    case _braceL: return parseBlock(); // no point creating a function for this
    case _semi: return parseEmptyStatement(node);
    case _export:
    case _import:
      if (!topLevel && !options.allowImportExportEverywhere)
        raise(tokStart, "'import' and 'export' may only appear at the top level");
      return starttype === _import ? parseImport(node) : parseExport(node);

      // If the statement does not start with a statement keyword or a
      // brace, it's an ExpressionStatement or LabeledStatement. We
      // simply start parsing an expression, and afterwards, if the
      // next token is a colon and the expression was a simple
      // Identifier node, we switch to interpreting it as a label.
    default:
      var maybeName = tokVal, expr = parseExpression();
      if (starttype === _name && expr.type === "Identifier" && eat(_colon))
        return parseLabeledStatement(node, maybeName, expr);
      else return parseExpressionStatement(node, expr);
    }
  }

  function parseBreakContinueStatement(node, keyword) {
    var isBreak = keyword == "break";
    next();
    if (eat(_semi) || canInsertSemicolon()) node.label = null;
    else if (tokType !== _name) unexpected();
    else {
      node.label = parseIdent();
      semicolon();
    }

    // Verify that there is an actual destination to break or
    // continue to.
    for (var i = 0; i < labels.length; ++i) {
      var lab = labels[i];
      if (node.label == null || lab.name === node.label.name) {
        if (lab.kind != null && (isBreak || lab.kind === "loop")) break;
        if (node.label && isBreak) break;
      }
    }
    if (i === labels.length) raise(node.start, "Unsyntactic " + keyword);
    return finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");
  }

  function parseDebuggerStatement(node) {
    next();
    semicolon();
    return finishNode(node, "DebuggerStatement");
  }

  function parseDoStatement(node) {
    next();
    labels.push(loopLabel);
    node.body = parseStatement();
    labels.pop();
    expect(_while);
    node.test = parseParenExpression();
    if (options.ecmaVersion >= 6)
      eat(_semi);
    else
      semicolon();
    return finishNode(node, "DoWhileStatement");
  }

  // Disambiguating between a `for` and a `for`/`in` or `for`/`of`
  // loop is non-trivial. Basically, we have to parse the init `var`
  // statement or expression, disallowing the `in` operator (see
  // the second parameter to `parseExpression`), and then check
  // whether the next token is `in` or `of`. When there is no init
  // part (semicolon immediately after the opening parenthesis), it
  // is a regular `for` loop.

  function parseForStatement(node) {
    next();
    labels.push(loopLabel);
    expect(_parenL);
    if (tokType === _semi) return parseFor(node, null);
    if (tokType === _var || tokType === _let) {
      var init = startNode(), varKind = tokType.keyword, isLet = tokType === _let;
      next();
      parseVar(init, true, varKind);
      finishNode(init, "VariableDeclaration");
      if ((tokType === _in || (options.ecmaVersion >= 6 && tokType === _name && tokVal === "of")) && init.declarations.length === 1 &&
          !(isLet && init.declarations[0].init))
        return parseForIn(node, init);
      return parseFor(node, init);
    }
    var init = parseExpression(false, true);
    if (tokType === _in || (options.ecmaVersion >= 6 && tokType === _name && tokVal === "of")) {
      checkLVal(init);
      return parseForIn(node, init);
    }
    return parseFor(node, init);
  }

  function parseFunctionStatement(node) {
    next();
    return parseFunction(node, true);
  }

  function parseIfStatement(node) {
    next();
    node.test = parseParenExpression();
    node.consequent = parseStatement();
    node.alternate = eat(_else) ? parseStatement() : null;
    return finishNode(node, "IfStatement");
  }

  function parseReturnStatement(node) {
    if (!inFunction && !options.allowReturnOutsideFunction)
      raise(tokStart, "'return' outside of function");
    next();

    // In `return` (and `break`/`continue`), the keywords with
    // optional arguments, we eagerly look for a semicolon or the
    // possibility to insert one.

    if (eat(_semi) || canInsertSemicolon()) node.argument = null;
    else { node.argument = parseExpression(); semicolon(); }
    return finishNode(node, "ReturnStatement");
  }

  function parseSwitchStatement(node) {
    next();
    node.discriminant = parseParenExpression();
    node.cases = [];
    expect(_braceL);
    labels.push(switchLabel);

    // Statements under must be grouped (by label) in SwitchCase
    // nodes. `cur` is used to keep the node that we are currently
    // adding statements to.

    for (var cur, sawDefault; tokType != _braceR;) {
      if (tokType === _case || tokType === _default) {
        var isCase = tokType === _case;
        if (cur) finishNode(cur, "SwitchCase");
        node.cases.push(cur = startNode());
        cur.consequent = [];
        next();
        if (isCase) cur.test = parseExpression();
        else {
          if (sawDefault) raise(lastStart, "Multiple default clauses"); sawDefault = true;
          cur.test = null;
        }
        expect(_colon);
      } else {
        if (!cur) unexpected();
        cur.consequent.push(parseStatement());
      }
    }
    if (cur) finishNode(cur, "SwitchCase");
    next(); // Closing brace
    labels.pop();
    return finishNode(node, "SwitchStatement");
  }

  function parseThrowStatement(node) {
    next();
    if (newline.test(input.slice(lastEnd, tokStart)))
      raise(lastEnd, "Illegal newline after throw");
    node.argument = parseExpression();
    semicolon();
    return finishNode(node, "ThrowStatement");
  }

  function parseTryStatement(node) {
    next();
    node.block = parseBlock();
    node.handler = null;
    if (tokType === _catch) {
      var clause = startNode();
      next();
      expect(_parenL);
      clause.param = parseIdent();
      if (strict && isStrictBadIdWord(clause.param.name))
        raise(clause.param.start, "Binding " + clause.param.name + " in strict mode");
      expect(_parenR);
      clause.guard = null;
      clause.body = parseBlock();
      node.handler = finishNode(clause, "CatchClause");
    }
    node.guardedHandlers = empty;
    node.finalizer = eat(_finally) ? parseBlock() : null;
    if (!node.handler && !node.finalizer)
      raise(node.start, "Missing catch or finally clause");
    return finishNode(node, "TryStatement");
  }

  function parseVarStatement(node, kind) {
    next();
    parseVar(node, false, kind);
    semicolon();
    return finishNode(node, "VariableDeclaration");
  }

  function parseWhileStatement(node) {
    next();
    node.test = parseParenExpression();
    labels.push(loopLabel);
    node.body = parseStatement();
    labels.pop();
    return finishNode(node, "WhileStatement");
  }

  function parseWithStatement(node) {
    if (strict) raise(tokStart, "'with' in strict mode");
    next();
    node.object = parseParenExpression();
    node.body = parseStatement();
    return finishNode(node, "WithStatement");
  }

  function parseEmptyStatement(node) {
    next();
    return finishNode(node, "EmptyStatement");
  }

  function parseLabeledStatement(node, maybeName, expr) {
    for (var i = 0; i < labels.length; ++i)
      if (labels[i].name === maybeName) raise(expr.start, "Label '" + maybeName + "' is already declared");
    var kind = tokType.isLoop ? "loop" : tokType === _switch ? "switch" : null;
    labels.push({name: maybeName, kind: kind});
    node.body = parseStatement();
    labels.pop();
    node.label = expr;
    return finishNode(node, "LabeledStatement");
  }

  function parseExpressionStatement(node, expr) {
    node.expression = expr;
    semicolon();
    return finishNode(node, "ExpressionStatement");
  }

  // Used for constructs like `switch` and `if` that insist on
  // parentheses around their expression.

  function parseParenExpression() {
    expect(_parenL);
    var val = parseExpression();
    expect(_parenR);
    return val;
  }

  // Parse a semicolon-enclosed block of statements, handling `"use
  // strict"` declarations when `allowStrict` is true (used for
  // function bodies).

  function parseBlock(allowStrict) {
    var node = startNode(), first = true, oldStrict;
    node.body = [];
    expect(_braceL);
    while (!eat(_braceR)) {
      var stmt = parseStatement();
      node.body.push(stmt);
      if (first && allowStrict && isUseStrict(stmt)) {
        oldStrict = strict;
        setStrict(strict = true);
      }
      first = false;
    }
    if (oldStrict === false) setStrict(false);
    return finishNode(node, "BlockStatement");
  }

  // Parse a regular `for` loop. The disambiguation code in
  // `parseStatement` will already have parsed the init statement or
  // expression.

  function parseFor(node, init) {
    node.init = init;
    expect(_semi);
    node.test = tokType === _semi ? null : parseExpression();
    expect(_semi);
    node.update = tokType === _parenR ? null : parseExpression();
    expect(_parenR);
    node.body = parseStatement();
    labels.pop();
    return finishNode(node, "ForStatement");
  }

  // Parse a `for`/`in` and `for`/`of` loop, which are almost
  // same from parser's perspective.

  function parseForIn(node, init) {
    var type = tokType === _in ? "ForInStatement" : "ForOfStatement";
    next();
    node.left = init;
    node.right = parseExpression();
    expect(_parenR);
    node.body = parseStatement();
    labels.pop();
    return finishNode(node, type);
  }

  // Parse a list of variable declarations.

  function parseVar(node, noIn, kind) {
    node.declarations = [];
    node.kind = kind;
    for (;;) {
      var decl = startNode();
      decl.id = options.ecmaVersion >= 6 ? toAssignable(parseExprAtom()) : parseIdent();
      checkLVal(decl.id, true);
      decl.init = eat(_eq) ? parseExpression(true, noIn) : (kind === _const.keyword ? unexpected() : null);
      node.declarations.push(finishNode(decl, "VariableDeclarator"));
      if (!eat(_comma)) break;
    }
    return node;
  }

  // ### Expression parsing

  // These nest, from the most general expression type at the top to
  // 'atomic', nondivisible expression types at the bottom. Most of
  // the functions will simply let the function(s) below them parse,
  // and, *if* the syntactic construct they handle is present, wrap
  // the AST node that the inner parser gave them in another node.

  // Parse a full expression. The arguments are used to forbid comma
  // sequences (in argument lists, array literals, or object literals)
  // or the `in` operator (in for loops initalization expressions).

  function parseExpression(noComma, noIn) {
    var start = storeCurrentPos();
    var expr = parseMaybeAssign(noIn);
    if (!noComma && tokType === _comma) {
      var node = startNodeAt(start);
      node.expressions = [expr];
      while (eat(_comma)) node.expressions.push(parseMaybeAssign(noIn));
      return finishNode(node, "SequenceExpression");
    }
    return expr;
  }

  // Parse an assignment expression. This includes applications of
  // operators like `+=`.

  function parseMaybeAssign(noIn) {
    var start = storeCurrentPos();
    var left = parseMaybeConditional(noIn);
    if (tokType.isAssign) {
      var node = startNodeAt(start);
      node.operator = tokVal;
      node.left = tokType === _eq ? toAssignable(left) : left;
      checkLVal(left);
      next();
      node.right = parseMaybeAssign(noIn);
      return finishNode(node, "AssignmentExpression");
    }
    return left;
  }

  // Parse a ternary conditional (`?:`) operator.

  function parseMaybeConditional(noIn) {
    var start = storeCurrentPos();
    var expr = parseExprOps(noIn);
    if (eat(_question)) {
      var node = startNodeAt(start);
      node.test = expr;
      node.consequent = parseExpression(true);
      expect(_colon);
      node.alternate = parseExpression(true, noIn);
      return finishNode(node, "ConditionalExpression");
    }
    return expr;
  }

  // Start the precedence parser.

  function parseExprOps(noIn) {
    var start = storeCurrentPos();
    return parseExprOp(parseMaybeUnary(), start, -1, noIn);
  }

  // Parse binary operators with the operator precedence parsing
  // algorithm. `left` is the left-hand side of the operator.
  // `minPrec` provides context that allows the function to stop and
  // defer further parser to one of its callers when it encounters an
  // operator that has a lower precedence than the set it is parsing.

  function parseExprOp(left, leftStart, minPrec, noIn) {
    var prec = tokType.binop;
    if (prec != null && (!noIn || tokType !== _in)) {
      if (prec > minPrec) {
        var node = startNodeAt(leftStart);
        node.left = left;
        node.operator = tokVal;
        var op = tokType;
        next();
        var start = storeCurrentPos();
        node.right = parseExprOp(parseMaybeUnary(), start, prec, noIn);
        finishNode(node, (op === _logicalOR || op === _logicalAND) ? "LogicalExpression" : "BinaryExpression");
        return parseExprOp(node, leftStart, minPrec, noIn);
      }
    }
    return left;
  }

  // Parse unary operators, both prefix and postfix.

  function parseMaybeUnary() {
    if (tokType.prefix) {
      var node = startNode(), update = tokType.isUpdate, nodeType;
      if (tokType === _ellipsis) {
        nodeType = "SpreadElement";
      } else {
        nodeType = update ? "UpdateExpression" : "UnaryExpression";
        node.operator = tokVal;
        node.prefix = true;
      }
      tokRegexpAllowed = true;
      next();
      node.argument = parseMaybeUnary();
      if (update) checkLVal(node.argument);
      else if (strict && node.operator === "delete" &&
               node.argument.type === "Identifier")
        raise(node.start, "Deleting local variable in strict mode");
      return finishNode(node, nodeType);
    }
    var start = storeCurrentPos();
    var expr = parseExprSubscripts();
    while (tokType.postfix && !canInsertSemicolon()) {
      var node = startNodeAt(start);
      node.operator = tokVal;
      node.prefix = false;
      node.argument = expr;
      checkLVal(expr);
      next();
      expr = finishNode(node, "UpdateExpression");
    }
    return expr;
  }

  // Parse call, dot, and `[]`-subscript expressions.

  function parseExprSubscripts() {
    var start = storeCurrentPos();
    return parseSubscripts(parseExprAtom(), start);
  }

  function parseSubscripts(base, start, noCalls) {
    if (eat(_dot)) {
      var node = startNodeAt(start);
      node.object = base;
      node.property = parseIdent(true);
      node.computed = false;
      return parseSubscripts(finishNode(node, "MemberExpression"), start, noCalls);
    } else if (eat(_bracketL)) {
      var node = startNodeAt(start);
      node.object = base;
      node.property = parseExpression();
      node.computed = true;
      expect(_bracketR);
      return parseSubscripts(finishNode(node, "MemberExpression"), start, noCalls);
    } else if (!noCalls && eat(_parenL)) {
      var node = startNodeAt(start);
      node.callee = base;
      node.arguments = parseExprList(_parenR, false);
      return parseSubscripts(finishNode(node, "CallExpression"), start, noCalls);
    } else if (tokType === _template) {
      var node = startNodeAt(start);
      node.tag = base;
      node.quasi = parseTemplate();
      return parseSubscripts(finishNode(node, "TaggedTemplateExpression"), start, noCalls);
    } return base;
  }

  // Parse an atomic expression — either a single token that is an
  // expression, an expression started by a keyword like `function` or
  // `new`, or an expression wrapped in punctuation like `()`, `[]`,
  // or `{}`.

  function parseExprAtom() {
    switch (tokType) {
    case _this:
      var node = startNode();
      next();
      return finishNode(node, "ThisExpression");

    case _yield:
      if (inGenerator) return parseYield();

    case _name:
      var start = storeCurrentPos();
      var id = parseIdent(tokType !== _name);
      if (eat(_arrow)) {
        return parseArrowExpression(startNodeAt(start), [id]);
      }
      return id;

    case _regexp:
      var node = startNode();
      node.regex = {pattern: tokVal.pattern, flags: tokVal.flags};
      node.value = tokVal.value;
      node.raw = input.slice(tokStart, tokEnd);
      next();
      return finishNode(node, "Literal");

    case _num: case _string:
      var node = startNode();
      node.value = tokVal;
      node.raw = input.slice(tokStart, tokEnd);
      next();
      return finishNode(node, "Literal");

    case _null: case _true: case _false:
      var node = startNode();
      node.value = tokType.atomValue;
      node.raw = tokType.keyword;
      next();
      return finishNode(node, "Literal");

    case _parenL:
      var start = storeCurrentPos();
      var val, exprList;
      next();
      // check whether this is generator comprehension or regular expression
      if (options.ecmaVersion >= 7 && tokType === _for) {
        val = parseComprehension(startNodeAt(start), true);
      } else {
        var oldParenL = ++metParenL;
        if (tokType !== _parenR) {
          val = parseExpression();
          exprList = val.type === "SequenceExpression" ? val.expressions : [val];
        } else {
          exprList = [];
        }
        expect(_parenR);
        // if '=>' follows '(...)', convert contents to arguments
        if (metParenL === oldParenL && eat(_arrow)) {
          val = parseArrowExpression(startNodeAt(start), exprList);
        } else {
          // forbid '()' before everything but '=>'
          if (!val) unexpected(lastStart);
          // forbid '...' in sequence expressions
          if (options.ecmaVersion >= 6) {
            for (var i = 0; i < exprList.length; i++) {
              if (exprList[i].type === "SpreadElement") unexpected();
            }
          }

          if (options.preserveParens) {
            var par = startNodeAt(start);
            par.expression = val;
            val = finishNode(par, "ParenthesizedExpression");
          }
        }
      }
      return val;

    case _bracketL:
      var node = startNode();
      next();
      // check whether this is array comprehension or regular array
      if (options.ecmaVersion >= 7 && tokType === _for) {
        return parseComprehension(node, false);
      }
      node.elements = parseExprList(_bracketR, true, true);
      return finishNode(node, "ArrayExpression");

    case _braceL:
      return parseObj();

    case _function:
      var node = startNode();
      next();
      return parseFunction(node, false);

    case _class:
      return parseClass(startNode(), false);

    case _new:
      return parseNew();

    case _template:
      return parseTemplate();

    default:
      unexpected();
    }
  }

  // New's precedence is slightly tricky. It must allow its argument
  // to be a `[]` or dot subscript expression, but not a call — at
  // least, not without wrapping it in parentheses. Thus, it uses the

  function parseNew() {
    var node = startNode();
    next();
    var start = storeCurrentPos();
    node.callee = parseSubscripts(parseExprAtom(), start, true);
    if (eat(_parenL)) node.arguments = parseExprList(_parenR, false);
    else node.arguments = empty;
    return finishNode(node, "NewExpression");
  }

  // Parse template expression.

  function parseTemplateElement() {
    var elem = startNodeAt(options.locations ? [tokStart + 1, tokStartLoc.offset(1)] : tokStart + 1);
    elem.value = tokVal;
    elem.tail = input.charCodeAt(tokEnd - 1) !== 123; // '{'
    next();
    var endOff = elem.tail ? 1 : 2;
    return finishNodeAt(elem, "TemplateElement", options.locations ? [lastEnd - endOff, lastEndLoc.offset(-endOff)] : lastEnd - endOff);
  }

  function parseTemplate() {
    var node = startNode();
    node.expressions = [];
    var curElt = parseTemplateElement();
    node.quasis = [curElt];
    while (!curElt.tail) {
      node.expressions.push(parseExpression());
      if (tokType !== _templateContinued) unexpected();
      node.quasis.push(curElt = parseTemplateElement());
    }
    return finishNode(node, "TemplateLiteral");
  }

  // Parse an object literal.

  function parseObj() {
    var node = startNode(), first = true, propHash = {};
    node.properties = [];
    next();
    while (!eat(_braceR)) {
      if (!first) {
        expect(_comma);
        if (options.allowTrailingCommas && eat(_braceR)) break;
      } else first = false;

      var prop = startNode(), isGenerator;
      if (options.ecmaVersion >= 6) {
        prop.method = false;
        prop.shorthand = false;
        isGenerator = eat(_star);
      }
      parsePropertyName(prop);
      if (eat(_colon)) {
        prop.value = parseExpression(true);
        prop.kind = "init";
      } else if (options.ecmaVersion >= 6 && tokType === _parenL) {
        prop.kind = "init";
        prop.method = true;
        prop.value = parseMethod(isGenerator);
      } else if (options.ecmaVersion >= 5 && !prop.computed && prop.key.type === "Identifier" &&
                 (prop.key.name === "get" || prop.key.name === "set")) {
        if (isGenerator) unexpected();
        prop.kind = prop.key.name;
        parsePropertyName(prop);
        prop.value = parseMethod(false);
      } else if (options.ecmaVersion >= 6 && !prop.computed && prop.key.type === "Identifier") {
        prop.kind = "init";
        prop.value = prop.key;
        prop.shorthand = true;
      } else unexpected();

      checkPropClash(prop, propHash);
      node.properties.push(finishNode(prop, "Property"));
    }
    return finishNode(node, "ObjectExpression");
  }

  function parsePropertyName(prop) {
    if (options.ecmaVersion >= 6) {
      if (eat(_bracketL)) {
        prop.computed = true;
        prop.key = parseExpression();
        expect(_bracketR);
        return;
      } else {
        prop.computed = false;
      }
    }
    prop.key = (tokType === _num || tokType === _string) ? parseExprAtom() : parseIdent(true);
  }

  // Initialize empty function node.

  function initFunction(node) {
    node.id = null;
    node.params = [];
    if (options.ecmaVersion >= 6) {
      node.defaults = [];
      node.rest = null;
      node.generator = false;
    }
  }

  // Parse a function declaration or literal (depending on the
  // `isStatement` parameter).

  function parseFunction(node, isStatement, allowExpressionBody) {
    initFunction(node);
    if (options.ecmaVersion >= 6) {
      node.generator = eat(_star);
    }
    if (isStatement || tokType === _name) {
      node.id = parseIdent();
    }
    parseFunctionParams(node);
    parseFunctionBody(node, allowExpressionBody);
    return finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
  }

  // Parse object or class method.

  function parseMethod(isGenerator) {
    var node = startNode();
    initFunction(node);
    parseFunctionParams(node);
    var allowExpressionBody;
    if (options.ecmaVersion >= 6) {
      node.generator = isGenerator;
      allowExpressionBody = true;
    } else {
      allowExpressionBody = false;
    }
    parseFunctionBody(node, allowExpressionBody);
    return finishNode(node, "FunctionExpression");
  }

  // Parse arrow function expression with given parameters.

  function parseArrowExpression(node, params) {
    initFunction(node);

    var defaults = node.defaults, hasDefaults = false;

    for (var i = 0, lastI = params.length - 1; i <= lastI; i++) {
      var param = params[i];

      if (param.type === "AssignmentExpression" && param.operator === "=") {
        hasDefaults = true;
        params[i] = param.left;
        defaults.push(param.right);
      } else {
        toAssignable(param, i === lastI, true);
        defaults.push(null);
        if (param.type === "SpreadElement") {
          params.length--;
          node.rest = param.argument;
          break;
        }
      }
    }

    node.params = params;
    if (!hasDefaults) node.defaults = [];

    parseFunctionBody(node, true);
    return finishNode(node, "ArrowFunctionExpression");
  }

  // Parse function parameters.

  function parseFunctionParams(node) {
    var defaults = [], hasDefaults = false;

    expect(_parenL);
    for (;;) {
      if (eat(_parenR)) {
        break;
      } else if (options.ecmaVersion >= 6 && eat(_ellipsis)) {
        node.rest = toAssignable(parseExprAtom(), false, true);
        checkSpreadAssign(node.rest);
        expect(_parenR);
        defaults.push(null);
        break;
      } else {
        node.params.push(options.ecmaVersion >= 6 ? toAssignable(parseExprAtom(), false, true) : parseIdent());
        if (options.ecmaVersion >= 6) {
          if (eat(_eq)) {
            hasDefaults = true;
            defaults.push(parseExpression(true));
          } else {
            defaults.push(null);
          }
        }
        if (!eat(_comma)) {
          expect(_parenR);
          break;
        }
      }
    }

    if (hasDefaults) node.defaults = defaults;
  }

  // Parse function body and check parameters.

  function parseFunctionBody(node, allowExpression) {
    var isExpression = allowExpression && tokType !== _braceL;

    if (isExpression) {
      node.body = parseExpression(true);
      node.expression = true;
    } else {
      // Start a new scope with regard to labels and the `inFunction`
      // flag (restore them to their old value afterwards).
      var oldInFunc = inFunction, oldInGen = inGenerator, oldLabels = labels;
      inFunction = true; inGenerator = node.generator; labels = [];
      node.body = parseBlock(true);
      node.expression = false;
      inFunction = oldInFunc; inGenerator = oldInGen; labels = oldLabels;
    }

    // If this is a strict mode function, verify that argument names
    // are not repeated, and it does not try to bind the words `eval`
    // or `arguments`.
    if (strict || !isExpression && node.body.body.length && isUseStrict(node.body.body[0])) {
      var nameHash = {};
      if (node.id)
        checkFunctionParam(node.id, {});
      for (var i = 0; i < node.params.length; i++)
        checkFunctionParam(node.params[i], nameHash);
      if (node.rest)
        checkFunctionParam(node.rest, nameHash);
    }
  }

  // Parse a class declaration or literal (depending on the
  // `isStatement` parameter).

  function parseClass(node, isStatement) {
    next();
    node.id = tokType === _name ? parseIdent() : isStatement ? unexpected() : null;
    node.superClass = eat(_extends) ? parseExpression() : null;
    var classBody = startNode();
    classBody.body = [];
    expect(_braceL);
    while (!eat(_braceR)) {
      var method = startNode();
      if (tokType === _name && tokVal === "static") {
        next();
        method['static'] = true;
      } else {
        method['static'] = false;
      }
      var isGenerator = eat(_star);
      parsePropertyName(method);
      if (tokType !== _parenL && !method.computed && method.key.type === "Identifier" &&
          (method.key.name === "get" || method.key.name === "set")) {
        if (isGenerator) unexpected();
        method.kind = method.key.name;
        parsePropertyName(method);
      } else {
        method.kind = "";
      }
      method.value = parseMethod(isGenerator);
      classBody.body.push(finishNode(method, "MethodDefinition"));
      eat(_semi);
    }
    node.body = finishNode(classBody, "ClassBody");
    return finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
  }

  // Parses a comma-separated list of expressions, and returns them as
  // an array. `close` is the token type that ends the list, and
  // `allowEmpty` can be turned on to allow subsequent commas with
  // nothing in between them to be parsed as `null` (which is needed
  // for array literals).

  function parseExprList(close, allowTrailingComma, allowEmpty) {
    var elts = [], first = true;
    while (!eat(close)) {
      if (!first) {
        expect(_comma);
        if (allowTrailingComma && options.allowTrailingCommas && eat(close)) break;
      } else first = false;

      if (allowEmpty && tokType === _comma) elts.push(null);
      else elts.push(parseExpression(true));
    }
    return elts;
  }

  // Parse the next token as an identifier. If `liberal` is true (used
  // when parsing properties), it will also convert keywords into
  // identifiers.

  function parseIdent(liberal) {
    var node = startNode();
    if (liberal && options.forbidReserved == "everywhere") liberal = false;
    if (tokType === _name) {
      if (!liberal &&
          (options.forbidReserved &&
           (options.ecmaVersion === 3 ? isReservedWord3 : isReservedWord5)(tokVal) ||
           strict && isStrictReservedWord(tokVal)) &&
          input.slice(tokStart, tokEnd).indexOf("\\") == -1)
        raise(tokStart, "The keyword '" + tokVal + "' is reserved");
      node.name = tokVal;
    } else if (liberal && tokType.keyword) {
      node.name = tokType.keyword;
    } else {
      unexpected();
    }
    tokRegexpAllowed = false;
    next();
    return finishNode(node, "Identifier");
  }

  // Parses module export declaration.

  function parseExport(node) {
    next();
    // export var|const|let|function|class ...;
    if (tokType === _var || tokType === _const || tokType === _let || tokType === _function || tokType === _class) {
      node.declaration = parseStatement();
      node['default'] = false;
      node.specifiers = null;
      node.source = null;
    } else
    // export default ...;
    if (eat(_default)) {
      node.declaration = parseExpression(true);
      node['default'] = true;
      node.specifiers = null;
      node.source = null;
      semicolon();
    } else {
      // export * from '...';
      // export { x, y as z } [from '...'];
      var isBatch = tokType === _star;
      node.declaration = null;
      node['default'] = false;
      node.specifiers = parseExportSpecifiers();
      if (tokType === _name && tokVal === "from") {
        next();
        node.source = tokType === _string ? parseExprAtom() : unexpected();
      } else {
        if (isBatch) unexpected();
        node.source = null;
      }
      semicolon();
    }
    return finishNode(node, "ExportDeclaration");
  }

  // Parses a comma-separated list of module exports.

  function parseExportSpecifiers() {
    var nodes = [], first = true;
    if (tokType === _star) {
      // export * from '...'
      var node = startNode();
      next();
      nodes.push(finishNode(node, "ExportBatchSpecifier"));
    } else {
      // export { x, y as z } [from '...']
      expect(_braceL);
      while (!eat(_braceR)) {
        if (!first) {
          expect(_comma);
          if (options.allowTrailingCommas && eat(_braceR)) break;
        } else first = false;

        var node = startNode();
        node.id = parseIdent(tokType === _default);
        if (tokType === _name && tokVal === "as") {
          next();
          node.name = parseIdent(true);
        } else {
          node.name = null;
        }
        nodes.push(finishNode(node, "ExportSpecifier"));
      }
    }
    return nodes;
  }

  // Parses import declaration.

  function parseImport(node) {
    next();
    // import '...';
    if (tokType === _string) {
      node.specifiers = [];
      node.source = parseExprAtom();
      node.kind = "";
    } else {
      node.specifiers = parseImportSpecifiers();
      if (tokType !== _name || tokVal !== "from") unexpected();
      next();
      node.source = tokType === _string ? parseExprAtom() : unexpected();
    }
    semicolon();
    return finishNode(node, "ImportDeclaration");
  }

  // Parses a comma-separated list of module imports.

  function parseImportSpecifiers() {
    var nodes = [], first = true;
    if (tokType === _name) {
      // import defaultObj, { x, y as z } from '...'
      var node = startNode();
      node.id = parseIdent();
      checkLVal(node.id, true);
      node.name = null;
      node['default'] = true;
      nodes.push(finishNode(node, "ImportSpecifier"));
      if (!eat(_comma)) return nodes;
    }
    if (tokType === _star) {
      var node = startNode();
      next();
      if (tokType !== _name || tokVal !== "as") unexpected();
      next();
      node.name = parseIdent();
      checkLVal(node.name, true);
      nodes.push(finishNode(node, "ImportBatchSpecifier"));
      return nodes;
    }
    expect(_braceL);
    while (!eat(_braceR)) {
      if (!first) {
        expect(_comma);
        if (options.allowTrailingCommas && eat(_braceR)) break;
      } else first = false;

      var node = startNode();
      node.id = parseIdent(true);
      if (tokType === _name && tokVal === "as") {
        next();
        node.name = parseIdent();
      } else {
        node.name = null;
      }
      checkLVal(node.name || node.id, true);
      node['default'] = false;
      nodes.push(finishNode(node, "ImportSpecifier"));
    }
    return nodes;
  }

  // Parses yield expression inside generator.

  function parseYield() {
    var node = startNode();
    next();
    if (eat(_semi) || canInsertSemicolon()) {
      node.delegate = false;
      node.argument = null;
    } else {
      node.delegate = eat(_star);
      node.argument = parseExpression(true);
    }
    return finishNode(node, "YieldExpression");
  }

  // Parses array and generator comprehensions.

  function parseComprehension(node, isGenerator) {
    node.blocks = [];
    while (tokType === _for) {
      var block = startNode();
      next();
      expect(_parenL);
      block.left = toAssignable(parseExprAtom());
      checkLVal(block.left, true);
      if (tokType !== _name || tokVal !== "of") unexpected();
      next();
      // `of` property is here for compatibility with Esprima's AST
      // which also supports deprecated [for (... in ...) expr]
      block.of = true;
      block.right = parseExpression();
      expect(_parenR);
      node.blocks.push(finishNode(block, "ComprehensionBlock"));
    }
    node.filter = eat(_if) ? parseParenExpression() : null;
    node.body = parseExpression();
    expect(isGenerator ? _parenR : _bracketR);
    node.generator = isGenerator;
    return finishNode(node, "ComprehensionExpression");
  }

});
;
// AST walker module for Mozilla Parser API compatible trees

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports); // CommonJS
  if (typeof define == "function" && define.amd) return define(["exports"], mod); // AMD
  mod((this.acorn || (this.acorn = {})).walk = {}); // Plain browser env
})(function(exports) {
  "use strict";

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
  exports.simple = function(node, visitors, base, state) {
    if (!base) base = exports.base;
    function c(node, st, override) {
      var type = override || node.type, found = visitors[type];
      base[type](node, st, c);
      if (found) found(node, st);
    }
    c(node, state);
  };

  // An ancestor walk builds up an array of ancestor nodes (including
  // the current node) and passes them to the callback as the state parameter.
  exports.ancestor = function(node, visitors, base, state) {
    if (!base) base = exports.base;
    if (!state) state = [];
    function c(node, st, override) {
      var type = override || node.type, found = visitors[type];
      if (node != st[st.length - 1]) {
        st = st.slice();
        st.push(node);
      }
      base[type](node, st, c);
      if (found) found(node, st);
    }
    c(node, state);
  };

  // A recursive walk is one where your functions override the default
  // walkers. They can modify and replace the state parameter that's
  // threaded through the walk, and can opt how and whether to walk
  // their child nodes (by calling their third argument on these
  // nodes).
  exports.recursive = function(node, state, funcs, base) {
    var visitor = funcs ? exports.make(funcs, base) : base;
    function c(node, st, override) {
      visitor[override || node.type](node, st, c);
    }
    c(node, state);
  };

  function makeTest(test) {
    if (typeof test == "string")
      return function(type) { return type == test; };
    else if (!test)
      return function() { return true; };
    else
      return test;
  }

  function Found(node, state) { this.node = node; this.state = state; }

  // Find a node with a given start, end, and type (all are optional,
  // null can be used as wildcard). Returns a {node, state} object, or
  // undefined when it doesn't find a matching node.
  exports.findNodeAt = function(node, start, end, test, base, state) {
    test = makeTest(test);
    try {
      if (!base) base = exports.base;
      var c = function(node, st, override) {
        var type = override || node.type;
        if ((start == null || node.start <= start) &&
            (end == null || node.end >= end))
          base[type](node, st, c);
        if (test(type, node) &&
            (start == null || node.start == start) &&
            (end == null || node.end == end))
          throw new Found(node, st);
      };
      c(node, state);
    } catch (e) {
      if (e instanceof Found) return e;
      throw e;
    }
  };

  // Find the innermost node of a given type that contains the given
  // position. Interface similar to findNodeAt.
  exports.findNodeAround = function(node, pos, test, base, state) {
    test = makeTest(test);
    try {
      if (!base) base = exports.base;
      var c = function(node, st, override) {
        var type = override || node.type;
        if (node.start > pos || node.end < pos) return;
        base[type](node, st, c);
        if (test(type, node)) throw new Found(node, st);
      };
      c(node, state);
    } catch (e) {
      if (e instanceof Found) return e;
      throw e;
    }
  };

  // Find the outermost matching node after a given position.
  exports.findNodeAfter = function(node, pos, test, base, state) {
    test = makeTest(test);
    try {
      if (!base) base = exports.base;
      var c = function(node, st, override) {
        if (node.end < pos) return;
        var type = override || node.type;
        if (node.start >= pos && test(type, node)) throw new Found(node, st);
        base[type](node, st, c);
      };
      c(node, state);
    } catch (e) {
      if (e instanceof Found) return e;
      throw e;
    }
  };

  // Find the outermost matching node before a given position.
  exports.findNodeBefore = function(node, pos, test, base, state) {
    test = makeTest(test);
    if (!base) base = exports.base;
    var max;
    var c = function(node, st, override) {
      if (node.start > pos) return;
      var type = override || node.type;
      if (node.end <= pos && (!max || max.node.end < node.end) && test(type, node))
        max = new Found(node, st);
      base[type](node, st, c);
    };
    c(node, state);
    return max;
  };

  // Used to create a custom walker. Will fill in all missing node
  // type properties with the defaults.
  exports.make = function(funcs, base) {
    if (!base) base = exports.base;
    var visitor = {};
    for (var type in base) visitor[type] = base[type];
    for (var type in funcs) visitor[type] = funcs[type];
    return visitor;
  };

  function skipThrough(node, st, c) { c(node, st); }
  function ignore(_node, _st, _c) {}

  // Node walkers.

  var base = exports.base = {};
  base.Program = base.BlockStatement = function(node, st, c) {
    for (var i = 0; i < node.body.length; ++i)
      c(node.body[i], st, "Statement");
  };
  base.Statement = skipThrough;
  base.EmptyStatement = ignore;
  base.ExpressionStatement = function(node, st, c) {
    c(node.expression, st, "Expression");
  };
  base.IfStatement = function(node, st, c) {
    c(node.test, st, "Expression");
    c(node.consequent, st, "Statement");
    if (node.alternate) c(node.alternate, st, "Statement");
  };
  base.LabeledStatement = function(node, st, c) {
    c(node.body, st, "Statement");
  };
  base.BreakStatement = base.ContinueStatement = ignore;
  base.WithStatement = function(node, st, c) {
    c(node.object, st, "Expression");
    c(node.body, st, "Statement");
  };
  base.SwitchStatement = function(node, st, c) {
    c(node.discriminant, st, "Expression");
    for (var i = 0; i < node.cases.length; ++i) {
      var cs = node.cases[i];
      if (cs.test) c(cs.test, st, "Expression");
      for (var j = 0; j < cs.consequent.length; ++j)
        c(cs.consequent[j], st, "Statement");
    }
  };
  base.ReturnStatement = base.YieldExpression = function(node, st, c) {
    if (node.argument) c(node.argument, st, "Expression");
  };
  base.ThrowStatement = base.SpreadElement = function(node, st, c) {
    c(node.argument, st, "Expression");
  };
  base.TryStatement = function(node, st, c) {
    c(node.block, st, "Statement");
    if (node.handler) c(node.handler.body, st, "ScopeBody");
    if (node.finalizer) c(node.finalizer, st, "Statement");
  };
  base.WhileStatement = function(node, st, c) {
    c(node.test, st, "Expression");
    c(node.body, st, "Statement");
  };
  base.DoWhileStatement = base.WhileStatement;
  base.ForStatement = function(node, st, c) {
    if (node.init) c(node.init, st, "ForInit");
    if (node.test) c(node.test, st, "Expression");
    if (node.update) c(node.update, st, "Expression");
    c(node.body, st, "Statement");
  };
  base.ForInStatement = base.ForOfStatement = function(node, st, c) {
    c(node.left, st, "ForInit");
    c(node.right, st, "Expression");
    c(node.body, st, "Statement");
  };
  base.ForInit = function(node, st, c) {
    if (node.type == "VariableDeclaration") c(node, st);
    else c(node, st, "Expression");
  };
  base.DebuggerStatement = ignore;

  base.FunctionDeclaration = function(node, st, c) {
    c(node, st, "Function");
  };
  base.VariableDeclaration = function(node, st, c) {
    for (var i = 0; i < node.declarations.length; ++i) {
      var decl = node.declarations[i];
      if (decl.init) c(decl.init, st, "Expression");
    }
  };

  base.Function = function(node, st, c) {
    c(node.body, st, "ScopeBody");
  };
  base.ScopeBody = function(node, st, c) {
    c(node, st, "Statement");
  };

  base.Expression = skipThrough;
  base.ThisExpression = ignore;
  base.ArrayExpression = function(node, st, c) {
    for (var i = 0; i < node.elements.length; ++i) {
      var elt = node.elements[i];
      if (elt) c(elt, st, "Expression");
    }
  };
  base.ObjectExpression = function(node, st, c) {
    for (var i = 0; i < node.properties.length; ++i)
      c(node.properties[i], st);
  };
  base.FunctionExpression = base.ArrowFunctionExpression = base.FunctionDeclaration;
  base.SequenceExpression = base.TemplateLiteral = function(node, st, c) {
    for (var i = 0; i < node.expressions.length; ++i)
      c(node.expressions[i], st, "Expression");
  };
  base.UnaryExpression = base.UpdateExpression = function(node, st, c) {
    c(node.argument, st, "Expression");
  };
  base.BinaryExpression = base.AssignmentExpression = base.LogicalExpression = function(node, st, c) {
    c(node.left, st, "Expression");
    c(node.right, st, "Expression");
  };
  base.ConditionalExpression = function(node, st, c) {
    c(node.test, st, "Expression");
    c(node.consequent, st, "Expression");
    c(node.alternate, st, "Expression");
  };
  base.NewExpression = base.CallExpression = function(node, st, c) {
    c(node.callee, st, "Expression");
    if (node.arguments) for (var i = 0; i < node.arguments.length; ++i)
      c(node.arguments[i], st, "Expression");
  };
  base.MemberExpression = function(node, st, c) {
    c(node.object, st, "Expression");
    if (node.computed) c(node.property, st, "Expression");
  };
  base.Identifier = base.Literal = base.ExportDeclaration = base.ImportDeclaration = ignore;

  base.TaggedTemplateExpression = function(node, st, c) {
    c(node.tag, st, "Expression");
    c(node.quasi, st);
  };
  base.ClassDeclaration = base.ClassExpression = function(node, st, c) {
    if (node.superClass) c(node.superClass, st, "Expression");
    for (var i = 0; i < node.body.body.length; i++)
      c(node.body.body[i], st);
  };
  base.MethodDefinition = base.Property = function(node, st, c) {
    if (node.computed) c(node.key, st, "Expression");
    c(node.value, st, "Expression");
  };
  base.ComprehensionExpression = function(node, st, c) {
    for (var i = 0; i < node.blocks.length; i++)
      c(node.blocks[i].right, st, "Expression");
    c(node.body, st, "Expression");
  };

  // NOTE: the stuff below is deprecated, and will be removed when 1.0 is released

  // A custom walker that keeps track of the scope chain and the
  // variables defined in it.
  function makeScope(prev, isCatch) {
    return {vars: Object.create(null), prev: prev, isCatch: isCatch};
  }
  function normalScope(scope) {
    while (scope.isCatch) scope = scope.prev;
    return scope;
  }
  exports.scopeVisitor = exports.make({
    Function: function(node, scope, c) {
      var inner = makeScope(scope);
      for (var i = 0; i < node.params.length; ++i)
        inner.vars[node.params[i].name] = {type: "argument", node: node.params[i]};
      if (node.id) {
        var decl = node.type == "FunctionDeclaration";
        (decl ? normalScope(scope) : inner).vars[node.id.name] =
          {type: decl ? "function" : "function name", node: node.id};
      }
      c(node.body, inner, "ScopeBody");
    },
    TryStatement: function(node, scope, c) {
      c(node.block, scope, "Statement");
      if (node.handler) {
        var inner = makeScope(scope, true);
        inner.vars[node.handler.param.name] = {type: "catch clause", node: node.handler.param};
        c(node.handler.body, inner, "ScopeBody");
      }
      if (node.finalizer) c(node.finalizer, scope, "Statement");
    },
    VariableDeclaration: function(node, scope, c) {
      var target = normalScope(scope);
      for (var i = 0; i < node.declarations.length; ++i) {
        var decl = node.declarations[i];
        target.vars[decl.id.name] = {type: "var", node: decl.id};
        if (decl.init) c(decl.init, scope, "Expression");
      }
    }
  });

});
;
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

(function(root, mod) {
  if (typeof exports == "object" && typeof module == "object") return mod(exports, require("./acorn")); // CommonJS
  if (typeof define == "function" && define.amd) return define(["exports", "./acorn"], mod); // AMD
  mod(root.acorn || (root.acorn = {}), root.acorn); // Plain browser env
})(this, function(exports, acorn) {
  "use strict";

  var tt = acorn.tokTypes;

  var options, input, fetchToken, context;

  acorn.defaultOptions.tabSize = 4;

  exports.parse_dammit = function(inpt, opts) {
    if (!opts) opts = {};
    input = String(inpt);
    fetchToken = acorn.tokenize(input, opts);
    options = fetchToken.options;
    sourceFile = options.sourceFile || null;
    context = [];
    nextLineStart = 0;
    ahead.length = 0;
    next();
    return parseTopLevel();
  };

  var lastEnd, token = {start: 0, end: 0}, ahead = [];
  var curLineStart, nextLineStart, curIndent, lastEndLoc, sourceFile;

  function next(forceRegexp) {
    lastEnd = token.end;
    if (options.locations)
      lastEndLoc = token.endLoc;
    if (forceRegexp)
      ahead.length = 0;

    token = ahead.shift() || readToken(forceRegexp);

    if (token.start >= nextLineStart) {
      while (token.start >= nextLineStart) {
        curLineStart = nextLineStart;
        nextLineStart = lineEnd(curLineStart) + 1;
      }
      curIndent = indentationAfter(curLineStart);
    }
  }

  function readToken(forceRegexp) {
    for (;;) {
      try {
        var tok = fetchToken(forceRegexp);
        if (tok.type === tt.dot && input.substr(tok.end, 1) === '.') {
          tok = fetchToken();
          tok.start--;
          tok.type = tt.ellipsis;
        }
        return tok;
      } catch(e) {
        if (!(e instanceof SyntaxError)) throw e;

        // Try to skip some text, based on the error message, and then continue
        var msg = e.message, pos = e.raisedAt, replace = true;
        if (/unterminated/i.test(msg)) {
          pos = lineEnd(e.pos + 1);
          if (/string/.test(msg)) {
            replace = {start: e.pos, end: pos, type: tt.string, value: input.slice(e.pos + 1, pos)};
          } else if (/regular expr/i.test(msg)) {
            var re = input.slice(e.pos, pos);
            try { re = new RegExp(re); } catch(e) {}
            replace = {start: e.pos, end: pos, type: tt.regexp, value: re};
          } else if (/template/.test(msg)) {
            replace = {start: e.pos, end: pos,
                       type: input.charAt(e.pos) == "`" ? tt.template : tt.templateContinued,
                       value: input.slice(e.pos + 1, pos)};
          } else {
            replace = false;
          }
        } else if (/invalid (unicode|regexp|number)|expecting unicode|octal literal|is reserved|directly after number/i.test(msg)) {
          while (pos < input.length && !isSpace(input.charCodeAt(pos))) ++pos;
        } else if (/character escape|expected hexadecimal/i.test(msg)) {
          while (pos < input.length) {
            var ch = input.charCodeAt(pos++);
            if (ch === 34 || ch === 39 || isNewline(ch)) break;
          }
        } else if (/unexpected character/i.test(msg)) {
          pos++;
          replace = false;
        } else if (/regular expression/i.test(msg)) {
          replace = true;
        } else {
          throw e;
        }
        resetTo(pos);
        if (replace === true) replace = {start: pos, end: pos, type: tt.name, value: "✖"};
        if (replace) {
          if (options.locations) {
            replace.startLoc = acorn.getLineInfo(input, replace.start);
            replace.endLoc = acorn.getLineInfo(input, replace.end);
          }
          return replace;
        }
      }
    }
  }

  function resetTo(pos) {
    for (;;) {
      try {
        var ch = input.charAt(pos - 1);
        var reAllowed = !ch || /[\[\{\(,;:?\/*=+\-~!|&%^<>]/.test(ch) ||
          /[enwfd]/.test(ch) && /\b(keywords|case|else|return|throw|new|in|(instance|type)of|delete|void)$/.test(input.slice(pos - 10, pos));
        return fetchToken.jumpTo(pos, reAllowed);
      } catch(e) {
        if (!(e instanceof SyntaxError && /unterminated comment/i.test(e.message))) throw e;
        pos = lineEnd(e.pos + 1);
        if (pos >= input.length) return;
      }
    }
  }

  function lookAhead(n) {
    while (n > ahead.length)
      ahead.push(readToken());
    return ahead[n-1];
  }

  var newline = /[\n\r\u2028\u2029]/;

  function isNewline(ch) {
    return ch === 10 || ch === 13 || ch === 8232 || ch === 8329;
  }
  function isSpace(ch) {
    return (ch < 14 && ch > 8) || ch === 32 || ch === 160 || isNewline(ch);
  }

  function pushCx() {
    context.push(curIndent);
  }
  function popCx() {
    curIndent = context.pop();
  }

  function lineEnd(pos) {
    while (pos < input.length && !isNewline(input.charCodeAt(pos))) ++pos;
    return pos;
  }
  function indentationAfter(pos) {
    for (var count = 0;; ++pos) {
      var ch = input.charCodeAt(pos);
      if (ch === 32) ++count;
      else if (ch === 9) count += options.tabSize;
      else return count;
    }
  }

  function closes(closeTok, indent, line, blockHeuristic) {
    if (token.type === closeTok || token.type === tt.eof) return true;
    if (line != curLineStart && curIndent < indent && tokenStartsLine() &&
        (!blockHeuristic || nextLineStart >= input.length ||
         indentationAfter(nextLineStart) < indent)) return true;
    return false;
  }

  function tokenStartsLine() {
    for (var p = token.start - 1; p >= curLineStart; --p) {
      var ch = input.charCodeAt(p);
      if (ch !== 9 && ch !== 32) return false;
    }
    return true;
  }

  function Node(start) {
    this.type = null;
    this.start = start;
    this.end = null;
  }
  Node.prototype = acorn.Node.prototype;

  function SourceLocation(start) {
    this.start = start || token.startLoc || {line: 1, column: 0};
    this.end = null;
    if (sourceFile !== null) this.source = sourceFile;
  }

  function startNode() {
    var node = new Node(token.start);
    if (options.locations)
      node.loc = new SourceLocation();
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [token.start, 0];
    return node;
  }

  function storeCurrentPos() {
    return options.locations ? [token.start, token.startLoc] : token.start;
  }

  function startNodeAt(pos) {
    var node;
    if (options.locations) {
      node = new Node(pos[0]);
      node.loc = new SourceLocation(pos[1]);
    } else {
      node = new Node(pos);
    }
    if (options.directSourceFile)
      node.sourceFile = options.directSourceFile;
    if (options.ranges)
      node.range = [pos[0], 0];
    return node;
  }

  function finishNode(node, type) {
    node.type = type;
    node.end = lastEnd;
    if (options.locations)
      node.loc.end = lastEndLoc;
    if (options.ranges)
      node.range[1] = lastEnd;
    return node;
  }

  function finishNodeAt(node, type, pos) {
    if (options.locations) { node.loc.end = pos[1]; pos = pos[0]; }
    node.type = type;
    node.end = pos;
    if (options.ranges) node.range[1] = pos;
    return node;
  }

  function dummyIdent() {
    var dummy = startNode();
    dummy.name = "✖";
    return finishNode(dummy, "Identifier");
  }
  function isDummy(node) { return node.name == "✖"; }

  function eat(type) {
    if (token.type === type) {
      next();
      return true;
    } else {
      return false;
    }
  }

  function canInsertSemicolon() {
    return (token.type === tt.eof || token.type === tt.braceR || newline.test(input.slice(lastEnd, token.start)));
  }
  function semicolon() {
    return eat(tt.semi);
  }

  function expect(type) {
    if (eat(type)) return true;
    if (lookAhead(1).type == type) {
      next(); next();
      return true;
    }
    if (lookAhead(2).type == type) {
      next(); next(); next();
      return true;
    }
  }

  function checkLVal(expr) {
    if (!expr) return expr;
    switch (expr.type) {
      case "Identifier":
      case "MemberExpression":
      case "ObjectPattern":
      case "ArrayPattern":
      case "SpreadElement":
        return expr;

      default:
        return dummyIdent();
    }
  }

  function parseTopLevel() {
    var node = startNodeAt(options.locations ? [0, acorn.getLineInfo(input, 0)] : 0);
    node.body = [];
    while (token.type !== tt.eof) node.body.push(parseStatement());
    lastEnd = token.end;
    lastEndLoc = token.endLoc;
    return finishNode(node, "Program");
  }

  function parseStatement() {
    if (token.type === tt.slash || token.type === tt.assign && token.value === "/=")
      next(true);

    var starttype = token.type, node = startNode();

    switch (starttype) {
    case tt._break: case tt._continue:
      next();
      var isBreak = starttype === tt._break;
      if (semicolon() || canInsertSemicolon()) {
        node.label = null;
      } else {
        node.label = token.type === tt.name ? parseIdent() : null;
        semicolon();
      }
      return finishNode(node, isBreak ? "BreakStatement" : "ContinueStatement");

    case tt._debugger:
      next();
      semicolon();
      return finishNode(node, "DebuggerStatement");

    case tt._do:
      next();
      node.body = parseStatement();
      node.test = eat(tt._while) ? parseParenExpression() : dummyIdent();
      semicolon();
      return finishNode(node, "DoWhileStatement");

    case tt._for:
      next();
      pushCx();
      expect(tt.parenL);
      if (token.type === tt.semi) return parseFor(node, null);
      if (token.type === tt._var || token.type === tt._let) {
        var init = parseVar(true);
        if (init.declarations.length === 1 && (token.type === tt._in || token.type === tt.name && token.value === "of")) {
          return parseForIn(node, init);
        }
        return parseFor(node, init);
      }
      var init = parseExpression(false, true);
      if (token.type === tt._in || token.type === tt.name && token.value === "of") {
        return parseForIn(node, checkLVal(init));
      }
      return parseFor(node, init);

    case tt._function:
      next();
      return parseFunction(node, true);

    case tt._if:
      next();
      node.test = parseParenExpression();
      node.consequent = parseStatement();
      node.alternate = eat(tt._else) ? parseStatement() : null;
      return finishNode(node, "IfStatement");

    case tt._return:
      next();
      if (eat(tt.semi) || canInsertSemicolon()) node.argument = null;
      else { node.argument = parseExpression(); semicolon(); }
      return finishNode(node, "ReturnStatement");

    case tt._switch:
      var blockIndent = curIndent, line = curLineStart;
      next();
      node.discriminant = parseParenExpression();
      node.cases = [];
      pushCx();
      expect(tt.braceL);

      for (var cur; !closes(tt.braceR, blockIndent, line, true);) {
        if (token.type === tt._case || token.type === tt._default) {
          var isCase = token.type === tt._case;
          if (cur) finishNode(cur, "SwitchCase");
          node.cases.push(cur = startNode());
          cur.consequent = [];
          next();
          if (isCase) cur.test = parseExpression();
          else cur.test = null;
          expect(tt.colon);
        } else {
          if (!cur) {
            node.cases.push(cur = startNode());
            cur.consequent = [];
            cur.test = null;
          }
          cur.consequent.push(parseStatement());
        }
      }
      if (cur) finishNode(cur, "SwitchCase");
      popCx();
      eat(tt.braceR);
      return finishNode(node, "SwitchStatement");

    case tt._throw:
      next();
      node.argument = parseExpression();
      semicolon();
      return finishNode(node, "ThrowStatement");

    case tt._try:
      next();
      node.block = parseBlock();
      node.handler = null;
      if (token.type === tt._catch) {
        var clause = startNode();
        next();
        expect(tt.parenL);
        clause.param = parseIdent();
        expect(tt.parenR);
        clause.guard = null;
        clause.body = parseBlock();
        node.handler = finishNode(clause, "CatchClause");
      }
      node.finalizer = eat(tt._finally) ? parseBlock() : null;
      if (!node.handler && !node.finalizer) return node.block;
      return finishNode(node, "TryStatement");

    case tt._var:
    case tt._let:
    case tt._const:
      return parseVar();

    case tt._while:
      next();
      node.test = parseParenExpression();
      node.body = parseStatement();
      return finishNode(node, "WhileStatement");

    case tt._with:
      next();
      node.object = parseParenExpression();
      node.body = parseStatement();
      return finishNode(node, "WithStatement");

    case tt.braceL:
      return parseBlock();

    case tt.semi:
      next();
      return finishNode(node, "EmptyStatement");

    case tt._class:
      return parseObj(true, true);

    case tt._import:
      return parseImport();

    case tt._export:
      return parseExport();

    default:
      var expr = parseExpression();
      if (isDummy(expr)) {
        next();
        if (token.type === tt.eof) return finishNode(node, "EmptyStatement");
        return parseStatement();
      } else if (starttype === tt.name && expr.type === "Identifier" && eat(tt.colon)) {
        node.body = parseStatement();
        node.label = expr;
        return finishNode(node, "LabeledStatement");
      } else {
        node.expression = expr;
        semicolon();
        return finishNode(node, "ExpressionStatement");
      }
    }
  }

  function parseBlock() {
    var node = startNode();
    pushCx();
    expect(tt.braceL);
    var blockIndent = curIndent, line = curLineStart;
    node.body = [];
    while (!closes(tt.braceR, blockIndent, line, true))
      node.body.push(parseStatement());
    popCx();
    eat(tt.braceR);
    return finishNode(node, "BlockStatement");
  }

  function parseFor(node, init) {
    node.init = init;
    node.test = node.update = null;
    if (eat(tt.semi) && token.type !== tt.semi) node.test = parseExpression();
    if (eat(tt.semi) && token.type !== tt.parenR) node.update = parseExpression();
    popCx();
    expect(tt.parenR);
    node.body = parseStatement();
    return finishNode(node, "ForStatement");
  }

  function parseForIn(node, init) {
    var type = token.type === tt._in ? "ForInStatement" : "ForOfStatement";
    next();
    node.left = init;
    node.right = parseExpression();
    popCx();
    expect(tt.parenR);
    node.body = parseStatement();
    return finishNode(node, type);
  }

  function parseVar(noIn) {
    var node = startNode();
    node.kind = token.type.keyword;
    next();
    node.declarations = [];
    do {
      var decl = startNode();
      decl.id = options.ecmaVersion >= 6 ? toAssignable(parseExprAtom()) : parseIdent();
      decl.init = eat(tt.eq) ? parseExpression(true, noIn) : null;
      node.declarations.push(finishNode(decl, "VariableDeclarator"));
    } while (eat(tt.comma));
    if (!node.declarations.length) {
      var decl = startNode();
      decl.id = dummyIdent();
      node.declarations.push(finishNode(decl, "VariableDeclarator"));
    }
    if (!noIn) semicolon();
    return finishNode(node, "VariableDeclaration");
  }

  function parseExpression(noComma, noIn) {
    var start = storeCurrentPos();
    var expr = parseMaybeAssign(noIn);
    if (!noComma && token.type === tt.comma) {
      var node = startNodeAt(start);
      node.expressions = [expr];
      while (eat(tt.comma)) node.expressions.push(parseMaybeAssign(noIn));
      return finishNode(node, "SequenceExpression");
    }
    return expr;
  }

  function parseParenExpression() {
    pushCx();
    expect(tt.parenL);
    var val = parseExpression();
    popCx();
    expect(tt.parenR);
    return val;
  }

  function parseMaybeAssign(noIn) {
    var start = storeCurrentPos();
    var left = parseMaybeConditional(noIn);
    if (token.type.isAssign) {
      var node = startNodeAt(start);
      node.operator = token.value;
      node.left = token.type === tt.eq ? toAssignable(left) : checkLVal(left);
      next();
      node.right = parseMaybeAssign(noIn);
      return finishNode(node, "AssignmentExpression");
    }
    return left;
  }

  function parseMaybeConditional(noIn) {
    var start = storeCurrentPos();
    var expr = parseExprOps(noIn);
    if (eat(tt.question)) {
      var node = startNodeAt(start);
      node.test = expr;
      node.consequent = parseExpression(true);
      node.alternate = expect(tt.colon) ? parseExpression(true, noIn) : dummyIdent();
      return finishNode(node, "ConditionalExpression");
    }
    return expr;
  }

  function parseExprOps(noIn) {
    var start = storeCurrentPos();
    var indent = curIndent, line = curLineStart;
    return parseExprOp(parseMaybeUnary(noIn), start, -1, noIn, indent, line);
  }

  function parseExprOp(left, start, minPrec, noIn, indent, line) {
    if (curLineStart != line && curIndent < indent && tokenStartsLine()) return left;
    var prec = token.type.binop;
    if (prec != null && (!noIn || token.type !== tt._in)) {
      if (prec > minPrec) {
        var node = startNodeAt(start);
        node.left = left;
        node.operator = token.value;
        next();
        if (curLineStart != line && curIndent < indent && tokenStartsLine()) {
          node.right = dummyIdent();
        } else {
          var rightStart = storeCurrentPos();
          node.right = parseExprOp(parseMaybeUnary(noIn), rightStart, prec, noIn, indent, line);
        }
        finishNode(node, /&&|\|\|/.test(node.operator) ? "LogicalExpression" : "BinaryExpression");
        return parseExprOp(node, start, minPrec, noIn, indent, line);
      }
    }
    return left;
  }

  function parseMaybeUnary(noIn) {
    if (token.type.prefix) {
      var node = startNode(), update = token.type.isUpdate, nodeType;
      if (token.type === tt.ellipsis) {
        nodeType = "SpreadElement";
      } else {
        nodeType = update ? "UpdateExpression" : "UnaryExpression";
        node.operator = token.value;
        node.prefix = true;
      }
      node.operator = token.value;
      node.prefix = true;
      next();
      node.argument = parseMaybeUnary(noIn);
      if (update) node.argument = checkLVal(node.argument);
      return finishNode(node, nodeType);
    }
    var start = storeCurrentPos();
    var expr = parseExprSubscripts();
    while (token.type.postfix && !canInsertSemicolon()) {
      var node = startNodeAt(start);
      node.operator = token.value;
      node.prefix = false;
      node.argument = checkLVal(expr);
      next();
      expr = finishNode(node, "UpdateExpression");
    }
    return expr;
  }

  function parseExprSubscripts() {
    var start = storeCurrentPos();
    return parseSubscripts(parseExprAtom(), start, false, curIndent, curLineStart);
  }

  function parseSubscripts(base, start, noCalls, startIndent, line) {
    for (;;) {
      if (curLineStart != line && curIndent <= startIndent && tokenStartsLine()) {
        if (token.type == tt.dot && curIndent == startIndent)
          --startIndent;
        else
          return base;
      }

      if (eat(tt.dot)) {
        var node = startNodeAt(start);
        node.object = base;
        if (curLineStart != line && curIndent <= startIndent && tokenStartsLine())
          node.property = dummyIdent();
        else
          node.property = parsePropertyAccessor() || dummyIdent();
        node.computed = false;
        base = finishNode(node, "MemberExpression");
      } else if (token.type == tt.bracketL) {
        pushCx();
        next();
        var node = startNodeAt(start);
        node.object = base;
        node.property = parseExpression();
        node.computed = true;
        popCx();
        expect(tt.bracketR);
        base = finishNode(node, "MemberExpression");
      } else if (!noCalls && token.type == tt.parenL) {
        pushCx();
        var node = startNodeAt(start);
        node.callee = base;
        node.arguments = parseExprList(tt.parenR);
        base = finishNode(node, "CallExpression");
      } else if (token.type == tt.template) {
        var node = startNodeAt(start);
        node.tag = base;
        node.quasi = parseTemplate();
        base = finishNode(node, "TaggedTemplateExpression");
      } else {
        return base;
      }
    }
  }

  function parseExprAtom() {
    switch (token.type) {
    case tt._this:
      var node = startNode();
      next();
      return finishNode(node, "ThisExpression");

    case tt.name:
      var start = storeCurrentPos();
      var id = parseIdent();
      return eat(tt.arrow) ? parseArrowExpression(startNodeAt(start), [id]) : id;

    case tt.regexp:
      var node = startNode();
      var val = token.value;
      node.regex = {pattern: val.pattern, flags: val.flags};
      node.value = val.value;
      node.raw = input.slice(token.start, token.end);
      next();
      return finishNode(node, "Literal");

    case tt.num: case tt.string:
      var node = startNode();
      node.value = token.value;
      node.raw = input.slice(token.start, token.end);
      next();
      return finishNode(node, "Literal");

    case tt._null: case tt._true: case tt._false:
      var node = startNode();
      node.value = token.type.atomValue;
      node.raw = token.type.keyword;
      next();
      return finishNode(node, "Literal");

    case tt.parenL:
      var start = storeCurrentPos();
      next();
      var val = parseExpression();
      expect(tt.parenR);
      if (eat(tt.arrow)) {
        return parseArrowExpression(startNodeAt(start), val.expressions || (isDummy(val) ? [] : [val]));
      }
      if (options.preserveParens) {
        var par = startNodeAt(start);
        par.expression = val;
        val = finishNode(par, "ParenthesizedExpression");
      }
      return val;

    case tt.bracketL:
      var node = startNode();
      pushCx();
      node.elements = parseExprList(tt.bracketR, true);
      return finishNode(node, "ArrayExpression");

    case tt.braceL:
      return parseObj();

    case tt._class:
      return parseObj(true);

    case tt._function:
      var node = startNode();
      next();
      return parseFunction(node, false);

    case tt._new:
      return parseNew();

    case tt._yield:
      var node = startNode();
      next();
      if (semicolon() || canInsertSemicolon()) {
        node.delegate = false;
        node.argument = null;
      } else {
        node.delegate = eat(tt.star);
        node.argument = parseExpression(true);
      }
      return finishNode(node, "YieldExpression");

    case tt.template:
      return parseTemplate();

    default:
      return dummyIdent();
    }
  }

  function parseNew() {
    var node = startNode(), startIndent = curIndent, line = curLineStart;
    next();
    var start = storeCurrentPos();
    node.callee = parseSubscripts(parseExprAtom(), start, true, startIndent, line);
    if (token.type == tt.parenL) {
      pushCx();
      node.arguments = parseExprList(tt.parenR);
    } else {
      node.arguments = [];
    }
    return finishNode(node, "NewExpression");
  }

  function parseTemplateElement() {
    var elem = startNodeAt(options.locations ? [token.start + 1, token.startLoc.offset(1)] : token.start + 1);
    elem.value = token.value;
    elem.tail = input.charCodeAt(token.end - 1) !== 123; // '{'
    var endOff = elem.tail ? 1 : 2;
    var endPos = options.locations ? [token.end - endOff, token.endLoc.offset(-endOff)] : token.end - endOff;
    next();
    return finishNodeAt(elem, "TemplateElement", endPos);
  }

  function parseTemplate() {
    var node = startNode();
    node.expressions = [];
    var curElt = parseTemplateElement();
    node.quasis = [curElt];
    while (!curElt.tail) {
      var next = parseExpression();
      if (isDummy(next)) {
        node.quasis[node.quasis.length - 1].tail = true;
        break;
      }
      node.expressions.push(next);
      if (token.type === tt.templateContinued) {
        node.quasis.push(curElt = parseTemplateElement());
      } else {
        curElt = startNode();
        curElt.value = {cooked: "", raw: ""};
        curElt.tail = true;
        node.quasis.push(curElt);
      }
    }
    return finishNode(node, "TemplateLiteral");
  }

  function parseObj(isClass, isStatement) {
    var node = startNode();
    if (isClass) {
      next();
      if (token.type === tt.name) node.id = parseIdent();
      else if (isStatement) node.id = dummyIdent();
      node.superClass = eat(tt._extends) ? parseExpression() : null;
      node.body = startNode();
      node.body.body = [];
    } else {
      node.properties = [];
    }
    pushCx();
    var indent = curIndent + 1, line = curLineStart;
    eat(tt.braceL);
    if (curIndent + 1 < indent) { indent = curIndent; line = curLineStart; }
    while (!closes(tt.braceR, indent, line)) {
      var prop = startNode(), isGenerator;
      if (options.ecmaVersion >= 6) {
        if (isClass) {
          if (prop['static'] = (token.type === tt.name && token.value === "static")) next();
        } else {
          prop.method = false;
          prop.shorthand = false;
        }
        isGenerator = eat(tt.star);
      }
      parsePropertyName(prop);
      if (isDummy(prop.key)) { if (isDummy(parseExpression(true))) next(); eat(tt.comma); continue; }
      if (!isClass && eat(tt.colon)) {
        prop.kind = "init";
        prop.value = parseExpression(true);
      } else if (options.ecmaVersion >= 6 && (token.type === tt.parenL || token.type === tt.braceL)) {
        if (isClass) {
          prop.kind = "";
        } else {
          prop.kind = "init";
          prop.method = true;
        }
        prop.value = parseMethod(isGenerator);
      } else if (options.ecmaVersion >= 5 && prop.key.type === "Identifier" &&
                 (prop.key.name === "get" || prop.key.name === "set")) {
        prop.kind = prop.key.name;
        parsePropertyName(prop);
        prop.value = parseMethod(false);
      } else if (isClass) {
        prop.kind = "";
        prop.value = parseMethod(isGenerator);
      } else {
        prop.kind = "init";
        prop.value = options.ecmaVersion >= 6 ? prop.key : dummyIdent();
        prop.shorthand = true;
      }

      if (isClass) {
        node.body.body.push(finishNode(prop, "MethodDefinition"));
        semicolon();
      } else {
        node.properties.push(finishNode(prop, "Property"));
        eat(tt.comma);
      }
    }
    popCx();
    if (!eat(tt.braceR)) {
      // If there is no closing brace, make the node span to the start
      // of the next token (this is useful for Tern)
      lastEnd = token.start;
      if (options.locations) lastEndLoc = token.startLoc;
    }
    if (isClass) {
      semicolon();
      finishNode(node.body, "ClassBody");
      return finishNode(node, isStatement ? "ClassDeclaration" : "ClassExpression");
    } else {
      return finishNode(node, "ObjectExpression");
    }
  }

  function parsePropertyName(prop) {
    if (options.ecmaVersion >= 6) {
      if (eat(tt.bracketL)) {
        prop.computed = true;
        prop.key = parseExpression();
        expect(tt.bracketR);
        return;
      } else {
        prop.computed = false;
      }
    }
    var key = (token.type === tt.num || token.type === tt.string) ? parseExprAtom() : parseIdent();
    prop.key = key || dummyIdent();
  }

  function parsePropertyAccessor() {
    if (token.type === tt.name || token.type.keyword) return parseIdent();
  }

  function parseIdent() {
    var node = startNode();
    node.name = token.type === tt.name ? token.value : token.type.keyword;
    fetchToken.noRegexp();
    next();
    return finishNode(node, "Identifier");
  }

  function initFunction(node) {
    node.id = null;
    node.params = [];
    if (options.ecmaVersion >= 6) {
      node.defaults = [];
      node.rest = null;
      node.generator = false;
      node.expression = false;
    }
  }

  // Convert existing expression atom to assignable pattern
  // if possible.

  function toAssignable(node) {
    if (options.ecmaVersion >= 6 && node) {
      switch (node.type) {
        case "ObjectExpression":
          node.type = "ObjectPattern";
          var props = node.properties;
          for (var i = 0; i < props.length; i++) {
            props[i].value = toAssignable(props[i].value);
          }
          break;

        case "ArrayExpression":
          node.type = "ArrayPattern";
          var elms = node.elements;
          for (var i = 0; i < elms.length; i++) {
            elms[i] = toAssignable(elms[i]);
          }
          break;

        case "SpreadElement":
          node.argument = toAssignable(node.argument);
          break;
      }
    }
    return checkLVal(node);
  }

  function parseFunctionParams(node, params) {
    var defaults = [], hasDefaults = false;

    if (!params) {
      pushCx();
      params = parseExprList(tt.parenR);
    }
    for (var i = 0; i < params.length; i++) {
      var param = params[i], defValue = null;
      if (param.type === "AssignmentExpression") {
        defValue = param.right;
        param = param.left;
      }
      param = toAssignable(param);
      if (param.type === "SpreadElement") {
        param = param.argument;
        if (i === params.length - 1) {
          node.rest = param;
          continue;
        }
      }
      node.params.push(param);
      defaults.push(defValue);
      if (defValue) hasDefaults = true;
    }

    if (hasDefaults) node.defaults = defaults;
  }

  function parseFunction(node, isStatement) {
    initFunction(node);
    if (options.ecmaVersion >= 6) {
      node.generator = eat(tt.star);
    }
    if (token.type === tt.name) node.id = parseIdent();
    else if (isStatement) node.id = dummyIdent();
    parseFunctionParams(node);
    node.body = parseBlock();
    return finishNode(node, isStatement ? "FunctionDeclaration" : "FunctionExpression");
  }

  function parseMethod(isGenerator) {
    var node = startNode();
    initFunction(node);
    parseFunctionParams(node);
    node.generator = isGenerator || false;
    node.expression = options.ecmaVersion >= 6 && token.type !== tt.braceL;
    node.body = node.expression ? parseExpression(true) : parseBlock();
    return finishNode(node, "FunctionExpression");
  }

  function parseArrowExpression(node, params) {
    initFunction(node);
    parseFunctionParams(node, params);
    node.expression = token.type !== tt.braceL;
    node.body = node.expression ? parseExpression(true) : parseBlock();
    return finishNode(node, "ArrowFunctionExpression");
  }

  function parseExport() {
    var node = startNode();
    next();
    node['default'] = eat(tt._default);
    node.specifiers = node.source = null;
    if (node['default']) {
      node.declaration = parseExpression();
      semicolon();
    } else if (token.type.keyword) {
      node.declaration = parseStatement();
    } else {
      node.declaration = null;
      parseSpecifierList(node, "Export");
    }
    semicolon();
    return finishNode(node, "ExportDeclaration");
  }

  function parseImport() {
    var node = startNode();
    next();
    if (token.type === tt.string) {
      node.specifiers = [];
      node.source = parseExprAtom();
      node.kind = '';
    } else {
      if (token.type === tt.name && token.value !== "from") {
        var elt = startNode();
        elt.id = parseIdent();
        elt.name = null;
        elt['default'] = true;
        finishNode(elt, "ImportSpecifier");
        eat(tt.comma);
      }
      parseSpecifierList(node, "Import");
      var specs = node.specifiers;
      for (var i = 0; i < specs.length; i++) specs[i]['default'] = false;
      if (elt) node.specifiers.unshift(elt);
    }
    semicolon();
    return finishNode(node, "ImportDeclaration");
  }

  function parseSpecifierList(node, prefix) {
    var elts = node.specifiers = [];
    if (token.type === tt.star) {
      var elt = startNode();
      next();
      if (token.type === tt.name && token.value === "as") {
        next();
        elt.name = parseIdent();
      }
      elts.push(finishNode(elt, prefix + "BatchSpecifier"));
    } else {
      var indent = curIndent, line = curLineStart, continuedLine = nextLineStart;
      pushCx();
      eat(tt.braceL);
      if (curLineStart > continuedLine) continuedLine = curLineStart;
      while (!closes(tt.braceR, indent + (curLineStart <= continuedLine ? 1 : 0), line)) {
        var elt = startNode();
        if (token.type === tt.star) {
          next();
          if (token.type === tt.name && token.value === "as") {
            next();
            elt.name = parseIdent();
          }
          finishNode(elt, prefix + "BatchSpecifier");
        } else {
          if (token.type === tt.name && token.value === "from") break;
          elt.id = parseIdent();
          if (token.type === tt.name && token.value === "as") {
            next();
            elt.name = parseIdent();
          } else {
            elt.name = null;
          }
          finishNode(elt, prefix + "Specifier");
        }
        elts.push(elt);
        eat(tt.comma);
      }
      eat(tt.braceR);
      popCx();
    }
    if (token.type === tt.name && token.value === "from") {
      next();
      node.source = parseExprAtom();
    } else {
      node.source = null;
    }
  }

  function parseExprList(close, allowEmpty) {
    var indent = curIndent, line = curLineStart, elts = [];
    next(); // Opening bracket
    while (!closes(close, indent + 1, line)) {
      if (eat(tt.comma)) {
        elts.push(allowEmpty ? null : dummyIdent());
        continue;
      }
      var elt = parseExpression(true);
      if (isDummy(elt)) {
        if (closes(close, indent, line)) break;
        next();
      } else {
        elts.push(elt);
      }
      eat(tt.comma);
    }
    popCx();
    if (!eat(close)) {
      // If there is no closing brace, make the node span to the start
      // of the next token (this is useful for Tern)
      lastEnd = token.start;
      if (options.locations) lastEndLoc = token.startLoc;
    }
    return elts;
  }
});
;
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
        var target = p.get(Global);
        if (!target) return;
        ea.methods.forEach(function(name) { delete target[name]; });
        if (ea.alias)
          ea.alias.forEach(function(mapping) { delete target[mapping[0]]; });

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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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
    return Array.isArray(object) ?
      Array.prototype.slice.call(object) : exports.obj.extend({}, object);
  },

  extract: function(properties, object, mapFunc) {
    return properties.reduce(function(extracted, name) {
      if (object.hasOwnProperty(name)) {
        var val = mapFunc ? mapFunc(name, object[name]) : object[name];
        extracted[name] = val;
      }
      return extracted;
    }, {});
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
    // `options` can be {printFunctionSource: BOOLEAN, escapeKeys: BOOLEAN, maxDepth: NUMBER}
    options = options || {};
    depth = depth || 0;
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
      printedProps = object.map(function(ea) { return inspect(ea, options, depth); });
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

    var printedPropsJoined = printedProps.join(','),
        useNewLines = !isArray
          && (!options.minLengthForNewLine
          || printedPropsJoined.length >= options.minLengthForNewLine),
        ind = indent('', options.indent || '  ', depth),
        propIndent = indent('', options.indent || '  ', depth + 1),
        startBreak = useNewLines ? '\n' + propIndent: '',
        endBreak = useNewLines ? '\n' + ind : '';
    if (useNewLines) printedPropsJoined = printedProps.join(',' + startBreak);
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
    if (this.isRoot()) return undefined;
    var parent = obj
    for (var i = 0; i < this._parts.length-1; i++) {
      var part = this._parts[i];
      if (parent.hasOwnProperty(part) && (typeof parent[part] === "object" || typeof parent[part] === "function")) {
        parent = parent[part];
      } else if (ensure) {
        parent = parent[part] = {};
      } else {
        return undefined;
      }
    }
    return parent[this._parts[this._parts.length-1]] = val;
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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
    return array.inject([], function(a, value, index) {
      if (0 === index || (sorted ? a.last() != value : !a.include(value)))
        a.push(value);
      return a;
    });
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

  delimWith: function(array, delim) {
    return array.reduce(function(xs, x) {
      if (xs.length > 0) xs.push(delim)
      xs.push(x); return xs;
    }, []);
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
    return array.clone().reverse().inject(endFunc, function(nextFunc, ea, idx) {
      return function() {
        iterator.call(context || (typeof window !== 'undefined' ? window : global), ea, idx);
        // only really delay every n'th call optionally
        if (optSynchronChunks && (idx % optSynchronChunks !== 0)) {
          nextFunc()
        } else {
          nextFunc.delay(waitSecs);
        }
      }
    })();
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
    if (!options.parallel) options.parallel = array.length-1;

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

// A grid is just a two-dimaensional array, representing a table-like data
var grid = exports.grid = {

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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
;
/*
 * Methods for traversing and transforming tree structures.
 */
;(function(exports) {
"use strict";

var tree = exports.tree = {

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
  }

}

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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
    return objString + (f.methodName || f.displayNameName || f.name || "anonymous");
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
      // cleaning up
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
      // cleaning up
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
        if (!endCallback) endCallback = args.length === 0 ? function() {} : args.pop();

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
      }
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
  if (typeof lively !== 'undefined' && lively.Config && lively.Config.get('loadRewrittenCode')) {
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
    if (typeof lively !== 'undefined' && lively.Config && lively.Config.get('loadRewrittenCode')) {
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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
		function md5blk(s) { 		/* I figured global was faster.   */
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
      // split string at start and end
      // return (0, start), (start, end), (end, ...)
      startGap = startGap || 0; endGap = endGap || 0;
      return [string.slice(0, start),
          string.slice(start+startGap, end-endGap),
          string.slice(end)]
    }

    function matchStringForward(s, pattern) {
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

  digitValue: function() {
    // ignore-in-doc
    return this.charCodeAt(0) - "0".charCodeAt(0);
  },

  times: function(s, count) {
    // Example:
    // string.times("test", 3) // => "testtesttest"
    return count < 1 ? '' : new Array(count + 1).join(s);
  }

}

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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
    //
    // var specialStart = fromString('$_'),
    //   Lu = fromUnicodeGeneralCategory('Lu'),
    //   Ll = fromUnicodeGeneralCategory('Ll'),
    //   Lt = fromUnicodeGeneralCategory('Lt'),
    //   Lm = fromUnicodeGeneralCategory('Lm'),
    //   Lo = fromUnicodeGeneralCategory('Lo'),
    //   Nl = fromUnicodeGeneralCategory('Nl');
    //   joiner1 = fromString("\u200C"),
    //   joiner2 = fromString("\u200D"),
    //   Mn = fromUnicodeGeneralCategory("Mn"),
    //   Mc = fromUnicodeGeneralCategory("Mc"),
    //   Nd = fromUnicodeGeneralCategory("Nd"),
    //   Pc = fromUnicodeGeneralCategory("Pc"),
    //   startCharTester = toRegex([specialStart,Lu,Ll,Lt,Lm,Lo,Nl].reduce(union)),
    //   precedingCharTester = toRegex([specialStart, Lu,Ll,Lt,Lm,Lo,Nl, joiner1, joiner2,Mn, Mc, Nd, Pc].reduce(union));
    // console.log('var startChars = /%s/;', startCharTester);
    // console.log('var precedingCharTester = /^(?:%s)*$/;', precedingCharTester);
    var startCharTester = /[$A-Z_a-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮͰ-ʹͶ-ͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁҊ-ԣԱ-Ֆՙա-ևא-תװ-ײء-يٮ-ٯٱ-ۓەۥ-ۦۮ-ۯۺ-ۼۿܐܒ-ܯݍ-ޥޱߊ-ߪߴ-ߵߺऄ-हऽॐक़-ॡॱ-ॲॻ-ॿঅ-ঌএ-ঐও-নপ-রলশ-হঽৎড়-ঢ়য়-ৡৰ-ৱਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹਖ਼-ੜਫ਼ੲ-ੴઅ-ઍએ-ઑઓ-નપ-રલ-ળવ-હઽૐૠ-ૡଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହଽଡ଼-ଢ଼ୟ-ୡୱஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹௐఅ-ఌఎ-ఐఒ-నప-ళవ-హఽౘ-ౙౠ-ౡಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹಽೞೠ-ೡഅ-ഌഎ-ഐഒ-നപ-ഹഽൠ-ൡൺ-ൿඅ-ඖක-නඳ-රලව-ෆก-ะา-ำเ-ๆກ-ຂຄງ-ຈຊຍດ-ທນ-ຟມ-ຣລວສ-ຫອ-ະາ-ຳຽເ-ໄໆໜ-ໝༀཀ-ཇཉ-ཬྈ-ྋက-ဪဿၐ-ၕၚ-ၝၡၥ-ၦၮ-ၰၵ-ႁႎႠ-Ⴥა-ჺჼᄀ-ᅙᅟ-ᆢᆨ-ᇹሀ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙶᚁ-ᚚᚠ-ᛪ\u16ee-\u16f0ᜀ-ᜌᜎ-ᜑᜠ-ᜱᝀ-ᝑᝠ-ᝬᝮ-ᝰក-ឳៗៜᠠ-ᡷᢀ-ᢨᢪᤀ-ᤜᥐ-ᥭᥰ-ᥴᦀ-ᦩᧁ-ᧇᨀ-ᨖᬅ-ᬳᭅ-ᭋᮃ-ᮠᮮ-ᮯᰀ-ᰣᱍ-ᱏᱚ-ᱽᴀ-ᶿḀ-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼⁱⁿₐ-ₔℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ\u2160-\u2188Ⰰ-Ⱞⰰ-ⱞⱠ-Ɐⱱ-ⱽⲀ-ⳤⴀ-ⴥⴰ-ⵥⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞⸯ々-\u3007\u3021-\u3029〱-〵\u3038-〼ぁ-ゖゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆷㇰ-ㇿ㐀-䶵一-鿃ꀀ-ꒌꔀ-ꘌꘐ-ꘟꘪ-ꘫꙀ-ꙟꙢ-ꙮꙿ-ꚗꜗ-ꜟꜢ-ꞈꞋ-ꞌꟻ-ꠁꠃ-ꠅꠇ-ꠊꠌ-ꠢꡀ-ꡳꢂ-ꢳꤊ-ꤥꤰ-ꥆꨀ-ꨨꩀ-ꩂꩄ-ꩋ가-힣豈-鶴侮-頻並-龎ﬀ-ﬆﬓ-ﬗיִײַ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻﹰ-ﹴﹶ-ﻼＡ-Ｚａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]|[\ud840-\ud868][\udc00-\udfff]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\ude80-\ude9c\udea0-\uded0\udf00-\udf1e\udf30-\udf4a\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f\udd00-\udd15\udd20-\udd39\ude00\ude10-\ude13\ude15-\ude17\ude19-\ude33]|\ud808[\udc00-\udf6e]|\ud809[\udc00-\udc62]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb]|\ud869[\udc00-\uded6]|\ud87e[\udc00-\ude1d]/;
    var precedingCharTester = /^(?:[$0-9A-Z_a-zªµºÀ-ÖØ-öø-ˁˆ-ˑˠ-ˤˬˮ\u0300-ʹͶ-ͷͺ-ͽΆΈ-ΊΌΎ-ΡΣ-ϵϷ-ҁ\u0483-\u0487Ҋ-ԣԱ-Ֆՙա-և\u0591-\u05bd\u05bf\u05c1-\u05c2\u05c4-\u05c5\u05c7א-תװ-ײ\u0610-\u061aء-\u065e٠-٩ٮ-ۓە-\u06dc\u06df-\u06e8\u06ea-ۼۿܐ-\u074aݍ-ޱ߀-ߵߺ\u0901-ह\u093c-\u094dॐ-\u0954क़-\u0963०-९ॱ-ॲॻ-ॿ\u0981-\u0983অ-ঌএ-ঐও-নপ-রলশ-হ\u09bc-\u09c4\u09c7-\u09c8\u09cb-ৎ\u09d7ড়-ঢ়য়-\u09e3০-ৱ\u0a01-\u0a03ਅ-ਊਏ-ਐਓ-ਨਪ-ਰਲ-ਲ਼ਵ-ਸ਼ਸ-ਹ\u0a3c\u0a3e-\u0a42\u0a47-\u0a48\u0a4b-\u0a4d\u0a51ਖ਼-ੜਫ਼੦-\u0a75\u0a81-\u0a83અ-ઍએ-ઑઓ-નપ-રલ-ળવ-હ\u0abc-\u0ac5\u0ac7-\u0ac9\u0acb-\u0acdૐૠ-\u0ae3૦-૯\u0b01-\u0b03ଅ-ଌଏ-ଐଓ-ନପ-ରଲ-ଳଵ-ହ\u0b3c-\u0b44\u0b47-\u0b48\u0b4b-\u0b4d\u0b56-\u0b57ଡ଼-ଢ଼ୟ-\u0b63୦-୯ୱ\u0b82-ஃஅ-ஊஎ-ஐஒ-கங-சஜஞ-டண-தந-பம-ஹ\u0bbe-\u0bc2\u0bc6-\u0bc8\u0bca-\u0bcdௐ\u0bd7௦-௯\u0c01-\u0c03అ-ఌఎ-ఐఒ-నప-ళవ-హఽ-\u0c44\u0c46-\u0c48\u0c4a-\u0c4d\u0c55-\u0c56ౘ-ౙౠ-\u0c63౦-౯\u0c82-\u0c83ಅ-ಌಎ-ಐಒ-ನಪ-ಳವ-ಹ\u0cbc-\u0cc4\u0cc6-\u0cc8\u0cca-\u0ccd\u0cd5-\u0cd6ೞೠ-\u0ce3೦-೯\u0d02-\u0d03അ-ഌഎ-ഐഒ-നപ-ഹഽ-\u0d44\u0d46-\u0d48\u0d4a-\u0d4d\u0d57ൠ-\u0d63൦-൯ൺ-ൿ\u0d82-\u0d83අ-ඖක-නඳ-රලව-ෆ\u0dca\u0dcf-\u0dd4\u0dd6\u0dd8-\u0ddf\u0df2-\u0df3ก-\u0e3aเ-\u0e4e๐-๙ກ-ຂຄງ-ຈຊຍດ-ທນ-ຟມ-ຣລວສ-ຫອ-\u0eb9\u0ebb-ຽເ-ໄໆ\u0ec8-\u0ecd໐-໙ໜ-ໝༀ\u0f18-\u0f19༠-༩\u0f35\u0f37\u0f39\u0f3e-ཇཉ-ཬ\u0f71-\u0f84\u0f86-ྋ\u0f90-\u0f97\u0f99-\u0fbc\u0fc6က-၉ၐ-႙Ⴀ-Ⴥა-ჺჼᄀ-ᅙᅟ-ᆢᆨ-ᇹሀ-ቈቊ-ቍቐ-ቖቘቚ-ቝበ-ኈኊ-ኍነ-ኰኲ-ኵኸ-ኾዀዂ-ዅወ-ዖዘ-ጐጒ-ጕጘ-ፚ\u135fᎀ-ᎏᎠ-Ᏼᐁ-ᙬᙯ-ᙶᚁ-ᚚᚠ-ᛪ\u16ee-\u16f0ᜀ-ᜌᜎ-\u1714ᜠ-\u1734ᝀ-\u1753ᝠ-ᝬᝮ-ᝰ\u1772-\u1773ក-ឳ\u17b6-\u17d3ៗៜ-\u17dd០-៩\u180b-\u180d᠐-᠙ᠠ-ᡷᢀ-ᢪᤀ-ᤜ\u1920-\u192b\u1930-\u193b᥆-ᥭᥰ-ᥴᦀ-ᦩ\u19b0-\u19c9᧐-᧙ᨀ-\u1a1b\u1b00-ᭋ᭐-᭙\u1b6b-\u1b73\u1b80-\u1baaᮮ-᮹ᰀ-\u1c37᱀-᱉ᱍ-ᱽᴀ-\u1de6\u1dfe-ἕἘ-Ἕἠ-ὅὈ-Ὅὐ-ὗὙὛὝὟ-ώᾀ-ᾴᾶ-ᾼιῂ-ῄῆ-ῌῐ-ΐῖ-Ίῠ-Ῥῲ-ῴῶ-ῼ\u200c-\u200d‿-⁀⁔ⁱⁿₐ-ₔ\u20d0-\u20dc\u20e1\u20e5-\u20f0ℂℇℊ-ℓℕℙ-ℝℤΩℨK-ℭℯ-ℹℼ-ℿⅅ-ⅉⅎ\u2160-\u2188Ⰰ-Ⱞⰰ-ⱞⱠ-Ɐⱱ-ⱽⲀ-ⳤⴀ-ⴥⴰ-ⵥⵯⶀ-ⶖⶠ-ⶦⶨ-ⶮⶰ-ⶶⶸ-ⶾⷀ-ⷆⷈ-ⷎⷐ-ⷖⷘ-ⷞ\u2de0-\u2dffⸯ々-\u3007\u3021-\u302f〱-〵\u3038-〼ぁ-ゖ\u3099-\u309aゝ-ゟァ-ヺー-ヿㄅ-ㄭㄱ-ㆎㆠ-ㆷㇰ-ㇿ㐀-䶵一-鿃ꀀ-ꒌꔀ-ꘌꘐ-ꘫꙀ-ꙟꙢ-\ua66f\ua67c-\ua67dꙿ-ꚗꜗ-ꜟꜢ-ꞈꞋ-ꞌꟻ-\ua827ꡀ-ꡳ\ua880-\ua8c4꣐-꣙꤀-\ua92dꤰ-\ua953ꨀ-\uaa36ꩀ-\uaa4d꩐-꩙가-힣豈-鶴侮-頻並-龎ﬀ-ﬆﬓ-ﬗיִ-ﬨשׁ-זּטּ-לּמּנּ-סּףּ-פּצּ-ﮱﯓ-ﴽﵐ-ﶏﶒ-ﷇﷰ-ﷻ\ufe00-\ufe0f\ufe20-\ufe26︳-︴﹍-﹏ﹰ-ﹴﹶ-ﻼ０-９Ａ-Ｚ＿ａ-ｚｦ-ﾾￂ-ￇￊ-ￏￒ-ￗￚ-ￜ]|[\ud840-\ud868][\udc00-\udfff]|\ud800[\udc00-\udc0b\udc0d-\udc26\udc28-\udc3a\udc3c-\udc3d\udc3f-\udc4d\udc50-\udc5d\udc80-\udcfa\udd40-\udd74\uddfd\ude80-\ude9c\udea0-\uded0\udf00-\udf1e\udf30-\udf4a\udf80-\udf9d\udfa0-\udfc3\udfc8-\udfcf\udfd1-\udfd5]|\ud801[\udc00-\udc9d\udca0-\udca9]|\ud802[\udc00-\udc05\udc08\udc0a-\udc35\udc37-\udc38\udc3c\udc3f\udd00-\udd15\udd20-\udd39\ude00-\ude03\ude05-\ude06\ude0c-\ude13\ude15-\ude17\ude19-\ude33\ude38-\ude3a\ude3f]|\ud808[\udc00-\udf6e]|\ud809[\udc00-\udc62]|\ud834[\udd65-\udd69\udd6d-\udd72\udd7b-\udd82\udd85-\udd8b\uddaa-\uddad\ude42-\ude44]|\ud835[\udc00-\udc54\udc56-\udc9c\udc9e-\udc9f\udca2\udca5-\udca6\udca9-\udcac\udcae-\udcb9\udcbb\udcbd-\udcc3\udcc5-\udd05\udd07-\udd0a\udd0d-\udd14\udd16-\udd1c\udd1e-\udd39\udd3b-\udd3e\udd40-\udd44\udd46\udd4a-\udd50\udd52-\udea5\udea8-\udec0\udec2-\udeda\udedc-\udefa\udefc-\udf14\udf16-\udf34\udf36-\udf4e\udf50-\udf6e\udf70-\udf88\udf8a-\udfa8\udfaa-\udfc2\udfc4-\udfcb\udfce-\udfff]|\ud869[\udc00-\uded6]|\ud87e[\udc00-\ude1d]|\udb40[\udd00-\uddef])*$/;
    return function(string) {
      return startCharTester.test(string[0])
        && precedingCharTester.test(string.slice(1));
    }
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));
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

})(typeof lively !== 'undefined' && lively.lang ? lively.lang : require('./base'));

//;
var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS && module.require("lively.lang");
var escodegen = isCommonJS ? require("escodegen") : escodegen;
var acorn = !isCommonJS && Global.acorn;
if (!acorn && isCommonJS) {
    acorn = require("acorn");
    acorn.walk = require("acorn/util/walk");
    acorn.parse_dammit = require("acorn/acorn_loose").parse_dammit;
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
      // ea.id is of type node
      retVal = this.accept(ea.id, depth, state, path.concat(["head", i, "id"]));
      if (ea.init) {
        // ea.init can be of type node
        retVal = this.accept(ea.init, depth, state, path.concat(["head", i, "init"]));
      }
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
      // ea.key is of type node
      retVal = this.accept(ea.key, depth, state, path.concat(["properties", i, "key"]));
      // ea.value is of type node
      retVal = this.accept(ea.value, depth, state, path.concat(["properties", i, "value"]));
      // ea.kind is "init" or "get" or "set"
    }, this);
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

    // left is a node of type Expression
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
      // ea is of type ComprehensionBlock
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
      // ea is of type ComprehensionBlock
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
      // ea.id is of type node
      retVal = this.accept(ea.id, depth, state, path.concat(["head", i, "id"]));
      if (ea.init) {
        // ea.init can be of type node
        retVal = this.accept(ea.init, depth, state, path.concat(["head", i, "init"]));
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
    } catch (e) { show(e.stack) }
  },

  visitVariableDeclaration: function ($super, node, depth, scope, path) {
    scope.varDecls.push(node);
    scope.varDeclPaths.push(path);
    return $super(node, depth, scope, path);
  },

  visitVariableDeclarator: function (node, depth, state, path) {
    //ignore id
    var retVal;
    if (node.init) {
      retVal = this.accept(node.init, depth, state, path.concat(["init"]));
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

  visitObjectExpression: function (node, depth, state, path) {
    var retVal;
    node.properties.forEach(function(ea, i) {
      // ignore keys: ["properties", i, "key"]
      retVal = this.accept(ea.value, depth, state, path.concat(["properties", i, "value"]));
    }, this);
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

  topLevelDeclsAndRefs: function(ast, options) {
    if (typeof ast === "string") ast = exports.parse(ast, {withComments: true});

    var scope     = exports.query.scopes(ast),
      useComments = options && !!options.jslintGlobalComment,
      declared    = declaredVarNames(scope),
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

    function declaredVarNames(scope) {
      return [scope.node.id && scope.node.id.name]
        .concat(chain(scope.funcDecls).pluck('id').pluck('name').compact().value())
        .concat(arr.pluck(scope.params, 'name'))
        .concat(arr.pluck(scope.catches, 'name'))
        .concat(chain(scope.varDecls).pluck('declarations').flatten().pluck('id').pluck('name').value())
        .concat(chain(scope.classDecls).pluck('id').pluck('name').value())
        .concat(!useComments ? [] :
          findJsLintGlobalDeclarations(
            scope.node.type === 'Program' ?
              scope.node : scope.node.body));
    }

    function findUndeclaredReferences(scope) {
      var names = declaredVarNames(scope);
      return scope.subScopes
        .map(findUndeclaredReferences)
        .reduce(function(refs, ea) { return refs.concat(ea); }, scope.refs)
        .filter(function(ref) { return names.indexOf(ref.name) === -1; });
    }

    function findJsLintGlobalDeclarations(node) {
      if (!node || !node.comments) return [];
      return arr.flatten(
        node.comments
          .filter(function(ea) { return ea.text.trim().match(/^global/) })
          .map(function(ea) {
            return arr.invoke(ea.text.replace(/^\s*global\s*/, '').split(','), 'trim');
          }));
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
      var funcDeclIds = scope.funcDecls,
          varDeclIds = chain(scope.varDecls).pluck("declarations").flatten().value();
      return scope.params.concat(arr.pluck(scope.funcDecls.concat(varDeclIds), 'id'));
    }
  },

  findDeclarationClosestToIndex: function(ast, name, index) {
    // var scopes = lively.ast
    function varDeclIdsOf(scope) {
      var funcDeclIds = scope.funcDecls,
          varDeclIds = chain(scope.varDecls).pluck("declarations").flatten().value();
      return scope.params.concat(arr.pluck(scope.funcDecls.concat(varDeclIds), 'id'));
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

//;
var isCommonJS = typeof module !== "undefined" && module.require;
var Global = typeof window !== "undefined" ? window : global;
var lang = typeof lively !== "undefined" ? lively.lang : isCommonJS ? module.require("lively.lang") : {};
var ast = typeof lively !== "undefined" && lively.ast ? lively.ast : (isCommonJS ? module.require("lively.ast") : (function() { throw new Error("Cannot find lively.lang") })());
var lv = Global.lively || {};
lv.ast = ast;
lv.lang = lang;

var env = {
  isCommonJS: isCommonJS,
  Global: Global,
  lively: lv
}

lang.obj.extend(isCommonJS ? module.exports : Global, env);
;
/*global module,lively*/

var exports = typeof module !== "undefined" && module.require ? module.exports : (lively.vm = {});
var lang = typeof module !== "undefined" && module.require ? module.require("lively.lang") : lively.lang;
var ast = typeof module !== "undefined" && module.require ? module.require("lively.ast") : lively.ast;

var arr = lang.arr;

lang.obj.extend(exports, {

  transformForVarRecord: function(code, varRecorder, varRecorderName, blacklist, defRangeRecorder) {
    // variable declaration and references in the the source code get
    // transformed so that they are bound to `varRecorderName` aren't local
    // state. THis makes it possible to capture eval results, e.g. for
    // inspection, watching and recording changes, workspace vars, and
    // incrementally evaluating var declarations and having values bound later.
    blacklist = blacklist || [];
    var undeclaredToTransform = lang.arr.withoutAll(Object.keys(varRecorder), blacklist),
        transformed = ast.transform.replaceTopLevelVarDeclAndUsageForCapturing(
          code, {name: varRecorderName, type: "Identifier"},
          {ignoreUndeclaredExcept: undeclaredToTransform,
           exclude: blacklist, recordDefRanges: !!defRangeRecorder});
    code = transformed.source;
    if (defRangeRecorder) lang.obj.extend(defRangeRecorder, transformed.defRanges);
    return code;
  },

  transformSingleExpression: function(code) {
    // evaling certain expressions such as single functions or object
    // literals will fail or not work as intended. When the code being
    // evaluated consists just out of a single expression we will wrap it in
    // parens to allow for those cases
    try {
      var parsed = ast.fuzzyParse(code);
      if (parsed.body.length === 1 &&
         (parsed.body[0].type === 'FunctionDeclaration'
       || parsed.body[0].type === 'BlockStatement')) {
        code = '(' + code.replace(/;\s*$/, '') + ')';
      }
    } catch(e) {
      if (typeof lively && lively.Config && lively.Config.showImprovedJavaScriptEvalErrors) $world.logError(e)
      else console.error("Eval preprocess error: %s", e.stack || e);
    }
    return code;
  },

  evalCodeTransform: function(code, options) {
    var vm = exports,
        recorder = options.topLevelVarRecorder,
        varRecorderName = options.varRecorderName || '__lvVarRecorder';

    if (recorder) code = vm.transformForVarRecord(
      code, recorder, varRecorderName,
      options.dontTransform, options.topLevelDefRangeRecorder);
    code = vm.transformSingleExpression(code);

    if (options.sourceURL) code += "\n//# sourceURL=" + options.sourceURL.replace(/\s/g, "_");

    return code;
  },

  getGlobal: function() {
    return (function() { return this; })();
  },

  _eval: function(__lvEvalStatement, __lvVarRecorder/*needed as arg for capturing*/) {
    return eval(__lvEvalStatement);
  },

  runEval: function (code, options, thenDo) {
    // The main function where all eval options are configured.
    // options can include {
    //   varRecorderName: STRING, // default is '__lvVarRecorder'
    //   topLevelVarRecorder: OBJECT,
    //   context: OBJECT,
    //   sourceURL: STRING
    // }
    if (typeof options === 'function' && arguments.length === 2) {
      thenDo = options; options = {};
    } else if (!options) options = {};

    var vm = exports, result, err,
        context = options.context || vm.getGlobal(),
        recorder = options.topLevelVarRecorder;

    try {
      code = vm.evalCodeTransform(code, options);
      typeof $morph !== "undefined" && $morph('log') && ($morph('log').textString = code);
      result = vm._eval.call(context, code, recorder);
    } catch (e) { err = e; } finally { thenDo(err, result); }
  },

  syncEval: function(string, options) {
    // See #runEval for options.
    // Although the defaul eval is synchronous we assume that the general
    // evaluation might not return immediatelly. This makes is possible to
    // change the evaluation backend, e.g. to be a remotely attached runtime
    var result;
    exports.runEval(string, options, function(e, r) { result = e || r; });
    return result;
  }

});

//# sourceMappingURL=lively.vm.dev-bundle.js.map