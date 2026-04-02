# explorer.lotusia.org API Inventory (Selenium, non-headless)

- Captured responses: **22**
- Unique endpoints: **18**

## Endpoints

### `/api/getbestblockhash`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getbestblockhash`
- Sample schema:
```json
"non-json"
```

### `/api/getblock`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `['hash']`
- Sample URL: `https://explorer.lotusia.org/api/getblock?hash=00000000008c7db50b4032a296a1e83ae3cd71805a7b64bea84031a677f0c2b7`
- Sample schema:
```json
{
  "hash": "string",
  "confirmations": "integer",
  "size": "integer",
  "height": "integer",
  "version": "integer",
  "versionHex": "string",
  "merkleroot": "string",
  "tx": {
    "type": "array",
    "items": "string"
  },
  "time": "integer",
  "mediantime": "integer",
  "nonce": "string",
  "bits": "string",
  "difficulty": "string",
  "chainwork": "string",
  "nTx": "integer",
  "epochblockhash": "string",
  "extendedmetadatahash": "string",
  "extendedmetadata": {
    "type": "array",
    "items": "unknown"
  },
  "previousblockhash": "string",
  "nextblockhash": "string"
}
```

### `/api/getblockchaininfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getblockchaininfo`
- Sample schema:
```json
"non-json"
```

### `/api/getblockcount`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getblockcount`
- Sample schema:
```json
"non-json"
```

### `/api/getblockhash`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `['index']`
- Sample URL: `https://explorer.lotusia.org/api/getblockhash?index=1259491`
- Sample schema:
```json
"non-json"
```

### `/api/getchaintips`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getchaintips`
- Sample schema:
```json
"non-json"
```

### `/api/getconnectioncount`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getconnectioncount`
- Sample schema:
```json
"non-json"
```

### `/api/getdifficulty`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getdifficulty`
- Sample schema:
```json
"non-json"
```

### `/api/getinfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getinfo`
- Sample schema:
```json
{
  "message": "string",
  "code": "integer",
  "name": "string"
}
```

### `/api/getmempoolinfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getmempoolinfo`
- Sample schema:
```json
"non-json"
```

### `/api/getmininginfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getmininginfo`
- Sample schema:
```json
{
  "blocks": "integer",
  "difficulty": "string",
  "networkhashps": "string",
  "pooledtx": "integer",
  "chain": "string",
  "warnings": "string"
}
```

### `/api/getnetworkinfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getnetworkinfo`
- Sample schema:
```json
"non-json"
```

### `/api/getpeerinfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getpeerinfo`
- Sample schema:
```json
{
  "type": "array",
  "items": {
    "id": "integer",
    "addr": "string",
    "addrbind": "string",
    "addrlocal": "string",
    "addr_relay_enabled": "boolean",
    "network": "string",
    "services": "string",
    "servicesnames": {
      "type": "array",
      "items": "string"
    },
    "relaytxes": "boolean",
    "lastsend": "integer",
    "lastrecv": "integer",
    "last_transaction": "integer",
    "last_proof": "integer",
    "last_block": "integer",
    "bytessent": "integer",
    "bytesrecv": "integer",
    "conntime": "integer",
    "timeoffset": "integer",
    "pingtime": "number",
    "minping": "number",
    "version": "integer",
    "subver": "string",
    "inbound": "boolean",
    "bip152_hb_to": "boolean",
    "bip152_hb_from": "boolean",
    "startingheight": "integer",
    "synced_headers": "integer",
    "synced_blocks": "integer",
    "inflight": {
      "type": "array",
      "items": "unknown"
    },
    "addr_processed": "integer",
    "addr_rate_limited": "integer",
    "permissions": {
      "type": "array",
      "items": "unknown"
    },
    "minfeefilter": "number",
    "bytessent_per_msg": {
      "addrv2": "integer",
      "cmpctblock": "integer",
      "feefilter": "integer",
      "getdata": "integer",
      "getheaders": "integer",
      "headers": "integer",
      "inv": "integer",
      "ping": "integer",
      "pong": "integer",
      "sendaddrv2": "integer",
      "sendcmpct": "integer",
      "sendheaders": "integer",
      "tx": "integer",
      "verack": "integer",
      "version": "integer"
    },
    "bytesrecv_per_msg": {
      "addr": "integer",
      "addrv2": "integer",
      "feefilter": "integer",
      "getaddr": "integer",
      "getdata": "integer",
      "getheaders": "integer",
      "headers": "integer",
      "inv": "integer",
      "ping": "integer",
      "pong": "integer",
      "sendaddrv2": "integer",
      "sendcmpct": "integer",
      "sendheaders": "integer",
      "tx": "integer",
      "verack": "integer",
      "version": "integer"
    },
    "connection_type": "string"
  }
}
```

### `/api/getrawmempool`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/getrawmempool`
- Sample schema:
```json
"non-json"
```

### `/api/getrawtransaction`
- Hits: `2`
- Statuses: `[200]`
- Query keys: `['decrypt', 'txid']`
- Sample URL: `https://explorer.lotusia.org/api/getrawtransaction?txid=1d1e3e29793af4d54bef8050298395e5ccad0a2b9a22ed47ebe6c3c5382fb883&decrypt=1`
- Sample schema:
```json
{
  "txid": "string",
  "hash": "string",
  "version": "integer",
  "size": "integer",
  "locktime": "integer",
  "vin": {
    "type": "array",
    "items": {
      "coinbase": "string",
      "sequence": "integer"
    }
  },
  "vout": {
    "type": "array",
    "items": {
      "value": "integer",
      "n": "integer",
      "scriptPubKey": {
        "asm": "string",
        "hex": "string",
        "type": "string"
      }
    }
  },
  "hex": "string",
  "blockhash": "string",
  "confirmations": "integer",
  "time": "integer",
  "blocktime": "integer"
}
```

### `/api/gettxoutsetinfo`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `[]`
- Sample URL: `https://explorer.lotusia.org/api/gettxoutsetinfo`
- Sample schema:
```json
{
  "height": "integer",
  "bestblock": "string",
  "transactions": "integer",
  "txouts": "integer",
  "bogosize": "integer",
  "hash_serialized": "string",
  "disk_size": "integer",
  "total_amount": "string"
}
```

### `/ext/getaddresstxsajax/:id`
- Hits: `4`
- Statuses: `[200]`
- Query keys: `['_', 'columns[0][data]', 'columns[0][orderable]', 'columns[0][search][regex]', 'columns[0][searchable]', 'columns[1][data]', 'columns[1][orderable]', 'columns[1][search][regex]', 'columns[1][searchable]', 'columns[2][data]', 'columns[2][orderable]', 'columns[2][search][regex]', 'columns[2][searchable]', 'columns[3][data]', 'columns[3][orderable]', 'columns[3][search][regex]', 'columns[3][searchable]', 'columns[4][data]', 'columns[4][orderable]', 'columns[4][search][regex]', 'columns[4][searchable]', 'draw', 'length', 'search[regex]', 'start']`
- Sample URL: `https://explorer.lotusia.org/ext/getaddresstxsajax/lotus_16PSJJfo6CiBc4PoXSJVJ3WmwFCjZr4GMV4JjG43u?draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=false&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=false&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&start=0&length=50&search%5Bvalue%5D=&search%5Bregex%5D=false&_=1774800645830`
- Sample schema:
```json
{
  "draw": "integer",
  "data": {
    "type": "array",
    "items": {
      "type": "array",
      "items": "string"
    }
  },
  "recordsTotal": "integer",
  "recordsFiltered": "integer"
}
```

### `/ext/getlastblocksajax`
- Hits: `1`
- Statuses: `[200]`
- Query keys: `['_', 'columns[0][data]', 'columns[0][orderable]', 'columns[0][search][regex]', 'columns[0][searchable]', 'columns[1][data]', 'columns[1][orderable]', 'columns[1][search][regex]', 'columns[1][searchable]', 'columns[2][data]', 'columns[2][orderable]', 'columns[2][search][regex]', 'columns[2][searchable]', 'columns[3][data]', 'columns[3][orderable]', 'columns[3][search][regex]', 'columns[3][searchable]', 'columns[4][data]', 'columns[4][orderable]', 'columns[4][search][regex]', 'columns[4][searchable]', 'columns[5][data]', 'columns[5][orderable]', 'columns[5][search][regex]', 'columns[5][searchable]', 'draw', 'length', 'search[regex]', 'start']`
- Sample URL: `https://explorer.lotusia.org/ext/getlastblocksajax?draw=1&columns%5B0%5D%5Bdata%5D=0&columns%5B0%5D%5Bname%5D=&columns%5B0%5D%5Bsearchable%5D=true&columns%5B0%5D%5Borderable%5D=false&columns%5B0%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B0%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B1%5D%5Bdata%5D=1&columns%5B1%5D%5Bname%5D=&columns%5B1%5D%5Bsearchable%5D=true&columns%5B1%5D%5Borderable%5D=false&columns%5B1%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B1%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B2%5D%5Bdata%5D=2&columns%5B2%5D%5Bname%5D=&columns%5B2%5D%5Bsearchable%5D=true&columns%5B2%5D%5Borderable%5D=false&columns%5B2%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B2%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B3%5D%5Bdata%5D=3&columns%5B3%5D%5Bname%5D=&columns%5B3%5D%5Bsearchable%5D=true&columns%5B3%5D%5Borderable%5D=false&columns%5B3%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B3%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B4%5D%5Bdata%5D=4&columns%5B4%5D%5Bname%5D=&columns%5B4%5D%5Bsearchable%5D=true&columns%5B4%5D%5Borderable%5D=false&columns%5B4%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B4%5D%5Bsearch%5D%5Bregex%5D=false&columns%5B5%5D%5Bdata%5D=5&columns%5B5%5D%5Bname%5D=&columns%5B5%5D%5Bsearchable%5D=true&columns%5B5%5D%5Borderable%5D=false&columns%5B5%5D%5Bsearch%5D%5Bvalue%5D=&columns%5B5%5D%5Bsearch%5D%5Bregex%5D=false&start=0&length=10&search%5Bvalue%5D=&search%5Bregex%5D=false&_=1774800637416`
- Sample schema:
```json
{
  "draw": "integer",
  "data": {
    "type": "array",
    "items": {
      "type": "array",
      "items": "integer"
    }
  },
  "recordsTotal": "integer",
  "recordsFiltered": "integer"
}
```
