#!/usr/bin/env python3
import json
import re
import time
from collections import defaultdict
from pathlib import Path
from urllib.parse import parse_qs, urlencode, urlparse
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from selenium import webdriver
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.common.by import By
from selenium.common.exceptions import TimeoutException
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.support.ui import WebDriverWait


BASE_URL = "https://explorer.lotusia.org"
OUTPUT_DIR = Path("comparison_report/explorer_api_inventory")


def normalize_path(pathname: str) -> str:
    parts = [p for p in pathname.split("/") if p]
    normalized = []
    for part in parts:
        if re.fullmatch(r"[0-9a-fA-F]{24,}", part):
            normalized.append(":hex")
        elif re.fullmatch(r"[A-Za-z0-9_-]{24,}", part):
            normalized.append(":id")
        elif re.fullmatch(r"\d{4,}", part):
            normalized.append(":num")
        else:
            normalized.append(part)
    return "/" + "/".join(normalized)


def infer_schema(value, depth=0):
    if depth > 4:
        return "..."
    if value is None:
        return "null"
    if isinstance(value, bool):
        return "boolean"
    if isinstance(value, int):
        return "integer"
    if isinstance(value, float):
        return "number"
    if isinstance(value, str):
        return "string"
    if isinstance(value, list):
        if not value:
            return {"type": "array", "items": "unknown"}
        return {"type": "array", "items": infer_schema(value[0], depth + 1)}
    if isinstance(value, dict):
        out = {}
        for k, v in list(value.items())[:50]:
            out[k] = infer_schema(v, depth + 1)
        return out
    return type(value).__name__


def parse_json_body(body_text: str):
    try:
        return json.loads(body_text)
    except Exception:
        return None


def fetch_text(url: str) -> str:
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=20) as resp:
        return resp.read().decode("utf-8", errors="replace")


def fetch_json(url: str):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*"})
    with urlopen(req, timeout=25) as resp:
        body = resp.read().decode("utf-8", errors="replace")
        return resp.status, body, parse_json_body(body)


def fetch_any(url: str):
    req = Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json,text/plain,*/*"})
    try:
        with urlopen(req, timeout=25) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            return resp.status, body, parse_json_body(body)
    except HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        return e.code, body, parse_json_body(body)
    except URLError:
        return None, "", None


def is_404_like(driver):
    title = (driver.title or "").lower()
    url = (driver.current_url or "").lower()
    body = (driver.page_source or "")[:3000].lower()
    return (
        "404" in title
        or "/404" in url
        or "not found" in title
        or "page not found" in body
        or "404" in body
    )


def safe_get_response_body(driver, request_id):
    try:
        return driver.execute_cdp_cmd("Network.getResponseBody", {"requestId": request_id})
    except Exception:
        return None


def drain_logs(driver, pending, captured):
    logs = driver.get_log("performance")
    for entry in logs:
        try:
            msg = json.loads(entry["message"])["message"]
        except Exception:
            continue
        method = msg.get("method")
        params = msg.get("params", {})
        if method == "Network.responseReceived":
            response = params.get("response", {})
            url = response.get("url", "")
            parsed = urlparse(url)
            mime = response.get("mimeType", "")
            is_api_like = "/api/" in parsed.path or "json" in mime.lower()
            if not is_api_like:
                continue
            pending[params.get("requestId")] = {
                "url": url,
                "status": response.get("status"),
                "mimeType": mime,
                "method": params.get("type"),
                "headers": response.get("headers", {}),
            }
        elif method == "Network.loadingFinished":
            request_id = params.get("requestId")
            if request_id not in pending:
                continue
            meta = pending.pop(request_id)
            body_obj = safe_get_response_body(driver, request_id)
            body = body_obj.get("body") if body_obj else ""
            if body_obj and body_obj.get("base64Encoded"):
                # Skip binary payloads.
                body = ""
            parsed = urlparse(meta["url"])
            payload = parse_json_body(body)
            captured.append(
                {
                    "url": meta["url"],
                    "path": parsed.path,
                    "path_normalized": normalize_path(parsed.path),
                    "query_keys": sorted(parse_qs(parsed.query).keys()),
                    "status": meta["status"],
                    "mimeType": meta["mimeType"],
                    "response_sample": payload if isinstance(payload, (dict, list)) else body[:400],
                    "response_schema": infer_schema(payload) if isinstance(payload, (dict, list)) else "non-json",
                }
            )


def navigate_and_capture(driver, url, pending, captured, wait_selector="body"):
    driver.get(url)
    try:
        WebDriverWait(driver, 7).until(EC.presence_of_element_located((By.CSS_SELECTOR, wait_selector)))
    except TimeoutException:
        # Continue anyway; some pages still trigger API calls before rendering.
        pass
    time.sleep(1.2)
    drain_logs(driver, pending, captured)
    return not is_404_like(driver)


def normalize_page_url(url: str):
    parsed = urlparse(url)
    if parsed.netloc != urlparse(BASE_URL).netloc:
        return None
    if parsed.scheme not in ("http", "https"):
        return None
    if not parsed.path or parsed.path == "":
        return BASE_URL
    if parsed.path.startswith("/ext/"):
        return None
    path = parsed.path.rstrip("/") or "/"
    return f"{BASE_URL}{path}"


def explorer_links(driver, css, limit=6):
    links = []
    for el in driver.find_elements(By.CSS_SELECTOR, css):
        href = (el.get_attribute("href") or "").strip()
        if not href:
            continue
        if not href.startswith(BASE_URL):
            continue
        links.append(href)
    # preserve order while deduping
    seen = set()
    out = []
    for link in links:
        if link in seen:
            continue
        seen.add(link)
        out.append(link)
        if len(out) >= limit:
            break
    return out


def discover_internal_links(driver, limit=80):
    links = []
    for el in driver.find_elements(By.CSS_SELECTOR, "a[href]"):
        href = (el.get_attribute("href") or "").strip()
        if not href:
            continue
        normalized = normalize_page_url(href)
        if normalized:
            links.append(normalized)
    seen = set()
    out = []
    for link in links:
        if link in seen:
            continue
        seen.add(link)
        out.append(link)
        if len(out) >= limit:
            break
    return out


def discover_ext_endpoints_from_scripts(driver):
    endpoints = set()
    api_endpoints = set()
    script_urls = set()
    for el in driver.find_elements(By.CSS_SELECTOR, "script[src]"):
        src = (el.get_attribute("src") or "").strip()
        if not src:
            continue
        script_urls.add(src)
    for src in script_urls:
        try:
            js = fetch_text(src)
        except Exception:
            continue
        for match in re.findall(r"['\"](/ext/[-a-zA-Z0-9_/]+)['\"]", js):
            endpoints.add(match)
        for match in re.findall(r"['\"](/api/[-a-zA-Z0-9_/]+)['\"]", js):
            api_endpoints.add(match)
    return sorted(endpoints), sorted(api_endpoints)


def seed_datatable_query():
    return {
        "draw": 1,
        "columns[0][data]": 0,
        "columns[0][name]": "",
        "columns[0][searchable]": "true",
        "columns[0][orderable]": "false",
        "columns[0][search][value]": "",
        "columns[0][search][regex]": "false",
        "start": 0,
        "length": 10,
        "search[value]": "",
        "search[regex]": "false",
        "_": int(time.time() * 1000),
    }


def enrich_with_ext_endpoint_samples(captured, endpoint_paths):
    for endpoint in endpoint_paths:
        url = f"{BASE_URL}{endpoint}"
        tried = [url]
        # First attempt without query.
        query_url = url
        try:
            status, body, payload = fetch_json(query_url)
            parsed = urlparse(query_url)
            captured.append(
                {
                    "url": query_url,
                    "path": parsed.path,
                    "path_normalized": normalize_path(parsed.path),
                    "query_keys": sorted(parse_qs(parsed.query).keys()),
                    "status": status,
                    "mimeType": "application/json",
                    "response_sample": payload if isinstance(payload, (dict, list)) else body[:400],
                    "response_schema": infer_schema(payload) if isinstance(payload, (dict, list)) else "non-json",
                }
            )
            continue
        except Exception:
            pass
        # Retry with generic datatable query.
        query_url = f"{url}?{urlencode(seed_datatable_query())}"
        if query_url not in tried:
            try:
                status, body, payload = fetch_json(query_url)
                parsed = urlparse(query_url)
                captured.append(
                    {
                        "url": query_url,
                        "path": parsed.path,
                        "path_normalized": normalize_path(parsed.path),
                        "query_keys": sorted(parse_qs(parsed.query).keys()),
                        "status": status,
                        "mimeType": "application/json",
                        "response_sample": payload if isinstance(payload, (dict, list)) else body[:400],
                        "response_schema": infer_schema(payload) if isinstance(payload, (dict, list)) else "non-json",
                    }
                )
            except Exception:
                continue


def mined_samples_from_captured(captured):
    sample = {"blockhash": None, "height": None, "txid": None, "address": None}
    for row in captured:
        payload = row.get("response_sample")
        if not isinstance(payload, dict):
            continue
        data = payload.get("data")
        if isinstance(data, list) and data and isinstance(data[0], list):
            first = data[0]
            if row.get("path") == "/ext/getlastblocksajax":
                if len(first) >= 2 and isinstance(first[1], str):
                    sample["blockhash"] = sample["blockhash"] or first[1]
                if len(first) >= 1 and isinstance(first[0], int):
                    sample["height"] = sample["height"] or first[0]
            if row.get("path", "").startswith("/ext/getaddresstxsajax"):
                for item in first:
                    if isinstance(item, str):
                        m = re.search(r"[0-9a-f]{64}", item)
                        if m:
                            sample["txid"] = sample["txid"] or m.group(0)
                        if "lotus_" in item:
                            m2 = re.search(r"lotus_[A-Za-z0-9]{20,}", item)
                            if m2:
                                sample["address"] = sample["address"] or m2.group(0)
    return sample


def candidate_api_urls(base_url, sample):
    blockhash = sample.get("blockhash")
    txid = sample.get("txid")
    height = sample.get("height")
    addr = sample.get("address")
    urls = []
    if blockhash:
        urls.append(f"{base_url}/api/getblock?hash={blockhash}")
    if txid:
        urls.append(f"{base_url}/api/getrawtransaction?txid={txid}&decrypt=1")
        urls.append(f"{base_url}/api/getrawtransaction?txid={txid}&decrypt=0")
    if height is not None:
        urls.append(f"{base_url}/api/getblockhash?index={height}")
    common = [
        "/api/getblockcount",
        "/api/getbestblockhash",
        "/api/getdifficulty",
        "/api/getmempoolinfo",
        "/api/getrawmempool",
        "/api/gettxoutsetinfo",
        "/api/getblockchaininfo",
        "/api/getnetworkinfo",
        "/api/getpeerinfo",
        "/api/getchaintips",
        "/api/getmininginfo",
        "/api/getconnectioncount",
        "/api/getinfo",
    ]
    urls.extend([f"{base_url}{path}" for path in common])
    if addr:
        urls.extend(
            [
                f"{base_url}/api/getaddressutxos?address={addr}",
                f"{base_url}/api/getaddressbalance?address={addr}",
                f"{base_url}/api/getaddresstxids?address={addr}",
            ]
        )
    # Preserve order while deduping.
    seen = set()
    out = []
    for u in urls:
        if u in seen:
            continue
        seen.add(u)
        out.append(u)
    return out


def enrich_with_api_endpoint_samples(captured, api_urls):
    for url in api_urls:
        status, body, payload = fetch_any(url)
        if status is None:
            continue
        parsed = urlparse(url)
        # Keep only potentially useful responses: 2xx or JSON-ish errors that document contract.
        if status >= 500:
            continue
        is_json = isinstance(payload, (dict, list))
        if not is_json and not body.strip():
            continue
        captured.append(
            {
                "url": url,
                "path": parsed.path,
                "path_normalized": normalize_path(parsed.path),
                "query_keys": sorted(parse_qs(parsed.query).keys()),
                "status": status,
                "mimeType": "application/json" if is_json else "text/plain",
                "response_sample": payload if is_json else body[:400],
                "response_schema": infer_schema(payload) if is_json else "non-json",
            }
        )


def build_summary(captured):
    grouped = defaultdict(list)
    for row in captured:
        grouped[row["path_normalized"]].append(row)

    summary = []
    for endpoint, rows in sorted(grouped.items()):
        example = rows[0]
        statuses = sorted({int(r["status"]) for r in rows if r.get("status") is not None})
        query_keys = sorted({k for r in rows for k in r.get("query_keys", [])})
        summary.append(
            {
                "endpoint": endpoint,
                "hits": len(rows),
                "statuses": statuses,
                "query_keys": query_keys,
                "sample_url": example["url"],
                "sample_schema": example["response_schema"],
            }
        )
    return summary


def write_report(captured, summary):
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    raw_path = OUTPUT_DIR / "endpoints_raw.json"
    summary_path = OUTPUT_DIR / "api_schema_summary.json"
    md_path = OUTPUT_DIR / "report.md"

    raw_path.write_text(json.dumps(captured, indent=2, ensure_ascii=False), encoding="utf-8")
    summary_path.write_text(json.dumps(summary, indent=2, ensure_ascii=False), encoding="utf-8")

    lines = [
        "# explorer.lotusia.org API Inventory (Selenium, non-headless)",
        "",
        f"- Captured responses: **{len(captured)}**",
        f"- Unique endpoints: **{len(summary)}**",
        "",
        "## Endpoints",
        "",
    ]
    for row in summary:
        lines.append(f"### `{row['endpoint']}`")
        lines.append(f"- Hits: `{row['hits']}`")
        lines.append(f"- Statuses: `{row['statuses']}`")
        lines.append(f"- Query keys: `{row['query_keys']}`")
        lines.append(f"- Sample URL: `{row['sample_url']}`")
        lines.append("- Sample schema:")
        lines.append("```json")
        lines.append(json.dumps(row["sample_schema"], indent=2, ensure_ascii=False))
        lines.append("```")
        lines.append("")

    md_path.write_text("\n".join(lines), encoding="utf-8")
    return raw_path, summary_path, md_path


def main():
    options = Options()
    options.set_capability("goog:loggingPrefs", {"performance": "ALL"})
    driver = webdriver.Chrome(options=options)
    driver.set_window_size(1600, 1000)
    driver.execute_cdp_cmd("Network.enable", {})

    pending = {}
    captured = []
    discovered_ext = set()
    discovered_api = set()
    try:
        seed_pages = [BASE_URL, f"{BASE_URL}/blocks", f"{BASE_URL}/txs", f"{BASE_URL}/richlist"]
        queue = []
        seen_pages = set()
        for page in seed_pages:
            if page not in seen_pages:
                queue.append(page)
                seen_pages.add(page)

        while queue and len(seen_pages) <= 60:
            page = queue.pop(0)
            ok = navigate_and_capture(driver, page, pending, captured)
            if not ok:
                continue
            for link in discover_internal_links(driver, limit=120):
                if link not in seen_pages and len(seen_pages) <= 60:
                    seen_pages.add(link)
                    queue.append(link)
            ext_endpoints, api_endpoints = discover_ext_endpoints_from_scripts(driver)
            for endpoint in ext_endpoints:
                discovered_ext.add(endpoint)
            for endpoint in api_endpoints:
                discovered_api.add(endpoint)

            # Deeper route samples from current page, when present.
            for block_url in explorer_links(driver, "a[href*='/block/']", limit=2):
                navigate_and_capture(driver, block_url, pending, captured)
            for tx_url in explorer_links(driver, "a[href*='/tx/']", limit=2):
                navigate_and_capture(driver, tx_url, pending, captured)
            for addr_url in explorer_links(driver, "a[href*='/address/']", limit=2):
                navigate_and_capture(driver, addr_url, pending, captured)

        # Final drain.
        time.sleep(1.2)
        drain_logs(driver, pending, captured)
    finally:
        driver.quit()

    # Add explicit samples for discovered ext endpoints (not only those auto-called in page flow).
    enrich_with_ext_endpoint_samples(captured, sorted(discovered_ext))
    sample = mined_samples_from_captured(captured)
    explicit_api_urls = candidate_api_urls(BASE_URL, sample)
    explicit_api_urls.extend([f"{BASE_URL}{p}" for p in sorted(discovered_api)])
    enrich_with_api_endpoint_samples(captured, explicit_api_urls)

    # Deduplicate identical URL + status + schema tuples to keep raw manageable.
    unique = []
    seen = set()
    for row in captured:
        key = (
            row["url"],
            row["status"],
            json.dumps(row["response_schema"], sort_keys=True, ensure_ascii=False),
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(row)

    summary = build_summary(unique)
    raw_path, summary_path, md_path = write_report(unique, summary)

    print(f"captured={len(unique)} endpoints={len(summary)}")
    print(raw_path)
    print(summary_path)
    print(md_path)


if __name__ == "__main__":
    main()
