# doc-comments

Extract comments from JavaScript source code and generate API documentation.

Typically you want to add it to the dev dependencies `npm install --save-dev
doc-comments.

Then call it from a script, e.g. put

```json
"scripts": {
  "doc": "node -e 'require(process.cwd())({files: [\"index.js\"]})'"
}
```

into your package.json and run `npm run doc`.


## API

<!---DOC_GENERATED_START--->

#### <a name="generateDoc"></a>generateDoc(options, thenDo)

 Reads JS source files, extracts toplevel, object, and function comments
 and generates a documentation from these. Will insert doc into README.md or
 doc files.
 options `{dryRun: BOOL, projectPath: STRING, files: ARRAY[STRING], intoFiles: BOOL}`
 `intoFiles`: split documentation into individual doc/xxx.md files or README.md (default).
 The README.md file should include insertion markers
 `<!---DOC_GENERATED_START--->` and
 `<!---DOC_GENERATED_END--->`.
 

```js
var files = ["lib/foo.js", "lib/bar.js"];
require("doc-comments")({
  projectPath: "/foo/bar", files: files},
  function(err, markup, fileData) { /*...*/ })/
```

<!---DOC_GENERATED_END--->`.
