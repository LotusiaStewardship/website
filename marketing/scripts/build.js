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
  const isMore = isFounders || isBetaServices || isBlog;

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
    nav_m_cls_ecosystem: mobileItemClass(isEcosystem),
    nav_m_cls_tools:     mobileItemClass(isTools),
    nav_m_cls_roadmap:   mobileItemClass(isRoadmap),
    nav_m_cls_faq:       mobileItemClass(isFaq),
    nav_m_cls_docs:      mobileItemClass(isDocs),
    nav_m_cls_founders:  mobileItemClass(isFounders),
    nav_m_cls_beta_services: mobileItemClass(isBetaServices),
    nav_m_cls_blog:      mobileItemClass(isBlog),
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

// Copy assets
fs.cpSync(ASSETS, path.join(DIST, 'assets'), { recursive: true });

// robots.txt
fs.writeFileSync(path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`);

// _redirects
fs.writeFileSync(path.join(DIST, '_redirects'), [
  '/explorer https://explorer.lotusia.org 301',
  '/explorer/* https://explorer.lotusia.org/:splat 301',
  '/social/* https://legacy.lotusia.org/social/:splat 301',
  '/api/* https://legacy.lotusia.org/api/:splat 200'
].join('\n') + '\n');

// sitemap.xml
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(sitemap));

console.log(`\nDone. ${sitemap.size} canonical URLs × up to ${LANGS.length} languages.`);
