# Cloudflare Wiring Report (`lotusia.org`)

Date: 2026-03-27  
Scope: Zone wiring, DNS inventory, edge/runtime routing, and safe static cutover plan.

## Executive Summary

- The zone `lotusia.org` is active in Cloudflare account `919afe3537f94cf9e3f7ae41ef8e7e5c`.
- Apex (`lotusia.org`) and `www` currently point to a server IP (`135.148.150.142` + IPv6), not Cloudflare Pages custom-domain routing.
- `explorer.lotusia.org` and `app.lotusia.org` also point to that server and are currently serving app responses.
- No Workers routes are configured.
- No Workers scripts are present in this account.
- No Pages projects were returned by this account/token.
- DNS has multiple additional operational records (mail, tunnels, ACME TXT, etc.) that must be preserved.

## Token and Access Validation

- Both provided tokens verify as active:
  - Read-all token id: `1b60461c6adc35ad7dc8a301c30b4d4d`
  - Read+Edit token id: `57b8cc7dcc70ed689bd2075ec2d5e360`
- Both tokens now return the same key results for audited endpoints:
  - `accounts/:id/workers/scripts` -> success, empty list
  - `accounts/:id/pages/projects` -> success, empty list
  - `zones/:id/workers/routes` -> success, empty list
- Remaining limitations are **not** simple auth scope gaps:
  - `zones/:id/pagerules` -> Cloudflare returns `1011`: endpoint does not support account-owned tokens
  - `zones/:id/custom_hostnames` -> Cloudflare returns `1404`: no SSL-for-SaaS quota allocated on this zone/account
  - several ruleset phase entrypoints -> not authorized

This means the report is exhaustive for what this token can read, and explicitly notes blind spots.

## Zone Identity

- Zone ID: `0a125a5d0491ad3a23912fd6563b98b7`
- Domain: `lotusia.org`
- Status: `active`
- Nameservers: `ace.ns.cloudflare.com`, `melinda.ns.cloudflare.com`
- Plan: Free Website

## DNS Inventory (Exhaustive Categories)

Record counts:
- `A`: 11
- `AAAA`: 7
- `CNAME`: 4
- `MX`: 1
- `NS`: 1
- `TXT`: 25

### Critical app/web records

- `A lotusia.org -> 135.148.150.142` (proxied)
- `AAAA lotusia.org -> 2604:2dc0:100:428e::2` (proxied)
- `A www.lotusia.org -> 135.148.150.142` (proxied)
- `AAAA www.lotusia.org -> 2604:2dc0:100:428e::2` (proxied)
- `A explorer.lotusia.org -> 135.148.150.142` (proxied)
- `AAAA explorer.lotusia.org -> 2604:2dc0:100:428e::2` (proxied)
- `A app.lotusia.org -> 135.148.150.142` (proxied)

### Tunnel-related records (must not break)

- `calculator.lotusia.org -> *.cfargotunnel.com` (proxied CNAME)
- `directory.lotusia.org -> *.cfargotunnel.com` (proxied CNAME)
- `wxpi.lotusia.org -> *.cfargotunnel.com` (proxied CNAME)
- `*.service.lotusia.org -> *.cfargotunnel.com` (proxied CNAME wildcard)

### Mail/ownership/security records present

- `MX lotusia.org -> miab.urgero.host`
- SPF TXT on apex
- Google site verification TXT on apex
- `_dmarc` TXT present
- DKIM TXT present
- Many ACME challenge TXT records for service subdomains

## Current Runtime Behavior (Live HTTP Checks)

- `https://lotusia.org` -> `200`, Nuxt-powered response
- `https://explorer.lotusia.org` -> `200`, Express-powered response
- `https://app.lotusia.org` -> `200`, Nuxt-powered response
- `https://lotusia.org/social` -> `404` currently (root path)
- `https://lotusia.org/social/activity` -> `200`, Nuxt page with live social activity content
- `https://lotusia.org/api` -> `301` to `/api/` currently
- `https://lotusia.burnlotus.org` -> serving static output (separate host)

## Zone/Edge Settings (Relevant)

- SSL mode: `full`
- Always Use HTTPS: `off`
- Automatic HTTPS Rewrites: `on`
- HTTP/3: `on`
- TLS 1.3: `on`
- Min TLS version: `1.0`
- DNSSEC: `disabled`
- Workers routes: none returned
- Workers scripts: none returned
- Pages projects: none returned for this account/token

## Important Risk Found Before Apex Static Cutover

Current generated `_redirects` rules include:

- `/social/* https://lotusia.org/social/:splat 301`
- `/api/* https://lotusia.org/api/:splat 200`

If the static site is deployed directly on `lotusia.org`, these two can self-target apex and risk loops or incorrect behavior.

## Safe Deployment Plan (Do This)

1. Keep these DNS records unchanged:
   - `explorer.lotusia.org` A/AAAA
   - `app.lotusia.org` A
   - all tunnel CNAMEs
   - MX/TXT/NS records

2. Update static redirect/proxy targets before apex cutover:
   - `/social/*` should target app host, e.g. `https://app.lotusia.org/social/:splat`
   - `/api/*` should proxy to app host, e.g. `https://app.lotusia.org/api/:splat`
   - keep `/explorer` redirect to `https://explorer.lotusia.org`

3. Add or confirm Cloudflare Pages project in upstream account:
   - project name expected by workflow: `lotusia-marketing`
   - bind custom domain `lotusia.org` and define preferred `www` behavior

4. Set upstream repo secrets:
   - `CLOUDFLARE_API_TOKEN`
   - `CLOUDFLARE_ACCOUNT_ID`

5. Enable one canonical host strategy:
   - apex -> www or www -> apex (single choice)
   - enforce HTTPS redirects

6. Post-cutover smoke tests:
   - `/`, `/tools`, `/founders`, `/blog`
   - `/social/*` and `/api/*` flow to app host
   - `explorer.lotusia.org` unaffected
   - confirm canonical/hreflang/sitemap/JSON-LD use `https://lotusia.org`

## What Could Not Be Fully Confirmed With This Token

- Legacy Page Rules via API (Cloudflare rejects account-owned tokens for this endpoint)
- Some Rulesets phase entrypoints (not authorized)
- Custom Hostnames endpoint is not usable here for inventory because this zone/account has no SSL-for-SaaS quota (`1404`)

For full completeness, run the same audit with credentials that can access page-rules/rulesets details in this tenant model:
- Zone: Read + Zone Settings Read + Rulesets Read
- A credential/token type accepted by Cloudflare for the Page Rules endpoint in this account model
- Optional (only if SSL for SaaS is enabled in future): Custom Hostnames read access

