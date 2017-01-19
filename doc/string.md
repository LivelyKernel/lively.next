## string.js

String utility methods for printing, parsing, and converting strings.

- [d](#d)

#### <a name="format"></a>format()


 Takes a variable number of arguments. The first argument is the format
 string. Placeholders in the format string are marked with `"%s"`.
 

```js
lively.lang.string.format("Hello %s!", "Lively User"); // => "Hello Lively User!"
```

#### <a name="indent"></a>indent(str, indentString, depth)


 

```js
string.indent("Hello", "  ", 2) // => "    Hello"
```

#### <a name="minIndent"></a>minIndent(str, indentString)

 Find out what the minum indentation of the text in str is
 

```js
minIndent("    Hello", "  ") // => 2
```

#### <a name="changeIndent"></a>changeIndent(str, indentString, depth)

 Add or remove indent from lines in str to match depth
 

```js
string.changeIndent("    Hello", "  ", 1) // => "  Hello"
```

#### <a name="quote"></a>quote(str)

 

```js
string.print("fo\"o") // => "\"fo\\\"o\""
```

#### <a name="print"></a>print(obj)

 Prints Arrays and escapes quotations. See `obj.inspect` for how to
 completely print / inspect JavaScript data strcutures
 

```js
string.print([[1,2,3], "string", {foo: 23}])
     // => [[1,2,3],"string",[object Object]]
```

#### <a name="printNested"></a>printNested(list, depth)

 

```js
string.printNested([1,2,[3,4,5]]) // => "1\n2\n  3\n  4\n  5\n"
```

#### <a name="pad"></a>pad(string, n, left)

 

```js
pad("Foo", 2) // => "Foo  "
pad("Foo", 2, true) // => "  Foo"
```

#### <a name="printTable"></a>printTable(tableArray, options)


 Takes a 2D Array and prints a table string. Kind of the reverse
 operation to `tableize`
 

```js
string.printTable([["aaa", "b", "c"], ["d", "e","f"]])
   // =>
   // aaa b c
   // d   e f
```

#### <a name="printTree"></a>printTree(rootNode, nodePrinter, childGetter, indent)


 A generic function to print a tree representation from a nested data structure.
 Receives three arguments:
 - `rootNode` an object representing the root node of the tree
 - `nodePrinter` is a function that gets a tree node and should return stringified version of it
 - `childGetter` is a function that gets a tree node and should return a list of child nodes
 

```js
var root = {name: "a", subs: [{name: "b", subs: [{name: "c"}]}, {name: "d"}]};
string.printTree(root, function(n) { return n.name; }, function(n) { return n.subs; });
// =>
// a
// |-b
// | \-c
// \-d
```

#### <a name="toArray"></a>toArray(s)

 

```js
string.toArray("fooo") // => ["f","o","o","o"]
```

#### <a name="lines"></a>lines(str)

 

```js
string.lines("foo\nbar\n\rbaz") // => ["foo","bar","baz"]
```

#### <a name="paragraphs"></a>paragraphs(string, options)

 

```js
var text = "Hello, this is a pretty long sentence\nthat even includes new lines."
        + "\n\n\nThis is a sentence in  a new paragraph.";
string.paragraphs(text) // => [
  // "Hello, this is a pretty long sentence\nthat even includes new lines.",
  // "This is a sentence in  a new paragraph."]
string.paragraphs(text, {keepEmptyLines: true}) // => [
  // "Hello, this is a pretty long sentence\n that even includes new lines.",
  // "\n ",
  // "This is a sentence in  a new paragraph."]
```

#### <a name="nonEmptyLines"></a>nonEmptyLines(str)

 

```js
string.nonEmptyLines("foo\n\nbar\n") // => ["foo","bar"]
```

#### <a name="tokens"></a>tokens(str, regex)

 

```js
string.tokens(' a b c') => ['a', 'b', 'c']
```

#### <a name="tableize"></a>tableize(s, options)


 Takes a String representing a "table" and parses it into a 2D-Array (as
 accepted by the `collection.Grid` methods or `string.printTable`)
 ```js
 options = {
     convertTypes: BOOLEAN, // automatically convert to Numbers, Dates, ...?
     cellSplitter: REGEXP // how to recognize "cells", by default just spaces
 }
 ```
 

```js
string.tableize('a b c\nd e f')
// => [["a","b","c"],["d","e","f"]]
// can also parse csv like
var csv = '"Symbol","Name","LastSale",\n'
        + '"FLWS","1-800 FLOWERS.COM, Inc.","5.65",\n'
        + '"FCTY","1st Century Bancshares, Inc","5.65",'
string.tableize(csv, {cellSplitter: /^\s*"|","|",?\s*$/g})
// => [["Symbol","Name","LastSale"],
//     ["FLWS","1-800 FLOWERS.COM, Inc.",5.65],
//     ["FCTY","1st Century Bancshares, Inc",5.65]]
```

#### <a name="unescapeCharacterEntities"></a>unescapeCharacterEntities(s)

 Converts [character entities](http://dev.w3.org/html5/html-author/charref)
 into utf-8 strings
 

```js
string.unescapeCharacterEntities("foo &amp;&amp; bar") // => "foo && bar"
```

#### <a name="toQueryParams"></a>toQueryParams(s, separator)

 

```js
string.toQueryParams("http://example.com?foo=23&bar=test")
  // => {bar: "test", foo: "23"}
```

#### <a name="joinPath"></a>joinPath()

 Joins the strings passed as paramters together so that ea string is
 connected via a single "/".
 

```js
string.joinPath("foo", "bar") // => "foo/bar";
```

#### <a name="newUUID"></a>newUUID()

 

```js
string.newUUID() // => "3B3E74D0-85EA-45F2-901C-23ECF3EAB9FB"
```

#### <a name="createDataURI"></a>createDataURI(content, mimeType)


 Takes some string representing content and a mime type.
 For a list of mime types see: [http://www.iana.org/assignments/media-types/media-types.xhtml]()
 More about data URIs: [https://developer.mozilla.org/en-US/docs/Web/HTTP/data_URIs]()
 

```js
window.open(string.createDataURI('<h1>test</h1>', 'text/html'));
```

#### <a name="hashCode"></a>hashCode(s)

 [http://werxltd.com/wp/2010/05/13/javascript-implementation-of-javas-string-hashcode-method/]()
 

```js
string.hashCode("foo") // => 101574
```

#### <a name="md5"></a>md5(string)

 © Joseph Myers [http://www.myersdaily.org/joseph/javascript/md5-text.html]()
 

```js
string.md5("foo") // => "acbd18db4cc2f85cedef654fccc4a4d8"
```

#### <a name="reMatches"></a>reMatches(string, re)

 Different to the native `match` function this method returns an object
 with `start`, `end`, and `match` fields
 

```js
string.reMatches("Hello World", /o/g)
  // => [{start: 4, end: 5, match: "o"},{start: 7, end: 8, match: "o"}]
```

#### <a name="stringMatch"></a>stringMatch(s, patternString, options)

 returns `{matched: true}` if success otherwise
 `{matched: false, error: EXPLANATION, pattern: STRING|RE, pos: NUMBER}`
 

```js
string.stringMatch("foo 123 bar", "foo __/[0-9]+/__ bar") // => {matched: true}
  string.stringMatch("foo aaa bar", "foo __/[0-9]+/__ bar")
    // => {
    //   error: "foo <--UNMATCHED-->aaa bar",
    //   matched: false,
    //   pattern: /[0-9]+/,
    //   pos: 4
    // }
```

#### <a name="peekRight"></a>peekRight(s, start, needle)

 Finds the next occurence of `needle` (String or RegExp). Returns delta
 index.
 

```js
peekRight("Hello World", 0, /o/g) // => 4
peekRight("Hello World", 5, /o/) // => 2
```

#### <a name="peekLeft"></a>peekLeft(s, start, needle)

 Similar to `peekRight`

#### <a name="lineIndexComputer"></a>lineIndexComputer(s)


 For converting character positions to line numbers.
 Returns a function accepting char positions. If the char pos is outside
 of the line ranges -1 is returned.
 

```js
var idxComp = lineIndexComputer("Hello\nWorld\n\nfoo");
idxComp(3) // => 0 (index 3 is "l")
idxComp(6) // => 1 (index 6 is "W")
idxComp(12) // => 2 (index 12 is "\n")
```

#### <a name="lineNumberToIndexesComputer"></a>lineNumberToIndexesComputer(s)


 For converting line numbers to [startIndex, endIndex]
 

```js
var idxComp = lineNumberToIndexesComputer("Hello\nWorld\n\nfoo");
idxComp(1) // => [6,12]
```

#### <a name="empty"></a>empty(s)



#### <a name="startsWithVowel"></a>startsWithVowel(s)



### <a name="d"></a>d

 

```js
endsWith("fooo!", "o!") // => true
```

#### <a name="withDecimalPrecision"></a>withDecimalPrecision(str, precision)


 

```js
withDecimalPrecision("1.12345678", 3) // => "1.123"
```

#### <a name="capitalize"></a>capitalize(s)

 

```js
capitalize("foo bar") // => "Foo bar"
```

#### <a name="camelCaseString"></a>camelCaseString(s)

 Spaces to camels, including first char
 

```js
camelCaseString("foo bar baz") // => "FooBarBaz"
```

#### <a name="camelize"></a>camelize(s)

 Dashes to camels, excluding first char
 

```js
camelize("foo-bar-baz") // => "fooBarBaz"
```

#### <a name="truncate"></a>truncate(s, length, truncation)

 Enforces that s is not more then `length` characters long.
 

```js
truncate("123456789", 5) // => "12..."
```

#### <a name="truncateLeft"></a>truncateLeft(s, length, truncation)

 Enforces that s is not more then `length` characters long.
 

```js
truncate("123456789", 5) // => "12..."
```

#### <a name="regExpEscape"></a>regExpEscape(s)

 For creating RegExps from strings and not worrying about proper escaping
 of RegExp special characters to literally match those.
 

```js
var re = new RegExp(regExpEscape("fooo{20}"));
re.test("fooo") // => false
re.test("fooo{20}") // => true
```

#### <a name="succ"></a>succ(s)

 Uses char code.
 

```js
succ("a") // => "b"
succ("Z") // => "["
```

#### <a name="applyChange"></a>applyChange(string, change)

 change is of the form
 `{start: Number, end: Number, lines: [String], action: "insert"|"remove"}`

#### <a name="levenshtein"></a>levenshtein(a, b)

 How many edit operations separate string a from b?
 MIT licensed, https://gist.github.com/andrei-
 Copyright (c) 2011 Andrei Mackenzie and https://github.com/kigiri

#### <a name="levenshtein"></a>levenshtein(a, b)

 swap to save some memory O(min(a,b)) instead of O(a)

#### <a name="levenshtein"></a>levenshtein(a, b)

 init the row

#### <a name="levenshtein"></a>levenshtein(a, b)

 fill in the rest