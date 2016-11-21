import { obj } from "lively.lang";

export var ansiAttributes = {
  // "\033[7m"              {name: 'invert', style: {}},
  // "\033[5m"              {name: 'blink', style: {}},
  // "\033[0J"              {name: 'eod', style: {}},
  // "\033[1{;1f"           {name: 'sod', style: {}},
  // "\033[0K"              {name: 'eol', style: {}},
  "":   {style: 'reset'},
  "0":  {style: 'reset'},
  "1":  {style: {fontWeight: 'bold'}},
  "4":  {style: {textDecoration: 'underline'}},
  "30": {style: {color: "black"}},
  "40": {style: {backgroundColor: "black"}},
  "31": {style: {color: "red"}},
  "41": {style: {backgroundColor: "red"}},
  "32": {style: {color: "green"}},
  "42": {style: {backgroundColor: "green"}},
  "33": {style: {color: "yellow"}},
  "43": {style: {backgroundColor: "yellow"}},
  "34": {style: {color: "blue"}},
  "44": {style: {backgroundColor: "blue"}},
  "35": {style: {color: "magenta"}},
  "45": {style: {backgroundColor: "magenta"}},
  "36": {style: {color: "cyan"}},
  "46": {style: {backgroundColor: "cyan"}},
  "37": {style: {color: "white"}},
  "47": {style: {backgroundColor: "white"}}
};

export var ansiAttributesRegexp = new RegExp(String.fromCharCode(0o033) + '\[[0-9;]*m', 'g');

export function convertToTextStyles(string) {
  /*
  string = "hello\033[31m\033[4mwor\033[44mld\033[0m";
  result = lively.ide.CommandLineInterface.toStyleSpec(string);
  morph = new lively.morphic.Text(rect(0,0,100,20), result.string)
  morph.emphasizeRanges(result.ranges);
  morph.openInWorld().remove.bind(morph).delay(3);
  */

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  var indexOffset = 0, result = [0,[]], currentAttributes = [];
  string = string.replace(ansiAttributesRegexp, (match, index) => {
    // match can look like this "\033[31m" or this "\033[1;31m"
    var attributeCodes = match.slice(2,match.length-1).split(';'),
        styles = Object.keys(ansiAttributes).map((code) =>
                  attributeCodes.includes(code) && ansiAttributes[code] && ansiAttributes[code].style)
                  .filter(Boolean);

    if (styles.length === 0) { indexOffset += match.length; return ''; } // nothing found in our table...

    result.push(index-indexOffset);
    result.push(currentAttributes.slice());
    if (styles.includes('reset')) currentAttributes = [];
    else currentAttributes.push(...styles);
    indexOffset += match.length;
    return '';
  });

  var lastIndex = result[result.length-2];
  if (lastIndex < string.length) result.push(string.length, currentAttributes);

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  var ranges = [];
  for (var i = 0; i < result.length; i += 2) {
    var idx = result[i], styles = result[i+1],
        nextIdx = result[i+2], nextStyles = result[i+3];
    if (idx === nextIdx) continue;
    if (typeof nextIdx !== "number") break;
    ranges.push([idx, nextIdx, obj.merge(nextStyles)]);
  }

  return {string, ranges};
}

export function stripAnsiAttributes(string) {
  return string.replace(ansiAttributesRegexp, '');
}
