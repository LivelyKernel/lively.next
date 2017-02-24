var sqlite3Path = System.decanonicalize("lively.user/node_modules/sqlite3/lib/sqlite3.js").replace(/^file:\/\//, "");
var sqlite3 = System._nodeRequire(sqlite3Path).verbose();
var dbPath = System.decanonicalize("lively.user/userdb.db").replace(/^file:\/\//, "");

export async function remove(user){
  var adminhash = '123'
  if (adminhash){
  //here we will validate that this is an approved action by comparing hash to admin hash
  //for now, it's just always true'
  var approved = true;
  }
  if (!approved){
    console.log('Error: Unaauthorized attempt to remove user')
    return
  }

}
export async function push(user,adminhash){
  var adminhash = '123'
  if (adminhash){
  //here we will validate that this is an approved action by comparing hash to admin hash
  //for now, it's just always true'
  var approved = true;
  }
  if (!approved){
    console.log('Error: Unaauthorized attempt to add user')
    return
  }
  var {username, email, hash} = user  
  
  var db = new sqlite3.Database(dbPath);
  try {
    var response = await new Promise((resolve, reject) => {        
        var stmnt = "INSERT INTO users(username, email, hash) VALUES ('" + username + "','" + email + "','" + hash + "');"
        db.run(stmnt, (err) => {
          if (err) {            
              reject(err)
          }
          else resolve('User: ' + username + ' added to ' + dbPath)
        });
    }).catch(err => {      
      return (err)
    })
  } finally {  
    db.close();    
  }
  console.log(response)
}


export async function getfromDB(username,email){
  
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
