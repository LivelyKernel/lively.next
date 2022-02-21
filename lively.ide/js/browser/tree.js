import { resource } from 'lively.resources';
import { parse } from 'lively.ast';

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

function transformJSONNode (property) {
  // recuvrsively parse arrays and objects
  
  if (property.type === 'ObjectExpression') {
    property.children = property.properties.map(n => {
      return transformJSONNode(n);
    });
  }
  if (property.value && property.value.type === 'ObjectExpression') {
    property.children = property.value.properties.map(n => {
      return transformJSONNode(n);
    }); 
  }
  if (property.type === 'ArrayExpression') {
    property.children = property.elements.map(n => {
      return transformJSONNode(n);
    });
  } 
  if (property.value && property.value.type === 'ArrayExpression') {
    property.children = property.value.elements.map(n => {
      return transformJSONNode(n);
    });
  }
  // we are at the bottom of a path through the json
  // since we abused acorn, we need to clean up our nodes
  if (!property.key) {
    property.start = property.start - 13;
    property.end = property.end - 13;
    property.name = property.value;
  } else {
    property.start = property.key.start - 13;
    property.end = property.end - 13;
    property.name = property.key.value;
    property.type = property.value.type === 'ObjectExpression' ? 'object-decl' : (property.value.type === 'ArrayExpression' ? 'array-decl' : 'Literal');
  } 
  property.isDeclaration = true;
  property.isCollapsed = true;
  if (!property.name) {
    // covers the case that objects are nested inside of an array,
    // i.e., the object does not have anything that we could use as first level identifier
    property.name = '[ANONYMOUS OBJECT]';
  } 
  return property;  
}

async function listJSONScope (url) {
  const json = await resource(url).read();
  // declaring the json as variable allows us to use acorn to parse it
  const parsedNode = parse('const test = ' + json);
  const entries = parsedNode.body[0].declarations[0].init.properties;
  for (let property of entries) {
    transformJSONNode(property);
  } 
  return entries;
}
