// type Matrix = Array<Array<number>>

function makeZeroArray(xl, yl) { // number, number -> Matrix
  const m = new Array(xl+1);
  for (let i = 0; i <= xl; i++) {
    m[i] = new Array(yl+1);
    for (let j = 0; j <= yl; j++) {
      m[i][j] = 0;
    }
  }
  return m;
}

function lcs(x, y) { // Array<string>, Array<string> -> Matrix
  const m = makeZeroArray(x.length, y.length);
  for (let i = 1; i <= x.length; i++) {
    for (let j = 1; j <= y.length; j++) {
      if (x[i-1] == y[j-1]) {
        m[i][j] = m[i-1][j-1] + 1;
      } else {
        m[i][j] = Math.max(m[i][j-1], m[i-1][j]);
      }
    }
  }
  return m;
}

function trace(m, x, y, i, j) {
  // Matrix, Array<string>, Array<string>, number, number -> Array<Diff>
  if (i > 0 && j > 0 && x[i-1] == y[j-1]) {
    const prev = trace(m, x, y, i-1, j-1);
    prev.push({value: x[i-1]});
    return prev;
  }
  if (j > 0 && (i == 0 || m[i][j-1] >= m[i-1][j])) {
    const prev = trace(m, x, y, i, j-1);
    prev.push({added: true, value: y[j-1]});
    return prev;
  }
  if (i > 0 && (j == 0 || m[i][j-1] < m[i-1][j])) {
    const prev = trace(m, x, y, i-1, j);
    prev.push({removed: true, value: x[i-1]});
    return prev;
  }
  return [];
}

// type Diff = {added: true, value: string}
//           | {removed: true, value: string}
//           | {value: string}

export function diff(x, y) { // string, string -> Array<Diff>
  // str.split(/\n\r?/)
  const xLines = x.split(/\n\r?/), yLines = y.split(/\n\r?/),
        m = lcs(xLines, yLines);
  return trace(m, xLines, yLines, xLines.length, yLines.length);
}

export function diffStr(x, y) { // string, string -> string
  const d = diff(x, y);
  let result = "";
  d.forEach(t => {
    if (t.added) {
      result += "+ ";
    } else if (t.removed) {
      result += "- ";
    } else {
      result += "  ";
    }
    result += t.value + "\n";
  });
  return result;
}
