'use strict';

const fs = require('fs');
const path = require('path');

const SEGMENTS = [
  'proxy.js',
  'html.js',
  'helpers.js',
  'explorer-render.js',
  'social-render.js',
  'router.js'
];

function getWorkerSource() {
  const dir = __dirname;
  const parts = SEGMENTS.map((name) => fs.readFileSync(path.join(dir, name), 'utf8'));
  return parts.join('\n\n');
}

module.exports = { getWorkerSource };
