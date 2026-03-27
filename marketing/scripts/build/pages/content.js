'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');
const { marked } = require('marked');

function makeBlogDocsBuilders(ctx) {
  const {
    CONTENT,
    I18N,
    SITE_URL,
    LANGS,
    abs,
    optimizeContentImages,
    imgTag,
    makePageMeta,
    jsonLd,
    breadcrumbJsonLd,
    breadcrumbHtml,
    renderPage,
    writeOutFromPath,
    fileLastmod,
    setSitemapEntry,
    maxLastmod
  } = ctx;

  function parseFrontmatter(content) {
    const m = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    if (!m) return { meta: {}, body: content };
    return { meta: yaml.load(m[1]) || {}, body: m[2] };
  }

  function buildBlog(sitemap) {
    const blogDir = path.join(CONTENT, 'blog');
    const files = fs.readdirSync(blogDir).filter(f => f.endsWith('.md')).sort().reverse();
    const en = I18N.en;
    const posts = [];

    const alternatesForBlog = { en: '/blog' };
    let blogIndexLastmod = '';

    for (const file of files) {
      const raw = fs.readFileSync(path.join(blogDir, file), 'utf8');
      const { meta, body } = parseFrontmatter(raw);
      const slug = file.replace(/^\d+\./, '').replace('.md', '');
      const htmlBody = optimizeContentImages(marked(body).replace(/src="\/img\//g, 'src="/assets/images/'), meta.title || slug);
      const dateRaw = meta.date || '';
      const dateObj = dateRaw ? new Date(dateRaw) : null;
      const dateStr = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
      const dateIso = dateObj ? dateObj.toISOString().split('T')[0] : '';
      const ogImage = meta.image && meta.image.src ? `/assets/images/blog/${path.basename(meta.image.src)}` : '/assets/images/blog_0.jpg';
      const authorName = (meta.authors && meta.authors[0] && meta.authors[0].name) || meta.author || 'Lotusia Stewardship';
      const heroImage = ogImage !== '/assets/images/blog_0.jpg'
        ? imgTag(ogImage, `${meta.title || slug} hero image`, 'blog-hero-img', 'loading="lazy"')
        : '';
      const canonicalPath = `/blog/${slug}`;
      const alternatesPost = { en: canonicalPath };
      const wordCount = (body || '').split(/\s+/).filter(Boolean).length;
      const articleSection = (meta.badge && meta.badge.label) || 'Blog';

      const vars = {
        ...makePageMeta('en', canonicalPath, alternatesPost),
        title: meta.title || slug,
        description: meta.description || '',
        slug,
        og_image: ogImage,
        date: dateStr,
        date_iso: dateIso,
        author: authorName,
        body: heroImage + htmlBody,
        json_ld: jsonLd({
          '@context': 'https://schema.org',
          '@type': 'BlogPosting',
          headline: meta.title || slug,
          description: meta.description || '',
          url: abs(canonicalPath),
          image: abs(ogImage),
          datePublished: dateIso || undefined,
          dateModified: dateIso || undefined,
          wordCount,
          articleSection,
          author: { '@type': 'Person', name: authorName },
          publisher: { '@type': 'Organization', name: 'Lotusia Stewardship', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` } },
          inLanguage: 'en'
        }),
        head_extra: ''
      };
      writeOutFromPath(canonicalPath, renderPage('blog-post', vars));

      const authorAvatar = meta.authors && meta.authors[0] && meta.authors[0].avatar && meta.authors[0].avatar.src
        ? `/assets/images/${path.basename(meta.authors[0].avatar.src)}`
        : '';
      const badge = (meta.badge && meta.badge.label) || '';
      const cardDate = dateObj ? dateObj.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
      posts.push({ title: meta.title || slug, description: meta.description || '', slug, date: cardDate, image: ogImage, author: authorName, avatar: authorAvatar, badge, canonicalPath });
      const postLastmod = dateIso || fileLastmod(path.join(blogDir, file));
      setSitemapEntry(sitemap, canonicalPath, alternatesPost, postLastmod);
      blogIndexLastmod = maxLastmod(blogIndexLastmod, postLastmod);
    }

    const postsHtml = posts.map((p, idx) => {
      const isFirst = idx === 0;
      const avatarHtml = p.avatar
        ? `<div class="inline-flex flex-row-reverse justify-end"><span class="inline-flex items-center justify-center flex-shrink-0 rounded-full h-6 w-6 text-xs ring-2 ring-white dark:ring-gray-900 overflow-hidden">${imgTag(p.avatar, `${p.author} avatar`, 'h-full w-full object-cover')}</span></div>`
        : '';
      const badgeHtml = p.badge
        ? `<div class="mb-3"><span class="inline-flex items-center font-medium rounded-md text-xs px-2 py-1 bg-primary-500/10 text-primary-500">${p.badge}</span></div>`
        : '';
      const imgWrapCls = isFirst ? 'relative overflow-hidden w-full rounded-lg lg:col-span-2' : 'relative overflow-hidden w-full rounded-lg';
      const imgHtml = p.image
        ? `<div class="${imgWrapCls}">${imgTag(p.image, `${p.title} cover image`, `w-full ${isFirst ? 'h-auto' : 'h-48'} object-cover`, 'loading="lazy"')}</div>`
        : '';
      const wrapperCls = isFirst ? 'relative flex flex-col w-full gap-y-6 lg:col-span-3 lg:grid lg:grid-cols-5 lg:gap-8' : 'relative flex flex-col w-full gap-y-6';
      const textWrapCls = isFirst ? 'flex flex-col justify-between flex-1 lg:col-span-3' : 'flex flex-col justify-between flex-1';
      return `<article class="${wrapperCls}">${imgHtml}<div class="${textWrapCls}"><div class="flex-1"><a href="/blog/${p.slug}" class="absolute inset-0"><span class="sr-only">${p.title}</span></a>${badgeHtml}<h2 class="text-gray-900 dark:text-white text-xl font-semibold">${p.title}</h2><p class="text-base text-gray-500 dark:text-gray-400 mt-1">${p.description}</p></div><div class="relative flex items-center gap-x-3 mt-4">${avatarHtml}<time class="text-sm text-gray-500 font-medium">${p.date}</time></div></div></article>`;
    }).join('\n');

    const vars = {
      ...makePageMeta('en', '/blog', alternatesForBlog),
      title: en.pages.blog.title,
      og_title: en.pages.blog.og_title,
      description: en.pages.blog.description,
      og_image: '/assets/images/blog_0.jpg',
      hero_title: en.pages.blog.title,
      hero_description: en.pages.blog.description,
      blog_posts: postsHtml,
      json_ld: jsonLd({
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
    const allDocs = [];
    const groups = {};

    function cleanName(n) { return n.replace(/^\d+\./, ''); }
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
          const isIdx = e.name === 'index.md' || e.name === '0.index.md';
          const slug = isIdx ? urlPrefix : `${urlPrefix}/${cleanName(e.name).replace('.md', '')}`;
          const docPath = slug.startsWith('/docs') ? slug : `/docs${slug}`;
          const title = meta.title || cleanName(e.name).replace('.md', '').replace(/-/g, ' ');
          const gname = group || 'General';
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
      const activeClass = 'block px-3 py-1 text-sm font-medium text-primary border-l border-primary';
      const inactiveClass = 'block px-3 py-1 text-sm text-gray-600 dark:text-gray-400 hover:text-primary hover:bg-gray-50 dark:hover:bg-gray-800 rounded-lg';
      const introClass = currentPath === '/docs'
        ? 'block px-3 py-1.5 text-sm font-semibold text-primary mb-3'
        : 'block px-3 py-1.5 text-sm font-semibold text-gray-900 dark:text-white mb-3 hover:text-primary';
      let sb = `<a href="/docs" class="${introClass}">Introduction</a>\n`;
      const guidesDocs = groups.guides;
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
      const bcParts = [{ name: 'Home', url: '/' }, { name: 'Docs', url: '/docs' }];
      if (doc.path !== '/docs') bcParts.push({ name: doc.title, url: doc.path });
      const vars = {
        ...makePageMeta('en', doc.path, alternates),
        title: doc.title,
        description: doc.description || `Lotusia technical documentation: ${doc.title}`,
        sidebar: buildSidebar(doc.path),
        body: doc.body,
        breadcrumb: breadcrumbHtml(bcParts),
        json_ld: jsonLd(
          {
            '@context': 'https://schema.org',
            '@type': 'TechArticle',
            headline: doc.title,
            description: doc.description || `Lotusia technical documentation: ${doc.title}`,
            url: abs(doc.path),
            articleSection: doc.group,
            isPartOf: { '@type': 'WebSite', name: 'Lotusia', url: SITE_URL },
            author: { '@type': 'Organization', name: 'Lotusia Stewardship' },
            publisher: { '@type': 'Organization', name: 'Lotusia Stewardship', logo: { '@type': 'ImageObject', url: `${SITE_URL}/assets/images/logo.png` } },
            wordCount: (doc.rawBody || '').split(/\s+/).filter(Boolean).length,
            inLanguage: 'en'
          },
          breadcrumbJsonLd(bcParts)
        ),
        head_extra: ''
      };
      writeOutFromPath(doc.path, renderPage('docs', vars));
      setSitemapEntry(sitemap, doc.path, alternates, doc.lastmod);
    }
  }

  return { buildBlog, buildDocs };
}

module.exports = { makeBlogDocsBuilders };
