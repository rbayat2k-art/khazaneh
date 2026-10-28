import http from 'node:http';
import crypto from 'node:crypto';
import { sha } from './common.mjs';

const loginPage = (error = false) => '<!doctype html><html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>محیط آزمایشی خصوصی شاهراه</title></head><body><main style="max-width:460px;margin:10vh auto;font-family:Tahoma;padding:24px"><h1>محیط آزمایشی خصوصی شاهراه</h1><p>این صفحه Production نیست. فقط اطلاعات مصنوعی وارد کنید؛ بانک و پیامک غیرفعال‌اند.</p>' + (error ? '<p role="alert">رمز دروازه نادرست است. دوباره تلاش کنید؛ رمز همین محیط را از فایل خصوصی ACCESS.txt بردارید.</p>' : '') + '<form method="post" action="/__staging/login"><label for="gate-password">رمز دروازهٔ آزمایشی</label><input style="display:block;margin:16px 0;padding:10px;width:90%" id="gate-password" type="password" name="password" autocomplete="current-password" required><button style="padding:10px 24px" type="submit">ورود به محیط آزمایشی</button></form><p>رمزها در فایل خصوصی ACCESS.txt این محیط هستند.</p></main></body></html>';

export function makeGateway(config, stop, isReady = () => false) {
  const origin = `http://127.0.0.1:${config.port}`, cookieName=`shahrah_staging_${config.port}`, sessions = new Map(), failures = new Map();
  const csp = "default-src 'self'; connect-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'";
  const equals = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const left = Buffer.from(a), right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('X-Shahrah-Environment', 'synthetic-staging'); res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Content-Security-Policy', csp); res.setHeader('X-Content-Type-Options', 'nosniff');
    const end = (code, body = '') => { if (body && !res.hasHeader('Content-Type')) res.setHeader('Content-Type', 'text/plain; charset=utf-8'); res.statusCode = code; res.end(body); };
    if (req.headers.host !== `127.0.0.1:${config.port}` || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress)) return end(403);
    if ((req.headers.origin && req.headers.origin !== origin) || req.headers['sec-fetch-site'] === 'cross-site') return end(403);
    if (req.url === '/__staging/control/stop' && req.method === 'POST') {
      if (!equals(req.headers['x-staging-control'], config.controlNonce)) return end(403);
      end(202); setImmediate(stop); return;
    }
    if (req.url === '/__staging/login' && req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return end(200, loginPage());
    }
    if (req.url === '/__staging/login' && req.method === 'POST') {
      const address = req.socket.remoteAddress, now = Date.now();
      for (const [id, expires] of sessions) if (expires <= now) sessions.delete(id);
      let limit = failures.get(address); if (!limit || limit.until < now) { limit = { count: 0, until: now + 60000 }; failures.set(address, limit); }
      if (limit.count >= 8) return end(429);
      let body = ''; try { for await (const chunk of req) { body += chunk; if (body.length > 2048) return end(413); } } catch { return end(400); }
      if (!equals(sha(new URLSearchParams(body).get('password') || ''), config.gateHash)) { limit.count++; res.setHeader('Content-Type', 'text/html; charset=utf-8'); return end(401, loginPage(true)); }
      if (sessions.size >= 100) return end(429);
      failures.delete(address); const id = crypto.randomBytes(32).toString('hex'); sessions.set(id, now + 8 * 3600000);
      res.setHeader('Set-Cookie', `${cookieName}=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`);
      res.setHeader('Location', '/'); return end(303);
    }
    const id = new RegExp(`(?:^|;\\s*)${cookieName}=([a-f0-9]{64})(?:;|$)`).exec(req.headers.cookie || '')?.[1];
    if (!id || (sessions.get(id) || 0) <= Date.now()) {
      if (req.method === 'GET' && (req.url === '/' || req.headers.accept?.includes('text/html'))) { res.setHeader('Location', '/__staging/login'); return end(303); }
      return end(401);
    }
    if (!isReady()) return end(503, 'Staging not ready');
    if (!req.url.startsWith('/') || req.url.startsWith('//')) return end(400);
    const headers = { ...req.headers, host: `127.0.0.1:${config.backendPort}`, connection: 'close' };
    delete headers.cookie; delete headers['x-staging-control']; delete headers['forwarded'];
    for (const key of Object.keys(headers)) if (key.startsWith('x-forwarded-')) delete headers[key];
    const upstream = http.request({ hostname: '127.0.0.1', port: config.backendPort, path: req.url, method: req.method, headers }, response => {
      res.statusCode = response.statusCode;
      for (const [key, value] of Object.entries(response.headers)) if (value !== undefined && !['content-security-policy', 'cache-control', 'set-cookie', 'connection'].includes(key)) res.setHeader(key, value);
      response.pipe(res);
    });
    upstream.setTimeout(30000, () => upstream.destroy());
    upstream.on('error', () => { if (!res.headersSent) end(503, 'Staging unavailable'); else res.destroy(); });
    req.on('aborted', () => upstream.destroy()); req.pipe(upstream);
  });
  server.headersTimeout = 10000; server.requestTimeout = 30000;
  server.on('upgrade', (_req, socket) => socket.destroy()); server.on('connect', (_req, socket) => socket.destroy());
  return server;
}
