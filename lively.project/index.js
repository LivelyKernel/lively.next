import { registerExtension } from 'lively.resources';
import { gitResourceExtension } from 'lively.shell/git-client-resource.js';
'format esm';

registerExtension(gitResourceExtension);

export * from './project.js';
export * from './helpers.js';
