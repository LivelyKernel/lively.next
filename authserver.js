/* global System */
import { Database } from "lively.storage";
import user from 'lively.user/user.js';

var dbPath = System.decanonicalize("lively.user/user.db").replace(/^file:\/\//, ""),
    userdb = Database.ensureDB(dbPath);

if (System._nodeRequire) {
  var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
  var bcrypt = System._nodeRequire(bcryptPath);
  var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
  var jwt = System._nodeRequire(jwtpath);
}
//replace with uuid, visible only to server
var key = "mysecret"
// var adminpassword = 'adminpassword'

export async function authenticate(user){
  var authUser = await userdb.get(user.email)
  if(!authUser){
    return {status: 'error', body: {data: 'No such username ' + user.name}}
  }

  if (bcrypt.compareSync(user.password,authUser.hash)){
    var result = await tokenize(user.name, user.email,Date.now())    
    return result
  } else {
    return {error: "User Not Authenticated"}
  }
}

export async function getUserInfo(email){
  var user = await userdb.get(email);
  if(!user){
    return {status: 'error', body: {data: 'No user for email ' + email }}
  }
  return user;
}

export async function getAllUsers(){
  
  var users = await userdb.getAll(),
      userDict = {};
   for (var user of users) {
     userDict[user.email] = user;
   }
  return userDict;
}

export async function removeUser({name: username,email},adminpassword){  
  var admin = await userdb.get('admin@lively-next.org'); 
  if(!admin){
    return {status: 'error', body: {data: 'No admin'}}
  }
  var adminhash = admin.hash
  if (!bcrypt.compareSync(adminpassword,adminhash)){
    return {status: 'error', body: {data: 'Unable to add user, admin not authenticated'}}
  }

  return await userdb.remove(email)
  
}

export async function addUser({name: username,email,password,avatar},adminpassword){  
  var admin = await userdb.get('admin@lively-next.org')
  if(!admin){
    return {status: 'error', body: {data: 'No admin'}}
  }
  var adminhash = admin.hash
  if (!bcrypt.compareSync(adminpassword,adminhash)){
    return {status: 'error', body: {data: 'Unable to add user, admin not authenticated'}}
  }
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  return await userdb.set(email, {username,email,hash,avatar});
}

//Export temporarily while testing function. Export to be removed.
export async function tokenize(username,email,date){  
  var token = await jwt.sign({ username: username, email: email, date: date}, key,{ expiresIn: 60 * 60 });  
  return token
}

export async function verify(user){
  var response = await new Promise((resolve,reject)=>{
      jwt.verify(user.token,key,(err,decode)=>{        
        if (err){
          console.log(err)
          if (err.name == 'TokenExpiredError'){
            reject ({
              type: 'failed',
              reason: 'JWT Expired'
            })
          } else if (err.name == 'JsonWebTokenError'){          
            reject( {
              type: 'failed',
              reason: 'JWT malformed'
            })
          
          } else {
            reject({
              type: 'failed',
              reason: 'other',
              detail: err
            })
          }
          
        }        
        resolve({
          type: 'success',
          reason: 'jwt valid'      
        })
      })
  });
  return response 
}

export const UserServices = {
  
  async validate(tracker, {sender, data}, ackFn, socket){   
    var response = await verify(data)    
    ackFn(response);  
  },

  async userInfo(tracker, {sender, data}, ackFn, socket) {
    // returns the unauthenticated user object, if available
    ackFn(new user(await getUserInfo(data.email)));
  },

  async listUsers(tracker, {sender, data}, ackFn, socket) {
    ackFn(await getAllUsers());
  },

  async authenticateUser(tracker, {sender, data}, ackFn, socket){    
    var newUser = new user(data);
    await newUser.authenticate(300);
    ackFn(newUser);
  },

  async createUser(tracker, {sender, data}, ackFn, socket){
     if (!data.name || !data.email || !data.password){
       var errMsg = 'Insufficient options specified: Requires name, email, password'
       throw new Error(errMsg)
     }
     await addUser(data,'adminpassword')
     ackFn({name: data.name, status: 'created ' + data.name  + 'successfully'})
  }
} 