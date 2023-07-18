import { ViewModel, ShadowObject, Image, Icon, Label, TilingLayout, component } from 'lively.morphic';
import { pt, Color } from 'lively.graphics';
import { currentUser, clearUserData, clearAllUserData, storeCurrentUser, storeCurrentUsersOrganizations, currentUsertoken, storeCurrentUsertoken } from 'lively.user';
import { signal } from 'lively.bindings';
import { runCommand } from 'lively.ide/shell/shell-interface.js';
import { StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { part } from 'lively.morphic/components/core.js';
import { Spinner } from 'lively.ide/studio/shared.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { waitFor, delay, timeToRun } from 'lively.lang/promise.js';
import { DarkPrompt, ConfirmPrompt } from 'lively.components/prompts.cp.js';
import { SystemButton } from 'lively.components/buttons.cp.js';

const livelyAuthGithubAppId = 'd523a69022b9ef6be515';

const CompactConfirmPrompt = component(ConfirmPrompt, {
  master: DarkPrompt,
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(15, 15, 0, 0),
    resizePolicies: [['prompt title', {
      height: 'fixed',
      width: 'fill'
    }], ['button wrapper', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 16
  }),
  submorphs: [{
    name: 'prompt title',
    fixedWidth: true,
    fixedHeight: true,
    height: 90
  }]
});

class UserFlapModel extends ViewModel {
  static get properties () {
    return {
      withLoginButton: {
        defaultValue: false
      },
      bindings: {
        get () {
          return [
            { target: 'login button', signal: 'onMouseDown', handler: 'login' },
            { target: 'left user label', signal: 'onMouseDown', handler: 'leftUserLabelClicked' },
            { target: 'right user label', signal: 'onMouseDown', handler: 'rightUserLabelClicked' }
          ];
        }
      },
      expose: {
        get () {
          return ['updateNetworkIndicator', 'showUserData', 'onLogin', 'showLoggedInUser', 'showGuestUser', 'toggleLoadingAnimation', 'login', 'update'];
        }
      }
    };
  }

  async update (){
    clearUserData();
    await this.retrieveGithubUserData();
    this.showUserData()
  }

  leftUserLabelClicked () {
    if (currentUser().login === 'guest') this.login();
  }

  rightUserLabelClicked () {
    if (currentUser().login !== 'guest') this.logout();
  }

  toggleLoadingAnimation () {
    const { spinner, avatar } = this.ui;
    spinner.visible = !spinner.visible;
    avatar.visible = this.withLoginButton ? false : !avatar.visible;
  }

  async viewDidLoad () {
    const { loginButton, leftUserLabel, rightUserLabel, avatar } = this.ui;
    if (currentUser().login === 'guest') {
      if (this.withLoginButton) {
        avatar.visible = false;
        loginButton.visible = loginButton.isLayoutable = true;
        leftUserLabel.visible = rightUserLabel.visible = false;
      } else {
        leftUserLabel.tooltip = 'Login with GitHub';
        rightUserLabel.tooltip = '';
      }
    } else {
      await this.update();
      this.showUserData();
      leftUserLabel.tooltip = '';
      rightUserLabel.tooltip = 'Logout';
      rightUserLabel.nativeCursor = 'pointer';
      leftUserLabel.nativeCursor = 'auto';
    }
  }

  async login () {
    if ($world.get('github login prompt')) return;
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
    // GitHub sends us an Interval (in s) that we need to wait between polling for login status, otherwise we get timeouted
    const interval = resOne.match(/interval=(\d*)&/)[1];
    this.toggleLoadingAnimation();
    let confirm;
    window.open('https://github.com/login/device', 'Github Authentification', 'width=500,height=600,top=100,left=100');
    $world.confirm(['Enter \n', null, `${userCode}`, { fontColor: Color.lively }, '\nin the popup to login!', null], {
      name: 'github login prompt',
      customize: (prompt) => {
        prompt.master = CompactConfirmPrompt;
        prompt.width = 300;
        prompt.position = $world.visibleBounds().center().subXY(150, prompt.height / 2);
      }
    }).then(conf => {
      confirm = conf;
    });
    cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'device_code=${deviceCode}' -F 'grant_type=urn:ietf:params:oauth:grant-type:device_code' https://github.com/login/oauth/access_token`;
    let curlCmd;
    let loginSuccessful = false;
    for (let i = 0; i < 20; i++) {
      let elapsedTimeWaitingForGitHub = await timeToRun(waitFor(interval * 1000, () => confirm !== undefined, false));
      if (confirm === true) {
        // Assumes that one logged in successfuly when pressing OK, we still need to wait in case GitHub wants us to
        if (elapsedTimeWaitingForGitHub < interval * 1000) {
          await delay((interval * 1000) - elapsedTimeWaitingForGitHub);
        }
      }
      if (confirm === false) {
        this.toggleLoadingAnimation();
        $world.setStatusMessage('Login aborted by user.');
        return;
      }
      curlCmd = await runCommand(cmdString).whenDone();
      if (curlCmd.exitCode === 0 && !curlCmd.stdout.includes('error')) {
        loginSuccessful = true;
        $world.get('github login prompt')?.remove();
        break;
      }
    }

    if (!loginSuccessful) {
      this.toggleLoadingAnimation();
      $world.setStatusMessage('Login failed.', StatusMessageError);
      return;
    }

    const { stdout: resTwo } = curlCmd;
    const userToken = resTwo.match(new RegExp('access_token=(.*)&s'))[1];
    if (!userToken) {
      this.toggleLoadingAnimation();
      $world.setStatusMessage('An unexpected error occured. Please contact the lively.next team.', StatusMessageError);
      return;
    }
    storeCurrentUsertoken(userToken);
    await this.retrieveGithubUserData();
    this.toggleLoadingAnimation();
    this.showLoggedInUser();
  }

  showLoggedInUser () {
    const { leftUserLabel, rightUserLabel, avatar, loginButton } = this.ui;

    leftUserLabel.visible = rightUserLabel.visible = avatar.visible = true;
    loginButton.visible = loginButton.isLayoutable = false;

    this.showUserData();

    signal(this.view, 'onLogin');
    rightUserLabel.tooltip = 'Logout';
    leftUserLabel.tooltip = '';
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
    clearAllUserData();
    this.showGuestUser();
    signal(this.view, 'onLogout');
    $world.setStatusMessage('Logged out. No git operations possible.');
  }

  showGuestUser () {
    const { loginButton, leftUserLabel, rightUserLabel, avatar } = this.ui;
    if (this.withLoginButton) {
      leftUserLabel.visible = rightUserLabel.visible = avatar.visible = false;
      loginButton.visible = loginButton.isLayoutable = true;
    } else {
      leftUserLabel.tooltip = 'Login with GitHub';
      rightUserLabel.tooltip = '';
      leftUserLabel.nativeCursor = 'pointer';
      rightUserLabel.nativeCursor = 'auto';
      leftUserLabel.textAndAttributes = Icon.textAttribute('github');
      rightUserLabel.textString = 'guest';
      avatar.loadUrl('https://s.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?s=160', false);
    }
  }

  showUserData () {
    const { avatar, leftUserLabel, rightUserLabel } = this.ui;
    try {
      const userData = currentUser();
      if (userData.login === 'guest') return;
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
  clipMode: 'hidden',
  extent: pt(362.3, 52.3),
  fill: Color.transparent,
  fontColor: Color.rgb(102, 102, 102),
  layout: new TilingLayout({
    align: 'right',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    orderByIndex: true,
    padding: rect(10, 10, 0, 0),
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
  }, part(Spinner, {
    viewModel: { color: 'black' },
    name: 'spinner',
    visible: false,
    position: pt(5.3, 4.2),
    scale: 0.3
  }), part(SystemButton, {
    name: 'login button',
    extent: pt(230, 40),
    isLayoutable: false,
    visible: false,
    submorphs: [{
      name: 'label',
      fontSize: 18,
      fontWeight: 900,
      textAndAttributes: ['To proceed, login with', null, ' ', {
        fontFamily: '"Font Awesome 6 Free", "Font Awesome 6 Brands"'
      }]
    }]
  })
  ]
});
