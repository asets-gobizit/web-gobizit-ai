'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const handler = require('../api/survey-lead');

const { validateLead, buildMessage, resetLimits } = handler._test;

const ENV_KEYS = [
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'MAIL_FROM', 'LEAD_TO',
  'RESEND_API_KEY', 'AI_PROVIDER', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'AI_MODEL'
];

function snapshotEnv() {
  const prev = {};
  ENV_KEYS.forEach((key) => { prev[key] = process.env[key]; });
  return prev;
}

function restoreEnv(prev) {
  ENV_KEYS.forEach((key) => {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  });
}

function clearMailEnv() {
  ENV_KEYS.forEach((key) => delete process.env[key]);
}

function mockRes() {
  return {
    statusCode: 0,
    body: '',
    headers: {},
    setHeader(name, value) { this.headers[String(name).toLowerCase()] = value; },
    end(payload) { this.body = payload; }
  };
}

function mockReq(body) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = { 'x-forwarded-for': '203.0.113.40' };
  req.socket = { remoteAddress: '203.0.113.40' };
  req.body = body;
  return req;
}

const answers = [[0, 2], [1], [0, 3], [1], [0], [2], [1], [0, 5]];

function leadBody(extra) {
  return Object.assign({
    name: 'דנה כהן',
    email: 'dana@example.co.il',
    website: 'https://example.co.il',
    consent: true,
    comment: 'הלידים מפוזרים בין הוואטסאפ לאקסל.',
    answers: answers,
    recommendation: {
      source: 'rules',
      summary: 'הצעדים הראשונים פשוטים.',
      steps: ['מרכזים לידים', 'מגדירים הודעת פתיחה', 'כותבים עם AI']
    },
    company: ''
  }, extra || {});
}

test('the email body lists the answers, comment, score, and a sober explanation', () => {
  const validated = validateLead(leadBody());
  assert.equal(validated.error, undefined);
  const message = buildMessage(
    validated.lead,
    validated.result,
    { source: 'rules', text: validated.result ? require('../api/survey-recommend')._test.explainDeterministic(validated.result) : '' },
    '18.11.2026, 14:00'
  );
  assert.match(message.subject, /דנה כהן/);
  assert.doesNotMatch(message.subject, /\n/);
  assert.match(message.text, /dana@example\.co\.il/);
  assert.match(message.text, /הלידים מפוזרים/);
  assert.match(message.text, /אישור לקבל מייל: כן/);
  assert.match(message.text, /בוואטסאפ, במחברת או בראש/);
  assert.match(message.text, /עד 2/);
  assert.match(message.text, /כללי הניקוד/);
  assert.match(message.text, /מרכזים לידים/);
  assert.doesNotMatch(message.text, /מובטח|נחסוך לכם/);
  assert.doesNotMatch(message.text, /הכנסה בסיכון/);

  const withCost = validateLead(leadBody({
    costEstimate: { missedPerWeek: 25, percentCustomers: 15, averageValue: 1500 }
  }));
  const costMessage = buildMessage(
    withCost.lead,
    withCost.result,
    { source: 'rules', text: 'הסבר' },
    '18.11.2026, 14:00'
  );
  assert.equal(withCost.lead.costEstimate.monthly, 24356);
  assert.match(costMessage.text, /\$24,356/);
  assert.equal(validateLead(leadBody({ costEstimate: { missedPerWeek: 0, percentCustomers: 15, averageValue: 1500 } })).lead.costEstimate, null);
});

test('missing mail settings skip the send and a honeypot is dropped', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error('should not send');
  };
  try {
    clearMailEnv();
    resetLimits();
    const res = mockRes();
    await handler(mockReq(leadBody()), res);
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).sent, false);

    resetLimits();
    const bot = mockRes();
    await handler(mockReq(leadBody({ company: 'Acme spam' })), bot);
    assert.equal(bot.statusCode, 200);
    assert.equal(JSON.parse(bot.body).sent, false);
    assert.equal(calls, 0);

    resetLimits();
    const bad = mockRes();
    await handler(mockReq(leadBody({ comment: 'א'.repeat(1001) })), bad);
    assert.equal(bad.statusCode, 400);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('Resend is used only when SMTP is not configured', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  let seen = null;
  global.fetch = async (url, opts) => {
    seen = { url: String(url), body: JSON.parse(opts.body), auth: opts.headers.Authorization || opts.headers.authorization };
    return new Response('{}', { status: 200 });
  };
  try {
    clearMailEnv();
    process.env.RESEND_API_KEY = 're_test_key';
    process.env.MAIL_FROM = 'GoBizIT <info@gobizit.ai>';
    process.env.LEAD_TO = 'neo@gobizit.ai';
    resetLimits();
    const res = mockRes();
    await handler(mockReq(leadBody()), res);
    assert.equal(JSON.parse(res.body).sent, true);
    assert.equal(seen.url, 'https://api.resend.com/emails');
    assert.equal(seen.body.to[0], 'neo@gobizit.ai');
    assert.match(seen.body.text, /דנה כהן/);
    assert.equal(seen.auth, 'Bearer re_test_key');
    assert.equal(seen.body.from.includes('SMTP_PASS'), false);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});
