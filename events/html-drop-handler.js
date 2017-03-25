import { Image } from "lively.morphic";
export function uploadItem() {
  
}

export async function uploadFile(file, type, options) {
  // file is an instance of the Browser File class
  //   https://developer.mozilla.org/en-US/docs/Web/API/File

  if (type.startsWith("image/")) {
    // upload as inlined image    
    return new Image({imageUrl: await fileReadAsDataURL(file), name: file.name});
  }

  return null;
}


// -=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
// helpers
function fileReadAsDataURL(file) {
  return new Promise((resolve, reject) => {
    let reader = new FileReader();
    reader.onload = e => resolve(e.target.result);
    reader.readAsDataURL(file);
  });
}