/* global FileReader */
import { Image } from '../morph.js';

export function uploadItem () {}

export async function uploadFile (file, type, options) {
  // file is an instance of the Browser File class
  //   https://developer.mozilla.org/en-US/docs/Web/API/File

  if (type.startsWith('image/')) {
    // upload as inlined image
    const imageUrl = await fileReadAsDataURL(file);

    return new Image({
      imageUrl,
      autoResize: true,
      name: file.name
    });
  }

  return null;
}

// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers
function fileReadAsDataURL (file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}
