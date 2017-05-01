import { resource } from "lively.resources";

export const lvInfoFileName = ".lv-npm-helper-info.json";

export async function readPackageSpec(packageDir, optPackageJSON) {
  let hasBindingGyp = await packageDir.join("binding.gyp").exists(),
      config = optPackageJSON || await packageDir.join("package.json").readJson(),
      scripts, bin;

  if (config.bin) {
    bin = typeof config.bin === "string" ? {[config.name]: config.bin} : {...config.bin};
  }

  if (config.scripts || hasBindingGyp) {
    scripts = {...config.scripts};
    if (hasBindingGyp && !scripts.install)
      scripts.install = "node-gyp rebuild";
  }

  let info = {};
  try { info = await packageDir.join(lvInfoFileName).readJson(); } catch (err) {}

  return {
    ...info,
    location: packageDir.url,
    hasBindingGyp,
    scripts,
    bin,
    config
  }
}


export function gitSpecFromVersion(version = "") {
  let gitMatch = version.match(/([^:]+):\/\/.*/),
      githubMatch = version.match(/([^\/]+)\/([^#]+).*/),
      gitRepoUrl = gitMatch ? version : githubMatch ? "https://github.com/" + version : null,
      [_, branch] = (gitRepoUrl && gitRepoUrl.match(/#([^#]*)$/) || []);
  if (gitRepoUrl && !branch) {
     branch = "master";
     gitRepoUrl += "#master";
  }
  return gitRepoUrl
    ? {branch, gitURL: gitRepoUrl, inFileName: gitRepoUrl.replace(/[:\/\+#]/g, "_")}
    : null;
}

export function pathForNameAndVersion(nameAndVersion, destinationDir) {
  // pathForNameAndVersion("foo-bar@1.2.3", "file:///x/y")
  // pathForNameAndVersion("foo-bar@foo/bar", "file:///x/y")
  // pathForNameAndVersion("foo-bar@git+https://github.com/foo/bar#master", "file:///x/y")

  let [name, version] = nameAndVersion.split("@"),
      gitSpec = gitSpecFromVersion(version);

  // "git clone -b my-branch git@github.com:user/myproject.git"
  if (gitSpec) {
    let location = resource(destinationDir).join(`${name}@${gitSpec.inFileName}`).url;
    return {...gitSpec, location, name, version: gitSpec.gitURL}
  }
  
  return {location: resource(destinationDir).join(nameAndVersion).url, name, version}
}
