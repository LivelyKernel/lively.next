/*global describe,System,beforeEach,afterEach,it,before,after,xdescribe*/
import { expect } from "mocha-es6";
import { join } from "path";
import { resource } from "lively.resources";
import UserDB from "../user-db.js";
import User from "../user.js";
import { start } from "../server.js";
import http from "http";

function req(path = "/", method = "GET", body, headers = {}) {
  return new Promise((resolve, reject) => {
    let req = http.request({hostname, port, method, path, headers}, res => {
      let {statusCode, headers} = res, data = "";
      res.on('data', d => data += String(d));
      res.on('end', () => {
        if (headers["content-type"] === "application/json")
          try { data = JSON.parse(data); } catch (err) { console.error(err); }
        resolve({data, statusCode, headers})
      });
    })
    req.on('error', reject);
    if (body) {
      if (typeof body !== "string") body = JSON.stringify(body);
      req.write(body);
    }
    req.end();
  });
}

function jwtTokenDecode(token) {
  let [a,b,c] = token.split(".")
  return {header: JSON.parse(atob(a)), body: JSON.parse(atob(b))}
}

let testDBUrl = resource(System.baseURL).join("lively-user-test-db.idb").url,
    userDB, server, hostname = "0.0.0.0", port = 9099;

describe("auth server", function () {

  this.timeout(20000);

  before(async () => server = await start({hostname, port, userdb: testDBUrl, debug: true}));
  after(() => server.close());

  beforeEach(() => {
    userDB = UserDB.ensureDB(testDBUrl, {});
  });

  afterEach(async () => {
    await userDB.destroy();
  });

  it("lists users", async () => {
    var {data, statusCode} = await req("/list-users");
    expect(data).equals([], "1");
    expect(statusCode).equals(200, "1");
    let user1 = new User({name: "test-user-1"}),
        user2 = new User({name: "test-user-2"});
    await user1.storeIntoDB(userDB);
    await user2.storeIntoDB(userDB);
    var {data, statusCode} = await req("/list-users");
    expect(data).containSubset([{name: "test-user-1"}, {name: "test-user-2"}], "2");
    expect(statusCode).equals(200, "1");
  });

  describe("login", () => {

    beforeEach(async () => {
      let user = new User({name: "test-user-1", password: "foo"})
      await user.storeIntoDB(userDB);
    });

    it("with non-existing users", async () => {
      var {data, statusCode} = await req("/login", "POST", {name: "foo", password: "bar"});
      expect(statusCode).equals(400, "1");
      expect(data).deep.equals({error: `/login failed`});
    });

    it("with wrong password", async () => {
      var {data} = await req("/login", "POST", {name: "test-user-1", password: "bar"});
      expect(data).deep.equals({error: `/login failed`});
    });

    it("with correct user and password", async () => {
      var {data} = await req("/login", "POST", {name: "test-user-1", password: "foo"});
      expect(data).containSubset({status: `login successful`});
      expect(jwtTokenDecode(data.token)).containSubset({body: {name: "test-user-1", roles: {}}});
    });

  });

  describe("register", () => {

    beforeEach(async () => {
      let user = new User({name: "test-user-1", password: "foo"})
      await user.storeIntoDB(userDB);
    });

    it("existing user", async () => {
      var {data, statusCode} = await req("/register", "POST", {name: "test-user-1", password: "foo"});
      expect(statusCode).equals(400, "1");
      expect(data).containSubset({
        error: "/register failed, A user with the name \"test-user-1\" is already registered!"
      });
    });

    it("non-existing user", async () => {
      var {data, statusCode} = await req("/register", "POST", {name: "new user", password: "bar"});
      expect(statusCode).equals(200, "1");
      console.log(data)
      expect(data).containSubset({status: `User "new user" registered successful`});
      expect(jwtTokenDecode(data.token)).containSubset({body: {name: "new user", roles: {}}});
    });

  });
  
  describe("change user", () => {

    beforeEach(async () => {
      let user = new User({name: "test-user-1", password: "foo"})
      await user.storeIntoDB(userDB);
    });

    it("change email", async () => {
      var {data, statusCode} = await req("/change", "POST",
        {name: "test-user-1", password: "foo", changes: {email: "foo@bar.com"}});
      expect(statusCode).equals(200, "1");
      expect(data).containSubset({
        status: `Changing user data for "test-user-1":\n email changed to "foo@bar.com"`
      });
    });

  });

  describe("verify", () => {

    beforeEach(async () => {
      let user = new User({name: "test-user-1", password: "foo"})
      await user.storeIntoDB(userDB);
    });

    it("verify correct token", async () => {
      var {data} = await req("/login", "POST", {name: "test-user-1", password: "foo"});
      var {data} = await req("/verify", "POST", {token: data.token});
      expect(data).containSubset({status: `OK`});
    });

  });

});