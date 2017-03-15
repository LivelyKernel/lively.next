import L2LClient from "lively.2lively/client.js";

export async function getUser(options){
  var opts = {
    name: 'anonymous',
    email: null,
    password: null,
    ...options
  }
  var defaultClient = L2LClient.default()
  var defaultUser = (await defaultClient.sendToAndWait(defaultClient.trackerId,'newUser',opts)).data
  return defaultUser
}