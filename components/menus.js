import { Label, Morph, show } from "lively.morphic";
import { arr, obj, promise, fun } from "lively.lang";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

export class MenuDivider extends Morph {

  static get properties() {
    return {
      isMenuDevider: {defaultValue: true},
      fill: {defaultValue: Color.gray.lighter()},
      extent: {defaultValue: pt(100, 5)},
      reactsToPointer: {defaultValue: false}
    }
  }
  
}

export class MenuItem extends Label {

  static get properties() {
    return {
      fixedWidth: {defaultValue: false},
      fixedHeight: {defaultValue: false},
      fill: {defaultValue: Color.transparent},
      fontSize: {defaultValue: 14},
      draggable: {defaultValue: false},
      readOnly: {defaultValue: true},
      nativeCursor: {defaultValue: "pointer"},
      selected: {
        defaultValue: false,
        set(value) {
          if (this.selected === value) return;
          this.addValueChange("selected", value);
          if (value) {
            this.fontColor = Color.white;
            this.fill = Color.blue;
          } else {
            this.fill = Color.transparent;
            this.fontColor = Color.black;
          }
        }
      },
      isMenuItem: {
        derived: true,
        readOnly: true,
        get() {
          return true;
        }
      },
      label: {
        get() {
          var {value} = this.valueAndAnnotation,
              label = value.map(([string], i) => (i % 2 === 0 ? string : "")).join("\n");
          return label;
        },
        set(value) {
          this.valueAndAnnotation = {value, annotation: this.annotation};
        }
      },
      annotation: {
        get() {
          return this.valueAndAnnotation.annotation;
        },
        set(annotation) {
          this.valueAndAnnotation = {value: this.value, annotation};
        }
      },
      action: {},
      submenu: {}
    };
  }

  onHoverIn(evt) {
    this.owner.itemMorphs.forEach(ea => ea !== this && (ea.selected = false));
    this.selected = true;
    if (this.submenu)
      this.owner.openSubMenuDelayed(evt, this, this.submenu)
  }

  onHoverOut(evt) {
    var {hand} = evt;
    setTimeout(() => {
      // only deselect if hand is not over a submenu
      var submenus = this.owner ? this.owner.submenus : [];
      if (!submenus.some(ea => ea.fullContainsWorldPoint(hand.position)))
        this.selected = false;
    }, 20);
    this.owner.maybeRemoveSubmenu();
  }

  onMouseDown(evt) {
    if (this.submenu) return;
    try {
      if (typeof this.action !== "function")
        throw new Error(`Menu item ${this.textString} has no executable action!`)
      this.action();
    } catch (err) {
      var w = this.world();
      if (w) w.logError(err);
      else console.error(err);
    }
  }

}

var invalidItem = {string: "invalid item", action: () => show("invalid item")};

export class Menu extends Morph {

  static forItems(items, opts = {title: ""}) {
    return new this({...opts, items});
  }

  static openAt(pos, items, opts = {title: ""}) {
    var menu = this.forItems(items, opts).openInWorldNear(pos);
    menu.offsetForWorld(pos);
    return menu;
  }

  static openAtHand(items, opts = {title: ""}) {
    var hand = opts.hand,
        menu = this.forItems(items, obj.dissoc(opts, ["hand"])),
        pos = hand ? hand.position : pt(0,0);
    if (menu.titleMorph) pos = pos.addXY(0, -menu.titleMorph.height);
    menu.openInWorld(pos);
    menu.offsetForWorld(pos)
    return menu;
  }

  static get properties() {
    return {
      dropShadow: {
        initialize() {
          this.dropShadow = true;
        }
      },
      submorphs: {
        initialize() {
          this.updateMorphs();
        }
      },
      padding: {defaultValue: Rectangle.inset(0, 2)},
      itemPadding: {defaultValue: Rectangle.inset(8, 4)},
      borderWidth: {defaultValue: 1},
      fill: {defaultValue: Color.white},
      borderColor: {defaultValue: Color.gray.lighter()},
      borderRadius: {defaultValue: 4},
      opacity: {defaultValue: 0.95},
      fontSize: {defaultValue: 16},
      fontFamily: {defaultValue: "Helvetica Neue, Arial, sans-serif"},
      title: {
        get() {
          return this.getProperty("title");
        },
        set(value) {
          this.addValueChange("title", value);
        }
      },
      ownerMenu: {},
      submenu: {},
      submenus: {
        readOnly: true,
        get() {
          return this.submenu ? [this.submenu].concat(this.submenu.submenus) : [];
        }
      },
      ownerItemMorph: {},
      removeOnMouseOut: {},
      items: {
        set(items) {
          items = items.map(this.ensureItem.bind(this)).filter(Boolean);
          this.setProperty('items', items);
        }
      },
      selectedItemMorph: {
        derived: true,
        readOnly: true,
        get() {
          return this.itemMorphs.find(ea => ea.selected);
        }
      },
      titleMorph: {
        derived: true,
        readOnly: true,
        get() {
          return this.getSubmorphNamed("title");
        }
      },
      itemMorphs: {
        derived: true,
        readOnly: true,
        get() {
          return this.submorphs.filter(ea => ea.isMenuItem);
        }
      }
    };
  }

  async remove() {
    await this.animate({opacity: 0, duration: 300});
    super.remove()
  }

  ensureItem(item) {
    if (!item) return invalidItem;

    if (item.title) { this.title = item.title; return null; }

    if (item.isDivider) return item;

    if (item.hasOwnProperty("string") && item.hasOwnProperty("action")) {
      return obj.select(item, ["string", "action", "annotation"]);
    }

    if (Array.isArray(item)) {
      var [name, actionOrList] = item;

      if (typeof name !== "string" && !Array.isArray(name)/*rich text*/) return invalidItem;

      if (!actionOrList || typeof actionOrList === "function")
        return {label: name, action: actionOrList || show.bind(null, name)};

      if (Array.isArray(actionOrList))
        return {
          label: name,
          submenu: actionOrList,
          annotation: [" ", {textStyleClasses: ["fa", "fa-caret-right"]}]
        };

      return invalidItem;
    }

    if (item.command) {
      var {command, showKeyShortcuts, target, alias, args} = item;
      if (!command || !target) return invalidItem;
      if (showKeyShortcuts === undefined) showKeyShortcuts = true;
      var keys = !showKeyShortcuts ?
          null :
          typeof showKeyShortcuts === "string" ?
            showKeyShortcuts :
            target.keysForCommand(command),
          label = alias || command,
          annotation = keys ? [`\t${keys}`, {fontSize: "70%"}] : ["", {}];
      return {string: label, annotation, action: () => target.execCommand(command, args)};
    }

    return invalidItem;
  }

  updateMorphs() {
    this.submorphs = [];

    var pLeft = this.padding.left(),
        pRight = this.padding.right(),
        pTop = this.padding.top(),
        pBottom = this.padding.bottom(),
        maxWidth = 0, pos = pt(pLeft, pTop);

    var defaultStyle = {};
    if (this.fontFamily) defaultStyle.fontFamily = this.fontFamily;
    if (this.fontSize) defaultStyle.fontSize = this.fontSize;
    if (this.itemPadding) defaultStyle.padding = this.itemPadding;

    if (this.title) {
      var title = this.addMorph({
        type: "label",
        value: this.title,
        name: "title",
        position: pos,
        fontWeight: "bold",
        ...defaultStyle
      });
      pos = title.bottomLeft;
      maxWidth = Math.max(title.width, maxWidth);
    }

    this.items.forEach(({label, string, annotation, action, submenu, isDivider}) => {
      var itemMorph = this.addMorph(
        isDivider ?
          new MenuDivider({position: pos}) :
          new MenuItem({
             label: label || string, annotation,
             action, submenu,
             position: pos,
             ...defaultStyle
          }));
      pos = itemMorph.bottomLeft;
      maxWidth = Math.max(itemMorph.width, maxWidth);
    });

    this.submorphs.forEach(ea => {
      if (ea.isLabel) {
        ea.fit();
        ea.autofit = false;
        ea.fixedWidth = true;
        ea.fixedHeight = true;
      }
      ea.width = maxWidth;
    });

    this.extent = pt(maxWidth + pRight + pLeft, pos.y + pBottom);
  }

  openSubMenuDelayed(evt, itemMorph, items) {
    // only open a new submenu after a certain delay to reduce the
    // impression of "flickering" menus and to be less annoying when trying to
    // move over a menu and leaving the bounds of the item morph that opened it
    this.openingSubMenuProcess && clearTimeout(this.openingSubMenuProcess);
    this.openingSubMenuProcess = setTimeout(() => {
      try {
        this.openSubMenu(evt, itemMorph, items);
      } catch(err) { var w = this.world(); w ? w.logError(err) : console.error(err); }
    }, 200);
  }

  openSubMenu(evt, itemMorph, items) {
    if (!itemMorph.selected) return;
    var existingSubMenu = this.submenu;

    if (existingSubMenu) {
      if (existingSubMenu.ownerItemMorph === itemMorph) return;
      if (this.morphsContainingPoint(evt.position).includes(existingSubMenu)) return;
      this.removeSubMenu();
    }

    var m = this.submenu = this.addMorph(
      new Menu({items, ownerItemMorph: itemMorph, ownerMenu: this}));
    m.updateMorphs();
    m.offsetForOwnerMenu();
  }

  maybeRemoveSubmenu() {
    fun.debounceNamed(this.id + "-maybeRemoveSubmenu", 300, () => {
      var w = this.world();
      if (!w) return;
      var {submenu, selectedItemMorph} = this,
          handOverSubmenu = w && submenu && submenu.fullContainsWorldPoint(w.firstHand.position);

      if (submenu && submenu.ownerItemMorph !== selectedItemMorph
       && !submenu.ownerItemMorph.selected) {
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

  removeSubMenu() {
    if (!this.submenu) return;
    var m = this.submenu;
    m.ownerMenu = null;
    this.submenu = null;
    m.remove();
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-


  moveBoundsForVisibility(menuBounds, visibleBounds) {
    var offsetX = 0, offsetY = 0;

    if (menuBounds.right() > visibleBounds.right())
      offsetX = -1 * (menuBounds.right() - visibleBounds.right());

    var overlapLeft = menuBounds.left() + offsetX;
    if (overlapLeft < 0) offsetX += -overlapLeft;

    if (menuBounds.bottom() > visibleBounds.bottom()) {
      offsetY = -1 * (menuBounds.bottom() - visibleBounds.bottom());
      // so that hand is not directly over menu, does not work when
      // menu is in the bottom right corner
      offsetX += 1;
    }

    var overlapTop = menuBounds.top() + offsetY;
    if (overlapTop < 0) offsetY += -overlapTop;

    return menuBounds.translatedBy(pt(offsetX, offsetY));
  }


  moveSubMenuBoundsForVisibility(subMenuBnds, mainMenuItemBnds, visibleBounds, direction) {
    // subMenuBnds is bounds to  be transformed, mainMenuItemBnds is the bounds of the menu
    // item that caused the submenu to appear, visbleBounds is the bounds that the submenu
    // should fit into, when there are multiple submenus force one direction with forceDirection
    if (!direction) {
      direction = mainMenuItemBnds.right() + subMenuBnds.width > visibleBounds.right() ?
          'left' : 'right';
    }

    var extent = subMenuBnds.extent()
    if (direction === 'left') {
      subMenuBnds = mainMenuItemBnds.topLeft().addXY(-extent.x, 0).extent(extent);
    } else {
      subMenuBnds = mainMenuItemBnds.topRight().extent(extent);
    }

    if (subMenuBnds.bottom() > visibleBounds.bottom()) {
      var deltaY = -1 * (subMenuBnds.bottom() - visibleBounds.bottom());
      subMenuBnds = subMenuBnds.translatedBy(pt(0, deltaY));
    }

    // if it overlaps at the top move the bounds so that it aligns woitht he top
    if (subMenuBnds.top() < visibleBounds.top()) {
      var deltaY = visibleBounds.top() - subMenuBnds.top();
      subMenuBnds = subMenuBnds.translatedBy(pt(0, deltaY));
    }

    return subMenuBnds;
  }

  offsetForOwnerMenu() {
    var owner = this.ownerMenu,
        visibleBounds = this.world().visibleBounds(),
        localVisibleBounds = owner.getGlobalTransform().inverse().transformRectToRect(visibleBounds),
        newBounds = this.clipForVisibility(
          this.moveSubMenuBoundsForVisibility(
            this.innerBounds(),
            owner.selectedItemMorph ? owner.selectedItemMorph.bounds() : owner.innerBounds(),
            localVisibleBounds), visibleBounds);
    this.setBounds(newBounds);
  }

  clipForVisibility(bounds = this.bounds(), worldBounds = this.world().visibleBounds()) {
    var globalBounds = this.owner.getTransform().transformRectToRect(bounds),
        overlapping = !worldBounds.containsRect(globalBounds.insetBy(5));

    // FIXME!
    var scrollbarWidth = 20;

    if (overlapping) {
      bounds = bounds.withExtent(pt(scrollbarWidth + 5 + bounds.width, worldBounds.height));
      // this.clipMode = "auto"
    }
    return bounds;
  }

  offsetForWorld(pos) {
    var bounds = this.innerBounds().translatedBy(pos);
    if (this.owner.visibleBounds) {
        var worldBounds = this.owner.visibleBounds();
        bounds = this.clipForVisibility(
            this.moveBoundsForVisibility(bounds, worldBounds),
            worldBounds);
    }
    this.setBounds(bounds);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // events
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  onHoverOut() {
    if (this.removeOnMouseOut) this.remove();
  }

}