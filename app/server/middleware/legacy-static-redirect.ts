import { defineEventHandler, getHeader, getRequestURL, sendRedirect } from 'h3'

function isMatch(pathname: string, base: string) {
  return pathname === base || pathname.startsWith(`${base}/`)
}

export default defineEventHandler((event) => {
  const hostHeader = getHeader(event, 'x-forwarded-host') || getHeader(event, 'host') || ''
  const host = hostHeader.split(':')[0].toLowerCase()
  if (host !== 'legacy.lotusia.org') return

  const url = getRequestURL(event)
  const pathname = url.pathname || '/'

  // Legacy profile links should route through the new apex host,
  // which then applies the social host split rules.
  if (pathname === '/social/twitter' || pathname.startsWith('/social/twitter/')) {
    return sendRedirect(event, `https://lotusia.org${pathname}${url.search || ''}`, 301)
  }

  const redirectBases = [
    '/',
    '/ecosystem',
    '/tools',
    '/roadmap',
    '/faq',
    '/founders',
    '/beta-services',
    '/blog',
    '/docs',
    '/fr',
    '/es',
    '/it',
    '/de',
    '/ru',
    '/cn'
  ]

  const isStaticPath = pathname === '/robots.txt'
    || pathname === '/sitemap.xml'
    || redirectBases.some(base => isMatch(pathname, base))

  if (!isStaticPath) return

  const destination = `https://lotusia.org${pathname}${url.search || ''}`
  return sendRedirect(event, destination, 301)
})
