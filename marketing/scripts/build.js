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
  return '<div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">' + features.map(f =>
    `<div class="rounded-xl bg-gray-100/50 dark:bg-gray-800/50 p-6 border border-gray-200/50 dark:border-gray-700/50"><div class="font-semibold text-gray-900 dark:text-white mb-1">${f.name}</div><div class="text-sm text-gray-500 dark:text-gray-400 leading-6">${f.description}</div></div>`
  ).join('') + '</div>';
}

function renderQuotes(quotes) {
  if (!quotes || !quotes.length) return '';
  return quotes.map(q =>
    `<div class="rounded-xl bg-gray-100/50 dark:bg-gray-800/50 p-6 border border-gray-200/50 dark:border-gray-700/50 mb-4"><p class="text-gray-600 dark:text-gray-300 italic mb-3 leading-7">"${q.text}"</p><div class="flex items-center gap-3">` +
    (q.avatar ? `<img src="/assets/images/${path.basename(q.avatar)}" alt="${q.author}" class="w-10 h-10 rounded-full object-cover">` : '') +
    `<div><div class="font-semibold text-gray-900 dark:text-white text-sm">${q.author}</div><div class="text-xs text-gray-500 dark:text-gray-400">${q.title || ''}</div></div></div></div>`
  ).join('');
}

function renderLinks(links) {
  if (!links || !links.length) return '';
  return '<div class="mt-10 flex flex-wrap gap-x-6 gap-y-3">' + links.map(l => {
    const isPrimary = l.color === 'purple' || l.color === 'primary';
    const cls = isPrimary
      ? 'inline-flex items-center rounded-full font-medium text-sm px-4 py-2.5 shadow-sm bg-primary-500 text-white hover:bg-primary-600 transition-colors gap-x-2'
      : 'inline-flex items-center rounded-full font-medium text-sm px-4 py-2.5 shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors gap-x-2';
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
    if (pageType === 'founders') {
      const founderImg = i === 0 ? 'alexandre_guillioud.jpeg' : 'matthew_urgero.jpeg';
      image = `<img src="/assets/images/${founderImg}" alt="${s.title}" loading="lazy" style="border-radius:15%;" class="w-full max-w-sm">`;
    } else if (pageType === 'ecosystem') {
      const ecoImages = ['ecosystem_0_0.jpg', 'ecosystem_1_2.jpg', 'ecosystem_2_0.jpg', 'ecosystem_3_0.jpg'];
      if (!quotes && ecoImages[i]) {
        image = `<img src="/assets/images/${ecoImages[i]}" alt="${s.title}" loading="lazy" style="border-radius:15%;" class="w-full max-w-sm">`;
      }
    } else if (pageType === 'tools') {
      const toolImages = ['LotusQT_0.png', 'lotus-lib_1.jpeg', 'extension_1.jpeg', 'bigvase_1.jpeg'];
      if (toolImages[i]) {
        image = `<img src="/assets/images/${toolImages[i]}" alt="${s.title}" loading="lazy" style="border-radius:15%;" class="w-full max-w-sm">`;
      }
    } else if (!quotes) {
      image = `<img src="/assets/images/turtles_${imgIdx}.jpeg" alt="${s.title}" loading="lazy" style="border-radius:15%;" class="w-full max-w-sm">`;
    }
    const reverse = i % 2 === 1 ? ' lg:flex-row-reverse' : '';
    return `<div class="py-16 sm:py-24">
      <div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl gap-16 sm:gap-y-24 grid lg:grid-cols-2 lg:items-center${reverse}">
        <div>
          ${s.headline ? `<p class="text-xs font-semibold text-primary-500 uppercase tracking-widest mb-2">${s.headline}</p>` : ''}
          <h2 class="text-3xl font-bold tracking-tight text-gray-900 dark:text-white sm:text-4xl lg:text-5xl">${s.title}</h2>
          <p class="mt-6 text-lg/8 text-gray-600 dark:text-gray-300">${s.description}</p>
          ${quotes}${features}${links}
        </div>
        <div class="flex justify-center">${image}</div>
      </div>
    </div>`;
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
    ? `<img src="/assets/images/${path.basename(typeof data.hero.image === 'string' ? data.hero.image : data.hero.image.light || '')}" alt="${data.hero?.title || ''}" loading="lazy" style="border-radius:15%;" class="w-full max-w-md">`
    : '';
  const pageTitle = data.ogTitle || data.title || '';
  const isHome = pagePath === '/';
  const bc = isHome
    ? { html: '', ld: '' }
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
    cta: data.cta ? `<div class="max-w-3xl mx-auto py-16 sm:py-24 text-center px-4"><h2 class="text-3xl font-bold tracking-tight sm:text-4xl">${data.cta.title}</h2><p class="mt-6 text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">${data.cta.description}</p>${renderLinks(data.hero?.links)}</div>` : '',
    breadcrumb_html: isHome ? '' : `<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-4 text-sm text-gray-500">${bc.html}</div>`,
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
      const headline = epoch.headline ? `<p class="text-sm text-primary-500 font-medium mb-6">${epoch.headline}</p>` : '';
      const cards = (epoch.cards || []).map(card => {
        const checklist = (card.checklist || []).map(item => {
          const cls = item.complete ? 'task task-done' : 'task';
          return `<div class="${cls}">${item.label}</div>`;
        }).join('');
        const links = renderLinks(card.links);
        const statusColors = { complete: 'bg-emerald-500/10 text-emerald-500', ongoing: 'bg-amber-500/10 text-amber-500', planned: 'bg-primary-500/10 text-primary-500' };
        const statusBadge = card.status ? `<span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColors[card.status] || ''}">${card.status}</span>` : '';
        return `<div class="rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-4"><div class="font-semibold text-lg flex items-center gap-3 flex-wrap mb-2">${card.title} ${statusBadge}</div><div class="text-sm text-gray-600 dark:text-gray-300 mb-3 leading-7">${card.description || ''}</div>${checklist}${links}</div>`;
      }).join('');
      return `<div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 mb-16"><h2 class="text-2xl font-bold mb-1">${epoch.title}</h2>${headline}${cards}</div>`;
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
    breadcrumb_html: `<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-4 text-sm text-gray-500">${bc.html}</div>`,
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
    breadcrumb_html: `<div class="mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl pt-4 text-sm text-gray-500">${bc.html}</div>`,
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
    const htmlBody = marked(body).replace(/src="\/img\//g, 'src="/assets/images/');
    const tmpl = readTemplate('blog-post');
    const dateRaw = meta.date || '';
    const dateObj = dateRaw ? new Date(dateRaw) : null;
    const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const dateIso = dateObj ? dateObj.toISOString().split('T')[0] : '';
    const ogImage = meta.image?.src ? `/assets/images/blog/${path.basename(meta.image.src)}` : '/assets/images/blog_0.jpg';
    const authorName = meta.authors?.[0]?.name || meta.author || 'Lotusia Stewardship';
    const heroImage = ogImage !== '/assets/images/blog_0.jpg'
      ? `<img src="${ogImage}" alt="${meta.title || slug}" class="blog-hero-img" loading="lazy">`
      : '';
    const html = inject(tmpl, {
      title: meta.title || slug,
      description: meta.description || '',
      slug,
      og_image: ogImage,
      date: dateStr,
      date_iso: dateIso,
      author: authorName,
      body: heroImage + htmlBody
    });
    writeOut(`blog/${slug}`, html);
    const authorAvatar = meta.authors?.[0]?.avatar?.src ? `/assets/images/${path.basename(meta.authors[0].avatar.src)}` : '';
    const badge = meta.badge?.label || '';
    const cardDate = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    posts.push({ title: meta.title || slug, description: meta.description || '', slug, date: cardDate, image: ogImage, author: authorName, avatar: authorAvatar, badge });
  }

  const postsHtml = posts.map(p => {
    const imgHtml = p.image ? `<img src="${p.image}" alt="${p.title}" class="w-full h-48 object-cover" loading="lazy">` : '';
    const avatarHtml = p.avatar ? `<img src="${p.avatar}" alt="${p.author}" class="w-6 h-6 rounded-full object-cover">` : '';
    const badgeHtml = p.badge ? `<span class="text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary-500/10 text-primary-500 mb-2 inline-block">${p.badge}</span>` : '';
    return `<a href="/blog/${p.slug}" class="block rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden hover:border-primary-500/50 hover:-translate-y-0.5 transition-all group">${imgHtml}<div class="p-6">${badgeHtml}<h2 class="text-xl font-semibold group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors truncate">${p.title}</h2><p class="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-7 line-clamp-3">${p.description}</p><div class="flex items-center gap-2 mt-4">${avatarHtml}<span class="text-xs text-gray-500">${p.date}</span></div></div></a>`;
  }).join('\n');
  const tmpl = readTemplate('blog-index');
  const html = inject(tmpl, { blog_posts: postsHtml });
  writeOut('blog', html);
}

function buildDocs() {
  const docsRoot = path.join(CONTENT, 'docs');
  const tmpl = readTemplate('docs');
  const allDocs = [];
  const groups = {};

  function cleanName(name) { return name.replace(/^\d+\./, ''); }

  function walkDir(dir, urlPrefix, group) {
    const entries = fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.isDirectory()) {
        const dirName = cleanName(e.name);
        const newGroup = group ? `${group} / ${dirName}` : dirName;
        walkDir(path.join(dir, e.name), `${urlPrefix}/${dirName}`, newGroup);
      } else if (e.name.endsWith('.md')) {
        const raw = fs.readFileSync(path.join(dir, e.name), 'utf8');
        const { meta, body } = parseFrontmatter(raw);
        const isIndex = e.name === 'index.md' || e.name === '0.index.md';
        const slug = isIndex ? urlPrefix : `${urlPrefix}/${cleanName(e.name).replace('.md', '')}`;
        const docPath = slug.startsWith('/docs') ? slug : `/docs${slug}`;
        const title = meta.title || cleanName(e.name).replace('.md', '').replace(/-/g, ' ');
        const groupName = group || 'General';
        if (!groups[groupName]) groups[groupName] = [];
        groups[groupName].push({ title, path: docPath });
        const renderedBody = marked(body).replace(/src="\/img\//g, 'src="/assets/images/').replace(/src="\.\.\/img\//g, 'src="/assets/images/').replace(/src="\/(preview[^"]*\.png)"/g, 'src="/assets/images/$1"');
        allDocs.push({ title, path: docPath, body: renderedBody, description: meta.description || '', group: groupName });
      }
    }
  }
  walkDir(docsRoot, '/docs', '');

  let sidebar = '<a href="/docs" class="block px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-white mb-3 hover:text-primary">Introduction</a>\n';
  const guidesDocs = groups['guides'];
  if (guidesDocs) {
    sidebar += `<details class="mb-2 border-t border-gray-200 dark:border-gray-800 pt-2" open><summary class="text-xs font-bold uppercase tracking-widest text-primary-500 px-3 py-1.5 cursor-pointer select-none flex items-center gap-1"><span class="text-[0.6rem] text-gray-400 transition-transform">▸</span> Guides</summary>`;
    sidebar += guidesDocs.map(d => `<a href="${d.path}" class="block px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">${d.title}</a>`).join('\n');
    sidebar += '</details>\n';
  }
  for (const [group, docs] of Object.entries(groups)) {
    if (group === 'General' || group === 'guides') continue;
    sidebar += `<details class="mb-2 border-t border-gray-200 dark:border-gray-800 pt-2"><summary class="text-xs font-bold uppercase tracking-widest text-primary-500 px-3 py-1.5 cursor-pointer select-none flex items-center gap-1"><span class="text-[0.6rem] text-gray-400 transition-transform">▸</span> ${group}</summary>`;
    sidebar += docs.map(d => `<a href="${d.path}" class="block px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">${d.title}</a>`).join('\n');
    sidebar += '</details>\n';
  }
  const generalDocs = groups['General'];
  if (generalDocs) {
    for (const d of generalDocs) {
      if (d.path !== '/docs') sidebar += `<a href="${d.path}" class="block px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg">${d.title}</a>\n`;
    }
  }

  for (const doc of allDocs) {
    const bcParts = [{ name: 'Docs', url: '/docs' }];
    if (doc.path !== '/docs') bcParts.push({ name: doc.title, url: doc.path });
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
