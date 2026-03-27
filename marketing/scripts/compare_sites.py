#!/usr/bin/env python3
"""
Side-by-side comparison of lotusia.org vs lotusia.burnlotus.org using Selenium.
Captures screenshots, compares computed styles, and generates a diff report.
"""
import json
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'comparison_report')
os.makedirs(OUTPUT_DIR, exist_ok=True)

ORIGINAL = 'https://lotusia.org'
STATIC = 'https://lotusia.burnlotus.org'

PAGES = ['/', '/ecosystem', '/tools', '/roadmap', '/faq', '/blog', '/docs']

STYLE_PROPS = [
    'fontFamily', 'fontSize', 'fontWeight', 'color', 'backgroundColor',
    'lineHeight', 'letterSpacing', 'padding', 'margin', 'borderRadius',
    'display', 'gap', 'maxWidth', 'textAlign', 'borderColor', 'borderWidth',
    'boxShadow', 'opacity', 'textDecoration', 'justifyContent', 'alignItems',
]

SELECTORS = {
    'body': 'body',
    'header': 'header',
    'header_nav_container': 'header > div, header > nav',
    'h1': 'h1',
    'h2': 'h2',
    'hero_title': 'h1',
    'hero_desc': 'h1 + p, h1 ~ p',
    'first_section': 'main section, section',
    'primary_button': 'a[href*="ecosystem"], a[href*="tools"]',
    'nav_link': 'header a[href="/ecosystem"], header a[href="/tools"]',
    'footer': 'footer',
    'footer_text': 'footer p, footer span, footer div',
}

JS_EXTRACT_STYLES = """
var results = {};
var selectors = arguments[0];
var props = arguments[1];
for (var key in selectors) {
    var els = document.querySelectorAll(selectors[key]);
    if (els.length > 0) {
        var el = els[0];
        var cs = getComputedStyle(el);
        var styles = {};
        for (var i = 0; i < props.length; i++) {
            styles[props[i]] = cs[props[i]];
        }
        styles['_tag'] = el.tagName;
        styles['_class'] = el.className.substring(0, 200);
        styles['_text'] = el.textContent.substring(0, 100).trim();
        styles['_rect'] = JSON.stringify(el.getBoundingClientRect());
        results[key] = styles;
    }
}
return results;
"""

JS_PAGE_METRICS = """
var body = document.body;
var html = document.documentElement;
return {
    title: document.title,
    bodyFont: getComputedStyle(body).fontFamily,
    bodyColor: getComputedStyle(body).color,
    bodyBg: getComputedStyle(body).backgroundColor,
    bodyFontSize: getComputedStyle(body).fontSize,
    bodyLineHeight: getComputedStyle(body).lineHeight,
    headerHeight: getComputedStyle(document.querySelector('header')).height,
    numSections: document.querySelectorAll('section').length,
    numImages: document.querySelectorAll('img').length,
    numLinks: document.querySelectorAll('a').length,
    numButtons: document.querySelectorAll('button').length,
    hasDarkClass: html.classList.contains('dark'),
    cssVars: (function() {
        var root = getComputedStyle(html);
        var vars = {};
        var names = ['--color-primary-500','--color-primary-400','--color-gray-900',
                     '--color-gray-200','--ui-background','--ui-foreground','--header-height'];
        for (var i = 0; i < names.length; i++) {
            vars[names[i]] = root.getPropertyValue(names[i]).trim();
        }
        return vars;
    })(),
    iconCount: document.querySelectorAll('[class*="i-heroicons"], [class*="i-simple-icons"], [class*="i-mdi"], [class*="i-fluent"]').length,
    visibleIconCount: (function() {
        var icons = document.querySelectorAll('[class*="i-heroicons"], [class*="i-simple-icons"], [class*="i-mdi"], [class*="i-fluent"]');
        var visible = 0;
        for (var i = 0; i < icons.length; i++) {
            var rect = icons[i].getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) visible++;
        }
        return visible;
    })()
};
"""

opts = Options()
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')
opts.add_argument('--window-size=1440,900')

print('Launching Chrome...')
driver = webdriver.Chrome(options=opts)

report = []
report.append('# Lotusia.org vs Lotusia.burnlotus.org — Visual Comparison Report\n')
report.append(f'Generated: {time.strftime("%Y-%m-%d %H:%M:%S")}\n')

all_diffs = {}

for page in PAGES:
    page_name = page.strip('/') or 'homepage'
    report.append(f'\n## Page: {page_name} (`{page}`)\n')
    print(f'\n=== Comparing {page_name} ===')

    # Original
    print(f'  Loading original: {ORIGINAL}{page}')
    driver.get(f'{ORIGINAL}{page}')
    time.sleep(4)

    driver.save_screenshot(os.path.join(OUTPUT_DIR, f'orig_{page_name}.png'))
    orig_metrics = driver.execute_script(JS_PAGE_METRICS)
    orig_styles = driver.execute_script(JS_EXTRACT_STYLES, SELECTORS, STYLE_PROPS)

    # Static
    print(f'  Loading static: {STATIC}{page}')
    driver.get(f'{STATIC}{page}')
    time.sleep(3)

    driver.save_screenshot(os.path.join(OUTPUT_DIR, f'static_{page_name}.png'))
    static_metrics = driver.execute_script(JS_PAGE_METRICS)
    static_styles = driver.execute_script(JS_EXTRACT_STYLES, SELECTORS, STYLE_PROPS)

    # Compare metrics
    report.append('### Page Metrics\n')
    report.append('| Metric | Original | Static | Match? |')
    report.append('|--------|----------|--------|--------|')
    metric_keys = ['title', 'bodyFont', 'bodyColor', 'bodyBg', 'bodyFontSize',
                   'bodyLineHeight', 'headerHeight', 'numSections', 'numImages',
                   'numLinks', 'hasDarkClass', 'iconCount', 'visibleIconCount']
    page_diffs = []
    for k in metric_keys:
        ov = str(orig_metrics.get(k, 'N/A'))
        sv = str(static_metrics.get(k, 'N/A'))
        match = '✅' if ov == sv else '❌'
        if ov != sv:
            page_diffs.append(f'{k}: `{ov[:60]}` vs `{sv[:60]}`')
        report.append(f'| {k} | `{ov[:50]}` | `{sv[:50]}` | {match} |')

    # Compare CSS variables
    report.append('\n### CSS Variables\n')
    report.append('| Variable | Original | Static | Match? |')
    report.append('|----------|----------|--------|--------|')
    orig_vars = orig_metrics.get('cssVars', {})
    static_vars = static_metrics.get('cssVars', {})
    for var in sorted(set(list(orig_vars.keys()) + list(static_vars.keys()))):
        ov = orig_vars.get(var, 'N/A')
        sv = static_vars.get(var, 'N/A')
        match = '✅' if ov == sv else '❌'
        if ov != sv:
            page_diffs.append(f'CSS var {var}: `{ov}` vs `{sv}`')
        report.append(f'| `{var}` | `{ov}` | `{sv}` | {match} |')

    # Compare element styles
    report.append('\n### Element Styles\n')
    for sel_name in SELECTORS:
        orig_s = orig_styles.get(sel_name)
        static_s = static_styles.get(sel_name)
        if not orig_s and not static_s:
            continue
        if not orig_s:
            report.append(f'**{sel_name}**: ❌ Missing in original')
            continue
        if not static_s:
            report.append(f'**{sel_name}**: ❌ Missing in static')
            page_diffs.append(f'Element `{sel_name}` missing in static')
            continue

        diffs = []
        for prop in STYLE_PROPS:
            ov = orig_s.get(prop, '')
            sv = static_s.get(prop, '')
            if ov != sv:
                diffs.append(f'  - `{prop}`: `{ov}` → `{sv}`')

        if diffs:
            report.append(f'**{sel_name}** — `{orig_s.get("_tag","")}` — ❌ {len(diffs)} differences:')
            for d in diffs:
                report.append(d)
                page_diffs.append(f'{sel_name}.{d.strip().split(":")[0].strip("` -")}')
        else:
            report.append(f'**{sel_name}** — ✅ Match')

    all_diffs[page_name] = page_diffs
    report.append('')

# Summary
report.append('\n## Summary\n')
total_diffs = sum(len(v) for v in all_diffs.values())
report.append(f'**Total differences found: {total_diffs}**\n')
for page, diffs in all_diffs.items():
    status = '✅' if not diffs else f'❌ {len(diffs)} diffs'
    report.append(f'- **{page}**: {status}')
    if diffs:
        for d in diffs[:10]:
            report.append(f'  - {d}')
        if len(diffs) > 10:
            report.append(f'  - ... and {len(diffs)-10} more')

report_text = '\n'.join(report)
report_path = os.path.join(OUTPUT_DIR, 'comparison_report.md')
with open(report_path, 'w') as f:
    f.write(report_text)

print(f'\n=== REPORT SAVED ===')
print(f'{report_path}')
print(f'\nTotal differences: {total_diffs}')
for page, diffs in all_diffs.items():
    print(f'  {page}: {len(diffs)} diffs')

# Also dump raw data
with open(os.path.join(OUTPUT_DIR, 'raw_data.json'), 'w') as f:
    json.dump(all_diffs, f, indent=2)

driver.quit()
