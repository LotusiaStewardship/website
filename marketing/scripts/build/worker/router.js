export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname || '/';
    const appStaticFiles = new Set([
      '/manifest.webmanifest',
      '/favicon.ico',
      '/apple-touch-icon.png',
      '/icon-192.png',
      '/icon-512.png'
    ]);

    if (path === '/explorer' || path === '/explorer/') {
      return new Response(await renderExplorerOverviewPage(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
    }
    const avatarPath = parseAvatarPath(path);
    if (avatarPath) {
      return cachedAvatarResponse(url, avatarPath.platform, avatarPath.profileId);
    }
    if (path === '/social') {
      return Response.redirect('https://lotusia.org/social/activity' + (url.search || ''), 301);
    }

    try {
      if (path === '/explorer/blocks') {
        return new Response(await renderExplorerBlocksPage(url), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      const blockPath = parseExplorerBlockPath(path);
      if (blockPath) {
        return new Response(await renderExplorerBlockDetailPage(url, blockPath), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      const txPath = parseExplorerTxPath(path);
      if (txPath) {
        return new Response(await renderExplorerTxDetailPage(url, txPath), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      const addressPath = parseExplorerAddressPath(path);
      if (addressPath) {
        return new Response(await renderExplorerAddressDetailPage(url, addressPath), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (path === '/social/activity') {
        return new Response(await renderActivityPage(url), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (path === '/social/trending') {
        return new Response(await renderTrendingPage(), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (path === '/social/profiles') {
        return new Response(await renderProfilesPage(url), { status: 200, headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
      }
      const profileRoute = parseProfilePath(path);
      if (profileRoute) {
        return new Response(await renderProfilePage(url, profileRoute.platform, profileRoute.profileId), {
          status: 200,
          headers: {
            'content-type': 'text/html; charset=utf-8',
            'cache-control': 'no-store'
          }
        });
      }
    } catch (err) {
      if (path.startsWith('/explorer/')) {
        return new Response(explorerErrorPage(path, err && err.message ? err.message : 'Unknown error'), {
          status: 502,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
        });
      }
      if (path.startsWith('/social/')) {
        return new Response(errorPage(path, err && err.message ? err.message : 'Unknown error'), {
          status: 502,
          headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
        });
      }
    }

    // App social routes render HTML that references root-level Nuxt assets.
    // These must be fetched from app host or the browser receives marketing HTML.
    if (path.startsWith('/_nuxt/') || appStaticFiles.has(path)) {
      const res = await proxy(request, 'https://app.lotusia.org');
      return withCors(res);
    }

    // Nuxt runtime internals (payload/content/navigation) must come from app host.
    if (path.startsWith('/api/_')) {
      return proxy(request, 'https://app.lotusia.org');
    }

    if (path.startsWith('/api/')) {
      return proxy(request, 'https://legacy.lotusia.org');
    }

    return env.ASSETS.fetch(request);
  }
};

