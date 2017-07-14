import UserDB from "./user-db.js";
import { verify } from "./jwt.js";

let routes = [

  {
    path: "/list-users",
    handle: async (server, req, res, next, success, fail) => {
      let userDB = UserDB.ensureDB(server.options.userdb, {}),
          users = await userDB.getAllUsers();
      success(users.map(ea => ea.dataForClient()));
    }
  },

  {
    path: "/login",
    methods: ["POST"],
    handle: async (server, req, res, next, success, fail) => {
      let data;
      try { data = await body(req, true); } catch (err) { return fail("json error"); }

      if (typeof data.name !== "string" && typeof data.password !== "string")
        return fail("invalid request", true);

      let userDB = UserDB.ensureDB(server.options.userdb, {}),
          user = await userDB.getUserNamed(data.name);
      if (!user) return fail(`no user "${data.name}"`, true);
      if (!user.checkPassword(data.password))
        return fail(`password for "${data.name}" does not match`, true);

      success({status: "login successful", token: user.token});
    }
  },

  {
    path: "/register",
    methods: ["POST"],
    handle: async (server, req, res, next, success, fail) => {
      let data;
      try { data = await body(req, true); } catch (err) { return fail("json error", true); }

      if (typeof data.name !== "string" && typeof data.password !== "string")
        return fail("invalid request, expected name and password fields", true);

      let userDB = UserDB.ensureDB(server.options.userdb, {}),
          user = await userDB.getUserNamed(data.name)
      if (user) return fail(`A user with the name "${data.name}" is already registered!`, true);

      user = await userDB.createUser(data);
      success({status: `User "${user.name}" registered successful`, token: user.token});
    }
  },

  {
    path: "/verify",
    methods: ["POST"],
    handle: async (server, req, res, next, success, fail) => {
      let data;
      try { data = await body(req, true); } catch (err) { return fail("json error"); }
      if (typeof data.token !== "string")
        return fail("invalid request");

      try {
        let decoded = await verify(data.token),
            answer = {status: "OK"};
        if (data.decode) answer.decoded = decoded;
        return success(answer);
      } catch (err) {
        switch (err.name) {
          case 'TokenExpiredError': return fail('token expired', true);
          case 'JsonWebTokenError': return fail('token malformed', true);
          default: return fail(String(err), true);
        }
      }
    }
  },

  {
    path: "/check-password",
    methods: ["POST"],
    handle: async (server, req, res, next, success, fail) => {
      let data;
      try { data = await body(req, true); } catch (err) { return fail("json error"); }

      let {password, token} = data;
      if (typeof token !== "string" || typeof password !== "string")
        return fail("invalid request, need token and password", true);

      let name;
      try { name = await verify(token).name; } catch (err) {
        switch (err.name) {
          case 'TokenExpiredError': return fail('token expired', true);
          case 'JsonWebTokenError': return fail('token malformed', true);
          default: return fail(String(err), true);
        }
      }

      let userDB = UserDB.ensureDB(server.options.userdb, {}),
          user = await userDB.getUserNamed(name);
      if (!user) return fail(`no user ${name}`, true);
      success({status: user.checkPassword(password)});
    }
  },

  {
    path: "/modify",
    methods: ["POST"],
    handle: async (server, req, res, next, success, fail) => {
      let data;
      try { data = await body(req, true); } catch (err) { return fail("json error"); }
      if (typeof data.token !== "string")
        return fail("invalid request, no token", true);
      if (typeof data.changes !== "object")
        return fail("invalid request, no changes", true);

      let decoded;
      try { decoded = await verify(data.token); }
      catch (err) { return fail(`Token does not verify: `, String(err), true); }

      let userDB = UserDB.ensureDB(server.options.userdb, {}),
          user = await userDB.getUserNamed(decoded.name);
      if (!user) return fail(`no user ${data.name}`);

      try { user.modify(data.changes); }
      catch (err) { return fail(`User change failure: `, err.message, true); }

      success({status: "modification successful", token: user.token});
    }
  }

]

function matches(req, route) {
  let {path, methods, handle} = route, match;

  if (typeof path === "string") {
    if (req.url !== path) return false;

  } else if (path instanceof RegExp) {
    match = path.match(req.url);
    if (!match) return false;

  } else if (typeof path === "function") {
    match = path(req.url);
    if (!match) return false;
  }

  if (methods && methods !== "*") {
    if (!methods.includes(req.method.toUpperCase())) return false;
  }

  return match || true;
}

function body(req, isJSON) {
  return new Promise((resolve, reject) => {
    if (req.body) return resolve(req.body);
    let body = "";
    req.on("data", d => body += String(d));
    req.on("end", () => {
      if (isJSON) {
        try { body = JSON.parse(body); } catch (err) { reject(err); }
        resolve(body);
      }
    });
    req.on("error", reject);
  });
}

function fail(req, res, path, reason, sendReason = false) {
  console.log(`${path} failed: ${reason}`);
  res.writeHead(400, {"content-type": "application/json"});
  res.end(JSON.stringify({error: sendReason ? reason : `${path} failed`}));
}

function success(req, res, path, data) {
  res.writeHead(200, {"content-type": "application/json"});
  res.end(JSON.stringify(data));
}

export async function handleRequest(server, req, res, next) {
  // this is for letsencrypt...
  if (req.url.startsWith("/.well-known"))    {
    try {
      let file = lively.resources.resource(lively.modules.getPackage("lively.user").url).join(req.url),
          content = await file.read();
      res.writeHead(200, {"content-type": "text/plain"});
      res.end(content);
    } catch(err) {
      res.writeHead(404, {});
      res.end(String(err));
    }
  }


  let route = routes.find(r => matches(req, r));

  if (!route) return next();
  let s = (data) => success(req, res, req.url, data);
  let f = (reason, sendReason) => fail(req, res, req.url, reason, sendReason);
  await route.handle(server, req, res, next, s, f);
}
