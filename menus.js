import { Label, Morph, show } from "./index.js";
import { arr, obj, promise, fun } from "lively.lang";
import { pt, Color, Rectangle, Transform, rect } from "lively.graphics";

export class MenuDivider extends Morph {

  constructor(props = {}) {
    super({
      fill: Color.gray.lighter(),
      extent: pt(100, 5),
      reactsToPointer: false,
      ...props
    });
  }

  get isMenuDivider() { return true; }
}

export class MenuItem extends Label {

  constructor(props = {}) {
    super({
      fixedWidth: false, fixedHeight: false,
      fill: null,
      fontSize: 14,
      draggable: false,
      readOnly: true,
      nativeCursor: "pointer",
      ...obj.dissoc(props, ["selected"])
    });

    this.selected = props.hasOwnProperty("selected") ? props.selected : false;
  }

  get isMenuItem() { return true; }

  get selected() { return this.getProperty("selected"); }
  set selected(value) {
    if (this.selected === value) return;
    this.addValueChange("selected", value);
    if (value) {
      this.fontColor = Color.white;
      this.fill = Color.blue;
    } else {
      this.fill = Color.null;
      this.fontColor = Color.black;
    }
  }

  get labelAndAnnotation() {
    var {value, annotation} = this.valueAndAnnotation,
        label = value.map(([string]) => string).join("\n");
    return {label, annotation};
  }

  set labelAndAnnotation(value) {
    var {label, annotation} = value;
    this.valueAndAnnotation = {value: label, annotation}
  }

  get label() { return this.labelAndAnnotation.label; }
  set label(label) { this.labelAndAnnotation = {label, annotation: this.annotation}; }

  get annotation() { return this.labelAndAnnotation.annotation; }
  set annotation(annotation) { this.labelAndAnnotation = {label: this.label, annotation}; }

  get action() { return this.getProperty("action") }
  set action(value) { this.addValueChange("action", value); }

  get submenu() { return this.getProperty("submenu") }
  set submenu(value) { this.addValueChange("submenu", value); }

  onHoverIn(evt) {
    this.owner.itemMorphs.forEach(ea => ea !== this && (ea.selected = false));
    this.selected = true;
    if (this.submenu)
      this.owner.openSubMenuDelayed(evt, this, this.submenu)
  }

  onHoverOut(evt) {
    this.selected = false;
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

  constructor(props) {
    var {ownerMenu, ownerItemMorph, subMenu, removeOnMouseOut, items} = props
    super({
      dropShadow: true,
      title: null,
      padding: Rectangle.inset(0, 2),
      itemPadding: Rectangle.inset(8, 4),
      borderWidth: 1,
      fill: Color.white,
      borderColor: Color.gray.lighter(),
      borderRadius: 4,
      opacity: 0.95,
      fontSize: 16,
      fontFamily: "Helvetica Neue, Arial, sans-serif",
      ...obj.dissoc(props, ["ownerMenu", "ownerItemMorph", "subMenu", "items", "removeOnMouseOut"])
    });
    this.state = {
      ownerMenu: null, ownerItemMorph: null, removeOnMouseOut: false,
      subMenu: null, items: null, openingSubMenuProcess: null
    };
    Object.assign(this, {ownerMenu, ownerItemMorph, subMenu, removeOnMouseOut, items});
    this.updateMorphs();
  }

  async remove() {
    await this.animate({opacity: 0, duration: 300});
    super.remove()
  }

  get title() { return this.getProperty("title") }
  set title(value) { this.addValueChange("title", value); }

  get ownerMenu() { return this.state.ownerMenu; }
  set ownerMenu(value) { this.state.ownerMenu = value; }

  get submenu() { return this.state.submenu; }
  set submenu(value) { this.state.submenu = value; }

  get ownerItemMorph() { return this.state.ownerItemMorph; }
  set ownerItemMorph(value) { this.state.ownerItemMorph = value; }

  get removeOnMouseOut() { return this.state.removeOnMouseOut; }
  set removeOnMouseOut(value) { this.state.removeOnMouseOut = value; }

  get items() { return this.state.items; }
  set items(items) {
    items = items.map(this.ensureItem.bind(this)).filter(Boolean);
    this.state.items = items;
  }

  get padding() { return this.getProperty("padding") }
  set padding(value) { this.addValueChange("padding", value); }

  get fontSize() { return this.getProperty("fontSize") }
  set fontSize(value) { this.addValueChange("fontSize", value); }

  get fontFamily() { return this.getProperty("fontFamily") }
  set fontFamily(value) { this.addValueChange("fontFamily", value); }

  get selectedItemMorph() { return this.itemMorphs.find(ea => ea.selected); }
  get titleMorph() { return this.getSubmorphNamed("title"); }
  get itemMorphs() { return this.submorphs.filter(ea => ea.isMenuItem); }

  ensureItem(item) {
    if (!item) return invalidItem;

    if (item.title) { this.title = item.title; return null; }

    if (item.isDivider) return item;

    if (Array.isArray(item)) {
      var [name, actionOrList] = item;
      if (typeof name !== "string") return invalidItem;

      if (!actionOrList || typeof actionOrList === "function")
        return {string: name, action: actionOrList || show.bind(null, name)};

      if (Array.isArray(actionOrList))
        return {
          string: name,
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

    this.items.forEach(({string: label, annotation, action, submenu, isDivider}) => {
      var itemMorph = this.addMorph(
        isDivider ?
          new MenuDivider({position: pos}) :
          new MenuItem({
             label, annotation,
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
    this.state.openingSubMenuProcess && clearTimeout(this.state.openingSubMenuProcess);
    this.state.openingSubMenuProcess = setTimeout(() => {
      try {
        this.openSubMenu(evt, itemMorph, items);
      } catch(err) { var w = this.world(); w ? w.logError(err) : console.error(err); }
    }, 200);
  }

  openSubMenu(evt, itemMorph, items) {
    if (!itemMorph.selected) return;
    var existingSubMenu = this.subMenu;

    if (existingSubMenu) {
      if (existingSubMenu.ownerItemMorph === itemMorph) return;
      if (this.morphsContainingPoint(evt.position).includes(existingSubMenu)) return;
      this.removeSubMenu();
    }

    var m = this.subMenu = this.addMorph(
      new Menu({items, ownerItemMorph: itemMorph, ownerMenu: this}));
    m.updateMorphs();
    m.offsetForOwnerMenu();
  }

  maybeRemoveSubmenu() {
    fun.debounceNamed(this.id + "-maybeRemoveSubmenu", 300, () => {
      var w = this.world();
      if (!w) return;
      var handOverSubmenu = w && this.subMenu
                         && this.subMenu.fullContainsWorldPoint(w.firstHand.position);

      if (this.subMenu && this.subMenu.ownerItemMorph !== this.selectedItemMorph
       && !this.subMenu.ownerItemMorph.selected) {
        // this logic is to ensure that if this is an owner menu and the selected
        // item morph that generated a submenu has changed but the user is
        // still hovering over the submenu then the item morph will be
        // re-selected
        // (deselecting my item morph can happen when quickly swooping over menus)
        if (handOverSubmenu) {
          this.selectedItemMorph && (this.selectedItemMorph.selected = false);
          this.subMenu.ownerItemMorph.selected = true;
        } else this.removeSubMenu()
      }
    })();

    return this.removeOnMouseOut;
  }

  removeSubMenu() {
    if (!this.subMenu) return;
    var m = this.subMenu;
    m.ownerMenu = null;
    this.subMenu = null;
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
