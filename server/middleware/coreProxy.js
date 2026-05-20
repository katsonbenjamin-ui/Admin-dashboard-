const https = require('https');
const http  = require('http');
const url   = require('url');

async function callCore(method, endpoint, body) {
  const coreUrl = process.env.CORE_URL;
  if (!coreUrl) return { ok: false, status: 503, data: { error: 'CORE_URL not set' } };

  const apiKey  = process.env.CORE_API_KEY || '';
  const fullUrl = coreUrl.replace(/\/$/, '') + endpoint;
  const parsed  = url.parse(fullUrl);
  const isHttps = parsed.protocol === 'https:';
  const lib     = isHttps ? https : http;
  const bodyStr = body ? JSON.stringify(body) : undefined;

  return new Promise((resolve) => {
    const options = {
      hostname: parsed.hostname,
      port:     parsed.port || (isHttps ? 443 : 80),
      path:     parsed.path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    apiKey,
        'Content-Length': bodyStr ? Buffer.byteLength(bodyStr) : 0,
      },
    };
    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ ok: res.statusCode < 400, status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ ok: false, status: res.statusCode, data: { error: 'Bad response' } }); }
      });
    });
    req.on('error', err => resolve({ ok: false, status: 502, data: { error: 'Core unreachable: ' + err.message } }));
    req.setTimeout(12000, () => { req.destroy(); resolve({ ok: false, status: 504, data: { error: 'Core timeout' } }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

module.exports = { callCore };
