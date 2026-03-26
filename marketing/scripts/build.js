const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const TEMPLATES = path.join(ROOT, 'templates');
const CONTENT = path.join(ROOT, 'content');
const ASSETS = path.join(ROOT, 'assets');

const header = fs.readFileSync(path.join(TEMPLATES, 'partials/header.html'), 'utf8');
const footer = fs.readFileSync(path.join(TEMPLATES, 'partials/footer.html'), 'utf8');

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES, name + '.html'), 'utf8');
}

function readYaml(file) {
  return yaml.load(fs.readFileSync(path.join(CONTENT, file), 'utf8'));
}

function inject(html, vars) {
  let out = html.replace('{{header}}', header).replace('{{footer}}', footer);
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v || '');
  }
  return out;
}

function writeOut(relPath, html) {
  const dir = path.join(DIST, relPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  console.log(`  ${relPath || '/'}`);
}

function renderFeatures(features) {
  if (!features || !features.length) return '';
  return '<div class="features">' + features.map(f =>
    `<div class="feature"><div class="feature-title">${f.name}</div><div class="feature-desc">${f.description}</div></div>`
  ).join('') + '</div>';
}

function renderQuotes(quotes) {
  if (!quotes || !quotes.length) return '';
  return quotes.map(q =>
    `<div class="quote"><p class="quote-text">"${q.text}"</p><div class="quote-author">` +
    (q.avatar ? `<img src="/assets/images/${path.basename(q.avatar)}" alt="${q.author}" class="quote-avatar">` : '') +
    `<div><div class="quote-name">${q.author}</div><div class="quote-role">${q.title || ''}</div></div></div></div>`
  ).join('');
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  return '<div class="hero-links">' + links.map(l => {
    const cls = l.color === 'purple' ? 'btn btn-primary' : 'btn btn-secondary';
    const tgt = l.target === '_blank' ? ' target="_blank"' : '';
    const href = l.to || '#';
    return `<a href="${href}" class="${cls}"${tgt}>${l.label}</a>`;
  }).join('') + '</div>';
}

function renderSections(sections, pageType) {
  if (!sections || !sections.length) return '';
  return sections.map((s, i) => {
    const quotes = renderQuotes(s.quotes);
    const features = renderFeatures(s.features);
    const links = renderLinks(s.links);
    const imgIdx = i + 1;
    let image = '';
    if (!quotes && pageType !== 'founders') {
      const candidates = [`turtles_${imgIdx}.jpeg`, `ecosystem_${imgIdx}_0.jpg`];
      image = `<div class="section-image"><img src="/assets/images/${candidates[0]}" alt="${s.title}"></div>`;
    }
    if (pageType === 'founders') {
      const founderImg = i === 0 ? 'alexandre_guillioud.jpeg' : 'matthew_urgero.jpeg';
      image = `<div class="section-image"><img src="/assets/images/${founderImg}" alt="${s.title}"></div>`;
    }
    return `<section class="landing-section">
      <div class="section-content">
        ${s.headline ? `<p class="section-headline">${s.headline}</p>` : ''}
        <h2>${s.title}</h2>
        <p>${s.description}</p>
        ${quotes}${features}${links}
      </div>
      ${image}
    </section>`;
  }).join('\n');
}

function breadcrumb(parts) {
  const items = [{ name: 'Home', url: '/' }, ...parts];
  const html = items.map((p, i) => i < items.length - 1
    ? `<a href="${p.url}">${p.name}</a>` : `<span>${p.name}</span>`
  ).join(' / ');
  const ld = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    'itemListElement': items.map((p, i) => ({
      '@type': 'ListItem', 'position': i + 1,
      'name': p.name, 'item': `https://lotusia.burnlotus.org${p.url}`
    }))
  };
  return { html, ld: `<script type="application/ld+json">${JSON.stringify(ld)}</script>` };
}

const SITE_URL = 'https://lotusia.burnlotus.org';
const ORG = {
  '@type': 'Organization', 'name': 'Lotusia Stewardship', 'url': SITE_URL,
  'logo': { '@type': 'ImageObject', 'url': `${SITE_URL}/assets/images/logo.png` },
  'foundingDate': '2021',
  'sameAs': ['https://github.com/LotusiaStewardship', 'https://t.me/givelotus', 'https://guillioud.com', 'https://lotusia.org']
};

function websiteJsonLd() {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebSite',
    'name': 'Lotusia', 'url': SITE_URL,
    'description': 'Ethical proof-of-work blockchain built to foster human relationships, build reciprocal culture, and bolster societal value production',
    'inLanguage': 'en', 'publisher': ORG,
    'potentialAction': { '@type': 'SearchAction', 'target': `${SITE_URL}/docs?q={search_term_string}`, 'query-input': 'required name=search_term_string' }
  })}</script>`;
}

function pageJsonLd(title, description, pagePath) {
  return `<script type="application/ld+json">${JSON.stringify({
    '@context': 'https://schema.org', '@type': 'WebPage',
    'name': title, 'description': description,
    'url': `${SITE_URL}${pagePath}`,
    'isPartOf': { '@type': 'WebSite', 'name': 'Lotusia', 'url': SITE_URL },
    'publisher': { '@type': 'Organization', 'name': 'Lotusia Stewardship', 'url': SITE_URL },
    'inLanguage': 'en'
  })}</script>`;
}

function buildLanding(file, pagePath, pageType) {
  const data = readYaml(file);
  const tmpl = readTemplate('landing');
  const imgFile = data.ogImage || data.hero?.image;
  const ogImg = imgFile ? `/assets/images/${path.basename(typeof imgFile === 'string' ? imgFile : imgFile.light || 'turtles_hero.jpeg')}` : '/assets/images/turtles_hero.jpeg';
  const heroImg = data.hero?.image
    ? `<div class="hero-image"><img src="/assets/images/${path.basename(typeof data.hero.image === 'string' ? data.hero.image : data.hero.image.light || '')}" alt="${data.hero?.title || ''}" loading="lazy"></div>`
    : '';
  const pageTitle = data.ogTitle || data.title || '';
  const isHome = pagePath === '/';
  const bc = isHome
    ? { html: '<span>Home</span>', ld: '' }
    : breadcrumb([{ name: pageTitle, url: pagePath }]);
  const jsonLd = isHome
    ? websiteJsonLd()
    : pageJsonLd(pageTitle, data.description || '', pagePath) + bc.ld;
  const html = inject(tmpl, {
    title: pageTitle,
    og_title: pageTitle,
    description: data.description || '',
    path: pagePath,
    og_image: ogImg,
    hero_title: data.hero?.title || data.title || '',
    hero_description: data.hero?.description || data.description || '',
    hero_links: renderLinks(data.hero?.links),
    hero_image: heroImg,
    sections: renderSections(data.sections, pageType),
    cta: data.cta ? `<section class="cta"><h2>${data.cta.title}</h2><p>${data.cta.description}</p>${renderLinks(data.hero?.links)}</section>` : '',
    breadcrumb: bc.html,
    json_ld: jsonLd,
    head_extra: ''
  });
  writeOut(pagePath === '/' ? '' : pagePath.slice(1), html);
}

function buildRoadmap() {
  const data = readYaml('roadmap.yml');
  const tmpl = readTemplate('landing');
  let sectionsHtml = '';
  if (data.sections) {
    sectionsHtml = data.sections.map(epoch => {
      const headline = epoch.headline ? `<p class="epoch-headline">${epoch.headline}</p>` : '';
      const cards = (epoch.cards || []).map(card => {
        const checklist = (card.checklist || []).map(item => {
          const cls = item.complete ? 'task task-done' : 'task';
          return `<div class="${cls}">${item.label}</div>`;
        }).join('');
        const links = renderLinks(card.links);
        const statusBadge = card.status ? `<span class="status-badge status-${card.status}">${card.status}</span>` : '';
        return `<div class="roadmap-card"><div class="roadmap-card-title">${card.title} ${statusBadge}</div><div class="roadmap-card-desc">${card.description || ''}</div>${checklist}${links}</div>`;
      }).join('');
      return `<section class="roadmap-epoch"><h2 class="epoch-title">${epoch.title}</h2>${headline}${cards}</section>`;
    }).join('\n');
  }
  const bc = breadcrumb([{ name: 'Roadmap', url: '/roadmap' }]);
  const jsonLd = pageJsonLd('Roadmap', data.description || '', '/roadmap') + bc.ld;
  const html = inject(tmpl, {
    title: data.ogTitle || 'Roadmap',
    og_title: data.ogTitle || 'Roadmap',
    description: data.description || '',
    path: '/roadmap',
    og_image: '/assets/images/roadmap_0.jpg',
    hero_title: data.hero?.title || 'Roadmap',
    hero_description: data.hero?.description || data.description || '',
    hero_links: '',
    hero_image: data.hero?.ogImage ? `<div class="hero-image"><img src="/assets/images/${path.basename(data.hero.ogImage)}" alt="Roadmap" loading="lazy"></div>` : '',
    sections: sectionsHtml,
    cta: '',
    breadcrumb: bc.html,
    json_ld: jsonLd,
    head_extra: ''
  });
  writeOut('roadmap', html);
}

function renderTable(tableData) {
  if (!tableData || !tableData.columns || !tableData.rows) return '';
  const headers = tableData.columns.map(c => `<th>${c.label || c.key}</th>`).join('');
  const rows = tableData.rows.map(r => {
    const cells = tableData.columns.map(c => `<td>${r[c.key] || ''}</td>`).join('');
    return `<tr>${cells}</tr>`;
  }).join('');
  return `<table class="specs-table"><thead><tr>${headers}</tr></thead><tbody>${rows}</tbody></table>`;
}

function buildFaq() {
  const data = readYaml('faq.yml');
  const tmpl = readTemplate('landing');
  let sectionsHtml = '';

  if (data.questions) {
    const qHtml = data.questions.map(q => {
      let extra = '';
      if (q.note) extra += `<p class="faq-note">${q.note}</p>`;
      if (q.table) extra += renderTable(q.table);
      if (q.links) extra += `<div class="faq-links">${q.links.map(l => `<a href="${l.to}" class="btn btn-sm btn-secondary"${l.target ? ` target="${l.target}"` : ''}>${l.label}</a>`).join(' ')}</div>`;
      return `<details class="faq-item"><summary>${q.text}</summary><div class="faq-answer"><p>${q.answer}</p>${extra}</div></details>`;
    }).join('\n');
    sectionsHtml += `<section class="faq-section"><div class="faq-group"><h2 class="faq-group-title">Frequently Asked Questions</h2>${qHtml}</div></section>`;
  }

  if (data.technical) {
    let techHtml = '';
    if (data.technical.questions) {
      techHtml += data.technical.questions.map(q => {
        let extra = q.note ? `<p class="faq-note">${q.note}</p>` : '';
        return `<details class="faq-item"><summary>${q.text}</summary><div class="faq-answer"><p>${q.answer}</p>${extra}</div></details>`;
      }).join('\n');
    }
    if (data.technical.sections) {
      techHtml += data.technical.sections.map(s =>
        `<div class="specs-group"><h3>${s.title}</h3>${renderTable(s.table)}</div>`
      ).join('\n');
    }
    sectionsHtml += `<section class="faq-section"><div class="faq-group"><h2 class="faq-group-title">${data.technical.title || 'Technical Specifications'}</h2><p>${data.technical.description || ''}</p>${techHtml}</div></section>`;
  }
  const bc = breadcrumb([{ name: 'FAQ', url: '/faq' }]);
  const jsonLd = pageJsonLd('FAQ', data.description || '', '/faq') + bc.ld;
  const html = inject(tmpl, {
    title: data.ogTitle || 'FAQ',
    og_title: data.ogTitle || 'FAQ',
    description: data.description || '',
    path: '/faq',
    og_image: '/assets/images/turtles_hero.jpeg',
    hero_title: data.hero?.title || 'FAQ',
    hero_description: data.hero?.description || data.description || '',
    hero_links: renderLinks(data.links),
    hero_image: '',
    sections: sectionsHtml,
    cta: data.cta ? `<section class="cta"><h2>${data.cta.title}</h2><p>${data.cta.description}</p>${renderLinks(data.cta.links)}</section>` : '',
    breadcrumb: bc.html,
    json_ld: jsonLd,
    head_extra: ''
  });
  writeOut('faq', html);
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return { meta: {}, body: content };
  return { meta: yaml.load(match[1]) || {}, body: match[2] };
}

function buildBlog() {
  const blogDir = path.join(CONTENT, 'blog');
  const mds = fs.readdirSync(blogDir).filter(f => f.endsWith('.md')).sort().reverse();
  const posts = [];

  for (const file of mds) {
    const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
    const { meta, body } = parseFrontmatter(raw);
    const slug = file.replace(/^\d+\./, '').replace('.md', '');
    const htmlBody = marked(body);
    const tmpl = readTemplate('blog-post');
    const dateStr = meta.date || '';
    const dateIso = dateStr ? new Date(dateStr).toISOString().split('T')[0] : '';
    const ogImage = meta.image?.src ? `/assets/images/blog/${path.basename(meta.image.src)}` : '/assets/images/blog_0.jpg';
    const authorName = meta.authors?.[0]?.name || meta.author || 'Lotusia Stewardship';
    const html = inject(tmpl, {
      title: meta.title || slug,
      description: meta.description || '',
      slug,
      og_image: ogImage,
      date: dateStr,
      date_iso: dateIso,
      author: authorName,
      body: htmlBody
    });
    writeOut(`blog/${slug}`, html);
    posts.push({ title: meta.title || slug, description: meta.description || '', slug, date: meta.date || '' });
  }

  const postsHtml = posts.map(p =>
    `<a href="/blog/${p.slug}" class="blog-card"><h2>${p.title}</h2><p>${p.description}</p><div class="blog-date">${p.date}</div></a>`
  ).join('\n');
  const tmpl = readTemplate('blog-index');
  const html = inject(tmpl, { blog_posts: postsHtml });
  writeOut('blog', html);
}

function buildDocs() {
  const docsRoot = path.join(CONTENT, 'docs');
  const tmpl = readTemplate('docs');
  const allDocs = [];

  function walkDir(dir, urlPrefix) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        walkDir(path.join(dir, e.name), `${urlPrefix}/${e.name.replace(/^\d+\./, '')}`);
      } else if (e.name.endsWith('.md')) {
        const raw = fs.readFileSync(path.join(dir, e.name), 'utf8');
        const { meta, body } = parseFrontmatter(raw);
        const slug = e.name === 'index.md' || e.name === '0.index.md'
          ? urlPrefix || '/docs'
          : `${urlPrefix}/${e.name.replace(/^\d+\./, '').replace('.md', '')}`;
        const docPath = slug.startsWith('/docs') ? slug : `/docs${slug}`;
        allDocs.push({ title: meta.title || e.name.replace('.md', ''), path: docPath, body: marked(body), description: meta.description || '' });
      }
    }
  }
  walkDir(docsRoot, '/docs');

  const sidebar = allDocs.map(d =>
    `<a href="${d.path}">${d.title}</a>`
  ).join('\n');

  for (const doc of allDocs) {
    const pathParts = doc.path.split('/').filter(Boolean);
    const bcParts = [{ name: 'Docs', url: '/docs' }];
    if (pathParts.length > 1) {
      bcParts.push({ name: doc.title, url: doc.path });
    }
    const bc = breadcrumb(bcParts);
    const html = inject(tmpl, {
      title: doc.title,
      description: doc.description || `Lotusia technical documentation: ${doc.title}`,
      path: doc.path,
      sidebar,
      body: doc.body,
      breadcrumb: bc.html
    });
    const outPath = doc.path === '/docs' ? 'docs' : doc.path.slice(1);
    writeOut(outPath, html);
  }
}

function buildSitemap(pages) {
  const urls = pages.map(p => `  <url><loc>https://lotusia.burnlotus.org${p}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;
}

// Clean and rebuild
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

console.log('Building pages...');
buildLanding('index.yml', '/', 'index');
buildLanding('ecosystem.yml', '/ecosystem', 'ecosystem');
buildLanding('tools.yml', '/tools', 'tools');
buildLanding('founders.yml', '/founders', 'founders');
buildRoadmap();
buildFaq();
buildBlog();
buildDocs();

// Copy assets
fs.cpSync(ASSETS, path.join(DIST, 'assets'), { recursive: true });

// Robots.txt
fs.writeFileSync(path.join(DIST, 'robots.txt'), 'User-agent: *\nAllow: /\n\nSitemap: https://lotusia.burnlotus.org/sitemap.xml\n');

// _redirects for dynamic routes (Cloudflare Pages)
fs.writeFileSync(path.join(DIST, '_redirects'), [
  '/explorer https://explorer.lotusia.org 301',
  '/explorer/* https://explorer.lotusia.org/explorer/:splat 301',
  '/social/* https://lotusia.org/social/:splat 301',
  '/api/* https://lotusia.org/api/:splat 200',
].join('\n') + '\n');

// Sitemap
const allPages = [];
function walkDist(dir, prefix) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) walkDist(path.join(dir, e.name), `${prefix}/${e.name}`);
    else if (e.name === 'index.html') allPages.push(prefix || '/');
  }
}
walkDist(DIST, '');
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), buildSitemap(allPages));

console.log(`Built ${allPages.length} pages. Sitemap has ${allPages.length} URLs.`);
