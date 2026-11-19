'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'wv-site-greeting.js'), 'utf8');
const SKIP_PREFIXES = ['survey/', '_to_delete/', 'wp-content/'];
const SCRIPT_TAG = '<script src="/wv-site-greeting.js" defer></script>';

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function run(code, { host, pathname, search = '', cookie = '', meta = '', storage, clock, ready }) {
  const fetches = [];
  const timers = [];
  const infoCalls = [];
  const session = storage || new Map();
  const originalReady = ready || function originalReady() {};
  const sandbox = {
    location: { hostname: host, pathname, search },
    sessionStorage: {
      getItem(key) {
        return session.has(key) ? session.get(key) : null;
      },
      setItem(key, value) {
        session.set(key, String(value));
      }
    },
    document: {
      cookie,
      querySelector(sel) {
        if (sel === 'meta[name="wv-greeting"]' && meta) {
          return { getAttribute: () => meta };
        }
        return null;
      },
      addEventListener() {}
    },
    fetch(url, opts) {
      fetches.push({ url, opts });
      return Promise.resolve({ ok: true, status: 204 });
    },
    setTimeout(fn, ms) {
      timers.push({ fn, ms });
      return timers.length;
    },
    $zoho: {
      salesiq: {
        ready: originalReady,
        visitor: {
          uniqueuserid() {
            return '';
          },
          info(payload) {
            infoCalls.push(payload);
          }
        }
      }
    }
  };
  sandbox.window = sandbox;
  sandbox.Date = { now: () => clock };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'wv-site-greeting.js' });
  return { fetches, timers, session, infoCalls, sandbox, originalReady };
}

test('greeting script keeps the proven Catalyst rules', () => {
  assert.match(source, /var ENDPOINT = 'https:\/\/wv-greetings-714119021\.development\.catalystserverless\.com\/server\/wv-greeting\/greet';/);
  assert.match(source, /var WAIT_MS = 180000;/);
  assert.match(source, /var ALLOWED_HOSTS = \["gobizit\.ai", "www\.gobizit\.ai"\];/);
  assert.match(source, /headers: \{ 'Content-Type': 'text\/plain;charset=UTF-8' \}/);
  assert.match(source, /function zldtFromCookie\(\)/);
  assert.match(source, /return zldtFromCookie\(\);/);
  assert.doesNotMatch(source, /vercel\.app/);
  assert.doesNotMatch(source, /survey\.gobizit\.ai/);
});

test('every gobizit.ai page loads the script once, after SalesIQ and without editing the widget', () => {
  const pages = walk(root);
  assert.ok(pages.length > 60);
  for (const file of pages) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    const tags = html.split(SCRIPT_TAG).length - 1;
    if (SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix))) {
      assert.equal(tags, 0, rel);
      continue;
    }
    assert.equal(tags, 1, rel);
    assert.equal(html.includes(`${SCRIPT_TAG}\n</body>`), true, rel);
    const start = html.indexOf('<!-- Zoho SalesIQ -->');
    if (start !== -1) {
      const end = html.indexOf('<!-- /Zoho SalesIQ -->', start);
      const block = html.slice(start, end + '<!-- /Zoho SalesIQ -->'.length);
      assert.equal(block.includes('wv-site-greeting'), false, rel);
      assert.equal((block.match(/id="zsiqscript"/g) || []).length, 1, rel);
      assert.match(block, /src="https:\/\/salesiq\.zohopublic\.com\/widget\?wc=siqaea3e08bb371e4b7e753ce6dcff9b12e70b4bf87fe699ac62ef491a1f46b447b"/);
    }
  }
});

test('middleware is not involved in loading the greeting', () => {
  const middleware = fs.readFileSync(path.join(root, 'middleware.js'), 'utf8');
  assert.equal(middleware.includes('wv-site-greeting'), false);
  assert.equal(middleware.includes('wv-greeting'), false);
});

test('a full page load records first-seen once and posts the page open when the wait elapses', async () => {
  const storage = new Map();
  const home = run(source, {
    host: 'gobizit.ai',
    pathname: '/',
    storage,
    clock: 1_000
  });
  assert.equal(storage.get('wv_site_first_seen'), '1000');
  assert.equal(home.fetches.length, 0);
  assert.equal(home.timers.length, 1);
  assert.equal(home.timers[0].ms, 180_000);
  assert.equal(home.sandbox.$zoho.salesiq.ready, home.originalReady);

  const moved = run(source, {
    host: 'www.gobizit.ai',
    pathname: '/contact-us/',
    storage,
    clock: 61_000
  });
  assert.equal(storage.get('wv_site_first_seen'), '1000');
  assert.equal(moved.fetches.length, 0);
  assert.equal(moved.timers[0].ms, 120_000);

  const due = run(source, {
    host: 'gobizit.ai',
    pathname: '/es/solutions/website-building/',
    search: '',
    cookie: 'other=1; kiwicrm-_zldt=uvid-es',
    meta: 'Hola',
    storage,
    clock: 181_000
  });
  assert.equal(due.fetches.length, 1);
  assert.equal(due.fetches[0].url, 'https://wv-greetings-714119021.development.catalystserverless.com/server/wv-greeting/greet');
  assert.equal(due.fetches[0].opts.method, 'POST');
  assert.equal(due.fetches[0].opts.mode, 'cors');
  assert.equal(due.fetches[0].opts.credentials, 'omit');
  assert.equal(due.fetches[0].opts.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.deepEqual(JSON.parse(due.fetches[0].opts.body), {
    uvid: 'uvid-es',
    host: 'gobizit.ai',
    path: '/es/solutions/website-building/'
  });
  assert.equal(JSON.stringify(due.infoCalls), JSON.stringify([{ wv_greeting: 'Hola' }]));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(storage.get('wv_greet_sent'), '1');

  const again = run(source, {
    host: 'gobizit.ai',
    pathname: '/solutions/ai-website-assistant/',
    cookie: 'kiwicrm-_zldt=uvid-es',
    storage,
    clock: 200_000
  });
  assert.equal(again.fetches.length, 0);
});

test('survey and preview hosts do not schedule or post', () => {
  for (const host of ['survey.gobizit.ai', 'web-gobizit-ai-git-cursor-salesiq-site-greeting-dad2-gobizit.vercel.app']) {
    const storage = new Map();
    const result = run(source, {
      host,
      pathname: '/contact-us/',
      cookie: 'kiwicrm-_zldt=should-not-send',
      storage,
      clock: 500_000
    });
    assert.equal(result.fetches.length, 0, host);
    assert.equal(result.timers.length, 0, host);
    assert.equal(storage.has('wv_site_first_seen'), false, host);
  }
});

test('a local-only preview host allowlist posts the current path (not committed)', () => {
  const previewHost = 'web-gobizit-ai-git-cursor-salesiq-site-greeting-dad2-gobizit.vercel.app';
  const patched = source.replace(
    'var ALLOWED_HOSTS = ["gobizit.ai", "www.gobizit.ai"];',
    `var ALLOWED_HOSTS = ["gobizit.ai", "www.gobizit.ai", "${previewHost}"];`
  );
  assert.notEqual(patched, source);

  const storage = new Map();
  storage.set('wv_site_first_seen', '1000');
  const early = run(patched, {
    host: previewHost,
    pathname: '/',
    storage,
    clock: 10_000
  });
  assert.equal(early.fetches.length, 0);
  assert.equal(storage.get('wv_site_first_seen'), '1000');

  const due = run(patched, {
    host: previewHost,
    pathname: '/es/contact-us/',
    cookie: 'portal-_zldt=preview-uvid',
    storage,
    clock: 181_000
  });
  assert.equal(due.fetches.length, 1);
  assert.deepEqual(JSON.parse(due.fetches[0].opts.body), {
    uvid: 'preview-uvid',
    host: previewHost,
    path: '/es/contact-us/'
  });
  assert.equal(due.fetches[0].opts.headers['Content-Type'], 'text/plain;charset=UTF-8');
  assert.equal(source.includes(previewHost), false);
});
