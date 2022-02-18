import { resource } from 'lively.resources';

export const editableFiles = ['md', 'js', 'json', 'css', 'less'];

/* eslint-disable no-unused-vars */
async function listEditableFilesInDir (url) {
  const resources = (await resource(url).dirList())
    .filter(res => res.isDirectory() || editableFiles.includes(res.ext()));
  return resources.map(res => {
    let type;
    if (res.isDirectory()) type = 'directory';
    else type = res.ext();
    return {
      isCollapsed: true,
      name: res.name(),
      size: res.size,
      lastModified: res.lastModified,
      url: res.url,
      type
    };
  });
}

async function listJSONScope (url) {
  const json = await resource(url).readJson();
  return Object.entries(json).map(([key, val]) => {
    return {
      type: 'json-node',
      isDeclaration: true,
      isCollapsed: true,
      name: key,
      value: val
    };
  });
}
/* eslint-enable no-unused-vars */
