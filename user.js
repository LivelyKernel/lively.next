import { string, promise } from "lively.lang";
import * as bcrypt from "node_modules/bcryptjs";

export class user {
  constructor(options) {
  var {name, password} = options  
  this.name = name ? name : 'anonymous'
  this.authenticated = this.authenticate(name,password)

  //Freeze to prevent manual changes to the object
  Object.freeze(this)
  }
  
  toString(){
    return "Module for user authentication"
  } 
  
  authenticate(name,pwd){
  // replace with db accessor pulling hash from db
  // currently resolves always to true
    var userHash = this.storepwd(pwd)
    //Next two lines are simply to force authentication to return true
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(pwd, salt);    
    return this.pwcheck(pwd,hash)
  }

  pwcheck(pwd,hash){   
    // Compare hash to entered pwd
    return bcrypt.compareSync(pwd,hash)
  }
  storepwd(pwd){
    var salt = bcrypt.genSaltSync(10);
    var hash = bcrypt.hashSync(pwd, salt);    
    //Add db accessor to store hash here
  }
}


