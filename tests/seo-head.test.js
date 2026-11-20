'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const root = path.join(__dirname, '..');
const SKIP_PREFIXES = ['survey/', '_to_delete/', 'wp-content/', 'wp-includes/'];

function walk(dir, out = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ent.name === 'node_modules' || ent.name === '.git' || ent.name === 'api') continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, out);
    else if (ent.name.endsWith('.html')) out.push(full);
  }
  return out;
}

function headOf(html) {
  const end = html.toLowerCase().indexOf('</head>');
  return end === -1 ? html : html.slice(0, end);
}

function metas(head) {
  const tags = head.match(/<meta\b[^>]*>/gi) || [];
  return tags.map((tag) => {
    const attrs = {};
    for (const match of tag.matchAll(/([:\w-]+)\s*=\s*(["'])(.*?)\2/gi)) {
      attrs[match[1].toLowerCase()] = match[3];
    }
    return attrs;
  });
}

function one(list, attr, key) {
  return list.filter((meta) => meta[attr] === key);
}

test('pages that already publish an og:image also publish the large-card twitter image', () => {
  const pages = walk(root).filter((file) => {
    const rel = path.relative(root, file).split(path.sep).join('/');
    return !SKIP_PREFIXES.some((prefix) => rel.startsWith(prefix));
  });
  assert.ok(pages.length > 40);
  let withImage = 0;
  for (const file of pages) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const meta = metas(headOf(fs.readFileSync(file, 'utf8')));
    const images = one(meta, 'property', 'og:image');
    if (images.length === 0) continue;
    withImage += 1;
    assert.equal(images.length, 1, rel);
    const image = images[0].content;
    assert.match(image, /^https:\/\/gobizit\.ai\//, rel);
    const cards = one(meta, 'name', 'twitter:card');
    assert.deepEqual(cards.map((item) => item.content), ['summary_large_image'], rel);
    const twitter = one(meta, 'name', 'twitter:image');
    assert.deepEqual(twitter.map((item) => item.content), [image], rel);
    assert.equal(one(meta, 'property', 'og:image:width').length, 1, rel);
    assert.equal(one(meta, 'property', 'og:image:height').length, 1, rel);
    assert.equal(one(meta, 'property', 'og:image:alt').length, 1, rel);
  }
  assert.ok(withImage >= 20, `expected article images, saw ${withImage}`);
});

test('www.gobizit.ai redirects to the apex host used by canonical tags', () => {
  const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));
  const redirects = config.redirects.filter((rule) =>
    (rule.has || []).some((check) => check.type === 'host' && check.value === 'www.gobizit.ai')
  );
  assert.equal(redirects.length, 2);
  assert.equal(redirects[0].source, '/');
  assert.equal(redirects[0].destination, 'https://gobizit.ai/');
  assert.equal(redirects[0].permanent, true);
  assert.equal(redirects[1].source, '/:path*');
  assert.equal(redirects[1].destination, 'https://gobizit.ai/:path*');
  assert.equal(redirects[1].permanent, true);
  assert.equal(config.redirects[0], redirects[0]);
});

test('sitemap urls resolve and the missing indexable pages are listed', () => {
  const xml = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
  const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) => match[1]);
  assert.ok(locs.length >= 57);
  for (const loc of locs) {
    assert.match(loc, /^https:\/\/gobizit\.ai\//);
    const pathname = new URL(loc).pathname;
    const file = pathname === '/'
      ? path.join(root, 'index.html')
      : path.join(root, pathname.replace(/^\//, ''), 'index.html');
    assert.equal(fs.existsSync(file), true, loc);
  }
  for (const loc of [
    'https://gobizit.ai/services/zoho-ai-services/',
    'https://gobizit.ai/privacy-policy/',
    'https://gobizit.ai/es/privacy-policy/',
    'https://gobizit.ai/terms-and-conditions/',
    'https://gobizit.ai/es/terms-and-conditions/',
    'https://gobizit.ai/sms-opt-in/',
    'https://gobizit.ai/es/sms-opt-in/'
  ]) {
    assert.ok(locs.includes(loc), loc);
  }
  assert.equal(locs.some((loc) => loc.includes('/survey/')), false);
  assert.equal(locs.some((loc) => loc.includes('/card/')), false);
  assert.equal(locs.some((loc) => loc.includes('/thankyou-page/')), false);
});

test('noindex utility pages no longer also say index, and contact email is a mailto', () => {
  for (const rel of ['404.html', 'thankyou-page/index.html']) {
    const meta = metas(headOf(fs.readFileSync(path.join(root, rel), 'utf8')));
    const robots = one(meta, 'name', 'robots').map((item) => item.content);
    assert.deepEqual(robots, ['noindex, follow'], rel);
  }
  for (const rel of ['contact-us/index.html', 'es/contact-us/index.html']) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    assert.equal(html.includes('/cdn-cgi/l/email-protection'), false, rel);
    assert.equal(html.includes('mailto:info@gobizit.ai'), true, rel);
    assert.equal(html.includes('Email: info@gobizit.ai'), true, rel);
  }
});

test('copied structured data points at the page it is on', () => {
  const cases = [
    ['solutions/ai-website-assistant/index.html', 'https://gobizit.ai/solutions/ai-website-assistant/'],
    ['es/solutions/website-ai-chat-assistant/index.html', 'https://gobizit.ai/es/solutions/website-ai-chat-assistant/'],
    ['es/services/ai-jumpstart/index.html', 'https://gobizit.ai/es/services/ai-jumpstart/'],
    ['services/zoho-ai-services/index.html', 'https://gobizit.ai/services/zoho-ai-services/']
  ];
  for (const [rel, url] of cases) {
    const html = fs.readFileSync(path.join(root, rel), 'utf8');
    const raw = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is)[1];
    const data = JSON.parse(raw);
    const page = data['@graph'].find((node) => node['@type'] === 'WebPage');
    assert.equal(page.url, url, rel);
    assert.equal(raw.includes('super-agi'), false, rel);
    assert.equal(raw.includes('Never miss a call'), false, rel);
  }
});

test('Zoho PageSense is the first thing in every HTML document head, once', () => {
  const snippetStart = '<script id="pagesenseCode">';
  const pages = walk(root).filter((file) => {
    const raw = fs.readFileSync(file);
    return !raw.includes(0) && raw.includes(Buffer.from('<head>'));
  });
  assert.equal(pages.length, 65);
  for (const file of pages) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const html = fs.readFileSync(file, 'utf8');
    assert.equal(html.split('id="pagesenseCode"').length - 1, 1, rel);
    const head = headOf(html);
    const headAt = head.indexOf('<head>');
    assert.ok(headAt !== -1, rel);
    const after = head.slice(headAt + '<head>'.length).replace(/^\r?\n/, '');
    assert.equal(after.startsWith(snippetStart), true, rel);
    assert.match(after, /cdn\.pagesense\.io\/js\/kiwicrm\/3ac28262b3284ff1b2c96c56a50914ba\.js/);
    const start = html.indexOf('<!-- Zoho SalesIQ -->');
    if (start !== -1) {
      const end = html.indexOf('<!-- /Zoho SalesIQ -->', start);
      const block = html.slice(start, end);
      assert.equal(block.includes('pagesense'), false, rel);
      assert.equal(block.includes('wv-site-greeting'), false, rel);
    }
  }
});

test('survey pages canonicalize to survey.gobizit.ai and describe the existing intro', () => {
  const expected = {
    'survey/en/index.html': ['https://survey.gobizit.ai/en/', '8 short questions'],
    'survey/es/index.html': ['https://survey.gobizit.ai/es/', '8 preguntas cortas'],
    'survey/he/index.html': ['https://survey.gobizit.ai/he/', '8 שאלות קצרות']
  };
  for (const [rel, [canonical, descStart]] of Object.entries(expected)) {
    const head = headOf(fs.readFileSync(path.join(root, rel), 'utf8'));
    const meta = metas(head);
    assert.match(head, new RegExp(`<link rel="canonical" href="${canonical}">`));
    const desc = one(meta, 'name', 'description')[0].content;
    assert.equal(desc.startsWith(descStart), true, rel);
    assert.equal(one(meta, 'property', 'og:url')[0].content, canonical, rel);
    assert.equal(head.includes('wv-site-greeting'), false, rel);
  }
});
