import { arr, string } from "lively.lang";

const classMetaForSerializationProp = "lively.serializer-class-info",
      moduleMetaInClassProp = Symbol.for("lively-module-meta");

export default class ClassHelper {

  static get moduleMetaInClassProp() { return moduleMetaInClassProp }
  static get classMetaForSerializationProp() { return classMetaForSerializationProp }

  get classNameProperty() { return '__LivelyClassName__'; }
  get sourceModuleNameProperty() { return '__SourceModuleName__'; }

  constructor(options) {
    this.options = {ignoreClassNotFound: true, ...options};
    this[Symbol.for('lively-instance-restorer')] = true; // for Class.intializer
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // class info persistence

  addClassInfo(objRef, realObj, snapshot) {

    // store class into persistentCopy if original is an instance
    if (!realObj || !realObj.constructor) return;
    
    var className = realObj.constructor.name;

    if (!className) {
      console.warn(`Cannot serialize class info of anonymous class of instance ${realObj}`);
      return;
    }

    var moduleMeta = realObj.constructor[moduleMetaInClassProp];
    if (className === "Object" && !moduleMeta) return;
    snapshot[classMetaForSerializationProp] = {className, module: moduleMeta};
  }

  restoreIfClassInstance(objRef, snapshot) {
    if (!snapshot.hasOwnProperty(classMetaForSerializationProp)) return;
    var meta = snapshot[classMetaForSerializationProp];
    if (!meta.className) return;

    var klass = this.locateClass(meta);
    if (!klass || typeof klass !== "function") {
      var msg = `Trying to deserialize instance of ${JSON.stringify(meta)} but this class cannot be found!`;
      if (!this.options.ignoreClassNotFound) throw new Error(msg);
      console.error(msg);
      return {isClassPlaceHolder: true, className: meta.className};
    }

    // non-lively classes don't understand our instance restorer arg...!'
    var isLivelyClass = klass.hasOwnProperty(Symbol.for("lively-instance-superclass"));
    return isLivelyClass ? new klass(this) : new klass();
  }

  locateClass(meta) {
    // meta = {className, module: {package, pathInPackage}}
    let m = meta.module;
    if (m) {
      let moduleId = m.pathInPackage;
      if (m.package && m.package.name && m.package.name !== "no group"/*FIXME*/) {
        let packagePath = System.decanonicalize(m.package.name.replace(/\/*$/, "/"));
        moduleId = string.joinPath(packagePath, moduleId);
      }

      let livelyEnv = System.get("@lively-env"),
          realModule = livelyEnv.moduleEnv(moduleId) || livelyEnv.moduleEnv(m.pathInPackage);
      if (!realModule)
        console.warn(`Trying to deserialize instance of class ${meta.className} but the module ${moduleId} is not yet loaded`);
      else
        return realModule.recorder[meta.className];
    }


    // is it a global?
    return System.global[meta.className];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  static sourceModulesInObjRef(snapshotedObjRef) {
    //                                  /--- that's the ref
    // from snapshot = {[key]: {..., props: [...]}}
    let modules = [],
        prop = snapshotedObjRef && snapshotedObjRef[classMetaForSerializationProp];
    if (prop && prop.module) modules.push(prop.module);
    return modules;
  }
  
  static sourceModulesIn(snapshots) {

    var modules = [];

    Object.keys(snapshots).forEach(id => {
      var snapshot = snapshots[id];
      if (snapshot && snapshot[classMetaForSerializationProp])
        modules.push(snapshot[classMetaForSerializationProp]);
    });

    return arr.uniqBy(modules, (a, b) => {
      var modA = a.module, modB = b.module;
      if ((!modA && !modB) || (modA && !modB) || (!modA && modB))
        return a.className === b.className;
      return a.className === b.className
          && modA.package.name == modB.package.name
          && modA.package.pathInPackage == modB.package.pathInPackage;
    });
  }

}
