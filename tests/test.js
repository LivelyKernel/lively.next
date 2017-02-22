var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
var jwtpath = System.decanonicalize("lively.user/node_modules/jsonwebtoken/index.js").replace(/^file:\/\//, "");
var jwt = System._nodeRequire(jwtpath);
import user from "lively.user/user.js"
import * as authserver from "lively.user/authserver.js"

var salt = bcrypt.genSaltSync(10);

import { expect } from "mocha-es6";
describe("Authentication", () => {
  it("Check if hash can be encoded/decoded", async () => {
    //This should work as long as bcrypt is correctly loading    
    var password = 'password'    
    var hash = bcrypt.hashSync(password,salt)
    expect(bcrypt.compareSync(password,hash)).equals(true)
  });
  it("Check if valid token is generated during correct login", async () =>{
    var tempUser = new user({name: 'Matt', email: "a@b.c", password: 'password'})
    var response = await authserver.verify(tempUser)    
    console.log(tempUser)    
    expect(response.type == 'success').equals(true,'token is invalid: \n' + JSON.stringify(response.reason))
  });
  it("Check if INvalid token is generated during bad login", async () =>{
    var tempUser = new user({name: 'baduser', email: "a@bademail.com", password: 'badpassword'})
    var response = await authserver.verify(tempUser)
    console.log(response)
    expect((response.type == 'failed') && (response.reason == 'JWT malformed')).equals(true,'Token does not correctly refuse authentication')
  });
  it("Check if token correctly checks for timeout", async () =>{
    
  })
});