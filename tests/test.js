/* global describe, before, after, it, System */
var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
var jwt = System._nodeRequire(jwtpath);
import user from "lively.user/user.js"
import * as authserver from "lively.user/authserver.js"

var salt = bcrypt.genSaltSync(10), malleableUser;

import { expect } from "mocha-es6";
describe("Authentication", () => {

  before(async () => {
     await authserver.addUser({name: "testUser1", email: "testuser1@lively-next.org", password: "test"},'adminpassword')
     await authserver.addUser({name: "testUser2", email: "testuser2@lively-next.org", password: "test"},'adminpassword')
     malleableUser = new user({name: 'testUser2', email: "testuser2@lively-next.org", password: 'test'})
     await malleableUser.authenticate(300);
     var response = await authserver.verify(malleableUser)
  })

  after(async () =>{
    await authserver.removeUser({name: "testUser1", email: "testuser1@lively-next.org"}, 'adminpassword')
    await authserver.removeUser({name: "testUser2", email: "testuser2@lively-next.org"}, 'adminpassword')
  })

  it("Check if hash can be encoded/decoded", async () => {
    //This should work as long as bcrypt is correctly loading    
    var password = 'password'    
    var hash = bcrypt.hashSync(password,salt)
    expect(bcrypt.compareSync(password,hash)).equals(true)
  });
  
  it("Check if valid token is generated during correct login", async () => {
    var tempUser = new user({name: 'testUser1', email: "testuser1@lively-next.org", password: 'test'})
    await tempUser.authenticate(300);
    var response = await authserver.verify(tempUser)    
    expect(response.type == 'success').equals(true,'token is invalid: \n' + JSON.stringify(response.reason))
  });
  
  it("Check if INvalid token is generated during bad login", async () => {
    var tempUser = new user({name: 'testUser2', email: "testUser2@lively-next.org", password: 'badpassword'})
    await tempUser.authenticate(300);    
    var response = await authserver.verify(tempUser).catch(err => {      
      return (err)
    })    
    expect((response.type == 'failed') && (response.reason == 'JWT malformed')).equals(true,'Token does not correctly refuse authentication')
  });
  
  it("Check if token correctly checks for timeout", async () =>{
      // console.log(malleableUser)
      var {username, email} = malleableUser,
      date = Date.now(),
      key = 'mysecret'
      var decode = jwt.verify(malleableUser.token, key)
      var cert = (Math.floor(decode.date/1000)<decode.exp)      
      expect(cert).equals(true)
      var expiredToken = await jwt.sign({ username: username, email: email, date: date}, key,{ expiresIn: 0 });
      malleableUser.token = expiredToken
      var status = await new Promise((resolve,reject)=>{
        jwt.verify(malleableUser.token, key,(err, decoded) =>{
          if (err) reject(err)
          resolve(decoded)
        })
      }).catch((err)=>{expect(err.name).equals('TokenExpiredError')})
  })
});