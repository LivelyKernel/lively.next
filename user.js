import { string, promise } from "lively.lang";

import * as authserver from "lively.user/authserver.js"

export default class user {
  constructor({name, username, password, email, avatar} ) {  
    this.name = name || username || 'anonymous';
    this.email = email
    this.avatar = avatar;
    this.password = password;
  }

  isReady() {
      return ((this.token) && (typeof this.token == 'string' || this.token.status == 'error'));
    }  
    
  async authenticate(timeout = 300){  
   // replace with db accessor pulling hash from db
   (async () => this.token = await authserver.authenticate(this))();
   await new Promise(r => setTimeout(r, timeout));
   return this.isReady();
  }
}


