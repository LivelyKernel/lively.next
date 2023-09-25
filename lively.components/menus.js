import { Label, config, Morph } from 'lively.morphic';
import { obj, promise, fun } from 'lively.lang';
import { pt, Color, Rectangle } from 'lively.graphics';
import { Icon } from '../lively.morphic/text/icons';

export class MenuDivider extends Morph {
  static get properties () {
    return {
      isMenuDevider: { defaultValue: true },
      fill: { defaultValue: Color.gray.lighter() },
      extent: { defaultValue: pt(100, 5) },
      reactsToPointer: { defaultValue: false }
    };
  }
}

export class MenuItem extends Label {
  static get properties () {
    return {
      acceptsDrops: { defaultValue: false },
      fixedWidth: { defaultValue: false },
      fixedHeight: { defaultValue: false },
      fill: { defaultValue: Color.transparent },
      fontSize: { defaultValue: 14 },
      draggable: { defaultValue: false },
      readOnly: { defaultValue: true },
      nativeCursor: { defaultValue: 'pointer' },
      lineHeight: { defaultValue: 1.4 },
      selected: {
        defaultValue: false,
        set (value) {
          if (this.selected === value) return;
          this.addValueChange('selected', value);
          if (value) {
            this.fontColor = Color.white;
            this.fill = Color.rgb(21, 101, 192);
          } else {
            this.fill = Color.transparent;
            this.fontColor = Color.black;
          }
        }
      },
      isMenuItem: {
        derived: true,
        readOnly: true,
        get () {
          return true;
        }
      },
      label: {
        derived: true,
        after: ['borderWidth'],
        get () {
          const { value } = this.valueAndAnnotation;
          const label = value.map((string, i) => (i % 2 === 0 ? string : '')).join('\n');
          return label;
        },
        set (value) {
          this.valueAndAnnotation = { value, annotation: this.annotation };
        }
      },
      annotation: {
        derived: true,
        after: ['borderWidth'],
        get () {
          return this.valueAndAnnotation.annotation;
        },
        set (annotation) {
          this.valueAndAnnotation = { value: this.value, annotation };
        }
      },
      action: {},
      submenu: {}
    };
  }

  onHoverIn (evt) {
    this.owner.itemMorphs.forEach(ea => ea !== this && (ea.selected = false));
    this.selected = true;
    if (this.submenu) { this.owner.openSubMenuDelayed(evt, this, this.submenu); }
  }

  onHoverOut (evt) {
    const { hand } = evt;
    setTimeout(() => {
      // only deselect if hand is not over a submenu
      const submenus = this.owner ? this.owner.submenus : [];
      if (!submenus.some(ea => ea.fullContainsWorldPoint(hand.globalPosition))) { this.selected = false; }
    }, 20);
    this.owner.maybeRemoveSubmenu();
  }

  async onMouseDown (evt) {
    if (this.submenu) return;
    try {
      this.owner.startFinish();
      if (typeof this.action !== 'function') { throw new Error(`Menu item ${this.textString} has no executable action!`); }
      await this.action();
      this.owner.completeFinish();
    } catch (err) {
      const w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }
}

const invalidItem = { string: 'invalid item', action: () => $world.setStatusMessage('invalid item') };

export class Menu extends Morph {
  static forItems (items, opts = { title: '' }) {
    return new this({ ...opts, items });
  }

  static openAt (pos, items, opts = { title: '' }) {
    const menu = this.forItems(items, opts).openInWorldNear(pos);
    menu.offsetForWorld(pos);
    return menu;
  }

  static openAtHand (items, opts = { title: '' }) {
    const hand = opts.hand;
    const menu = this.forItems(items, obj.dissoc(opts, ['hand']));
    let pos = hand ? hand.position : pt(0, 0);
    if (menu.titleMorph) pos = pos.addXY(0, -menu.titleMorph.height);
    menu.openInWorld(pos);
    menu.offsetForWorld(pos);
    return menu;
  }

  static get properties () {
    return {
      dropShadow: {
        initialize () {
          if (config.fastShadows || !this.ownerMenu) {
            this.dropShadow = true;
            this.dropShadow.fast = false;
          }
        }
      },
      submorphs: {
        initialize () {
          this.updateMorphs();
        }
      },
      epiMorph: { defaultValue: true },
      acceptsDrops: { defaultValue: false },
      hasFixedPosition: { defaultValue: true },
      padding: { defaultValue: Rectangle.inset(0, 2) },
      itemPadding: { defaultValue: Rectangle.inset(8, 4) },
      borderWidth: { defaultValue: 1 },
      fill: { defaultValue: Color.white },
      borderColor: { defaultValue: Color.gray.lighter() },
      borderRadius: { defaultValue: 4 },
      opacity: { defaultValue: 0.95 },
      fontSize: { defaultValue: 16 },
      title: {
        get () {
          return this.getProperty('title');
        },
        set (value) {
          this.addValueChange('title', value);
        }
      },
      finishedPromise: {
        initialize () {
          this.finishedPromise = promise.deferred();
        }
      },
      ownerMenu: {},
      submenu: {},
      styleClasses: {
        defaultValue: ['Halo']
      },
      submenus: {
        readOnly: true,
        get () {
          return this.submenu ? [this.submenu].concat(this.submenu.submenus) : [];
        }
      },
      ownerItemMorph: {},
      removeOnMouseOut: {},
      items: {
        set (items) {
          items = items.map(this.ensureItem.bind(this)).filter(Boolean);
          this.setProperty('items', items);
        }
      },
      selectedItemMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.itemMorphs.find(ea => ea.selected);
        }
      },
      titleMorph: {
        derived: true,
        readOnly: true,
        get () {
          return this.getSubmorphNamed('title');
        }
      },
      itemMorphs: {
        derived: true,
        readOnly: true,
        get () {
          return this.submorphs.filter(ea => ea.isMenuItem);
        }
      }
    };
  }

  get isMenu () {
    return true;
  }

  startFinish () {
    if (this.ownerMenu) this.ownerMenu.startFinish();
    this._waitingForFinish = true;
  }

  completeFinish () {
    if (this.ownerMenu) this.ownerMenu.completeFinish();
    this.finishedPromise.resolve(true);
  }

  whenFinished () {
    return this.finishedPromise.promise;
  }

  onChange (change) {
    const { prop, selector } = change;
    switch (prop) {
      case 'itemPadding':
      case 'fontSize':
      case 'fontFamily': this.updateMorphs(); break;
    }
    super.onChange(change);
  }

  close () {
    this.remove();
  }

  async remove () {
    await this.animate({ opacity: 0, duration: 300 });
    if (!this._waitingForFinish) this.completeFinish();
    super.remove();
  }

  ensureItem (item) {
    if (!item) return invalidItem;

    if (item.title) { this.title = item.title; return null; }

    if (item.isDivider) return item;

    if (item.hasOwnProperty('string') && item.hasOwnProperty('action')) {
      return obj.select(item, ['string', 'action', 'annotation']);
    }

    if (Array.isArray(item)) {
      const [name, actionOrList] = item;

      if (typeof name !== 'string' && !Array.isArray(name)/* rich text */) return invalidItem;

      if (!actionOrList || typeof actionOrList === 'function') {
        return {
          label: name,
          action: actionOrList || (() => $world.setStatusMessage(name))
        };
      }

      if (typeof actionOrList === 'object' && actionOrList.getItems) {
        return {
          label: name,
          submenu: actionOrList.getItems,
          annotation: Icon.textAttribute('caret-right')
        };
      }

      if (Array.isArray(actionOrList)) {
        return {
          label: name,
          submenu: actionOrList,
          annotation: Icon.textAttribute('caret-right')
        };
      }

      return invalidItem;
    }

    if (item.command) {
      let { command, showKeyShortcuts, target, alias, args, tooltip } = item;
      if (!command || !target) return invalidItem;
      if (showKeyShortcuts === undefined) showKeyShortcuts = true;
      const keys = !showKeyShortcuts
        ? null
        : typeof showKeyShortcuts === 'string'
          ? showKeyShortcuts
          : target.keysForCommand(command);
      const label = alias || command;
      const annotation = keys ? [`\t${keys}`, { fontSize: '70%' }] : ['', {}];
      return { tooltip, string: label, annotation, action: () => target.execCommand(command, args) };
    }

    return invalidItem;
  }

  async updateMorphs () {
    await fun.guardNamed('updateMorphs' + this.id, async () => {
      this.submorphs = [];

      const pLeft = this.padding.left();
      const pRight = this.padding.right();
      const pTop = this.padding.top();
      const pBottom = this.padding.bottom();
      let maxWidth = 0; let pos = pt(pLeft, pTop);

      const defaultStyle = {};
      if (this.fontFamily) defaultStyle.fontFamily = this.fontFamily;
      if (this.fontSize) defaultStyle.fontSize = this.fontSize;
      if (this.itemPadding) defaultStyle.padding = this.itemPadding;

      if (this.title) {
        const title = this.addMorph({
          type: 'label',
          value: this.title,
          name: 'title',
          position: pos,
          fontWeight: 'bold',
          ...defaultStyle
        });
        await title.whenFontLoaded();
        if (title.fit) title.fit();
        pos = title.bottomLeft;
        maxWidth = Math.max(title.width, maxWidth);
      }

      for (let { label, string, annotation, action, submenu, isDivider, tooltip } of this.items) {
        const itemMorph = this.addMorph(
          isDivider
            ? new MenuDivider({ position: pos })
            : new MenuItem({
              label: label || string,
              annotation,
              action,
              submenu,
              tooltip,
              position: pos,
              ...defaultStyle
            }));
        if (itemMorph.fit) {
          await itemMorph.whenFontLoaded();
          itemMorph.fit();
        }
        pos = itemMorph.bottomLeft;
        maxWidth = Math.max(itemMorph.width, maxWidth);
      }

      this.submorphs.forEach(ea => {
        ea.fixedWidth = true;
        ea.width = maxWidth;
        if (ea.fit) ea.fit();
      });

      this.extent = pt(maxWidth + pRight + pLeft, pos.y + pBottom);
    })();
  }

  openSubMenuDelayed (evt, itemMorph, items) {
    // only open a new submenu after a certain delay to reduce the
    // impression of "flickering" menus and to be less annoying when trying to
    // move over a menu and leaving the bounds of the item morph that opened it
    this.openingSubMenuProcess && clearTimeout(this.openingSubMenuProcess);
    this.openingSubMenuProcess = setTimeout(() => {
      try {
        this.openSubMenu(evt, itemMorph, items);
      } catch (err) { const w = this.world(); w ? w.logError(err) : console.error(err); }
    }, 200);
  }

  openSubMenu (evt, itemMorph, items) {
    if (!itemMorph.selected) return;
    const existingSubMenu = this.submenu;

    if (existingSubMenu) {
      if (existingSubMenu.ownerItemMorph === itemMorph) return;
      if (this.morphsContainingPoint(evt.position).includes(existingSubMenu)) return;
      this.removeSubMenu();
    }

    if (typeof items === 'function') items = items();

    const m = this.submenu = this.addMorph(new Menu({ items, ownerItemMorph: itemMorph, ownerMenu: this }));
    m.updateMorphs();
    m.offsetForOwnerMenu();
  }

  maybeRemoveSubmenu () {
    fun.debounceNamed(this.id + '-maybeRemoveSubmenu', 300, () => {
      const w = this.world();
      if (!w) return;
      const { submenu, selectedItemMorph } = this;
      const handOverSubmenu = w && submenu && submenu.fullContainsWorldPoint(w.firstHand.position);

      if (submenu && submenu.ownerItemMorph !== selectedItemMorph &&
       !submenu.ownerItemMorph.selected) {
        // this logic is to ensure that if this is an owner menu and the selected
        // item morph that generated a submenu has changed but the user is
        // still hovering over the submenu then the item morph will be
        // re-selected
        // (deselecting my item morph can happen when quickly swooping over menus)
        if (handOverSubmenu) {
          selectedItemMorph && (selectedItemMorph.selected = false);
          submenu.ownerItemMorph.selected = true;
        } else this.removeSubMenu();
      }
    })();

    return this.removeOnMouseOut;
  }

  removeSubMenu () {
    if (!this.submenu) return;
    const m = this.submenu;
    m.ownerMenu = null;
    this.submenu = null;
    m.remove();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  moveBoundsForVisibility (menuBounds, visibleBounds) {
    let offsetX = 0; let offsetY = 0;

    if (menuBounds.right() > visibleBounds.right()) { offsetX = -1 * (menuBounds.right() - visibleBounds.right()); }

    const overlapLeft = menuBounds.left() + offsetX;
    if (overlapLeft < 0) offsetX += -overlapLeft;

    if (menuBounds.bottom() > visibleBounds.bottom()) {
      offsetY = -1 * (menuBounds.bottom() - visibleBounds.bottom());
      // so that hand is not directly over menu, does not work when
      // menu is in the bottom right corner
      offsetX += 1;
    }

    const overlapTop = menuBounds.top() + offsetY;
    if (overlapTop < 0) offsetY += -overlapTop;

    return menuBounds.translatedBy(pt(offsetX, offsetY));
  }

  moveSubMenuBoundsForVisibility (subMenuBnds, mainMenuItemBnds, visibleBounds, direction) {
    // subMenuBnds is bounds to  be transformed, mainMenuItemBnds is the bounds of the menu
    // item that caused the submenu to appear, visbleBounds is the bounds that the submenu
    // should fit into, when there are multiple submenus force one direction with forceDirection
    if (!direction) {
      direction = mainMenuItemBnds.right() + subMenuBnds.width > visibleBounds.right()
        ? 'left'
        : 'right';
    }

    const extent = subMenuBnds.extent();
    if (direction === 'left') {
      subMenuBnds = mainMenuItemBnds.topLeft().addXY(-extent.x, 0).extent(extent);
    } else {
      subMenuBnds = mainMenuItemBnds.topRight().extent(extent);
    }

    if (subMenuBnds.bottom() > visibleBounds.bottom()) {
      const deltaY = -1 * (subMenuBnds.bottom() - visibleBounds.bottom());
      subMenuBnds = subMenuBnds.translatedBy(pt(0, deltaY));
    }

    // if it overlaps at the top move the bounds so that it aligns woitht he top
    if (subMenuBnds.top() < visibleBounds.top()) {
      const deltaY = visibleBounds.top() - subMenuBnds.top();
      subMenuBnds = subMenuBnds.translatedBy(pt(0, deltaY));
    }

    return subMenuBnds;
  }

  offsetForOwnerMenu () {
    const owner = this.ownerMenu;
    const visibleBounds = this.world().visibleBounds();
    const localVisibleBounds = owner.getGlobalTransform().inverse().transformRectToRect(visibleBounds);
    const newBounds = this.clipForVisibility(
      this.moveSubMenuBoundsForVisibility(
        this.innerBounds(),
        owner.selectedItemMorph ? owner.selectedItemMorph.bounds() : owner.innerBounds(),
        localVisibleBounds), visibleBounds);
    this.setBounds(newBounds);
  }

  clipForVisibility (bounds = this.bounds(), worldBounds = this.world().visibleBounds()) {
    const globalBounds = this.transformRectToMorph(this.world(), bounds.withX(0).withY(0));
    const overlapping = !worldBounds.containsRect(globalBounds.insetBy(10));

    // FIXME!
    const scrollbarWidth = 0; // 15 ?? this requires a change of submenu rendering,
    // since those need to be rendered outside of parent menu

    if (overlapping) {
      bounds = bounds.withExtent(pt(scrollbarWidth + 5 + bounds.width, Math.min(globalBounds.height, worldBounds.height)));
      // this.clipMode = "auto"
    }
    return bounds;
  }

  offsetForWorld (pos) {
    let bounds = this.innerBounds().translatedBy(pos);
    if (this.owner.visibleBounds) {
      const worldBounds = this.owner.visibleBounds();
      // bounds = this.moveBoundsForVisibility(bounds, worldBounds);
      bounds = this.clipForVisibility(
        this.moveBoundsForVisibility(bounds, worldBounds),
        worldBounds);
    }
    this.setBounds(bounds);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onHoverOut () {
    if (this.removeOnMouseOut) this.remove();
  }
}
