import jwt from "jsonwebtoken";

// verify: function (jwtString, secretOrPublicKey, options, callback) {
const JWT_SECRET = "FOOOOOO"; // FIXME

export var decode = jwt.decode;
export function sign(payload) { return jwt.sign(payload, JWT_SECRET); }
export function verify(jwtString) { return jwt.verify(jwtString, JWT_SECRET); }
