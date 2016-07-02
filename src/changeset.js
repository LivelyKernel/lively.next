class ChangeSet {
  constructor(name) {
    this.name = name;
    this.changes = [];
  }
  
  changedFile(filename) {
    return this.changes.any(c => c.path === filename);
  }
  
  getFileContent(filename) {
    const c = this.changes.find(c => c.path === filename);
    return c.content;
  }
  
  pushToGithub() {
    //TODO
  }
  
  pullFromGithub() {
    //TODO
  }
  
  toFile() {
    //TODO
  }
  
  fromFile() {
    //TODO
  }
}

export function localChangeSets() {
  // look up repositories for all loaded packages
  // and return change sets from available branches
}

let current = null;

export function currentChangeSet() { return current; }
