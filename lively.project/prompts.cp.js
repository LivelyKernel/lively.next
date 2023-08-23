/* global URL */
import { component, ShadowObject, TilingLayout, add, part } from 'lively.morphic';
import { AbstractPromptModel, OKCancelButtonWrapper, LightPrompt } from 'lively.components/prompts.cp.js';
import { Color, pt } from 'lively.graphics';
import { InputLineDefault, LabeledCheckBox } from 'lively.components/inputs.cp.js';
import { InformIconOnLight } from 'lively.components/helpers.cp.js';
import { UserFlap } from 'lively.user/user-flap.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { SaveWorldDialog } from 'lively.ide/studio/dialogs.cp.js';
import { without } from 'lively.morphic/components/core.js';
import { Label } from 'lively.morphic/text/label.js';
import { CheckBox } from 'lively.components/widgets.js';
import { currentUserToken, currentUsersOrganizations, currentUsername } from 'lively.user';
import { Project } from 'lively.project';
import { StatusMessageError, StatusMessageConfirm } from 'lively.halos/components/messages.cp.js';
import { EnumSelector, Spinner } from 'lively.ide/studio/shared.cp.js';
import { SystemList } from 'lively.ide/styling/shared.cp.js';
import { SystemButton, SystemButtonDark } from 'lively.components/buttons.cp.js';
import { VersionChecker } from 'lively.ide/studio/version-checker.cp.js';
import { once } from 'lively.bindings';
import { ModeSelector } from 'lively.components/widgets/mode-selector.cp.js';
import { fun } from 'lively.lang';

class ProjectSettingsPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            {
              model: 'cancel button',
              signal: 'fire',
              handler: () => {
                this.view.remove();
              }
            },
            { model: 'test check', signal: 'checked', handler: (val) => this.ui.testModeSelector.enabled = val },
            { model: 'build check', signal: 'checked', handler: (val) => this.ui.buildModeSelector.enabled = val },
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            {
              target: 'visibility selector',
              signal: 'selectionChanged',
              handler: async (visibility) => {
                const { spinner, visibilitySelector, deployCheck } = this.ui;
                spinner.opacity = 1;
                visibilitySelector.enabled = false;
                const res = await this.project.changeRepositoryVisibility(visibility);
                if (!res) {
                  $world.setStatusMessage('Error changing Repository visibility.', StatusMessageError);
                  return;
                }
                await this.project.checkPagesSupport();
                if (this.project.canDeployToPages) deployCheck.enable();
                else deployCheck.disable();
                spinner.opacity = 0;
                visibilitySelector.enabled = true;
              }
            }
          ];
        }
      },
      project: {}
    };
  }

  resolve () {
    const { testCheck, buildCheck, deployCheck, testModeSelector, buildModeSelector } = this.ui;
    const conf = this.project.config.lively;

    conf.testActionEnabled = testCheck.checked;
    conf.buildActionEnabled = buildCheck.checked;
    conf.deployActionEnabled = deployCheck.checked;

    conf.testOnPush = testModeSelector.selectedItem === 'push';
    conf.buildOnPush = buildModeSelector.selectedItem === 'push';
    super.resolve(true);
  }

  viewDidLoad () {
    const { testCheck, buildCheck, deployCheck, testModeSelector, buildModeSelector, visibilitySelector } = this.ui;
    const conf = this.project.config.lively;

    if (conf.repositoryIsPrivate) {
      visibilitySelector.selectedItem = 'private';
      if (!this.project.canDeployToPages) deployCheck.disable();
    }

    testCheck.checked = conf.testActionEnabled;
    buildCheck.checked = conf.buildActionEnabled;
    deployCheck.checked = conf.deployActionEnabled;

    if (conf.testOnPush) testModeSelector.select('push');
    if (conf.buildOnPush) buildModeSelector.select('push');
  }
}

class ProjectCreationPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            { target: 'user flap', signal: 'onLogin', handler: 'onLogin' },
            { target: 'user flap', signal: 'onLogout', handler: 'waitForLogin' },
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            { model: 'from remote checkbox', signal: 'checked', handler: 'onCheckbox' },
            {
              model: 'create remote checkbox',
              signal: 'checked',
              handler: (checked) => {
                const { privateCheckbox } = this.ui;
                if (checked) privateCheckbox.enable();
                else privateCheckbox.disable();
              }
            },
            { target: 'remote url', signal: 'onInputChanged', handler: 'checkValidity', converter: '() => false' },
            { target: 'project name', signal: 'onInputChanged', handler: 'checkValidity', converter: '() => false' }
          ];
        }
      },
      label: 'Create new Project'
    };
  }

  reject () {
    // noop, just to stop users from cancelling the prompt
  }

  checkValidity (onlyCheck = false) {
    const { okButton, remoteUrl, projectName } = this.ui;
    if (this.fromRemote) {
      try {
        const url = new URL(remoteUrl.textString);
        if (url.host !== 'github.com') {
          remoteUrl.indicateError('enter github url');
          if (!onlyCheck) okButton.disable();
          return false;
        }
      } catch (err) {
        remoteUrl.indicateError('enter valid url');
        if (!onlyCheck) okButton.disable();
        return false;
      }
    } else {
      if (!projectName.textString || !projectName.textString.match(/^[\da-zA-Z-_]*$/)) {
        projectName.indicateError('enter valid name');
        if (!onlyCheck) okButton.disable();
        return false;
      }
    }
    if (!onlyCheck) okButton.enable();
    return true;
  }

  async resolve () {
    await fun.guardNamed('resolve-project-creation', async () => {
      this.disableButtons();
      let li;
      let { remoteUrl, projectName, createRemoteCheckbox, privateCheckbox, userSelector, description } = this.ui;
      let createdProject, urlString;
      if (!this.checkValidity(true)) {
        return;
      }
      if (this.fromRemote) {
        try {
          urlString = remoteUrl.textString;
          if (urlString.endsWith('.git')) urlString = urlString.replace('.git', '');
          createdProject = await Project.fromRemote(urlString);
          super.resolve(createdProject);
        } catch (err) {
          this.enableButtons();
          this.view.setStatusMessage('Error fetching Project from remote.', StatusMessageError);
        }
      } else {
        li = $world.showLoadingIndicatorFor(this.view, 'Creating Project...');
        const createNewRemote = createRemoteCheckbox.checked;
        const priv = privateCheckbox.checked;
        const { name: repoOwner, isOrg } = userSelector.selection;
        createdProject = new Project(projectName.textString, { author: currentUsername(), description: description.textString, repoOwner: repoOwner });
        const currentLivelyVersion = await VersionChecker.currentLivelyVersion(true);
        createdProject.config.lively.boundLivelyVersion = currentLivelyVersion;
        try {
          await createdProject.create(createNewRemote, isOrg ? repoOwner : currentUsername(), priv);
          li.remove();
          super.resolve(createdProject);
        } catch (err) {
          this.enableButtons();
          li?.remove();
          this.view.setStatusMessage('There was an error initializing the project or its remote.', StatusMessageError);
        }
      }
      this.enableButtons();
    })();
  }

  async viewDidLoad () {
    const { promptTitle, cancelButton, okButton, userFlap, privateCheckbox } = this.ui;
    okButton.disable();
    privateCheckbox.disable();
    cancelButton.disable();
    if (!currentUserToken()) {
      this.waitForLogin();
    } else {
      const li = $world.showLoadingIndicatorFor(this.view);
      li.center = $world.visibleBounds().center();
      li.hasFixedPosition = true;
      once(this.view, 'activate', () => li.bringToFront());
      await userFlap.update();
      li.remove();
      this.projectNameMode();
    }
    promptTitle.textString = 'Configure new Project';
  }

  waitForLogin () {
    const { remoteUrl, projectName, description, createRemoteCheckbox, userSelector, userFlapContainer } = this.ui;
    $world.get('lively top bar')?.get('user flap').showGuestUser();
    remoteUrl.clearError();
    projectName.clearError();
    projectName.deactivate();
    remoteUrl.deactivate();
    description.deactivate();
    createRemoteCheckbox.disable();
    userSelector.disable();

    this.ui.userFlapContainer.animate({ duration: 500, borderColor: Color.red })
      .then(() => userFlapContainer.animate({ duration: 500, borderColor: Color.transparent }))
      .then(() => userFlapContainer.animate({ duration: 500, borderColor: Color.red }))
      .then(() => userFlapContainer.animate({ duration: 500, borderColor: Color.transparent }));

    this.withoutBindingsDo(() => this.ui.fromRemoteCheckbox.disable());
  }

  onLogin () {
    $world.get('user flap').showLoggedInUser();
    this.withoutBindingsDo(() => this.ui.fromRemoteCheckbox.enable());
    this.projectNameMode();
  }

  onCheckbox (fromRemote) {
    this.ui.remoteUrl.clearError();
    this.ui.projectName.clearError();
    if (fromRemote) {
      this.remoteUrlMode();
    } else {
      this.projectNameMode();
    }
  }

  projectNameMode () {
    const { projectName, userSelector, description, createRemoteCheckbox, remoteUrl } = this.ui;
    this.fromRemote = false;
    projectName.activate();
    userSelector.enable();
    description.activate();
    createRemoteCheckbox.enable();
    remoteUrl.deactivate();
    projectName.indicateError('required', 'only - and letters are allowed');
    // we do this here since we are sure that we are logged in when we reach this method!
    const ownerOptions = currentUsersOrganizations().map(orgName => { return { string: orgName, value: { name: orgName, isOrg: true }, isListItem: true }; });
    userSelector.items = [{ string: currentUsername(), value: { name: currentUsername(), isOrg: false }, isListItem: true }].concat(ownerOptions);
    userSelector.selection = userSelector.items[0].value;
  }

  remoteUrlMode () {
    const { projectName, userSelector, description, createRemoteCheckbox, remoteUrl } = this.ui;
    this.fromRemote = true;
    createRemoteCheckbox.disable();
    createRemoteCheckbox.checked = false;
    projectName.deactivate();
    userSelector.disable();
    description.deactivate();
    remoteUrl.activate();
    remoteUrl.indicateError('required', 'must be the url to a github repository');
  }
}

class RepoCreationPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      project: {},
      bindings: {
        get () {
          {
            return [
              { model: 'ok button', signal: 'fire', handler: 'resolve' },
              { model: 'cancel button', signal: 'fire', handler: 'reject' }
            ];
          }
        }
      }
    };
  }

  async resolve () {
    await fun.guardNamed('resolve-repository-creation', async () => {
      this.disableButtons();

      let li = $world.showLoadingIndicatorFor(this.view, 'Creating Repository...');

      let { privateCheckbox } = this.ui;
      const privateRepo = !!privateCheckbox.checked;

      try {
        const proj = this.project;
        const repoInOrg = currentUsername() !== currentUsername();
        await proj.gitResource.createAndAddRemoteToGitRepository(currentUserToken(), proj.name, proj.repoOwner, proj.config.description, repoInOrg, privateRepo);
        li.remove();

        li = $world.showLoadingIndicatorFor(this.view, 'Setting up Defaults...');
        proj.setCIDefaults();
        proj.config.lively.repositoryIsPrivate = privateRepo;
        proj.config.lively.repoBelongsToOrg = repoInOrg;
        li.remove();

        li = $world.showLoadingIndicatorFor(this.view, 'Uploading Project...');
        await proj.save({
          message: 'Enabling remote repository.',
          filesToCommit: 'package.json .github/*'
        });
        li.remove();

        $world.setStatusMessage('Project uploaded!', StatusMessageConfirm);
        super.resolve(true);
      } catch (err) {
        this.enableButtons();
        li?.remove();
        this.view.setStatusMessage('There was an error creating the repository.', StatusMessageError);
      }
      this.enableButtons();
    })();
  }
}

class ProjectSavePrompt extends AbstractPromptModel {
  static get properties () {
    return {
      project: { },
      bindings: {
        get () {
          return [
            { model: 'ok button', signal: 'fire', handler: 'resolve' },
            {
              model: 'cancel button',
              signal: 'fire',
              handler: () => {
                this.view.remove();
                this.terminalWindow?.close();
              }
            },
            { target: 'minor check', signal: 'toggle', handler: (status) => this.increaseMinor = status },
            { target: 'major check', signal: 'toggle', handler: (status) => this.increaseMajor = status },
            { target: 'tag check', signal: 'toggle', handler: (status) => this.tag = status },
            { target: 'diff button', signal: 'onMouseDown', handler: () => { this.terminalWindow = this.project.showDiffSummary(); } }
          ];
        }
      }
    };
  }

  async viewDidLoad () {
    this.ui.diffButton.disable();
    await this.project.saveConfigData();
    this.ui.diffButton.enable();
  }

  async resolve () {
    await fun.guardNamed('resolve-project-saving', async () => {
      this.disableButtons();

      const { description } = this.ui;
      const message = description.textString;

      let increaseLevel;
      if (this.increaseMajor) increaseLevel = 'major';
      else if (this.increaseMinor) increaseLevel = 'minor';
      else increaseLevel = 'patch';

      const li = $world.showLoadingIndicatorFor(this.view, 'Saving Project...');
      const success = await this.project.save({ increaseLevel, message, tag: this.tag });
      li.remove();
      this.terminalWindow?.close();
      if (success) $world.setStatusMessage('Project saved!', StatusMessageConfirm);
      else $world.setStatusMessage('Save unsuccessful', StatusMessageError);
      super.resolve(success);
    })();
  }
}

export const ProjectSettingsPrompt = component(LightPrompt, {
  defaultViewModel: ProjectSettingsPromptModel,
  extent: pt(385, 244),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(15, 15, 0, 0),
    spacing: 16
  }),
  submorphs: [{
    name: 'prompt title',
    nativeCursor: 'text',
    textAndAttributes: ['Project Settings', null]
  }, add({
    name: 'prompt contents',
    layout: new TilingLayout({
      align: 'center',
      axis: 'column',
      axisAlign: 'center',
      orderByIndex: true,
      spacing: 20
    }),
    fill: Color.transparent,
    extent: pt(327.5, 105.5),
    submorphs: [
      {
        name: 'ci settings',
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          align: 'center',
          axis: 'column',
          axisAlign: 'center',
          orderByIndex: true
        }),
        submorphs: [
          {
            type: Label,
            textString: 'GitHub Actions Settings',
            fontSize: 15,
            fontWeight: '600'
          },
          {
            name: 'row 11',
            fill: Color.rgba(255, 255, 255, 0),
            extent: pt(480, 42),
            layout: new TilingLayout({
              align: 'center',
              axisAlign: 'center',
              orderByIndex: true,
              spacing: 20
            }),
            submorphs: [{
              name: 'wrapper 11',
              borderColor: Color.rgba(255, 255, 255, 0),
              layout: new TilingLayout({
                axisAlign: 'center',
                orderByIndex: true
              }),
              fill: Color.transparent,
              borderWidth: 0,
              extent: pt(195.5, 28.5),
              submorphs: [part(LabeledCheckBox, { name: 'test check', viewModel: { label: 'Run Tests Remotely:' } }), { extent: pt(64, 12), fill: Color.transparent, borderWidth: 0 }]
            }, part(ModeSelector, {
              name: 'test mode selector',
              viewModel: {
                items: [{ text: 'Manually', name: 'manual' }, { text: 'On each push to `main` branch', name: 'push' }],
                tooltips: ['Only run tests when triggered manually on GitHub', 'Run each time a push to the projects main branch is performed.']
              }
            })]
          },
          {
            name: 'row 21',
            fill: Color.rgba(255, 255, 255, 0),
            extent: pt(297, 29),
            layout: new TilingLayout({
              align: 'center',
              axisAlign: 'center',
              orderByIndex: true,
              spacing: 20
            }),
            submorphs: [{
              name: 'wrapper 21',
              layout: new TilingLayout({
                orderByIndex: true,
                axisAlign: 'center'
              }),
              fill: Color.transparent,
              borderWidth: 0,
              extent: pt(195.5, 28.5),
              submorphs: [part(LabeledCheckBox, { name: 'build check', viewModel: { label: 'Build Project Remotely:' } }), { extent: pt(47.5, 12), fill: Color.transparent, borderWidth: 0 }]
            }, part(ModeSelector, {
              name: 'build mode selector',
              viewModel: {
                items: [{ text: 'Manually', name: 'manual' }, { text: 'On each push to `main` branch', name: 'push' }],
                tooltips: ['Only run build when triggered manually on GitHub', 'Run each time a push tp the projects main branch is performed.']
              }
            })]
          }, {
            name: 'row 31',
            fill: Color.rgba(255, 255, 255, 0),
            extent: pt(480, 41.5),
            layout: new TilingLayout({
              align: 'center',
              axisAlign: 'center',
              orderByIndex: true,
              spacing: 20
            }),
            submorphs: [{
              name: 'wrapper 31',
              layout: new TilingLayout({
                orderByIndex: true,
                axisAlign: 'center'
              }),
              fill: Color.transparent,
              borderWidth: 0,
              extent: pt(195.5, 28.5),
              submorphs: [part(LabeledCheckBox, { name: 'deploy check', viewModel: { label: 'Deploy Build to GitHub Pages:' } }), part(InformIconOnLight, { viewModel: { information: 'Deploying to GitHub Pages is only available for public repositories.' } })]
            }, { fill: Color.transparent, width: 255 }]
          }]
      },
      {
        name: 'repo settings',
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          align: 'center',
          axis: 'column',
          axisAlign: 'center',
          orderByIndex: true
        }),
        submorphs: [
          {
            type: Label,
            textString: 'Repository Settings',
            fontSize: 15,
            fontWeight: '600'
          }, {
            name: 'row 12',
            fill: Color.rgba(255, 255, 255, 0),
            extent: pt(480, 42),
            layout: new TilingLayout({
              axisAlign: 'center',
              orderByIndex: true,
              spacing: 20
            }),
            submorphs: [{
              name: 'wrapper 12',
              layout: new TilingLayout({
                orderByIndex: true,
                axisAlign: 'center',
                spacing: 20
              }),
              fill: Color.transparent,
              borderWidth: 0,
              extent: pt(195.5, 28.5),
              submorphs: [
                { type: Label, textString: 'Repository Visibility:' },
                part(Spinner, {
                  name: 'spinner',
                  viewModel: { color: 'black' },
                  scale: 0.3,
                  opacity: 0
                })]
            }, part(ModeSelector, {
              name: 'visibility selector',
              viewModel: {
                items: [{ text: 'Public', name: 'public' }, { text: 'Private', name: 'private' }]
              }
            })]
          }]
      }

    ]
  }), add(part(OKCancelButtonWrapper, { name: 'button wrapper' }))]
});

const RepoSettings = component(
  {
    name: 'repo settings',
    fill: Color.transparent,
    layout: new TilingLayout({
      axis: 'column',
      hugContentsHorizontally: true,
      orderByIndex: true,
      spacing: 5
    }),
    submorphs: [
      {
        name: 'user holder',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          orderByIndex: true,
          spacing: 5
        }),
        submorphs: [
          part(EnumSelector, {
            name: 'user selector',
            master: SystemButton,
            layout: new TilingLayout(
              {
                align: 'center',
                axisAlign: 'center',
                justifySubmorphs: 'spaced',
                orderByIndex: true,
                padding: rect(5, 0, 5, 0),
                resizePolicies: [['label', [{ height: 'fixed', width: 'fill' }]]]
              }),
            viewModel: {
              listMaster: SystemList,
              openListInWorld: true,
              listAlign: 'selection'
            }
          }), part(InformIconOnLight, {
            viewModel: { information: 'For which entity should the project be created? This corresponds to the repository owner on GitHub.' },
            name: 'label_1'
          })
        ]
      },
      {
        name: 'remote holder',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center'
        }),
        submorphs: [
          part(LabeledCheckBox, { name: 'create remote checkbox', viewModel: { label: 'Create new GitHub repository?' } }),
          part(InformIconOnLight, {
            viewModel: { information: 'Should a new GitHub repository with the projects name automatically be created under the specified GitHub entity?' },
            name: 'morph_1'
          })
        ]
      }, {
        name: 'private repo holder',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center'
        }),
        submorphs: [
          part(LabeledCheckBox, { name: 'private checkbox', viewModel: { label: 'Should the new GitHub repository be private?' } }),
          part(InformIconOnLight, {
            viewModel: { information: 'Should the new GitHub repository for the project be private?' },
            name: 'morph_2'
          })
        ]
      }]
  });

export const RepoCreationPrompt = component(LightPrompt, {
  defaultViewModel: RepoCreationPromptModel,
  submorphs: [
    {
      name: 'prompt title',
      padding: rect(10, 0, 10, 0),
      textAndAttributes: ['Create GitHub Repository for Project', null]
    },
    add(part(RepoSettings, {
      name: 'repo settings',
      submorphs: [
        without('user holder'),
        without('remote holder'), {
          layout: new TilingLayout({
            axisAlign: 'center',
            orderByIndex: true
          }),
          name: 'private repo holder',
          extent: pt(332.0000, 21.0000),
          submorphs: [{
            layout: new TilingLayout({
              orderByIndex: true
            }),
            name: 'private checkbox'
          }]
        }
      ]
    })),
    add(part(OKCancelButtonWrapper, { name: 'button wrapper' }))
  ]
});

export const ProjectCreationPrompt = component(LightPrompt, {
  defaultViewModel: ProjectCreationPromptModel,
  extent: pt(385, 345),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    orderByIndex: true,
    padding: rect(15, 15, 0, 0),
    spacing: 16
  }),
  epiMorph: false,
  hasFixedPosition: true,
  viewModel: {
    label: ['Create New Project\n', {
      fontWeight: 'bold'
    }]
  },
  submorphs: [
    add({
      name: 'project creation form',
      extent: pt(318, 200),
      fill: Color.transparent,
      layout: new TilingLayout({
        axis: 'column',
        hugContentsHorizontally: true,
        orderByIndex: true,
        spacing: 5
      }),
      submorphs: [{
        name: 'user flap container',
        borderColor: Color.rgba(255, 255, 255, 0),
        clipMode: 'hidden',
        borderRadius: 20,
        borderWidth: 2,
        layout: new TilingLayout({
          align: 'center',
          orderByIndex: true
        }),
        extent: pt(318, 48.9),
        fill: Color.transparent,
        submorphs: [
          part(UserFlap, { viewModel: { withLoginButton: true } })
        ]
      },
      {
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center'
        }),
        submorphs: [
          part(LabeledCheckBox, { name: 'from remote checkbox', viewModel: { label: 'Initialize from Remote?' } }),
          part(InformIconOnLight, { viewModel: { information: 'Should the project be initialized from an existing remote repository?' } })
        ]
      }, part(InputLineDefault, { name: 'remote url', placeholder: 'URL' }),
      part(InputLineDefault, {
        name: 'project name',
        placeholder: 'Project Name',
        submorphs: [{
          name: 'placeholder',
          extent: pt(142, 34),
          fontFamily: '"IBM Plex Sans",Sans-Serif',
          nativeCursor: 'text',
          textAndAttributes: ['Project Name', null]
        }]
      }), part(RepoSettings),
      part(InputLineDefault, {
        name: 'description',
        extent: pt(318.1, 106.3),
        placeholder: 'Project Description',
        lineWrapping: 'by-words',
        submorphs: [{
          name: 'placeholder',
          visible: false,
          extent: pt(148, 34),
          fontFamily: '"IBM Plex Sans",Sans-Serif',
          nativeCursor: 'text'
        }]
      })
      ]
    }), add(part(OKCancelButtonWrapper))]
});

export const SaveProjectDialog = component(SaveWorldDialog, {
  defaultViewModel: ProjectSavePrompt,
  extent: pt(500, 367),
  submorphs: [{
    name: 'prompt title',
    nativeCursor: 'text',
    textAndAttributes: ['Save Project', null]
  }, {
    name: 'prompt controls',
    extent: pt(455.5, 285),
    submorphs: [without('third row'), without('second row'), without('first row'), add({
      name: 'second row',
      extent: pt(450, 76.8),
      fill: Color.transparent,
      layout: new TilingLayout({
        align: 'right',
        axis: 'column',
        orderByIndex: true,
        padding: rect(0, 15, 0, -15),
        spacing: 11
      }),
      position: pt(-146, 28),
      submorphs: [{
        name: 'aMorph',
        borderColor: Color.rgba(23, 160, 251, 0),
        borderWidth: 1,
        extent: pt(256.5, 31),
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          orderByIndex: true
        }),
        position: pt(0, -1),
        submorphs: [{
          type: Label,
          name: 'description label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: '"IBM Plex Sans"',
          fontSize: 15,
          nativeCursor: 'pointer',
          textAndAttributes: ['Bump Minor Version:', null]
        }, {
          type: CheckBox,
          name: 'minor check',
          borderWidth: 0,
          position: pt(139, 0)
        }]
      }, {
        name: 'aMorph1',
        borderColor: Color.rgba(23, 160, 251, 0),
        borderWidth: 1,
        extent: pt(256.5, 29.5),
        fill: Color.rgba(255, 255, 255, 0),
        layout: new TilingLayout({
          orderByIndex: true
        }),
        position: pt(0, 63),
        submorphs: [{
          type: Label,
          name: 'description label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: '"IBM Plex Sans"',
          fontSize: 15,
          nativeCursor: 'pointer',
          textAndAttributes: ['Bump Major Version:', null]
        }, {
          type: CheckBox,
          name: 'major check',
          borderWidth: 0,
          position: pt(139, 0)
        }]
      }, {
        name: 'tag row',
        fill: Color.rgba(255, 255, 255, 0),
        borderColor: Color.rgba(23, 160, 251, 0),
        extent: pt(256.5, 29.5),
        layout: new TilingLayout({
          orderByIndex: true
        }),
        position: pt(-82, 26),
        submorphs: [{
          type: Label,
          name: 'tag label',
          fill: Color.rgba(255, 255, 255, 0),
          fontColor: Color.rgb(255, 255, 255),
          fontFamily: '"IBM Plex Sans"',
          fontSize: 15,
          nativeCursor: 'pointer',
          textAndAttributes: ['Tag this Version as Release:', null]
        }, {
          type: CheckBox,
          name: 'tag check',
          borderWidth: 0,
          position: pt(179, 0)
        }]
      }, part(SystemButtonDark, {
        name: 'diff button',
        extent: pt(449.5, 27),
        submorphs: [{
          name: 'label',
          textAndAttributes: ['Show Summary of Changes (Advanced Operation)', null, '', {
            fontFamily: 'Tabler Icons',
            fontWeight: '900'
          }, ' ', {}]
        }]
      })]
    }), {
      name: 'fourth row',
      submorphs: [{
        name: 'description',
        dropShadow: new ShadowObject({ distance: 4, color: Color.rgba(0, 0, 0, 0.26), blur: 10 }),
        textAndAttributes: ['', null]

      }]
    }]
  }, {
    name: 'button wrapper',
    layout: new TilingLayout({
      align: 'center',
      axisAlign: 'center',
      orderByIndex: true,
      padding: rect(12, 12, 0, 0),
      spacing: 12
    })
  }]
});
