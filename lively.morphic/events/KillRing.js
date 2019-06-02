import { arr } from "lively.lang";

export default class KillRing {
  
  constructor(size = 0) {
    this.size = size;
    this.buffer = [];
    this.pointer = -1;
  }

  isCycling() {
    return this.pointer !== this.buffer.length-1
  }

  add(x) {
    var b = this.buffer;
    b.push(x);
    if (this.size && b.length > this.size)
      b.splice(0, b.length - this.size);
    this.pointer = this.buffer.length-1;
    return x;
  }

  yank() {
    return this.buffer[this.pointer] || "";
  }
  
  back() {
    this.pointer = (this.pointer <= 0 ? this.buffer.length : this.pointer)-1;
    return this.yank();
  }
}
