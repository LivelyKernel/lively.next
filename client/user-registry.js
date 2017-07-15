/*global System*/
import { User, GuestUser } from "./user.js";
  
export default class UserRegistry {

  static get current() {
    return this._current || (this._current = new this());
  }

  hasUserStored() {
    try {
      return !!localStorage["lively.user"] || !!sessionStorage["lively.user"];
    } catch (err) { return false; }
  }

  async login(user, password) {
    if (!user.isGuestUser) {
      let {error} = await user.login(password);
      if (error) throw Error(error);
    }
    this.saveUserToLocalStorage(user);
    return user;
  }

  async logout(user) {
    try {
      delete localStorage["lively.user"];
      delete sessionStorage["lively.user"];
    } catch (err) {}
    user = user && user.isGuestUser ? user : User.guest;
    if (lively.notifications)
      lively.notifications.emit("lively.user/userchanged", {user}, Date.now(), System);
    return user;
  }

  async register(user, password) {
    if (!user || user.isGuestUser)
      throw new Error("guest users cannot register");
    let {error} = await user.register(password);
    if (error) throw Error(error);
    this.saveUserToLocalStorage(user);
    return user;
  }

  loadUserFromLocalStorage(authServerURL) {
    try {
      let stored = localStorage["lively.user"] || sessionStorage["lively.user"];
      if (stored) {
        stored = JSON.parse(stored);
        return stored.isGuest
          ? GuestUser.named(stored.name, null)
          : User.fromToken(stored.token, authServerURL);
      }
    } catch (err) {
      console.warn(`Could not read user from localStorage: ${err}`);
    }
    return GuestUser.guest;
  }

  saveUserToLocalStorage(user) {
    if (!user || (!user.isGuestUser && !user.token)) return false;

    if (lively.notifications)
      lively.notifications.emit("lively.user/userchanged", {user}, Date.now(), System);

    try {
      if (user.isGuestUser) {
        sessionStorage["lively.user"] = JSON.stringify({isGuest: true, name: user.name});
        delete localStorage["lively.user"];
      } else {
        localStorage["lively.user"] = JSON.stringify({token: user.token});
      }
      return true;
    } catch (err) {
      console.warn(`Could not save user into local/sessionStorage: ${err}`);
      return false;
    }
  }
}
