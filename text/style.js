import { Range } from "./range.js";
import { obj, arr } from "lively.lang";


export class StyleRange {

  constructor(style = {}, range) {
    this.style = style;
    this.range = range;
  }

  get start() { return this.range.start }
  get end() { return this.range.end }

  static flatten(base, ...rest) {
    let flattened = base ? [base] : [];
    for (let thatStyleRange of rest) {
      flattened = arr.flatten(flattened.map(thisStyleRange => StyleRange.merge(thisStyleRange, thatStyleRange)));
    }
    return flattened;
  }

  static merge(a, b) {
    // Styles from "b" will be applied to (and override) any overlapping section of "a"; will return 1-3 new ranges
    let { style: style_a, range: range_a } = a,
        { style: style_b, range: range_b } = b,
        intersection = range_a.intersect(range_b),
        outputStyleRanges;
    if (!intersection.isEmpty()) {
      let mergedStyle = obj.merge(style_a, style_b),
          restyledRange = new StyleRange(mergedStyle, intersection),
          leftoverRanges = range_a.subtract(intersection).map(range => new StyleRange(style_a, range));
      outputStyleRanges = [restyledRange, ...leftoverRanges];
    } else {
      outputStyleRanges = [a];
    }
    return Range.sort(outputStyleRanges);
  }

}