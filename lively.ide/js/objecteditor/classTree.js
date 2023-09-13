import { TreeData } from 'lively.components';
import { arr } from 'lively.lang';
import { withSuperclasses } from 'lively.classes/util.js';
import { lexicalClassMembers } from 'lively.classes/source-descriptors.js';
import { Icon } from 'lively.morphic';

// var oe = ObjectEditor.open({target: this})

// var tree = oe.get("classTree");
// tree.treeData = new ClassTreeData(this.constructor);
// var td = oe.get("classTree").treeData
// oe.remove()

// td.getChildren(td.root)
// td.collapse(td.getChildren(td.root)[0], false)
// tree.update()
// td.isCollapsed(td.getChildren(td.root)[2])
// tree.onNodeCollapseChanged(td.root)

// var x = new ClassTreeData(this.constructor)
// x.getChildren(x.root)
// x.getChildren(x.getChildren(x.root)[1])

// tree.selection = x.getChildren(x.root)[2]

// a context for the ObjectEditor, that encapsulates the current
// editing session. Detatched from the actual Object Editor interface
// in order to run locally as well as remotely

export default class ClassTreeData extends TreeData {
  constructor (target) {
    super({
      target,
      name: 'root',
      isRoot: true,
      isCollapsed: false
    });
  }

  display (node) {
    if (!node) return 'empty';

    if (node.isRoot) { return node.target.name || node.target.id || 'root object'; }

    // class
    if (node.isClass) { return node.target; }
    // method

    return node.name || 'no name';
  }

  isLeaf (node) { if (!node) return true; return !node.isRoot && !node.isClass; }
  isCollapsed (node) { return !node || node.isCollapsed; }
  collapse (node, bool) { node && (node.isCollapsed = bool); }

  getChildren (node) {
    if (!node) return [];
    // if (node.isCollapsed) return [];

    if (node.isRoot) {
      if (node.children) return node.children;
      const classes = arr.without(withSuperclasses(node.target), Object).reverse();
      return node.children = classes.map(klass => ({ isClass: true, klass, target: klass[Symbol.for('__LivelyClassName__')], isCollapsed: true }));
    }

    if (node.isClass) {
      try {
        return node.children ||
          (node.children = lexicalClassMembers(node.klass).map(ea => {
            const { static: _static, name, kind, overridden } = ea;
            let prefix = '';
            if (_static) prefix += 'static ';
            if (kind === 'get') prefix += 'get ';
            if (kind === 'set') prefix += 'set ';
            return { name: [overridden ? [...Icon.textAttribute('arrow-circle-up'), ' ', { opacity: 0.5 }] : [], prefix + name, {}], target: ea };
          }));
      } catch (e) { $world.showError(e); return node.children = []; }
    }

    return [];
  }
}
