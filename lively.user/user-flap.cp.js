import { ViewModel, ShadowObject, Image, Icon, Label, TilingLayout, component } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { currentUser, clearUserData, storeCurrentUser, storeCurrentUsersOrganizations, currentUsertoken, storeCurrentUsertoken } from 'lively.user';
import { connect, signal, disconnect } from 'lively.bindings';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import { StatusMessageError } from 'lively.halos/components/messages.cp.js';

const livelyAuthGithubAppId = 'd523a69022b9ef6be515';

class UserFlapModel extends ViewModel {
  static get properties () {
    return {
      expose: {
        get () {
          return ['updateNetworkIndicator', 'showUserData', 'onLogin', 'showLoggedInUser'];
        }
      }
    };
  }

  viewDidLoad () {
    const { leftUserLabel, rightUserLabel } = this.ui;
    if (!currentUser().login === 'guest') {
      connect(leftUserLabel, 'onMouseDown', this, 'login');
      leftUserLabel.tooltip = 'Login with GitHub';
    } else {
      this.showUserData();
      connect(rightUserLabel, 'onMouseDown', this, 'logout');
      rightUserLabel.tooltip = 'Logout';
      rightUserLabel.nativeCursor = 'pointer';
      leftUserLabel.nativeCursor = 'auto';
    }
  }

  async login () {
    let cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'scope=user,repo,workflow' https://github.com/login/device/code`;
    const { stdout: resOne } = await runCommand(cmdString).whenDone();
    if (resOne === '') {
      $world.setStatusMessage('You seem to be offline.', StatusMessageError);
      return;
    }
    if (resOne === 'NOT FOUND') {
      $world.setStatusMessage('An unexpected error occured. Please contact the lively.next team.', StatusMessageError);
      return;
    }
    const deviceCodeMatch = resOne.match(new RegExp('device_code=(.*)&e'));
    const userCodeMatch = resOne.match(new RegExp('user_code=(.*)&'));
    if (!deviceCodeMatch || !userCodeMatch) {
      $world.setStatusMessage('An unexpected error occured. Please contact the lively.next team.', StatusMessageError);
      return;
    }
    const deviceCode = deviceCodeMatch[1];
    const userCode = userCodeMatch[1];
    const confirm = await $world.confirm(['Go to ', null, 'GitHub', { doit: { code: 'window.open(\'https://github.com/login/device\',\'Github Authentification\',\'width=500,height=600,top=100,left=500\')' }, fontColor: Color.link }, ` and enter\n${userCode}\n Afterwards, confirm with OK.`, null]);
    if (!confirm) return;
    cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'device_code=${deviceCode}' -F 'grant_type=urn:ietf:params:oauth:grant-type:device_code' https://github.com/login/oauth/access_token`;
    const { stdout: resTwo } = await runCommand(cmdString).whenDone();
    const userToken = resTwo.match(new RegExp('access_token=(.*)&s'))[1];
    if (!userToken) {
      $world.setStatusMessage('An unexpected error occured. Please contact the lively.next team.', StatusMessageError);
      return;
    }
    storeCurrentUsertoken(userToken);
    await this.retrieveGithubUserData();
    this.showLoggedInUser();
  }

  showLoggedInUser () {
    const { leftUserLabel, rightUserLabel } = this.ui;
    this.showUserData();

    disconnect(leftUserLabel, 'onMouseDown', this, 'login');
    connect(rightUserLabel, 'onMouseDown', this, 'logout');
    signal(this.view, 'onLogin');
    rightUserLabel.tooltip = 'Logout';
    rightUserLabel.nativeCursor = 'pointer';
    leftUserLabel.nativeCursor = 'auto';
  }

  async retrieveGithubUserData () {
    const token = currentUsertoken();
    // retrieve general data about the authenticated user
    const cmdString = `curl -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${token}" https://api.github.com/user`;
    let { stdout: userRes } = await runCommand(cmdString).whenDone();
    if (!userRes || userRes === '') {
      $world.setStatusMessage('An unexpected error occured. Please check your connection.', StatusMessageError);
      return;
    }
    // retrieve the organizations in which the authenticated user is a member
    const organizationCmdString = `curl -L \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer ${token}"\
      -H "X-GitHub-Api-Version: 2022-11-28" \
      https://api.github.com/user/orgs`;
    let { stdout: orgsResForUser } = await runCommand(organizationCmdString).whenDone();
    if (!userRes || userRes === '') {
      $world.setStatusMessage('An unexpected error occured. Please check your connection.', StatusMessageError);
      return;
    }
    const orgNames = JSON.parse(orgsResForUser).map(org => org.login);
    storeCurrentUsersOrganizations(orgNames);
    storeCurrentUser(userRes);
  }

  logout () {
    const { leftUserLabel, rightUserLabel, avatar } = this.ui;
    connect(leftUserLabel, 'onMouseDown', this, 'login');
    leftUserLabel.tooltip = 'Login with GitHub';
    disconnect(rightUserLabel, 'onMouseDown', this, 'logout');
    leftUserLabel.nativeCursor = 'pointer';
    rightUserLabel.nativeCursor = 'auto';

    clearUserData();

    $world.setStatusMessage('Logged out. No git operations possible.');
    leftUserLabel.textAndAttributes = Icon.textAttribute('github');
    rightUserLabel.textString = 'guest';
    avatar.loadUrl('https://s.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=160', false);
  }

  showUserData () {
    const { avatar, leftUserLabel, rightUserLabel } = this.ui;
    try {
      const userData = currentUser();
      avatar.loadUrl(userData.avatar_url, false);
      leftUserLabel.textString = userData.login;
      rightUserLabel.textAndAttributes = Icon.textAttribute('right-from-bracket');
    } catch (err) {
      $world.setStatusMessage('An unexpected error occured. Please contact the lively.next team.', StatusMessageError);
    }
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
    hugContentsHorizontally: true,
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
