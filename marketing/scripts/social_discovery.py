#!/usr/bin/env python3
"""
Headed Selenium crawler for social routes.

Outputs:
  - content/social/discovery.json
  - content/social/discovery-dom/*.html
"""

from __future__ import annotations

import argparse
import json
import re
import time
from pathlib import Path
from urllib.parse import parse_qs, urljoin, urlparse

from selenium import webdriver
from selenium.webdriver.common.by import By


SCRIPT_DIR = Path(__file__).resolve().parent
MARKETING_DIR = SCRIPT_DIR.parent
SOCIAL_DIR = MARKETING_DIR / "content" / "social"
DOM_DIR = SOCIAL_DIR / "discovery-dom"


def slugify_path(path: str) -> str:
  cleaned = path.strip("/") or "root"
  return re.sub(r"[^a-zA-Z0-9._-]+", "_", cleaned)


def collect_profile_links(driver) -> list[dict]:
  profiles = []
  anchors = driver.find_elements(By.CSS_SELECTOR, "a[href*='/social/']")
  seen = set()
  for a in anchors:
    href = (a.get_attribute("href") or "").strip()
    text = (a.text or "").strip()
    if not href:
      continue
    parsed = urlparse(href)
    m = re.match(r"^/social/([^/]+)/([^/]+)/?$", parsed.path)
    if not m:
      continue
    platform, profile_id = m.group(1), m.group(2)
    key = (platform, profile_id)
    if key in seen:
      continue
    seen.add(key)
    profiles.append({
      "platform": platform,
      "profileId": profile_id,
      "sourceText": text,
      "sourceUrl": href
    })
  return profiles


def route_label(path: str, query: str = "") -> str:
  label = slugify_path(path)
  if not query:
    return label
  q = parse_qs(query)
  page = (q.get("page") or [""])[0]
  page_size = (q.get("pageSize") or [""])[0]
  suffix = []
  if page:
    suffix.append(f"page_{page}")
  if page_size:
    suffix.append(f"size_{page_size}")
  return f"{label}__{'_'.join(suffix)}" if suffix else label


def save_dom_snapshot(driver, current_url: str) -> str:
  parsed = urlparse(current_url)
  filename = route_label(parsed.path, parsed.query) + ".html"
  dom_path = DOM_DIR / filename
  dom_path.write_text(driver.page_source, encoding="utf-8")
  return str(dom_path.relative_to(MARKETING_DIR))


def open_and_capture(driver, base_url: str, path: str, wait_seconds: float):
  url = urljoin(base_url, path)
  driver.get(url)
  time.sleep(wait_seconds)
  current = driver.current_url
  title = driver.title
  dom_snapshot = save_dom_snapshot(driver, current)
  return {
    "path": path,
    "url": current,
    "title": title,
    "domSnapshot": dom_snapshot
  }


def main() -> None:
  parser = argparse.ArgumentParser(description="Discover social routes and DOM snapshots.")
  parser.add_argument("--base-url", default="https://legacy.lotusia.org", help="Base host to crawl")
  parser.add_argument("--wait-seconds", type=float, default=2.0, help="Wait after each load")
  parser.add_argument("--sample-profiles", type=int, default=50, help="How many profile routes to snapshot")
  parser.add_argument("--capture-pages", type=int, default=3, help="How many paginated states to capture for activity/profiles")
  args = parser.parse_args()

  SOCIAL_DIR.mkdir(parents=True, exist_ok=True)
  DOM_DIR.mkdir(parents=True, exist_ok=True)

  options = webdriver.ChromeOptions()
  # User asked for non-headless exploration.
  driver = webdriver.Chrome(options=options)

  try:
    seed_paths = ["/social/activity", "/social/trending", "/social/profiles"]
    route_entries = []
    all_profiles = []

    for path in seed_paths:
      route_entries.append(open_and_capture(driver, args.base_url, path, args.wait_seconds))

      if path in ("/social/activity", "/social/profiles"):
        all_profiles.extend(collect_profile_links(driver))

    for page in range(2, args.capture_pages + 1):
      route_entries.append(open_and_capture(driver, args.base_url, f"/social/activity?page={page}", args.wait_seconds))
      all_profiles.extend(collect_profile_links(driver))
      route_entries.append(open_and_capture(driver, args.base_url, f"/social/profiles?page={page}", args.wait_seconds))
      all_profiles.extend(collect_profile_links(driver))

    dedup = {}
    for p in all_profiles:
      dedup[(p["platform"], p["profileId"])] = p

    sampled_profiles = sorted(dedup.values(), key=lambda x: (x["platform"], x["profileId"]))[: args.sample_profiles]
    for p in sampled_profiles:
      path = f"/social/{p['platform']}/{p['profileId']}"
      route_entries.append(open_and_capture(driver, args.base_url, path, args.wait_seconds))

    manifest = {
      "generatedAt": int(time.time()),
      "baseUrl": args.base_url,
      "routes": route_entries,
      "profiles": sorted(dedup.values(), key=lambda x: (x["platform"], x["profileId"])),
      "sampledProfiles": sampled_profiles
    }
    (SOCIAL_DIR / "discovery.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote {SOCIAL_DIR / 'discovery.json'}")
  finally:
    driver.quit()


if __name__ == "__main__":
  main()
