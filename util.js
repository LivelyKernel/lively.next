export async function readBody(req, forceJson = false) {
  if (req._body) return req._body;
  return new Promise((resolve, reject) => {
    var data = '';
    req.on('data', d => data += d.toString());
    req.on('end', () => {
      try {
        if (forceJson || req.headers["content-type"] === "application/json")
          data = JSON.parse(data);
      } catch (err) { if (forceJson) throw err; }
      resolve(req._body = data);
    });
    req.on('error', err => reject(err));
  });
}
