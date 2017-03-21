var sqlite3Path = System.decanonicalize("lively.user/node_modules/sqlite3/lib/sqlite3.js").replace(/^file:\/\//, "");
var sqlite3 = System._nodeRequire(sqlite3Path).verbose();
var dbPath = System.decanonicalize("lively.user/userdb.db").replace(/^file:\/\//, "");

export async function doSQL(queryString){
  var db = new sqlite3.Database(dbPath);
  try {
    var response = await new Promise((resolve, reject) => {        
        var stmnt = queryString        
        db.all(stmnt, (err,resp) => {          
          if (err) {            
              reject(err)
          }
          else resolve(resp)
        });
    }).catch(err => {      
      return (err)
    })
  } finally {  
    db.close();    
  }
  console.log(response)
  return response
}

export async function remove(user){
  var {username, email} = user  
  
  var db = new sqlite3.Database(dbPath);
  try {
    var response = await new Promise((resolve, reject) => {        
        var stmnt = "DELETE FROM users WHERE username='" + username + "' and email='" + email + "'"        
        db.run(stmnt, (err) => {
          if (err) {            
              reject(err)
          }
          else resolve('User: ' + username + ' removed from ' + dbPath)
        });
    }).catch(err => {      
      return (err)
    })
  } finally {  
    db.close();    
  }
  console.log(response)
  return response
}
export async function push(user){  
  var {username, email, hash, avatar} = user  
  
  var db = new sqlite3.Database(dbPath);
  try {
    var response = await new Promise((resolve, reject) => {        
        var stmnt = "INSERT INTO users(username, email, hash, avatar) VALUES ('" + username + "','" + email + "','" + hash + "','" + JSON.stringify(avatar) + "');"
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

export async function getByEmail(email){
  
  var db = new sqlite3.Database(dbPath);
  try {
    var results = await new Promise((resolve, reject) => {  
      db.serialize(function() { 
        db.all("SELECT * FROM users where email='" + email + "'", function(err, rows) {
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
