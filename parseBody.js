const MAX_BODY_BYTES = 1024 * 1024;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    req.on('data', (chunk) => {
      if (settled) return;
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        fail(Object.assign(new Error('Request body too large'), { statusCode: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });

    req.once('error', fail);
    req.once('aborted', () => fail(new Error('Request was aborted')));
    req.once('end', () => {
      if (settled) return;
      try {
        const rawBody = Buffer.concat(chunks).toString('utf8');
        resolve(JSON.parse(rawBody));
      } catch (error) {
        fail(Object.assign(new Error('Invalid JSON body'), { statusCode: 400 }));
      }
    });
  });
}

module.exports = parseBody;
