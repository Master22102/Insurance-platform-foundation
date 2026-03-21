/**
 * Loads next.config.js twice to ensure CSP header mode tracks CSP_MODE env.
 * Fast PR signal without a second full `next build`.
 */
const path = require('path');

const root = path.join(__dirname, '..');

async function assertCspBranch(enforce) {
  if (enforce) {
    process.env.CSP_MODE = 'enforce';
  } else {
    delete process.env.CSP_MODE;
  }
  delete require.cache[require.resolve(path.join(root, 'next.config.js'))];
  const cfg = require(path.join(root, 'next.config.js'));
  const rows = await cfg.headers();
  const headers = rows[0]?.headers ?? [];
  const keys = headers.map((h) => h.key);
  if (enforce) {
    if (!keys.includes('Content-Security-Policy')) {
      throw new Error('CSP_MODE=enforce: expected Content-Security-Policy header');
    }
    if (keys.includes('Content-Security-Policy-Report-Only')) {
      throw new Error('CSP_MODE=enforce: did not expect Report-Only header');
    }
  } else {
    if (!keys.includes('Content-Security-Policy-Report-Only')) {
      throw new Error('default: expected Content-Security-Policy-Report-Only header');
    }
    if (keys.includes('Content-Security-Policy')) {
      throw new Error('default: did not expect enforcing Content-Security-Policy header');
    }
  }
}

(async () => {
  try {
    await assertCspBranch(false);
    await assertCspBranch(true);
    console.log('verify-csp-next-config: OK (report-only + enforce branches)');
  } catch (e) {
    console.error('verify-csp-next-config:', e.message || e);
    process.exit(1);
  }
})();
