/* global URL */
/* eslint-disable no-console */
import { localInterface } from 'lively-system-interface';
import { resource } from 'lively.resources';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { loadPackage } from 'lively-system-interface/commands/packages.js';
import { workflowDefinition } from './templates/test-action.js';
import { VersionChecker } from 'lively.ide/studio/version-checker.cp.js';
import { StatusMessageConfirm, StatusMessageWarning, StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { join } from 'lively.modules/src/url-helpers.js';
import { runCommand } from 'lively.shell/client-command.js';
import ShellClientResource from 'lively.shell/client-resource.js';
import { PackageRegistry } from 'lively.modules/index.js';
import { currentUserToken, currentUserData, isUserLoggedIn, currentUser, currentUsername } from 'lively.user';
import { reloadPackage } from 'lively.modules/src/packages/package.js';
import { buildScriptShell } from './templates/build-shell.js';
import { buildScript } from './templates/build.js';
import { buildRemoteScript } from './templates/build-upload-action.js';
import { deployScript } from './templates/deploy-pages-action.js';
import Terminal from 'lively.ide/shell/terminal.js';
import { pt } from 'lively.graphics';
import { arr, obj } from 'lively.lang';
import { addOrChangeCSSDeclaration } from 'lively.morphic';
import { generateFontFaceString } from 'lively.morphic/rendering/fonts.js';
import { supportedImageFormats } from 'lively.ide/assets.js';
import { evalOnServer } from 'lively.freezer/src/util/helpers.js';
import { promise } from 'lively.lang';
import { setupLively2Lively, setupLivelyShell } from 'lively.morphic/world-loading.js';
import { GitHubAPIWrapper } from 'lively.git';
import { generateKeyPair } from 'lively.git/js-keygen/js-keygen.js';
import * as semver from 'esm://cache/semver';

export const repositoryOwnerAndNameRegex = /\.com\/(.+)\/(.*)/;
const fontCSSWarningString = `/*\nDO NOT CHANGE THE CONTENTS OF THIS FILE!
Its content is managed automatically by lively.next. It will automatically be loaded/bundled together with this project!\n*/\n\n`;
export class Project {
  static get systemInterface () {
    return localInterface.coreInterface;
  }

  static async ensureGitResource (fullName) {
    return resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(fullName).withRelativePartsResolved().asDirectory();
  }

  static fetchInfoPreflight (fullName) {
    let finishCheck;
    ({ promise: lively.checkedProjectVersionRelation, resolve: finishCheck } = promise.deferred());
    lively.projectRepoPull = (async () => {
      const gitResource = await this.ensureGitResource(fullName);
      // Initialization needs to be done here, since the one in the world loading step comes too late.
      // However we are setting up shell and l2l for a different world, thereby requiring us to initialize both twice...
      const l2lClient = await setupLively2Lively($world);
      if (l2lClient) await setupLivelyShell({ l2lClient });

      await Project.resetConfigFiles(gitResource);
      Project.projectDirectory(fullName).then(
        dir => dir.join('package.json').readJson().then(
          (config) => {
            VersionChecker.checkVersionRelation(config.lively.boundLivelyVersion, true).then(
              finishCheck);
          }));
      await Project.pullUpstreamChangesIfRemote(gitResource);
    })();
  }

  // As a URL to be used from inside of lively.
  static async projectDirectory (projectName) {
    const baseURL = await Project.systemInterface.getConfig().baseURL;
    return resource(baseURL).join('local_projects').join(projectName).asDirectory();
  }

  static async resetConfigFiles (gitResource) {
    await gitResource.resetFile('package.json');
    await gitResource.resetFile('.github/workflows/ci-tests.yml');
  }

  static async pullUpstreamChangesIfRemote (gitResource) {
    if (await gitResource.hasRemote()) await gitResource.pullRepo();
  }

  /**
   * Returns a name that is intended to be displayed to the user. There is no guaranteed one-to-one mapping from available projects to this name.
   */
  get name () {
    return this.config.name.replace(/.*--/, '');
  }

  /**
   * A qualified name that includes the owner of the repository that the project resides in, prefixed to the name of the project with --.
   * This guarantees a one-to-one mapping between fullName and available projects.
   * Used for internal operations and not intended to be exposed to the user.
   */
  get fullName () {
    return this.url.replace(/.*\/local_projects\//, '').replace('/', '');
  }

  get repoOwner () {
    return this.fullName.replace(/--.*/, '');
  }

  get canDeployToPages () {
    return this.config.lively.canUsePages;
  }

  async hasRemoteConfigured () {
    return await this.gitResource.hasRemote();
  }

  async hasUncommitedChanges () {
    return await this.gitResource.hasUncommitedChanges();
  }

  async changeRepositoryVisibility (visibility) {
    const oldValue = this.config.lively.repositoryIsPrivate; 
    this.config.lively.repositoryIsPrivate = visibility === 'private';
    if (this.config.lively.repositoryIsPrivate !== oldValue) this.config.hasUnsavedChanges = true;
    return await this.gitResource.changeRemoteVisibility(currentUserToken(), this.name, this.repoOwner, visibility);
  }

  constructor (name, opts = { author: 'anon', description: '', repoOwner: 'anon' }) {
    const { author, description, repoOwner } = opts;
    this.config = {
      hasUnsavedChanges: true,
      name: name ? repoOwner + '--' + name : 'new world',
      author: {
        // TODO: We could enhance this by utilizing more of the user data GitHub provides for us
        // See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#people-fields-author-contributors
        name: author
      },
      description: description,
      scripts: {
        build: "rm -rf build/* && export MINIFY='' && ./tools/build.sh",
        'build-minified': 'rm -rf build/* && export MINIFY=true && ./tools/build.sh'
      },
      // TODO: How do we manage the necessity to upgrade this nicely?
      dependencies: {
        '@rollup/plugin-json': '4.1.0',
        rollup: '^2.70.2',
        'rollup-plugin-export-default': '1.4.0',
        'rollup-plugin-polyfill-node': '0.9.0'
      },
      lively: {
        projectDependencies: []
      },
      version: '0.1.0'
    };
  }

  static async listAvailableProjects (forProjectBrowser = false) {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;

    const packageCache = lively.FreezerRuntime
      ? await resource(baseURL).join('../package-registry.json').withRelativePartsResolved().readJson()
      : PackageRegistry.ofSystem(System);

    let projectsCandidates = [];
    Object.keys(packageCache.packageMap).forEach(pack =>
      Object.keys(packageCache.packageMap[pack].versions).forEach(v => {
        // filters out invalid projects (e.g., with invalid package.json file)
        if (v === '0.0.0') return;
        projectsCandidates.push(packageCache.packageMap[pack].versions[v]);
      })
    );
    projectsCandidates = projectsCandidates.filter(p => p.url.includes('local_projects'));
    const includePartsbinSetting = localStorage.getItem('livelyIncludePartsbinInList');
    if (forProjectBrowser && (!includePartsbinSetting || includePartsbinSetting == 'false')) projectsCandidates = projectsCandidates.filter(p => p._name !== 'LivelyKernel--partsbin');
    projectsCandidates.forEach(p => {
      p._projectName = p._name.replace(/.*--/, '');
      p._projectOwner = p._name.replace(/--.*/, '');
    });
    // case-insensitive and unicode aware sorting
    projectsCandidates.sort((a, b) => a._projectName.toLowerCase().localeCompare(b._projectName.toLowerCase()));
    return projectsCandidates;
  }

  /**
   * Takes the URL for a GitHub Repository at which a lively project resides and clones the repository in the projects folder of the local lively installation.
   * Note, that the cloned project needs to be loaded separately.
   * @param {string} remote - The URL of the GitHub Repository.
   */
  static async fromRemote (remote, branchName) {
    const li = $world.showLoadingIndicatorFor($world, 'Fetching Project...');
    if (remote.endsWith('/')) remote = remote.slice(0, -1);
    const remoteUrl = new URL(remote);

    const userToken = currentUserToken();
    const projectName = remote.match(repositoryOwnerAndNameRegex)[2];
    const projectRepoOwner = remote.match(repositoryOwnerAndNameRegex)[1];

    const repoInfoCmd = runCommand(`curl -L \
      -H "Accept: application/vnd.github+json" \
      -H "Authorization: Bearer ${userToken}"\
      -H "X-GitHub-Api-Version: 2022-11-28" \
      https://api.github.com/repos/${projectRepoOwner}/${projectName}`,
    { l2lClient: ShellClientResource.defaultL2lClient });

    await repoInfoCmd.whenDone();
    const repoInfos = JSON.parse(repoInfoCmd.stdout);
    const isFork = repoInfos.fork;

    // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
    const cmd = runCommand(`cd ../local_projects/ && git clone -b ${branchName} https://${userToken}@github.com${remoteUrl.pathname} ${projectRepoOwner}--${projectName}`,
      { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error cloning repository');

    if (isFork) {
      await Project.setupForkInformation(projectRepoOwner, projectName);
    }

    const projectDir = await Project.projectDirectory(`${projectRepoOwner}--${projectName}`);
    await evalOnServer(`System.get("@lively-env").packageRegistry.addPackageAt(System.baseURL + 'local_projects/${projectRepoOwner}--${projectName}')`);
    await System.get('@lively-env').packageRegistry.addPackageAt(projectDir);

    li.remove();
    return `${projectRepoOwner}--${projectName}`;
  }

  static async setupForkInformation (forkOwner, forkName) {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;
    const forkIndicatorFile = resource(baseURL).join(`local_projects/${forkOwner}--${forkName}/.livelyForkInformation`);
    await forkIndicatorFile.ensureExistance();
    const forkIndicatorContents = JSON.stringify({ owner: forkOwner, name: forkName });
    await resource(forkIndicatorFile).write(forkIndicatorContents);
  }

  static async deleteProject (name, repoOwner, token, deleteRemote) {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;
    const projectsDir = lively.FreezerRuntime ? resource(baseURL).join(`../local_projects/${repoOwner}--${name}`).withRelativePartsResolved().asDirectory() : (await Project.projectDirectory(`${repoOwner}--${name}`));
    const gitResource = await resource('git/' + projectsDir.url);

    try {
      await evalOnServer(`
      const reg = System.get("@lively-env").packageRegistry;
      const p = reg.findPackageWithURL(System.baseURL + 'local_projects/${repoOwner}--${name}');
      reg.removePackage(p)`);
      let remoteDeletionSuccessful;
      if (deleteRemote) {
        remoteDeletionSuccessful = await gitResource.deleteRemoteRepository(token, name, repoOwner);
      }
      if (!remoteDeletionSuccessful) console.warn('Remote repository could not be deleted, due to insufficient permissions.');
      await projectsDir.remove();
    } catch (err) {
      throw Error('Error deleting project', { cause: err });
    }
  }

  static async loadProject (fullName, onlyLoadNotOpen = false) {
    let li;
    if (!onlyLoadNotOpen && $world) li = $world.showLoadingIndicatorFor($world, 'Loading Project...');
    // Create Project object and do not automatically update the referenced lively version.
    // The project acts merely as a container until we fill in the correct contents below!
    const loadedProject = new Project(fullName);

    let address;
    address = await Project.projectDirectory(fullName);
    loadedProject.url = address.url;
    loadedProject.configFile = address.join('package.json');
    if (!onlyLoadNotOpen) {
      loadedProject.gitResource = await Project.ensureGitResource(fullName);

      // As we cannot easily access gitresource when cloning a project, do this here.
      // Gets executed more often than necessary, but is a valid catch-all solution to treat recently cloned projects as well as a user change.
      const currUserData = currentUserData();
      if (currUserData) await loadedProject.gitResource.setGitConfig(currUserData.name, currUserData.email);

      if (await loadedProject.gitResource.hasRemote()) {
        const remoteURL = await loadedProject.gitResource.getRemote();
        let remoteURLUserTokenMatch = remoteURL.match(/(gho_.*)@/);
        let userTokenInRemoteURL;
        const currUserToken = currentUserToken();
        // This should always be the case, just be defensive here to minimize the potential for crashes.
        if (remoteURLUserTokenMatch) userTokenInRemoteURL = remoteURLUserTokenMatch[1];
        if (currUserToken && userTokenInRemoteURL && (userTokenInRemoteURL !== currUserToken)) {
          const repoOwner = fullName.replace(/--.*/, '');
          const name = fullName.replace(/.*--/, '');
          await loadedProject.gitResource.changeRemoteURLToUseCurrentToken(currUserToken, repoOwner, name);
        }
      }
      // The latter part of the condition is only to not tightly couple lively.projects to the code in bootstrap.js
      if (!lively.isInOfflineMode && !lively.projectRepoPull) {
        // Ensure that we do not run into conflicts regarding the bound lively version.
        await Project.resetConfigFiles(loadedProject.gitResource);
        await Project.pullUpstreamChangesIfRemote(loadedProject.gitResource);
      } else {
        await lively.projectRepoPull;
      }
    }

    loadedProject.config = await loadedProject.configFile.readJson();

    // We reset uncommitted changes in `package.json` above. This should usually only concern the bound lively version or dependencies.
    // We reintroduce those changes here, if necessary.
    const checkLivelyCompatibility = await loadedProject.bindAgainstCurrentLivelyVersion(loadedProject.config.lively.boundLivelyVersion, onlyLoadNotOpen);
    if (!onlyLoadNotOpen) {
      loadedProject.addMissingProjectDependencies(); // Add dependencies which are directly imported by JS files inside of this project.
      switch (checkLivelyCompatibility) {
        case 'CANCELED':
        case 'OUTDATED': {
          await $world.inform({ title: 'The required lively version of this project conflicts with the running one.', text: 'You can proceed with OK, but be aware that some expected behaviour might differ or not work.' });
        }
      }
    }

    try {
      await loadedProject.ensureDependenciesExist();
      await loadedProject.checkVersionCompatibilityOfProjectDependencies(onlyLoadNotOpen);
    } catch (err) {
      if (!onlyLoadNotOpen) {
        await $world.inform('The projects dependencies cannot be found.\n This session will now close.');
        window.location.href = (await Project.systemInterface.getConfig().baseURL);
      } else $world.setStatusMessage('Project could not be loaded due to missing dependencies!', StatusMessageError);
      throw new Error({ cause: err });
    }
    if (li) li.label = 'Loading Packages...';
    const pkg = await loadPackage(Project.systemInterface, {
      name: fullName,
      url: loadedProject.url,
      address: loadedProject.url,
      configFile: address.join('package.json').url,
      main: loadedProject.config.main ? address.join(loadedProject.config.main).url : address.join('index.js').url,
      type: 'package'
    });
    loadedProject.package = pkg;
    await Project.installCSSForProject(loadedProject.url, !onlyLoadNotOpen, fullName, (!onlyLoadNotOpen ? loadedProject : null));
    if (!onlyLoadNotOpen) {
      $world.openedProject = loadedProject;
      await loadedProject.retrieveProjectFontsFromCSS();
    }
    if (li) li.remove();
    return loadedProject;
  }

  /**
   * @param {string} projectUrl
   * @param {boolean} forProject - Whether to install CSS for an opened project or a dependency
   * @param {object} opts
   * @param {object} projectRef - Only important when forProject is true. Reference to the Project that the CSS belongs to, so that we can access its instance later.
   */
  static async installCSSForProject (projectUrl, forProject, projectName, projectRef) {
    const indexCSSResource = resource(projectUrl).join('index.css');
    let indexCSS = await indexCSSResource.read();
    if (forProject) {
      indexCSS = `@import '/local_projects/${projectName}/fonts.css';\n` + indexCSS;
      addOrChangeCSSDeclaration(`CSS-for-project-${projectName}`, indexCSS);
      const updateProjectCSS = async () => {
        let cssContents = await indexCSSResource.read();
        cssContents = `@import '/local_projects/${projectName}/fonts.css';\n` + cssContents;
        addOrChangeCSSDeclaration(`CSS-for-project-${projectName}`, cssContents);
        await projectRef.retrieveProjectFontsFromCSS();
      };
      $world.fileWatcher.registerFileAction(indexCSSResource, updateProjectCSS);
      $world.fileWatcher.registerFileAction(resource(projectUrl).join('fonts.css'), updateProjectCSS);
      await updateProjectCSS();
    } else {
      indexCSS = `@import '/local_projects/${projectName}/fonts.css';\n` + indexCSS;
      addOrChangeCSSDeclaration(`CSS-for-dependency-${projectName}`, indexCSS);
    }
  }

  showDiffSummary () {
    // Reset current staging area (necessary for `git diff-files` to produce meaningful output) while suppressing output.
    // Run `git diff-file --stat` and output result (nice overview of **changed** files).
    // Add all files to staging area while suppressing output, ensure that we reach the last command.
    // Printout new line (just for easier to read output).
    // Run git `status --short` and output result (overview **including new files**).
    const term = Terminal.runCommand("git reset 1>/dev/null && git diff-files --stat && git add * 2>/dev/null || true && echo '' && git status --short", { cwd: this.gitResource.url, position: pt(100, 100) });
    term.position = pt(100, 100);
    return term;
  }

  async checkPagesSupport () {
    if (lively.isInOfflineMode) return;
    const currUser = currentUser();
    const currUserName = currUser.login;

    // GH Pages is possible for non-private repositories in any case
    if (!this.config.lively.repositoryIsPrivate) {
      if (!this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
      this.config.lively.canUsePages = true;
      return;
    }

    // Each time the repository is saved by its owner, check if they have a non-free plan, allowing to use GH Pages on private repositories
    if (this.repoOwner === currUserName && this.config.lively.repositoryIsPrivate) {
      if (currUser.plan.name !== 'free') {
        if (!this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
        this.config.lively.canUsePages = true;
      }
      else {
        if (this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
        this.config.lively.canUsePages = false;
      }
      return;
    }

    if (this.config.lively.repoBelongsToOrg) {
      const checkOrgPlanCmd = runCommand(`curl -L \
        -H "Accept: application/vnd.github+json" \
        -H "Authorization: Bearer ${currentUserToken()}" \
        -H "X-GitHub-Api-Version: 2022-11-28" \
        https://api.github.com/orgs/${this.repoOwner}
      `, { l2lClient: ShellClientResource.defaultL2lClient });
      await checkOrgPlanCmd.whenDone();
      // In case the command errors out, we just set the value to false to be on the save side
      if (checkOrgPlanCmd.exitCode !== 0) {
        if (this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
        this.config.lively.canUsePages = false;
      } else {
        const planName = (JSON.parse(checkOrgPlanCmd.stdout))?.plan?.name;
        if (planName && planName !== 'free') {
          if (!this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
          this.config.lively.canUsePages = true;
        }
        else {
          if (this.config.lively.canUsePages) this.config.hasUnsavedChanges = true;
          this.config.lively.canUsePages = false;
        }
      }
    }
  }

  /**
   * Method to be used to store `package.json` data on disk.
   * Other changes will be stored on a per module basis anyways.
   * Called when a project gets saved.
   */
  async saveConfigData () {
    if (!this.config.hasUnsavedChanges) return;
    const remoteConfigured = await this.hasRemoteConfigured();
    // Update for the case that a user changed its plan since the last save.
    if (remoteConfigured) await this.checkPagesSupport();
    
    const filesInPackage = await resource(this.url).asDirectory().dirList('infinity',{exclude: r => r.url.includes('node_modules') || r.url.includes('.git')});
    await this.removeUnusedProjectDependencies(filesInPackage);
    await this.addMissingProjectDependencies(filesInPackage);

    // We use author here, as owner can also be an org.
    // This assumes, that the author of org projects has sufficient rights (admin) to retrieve secrets.
    if (currentUsername() === this.config.author.name) {
      if (remoteConfigured && !lively.isInOfflineMode) await this.setupDependencyPermissions();
    } else {
      console.warn('Dependency permissions might not be setup correctly. To ensure working dependencies remotely, the owner of the project needs to save it.');
    }
    if (!this.configFile) {
      throw Error('No config file found. Should never happen.');
    }
    try {
      delete this.config.hasUnsavedChanges;
      await this.configFile.write(JSON.stringify(this.config, null, 2));
    } catch (e) {
      this.config.hasUnsavedChanges = true;
      throw Error('Error writing config file', { cause: e });
    }
  }

  async setupDependencyPermissions () {
    const dependencies = await this.generateFlatDependenciesList();
    const normalizedDeps = dependencies.map(d => d.name.replaceAll('/', '_').replaceAll('-', '_'));
    const alreadySetupDependencies = (await GitHubAPIWrapper.listActionSecrets(this.repoOwner, this.name)).map(d => d.toLowerCase());

    for (let dep of alreadySetupDependencies) {
      if (normalizedDeps.includes(dep)) continue;
      await GitHubAPIWrapper.deleteRepositorySecret(this.repoOwner, this.name, dep);
      const dependencyOwner = dep.replace(/__.*/, '');
      const dependencyName = dep.replace(/.*__/, '');
      await GitHubAPIWrapper.deleteDeployKey(dependencyOwner.replaceAll('_', '-'), dependencyName.replaceAll('_', '-'), this.fullName.replaceAll('/', '_').replaceAll('-', '_'));
    }

    for (let i = 0; i < dependencies.length; i++) {
      const dep = dependencies[i];
      const normalizedDep = normalizedDeps[i];
      if (alreadySetupDependencies.includes(normalizedDep)) continue;
      const [priv, pub] = await generateKeyPair();
      const repoPublicKey = await GitHubAPIWrapper.retrieveRepositoriesPublicKey(this.repoOwner, this.name);
      const depName = dep.name.replace(/.*--/, '');
      const depOwner = dep.name.replace(/--.*/, '');
      await GitHubAPIWrapper.addDeployKey(depOwner, depName, this.fullName.replaceAll('/', '_').replaceAll('-', '_'), pub);
      await GitHubAPIWrapper.addOrUpdateRepositorySecret(this.repoOwner, this.name, normalizedDep, priv, repoPublicKey.key, repoPublicKey.id);
    }
  }

  /**
   * Increases the version number of the project in its config data.
   * Works solely on the Project data structure, does not write anything to disk.
   * @param {String} 'major', 'minor', or 'patch', depending on what should be increased
   */
  increaseVersion (increaseLevel = 'patch') {
    const version = semver.coerce(this.config.version);
    this.config.version = semver.inc(version, increaseLevel);
    this.config.hasUnsavedChanges = true;
  }

  async bindAgainstCurrentLivelyVersion (knownCompatibleVersion, onlyLoadNotOpen = false) {
    const { comparison } = await lively.checkedProjectVersionRelation || await VersionChecker.checkVersionRelation(knownCompatibleVersion, true);
    const comparisonBetweenVersions = VersionChecker.parseHashComparison(comparison);
    if (comparisonBetweenVersions > 0 && onlyLoadNotOpen) {
      console.warn('A loaded project expects a different lively version than the one currently running.');
      return;
    }
    switch (comparisonBetweenVersions) {
      case (0): {
        if (!onlyLoadNotOpen) $world.setStatusMessage('Already using the latest lively version. All good!', StatusMessageConfirm);
        return 'SUCCESS';
      }
      case (1): {
        const confirmed = await $world.confirm('This changes the required version of lively.next for this project.\n Are you sure you want to proceed?');
        if (!confirmed) {
          $world.setStatusMessage('Changing the required version of lively.next has been canceled.', StatusMessageError);
          return 'CANCELED';
        } else {
          $world.setStatusMessage(`Updated the required version of lively.next for ${this.name}.`, StatusMessageConfirm);
          const currentCommit = await VersionChecker.currentLivelyVersion(true);
          this.config.lively.boundLivelyVersion = currentCommit;
          this.config.hasUnsavedChanges = true;
          await this.saveConfigData();
          await this.regeneratePipelines();
          return 'UPDATED';
        }
      }
      case (-1):
      case (2): {
        $world.setStatusMessage(`You do not have the version of lively.next necessary to open this project. Please get version ${knownCompatibleVersion} of lively.next`, StatusMessageError);
        return 'OUTDATED';
      }
      case (3) : {
        $world.setStatusMessage(`The required version of lively.next ${this.name} has been overwritten. ${this.name} has been upgraded to use the latest version available to you.`, StatusMessageWarning);
        const currentCommit = await VersionChecker.currentLivelyVersion(true);
        this.config.lively.boundLivelyVersion = currentCommit;
        this.config.hasUnsavedChanges = true;
        await this.saveConfigData();
        await this.regeneratePipelines();
        return 'UPDATED';
      }
    }
  }

  addRemoteConfig (priv) {
    const { config } = this;
    config.lively.repositoryIsPrivate = !!priv;
    const repoOwner = this.repoOwner;
    config.lively.repoBelongsToOrg = repoOwner !== currentUsername();
    config.repository = {
      type: 'git',
      url: `https://github.com/${repoOwner}/${this.name}`
    };

    // OPINIONATED DEFAULTS
    const livelyConfig = config.lively;
    livelyConfig.testOnPush = true;
    livelyConfig.buildOnPush = false;
    livelyConfig.deployOnPush = false;
    this.config.hasUnsavedChanges = true;
  }

  async create (withRemote = false, gitHubUser, priv) {
    this.gitResource = null;
    const system = Project.systemInterface;

    const projectDir = await Project.projectDirectory(`${gitHubUser}--${this.name}`);
    this.url = projectDir.url;

    try {
      await system.resourceCreateFiles(projectDir, {
        'index.js': "'format esm';\nexport async function main () {\n    // THIS FUNCTION IS THE ENTRY POINT IN THE BUNDLED APPLICATION!\n}",
        'package.json': '',
        '.gitignore': 'node_modules/\nbuild/\n.livelyForkInformation',
        'README.md': `# ${this.name}\n\nNo description for package ${this.name} yet.\n`,
        tools: {
          'build.sh': '',
          'build.mjs': ''
        },
        build: { },
        tests: {
          'test.js': `/* global describe,it */\nimport { expect } from "mocha-es6";\ndescribe("${this.name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
        },
        ui: {
          'components.cp.js': "'format esm';\n"
        },
        workspaces: {
          'default.workspace.js': ''
        },
        'index.css': '/* Use this file to add custom CSS to be used for this project. */\n/* Do NOT create other CSS files in this folder, as they will not be available in the bundled application! */\n/* `@imports` fetching remote CSS are okay. */',
        'fonts.css': fontCSSWarningString
      });
      await this.generateBuildScripts();
      this.gitResource = await Project.ensureGitResource(this.fullName);
      this.configFile = await resource(projectDir.join('package.json').url);

      await this.gitResource.initializeGitRepository();
      const currUserData = currentUserData();
      await this.gitResource.setGitConfig(currUserData.name, currUserData.email);

      if (withRemote) {
        this.addRemoteConfig(priv);
      }
      await this.saveConfigData();

      await evalOnServer(`System.get("@lively-env").packageRegistry.addPackageAt(System.baseURL + 'local_projects/${this.fullName}')`);
      await System.get('@lively-env').packageRegistry.addPackageAt(projectDir);

      const pkg = await loadPackage(system, {
        name: this.fullName,
        url: this.url,
        address: this.url,
        configFile: projectDir.join('package.json').url,
        main: projectDir.join('index.js').url,
        test: projectDir.join('tests/test.js').url,
        type: 'package'
      });
      this.package = pkg;
    } catch (error) {
      throw Error('Error creating project files', { cause: error });
    }
    await Project.installCSSForProject(this.url, true, this.fullName, this);
    if (withRemote) {
      try {
        await this.gitResource.createAndAddRemoteToGitRepository(currentUserToken(), this.name, gitHubUser, this.config.description, gitHubUser !== currentUsername(), priv);
        await this.regeneratePipelines();
      } catch (e) {
        throw Error('Error setting up remote', { cause: e });
      }
    }

    const saveSuccess = await this.save({ message: 'Initial Commit' }, true);
    if (!saveSuccess) $world.setStatusMessage('Error saving the project!', StatusMessageError);
    return this;
  }

  reloadPackage () {
    reloadPackage(System, this.package.url);
  }

  async regeneratePipelines () {
    if (!lively.isInOfflineMode) {
      await this.checkPagesSupport();
      await this.gitResource.activateGitHubPages(currentUserToken(), this.name, this.repoOwner);
    }
    let pipelineFile, content;
    const livelyConfig = this.config.lively;

    pipelineFile = join(this.url, '.github/workflows/ci-tests.yml');
    content = await this.fillPipelineTemplate(workflowDefinition, livelyConfig.testOnPush);
    await (await resource(pipelineFile).ensureExistance()).write(content);

    pipelineFile = join(this.url, '.github/workflows/build-upload-action.yml');
    content = await this.fillPipelineTemplate(buildRemoteScript, livelyConfig.buildOnPush);
    await (await resource(pipelineFile).ensureExistance()).write(content);

    pipelineFile = join(this.url, '.github/workflows/deploy-pages-action.yml');
    content = await this.fillPipelineTemplate(deployScript, livelyConfig.deployOnPush);
    await (await resource(pipelineFile).ensureExistance()).write(content);
  }

  async fillPipelineTemplate (workflowDefinition, triggerOnPush = false) {
    const livelyConf = this.config.lively;
    let definition = workflowDefinition.replaceAll('%LIVELY_VERSION%', livelyConf.boundLivelyVersion);
    if (triggerOnPush) {
      definition = definition.replace('%ACTION_TRIGGER%', '\n  push:\n    branches:\n      - main');
    } else definition = definition.replace('%ACTION_TRIGGER%', '');
    if (livelyConf.repositoryIsPrivate && livelyConf.canUsePages) definition = definition.replace('%TOKEN_PERMISSIONS%', '\n  contents: read');
    else definition = definition.replace('%TOKEN_PERMISSIONS%', '');
    const projectDependencies = await this.generateFlatDependenciesList();
    if (projectDependencies.length > 0) {
      let depSetupStatements = '';
      projectDependencies.forEach(dep => {
        if (dep.hasRemote) {
          const name = dep.name.replace(/.*--/, '');
          const owner = dep.name.replace(/--.*/, '');
          let depStatement =
        `\n      - name: Checkout Project Dependencies
        uses: actions/checkout@v4
        with:
          repository: ${owner}/${name}
          path: local_projects/${dep.name}/
          ssh-key: \${{ secrets.${dep.name.replaceAll('/', '_').replaceAll('-', '_')} }}`;
          if (!dep.privateRepo) depStatement = depStatement.replace(/\n\s*ssh-key.*}}/, '');
          depSetupStatements += depStatement;
        }
      });
      definition = definition.replace('%PROJECT_DEPENDENCIES%', depSetupStatements);
    } else definition = definition.replace('%PROJECT_DEPENDENCIES%', '');
    return definition.replaceAll('%PROJECT_NAME%', this.fullName);
  }

  async generateBuildScripts () {
    const shellBuildScript = join(this.url, 'tools/build.sh');
    await (await resource(shellBuildScript).ensureExistance()).write(buildScriptShell);
    const mjsBuildScript = join(this.url, 'tools/build.mjs');
    let content = buildScript;
    content = content.replaceAll('%PROJECT_NAME%', this.fullName);
    await (await resource(mjsBuildScript).ensureExistance()).write(content);
    const shellBuildScriptOrigin = new URL(shellBuildScript).origin;
    const scriptDir = shellBuildScript.replace(shellBuildScriptOrigin + '/', '').replace('/build.sh', '');
    const cmd = runCommand(`cd ../${scriptDir} && chmod a+x build.sh`, { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone();
    return cmd.exitCode;
  }

  async save (opts = {}, initialSave = false) {
    if (!isUserLoggedIn()) {
      $world.setStatusMessage('Please log in.');
      return false;
    }
    let { message, increaseLevel, tag, filesToCommit, needsPipelines } = opts;
    message = message.trim();
    message = message + '\nCommited from within lively.next.';

    this.increaseVersion(increaseLevel);
    try {
      const hasRemote = await this.gitResource.hasRemote();
      if (hasRemote && needsPipelines) await this.regeneratePipelines();
      await this.saveConfigData();
      if (hasRemote) {
        if (!lively.isInOfflineMode && !initialSave) await this.gitResource.pullRepo();
        await this.regeneratePipelines();
        await this.gitResource.commitRepo(message, tag, this.config.version, filesToCommit);
        if (!lively.isInOfflineMode) await this.gitResource.pushRepo();
        // In case we have pulled new changes, reload the package so that lively knows of them!
        await this.reloadPackage();
      } else await this.gitResource.commitRepo(message, tag, this.config.version);
      return true;
    } catch (err) {
      $world.setStatusMessage(err);
      return false;
    }
  }

  async ensureDependenciesExist () {
    const dependencyMap = {};

    let availableProjects = await Project.listAvailableProjects();
    let depsToEnsure = this.config.lively.projectDependencies.map(dep => ({
      name: dep.name,
      version: dep.version,
      requester: this.fullName
    }));

    // Check until all (transitive) deps are ensured to exist.
    // The same dependency with different versions needs to be counted as a separate dependency.
    while (depsToEnsure.length > 0) {
      const depToEnsure = depsToEnsure[0];
      // We have already ensured a dep with this name previously.
      if (dependencyMap[depToEnsure.name]) {
        // Same version has already been requested, we only need to add to requester list.
        if (dependencyMap[depToEnsure.name][depToEnsure.version]) {
          const dependerArray = dependencyMap[depToEnsure.name][depToEnsure.version];
          if (!dependerArray.includes(depToEnsure.requester)) dependerArray.push(depToEnsure.requester);
          // Same name has been requested, but not the same version.
        } else dependencyMap[depToEnsure.name][depToEnsure.version] = [depToEnsure.requester];
        depsToEnsure.shift();
        continue;
      }
      // No dependency with this name has been requested.
      const depExists = availableProjects.some(proj => proj._name === depToEnsure.name);
      // Dependency is not yet installed locally. Try to retrieve it from GitHub.
      // Cannot happen in offline mode, as we do not allow cloning new projects anyways. Left in as a safety measure regardless.
      if (!depExists && !lively.isInOfflineMode) {
        const depName = depToEnsure.name.match(/[a-zA-Z\d]*--(.*)/)[1];
        const depRepoOwner = depToEnsure.name.match(/([a-zA-Z\d]*)--/)[1];
        // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
        const cmd = runCommand(`cd ../local_projects/ && git clone https://${currentUserToken()}@github.com/${depRepoOwner}/${depName} ${depRepoOwner}--${depName}`, { l2lClient: ShellClientResource.defaultL2lClient });
        await cmd.whenDone();
        if (cmd.exitCode !== 0) throw Error('Error cloning uninstalled dependency project.');
        // Refresh the cache of available projects and their version.
        const projectDir = await Project.projectDirectory(`${depRepoOwner}--${depName}`);
        await evalOnServer(`System.get("@lively-env").packageRegistry.addPackageAt(System.baseURL + 'local_projects/${depRepoOwner}--${depName}')`);
        await PackageRegistry.ofSystem(System).addPackageAt(projectDir);
        availableProjects = await Project.listAvailableProjects();
      }
      // Add all transitive dependencies from the current dependency to the list.
      // **Note:** Actually, the transitive dependencies of a project could be different in different versions of this project.
      // Since we do not **actually** resolve the correct versions of projects currently, but only use the version number to *report* to users that something might be amiss, we do not deal with this here.
      // In case we could actually resolve different versions of the same project at the same time, transitive dependencies would also need to be handled in the case same name but different version above!
      const transitiveDepsOfDepToEnsure = availableProjects.find(proj => proj._name === depToEnsure.name).lively.projectDependencies.map(dep => ({
        name: dep.name,
        version: dep.version,
        requester: depToEnsure.name
      }));
      transitiveDepsOfDepToEnsure.forEach(dep => dep.requester = depToEnsure.name);
      depsToEnsure = depsToEnsure.concat(transitiveDepsOfDepToEnsure);

      // Load the dependency and mount its CSS.
      const adr = await Project.projectDirectory(depToEnsure.name);
      await loadPackage(Project.systemInterface, {
        name: depToEnsure.name,
        url: adr.url,
        address: adr.url,
        type: 'package'
      });
      Project.installCSSForProject(adr.url, false, depToEnsure.name);
      // Last step: mark dependency with name and version as ensured and remove it from the list.
      dependencyMap[depToEnsure.name] = {
        [String(depToEnsure.version)]: [depToEnsure.requester]
      };
      depsToEnsure.shift();
    }
    // Is used for semver checking below in `checkVersionCompatibilityOfProjectDependencies`.
    this.dependencyMap = dependencyMap;
  }

  async generateFlatDependenciesList () {
    const dependencyMap = {};

    let availableProjects = await Project.listAvailableProjects();
    let depsToEnsure = this.config.lively.projectDependencies.map(dep => {
      const avlProj = availableProjects.find(p => p._name === dep.name);
      return {
        name: dep.name,
        privateRepo: avlProj.config.lively.repositoryIsPrivate,
        hasRemote: 'testOnPush' in avlProj.config.lively
      };
    });

    while (depsToEnsure.length > 0) {
      const depToEnsure = depsToEnsure[0];
      if (dependencyMap[depToEnsure.name]) {
        depsToEnsure.shift();
        continue;
      }

      const transitiveDepsOfDepToEnsure = availableProjects.find(proj => proj._name === depToEnsure.name).lively.projectDependencies.map(dep => {
        const avlProj = availableProjects.find(p => p._name === dep.name);
        return {
          name: dep.name,
          privateRepo: avlProj.config.lively.repositoryIsPrivate,
          hasRemote: 'testOnPush' in avlProj.config.lively
        };
      });
      depsToEnsure = depsToEnsure.concat(transitiveDepsOfDepToEnsure);

      dependencyMap[depToEnsure.name] = {
        name: depToEnsure.name,
        privateRepo: depToEnsure.privateRepo,
        hasRemote: depToEnsure.hasRemote
      };
      depsToEnsure.shift();
    }
    return Object.values(dependencyMap);
  }

  async checkVersionCompatibilityOfProjectDependencies (onlyLoadNotOpen = false) {
    const { dependencyMap } = this;
    let dependencyStatusReport = [];
    const availableProjects = await Project.listAvailableProjects();
    let showStatusReport = false;
    for (let dep in dependencyMap) {
      const installedDep = availableProjects.find(proj => proj._name === dep);
      for (let depVersion in dependencyMap[dep]) {
        const requesterOfDepVersion = dependencyMap[dep][depVersion].join(' ');
        // FIXME: We could determine if it would in theory be possible to find a version that satisfies all required ranges for a given dependency.
        // However, since `semver` only allows us to check this for exactly two ranges at a time, we would need to loop over all pairs of required versions.
        // Since we cannot really do anything with this information as of yet, I omitted that code here.
        const versionStatus = semver.satisfies(semver.coerce(installedDep.version), semver.validRange(depVersion));
        if (versionStatus === true) dependencyStatusReport = dependencyStatusReport.concat([`✔️ Loaded ${dep} with version ${installedDep.version} (${depVersion} required by [${requesterOfDepVersion}]).\n`, null]);
        else {
          showStatusReport = true;
          dependencyStatusReport = dependencyStatusReport.concat([`⚠️ Loaded ${dep} with version ${installedDep.version}, but ${depVersion} required by [${requesterOfDepVersion}].\n`, null]);
        }
      }
    }
    if (showStatusReport && !onlyLoadNotOpen) $world.inform({ title: 'Dependency Status', text: dependencyStatusReport.concat(['Loading has been successful, but be cautious.', { fontWeight: 700 }]) });
    if (showStatusReport && onlyLoadNotOpen) console.warn('A loaded project introduced a dependency version conflict.');
    // Reset this, so that nobody gets tempted to (ab)use this hot mess of a half-working feature...
    this.dependencyMap = null;
  }

  async addMissingProjectDependencies (alreadyRetrievedFiles = false) {
    const availableDeps = (await Project.listAvailableProjects()).map(proj => ({ name: proj.name, version: proj.version }));
    let currentDeps = this.config.lively.projectDependencies.slice();

    const filesInPackage = alreadyRetrievedFiles || await resource(this.url).asDirectory().dirList('infinity',{exclude: r => r.url.includes('node_modules') || r.url.includes('.git')});
    const jsFilesInPackage = filesInPackage.filter(p => p.url.endsWith('.js') && !p.url.includes('/build'));
    for (let jsFile of jsFilesInPackage) {
      const content = await jsFile.read();
      availableDeps.forEach(dep => {
        if (content.includes(dep.name) &&
            !currentDeps.some(alreadyPresentDeps => dep.name === alreadyPresentDeps.name) &&
            this.fullName !== dep.name) currentDeps.push(dep);
      });
    }
    currentDeps = arr.uniqBy(currentDeps, obj.equals);
    if (!obj.equals(currentDeps, this.config.lively.projectDependencies)) this.config.hasUnsavedChanges = true;
    this.config.lively.projectDependencies = currentDeps;
    return currentDeps;
  }

  async removeUnusedProjectDependencies (alreadyRetrievedFiles = false) {
    let usedDeps = [];
    const currentDeps = this.config.lively.projectDependencies;

    const filesInPackage = alreadyRetrievedFiles || await resource(this.url).asDirectory().dirList('infinity',{exclude: r => r.url.includes('node_modules') || r.url.includes('.git')});
    const jsFilesInPackage = filesInPackage.filter(p => p.url.endsWith('.js') && !p.url.includes('/build'));
    for (let jsFile of jsFilesInPackage) {
      const content = await jsFile.read();
      currentDeps.forEach(dep => {
        if (content.includes(dep.name)) usedDeps.push(dep);
      });
    }
    if (!obj.equals(this.config.lively.projectDependencies), usedDeps) this.config.hasUnsavedChanges = true;
    this.config.lively.projectDependencies = usedDeps;
    return usedDeps;
  }

  async addCustomFontFace (customFontObj) {
    const fontCSS = resource(this.url).join('fonts.css');
    let fontCSSContent = await fontCSS.read();
    const fontCSSToAdd = generateFontFaceString(customFontObj);
    fontCSSContent = fontCSSContent + fontCSSToAdd;
    await fontCSS.write(fontCSSContent);
  }

  async deleteCustomFont (fontObjToDelete, deleteFile = false) {
    const currentProjFonts = await this.retrieveProjectFontsFromCSS();
    const fontFileToDelete = resource($world.openedProject.url).join('assets/' + fontObjToDelete.fileName + '.woff2');
    const newProjFonts = currentProjFonts.filter((projFont) => !obj.equals(projFont, fontObjToDelete));
    let cssString = newProjFonts.map(f => generateFontFaceString(f)).join('\n');
    cssString = fontCSSWarningString + cssString;
    const fontCSS = resource(this.url).join('fonts.css');
    if (deleteFile) await fontFileToDelete.remove();
    await fontCSS.write(cssString);
  }

  async retrieveProjectFontsFromCSS () {
    const fontObjects = [];
    const fontCSS = resource(this.url).join('fonts.css');
    let fontCSSContent = (await fontCSS.read()).replaceAll(/\s+/g, ' ');

    const matches = fontCSSContent.matchAll(/@font-face {([^}]*)}/gm);

    for (let match of matches) {
      const fontString = match[1].replaceAll(/\s+/g, ' ');
      fontObjects.push({
        fileName: fontString.match(/url\('.*\/(.*)\.woff2'\);/)[1],
        fontName: fontString.match(/font-family: '(.*)'; src/)[1],
        fontWeight: fontString.match(/font-weight: ([\s\d]*);/)?.[1].split(' ').map(i => Number.parseInt(i)) || [],
        fontStyle: fontString.match(/font-style: ([a-z]*);/)[1],
        unicodeRange: fontString.match(/unicode-range: ([^;]*)/)?.[1] || "''"
      });
    }
    // In order to not deal with the actual CSS file when not strictly necessary, we always "cache" the latest contents in this variable.
    // To be used mainly in `projectFonts()` below.
    this._fonts = fontObjects || [];
    return fontObjects;
  }

  get projectFonts () {
    const fonts = this._fonts;
    // We need to transform the objects that are "@font-face compatible" to an array of objects where each object contains a name and an array of supported fontweights:
    const fontItems = fonts.map(fontObj => {
      const name = fontObj.fontName;
      // Only one specific fontWeight is supported
      if (fontObj.fontWeight.length === 1) return { name, supportedWeights: fontObj.fontWeight };
      // A range of fontWeights is supported
      const supportedWeights = [];
      if (fontObj.fontWeight.length === 2) {
        const range = fontObj.fontWeight;
        for (let i = Number(range[0]); i <= range[1]; i += 100) supportedWeights.push(i);
        return { name, supportedWeights };
      } else return { name, supportedWeights: [] }; // No explicit fontWeight defined
    }).filter(value => Object.keys(value).length !== 0);

    // The above transformation might produce multiple objects for the same font.
    // Here, we merge them together. In the case that two entries are merged, we need to merge the array of supported fontWeights as well!
    const unifiedFontItems = fontItems.reduce((collection, currentValue) => {
      const findExistingEntry = collection.find(v => v.name === currentValue.name);
      if (findExistingEntry) findExistingEntry.supportedWeights.push(...currentValue.supportedWeights);
      else collection.push(currentValue);
      return collection;
    }, []);

    // Make sure that each fontWeight only appears once (not once for italic and normal) and sort them as users would expect
    unifiedFontItems.forEach(fontItem => fontItem.supportedWeights = arr.uniq(fontItem.supportedWeights.sort(), true));
    return unifiedFontItems;
  }

  /**
   * Returns an array of `resource` handles.
   * @param {string} type - One of 'video', 'audio', 'image'
   */
  async getAssets (type) {
    if (!(await resource(this.url + '/assets').exists()) || ((await resource(this.url + '/assets').dirList()).length === 0)) {
      return false;
    }
    switch (type) {
      case 'image':
        return (await resource(this.url + '/assets').dirList()).filter(a => a.name().match(supportedImageFormats)).sort((a, b) => ('' + a).localeCompare(b));
    }
  }
}
