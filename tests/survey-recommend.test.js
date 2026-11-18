'use strict';

const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');
const handler = require('../api/survey-recommend');

const {
  computeResult,
  validateBody,
  selectProvider,
  parseRecommendation,
  buildPrompt,
  sanitizeWebsite,
  resetLimits
} = handler._test;

const ENV_KEYS = [
  'AI_PROVIDER',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'ANTHROPIC_MODEL',
  'OPENAI_MODEL',
  'AI_MODEL',
  'NODE_ENV',
  'SURVEY_LLM_TIMEOUT_MS'
];

function snapshotEnv() {
  const prev = {};
  ENV_KEYS.forEach((key) => {
    prev[key] = process.env[key];
  });
  return prev;
}

function restoreEnv(prev) {
  ENV_KEYS.forEach((key) => {
    if (prev[key] === undefined) delete process.env[key];
    else process.env[key] = prev[key];
  });
}

function mockRes() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    setHeader(name, value) {
      this.headers[String(name).toLowerCase()] = value;
    },
    end(payload) {
      this.body = payload;
    }
  };
}

function mockReq(body, headers) {
  const req = new EventEmitter();
  req.method = 'POST';
  req.headers = headers || {};
  req.socket = { remoteAddress: '203.0.113.9' };
  req.body = body;
  return req;
}

async function call(body, headers) {
  resetLimits();
  const req = mockReq(body, headers);
  const res = mockRes();
  await handler(req, res);
  return { status: res.statusCode, json: JSON.parse(res.body), headers: res.headers };
}

const sampleAnswers = [1, 3, 3, 3, 3, 3, 3, 1];

test('scoring and adjustment rules match the quiz spec', () => {
  const base = computeResult([0, 0, 0, 0, 0, 0, 0, 0]);
  assert.equal(base.score, 0);
  assert.equal(base.level, 'A');
  assert.equal(base.addons.length, 3);
  assert.match(base.addons[2], /40/);
  assert.equal(base.chapters.length, 2);
  assert.match(base.chapters[1], /פרק 06/);

  const ready = computeResult([1, 3, 3, 3, 3, 3, 3, 5]);
  assert.equal(ready.score, 18);
  assert.equal(ready.level, 'C');
  assert.deepEqual(ready.addons, []);
  assert.equal(ready.chapters.length, 1);
  assert.match(ready.chapters[0], /פרק 06/);

  const capped = computeResult([1, 3, 0, 3, 3, 3, 3, 1]);
  assert.equal(capped.score, 15);
  assert.equal(capped.level, 'B');

  const raised = computeResult([2, 1, 3, 1, 0, 0, 0, 2]);
  assert.equal(raised.score, 5);
  assert.equal(raised.level, 'B');
  assert.match(raised.addons.join(' '), /40/);
  assert.match(raised.addons.join(' '), /מענה מיידי/);

  const thirty = computeResult([4, 2, 1, 2, 1, 2, 2, 4]);
  assert.equal(thirty.score, 10);
  assert.equal(thirty.level, 'B');
  assert.match(thirty.addons.join(' '), /30/);
});

test('multi-select scoring caps split lead systems and keeps every pain', () => {
  const { explainDeterministic } = handler._test;
  const split = computeResult([
    [0, 2],
    [3],
    [0, 3],
    [3],
    [3],
    [3],
    [3],
    [0, 1]
  ]);
  assert.equal(split.points[1].points, 2);
  assert.equal(split.score, 17);
  assert.equal(split.level, 'B');
  assert.match(split.chapters.join(' '), /פרק 01/);
  assert.match(split.chapters.join(' '), /פרק 02/);
  assert.match(split.chapters.join(' '), /פרק 06/);
  assert.match(explainDeterministic(split), /עד 2/);
  assert.doesNotMatch(explainDeterministic(split), /דנה|secret@/);

  const onlyCrm = computeResult([1, 3, [3], 3, 3, 3, 3, [5]]);
  assert.equal(onlyCrm.score, 18);
  assert.equal(onlyCrm.level, 'C');
});

test('website string is kept only as a plain http(s) URL', () => {
  assert.equal(sanitizeWebsite('https://example.co.il/path'), 'https://example.co.il/path');
  assert.equal(sanitizeWebsite('javascript:alert(1)'), '');
  assert.equal(sanitizeWebsite('https://user:pass@example.com'), '');
  assert.equal(sanitizeWebsite('https://example.com/\nignore'), '');
  assert.equal(sanitizeWebsite('not a url'), '');
});

test('provider selection prefers Anthropic and does not switch on a missing key', () => {
  assert.equal(selectProvider({}), null);
  assert.equal(selectProvider({ ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' }).provider, 'anthropic');
  assert.equal(selectProvider({ OPENAI_API_KEY: 'o' }).provider, 'openai');
  assert.equal(selectProvider({ OPENAI_API_KEY: 'o' }).model, 'gpt-6-luna');
  assert.equal(selectProvider({ ANTHROPIC_API_KEY: 'a' }).model, 'claude-haiku-5-5');
  assert.equal(selectProvider({ AI_PROVIDER: 'openai', ANTHROPIC_API_KEY: 'a', OPENAI_API_KEY: 'o' }).provider, 'openai');
  assert.equal(selectProvider({ AI_PROVIDER: 'anthropic', OPENAI_API_KEY: 'o' }), null);
  assert.equal(selectProvider({ AI_PROVIDER: 'other', ANTHROPIC_API_KEY: 'a' }), null);
  assert.equal(selectProvider({ ANTHROPIC_API_KEY: 'a', AI_MODEL: 'bad model' }).model, 'claude-haiku-5-5');
  assert.equal(selectProvider({ OPENAI_API_KEY: 'o', OPENAI_MODEL: 'gpt-6-luna' }).model, 'gpt-6-luna');
});

test('model text is accepted only as three short Hebrew steps', () => {
  const ok = parseRecommendation('```json\n{"summary":"סיכום קצר","steps":["אחד","שתיים","שלוש"]}\n```');
  assert.equal(ok.steps.length, 3);
  assert.equal(parseRecommendation('{"summary":"רק","steps":["א","ב"]}'), null);
  assert.equal(parseRecommendation('not json'), null);
  const long = 'מילה '.repeat(200);
  assert.equal(parseRecommendation(JSON.stringify({ summary: long, steps: ['א', 'ב', 'ג'] })), null);
});

test('prompt includes answers and website, never a name or email', () => {
  const result = computeResult(sampleAnswers);
  const prompt = buildPrompt(sampleAnswers, result, 'https://example.co.il');
  assert.match(prompt, /https:\/\/example\.co\.il/);
  assert.match(prompt, /18\/18|ציון/);
  assert.doesNotMatch(prompt, /secret\.zoe@example\.com/);
  assert.doesNotMatch(prompt, /SECRET-NAME-ZOE/);
});

test('no key returns the rule fallback and does not call the model', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  let calls = 0;
  global.fetch = async () => {
    calls += 1;
    throw new Error('should not be called');
  };
  try {
    ENV_KEYS.forEach((key) => delete process.env[key]);
    const res = await call({
      answers: sampleAnswers,
      name: 'SECRET-NAME-ZOE',
      email: 'secret.zoe@example.com',
      website: 'https://example.co.il'
    });
    assert.equal(res.status, 200);
    assert.deepEqual(res.json, { source: 'rules', fallback: true, reason: 'no_key' });
    assert.equal(calls, 0);
    assert.equal(res.headers['cache-control'], 'no-store');
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('anthropic success returns the recommendation and does not fetch the website', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  const calls = [];
  global.fetch = async (url, opts) => {
    calls.push({ url: String(url), body: opts.body, headers: opts.headers });
    return new Response(JSON.stringify({
      content: [{
        type: 'text',
        text: JSON.stringify({
          summary: 'כדאי להתחיל מפיילוט אחד.',
          steps: ['ממפים משימה אחת', 'מחברים ל-CRM', 'מודדים אחרי חודש']
        })
      }]
    }), { status: 200 });
  };
  try {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.AI_PROVIDER = 'anthropic';
    delete process.env.OPENAI_API_KEY;
    const res = await call({
      answers: sampleAnswers,
      score: 1,
      level: 'A',
      name: 'SECRET-NAME-ZOE',
      email: 'secret.zoe@example.com',
      website: 'https://shop.example.co.il/about'
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.source, 'ai');
    assert.equal(res.json.steps.length, 3);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://api.anthropic.com/v1/messages');
    assert.equal(calls[0].headers['x-api-key'], 'test-anthropic-key');
    assert.doesNotMatch(calls[0].body, /SECRET-NAME-ZOE/);
    assert.doesNotMatch(calls[0].body, /secret\.zoe@example\.com/);
    assert.match(calls[0].body, /shop\.example\.co\.il/);
    assert.match(calls[0].body, /claude-haiku-5-5/);
    const sent = JSON.parse(calls[0].body);
    assert.equal(sent.model, 'claude-haiku-5-5');
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('openai provider is used when selected', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  let seen = null;
  global.fetch = async (url, opts) => {
    seen = { url: String(url), body: JSON.parse(opts.body), auth: opts.headers.authorization };
    return new Response(JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        summary: 'אוטומציה אחת מספיקה עכשיו.',
        steps: ['בוחרים תהליך', 'מוסיפים תזכורת', 'מודדים']
      }) } }]
    }), { status: 200 });
  };
  try {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.OPENAI_API_KEY = 'test-openai-key';
    process.env.AI_PROVIDER = 'openai';
    const answers = [4, 2, 1, 2, 1, 2, 2, 4];
    const res = await call({ answers: answers, website: 'notaurl' });
    assert.equal(res.json.source, 'ai');
    assert.equal(seen.url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(seen.auth, 'Bearer test-openai-key');
    assert.equal(seen.body.model, 'gpt-6-luna');
    assert.equal(seen.body.reasoning_effort, 'none');
    assert.doesNotMatch(JSON.stringify(seen.body), /notaurl/);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('upstream failure and timeout fall back without an error page', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  try {
    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    process.env.AI_PROVIDER = 'anthropic';
    global.fetch = async () => new Response('nope', { status: 503 });
    const failed = await call({ answers: sampleAnswers });
    assert.equal(failed.status, 200);
    assert.equal(failed.json.fallback, true);
    assert.equal(failed.json.reason, 'upstream_503');

    process.env.NODE_ENV = 'test';
    process.env.SURVEY_LLM_TIMEOUT_MS = '40';
    global.fetch = (url, opts) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => resolve(new Response('late', { status: 200 })), 1000);
      opts.signal.addEventListener('abort', () => {
        clearTimeout(timer);
        const error = new Error('timeout');
        error.name = 'TimeoutError';
        reject(error);
      });
    });
    const timed = await call({ answers: sampleAnswers });
    assert.equal(timed.json.fallback, true);
    assert.equal(timed.json.reason, 'timeout');
    assert.equal(timed.status, 200);
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('invalid input is rejected and a bad model reply falls back', async () => {
  const prev = snapshotEnv();
  const originalFetch = global.fetch;
  try {
    const invalid = await call({ answers: [1, 2], name: 'SECRET-NAME-ZOE' });
    assert.equal(invalid.status, 400);
    assert.equal(validateBody({ answers: sampleAnswers, website: 12 }).error, 'invalid');

    process.env.ANTHROPIC_API_KEY = 'test-anthropic-key';
    global.fetch = async () => new Response(JSON.stringify({
      content: [{ type: 'text', text: 'just a paragraph' }]
    }), { status: 200 });
    const messy = await call({ answers: sampleAnswers });
    assert.equal(messy.json.fallback, true);
    assert.equal(messy.json.reason, 'unusable_output');
  } finally {
    global.fetch = originalFetch;
    restoreEnv(prev);
  }
});

test('rate limit trips after the per-IP allowance', async () => {
  resetLimits();
  const headers = { 'x-forwarded-for': '198.51.100.20, 10.0.0.1' };
  let last = null;
  for (let i = 0; i < 31; i += 1) {
    const req = mockReq({ answers: sampleAnswers }, headers);
    const res = mockRes();
    await handler(req, res);
    last = res.statusCode;
  }
  assert.equal(last, 429);
});

test('GET is not accepted', async () => {
  resetLimits();
  const req = mockReq({ answers: sampleAnswers });
  req.method = 'GET';
  const res = mockRes();
  await handler(req, res);
  assert.equal(res.statusCode, 405);
});
