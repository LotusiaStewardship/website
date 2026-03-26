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

function buildLanding(file, pagePath, pageType) {
  const data = readYaml(file);
  const tmpl = readTemplate('landing');
  const heroImg = data.hero?.image
    ? `<div class="hero-image"><img src="/assets/images/${path.basename(typeof data.hero.image === 'string' ? data.hero.image : data.hero.image.light || '')}" alt="${data.hero?.title || ''}"></div>`
    : '';
  const html = inject(tmpl, {
    title: data.ogTitle || data.title || '',
    og_title: data.ogTitle || data.title || '',
    description: data.description || '',
    path: pagePath,
    hero_title: data.hero?.title || data.title || '',
    hero_description: data.hero?.description || data.description || '',
    hero_links: renderLinks(data.hero?.links),
    hero_image: heroImg,
    sections: renderSections(data.sections, pageType),
    cta: data.cta ? `<section class="cta"><h2>${data.cta.title}</h2><p>${data.cta.description}</p>${renderLinks(data.hero?.links)}</section>` : '',
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
      const groups = (epoch.groups || []).map(g => {
        const tasks = (g.tasks || []).map(t => {
          const cls = t.done ? 'task task-done' : 'task';
          return `<div class="${cls}">${t.label}</div>`;
        }).join('');
        const links = renderLinks(g.links);
        return `<div class="roadmap-group"><div class="roadmap-group-title">${g.title}</div><div class="roadmap-group-desc">${g.description || ''}</div>${tasks}${links}</div>`;
      }).join('');
      return `<section class="roadmap-epoch"><h2 class="epoch-title">${epoch.title}</h2>${groups}</section>`;
    }).join('\n');
  }
  const html = inject(tmpl, {
    title: data.ogTitle || 'Roadmap',
    og_title: data.ogTitle || 'Roadmap',
    description: data.description || '',
    path: '/roadmap',
    hero_title: data.hero?.title || 'Roadmap',
    hero_description: data.hero?.description || data.description || '',
    hero_links: '',
    hero_image: data.hero?.ogImage ? `<div class="hero-image"><img src="/assets/images/${path.basename(data.hero.ogImage)}" alt="Roadmap"></div>` : '',
    sections: sectionsHtml,
    cta: '',
    head_extra: ''
  });
  writeOut('roadmap', html);
}

function buildFaq() {
  const data = readYaml('faq.yml');
  const tmpl = readTemplate('landing');
  let sectionsHtml = '';
  if (data.sections) {
    sectionsHtml = data.sections.map(s => {
      const features = renderFeatures(s.features);
      const links = renderLinks(s.links);
      let specsHtml = '';
      if (s.specs) {
        specsHtml = '<table class="specs-table"><thead><tr><th>Parameter</th><th>Value</th></tr></thead><tbody>' +
          s.specs.map(sp => `<tr><td>${sp.name}</td><td>${sp.value}</td></tr>`).join('') +
          '</tbody></table>';
      }
      return `<section class="faq-section"><div class="faq-group"><h2 class="faq-group-title">${s.title}</h2><p>${s.description || ''}</p>${features}${specsHtml}${links}</div></section>`;
    }).join('\n');
  }
  const html = inject(tmpl, {
    title: data.ogTitle || 'FAQ',
    og_title: data.ogTitle || 'FAQ',
    description: data.description || '',
    path: '/faq',
    hero_title: data.hero?.title || 'FAQ',
    hero_description: data.hero?.description || data.description || '',
    hero_links: renderLinks(data.links),
    hero_image: '',
    sections: sectionsHtml,
    cta: data.cta ? `<section class="cta"><h2>${data.cta.title}</h2><p>${data.cta.description}</p>${renderLinks(data.cta.links)}</section>` : '',
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
    const html = inject(tmpl, {
      title: meta.title || slug,
      description: meta.description || '',
      slug,
      og_image: meta.image?.src || '/assets/images/blog_0.jpg',
      date: meta.date || '',
      author: meta.author || 'Lotusia Stewardship',
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
    const html = inject(tmpl, {
      title: doc.title,
      description: doc.description,
      path: doc.path,
      sidebar,
      body: doc.body
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
