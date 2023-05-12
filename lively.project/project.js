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

const repositoryOwnerRegex = /\/([\dA-za-z]+)\//;
const repositoryNameRegex = /\/.+\/(.*)/;
export class Project {
  static async projectDirectory () {
    const baseURL = await Project.systemInterface.getConfig().baseURL;
    return resource(baseURL).join('local_projects').asDirectory();
  }

  get name () {
    return this.config.name;
  }

  constructor (name, bindVersion = true, opts = { author: 'anon', description: '', repoOwner: 'anon' }) {
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
      lively: {
      },
      version: '0.1.0'
    };

    if (bindVersion) VersionChecker.currentLivelyVersion().then(version => this.config.lively.boundLivelyVersion = version);
  }

  static async listAvailableProjects () {
    const baseURL = (await Project.systemInterface.getConfig()).baseURL;
    const projectsDir = lively.FreezerRuntime ? resource(baseURL).join('../local_projects').withRelativePartsResolved().asDirectory() : (await Project.projectDirectory());

    let projectsCandidates = await resource(projectsDir).dirList(2, {
      exclude: dir => {
        return dir.isFile() && !dir.name().endsWith('package.json');
      }
    });
    projectsCandidates = projectsCandidates.filter(dir => dir.name().endsWith('package.json')).map(f => f.parent());
    const packageJSONStrings = await Promise.all(projectsCandidates.map(async projectDir => await resource(projectDir.join('package.json')).read()));
    const packageJSONObjects = packageJSONStrings.map(s => JSON.parse(s));
    packageJSONObjects.forEach(pkg => pkg.projectRepoOwner = pkg.repository.url.match(repositoryOwnerRegex)[1]);
    return packageJSONObjects;
  }

  /**
   * Takes the URL for a GitHub Repository at which a lively project resides and clones the repository in the projects folder of the local lively installation.
   * Afterwards, the cloned project gets loaded.
   * @param {string} remote - The URL at which to find the GitHub Repository.
   */
  static async fromRemote (remote) {
    const remoteUrl = new URL(remote);

    const userToken = currentUsertoken();
    // This relies on the assumption, that the default directory the shell command gets dropped in is `lively.server`.
    const projectName = remoteUrl.pathname.match(repositoryNameRegex)[1];
    const projectRepoOwner = remoteUrl.pathname.match(repositoryOwnerRegex)[1];
    const cmd = runCommand(`cd ../local_projects/ && git clone https://${userToken}@github.com${remoteUrl.pathname} ${projectRepoOwner}-${projectName}`, { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone(); // TODO: this needs error handling

    const loadedProject = await Project.loadProject(projectName, projectRepoOwner);
    return loadedProject;
  }

  static async loadProject (name, repoOwner) {
    // Create Project object and do not automatically update the referenced lively version.
    // It acts merely as a container until we fill in the correct contents below.
    const loadedProject = new Project(name, false);

    let address, url;
    address = (await Project.projectDirectory()).join(repoOwner + '-' + name);
    url = address.url;

    loadedProject.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(repoOwner + '-' + name).withRelativePartsResolved().asDirectory();

    if (await loadedProject.gitResource.hasRemote()) await loadedProject.gitResource.pullRepo();

    const pkg = await loadPackage(Project.systemInterface, {
      name: name,
      address: url,
      configFile: address.join('package.json').url,
      main: address.join('index.js').url,
      test: address.join('tests/test.js').url,
      type: 'package'
    });

    loadedProject.configFile = await resource(address.join('package.json').url);
    const configContent = await loadedProject.configFile.read();
    loadedProject.config = JSON.parse(configContent);
    const checkLivelyCompatability = await loadedProject.bindAgainstCurrentLivelyVersion(loadedProject.config.lively.boundLivelyVersion);

    switch (checkLivelyCompatability) {
      case 'CANCELED':
      case 'OUTDATED': {
        await $world.inform('Due to incompatible lively versions, you cannot open this project. This session will now close. This probably means that your version is older than the one the project requires.');
        window.location.href = (await Project.systemInterface.getConfig().baseURL);
      }
    }
    loadedProject.package = pkg;
    $world.openedProject = loadedProject;
    return loadedProject;
  }

  /**
   * Method to be used to store package.json data away.
   * Other changes will be stored on a per module basis anyways.
   * Called when a project gets saved and otherwise can be called optionally.
   */
  async saveConfigData () {
    if (!this.configFile) {
      console.error('This should never happen.');
      return;
    }
    try {
      await this.configFile.write(JSON.stringify(this.config, null, 2));
    } catch (e) {
      console.warn(`Error when reading package config for ${this.directory}: ${e}`);
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

  static get systemInterface () {
    return localInterface.coreInterface;
  }

  async bindAgainstCurrentLivelyVersion (compatibleVersion) {
    const { comparison } = await VersionChecker.checkVersionRelation(compatibleVersion);
    const comparisonBetweenVersions = VersionChecker.parseHashComparison(comparison);
    switch (comparisonBetweenVersions) {
      case (0): {
        $world.setStatusMessage('Already using the latest version. All good!', StatusMessageConfirm);
        return 'SUCCESS';
      }
      case (1): {
        const confirmed = await $world.confirm('This changes the required version of lively.next for this project.\n Are you sure you want to proceed?');
        if (!confirmed) {
          $world.setStatusMessage('Changing the required version of lively.next has been canceled.', StatusMessageError);
          return 'CANCELED';
        } else {
          $world.setStatusMessage(`Updated the required version of lively.next for ${this.config.name}.`, StatusMessageConfirm);
          const currentCommit = await VersionChecker.currentLivelyVersion();
          this.config.lively.boundLivelyVersion = currentCommit;
          await this.saveConfigData();
          await this.regenerateTestPipeline();
          return 'UPDATED';
        }
      }
      case (-1):
      case (2) : {
        $world.setStatusMessage(`You do not have the version of lively.next necessary to open this project. Please get version ${compatibleVersion} of lively.next`, StatusMessageError);
        return 'OUTDATED';
      }
    }
  }

  async create (withRemote = false, gitHubUser) {
    this.gitResource = null;
    const system = Project.systemInterface;
    const projectDir = (await Project.projectDirectory()).join(gitHubUser + '-' + this.name);
    this.url = projectDir.url;

    await system.resourceCreateFiles(projectDir, {
      'index.js': "'format esm';\n",
      'package.json': '',
      '.gitignore': 'node_modules/',
      'README.md': `# ${this.name}\n\nNo description for package ${this.name} yet.\n`,
      '.github': {
        workflows: {
          'ci-tests.yml': workflowDefinition
        }
      },
      tests: {
        'test.js': `/* global describe,it */\nimport { expect } from "mocha-es6";\ndescribe("${this.name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
      },
      ui: {
        'components.cp.js': ''
      },
      workspaces: {
        'default.workspace.js': ''
      },
      assets: { },
      'index.css': ''
    });

    this.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(gitHubUser + '-' + this.name).withRelativePartsResolved().asDirectory();
    this.configFile = await resource(projectDir.join('package.json').url);

    await this.gitResource.initializeGitRepository();
    this.saveConfigData();
    const pkg = await loadPackage(system, {
      name: this.name,
      address: this.url,
      configFile: projectDir.join('package.json').url,
      main: projectDir.join('index.js').url,
      test: projectDir.join('tests/test.js').url,
      type: 'package'
    });

    this.package = pkg;
    if (withRemote) {
      await this.regenerateTestPipeline();
      const createForOrg = gitHubUser !== currentUsername();
      await this.gitResource.addRemoteToGitRepository(currentUsertoken(), this.config.name, gitHubUser, this.config.description, createForOrg);
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
    if (!await resource(pipelineFile).exists()) $world.setStatusMessage(StatusMessageError, 'This should never happen.');
    let content = workflowDefinition;
    content = this.fillPipelineTemplate(workflowDefinition);
    await resource(pipelineFile).write(content);
  }

  fillPipelineTemplate (workflowDefinition) {
    let definiton = workflowDefinition.replace('%LIVELY_VERSION%', this.config.lively.boundLivelyVersion);
    return definiton.replaceAll('%PROJECT_NAME%', this.name);
  }

  async save (opts = {}) {
    if (currentUsername() === 'guest') {
      $world.setStatusMessage('Please log in.');
      return false;
    }
    let { message, increaseLevel } = opts;
    message = message.trim();
    message = message + '\nCommited from within lively.next.';

    this.increaseVersion(increaseLevel);
    try {
      await this.saveConfigData();
      if (await this.gitResource.hasRemote()) {
        await this.gitResource.pullRepo();
        await this.gitResource.commitRepo(message);
        await this.gitResource.pushRepo();
        await this.reloadPackage();
      } else await this.gitResource.commitRepor(message);
    } catch (err) {
      return false;
    }
    return true;
  }
}
