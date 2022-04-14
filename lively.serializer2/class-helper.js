/* global System */
import { arr, string } from 'lively.lang';

const classMetaForSerializationProp = 'lively.serializer-class-info';
const classSuperClassProp = Symbol.for('lively-instance-superclass');
const classNameProp = Symbol.for('__LivelyClassName__');
const moduleMetaInClassProp = Symbol.for('lively-module-meta');

export function getClassName (obj) {
  return obj.constructor[classNameProp] || obj.constructor.name;
}

export function getSerializableClassMeta (realObj) {
  if (!realObj || !realObj.constructor) return;

  let className = getClassName(realObj);

  if (!className) {
    console.warn(`Cannot serialize class info of anonymous class of instance ${realObj}`);
    return;
  }

  let moduleMeta = realObj.constructor[moduleMetaInClassProp];
  if (className === 'Object' && !moduleMeta) return;

  // Errrr FIXME
  if (moduleMeta) {
    delete moduleMeta.lastChange;
    delete moduleMeta.lastSuperclassChange;
  }

  return { className, module: moduleMeta };
}

export function locateClass (meta) {
  // meta = {className, module: {package, pathInPackage}}
  let m = meta.module;
  if (m) {
    let moduleId = m.pathInPackage;
    if (m.package && m.package.name && m.package.name !== 'no group'/* FIXME */) {
      let packagePath = System.decanonicalize(m.package.name.replace(/\/*$/, '/'));
      moduleId = string.joinPath(packagePath, moduleId);
    }
    let livelyEnv = System.get('@lively-env');
    let realModule = livelyEnv.moduleEnv(moduleId) || livelyEnv.moduleEnv(m.pathInPackage);
    if (!realModule) {
      console.warn(`Trying to deserialize instance of class ${meta.className} but the module ${moduleId} is not yet loaded`);
    } else {
      return realModule.recorder[meta.className];
    }
  }

  // is it a global?
  return System.global[meta.className];
}

export default class ClassHelper {
  static get moduleMetaInClassProp () { return moduleMetaInClassProp; }
  static get classMetaForSerializationProp () { return classMetaForSerializationProp; }
  static get classSuperClassProp () { return classSuperClassProp; }
  static get classNameProperty () { return classNameProp; }

  get sourceModuleNameProperty () { return '__SourceModuleName__'; }

  constructor (options) {
    this.options = { ignoreClassNotFound: true, ...options };
    this[Symbol.for('lively-instance-restorer')] = true; // for Class.intializer
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // class info persistence

  addClassInfo (objRef, realObj, snapshot) {
    // store class into persistentCopy if original is an instance
    const meta = getSerializableClassMeta(realObj);
    if (!meta) return;
    snapshot[classMetaForSerializationProp] = meta;
  }

  restoreIfClassInstance (objRef, snapshot) {
    if (!snapshot.hasOwnProperty(classMetaForSerializationProp)) return;
    let meta = snapshot[classMetaForSerializationProp];
    if (!meta.className) return;

    let klass = locateClass(meta);
    if (!klass || typeof klass !== 'function') {
      let msg = `Trying to deserialize instance of ${JSON.stringify(meta)} but this class cannot be found!`;
      if (!this.options.ignoreClassNotFound) throw new Error(msg);
      console.error(msg);
      return { isClassPlaceHolder: true, className: meta.className };
    }

    // non-lively classes don't understand our instance restorer arg...!'
    let isLivelyClass = klass.hasOwnProperty(Symbol.for('lively-instance-superclass'));
    return isLivelyClass ? new klass(this) : new klass();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // searching
  static sourceModulesInObjRef (snapshotedObjRef) {
    //                                  /--- that's the ref
    // from snapshot = {[key]: {..., props: [...]}}
    let modules = [];
    let prop = snapshotedObjRef && snapshotedObjRef[classMetaForSerializationProp];
    if (prop && prop.module) modules.push(prop.module);
    return modules;
  }

  static sourceModulesIn (snapshots) {
    let modules = [];

    Object.keys(snapshots).forEach(id => {
      let snapshot = snapshots[id];
      if (snapshot && snapshot[classMetaForSerializationProp]) { modules.push(snapshot[classMetaForSerializationProp]); }
    });

    return arr.uniqBy(modules, (a, b) => {
      let modA = a.module; let modB = b.module;
      if ((!modA && !modB) || (modA && !modB) || (!modA && modB)) { return a.className === b.className; }
      return a.className === b.className &&
          modA.package.name === modB.package.name &&
          modA.package.pathInPackage === modB.package.pathInPackage;
    });
  }
}
