#!/usr/bin/env python3
"""
Extract all computed CSS from lotusia.org using Selenium + Chrome (non-headless).
Saves raw CSS variables, computed styles, and full stylesheet content.
"""
import json
import os
import time
from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By

OUTPUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'extracted_css')
os.makedirs(OUTPUT_DIR, exist_ok=True)

PAGES = {
    'homepage': 'https://lotusia.org/',
    'ecosystem': 'https://lotusia.org/ecosystem',
    'tools': 'https://lotusia.org/tools',
    'roadmap': 'https://lotusia.org/roadmap',
    'faq': 'https://lotusia.org/faq',
    'blog': 'https://lotusia.org/blog',
    'docs': 'https://lotusia.org/docs',
}

opts = Options()
# Non-headless as requested
opts.add_argument('--no-sandbox')
opts.add_argument('--disable-dev-shm-usage')
opts.add_argument('--window-size=1920,1080')

print('Launching Chrome (non-headless)...')
driver = webdriver.Chrome(options=opts)

try:
    # 1. Extract CSS variables from :root
    print('\n=== Extracting CSS variables from homepage ===')
    driver.get('https://lotusia.org/')
    time.sleep(5)

    # Get all inline <style> blocks
    style_blocks = driver.execute_script("""
        var styles = [];
        document.querySelectorAll('style').forEach(function(s) {
            styles.push({
                id: s.id || '',
                content: s.textContent
            });
        });
        return styles;
    """)

    with open(os.path.join(OUTPUT_DIR, 'style_blocks.json'), 'w') as f:
        json.dump(style_blocks, f, indent=2)
    print(f'  Saved {len(style_blocks)} style blocks')

    # Save the important ones separately
    for block in style_blocks:
        if block['id']:
            fname = f"style_{block['id']}.css"
            with open(os.path.join(OUTPUT_DIR, fname), 'w') as f:
                f.write(block['content'])
            print(f'  Saved {fname} ({len(block["content"])} bytes)')

    # 2. Extract computed CSS variables from :root
    css_vars = driver.execute_script("""
        var root = getComputedStyle(document.documentElement);
        var vars = {};
        for (var i = 0; i < document.styleSheets.length; i++) {
            try {
                var rules = document.styleSheets[i].cssRules;
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    if (rule.selectorText === ':root' || rule.selectorText === '.dark') {
                        for (var k = 0; k < rule.style.length; k++) {
                            var prop = rule.style[k];
                            if (prop.startsWith('--')) {
                                vars[prop] = rule.style.getPropertyValue(prop).trim();
                            }
                        }
                    }
                }
            } catch(e) {}
        }
        return vars;
    """)

    with open(os.path.join(OUTPUT_DIR, 'css_variables.json'), 'w') as f:
        json.dump(css_vars, f, indent=2)
    print(f'  Saved {len(css_vars)} CSS variables')

    # 3. Extract all external stylesheets
    links = driver.execute_script("""
        var links = [];
        document.querySelectorAll('link[rel="stylesheet"]').forEach(function(l) {
            links.push(l.href);
        });
        return links;
    """)

    for i, href in enumerate(links):
        print(f'  External stylesheet: {href[:80]}...')

    # 4. Extract full rendered HTML for each page
    for name, url in PAGES.items():
        print(f'\n=== Extracting {name}: {url} ===')
        driver.get(url)
        time.sleep(3)

        html = driver.page_source
        with open(os.path.join(OUTPUT_DIR, f'page_{name}.html'), 'w') as f:
            f.write(html)
        print(f'  Saved page_{name}.html ({len(html)} bytes)')

        # Extract key element computed styles
        key_styles = driver.execute_script("""
            var results = {};
            var selectors = {
                'body': 'body',
                'header': 'header',
                'h1': 'h1',
                'h2': 'h2',
                'nav_link': 'a[href="/ecosystem"]',
                'button_primary': 'a[class*="bg-primary"], a[class*="bg-purple"]',
                'feature_dt': 'dt',
                'feature_dd': 'dd',
                'footer': 'footer'
            };
            for (var key in selectors) {
                var el = document.querySelector(selectors[key]);
                if (el) {
                    var cs = getComputedStyle(el);
                    results[key] = {
                        fontFamily: cs.fontFamily,
                        fontSize: cs.fontSize,
                        fontWeight: cs.fontWeight,
                        color: cs.color,
                        backgroundColor: cs.backgroundColor,
                        lineHeight: cs.lineHeight,
                        letterSpacing: cs.letterSpacing,
                        padding: cs.padding,
                        margin: cs.margin,
                        borderRadius: cs.borderRadius
                    };
                }
            }
            return results;
        """)

        with open(os.path.join(OUTPUT_DIR, f'computed_{name}.json'), 'w') as f:
            json.dump(key_styles, f, indent=2)
        print(f'  Saved computed styles for {len(key_styles)} elements')

    # 5. Extract the full Tailwind CSS (the big inline style block)
    print('\n=== Extracting full Tailwind CSS ===')
    driver.get('https://lotusia.org/')
    time.sleep(3)

    tailwind_css = driver.execute_script("""
        var biggest = '';
        document.querySelectorAll('style').forEach(function(s) {
            if (s.textContent.length > biggest.length) {
                biggest = s.textContent;
            }
        });
        return biggest;
    """)

    with open(os.path.join(OUTPUT_DIR, 'tailwind_full.css'), 'w') as f:
        f.write(tailwind_css)
    print(f'  Saved tailwind_full.css ({len(tailwind_css)} bytes)')

    # 6. Extract icon CSS classes
    icon_css = driver.execute_script("""
        var icons = {};
        for (var i = 0; i < document.styleSheets.length; i++) {
            try {
                var rules = document.styleSheets[i].cssRules;
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    if (rule.selectorText && rule.selectorText.startsWith('.i-')) {
                        icons[rule.selectorText] = rule.cssText;
                    }
                }
            } catch(e) {}
        }
        return icons;
    """)

    with open(os.path.join(OUTPUT_DIR, 'icon_classes.json'), 'w') as f:
        json.dump(icon_css, f, indent=2)
    print(f'  Saved {len(icon_css)} icon class definitions')

    print('\n=== EXTRACTION COMPLETE ===')
    print(f'All files saved to: {os.path.abspath(OUTPUT_DIR)}')
    print('Files:')
    for f in sorted(os.listdir(OUTPUT_DIR)):
        size = os.path.getsize(os.path.join(OUTPUT_DIR, f))
        print(f'  {f} ({size:,} bytes)')

finally:
    driver.quit()
