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
  // `intoFiles`: split documentation into individual doc/xxx.md files or README.md (default)
  // Example:
  // var files = ["lib/foo.js", "lib/bar.js"];
  // require("./generate-doc").generateDoc({
  //   projectPath: "/foo/bar", files: files},
  //   function(err, markup, fileData) { /*...*/ })/

  options = lively.lang.obj.merge({
    dryRun: false,
    projectPath: "./",
    files: null,
    intoFiles: false
  }, options);
  
  var files = options.files;
  
  if (!files) return thenDo(new Error("No files specified!"));

  var commentData = {};

  global.fileData = {};
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
      if (err) console.error(String(err));
      else console.log("DONE!");
      thenDo && thenDo(err);
  });

}

function readFile(name, thenDo) {
  // ignore-in-doc
  fs.readFile(name, function(err, out) { thenDo(err, out && String(out)); });
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

var ignoredComments = {};
function processComment(comments, comment) {
  // ignore-in-doc

  if (ignoreComment(comment)) return comments;
  removePublicDecl(comment);
  // markTypes(comment);
  ignoreTypes(comment);
  markExamples(comment);
  comments.push(comment)
  return comments; 

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  function markTypes(comment) {
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
    if (comment.comment.trim() === 'show-in-doc') comment.comment = "";
    return comment;
  }
  
  function ignoreComment(comment) {
    var ignored = ignoredComments[comment.file] || (ignoredComments[comment.file] = {});
    var path = comment.path.join(".");
    if (ignored[path]
     || obj.keys(ignored).some(function(prefix) {
         return path.startsWith(prefix); })) return true;
    if (string.startsWith(comment.comment.trim(), 'ignore-in-doc')) {
      ignored[path] = true;
      return true;
    }
    if (!comment.name) return true;
    if (comment.type !== "method") return false;
    // aloow only one comment (the first one) per method
    return comments.some(function(c) {
        return c.name == comment.name && c.objectName == comment.objectName;
    });
  }
}

function step1_readSourceFiles(options, thenDo) {
  // ignore-in-doc
  var fileData = {};
  console.log("loading...");
  arr.doAndContinue(options.files, function(next, fn, i) {
    console.log("...%s/%s", i, options.files.length);
    readFile(path.join(options.projectPath, fn), function(err, out) {
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
      fileData[fn].comments = comments.reduce(processComment, []);
      var topLevelComment = arr.detect(comments, function(ea) { return !string.startsWith(ea.comment, "global") && !ea.path.length; });
      fileData[fn].topLevelComment = (topLevelComment ? topLevelComment.comment : "").replace(/^\s+(\*\s+)?/gm, "");

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
          if (ea.name.match(/^[A-Z]/)) return null;
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
  var markupToc = "### Contents\n\n"
                + lang.chain(fileData).values().pluck('markdownToc')
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
    console.log("...%s/%s", i, sourceFiles.length);
    var docFile = fn.replace(/lib\//, 'doc/').replace(/\.js$/, '.md');
    var content = "## " + fn + "\n\n" + fileData[fn].topLevelComment + "\n\n"
      + (fileData[fn].markdownToc || "*no toc!*") + "\n\n" + fileData[fn].markdown;

    writeFile(options, path.join(options.projectPath, docFile),
      content, function(err) { next(err); });
  }, function() { thenDo(null, markup, fileData); });

}



function step8_markdownTocFromFileData(options, markup, fileData, thenDo) {
  // ignore-in-doc
  var startMarker = "<!---DOC_GENERATED_START--->";
  var endMarker = "<!---DOC_GENERATED_END--->";

  if (options.intoFiles)
    putOutlineIntoReadme();
  else
    putEntireDocIntoReadme();

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  function putOutlineIntoReadme() {
    var content = [];
    Object.keys(fileData).forEach(function(fn) {
      var s = string.format(
        "### [%s](doc/%s)\n\n%s\n\n",
        fn.replace(/^lib\//, ""), fn.replace(/\.js$/, ".md").replace(/^lib\//, ""),
        fileData[fn].topLevelComment);
      content.push(s);
    });
    updateReadme(content.join("\n\n"));
  }

  function putEntireDocIntoReadme() { updateReadme(markup); }

  function updateReadme(content) {
    fun.composeAsync(
      function(next) {
        readFile(path.join(options.projectPath, "README.md"), next);
      },
      function(readmeContent, next) {
        var startIdx = readmeContent.indexOf(startMarker) + startMarker.length;
        var endIdx = readmeContent.indexOf(endMarker);
        var start = readmeContent.slice(0, startIdx);
        var end = readmeContent.slice(endIdx);
        next(null, start + "\n" + content + "\n" + end);
      },
      function(updatedReadmeContent, next) {
        writeFile(options, path.join(options.projectPath, "README.md"),
          updatedReadmeContent, function(err) { next(err); });
      }
    )(function(err) { thenDo(err, markup, fileData) });
  }
}
