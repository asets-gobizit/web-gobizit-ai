'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');

test('survey.gobizit.ai language roots rewrite, and every other request passes through', async () => {
  const { default: middleware, surveyDestination, config } = await import('../middleware.js');
  assert.deepEqual(config.matcher, ['/', '/he', '/he/', '/en', '/en/', '/es', '/es/']);

  assert.equal(surveyDestination('survey.gobizit.ai', '/'), '/survey/he/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/es'), '/survey/es/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/es/'), '/survey/es/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/en/'), '/survey/en/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/he'), '/survey/he/');
  assert.equal(surveyDestination('gobizit.ai', '/'), null);
  assert.equal(surveyDestination('www.gobizit.ai', '/es/'), null);
  assert.equal(surveyDestination('survey.gobizit.ai', '/es/blogs/'), null);
  assert.equal(surveyDestination('survey.gobizit.ai', '/survey/es/'), null);

  const rewritten = await middleware(new Request('https://survey.gobizit.ai/es/', {
    headers: { host: 'survey.gobizit.ai' }
  }));
  assert.equal(rewritten.headers.get('x-middleware-rewrite'), 'https://survey.gobizit.ai/survey/es/');

  const passed = await middleware(new Request('https://gobizit.ai/es/', {
    headers: { host: 'gobizit.ai' }
  }));
  assert.equal(passed.headers.get('x-middleware-next'), '1');
  assert.equal(passed.headers.get('x-middleware-rewrite'), null);

  const home = await middleware(new Request('https://www.gobizit.ai/', {
    headers: { host: 'www.gobizit.ai' }
  }));
  assert.equal(home.headers.get('x-middleware-next'), '1');
  assert.equal(home.status, 200);
});
