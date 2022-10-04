/* global System, localStorage */
import { arr, obj, Path, string, fun, promise } from 'lively.lang';
import { Icon, Morph, HorizontalLayout, GridLayout, config } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import JavaScriptEditorPlugin from '../editor-plugin.js';
import { withSuperclasses, isClass } from 'lively.classes/util.js';
import { LoadingIndicator } from 'lively.components';
import { connect } from 'lively.bindings';
import { RuntimeSourceDescriptor } from 'lively.classes/source-descriptors.js';
import ObjectPackage, { isObjectClass } from 'lively.classes/object-classes.js';
import { chooseUnusedImports, interactivlyFixUndeclaredVariables, interactivelyChooseImports } from '../import-helper.js';
import * as modules from 'lively.modules';
import { parse, query } from 'lively.ast';
import { interactivelySavePart } from 'lively.morphic/partsbin.js';

import { adoptObject } from 'lively.lang/object.js';

import { InteractiveMorphSelector } from 'lively.halos';

import ObjectEditorContext from './context.js';
import DarkTheme from '../../themes/dark.js';
import DefaultTheme from '../../themes/default.js';
import { stringifyFunctionWithoutToplevelRecorder } from 'lively.source-transform';
import { interactivelyFreezePart } from 'lively.freezer';
import { generateReferenceExpression } from '../inspector/helpers.js';
import { getClassName } from 'lively.serializer2';
import { resource } from 'lively.resources';
import lint from '../linter.js';
import { StatusMessageConfirm, StatusMessageWarning, StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { ViewModel } from 'lively.morphic/components/core.js';

const DANGEROUS_METHODS_TO_OVERRIDE = ['render', 'remove', 'addMorph', 'addMorphAt'];

export class ObjectEditorModel extends ViewModel {
  static get properties () {
    return {

      context: {},

      editorPlugin: {
        readOnly: true,
        derived: true,
        after: ['submorphs'],
        get () {
          const ed = this.ui.sourceEditor;
          let p = ed.pluginFind(p => p.isEditorPlugin);
          if (!p) p = ed.addPlugin(new JavaScriptEditorPlugin(config.codeEditor.defaultTheme));
          return p;
        }
      },

      target: {
        get () {
          return this.context.target;
        }
      },

      isObjectEditor: {
        readOnly: true,
        get () { return true; }
      },

      systemInterface: {
        readOnly: true,
        get () {
          return this.editorPlugin.evalEnvironment.systemInterface;
        }
      },

      expose: {
        get () {
          return ['browse', 'commands', 'keybindings', 'onWindowClose'];
        }
      },

      bindings: {
        get () {
          return [
            {
              model: 'inspect object button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'open object inspector for target'
            },
            {
              model: 'publish button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'freeze target'
            },
            {
              model: 'choose target button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'choose target'
            },
            { model: 'add button', signal: 'fire', handler: 'interactivelyAddObjectPackageAndMethod' },
            {
              model: 'remove button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'remove method or class'
            },
            { model: 'fork package button', signal: 'fire', handler: 'interactivelyForkPackage' },
            {
              model: 'open in browser button',
              signal: 'fire',
              handler: 'execCommand',
              updater: function ($upd) {
                $upd('open class in system browser', { klass: this.targetObj.selectedClass });
              }
            },
            {
              model: 'save button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'save source'
            },
            {
              model: 'run method button',
              signal: 'fire',
              handler: 'execCommand',
              converter: () => 'run selected method'
            },
            { model: 'toggle imports button', signal: 'fire', handler: 'toggleShowingImports' },
            { target: 'source editor', signal: 'textChange', handler: 'updateUnsavedChangeIndicatorDebounced' },
            { target: 'class tree', signal: 'selectedNode', handler: 'onClassTreeSelection' },
            { target: 'class tree', signal: 'contextMenuRequested', handler: 'contextMenuForClassTree' }
          ];
        }
      }
    };
  }

  get keybindings () {
    return [
      { keys: 'F1', command: 'focus class tree' },
      { keys: 'F2', command: 'focus code editor' },
      { keys: 'F3', command: 'toggle showing imports' },
      { keys: { mac: 'Command-S', win: 'Ctrl-S' }, command: 'save source' },
      { keys: { mac: 'Command-Shift-=', win: 'Ctrl-Shift-=' }, command: 'add method' },
      { keys: { mac: 'Command-Shift--', win: 'Ctrl-Shift--' }, command: 'remove method or class' },
      { keys: 'Ctrl-Shift-R', command: 'run selected method' },
      { keys: 'Alt-R', command: 'refresh' },
      { keys: { win: 'Ctrl-B', mac: 'Meta-B' }, command: 'open class in system browser' },
      { keys: 'Alt-Shift-T', command: 'choose target' },
      { keys: 'Alt-J', command: 'jump to definition' },
      { keys: 'Ctrl-C I', command: '[javascript] inject import' },
      { keys: 'Ctrl-C C I', command: '[javascript] fix undeclared variables' }
    ];
  }

  get commands () {
    return [

      {
        name: 'focus class tree',
        exec: () => { const m = this.ui.classTree; m.show(); m.focus(); return true; }
      },

      {
        name: 'focus code editor',
        exec: () => { const m = this.ui.sourceEditor; m.show(); m.focus(); return true; }
      },

      {
        name: 'refresh',
        exec: async () => {
          await this.withContextDo(ctx => {
            const klass = ctx.selectedClass;
            if (klass) {
              const descr = ctx.sourceDescriptorFor(klass);
              descr.module.reset();
              descr.reset();
            }
          });
          await this.refresh(true);
          this.view.setStatusMessage('reloaded');
          return true;
        }
      },

      {
        name: '[javascript] inject import',
        exec: async () => { await this.models.importController.interactivelyAddImport(); return true; }
      },

      {
        name: '[javascript] fix undeclared variables',
        exec: async () => this.interactivlyFixUndeclaredVariables()
      },

      {
        name: '[javascript] removed unused imports',
        exec: async () => { await this.interactivelyRemoveUnusedImports(); return true; }
      },

      {
        name: 'toggle showing imports',
        exec: async () => { await this.toggleShowingImports(); return true; }
      },

      {
        name: 'add method',
        exec: async () => { await this.interactivelyAddObjectPackageAndMethod(); return true; }
      },

      {
        name: 'remove method or class',
        exec: async () => { await this.interactivelyRemoveMethodOrClass(); return true; }
      },

      {
        name: 'adopt by superclass',
        exec: async () => { await this.interactivelyAdoptBySuperclass(); return true; }
      },

      {
        name: 'adopt by another class',
        exec: async () => { await this.interactivelyAdoptByClass(); return true; }
      },

      {
        name: 'run selected method',
        exec: async () => { await this.interactivelyRunSelectedMethod(); return true; }
      },

      {
        name: 'jump to definition',
        exec: async () => {
          const { classTree: tree, sourceEditor } = this.ui;
          const td = tree.treeData;
          const classNodes = td.getChildren(td.root).slice();
          const items = classNodes.reverse().flatMap(node => {
            const klass = node.target;
            const methods = td.getChildren(node);

            return [{
              isListItem: true,
              label: [klass, { fontWeight: 'bold', fontFamily: 'IBM Plex Mono' }],
              value: { node, selector: 'selectClass', klass }
            }].concat(
              methods.map(ea => {
                return {
                  isListItem: true,
                  label: [
                        `${klass}`, {
                          fontSize: '80%',
                          textStyleClasses: ['v-center-text'],
                          paddingRight: '10px'
                        },
                        `${ea.name[1]}`, {}
                  ],
                  value: { node: ea, selector: 'selectMethod', klass }
                };
              })
            );
          });

          const { selected: [choice] } = await this.world().filterableListPrompt(
            'select class or method', items,
            {
              historyId: 'lively.morphic-object-editor-jump-def-hist',
              requester: this.view
            });

          if (choice) {
            await this[choice.selector](choice.klass, choice.node.target);
            sourceEditor.focus();
            tree.scrollSelectionIntoView();
            if (choice.selector === 'selectClass') sourceEditor.scroll = pt(0, 0);
          }
          return true;
        }
      },

      {
        name: 'save source',
        exec: async () => {
          try {
            const { view } = this;
            const { success, reason, warnings } = await this.doSave();
            if (warnings && warnings.length > 0) {
              view.setStatusMessage(['Saved with warnings:'].concat(warnings.map(warning => `"${warning.message}" on line ${warning.line}`)).join('\n'), StatusMessageWarning, 5000, { isCompact: false });
              return true;
            }
            view.setStatusMessage(
              success ? 'saved' : reason,
              success ? StatusMessageConfirm : StatusMessageError,
              5000,
              { extent: pt(view.width, 40) }
            );
          } catch (e) { this.view.showError(e); }
          return true;
        }
      },

      {
        name: 'open class in system browser',
        exec: async (_, opts = { klass: null }) => {
          return this.browseClass(opts.klass);
        }
      },

      {
        name: 'open object inspector for target',
        exec: async () => {
          return this.world().execCommand('open object inspector', { target: this.target });
        }
      },

      {
        name: 'freeze target',
        exec: async () => {
          try {
            await interactivelyFreezePart(this.target, this.view);
          } catch (e) {
            if (e === 'canceled') this.view.setStatusMessage('canceled');
            else this.view.showError(e);
          }
        }
      },

      {
        name: 'publish target to PartsBin',
        exec: async () => {
          const { view } = this;
          try {
            const commit = await interactivelySavePart(this.target, { notifications: false, loadingIndicator: true });
            view.setStatusMessage(
              commit
                ? `Published ${this.target} as ${commit.name}`
                : `Failed to publish part ${this.target}`,
              commit ? StatusMessageConfirm : StatusMessageError, 5000);
          } catch (e) {
            if (e === 'canceled') view.setStatusMessage('canceled');
            else view.showError(e);
          }
        }
      },

      {
        // fixme: this will crash weirdly inside a nodejs context
        name: 'choose target',
        exec: async () => {
          const { view } = this;
          if (view.env.eventDispatcher.isKeyPressed('Shift')) {
            // support remote morph selection
            if (this.context.isRemote) {
              this._loadingIndicator = LoadingIndicator.open('Connecting to Remote...');
              await this.withContextDo(async ctx => {
                // REMOTE START
                if (!ctx.target.isMorph) return;
                const selectionFn = async (title, items, opts) => {
                  // ensure the tiems are ids
                  const editorCallback = stringifyFunctionWithoutToplevelRecorder(async ed => {
                    // LOCAL START
                    ed._loadingIndicator.remove();
                    const res = await ed.world().filterableListPrompt(title, items, opts);
                    ed._loadingIndicator = LoadingIndicator.open('Switching Target...');
                    return res;
                    // LOCAL END
                  });
                  const res = await ctx.withEditorDo(editorCallback, {
                    items: items.map(item => { item.value = item.value.id; return item; }),
                    title,
                    opts
                  }); // insert stringified params
                  let { selected, action } = res;
                  selected = selected.map(id => $world.getMorphWithId(id));
                  return { selected, action };
                };
                const [selected] = await $world.execCommand('select morph', {
                  selectionFn,
                  justReturn: true,
                  root: [ctx.target, ...ctx.target.ownerChain()].find(m => m.owner.isWorld)
                });
                if (selected) {
                  await ctx.selectTarget(selected);
                }
                // REMOTE END
              });
              await this.refresh();
              this._loadingIndicator.remove();
              return;
            }
            const [selected] = await this.world().execCommand('select morph', {
              justReturn: true,
              root: [this.target, ...this.target.ownerChain()].find(m => m.owner.isWorld)
            });
            if (selected) this.selectTarget(selected);
          } else {
            const selected = await InteractiveMorphSelector.selectMorph(this.world());
            if (selected) this.selectTarget(selected);
          }

          view.focus();
          return this.target;
        }
      },

      {
        name: 'open browse snippet',
        exec: () =>
          this.world().execCommand('open workspace',
            { content: this.browseSnippetForSelection(), language: 'javascript' })
      }
    ];
  }

  viewDidLoad () {
    this.ui.sourceEditor.addCommands([{
      name: '[javascript] fix undeclared variables',
      exec: () => this.interactivlyFixUndeclaredVariables()
    }, {
      name: '[javascript] inject import',
      exec: () => this.interactivelyAddImport()
    }, {
      name: '[javascript] remove unused imports',
      exec: () => this.interactivelyRemoveUnusedImports()
    }]);
  }

  // __additionally_serialize__

  // onLoad()

  async warnForUnsavedChanges () {
    return await this.world().confirm([
      'Discard Changes\n', {}, 'The unsaved changes to this module are going to be discarded.\nAre you sure you want to proceed?', { fontSize: 16, fontWeight: 'normal' }], { requester: this.view, width: 350 });
  }

  async onWindowClose () {
    let proceed = true;
    if (await this.hasUnsavedChanges()) proceed = await this.warnForUnsavedChanges();
    if (proceed) this.context.dispose();
    else return false;
  }

  /*
   * Returns wether or not the sidepanel that displays all the imports is shown.
   * @returns {Boolean}
   */
  isShowingImports () { return this.view.layout.grid.col(2).width > 10; }

  /*
   * Returns the source descriptor for a corresponding class object.
   * The source descriptor allows us to access and edit the corresponding
   * module and source of that class.
   * @param { Class } klass - The class to get the source descriptor for.
   * @return { RuntimeSourceDescriptor }
   */
  sourceDescriptorFor (klass) { return RuntimeSourceDescriptor.for(klass); }

  /*
   * Returns the chain of superclasses for the class of the selected target.
   * @returns {Class[]}
   */
  classChainOfTarget () {
    return withSuperclasses(this.target.constructor);
  }

  /*
   * Toggle the sidebar that displays the list of imported entities inside the
   * module that the target's class definition resides in.
   * @param { Number } timeout - Duration of the toggle animation.
   */
  async toggleShowingImports (timeout = 300/* ms */) {
    const { view, ui: { importController, sourceEditor, frozenWarning } } = this;
    const expandedWidth = importController.getExpandedWidth();
    const enable = !this.isShowingImports();
    const newWidth = enable ? expandedWidth : -expandedWidth;
    const column = view.layout.grid.col(2);
    // disable the layouts so we can make some adjustments
    view.layout.disable();
    importController.layout.disable();
    column.width += newWidth;
    column.before.width -= newWidth;
    importController.layout.col(0).width = enable ? expandedWidth : 0;
    // enable the layouts animated
    importController.layout.enable(timeout ? { duration: timeout } : null);
    await view.layout.enable(timeout ? { duration: timeout } : null);
    (enable ? importController : sourceEditor).focus();
    await promise.delay(2 * timeout);
  }

  /*
   * Adjust the window style depending on the evaluation context
   * the target is residing in. If the target object resides in a client side
   * environemnt, the window carries the default style.
   * If the target object resides in a nodejs environment (server side)
   * we apply a dark window to the window.
   * @param {Boolean} animated - Wether or not to transition between window styles in an animated fashion.
   */
  async ensureProperWindowStyle (animated = true) {
    const duration = 300; let theme; let styleClasses; const window = this.view.getWindow();
    if ((await this.editorPlugin.runEval("System.get('@system-env').node")).value) {
      styleClasses = [...arr.without(window.styleClasses, 'local'), 'node'];
      theme = DarkTheme.instance;
    } else {
      styleClasses = ['local', ...arr.without(window.styleClasses, 'node')];
      theme = DefaultTheme.instance;
    }
    this.editorPlugin.theme = theme;
    if (animated) {
      window.animate({ duration, styleClasses });
      this.ui.sourceEditor.animate({
        fill: theme.background, duration
      });
    } else {
      window.styleClasses = styleClasses;
    }
    this.ui.sourceEditor.textString = this.ui.sourceEditor.textString;
    this.editorPlugin.highlight();
  }

  /*
   * Set the currently focused target object of the object editor together
   * with the appropriate evaluation environment.
   * @param { Object } target - The target object to select
   * @param { Object } evalEnvironment - The eval environment corresponding to the newly selected target
   * @param { Object } evalEnvironment.context - Binding of the "this" keyword.
   * @param { String } evalEnvironemnt.format - The format of the target module.
   * @param { SystemInterface } evalEnvironment.systemInterface - The system interface that provides access to the runtime.
   * @param { String } evalEnvironment.targetModel - The id of the target module.
   */
  async selectTarget (target, evalEnvironment) {
    const { classTree, openInBrowserButton, publishButton } = this.ui;
    this.context = await ObjectEditorContext.for(target, this, evalEnvironment);
    if (await this.withContextDo(ctx => !ctx.target.isMorph)) publishButton.disable();
    else publishButton.enable();
    if (await this.withContextDo(ctx => !ctx.target.constructor[Symbol.for('lively-module-meta')].package.name)) { openInBrowserButton.disable(); } else openInBrowserButton.enable();
    classTree.treeData = await this.withContextDo(ctx => ctx.classTreeData);
    await this.selectClass(this.context.selectedClassName);
    this.ensureProperWindowStyle();
  }

  /*
   * Perform a callback within the context of the current evaluation environment.
   * Dispatches the "migration" of the function binding to the context who makes sure
   * that var mappings are resolved properly.
   * @param { Function } fn - Callback function to run inside the current evaluation environment.
   * @param { Object } varMapping - The var mapping to ensure the bindings of variables inside the function. Attention: The bound variables are subject to serialization. So types that can not be resolved in the other eval environment can cause the callback to crash.
   */
  async withContextDo (fn, varMapping) {
    return await this.context.withContextDo(fn, varMapping);
  }

  /*
   * Refresh the UI to reflect the currently selected object and class.
   * @param { Boolean } keepCursor - Wether or not to maintain the current position of the text cursor when the source is being updated.
   */
  async refresh (keepCursor = false) {
    const {
      ui: { sourceEditor: ed, classTree: tree }
    } = this;
    const oldPos = ed.cursorPosition;
    const { className, treeData } = await this.withContextDo(async (ctx) => {
      const res = {
        className: ctx.selectedClass && ctx.selectedClass.name,
        methodName: ctx.selectedMethod && ctx.selectedMethod.name
      };
      await ctx.refresh();
      res.treeData = ctx.classTreeData;
      return res;
    });

    await tree.maintainViewStateWhile(
      () => tree.treeData = treeData,
      node => node.isClass ? node.target : node.name);

    if (className && !tree.selectedNode) await this.selectClass(className);

    if (keepCursor) ed.cursorPosition = oldPos;
  }

  /*
   * Updates the known globals for the currently selected context.
   * Known globals are variables that are defined outside the scope of the current modules
   * and can usually be accessed from any module inside the system.
   */
  async updateKnownGlobals () {
    const declaredNames = await this.withContextDo(async (ctx) => {
      let declaredNames = [];
      const klass = ctx.selectedClass;

      if (klass) {
        const descr = ctx.sourceDescriptorFor(klass);
        ({ declaredNames } = await descr.declaredAndUndeclaredNames);
      }

      Object.assign(ctx.evalEnvironment, { knownGlobals: declaredNames });

      return declaredNames;
    });
    // keep both evaluation environments in sync
    // fixme: maybe better to have a single source of truth?
    Object.assign(this.editorPlugin.evalEnvironment, { knownGlobals: declaredNames });
    this.editorPlugin.highlight();
  }

  /*
   * Update the displayed source string inside the editor.
   * @param { String } source - The updated source string to be displayed.
   * @param { String } targetModule - The id of the module the source string is derived from. In object editors we always display "substrings" of the entire module source.
   */
  async updateSource (source, targetModule = 'lively://object-editor/' + this.id) {
    const ed = this.ui.sourceEditor;
    const format = await this.withContextDo(async (ctx) => {
      const { systemInterface: system } = ctx.evalEnvironment;
      const format = (await system.moduleFormat(targetModule)) || 'esm';
      Object.assign(ctx.evalEnvironment, { targetModule, format });
      return format;
    }, {
      targetModule
    });
    if (ed.textString !== source) { ed.textString = source; }
    Object.assign(this.editorPlugin.evalEnvironment, { targetModule, format });
    const hashCode = string.hashCode(source);
    await this.withContextDo((ctx) => {
      ctx.moduleChangeWarning = null;
      ctx.sourceHash = hashCode;
    }, { hashCode });
    await this.clearLocalProperties();
    this.indicateNoUnsavedChanges();
  }

  /*
   * Convenience method that allows to clear any locally defined props
   * that are not declared in code but instead have been applied to the
   * target object at runtime.
   */
  async clearLocalProperties () {
    await this.withContextDo((ctx) => {
      const { properties } = ctx.target.propertiesAndPropertySettings();
      for (const prop in properties) {
        if (ctx.target.hasOwnProperty(prop)) {
          if (ctx.target[prop] && ctx.target[prop].isConnectionWrapper) continue;
          if (ctx.hasOwnProperty('$$' + prop)) delete ctx.target[prop];
        }
      }
    });
  }

  /*
   * Activate the visual indicator that shows that unsaved changes have been
   * applied to the editor. These may get discarded when a different target or
   * class is selected.
   */
  indicateUnsavedChanges () {
    const { sourceEditor } = this.ui;
    this.view.layout.col(1).paddingRight = 1;
    sourceEditor.padding = sourceEditor.padding.withWidth(-1);
    sourceEditor.borderColor = Color.red;
  }

  /*
   * Clear the visual indicator for unsaved changes.
   */
  indicateNoUnsavedChanges () {
    const { sourceEditor } = this.ui;
    this.view.layout.col(1).paddingRight = 0;
    sourceEditor.padding = sourceEditor.padding.withWidth(0);
    sourceEditor.borderColor = Color.gray;
  }

  /*
   * Returns true if the source string inside the editor and the actual source code of the module
   * no longer match. Since the module source can reside in a remote evaluation environment we
   * return asynchronously.
   */
  async hasUnsavedChanges () {
    return (await this.withContextDo(ctx => ctx.sourceHash)) !== string.hashCode(this.ui.sourceEditor.textString);
  }

  /*
   * Update the unsaved changes indicator according to wether or not there are unsaved changes detected.
   */
  async updateUnsavedChangeIndicator () {
    this[(await this.hasUnsavedChanges()) ? 'indicateUnsavedChanges' : 'indicateNoUnsavedChanges']();
  }

  /*
   * Debounce wrapper for unsaved changes indicator
   */
  updateUnsavedChangeIndicatorDebounced () {
    fun.debounceNamed(this.id + '-updateUnsavedChangeIndicatorDebounced', 20,
      () => this.updateUnsavedChangeIndicator())();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // system events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /*
   * Should the source of the module of a currently selected target change
   * from outside of the object editor, we react to this change by notifying
   * the user in case there are unsaved changes that may conflict.
   * @param { String } newClassSource - The updated source of the class in the changed module.
   */
  async reactToModuleChange (newClassSource) {
    const ed = this.ui.sourceEditor;
    if (await this.hasUnsavedChanges()) {
      if (string.hashCode(ed.textString) !== string.hashCode(newClassSource)) {
        await this.withContextDo((ctx) => ctx.addModuleChangeWarning());
        return;
      }
    }
    await this.refresh(true);
  }

  /*
   * Callback for module changes in the system.
   */
  async onModuleChanged (evt) {
    if (!this.context || this.context.isRemote) return;
    const newClassSource = await this.context.onModuleChanged(evt);
    if (newClassSource) this.reactToModuleChange(newClassSource);
  }

  onModuleLoaded (evt) {
    this.onModuleChanged(evt);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // classes and method ui
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /*
   * Shorthand for setting up the object editor according to a particular configuration.
   * This is especially useful for reconstructing object editors when reloading a workspace from
   * minimum amount of information.
   * @param { Object } spec - The UI spec for the object editor.
   * @param { Object } spec.target - The target object to be selected.
   * @param { String } spec.className - The name of the class to be selected.
   * @param { String } spec.methodName - The name of the method or member to be selected.
   * @param { TextPosition } spec.textPosition - The row and column the text cursor should be placed at.
   * @param { Point } spec.scroll - The scroll position of the code editor.
   * @param { Point } spec.classTreeScroll - The scroll of the class tree side panel.
   * @param { Object } spec.evalEnvironment - The evaluation environment corresponding to the target object.
   */
  async browse (spec) {
    let {
      target, // can be string
      className,
      methodName,
      textPosition,
      scroll,
      classTreeScroll,
      evalEnvironment
    } = spec;

    if (target) await this.selectTarget(target, evalEnvironment);

    if (!className) {
      className = await this.withContextDo((ctx) => {
        return ctx.selectedClass.name;
      });
    }
    if (className && methodName) await this.selectMethod(className, methodName, false);
    else if (className) await this.selectClass(className);

    const { classTree, sourceEditor } = this.ui;
    if (scroll) sourceEditor.scroll = scroll;
    if (textPosition) sourceEditor.cursorPosition = textPosition;
    if (classTreeScroll) classTree.scroll = classTreeScroll;

    return this;
  }

  /*
   * Returns the browse spec based on the current configuration of the object editor.
   * Passing the result back into ObjectEditorModel>>browse() should reconstruct the editor to the current state.
   * @param { Boolean } complete - Wether or not to include the precise scroll positions of all editor, tree and imports list.
   */
  async browseSpec (complete = true) {
    const {
      ui: {
        classTree: { scroll: classTreeScroll },
        sourceEditor: { scroll, cursorPosition: textPosition }
      }
    } = this;
    const { className, methodName } = await this.withContextDo(ctx => {
      const className = ctx.selectedClass && ctx.selectedClass.name;
      const methodName = ctx.selectedMethod && ctx.selectedMethod.name;
      return { className, methodName };
    });

    return {
      target: this.context.target,
      className,
      methodName,
      evalEnvironment: this.context.evalEnvironment,
      ...complete ? { scroll, textPosition, classTreeScroll } : {}
    };
  }

  /*
   * Opens the system browser at the module and text position where the given class is defined
   * @param { Class } klass - The class to open the source code for.
   */
  async browseClass (klass) {
    let className, moduleName;
    if (klass) {
      ({ name: className, module: { id: moduleName } } = this.context.sourceDescriptorFor(klass));
    } else {
      ({ className, moduleName } = await this.withContextDo(ctx => {
        if (!ctx.selectedClass) return {};
        const desc = ctx.sourceDescriptorFor(ctx.selectedClass);
        return {
          className: desc.name,
          moduleName: desc.module.id
        };
      }));
    }
    if (moduleName && className) {
      return this.world().execCommand('open browser',
        { moduleName, codeEntity: { name: className }, systemInterface: this.systemInterface });
    }
    this.view.setStatusMessage('No class specified');
    return true;
  }

  /*
   * Produces a string that, when evaluated, will open the browser at the
   * same location it is at now.
   * @returns { String }
   */
  browseSnippetForSelection () {
    const c = this.context.selectedClassName;
    const m = this.selectedMethod;
    const t = this.target;

    let codeSnip = '$world.execCommand("open object editor", {';
    codeSnip += `target: ${generateReferenceExpression(t)}`;
    if (c) codeSnip += `, selectedClass: "${c}"`;
    if (m && c) codeSnip += `, selectedMethod: "${m.name}"`;
    codeSnip += '});';

    return codeSnip;
  }

  /*
   * Callback that is invoked in response to selection changes inside the class tree side panel.
   * @param { Object } node - The tree node that is currently selected in the class tree.
   * @param { String | Class } node.target - The member or class referenced in the tree at that node.
   */
  onClassTreeSelection (node) {
    if (!node) { return; }

    if (obj.isString(node.target) || isClass(node.target)) {
      this.selectClass(node.target);
      return;
    }

    const tree = this.ui.classTree;
    const parentNode = tree.treeData.parentNode(node);
    const isClick = !!Path('env.eventDispatcher.eventState.clickedOnMorph').get(this.view);
    this.selectMethod(parentNode.target, node.target, isClick);
  }

  /*
   * Return (and open) the proper context menu for a given node in the class tree depending on what entity it refers to.
   * @param { Object } _.node - The node inside the tree to get the context menu for.
   * @param { Event } _.evt - Optionally the mouse event that initiated the context menu request.
   * @returns { Menu }
   */
  contextMenuForClassTree ({ node, evt }) {
    evt.stop();
    if (!node || !node.target) return;
    const klass = isClass(node.target)
      ? node.target
      : node.target.owner && isClass(node.target.owner)
        ? node.target.owner
        : obj.isString(node.target) ? node.target : null;

    const items = [];

    if (klass) {
      items.push({ command: 'open browse snippet', target: this.view });
    }

    if (obj.isString(klass) ? this.context.selectedClassName === klass : this.context.selectedClass === klass) {
      const adoptByItems = [];
      klass.name !== 'Morph' && adoptByItems.push({ alias: 'by superclass', command: 'adopt by superclass', target: this.view });
      adoptByItems.push({ alias: 'by custom class...', command: 'adopt by another class', target: this.view });
      items.push(['adopt by...', adoptByItems]);
    }

    return this.world().openWorldMenu(evt, items);
  }

  /*
   * Select the given class in the side panel and update the source and context accordingly.
   * @param { Object | String } klass - The name or direct reference to the class to be selected.
   */
  async selectClass (klass) {
    if (this._updatingTree) return;
    const tree = this.ui.classTree;
    const className = typeof klass === 'string' ? klass : klass.name;
    if (this.context.selectedClassName !== className) {
      if (tree.selectedNode && await this.hasUnsavedChanges() && this.ui.sourceEditor.textString) {
        const proceed = await this.warnForUnsavedChanges();
        if (!proceed) {
          const node = tree.nodes.find(ea => !ea.isRoot && ea.isClass && ea.klass.name === this.context.selectedClassName);
          this._updatingTree = true;
          tree.selectedNode = node;
          this._updatingTree = false;
          return;
        }
      }
      await this.context.selectClass(className);
    }
    if (await this.withContextDo((ctx) => isObjectClass(ctx.selectedClass))) { this.ui.forkPackageButton.enable(); } else this.ui.forkPackageButton.disable();
    // fetch data from context
    const descr = await this.withContextDo(async (ctx) => {
      ctx.selectedMethod = null; // ensure that method is not selected
      const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
      if (!descr._moduleSource && descr.module._frozenModule) {
        descr._moduleSource = await descr.module.source();
      }
      return {
        source: descr.source,
        moduleId: descr.module.id
      };
    });

    await this.updateSource(await descr.source, descr.moduleId);
    await this.updateKnownGlobals();
    await this.updateTitle();
    await this.ui.importController.setModule(descr.moduleId);

    if (!tree.selectedNode || tree.selectedNode.target !== klass) {
      const node = tree.nodes.find(ea => !ea.isRoot && ea.isClass && ea.name === klass);
      tree.selectedNode = node;
    }
  }

  /*
   * Given a class, select a method or member of that class and update the
   * editor interface accordingly.
   * @param { String | Object } klass - The class the selected method/member belongs to.
   * @param { Object | String } methodSpec - The spec that uniquely identifies the selected method/member.
   * @param { String } methodSpec.name - The name of the method or member to be selected.
   * @param { Number } methodSpec.start - The start index inside the source code where the method/member definition can be found.
   * @param { Number } methodSpec.end - The end index inside the source code where the method/member definition can be found.
   * @param { Boolean } highlight - Wether or not to highlight the definition of the method/member upon selection.
   * @param { Boolean } putCursorInBody - Wether or not to place the cursor at the starting position of the method/member definition upon selection.
   */
  async selectMethod (klass, methodSpec, highlight = true, putCursorInBody = false) {
    const className = klass.name || klass;
    if (!methodSpec.name) methodSpec = { name: methodSpec };
    const methodNode = await this.context.selectMethod(className, methodSpec);

    if (!methodNode) {
      this.setStatusMessage(`Cannot find method ${methodSpec.name}`);
      return;
    }

    await this.updateTitle();

    const tree = this.ui.classTree;
    const differentClassSelected = await this.withContextDo(ctx =>
      ctx.selectedClass.name !== className, { className });
    if (differentClassSelected || !tree.selectedNode) { await this.selectClass(klass); }

    await tree.uncollapse(tree.selectedNode);
    if (!tree.selectedNode || tree.selectedNode.target !== methodSpec) {
      const node = tree.nodes.find(ea =>
        !ea.isClass &&
         !ea.isRoot &&
         ea.target.owner === klass &&
         ea.target.name === methodSpec.name);
      tree.selectedNode = node;
      tree.scrollSelectionIntoView();
    }

    const ed = this.ui.sourceEditor;
    const cursorPos = ed.indexToPosition(putCursorInBody
      ? methodNode.value.body.start + 1
      : methodNode.key.start);
    ed.cursorPosition = cursorPos;
    ed.scrollCursorIntoView();

    const methodRange = {
      start: ed.indexToPosition(methodNode.start),
      end: ed.indexToPosition(methodNode.end)
    };
    ed.centerRange(methodRange);
    if (highlight) {
      ed.flash(methodRange, { id: 'method', time: 1000, fill: ed.selectionColor || Color.blue.withA(0.2) });
    }
    this.selectedMethodName = methodSpec.name;
  }

  /*
   * Trigger the frozen module indicator that shows that the module system currently has
   * not instrumented the source code and that editing is temporarily deactivated.
   * FIXME: This should be a thing of the past in the future. There should be support for successively hot swapping compiled code with dynamic one by compiling "entry points" into the compiled source that allow for hot swapping of refs. This requires A.) Refactoring the freezer and B.) Writing a custom source transformer that replaces all direct variable references by replacable references.
   */
  async displayFrozenWarningIfNeeded () {
    const { view } = this;
    const moduleInfo = await this.withContextDo(ctx => {
      return ctx.selectedModule._frozenModule && {
        pkgName: ctx.selectedModule.package().name,
        moduleName: ctx.selectedModule.pathInPackage()
      };
    });
    if (moduleInfo) {
      this.ui.frozenWarning.textString = `The module "${moduleInfo.pkgName}/${moduleInfo.moduleName}" you are viewing is frozen. You are not able to make changes to this module unless you reload the world with dynamic load enabled for the package "${moduleInfo.pkgName}".`;
    }

    this.ui.saveButton.deactivated = !!moduleInfo;
    const prevHeight = view.layout.row(1).height;
    const row = view.layout.row(1);
    view.layout.disable();
    row.height = moduleInfo ? 80 : 0;
    row.after.height -= prevHeight !== row.height ? (moduleInfo ? 80 : -80) : 0;
    view.layout.enable({ duration: 300 });
  }

  /*
   * Update the window title in accordance to the selected target and its respective context.
   */
  async updateTitle () {
    const win = this.view.getWindow();
    if (!win) return;
    let title = 'ObjectEditor';
    title += await this.withContextDo((ctx) => ctx.getTitle());
    const url = this.systemInterface.coreInterface.url;
    title += url ? ` [${url}]` : '';
    win.title = title;
    win.relayoutWindowControls();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // command support
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  /*
   * Perform a save and update the source of the module the class definition of the selected target lives in.
   */
  async doSave () {
    const { ui: { sourceEditor } } = this;
    if (await this.withContextDo((ctx) => !ctx.selectedClass)) { return { success: false, reason: 'No class selected' }; }

    if (await this.withContextDo((ctx) => ctx.selectedModule._frozenModule)) { return { success: false, reason: 'Frozen modules can not be altered' }; }

    // Ask user what to do with undeclared variables. If this gets canceled we
    // abort the save
    if (config.objectEditor.fixUndeclaredVarsOnSave) {
      const fixed = await this.execCommand('[javascript] fix undeclared variables');
      if (!fixed) return { success: false, reason: 'Save canceled' };
    }

    let className; let content = sourceEditor.textString;
    ({ content, className } = await this.withContextDo((ctx) => {
      const { selectedClass } = ctx;

      const parsed = parse(content);

      // ensure that the source is a class declaration
      if (parsed.body.length !== 1 || parsed.body[0].type !== 'ClassDeclaration') {
        return {
          success: false,
          reason: `Code is expected to contain the class definition of ${selectedClass}, aborting save.`
        };
      }

      // we do not support renaming classes by changing the source (yet?)
      const classDecl = parsed.body[0];
      const className = content.slice(classDecl.id.start, classDecl.id.end);
      if (className !== selectedClass.name) {
        content = content.slice(0, classDecl.id.start) + selectedClass.name + content.slice(classDecl.id.end);
      }
      return { content, className };
    }, {
      content
    }));

    let warnings = false;
    [content, warnings] = lint(content, { 'no-unused-vars': ['warn', { args: 'none', varsIgnorePattern: `_|${className}` }] });

    const editorSourceHash = string.hashCode(content);
    const { sourceChanged, outsideChangeWarning, selectedModuleId } = await this.withContextDo((ctx) => {
      // moduleChangeWarning is set when the context gets notified that the
      // current module was changed elsewhere (onModuleChanged) and it also has
      // unsaved changes
      const { sourceHash, moduleChangeWarning, selectedModule } = ctx;
      const sourceChanged = sourceHash !== editorSourceHash;
      return {
        selectedModuleId: selectedModule.id,
        sourceChanged,
        outsideChangeWarning: moduleChangeWarning === selectedModule.id
      };
    }, {
      editorSourceHash
    });

    const overriddenSystemMethods = await this.withContextDo(ctx => {
      const parsed = parse(content);

      const [classDecl] = query.topLevelDeclsAndRefs(parsed).classDecls;
      const problematicOverrides = query.nodesInScopeOf(classDecl).filter(m => {
        return m.type === 'MethodDefinition' &&
        DANGEROUS_METHODS_TO_OVERRIDE.includes(m.key.name) &&
        !ctx.selectedClass.prototype.hasOwnProperty(m.key.name);
      });
      return problematicOverrides.length ? problematicOverrides.map(m => m.key.name) : false;
    });

    if (overriddenSystemMethods) {
      let overriddenSystemMethod;
      while (overriddenSystemMethod = overriddenSystemMethods.pop()) {
        let really = await this.world().confirm(
          ['System Method Override\n', {},
            'You are about to override ', { fontWeight: 'normal', fontSize: 16 },
            overriddenSystemMethod + '()', { fontWeight: 'bold', fontStyle: 'italic' },
            ' which is a method at the core of the System. You should only proceed if you are absolutely sure you know what you are doing, else you may cause to crash the running System.', { fontWeight: 'normal' }
          ],
          {
            width: 400,
            requester: this
          }
        );
        if (!really) return { success: false };
      }
    }

    if (sourceChanged && outsideChangeWarning) {
      let really = await this.world().confirm(
        ['Simultaneous Change Warning\n', {},
        `The module ${selectedModuleId} you are trying to save changed elsewhere!\nOverwrite those changes?`, {
          fontSize: 16, fontWeight: 'normal'
        }], { requester: this });
      if (!really) return { success: false, reason: 'Save canceled' };
      await this.withContextDo(ctx => ctx.moduleChangeWarning = null);
    }

    this.backupSourceInLocalStorage(content);

    try {
      await this.withContextDo(async (ctx) => {
        ctx.isSaving = true;
        await this.sourceDescriptorFor(ctx.selectedClass).changeSource(content);
      }, { content });
      await sourceEditor.saveExcursion(async () => {
        await this.refresh();
      });
      await this.withContextDo((ctx) => {
        ctx.updatePackageConfig(sourceChanged);
      }, { sourceChanged });
      return { success: true, warnings };
    } finally {
      // jump to the member the cursor is located at
      this.jumpToMethodAtCursorPosition();
      await this.withContextDo(ctx => ctx.isSaving = false);
      this.updateSource(content, selectedModuleId);
    }

    if (this.target instanceof ViewModel) {
      this.target.reifyBindings();
      this.target.reifyExposedProps();
    }
  }

  /*
   * Selects the member/method in the class panel depending on the current cursor position.
   * FIXME: This still does not work well and interferes with auto positioning of
   *        the cursor from the system and manual selection.
   */
  async jumpToMethodAtCursorPosition () {
    return;
    const { sourceEditor } = this.ui;
    const cursorIndex = sourceEditor.positionToIndex(sourceEditor.cursorPosition);
    const [methodNode, className] = await this.withContextDo((ctx) => {
      const { className } = ctx.selectedClass;
      return [ctx.getMethodAtCursorPos(className, {}, cursorIndex), className];
    }, { cursorIndex });
    this.selectMethod(className, methodNode.key.name, false);
  }

  /*
   * Backup a given source code string to the local storage to retrieve it later.
   * This is useful for securing code changes to object packages that may have been lost
   * after an accidental runtime crash.
   * @param { String } source - The soruce code (usually the class definition) to be backed up to local storage.
   */
  backupSourceInLocalStorage (source) {
    const store = JSON.parse(localStorage.getItem('oe helper') || '{"saves": []}');
    if (store.saves.some(ea => typeof ea === 'string' ? ea === source : ea.source === source)) return;
    if (store.saves.length > 100) store.saves = store.saves.slice(40, 100);
    store.saves.push({ source, time: Date.now() });
    localStorage.setItem('oe helper', JSON.stringify(store));
  }

  /*
   * Interactively create a fresh object package and default method for the current target.
   * This will prompt the user to enter a proper object package name in order to create one.
   * This is intended for experimental scripting local to a workspace that is not meant to
   * be collaborated with other programmers in the team. Object Packages can be used to brainstorm
   * and experiment with ideas in a sandbox before finalizing them and adding them to the repository source code.
   * NOTE: Lively for now lacks a sufficiently powerful mechanism for collaborating snapshot state. A possible future solution to this would be either a meaningful snapshot diff tool or a performant real time collaboration a la croquet.
   */
  async interactivelyAddObjectPackageAndMethod () {
    let objPkgName, className, methodName, stringifiedTarget;
    const li = LoadingIndicator.open('Lookup Package...');
    const requester = this.view.getWindow();
    try {
      ({ objPkgName, className, stringifiedTarget } = await this.withContextDo((ctx) => {
        // always get the package for the world, based on the name
        // const pkg = ObjectPackage.withId($world.metadata.commit.name);
        const pkg = ObjectPackage.lookupPackageForObject(ctx.target);
        return {
          objPkgName: pkg && pkg.id,
          className: getClassName(ctx.target),
          stringifiedTarget: ctx.target.toString()
        };
      }));

      if (!objPkgName) {
        li.remove();

        // check if the world has a custom object package, or if the world exists at all
        const worldPkgUrl = await this.withContextDo(() => {
          let pkg = ObjectPackage.lookupPackageForObject($world);
          if (pkg) return pkg.name;
        });

        if (worldPkgUrl) {
          className = await this.world().prompt(
            ['New Class\n', {},
              'Regarding the object:\n', { fontSize: 16, fontWeight: 'normal' },
              stringifiedTarget, { fontSize: 16, fontStyle: 'italic', fontWeight: 'normal' },
              '\nEnter a name for the new class of this object:', { fontSize: 16, fontWeight: 'normal' }], {
              historyId: 'object-package-name-hist',
              requester,
              width: 400,
              input: string.capitalize(className).replace(/\s+(.)/g, (_, match) => match.toUpperCase())
            });

          if (!className) { requester.setStatusMessage('Canceled'); return; }

          // also derive a proper module name from this className

          await this.withContextDo(async (ctx) => {
          // the adoption method of object packages are useless, we just create our
            const pkg = ObjectPackage.withId(worldPkgUrl); // this is the world package
            const modName = className[0].toLowerCase() + className.slice(1) + '.js';
            const mod = await pkg.ensureSubModule(modName);
            await mod.adoptObject(ctx.target, className);
          }, { className, worldPkgUrl });
        } else {
          objPkgName = await this.world().prompt(
            ['New Object Package\n', {},
              'No object package exists yet for object\n', { fontSize: 16, fontWeight: 'normal' },
              stringifiedTarget, { fontSize: 16, fontStyle: 'italic', fontWeight: 'normal' },
              '\nEnter a name for a new package:', { fontSize: 16, fontWeight: 'normal' }], {
              historyId: 'object-package-name-hist',
              requester,
              width: 400,
              input: string.capitalize(className).replace(/\s+(.)/g, (_, match) => match.toUpperCase())
            });

          if (!objPkgName) { requester.setStatusMessage('Canceled'); return; }

          li.label = 'Creating Class...';
          li.openInWorld();

          await this.withContextDo(async (ctx) => {
          // the adoption method of object packages are useless, we just create our
            const pkg = ObjectPackage.withId(objPkgName); // this is the world package

            await pkg.adoptObject(ctx.target);
          }, { objPkgName });
        }
      }
      li.label = 'Adding method...';
      ({ className, methodName } = await this.withContextDo(async ctx => {
        const { methodName } = await ctx.addNewMethod();
        return {
          methodName, className: ctx.target.constructor[Symbol.for('__LivelyClassName__')]
        };
      }));
      li.remove();
      await this.refresh();
      await this.selectMethod(className, methodName, true, true);
      this.ui.sourceEditor.focus();
    } catch (e) {
      li.remove();
      requester.showError(e);
    }
  }

  /*
   * Removes the selected entity selected in the class tree.
   * This can be either a property, method or class.
   */
  async interactivelyRemoveMethodOrClass () {
    const { selectedMethod, selectedClass } = await this.withContextDo(ctx => ({
      selectedMethod: Path('selectedMethod.name').get(ctx),
      selectedClass: Path('selectedClass.name').get(ctx)
    }));
    if (selectedMethod) return this.interactivelyRemoveMethod();
    if (selectedClass) return this.interactivelyAdoptBySuperclass();
  }

  /*
   * Adjust the current class of the selected target.
   */
  async interactivelyAdoptByClass () {
    const li = LoadingIndicator.open('fetching modules...');
    const items = await this.withContextDo(async (ctx) => {
      const { systemInterface: system } = ctx.evalEnvironment;
      const modules = await system.getModules();
      const { module } = await System.import('lively.modules');
      const items = [];
      for (const mod of modules) {
        // mod = modules[0]
        if (mod.name.endsWith('.md')) continue;
        const pkg = await system.getPackageForModule(mod.name);
        const shortName = pkg
          ? pkg.name + '/' + system.shortModuleName(mod.name, pkg)
          : mod.name;

        const realModule = module(mod.name);
        if (realModule.format() !== 'esm' && realModule.format() !== 'register') { continue; }

        const imports = (await realModule.imports()).map(ea => ea.local);
        const { Morph } = ctx.target.isMorph ? await System.import('lively.morphic') : {};
        const klassDefs = (await realModule.scope()).classDecls.map(klass => klass.id.name);
        const klasses = obj.values(realModule.recorder).filter(ea =>
          isClass(ea) && !imports.includes(ea.name) && klassDefs.includes(ea.name) &&
          (ctx.target.isMorph ? withSuperclasses(ea).includes(Morph) : true));

        for (const klass of klasses) {
          items.push({
            isListItem: true,
            string: `${shortName} ${klass.name}`,
            value: { moduleName: mod.name, className: klass.name }
          });
        }
      }
      return items;
    });

    li.remove();

    const { selected: [klassAndModule] } = await $world.filterableListPrompt(
      'From which class should the target object inherit?', items, { requester: this.view });

    if (!klassAndModule) return;

    await this.withContextDo((ctx) => {
      const { moduleName, className } = klassAndModule;
      const klass = modules.module(moduleName).recorder[className];
      adoptObject(ctx.target, klass);
    }, {
      klassAndModule
    });
    this.refresh();
    this.selectClass(klassAndModule.className);
  }

  /*
   * Change the class of the selected target to its superclass.
   * If the superclass is Object this routine has no effect.
   */
  async interactivelyAdoptBySuperclass () {
    const { nextClassName, className, targetName, moduleMeta, nextModuleMeta } = await this.withContextDo((ctx) => {
      const { target: t } = ctx;
      const klass = t.constructor;
      if (klass === Morph) return {}; // this is a weird exception but makes sense in general
      const nextClass = withSuperclasses(klass)[1];
      return {
        moduleMeta: klass[Symbol.for('lively-module-meta')],
        nextModuleMeta: nextClass[Symbol.for('lively-module-meta')],
        nextClassName: nextClass.name,
        className: klass.name,
        targetName: t.name
      };
    });
    const generateDoit = (meta, entity) => ({
      textDecoration: 'underline',
      doit: { code: `$world.execCommand("open browser", {moduleName: "${meta.package.name + '/' + meta.pathInPackage}", codeEntity: "${entity}"})` }
    });
    if (nextClassName) {
      const normalStyle = { fontWeight: 'normal', fontSize: 16 };
      const highlightStyle = { fontWeight: 'normal', fontStyle: 'italic', fontSize: 16 };
      const really = await this.world().confirm([
        'Class Hierarchy Change\n', {},
        'Do you really want to make ', normalStyle,
        `"${targetName}"`, highlightStyle,
        ' an instance of ', normalStyle,
        nextClassName, { ...highlightStyle, ...generateDoit(nextModuleMeta, nextClassName) },
        ' and remove class ', normalStyle,
        className, { ...highlightStyle, ...generateDoit(moduleMeta, className) },
        ' and its package ', normalStyle,
        moduleMeta.package.name, highlightStyle, ' ?', normalStyle],
      {
        requester: this.view, width: 500
      });
      if (!really) return;
      await this.withContextDo((ctx) => {
        adoptObject(ctx.target, withSuperclasses(ctx.target.constructor)[1]);
      });
      this.refresh();
      this.selectClass(nextClassName);
    }
  }

  /*
   * Remove the selected method or property on the class.
   */
  async interactivelyRemoveMethod () {
    if (await this.withContextDo(ctx => !ctx.selectedMethod)) return;
    const parsed = this.editorPlugin.parse().body[0];
    const { methodNode, selectedMethodName } = await this.withContextDo(async (ctx) => {
      const { selectedMethod, selectedClass } = ctx;
      return {
        selectedMethodName: selectedMethod.name,
        methodNode: await ctx._sourceDescriptor_of_class_findMethodNode(
          selectedClass, selectedMethod.name, selectedMethod.kind, selectedMethod.static, parsed)
      };
    }, { parsed });

    if (!selectedMethodName) return;

    if (!methodNode) {
      this.view.showError(`Cannot find AST node for method ${selectedMethodName}`);
      return;
    }

    const really = await this.world().confirm(
      `Really remove method ${selectedMethodName}?`);
    if (!really) return;

    const ed = this.ui.sourceEditor;
    const range = { start: ed.indexToPosition(methodNode.start), end: ed.indexToPosition(methodNode.end) };
    if (!ed.textInRange({ start: { column: 0, row: range.start.row }, end: range.start }).trim()) {
      range.start = ed.lineRange(range.start.row - 1).end;
    }
    ed.replace(range, '');

    await this.doSave();
  }

  /*
   * Given that the current class definition resides inside a local object package,
   * this routine will guide the user to fork the class definition and create a
   * new object package just to container the new class definition.
   * The selected target is then adopted by that new class.
   */
  async interactivelyForkPackage () {
    const forkedName = await this.world().prompt([
      'New Forked Package\n', {},
      'Please enter a name for the forked class and its package:', { fontSize: 16, fontWeight: 'normal' }], {
      requester: this.view,
      input: await this.withContextDo(ctx => ctx.target.constructor[Symbol.for('__LivelyClassName__')]) + 'Fork',
      historyId: 'lively.morphic-object-editor-fork-names',
      useLastInput: false
    });
    if (!forkedName) return;
    const newClassName = await this.withContextDo(async (ctx) => {
      await ctx.forkPackage(forkedName);
    }, { forkedName });
    await this.browse({ target: this.context.target, selectedClass: newClassName });
  }

  /*
   * Trigger the interactive fix of undeclared variables inside the module scope
   * the class is defined in.
   */
  async interactivlyFixUndeclaredVariables () {
    let moduleId, origSource, content;
    const { ui: { sourceEditor, importController } } = this;
    try {
      if (!await this.withContextDo(ctx => ctx.selectedClass && ctx.selectedClass.name)) {
        this.view.showError(new Error('No class selected'));
        return null;
      }

      content = sourceEditor.textString;
      ({ moduleId, origSource } = await this.withContextDo((ctx) => {
        const { selectedClass } = ctx;
        const descr = ctx.sourceDescriptorFor(selectedClass);
        const m = descr.module;
        const origSource = descr.moduleSource;

        ctx.isSaving = true;
        return { moduleId: m.id, origSource };
      }));

      return await interactivlyFixUndeclaredVariables(sourceEditor, {
        requester: sourceEditor,
        sourceUpdater: async (type, arg) => {
          await this.withContextDo(async (ctx) => {
            const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
            const m = descr.module;
            if (type === 'import') await m.addImports(arg);
            else if (type === 'global') await m.addGlobalDeclaration(arg);
            else throw new Error(`Cannot handle fixUndeclaredVar type ${type}`);
            descr.resetIfChanged();
          }, { type, arg });
          await importController.updateImports();
          await this.updateKnownGlobals();
        },
        sourceRetriever: async () => this.withContextDo((ctx) => {
          const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
          return descr._modifiedSource(content).moduleSource;
        }, {
          content: sourceEditor.textString
        }),
        highlightUndeclared: async undeclaredVar => {
          // start,end index into module source, compensate
          let { start: varStart, end: varEnd } = undeclaredVar;
          const { classStart, classEnd } = await this.withContextDo((ctx) => {
            const descr = ctx.sourceDescriptorFor(ctx.selectedClass);
            const { sourceLocation: { start: classStart, end: classEnd } } = descr;
            return { classStart, classEnd };
          });
          if (varStart < classStart || varEnd > classEnd) return;
          varStart -= classStart;
          varEnd -= classStart;
          const range = {
            start: sourceEditor.indexToPosition(varStart),
            end: sourceEditor.indexToPosition(varEnd)
          };
          sourceEditor.selection = range;
          sourceEditor.centerRange(range);
        }
      });
    } catch (e) {
      await this.withContextDo(async () =>
        origSource && await modules.module(moduleId).changeSource(origSource), {
        moduleId, origSource
      });
      this.view.showError(e);
      return null;
    } finally {
      await this.withContextDo(ctx => ctx.isSaving = false);
      await importController.updateImports();
      await this.updateKnownGlobals();
      sourceEditor.focus();
    }
  }

  async interactivelyRunSelectedMethod (opts = {}) {
    const { statusMessage } = await this.withContextDo(async (ctx) => {
      const selectedMethod = ctx.selectedMethod;

      if (!selectedMethod) {
        return { statusMessage: 'no message selected' };
      }

      if (typeof ctx.target[selectedMethod.name] !== 'function') {
        return { statusMessage: `${selectedMethod.name} is not a method of ${this.target}` };
      }

      try {
        const result = await ctx.target[selectedMethod.name]();
        let msg = `Running ${selectedMethod.name}`;
        if (typeof result !== 'undefined') msg += `, returns ${result}`;
        return { statusMessage: msg };
      } catch (e) {
        return { statusMessage: e.toString() };
      }
    });
    if (statusMessage && !opts.silent) this.view.setStatusMessage(statusMessage);
  }
}

export class ImportControllerModel extends ViewModel {
  static get properties () {
    return {
      editor: { get () { return this.view.owner.viewModel; } },
      systemInterface: {
        get () {
          return this.editor && this.editor.systemInterface;
        }
      },
      module: {
        set (moduleOrId) {
          const id = !moduleOrId ? null : typeof moduleOrId === 'string' ? moduleOrId : moduleOrId.id;
          this.setProperty('module', id);
        }
      },
      expose: {
        get () {
          return ['commands', 'keybindings', 'setModule', 'updateImports', 'doNewNPMSearch', 'getExpandedWidth'];
        }
      },
      bindings: {
        get () {
          return [
            { model: 'open button', signal: 'fire', handler: 'openModuleInBrowser' },
            { model: 'add import button', signal: 'fire', handler: 'interactivelyAddImport' },
            { model: 'remove import button', signal: 'fire', handler: 'interactivelyRemoveImport' },
            { model: 'cleanup button', signal: 'fire', handler: 'interactivelyRemoveUnusedImports' }
          ];
        }
      }
    };
  }

  getExpandedWidth () {
    return Math.min(400, Math.max(300, this.ui.importsList.listItemContainer.width));
  }

  openModuleInBrowser () {
    this.view.execCommand('open selected module in system browser');
  }

  async setModule (moduleId) {
    this.module = moduleId;
    await this.updateImports();
  }

  async doNewNPMSearch (query) {
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
    // text	String	Query	❌	full-text search to apply
    // size	integer	Query	❌	how many results should be returned (default 20, max 250)
    // from	integer	Query	❌	offset to return results from
    // quality	float	Query	❌	how much of an effect should quality have on search results
    // popularity	float	Query	❌	how much of an effect should popularity have on search results
    // maintenance	float	Query	❌	how much of an effect should maintenance have on search results

    // let fields = ['name','description','keywords','author','modified','homepage','version','license','rating', "readme"]
    const i = LoadingIndicator.open('fetching information...');
    i.center = this.view.owner.globalBounds().center();
    const url = `https://registry.npmjs.com/-/v1/search?text=${query}&size=50`;
    const found = await resource(url).makeProxied().readJson();
    i.remove();
    return found.objects.map(p => {
      const { package: { name, version } } = p;
      return {
        isListItem: true,
        string: `${name}@${version}`,
        value: p
      };
    });
  }

  async updateImports () {
    // this needs to be done within the context, since there
    // currently is no remote tracking of module objects
    const { importsList } = this.ui;
    const items = await this.editor.withContextDo(async (ctx) => {
      const module = await ctx.selectedModule;
      if (!module) {
        return [];
      }

      const imports = await module.imports();
      const items = imports.map(ea => {
        const label = [];
        const alias = ea.local !== ea.imported && ea.imported !== 'default' ? ea.local : null;
        if (alias) label.push(`${ea.imported} as `, {});
        const importName = alias || ea.local || '??????';
        label.push(importName, { fontWeight: 'bold' });
        label.push(` from ${string.truncate(ea.fromModule, 25, '...')}`, { opacity: 0.5 });
        const tooltip = label.slice();
        tooltip[2] = ` from ${ea.fromModule}`;
        tooltip[3] = {};
        return {
          isListItem: true,
          value: ea,
          label,
          tooltip,
          annotation: ea.fromModule.includes('jspm.dev') ? Icon.textAttribute('npm', { fontSize: 18, fontWeight: '400', textStyleClasses: ['fab'] }) : []
        };
      });
      return items;
    });

    importsList.items = [];
    importsList.items = items;
  }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'open selected module in system browser' }
    ];
  }

  get commands () {
    return [{
      name: 'open selected module in system browser',
      exec: async importController => {
        const requester = this.view.getWindow();
        const importSpec = this.ui.importsList.selection;
        if (!importSpec) {
          requester.setStatusMessage('no module selected');
          return null;
        }
        let { fromModule, local } = importSpec || {};
        if (fromModule.startsWith('.')) { fromModule = System.decanonicalize(fromModule, this.module); }
        return this.world().execCommand('open browser',
          { moduleName: fromModule, codeEntity: local });
      }
    }];
  }

  async refreshInterface () {
    await this.updateImports();
    await this.editor.updateKnownGlobals();
    this.editor.ui.sourceEditor.focus();
  }

  /*
   * Interactively add a new import from either one of:
   * 1.) A different module inside the system.
   * 2.) A module from JSPM.
   * 3.) A module residing at a custom URL.
   */
  async interactivelyAddImport () {
    let origSource;
    const {
      editor
    } = this;

    const requester = this.view.getWindow();

    try {
      if (await editor.withContextDo(ctx => !ctx.selectedClass)) {
        requester.showError(new Error('No class selected'));
        return;
      }

      let importStyle = await this.world().multipleChoicePrompt(
        'Select import style:', {
          requester,
          width: 400,
          choices: new Map([
            ['An already loaded module (via exports)', 'system'],
            ['A NPM Module via jspm.dev', 'jspm'],
            ['A custom module (via free text)', 'free text']
          ])
        });

      if (importStyle === undefined) return;

      let importStmt = 'import ... from "module";';

      if (importStyle === 'jspm') {
        let jspmModule = await this.world().filterableListPrompt('Browse NPM', [], {
          requester,
          onFilter: fun.debounce(500, async (param) => {
            const list = param.target.owner; // gets a MethodCallChange as parameter
            if (list._lastTerm === list.input) return;
            list._lastTerm = list.input;
            list.items = await this.doNewNPMSearch(list.input);
          }),
          fuzzy: true
        });
        if (jspmModule.status !== 'accepted') return;
        [jspmModule] = jspmModule.selected;
        const { version, name } = jspmModule.package;
        // fixme: use custom esm://cache mechanism per default here?
        importStmt = `import ... from "https://jspm.dev/${name}@${version}";`;
        importStyle = 'free text'; // transition to free text mode
      }

      if (importStyle === 'free text') {
        while (true) {
          importStmt = await this.world().editPrompt('Enter import statement:', {
            requester,
            input: importStmt,
            mode: 'js'
          });
          if (!importStmt) return;
          try {
            parse(importStmt);
          } catch (e) {
            requester.setStatusMessage(e.message);
            continue;
          }
          break;
        }

        // prepend this import statement to the module
        origSource = await editor.withContextDo(async (ctx) => {
          const origSource = await ctx.selectedModule.source();
          ctx.isSaving = true;
          await ctx.selectedModule.changeSource(importStmt + '\n' + origSource);
          return origSource;
        }, { importStmt });
      }
      if (importStyle === 'system') {
        const system = await editor.editorPlugin.systemInterface();
        const choices = await interactivelyChooseImports(system, { requester });
        if (!choices) return null;

        // FIXME move this into system interface!
        origSource = await editor.withContextDo(async (ctx) => {
          const origSource = await ctx.selectedModule.source();
          ctx.isSaving = true;
          await ctx.selectedModule.addImports(choices);
          return origSource;
        }, {
          choices
        });

        const insertions = choices.map(({ local, exported }) =>
          exported === 'default' ? local : exported).join('\n');

        const { sourceEditor } = editor.ui; // demeters law violation...
        sourceEditor.insertTextAndSelect(insertions, sourceEditor.cursorPosition);
      }
    } catch (e) {
      await editor.withContextDo(async (ctx) =>
        origSource && await ctx.selectedModule.changeSource(origSource), {
        origSource
      });
      requester.showError(e);
    } finally {
      await this.updateImports();
      await editor.updateKnownGlobals();
      await editor.withContextDo(async (ctx) => {
        ctx.isSaving = false;
      });
      // sourceEditor.focus();
    }
  }

  /*
   * Remove the import that is selected in the import controller.
   */
  async interactivelyRemoveImport () {
    const { importsList } = this.ui;
    const requester = this.view.getWindow();
    const sels = importsList.selections;
    if (!sels || !sels.length) return;
    const really = await this.world().confirm([
      'Really remove these imports?\n', {},
      arr.pluck(sels, 'local').join('\n'), { fontWeight: 'normal', fontSize: 16 }],
    { requester });
    if (!really) return;
    const error = await this.editor.withContextDo(async (ctx) => {
      let m, origSource;
      try {
        m = ctx.selectedModule;
        origSource = await m.source();
        await m.removeImports(sels);
        return false;
      } catch (e) {
        origSource && await m.changeSource(origSource);
        return e;
      }
    }, { sels });
    importsList.selection = null;
    if (error) requester.showError(error);
    this.refreshInterface();
  }

  /*
   * Remove any unused imports in the module scope.
   */
  async interactivelyRemoveUnusedImports () {
    try {
      const requester = this.view.getWindow();
      const origSource = await this.editor.withContextDo(async ctx => {
        return await ctx.selectedModule.source();
      });
      const toRemove = await chooseUnusedImports(origSource, { requester });

      if (!toRemove || !toRemove.changes || !toRemove.changes.length) {
        requester.setStatusMessage('Nothing to remove');
        return;
      }

      await this.editor.withContextDo((ctx) => {
        ctx.selectedModule.removeImports(toRemove.removedImports);
      }, { toRemove });
      requester.setStatusMessage('Imports removed');
    } catch (e) {
      origSource && await this.editor.withContextDo(ctx =>
        ctx.selectedModule.changeSource(origSource), {
        origSource
      });
      requester.setStatusMessage(e.toString());
      return;
    }
    await this.updateImports();
    await this.editor.updateKnownGlobals();
    this.editor.ui.sourceEditor.focus();
  }
}

export class ImportController extends Morph {
  static get properties () {
    return {
      extent: { defaultValue: pt(300, 600) },
      systemInterface: {
        get () {
          return this.owner.systemInterface;
        }
      },
      module: {
        set (moduleOrId) {
          const id = !moduleOrId ? null : typeof moduleOrId === 'string' ? moduleOrId : moduleOrId.id;
          this.setProperty('module', id);
        }
      }
    };
  }

  constructor (props) {
    super(props);
    this.build();
    connect(this.get('openButton'), 'fire', this, 'execCommand', { converter: () => 'open selected module in system browser' });
  }

  async setModule (moduleId) {
    this.module = moduleId;
    await this.updateImports();
  }

  build () {
    const listStyle = {
      borderWidthTop: 1,
      borderWidthBottom: 1,
      borderColor: Color.gray,
      fontSize: 14,
      fontFamily: 'IBM Plex Sans',
      type: 'list'
    };

    const btnStyle = {
      type: 'button',
      extent: pt(26, 24)
    };

    this.submorphs = [
      { ...listStyle, name: 'importsList', multiSelect: true, borderBottom: { width: 1, color: Color.gray } },
      {
        name: 'buttons',
        fill: Color.transparent,
        layout: new HorizontalLayout({ direction: 'centered', spacing: 2, autoResize: false }),
        submorphs: [
          { ...btnStyle, name: 'addImportButton', label: Icon.makeLabel('plus'), tooltip: 'add new import' },
          { ...btnStyle, name: 'removeImportButton', label: Icon.makeLabel('minus'), tooltip: 'remove selected import(s)' },
          { ...btnStyle, name: 'cleanupButton', label: 'cleanup', tooltip: 'remove unused imports' },
          { ...btnStyle, name: 'openButton', label: 'open', tooltip: 'open selected module' }
        ]
      }
    ];

    this.layout = new GridLayout({
      renderViaCSS: true,
      grid: [
        ['importsList'],
        ['buttons']
      ]
    });
    this.layout.row(1).fixed = 30;
    this.layout.row(1).col(0).group.resize = false;
    this.layout.row(1).col(0).group.align = 'center';
    this.layout.row(1).col(0).group.alignedProperty = 'center';
    this.applyLayoutIfNeeded();

    // FIXME
    [this.get('openButton'),
      this.get('cleanupButton'),
      this.get('removeImportButton'),
      this.get('addImportButton')].forEach(btn => btn.extent = btnStyle.extent);
  }

  async doNewNPMSearch (query) {
    // https://github.com/npm/registry/blob/master/docs/REGISTRY-API.md#get-v1search
    // text	String	Query	❌	full-text search to apply
    // size	integer	Query	❌	how many results should be returned (default 20, max 250)
    // from	integer	Query	❌	offset to return results from
    // quality	float	Query	❌	how much of an effect should quality have on search results
    // popularity	float	Query	❌	how much of an effect should popularity have on search results
    // maintenance	float	Query	❌	how much of an effect should maintenance have on search results

    // let fields = ['name','description','keywords','author','modified','homepage','version','license','rating', "readme"]
    const i = LoadingIndicator.open('fetching information...');
    i.center = this.owner.globalBounds().center();
    const url = `https://registry.npmjs.com/-/v1/search?text=${query}&size=50`;
    const found = await resource(url).makeProxied().readJson();
    i.remove();
    return found.objects.map(p => {
      const { package: { name, version } } = p;
      return {
        isListItem: true,
        string: `${name}@${version}`,
        value: p
      };
    });
  }

  async updateImports () {
    // this needs to be done within the context, since there
    // currently is no remote tracking of module objects
    const items = await this.owner.withContextDo(async (ctx) => {
      const module = await ctx.selectedModule;
      if (!module) {
        return [];
      }

      const imports = await module.imports();
      const items = imports.map(ea => {
        const label = [];
        const alias = ea.local !== ea.imported && ea.imported !== 'default' ? ea.local : null;
        if (alias) label.push(`${ea.imported} as `, {});
        const importName = alias || ea.local || '??????';
        label.push(importName, { fontWeight: 'bold' });
        label.push(` from ${string.truncate(ea.fromModule, 25, '...')}`, { opacity: 0.5 });
        const tooltip = label.slice();
        tooltip[2] = ` from ${ea.fromModule}`;
        tooltip[3] = {};
        return {
          isListItem: true,
          value: ea,
          label,
          tooltip,
          annotation: ea.fromModule.includes('jspm.dev') ? Icon.textAttribute('npm', { fontSize: 18, fontWeight: '400', textStyleClasses: ['fab'] }) : []
        };
      });
      return items;
    });

    this.getSubmorphNamed('importsList').items = [];
    this.getSubmorphNamed('importsList').items = items;
  }

  get keybindings () {
    return [
      { keys: 'Enter', command: 'open selected module in system browser' }
    ].concat(super.keybindings);
  }

  get commands () {
    return [{
      name: 'open selected module in system browser',
      exec: async importController => {
        const importSpec = this.getSubmorphNamed('importsList').selection;
        if (!importSpec) {
          this.setStatusMessage('no module selected');
          return null;
        }
        let { fromModule, local } = importSpec || {};
        if (fromModule.startsWith('.')) { fromModule = System.decanonicalize(fromModule, this.module); }
        return this.world().execCommand('open browser',
          { moduleName: fromModule, codeEntity: local });
      }
    }];
  }
}
