import { string, promise } from "lively.lang";

import * as authserver from "lively.user/authserver.js"

export default class user {
  constructor(options) {  
  var {name, password, email}  = {
      name: 'anonymous',
      email: null,
      password: null,
      ...options
    }
  this.name = name
  this.email = email
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


