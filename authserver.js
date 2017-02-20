// import * as bcrypt from "lively.user/node_modules/bcryptjs";
// import * as jwt from "lively.user/node_modules/jsonwebtoken"
var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
var jwt = System._nodeRequire(jwtpath);


var key = "mysecret"
var users = [
  {
    name: 'Matt',
    hash:  '$2a$10$p4zdkYKOegab0ZKtvlUVeO6sxDSRVS8C5FwRsFC/6Kpc5KZxwYmCu'
  }
]



export function authenticate(username,email,password){
  var user = users.filter(function(ea){
    return ea.name == username
  })[0]
  
  if(!user){
    return {status: 'error', body: {data: 'No such username'}}
  }
  // console.log(user)
  var hash = user.hash
  console.log(password)
  if (bcrypt.compareSync(password,hash)){
    return tokenize(username,email,Date.now())
  }
}

//Export temporarily while testing function. Export to be removed.
export function tokenize(username,email,date){
  var token = jwt.sign({ username: username, email: email, date: date}, key);
  return token
  // return 'abc123'
}
