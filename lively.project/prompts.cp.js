/* global fetch */
/* global URL */
import { component, ShadowObject, TilingLayout, add, part } from 'lively.morphic';
import { AbstractPromptModel, OKCancelButtonWrapper, LightPrompt } from 'lively.components/prompts.cp.js';
import { Color, pt } from 'lively.graphics';
import { InputLineDefault, InputLineDark } from 'lively.components/inputs.cp.js';
import { InformIconOnLight } from 'lively.components/helpers.cp.js';
import { UserFlap } from 'lively.user/user-flap.cp.js';
import { rect } from 'lively.graphics/geometry-2d.js';
import { SaveWorldDialog } from 'lively.ide/studio/dialogs.cp.js';
import { without } from 'lively.morphic/components/core.js';
import { Label } from 'lively.morphic/text/label.js';
import { Checkbox, LabeledCheckboxLight } from 'lively.components';
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
import { repositoryOwnerAndNameRegex } from './project.js';
import { debounceNamed } from 'lively.lang/function.js';
import { GitHubAPIWrapper } from 'lively.git';
import { Text } from 'lively.morphic/text/morph.js';

class ProjectSettingsPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      bindings: {
        get () {
          return [
            {
              target: 'cancel button',
              signal: 'fire',
              handler: () => {
                this.view.remove();
              }
            },
            { target: 'ok button', signal: 'fire', handler: 'resolve' },
            {
              target: 'visibility selector',
              signal: 'selectionChanged',
              handler: async (visibility) => {
                const { spinner, visibilitySelector, deployModeSelector } = this.ui;
                spinner.opacity = 1;
                visibilitySelector.enabled = false;
                const res = await this.project.changeRepositoryVisibility(visibility);
                if (!res) {
                  $world.setStatusMessage('Error changing Repository visibility.', StatusMessageError);
                  return;
                }
                await this.project.checkPagesSupport();
                if (this.project.canDeployToPages) {
                  deployModeSelector.enabled = true;
                } else {
                  deployModeSelector.enabled = false;
                }
                spinner.opacity = 0;
                visibilitySelector.enabled = true;
              }
            }
          ];
        }
      },
      project: {},
      title: { defaultValue: 'Project Settings' }
    };
  }

  resolve () {
    const { testModeSelector, buildModeSelector, deployModeSelector } = this.ui;
    const conf = this.project.config.lively;

    if (conf.testOnPush !== (testModeSelector.selectedItem === 'push')){
      conf.testOnPush = testModeSelector.selectedItem === 'push';
      this.project.config.hasUnsavedChanges = true;
    }
    if (conf.buildOnPush !== (buildModeSelector.selectedItem === 'push')){
      conf.buildOnPush = buildModeSelector.selectedItem === 'push';
      this.project.config.hasUnsavedChanges = true;
    }
    if (conf.deployOnPush !== (deployModeSelector.selectedItem === 'push')){
      conf.deployOnPush = deployModeSelector.selectedItem === 'push';
      this.project.config.hasUnsavedChanges = true;
    }
    super.resolve(true);
  }

  viewDidLoad () {
    const { testModeSelector, buildModeSelector, deployModeSelector, visibilitySelector } = this.ui;

    if (lively.isInOfflineMode) visibilitySelector.enabled = false;

    const conf = this.project.config.lively;

    if (conf.repositoryIsPrivate) {
      visibilitySelector.selectedItem = 'private';
      if (!this.project.canDeployToPages) {
        deployModeSelector.enabled = false;
      }
    }
    if (conf.testOnPush) testModeSelector.select('push');
    if (conf.buildOnPush) buildModeSelector.select('push');
    if (conf.deployOnPush) deployModeSelector.select('push');
  }
}

class ProjectCreationPromptModel extends AbstractPromptModel {
  static get properties () {
    return {
      title: { defaultValue: 'Create New Project' },
      bindings: {
        get () {
          return [
            { target: 'user flap', signal: 'onLogin', handler: 'onLogin' },
            { target: 'user flap', signal: 'onLogout', handler: 'waitForLogin' },
            { target: 'ok button', signal: 'fire', handler: 'resolve' },
            { target: 'from remote checkbox', signal: 'checked', handler: 'onCheckbox' },
            {
              target: 'create remote checkbox',
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
      }
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
        } else debounceNamed('branch-check', 100, () => this.showBranchInformation())();
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

  async showBranchInformation () {
    const { branchHolder, branchLoadingIndicator, branchSelector, remoteUrl } = this.ui;
    branchHolder.visible = true;
    branchLoadingIndicator.visible = true;
    branchSelector.visible = false;
    let urlString = remoteUrl.textString;
    if (urlString.endsWith('.git')) urlString = urlString.replace('.git', '');
    const projectRepoOwner = urlString.match(repositoryOwnerAndNameRegex)[1];
    const projectName = urlString.match(repositoryOwnerAndNameRegex)[2];
    const repoInfos = await GitHubAPIWrapper.remoteRepoInfos(projectRepoOwner, projectName);
    const branchListing = await GitHubAPIWrapper.listGithubBranches(projectRepoOwner, projectName);
    branchSelector.items = branchListing.map(b => ({ string: b, value: { name: b }, isListItem: true }));
    branchSelector.selection = this.ui.branchSelector.items.find(i => i.value.name === repoInfos.default_branch).value;
    branchSelector.visible = true;
    branchLoadingIndicator.visible = false;
  }

  async resolve () {
    await fun.guardNamed('resolve-project-creation', async () => {
      const availableProjects = (await Project.listAvailableProjects()).map(p => p._name);
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
          const projectName = urlString.match(repositoryOwnerAndNameRegex)[2];
          const projectRepoOwner = urlString.match(repositoryOwnerAndNameRegex)[1];
          const projectNameToLoad = `${projectRepoOwner}--${projectName}`;
          if (availableProjects.includes(projectNameToLoad)) {
            this.enableButtons();
            this.view.setStatusMessage('Project already exists locally. You can open it via the Dashboard or fetch another Project from GitHub.', StatusMessageError);
            remoteUrl.textString = '';
            remoteUrl.clearError(); // otherwise the validity check instantly fails
            return;
          }
          await Project.fromRemote(urlString, this.ui.branchSelector.selection.name);
          this.view.remove();
          const loadedProject = await Project.loadProject(projectNameToLoad);
          super.resolve(loadedProject);
        } catch (err) {
          this.enableButtons();
          this.view.setStatusMessage('Error fetching Project from remote.', StatusMessageError);
        }
      } else {
        li = $world.showLoadingIndicatorFor(this.view, 'Creating Project...');
        const createNewRemote = createRemoteCheckbox.checked;
        const priv = privateCheckbox.checked;
        const enteredName = projectName.textString;
        const { name: repoOwner, isOrg } = userSelector.selection;
        if (availableProjects.includes(`${repoOwner}--${enteredName}`)) {
          li.remove();
          li = null;
          this.enableButtons();
          this.view.setStatusMessage('Project with this name already exists locally.', StatusMessageError);
          projectName.textString = '';
          projectName.indicateError('project name needs to be unique');
          return;
        }

        if (createNewRemote) {
          const remoteRes = await fetch(`https://api.github.com/repos/${repoOwner}/${enteredName}`, {
            method: 'GET',
            headers: {
              accept: 'application/vnd.github+json',
              authorization: `Bearer ${currentUserToken()}`,
              'X-GitHub-Api-Version': '2022-11-28'
            }
          });
          if (remoteRes.status === 200) {
            li.remove();
            li = null;
            this.enableButtons();
            this.view.setStatusMessage('A repository with this name already exists on GitHub.', StatusMessageError);
            projectName.textString = '';
            projectName.indicateError('project name needs to be unique');
            return;
          }
        }

        createdProject = new Project(enteredName, { author: currentUsername(), description: description.textString, repoOwner: repoOwner });
        // TODO: We currently assume that project creation is not done in offline mode, but do nothing to actually enforce this.
        // Once we tackle this, this code needs to be checked.
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
    super.viewDidLoad();
    const { cancelButton, okButton, privateCheckbox, createRemoteCheckbox, fromRemoteCheckbox } = this.ui;
    okButton.disable();
    createRemoteCheckbox.disable();
    if (lively.isInOfflineMode) fromRemoteCheckbox.disable();
    privateCheckbox.disable();
    cancelButton.disable();
    if (!currentUserToken()) {
      this.waitForLogin();
    } else {
      const li = $world.showLoadingIndicatorFor(this.view);
      li.center = $world.visibleBounds().center();
      li.hasFixedPosition = true;
      once(this.view, 'activate', () => li.bringToFront());
      li.remove();
      await this.view.whenRendered();
      this.projectNameMode();
    }
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
    const { fromRemoteCheckbox } = this.ui;
    $world.get('user flap').showLoggedInUser();
    this.withoutBindingsDo(() => {
      if (!lively.isInOfflineMode) fromRemoteCheckbox.enable();
    });
    this.projectNameMode();
  }

  onCheckbox (fromRemote) {
    const { remoteUrl, projectName } = this.ui;
    remoteUrl.clearError();
    projectName.clearError();
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
    if (!lively.isInOfflineMode) createRemoteCheckbox.enable();
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
      title: { defaultValue: 'Create GitHub Repository for Project' },
      bindings: {
        get () {
          {
            return [
              { target: 'ok button', signal: 'fire', handler: 'resolve' },
              { target: 'cancel button', signal: 'fire', handler: 'reject' }
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
        const remoteRes = await fetch(`https://api.github.com/repos/${proj.repoOwner}/${proj.name}`, {
          method: 'GET',
          headers: {
            accept: 'application/vnd.github+json',
            authorization: `Bearer ${currentUserToken()}`,
            'X-GitHub-Api-Version': '2022-11-28'
          }
        });
        if (remoteRes.status === 200) {
          li.remove();
          li = null;
          this.view.setStatusMessage('A repository with this name already exists on GitHub.', StatusMessageError);
          this.enableButtons();
          return;
        }

        // order is important here: we only want to set up the remote specific config stuff if repo creation succeeds
        await proj.gitResource.createAndAddRemoteToGitRepository(currentUserToken(), proj.name, proj.repoOwner, proj.config.description, proj.repoOwner !== proj.config.author.name, privateRepo);
        proj.addRemoteConfig(privateRepo);
        li.remove();
        li = $world.showLoadingIndicatorFor(this.view, 'Setting up Defaults...');
        li.remove();

        li = $world.showLoadingIndicatorFor(this.view, 'Uploading Project...');
        await proj.save({
          message: 'Enabling remote repository.',
          filesToCommit: 'package.json .github/*',
          needsPipelines: true
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
      title: { defaultValue: 'Save Project' },
      bindings: {
        get () {
          return [
            { target: 'ok button', signal: 'fire', handler: 'resolve' },
            {
              target: 'cancel button',
              signal: 'fire',
              handler: () => {
                this.view.remove();
                this.terminalWindow?.close();
              }
            },
            { target: 'advanced toggler', signal: 'onMouseDown', handler: 'toggleAdvancedUI' },
            { target: 'minor check', signal: 'checked', handler: (status) => this.increaseMinor = status },
            { target: 'major check', signal: 'checked', handler: (status) => this.increaseMajor = status },
            { target: 'tag check', signal: 'checked', handler: (status) => this.tag = status },
            { target: 'branch check', signal: 'checked', handler: (status) => status ? this.ui.branchInput.activate() : this.ui.branchInput.deactivate() },
            { target: 'diff button', signal: 'onMouseDown', handler: () => { this.terminalWindow = this.project.showDiffSummary(); } }
          ];
        }
      }
    };
  }

  toggleAdvancedUI () {
    const currStatus = this.ui.secondRow.visible;
    this.ui.secondRow.visible = !currStatus;
    this.ui.advancedToggler.textAndAttributes = currStatus
      ? ['', { fontFamily: 'Font Awesome' }, ' Show Advanced Options', null]
      : ['', { fontFamily: 'Font Awesome' }, ' Show Advanced Options', { fontWeight: 700 }];
  }

  async viewDidLoad () {
    const { promptTitle, branchInput } = this.ui;
    this.view.visible = false;
    const li = $world.showLoadingIndicatorFor(null, 'Setting up Save operation...');
    const dependencies = await this.project.generateFlatDependenciesList();
    const localDeps = dependencies.some(d => !d.hasRemote);
    this.ui.dependencyStatusInfo.visible = localDeps;
    branchInput.deactivate();
    const currentBranchName = await this.project.gitResource.branchName();
    promptTitle.textAndAttributes = ['Save Project\n', null, '(currently on', { fontSize: 16 }, ` ${currentBranchName}`, { fontSize: 16, fontColor: Color.lively }, ')', null];
    await this.project.saveConfigData();
    if (await this.project.hasRemoteConfigured()) this.project.regeneratePipelines();
    li.remove();
    this.view.visible = true;
  }

  forceResolve () {
    this.resolve(true);
  }

  async resolve (force) {
    if (!force && this.ui.description.isFocused()) {
      this.ui.description.insertText('\n');
      return;
    }
    await fun.guardNamed('resolve-project-saving', async () => {
      this.disableButtons();

      const { description, branchCheck, branchInput } = this.ui;
      const message = description.textString;

      let increaseLevel;
      if (this.increaseMajor) increaseLevel = 'major';
      else if (this.increaseMinor) increaseLevel = 'minor';
      else increaseLevel = 'patch';

      const li = $world.showLoadingIndicatorFor(this.view, 'Saving Project...');

      const createBranch = branchCheck.checked;

      let success;
      if (createBranch) {
        const branchName = branchInput.textString.trim();
        success = await this.project.gitResource.createAndCheckoutBranch(branchName);
        if (!success) $world.setStatusMessage(`Could not create branch ${branchName}, possibly due to a name collision!`, StatusMessageError);
      } else success = true;

      if (success) success = await this.project.save({ increaseLevel, message, tag: this.tag });
      li.remove();
      this.terminalWindow?.close();
      if (success) $world.setStatusMessage('Project saved!', StatusMessageConfirm);
      else $world.setStatusMessage('Save unsuccessful', StatusMessageError);
      super.resolve(success);
    })();
  }

  get commands () {
    return super.commands.concat([
      { name: 'forceResolve', exec: () => this.forceResolve() }
    ]);
  }

  get keybindings () {
    return super.keybindings.concat([,
      {
        keys: 'Enter',
        command: 'resolve'
      },
      { keys: 'Ctrl-Enter', command: 'forceResolve' }
    ]);
  }
}

export const ProjectSettingsPrompt = component(LightPrompt, {
  defaultViewModel: ProjectSettingsPromptModel,
  extent: pt(550, 357),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
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
    extent: pt(487, 105.5),
    submorphs: [
      {
        name: 'ci settings',
        extent: pt(285.5, 10),
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
              submorphs: [{
                type: Label,
                name: 'test label',
                textString: 'Run Tests Remotely:'
              },
              { extent: pt(64, 12), fill: Color.transparent, borderWidth: 0 }]
            }, part(ModeSelector, {
              name: 'test mode selector',
              viewModel: {
                items: [{ text: 'Only Manually', name: 'manual' }, { text: 'Also on each push to `main` branch', name: 'push' }],
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
              submorphs: [
                {
                  type: Label,
                  name: 'build check',
                  textString: 'Build Project Remotely:'
                },
                { extent: pt(47.5, 12), fill: Color.transparent, borderWidth: 0 }]
            }, part(ModeSelector, {
              name: 'build mode selector',
              viewModel: {
                items: [{ text: 'Only Manually', name: 'manual' }, { text: 'Also on each push to `main` branch', name: 'push' }],
                tooltips: ['Only run build when triggered manually on GitHub', 'Run each time a push to the projects main branch is performed.']
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
                axisAlign: 'center',
                orderByIndex: true,
                spacing: 5
              }),
              fill: Color.transparent,
              borderWidth: 0,
              extent: pt(195.5, 28.5),
              submorphs: [{
                type: Label,
                name: 'deploy label',
                textString: 'Deploy Build to GitHub Pages:'
              },
              part(InformIconOnLight, { viewModel: { information: 'Deploying to GitHub Pages is only available for public repositories or with a paid GitHub plan.' } })
              ]
            },
            part(ModeSelector, {
              name: 'deploy mode selector',
              viewModel: {
                items: [{ text: 'Only Manually', name: 'manual' }, { text: 'Also on each push to `main` branch', name: 'push' }],
                tooltips: ['Only deploy when triggered manually on GitHub', 'Deploy each time a push to the projects main branch is performed.']
              }
            })]
          }
        ]
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
            fontWeight: '600',
            padding: {
              left: 200
            }
          }, {
            name: 'row 12',
            fill: Color.rgba(255, 255, 255, 0),
            extent: pt(520, 42),
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
    extent: pt(181.9, 73),
    clipMode: 'hidden',
    fill: Color.transparent,
    layout: new TilingLayout({
      axis: 'column',
      hugContentsVertically: true,
      padding: rect(2, 2, 0, 0),
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
            },
            submorphs: [{
              name: 'label'
            }]
          }), part(InformIconOnLight, {
            viewModel: { information: 'For which entity should the project be created? This corresponds to the repository owner on GitHub.' },
            name: 'user inform'
          })
        ]
      },
      {
        name: 'remote holder',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          spacing: 5
        }),
        submorphs: [
          part(LabeledCheckboxLight, {
            name: 'create remote checkbox',
            extent: pt(90, 18.2),
            clipMode: 'hidden',
            viewModel: { label: 'Create new GitHub repository?' }
          }),
          part(InformIconOnLight, { viewModel: { information: 'Should a new GitHub repository with the projects name automatically be created under the specified GitHub entity?' } })
        ]
      }, {
        name: 'private repo holder',
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          spacing: 5
        }),
        submorphs: [
          part(LabeledCheckboxLight, {
            name: 'private checkbox',
            extent: pt(90, 20.3),
            clipMode: 'hidden',
            viewModel: { label: 'Should the new GitHub repository be private?' }
          }),
          part(InformIconOnLight, {
            viewModel: { information: 'Should the new GitHub repository for the project be private?' },
            name: 'private repo inform'
          })
        ]
      }]
  });

export const RepoCreationPrompt = component(LightPrompt, {
  defaultViewModel: RepoCreationPromptModel,
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    padding: rect(15, 15, 0, 0),
    resizePolicies: [['repo settings', {
      height: 'fixed',
      width: 'fill'
    }]],
    spacing: 16
  }),
  submorphs: [
    {
      name: 'prompt title',
      padding: rect(10, 0, 10, 0),
      textAndAttributes: ['Create GitHub Repository for Project', null]
    },
    add(part(RepoSettings, {
      name: 'repo settings',
      layout: new TilingLayout({
        align: 'center',
        axis: 'column',
        axisAlign: 'center',
        hugContentsVertically: true,
        padding: rect(2, 2, 0, 0),
        spacing: 5
      }),
      submorphs: [
        without('user holder'),
        without('remote holder'), {
          name: 'private repo holder',
          layout: new TilingLayout({
            axisAlign: 'center',
            spacing: 5,
            align: 'center'
          }),
          submorphs: [{
            name: 'private checkbox',
            clipMode: 'hidden'
          }]
        }
      ]
    })),
    add(part(OKCancelButtonWrapper, { name: 'button wrapper' }))
  ]
});

export const ProjectCreationPrompt = component(LightPrompt, {
  defaultViewModel: ProjectCreationPromptModel,
  extent: pt(385, 474),
  layout: new TilingLayout({
    align: 'center',
    axis: 'column',
    axisAlign: 'center',
    hugContentsHorizontally: true,
    hugContentsVertically: true,
    padding: rect(15, 15, 0, 0),
    spacing: 16
  }),
  epiMorph: false,
  hasFixedPosition: true,
  submorphs: [
    add({
      name: 'project creation form',
      extent: pt(336.7, 363),
      fill: Color.transparent,
      clipMode: 'hidden',
      layout: new TilingLayout({
        axis: 'column',
        hugContentsHorizontally: true,
        hugContentsVertically: true,
        padding: rect(10, 10, 0, 0),
        resizePolicies: [['branch holder', {
          height: 'fixed',
          width: 'fill'
        }], ['repo settings', {
          height: 'fixed',
          width: 'fill'
        }]],
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
          part(UserFlap, {
            viewModel: { withLoginButton: true },
            name: 'user flap'
          })
        ]
      },
      {
        fill: Color.transparent,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          spacing: 5
        }),
        name: 'remote repo wrapper',
        submorphs: [
          part(LabeledCheckboxLight, { name: 'from remote checkbox', viewModel: { label: 'Initialize from Remote?' } }),
          part(InformIconOnLight, { name: 'inform icon remote repo', viewModel: { information: 'Should the project be initialized from an existing remote repository?' } })
        ]
      },
      part(InputLineDefault, { name: 'remote url', placeholder: 'URL' }),
      {
        name: 'branch holder',
        height: 3,
        visible: false,
        layout: new TilingLayout({
          align: 'center',
          axisAlign: 'center',
          hugContentsVertically: true,
          justifySubmorphs: 'spaced'
        }),
        fill: Color.transparent,
        clipMode: 'visible',
        submorphs: [
          part(Spinner, {
            name: 'branch loading indicator',
            extent: pt(65, 70),
            fill: Color.rgba(255, 255, 255, 0),
            scale: 0.2560724949479811,
            visible: false,
            viewModel: {
              color: 'black'
            }
          }),
          part(EnumSelector, {
            name: 'branch selector',
            visible: false,
            master: SystemButton,
            width: 260,
            clipMode: 'hidden',
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
              openListInWorld: true
            }
          }), part(InformIconOnLight, {
            viewModel: { information: 'Which branch of the remote repository should be used?' },
            name: 'branch inform'
          })
        ]
      },

      part(InputLineDefault, {
        name: 'project name',
        placeholder: 'Project Name',
        submorphs: [{
          name: 'placeholder',
          extent: pt(142, 34),
          fontFamily: 'IBM Plex Sans',
          nativeCursor: 'text',
          textAndAttributes: ['Project Name', null]
        }]
      }),
      part(RepoSettings, {
        name: 'repo settings'
      }),
      part(InputLineDefault, {
        name: 'description',
        extent: pt(318.1, 106.3),
        placeholder: 'Project Description',
        lineWrapping: 'by-words',
        submorphs: [{
          name: 'placeholder',
          visible: false,
          extent: pt(148, 34),
          fontFamily: 'IBM Plex Sans',
          nativeCursor: 'text'
        }]
      })
      ]
    }),
    add(part(OKCancelButtonWrapper, { name: 'button wrapper' }))]
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
    layout: new TilingLayout({
      align: 'center',
      axis: 'column',
      axisAlign: 'center',
      hugContentsVertically: true,
      padding: rect(11, 11, 0, 0),
      spacing: 5
    }),
    extent: pt(455.5, 333),
    submorphs: [without('third row'), without('second row'), without('first row'),
      add({
        type: Text,
        name: 'dependency status info',
        fontSize: 16,
        fontColor: Color.rgb(255, 108, 0),
        textAndAttributes: ['', {
          fontFamily: 'Font Awesome',
        }, ' ', {}, 'At least one of the dependencies of this project is not available remotely!', null],
        borderColor: Color.rgb(23, 160, 251),
        dynamicCursorColoring: true,
        extent: pt(445.5, 33.5),
        fill: Color.rgba(255, 255, 255, 0),
        fixedHeight: true,
        fixedWidth: true,
        lineWrapping: 'by-words',
        padding: rect(1, 1, 0, 0)
      }, 'fourth row'), add(
        {
          name: 'advanced holder',
          extent: pt(10, 0),
          layout: new TilingLayout({
            axis: 'column'
          }),
          fill: Color.transparent,
          submorphs: [{
            name: 'advanced toggler',
            type: Label,
            fontSize: 15,
            fontColor: Color.white,
            textAndAttributes: ['', { fontFamily: 'Font Awesome' }, ' Show Advanced Options', null]
          }, {
            name: 'second row',
            extent: pt(450, 0),
            fill: Color.transparent,
            visible: false,
            layout: new TilingLayout({
              align: 'right',
              axis: 'column',
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
                axisAlign: 'center',
                orderByIndex: true,
                spacing: 10
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
              }, part(Checkbox, {
                name: 'minor check',
                padding: rect(0, -3, 0, 3),
                position: pt(139, 0)
              })]
            }, {
              name: 'aMorph1',
              borderColor: Color.rgba(23, 160, 251, 0),
              borderWidth: 1,
              extent: pt(256.5, 29.5),
              fill: Color.rgba(255, 255, 255, 0),
              layout: new TilingLayout({
                axisAlign: 'center',
                orderByIndex: true,
                spacing: 10
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
              }, part(Checkbox, {
                name: 'major check',
                position: pt(139, 0)
              })]
            }, {
              name: 'tag row',
              fill: Color.rgba(255, 255, 255, 0),
              borderColor: Color.rgba(23, 160, 251, 0),
              extent: pt(256.5, 29.5),
              layout: new TilingLayout({
                axisAlign: 'center',
                orderByIndex: true,
                spacing: 10
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
              }, part(Checkbox, {
                name: 'tag check',
                position: pt(179, 0)
              })]
            }, {
              name: 'branch row',
              borderColor: Color.rgba(23, 160, 251, 0),
              extent: pt(256.5, 29.5),
              fill: Color.rgba(255, 255, 255, 0),
              layout: new TilingLayout({
                axisAlign: 'center',
                spacing: 10
              }),
              position: pt(-79, 22),
              submorphs: [{
                type: Label,
                name: 'branch label',
                fill: Color.rgba(255, 255, 255, 0),
                fontColor: Color.rgb(255, 255, 255),
                fontFamily: '"IBM Plex Sans"',
                fontSize: 15,
                nativeCursor: 'pointer',
                position: pt(0, 4),
                textAndAttributes: ['Create a new branch to save on:', null]

              }, part(Checkbox, {
                name: 'branch check'
              }), part(InputLineDark, {
                name: 'branch input',
                extent: pt(201.1, 23.3),
                placeholder: ['Branch Name', null],
                fontSize: 12,
                submorphs: [{
                  name: 'placeholder',
                  extent: pt(10, 23.3),
                  nativeCursor: 'text',
                  visible: true
                }],
                textAndAttributes: ['', null]

              })]
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
          }]
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
