import { string } from 'lively.lang';

/** Keep a declaring class reference stable when an opted-in closure is saved. */
export function declaringClassCell(declaringClass) {
  return {kind: 'const', initialized: true, value: declaringClass, __serialize__(pool) {
    const serializer = pool.expressionSerializer;
    const cls = this.value;
    const meta = cls?.[Symbol.for('lively-module-meta')];
    const moduleId = meta?.package?.name ? string.joinPath(meta.package.name, meta.pathInPackage) : meta?.pathInPackage;
    if (!moduleId || !cls.name || serializer.getModuleRecorder(moduleId)[cls.name] !== cls)
      throw new Error('Cannot save super callback: declaring class ' + (cls?.name || '<anonymous>') + ' has no stable module reference (' + (moduleId || 'unknown module') + ')');
    const expression = serializer.exprStringDecode(serializer.getExpressionForFunction(cls));
    const helperModule = 'lively.context/lib/exception.js';
    return {...expression, __expr__: '__restoreDeclaringClassCell(' + expression.__expr__ + ')',
      bindings: {...expression.bindings, [helperModule]: [...(expression.bindings[helperModule] || []), {exported: 'declaringClassCell', local: '__restoreDeclaringClassCell'}]}};
  }};
}
