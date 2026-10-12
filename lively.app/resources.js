import { registerExtension, unregisterExtension } from 'lively.resources';
import { registerObjectDBResource } from 'lively.storage/objectdb-resource.js';

export async function registerDesktopResources () {
  if (!globalThis.livelyNative) return;
  const extension = await livelyNative.fileExtension();
  unregisterExtension(extension.name);
  // Keep the native implementation first when live editing re-registers defaults.
  registerExtension({ ...extension, name: 'lively.desktop.file' });
  registerObjectDBResource(livelyNative.request);
}
