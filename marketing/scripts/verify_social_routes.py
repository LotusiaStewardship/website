#!/usr/bin/env python3
"""
Verify social routes are crawlable and SEO/basic UI markers exist.
"""

from __future__ import annotations

import argparse
import sys
from urllib.error import URLError, HTTPError
from urllib.request import Request, urlopen


def fetch(url: str) -> tuple[int, str]:
  req = Request(url, headers={"User-Agent": "lotusia-social-verify/1.0"})
  try:
    with urlopen(req, timeout=20) as res:
      return res.status, res.read().decode("utf-8", errors="ignore")
  except HTTPError as e:
    return e.code, e.read().decode("utf-8", errors="ignore")
  except URLError as e:
    return 0, str(e)


def check_route(base_url: str, path: str, markers: list[str]) -> tuple[bool, str]:
  status, html = fetch(base_url.rstrip("/") + path)
  if status != 200:
    return False, f"{path}: status {status}"
  for m in markers:
    if m not in html:
      return False, f"{path}: missing marker '{m}'"
  if '<link rel="canonical"' not in html:
    return False, f"{path}: missing canonical link"
  return True, f"{path}: ok"


def main() -> None:
  parser = argparse.ArgumentParser(description="Verify social routes and SEO markers.")
  parser.add_argument("--base-url", default="https://lotusia.org")
  args = parser.parse_args()

  checks = [
    ("/social/activity", ["Latest Activity", "Fresh social vote activity", "Ecosystem", "Social"]),
    ("/social/trending", ["Trending Profiles", "Top ranked profiles", "Ecosystem", "Social"]),
    ("/social/profiles", ["Profiles", "Public social profiles", "Ecosystem", "Social"]),
    ("/social/twitter/travisakers", ["travisakers on twitter", "Live profile data from Nitro API.", "Recent posts", "Recent votes"])
  ]

  failures = []
  for path, markers in checks:
    ok, msg = check_route(args.base_url, path, markers)
    print(msg)
    if not ok:
      failures.append(msg)

  if failures:
    print("\nVerification failed:")
    for f in failures:
      print(" -", f)
    sys.exit(1)
  print("\nAll social route checks passed.")


if __name__ == "__main__":
  main()
