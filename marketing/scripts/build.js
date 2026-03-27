'use strict';
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

const ROOT      = path.resolve(__dirname, '..');
const DIST      = path.join(ROOT, 'dist');
const TEMPLATES = path.join(ROOT, 'templates');
const CONTENT   = path.join(ROOT, 'content');
const ASSETS    = path.join(ROOT, 'assets');
const I18N_DIR  = path.join(ROOT, 'i18n');
const IMAGES_DIR = path.join(ASSETS, 'images');
const SOCIAL_DIR = path.join(CONTENT, 'social');

const SITE_URL = process.env.SITE_URL || 'https://lotusia.org';
const LANGS    = ['en', 'fr', 'es', 'it', 'de', 'ru', 'cn'];

// ── Localised routes: only these pages are duplicated per language ──────────
const LOCALIZED_ROUTES = new Set(['/', '/ecosystem', '/tools', '/roadmap', '/faq', '/founders', '/beta-services']);

// ── Load every template once ────────────────────────────────────────────────
const headerTmpl = fs.readFileSync(path.join(TEMPLATES, 'partials/header.html'), 'utf8');
const footerTmpl = fs.readFileSync(path.join(TEMPLATES, 'partials/footer.html'), 'utf8');

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, `${name}.html`), 'utf8');
}
function readYaml(file) {
  return yaml.load(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
}
function loadI18n(lang) {
  return JSON.parse(fs.readFileSync(path.join(I18N_DIR, `${lang}.json`), 'utf8'));
}

const I18N = Object.fromEntries(LANGS.map(l => [l, loadI18n(l)]));

// ── Token replacement ────────────────────────────────────────────────────────
function fill(tmpl, vars) {
  let out = tmpl;
  for (const [k, v] of Object.entries(vars))
    out = out.split(`{{${k}}}`).join(String(v ?? ''));
  return out;
}

function renderPage(templateName, vars) {
  const pageTmpl = readTemplate(templateName);
  const header   = fill(headerTmpl, vars);
  const footer   = fill(footerTmpl, vars);
  return fill(pageTmpl, { ...vars, header, footer });
}

// ── Output ───────────────────────────────────────────────────────────────────
function writeOutFromPath(pagePath, html) {
  const rel = pagePath === '/' ? '' : pagePath.replace(/^\/+|\/+$/g, '');
  const dir = path.join(DIST, rel);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  ${pagePath}`);
}

// ── URL helpers ──────────────────────────────────────────────────────────────
function abs(p)       { return `${SITE_URL}${p}`; }
function langPath(lang, basePath) {
  if (lang === 'en') return basePath;
  return basePath === '/' ? `/${lang}` : `/${lang}${basePath}`;
}
function navRoute(lang, route) {
  if (lang === 'en' || !LOCALIZED_ROUTES.has(route)) return route;
  return langPath(lang, route);
}
function localHref(lang, href) {
  if (!href || /^(https?:|mailto:|#)/.test(href)) return href;
  return navRoute(lang, href);
}

function formatDateYMD(date) {
  return date instanceof Date && !Number.isNaN(date.getTime())
    ? date.toISOString().slice(0, 10)
    : '';
}

function fileLastmod(filePath) {
  try {
    return formatDateYMD(fs.statSync(filePath).mtime);
  } catch {
    return '';
  }
}

function maxLastmod(a, b) {
  if (!a) return b || '';
  if (!b) return a || '';
  return a > b ? a : b;
}

function setSitemapEntry(sitemap, canonicalPath, alternates, lastmod = '') {
  const current = sitemap.get(canonicalPath);
  if (!current) {
    sitemap.set(canonicalPath, { alternates, lastmod: lastmod || '' });
    return;
  }
  const mergedAlternates = { ...current.alternates, ...alternates };
  sitemap.set(canonicalPath, {
    alternates: mergedAlternates,
    lastmod: maxLastmod(current.lastmod, lastmod)
  });
}

function localizedAlternates(basePath) {
  return Object.fromEntries(LANGS.map(c => [c, langPath(c, basePath)]));
}

const imageMetaCache = new Map();
function getAssetImageFilePath(src) {
  if (!src || typeof src !== 'string') return '';
  if (!src.startsWith('/assets/images/')) return '';
  const rel = decodeURIComponent(src.replace('/assets/images/', ''));
  return path.join(IMAGES_DIR, rel);
}

function readImageSize(filePath) {
  if (!filePath) return null;
  if (imageMetaCache.has(filePath)) return imageMetaCache.get(filePath);
  let out = null;
  try {
    const buf = fs.readFileSync(filePath);
    if (buf.length > 24 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      out = { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
    } else if (buf.length > 4 && buf[0] === 0xff && buf[1] === 0xd8) {
      let i = 2;
      while (i < buf.length - 9) {
        if (buf[i] !== 0xff) { i += 1; continue; }
        const marker = buf[i + 1];
        if (marker === 0xd9 || marker === 0xda) break;
        const len = buf.readUInt16BE(i + 2);
        if ((marker >= 0xc0 && marker <= 0xc3) || (marker >= 0xc5 && marker <= 0xc7) || (marker >= 0xc9 && marker <= 0xcb) || (marker >= 0xcd && marker <= 0xcf)) {
          out = { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
          break;
        }
        i += 2 + len;
      }
    } else if (buf.length > 10 && (String.fromCharCode(...buf.slice(0, 6)) === 'GIF87a' || String.fromCharCode(...buf.slice(0, 6)) === 'GIF89a')) {
      out = { width: buf.readUInt16LE(6), height: buf.readUInt16LE(8) };
    } else if (buf.length > 30 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
      const type = buf.toString('ascii', 12, 16);
      if (type === 'VP8X') {
        out = {
          width: 1 + buf.readUIntLE(24, 3),
          height: 1 + buf.readUIntLE(27, 3)
        };
      }
    }
  } catch {
    out = null;
  }
  imageMetaCache.set(filePath, out);
  return out;
}

function inferAltFromSrc(src, fallback = 'Editorial image') {
  if (!src || typeof src !== 'string') return fallback;
  const base = path.basename(src).replace(path.extname(src), '').replace(/[-_]+/g, ' ').trim();
  return base ? `${base} image` : fallback;
}

function escapeAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function imgTag(src, alt, className = '', extraAttrs = '') {
  const filePath = getAssetImageFilePath(src);
  const dims = readImageSize(filePath);
  const sizeAttrs = dims?.width && dims?.height ? ` width="${dims.width}" height="${dims.height}"` : '';
  const cls = className ? ` class="${className}"` : '';
  const attrs = extraAttrs ? ` ${extraAttrs.trim()}` : '';
  return `<img src="${src}" alt="${escapeAttr(alt || inferAltFromSrc(src))}"${cls}${sizeAttrs}${attrs}>`;
}

function optimizeContentImages(html, fallbackAltPrefix) {
  if (!html) return html;
  return html.replace(/<img\b[^>]*>/gi, (tag) => {
    const srcM = tag.match(/\ssrc="([^"]+)"/i);
    if (!srcM) return tag;
    const src = srcM[1];
    const altM = tag.match(/\salt="([^"]*)"/i);
    const widthM = tag.match(/\swidth="([^"]+)"/i);
    const heightM = tag.match(/\sheight="([^"]+)"/i);
    const loadingM = tag.match(/\sloading="([^"]+)"/i);
    const alt = (altM && altM[1].trim()) ? altM[1] : inferAltFromSrc(src, `${fallbackAltPrefix} image`);
    const filePath = getAssetImageFilePath(src);
    const dims = readImageSize(filePath);
    let out = tag;
    if (!altM) out = out.replace('<img', `<img alt="${escapeAttr(alt)}"`);
    else if (!altM[1].trim()) out = out.replace(altM[0], ` alt="${escapeAttr(alt)}"`);
    if (dims?.width && dims?.height && (!widthM || !heightM)) {
      if (!widthM) out = out.replace('<img', `<img width="${dims.width}"`);
      if (!heightM) out = out.replace('<img', `<img height="${dims.height}"`);
    }
    if (!loadingM) out = out.replace('<img', '<img loading="lazy"');
    return out;
  });
}

// ── JSON-LD helpers ───────────────────────────────────────────────────────────
function jsonLd(...items) {
  return items.filter(Boolean)
    .map(o => `<script type="application/ld+json">${JSON.stringify(o)}</script>`)
    .join('\n');
}

const ORG = {
  '@type': 'Organization',
  name: 'Lotusia Stewardship',
  url: SITE_URL,
  logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` },
  foundingDate: '2021',
  sameAs: [
    'https://github.com/LotusiaStewardship',
    'https://t.me/givelotus',
    'https://guillioud.com',
    'https://lotusia.org'
  ]
};

function webSiteJsonLd(lang) {
  return {
    '@context': 'https://schema.org', '@type': 'WebSite',
    name: 'Lotusia', url: SITE_URL,
    description: I18N[lang].pages.index.description,
    inLanguage: I18N[lang].hreflang,
    availableLanguage: LANGS.map(c => I18N[c].hreflang),
    publisher: { '@type': 'Organization', name: 'Lotusia Stewardship', url: SITE_URL },
    potentialAction: {
      '@type': 'SearchAction',
      target: `${SITE_URL}/docs?q={search_term_string}`,
      'query-input': 'required name=search_term_string'
    }
  };
}

function webPageJsonLd(title, description, pagePath, lang, type = 'WebPage') {
  return {
    '@context': 'https://schema.org', '@type': type,
    name: title, description,
    url: abs(pagePath),
    isPartOf: { '@type': 'WebSite', name: 'Lotusia', url: SITE_URL },
    publisher: { '@type': 'Organization', name: 'Lotusia Stewardship', url: SITE_URL },
    inLanguage: I18N[lang].hreflang
  };
}

function breadcrumbJsonLd(parts) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: parts.map((p, i) => ({
      '@type': 'ListItem', position: i + 1, name: p.name, item: abs(p.url)
    }))
  };
}

// ── hreflang tags ────────────────────────────────────────────────────────────
function hreflangTags(alternates) {
  const unique = new Set();
  const entries = Object.entries(alternates || {})
    .filter(([lang, href]) => LANGS.includes(lang) && href)
    .filter(([, href]) => {
      if (unique.has(href)) return false;
      unique.add(href);
      return true;
    });
  const lines = entries.map(([lang, href]) => {
    const hreflang = I18N[lang].hreflang || lang;
    return `<link rel="alternate" hreflang="${hreflang}" href="${abs(href)}">`;
  });
  const xDefault = alternates?.en || entries[0]?.[1];
  if (xDefault) lines.push(`<link rel="alternate" hreflang="x-default" href="${abs(xDefault)}">`);
  return lines.join('\n');
}

// ── Language switcher ────────────────────────────────────────────────────────
function langSwitcher(currentLang, alternates, mobile = false) {
  const cur = I18N[currentLang];
  const flagByLang = {
    en: '🇬🇧',
    fr: '🇫🇷',
    es: '🇪🇸',
    it: '🇮🇹',
    de: '🇩🇪',
    ru: '🇷🇺',
    cn: '🇨🇳'
  };
  const items = LANGS.map(lang => {
    const href  = alternates[lang] || alternates.en;
    const flag = flagByLang[lang] || '🌐';
    const label = `${flag} ${I18N[lang].lang_name} (${lang.toUpperCase()})`;
    const active = lang === currentLang;
    if (mobile) {
      const cls = active
        ? 'block px-3 py-2 text-sm font-semibold text-primary rounded-lg whitespace-nowrap'
        : 'block px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg whitespace-nowrap';
      return `<a href="${href}" lang="${I18N[lang].html_lang}" class="${cls}">${label}</a>`;
    }
    const cls = active
      ? 'block px-3 py-2 text-sm text-primary font-semibold rounded-lg whitespace-nowrap'
      : 'block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg whitespace-nowrap';
    return `<a href="${href}" lang="${I18N[lang].html_lang}" class="${cls}">${label}</a>`;
  }).join('');

  if (mobile) {
    return `<div class="border-t border-gray-200 dark:border-gray-800 mt-2 pt-2">${items}</div>`;
  }
  const langLabel = cur.common.language;
  const currentFlag = flagByLang[currentLang] || '🌐';
  return `<div class="relative" data-dropdown><button type="button" class="text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary whitespace-nowrap" data-dropdown-trigger aria-expanded="false">${langLabel}: ${currentFlag} ${currentLang.toUpperCase()} <span class="text-xs">▾</span></button><div class="hidden absolute top-full right-0 mt-1 w-60 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-2 z-50" data-dropdown-menu>${items}</div></div>`;
}

// ── Nav vars (injected into every header/footer render) ───────────────────────
function makeNavVars(lang, alternates, pagePath) {
  const i = I18N[lang];
  const normalized = (() => {
    const p = pagePath || '/';
    const withoutPrefix = p.replace(/^\/(fr|es|it|de|ru|cn)(?=\/|$)/, '');
    return withoutPrefix || '/';
  })();
  const isEcosystem = normalized === '/ecosystem';
  const isTools = normalized === '/tools';
  const isRoadmap = normalized === '/roadmap';
  const isFaq = normalized === '/faq';
  const isDocs = normalized === '/docs' || normalized.startsWith('/docs/');
  const isFounders = normalized === '/founders';
  const isBetaServices = normalized === '/beta-services';
  const isBlog = normalized === '/blog' || normalized.startsWith('/blog/');
  const isExplorer = normalized === '/explorer' || normalized.startsWith('/explorer/');
  const isSocial = normalized === '/social' || normalized.startsWith('/social/');
  const isMore = isFounders || isBetaServices || isBlog || isExplorer || isSocial;

  const topNavClass = (active) => active
    ? 'text-sm/6 font-semibold flex items-center gap-1 text-primary underline underline-offset-4 decoration-primary'
    : 'text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary';
  const moreButtonClass = (active) => active
    ? 'text-sm/6 font-semibold flex items-center gap-1 text-primary'
    : 'text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary';
  const dropdownItemClass = (active) => active
    ? 'block px-3 py-2 text-sm text-primary font-semibold bg-gray-50 dark:bg-gray-800 rounded-lg'
    : 'block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';
  const mobileItemClass = (active) => active
    ? 'block px-3 py-2 text-sm font-semibold text-primary bg-gray-50 dark:bg-gray-800 rounded-lg'
    : 'block px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';

  return {
    nav_ecosystem:       i.nav.ecosystem,
    nav_tools:           i.nav.tools,
    nav_roadmap:         i.nav.roadmap,
    nav_faq:             i.nav.faq,
    nav_docs:            i.nav.docs,
    nav_founders:        i.nav.founders,
    nav_blog:            i.nav.blog,
    nav_more:            i.nav.more,
    nav_explorer:        i.nav.explorer,
    nav_beta_services:   i.nav.beta_services,
    nav_cls_ecosystem:   topNavClass(isEcosystem),
    nav_cls_tools:       topNavClass(isTools),
    nav_cls_roadmap:     topNavClass(isRoadmap),
    nav_cls_faq:         topNavClass(isFaq),
    nav_cls_docs:        topNavClass(isDocs),
    nav_cls_more:        moreButtonClass(isMore),
    nav_cls_founders:    dropdownItemClass(isFounders),
    nav_cls_beta_services: dropdownItemClass(isBetaServices),
    nav_cls_blog:        dropdownItemClass(isBlog),
    nav_cls_explorer:    dropdownItemClass(isExplorer),
    nav_cls_social:      dropdownItemClass(isSocial),
    nav_m_cls_ecosystem: mobileItemClass(isEcosystem),
    nav_m_cls_tools:     mobileItemClass(isTools),
    nav_m_cls_roadmap:   mobileItemClass(isRoadmap),
    nav_m_cls_faq:       mobileItemClass(isFaq),
    nav_m_cls_docs:      mobileItemClass(isDocs),
    nav_m_cls_founders:  mobileItemClass(isFounders),
    nav_m_cls_beta_services: mobileItemClass(isBetaServices),
    nav_m_cls_blog:      mobileItemClass(isBlog),
    nav_m_cls_explorer:  mobileItemClass(isExplorer),
    nav_m_cls_social:    mobileItemClass(isSocial),
    toggle_theme:        i.common.toggle_theme,
    footer_copyright:    i.common.copyright,
    footer_all_rights_reserved: i.common.all_rights_reserved,
    url_home:            navRoute(lang, '/'),
    url_ecosystem:       navRoute(lang, '/ecosystem'),
    url_tools:           navRoute(lang, '/tools'),
    url_roadmap:         navRoute(lang, '/roadmap'),
    url_faq:             navRoute(lang, '/faq'),
    url_docs:            '/docs',
    url_founders:        navRoute(lang, '/founders'),
    url_beta_services:   navRoute(lang, '/beta-services'),
    url_blog:            '/blog',
    url_explorer:        '/explorer/blocks',
    url_social:          '/social/activity',
    breadcrumb_home:     i.common.home,
    breadcrumb_blog:     i.nav.blog,
    lang_switcher:        langSwitcher(lang, alternates, false),
    lang_switcher_mobile: langSwitcher(lang, alternates, true)
  };
}

function makePageMeta(lang, pagePath, alternates) {
  const i = I18N[lang];
  return {
    html_lang:     i.html_lang || lang,
    og_locale:     i.locale    || 'en_US',
    site_url:      SITE_URL,
    canonical_url: abs(pagePath),
    hreflang_tags: hreflangTags(alternates),
    path:          pagePath,
    ...makeNavVars(lang, alternates, pagePath)
  };
}

// ── i18n overlay: merge translated strings onto YAML data ─────────────────────
function overlayI18nSections(yamlSections, i18nSections) {
  if (!i18nSections?.length || !yamlSections?.length) return yamlSections;
  return yamlSections.map((section, i) => {
    const t = i18nSections[i];
    if (!t) return section;
    const out = { ...section };
    if (t.title)       out.title = t.title;
    if (t.description) out.description = t.description;
    if (t.headline)    out.headline = t.headline;
    if (t.features && section.features) {
      out.features = section.features.map((f, fi) => {
        const ft = t.features?.[fi];
        return ft ? { ...f, name: ft.name || f.name, description: ft.description || f.description } : f;
      });
    }
    if (t.quotes && section.quotes) {
      out.quotes = section.quotes.map((q, qi) => {
        const qt = t.quotes?.[qi];
        return qt ? { ...q, text: qt.text || q.text } : q;
      });
    }
    return out;
  });
}

function overlayI18nFaqQuestions(yamlQuestions, i18nQuestions) {
  if (!i18nQuestions?.length || !yamlQuestions?.length) return yamlQuestions;
  return yamlQuestions.map((q, i) => {
    const t = i18nQuestions[i];
    if (!t) return q;
    return { ...q, text: t.text || q.text, answer: t.answer || q.answer };
  });
}

function overlayI18nRoadmapSections(yamlSections, i18nSections) {
  if (!i18nSections?.length || !yamlSections?.length) return yamlSections;
  return yamlSections.map((epoch, i) => {
    const te = i18nSections[i];
    if (!te) return epoch;
    const out = { ...epoch };
    if (te.title)    out.title = te.title;
    if (te.headline) out.headline = te.headline;
    if (te.cards && epoch.cards) {
      out.cards = epoch.cards.map((card, ci) => {
        const tc = te.cards?.[ci];
        if (!tc) return card;
        const cardOut = { ...card };
        if (tc.title)       cardOut.title = tc.title;
        if (tc.description) cardOut.description = tc.description;
        if (tc.checklist && card.checklist) {
          cardOut.checklist = card.checklist.map((item, li) => {
            const tl = tc.checklist?.[li];
            return tl ? { ...item, label: tl.label || item.label } : item;
          });
        }
        return cardOut;
      });
    }
    return out;
  });
}

// ── Content renderers ─────────────────────────────────────────────────────────
function renderFeatures(features) {
  if (!features?.length) return '';
  return '<dl class="mt-6 leading-7 space-y-4">'
    + features.map(f => {
        const icon = f.icon
          ? `<span class="${f.icon} absolute left-0 top-1 h-5 w-5 text-primary" aria-hidden="true"></span>`
          : `<span class="absolute left-0 top-1 h-5 w-5 text-primary" aria-hidden="true">&#x2022;</span>`;
        return `<div class="relative pl-8"><dt class="font-semibold text-gray-900 dark:text-white">${icon}<span>${f.name}</span></dt><dd class="text-gray-500 dark:text-gray-400 leading-6">${f.description}</dd></div>`;
      }).join('')
    + '</dl>';
}

function renderQuotes(quotes) {
  if (!quotes?.length) return '';
  return quotes.map(q =>
    `<div class="rounded-xl bg-gray-100/50 dark:bg-gray-800/50 p-6 border border-gray-200/50 dark:border-gray-700/50 mb-4">`
    + `<p class="text-gray-600 dark:text-gray-300 italic mb-3 leading-7">"${q.text}"</p>`
    + `<div class="flex items-center gap-3">`
    + (q.avatar ? imgTag(`/assets/images/${path.basename(q.avatar)}`, `${q.author} avatar`, 'w-10 h-10 rounded-full object-cover') : '')
    + `<div><div class="font-semibold text-gray-900 dark:text-white text-sm">${q.author}</div><div class="text-xs text-gray-500 dark:text-gray-400">${q.title || ''}</div></div></div></div>`
  ).join('');
}

function translateLabel(i18n, label) {
  const map = {
    'Get Started':    i18n.buttons.get_started,
    'Learn More':     i18n.buttons.learn_more,
    'Technical Docs': i18n.buttons.technical_docs
  };
  return map[label] || label;
}

function renderLinks(links, lang, opts = {}) {
  if (!links?.length) return '';
  const i18n = I18N[lang];
  const { defaultPrimary = false, singleRow = false } = opts;
  const wrapperClass = singleRow
    ? 'mt-10 flex flex-nowrap gap-3 overflow-x-auto pb-1'
    : 'mt-10 flex flex-wrap gap-x-6 gap-y-3';
  return `<div class="${wrapperClass}">`
    + links.map(l => {
        const primary = l.color === 'purple' || l.color === 'primary' || (!l.color && defaultPrimary);
        const cls = primary
          ? 'inline-flex items-center rounded-full font-medium text-base gap-x-2.5 px-3.5 py-2.5 shadow-sm text-white bg-primary-500 hover:bg-primary-600 transition-colors'
          : 'inline-flex items-center rounded-full font-medium text-base gap-x-2.5 px-3.5 py-2.5 shadow-sm ring-1 ring-inset ring-gray-300 dark:ring-gray-700 text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors';
        const clsWithRow = singleRow ? `${cls} flex-shrink-0 whitespace-nowrap` : cls;
        const tgt  = l.target === '_blank' ? ' target="_blank"' : '';
        const href = localHref(lang, l.to || '#');
        const icon = l.icon ? `<span class="${l.icon} h-5 w-5 flex-shrink-0" aria-hidden="true"></span>` : '';
        return `<a href="${href}" class="${clsWithRow}"${tgt}>${icon}<span>${translateLabel(i18n, l.label)}</span></a>`;
      }).join('')
    + '</div>';
}

function renderSections(sections, pageType, lang) {
  if (!sections?.length) return '';
  return sections.map((s, i) => {
    const quotes   = renderQuotes(s.quotes);
    const features = renderFeatures(s.features);
    const links    = renderLinks(s.links, lang, {
      defaultPrimary: pageType === 'tools',
      singleRow: pageType === 'tools'
    });

    // image selection
    let image = '';
    if (pageType === 'founders') {
      const img = i === 0 ? 'alexandre_guillioud.jpeg' : 'matthew_urgero.jpeg';
      image = imgTag(`/assets/images/${img}`, `${s.title} portrait`, 'w-full max-w-sm', 'loading="lazy" style="border-radius:15%;"');
    } else if (pageType === 'ecosystem') {
      const imgs = ['ecosystem_0_0.jpg','ecosystem_1_2.jpg','ecosystem_2_0.jpg','ecosystem_3_0.jpg'];
      if (!quotes && imgs[i]) image = imgTag(`/assets/images/${imgs[i]}`, `${s.title} illustration`, 'w-full max-w-sm', 'loading="lazy" style="border-radius:15%;"');
    } else if (pageType === 'tools') {
      const imgs = ['LotusQT_0.png','lotus-lib_1.jpeg','extension_1.jpeg','bigvase_1.jpeg'];
      if (imgs[i]) image = imgTag(`/assets/images/${imgs[i]}`, `${s.title} screenshot`, 'w-full max-w-sm', 'loading="lazy" style="border-radius:15%;"');
    } else if (!quotes) {
      image = imgTag(`/assets/images/turtles_${i + 1}.jpeg`, `${s.title} illustration`, 'w-full max-w-sm', 'loading="lazy" style="border-radius:15%;"');
    }

    // alternation: even index → text left / image right; odd → image left / text right
    // We always output text first in HTML, then media.
    // When textOnRight, we push text to the right with lg:order-last.
    const textOnRight = (s.align === 'right') || (s.align === undefined && i % 2 === 0);
    const textDiv  = `<div${textOnRight ? ' class="lg:order-last"' : ''}>${s.headline ? `<p class="text-base/7 font-semibold text-primary">${s.headline}</p>` : ''}<h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">${s.title}</h2><p class="mt-6 text-lg/8 text-gray-600 dark:text-gray-300">${s.description}</p>${features}${links}</div>`;
    const mediaDiv = quotes ? `<div class="grid grid-cols-1 gap-8">${quotes}</div>` : (image ? `<div class="flex justify-center">${image}</div>` : '');

    return `<div class="py-16 sm:py-24"><div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl gap-16 sm:gap-y-24 grid lg:grid-cols-2 lg:items-center">${textDiv}${mediaDiv}</div></div>`;
  }).join('\n');
}

function renderTable(tableData) {
  if (!tableData?.columns || !tableData?.rows) return '';
  const headers = tableData.columns.map(c => `<th>${c.label || c.key}</th>`).join('');
  const rows    = tableData.rows.map(r =>
    `<tr>${tableData.columns.map(c => `<td>${r[c.key] ?? ''}</td>`).join('')}</tr>`
  ).join('');
  return `<table class="specs-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function breadcrumbHtml(parts) {
  return parts.map((p, i) =>
    i < parts.length - 1 ? `<a href="${p.url}">${p.name}</a>` : `<span>${p.name}</span>`
  ).join(' / ');
}

// ═══════════════════════════════════════════════════════════════════════════════
//  PAGE BUILDERS
// ═══════════════════════════════════════════════════════════════════════════════

function buildLanding(file, basePath, pageType, lang, sitemap) {
  const data    = readYaml(file);
  const i18n    = I18N[lang];
  const pi      = i18n.pages[pageType] || {};
  const pagePath = langPath(lang, basePath);
  const alternates = localizedAlternates(basePath);
  const isHome   = basePath === '/';

  // image / hero
  const imgFile  = data.ogImage || data.hero?.image;
  const ogImg    = imgFile
    ? `/assets/images/${path.basename(typeof imgFile === 'string' ? imgFile : imgFile.light || 'turtles_hero.jpeg')}`
    : '/assets/images/turtles_hero.jpeg';
  const heroImg  = data.hero?.image
    ? imgTag(`/assets/images/${path.basename(typeof data.hero.image === 'string' ? data.hero.image : data.hero.image.light || '')}`, `${data.hero?.title || data.title || 'Lotusia'} hero image`, 'w-full max-w-md', 'loading="lazy" style="border-radius:15%;"')
    : '';

  const pageTitle = pi.og_title || data.ogTitle || data.title || '';
  const title     = pi.title    || pageTitle;
  const heroTitle = pi.hero_title || data.hero?.title || data.title || '';
  const heroDesc  = pi.hero_description || pi.description || data.hero?.description || data.description || '';
  const description = pi.description || data.description || '';

  // overlay i18n onto sections
  const sections = overlayI18nSections(data.sections, pi.sections);

  const bcParts = isHome ? [] : [
    { name: i18n.common.home, url: navRoute(lang, '/') },
    { name: title,            url: pagePath }
  ];
  const breadcrumbDiv = isHome ? '' : `<div class="pt-4 text-sm text-gray-500">${breadcrumbHtml(bcParts)}</div>`;

  const heroBlock = `<div class="md:py-40 relative py-16 sm:py-16 lg:py-16"><div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl gap-16 sm:gap-y-24 grid lg:grid-cols-2 lg:items-center"><div><h1 class="text-5xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-7xl">${heroTitle}</h1><p class="mt-6 text-lg tracking-tight text-gray-600 dark:text-gray-300">${heroDesc}</p>${renderLinks(data.hero?.links, lang)}</div><div class="flex justify-center">${heroImg}</div></div></div>`;

  // JSON-LD
  const ldItems = [webPageJsonLd(title, description, pagePath, lang)];
  if (isHome) ldItems.unshift(webSiteJsonLd(lang), { '@context': 'https://schema.org', ...ORG });
  if (!isHome) ldItems.push(breadcrumbJsonLd(bcParts));
  if (pageType === 'founders' && sections) {
    sections.forEach((s, idx) => {
      ldItems.push({
        '@context': 'https://schema.org', '@type': 'Person',
        name: s.title, jobTitle: s.headline || 'Founder',
        image: `${SITE_URL}/assets/images/${idx === 0 ? 'alexandre_guillioud.jpeg' : 'matthew_urgero.jpeg'}`
      });
    });
  }

  // CTA with i18n overlay
  let ctaData = data.cta;
  if (ctaData && pi.cta) {
    ctaData = { ...ctaData, title: pi.cta.title || ctaData.title, description: pi.cta.description || ctaData.description };
  }
  const ctaHtml = ctaData
    ? `<div class="max-w-3xl mx-auto py-16 sm:py-24 text-center px-4"><h2 class="text-3xl font-bold tracking-tight sm:text-4xl">${ctaData.title}</h2><p class="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">${ctaData.description}</p>${renderLinks(ctaData.links || data.hero?.links, lang)}</div>`
    : '';

  const vars = {
    ...makePageMeta(lang, pagePath, alternates),
    title,
    og_title:       pageTitle,
    description,
    og_image:       ogImg,
    hero_block:     heroBlock,
    sections:       renderSections(sections, pageType, lang),
    cta:            ctaHtml,
    breadcrumb_html: breadcrumbDiv,
    json_ld:        jsonLd(...ldItems),
    head_extra:     ''
  };
  writeOutFromPath(pagePath, renderPage('landing', vars));
  setSitemapEntry(sitemap, basePath, alternates, fileLastmod(path.join(CONTENT, file)));
}

function buildRoadmap(lang, sitemap) {
  const data     = readYaml('roadmap.yml');
  const i18n     = I18N[lang];
  const pi       = i18n.pages.roadmap || {};
  const basePath = '/roadmap';
  const pagePath = langPath(lang, basePath);
  const alternates = localizedAlternates(basePath);

  const roadmapSections = overlayI18nRoadmapSections(data.sections, pi.sections);
  const sectionsHtml = (roadmapSections || []).map(epoch => {
    const headline = epoch.headline
      ? `<div class="mb-3 text-sm/6 font-semibold text-primary flex items-center">${epoch.headline}</div>` : '';
    const statusColors = {
      complete: 'bg-emerald-500/10 text-emerald-500 border-emerald-500',
      ongoing:  'bg-amber-500/10 text-amber-500 border-purple-500',
      planned:  'bg-primary-500/10 text-primary-500 border-primary-500'
    };
    const cards = (epoch.cards || []).map(card => {
      const borderColor = card.status === 'complete' ? 'border-l-emerald-500' : card.status === 'ongoing' ? 'border-l-purple-500' : 'border-l-primary-500';
      const badge = card.status
        ? `<span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[card.status] || ''}">${card.status}</span>` : '';
      const checklist = (card.checklist || []).map(item =>
        `<div class="${item.complete ? 'task task-done' : 'task'}">${item.label}</div>`
      ).join('');
      return `<div class="rounded-xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 border-l-4 ${borderColor} relative"><div class="flex-1 px-4 py-5 sm:p-6"><div class="mb-6 flex"><div class="flex items-center gap-2">${badge}</div></div><p class="text-gray-900 dark:text-white text-base font-semibold">${card.title}</p><p class="text-[15px] text-gray-500 dark:text-gray-400 mt-1">${card.description || ''}</p><div class="mt-2">${checklist}</div>${renderLinks(card.links, lang)}</div></div>`;
    }).join('');
    return `<div class="flex flex-col lg:grid lg:grid-cols-10 lg:gap-8"><div class="lg:col-span-10"><div class="relative border-b border-gray-200 dark:border-gray-800 py-8">${headline}<div class="flex flex-col lg:flex-row items-start gap-6"><div class="flex-1"><h2 class="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white">${epoch.title}</h2></div></div></div><div class="mt-8 pb-24"><div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">${cards}</div></div></div></div>`;
  }).join('\n');

  const heroTitle = pi.hero_title || data.hero?.title || 'Roadmap';
  const heroDesc  = pi.hero_description || pi.description || data.hero?.description || data.description || '';
  const title     = pi.title || data.ogTitle || 'Roadmap';
  const description = pi.description || data.description || '';

  const bcParts = [
    { name: i18n.common.home, url: navRoute(lang, '/') },
    { name: title,            url: pagePath }
  ];
  const itemList = {
    '@context': 'https://schema.org', '@type': 'ItemList',
    name: title,
    itemListElement: (data.sections || []).flatMap((epoch, ei) =>
      (epoch.cards || []).map((card, ci) => ({
        '@type': 'ListItem', position: ei * 100 + ci + 1,
        name: card.title, description: card.description || ''
      }))
    )
  };

  const vars = {
    ...makePageMeta(lang, pagePath, alternates),
    title,
    og_title:    pi.og_title || data.ogTitle || 'Roadmap',
    description,
    og_image:    '/assets/images/roadmap_0.jpg',
    hero_block:  `<div class="py-8 sm:py-16 lg:py-24"><div class="flex flex-col gap-8 sm:gap-y-16"><div class="flex flex-col items-center text-center"><h1 class="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">${heroTitle}</h1><p class="mt-4 text-lg text-gray-500 dark:text-gray-400">${heroDesc}</p></div></div></div>`,
    sections:    sectionsHtml,
    cta:         '',
    breadcrumb_html: `<div class="pt-4 text-sm text-gray-500">${breadcrumbHtml(bcParts)}</div>`,
    json_ld:     jsonLd(webPageJsonLd(title, description, pagePath, lang), breadcrumbJsonLd(bcParts), itemList),
    head_extra:  ''
  };
  writeOutFromPath(pagePath, renderPage('landing', vars));
  setSitemapEntry(sitemap, basePath, alternates, fileLastmod(path.join(CONTENT, 'roadmap.yml')));
}

function buildFaq(lang, sitemap) {
  const data     = readYaml('faq.yml');
  const i18n     = I18N[lang];
  const pi       = i18n.pages.faq || {};
  const basePath = '/faq';
  const pagePath = langPath(lang, basePath);
  const alternates = localizedAlternates(basePath);

  function renderFaqItems(questions) {
    if (!questions?.length) return '';
    return questions.map(q => {
      let extra = '';
      if (q.note)   extra += `<div class="pb-2 flex flex-wrap gap-x-3 gap-y-1.5 items-center"><span class="text-gray-500 dark:text-gray-400 text-sm">${q.note}</span></div>`;
      if (q.links)  extra += `<div class="lg:space-y-1.5">${q.links.map(l => `<a href="${localHref(lang, l.to)}" class="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 hover:text-primary text-sm"${l.target ? ` target="${l.target}"` : ''}>${translateLabel(i18n, l.label)}</a>`).join('')}</div>`;
      if (q.table)  extra += renderTable(q.table);
      return `<div class="pb-16"><div class="text-xl font-semibold text-gray-900 dark:text-white">${q.text}</div><div class="py-2 flex flex-wrap gap-x-3 gap-y-1.5 text-gray-600 dark:text-gray-300">${q.answer}</div>${extra}</div>`;
    }).join('\n');
  }

  const translatedQuestions = overlayI18nFaqQuestions(data.questions, pi.questions);
  let sectionsHtml = '';
  if (translatedQuestions)  sectionsHtml += `<div class="flex flex-col lg:grid lg:grid-cols-10 lg:gap-8"><div class="lg:col-span-10"><div class="mt-8 pb-24">${renderFaqItems(translatedQuestions)}</div></div></div>`;
  if (data.technical) {
    let techHtml = renderFaqItems(data.technical.questions);
    if (data.technical.sections) {
      techHtml += data.technical.sections.map(s =>
        `<div class="pb-16"><h3 class="text-xl font-semibold text-gray-900 dark:text-white mb-4">${s.title}</h3>${renderTable(s.table)}</div>`
      ).join('\n');
    }
    sectionsHtml += `<div class="flex flex-col lg:grid lg:grid-cols-10 lg:gap-8"><div class="lg:col-span-10"><div class="mt-8 pb-24">${techHtml}</div></div></div>`;
  }
  if (data.cta) {
    const faqCta = pi.cta ? { ...data.cta, title: pi.cta.title || data.cta.title, description: pi.cta.description || data.cta.description } : data.cta;
    sectionsHtml += `<div class="py-16 sm:py-24 text-center"><h2 class="text-3xl font-bold tracking-tight sm:text-4xl text-gray-900 dark:text-white">${faqCta.title}</h2><p class="mt-4 text-lg text-gray-500 dark:text-gray-400">${faqCta.description}</p>${renderLinks(faqCta.links, lang)}</div>`;
  }

  const title       = pi.title       || data.ogTitle  || 'FAQ';
  const heroTitle   = pi.hero_title  || data.hero?.title || 'FAQ';
  const heroDesc    = pi.hero_description || pi.description || data.hero?.description || data.description || '';
  const description = pi.description || data.description || '';

  const bcParts = [
    { name: i18n.common.home, url: navRoute(lang, '/') },
    { name: title,            url: pagePath }
  ];
  const faqMainEntity = (translatedQuestions || []).map(q => ({
    '@type': 'Question', name: q.text,
    acceptedAnswer: { '@type': 'Answer', text: q.answer }
  }));

  const vars = {
    ...makePageMeta(lang, pagePath, alternates),
    title,
    og_title:    pi.og_title || data.ogTitle || 'FAQ',
    description,
    og_image:    '/assets/images/turtles_hero.jpeg',
    hero_block:  `<div class="py-8 sm:py-16 lg:py-24"><div class="flex flex-col gap-8 sm:gap-y-16"><div class="flex flex-col items-center text-center"><h1 class="text-3xl font-bold text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">${heroTitle}</h1><p class="mt-4 text-lg text-gray-500 dark:text-gray-400">${heroDesc}</p><div class="mt-8 flex flex-wrap gap-x-3 gap-y-1.5 justify-center">${renderLinks(data.links, lang)}</div></div></div></div>`,
    sections:    sectionsHtml,
    cta:         '',
    breadcrumb_html: `<div class="pt-4 text-sm text-gray-500">${breadcrumbHtml(bcParts)}</div>`,
    json_ld:     jsonLd(
      webPageJsonLd(title, description, pagePath, lang),
      breadcrumbJsonLd(bcParts),
      { '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: faqMainEntity }
    ),
    head_extra:  ''
  };
  writeOutFromPath(pagePath, renderPage('landing', vars));
  setSitemapEntry(sitemap, basePath, alternates, fileLastmod(path.join(CONTENT, 'faq.yml')));
}

// ── Frontmatter parser ───────────────────────────────────────────────────────
function parseFrontmatter(content) {
  const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) return { meta: {}, body: content };
  return { meta: yaml.load(m[1]) || {}, body: m[2] };
}

function buildBlog(sitemap) {
  const blogDir = path.join(CONTENT, 'blog');
  const files   = fs.readdirSync(blogDir).filter(f => f.endsWith('.md')).sort().reverse();
  const en      = I18N.en;
  const posts   = [];

  const alternatesForBlog = { en: '/blog' };
  let blogIndexLastmod = '';

  for (const file of files) {
    const raw    = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug   = file.replace(/^\d+\./, '').replace('.md', '');
    const htmlBody = optimizeContentImages(
      marked(body).replace(/src="\/img\//g, 'src="/assets/images/'),
      meta.title || slug
    );
    const dateRaw  = meta.date || '';
    const dateObj  = dateRaw ? new Date(dateRaw) : null;
    const dateStr  = dateObj ? dateObj.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }) : '';
    const dateIso  = dateObj ? dateObj.toISOString().split('T')[0] : '';
    const ogImage  = meta.image?.src
      ? `/assets/images/blog/${path.basename(meta.image.src)}`
      : '/assets/images/blog_0.jpg';
    const authorName  = meta.authors?.[0]?.name || meta.author || 'Lotusia Stewardship';
    const heroImage   = ogImage !== '/assets/images/blog_0.jpg'
      ? imgTag(ogImage, `${meta.title || slug} hero image`, 'blog-hero-img', 'loading="lazy"')
      : '';
    const canonicalPath = `/blog/${slug}`;
    const alternatesPost = { en: canonicalPath };
    const wordCount      = (body || '').split(/\s+/).filter(Boolean).length;
    const articleSection = meta.badge?.label || 'Blog';

    const vars = {
      ...makePageMeta('en', canonicalPath, alternatesPost),
      title:        meta.title || slug,
      description:  meta.description || '',
      slug,
      og_image:     ogImage,
      date:         dateStr,
      date_iso:     dateIso,
      author:       authorName,
      body:         heroImage + htmlBody,
      json_ld:      jsonLd({
        '@context':    'https://schema.org',
        '@type':       'BlogPosting',
        headline:      meta.title || slug,
        description:   meta.description || '',
        url:           abs(canonicalPath),
        image:         abs(ogImage),
        datePublished: dateIso || undefined,
        dateModified:  dateIso || undefined,
        wordCount,
        articleSection,
        author:        { '@type': 'Person', name: authorName },
        publisher:     { '@type': 'Organization', name: 'Lotusia Stewardship', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` } },
        inLanguage:    'en'
      }),
      head_extra: ''
    };
    writeOutFromPath(canonicalPath, renderPage('blog-post', vars));

    const authorAvatar = meta.authors?.[0]?.avatar?.src
      ? `/assets/images/${path.basename(meta.authors[0].avatar.src)}` : '';
    const badge    = meta.badge?.label || '';
    const cardDate = dateObj ? dateObj.toLocaleDateString('en-US', { year:'numeric', month:'short', day:'numeric' }) : '';
    posts.push({ title: meta.title || slug, description: meta.description || '', slug, date: cardDate, image: ogImage, author: authorName, avatar: authorAvatar, badge, canonicalPath });
    const postLastmod = dateIso || fileLastmod(path.join(blogDir, file));
    setSitemapEntry(sitemap, canonicalPath, alternatesPost, postLastmod);
    blogIndexLastmod = maxLastmod(blogIndexLastmod, postLastmod);
  }

  // Blog index
  const postsHtml = posts.map((p, idx) => {
    const isFirst    = idx === 0;
    const avatarHtml = p.avatar
      ? `<div class="inline-flex flex-row-reverse justify-end"><span class="inline-flex items-center justify-center flex-shrink-0 rounded-full h-6 w-6 text-xs ring-2 ring-white dark:ring-gray-900 overflow-hidden">${imgTag(p.avatar, `${p.author} avatar`, 'h-full w-full object-cover')}</span></div>` : '';
    const badgeHtml  = p.badge
      ? `<div class="mb-3"><span class="inline-flex items-center font-medium rounded-md text-xs px-2 py-1 bg-primary-500/10 text-primary-500">${p.badge}</span></div>` : '';
    const imgWrapCls = isFirst
      ? 'relative overflow-hidden w-full rounded-lg lg:col-span-2'
      : 'relative overflow-hidden w-full rounded-lg';
    const imgHtml    = p.image
      ? `<div class="${imgWrapCls}">${imgTag(p.image, `${p.title} cover image`, `w-full ${isFirst ? 'h-auto' : 'h-48'} object-cover`, 'loading="lazy"')}</div>` : '';
    const wrapperCls = isFirst
      ? 'relative flex flex-col w-full gap-y-6 lg:col-span-3 lg:grid lg:grid-cols-5 lg:gap-8'
      : 'relative flex flex-col w-full gap-y-6';
    const textWrapCls = isFirst
      ? 'flex flex-col justify-between flex-1 lg:col-span-3'
      : 'flex flex-col justify-between flex-1';
    return `<article class="${wrapperCls}">${imgHtml}<div class="${textWrapCls}"><div class="flex-1"><a href="/blog/${p.slug}" class="absolute inset-0"><span class="sr-only">${p.title}</span></a>${badgeHtml}<h2 class="text-gray-900 dark:text-white text-xl font-semibold">${p.title}</h2><p class="text-base text-gray-500 dark:text-gray-400 mt-1">${p.description}</p></div><div class="relative flex items-center gap-x-3 mt-4">${avatarHtml}<time class="text-sm text-gray-500 font-medium">${p.date}</time></div></div></article>`;
  }).join('\n');

  const vars = {
    ...makePageMeta('en', '/blog', alternatesForBlog),
    title:            en.pages.blog.title,
    og_title:         en.pages.blog.og_title,
    description:      en.pages.blog.description,
    og_image:         '/assets/images/blog_0.jpg',
    hero_title:       en.pages.blog.title,
    hero_description: en.pages.blog.description,
    blog_posts:       postsHtml,
    json_ld:          jsonLd({
      '@context': 'https://schema.org', '@type': 'CollectionPage',
      name: 'Lotusia Blog', url: abs('/blog'), inLanguage: 'en',
      isPartOf: { '@type': 'WebSite', name: 'Lotusia', url: SITE_URL },
      hasPart: posts.map(p => ({ '@type': 'BlogPosting', headline: p.title, url: abs(p.canonicalPath) }))
    }),
    head_extra: ''
  };
  writeOutFromPath('/blog', renderPage('blog-index', vars));
  setSitemapEntry(sitemap, '/blog', alternatesForBlog, blogIndexLastmod);
}

function buildDocs(sitemap) {
  const docsRoot = path.join(CONTENT, 'docs');
  const allDocs  = [];
  const groups   = {};

  function cleanName(n) { return n.replace(/^\d+\./, ''); }

  function walkDir(dir, urlPrefix, group) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        const dirName  = cleanName(e.name);
        const newGroup = group ? `${group} / ${dirName}` : dirName;
        walkDir(path.join(dir, e.name), `${urlPrefix}/${dirName}`, newGroup);
      } else if (e.name.endsWith('.md')) {
        const raw = fs.readFileSync(path.join(dir, e.name), 'utf8');
        const { meta, body } = parseFrontmatter(raw);
        const isIdx  = e.name === 'index.md' || e.name === '0.index.md';
        const slug   = isIdx ? urlPrefix : `${urlPrefix}/${cleanName(e.name).replace('.md', '')}`;
        const docPath = slug.startsWith('/docs') ? slug : `/docs${slug}`;
        const title  = meta.title || cleanName(e.name).replace('.md', '').replace(/-/g, ' ');
        const gname  = group || 'General';
        if (!groups[gname]) groups[gname] = [];
        groups[gname].push({ title, path: docPath });
        const rendered = optimizeContentImages(marked(body)
          .replace(/src="\/img\//g, 'src="/assets/images/')
          .replace(/src="\.\.\/img\//g, 'src="/assets/images/')
          .replace(/src="\/(preview[^"]*\.png)"/g, 'src="/assets/images/$1"'), title);
        allDocs.push({
          title,
          path: docPath,
          body: rendered,
          rawBody: body,
          description: meta.description || '',
          group: gname,
          lastmod: fileLastmod(path.join(dir, e.name))
        });
      }
    }
  }
  walkDir(docsRoot, '/docs', '');

  function buildSidebar(currentPath) {
    const activeClass   = 'block px-3 py-1 text-sm font-medium text-primary border-l border-primary';
    const inactiveClass = 'block px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';
    const introClass    = currentPath === '/docs'
      ? 'block px-3 py-1.5 text-sm font-semibold text-primary mb-3'
      : 'block px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-white mb-3 hover:text-primary';
    let sb = `<a href="/docs" class="${introClass}">Introduction</a>\n`;
    const guidesDocs   = groups.guides;
    const orderedGroups = [];
    if (guidesDocs) orderedGroups.push(['Guides', guidesDocs]);
    for (const [g, docs] of Object.entries(groups)) {
      if (g === 'General' || g === 'guides') continue;
      orderedGroups.push([g, docs]);
    }
    for (const [groupLabel, docs] of orderedGroups) {
      const isOpen = docs.some(d => currentPath === d.path || currentPath.startsWith(`${d.path}/`));
      sb += `<details class="mb-2 border-t border-gray-200 dark:border-gray-800 pt-2"${isOpen ? ' open' : ''}><summary class="text-xs font-bold uppercase tracking-widest text-primary-500 px-3 py-1.5 cursor-pointer select-none flex items-center gap-1"><span class="text-[0.6rem] text-gray-400 transition-transform">▸</span> ${groupLabel}</summary>`;
      sb += docs.map(d => `<a href="${d.path}" class="${currentPath === d.path ? activeClass : inactiveClass}">${d.title}</a>`).join('\n');
      sb += '</details>\n';
    }
    const generalDocs = groups.General;
    if (generalDocs) {
      for (const d of generalDocs) {
        if (d.path !== '/docs') sb += `<a href="${d.path}" class="${currentPath === d.path ? activeClass : inactiveClass}">${d.title}</a>\n`;
      }
    }
    return sb;
  }

  for (const doc of allDocs) {
    const alternates = { en: doc.path };
    const bcParts    = [{ name: 'Home', url: '/' }, { name: 'Docs', url: '/docs' }];
    if (doc.path !== '/docs') bcParts.push({ name: doc.title, url: doc.path });

    const vars = {
      ...makePageMeta('en', doc.path, alternates),
      title:       doc.title,
      description: doc.description || `Lotusia technical documentation: ${doc.title}`,
      sidebar:     buildSidebar(doc.path),
      body:        doc.body,
      breadcrumb:  breadcrumbHtml(bcParts),
      json_ld:     jsonLd(
        {
          '@context':    'https://schema.org',
          '@type':       'TechArticle',
          headline:      doc.title,
          description:   doc.description || `Lotusia technical documentation: ${doc.title}`,
          url:           abs(doc.path),
          articleSection: doc.group,
          isPartOf:      { '@type': 'WebSite', name: 'Lotusia', url: SITE_URL },
          author:        { '@type': 'Organization', name: 'Lotusia Stewardship' },
          publisher:     { '@type': 'Organization', name: 'Lotusia Stewardship', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` } },
          wordCount:     (doc.rawBody || '').split(/\s+/).filter(Boolean).length,
          inLanguage:    'en'
        },
        breadcrumbJsonLd(bcParts)
      ),
      head_extra: ''
    };
    writeOutFromPath(doc.path, renderPage('docs', vars));
    setSitemapEntry(sitemap, doc.path, alternates, doc.lastmod);
  }
}

function buildSocialPages(sitemap) {
  const activityPath = '/social/activity';
  const trendingPath = '/social/trending';
  const profilesPath = '/social/profiles';
  const lastmod = fileLastmod(path.join(SOCIAL_DIR, 'social-data.json')) || formatDateYMD(new Date());
  setSitemapEntry(sitemap, activityPath, { en: activityPath }, lastmod);
  setSitemapEntry(sitemap, trendingPath, { en: trendingPath }, lastmod);
  setSitemapEntry(sitemap, profilesPath, { en: profilesPath }, lastmod);
}

// ── Sitemap ──────────────────────────────────────────────────────────────────
function buildSitemap(sitemap) {
  const urls = [];
  for (const [, entry] of sitemap.entries()) {
    const alternates = entry.alternates || {};
    const enPath = alternates.en || Object.values(alternates)[0];
    if (!enPath) continue;
    const unique = new Set();
    const links = Object.entries(alternates)
      .filter(([lang, href]) => LANGS.includes(lang) && href)
      .filter(([, href]) => {
        if (unique.has(href)) return false;
        unique.add(href);
        return true;
      })
      .map(([lang, href]) => {
        const hreflang = I18N[lang].hreflang || lang;
        return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${abs(href)}"/>`;
      })
      .join('\n');
    const xDefault = alternates.en || Object.values(alternates)[0];
    const lastmod = entry.lastmod ? `\n    <lastmod>${entry.lastmod}</lastmod>` : '';
    urls.push(`  <url>\n    <loc>${abs(enPath)}</loc>${lastmod}\n${links}\n    <xhtml:link rel="alternate" hreflang="x-default" href="${abs(xDefault)}"/>\n  </url>`);
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${urls.join('\n')}\n</urlset>`;
}

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN
// ═══════════════════════════════════════════════════════════════════════════════
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

console.log('Building pages...');
const sitemap = new Map();

for (const lang of LANGS) {
  buildLanding('index.yml',     '/',         'index',    lang, sitemap);
  buildLanding('ecosystem.yml', '/ecosystem','ecosystem', lang, sitemap);
  buildLanding('tools.yml',     '/tools',    'tools',    lang, sitemap);
  buildLanding('founders.yml',  '/founders', 'founders', lang, sitemap);
  buildLanding('beta-services.yml', '/beta-services', 'beta_services', lang, sitemap);
  buildRoadmap(lang, sitemap);
  buildFaq(lang, sitemap);
}

buildBlog(sitemap);
buildDocs(sitemap);
buildSocialPages(sitemap);

// Copy assets
fs.cpSync(ASSETS, path.join(DIST, 'assets'), { recursive: true });

// robots.txt
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// _redirects
fs.writeFileSync(path.join(DIST, '_redirects'), [
].join('\n') + '\n');

// Tailwind safelist for runtime-generated worker HTML.
fs.writeFileSync(path.join(DIST, '_worker-safelist.html'), `
<div class="hidden">
  text-left rtl:text-right px-4 py-3.5 text-gray-900 dark:text-white font-semibold text-sm
  whitespace-nowrap px-4 py-4 text-gray-500 dark:text-gray-400
  min-w-full table-fixed divide-y divide-gray-300 dark:divide-gray-700
  rounded-md rounded-lg rounded-xl rounded-2xl border-l-2 border-primary-500
  ring-1 ring-inset ring-gray-300 dark:ring-gray-700
  bg-primary-500 hover:bg-primary-600 text-white dark:bg-primary-400 dark:text-gray-900
  bg-green-50 text-green-600 dark:bg-green-400/10 dark:text-green-400
  bg-lime-50 text-lime-600 dark:bg-lime-400/10 dark:text-lime-400
  bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-400
  text-sky-500 dark:text-sky-400 text-primary-500 dark:text-primary-400
  hover:text-primary-600 dark:hover:text-primary-300
  sticky top-[calc(var(--header-height)+2rem)] tabular-nums
  grid lg:grid-cols-[250px_1fr] gap-8 xl:grid-cols-3 sm:grid-cols-2
  bg-background text-foreground min-h-screen
</div>
`.trim() + '\n');

// _worker.js (Cloudflare Pages advanced mode) for host-preserving proxy routes
fs.writeFileSync(path.join(DIST, '_worker.js'), `'use strict';

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
  const upstreamUrl = new URL(\`\${targetBase}\${incomingUrl.pathname}\${incomingUrl.search}\`);
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

function navHtml(pathname) {
  const topNavClass = function(active) {
    return active
      ? 'text-sm/6 font-semibold flex items-center gap-1 text-primary underline underline-offset-4 decoration-primary'
      : 'text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary';
  };
  const moreButtonClass = function(active) {
    return active
      ? 'text-sm/6 font-semibold flex items-center gap-1 text-primary'
      : 'text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary';
  };
  const dropdownItemClass = function(active) {
    return active
      ? 'block px-3 py-2 text-sm text-primary font-semibold bg-gray-50 dark:bg-gray-800 rounded-lg'
      : 'block px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';
  };
  const mobileItemClass = function(active) {
    return active
      ? 'block px-3 py-2 text-sm font-semibold text-primary bg-gray-50 dark:bg-gray-800 rounded-lg'
      : 'block px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';
  };
  const isEcosystem = pathname === '/ecosystem';
  const isTools = pathname === '/tools';
  const isRoadmap = pathname === '/roadmap';
  const isFaq = pathname === '/faq';
  const isDocs = pathname === '/docs' || pathname.startsWith('/docs/');
  const isFounders = pathname === '/founders';
  const isBetaServices = pathname === '/beta-services';
  const isBlog = pathname === '/blog' || pathname.startsWith('/blog/');
  const isExplorer = pathname === '/explorer' || pathname.startsWith('/explorer/');
  const isSocial = pathname === '/social' || pathname.startsWith('/social/');
  const isMore = isFounders || isBetaServices || isBlog || isExplorer || isSocial;
  return '<header class="bg-background/75 backdrop-blur border-b border-gray-200 dark:border-gray-800 -mb-px sticky top-0 z-50">' +
    '<nav class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl flex items-center justify-between gap-3 h-[--header-height]">' +
    '<div class="lg:flex-1 flex items-center gap-1.5"><a href="/" class="flex-shrink-0 font-bold text-xl text-gray-900 dark:text-white flex items-end gap-1.5"><img src="/assets/images/logo.png" alt="Lotusia" class="h-8 w-auto"></a></div>' +
    '<div class="items-center gap-x-8 hidden lg:flex">' +
    '<a href="/ecosystem" class="' + topNavClass(isEcosystem) + '">Ecosystem</a>' +
    '<a href="/tools" class="' + topNavClass(isTools) + '">Tools</a>' +
    '<a href="/roadmap" class="' + topNavClass(isRoadmap) + '">Roadmap</a>' +
    '<a href="/faq" class="' + topNavClass(isFaq) + '">FAQ</a>' +
    '<a href="/docs" class="' + topNavClass(isDocs) + '">Docs</a>' +
    '<div class="relative" data-dropdown>' +
    '<button type="button" class="' + moreButtonClass(isMore) + '" data-dropdown-trigger aria-expanded="false">More <span class="text-xs">▾</span></button>' +
    '<div class="hidden absolute top-full right-0 mt-1 w-52 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-2 z-50" data-dropdown-menu>' +
    '<a href="/founders" class="' + dropdownItemClass(isFounders) + '">Founders</a>' +
    '<a href="/beta-services" class="' + dropdownItemClass(isBetaServices) + '">Beta services</a>' +
    '<a href="/blog" class="' + dropdownItemClass(isBlog) + '">Blog</a>' +
    '<a href="/explorer/blocks" class="' + dropdownItemClass(isExplorer) + '">Explorer</a>' +
    '<a href="/social/activity" class="' + dropdownItemClass(isSocial) + '">Social</a>' +
    '</div></div></div>' +
    '<div class="flex items-center justify-end lg:flex-1 gap-1.5">' +
    '<div class="relative hidden lg:block" data-dropdown>' +
    '<button type="button" class="text-sm/6 font-semibold flex items-center gap-1 text-gray-700 dark:text-gray-200 hover:text-primary whitespace-nowrap" data-dropdown-trigger aria-expanded="false">Language: 🇬🇧 EN <span class="text-xs">▾</span></button>' +
    '<div class="hidden absolute top-full right-0 mt-1 w-44 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl shadow-lg p-2 z-50" data-dropdown-menu>' +
    '<a href="/" class="block px-3 py-2 text-sm text-primary font-semibold rounded-lg whitespace-nowrap">🇬🇧 English (EN)</a>' +
    '</div></div>' +
    '<a href="https://t.me/givelotus" target="_blank" class="inline-flex items-center justify-center rounded-full p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800" title="Telegram">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>' +
    '</a>' +
    '<a href="https://github.com/LotusiaStewardship" target="_blank" class="inline-flex items-center justify-center rounded-full p-1.5 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800" title="GitHub">' +
    '<svg viewBox="0 0 24 24" fill="currentColor" class="h-5 w-5"><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12"/></svg>' +
    '</a>' +
    '<button onclick="var d=document.documentElement;d.classList.toggle(\\'dark\\');localStorage.setItem(\\'theme\\',d.classList.contains(\\'dark\\')?\\'dark\\':\\'light\\')" class="relative inline-flex flex-shrink-0 border-2 border-transparent h-4 w-7 rounded-full bg-gray-200 dark:bg-gray-700 cursor-pointer transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" title="Toggle dark mode">' +
    '<span class="pointer-events-none relative inline-block rounded-full bg-white dark:bg-gray-900 shadow h-3 w-3 transform transition-transform translate-x-0 dark:translate-x-3"></span>' +
    '</button>' +
    '</div>' +
    '<button class="lg:hidden inline-flex items-center justify-center rounded-full p-2 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800" onclick="document.getElementById(\\'mobile-nav\\').classList.toggle(\\'hidden\\')">' +
    '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/></svg>' +
    '</button></nav>' +
    '<div id="mobile-nav" class="hidden lg:hidden border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 space-y-1">' +
    '<a href="/ecosystem" class="' + mobileItemClass(isEcosystem) + '">Ecosystem</a>' +
    '<a href="/tools" class="' + mobileItemClass(isTools) + '">Tools</a>' +
    '<a href="/roadmap" class="' + mobileItemClass(isRoadmap) + '">Roadmap</a>' +
    '<a href="/faq" class="' + mobileItemClass(isFaq) + '">FAQ</a>' +
    '<a href="/docs" class="' + mobileItemClass(isDocs) + '">Docs</a>' +
    '<a href="/founders" class="' + mobileItemClass(isFounders) + '">Founders</a>' +
    '<a href="/beta-services" class="' + mobileItemClass(isBetaServices) + '">Beta services</a>' +
    '<a href="/blog" class="' + mobileItemClass(isBlog) + '">Blog</a>' +
    '<a href="/explorer/blocks" class="' + mobileItemClass(isExplorer) + '">Explorer</a>' +
    '<a href="/social/activity" class="' + mobileItemClass(isSocial) + '">Social</a>' +
    '</div></header>' +
    '<script>(function(){const d=Array.from(document.querySelectorAll(\\'[data-dropdown]\\'));if(!d.length)return;const c=(e)=>{const m=e.querySelector(\\'[data-dropdown-menu]\\');const t=e.querySelector(\\'[data-dropdown-trigger]\\');if(!m||!t)return;m.classList.add(\\'hidden\\');t.setAttribute(\\'aria-expanded\\',\\'false\\');};const o=(e)=>{const m=e.querySelector(\\'[data-dropdown-menu]\\');const t=e.querySelector(\\'[data-dropdown-trigger]\\');if(!m||!t)return;m.classList.remove(\\'hidden\\');t.setAttribute(\\'aria-expanded\\',\\'true\\');};d.forEach((e)=>{const t=e.querySelector(\\'[data-dropdown-trigger]\\');let x=null;if(!t)return;const s=()=>{clearTimeout(x);x=setTimeout(()=>c(e),140);};const k=()=>{clearTimeout(x);};e.addEventListener(\\'mouseenter\\',()=>{k();o(e);});e.addEventListener(\\'mouseleave\\',s);e.addEventListener(\\'focusin\\',()=>{k();o(e);});e.addEventListener(\\'focusout\\',()=>{if(!e.contains(document.activeElement))s();});t.addEventListener(\\'click\\',(a)=>{a.preventDefault();k();const p=t.getAttribute(\\'aria-expanded\\')===\\'true\\';d.forEach((y)=>{if(y!==e)c(y);});if(p)c(e);else o(e);});});document.addEventListener(\\'click\\',(e)=>{d.forEach((x)=>{if(!x.contains(e.target))c(x);});});})();</script>';
}

function pageShell(pathname, title, description, bodyHtml) {
  const breadcrumbs = '<div class="text-xs text-gray-500 dark:text-gray-400 mb-5"><a href="/" class="hover:text-primary">Home</a> <span class="mx-1">/</span> <span>' + esc(pathname.replace(/^\\//, '') || 'home') + '</span></div>';
  return '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">' +
    '<title>' + esc(title) + ' | Lotusia</title>' +
    '<meta name="description" content="' + esc(description) + '">' +
    '<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1">' +
    '<meta name="author" content="Lotusia Stewardship">' +
    '<meta property="og:title" content="' + esc(title) + '">' +
    '<meta property="og:description" content="' + esc(description) + '">' +
    '<meta property="og:type" content="website">' +
    '<meta property="og:url" content="https://lotusia.org' + esc(pathname) + '">' +
    '<meta property="og:site_name" content="Lotusia">' +
    '<meta name="twitter:card" content="summary_large_image">' +
    '<meta name="twitter:title" content="' + esc(title) + '">' +
    '<meta name="twitter:description" content="' + esc(description) + '">' +
    '<link rel="canonical" href="https://lotusia.org' + esc(pathname) + '">' +
    '<link rel="icon" href="/assets/favicon.ico">' +
    '<link rel="stylesheet" href="/assets/css/main.css"></head>' +
    '<body class="bg-background text-foreground min-h-screen">' +
    navHtml(pathname) +
    '<main class="min-h-[calc(100vh-var(--header-height))]"><div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8 sm:py-10">' +
    breadcrumbs +
    '<section>' +
    bodyHtml +
    '</section></div></main>' +
    '<footer class="relative"><div class="border-t border-gray-200 dark:border-gray-800"><div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl py-8 lg:py-4 lg:flex lg:items-center lg:justify-between lg:gap-x-3"><div class="lg:flex-1 flex items-center justify-center lg:justify-end gap-x-1.5 lg:order-3"></div><div class="mt-3 lg:mt-0 lg:order-2 flex items-center justify-center"></div><div class="flex items-center justify-center lg:justify-start lg:flex-1 gap-x-1.5 mt-3 lg:mt-0 lg:order-1"><p class="text-gray-500 dark:text-gray-400 text-sm">Copyright &copy; Lotusia 2021-2026. All rights reserved.</p></div></div></div></footer>' +
    '<script>(function(){var t=localStorage.getItem(\\'theme\\');if(t===\\'dark\\'||(t===null&&window.matchMedia(\\'(prefers-color-scheme:dark)\\').matches)){document.documentElement.classList.add(\\'dark\\');}})();</script>' +
    '</body></html>';
}

function renderTable(headers, rows, emptyMessage) {
  const head = headers.map(h => '<th class="text-left rtl:text-right px-4 py-3.5 text-gray-900 dark:text-white font-semibold text-sm">' + esc(h) + '</th>').join('');
  const body = rows.length
    ? rows.join('')
    : '<tr><td class="px-4 py-4 text-sm text-gray-500 dark:text-gray-400" colspan="' + headers.length + '">' + esc(emptyMessage) + '</td></tr>';
  return '<div class="relative overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">' +
    '<table class="min-w-full table-fixed divide-y divide-gray-300 dark:divide-gray-700">' +
    '<thead><tr>' + head + '</tr></thead>' +
    '<tbody class="divide-y divide-gray-200 dark:divide-gray-800">' + body + '</tbody></table></div>';
}

function iconSvg(name, cls) {
  if (name === 'network') return '<svg viewBox="0 0 24 24" class="' + cls + '" fill="currentColor"><path d="M4 3h7v7H4V3zm9 0h7v7h-7V3zM4 14h7v7H4v-7zm15 0h-6v2h4v3h-4v2h6v-7z"/></svg>';
  if (name === 'social') return '<svg viewBox="0 0 24 24" class="' + cls + '" fill="currentColor"><path d="M16 11a4 4 0 1 0-3.999-4A4 4 0 0 0 16 11zm-8 0a3 3 0 1 0-3-3 3 3 0 0 0 3 3zm8 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4zM8 13c-.29 0-.62.02-.97.05C5.5 13.2 2 13.97 2 16v3h4v-2c0-1.16.66-2.18 2-3.02V13z"/></svg>';
  if (name === 'chart') return '<svg viewBox="0 0 24 24" class="' + cls + '" fill="currentColor"><path d="M3 3h2v16h16v2H3V3zm6 10 3-3 3 2 4-5 2 1-5 7-3-2-3 3-1-1z"/></svg>';
  if (name === 'profile') return '<svg viewBox="0 0 24 24" class="' + cls + '" fill="currentColor"><path d="M12 12a5 5 0 1 0-5-5 5 5 0 0 0 5 5zm0 2c-4.42 0-8 2.01-8 4.5V21h16v-2.5c0-2.49-3.58-4.5-8-4.5z"/></svg>';
  if (name === 'x') return '<svg viewBox="0 0 24 24" class="' + cls + '" fill="currentColor"><path d="M18.9 2H22l-6.8 7.8L23 22h-6.2l-4.9-6.5L6.2 22H3l7.2-8.3L1 2h6.3l4.4 5.9L18.9 2z"/></svg>';
  if (name === 'up') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="m10 4 6 6h-4v6H8v-6H4l6-6z"/></svg>';
  if (name === 'down') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="M10 16 4 10h4V4h4v6h4l-6 6z"/></svg>';
  if (name === 'minus') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="M4 9h12v2H4z"/></svg>';
  if (name === 'external') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="M11 3h6v6h-2V6.41l-7.29 7.3-1.42-1.42 7.3-7.29H11V3z"/><path d="M5 5h4v2H7v8h8v-2h2v4H5V5z"/></svg>';
  if (name === 'prev') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="m12.7 4.3-1.4 1.4L7 10l4.3 4.3 1.4-1.4L9.8 10z"/></svg>';
  if (name === 'next') return '<svg viewBox="0 0 20 20" class="' + cls + '" fill="currentColor"><path d="m7.3 15.7 1.4-1.4L13 10 8.7 5.7 7.3 7.1 10.2 10z"/></svg>';
  return '<span class="' + cls + '"></span>';
}

function sideNavSection(title, iconName, items) {
  const links = items.map(i => {
    const cls = i.active
      ? 'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 border-l-2 border-primary-500'
      : 'group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 border-l-2 border-transparent';
    return '<a href="' + i.href + '" class="' + cls + '"><span class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600"></span>' + esc(i.label) + '</a>';
  }).join('');
  return '<div class="mb-6"><h3 class="px-3 mb-2 text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400 font-semibold flex items-center gap-2">' +
    iconSvg(iconName, 'h-4 w-4') + esc(title) + '</h3><div class="space-y-1">' + links + '</div></div>';
}

function legacyExplorerLayout(activeKey, contentHtml) {
  const network = sideNavSection('Network', 'network', [
    { label: 'Overview', href: '/explorer', active: activeKey === 'overview' },
    { label: 'Blocks', href: '/explorer/blocks', active: activeKey === 'blocks' }
  ]);
  const social = sideNavSection('Social Media', 'social', [
    { label: 'Latest', href: '/social/activity', active: activeKey === 'latest' },
    { label: 'Trending', href: '/social/trending', active: activeKey === 'trending' },
    { label: 'Profiles', href: '/social/profiles', active: activeKey === 'profiles' }
  ]);
  return '<div class="grid lg:grid-cols-[250px_1fr] gap-8">' +
    '<aside class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-3 h-fit sticky top-[calc(var(--header-height)+2rem)]">' + network + social + '</aside>' +
    '<section>' + contentHtml + '</section>' +
    '</div>';
}

function parsePageAndSize(url) {
  const pageRaw = Number(url.searchParams.get('page') || 1);
  const pageSizeRaw = Number(url.searchParams.get('pageSize') || 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
  const pageSize = Number.isFinite(pageSizeRaw) && pageSizeRaw > 0 ? Math.floor(pageSizeRaw) : 10;
  return { page, pageSize };
}

function compactStatCard(label, value, hint, icon) {
  return '<div class="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4 transition-colors hover:border-primary-200 dark:hover:border-primary-800">' +
    '<div class="flex items-start justify-between gap-3 mb-2"><div class="text-xs text-gray-500 dark:text-gray-400">' + esc(label) + '</div>' +
    '<span class="inline-flex items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-300 h-8 w-8">' + iconSvg(icon || 'chart', 'h-4 w-4') + '</span></div>' +
    '<div class="text-2xl font-bold tabular-nums text-gray-900 dark:text-white">' + esc(value) + '</div>' +
    (hint ? '<div class="text-xs text-gray-500 dark:text-gray-400 mt-1">' + esc(hint) + '</div>' : '') +
    '</div>';
}

function formatUtc(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n) || n <= 0) return '-';
  const d = new Date((String(value).length > 11 ? n : n * 1000));
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
    timeZone: 'UTC',
    timeZoneName: 'short'
  });
}

function formatXpiFromSats(sats) {
  const n = Number(sats || 0);
  if (!Number.isFinite(n)) return '0 XPI';
  const xpi = n / 1000000;
  const text = Number.isInteger(xpi) ? String(xpi) : xpi.toFixed(2);
  return text + ' XPI';
}

function voteRatio(positive, negative) {
  const p = num(positive);
  const n = num(negative);
  const total = p + n;
  if (total <= 0) return '0%';
  return ((p / total) * 100).toFixed(1) + '%';
}

function voteRatioPill(positive, negative) {
  const ratioText = voteRatio(positive, negative);
  const ratioValue = num(ratioText.replace('%', ''));
  const cls = ratioValue >= 90
    ? 'bg-green-50 text-green-600 dark:bg-green-400/10 dark:text-green-400'
    : ratioValue >= 50
    ? 'bg-lime-50 text-lime-600 dark:bg-lime-400/10 dark:text-lime-400'
    : 'bg-red-50 text-red-600 dark:bg-red-400/10 dark:text-red-400';
  return '<span class="inline-flex items-center rounded-md text-sm font-medium px-2 py-1 ' + cls + '">' + esc(ratioText) + ' Positive</span>';
}

function sectionHeader(icon, title, subtitle, badgeHtml) {
  return '<div class="mb-6 border-b border-gray-200 dark:border-gray-800 pb-4">' +
    '<div class="flex items-start gap-3">' +
    '<span class="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 dark:bg-primary-950/30 text-primary-600 dark:text-primary-300">' + iconSvg(icon, 'h-6 w-6') + '</span>' +
    '<div><div class="flex items-center gap-2"><h1 class="text-2xl font-bold text-gray-900 dark:text-white">' + esc(title) + '</h1>' + (badgeHtml || '') + '</div>' +
    '<p class="text-sm text-gray-500 dark:text-gray-400 mt-1">' + esc(subtitle) + '</p></div></div></div>';
}

function profileCellHtml(platform, profileId) {
  const handle = String(profileId || '');
  const initial = handle ? handle.charAt(0).toUpperCase() : '?';
  return '<div class="flex items-center gap-2">' +
    '<span class="inline-flex items-center justify-center rounded-full h-8 w-8 bg-primary-100 dark:bg-primary-900 text-primary-600 dark:text-primary-300 text-xs font-bold">' + esc(initial) + '</span>' +
    '<a class="font-semibold text-sm text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/social/' + esc(platform) + '/' + esc(profileId) + '">' + esc(handle) + '</a>' +
    iconSvg('x', 'h-4 w-4 text-sky-500 dark:text-sky-400') +
    '</div>';
}

function voteToneHtml(sentiment, sats) {
  if (sentiment === 'positive') return '<span class="flex items-center gap-1 text-green-500 dark:text-green-400">' + iconSvg('up', 'h-4 w-4') + esc(formatXpiFromSats(sats)) + '</span>';
  if (sentiment === 'negative') return '<span class="flex items-center gap-1 text-red-500 dark:text-red-400">' + iconSvg('down', 'h-4 w-4') + esc(formatXpiFromSats(sats)) + '</span>';
  return '<span class="flex items-center gap-1 text-gray-500 dark:text-gray-400">' + iconSvg('minus', 'h-4 w-4') + '0 XPI</span>';
}

function paginationHtml(basePath, page, pageSize, numPages) {
  const safePage = Math.max(1, Math.min(page, Math.max(1, num(numPages) || 1)));
  const totalPages = Math.max(1, num(numPages) || 1);
  const mk = function(targetPage, targetSize) {
    return basePath + '?page=' + targetPage + '&pageSize=' + targetSize;
  };
  const pageSizes = [10, 20, 30, 40];
  const selectOptions = pageSizes.map(function(size) {
    return '<option value="' + size + '"' + (size === pageSize ? ' selected' : '') + '>' + size + '</option>';
  }).join('');
  const selectControl = '<div class="relative w-20"><select onchange="window.location.href=\\'' + basePath + '?page=1&pageSize=\\'+this.value" class="relative block w-full appearance-none rounded-md border-0 py-1.5 pr-8 pl-3 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-900 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 focus:ring-2 focus:ring-primary-500">' + selectOptions + '</select></div>';
  const prevDisabled = safePage <= 1;
  const nextDisabled = safePage >= totalPages;
  const windowStart = Math.max(1, Math.min(safePage - 2, totalPages - 4));
  const windowEnd = Math.min(totalPages, windowStart + 4);
  const pageButtons = [];
  for (let p = windowStart; p <= windowEnd; p += 1) {
    if (p === safePage) pageButtons.push('<span class="inline-flex items-center justify-center min-w-[2rem] px-2 py-1.5 text-sm rounded-md bg-primary-500 text-white dark:bg-primary-400 dark:text-gray-900">' + p + '</span>');
    else pageButtons.push('<a href="' + mk(p, pageSize) + '" class="inline-flex items-center justify-center min-w-[2rem] px-2 py-1.5 text-sm rounded-md ring-1 ring-inset ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">' + p + '</a>');
  }
  const endCaps = (windowStart > 1 ? '<a href="' + mk(1, pageSize) + '" class="inline-flex items-center justify-center min-w-[2rem] px-2 py-1.5 text-sm rounded-md ring-1 ring-inset ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">1</a><span class="px-1 text-gray-400">…</span>' : '') +
    pageButtons.join('') +
    (windowEnd < totalPages ? '<span class="px-1 text-gray-400">…</span><a href="' + mk(totalPages, pageSize) + '" class="inline-flex items-center justify-center min-w-[2rem] px-2 py-1.5 text-sm rounded-md ring-1 ring-inset ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200">' + totalPages + '</a>' : '');
  const prevLink = prevDisabled
    ? '<span class="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-800">' + iconSvg('prev', 'h-4 w-4') + '</span>'
    : '<a class="inline-flex items-center justify-center rounded-md p-1.5 text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-900" href="' + mk(safePage - 1, pageSize) + '">' + iconSvg('prev', 'h-4 w-4') + '</a>';
  const nextLink = nextDisabled
    ? '<span class="inline-flex items-center justify-center rounded-md p-1.5 text-gray-400 ring-1 ring-inset ring-gray-200 dark:ring-gray-800">' + iconSvg('next', 'h-4 w-4') + '</span>'
    : '<a class="inline-flex items-center justify-center rounded-md p-1.5 text-gray-700 dark:text-gray-200 ring-1 ring-inset ring-gray-300 dark:ring-gray-700 bg-white dark:bg-gray-900" href="' + mk(safePage + 1, pageSize) + '">' + iconSvg('next', 'h-4 w-4') + '</a>';
  return '<div class="mt-4 flex items-center justify-between px-3 py-3.5 border-t border-gray-200 dark:border-gray-700">' +
    '<div class="flex items-center gap-2"><span class="text-sm text-gray-700 dark:text-gray-200">Rows per page:</span>' + selectControl + '</div>' +
    '<div class="flex items-center gap-3"><span class="text-sm text-gray-700 dark:text-gray-200">Page ' + safePage + ' of ' + totalPages + '</span><div class="flex items-center -space-x-px">' + prevLink + endCaps + nextLink + '</div></div>' +
    '</div>';
}

function formatNumber(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '0';
  return n.toLocaleString('en-US');
}

function formatBytes(value) {
  const n = Number(value || 0);
  if (!Number.isFinite(n)) return '-';
  return formatNumber(n) + ' B';
}

function shortHash(value) {
  const text = String(value || '');
  if (text.length <= 18) return text;
  return text.slice(0, 1) + '...' + text.slice(-16);
}

function parseExplorerBlockPath(pathname) {
  const m = pathname.match(/^\\/explorer\\/block\\/([^/]+)\\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseExplorerTxPath(pathname) {
  const m = pathname.match(/^\\/explorer\\/tx\\/([^/]+)\\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

function parseExplorerAddressPath(pathname) {
  const m = pathname.match(/^\\/explorer\\/address\\/([^/]+)\\/?$/);
  return m ? decodeURIComponent(m[1]) : null;
}

async function renderExplorerBlocksPage(url) {
  const params = parsePageAndSize(url);
  const payload = await fetchLegacyJson('/api/explorer/blocks', { page: params.page, pageSize: params.pageSize });
  const blocks = payload.blocks || [];
  const tipHeight = num(payload.tipHeight);
  const numPages = tipHeight > 0 ? Math.ceil(tipHeight / params.pageSize) : 1;
  const rows = blocks.map(block => {
    const info = block.blockInfo || {};
    const hash = info.hash || block.hash || '';
    const height = info.height || block.height || 0;
    const burn = info.numBurnedSats || block.sumBurnedSats || 0;
    const txCount = info.numTxs || (block.txs ? block.txs.length : 0);
    const size = info.blockSize || block.size || 0;
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber(height)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/block/' + esc(hash) + '">' + esc(shortHash(hash)) + '</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatUtc(info.timestamp)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber(txCount)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatBytes(size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/blocks?page=' + params.page + '&pageSize=' + params.pageSize;
  const bodyInner = sectionHeader('network', 'Blocks', 'Latest blocks in the blockchain. Refreshed every 5 seconds.') +
    renderTable(['Height', 'Hash', 'Timestamp', 'Burned', 'Transactions', 'Size'], rows, 'No blocks found.') +
    paginationHtml('/explorer/blocks', params.page, params.pageSize, numPages);
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, 'Blocks', 'Latest blocks in the Lotusia blockchain.', body);
}

async function renderExplorerOverviewPage() {
  const [overview, chainInfo, mempool] = await Promise.all([
    fetchLegacyJson('/api/explorer/overview'),
    fetchLegacyJson('/api/explorer/chain-info').catch(() => ({})),
    fetchLegacyJson('/api/explorer/mempool').catch(() => [])
  ]);
  const mining = overview.mininginfo || {};
  const peers = overview.peerinfo || [];
  const peerRows = peers.slice(0, 15).map(p => {
    const country = (p.geoip && p.geoip.countryCode) || '-';
    const addr = p.addr || '-';
    const version = p.subver || '-';
    const blocks = p.synced_headers ?? p.synced_blocks ?? '-';
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(country) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(addr) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(version) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber(blocks)) + '</td>' +
      '</tr>';
  });
  const tip = num(chainInfo.tipHeight || chainInfo.blocks || 0);
  const pending = Array.isArray(mempool) ? mempool.length : 0;
  const hashrate = num(mining.networkhashps || 0);
  const hashrateText = hashrate > 0 ? (hashrate / 1e9).toFixed(1) + ' GH/s' : '-';
  const diffText = num(mining.difficulty || 0) > 0 ? num(mining.difficulty).toFixed(1) : '-';
  const blockTime = num(mining.target || 0) > 0 ? (num(mining.target) / 60).toFixed(1) + ' minutes' : '-';
  const cards = '<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Connections', formatNumber(peers.length), 'Number of Lotus nodes connected to the Explorer', 'network') +
    compactStatCard('Blocks', formatNumber(tip), 'Total number of blocks in the blockchain', 'network') +
    compactStatCard('Pending Transactions', formatNumber(pending), 'Transactions waiting to be confirmed', 'chart') +
    compactStatCard('Hashrate', hashrateText, 'Estimated hashes computed per second', 'chart') +
    compactStatCard('Difficulty', diffText, 'Difficulty of the most recent block', 'chart') +
    compactStatCard('Avg. Block Time', blockTime, 'Calculated from latest chain target', 'chart') +
    '</div>';
  const mainnetBadge = '<span class="inline-flex items-center rounded-full bg-green-50 dark:bg-green-400/10 text-green-600 dark:text-green-400 text-xs font-medium px-2.5 py-0.5">Mainnet</span>';
  const bodyInner = sectionHeader('network', 'Network', 'Up-to-date information about the Lotusia blockchain network.', mainnetBadge) +
    cards +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Peer Info</h2>' +
    '<p class="text-gray-600 dark:text-gray-300 mb-4">List of Lotus nodes connected to the Explorer.</p>' +
    renderTable(['Country', 'Address', 'Version', 'Blocks'], peerRows, 'No peer data available.');
  const body = legacyExplorerLayout('overview', bodyInner);
  return pageShell('/explorer', 'Overview', 'Network overview for the Lotusia explorer.', body);
}

async function renderExplorerBlockDetailPage(url, hashOrHeight) {
  const payload = await fetchLegacyJson('/api/explorer/block/' + encodeURIComponent(hashOrHeight));
  const info = payload.blockInfo || {};
  const txs = payload.txs || [];
  const rows = txs.map(tx => {
    const burn = tx.sumBurnedSats || 0;
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(tx.txid) + '">' + esc(shortHash(tx.txid)) + '</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatUtc(tx.timeFirstSeen || info.timestamp)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.inputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.outputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatBytes(tx.size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/block/' + encodeURIComponent(hashOrHeight);
  const bodyInner = sectionHeader('network', 'Block Details', 'Detailed block metrics and transactions.', '<span class="inline-flex items-center rounded-full bg-green-50 dark:bg-green-400/10 text-green-600 dark:text-green-400 text-xs font-medium px-2.5 py-0.5">Mainnet</span>') +
    '<p class="text-sm text-gray-500 mb-6"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/blocks">#' + esc(formatNumber(info.height || hashOrHeight)) + '</a> · ' + esc(shortHash(info.hash || hashOrHeight)) + '</p>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Timestamp', formatUtc(info.timestamp), 'UTC', 'chart') +
    compactStatCard('Block Subsidy', formatXpiFromSats(info.reward || 0), 'New coins minted', 'chart') +
    compactStatCard('Mined By', payload.minedBy || '-', 'Miner address', 'profile') +
    compactStatCard('Block Size', formatBytes(info.blockSize), 'Serialized bytes', 'network') +
    compactStatCard('Transactions', formatNumber(info.numTxs || txs.length), 'Transactions in this block', 'network') +
    compactStatCard('Burned', formatXpiFromSats(info.numBurnedSats || 0), 'Total burned in block', 'down') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transactions</h2>' +
    renderTable(['Transaction ID', 'First Seen', 'Burned', 'Inputs', 'Outputs', 'Size'], rows, 'No transactions in this block.');
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, 'Block ' + (info.hash || hashOrHeight), 'Detailed information about a Lotusia block.', body);
}

async function renderExplorerTxDetailPage(url, txid) {
  const payload = await fetchLegacyJson('/api/explorer/tx/' + encodeURIComponent(txid));
  const block = payload.block || {};
  const inputs = payload.inputs || [];
  const outputs = payload.outputs || [];
  const inputsRows = inputs.map(function(input, idx) {
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">Input #' + (idx + 1) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(input.address || (input.isCoinbase ? 'Coinbase' : '-')) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(input.value || 0)) + '</td>' +
      '</tr>';
  });
  const outputsRows = outputs.map(function(output, idx) {
    const target = output.address
      ? '<a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 break-all" href="/explorer/address/' + esc(output.address) + '">' + esc(output.address) + '</a>'
      : (output.rankOutput ? 'RANK script output' : '-');
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">Output #' + (idx + 1) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + target + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(output.value || 0)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/tx/' + encodeURIComponent(txid);
  const statusBadge = '<span class="inline-flex rounded-full bg-green-50 dark:bg-green-400/10 text-green-600 dark:text-green-400 px-2.5 py-0.5 text-xs font-medium">Confirmed</span>' +
    (payload.isCoinbase ? ' <span class="inline-flex rounded-full bg-primary-50 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 px-2.5 py-0.5 text-xs font-medium">Coinbase</span>' : '');
  const bodyInner = sectionHeader('chart', 'Transaction Details', 'Inputs, outputs, and block confirmation details.', statusBadge) +
    '<p class="text-sm text-gray-500 mb-6">' + esc(shortHash(payload.txid || txid)) + '</p>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Time First Seen', formatUtc(payload.timeFirstSeen), 'When this tx first appeared', 'chart') +
    compactStatCard('Size', formatBytes(payload.size), 'Raw transaction size', 'network') +
    compactStatCard('Confirmations', formatNumber(payload.confirmations || 0), 'Current block confirmations', 'up') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Block Information</h2>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Transaction Confirmed', formatUtc(block.timestamp), 'Confirmation timestamp', 'up') +
    compactStatCard('Confirmations', formatNumber(payload.confirmations || 0), 'Network confirmations', 'up') +
    compactStatCard('Confirmed in Block', shortHash(block.hash || ''), 'View full block details', 'network') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Inputs</h2>' +
    renderTable(['Input', 'Source', 'Amount'], inputsRows, 'No inputs.') +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Outputs</h2>' +
    renderTable(['Output', 'Destination', 'Amount'], outputsRows, 'No outputs.');
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, 'Transaction ' + txid, 'Detailed information about a Lotusia transaction.', body);
}

async function renderExplorerAddressDetailPage(url, address) {
  const params = parsePageAndSize(url);
  const [details, balance] = await Promise.all([
    fetchLegacyJson('/api/explorer/address/' + encodeURIComponent(address), { page: params.page, pageSize: params.pageSize }),
    fetchLegacyJson('/api/explorer/address/' + encodeURIComponent(address) + '/balance')
  ]);
  const txs = (details.history && details.history.txs) || [];
  const numPages = (details.history && details.history.numPages) || 1;
  const rows = txs.map(tx => {
    const burn = tx.sumBurnedSats || 0;
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(tx.txid) + '">' + esc(shortHash(tx.txid)) + '</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatUtc((tx.block && tx.block.timestamp) || tx.timeFirstSeen)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.inputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.outputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatBytes(tx.size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/address/' + encodeURIComponent(address) + '?page=' + params.page + '&pageSize=' + params.pageSize;
  const bodyInner = sectionHeader('profile', 'Address Details', 'Address balance and transaction history on Lotusia mainnet.') +
    '<p class="text-sm text-gray-500 mb-6 break-all">' + esc(address) + '</p>' +
    '<div class="grid sm:grid-cols-2 gap-4 mb-8">' +
    compactStatCard('Balance', formatXpiFromSats(balance), 'Current wallet balance', 'up') +
    compactStatCard('Last Seen', formatUtc(details.lastSeen), 'Last activity timestamp', 'chart') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transaction History</h2>' +
    renderTable(['Transaction ID', 'First Seen', 'Burned', 'Inputs', 'Outputs', 'Size'], rows, 'No transactions for this address.') +
    paginationHtml('/explorer/address/' + encodeURIComponent(address), params.page, params.pageSize, numPages);
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, 'Address ' + address, 'Detailed information for a Lotusia address.', body);
}

function explorerErrorPage(pathname, message) {
  const body = '<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">Explorer Unavailable</h1>' +
    '<p class="text-gray-600 dark:text-gray-300 mb-6">Unable to load fresh explorer data for this route.</p>' +
    '<div class="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">' + esc(message) + '</div>';
  return pageShell(pathname, 'Explorer Unavailable', 'Unable to load explorer data.', body);
}

async function renderActivityPage(url) {
  const params = parsePageAndSize(url);
  const payload = await fetchSocialJson('/api/social/activity', { page: params.page, pageSize: params.pageSize });
  const rows = (payload.votes || []).map(v => {
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(v.txid) + '">' + esc((v.txid || '').slice(0, 12)) + '...</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatUtc(v.firstSeen)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + profileCellHtml(v.platform || 'twitter', v.profileId || '') + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + voteToneHtml(String(v.sentiment || 'neutral'), v.sats) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400"><a class="inline-flex items-center text-sky-500 dark:text-sky-400 hover:underline" target="_blank" rel="noopener noreferrer" href="https://x.com/' + esc(v.profileId) + '/status/' + esc(v.postId) + '">' + esc(v.postId) + iconSvg('external', 'ml-1 h-3.5 w-3.5 text-gray-400') + '</a></td>' +
      '</tr>';
  });
  const canonical = '/social/activity?page=' + params.page + '&pageSize=' + params.pageSize;
  const bodyInner = sectionHeader('chart', 'Vote Activity', 'Vote activity for all profiles across all platforms.') +
    renderTable(['Transaction ID', 'First Seen', 'Profile', 'Vote', 'Post ID'], rows, 'No recent activity.') +
    paginationHtml('/social/activity', params.page, params.pageSize, payload.numPages);
  const body = legacyExplorerLayout('latest', bodyInner);
  return pageShell(canonical, 'Latest Activity', 'Fresh social vote activity across profiles on Lotusia.', body);
}

async function renderTrendingPage() {
  const [profilesPayload, topProfiles, lowProfiles, topPosts, lowPosts] = await Promise.all([
    fetchSocialJson('/api/social/profiles', { page: 1, pageSize: 100 }),
    fetchSocialJson('/api/social/stats/profiles/top-ranked/today').catch(() => []),
    fetchSocialJson('/api/social/stats/profiles/lowest-ranked/today').catch(() => []),
    fetchSocialJson('/api/social/stats/posts/top-ranked/today').catch(() => []),
    fetchSocialJson('/api/social/stats/posts/lowest-ranked/today').catch(() => [])
  ]);
  const topSeed = Array.isArray(topProfiles) && topProfiles.length
    ? topProfiles
    : (profilesPayload.profiles || []).slice().sort((a, b) => num(b.ranking) - num(a.ranking)).slice(0, 10);
  const topRows = topSeed.map(function(p) {
    const platform = p.platform || p.provider || 'twitter';
    const profileId = p.profileId || p.id || p.handle || '';
    const ranking = p.ranking || p.rate || '0';
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + profileCellHtml(platform, profileId) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(ranking)) + '</td></tr>';
  });
  const lowRows = (Array.isArray(lowProfiles) ? lowProfiles : []).map(function(p) {
    const platform = p.platform || p.provider || 'twitter';
    const profileId = p.profileId || p.id || p.handle || '';
    const ranking = p.ranking || p.rate || '0';
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + profileCellHtml(platform, profileId) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(ranking)) + '</td></tr>';
  });
  const topPostRows = (Array.isArray(topPosts) ? topPosts : []).map(function(p) {
    const pid = p.profileId || p.profile || '';
    const post = p.postId || (p.post && p.post.id) || '';
    const ranking = p.ranking || p.rate || '0';
    return '<tr><td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(pid + '/' + post) + '</td><td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(ranking)) + '</td></tr>';
  });
  const lowPostRows = (Array.isArray(lowPosts) ? lowPosts : []).map(function(p) {
    const pid = p.profileId || p.profile || '';
    const post = p.postId || (p.post && p.post.id) || '';
    const ranking = p.ranking || p.rate || '0';
    return '<tr><td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(pid + '/' + post) + '</td><td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(ranking)) + '</td></tr>';
  });
  const bodyInner = sectionHeader('chart', 'Trending', 'Top and lowest ranked profiles and posts over today.') +
    '<div class="grid md:grid-cols-2 gap-6">' +
    '<section><h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Top Ranked Profiles</h2>' + renderTable(['Profile', 'Ranking'], topRows, 'No profile trend data.') + '</section>' +
    '<section><h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Lowest Ranked Profiles</h2>' + renderTable(['Profile', 'Ranking'], lowRows, 'No profile trend data.') + '</section>' +
    '<section><h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Top Ranked Posts</h2>' + renderTable(['Post', 'Ranking'], topPostRows, 'No post trend data.') + '</section>' +
    '<section><h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Lowest Ranked Posts</h2>' + renderTable(['Post', 'Ranking'], lowPostRows, 'No post trend data.') + '</section>' +
    '</div>';
  const body = legacyExplorerLayout('trending', bodyInner);
  return pageShell('/social/trending', 'Trending Profiles', 'Top ranked social profiles on Lotusia.', body);
}

async function renderProfilesPage(url) {
  const params = parsePageAndSize(url);
  const payload = await fetchSocialJson('/api/social/profiles', { page: params.page, pageSize: params.pageSize });
  const rows = (payload.profiles || []).map(function(p, idx) {
      const rank = ((params.page - 1) * params.pageSize) + idx + 1;
      return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + rank + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + profileCellHtml(p.platform, p.id) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(p.ranking)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + voteRatioPill(p.votesPositive, p.votesNegative) + '</td>' +
      '</tr>';
  });
  const canonical = '/social/profiles?page=' + params.page + '&pageSize=' + params.pageSize;
  const bodyInner = sectionHeader('profile', 'Profiles', 'Browse profiles on Lotusia Social.') +
    renderTable(['#', 'Profile', 'Ranking', 'Vote Ratio'], rows, 'No profiles found.') +
    paginationHtml('/social/profiles', params.page, params.pageSize, payload.numPages);
  const body = legacyExplorerLayout('profiles', bodyInner);
  return pageShell(canonical, 'Social Profiles', 'Public social profile rankings on Lotusia.', body);
}

async function renderProfilePage(url, platform, profileId) {
  const params = parsePageAndSize(url);
  const [profile, posts, votes] = await Promise.all([
    fetchSocialJson('/api/social/' + encodeURIComponent(platform) + '/' + encodeURIComponent(profileId)),
    fetchSocialJson('/api/social/' + encodeURIComponent(platform) + '/' + encodeURIComponent(profileId) + '/posts', { page: params.page, pageSize: params.pageSize }),
    fetchSocialJson('/api/social/' + encodeURIComponent(platform) + '/' + encodeURIComponent(profileId) + '/votes', { page: params.page, pageSize: params.pageSize })
  ]);

  const postsRows = (posts.posts || []).map(post => '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(post.id) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(post.ranking)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + voteRatioPill(post.votesPositive, post.votesNegative) + '</td>' +
      '</tr>');
  const votesRows = (votes.votes || []).map(v => '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(v.txid) + '">' + esc((v.txid || '').slice(0, 12)) + '...</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatUtc(v.timestamp)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + voteToneHtml(String(v.sentiment || 'neutral'), v.sats) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(v.sats)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm text-gray-500 dark:text-gray-400">' + esc((v.post && v.post.id) || '') + '</td>' +
      '</tr>');
  const profilePath = '/social/' + platform + '/' + profileId + '?page=' + params.page + '&pageSize=' + params.pageSize;
  const bodyInner = sectionHeader('profile', profileId, 'Live profile data from Nitro API (' + esc(platform) + ').') +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Ranking', formatXpiFromSats(profile.ranking), 'Current profile ranking', 'chart') +
    compactStatCard('Votes +', String(profile.votesPositive || 0), 'Positive votes', 'up') +
    compactStatCard('Votes -', String(profile.votesNegative || 0), 'Negative votes', 'down') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Posts</h2>' +
    renderTable(['Post ID', 'Ranking', 'Vote Ratio'], postsRows, 'No posts yet.') +
    paginationHtml('/social/' + esc(platform) + '/' + esc(profileId), params.page, params.pageSize, posts.numPages) +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Votes</h2>' +
    renderTable(['Transaction', 'Timestamp', 'Sentiment', 'Amount', 'Post ID'], votesRows, 'No votes yet.');
  const body = legacyExplorerLayout('profiles', bodyInner);
  return pageShell(profilePath, profileId + ' on ' + platform, 'Social profile details for ' + profileId + ' on ' + platform + '.', body);
}

function errorPage(pathname, message) {
  const body = '<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">Social Unavailable</h1>' +
    '<p class="text-gray-600 dark:text-gray-300 mb-6">Unable to load fresh social data for this route.</p>' +
    '<div class="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">' + esc(message) + '</div>';
  return pageShell(pathname, 'Social Unavailable', 'Unable to load social data.', body);
}

function parseProfilePath(pathname) {
  const m = pathname.match(/^\\/social\\/([^/]+)\\/([^/]+)\\/?$/);
  return m ? { platform: m[1], profileId: m[2] } : null;
}

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

`);

// sitemap.xml
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemap));

console.log(`\nDone. ${sitemap.size} canonical URLs × up to ${LANGS.length} languages.`);
