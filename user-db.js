export function push(obj){
  return('push')
}

export async function userList(){
  var userList = 'empty';  
  return userList
}

export function pop(obj){
  return('pop')
}

function getJSON(url, callback) {
  let xhr = new XMLHttpRequest();
  xhr.onload = function () { 
    callback(this.responseText) 
  };
  xhr.open('GET', url, true);
  xhr.send();
}