export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  if (typeof body !== 'string' && !(body instanceof Uint8Array)) {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    body = JSON.stringify(body);
  }
  res.end(body);
}
export function query(req) {
  return new URL(req.url, 'http://localhost').searchParams;
}
export async function fetchWithTimeout(url, ms, opts = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), ms);
  try {
    return await fetch(url, { ...opts, signal: ctl.signal, headers: { 'user-agent': 'gods-eye-console/1.0', ...(opts.headers || {}) } });
  } finally { clearTimeout(t); }
}
