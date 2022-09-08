/*global describe,System,beforeEach,afterEach,it,before,after,xdescribe*/
import { expect } from "mocha-es6";
import ServerUser from "../server/user.js";
import { User as ClientUser } from "../client/user.js";
import { start } from "../server/server.js";
import UserDB from "../server/user-db.js";
import { verify } from "../server/jwt.js";

let testDBUrl = System.baseURL + "lively-user-test-db.idb",
    userDB, server, hostname = "0.0.0.0", port = 9099, url = `http://${hostname}:${port}`;

describe("client user", function () {

  this.timeout(20000);

  before(async () => server = await start({hostname, port, userdb: testDBUrl, debug: true}));
  after(async () => await server.close());

  beforeEach(() => {
    userDB = UserDB.ensureDB(testDBUrl, {});
  });

  afterEach(async () => {
    await userDB.destroy();
    ClientUser.clearCache();
  });

  describe("register", () => {
    
    it("new user", async () => {
      let user = ClientUser.named("test user", url);
      expect(user.isLoggedIn()).equals(false);
      let answer = await user.register("pwd")
      expect(answer).deep.equals({status: "User \"test user\" registered successful"});
      expect(user.isLoggedIn()).equals(true);
      expect(verify(user.token)).containSubset({name: "test user"});
      let serverUser = await userDB.getUserNamed(user.name);
      expect(serverUser).to.exist;
    });

    it("existing user", async () => {
      let serverUser = await userDB.createUser({name: "test user", password: "foo"});
      let user = ClientUser.named("test user", url);
      let answer = await user.register("foo")
      expect(answer).deep.equals({error: "A user with the name \"test user\" is already registered!"});
      expect(user.isLoggedIn()).equals(false);
      expect(user.token).equals(null);
    });
  })

  describe("login", () => {
    
    it("exisiting user", async () => {
      let serverUser = await userDB.createUser({name: "test user 2", password: "foo"}),
          user = ClientUser.named("test user 2", url),
          answer = await user.login("foo");
      expect(answer).deep.equals({status: "login successful"});
      expect(user.isLoggedIn()).equals(true);
      expect(verify(user.token)).containSubset({name: "test user 2"});
    });
    
    it("non exisiting user", async () => {
      let user = ClientUser.named("test user 2", url),
          answer = await user.login("foo");
      expect(answer).deep.equals({error: "No user \"test user 2\""});
      expect(user.isLoggedIn()).equals(false);
      expect(user.token).equals(null);
    });
  });

});
