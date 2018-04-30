import { CustomLayout, VerticalLayout, Morph, Text, StyleSheet, Label, Icon, morph } from "lively.morphic";
import { pt, LinearGradient, Color, Rectangle, rect } from "lively.graphics";
import { arr, Path, string } from "lively.lang";
import { signal, once } from "lively.bindings";
import { Button } from "./buttons.js";

function asItem(obj) {
  // make sure that object is of the form
  // {isListItem: true, string: STRING, value: OBJECT}
  if (obj && obj.isListItem && typeof obj.string === "string") return obj;
  if (!obj || !obj.isListItem) return {isListItem: true, string: String(obj), value: obj};
  var label = obj.string || obj.label || "no item.string";
  obj.string = !label || typeof label === "string" ? String(label) :
    Array.isArray(label) ?
      label.map((text, i) => i%2==0? String(text) : "").join("") :
      String(label);
  return obj;
}

class ListItemMorph extends Label {

  static get properties() {
    return {
      clipMode:              {defaultValue: "hidden"},
      autofit:               {defaultValue: false},
      isSelected:            {defaultValue: false},
      draggable:             {defaultValue: true},
      fill: {
        derived: true,
        get() {
          return this.isSelected ? this.selectionColor : Color.transparent;
        }
      },
      itemIndex:             {defaultValue: undefined},
      selectionFontColor:    {isStyleProp: true, defaultValue: Color.white},
      selectionColor:        {isStyleProp: true, defaultValue: Color.blue},
      nonSelectionFontColor: {isStyleProp: true, defaultValue: Color.rgbHex("333")},
      fontColor: {
        derived: true,
        get() {
          return this.isSelected ? this.selectionFontColor : this.nonSelectionFontColor;
        }
      }
    };
  }

  displayItem(item, itemIndex, goalWidth, itemHeight, pos, isSelected = false, style) {
    let itemMorph = item.morph,
        label = itemMorph ? "" : (item.label || item.string || "no item.string");

    if (item.annotation) this.valueAndAnnotation = {value: label, annotation: item.annotation};
    else if (typeof label === "string") this.textString = label;
    else this.value = label;

    this.tooltip = this.tooltip || this.textString;
    this.itemIndex = itemIndex;
    this.position = pos;

    if (style) {
      let {
        fontFamily,
        selectionColor,
        selectionFontColor,
        nonSelectionFontColor,
        fontSize,
        padding
      } = style;
      if (selectionFontColor && this.selectionFontColor !== selectionFontColor)
        this.selectionFontColor = selectionFontColor;
      if (nonSelectionFontColor && this.nonSelectionFontColor !== nonSelectionFontColor)
        this.nonSelectionFontColor = nonSelectionFontColor;
      if (selectionColor && this.selectionColor !== selectionColor)
        this.selectionColor = selectionColor;
      if (fontSize && this.fontSize !== fontSize) this.fontSize = fontSize;
      if (fontFamily && this.fontFamily !== fontFamily) this.fontFamily = fontFamily;
      if (padding && !this.padding.equals(padding)) this.padding = padding;
    }

    {
      // if its wider, its wider...
      // this is more correct but slower:
      // this.extent = pt(Math.max(goalWidth, this.textBounds().width), itemHeight);
      // this is faster:
      let width = itemMorph ? Math.max(itemMorph.width, goalWidth) : goalWidth,
          height = itemHeight; // itemMorph ? Math.max(itemMorph.height, itemHeight) : itemHeight;
      this.extent = pt(width, height);
    }

    if (itemMorph) this.addMorph(itemMorph);
    else if (this.submorphs.length) this.submorphs = [];

    this.isSelected = isSelected;
  }

  onDragStart(evt) {
    let list = this.owner.owner;
    this._dragState = {sourceIsSelected: this.isSelected, source: this, itemsTouched: []};
    if (!list.multiSelect || !list.multiSelectViaDrag)
      list.onItemMorphDragged(evt, this);
  }

  onDrag(evt) {
    let list = this.owner.owner;
    if (list.multiSelect && list.multiSelectViaDrag) {
      let below = evt.hand.morphBeneath(evt.position),
          {selectedIndexes, itemMorphs} = list;
      if (below === this || !itemMorphs.includes(below)) return;
      if (this._dragState.sourceIsSelected && !below.isSelected) {
        arr.pushIfNotIncluded(selectedIndexes, below.itemIndex);
        list.selectedIndexes = selectedIndexes;
      } else if (!this._dragState.sourceIsSelected && below.isSelected) {
        arr.remove(selectedIndexes, below.itemIndex);
        list.selectedIndexes = selectedIndexes;
      }
    }
  }
}

class ListScroller extends Morph {
  
  static get properties() {
    return {
      name: {defaultValue: "scroller"},
      fill: {defaultValue: Color.transparent},
      clipMode: {defaultValue: "auto"},
      scrollbar: {
        derived: true, readOnly: true, after: ['submorphs'],
        get() { return this.submorphs[0]; }
      },
      submorphs: {
        initialize() { this.submorphs = [{name: 'scrollbar'}]; }
      }
    }
  }
  
  onScroll(evt) { return this.owner.update(); }
  onMouseDown(evt) { return this.owner.clickOnItem(evt); }
}

var listCommands = [
  {
    name: "page up",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.max(0, index - Math.round(list.height / list.itemHeight));
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "page down",
    exec: (list) => {
      var index = list.selectedIndex,
          newIndex = Math.min(list.items.length-1, index + Math.round(list.height / list.itemHeight));
      list.gotoIndex(newIndex);
      return true;
    }
  },

  {
    name: "goto first item",
    exec: (list) => { list.gotoIndex(0); return true; }
  },

  {
    name: "goto last item",
    exec: (list) => { list.gotoIndex(list.items.length-1); return true; }
  },

  {
    name: "arrow up",
    exec: (list) => { list.gotoIndex(list.indexUp()); return true; }
  },

  {
    name: "arrow down",
    exec: (list) => {
      list.gotoIndex(list.indexDown());
      return true;
    }
  },

  {
    name: "select up",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow up");

      var current = selected[0];
      if (typeof current !== "number") list.selectedIndexes = [current];
      else {
        var up = list.indexUp(current);
        if (selected.includes(current) && selected.includes(up)) {
          list.selectedIndexes = selected.filter(ea => ea !== current);
        } else {
          list.selectedIndexes = [up].concat(selected.filter(ea => ea !== up));
        }
      }
      return true;
    }
  },

  {
    name: "select down",
    exec: (list) => {
      var selected = list.selectedIndexes;
      if (!list.multiSelect || !selected.length)
        return list.execCommand("arrow down");

      var current = selected[0],
          down = list.indexDown(current);
      if (selected.includes(current) && selected.includes(down)) {
        list.selectedIndexes = selected.filter(ea => ea !== current);
      } else {
        list.selectedIndexes = [down].concat(selected.filter(ea => ea !== down));
      }
      return true;
    }
  },

  {
    name: "select all",
    exec: (list) => {
      list.selectedIndexes = arr.range(list.items.length-1, 0);
      list.scrollIndexIntoView(list.selectedIndexes[0]);
      return true;
    }
  },

  {
    name: "select via filter",
    exec: async (list) => {
      var preselect = list.selectedIndex || 0;
      var {selected} = await list.world().filterableListPrompt(
        "Select item", list.items,
        {preselect, requester: list.getWindow() || list, itemPadding: Rectangle.inset(0,2), multiSelect: true});
      if (selected.length) {
        if (list.multiSelect) list.selections = selected;
        else list.selection = selected[0];
        list.scrollSelectionIntoView();
        list.update();
      }
      return true;
    }
  },

  {
    name: "realign top-bottom-center",
    exec: list => {
      if (!list.selection) return;
      var {padding, selectedIndex: idx, itemHeight, scroll: {x: scrollX, y: scrollY}} = list,
          pos = pt(0, idx*itemHeight),
          offsetX = 0, offsetY = 0,
          h = list.height - itemHeight - padding.top() - padding.bottom();
      if (Math.abs(pos.y - scrollY) < 2) {
        scrollY = pos.y - h;
      } else if (Math.abs(pos.y - scrollY - h * 0.5) < 2) {
        scrollY = pos.y;
      } else {
        scrollY = pos.y - h * 0.5;
      }
      list.scroll = pt(scrollX, scrollY);
      return true;
    }
  },

  {
    name: "print contents in text window",
    exec: list => {
      var title = "items of " + list.name,
          content = list.items.map(item => {
            if (typeof item === "string") return item;
            var {string, label, annotation} = item,
                result = "";

            if (label) {
              if (typeof label === "string") result += label;
              else result += label.map((text, i) => i%2==0? text: "").join("");
            } else if (string) result += string;

            if (annotation) {
              result += " ";
              if (typeof annotation === "string") result += annotation;
              else result += annotation[0];
            }
            return result;
          }).join("\n");

      return list.world().execCommand("open text window",
        {title, content, name: title, fontFamily: "Monaco, monospace"});
    }
  }
];


export class List extends Morph {

  static get styleSheet() {
    return new StyleSheet({
      ".List.dark": {
        fill: Color.transparent,
        hideScrollbars: true,
        padding: Rectangle.inset(2, 2, 0, 0),
        fontFamily: "Monaco, monospace",
        selectionColor: Color.gray.lighter(),
        selectionFontColor: Color.black,
        nonSelectionFontColor: Color.gray,
      },
      "[name=scrollbar]": {
        fill: Color.transparent
      },
      ".List.dark .ListItemMorph": {
        selectionFontColor: Color.black,
        nonSelectionFontColor: Color.gray,
      },
      ".List.default": {
        padding: Rectangle.inset(2, 2, 0, 0)
      }
    });
  }

  static get properties() {

    return {

      fill:            {defaultValue: Color.white},
      clipMode:        {defaultValue: 'hidden'},

      selectionFontColor:    {isStyleProp: true, defaultValue: Color.white},
      selectionColor:        {isStyleProp: true, defaultValue: Color.blue},
      nonSelectionFontColor: {isStyleProp: true, defaultValue: Color.rgbHex("333")},
      fontColor:             {isStyleProp: true, defaultValue: Color.rgbHex("333")},

      styleClasses: {defaultValue: ['default']},

      itemScroll: {
        /*
          We need to use a different property name for the list scroll,
          since the default scroll property is already rendered as a div
          with overflow hidden|scroll which we do not want since we implement
          the scroll for ourselves.
        */
        derived: true,
        after: ['submorphs'],
        get() { return this.scroller ? this.scroller.scroll : pt(0,0) },
        set(s) { if (this.scroller) this.scroller.scroll = s; }
      },

      styleSheets: {
        initialize() {
          this.styleSheets = List.styleSheet;
        }
      },

      extent: {
        set(value) {
          if (value.eqPt(this.extent)) return;
          this.setProperty("extent", value);
          this.update();
        }
      },

      fontFamily: {
        isStyleProp: true,
        defaultValue: "Helvetica Neue, Arial, sans-serif",
        set(value) {
          this.setProperty("fontFamily", value);
          this.invalidateCache();
        }
      },

      fontSize: {
        isStyleProp: true,
        defaultValue: 12,
        set(value) {
          this.setProperty("fontSize", value);
          this.invalidateCache();
        }
      },

      padding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(3)
      },

      itemBorderRadius: {
        isStyleProp: true, defaultValue: 0,
        set(value) {
          this.setProperty("itemBorderRadius", value);
          this.invalidateCache();
        }
      },

      itemPadding: {
        isStyleProp: true,
        defaultValue: Rectangle.inset(1),
        set(value) {
          this.setProperty("itemPadding", value);
          this.invalidateCache();
        }
      },

      items: {
        group: "list", defaultValue: [], after: ["submorphs"],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.update();
          if (this.attributeConnections)
            signal(this, "values", this.values);
        }
      },

      multiSelect: {
        defaultValue: false
      },

      multiSelectWithSimpleClick: {
        description: "Does a simple click toggle selections without deselecting?",
        defaultValue: false,
      },

      multiSelectViaDrag: {
        description: "Does dragging extend selection?",
        defaultValue: true,
      },

      values: {
        group: "list", after: ["items"], readOnly: true,
        get() { return this.items.map(ea => ea.value); }
      },

      selectedIndex: {
        group: "list",
        defaultValue: [], after: ["selectedIndexes"],
        get() { return this.selectedIndexes[0]; },
        set(i) { return this.selectedIndexes = typeof i === "number" ? [i] : []; }
      },

      selectedIndexes: {
        get() { return this.getProperty("selectedIndexes") || []; },
        set(indexes) {
          var maxLength = this.items.length;
          this.setProperty(
            "selectedIndexes",
            (indexes || []).filter(i => 0 <= i && i < maxLength));
          this.update();
          signal(this, "selection", this.selection);
        }
      },

      selection: {
        group: "list",
        after: ["selections"],
        get() { return this.selections[0]; },
        set(itemOrValue) { this.selections = [itemOrValue]; }
      },

      selections: {
        group: "list",
        after: ["selectedIndexes"],
        get() { return this.selectedIndexes.map(i => this.items[i] && this.items[i].value); },
        set(sels) { this.selectedIndexes = sels.map(ea => this.findIndex(ea)); }
      },

      selectedItems: {
        after: ["selectedIndexes"], readOnly: true,
        get() { return this.selectedIndexes.map(i => this.items[i]); }
      },

      submorphs: {
        initialize(submorphs) { this.initializeSubmorphs(submorphs); }
      },

      listItemContainer: {
        after: ["submorphs"], readOnly: true,
        get() { return this.getSubmorphNamed("listItemContainer"); }
      },

      itemMorphs: {
        after: ["submorphs"], readOnly: true,
        get() { return this.listItemContainer.submorphs; }
      },

      scrollBar: {
        after: ['submorphs'], readOnly: true,
        get() { return this.getSubmorphNamed('scrollbar') }
      },

      scroller: {
        after: ['submorphs'], readOnly: true,
        get() {  return this.getSubmorphNamed('scroller'); }
      },

      manualItemHeight: {type: "Boolean"},

      itemHeight: {
        after: ["fontFamily", "fontSize", "itemPadding"],
        defaultValue: 10,
        set(val) {
          this.setProperty("itemHeight", val);
          this.manualItemHeight = typeof val === "number";
        },
        get() {
          let height = this.getProperty("itemHeight");
          if (height) return height;
          var h = this.env.fontMetric.defaultLineHeight(
                {fontFamily: this.fontFamily, fontSize: this.fontSize}),
              padding = this.itemPadding;
          if (padding) h += padding.top() + padding.bottom();
          this.setProperty("itemHeight", h);
          return h;
        }
      },

      theme: {
        after: ['styleClasses'],
        defaultValue: 'default',
        set(val) {
          this.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.setProperty('theme', val);
        }
      },

    };
  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    this.update();
  }

  initializeSubmorphs(submorphs) {
    let container, scroller;
    submorphs = submorphs || this.submorphs || [];
    if (!this.submorphs) this.submorphs = submorphs;
    for (let i = 0; i < submorphs.length; i++) {
      switch (submorphs[i].name) {
        case "listItemContainer": container = submorphs[i]; continue;
        case "scroller": scroller = submorphs[i]; continue;
      }
    }
    if (!container) this.addMorph({
      name: "listItemContainer", fill: Color.transparent,
      clipMode: "hidden", halosEnabled: false,
      acceptsDrops: false, draggable: false
    });
    if (!scroller) this.addMorph(new ListScroller({halosEnabled: false, name: "scroller"}));
    if (container || scroller) this.update();
  }

  get isList() { return true; }

  onChange(change) {
    var {prop} = change;
    if (prop === "fontFamily"
     || prop === "fontSize"
     || prop === "padding"
     || prop === "itemPadding"
     || prop === "items") this.update();
    return super.onChange(change);
  }

  clickOnItem(evt) {
    let item = this.scroller.morphBeneath(evt.positionIn(this.world()).subPt(this.scroll));
    var {state: {clickCount}} = evt,
        method = clickCount === 2 ? "onItemMorphDoubleClicked" : "onItemMorphClicked";
    this[method](evt, item);
  }

  get connections() {
    return {selection: {signalOnAssignment: false}};
  }

  invalidateCache() {
    if (!this.manualItemHeight)
      this.setProperty("itemHeight", null);
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // items

  find(itemOrValue) {
    return this.items.find(item => item === itemOrValue || item.value === itemOrValue);
  }

  findIndex(itemOrValue) {
    return this.items.findIndex(item => item === itemOrValue || item.value === itemOrValue);
  }

  addItem(item) { return this.addItemAt(item); }

  addItemAt(item, index = this.items.length) {
    var items = this.items;
    index = Math.min(items.length, Math.max(0, index));
    items.splice(index, 0, asItem(item));

    this.addMethodCallChangeDoing({
      target: this,
      selector: "addItemAt",
      args: [item, index],
      undo: {
        target: this,
        selector: "removeItem",
        args: [item],
      }
    }, () => this.update());

  }

  removeItem(itemOrValue) {
    var item = this.find(itemOrValue),
        items = this.items,
        index = items.indexOf(item);
    if (index === -1) return;

    items.splice(index, 1);

    this.addMethodCallChangeDoing({
      target: this,
      selector: "removeItem",
      args: [item],
      undo: {
        target: this,
        selector: "addItemAt",
        args: [item, index],
      }
    }, () => this.update());

  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // selection

  selectItemMorph(itemMorph) {
    this.selectedIndexes = [itemMorph.itemIndex];
  }

  gotoIndex(i) { this.scrollIndexIntoView(this.selectedIndex = i); }

  indexUp(from) {
    from = typeof from === "number" ? from : this.selectedIndex;
    // wrap around:
    return (from || this.items.length) - 1;
  }

  indexDown(index = this.selectedIndex) {
    index = typeof index === "number" ? index : -1;
    return (index + 1) % this.items.length;
  }

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // rendering

  update() {
    var items = this.items;
    if (!items || !this.scroller) return; // pre-initialize

    this.dontRecordChangesWhile(() => {
      var {
            itemHeight,
            itemMorphs, listItemContainer,
            selectedIndexes,
            extent: {x: width, y: height},
            fontSize, fontFamily, fontColor,
            padding, itemPadding, selectionColor,
            selectionFontColor, nonSelectionFontColor,
            itemBorderRadius, scrollBar, scroller
          } = this,
          {scroll: {x: left, y: top}} = scroller,
          padding = padding || Rectangle.inset(0),
          padTop = padding.top() , padLeft = padding.left(),
          padBottom = padding.bottom(), padRight = padding.right(),
          scrollOffset =  -(top % itemHeight),
          firstItemIndex = Math.max(0, Math.floor((top) / itemHeight)),
          lastItemIndex = Math.min(items.length, Math.ceil((top + height) / itemHeight)),
          maxWidth = 0,
          goalWidth = this.width - (padLeft + padRight);

      for (var i = 0; i < lastItemIndex-firstItemIndex; i++) {
        var itemIndex = firstItemIndex+i,
            item = items[itemIndex];

        if (!item) {
          // if no items to display, remove remaining itemMorphs
          itemMorphs.slice(i).forEach(itemMorph => itemMorph.remove());
          break;
        }

        let style = {
              fontSize, fontFamily,
              fontColor: nonSelectionFontColor || fontColor,
              padding: itemPadding, borderRadius: itemBorderRadius || 0,
              selectionFontColor,
              nonSelectionFontColor,
              selectionColor
            }, itemMorph = itemMorphs[i];

        if (!itemMorph)
          itemMorph = itemMorphs[i] = listItemContainer.addMorph(new ListItemMorph(style));
        itemMorph.displayItem(
          item, itemIndex,
          goalWidth, itemHeight,
          pt(0, scrollOffset + itemHeight * (itemIndex - firstItemIndex)),
          selectedIndexes.includes(itemIndex),
          style);

        maxWidth = Math.max(maxWidth, itemMorph.width);
      }

      itemMorphs.slice(lastItemIndex-firstItemIndex).forEach(ea => ea.remove());

      listItemContainer.setBounds(pt(padLeft, padTop).extent(this.extent));
      scroller.extent = this.extent;
      scrollBar.left = maxWidth - 1;
      scrollBar.extent = pt(
        1,
        Math.max(padTop + padBottom + itemHeight * items.length, this.height));
    });
  }

  scrollSelectionIntoView() {
    if (this.selection) this.scrollIndexIntoView(this.selectedIndex);
  }

  scrollIndexIntoView(idx) {
    var {itemHeight, width, itemScroll, scrollbarOffset} = this,
        itemBounds = new Rectangle(0, idx*itemHeight, width, itemHeight),
        visibleBounds = this.innerBounds().insetByRect(this.padding).translatedBy(itemScroll),
        offsetX = 0, offsetY = 0;
    if (itemBounds.bottom() > visibleBounds.bottom() - scrollbarOffset.y)
      offsetY = itemBounds.bottom() - (visibleBounds.bottom() - scrollbarOffset.y);
    if (itemBounds.top() < visibleBounds.top())
      offsetY = itemBounds.top() - visibleBounds.top();
    this.itemScroll = itemScroll.addXY(offsetX, offsetY);
  }

  onItemMorphDoubleClicked(evt, itemMorph) {}

  onItemMorphClicked(evt, itemMorph) {
    var itemI = itemMorph.itemIndex,
        {selectedIndexes} = this,
        isClickOnSelected = selectedIndexes.includes(itemI),
        indexes = [];

    if (this.multiSelect) {
      if (evt.isShiftDown()) {

        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // select from last selected to clicked item
          var from = selectedIndexes[0],
              added = typeof from === "number" ? arr.range(itemI, from) : [itemI];
          indexes = added.concat(selectedIndexes.filter(ea => !added.includes(ea)));
        }

      } else if (this.multiSelectWithSimpleClick || evt.isCommandKey()) {

        // deselect item
        if (isClickOnSelected) {
          indexes = selectedIndexes.filter(ea => ea != itemI);
        } else {
          // just add clicked item to selection list
          indexes = [itemI].concat(selectedIndexes.filter(ea => ea != itemI));
        }

      } else indexes = [itemI];

    } else indexes = [itemI];

    this.selectedIndexes = indexes;
  }

  onItemMorphDragged(evt, itemMorph) {}

  onDragStart(evt) {
    if (!this.multiSelect || !this.multiSelectViaDrag) return;
  }

  onDrag(evt) {}

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  // event handling
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: {win: "Ctrl-A", mac: "Meta-A"}, command: "select all"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Alt-Space",                    command: "select via filter"},
      {keys: "Ctrl-L",                       command: "realign top-bottom-center"}
    ].concat(super.keybindings);
  }

  get commands() { return listCommands; }

}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

import { connect } from "lively.bindings";

export class FilterableList extends Morph {

  static get styleSheet() {
    return new StyleSheet({
      ".FilterableList.dark [name=input]": {
        borderWidth: 0,
        borderRadius: 20,
        fill: Color.gray.withA(0.8),
        fontColor: Color.gray.darker(),
        padding: rect(10, 2)
      },
      ".FilterableList.dark [name=input] [name=placeholder]": {
        fontColor: Color.gray.darker().withA(.7)
      },
      ".FilterableList.default [name=input]": {
        borderWidth: 0,
        borderColor: Color.gray
      }
    });
  }

  static get properties() {

    return {

      fill: {defaultValue: Color.transparent},
      borderWidth: {defaultValue: 1},
      updateSelectionsAfterFilter: {defaultValue: false},

      theme: {
        after: ['styleClasses', 'listMorph'],
        defaultValue: 'default',
        set(val) {
          this.removeStyleClass(this.theme);
          this.listMorph.removeStyleClass(this.theme);
          this.addStyleClass(val);
          this.listMorph.addStyleClass(val);
          this.setProperty('theme', val);
        }
      },

      submorphs: {
        initialize() {
          let input = Text.makeInputLine({
            name: "input",
            highlightWhenFocused: false,
            fixedHeight: false,
            autofit: false
          });
          this.submorphs = [
            input,
            new morph({name: 'padding', fill: Color.transparent, height: 5}),
            new List({name: "list", items: [], clipMode: "auto"})
          ];
          // rms 24.5.17 in order to ensure that the list correctly conforms to
          //   global style sheets that become active once list is opened in world
          //   NOTE: this is a temporary fix, results in not so nice looking moving of
          //         elements
          this.get('list').whenRendered().then(() => this.get('list').update());
        }
      },

      paddingMorph: {
        derived: true, readOnly: true, after: ['submorphs'],
        get() { return this.getSubmorphNamed('padding'); }
      },

      listMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("list"); },
      },

      inputMorph: {
        derived: true, readOnly: true, after: ["submorphs"],
        get() { return this.getSubmorphNamed("input"); },
      },

      fontFamily: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        defaultValue: "Helvetica Neue, Arial, sans-serif",
        get() { return this.listMorph.fontFamily; },
        set(val) {
          this.listMorph.fontFamily = val;
          this.inputMorph.fontFamily = val;
        }
      },

      padding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        defaultValue: Rectangle.inset(2,0),
        get() { return this.listMorph.padding; },
        set(val) {
          this.listMorph.padding = val;
          this.inputMorph.padding = val;
        }
      },

      fontSize: {
        isStyleProp: true,
        group: "styling",
        derived: true, after: ["submorphs"], defaultValue: 11,
        get() { return this.listMorph.fontSize; },
        set(val) {
          this.listMorph.fontSize = val;
          this.inputMorph.fontSize = val;
        }
      },

      itemPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.itemPadding; },
        set(val) { this.listMorph.itemPadding = val; }
      },

      inputPadding: {
        isStyleProp: true,
        derived: true, after: ["submorphs", "padding"],
        defaultValue: Rectangle.inset(2),
        get() { return this.inputMorph.padding; },
        set(val) { this.inputMorph.padding = val; }
      },

      input: {
        derived: true, after: ["submorphs"], defaultValue: "",
        get() { return this.inputMorph.input; },
        set(val) { this.inputMorph.input = val; }
      },

      historyId: {
        derived: true, after: ["submorphs"], defaultValue: null,
        get() { return this.inputMorph.historyId; },
        set(val) { this.inputMorph.historyId = val; }
      },

      multiSelect: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.multiSelect; },
        set(multiSelect) { this.listMorph.multiSelect = multiSelect; }
      },

      items: {
        after: ["submorphs", "fuzzy", "fuzzySortFunction", "fuzzyFilterFunction"],
        defaultValue: [],
        set(items) {
          this.setProperty("items", items.map(asItem));
          this.updateFilter();
        }
      },

      visibleItems: {
        derived: true, after: ["submorphs"],
        get visibleItems() { return this.listMorph.items; }
      },

      selection: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selection; },
        set(x) { this.listMorph.selection = x; }
      },

      selectedIndex: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedIndex; },
        set(x) { this.listMorph.selectedIndex = x; }
      },

      selectedIndexes: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedIndexes; },
        set(x) { this.listMorph.selectedIndexes = x; }
      },

      selectedItems: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selectedItems; },
        set(x) { this.listMorph.selectedItems = x; }
      },

      selections: {
        derived: true, after: ["submorphs"],
        get() { return this.listMorph.selections; },
        set(x) { this.listMorph.selections = x; }
      },

      fuzzy: {
        derived: true, after: ["filterFunction", "sortFunction"],
        set(fuzzy) {
          // fuzzy => bool or prop;
          this.setProperty("fuzzy", fuzzy);
          if (!fuzzy) {
            if (this.sortFunction === this.fuzzySortFunction)
              this.sortFunction = null;
            if (this.filterFunction === this.fuzzyFilterFunction)
              this.filterFunction = this.defaultFilterFunction;
          } else  {
            if (!this.sortFunction) this.sortFunction = this.fuzzySortFunction;
            if (this.filterFunction == this.defaultFilterFunction)
              this.filterFunction = this.fuzzyFilterFunction;
          }
        }
      },

      filterFunction: {
        get() {
          let filterFunction = this.getProperty("filterFunction");
          if (!filterFunction) return this.defaultFilterFunction;
          if (typeof filterFunction === "string")
            filterFunction = eval(`(${filterFunction})`);
          return filterFunction;
        }
      },

      sortFunction: {},

      defaultFilterFunction: {
        readOnly: true,
        get() {
          return this._defaultFilterFunction
              || (this._defaultFilterFunction = (parsedInput, item) =>
                parsedInput.lowercasedTokens.every(token =>
                  item.string.toLowerCase().includes(token)));
        }
      },

      fuzzySortFunction: {
        get() {
          return this._fuzzySortFunction
              || (this._fuzzySortFunction = (parsedInput, item) => {
                var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
                // preioritize those completions that are close to the input
                var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                var base = 0;
                parsedInput.lowercasedTokens.forEach(t => {
                  if (fuzzyValue.startsWith(t)) base -= 10;
                  else if (fuzzyValue.includes(t)) base -= 5;
                });
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue.toLowerCase(), token))) + base;
              });
        }
      },

      fuzzyFilterFunction: {
        get() {
          return this._fuzzyFilterFunction
              || (this._fuzzyFilterFunction = (parsedInput, item) => {
                var prop = typeof this.fuzzy === "string" ? this.fuzzy : "string";
                var tokens = parsedInput.lowercasedTokens;
                if (tokens.every(token => item.string.toLowerCase().includes(token))) return true;
                // "fuzzy" match against item.string or another prop of item
                var fuzzyValue = String(Path(prop).get(item)).toLowerCase();
                return arr.sum(parsedInput.lowercasedTokens.map(token =>
                  string.levenshtein(fuzzyValue, token))) <= 3;
              });
        }
      },

      selectedAction: {
        get() { return this.getProperty("selectedAction") || "default"; }
      },

      actions: {}
    };

  }

  constructor(props = {}) {
    if (!props.bounds && !props.extent) props.extent = pt(400, 360);
    super(props);
    connect(this.inputMorph, "inputChanged", this, "updateFilter");
    connect(this.listMorph, "selection", this, "selectionChanged");
    connect(this.listMorph, "onItemMorphDoubleClicked", this, "acceptInput");
    this.updateFilter();
    this.layout = new CustomLayout({relayout: () => this.relayout()});
  }

  resetConnections() {
    let cs = this.attributeConnections;
    if (!cs) return;
    let props = ["accepted", "canceled", "remove"];
    cs.filter(c => props.includes(c.sourceAttrName) && c.targetObj !== this)
      .forEach(c => c.disconnect());
  }

  get isList() { return true; }

  relayout() {
    let {listMorph, inputMorph, paddingMorph, borderWidth: offset} = this;
    inputMorph.topLeft = pt(offset, offset);
    inputMorph.width = listMorph.width = this.width - 2*offset;
    if (paddingMorph) {
      paddingMorph.topLeft = inputMorph.bottomLeft;
    }
    listMorph.position = paddingMorph ? paddingMorph.bottomLeft : inputMorph.bottomLeft;
    listMorph.height = this.height - listMorph.top - offset;
  }

  focus() { this.get("input").focus(); }

  selectionChanged(sel) { signal(this, "selection", sel); }

  scrollSelectionIntoView() { return this.listMorph.scrollSelectionIntoView(); }

  parseInput() {
    var filterText = this.get("input").textString,

        // parser that allows escapes
        parsed = Array.from(filterText).reduce(((state, char) => {
          // filterText = "foo bar\\ x"
          if (char === "\\" && !state.escaped) {
            state.escaped = true;
            return state;
          }

          if (char === " " && !state.escaped) {
            if (!state.spaceSeen && state.current) {
              state.tokens.push(state.current);
              state.current = "";
            }
            state.spaceSeen = true;
          } else {
            state.spaceSeen = false;
            state.current += char;
          }
          state.escaped = false;
          return state;
        }), {tokens: [], current: "", escaped: false, spaceSeen: false});
    parsed.current && parsed.tokens.push(parsed.current);
    var lowercasedTokens = parsed.tokens.map(ea => ea.toLowerCase());
    return {tokens: parsed.tokens, lowercasedTokens, input: filterText};
  }

  updateFilter() {
    var parsedInput = this.parseInput(),
        filterFunction = this.filterFunction,
        sortFunction = this.sortFunction,
        filteredItems = this.items.filter(item => filterFunction.call(this, parsedInput, item));

    if (sortFunction)
      filteredItems = arr.sortBy(filteredItems, ea => sortFunction.call(this, parsedInput, ea));

    var list = this.listMorph,
        newSelectedIndexes = this.updateSelectionsAfterFilter ?
          list.selectedIndexes.map(i => filteredItems.indexOf(list.items[i])).filter(i => i !== -1) :
          list.selectedIndexes;

    list.items = filteredItems;
    list.selectedIndexes = newSelectedIndexes.length ? newSelectedIndexes : filteredItems.length ? [0] : [];
    this.scrollSelectionIntoView();

    signal(this, "filterChanged", {parsedInput, items: list.items});
  }

  acceptInput() {
    var list = this.listMorph;
    this.get("input").acceptInput();
    var result = {
      filtered: this.items,
      selected: list.selections,
      action: this.selectedAction,
      status: "accepted",
    };
    signal(this, "accepted", result);
    return result;
  }

  get keybindings() {
    return [
      {keys: "Up|Ctrl-P",                    command: "arrow up"},
      {keys: "Down|Ctrl-N",                  command: "arrow down"},
      {keys: "Shift-Up",                     command: "select up"},
      {keys: "Shift-Down",                   command: "select down"},
      {keys: "Alt-V|PageUp",                 command: "page up"},
      {keys: "Ctrl-V|PageDown",              command: "page down"},
      {keys: "Alt-Shift-,",                  command: "goto first item"},
      {keys: "Alt-Shift-.",                  command: "goto last item"},
      {keys: "Enter",                        command: "accept input"},
      {keys: "Escape|Ctrl-G",                command: "cancel"},
      {keys: "Tab",                          command: "choose action"},
      ...arr.range(0, 8).map(n => {
        return {
          keys: "Alt-" + (n+1),
          command: {command: "choose action and accept input", args: {actionNo: n}}};
      })
    ].concat(super.keybindings);
  }

  get commands()  {
    return super.commands.concat([
      {
        name: "accept input",
        exec: (morph) => { this.acceptInput(); return true; }
      },

      {
        name: "cancel",
        exec: (morph) => {
          signal(morph, "canceled");
          return true;
        }
      },

      {
        name: "choose action and accept input",
        exec: (flist, args = {}) => {
          let {actionNo = 0} = args;
          flist.selectedAction = (flist.actions || [])[actionNo];
          return flist.execCommand("accept input");
        }
      },

      {
        name: "choose action",
        exec: async (morph) => {
          if (!morph.actions) return true;

          let similarStyle = {...morph.style, extent: morph.extent};
          let chooser = new FilterableList(similarStyle);
          chooser.openInWorld(morph.globalPosition);
          chooser.items = morph.actions;
          let preselect = morph.actions.indexOf(morph.selectedAction);
          if (preselect === -1) preselect = 0;
          chooser.selectedIndex = preselect;
          connect(chooser, 'accepted', morph, 'selectedAction', {
            converter: function(result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return result.selected[0];
            }
          });
          connect(chooser, 'canceled', morph, 'selectedAction', {
            converter: function(result) {
              this.targetObj.focus();
              this.disconnect();
              this.sourceObj.remove();
              return this.targetObj.selectedAction;
            }
          });
          chooser.focus();

          return true;
        }
      },

      ...listCommands.map(cmd =>
        ({...cmd, exec: (morph, opts, count) => cmd.exec(this.listMorph, opts, count)}))
    ]);
  }

}


export class DropDownList extends Button {

  // new DropDownList({selection: 1, items: [1,2,3,4]}).openInWorld()

  static get properties() {
    return {

      padding:      {defaultValue: Rectangle.inset(3,2)},
      listHeight: {defaultValue: 100},

      listAlign: {defaultValue: "bottom"/*or "top"*/},

      styleSheets: {
        initialize() {
          this.styleSheets = new StyleSheet({
            ".DropDownList [name=dropDownList]": {
              fontSize: 12,
              fontFamily: "Helvetica Neue, Arial, sans-serif",
              borderWidth: 1,
              borderColor: Color.gray
            },
            ".DropDownList.dark [name=dropDownList]": {
              fontColor: Color.white,
              nonSelectionFontColor: Color.white,
              selectionColor: Color.gray,
              selectionFontColor: Color.black,
              fill: Color.black.withA(.7),
              padding: rect(2,2,0,-2),
              borderRadius: 2,
              borderWidth: 0
            },
            ".Button.activeStyle": {
              fill: new LinearGradient({
                stops: [
                  {offset: 0, color: Color.white},
                  {offset: 1, color: new Color.rgb(236, 240, 241)}
                ]
              })
            }
          });
        }
      },

      listMorph: {
        after: ["labelMorph"],
        get() {
          let list = this.getProperty("listMorph");
          if (list) return list;
          list = new List({name: "dropDownList"});
          this.setProperty("listMorph", list);
          return list;
        }
      },

      label: {
        readOnly: true, after: ["labelMorph"],
        get() { return this.getSubmorphNamed("label"); }
      },

      items: {
        derived: true, after: ["listMorph"],
        get() { return this.listMorph.items; },
        set(value) { this.listMorph.items = value; }
      },

      selection: {
        after: ["listMorph", 'items'], derived: true,
        get() {
          return this.listMorph.selection;
        },
        set(value) {
          let {listAlign, listMorph} = this;

          if (!value) {
            listMorph.selection = null;
            this.label = "";

          } else {
            let {items} = listMorph,
                item = listMorph.find(value);
            if (!item && typeof value === "string") {
              item = items.find(ea => ea.string === value);
            }
            if (!item) return;

            let label = item.label || [item.string, null];
            this.label = [
              ...label, " ", null,
              ...Icon.textAttribute(
                "caret-" + (listAlign === "bottom" ?
                  "down" : "up"))
            ];

            listMorph.selectedIndex = items.indexOf(item);
          }
          signal(this, "selection", listMorph.selection);
        }
      }

    };

  }

  constructor(props) {
    super(props);
    connect(this, "fire", this, "toggleList");
  }

  isListVisible() { return this.listMorph.owner === this; }

  removeWhenFocusLost(evt) {
    setTimeout(() => {
      let list = this.listMorph,
          focused = this.world() && this.world().focusedMorph;
      if (list !== focused
      &&  !list.withAllSubmorphsDetect(m => m == focused))
        list.fadeOut(200);
    }, 100);
  }

  toggleList() {
    var list = this.listMorph;
    if (this.isListVisible()) {
      signal(this, "deactivated");
      this.selection = list.selection;
      list.remove();
    } else {
      signal(this, "activated");
      this.addMorph(list);
      list.extent = pt(this.width, this.listHeight);
      if (this.listAlign === "top") {
        list.bottomLeft = this.innerBounds().topLeft();
      } else {
        list.topLeft = this.innerBounds().bottomLeft();
      }
      once(list, 'onItemMorphClicked', this, 'toggleList');
      // once(list, 'onBlur', this, 'removeWhenFocusLost');
      list.focus();
    }
  }

  get commands() {
    return [
      {
        name: "accept",
        exec: () => {
          if (this.isListVisible()) this.toggleList();
          return true;
        }
      },

      {
        name: "cancel",
        exec: () => {
          if (this.isListVisible()) this.listMorph.remove();
          return true;
        }
      }
    ].concat(super.commands);
  }

  get keybindings() {
    return super.keybindings.concat([
      {keys: "Enter", command: "accept"},
      {keys: "Escape|Ctrl-G", command: "cancel"}
    ]);
  }

}
