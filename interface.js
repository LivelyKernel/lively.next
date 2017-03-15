import L2LClient from "lively.2lively/client.js";

var defaultClient = L2LClient.default()

export async function getUser(options){
  var opts = {
    name: 'anonymous',
    email: null,
    password: null,
    ...options
  }
  
  var defaultUser = (await defaultClient.sendToAndWait(defaultClient.trackerId,'newUser',opts)).data
  return defaultUser
}

export async function createUser(options,ackFn){
  var {name,email,password} = options
  if(!name || !email || !password) {
    var errMsg = 'Insufficient options specified: Requires name, email, password'
    throw new Error(errMsg)
  }
  
  await defaultClient.sendToAndWait(defaultClient.trackerId,'createUser',options,ackFn)
  
}