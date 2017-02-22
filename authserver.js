var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
var jwt = System._nodeRequire(jwtpath);
var sqlite3Path = System.decanonicalize("lively.user/node_modules/sqlite3/lib/sqlite3.js").replace(/^file:\/\//, "");
var sqlite3 = System._nodeRequire(sqlite3Path).verbose();

//replace with uuid, visible only to server
var key = "mysecret"

//Database for user information
async function getfromDB(username,email){
  var dbPath = System.decanonicalize("lively.user/userdb.db").replace(/^file:\/\//, "");
  var db = new sqlite3.Database(dbPath);
  try {
    var results = await new Promise((resolve, reject) => {  
      db.serialize(function() { 
        db.all("SELECT * FROM users where username='" + username + "' and email='" + email + "'", function(err, rows) {
          if (err) reject(err)
          else resolve(rows);
        });
      });
    })  
  } finally {  
    db.close();
  }  
  return results;
}

//temporary substitute for a database
// var users = [
//   {
//     name: 'Matt',
//     hash:  '$2a$10$p4zdkYKOegab0ZKtvlUVeO6sxDSRVS8C5FwRsFC/6Kpc5KZxwYmCu'
//   },
//   {
//     name: 'some_anon',
//     hash:  '$2a$10$p4zdkYKOegab0ZKtvlUVeO6sxDSRVS8C5FwRsFC/6Kpc5KZxwYmCu'
//   }
// ]

export async function authenticate(username,email,password){
  var users = await getfromDB(username,email)
  //check 0-th record, as both username and email are PKs  
  var user = users[0]
  
  if(!user){
    return {status: 'error', body: {data: 'No such username'}}
  }
  var hash = user.hash  
  if (bcrypt.compareSync(password,hash)){
    return tokenize(username,email,Date.now())
  } else {
    return {error: "User Not Authenticated"}
  }
}

//Export temporarily while testing function. Export to be removed.
export function tokenize(username,email,date){
  var token = jwt.sign({ username: username, email: email, date: date}, key,{ expiresIn: 60 * 60 });
  return token
}

export async function verify(user){
  var response;
  await jwt.verify(user.token,key,(err,decode)=>{
    if(err){
      if (err.name == 'TokenExpiredError'){
        response = {
          type: 'failed',
          reason: 'JWT Expired'
        }
      }
      if (err.name == 'JsonWebTokenError'){
        response = {
          type: 'failed',
          reason: 'JWT malformed'
        }
      }
      
    } else {
      response = {
        type: 'success',
        reason: 'jwt valid'
      }      
    }    
  })  
  return response;
}
