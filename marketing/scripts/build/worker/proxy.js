'use strict';

const SOCIAL_API_BASE = 'https://legacy.lotusia.org';

function withForwardedHostHeaders(headers) {
  const next = new Headers();
  for (const [key, value] of headers.entries()) {
    if (key.toLowerCase() === 'host') continue;
    next.set(key, value);
  }
  next.set('x-forwarded-host', 'lotusia.org');
  next.set('x-forwarded-proto', 'https');
  next.set('x-forwarded-port', '443');
  return next;
}

async function proxy(request, targetBase) {
  const incomingUrl = new URL(request.url);
  const upstreamUrl = new URL(`${targetBase}${incomingUrl.pathname}${incomingUrl.search}`);
  const method = request.method || 'GET';
  const headers = withForwardedHostHeaders(request.headers);
  const upstreamRequest = new Request(upstreamUrl.toString(), {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : request.body,
    redirect: 'manual'
  });
  return fetch(upstreamRequest);
}

function withCors(response) {
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', '*');
  headers.set('access-control-allow-methods', 'GET, HEAD, OPTIONS');
  headers.set('access-control-allow-headers', 'Content-Type, Authorization');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function num(value) {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

async function fetchSocialJson(pathname, query) {
  return fetchLegacyJson(pathname, query);
}

async function fetchLegacyJson(pathname, query) {
  const u = new URL(pathname, SOCIAL_API_BASE);
  if (query) {
    for (const [k, v] of Object.entries(query)) u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), { redirect: 'manual' });
  if (!res.ok) throw new Error('Legacy API ' + pathname + ' failed with ' + res.status);
  return res.json();
}

function normalizePeerIp(addr) {
  const text = String(addr || '').trim();
  if (!text) return '';
  if (text.startsWith('[')) {
    const end = text.indexOf(']');
    return end > 1 ? text.slice(1, end) : '';
  }
  const colonCount = (text.match(/:/g) || []).length;
  if (colonCount > 1) {
    return text;
  }
  if (colonCount === 1) {
    return text.split(':')[0];
  }
  return text;
}

async function lookupGeoIp(ip) {
  const safeIp = normalizePeerIp(ip);
  if (!safeIp) return { countryCode: '', countryName: '' };
  const cache = caches.default;
  const cacheKey = new Request('https://lotusia.org/_geoip/' + encodeURIComponent(safeIp), { method: 'GET' });
  const cached = await cache.match(cacheKey);
  if (cached) {
    try {
      return await cached.json();
    } catch (_) {}
  }
  try {
    const res = await fetch('https://ipwho.is/' + encodeURIComponent(safeIp) + '?fields=success,country,country_code', {
      cf: { cacheEverything: true, cacheTtl: 86400 }
    });
    if (!res.ok) throw new Error('geoip ' + res.status);
    const payload = await res.json();
    const out = {
      countryCode: payload && payload.success && payload.country_code ? String(payload.country_code).toUpperCase() : '',
      countryName: payload && payload.success && payload.country ? String(payload.country) : ''
    };
    const response = new Response(JSON.stringify(out), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=86400, s-maxage=86400, stale-while-revalidate=86400'
      }
    });
    await cache.put(cacheKey, response.clone());
    return out;
  } catch (_) {
    return { countryCode: '', countryName: '' };
  }
}

function countryFlagEmoji(countryCode) {
  const code = String(countryCode || '').toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return '';
  return String.fromCodePoint(127397 + code.charCodeAt(0), 127397 + code.charCodeAt(1));
}