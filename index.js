var fs = require("fs");
var lang = require("lively.lang");
var ast = require("lively.ast");
var path = require("path");

var obj = lang.obj;
var arr = lang.arr;
var fun = lang.fun;
var string = lang.string;

module.exports = generateDoc;

function generateDoc(options, thenDo) {
  // Reads JS source files, extracts toplevel, object, and function comments
  // and generates a documentation from these. Will insert doc into README.md or
  // doc files.
  // options `{dryRun: BOOL, projectPath: STRING, files: ARRAY[STRING], intoFiles: BOOL}`
  // `intoFiles`: split documentation into individual doc/xxx.md files or README.md (default).
  // The README.md file should include insertion markers
  // `<!---DOC_GENERATED_START--->` and
  // `<!---DOC_GENERATED_END--->`.
  // Example:
  // var files = ["lib/foo.js", "lib/bar.js"];
  // require("doc-comments")({
  //   projectPath: "/foo/bar", files: files},
  //   function(err, markup, fileData) { /*...*/ })/

  options = obj.merge({
    dryRun: false,
    projectPath: "./",
    files: null,
    intoFiles: false,
    alias: {},
    introIntoReadme: true
  }, options);
  
  var files = options.files;
  
  if (!files) return thenDo(new Error("No files specified!"));

  var commentData = {};
  fun.composeAsync(
      step1_readSourceFiles.bind(global, options),
      step2_extractCommentsFromFileData,
      step3_markdownFromFileData,
      step4_commentCoverageFromFileData,
      step5_markdownTocFromFileData,
      step6_markdownDocumentationFromFileData,
      step7_markdownDocFilesFromFileData.bind(global, options),
      step8_markdownTocFromFileData
  )(function(err, markup, fileData) {
      if (err) { console.error(String(err));  }
      else {
        var report = lang.chain(fileData).keys().flatmap(function(file) {
          var data = fileData[file];
          var commentLines = lang.chain(data.comments)
            .withoutAll(arr.filterByKey(data.comments, "ignored"))
            .map(function(comment) { return "  " + comment.name + " (" + comment.type + ")"; })
            .value();
          return commentLines.length ? [file].concat(commentLines) : [];
        }).value().join("\n");
        console.log("generated docs:\n%s", report);
      }
      thenDo && thenDo(err, markup, fileData);
  });

}

function readFile(name, thenDo) {
  // ignore-in-doc
  if (fs.existsSync(name))
    fs.readFile(name, function(err, out) { thenDo(err, out && String(out)); });
  else
    thenDo(new Error("File " + name + " does not exist!"));
}

function writeFile(options, name, content, thenDo) {
  // ignore-in-doc
  if (options.dryRun) {
    console.log("WRITING %s\n%s", name, content);
    thenDo(null);
  } else {
    fs.writeFile(name, content, thenDo);
  }
}

function docFileForSourceFile(sourceFileName) {
  var parts = sourceFileName.split("/");
  return (parts.length > 1 ?
    ["doc"].concat(sourceFileName.split("/").slice(1)).join("/") :
    "doc/" + sourceFileName).replace(/\.js$/, ".md");
}

function processComment(comments, comment) {
  // ignore-in-doc

  if (ignoreComment(comment)) {
    comment.ignored = true;
    return [];
  }

  removePublicDecl(comment);
  // markTypes(comment);
  ignoreTypes(comment);
  markExamples(comment);
  return [comment]; 

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function markTypes(comment) {
    // ignore-in-doc
    var text = comment.comment;
    // var text = " [a] -> (a -> Boolean) -> c? -> a "
    var matches = string.reMatches(text, /^[ [\[\]\(\)a-z\?\*\+]+(?:->[ [\[\]\(\)a-z\?\*\+]+)+$/igm);
    var match = matches && matches[0];
    if (!match) return comment;
    var before = text.slice(0, match.start);
    var inner = matches[0].match.replace(/^(\s*)|(\s*)$$/g,'$1`');
    var after = text.slice(match.end);
    comment.comment = before + inner + after;
    return comment;
  }

  function ignoreTypes(comment) {
    // ignore-in-doc
    var text = comment.comment;
    // var text = " [a] -> (a -> Boolean) -> c? -> a "
    var matches = string.reMatches(text, /^[ [\[\]\(\)a-z\?\*\+]+(?:->[ [\[\]\(\)a-z\?\*\+]+)+$/igm);
    var match = matches && matches[0];
    if (!match) return comment;
    var before = text.slice(0, match.start);
    var after = text.slice(match.end);
    comment.comment = before + after;
    return comment;
  }

  function markExamples(comment) {
    var text = comment.comment;
    var matches = string.reMatches(text, /Examples?:\s*/)
    var match = matches && matches[0];
    if (!match) return comment;
    var before = text.slice(0, match.start);
    var code = text.slice(match.end);
    code = "\n" + code.replace(/^\s/gm, "");
    comment.comment = before
                    + "\n\n```js"
                    + code
                    + "\n```"
    return comment;
  }

  function removePublicDecl(comment) {
    comment.comment = comment.comment.replace(/\s*show-in-docs?\s*/m, "");
    return comment;
  }

  function ignoreComment(comment) {
    // ignore-in-doc
    if (string.startsWith(comment.comment.trim(), '-=-=-')) return true;
    if (string.startsWith(comment.comment.trim(), 'ignore-in-doc')) return true;
    if (string.startsWith(comment.comment.trim(), 'show-in-doc')) return false;
    var ignored = arr.filterByKey(comments, "ignored");
    var commentsBefore = arr.withoutAll(comments.slice(0, comments.indexOf(comment)), ignored);
    if (ignored.some(function(ea) { return obj.equals(comment.path, ea.path); })) return true;
    if (!comment.name) return true;
    if (comment.type !== "method") return false;
    // allow only one comment (the first one) per method
    return commentsBefore.some(function(c) {
        return c.name == comment.name && c.objectName == comment.objectName;
    });
  }

}

function step1_readSourceFiles(options, thenDo) {
  // ignore-in-doc
  var fileData = {};
  console.log("loading...");
  arr.doAndContinue(options.files, function(next, fn, i) {
    console.log("...%s/%s", i+1, options.files.length);
    var fullFn = path.join(options.projectPath, fn);
    if (!fs.existsSync(fullFn))
      return next(new Error(`File ${fullFn} does not exist!`));
    readFile(fullFn, function(err, out) {
      fileData[fn] = {content: out};
      next();
    });
  }, function() { thenDo(null, fileData); });
}


function step2_extractCommentsFromFileData(fileData, thenDo) {
  // ignore-in-doc
  Object.keys(fileData).forEach(function(fn) {
    try {
      var comments = ast.comments.extractComments(fileData[fn].content);
      comments.forEach(function(ea) { ea.file = fn; });
      fileData[fn].comments = arr.flatmap(comments, processComment.bind(null, comments));
      var topLevelComment = arr.detect(comments, function(ea) { return !string.startsWith(ea.comment, "global") && !ea.path.length; });
      var comment =  (topLevelComment && topLevelComment.comment) || "";
      var lines = string.lines(comment);
      var commonIndent = lines.reduce((commonIndent, line) =>
        line.match(/^\s*$/) ?
          commonIndent :
          Math.min(commonIndent, line.match(/^\s*/)[0].length), Infinity);
      comment = lines.map(line => line.slice(commonIndent)).join("\n");
      fileData[fn].topLevelComment = comment;
    } catch (err) {
      console.error("error extracting comments in file "
           + fn + ":\n" + (err.stack || err) + "\n" + fileData[fn].content);
    }
  });
  thenDo(null, fileData);
}


function step3_markdownFromFileData(fileData, thenDo) {
  // ignore-in-doc

  Object.keys(fileData).forEach(function(fn) {
    if (fileData[fn].comments)
      fileData[fn].markdown = markdownFromComments(fn, fileData[fn].comments);
  });
  thenDo(null, fileData);
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  function markdownFromComments(fileName, comments) {
    // ignore-in-doc
    return arr.compact(comments.map(function(ea) {
       if (ea.comment.trim().match(/^[-=-]+$/)) return null;
       switch (ea.type) {
         case 'object': case 'var': {
           return string.format('### %s%s\n\n%s', anchorFor(ea), ea.name, ea.comment);
         }
         case 'method': {
           var objName = string.endsWith(ea.objectName, ".prototype") ? ea.objectName.replace(".prototype", ">>") : ea.objectName + ".";
           return string.format('#### %s%s%s(%s)\n\n%s', anchorFor(ea), objName, ea.name, ea.args.join(', '), ea.comment);
        }
        case 'function': {
          return string.format('#### %s%s(%s)\n\n%s', anchorFor(ea), ea.name, ea.args.join(', '), ea.comment);
        }
         default: return null;
       }
     })).join('\n\n');
  }

  function anchorFor(comment) {
    // ignore-in-doc
    return string.format('<a name="%s%s"></a>',
      comment.objectName ? comment.objectName + "-" : "",
      comment.name);
  }
}



function step4_commentCoverageFromFileData(fileData, thenDo) {
  // ignore-in-doc
  Object.keys(fileData).forEach(function(fn) {
    fileData[fn].coverage = coverageFromComments(fn, fileData[fn].comments);
  });
  thenDo(null, fileData);
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  function coverageFromComments(fileName, comments) {
    // ignore-in-doc
    var coverage = {};
    comments.map(function(ea) {
      if (ea.comment.trim().match(/^[-=-]+$/)) return null;
      switch (ea.type) {
        case 'object': case 'var': {
          if (!coverage[ea.name]) coverage[ea.name] = [];
          return;
        }
        case 'method': {
          if (!coverage[ea.objectName]) coverage[ea.objectName] = [];
          coverage[ea.objectName].push(ea.name);
          return;
        }
        case 'function': {
          if (!ea.name.match(/^[A-Z]/)) return null;
          if (!coverage[ea.name]) coverage[ea.name] = [];
          return;
        }
        default: return null;
      }
    });
  
    return coverage;
  }

}



function step5_markdownTocFromFileData(fileData, thenDo) {
  // ignore-in-doc
  Object.keys(fileData).forEach(function(fn) {
    if (fileData[fn].coverage)
      fileData[fn].markdownToc = printKeysWithLists(fileData[fn].coverage);
  });
  thenDo(null, fileData);
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function printKeysWithLists(obj) {
    // ignore-in-doc
    return Object.keys(obj)
        .map(function(k) {
          var objHeading = "- [" + k + "](#" + k + ")";
          if (!arr.uniq(obj[k]).length) return objHeading;
          return objHeading + "\n  - "+ arr.uniq(obj[k])
                 .map(function(item) { return "[" + item + "](#" + (k + "-" + item) + ")"})
                 .join("\n  - ");
         }).join("\n");
  }

}

function step6_markdownDocumentationFromFileData(fileData, thenDo) {
  // ignore-in-doc
  var markupToc = lang.chain(fileData).values().pluck('markdownToc')
                    .invoke("trim").compact().value().join("\n\n");

  var markup = markupToc + "\n\n"
    + lang.chain(fileData).values().pluck('markdown').value().join('\n\n')
  thenDo(null, markup, fileData)
}

function step7_markdownDocFilesFromFileData(options, markup, fileData, thenDo) {
  // ignore-in-doc

  if (!options.intoFiles) return thenDo(null, options, markup, fileData);

  console.log("writing...");

  var sourceFiles = Object.keys(fileData);

  arr.doAndContinue(sourceFiles, function(next, fn, i) {
    console.log("...%s/%s", i+1, sourceFiles.length);

    var docFile = docFileForSourceFile(fn),
        name = (options.alias && options.alias[fn]) || fn,
        content = `## ${name}\n\n${fileData[fn].topLevelComment}\n\n${fileData[fn].markdownToc || "<!--*no toc!*-->"}\n\n${fileData[fn].markdown}`;

    writeFile(options, path.join(options.projectPath, docFile), content, function(err) { next(err); });
  }, function() { thenDo(null, options, markup, fileData); });

}



function step8_markdownTocFromFileData(options, markup, fileData, thenDo) {
  // ignore-in-doc
  var startMarker = "<!---DOC_GENERATED_START--->",
      endMarker = "<!---DOC_GENERATED_END--->";

  if (options.intoFiles) putOutlineIntoReadme();
  else putEntireDocIntoReadme();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function docFromFiles() {
    return Object.keys(fileData).map(function(fn) {
      if (!options.introIntoReadme || !fileData[fn].topLevelComment) return null;
      var s = string.format(
        "### [%s](%s)\n\n%s\n\n",
        (options.alias && options.alias[fn]) || fn,
        options.intoFiles ? docFileForSourceFile(fn) : fn,
        options.introIntoReadme ? fileData[fn].topLevelComment : "");
      return s;
    }).filter(ea => !!ea);
  }

  function putOutlineIntoReadme() {
    updateReadme(docFromFiles().join("\n\n"));
  }

  function putEntireDocIntoReadme() {
    updateReadme([markup].concat(docFromFiles()).join("\n\n"));
  }

  function updateReadme(content) {
    fun.composeAsync(
      function(next) {
        readFile(path.join(options.projectPath, "README.md"), next);
      },
      function(readmeContent, next) {
        var startIdx = readmeContent.indexOf(startMarker) + startMarker.length,
            endIdx = readmeContent.lastIndexOf(endMarker),
            start = readmeContent.slice(0, startIdx),
            end = readmeContent.slice(endIdx);
        next(null, start + "\n\n" + content + "\n\n" + end);
      },
      function(updatedReadmeContent, next) {
        writeFile(options, path.join(options.projectPath, "README.md"),
          updatedReadmeContent, function(err) { next(err); });
      }
    )(function(err) { thenDo(err, markup, fileData) });
  }
}
