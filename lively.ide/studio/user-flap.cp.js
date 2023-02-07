import { ViewModel, Image, Icon, Label, touchInputDevice, part, TilingLayout, Polygon, ShadowObject, Text, component } from 'lively.morphic';
import { Color, rect, pt } from 'lively.graphics';
import { login, retrieveGithubUserData } from 'lively.user/github-login.js';
import { arr, string } from 'lively.lang';
import { resource } from 'lively.resources';
class UserFlapModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['isUserFlap', 'isMaximized', 'updateNetworkIndicator', 'alignInWorld'];
        }
      },
      bindings: {
        get () {
          return [
            { signal: 'onBlur', handler: 'collapse' },
            { target: 'avatar', signal: 'onMouseDown', handler: 'maximize' },
            { target: 'keyboard input', signal: 'onMouseDown', handler: 'toggleKeyboardInput' },
            { target: 'profile item', signal: 'onMouseDown', handler: 'showCurrentUserInfo' },
            { target: 'logout item', signal: 'onMouseDown', handler: 'logoutCurrentUser' },
            { target: 'login item', signal: 'onMouseDown', handler: 'showCurrentUserLogin' },
            { target: 'register item', signal: 'onMouseDown', handler: 'showRegister' }
          ];
        }
      }
    };
  }

  get isUserFlap () { return true; }

  async collapse () {
    this.minimize();
    if (this.world().focusedMorph.ownerChain().includes(this.view)) { this.view.focus(); }
  }

  open () {
    this.openInWorld();
    this.showUser(this.currentUser(), false);
    this.alignInWorld(false);
    this.hasFixedPosition = true;
    return this;
  }

  showCurrentUserInfo () {
    this.showUserInfo(this.currentUser());
  }

  async logoutCurrentUser () {
    await this.minimize();
    await this.logout(this.currentUser());
  }

  showCurrentUserLogin () {
    this.showLogin(this.currentUser());
  }

  toggleKeyboardInput (active = !touchInputDevice) {
    const keyboardToggleButton = this.ui.keyboardInput;
    if (!active) {
      keyboardToggleButton.fontColor = this.fontColor;
      keyboardToggleButton.dropShadow = false;
    } else {
      keyboardToggleButton.fontColor = Color.rgb(0, 176, 255);
      keyboardToggleButton.dropShadow = this.haloShadow;
    }
  }

  currentUser () {
    // return UserRegistry.current.loadUserFromLocalStorage(config.users.authServerURL);
    return 'test user';
  }

  onUserChanged (evt) {
    this.showUser(evt.user || { name: '???' }, false);
  }

  onWorldResize (evt) { !this.isComponent && this.alignInWorld(); }

  relayout () { this.alignInWorld(); }

  async alignInWorld (animated) {
    const { owner } = this.view;
    if (!owner) return;

    if (this.view.hasFixedPosition && owner.isWorld) {
      this.view.topRight = pt(this.world().visibleBounds().width, 0);
    } else if (owner.isWorld) {
      const tr = $world.visibleBounds().topRight().withY(0).subXY(10, 0);
      if (animated) this.view.animate({ topRight: tr, duration: 200 });
      else this.view.topRight = tr;
    }
  }

  async minimize () {
    const menu = this.ui.userMenu;
    if (!menu) return;
    await menu.animate({
      opacity: 0,
      scale: 0.8,
      duration: 200
    });
    menu.visible = false;
  }

  ensureMenu () {
    const menu = this.ui.userMenu || this.view.addMorph(part(UserMenu, { name: 'user menu' })); // eslint-disable-line no-use-before-define
    menu.visible = false;
    menu.opacity = 0;
    menu.scale = 0.8;
    menu.position = this.ui.avatar.bottomCenter.addXY(0, 10);
    this.reifyBindings(); // since the menu is now present
    return menu;
  }

  async maximize () {
    if (!localStorage.getItem('gh_access_token')) {
      login();
    } else { retrieveGithubUserData(); }
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
    this.view.withMetaDo({ metaInteraction: true }, () => {
      const allItems = ['login item', 'logout item', 'profile item', 'register item'];
      arr.withoutAll(allItems, items)
        .map(name => this.view.getSubmorphNamed(name))
        .forEach(m => {
          m.visible = false;
          m.bringToFront();
        });
      items.map(name => this.view.getSubmorphNamed(name))
        .forEach(m => {
          m.visible = true;
        });
    });
  }

  async showUser (user, animated = false) {
    const { nameLabel, userMenu, avatar } = this.ui;
    let userName = String(user.name);
    const gravatar = resource('https://s.gravatar.com/avatar').join(string.md5(user.email || '')).withQuery({ s: 160 }).url;
    this.ensureMenu();
    if (userName.startsWith('guest-')) {
      this.showMenuItems(['login item', 'register item']);
      userName = 'guest';
    } else {
      this.showMenuItems(['logout item', 'profile item']);
    }
    nameLabel.value = userName;
    avatar.imageUrl = gravatar;
    if (userMenu) {
      userMenu.position = avatar.bottomCenter.addXY(0, 10);
    }
    this.alignInWorld();
  }

  // TODO:
  logout () {
    localStorage.removeItem('gh_access_token');
    $world.setStatusMessage('Logged out. No git operations possible.');
  }

  updateNetworkIndicator (l2lClient) {
    let color = 'red';
    if (l2lClient) {
      if (l2lClient.isOnline()) color = 'yellow';
      if (l2lClient.isRegistered()) color = 'green';
    }
    this.ui.networkIndicator.animate({
      fill: Color[color], duration: 300
    });
  }
}

// part(UserFlap).openInWorld()
export const UserFlap = component({
  name: 'user flap',
  defaultViewModel: UserFlapModel,
  borderColor: {
    bottom: Color.rgb(204, 204, 204),
    left: Color.rgb(204, 204, 204),
    right: Color.rgb(204, 204, 204),
    top: Color.rgb(255, 255, 255)
  },
  position: pt(580.2, 897.3),
  borderRadius: 7,
  clipMode: 'visible',
  extent: pt(362.3, 52.3),
  fontColor: Color.rgb(102, 102, 102),
  layout: new TilingLayout({
    axisAlign: 'center',
    align: 'right',
    orderByIndex: true,
    padding: {
      height: 0,
      width: 0,
      x: 10,
      y: 10
    },
    reactToSubmorphAnimations: false,
    renderViaCSS: true,
    spacing: 10
  }),
  submorphs: [{
    name: 'network-indicator',
    borderRadius: 5,
    extent: pt(5, 5),
    fill: Color.rgb(0, 204, 0),
    reactsToPointer: false
  }, {
    type: Label,
    name: 'name label',
    draggable: true,
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: {
      onlyAtInstantiation: true,
      value: Color.rgb(102, 102, 102)
    },
    fontSize: 16,
    grabbable: true,
    nativeCursor: 'pointer',
    reactsToPointer: false,
    textAndAttributes: Icon.textAttribute('github')
  }, {
    type: Label,
    name: 'name label',
    draggable: true,
    fill: Color.rgba(255, 255, 255, 0),
    fontColor: {
      onlyAtInstantiation: true,
      value: Color.rgb(102, 102, 102)
    },
    fontSize: 16,
    grabbable: true,
    nativeCursor: 'pointer',
    reactsToPointer: false,
    textAndAttributes: ['guest', null]
  }, {
    type: Image,
    name: 'avatar',
    borderRadius: 25,
    clipMode: 'hidden',
    dropShadow: new ShadowObject({ rotation: 72, color: Color.rgba(0, 0, 0, 0.47), blur: 5 }),
    extent: pt(30, 30),
    fill: Color.transparent,
    imageUrl: 'https://s.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=160',
    nativeCursor: 'pointer',
    naturalExtent: pt(160, 160)
  }]
});
// part(DarkUserFlap).openInWorld();
export const DarkUserFlap = component(UserFlap, {
  name: 'dark user flap',
  fill: Color.rgba(255, 255, 255, 0),
  submorphs: [{
    name: 'name label',
    fontColor: Color.white
  }, {
    name: 'user menu',
    position: pt(15, 40),
    scale: 0.8,
    opacity: 0,
    borderColor: Color.rgb(202, 207, 210),
    borderRadius: 5,
    borderWidth: 1,
    dropShadow: new ShadowObject({ distance: 7, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 20, fast: false }),
    extent: pt(146.3, 70.9),
    fill: Color.rgb(253, 254, 254),
    isLayoutable: false,
    origin: pt(121.7, -4.7),
    visible: false
  }, {
    name: 'avatar',
    imageUrl: 'https://s.gravatar.com/avatar/81fca83dcbbab5d52e990f7b76aa97ca?s=160'
  }]
});

const ProfileItem = component({
  type: Text,
  name: 'profile item',
  borderColor: Color.rgb(204, 204, 204),
  extent: pt(144, 28),
  fill: Color.rgba(0, 0, 0, 0),
  fixedWidth: true,
  fontFamily: 'IBM Plex Sans',
  fontSize: 16,
  nativeCursor: 'pointer',
  padding: rect(10, 3, -5, 0),
  textString: 'Profile',
  readOnly: true,
  selectable: false
});

const ProfileItemSelected = component(ProfileItem, {
  name: 'profile item selected',
  fill: Color.rgb(215, 219, 221)
});
// part(UserMenu).openInWorld()
const UserMenu = component({
  name: 'user menu',
  borderColor: Color.rgb(202, 207, 210),
  borderRadius: 5,
  borderWidth: 1,
  dropShadow: new ShadowObject({ distance: 7, rotation: 75, color: Color.rgba(0, 0, 0, 0.11), blur: 20, fast: false }),
  extent: pt(146.3, 35),
  fill: Color.rgb(253, 254, 254),
  isLayoutable: false,
  origin: pt(121.7, -4.7),
  submorphs: [{
    type: Polygon,
    name: 'menu shape',
    borderColor: Color.rgb(202, 207, 210),
    borderWidth: 1,
    extent: pt(20.2, 10.4),
    fill: Color.rgb(253, 254, 254),
    isLayoutable: false,
    position: pt(-10.5, -5.4),
    vertices: [{
      position: pt(0, 10),
      isSmooth: false,
      controlPoints: {
        next: pt(0, 0), previous: pt(0, 0)
      }
    }, {
      position: pt(10, 0),
      isSmooth: false,
      controlPoints: { next: pt(0, 0), previous: pt(0, 0) }
    }, {
      position: pt(20, 10),
      isSmooth: false,
      controlPoints: { next: pt(0, 0), previous: pt(0, 0) }
    }]
  }, {
    name: 'item container',
    layout: new TilingLayout({
      axis: 'column',
      orderByIndex: true,
      hugContentsVertically: true,
      resizePolicies: [
        ['login item', { width: 'fill', height: 'fixed' }],
        ['logout item', { width: 'fill', height: 'fixed' }]
      ]
    }),
    position: pt(-120.6, 10.9),
    clipMode: 'hidden',
    draggable: true,
    extent: pt(144.2, 65),
    fill: Color.rgba(46, 75, 223, 0),
    grabbable: true,
    submorphs: [
      part(ProfileItem, {
        name: 'login item',
        textString: 'Sign in',
        master: { hover: ProfileItemSelected }
      }),
      part(ProfileItem, {
        name: 'logout item',
        textString: 'Sign out',
        visible: false,
        master: { hover: ProfileItemSelected }
      })
    ]
  }]
});
