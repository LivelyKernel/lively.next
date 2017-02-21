import { string, promise } from "lively.lang";
var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
import * as authserver from "lively.user/authserver.js"

export default class user {
  constructor(options) {
  var {name, password, email} = options  
  this.name = name ? name : 'anonymous'
  this.email = email ? email : 'a@b.c'
  this.token = this.authenticate(name,email,password)

  //Freeze to prevent manual changes to the object
  Object.freeze(this)
  }  
  
  authenticate(name,email,pwd){
  // replace with db accessor pulling hash from db
    return authserver.authenticate(name,email,pwd)
  }
}