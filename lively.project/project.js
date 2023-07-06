/* global URL */
/* eslint-disable no-console */
import { localInterface } from 'lively-system-interface';
import { resource } from 'lively.resources';
import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { loadPackage } from 'lively-system-interface/commands/packages.js';
import { workflowDefinition } from './templates/test-action.js';
import { VersionChecker } from 'lively.ide/studio/version-checker.cp.js';
import { StatusMessageConfirm, StatusMessageError } from 'lively.halos/components/messages.cp.js';
import { join } from 'lively.modules/src/url-helpers.js';
import { runCommand } from 'lively.shell/client-command.js';
import ShellClientResource from 'lively.shell/client-resource.js';
import { semver } from 'lively.modules/index.js';
import { currentUsertoken, currentUsername } from 'lively.user';
import { reloadPackage } from 'lively.modules/src/packages/package.js';
import { buildScriptShell } from './templates/build-shell.js';
import { buildScript } from './templates/build.js';
import Terminal from 'lively.ide/shell/terminal.js';
import { pt } from 'lively.graphics';
import { arr, obj } from 'lively.lang';

const repositoryOwnerAndNameRegex = /\.com\/(.+)\/(.*)/;

export class Project {
  static retrieveAvailableProjectsCache () {
    return JSON.parse(localStorage.getItem('available_lively_projects'));
  }

  static get systemInterface () {
    return localInterface.coreInterface;
  }

  // As a URL to be used from inside of lively.
  static async projectDirectory () {
    const baseURL = await Project.systemInterface.getConfig().baseURL;
    return resource(baseURL).join('local_projects').asDirectory();
  }

  get name () {
    return this.config.name;
  }

  // TODO: 🍴 Support
  // **Note** since this is a getter on an instance, we can retrieve whatever we want from the config object
  // We just need to make sure that we populate it in the correct way!
  get repoOwner () {
    return this.config.repository.url.match(repositoryOwnerAndNameRegex)[1];
  }

  constructor (name, opts = { author: 'anon', description: '', repoOwner: 'anon' }) {
    const { author, description, repoOwner } = opts;
    this.config = {
      name: name || 'new world',
      author: {
        // TODO: We could enhance this by utilizing more of the user data GitHub provides for us
        // See: https://docs.npmjs.com/cli/v6/configuring-npm/package-json#people-fields-author-contributors
        name: author
      },
      description: description,
      repository: {
        type: 'git',
        url: `https://github.com/${repoOwner}/${name}`
      },
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

  static async listAvailableProjects () {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;
    const projectsDir = lively.FreezerRuntime ? resource(baseURL).join('../local_projects').withRelativePartsResolved().asDirectory() : (await Project.projectDirectory());

    let projectsCandidates = await resource(projectsDir).dirList(2, {
      exclude: dir => {
        return dir.isFile() && !dir.name().endsWith('package.json');
      }
    });
    try {
      projectsCandidates = projectsCandidates.filter(dir => dir.name().endsWith('package.json')).map(f => f.parent());
      const packageJSONStrings = await Promise.all(projectsCandidates.map(async projectDir => await resource(projectDir.join('package.json')).read()));
      const packageJSONObjects = packageJSONStrings.map(s => JSON.parse(s));
      // TODO: 🍴 Support
      packageJSONObjects.forEach(pkg => pkg.projectRepoOwner = pkg.repository.url.match(repositoryOwnerAndNameRegex)[1]);
      // To allow correct resolution of projects via `flatn`, we need the name attribute in `package.json` to match the folder of the package.
      // To make working with the project names easier at runtime, we remove the owner-- here, so that the name attribut equals the project name again.
      packageJSONObjects.forEach(pkg => pkg.name = pkg.name.replace(/[a-zA-Z\d]*--/, ''));
      localStorage.setItem('available_lively_projects', JSON.stringify(packageJSONObjects));
      return packageJSONObjects;
    } catch (err) {
      throw Error('Error listing local projects', { cause: err });
    }
  }

  /**
   * Takes the URL for a GitHub Repository at which a lively project resides and clones the repository in the projects folder of the local lively installation.
   * Afterwards, the cloned project gets loaded.
   * @param {string} remote - The URL of the GitHub Repository.
   */
  static async fromRemote (remote) {
    const li = $world.showLoadingIndicatorFor($world, 'Fetching Project...');

    if (remote.endsWith('/')) remote = remote.slice(0, -1);
    const remoteUrl = new URL(remote);

    const userToken = currentUsertoken();
    // TODO: 🍴 Support!
    // Check here if the repo to clone is a fork (GitHub API) and create hidden metadata files if necessary.
    const projectName = remote.match(repositoryOwnerAndNameRegex)[2];
    const projectRepoOwner = remote.match(repositoryOwnerAndNameRegex)[1];
    // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
    const cmd = runCommand(`cd ../local_projects/ && git clone https://${userToken}@github.com${remoteUrl.pathname} ${projectRepoOwner}--${projectName}`, { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone();
    if (cmd.exitCode !== 0) throw Error('Error cloning repository');
    li.remove();
    const loadedProject = await Project.loadProject(projectName, projectRepoOwner);
    return loadedProject;
  }

  static async deleteProject (name, repoOwner) {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;
    const projectsDir = lively.FreezerRuntime ? resource(baseURL).join(`../local_projects/${repoOwner}--${name}`).withRelativePartsResolved().asDirectory() : ((await Project.projectDirectory()).join(`/${repoOwner}--${name}`).asDirectory());
    try {
      await projectsDir.remove();
    } catch (err) {
      throw Error('Error deleting project', { cause: err });
    }
  }

  static async loadProject (name, repoOwner, onlyLoadNotOpen = false) {
    let li;
    if (!onlyLoadNotOpen && $world) li = $world.showLoadingIndicatorFor($world, 'Loading Project...');
    // Create Project object and do not automatically update the referenced lively version.
    // The project acts merely as a container until we fill in the correct contents below!
    const loadedProject = new Project(name);

    let address, url;
    // Operates on the "patched" name property, thus we need to glue owner and name together with dashes, to get the folder of the project.
    address = (await Project.projectDirectory()).join(repoOwner + '--' + name);
    url = address.url;
    loadedProject.url = url;
    loadedProject.configFile = await resource(address.join('package.json').url);
    if (!onlyLoadNotOpen) {
      loadedProject.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(repoOwner + '--' + name).withRelativePartsResolved().asDirectory();
      // Ensure that we do not run into conflicts regarding the bound lively version.
      await loadedProject.gitResource.resetFile('package.json');
      await loadedProject.gitResource.resetFile('.github/workflows/ci-tests.yml');
      if (await loadedProject.gitResource.hasRemote()) await loadedProject.gitResource.pullRepo();
    }

    const configContent = await loadedProject.configFile.read();
    loadedProject.config = JSON.parse(configContent);
    // `package.json` contains the `flatn`-friendly version, exchange that here for more comfortable runtime behavior.
    loadedProject.config.name = name;
    // We reset uncommitted changes in `package.json` above. This should usually only concern the bound lively version or dependencies. We reintroduce those changes here, if necessary.
    const checkLivelyCompatibility = await loadedProject.bindAgainstCurrentLivelyVersion(loadedProject.config.lively.boundLivelyVersion, onlyLoadNotOpen);
    if (!onlyLoadNotOpen) {
      loadedProject.addMissingProjectDependencies(); // Add dependencies which are directly imported by JS files inside of this project.
      switch (checkLivelyCompatibility) {
        case 'CANCELED':
        case 'OUTDATED': {
          await $world.inform('The required lively version of this project conflicts with the running one.', { additionalText: 'You can proceed with OK, but be aware that some expected behaviour might differ or not work.' });
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

    const pkg = await loadPackage(Project.systemInterface, {
      name: name,
      url: url,
      address: url,
      configFile: address.join('package.json').url,
      main: loadedProject.config.main ? address.join(loadedProject.config.main).url : address.join('index.js').url,
      type: 'package'
    });
    loadedProject.package = pkg;

    if (!onlyLoadNotOpen) $world.openedProject = loadedProject;
    if (li) li.remove();
    return loadedProject;
  }

  showDiffSummary () {
    const term = Terminal.runCommand('git diff-files --stat', { cwd: this.gitResource.url, position: pt(100, 100) });
    term.position = pt(100, 100);
    return term;
  }

  /**
   * Method to be used to store package.json data on disk.
   * Other changes will be stored on a per module basis anyways.
   * Called when a project gets saved..
   */
  async saveConfigData () {
    await this.removeUnusedProjectDependencies();
    await this.addMissingProjectDependencies();
    if (!this.configFile) {
      throw Error('No config file found. Should never happen.');
    }
    const nameToRecover = this.config.name;
    try {
      this.config.name = `${this.repoOwner}--${nameToRecover}`;
      await this.configFile.write(JSON.stringify(this.config, null, 2));
    } catch (e) {
      throw Error('Error writing config file', { cause: e });
    } finally {
      this.config.name = nameToRecover;
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
  }

  async bindAgainstCurrentLivelyVersion (knownCompatibleVersion, onlyLoadNotOpen = false) {
    const { comparison } = await VersionChecker.checkVersionRelation(knownCompatibleVersion, true);
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
          $world.setStatusMessage(`Updated the required version of lively.next for ${this.config.name}.`, StatusMessageConfirm);
          const currentCommit = await VersionChecker.currentLivelyVersion(true);
          this.config.lively.boundLivelyVersion = currentCommit;
          await this.saveConfigData();
          await this.regenerateTestPipeline();
          return 'UPDATED';
        }
      }
      case (-1):
      case (2) : {
        $world.setStatusMessage(`You do not have the version of lively.next necessary to open this project. Please get version ${knownCompatibleVersion} of lively.next`, StatusMessageError);
        return 'OUTDATED';
      }
    }
  }

  async create (withRemote = false, gitHubUser) {
    this.gitResource = null;
    const system = Project.systemInterface;
    const projectDir = (await Project.projectDirectory()).join(gitHubUser + '--' + this.name);
    this.url = projectDir.url;
    try {
      await system.resourceCreateFiles(projectDir, {
        'index.js': "'format esm';\n",
        'package.json': '',
        '.gitignore': 'node_modules/\nbuild/',
        'README.md': `# ${this.name}\n\nNo description for package ${this.name} yet.\n`,
        '.github': {
          workflows: {
            'ci-tests.yml': workflowDefinition
          }
        },
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
        assets: { },
        'index.css': ''
      });
      await this.generateBuildScripts();
      this.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(gitHubUser + '--' + this.name).withRelativePartsResolved().asDirectory();
      this.configFile = await resource(projectDir.join('package.json').url);

      await this.gitResource.initializeGitRepository();
      await this.saveConfigData();
      const pkg = await loadPackage(system, {
        name: this.name,
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

    if (withRemote) {
      try {
        await this.regenerateTestPipeline();
        const createForOrg = gitHubUser !== currentUsername();
        await this.gitResource.addRemoteToGitRepository(currentUsertoken(), this.config.name, gitHubUser, this.config.description, createForOrg);
      } catch (e) {
        throw Error('Error setting up remote', { cause: e });
      }
    }
    const saveSuccess = await this.save({ message: 'Initial Commit' });
    if (!saveSuccess) $world.setStatusMessage('Error saving the project!', StatusMessageError);
    return this;
  }

  reloadPackage () {
    reloadPackage(System, this.package.url);
  }

  async regenerateTestPipeline () {
    const pipelineFile = join(this.url, '.github/workflows/ci-tests.yml');
    const content = this.fillPipelineTemplate(workflowDefinition);
    await (await resource(pipelineFile).ensureExistance()).write(content);
  }

  fillPipelineTemplate (workflowDefinition) {
    let definition = workflowDefinition.replace('%LIVELY_VERSION%', this.config.lively.boundLivelyVersion);
    // `flatn` resolves the package to test to be its directory name!
    return definition.replaceAll('%PROJECT_NAME%', `${this.repoOwner}--${this.name}`);
  }

  async generateBuildScripts () {
    const shellBuildScript = join(this.url, 'tools/build.sh');
    await (await resource(shellBuildScript).ensureExistance()).write(buildScriptShell);
    const mjsBuildScript = join(this.url, 'tools/build.mjs');
    let content = buildScript;
    content = content.replaceAll('%PROJECT_NAME%', this.name);
    await (await resource(mjsBuildScript).ensureExistance()).write(content);
    const shellBuildScriptOrigin = new URL(shellBuildScript).origin;
    const scriptDir = shellBuildScript.replace(shellBuildScriptOrigin + '/', '').replace('/build.sh', '');
    const cmd = runCommand(`cd ../${scriptDir} && chmod a+x build.sh`, { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone();
    return cmd.exitCode;
  }

  async save (opts = {}) {
    if (currentUsername() === 'guest') {
      $world.setStatusMessage('Please log in.');
      return false;
    }
    let { message, increaseLevel, tag } = opts;
    message = message.trim();
    message = message + '\nCommited from within lively.next.';

    this.increaseVersion(increaseLevel);
    try {
      await this.saveConfigData();
      if (await this.gitResource.hasRemote()) {
        await this.gitResource.pullRepo();
        await this.gitResource.commitRepo(message, tag, this.config.version);
        await this.gitResource.pushRepo();
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

    let availableProjects = Project.retrieveAvailableProjectsCache();
    let depsToEnsure = this.config.lively.projectDependencies.map(dep => ({
      name: dep.name,
      version: dep.version,
      requester: this.name
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
          if (!dependerArray.includes(depToEnsure.requester)) dependencyMap[depToEnsure.name][depToEnsure.version] = dependerArray.push(depToEnsure.requester);
          // Same name has been requested, but not the same version.
        } else dependencyMap[depToEnsure.name][depToEnsure.version] = [depToEnsure.requester];
        depsToEnsure.shift();
        continue;
      }
      // No dependency with this name has been requested.
      const depExists = availableProjects.some(proj => `${proj.projectRepoOwner}--${proj.name}` === depToEnsure.name);
      if (!depExists) { // Dependency is not yet installed locally. Try to retrieve it from GitHub.
        const depName = depToEnsure.name.match(/[a-zA-Z\d]*--(.*)/)[1];
        const depRepoOwner = depToEnsure.name.match(/([a-zA-Z\d]*)--/)[1];
        // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
        const cmd = runCommand(`cd ../local_projects/ && git clone https://${currentUsertoken()}@github.com/${depRepoOwner}/${depName} ${depRepoOwner}--${depName}`, { l2lClient: ShellClientResource.defaultL2lClient });
        await cmd.whenDone();
        if (cmd.exitCode !== 0) throw Error('Error cloning uninstalled dependency project.');
        // Refresh the cache of available projects and their version.
        availableProjects = await Project.listAvailableProjects();
      }
      // Add all transitive dependencies from the current dependency to the list.
      // **Note:** Actually, the transitive dependencies of a project could be different in different versions of this project.
      // Since we do not **actually** resolve the correct versions of projects currently, but only use the version number to *report* to users that something might be amiss, we do not deal with this here.
      // In case we could actually resolve different versions of the same project at the same time, transitive dependencies would also need to be handled in the case same name but different version above!
      const transitiveDepsOfDepToEnsure = availableProjects.find(proj => `${proj.projectRepoOwner}--${proj.name}` === depToEnsure.name).lively.projectDependencies.map(dep => ({
        name: dep.name,
        version: dep.version,
        requester: depToEnsure.name
      }));
      transitiveDepsOfDepToEnsure.forEach(dep => dep.requester = depToEnsure.name);
      depsToEnsure = depsToEnsure.concat(transitiveDepsOfDepToEnsure);

      // Load the dependency.
      // The use to do this explicitly is debatable. Usually it is safe to assume that one actually uses all dependencies in which case `flatn` has our back.
      // However, when one manually adds a dependency to `package.json`, commits that and does not use that dependency in the code,
      // the explicit loading is necessary to get to the expected outcome.
      // Will only be entered once per dependency!
      const adr = (await Project.projectDirectory()).join(depToEnsure.name);
      await loadPackage(Project.systemInterface, {
        name: depToEnsure.name,
        url: adr.url,
        address: adr.url,
        type: 'package'
      });
      // Last step: mark dependency with name and version as ensured and remove it from the list.
      dependencyMap[depToEnsure.name] = {
        [String(depToEnsure.version)]: [depToEnsure.requester]
      };
      depsToEnsure.shift();
    }
    // Is used for semver checking below in `checkVersionCompatibilityOfProjectDependencies`.
    this.dependencyMap = dependencyMap;
  }

  async checkVersionCompatibilityOfProjectDependencies (onlyLoadNotOpen = false) {
    const { dependencyMap } = this;
    let dependencyStatusReport = [];
    const availableProjects = Project.retrieveAvailableProjectsCache();
    let showStatusReport = false;
    for (let dep in dependencyMap) {
      const installedDep = availableProjects.find(proj => `${proj.projectRepoOwner}--${proj.name}` === dep);
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
    if (showStatusReport && !onlyLoadNotOpen) $world.inform('Dependency Status', { additionalText: dependencyStatusReport.concat(['Loading has been successful, but be cautious.', { fontWeight: 700 }]) });
    if (showStatusReport && onlyLoadNotOpen) console.warn('A loaded project introduced a dependency version conflict.');
    // Reset this, so that nobody gets tempted to (ab)use this hot mess of a half-working feature...
    this.dependencyMap = null;
  }

  /**
   * Tries to load the project and adds it to the config of the currently opened project if loading was successful.
   * Also ensures and loads all dependencies that the project to be loaded might have.
   * @param {string} owner
   * @param {string} name
   */
  async addDependencyToProject (owner, name) {
    const ownerAndNameString = `${owner}--${name}`;
    const dep = Project.retrieveAvailableProjectsCache().find(proj => ownerAndNameString === `${proj.projectRepoOwner}--${proj.name}`);
    // TODO: We could think about adding clone support here as well, so that dependencies can be added directly from GitHub.
    if (!dep) throw Error('Dependency is not available!');

    // Order is important here, as we do not want to change the config object when loading of the Project fails!
    try {
      await Project.loadProject(name, owner, true);
    } catch (err) {
      throw Error('Error loading and adding dependency package', { cause: err });
    }

    const version = dep.version;
    const addedSemver = semver.coerce(version);
    // **Note**: Since each save operation in lively increases the patch version, we bind against arbitrary patch ranges.
    // This assumes, that projects developer actually utilize minor/major increases in a meaningful way.
    // We decided against denoting a concrete patch version here, since then one would basically always load "outdated" dependencies.
    const newDepVersion = `${addedSemver.major}.${addedSemver.minor}.x`;
    const deps = this.config.lively.projectDependencies;
    const alreadyDependent = deps.find(dep => dep.name === ownerAndNameString);
    if (alreadyDependent) {
      alreadyDependent.version = newDepVersion;
    } else this.config.lively.projectDependencies.push({ name: ownerAndNameString, version: newDepVersion });
  }

  // Caution: This only removes the dependency from the runtime config information.
  // Config data needs to be explicitly written to disk!
  removeDependencyFromProject (owner, name) {
    const deps = this.config.lively.projectDependencies;
    this.config.lively.projectDependencies = deps.filter(dep => dep.name !== `${owner}--${name}`);
  }

  async addMissingProjectDependencies () {
    const availableDeps = Project.retrieveAvailableProjectsCache().map(proj => ({ name: `${proj.projectRepoOwner}--${proj.name}`, version: proj.version }));
    let currentDeps = this.config.lively.projectDependencies.slice();

    const filesInPackage = await resource(this.url).asDirectory().dirList('infinity');
    const jsFilesInPackage = filesInPackage.filter(p => p.url.endsWith('.js') && !p.url.includes('/build'));
    for (let jsFile of jsFilesInPackage) {
      const content = await jsFile.read();
      availableDeps.forEach(dep => {
        if (content.includes(dep.name) && 
            !currentDeps.some(alreadyPresentDeps => dep.name === alreadyPresentDeps.name) &&
            `${this.repoOwner}--${this.name}` !== dep.name) currentDeps.push(dep);
      });
    }
    currentDeps = arr.uniqBy(currentDeps, obj.equals);
    this.config.lively.projectDependencies = currentDeps;
    return currentDeps;
  }

  async removeUnusedProjectDependencies () {
    let usedDeps = [];
    const currentDeps = this.config.lively.projectDependencies;

    const filesInPackage = await resource(this.url).asDirectory().dirList('infinity');
    const jsFilesInPackage = filesInPackage.filter(p => p.url.endsWith('.js') && !p.url.includes('/build'));
    for (let jsFile of jsFilesInPackage) {
      const content = await jsFile.read();
      currentDeps.forEach(dep => {
        if (content.includes(dep.name)) usedDeps.push(dep);
      });
    }
    this.config.lively.projectDependencies = usedDeps;
    return usedDeps;
  }
}
