/**
 * Public Zoho Mail outgoing-webhook forwarder for gobizit.ai.
 *
 * Zoho Mail's first-save handshake POSTs to the Webhook URL with no
 * Authorization header and refuses to save unless that request returns
 * HTTP 200. This endpoint always answers Zoho with 200, then forwards
 * the payload to the Cursor automation webhook with a Bearer token.
 *
 * Env vars (set in the Vercel project; never commit values):
 *   ZOHO_MAIL_WEBHOOK_DEST   — full https destination URL
 *   ZOHO_MAIL_WEBHOOK_BEARER — raw token only, no "Bearer " prefix
 */

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function readRawBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (Buffer.isBuffer(req.body)) {
      return Promise.resolve(req.body);
    }
    if (typeof req.body === 'string') {
      return Promise.resolve(Buffer.from(req.body));
    }
    if (typeof req.body === 'object') {
      return Promise.resolve(Buffer.from(JSON.stringify(req.body)));
    }
  }

  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => {
      chunks.push(chunk);
    });
    req.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    req.on('error', reject);
  });
}

function destinationFromEnv(env) {
  const dest = String(env.ZOHO_MAIL_WEBHOOK_DEST || '').trim();
  const bearer = String(env.ZOHO_MAIL_WEBHOOK_BEARER || '')
    .trim()
    .replace(/^Bearer\s+/i, '');

  if (!dest || !bearer) {
    return null;
  }

  try {
    const url = new URL(dest);
    if (url.protocol !== 'https:') {
      return null;
    }
  } catch {
    return null;
  }

  return { dest, bearer };
}

async function forward(dest, bearer, method, body) {
  await fetch(dest, {
    method,
    headers: {
      Authorization: `Bearer ${bearer}`,
      'Content-Type': 'application/json',
    },
    body,
    redirect: 'manual',
    signal: AbortSignal.timeout(8000),
  });
}

async function handler(req, res) {
  const method = String(req.method || 'GET').toUpperCase();

  if (method === 'GET') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    sendJson(res, 405, { ok: false, error: 'method_not_allowed' });
    return;
  }

  const config = destinationFromEnv(process.env);
  if (!config) {
    sendJson(res, 200, { ok: true, forwarded: false });
    return;
  }

  let body = Buffer.alloc(0);
  try {
    body = await readRawBody(req);
  } catch {
    sendJson(res, 200, { ok: true });
    return;
  }

  // Answer Zoho first so the handshake stays fast, then forward.
  sendJson(res, 200, { ok: true, forwarded: true });

  try {
    await forward(config.dest, config.bearer, method, body);
  } catch {
    // Fail closed: do not log dest, bearer, body, or the fetch error.
  }
}

module.exports = handler;
