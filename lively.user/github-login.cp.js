import { component, TilingLayout, Ellipse, Image, ViewModel, Icon, part } from 'lively.morphic';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { pt, Color } from 'lively.graphics';
import { runCommand } from 'lively.ide/shell/shell-interface.js';

const livelyAuthGithubAppId = 'd523a69022b9ef6be515';
class GithubAuthModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'github login button', signal: 'onMouseDown', handler: 'onMouseDown' }
          ];
        }
      }
    };
  }

  async onMouseDown () {
    let cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'scope=repo' https://github.com/login/device/code`;
    const { stdout: resOne } = await runCommand(cmdString).whenDone();
    const deviceCode = resOne.match(new RegExp('device_code=(.*)&e'))[1];
    const userCode = resOne.match(new RegExp('user_code=(.*)&'))[1];
    // TODO: gracefully fail when aborted
    const confirmed = await $world.confirm(['Go to', null, 'GitHub', { link: 'https://github.com/login/device' }, `and enter ${userCode}`, null]);
    const indicator = $world.showLoadingIndicatorFor($world, 'Waiting for GitHub.com ...');
    // TODO: actually poll for the token
    cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'device_code=${deviceCode}' -F 'grant_type=urn:ietf:params:oauth:grant-type:device_code' https://github.com/login/oauth/access_token`;
    const { stdout: resTwo } = await runCommand(cmdString).whenDone();
    // TODO: error management
    this.accessToken = resTwo.match(new RegExp('access_token=(.*)&s'))[1];
    indicator.label = 'Testing Access Token';
    cmdString = `curl -H "Accept: application/vnd.github+json" -H "Authorization: Bearer ${this.accessToken}" https://api.github.com/user`;
    let { stdout: userRes } = await runCommand(cmdString).whenDone();
    userRes = JSON.parse(userRes);
    this.ui.loginIndicator.fill = Color.green;
    this.ui.avatarHolder.loadUrl(userRes.avatar_url, false);
    indicator.remove();
  }
}

// part(GithubAuthPanel).openInWorld()
export const GithubAuthPanel = component({
  name: 'github auth panel',
  defaultViewModel: GithubAuthModel,
  extent: pt(300, 300),
  fill: Color.gray,
  layout: new TilingLayout({
    axis: 'row'
  }),
  submorphs: [
    {
      name: 'login indicator',
      type: Ellipse,
      extent: pt(10, 10),
      fill: Color.red
    },
    part(ButtonDefault, {
      name: 'github login button',
      extent: pt(170, 35),
      submorphs: [
        {
          name: 'label',
          textAndAttributes: Icon.textAttribute('github').concat([' Login With GitHub', null])
        }
      ]
    }),
    {
      type: Image,
      extent: pt(80, 80),
      name: 'avatar holder',
      autoResize: true
    }
  ]
});
