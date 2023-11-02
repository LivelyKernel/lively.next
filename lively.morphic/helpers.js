/* global System */
import { locateClass } from 'lively.serializer2';
import { string, obj } from 'lively.lang';
import { parseQuery } from 'lively.resources';
import { stringifyQuery } from 'lively.resources/src/helpers.js';

let touchInput;

try {
  document.createEvent('TouchEvent');
  touchInput = true;
} catch (e) {
  touchInput = false;
}

export const touchInputDevice = touchInput;

let CachedDefaultValues;
CachedDefaultValues = CachedDefaultValues || new Map();
let CachedStyleProperties;
CachedStyleProperties = CachedStyleProperties || new Map();
let CachedFoldableProperties;
CachedFoldableProperties = CachedFoldableProperties || new Map();
let nameToClassMapping;
nameToClassMapping = nameToClassMapping || {}; // eslint-disable-line no-use-before-define

export function getClassForName (name) {
  return nameToClassMapping[name] || Object;
}

export function sanitizeFont (font) {
  return font && font.split(',').map(subFont => {
    // first clear whitespace before and after
    subFont = subFont.split(' ').filter(m => m !== '').join(' ');
    if (subFont.includes(' ')) {
      if (subFont.startsWith("'")) subFont = subFont.slice(1);
      if (subFont.endsWith("'")) subFont = subFont.slice(0, -1);
      if (!subFont.startsWith('"')) subFont = '"' + subFont;
      if (!subFont.endsWith('"')) subFont = subFont + '"';
    }
    return subFont;
  }).join(',');
}

export function pathForBrowserHistory (worldName, queryString, project = false, projectOwner) {
  // how does the resource map to a URL shown in the browser URL bar? used for
  // browser history
  if (!queryString) { queryString = typeof document !== 'undefined' ? document.location.search : ''; }
  queryString = queryString.trim();
  let query;
  if (!queryString || queryString === '?') query = {};
  else query = parseQuery(queryString);

  const basePath = project ? '/projects/load' : '/worlds/load';
  // ensure the name param in the query string matches worldName
  if (worldName.endsWith('.json')) {
    query.file = worldName;
    delete query.name;
  } else {
    delete query.file;
    query.name = worldName;
    if (project && projectOwner) query.owner = projectOwner;
  }

  if (lively.isResurrectionBuild) query.fastLoad = true;

  return `${basePath}?${stringifyQuery(query)}`;
}

export function addClassMappings (mapping) {
  Object.assign(nameToClassMapping, mapping);
}

// fixme: how do we invalidate this cache if style properties for a class change?
// possible solution: store the modules for each of the classes we cache the style props for and clear the cache when a change in the module is sent around from lively.notifications

export function clearStylePropertiesForClassesIn (moduleId) {
  CachedStyleProperties.forEach((props, klass) => {
    if (moduleId.endsWith(props.moduleId)) CachedStyleProperties.delete(klass); // clear from cache
  });
}

function getPropSettings (type) {
  const klass = (!type || obj.isString(type)) ? getClassForName(type || 'default') : type;
  const { package: pkg, pathInPackage } = klass[Symbol.for('lively-module-meta')];
  const { properties: props, order } = klass[Symbol.for('lively.classes-properties-and-settings')];
  return { order, props, moduleId: string.joinPath(pkg.name || '', pathInPackage) };
}

export function getStylePropertiesFor (type) {
  if (typeof type === 'undefined') type = 'default';
  if (CachedStyleProperties.has(type)) return CachedStyleProperties.get(type);
  const { props, moduleId, order } = getPropSettings(type);
  const styleProps = [];
  styleProps.moduleId = moduleId;
  for (let prop of order) {
    if (props[prop].isStyleProp) styleProps.push(prop);
    if (props[prop].foldable) {
      styleProps.push(...props[prop].foldable.map(sub => prop + string.capitalize(sub)));
    }
    if (props[prop].group === 'geometry' && props[prop].derived) styleProps.push(prop);
  }
  CachedStyleProperties.set(type, styleProps);
  return styleProps;
}

export function getDefaultValueFor (type, propName) {
  if (CachedDefaultValues.has(type)) return CachedDefaultValues.get(type)[propName];
  const { props } = getPropSettings(type);
  const defaultValues = {};
  for (let prop in props) {
    if (props[prop].isStyleProp && 'defaultValue' in props[prop]) {
      defaultValues[prop] = props[prop].defaultValue;
    }
  }
  CachedDefaultValues.set(type, defaultValues);
  return defaultValues[propName];
}

export function isFoldableProp (type, propName) {
  if (CachedFoldableProperties.has(type)) return CachedFoldableProperties.get(type)[propName];
  const { props } = getPropSettings(type);
  const foldableProps = {};
  for (let prop in props) {
    if ('foldable' in props[prop]) {
      foldableProps[prop] = props[prop].foldable;
    }
  }
  CachedFoldableProperties.set(type, foldableProps);
  return foldableProps[propName];
}

export function morph (props = {}, opts = { restore: false }) {
  let klass = nameToClassMapping.default;
  if (props.type) {
    if (typeof props.type === 'function') klass = props.type;
    if (typeof props.type === 'object') klass = locateClass(props.type);
    else if (typeof props.type === 'string') { klass = nameToClassMapping[props.type.toLowerCase()] || klass; }
  }

  if (morph.evaluateAsSpec) return { ...props, __isSpec__: true };

  return opts.restore
    ? new klass({ [Symbol.for('lively-instance-restorer')]: true }).initFromJSON(props)
    : new klass(props);
}

export function newMorphId (classOrClassName) {
  const prefix = typeof classOrClassName === 'function'
    ? classOrClassName[Symbol.for('__LivelyClassName__')]
    : typeof classOrClassName === 'string'
      ? classOrClassName.toLowerCase()
      : '';
  return prefix + '_' + string.newUUID().replace(/-/g, '_');
}

async function lazyInspect (obj) {
  // lazy load
  const { openInWindow: realInspect } = await System.import('lively.ide/js/inspector/ui.cp.js');
  inspect = realInspect; // eslint-disable-line no-use-before-define
  return realInspect({ targetObject: obj });
}

export let inspect = lazyInspect;
