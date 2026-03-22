'use strict';
/**
 * Absolute app root for Playwright / E2E. Loaded via `require()` so `__dirname` is correct
 * even when `process.cwd()` differs (Windows workers, spawned `npx`, etc.).
 */
const path = require('path');
module.exports = path.resolve(__dirname);
