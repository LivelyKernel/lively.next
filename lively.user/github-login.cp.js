import { component, InputLine, Label, TilingLayout, Ellipse, Image, ViewModel, Icon, part } from 'lively.morphic';
import { ButtonDefault } from 'lively.components/buttons.cp.js';
import { pt, Color } from 'lively.graphics';
import { runCommand, defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { resource } from 'lively.resources';
import { StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';

const livelyAuthGithubAppId = 'd523a69022b9ef6be515';

/**
 * accessToken
 * projectName
 */
class GithubAuthModel extends ViewModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'github login button', signal: 'onMouseDown', handler: 'onLoginPressed' },
            { target: 'project confirm button', signal: 'onMouseDown', handler: 'onProjectConfirmed' },
            { target: 'repo status button', signal: 'onMouseDown', handler: 'onRepoStatusPressed' },
            { target: 'remote status button', signal: 'onMouseDown', handler: 'onRemoteStatusPressed' },
            { target: 'push button', signal: 'onMouseDown', handler: 'onPush' },
            { target: 'pull button', signal: 'onMouseDown', handler: 'onPull' }
          ];
        }
      }
    };
  }

  async onLoginPressed () {
    let cmdString = `curl -X POST -F 'client_id=${livelyAuthGithubAppId}' -F 'scope=repo' https://github.com/login/device/code`;
    const { stdout: resOne } = await runCommand(cmdString).whenDone();
    const deviceCode = resOne.match(new RegExp('device_code=(.*)&e'))[1];
    const userCode = resOne.match(new RegExp('user_code=(.*)&'))[1];
    // TODO: gracefully fail when aborted
    const confirmed = await $world.confirm(['Go to', null, 'GitHub', { link: 'https://github.com/login/device' }, `and enter ${userCode}`, null]); // eslint-disable-line no-unused-vars
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
    this.ui.githubNameLabel.textString = userRes.login;
    this.user = userRes.login;
    this.ui.accessTokenLabel.textString = this.accessToken;
    indicator.remove();
  }

  async onProjectConfirmed () {
    this.projectName = this.ui.projectName.textString;
    this.resourceHandle = resource(await defaultDirectory()).join('..').join('projects').join(this.projectName).withRelativePartsResolved().asDirectory();
  }

  async onRepoStatusPressed () {
    $world.setStatusMessage('start');
    const isDir = await this.resourceHandle.isDirectory();
    if (!isDir) {
      $world.setStatusMessage('No Directory For Project found. :O');
      return;
    }
    const isRepo = await this.resourceHandle.isGitRepository();
    if (isRepo) $world.setStatusMessage('Yai!', StatusMessageConfirm);
    else {
      await this.resourceHandle.initializeGitRepository();
      $world.setStatusMessage('Initialized Repository');
    }
    $world.setStatusMessage('stop');
  }

  async onRemoteStatusPressed () {
    const hasRemote = await this.resourceHandle.isGitRepository(true);
    if (hasRemote) $world.setStatusMessage('all set');
    // FIXME: repository can also belong to another user or an organization
    else await this.resourceHandle.addRemoteToGitRepository(this.accessToken, this.projectName, this.user);
  }

  async onPush () {
    this.resourceHandle.pushGitRepo();
  }

  async onPull () {
    this.resourceHandle.pullGitRepo();
  }
}

// part(GithubAuthPanel).openInWorld()
export const GithubAuthPanel = component({
  name: 'github auth panel',
  defaultViewModel: GithubAuthModel,
  extent: pt(300, 300),
  fill: Color.gray,
  layout: new TilingLayout({
    axis: 'column'
  }),
  submorphs: [
    {
      name: 'upper container',
      layout: new TilingLayout({
        axis: 'column',
        align: 'center',
        axisAlign: 'center'
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
          imageUrl: 'https://www.absoluteanime.com/avatar_the_last_airbender/aang[2].jpg',
          autoResize: true
        }]
    },
    {
      name: 'lower container',
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'row'
      }),
      submorphs: [
        {
          type: Label,
          name: 'github name label',
          textString: 'username'
        }, {
          type: Label,
          name: 'access token label',
          textString: 'token'
        },
        {
          name: 'input container',
          fill: Color.transparent,
          layout: new TilingLayout({
            axis: 'column'
          }),
          submorphs: [
            {
              type: Label,
              textString: 'Project Name: '
            },
            {
              type: InputLine,
              name: 'project name'
            },
            part(ButtonDefault, {
              name: 'project confirm button',
              extent: pt(95, 25),
              submorphs: [
                {
                  name: 'label',
                  value: 'Confirm Name'
                }
              ]
            })
          ]
        }
      ]
    },
    {
      name: 'lowest container',
      fill: Color.transparent,
      width: 300,
      layout: new TilingLayout({
        axis: 'row',
        wrapSubmorphs: true
      }),
      submorphs: [
        part(ButtonDefault, {
          name: 'repo status button',
          extent: pt(95, 25),
          submorphs: [
            {
              name: 'label',
              value: 'Repo Status'
            }
          ]
        }),
        part(ButtonDefault, {
          name: 'remote status button',
          extent: pt(95, 25),
          submorphs: [
            {
              name: 'label',
              value: 'remote status'
            }
          ]
        }),
        part(ButtonDefault, {
          name: 'push button',
          extent: pt(95, 25),
          submorphs: [
            {
              name: 'label',
              value: 'Push'
            }
          ]
        }),
        part(ButtonDefault, {
          name: 'pull button',
          extent: pt(95, 25),
          submorphs: [
            {
              name: 'label',
              value: 'Pull'
            }
          ]
        })
      ]

    }

  ]
});
