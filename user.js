import { string, promise } from "lively.lang";
import * as bcrypt from "lively.user/node_modules/bcryptjs";
import * as authserver from "lively.user/authserver.js"


export default class user {
  constructor(options) {
  var {name, password} = options  
  this.name = name ? name : 'anonymous'
  this.token = this.authenticate(name,password)

  //Freeze to prevent manual changes to the object
  Object.freeze(this)
  }
  
  toString(){
    return "Module for user authentication"
  } 
  
  authenticate(name,pwd){
  // replace with db accessor pulling hash from db
  // currently resolves always to true
    return authserver.authenticate(name,pwd)
  }

  
  
}


