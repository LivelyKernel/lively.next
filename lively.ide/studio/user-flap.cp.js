import { ViewModel, Image, Icon, Label, TilingLayout, ShadowObject, component } from 'lively.morphic';
import { Color, pt } from 'lively.graphics';

import { connect, disconnect } from 'lively.bindings';
import { runCommand } from '../shell/shell-interface.js';

const livelyAuthGithubAppId = 'd523a69022b9ef6be515';

class UserFlapModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['updateNetworkIndicator', 'showUserData'];
        }
      }
    };
  }

  viewDidLoad () {
    if (!localStorage.getItem('gh_user_data')) {
      connect(this.ui.leftUserLabel, 'onMouseDown', this, 'login');
      this.ui.leftUserLabel.tooltip = 'Login with GitHub';
    } else {
      this.showUserData();
      connect(this.ui.rightUserLabel, 'onMouseDown', this, 'logout');
      this.ui.rightUserLabel.tooltip = 'Logout';
      this.ui.rightUserLabel.nativeCursor = 'pointer';
      this.ui.leftUserLabel.nativeCursor = 'auto';
    }
  }

  async login () {
    let cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'scope=repo' https://github.com/login/device/code`;
    const { stdout: resOne } = await runCommand(cmdString).whenDone();
    const deviceCode = resOne.match(new RegExp('device_code=(.*)&e'))[1];
    const userCode = resOne.match(new RegExp('user_code=(.*)&'))[1];
    const confirm = await $world.confirm(['Go to ', null, 'GitHub', { doit: { code: 'window.open(\'https://github.com/login/device\',\'Github Authentification\',\'width=500,height=600,top=100,left=500\')' }, fontColor: Color.blue }, ` and enter\n${userCode}\n Afterwards, confirm with OK.`, null]);
    if (!confirm) return;
    cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'device_code=${deviceCode}' -F 'grant_type=urn:ietf:params:oauth:grant-type:device_code' https://github.com/login/oauth/access_token`;
    const { stdout: resTwo } = await runCommand(cmdString).whenDone();
    const userToken = resTwo.match(new RegExp('access_token=(.*)&s'))[1];
    if (!userToken) return;
    localStorage.setItem('gh_access_token');
    await this.retrieveGithubUserData();
    this.showUserData();

    disconnect(this.ui.leftUserLabel, 'onMouseDown', this, 'login');
    connect(this.ui.rightUserLabel, 'onMouseDown', this, 'logout');
    this.ui.rightUserLabel.tooltip = 'Logout';
    this.ui.rightUserLabel.nativeCursor = 'pointer';
    this.ui.leftUserLabel.nativeCursor = 'auto';
  }

  async retrieveGithubUserData () {
    const cmdString = `curl -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${localStorage.getItem('gh_access_token')}" https://api.github.com/user`;
    let { stdout: userRes } = await runCommand(cmdString).whenDone();
    localStorage.setItem('gh_user_data', userRes);
  }

  logout () {
    connect(this.ui.leftUserLabel, 'onMouseDown', this, 'login');
    this.ui.leftUserLabel.tooltip = 'Login with GitHub';
    disconnect(this.ui.rightUserLabel, 'onMouseDown', this, 'logout');
    this.ui.leftUserLabel.nativeCursor = 'pointer';
    this.ui.rightUserLabel.nativeCursor = 'auto';

    localStorage.removeItem('gh_access_token');
    localStorage.removeItem('gh_user_data');

    $world.setStatusMessage('Logged out. No git operations possible.');
    this.ui.leftUserLabel.textAndAttributes = Icon.textAttribute('github');
    this.ui.rightUserLabel.textString = 'guest';
    this.ui.avatar.loadUrl('https://s.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=160', false);
  }

  showUserData () {
    const userData = JSON.parse(localStorage.getItem('gh_user_data'));
    this.ui.avatar.loadUrl(userData.avatar_url, false);
    this.ui.leftUserLabel.textString = userData.login;
    this.ui.rightUserLabel.textAndAttributes = Icon.textAttribute('right-from-bracket');
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

export const UserFlap = component({
  name: 'user flap',
  defaultViewModel: UserFlapModel,
  borderWidth: 0,
  position: pt(580.2, 897.3),
  borderRadius: 7,
  clipMode: 'visible',
  extent: pt(362.3, 52.3),
  fill: Color.transparent,
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
    name: 'left user label',
    draggable: true,
    fontColor: {
      onlyAtInstantiation: true,
      value: Color.rgb(102, 102, 102)
    },
    fontSize: 16,
    nativeCursor: 'pointer',
    textAndAttributes: Icon.textAttribute('github')
  }, {
    type: Label,
    name: 'right user label',
    fontColor: Color.rgb(102, 102, 102),
    fontSize: 16,
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
    naturalExtent: pt(160, 160)
  }]
});
