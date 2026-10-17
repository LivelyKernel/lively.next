export function numericFuzzSeed (seed) {
  if (Number.isInteger(seed)) return seed >>> 0;
  const stringSeed = String(seed);
  let hash = 2166136261;
  for (let i = 0; i < stringSeed.length; i++) {
    hash ^= stringSeed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export class SeededRandom {
  constructor (seed = 0xC0FFEE) {
    this.seed = seed;
    this.state = numericFuzzSeed(seed);
  }

  next () {
    this.state = (this.state + 0x6D2B79F5) >>> 0;
    let value = this.state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  }

  integer (min, max) {
    return min + Math.floor(this.next() * (max - min));
  }

  boolean (probability = 0.5) {
    return this.next() < probability;
  }

  pick (items) {
    return items.length ? items[this.integer(0, items.length)] : undefined;
  }

  shuffle (items) {
    const shuffled = items.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = this.integer(0, i + 1);
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }
}
