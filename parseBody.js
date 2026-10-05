function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = new Set();
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      chunks.add(chunk);
    });

    req.once('error', fail);
    req.once('aborted', () => fail(new Error('Request was aborted')));
    req.once('end', () => {
      if (settled) return;
      try {
        const rawBody = Buffer.concat([...chunks]).toString('utf8');
        resolve(JSON.parse(rawBody));
      } catch (error) {
        fail(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
  });
}

module.exports = parseBody;
