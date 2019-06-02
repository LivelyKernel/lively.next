## closure.js

A `Closure` is a representation of a JavaScript function that controls what
values are bound to out-of-scope variables. By default JavaScript has no
reflection capabilities over closed values in functions. When needing to
serialize execution or when behavior should become part of the state of a
system it is often necessary to have first-class control over this language
aspect.

Typically closures aren't created directly but with the help of [`asScriptOf`](#)

Example:
function func(a) { return a + b; }
var closureFunc = Closure.fromFunction(func, {b: 3}).recreateFunc();
closureFunc(4) // => 7
var closure = closureFunc.livelyClosure // => {
//   varMapping: { b: 3 },
//   originalFunc: function func(a) {/*...*/}
// }
closure.lookup("b") // => 3
closure.getFuncSource() // => "function func(a) { return a + b; }"

- [<error: no object found for method>](#<error: no object found for method>)
  - [fromFunction](#<error: no object found for method>-fromFunction)
  - [fromSource](#<error: no object found for method>-fromSource)
  - [setFuncSource](#<error: no object found for method>-setFuncSource)
  - [getFuncSource](#<error: no object found for method>-getFuncSource)
  - [hasFuncSource](#<error: no object found for method>-hasFuncSource)
  - [getFunc](#<error: no object found for method>-getFunc)
  - [lookup](#<error: no object found for method>-lookup)
  - [recreateFunc](#<error: no object found for method>-recreateFunc)
- [msg](#msg)

#### <a name="<error: no object found for method>-fromFunction"></a><error: no object found for method>.fromFunction(func, varMapping)



#### <a name="<error: no object found for method>-fromSource"></a><error: no object found for method>.fromSource(source, varMapping)



#### <a name="<error: no object found for method>-setFuncSource"></a><error: no object found for method>.setFuncSource(src)



#### <a name="<error: no object found for method>-getFuncSource"></a><error: no object found for method>.getFuncSource()



#### <a name="<error: no object found for method>-hasFuncSource"></a><error: no object found for method>.hasFuncSource()



#### <a name="<error: no object found for method>-getFunc"></a><error: no object found for method>.getFunc()



#### <a name="<error: no object found for method>-lookup"></a><error: no object found for method>.lookup(name)



#### <a name="<error: no object found for method>-recreateFunc"></a><error: no object found for method>.recreateFunc()

 Creates a real function object

### <a name="msg"></a>msg

 var msg = `Cannot create function ${e} src: ${src}`;