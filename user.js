import { string, promise } from "lively.lang";
var bcryptPath = System.decanonicalize("lively.user/node_modules/bcryptjs/index.js").replace(/^file:\/\//, "");
var bcrypt = System._nodeRequire(bcryptPath);
import * as authserver from "lively.user/authserver.js"

export default class user {
  constructor(options) {
  var {name, password, email} = options  
  this.name = name ? name : 'anonymous'
  this.email = email ? email : null
  this.authenticate(name,email,password)
  }  

  isReady() {
      return ((this.token) && (typeof this.token == 'string' || this.token.status == 'error'));
    }

  authenticated(timeout) {
    return promise.waitFor(timeout, () => this.isReady())
            .catch(err =>            
              Promise.reject(/timeout/i.test(String(err)) ?
                new Error(`Timeout in ${this}.authenticated`) : err))
  }
  
  async authenticate(name,email,pwd){  
  // replace with db accessor pulling hash from db
    var result = await authserver.authenticate(name,email,pwd)    
    this.token = await result
  }
}