/*global System*/
import { promise } from "lively.lang/index.js";
import { resource } from "lively.resources";
import { pt, Rectangle, Color } from "lively.graphics/index.js";
import { connect, once, signal } from "lively.bindings/index.js";
import { morph, Icon, Menu, config } from "lively.morphic/index.js";
import { Morph } from "lively.morphic/morph.js";
import { loadMorphFromSnapshot, createMorphSnapshot } from "lively.morphic/serialization.js";
import UserRegistry from "lively.user/client/user-registry.js";
import { ClientUser } from "lively.user/index.js";
import { loadPart } from "lively.morphic/partsbin.js";

// adoptObject(that, UserInfoWidget) 
// adoptObject(that, LoginWidget) 
// adoptObject(that, RegisterWidget) 

async function notify(target, msg) {
  let text = morph({
    type: "text", textAlign: "center",
    textString: msg,
    fill: null,
    padding: Rectangle.inset(10),
    fontSize: 30, fontColor: "white", fontWeight: "bold",
    readOnly: true, grabbable: false
  });
  
  let w = Math.max(target.width + 40, text.width),
      h = Math.max(120, text.height),
      notification = target.addMorph({
        extent: pt(w, h), border: {radius: 8},
        name: "notification",
        center: target.innerBounds().center(),
        origin: pt(w/2, h/2),
        fill: Color.gray,
        scale: .1,
        grabbable: false,
        submorphs: [text]
      });

  notification.submorphs[0].center = notification.innerBounds().center().subPt(pt(w/2, h/2));
  await notification.animate({scale: 1, duration: 400});
  await promise.delay(800);
  await notification.animate({opacity: 0, duration: 400});
  notification.remove();
}


export var UserUI = {

  getCurrentUser() {
    return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
  },

  showUserFlap(world = $world) {
    this.hideUserFlap(world);
    let flap = new UserFlap().open();
    // FIXME
    System.import("lively.2lively/client.js").then(m =>
      flap.updateNetworkIndicator(m.default.default()))
    return flap;
  },

  hideUserFlap(world = $world) {
    world.submorphs
      .filter(ea => ea.name === "user flap")
      .forEach(ea => ea.remove());
  },

  async showWidget(widgetName, options = {}) {
    let {modal = true, user = this.getCurrentUser()} = options,
        widget = await this.loadMorph(widgetName);
    return widget.run(modal, options.world, user);
  },

  async showUserInfo(options = {}) {
    return this.showWidget("user info", options);
    // let {user = this.getCurrentUser()} = options;
    // return user.isGuestUser ? this.showLogin(options) : this.showWidget("user info", options);
  },
  async showLogin(options = {}) { return this.showWidget("login widget", options); },
  async showRegister(options = {}) { return this.showWidget("register widget", options); },

  async loadMorph(name, options) {
    let url = System.decanonicalize(`lively.user/morphic/${name}.json`),
        snap = await resource(url).readJson();
    return loadMorphFromSnapshot(snap, options);
  }

}


class UserWidget extends Morph {

  static get properties() {
    return {
      user: {}
    }
  }

  run(withOverlay = true, world = $world, user) {
    // await this.copy().run()
    if (withOverlay) {
      var overlay = world.addMorph({
        name: this.name + " overlay",
        grabbable: false, draggable: false,
        extent: world.extent,
        fill: Color.black.withA(.4)
      });
    }
    this.activate(user);
    return new Promise((resolve, reject) => {
      once(this, "resolved", resolve);
    }).then(result => {
      this.remove();
      overlay && overlay.remove();
      return result;
    });
  }

  activate(user) {
    let w = $world;
    w.addMorph(this);
    this.align(this.worldPoint(this.innerBounds().center()), w.visibleBounds().center())
    this.focus();
  }

  onKeyDown(evt) {
    if (evt.keyCombo === "Enter") { this.onEnterPressed(); evt.stop(); }
    if (evt.keyCombo === "Escape") { this.onEscapePressed(); evt.stop(); }
    if (evt.keyCombo === "Tab") { this.focusNext(); evt.stop(); }
    if (evt.keyCombo === "Shift-Tab") { this.focusPrev(); evt.stop(); }
  }

  focusOrder() {
    return [];
  }

  focusNext() {
    let focusOrder = this.focusOrder(),
        focused = this.world().focusedMorph,
        nextIndex = focusOrder.indexOf(focused) + 1;
    if (nextIndex > focusOrder.length-1) nextIndex = 0;
    focusOrder[nextIndex].focus();
  }

  focusPrev() {
    let focusOrder = this.focusOrder(),
        focused = this.world().focusedMorph,
        nextIndex = focusOrder.indexOf(focused) - 1;
    if (nextIndex < 0) nextIndex = focusOrder.length-1;
    focusOrder[nextIndex].focus();
  }

  onEscapePressed() { this.close(); }
  onEnterPressed() {}

  close() {}
  
  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
  

  async _save() {
    // await this._save();
    let snap = await createMorphSnapshot(this)
    await lively.modules.module(`lively.user/morphic/${this.name}.json`).changeSource(JSON.stringify(snap, null, 2), {doEval: false});
  }

  async _htmlExport() {
    // await this._htmlExport();
    let m = lively.modules.module,
        url = m(`lively.user/html/${this.name}.html`).id,
        res = resource(url),
        { generateHTML } = await m("lively.morphic/rendering/html-generator.js").load(),
        html = await generateHTML(this, res, {isFragment: true, addStyles: false});
    return {resource: res, html};
  }
  
  htmlExport_transformNode(node) {
    let morphs = this.focusOrder();
    morphs.forEach((m, i) => node.querySelector("#" + m.id).tabIndex = i + 1);
    return node;
  }

}

export class UserInfoWidget extends UserWidget {

  get ui() {
    return {
      userNameInput: this.getSubmorphNamed("user name input"),
      passwordInput: this.getSubmorphNamed("password input"),
      passwordInput2: this.getSubmorphNamed("password input 2"),
      emailInput: this.getSubmorphNamed("email input"),
      saveButton: this.getSubmorphNamed("save button"),
      logoutButton: this.getSubmorphNamed("logout button"),
      closeButton: this.getSubmorphNamed("close button"),
    }
  }

  activate(user) {
    super.activate(user);
    this.displayUser(user);
  }

  focus() {
    this.ui.userNameInput.focus();
  }

  focusOrder() {
    let {
      ui: {
        userNameInput,
        emailInput,
        passwordInput,
        passwordInput2
      }
    } = this;

    return [
      userNameInput,
      emailInput,
      passwordInput,
      passwordInput2];
  }

  onEnterPressed() { this.trySave(); }

  reset() {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });

    connect(this.ui.saveButton, 'fire', this, 'trySave');
    connect(this.ui.logoutButton, 'fire', this, 'logout');
    connect(this.ui.closeButton, 'onMouseDown', this, 'close');
    this.ui.userNameInput.readOnly = true;
    this.ui.userNameInput.selectable = true
    notify(this, "OK")
  }

  displayUser(user) {
    this.user = user;
    let {name, email} = user || {};
    this.ui.userNameInput.input = name || "";
    this.ui.emailInput.input = email || "";
    this.ui.passwordInput.input = "";
    this.ui.passwordInput2.input = "";
  }

  async trySave() {
    let {
      user, ui: {
        userNameInput,
        emailInput,
        passwordInput,
        passwordInput2
      }
    } = this;

    if (!user) return this.showError("no user object");

    let username = userNameInput.input,
        email = emailInput.input,
        password = passwordInput.input,
        password2 = passwordInput2.input;

    // if (!email && !password && !password2) return this.world().inform("Nothing changed", {requester: this});
    if (user.email == email && !password && !password2) return signal(this, "resolved", user);

    if (password || password2) {

      if (password !== password2) return this.world().inform("Passwords do not match!", {requester: this});

      let oldPassword = await this.world().passwordPrompt(
        "To set a new password, please enter your old one", {requester: this});

      if (!oldPassword)
        return this.world().inform("Old password needed to change password, aborting!", {requester: this});

      let matches = await user.checkPassword(oldPassword);
      if (!matches)
        return this.world().inform("Old password is not correct, aborting!", {requester: this});

    }

    let changes = {};
    if (password) changes.password = password;
    if (email) changes.email = email;
    let {status, error} = await user.modify(changes);

    if (error)
      return this.world().inform("Failed to modify: " + error, {requester: this});;

    await UserRegistry.current.saveUserToLocalStorage(user);
    await notify(this, status);

    this.displayUser(user);

    signal(this, "resolved", user);
  }

  async logout() {
    await UserRegistry.current.logout(this.user);
    this.displayUser(this.user);
    // await notify(this, "logged out");
    this.remove();
    let user = await UserUI.showLogin({modal: false});
    signal(this, "resolved", user);
  }

  close() { signal(this, "resolved", this.user); }

}


export class LoginWidget extends UserWidget {

  get ui() {
    return {
      userNameInput: this.getSubmorphNamed("user name input"),
      passwordInput: this.getSubmorphNamed("password input"),
      loginButton: this.getSubmorphNamed("login button"),
      registerButton: this.getSubmorphNamed("register button"),
      guestButton: this.getSubmorphNamed("guest button"),
    }
  }

  focus() {
    this.ui.userNameInput.focus();
  }

  focusOrder() {
    return [
      this.ui.userNameInput,
      this.ui.passwordInput];
  }

  reset() {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });

    connect(this.ui.loginButton, 'fire', this, 'tryLogin');
    connect(this.ui.registerButton, 'fire', this, 'switchToRegisterWidget');
    connect(this.ui.guestButton, 'fire', this, 'continueAsGuest');

    this.ui.userNameInput.input = "";
    this.ui.passwordInput.input = "";

    notify(this, "OK")
  }

  onEnterPressed() { this.tryLogin(); }

  async tryLogin() {
    let {
      ui: {
        userNameInput,
        passwordInput,
      }
    } = this;

    let username = userNameInput.input,
        password = passwordInput.input;
    if (!username) return;

    let user = ClientUser.named(username, config.users.authServerURL), error;
    try {
      await UserRegistry.current.login(user, password);
    } catch (err) { error = err.message; }

    if (error) {
      signal(this, "loginFailed", error);
      this.world().inform(error, {requester: this});
      return;
    }

    notify(this, "logged in");
    signal(this, "loginSucceeded", user);
    signal(this, "resolved", user);
  }

  async switchToRegisterWidget() {
    let user = await UserUI.showRegister({modal: false});
    if (user) signal(this, "resolved", user);
  }

  async continueAsGuest() {
    let reg = UserRegistry.current,
        stored = reg.loadUserFromLocalStorage(config.users.authServerURL),
        user = stored.isGuestUser ? stored : await reg.login(ClientUser.guest);
    signal(this, "resolved", user);
  }

}

export class RegisterWidget extends UserWidget {

  get ui() {
    return {
      userNameInput: this.getSubmorphNamed("user name input"),
      emailInput: this.getSubmorphNamed("email input"),
      passwordInput: this.getSubmorphNamed("password input"),
      passwordInput2: this.getSubmorphNamed("password input 2"),
      registerButton: this.getSubmorphNamed("register button"),
      cancelButton: this.getSubmorphNamed("cancel button"),
    }
  }

  onEnterPressed() { this.tryRegister(); }

  focus() {
    this.ui.userNameInput.focus();
  }

  focusOrder() {
    return [
      this.ui.userNameInput,
      this.ui.emailInput,
      this.ui.passwordInput,
      this.ui.passwordInput2
    ];
  }

  reset() {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });
    
    connect(this.ui.registerButton, 'fire', this, 'tryRegister');
    connect(this.ui.cancelButton, 'fire', this, 'close');
    this.ui.userNameInput.readOnly = true;
    this.ui.userNameInput.selectable = true
    notify(this, "OK")
  }

  displayUser(user) {
    this.user = user;
    // let {name = "", email = ""} = user || {};
    // this.ui.userNameInput.input = name;
    // this.ui.emailInput.input = email;
    // this.ui.passwordInput.input = "";
    // this.ui.passwordInput2.input = "";
  }

  async tryRegister() {
    let {
      ui: {
        userNameInput,
        emailInput,
        passwordInput,
        passwordInput2
      }
    } = this;

    let username = userNameInput.input,
        email = emailInput.input,
        password = passwordInput.input,
        password2 = passwordInput2.input;

    if (!username || !password || !password2)
      return this.world().inform("Please check your input", {requester: this});

    if (password !== password2)
      return this.world().inform("Passwords do not match!", {requester: this});

    
    let user = ClientUser.named(username, config.users.authServerURL);
    if (email) user.email = email;

    let error;
    try {
      await UserRegistry.current.register(user, password);
    } catch (err) { error = err; }

    if (error)
      return this.world().inform("Failed to register: " + error, {requester: this});

    await notify(this, "registed");

    this.displayUser(user);
    signal(this, "resolved", user);
  }

  close() {
    signal(this, "resolved", this.user);
  }
}

export class UserFlap extends Morph {

  static get properties() {
    return {
      submorphs: {
        initialize() {
          this.submorphs = [
          {
            type: "label", name: "label",
            fontSize: 12,
            fontFamliy: "Helvetica Neue, Verdana, Sans Serif",
            fontWeight: "bold",
            padding: Rectangle.inset(4),
            reactsToPointer: false
          }, 

           Icon.makeLabel('user', {
             name: 'avatar', 
             fontColor: Color.black.withA(.3),
             fontSize: 12,
             clipMode: 'hidden',
             padding: Rectangle.inset(2, 2, 4, 0),
             borderWidth: 1,
             borderColor: Color.black.withA(.3),
             extent: pt(20,20),
             borderRadius: 10
           }),

            {
              name: "network-indicator",
              fill: Color.red, borderRadius: 5,
              extent: pt(5,5), position: pt(5,8),
              reactsToPointer: false
            },
          ];
        }
      },

      name: {initialize() { this.name = "user flap"; }},
      epiMorph: {defaultValue: true},
      clipMode: {defaultValue: 'hidden'},
      draggable: {defaultValue: false},
      grabbable: {defaultValue: false},
      acceptsDrops: {defaultValue: false},
      fill: {defaultValue: Color.white},
      borderLeft: {defaultValue: {width: 1, color: Color.gray}},
      borderRight: {defaultValue: {width: 1, color: Color.gray}},
      borderBottom: {defaultValue: {width: 1, color: Color.gray}},
      borderRadiusBottom: {defaultValue: 10},
      borderRadiusLeft: {defaultValue: 10},
      borderRadiusRight: {defaultValue: 10},
      nativeCursor: {defaultValue: "pointer"},
    }
  }

  get isUserFlap() { return true; }

  get isMaximized() { return this.submorphs.length > 3; }

  open() {
    this.openInWorld();
    this.showUser(this.currentUser(), false);
    this.alignInWorld(false);
    this.hasFixedPosition = true;
    return this;
  }

  onMouseDown(evt) {
    if (!this.isMaximized) this.maximize();
  }

  currentUser() {
    return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
  }

  onUserChanged(evt) {
    // console.log("user changed!!!", evt)
    if (!this.isMaximized) this.showUser(evt.user || {name: "???"}, false);
  }

  onWorldResize(evt) { this.alignInWorld(); }

  alignInWorld(animated) {
    let w = $world.visibleBounds().width;
    if (animated) this.animate({topRight: pt(w - 10, 0)});
    else this.topRight = pt(w - 10, 0);
  }

  async minimize() {
    await this.showUser(this.currentUser(), true);
    this.get("network-indicator").visible = true;
  }

  async maximize() {
    this.get("network-indicator").visible = false;
    await this.showMenu(this.currentUser(), true);
  }

  async changeWidthAndHeight(newWidth, newHeight, animated) {
    if (animated) {
      await this.animate({
        position: this.position.addXY(this.width - newWidth, 0),
        extent: pt(newWidth, newHeight),
        duration: 500
      });
    }
    else {
      this.extent = pt(newWidth, newHeight);
      this.position = this.position.addXY(this.width - newWidth, 0);
    }
  }

  async showUser(user, animated = false) {
    let label = this.getSubmorphNamed("label"),
        menu = this.getSubmorphNamed("menu"),
        avatar = this.getSubmorphNamed("avatar"),
        userName = String(user.name);
    if (userName.startsWith("guest-")) userName = "guest";
    avatar.visible = true;
    label.visible = true;
    label.value = [userName, {fontColor: Color.gray.darker()}];
    label.fit();
    avatar.fit();
    if (menu && animated) menu.animate({opacity: 0, duration: 500});
    await this.changeWidthAndHeight(label.width + 20 + avatar.width, label.height, animated);
    label.leftCenter = this.innerBounds().insetBy(10).leftCenter();
    avatar.leftCenter = label.rightCenter;
    menu && menu.remove();
  }

  showUserInfo(user) { return UserUI.showUserInfo({user}); }
  showLogin(user) { return UserUI.showLogin({user}); }
  logout(user) { UserRegistry.current.logout(user); }

  onBlur(evt) {
    this.minimize();
  }

  async showMenu(user, animated = false) {
    let label = this.getSubmorphNamed("label"),
        avatar = this.getSubmorphNamed('avatar'),
        openChatItem = ["open chat", async () => {
          let chat = await loadPart("Lively Chat");
          chat.openInWorld();
        }],
        menu = Object.assign(Menu.forItems(
          user.isGuestUser ? [
            openChatItem,
            ["login", () => { this.minimize(); this.showLogin(user); }],
          ] :
          [
            ["show user info", () => { this.minimize(); this.showUserInfo(user); }],
            openChatItem,
            ["logout", async () => { await this.minimize(); this.logout(user); }],
          ]), {
            name: "menu",
            position: pt(10, 5),
            dropShadow: false,
            opacity: animated ? 0 : 1,
            borderWidth: 0,
            fontSize: 12,
            fontFamily: "Helvetica Neue, Verdana, Sans Serif"
          });
    avatar.visible = false;
    label.visible = false;
    this.addMorph(menu);
    if (animated) menu.animate({opacity: 1, duration: 500});
    await this.changeWidthAndHeight(
      menu.width + 20, menu.height + 10, animated);
  }

  updateNetworkIndicator(l2lClient) {
    let color = "red";
    if (l2lClient) {
      if (l2lClient.isOnline()) color = "yellow";
      if (l2lClient.isRegistered()) color = "green";
    }
    this.get("network-indicator").fill = Color[color];
  }
}
