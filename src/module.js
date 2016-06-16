
// Module class is primarily used to provide a nice API
// It does not hold any mutable state
export default class Module {
  constructor(System, id) {
    this.System = System;
    this.id = id;
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // module records
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  get record() {
    const record = this.System._loader.moduleRecords[this.id];
    if (!record) return null;
    if (!record.hasOwnProperty("__lively_modules__"))
      record.__lively_modules__ = {evalOnlyExport: {}};
    return record;
  }
  
  updateModuleRecordOf(doFunc) {
    var record = this.record;
    if (!record) throw new Error(`es6 environment global of ${this.id}: module not loaded, cannot get export object!`);
    record.locked = true;
    try {
      return doFunc(record);
    } finally { record.locked = false; }
  }
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // search
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  
  async search(searchStr) {
    const src = await this.source();
    const re = new RegExp(searchStr, "g");
    let match, res = [];
    while ((match = re.exec(src)) !== null) {
      res.push(match.index);
    }
    for (let i = 0, j = 0, line = 1; i < src.length && j < res.length; i++) {
      if (src[i] == '\n') line++;
      if (i == res[j]) {
        res[j] = this.id + ":" + line;
        j++;
      }
    }
    return res;
  }
}