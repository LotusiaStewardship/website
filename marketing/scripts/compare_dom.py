#!/usr/bin/env python3
"""
DOM tree structure comparison between lotusia.org and lotusia.burnlotus.org.
Extracts the main content DOM tree (ignoring scripts/styles) and diffs them.
"""
import json
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'comparison_report')
os.makedirs(OUTPUT_DIR, exist_ok=True)

ORIGINAL = 'https://lotusia.org'
STATIC = 'https://lotusia.burnlotus.org'

PAGES = {
    'homepage': '/',
    'ecosystem': '/ecosystem',
    'tools': '/tools',
    'roadmap': '/roadmap',
    'faq': '/faq',
    'blog': '/blog',
    'docs': '/docs',
}

JS_DOM_TREE = """
function getTree(el, depth) {
    if (depth > 8) return null;
    var tag = el.tagName ? el.tagName.toLowerCase() : '';
    if (['script','style','noscript','link','meta','svg','path','br','hr','img'].includes(tag)) {
        if (tag === 'img') return {tag:'img', src: el.getAttribute('src') || '', alt: el.getAttribute('alt') || ''};
        if (tag === 'svg') return {tag:'svg'};
        return null;
    }
    var node = {tag: tag};
    var cls = (el.className && typeof el.className === 'string') ? el.className : '';
    if (cls) {
        var important = cls.split(' ').filter(function(c){
            return c.match(/^(flex|grid|gap|col-|row-|lg:|md:|sm:|hidden|block|inline|items-|justify-|max-w|mx-auto|px-|py-|pt-|pb-|mt-|mb-|text-|font-|border|rounded|bg-|w-|h-|min-h|relative|absolute|sticky|overflow)/);
        });
        if (important.length) node.layout = important.join(' ');
    }
    var href = el.getAttribute('href');
    if (href) node.href = href;
    var cs = getComputedStyle(el);
    node.display = cs.display;
    if (cs.display === 'grid') {
        node.gridCols = cs.gridTemplateColumns;
    }
    if (cs.display === 'flex' || cs.display === 'inline-flex') {
        node.flexDir = cs.flexDirection;
        node.flexWrap = cs.flexWrap;
    }
    var rect = el.getBoundingClientRect();
    node.w = Math.round(rect.width);
    node.h = Math.round(rect.height);
    var text = '';
    for (var i = 0; i < el.childNodes.length; i++) {
        if (el.childNodes[i].nodeType === 3) {
            text += el.childNodes[i].textContent.trim();
        }
    }
    if (text && text.length < 100) node.text = text;
    if (text && text.length >= 100) node.text = text.substring(0, 80) + '...';
    var children = [];
    for (var i = 0; i < el.children.length; i++) {
        var child = getTree(el.children[i], depth + 1);
        if (child) children.push(child);
    }
    if (children.length) node.children = children;
    return node;
}
var main = document.querySelector('main') || document.querySelector('#__nuxt > div > div:nth-child(2)') || document.body;
var header = document.querySelector('header');
var footer = document.querySelector('footer');
return {
    header: header ? getTree(header, 0) : null,
    main: getTree(main, 0),
    footer: footer ? getTree(footer, 0) : null,
    bodyClasses: document.body.className,
    htmlClasses: document.documentElement.className
};
"""

JS_SECTION_LAYOUT = """
var sections = [];
var containers = document.querySelectorAll('main > div, main > section, [class*="max-w"] > div');
for (var i = 0; i < Math.min(containers.length, 20); i++) {
    var el = containers[i];
    var cs = getComputedStyle(el);
    var rect = el.getBoundingClientRect();
    var info = {
        tag: el.tagName.toLowerCase(),
        display: cs.display,
        flexDir: cs.flexDirection,
        gridCols: cs.gridTemplateColumns,
        w: Math.round(rect.width),
        h: Math.round(rect.height),
        childCount: el.children.length,
        className: (el.className || '').substring(0, 150),
        text: el.textContent.substring(0, 60).trim().replace(/\\s+/g, ' ')
    };
    var childLayouts = [];
    for (var j = 0; j < Math.min(el.children.length, 10); j++) {
        var child = el.children[j];
        var ccs = getComputedStyle(child);
        var crect = child.getBoundingClientRect();
        childLayouts.push({
            tag: child.tagName.toLowerCase(),
            display: ccs.display,
            w: Math.round(crect.width),
            h: Math.round(crect.height),
            text: child.textContent.substring(0, 40).trim().replace(/\\s+/g, ' ')
        });
    }
    info.children = childLayouts;
    sections.push(info);
}
return sections;
"""

def tree_to_skeleton(node, indent=0):
    if not node:
        return ''
    lines = []
    prefix = '  ' * indent
    tag = node.get('tag', '?')
    dims = f"{node.get('w',0)}x{node.get('h',0)}"
    display = node.get('display', '')
    layout_info = []
    if display in ('flex', 'inline-flex'):
        layout_info.append(f"flex-{node.get('flexDir','row')}")
    if display == 'grid':
        layout_info.append(f"grid({node.get('gridCols','')})")
    if node.get('layout'):
        layout_info.append(node['layout'][:60])
    text = node.get('text', '')
    if text:
        layout_info.append(f'"{text[:40]}"')
    info = ' '.join(layout_info)
    lines.append(f"{prefix}<{tag}> [{dims}] {display} {info}")
    for child in node.get('children', []):
        lines.append(tree_to_skeleton(child, indent + 1))
    return '\n'.join(lines)


opts = Options()
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')
opts.add_argument('--window-size=1440,900')

print('Launching Chrome...')
driver = webdriver.Chrome(options=opts)

report = ['# DOM Structure Comparison\n']
report.append(f'Generated: {time.strftime("%Y-%m-%d %H:%M:%S")}\n')

for name, path in PAGES.items():
    print(f'\n=== {name} ===')
    report.append(f'\n## {name} (`{path}`)\n')

    # Original
    driver.get(f'{ORIGINAL}{path}')
    time.sleep(4)
    orig_tree = driver.execute_script(JS_DOM_TREE)
    orig_sections = driver.execute_script(JS_SECTION_LAYOUT)

    # Static
    driver.get(f'{STATIC}{path}')
    time.sleep(3)
    static_tree = driver.execute_script(JS_DOM_TREE)
    static_sections = driver.execute_script(JS_SECTION_LAYOUT)

    # Save raw data
    with open(os.path.join(OUTPUT_DIR, f'dom_{name}_orig.json'), 'w') as f:
        json.dump({'tree': orig_tree, 'sections': orig_sections}, f, indent=2)
    with open(os.path.join(OUTPUT_DIR, f'dom_{name}_static.json'), 'w') as f:
        json.dump({'tree': static_tree, 'sections': static_sections}, f, indent=2)

    # Generate skeleton views
    orig_skeleton = tree_to_skeleton(orig_tree.get('main'))
    static_skeleton = tree_to_skeleton(static_tree.get('main'))

    report.append('### Original DOM skeleton (main)\n')
    report.append('```')
    report.append(orig_skeleton[:3000])
    report.append('```\n')

    report.append('### Static DOM skeleton (main)\n')
    report.append('```')
    report.append(static_skeleton[:3000])
    report.append('```\n')

    # Section layout comparison
    report.append('### Section layouts\n')
    report.append('| # | Original | Static | Match? |')
    report.append('|---|----------|--------|--------|')

    max_sections = max(len(orig_sections), len(static_sections))
    for i in range(max_sections):
        orig_s = orig_sections[i] if i < len(orig_sections) else None
        static_s = static_sections[i] if i < len(static_sections) else None

        def fmt_section(s):
            if not s:
                return 'MISSING'
            d = s['display']
            txt = s['text'][:30]
            children = s['childCount']
            w = s['w']
            return f"`{d} {w}px {children}ch` {txt}"

        o_fmt = fmt_section(orig_s)
        s_fmt = fmt_section(static_s)

        match = '✅' if (orig_s and static_s and
                orig_s['display'] == static_s['display'] and
                orig_s['childCount'] == static_s['childCount'] and
                abs(orig_s['w'] - static_s['w']) < 50) else '❌'

        report.append(f'| {i} | {o_fmt} | {s_fmt} | {match} |')

    report.append('')

report_text = '\n'.join(report)
with open(os.path.join(OUTPUT_DIR, 'dom_comparison.md'), 'w') as f:
    f.write(report_text)

print(f'\n=== DOM COMPARISON SAVED ===')
print(os.path.join(OUTPUT_DIR, 'dom_comparison.md'))

driver.quit()
