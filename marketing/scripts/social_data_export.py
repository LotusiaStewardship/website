#!/usr/bin/env python3
"""
Export social API payloads to build-consumable JSON.

Output:
  content/social/social-data.json
"""

from __future__ import annotations

import argparse
import json
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


SCRIPT_DIR = Path(__file__).resolve().parent
MARKETING_DIR = SCRIPT_DIR.parent
SOCIAL_DIR = MARKETING_DIR / "content" / "social"
DISCOVERY_FILE = SOCIAL_DIR / "discovery.json"
OUTPUT_FILE = SOCIAL_DIR / "social-data.json"


def get_json(url: str):
  req = Request(url, headers={"User-Agent": "lotusia-social-export/1.0"})
  try:
    with urlopen(req, timeout=20) as res:
      body = res.read().decode("utf-8")
      return json.loads(body)
  except (HTTPError, URLError, TimeoutError, json.JSONDecodeError):
    return None


def endpoint(base: str, path: str, query: dict | None = None) -> str:
  q = f"?{urlencode(query)}" if query else ""
  return f"{base.rstrip('/')}{path}{q}"


def main() -> None:
  parser = argparse.ArgumentParser(description="Export social API payloads to local JSON.")
  parser.add_argument("--api-base", default="https://lotusia.org", help="Host exposing /api/social endpoints")
  parser.add_argument("--profiles-page-size", type=int, default=200)
  parser.add_argument("--posts-page-size", type=int, default=20)
  parser.add_argument("--votes-page-size", type=int, default=20)
  args = parser.parse_args()

  SOCIAL_DIR.mkdir(parents=True, exist_ok=True)

  discovery = {"profiles": []}
  if DISCOVERY_FILE.exists():
    try:
      discovery = json.loads(DISCOVERY_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
      pass

  activity = get_json(endpoint(args.api_base, "/api/social/activity", {"page": 1, "pageSize": 100}))
  profiles_payload = get_json(endpoint(args.api_base, "/api/social/profiles", {"page": 1, "pageSize": args.profiles_page_size}))

  profiles = discovery.get("profiles") or []
  if profiles_payload and isinstance(profiles_payload.get("profiles"), list):
    for p in profiles_payload["profiles"]:
      platform = p.get("platform")
      pid = p.get("id")
      if platform and pid:
        profiles.append({"platform": platform, "profileId": pid, "source": "api"})

  dedup = {}
  for p in profiles:
    key = (p.get("platform"), p.get("profileId"))
    if key[0] and key[1]:
      dedup[key] = {"platform": key[0], "profileId": key[1]}

  profile_entries = []
  for p in sorted(dedup.values(), key=lambda x: (x["platform"], x["profileId"])):
    platform = p["platform"]
    pid = p["profileId"]
    profile = get_json(endpoint(args.api_base, f"/api/social/{platform}/{pid}"))
    posts = get_json(endpoint(args.api_base, f"/api/social/{platform}/{pid}/posts", {"page": 1, "pageSize": args.posts_page_size}))
    votes = get_json(endpoint(args.api_base, f"/api/social/{platform}/{pid}/votes", {"page": 1, "pageSize": args.votes_page_size}))
    profile_entries.append({
      "platform": platform,
      "profileId": pid,
      "profile": profile or {},
      "posts": posts or {"posts": [], "numPages": 0},
      "votes": votes or {"votes": [], "numPages": 0}
    })

  out = {
    "generatedAt": int(time.time()),
    "apiBase": args.api_base,
    "activity": activity or {"votes": [], "numPages": 0},
    "profiles": profiles_payload or {"profiles": [], "numPages": 0},
    "profilePages": profile_entries
  }
  OUTPUT_FILE.write_text(json.dumps(out, indent=2), encoding="utf-8")
  print(f"Wrote {OUTPUT_FILE}")


if __name__ == "__main__":
  main()
