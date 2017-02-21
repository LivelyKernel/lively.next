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
    var tempUser = new user({name: 'Matt', password: 'password'})
    var verifiedToken = jwt.verify(tempUser.token,'mysecret')
    
    // Drop milliseconds because iat is only valid to the second
    var now = parseInt(Date.now()/1000)
    // Check if token is valid in timeframe
    var seconds = 30
    expect(now-verifiedToken.iat).lessThan(30,'token is more than ' + seconds + ' seconds old')
  });
});