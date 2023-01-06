/* global System */
import { promise, arr, string } from 'lively.lang';
import { resource } from 'lively.resources';
import { pt, Rectangle, Color } from 'lively.graphics';
import { connect, once, signal } from 'lively.bindings';
import { morph, easings, touchInputDevice, Icon, config, Morph, part } from 'lively.morphic';
import { Menu } from 'lively.components';
import { pathForBrowserHistory } from 'lively.morphic/helpers.js';
import { loadMorphFromSnapshot, createMorphSnapshot } from 'lively.morphic/serialization.js';
import UserRegistry from 'lively.user/client/user-registry.js';
import { ClientUser } from 'lively.user/index.js';

// das kostet was??? 99 euro ey.
// import * as AppleID from "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en_US/appleid.auth.js";
import ObjectPackage from 'lively.classes/object-classes.js';
import { defaultPropertiesPanelWidth } from 'lively.ide/studio/properties-panel.cp.js';
import { toggleSidebar, relayoutSidebarFlapInWorld, openSidebarFlapInWorld } from 'lively.ide/studio/sidebar-flap.js';

// adoptObject(that, UserInfoWidget)
// adoptObject(that, LoginWidget)
// adoptObject(that, RegisterWidget)

async function notify (target, msg) {
  const text = morph({
    type: 'text',
    textAlign: 'center',
    textString: msg,
    fill: null,
    padding: Rectangle.inset(10),
    fontSize: 30,
    fontColor: 'white',
    fontWeight: 'bold',
    readOnly: true,
    grabbable: false
  });

  const w = Math.max(target.width + 40, text.width);
  const h = Math.max(120, text.height);
  const notification = target.addMorph({
    extent: pt(w, h),
    border: { radius: 8 },
    name: 'notification',
    center: target.innerBounds().center(),
    origin: pt(w / 2, h / 2),
    fill: Color.gray,
    scale: 0.1,
    grabbable: false,
    submorphs: [text]
  });

  notification.submorphs[0].center = notification.innerBounds().center().subPt(pt(w / 2, h / 2));
  await notification.animate({ scale: 1, duration: 400 });
  await promise.delay(800);
  await notification.animate({ opacity: 0, duration: 400 });
  notification.remove();
}

export const UserUI = {

  getCurrentUser () {
    return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
  },

  // fixme: move this logic into the top bar itself...
  async showUserFlap (world = $world) {
    const { TopBar } = await System.import('lively.ide/studio/top-bar.cp.js');
    const topBar = part(TopBar);
    topBar.epiMorph = true;
    topBar.name = 'lively top bar';
    topBar.hasFixedPosition = true;
    topBar.respondsToVisibleWindow = true;
    topBar.openInWorld();
    topBar.relayout();
    topBar.top = -topBar.height; // tell top bar to hide
    const dropShadow = topBar.dropShadow;
    topBar.dropShadow = null;
    topBar.attachToTarget(world);
    $world.onTopBarLoaded();
    // FIXME
    System.import('lively.2lively/client.js');
    (async () => {
      topBar.showCurrentUser();
      await topBar.animate({ position: pt(0, 0), dropShadow, duration: 500 }); // tell top bar to show in
      if (!world.metadata) {
        await world.animate({
          customTween: p => {
            topBar.blur = world.blur = p * 3;
          },
          duration: 500
        });
        const worldName = await world.askForName();
        world.name = worldName;
        world.changeMetaData('commit', { name: worldName });
        if (window.history) {
          window.history.pushState({}, 'lively.next', pathForBrowserHistory(worldName));
        }
        // fixme: We do not want to subclass the world class. This is just a temporary solution
        //        to reliably load the package at all times the world is loaded
        const pkg = ObjectPackage.withId(string.camelCaseString(worldName));
        await pkg.adoptObject(world);
        await world.animate({
          customTween: p => {
            topBar.blur = world.blur = (1 - p) * 3;
          },
          duration: 500
        });
      }
      const { LivelyVersionChecker } = await System.import('lively.ide/studio/version-checker.cp.js');
      const versionChecker = part(LivelyVersionChecker);
      versionChecker.name = 'lively version checker';
      versionChecker.openInWorld();
      versionChecker.relayout();
      versionChecker.checkVersion();

      const { WorldZoomIndicator } = await System.import('lively.ide/studio/zoom-indicator.cp.js');
      const zoomIndicator = part(WorldZoomIndicator);
      zoomIndicator.openInWorld();
      zoomIndicator.name = 'world zoom indicator';
      zoomIndicator.relayout();

      const { Flap } = await System.import('lively.ide/studio/flap.cp.js');
      const sceneGraphFlap = part(Flap, { viewModel: { target: 'scene graph', action: toggleSidebar, openingRoutine: openSidebarFlapInWorld, relayoutRoutine: relayoutSidebarFlapInWorld } }).openInWorld();
      connect(sceneGraphFlap, 'position', versionChecker, 'relayout');
      const propertiesPanelFlap = part(Flap, { viewModel: { target: 'properties panel', action: toggleSidebar, openingRoutine: openSidebarFlapInWorld, relayoutRoutine: relayoutSidebarFlapInWorld } }).openInWorld();
      connect(propertiesPanelFlap, 'position', zoomIndicator, 'relayout');
    })();
    return topBar;
  },

  hideUserFlap (world = $world) {
    world.submorphs
      .filter(ea => ea.name === 'user flap' && ea.owner === world)
      .forEach(ea => ea.remove());
  },

  async showWidget (widgetName, options = {}) {
    const { modal = true, user = this.getCurrentUser() } = options;
    const widget = await this.loadMorph(widgetName);
    return widget.run(modal, options.world, user);
  },

  async showUserInfo (options = {}) {
    return await this.showWidget('user info', options);
  },
  async showLogin (options = {}) { return this.showWidget('login widget', options); },
  async showRegister (options = {}) { return this.showWidget('register widget', options); },

  async loadMorph (name, options) {
    switch (name) {
      case 'login widget':
        return await resource('part://SystemUserUI/login widget').read();
      case 'user info':
        return await resource('part://SystemUserUI/user info').read();
      case 'register widget':
        return await resource('part://SystemUserUI/register widget').read();
    }
    const url = System.decanonicalize(`lively.user/morphic/${name}.json`);
    const snap = await resource(url).readJson();
    return loadMorphFromSnapshot(snap, options);
  }

};

class UserWidget extends Morph {
  static get properties () {
    return {
      user: {}
    };
  }

  run (withOverlay = true, world = $world, user) {
    // await this.copy().run()
    if (withOverlay) {
      const overlay = world.addMorph({ // eslint-disable-line no-unused-vars
        name: this.name + ' overlay',
        hasFixedPosition: true,
        grabbable: false,
        draggable: false,
        extent: world.extent,
        fill: Color.black.withA(0.4)
      });
    }
    this.hasFixedPosition = true;
    this.epiMorph = true;
    this.activate(user);
    return new Promise((resolve, reject) => {
      once(this, 'resolved', resolve);
    }).then(result => {
      this.remove();
      overlay && overlay.remove();
      return result;
    });
  }

  activate (user) {
    const w = $world;
    w.addMorph(this);
    this.align(this.worldPoint(this.innerBounds().center()), w.visibleBounds().center());
    this.focus();
  }

  onKeyDown (evt) {
    if (evt.keyCombo === 'Enter') { this.onEnterPressed(); evt.stop(); }
    if (evt.keyCombo === 'Escape') { this.onEscapePressed(); evt.stop(); }
    if (evt.keyCombo === 'Tab') { this.focusNext(); evt.stop(); }
    if (evt.keyCombo === 'Shift-Tab') { this.focusPrev(); evt.stop(); }
  }

  focusOrder () {
    return [];
  }

  focusNext () {
    const focusOrder = this.focusOrder();
    const focused = this.world().focusedMorph;
    let nextIndex = focusOrder.indexOf(focused) + 1;
    if (nextIndex > focusOrder.length - 1) nextIndex = 0;
    focusOrder[nextIndex].focus();
  }

  focusPrev () {
    const focusOrder = this.focusOrder();
    const focused = this.world().focusedMorph;
    let nextIndex = focusOrder.indexOf(focused) - 1;
    if (nextIndex < 0) nextIndex = focusOrder.length - 1;
    focusOrder[nextIndex].focus();
  }

  onEscapePressed () { this.close(); }
  onEnterPressed () {}

  close () {}

  // -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-

  async _save () {
    // await this._save();
    const snap = await createMorphSnapshot(this);
    await lively.modules.module(`lively.user/morphic/${this.name}.json`).changeSource(JSON.stringify(snap, null, 2), { doEval: false });
  }

  async _htmlExport () {
    // await this._htmlExport();
    const m = lively.modules.module;
    const url = m(`lively.user/html/${this.name}.html`).id;
    const res = resource(url);
    const { generateHTML } = await m('lively.morphic/rendering/html-generator.js').load();
    const html = await generateHTML(this, res, { isFragment: true, addStyles: false });
    return { resource: res, html };
  }

  htmlExport_transformNode (node) {
    const morphs = this.focusOrder();
    morphs.forEach((m, i) => node.querySelector('#' + m.id).tabIndex = i + 1);
    return node;
  }
}

export class UserInfoWidget extends UserWidget {
  get ui () {
    return {
      userNameInput: this.getSubmorphNamed('user name input'),
      passwordInput: this.getSubmorphNamed('password input'),
      passwordInput2: this.getSubmorphNamed('password input 2'),
      emailInput: this.getSubmorphNamed('email input'),
      saveButton: this.getSubmorphNamed('save button'),
      logoutButton: this.getSubmorphNamed('logout button'),
      closeButton: this.getSubmorphNamed('close button'),
      userAvatar: this.getSubmorphNamed('user avatar')
    };
  }

  activate (user) {
    super.activate(user);
    this.displayUser(user);
  }

  focus () {
    this.ui.userNameInput.focus();
  }

  focusOrder () {
    const {
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

  onEnterPressed () { this.trySave(); }

  reset () {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });

    connect(this.ui.saveButton, 'fire', this, 'trySave');
    connect(this.ui.logoutButton, 'fire', this, 'logout');
    connect(this.ui.closeButton, 'onMouseDown', this, 'close');
    this.ui.userNameInput.readOnly = true;
    this.ui.userNameInput.selectable = true;
    notify(this, 'OK');
  }

  displayUser (user) {
    this.user = user;
    const { name, email } = user || {};
    const {
      userNameInput, emailInput, passwordInput,
      passwordInput2, userAvatar
    } = this.ui;
    userNameInput.input = name || '';
    emailInput.input = email || '';
    passwordInput.input = '';
    passwordInput2.input = '';
    userAvatar.imageUrl = resource('https://s.gravatar.com/avatar').join(string.md5(email || '')).withQuery({ s: 320 }).url;
  }

  async trySave () {
    const {
      user, ui: {
        emailInput,
        passwordInput,
        passwordInput2
      }
    } = this;

    if (!user) return this.showError('no user object');

    const email = emailInput.input;
    const password = passwordInput.input;
    const password2 = passwordInput2.input;

    // if (!email && !password && !password2) return this.world().inform("Nothing changed", {requester: this});
    if (user.email === email && !password && !password2) return signal(this, 'resolved', user);

    if (password || password2) {
      if (password !== password2) return this.world().inform('Passwords do not match!', { requester: this });

      const oldPassword = await this.world().passwordPrompt(
        'To set a new password, please enter your old one', { requester: this });

      if (!oldPassword) { return this.world().inform('Old password needed to change password, aborting!', { requester: this }); }

      const matches = await user.checkPassword(oldPassword);
      if (!matches) { return this.world().inform('Old password is not correct, aborting!', { requester: this }); }
    }

    const changes = {};
    if (password) changes.password = password;
    if (email) changes.email = email;
    const { status, error } = await user.modify(changes);

    if (error) { return this.world().inform('Failed to modify: ' + error, { requester: this }); }

    await UserRegistry.current.saveUserToLocalStorage(user);
    await notify(this, status);

    this.displayUser(user);

    signal(this, 'resolved', user);
  }

  async logout () {
    await UserRegistry.current.logout(this.user);
    this.displayUser(this.user);
    // await notify(this, "logged out");
    this.remove();
    const user = await UserUI.showLogin({ modal: false });
    signal(this, 'resolved', user);
  }

  close () { signal(this, 'resolved', this.user); }

  onMouseUp (evt) {
    const { closeButton, saveButton } = this.ui;
    switch (evt.targetMorph) {
      case closeButton:
        this.close();
        break;
      case saveButton:
        this.trySave();
        break;
    }
  }
}

export class LoginWidget extends UserWidget {
  get ui () {
    return {
      userNameInput: this.getSubmorphNamed('user name input'),
      passwordInput: this.getSubmorphNamed('password input'),
      loginButton: this.getSubmorphNamed('login button'),
      registerButton: this.getSubmorphNamed('register button'),
      guestButton: this.getSubmorphNamed('guest button'),
      emailLoginForm: this.getSubmorphNamed('email login form'),
      googleLogin: this.getSubmorphNamed('google login'),
      emailLogin: this.getSubmorphNamed('email login'),
      appleLogin: this.getSubmorphNamed('apple login')
    };
  }

  async signInWithGoogle () {
    const { gapi } = await System.import('https://apis.google.com/js/platform.js');
    gapi.load('auth2', async () => {
      gapi.auth2.init({
        client_id: 'CLIENT_ID.apps.googleusercontent.com'
      });
      // const GoogleAuth = gapi.auth2.getAuthInstance();
      // const user = await GoogleAuth.signIn();
    });
  }

  async signInWithEmail () {
    const { emailLoginForm, googleLogin, emailLogin, appleLogin } = this.ui;
    const easing = easings.inOutExpo;
    const duration = 300;

    [googleLogin, emailLogin, appleLogin].map(m => m.animate({
      visible: false,
      isLayoutable: false,
      easing,
      duration
    }));

    emailLoginForm.animate({
      visible: true,
      isLayoutable: true,
      easing,
      duration
    });
  }

  focus () {
    this.ui.userNameInput.focus();
  }

  focusOrder () {
    return [
      this.ui.userNameInput,
      this.ui.passwordInput
    ];
  }

  // this.reset()

  reset () {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });

    const {
      loginButton, registerButton, userNameInput, appleLogin,
      passwordInput, emailLoginForm, googleLogin, emailLogin
    } = this.ui;

    connect(loginButton, 'fire', this, 'tryLogin');
    connect(registerButton, 'fire', this, 'switchToRegisterWidget');
    connect(emailLogin, 'fire', this, 'signInWithEmail');
    connect(googleLogin, 'fire', this, 'loginWithGoogle');

    userNameInput.input = '';
    passwordInput.input = '';

    emailLoginForm.isLayoutable = emailLoginForm.visible = false;
    [emailLogin, appleLogin, googleLogin].map(m => m.visible = m.isLayoutable = true);
  }

  onEnterPressed () { this.tryLogin(); }

  async tryLogin () {
    const {
      ui: {
        userNameInput,
        passwordInput
      }
    } = this;

    const username = userNameInput.input;
    const password = passwordInput.input;
    if (!username) return;

    const user = ClientUser.named(username, config.users.authServerURL); let error;
    try {
      await UserRegistry.current.login(user, password);
    } catch (err) { error = err.message; }

    if (error) {
      signal(this, 'loginFailed', error);
      if (error.includes('No user')) this.indicateError(this.ui.userNameInput, error);
      if (error.includes('does not match')) this.indicateError(this.ui.passwordInput, 'Password incorrect');
      return;
    }

    notify(this, 'logged in');
    signal(this, 'loginSucceeded', user);
    signal(this, 'resolved', user);
  }

  async switchToRegisterWidget () {
    const user = await UserUI.showRegister({ modal: false });
    if (user) signal(this, 'resolved', user);
  }

  async continueAsGuest () {
    const reg = UserRegistry.current;
    const stored = reg.loadUserFromLocalStorage(config.users.authServerURL);
    const user = stored.isGuestUser ? stored : await reg.login(ClientUser.guest);
    signal(this, 'resolved', user);
  }

  indicateError (input, message) {
    input.indicateError(message);
  }

  clearErrors () {
    this.ui.userNameInput.clearError();
    this.ui.passwordInput.clearError();
  }

  onMouseUp (evt) {
    const { loginButton, registerButton } = this.ui;
    switch (evt.targetMorph) {
      case loginButton:
        this.tryLogin();
        break;
      case registerButton:
        this.switchToRegisterWidget();
        break;
    }
  }
}

export class RegisterWidget extends UserWidget {
  get ui () {
    return {
      userNameInput: this.getSubmorphNamed('user name input'),
      emailInput: this.getSubmorphNamed('email input'),
      passwordInput: this.getSubmorphNamed('password input'),
      passwordInput2: this.getSubmorphNamed('password input 2'),
      registerButton: this.getSubmorphNamed('register button'),
      cancelButton: this.getSubmorphNamed('cancel button')
    };
  }

  onEnterPressed () { this.tryRegister(); }

  focus () {
    this.ui.userNameInput.focus();
  }

  focusOrder () {
    return [
      this.ui.userNameInput,
      this.ui.emailInput,
      this.ui.passwordInput,
      this.ui.passwordInput2
    ];
  }

  reset () {
    this.withAllSubmorphsDo(ea => { ea.draggable = false; ea.grabbable = false; });

    connect(this.ui.registerButton, 'fire', this, 'tryRegister');
    connect(this.ui.cancelButton, 'fire', this, 'close');
    this.ui.userNameInput.readOnly = true;
    this.ui.userNameInput.selectable = true;
    notify(this, 'OK');
  }

  displayUser (user) {
    this.user = user;
    // let {name = "", email = ""} = user || {};
    // this.ui.userNameInput.input = name;
    // this.ui.emailInput.input = email;
    // this.ui.passwordInput.input = "";
    // this.ui.passwordInput2.input = "";
  }

  async tryRegister () {
    const {
      ui: {
        userNameInput,
        emailInput,
        passwordInput,
        passwordInput2
      }
    } = this;

    const username = userNameInput.input;
    const email = emailInput.input;
    const password = passwordInput.input;
    const password2 = passwordInput2.input;

    if (!username || !password || !password2 || !email) {
      if (!username) userNameInput.indicateError('Please enter a user name!');
      if (!email) emailInput.indicateError('Please enter E-Mail address!');
      if (!password) passwordInput.indicateError('Please enter a password!');
      if (!password2) passwordInput2.indicateError('Please repeat your password!');
      return;
    }

    if (password !== password2) {
      passwordInput2.indicateError('Passwords do not match!');
      return;
    }

    const user = ClientUser.named(username, config.users.authServerURL);
    if (email) user.email = email;

    let error;
    try {
      await UserRegistry.current.register(user, password);
    } catch (err) { error = err; }

    if (error) { return this.world().inform('Failed to register: ' + error, { requester: this }); }

    await notify(this, 'registered');

    this.displayUser(user);
    signal(this, 'resolved', user);
  }

  close () {
    signal(this, 'resolved', this.user);
  }

  onMouseUp (evt) {
    const { registerButton, cancelButton } = this.ui;
    switch (evt.targetMorph) {
      case registerButton:
        this.tryRegister();
        break;
      case cancelButton:
        this.close();
        break;
    }
  }
}

export class UserFlap extends Morph {
  static get properties () {
    return {
      submorphs: {
        initialize () {
          this.submorphs = [
            {
              type: 'label',
              name: 'label',
              fontSize: 12,
              fontFamliy: 'sans-serif',
              fontWeight: 'bold',
              padding: Rectangle.inset(4),
              reactsToPointer: false
            },

            Icon.makeLabel('user', {
              name: 'avatar',
              fontColor: Color.black.withA(0.3),
              fontSize: 12,
              clipMode: 'hidden',
              padding: Rectangle.inset(2, 2, 4, 0),
              borderWidth: 1,
              borderColor: Color.black.withA(0.3),
              extent: pt(20, 20),
              borderRadius: 10
            }),

            {
              name: 'network-indicator',
              fill: Color.red,
              borderRadius: 5,
              extent: pt(5, 5),
              position: pt(5, 8),
              reactsToPointer: false
            }
          ];
        }
      },

      fontColor: {
        after: ['submorphs'],
        set (c) {
          this.setProperty('fontColor', c);
        }
      },

      name: { initialize () { this.name = 'user flap'; } },
      epiMorph: { defaultValue: true },
      clipMode: { defaultValue: 'hidden' },
      draggable: { defaultValue: false },
      grabbable: { defaultValue: false },
      acceptsDrops: { defaultValue: false },
      fill: { defaultValue: Color.white },
      borderRadius: { defaultValue: 10 },
      nativeCursor: { defaultValue: 'pointer' },
      respondsToVisibleWindow: { defaultValue: true },
      haloColor: {
        readOnly: true,
        get () {
          return Color.rgb(0, 176, 255);
        }
      },
      haloShadow: {
        readOnly: true,
        get () {
          return {
            distance: 2,
            rotation: 45,
            color: Color.rgba(64, 196, 255, 0.4),
            inset: false,
            blur: 6,
            spread: 0,
            fast: false
          };
        }
      }
    };
  }

  get isUserFlap () { return true; }

  get isMaximized () { return this.submorphs.length > 3; }

  async onLoad () {
    await this.whenEnvReady();
    this.showUser(this.currentUser());
  }

  async open () {
    this.openInWorld();
    this.showUser(this.currentUser(), false);
    this.alignInWorld(false);
    this.hasFixedPosition = true;
    return this;
  }

  async onMouseDown (evt) {
    const target = evt.targetMorph.name;
    const user = this.currentUser();
    switch (target) {
      case 'profile item':
        return this.showUserInfo(user);
      case 'logout item':
        await this.minimize();
        await this.logout(user);
        return;
      case 'login item':
        await this.showLogin(user);
        return;
      case 'register item':
        this.showRegister();
        break;
      case 'user flap':
        this.maximize();
        break;
      case 'keyboard input':
        this.toggleKeyboardInput();
        break;
    }
  }

  // this.get('user flap').toggleKeyboardInput(false)

  toggleKeyboardInput (active = !touchInputDevice) {
    touchInputDevice = active; // but this does not really have a system wide effect unfortunately
    const keyboardToggleButton = this.get('keyboard input');
    if (!active) {
      keyboardToggleButton.fontColor = this.fontColor;
      keyboardToggleButton.dropShadow = false;
    } else {
      keyboardToggleButton.fontColor = Color.rgb(0, 176, 255);
      keyboardToggleButton.dropShadow = this.haloShadow;
    }
  }

  currentUser () {
    return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
  }

  onUserChanged (evt) {
    this.showUser(evt.user || { name: '???' }, false);
  }

  onWorldResize (evt) { !this.isComponent && this.alignInWorld(); }

  relayout () { this.alignInWorld(); }

  alignInWorld (animated) {
    if (this.hasFixedPosition && this.owner.isWorld) {
      this.topRight = pt(this.world().visibleBounds().width, 0);
    } else if (this.owner.isWorld) {
      const tr = $world.visibleBounds().topRight().withY(0).subXY(10, 0);
      if (animated) this.animate({ topRight: tr, duration: 200 });
      else this.topRight = tr;
    }
  }

  async minimize () {
    const menu = this.getSubmorphNamed('user menu');
    if (!menu) return;
    await menu.animate({
      opacity: 0,
      scale: 0.8,
      duration: 200
    });
    menu.visible = false;
  }

  async ensureMenu () {
    if (this._menuFetch) {
      return await this._menuFetch;
    }
    const p = promise.deferred();
    this._menuFetch = p.promise;
    const menu = this.getSubmorphNamed('user menu') || this.addMorph(await resource('part://SystemIDE/user menu master').read());
    menu.name = 'user menu';
    menu.visible = false;
    menu.opacity = 0;
    menu.scale = 0.8;
    menu.position = this.getSubmorphNamed('avatar').bottomCenter.addXY(0, 10);
    p.resolve(menu);
  }

  async maximize () {
    let menu = this.getSubmorphNamed('user menu');
    if (!menu) {
      menu = await this.ensureMenu();
    }
    menu.right = this.width - 5;
    menu.visible = true;
    await menu.animate({
      opacity: 1,
      scale: 1,
      duration: 200
    });
  }

  async changeWidthAndHeight (newWidth, newHeight, animated) {
    if (animated) {
      await this.animate({
        position: this.position.addXY(this.width - newWidth, 0),
        extent: pt(newWidth, newHeight),
        duration: 200
      });
    } else {
      this.extent = pt(newWidth, newHeight);
      this.position = this.position.addXY(this.width - newWidth, 0);
    }
  }

  showMenuItems (items) {
    const allItems = ['login item', 'logout item', 'profile item', 'register item'];
    arr.withoutAll(allItems, items)
      .map(name => this.getSubmorphNamed(name))
      .forEach(m => {
        m.visible = false;
        m.bringToFront();
      });
    items.map(name => this.getSubmorphNamed(name))
      .forEach(m => {
        m.visible = true;
      });
  }

  // this.showUser(this.currentUser())

  async showUser (user, animated = false) {
    const label = this.getSubmorphNamed('label');
    const menu = this.getSubmorphNamed('user menu');
    const avatar = this.getSubmorphNamed('avatar');
    let userName = String(user.name);
    const gravatar = resource('https://s.gravatar.com/avatar').join(string.md5(user.email || '')).withQuery({ s: 160 }).url;
    await this.ensureMenu();
    if (userName.startsWith('guest-')) {
      this.showMenuItems(['login item', 'register item']);
      userName = 'guest';
    } else {
      this.showMenuItems(['logout item', 'profile item']);
    }
    label.value = userName;
    avatar.imageUrl = gravatar;
    if (menu) {
      await menu.master.whenApplied();
      menu.position = avatar.bottomCenter.addXY(0, 10);
    }
    this.alignInWorld();
  }

  showRegister () { return UserUI.showRegister(); }
  showUserInfo (user) { return UserUI.showUserInfo({ user }); }
  showLogin (user) { return UserUI.showLogin({ user }); }
  logout (user) { return UserRegistry.current.logout(user); }

  async onBlur (evt) {
    this.minimize();
    if (this.world().focusedMorph.ownerChain().includes(this)) { this.focus(); }
  }

  async showMenu (user, animated = false) {
    const label = this.getSubmorphNamed('label');
    const avatar = this.getSubmorphNamed('avatar');
    const openChatItem = ['open chat', async () => { }];
    const menu = Object.assign(Menu.forItems(
      user.isGuestUser
        ? [
            openChatItem,
            ['login', async () => {
              this.minimize();
              this.showLogin(user);
            }]
          ]
        : [
            ['show user info', () => { this.minimize(); this.showUserInfo(user); }],
            openChatItem,
            ['logout', async () => { await this.minimize(); this.logout(user); }]
          ]), {
      name: 'menu',
      position: pt(10, 5),
      dropShadow: false,
      opacity: animated ? 0 : 1,
      borderWidth: 0,
      fontSize: 12,
      fontFamily: 'sans-serif'
    });
    avatar.visible = false;
    label.visible = false;
    this.addMorph(menu);
    if (animated) menu.animate({ opacity: 1, duration: 200 });
    await this.changeWidthAndHeight(
      menu.width + 20, menu.height + 10, animated);
  }

  updateNetworkIndicator (l2lClient) {
    let color = 'red';
    if (l2lClient) {
      if (l2lClient.isOnline()) color = 'yellow';
      if (l2lClient.isRegistered()) color = 'green';
    }
    this.get('network-indicator').animate({
      fill: Color[color], duration: 300
    });
  }
}
