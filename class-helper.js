import { arr } from "lively.lang";

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

    return new klass(this);
  }

  locateClass(meta) {
    // meta = {className, module: {package, pathInPackage}}
    var module = meta.module;
    if (module && module.package && module.package.name) {
      var packagePath = System.decanonicalize(module.package.name + "/"),
          moduleId = lively.lang.string.joinPath(packagePath, module.pathInPackage),
          module = System.get("@lively-env").moduleEnv(moduleId);
      if (!module)
        console.warn(`Trying to deserialize instance of class ${meta.className} but the module ${moduleId} is not yet loaded`);
      else
        return module.recorder[meta.className];
    }

    // is it a global?
    return System.global[meta.className];
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  static sourceModulesInObjRef(snapshotedObjRef) {
    //                                  /--- that's the ref
    // from snapshot = {[key]: {..., props: [...]}}
    var modules = [],
        prop = snapshotedObjRef && snapshotedObjRef[classMetaForSerializationProp];
    if (prop && prop.module) modules.push(prop.module);
    return modules;
  }
  
  static sourceModulesIn(snapshot) {

    var modules = [];

    Object.keys(snapshot).forEach(id => {
      var snapshot = snapshot[id];
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
