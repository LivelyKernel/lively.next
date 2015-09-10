# doc-comments

Extract comments from JavaScript source code and generate API documentation.

## API

<!---DOC_GENERATED_START--->
### Contents



#### <a name="generateDoc"></a>generateDoc(options, thenDo)

 Reads JS source files, extracts toplevel, object, and function comments
 and generates a documentation from these. Will insert doc into README.md or
 doc files.
 options `{dryRun: BOOL, projectPath: STRING, files: ARRAY[STRING], intoFiles: BOOL}`
 `intoFiles`: split documentation into individual doc/xxx.md files or README.md (default)
 

```js
var files = ["lib/foo.js", "lib/bar.js"];
require("./generate-doc").generateDoc({
  projectPath: "/foo/bar", files: files},
  function(err, markup, fileData) { /*...*/ })/
```
<!---DOC_GENERATED_END--->