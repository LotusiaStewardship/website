async function renderExplorerBlocksPage(url) {
  const params = parsePageAndSize(url);
  const payload = await fetchLegacyJson('/api/explorer/blocks', { page: params.page, pageSize: params.pageSize });
  const blocks = payload.blocks || [];
  const tipHeight = num(payload.tipHeight);
  const numPages = tipHeight > 0 ? Math.ceil(tipHeight / params.pageSize) : 1;
  const rows = blocks.map(block => {
    const info = block.blockInfo || {};
    const hash = info.hash || block.hash || '';
    const height = info.height || block.height || 0;
    const burn = info.numBurnedSats || block.sumBurnedSats || 0;
    const txCount = info.numTxs || (block.txs ? block.txs.length : 0);
    const size = info.blockSize || block.size || 0;
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber(height)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/block/' + esc(hash) + '">' + esc(shortHash(hash)) + '</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatUtc(info.timestamp)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber(txCount)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatBytes(size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/blocks?page=' + params.page + '&pageSize=' + params.pageSize;
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Explorer', href: '/explorer' },
    { label: 'Blocks', href: '/explorer/blocks' }
  ];
  const title = 'Blocks';
  const description = 'Latest blocks in the Lotusia blockchain.';
  const jsonLd = seoJsonLd([
    seoBreadcrumbGraph(breadcrumbs),
    seoPageGraph(canonical, title, description, 'CollectionPage'),
    seoItemListGraph('Latest blocks', blocks.slice(0, 20).map(function(block) {
      const info = block.blockInfo || {};
      const hash = info.hash || block.hash || '';
      const height = info.height || block.height || 0;
      return {
        name: 'Block #' + String(height),
        url: hash ? seoAbsoluteUrl('/explorer/block/' + encodeURIComponent(hash)) : ''
      };
    }))
  ]);
  const bodyInner = sectionHeader('network', 'Blocks', 'Latest blocks in the blockchain. Refreshed every 5 seconds.') +
    renderTable(['Height', 'Hash', 'Timestamp', 'Burned', 'Transactions', 'Size'], rows, 'No blocks found.', { withPagination: true }) +
    paginationHtml('/explorer/blocks', params.page, params.pageSize, numPages);
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, title, description, body, {
    breadcrumbs,
    keywords: 'lotusia explorer blocks, latest blocks, blockchain height',
    jsonLd
  });
}

async function renderExplorerOverviewPage() {
  const [overview, chainInfo, mempool] = await Promise.all([
    fetchLegacyJson('/api/explorer/overview'),
    fetchLegacyJson('/api/explorer/chain-info').catch(() => ({})),
    fetchLegacyJson('/api/explorer/mempool').catch(() => [])
  ]);
  const mining = overview.mininginfo || {};
  const peers = overview.peerinfo || [];
  const peerRows = await Promise.all(peers.slice(0, 15).map(async function(p) {
    const addr = p.addr || '-';
    const version = p.subver || '-';
    const blocks = p.synced_headers ?? p.synced_blocks ?? '-';
    const fromApiCode = p.geoip && (p.geoip.countryCode || p.geoip.country_code);
    const fromApiName = p.geoip && (p.geoip.country || p.geoip.countryName);
    const geo = fromApiCode
      ? { countryCode: String(fromApiCode).toUpperCase(), countryName: String(fromApiName || '') }
      : await lookupGeoIp(addr);
    const code = geo.countryCode || '';
    const name = geo.countryName || '';
    const flag = countryFlagEmoji(code);
    const label = name || (code ? code : 'Unknown country');
    const countryCell = code
      ? '<span class="inline-flex items-center gap-2" title="' + esc(label) + '" aria-label="' + esc(label) + '"><span class="text-base leading-none" aria-hidden="true">' + esc(flag || '') + '</span><span>' + esc(code) + '</span></span>'
      : '<span class="text-gray-500 dark:text-gray-400" title="Unknown country" aria-label="Unknown country">-</span>';
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + countryCell + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(addr) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(version) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber(blocks)) + '</td>' +
      '</tr>';
  }));
  const tip = num(chainInfo.tipHeight || chainInfo.blocks || 0);
  const pending = Array.isArray(mempool) ? mempool.length : 0;
  const hashrate = num(mining.networkhashps || 0);
  const hashrateText = hashrate > 0 ? (hashrate / 1e9).toFixed(1) + ' GH/s' : '-';
  const diffText = num(mining.difficulty || 0) > 0 ? num(mining.difficulty).toFixed(1) : '-';
  const blockTime = num(mining.target || 0) > 0 ? (num(mining.target) / 60).toFixed(1) + ' minutes' : '-';
  const cards = '<div class="grid sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Connections', formatNumber(peers.length), 'Number of Lotus nodes connected to the Explorer', 'connections') +
    compactStatCard('Blocks', formatNumber(tip), 'Total number of blocks in the blockchain', 'cube') +
    compactStatCard('Pending Transactions', formatNumber(pending), 'Transactions waiting to be confirmed', 'clock') +
    compactStatCard('Hashrate', hashrateText, 'Estimated hashes computed per second', 'bolt') +
    compactStatCard('Difficulty', diffText, 'Difficulty of the most recent block', 'gauge') +
    compactStatCard('Avg. Block Time', blockTime, 'Calculated from latest chain target', 'clock') +
    '</div>';
  const mainnetBadge = '<span class="inline-flex shrink-0 items-center rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">Mainnet</span>';
  const canonical = '/explorer';
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Explorer', href: '/explorer' }
  ];
  const title = 'Overview';
  const description = 'Network overview for the Lotusia explorer.';
  const jsonLd = seoJsonLd([
    seoBreadcrumbGraph(breadcrumbs),
    seoPageGraph(canonical, title, description, 'WebPage')
  ]);
  const bodyInner = sectionHeader('network', 'Network', 'Up-to-date information about the Lotusia blockchain network.', mainnetBadge) +
    cards +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Peer Info</h2>' +
    '<p class="text-gray-600 dark:text-gray-300 mb-4">List of Lotus nodes connected to the Explorer.</p>' +
    renderTable(['Country', 'Address', 'Version', 'Blocks'], peerRows, 'No peer data available.');
  const body = legacyExplorerLayout('overview', bodyInner);
  return pageShell(canonical, title, description, body, {
    breadcrumbs,
    keywords: 'lotusia explorer overview, hashrate, difficulty, peers, mempool',
    jsonLd
  });
}

async function renderExplorerBlockDetailPage(url, hashOrHeight) {
  const payload = await fetchLegacyJson('/api/explorer/block/' + encodeURIComponent(hashOrHeight));
  const info = payload.blockInfo || {};
  const txs = payload.txs || [];
  const rows = txs.map(tx => {
    const burn = tx.sumBurnedSats || 0;
    const isCoinbase = Boolean(tx.isCoinbase || tx.coinbase || tx.is_coinbase);
    const coinbaseBadge = isCoinbase
      ? '<span class="inline-flex items-center rounded-md border border-green-500/30 bg-green-500/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400" style="margin-left:.625rem;">Coinbase</span>'
      : '';
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(tx.txid) + '">' + esc(shortHash(tx.txid)) + '</a>' + coinbaseBadge + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatUtc(tx.timeFirstSeen || info.timestamp)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.inputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.outputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatBytes(tx.size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/block/' + encodeURIComponent(hashOrHeight);
  const blockLabel = '#' + String(info.height || hashOrHeight);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Explorer', href: '/explorer' },
    { label: 'Blocks', href: '/explorer/blocks' },
    { label: blockLabel, href: canonical }
  ];
  const title = 'Block ' + (info.hash || hashOrHeight);
  const description = 'Detailed information about a Lotusia block.';
  const jsonLd = seoJsonLd([
    seoBreadcrumbGraph(breadcrumbs),
    seoPageGraph(canonical, title, description, 'WebPage')
  ]);
  const mainnetBadge = '<span class="inline-flex shrink-0 items-center rounded-md border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">Mainnet</span>';
  const minedByAddress = String(payload.minedBy || '').trim();
  const minedByValue = minedByAddress
    ? middleEllipsis(minedByAddress, 14, 12)
    : '-';
  const minedByHint = minedByAddress
    ? '<a href="/explorer/address/' + esc(minedByAddress) + '" title="' + esc(minedByAddress) + '" class="block max-w-full truncate text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300">' + esc(middleEllipsis(minedByAddress, 12, 10)) + '</a>'
    : 'Miner address';
  const bodyInner = sectionHeader('cube', 'Block Details', 'Detailed block metrics and transactions.', mainnetBadge) +
    '<p class="text-sm text-gray-500 mb-6"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/blocks">#' + esc(formatNumber(info.height || hashOrHeight)) + '</a> · ' + esc(shortHash(info.hash || hashOrHeight)) + '</p>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Timestamp', formatUtc(info.timestamp), 'UTC', 'clock') +
    compactStatCard('Block Subsidy', formatXpiFromSats(info.reward || 0), 'New coins minted', 'coins') +
    compactStatCard('Mined By', minedByValue, minedByHint, 'profile', { valueClass: 'text-lg md:text-xl leading-tight truncate max-w-full block', hintClass: 'truncate max-w-full', hintHtml: true }) +
    compactStatCard('Block Size', formatBytes(info.blockSize), 'Serialized bytes', 'weight') +
    compactStatCard('Transactions', formatNumber(info.numTxs || txs.length), 'Transactions in this block', 'txs') +
    compactStatCard('Burned', formatXpiFromSats(info.numBurnedSats || 0), 'Total burned in block', 'flame') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transactions</h2>' +
    renderTable(['Transaction ID', 'First Seen', 'Burned', 'Inputs', 'Outputs', 'Size'], rows, 'No transactions in this block.');
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, title, description, body, {
    breadcrumbs,
    keywords: 'lotusia block detail, block transactions, block subsidy, block size',
    jsonLd
  });
}

async function renderExplorerTxDetailPage(url, txid) {
  const payload = await fetchLegacyJson('/api/explorer/tx/' + encodeURIComponent(txid));
  const block = payload.block || {};
  const inputs = payload.inputs || [];
  const outputs = payload.outputs || [];
  const inputsRows = inputs.map(function(input, idx) {
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">Input #' + (idx + 1) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(input.address || (input.isCoinbase ? 'Coinbase' : '-')) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(input.value || 0)) + '</td>' +
      '</tr>';
  });
  const outputsRows = outputs.map(function(output, idx) {
    const target = output.address
      ? '<a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300 break-all" href="/explorer/address/' + esc(output.address) + '">' + esc(output.address) + '</a>'
      : (output.rankOutput ? 'RANK script output' : '-');
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">Output #' + (idx + 1) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + target + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(output.value || 0)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/tx/' + encodeURIComponent(txid);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Explorer', href: '/explorer' },
    { label: 'Transaction', href: canonical }
  ];
  const title = 'Transaction ' + txid;
  const description = 'Detailed information about a Lotusia transaction.';
  const jsonLd = seoJsonLd([
    seoBreadcrumbGraph(breadcrumbs),
    seoPageGraph(canonical, title, description, 'WebPage')
  ]);
  const statusBadge = '<span class="inline-flex items-center gap-2">' +
    '<span class="inline-flex shrink-0 items-center rounded-md border border-green-500/30 bg-green-500/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">Confirmed</span>' +
    (payload.isCoinbase
      ? '<span class="inline-flex shrink-0 items-center rounded-md border border-green-500/30 bg-green-500/10 px-3 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-green-400">Coinbase</span>'
      : '') +
    '</span>';
  const bodyInner = sectionHeader('chart', 'Transaction Details', 'Inputs, outputs, and block confirmation details.', statusBadge) +
    '<p class="text-sm text-gray-500 mb-6">' + esc(shortHash(payload.txid || txid)) + '</p>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Time First Seen', formatUtc(payload.timeFirstSeen), 'When this tx first appeared', 'chart') +
    compactStatCard('Size', formatBytes(payload.size), 'Raw transaction size', 'network') +
    compactStatCard('Confirmations', formatNumber(payload.confirmations || 0), 'Current block confirmations', 'up') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Block Information</h2>' +
    '<div class="grid sm:grid-cols-3 gap-4 mb-8">' +
    compactStatCard('Transaction Confirmed', formatUtc(block.timestamp), 'Confirmation timestamp', 'up') +
    compactStatCard('Confirmations', formatNumber(payload.confirmations || 0), 'Network confirmations', 'up') +
    compactStatCard('Confirmed in Block', shortHash(block.hash || ''), 'View full block details', 'network') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Inputs</h2>' +
    renderTable(['Input', 'Source', 'Amount'], inputsRows, 'No inputs.') +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mt-8 mb-3">Outputs</h2>' +
    renderTable(['Output', 'Destination', 'Amount'], outputsRows, 'No outputs.');
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, title, description, body, {
    breadcrumbs,
    keywords: 'lotusia transaction detail, tx inputs, tx outputs, confirmations',
    jsonLd
  });
}

async function renderExplorerAddressDetailPage(url, address) {
  const params = parsePageAndSize(url);
  const [details, balance] = await Promise.all([
    fetchLegacyJson('/api/explorer/address/' + encodeURIComponent(address), { page: params.page, pageSize: params.pageSize }),
    fetchLegacyJson('/api/explorer/address/' + encodeURIComponent(address) + '/balance')
  ]);
  const txs = (details.history && details.history.txs) || [];
  const numPages = (details.history && details.history.numPages) || 1;
  const rows = txs.map(tx => {
    const burn = tx.sumBurnedSats || 0;
    return '<tr>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm"><a class="text-primary-500 dark:text-primary-400 hover:text-primary-600 dark:hover:text-primary-300" href="/explorer/tx/' + esc(tx.txid) + '">' + esc(shortHash(tx.txid)) + '</a></td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatUtc((tx.block && tx.block.timestamp) || tx.timeFirstSeen)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatXpiFromSats(burn)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.inputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatNumber((tx.outputs || []).length)) + '</td>' +
      '<td class="whitespace-nowrap px-4 py-4 text-sm leading-6 tabular-nums text-gray-500 dark:text-gray-400">' + esc(formatBytes(tx.size)) + '</td>' +
      '</tr>';
  });
  const canonical = '/explorer/address/' + encodeURIComponent(address) + '?page=' + params.page + '&pageSize=' + params.pageSize;
  const canonicalBase = '/explorer/address/' + encodeURIComponent(address);
  const breadcrumbs = [
    { label: 'Home', href: '/' },
    { label: 'Explorer', href: '/explorer' },
    { label: 'Address', href: canonicalBase }
  ];
  const title = 'Address ' + address;
  const description = 'Detailed information for a Lotusia address.';
  const jsonLd = seoJsonLd([
    seoBreadcrumbGraph(breadcrumbs),
    seoPageGraph(canonical, title, description, 'CollectionPage')
  ]);
  const bodyInner = sectionHeader('profile', 'Address Details', 'Address balance and transaction history on Lotusia mainnet.') +
    '<p class="text-sm text-gray-500 mb-6 break-all">' + esc(address) + '</p>' +
    '<div class="grid sm:grid-cols-2 gap-4 mb-8">' +
    compactStatCard('Balance', formatXpiFromSats(balance), 'Current wallet balance', 'up') +
    compactStatCard('Last Seen', formatUtc(details.lastSeen), 'Last activity timestamp', 'chart') +
    '</div>' +
    '<h2 class="text-xl font-semibold text-gray-900 dark:text-white mb-3">Transaction History</h2>' +
    renderTable(['Transaction ID', 'First Seen', 'Burned', 'Inputs', 'Outputs', 'Size'], rows, 'No transactions for this address.', { withPagination: true }) +
    paginationHtml('/explorer/address/' + encodeURIComponent(address), params.page, params.pageSize, numPages);
  const body = legacyExplorerLayout('blocks', bodyInner);
  return pageShell(canonical, title, description, body, {
    breadcrumbs,
    keywords: 'lotusia address detail, wallet balance, address transactions',
    jsonLd
  });
}

function explorerErrorPage(pathname, message) {
  const body = '<h1 class="text-3xl font-bold text-gray-900 dark:text-white mb-3">Explorer Unavailable</h1>' +
    '<p class="text-gray-600 dark:text-gray-300 mb-6">Unable to load fresh explorer data for this route.</p>' +
    '<div class="rounded-xl border border-red-300 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">' + esc(message) + '</div>';
  return pageShell(pathname, 'Explorer Unavailable', 'Unable to load explorer data.', body);
}