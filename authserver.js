import * as bcrypt from "lively.user/node_modules/bcryptjs";
// import * as jsonwebtoken from "lively.user/node_modules/jsonwebtoken"
    
var users = [
  {
    name: 'Matt',
    hash:  '$2a$10$p4zdkYKOegab0ZKtvlUVeO6sxDSRVS8C5FwRsFC/6Kpc5KZxwYmCu'
  }
]

export function authenticate(username,password){
  var user = users.filter(function(ea){
    return ea.name == username
  })[0]
  
  if(!user){
    return {status: 'error', body: {data: 'No such username'}}
  }
  console.log(user)
  var hash = user.hash
  if (bcrypt.compareSync(password,hash)){
    return tokenize(username,email,Date.now())
  }
}

function tokenize(username,email,date){
  return 'abc123'
}
