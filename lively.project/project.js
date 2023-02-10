import { localInterface } from 'lively-system-interface';
import { resource } from 'lively.resources';

import { defaultDirectory } from 'lively.ide/shell/shell-interface.js';
import { loadPackage } from 'lively-system-interface/commands/packages.js';
import { workflowDefinition } from './templates/test-action.js';
import { lookupPackage } from 'lively.modules/index.js';

export class Project {
  // TODO: bind lively version
  // this.currentLivelyVersion
  constructor (name, repoURL) {
    this.name = name || 'new world';
    this.repoURL = repoURL;
    if (!this.repoURL) this.repoURL = 'https://github.com/LivelyKernel/lively.next-Project-Testing';
    this.saved = false;
  }

  get system () {
    return localInterface.coreInterface;
  }

  async create () {
    this.gitResource = null;
    const system = this.system;
    let res, guessedAddress;
    try {
      res = resource(this.name);
      guessedAddress = res.url;
    } catch (e) {
      let baseURL = (await system.getConfig()).baseURL;
      let maybePackageDir = resource(baseURL).join('projects').join(this.name).asDirectory().url;
      guessedAddress = (await system.normalize(maybePackageDir)).replace(/\/\.js$/, '/');
    }

    let url = resource(guessedAddress).asDirectory();
    let address = url.asFile().url;

    await system.removePackage(address);

    await system.resourceCreateFiles(address, {
      'index.js': "'format esm';\n",
      'package.json': `{\n  "name": "${this.name}",\n  "version": "0.1.0"\n}`,
      '.gitignore': 'node_modules/',
      'README.md': `# ${this.name}\n\nNo description for package ${this.name} yet.\n`,
      '.github': {
        workflows: {
          'ci-tests.yml': workflowDefinition
        }
      },
      tests: {
        'test.js': `import { expect } from "mocha-es6";\ndescribe("${this.name}", () => {\n  it("works", () => {\n    expect(1 + 2).equals(3);\n  });\n});`
      },
      ui: {
        'components.cp.js': ''
      },
      workspaces: {
        'default.workspace.js': ''
      },
      assets: { },
      'index.css': '',
      'comments.json': '{}'
    });
    this.gitResource = await resource('git/' + await defaultDirectory()).join('..').join('projects').join(this.name).withRelativePartsResolved().asDirectory();

    await this.gitResource.initializeGitRepository($world.currentUsertoken, 'lively.next-Project-Testing', 'LivelyKernel');

    await loadPackage(system, {
      name: this.name,
      address: address,
      configFile: url.join('package.json').url,
      main: url.join('index.js').url,
      test: url.join('tests/test.js').url,
      type: 'package'
    });

    this.package = lookupPackage(url.url).pkg;
    await this.gitResource.addRemoteToGitRepository($world.currentUsertoken, 'lively.next-Project-Testing', 'LivelyKernel');
  }

  async save () {
    if ($world.currentUsername === 'guest') {
      $world.setStatusMessage('Please log in.');
      return;
    }
    await $world.openedProject.gitResource.commitRepo();
    await $world.openedProject.gitResource.pushGitRepo();
  }
}
