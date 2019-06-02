export function comparePosition(pos1, pos2) {
  // pos1.row < pos2.row = -2
  // pos1.row = pos2.row and pos1.column < pos2.column  = -1
  // pos1 = pos2  = 0
  // pos1.row = pos2.row and pos1.column > pos2.column  = 1
  // pos1.row > pos2.row = 2
  var {row, column} = pos1,
      {row: row2, column: column2} = pos2;
  if (row < row2) return -2;
  if (row === row2) {
    if (column < column2) return -1
    if (column === column2) return 0
    return 1;
  }
  return 2;
}

export function lessPosition(p1, p2) {
  return comparePosition(p1, p2) < 0;
}

export function lessEqPosition(p1, p2) {
  return comparePosition(p1, p2) <= 0;
}

export function eqPosition(p1, p2) {
  return comparePosition(p1, p2) === 0;
}

export function minPosition(p1, p2) {
  return lessPosition(p1, p2) ? p1 : p2;
}

export function maxPosition(p1, p2) {
  return lessPosition(p1, p2) ? p2 : p1;
}