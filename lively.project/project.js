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

export class Project {
  static async projectDirectory () {
    const baseURL = await Project.system.getConfig().baseURL;
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

    this.saved = false;
    if (bindVersion) VersionChecker.currentLivelyVersion().then(version => this.config.lively.boundLivelyVersion = version);
  }

  static async listAvailableProjects () {
    const baseURL = (await Project.system.getConfig()).baseURL;
    const projectsDir = lively.FreezerRuntime ? resource(baseURL).join('../local_projects').withRelativePartsResolved().asDirectory() : Project.projectDirectory();

    let projectsCandidates = await resource(projectsDir).dirList(2, {
      exclude: dir => {
        return dir.isFile() && !dir.name().endsWith('package.json');
      }
    });
    projectsCandidates = projectsCandidates.filter(dir => dir.name().endsWith('package.json')).map(f => f.parent());
    const packageJSONStrings = await Promise.all(projectsCandidates.map(async projectDir => await resource(projectDir.join('package.json')).read()));
    const packageJSONObjects = packageJSONStrings.map(s => JSON.parse(s));
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
    const cmd = runCommand(`cd ../local_projects/ && git clone https://${userToken}@github.com${remoteUrl.pathname}`, { l2lClient: ShellClientResource.defaultL2lClient });
    await cmd.whenDone(); // TODO: this needs error handling
    // CAUTION: This makes it so that repo name = project name for now!
    const projectName = remoteUrl.pathname.match(/\/.+\/(.*)/)[1];
    const loadedProject = await Project.loadProject(projectName);
    return loadedProject;
  }

  static async loadProject (name) {
    // Create Project object and do not bind to the current version.
    // It acts merely as a container until we fill in the correct contents below.
    const loadedProject = new Project(name, false);

    let address, url;
    address = (await Project.projectDirectory()).join('name');
    url = address.url;

    loadedProject.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('local_projects').join(name).withRelativePartsResolved().asDirectory();

    // await this.gitResource.pullRepo();
    // load package into lively
    const pkg = await loadPackage(Project.system, {
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

  static get system () {
    return localInterface.coreInterface;
  }

  async bindAgainstCurrentLivelyVersion () {
    const currentCommit = await VersionChecker.currentLivelyVersion();
    const { comparison, hash } = await VersionChecker.checkVersionRelation(currentCommit);
    const comparisonBetweenVersions = VersionChecker.parseHashComparison(comparison);
    switch (comparisonBetweenVersions) {
      case (0): $world.setStatusMessage('Already using the latest version. All good! ✅'); break;
      case (1): {
        const confirmed = await $world.confirm('This changes the required version of lively.next for this project.\n Are you sure you want to proceed?');
        if (!confirmed) $world.setStatusMessage('Changing the required version of lively.next has been canceled.');
        else {
          $world.setStatusMessage(`Updated the required version of lively.next for ${this.config.name}.`, StatusMessageConfirm);
          this.config.lively.boundLivelyVersion = currentCommit;
          await this.saveConfigData();
          await this.regenerateTestPipeline();
        }

        break;
      }
      case (-1):
      case (2) :
        $world.setStatusMessage(`You do not have the version of lively.next necessary to open this project. Please get version ${hash} of lively.next`);
    }
  }

  async create (withRemote = false, gitHubUser) {
    this.gitResource = null;
    const system = Project.system;
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
    return this;
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
      return;
    }
    let { message, increaseLevel } = opts;
    message = message + '\n Commited from within lively.next.';

    this.increaseVersion(increaseLevel);
    await this.saveConfigData();
    await this.gitResource.commitRepo(message);
    await this.gitResource.pullRepo();
    await this.gitResource.pushRepo();
  }
}
