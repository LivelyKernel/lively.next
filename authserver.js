import * as userdb from "lively.user/user-db.js"

var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
var jwt = System._nodeRequire(jwtpath);

//replace with uuid, visible only to server
var key = "mysecret"

// var adminpassword = 'adminpassword'

export async function authenticate(username,email,password){
  
  var users = await userdb.getfromDB(username,email)
  //check 0-th record, as both username and email are PKs  
  var user = users[0]  
  if(!user){
    return {status: 'error', body: {data: 'No such username'}}
  }
  var hash = user.hash
  if (bcrypt.compareSync(password,hash)){
    var result = await tokenize(username,email,Date.now())    
    return result
  } else {
    return {error: "User Not Authenticated"}
  }
}

export async function removeUser(username,email,adminpassword){  
  var users = await userdb.getfromDB('admin','admin@lively-next.org')
  
  //check 0-th record, as both username and email are PKs  
  var admin = users[0]  
  if(!admin){
    return {status: 'error', body: {data: 'No admin'}}
  }
  var adminhash = admin.hash
  if (!bcrypt.compareSync(adminpassword,adminhash)){
    return {status: 'error', body: {data: 'Unable to add user, admin not authenticated'}}
  }

  return await userdb.remove({username,email})
  
}

export async function addUser(username,email,password,adminpassword){  
  var users = await userdb.getfromDB('admin','admin@lively-next.org')
  
  //check 0-th record, as both username and email are PKs  
  var admin = users[0]  
  if(!admin){
    return {status: 'error', body: {data: 'No admin'}}
  }
  var adminhash = admin.hash
  if (!bcrypt.compareSync(adminpassword,adminhash)){
    return {status: 'error', body: {data: 'Unable to add user, admin not authenticated'}}
  }
  var salt = bcrypt.genSaltSync(10);
  var hash = bcrypt.hashSync(password, salt);
  return await userdb.push({username,email,hash})
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
