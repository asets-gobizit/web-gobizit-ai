'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { surveyDestination } = require('../survey/host-route');

test('survey.gobizit.ai sends the language roots to the quiz', () => {
  assert.equal(surveyDestination('survey.gobizit.ai', '/'), '/survey/he/');
  assert.equal(surveyDestination('survey.gobizit.ai:443', '/es'), '/survey/es/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/es/'), '/survey/es/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/en'), '/survey/en/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/en/'), '/survey/en/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/he'), '/survey/he/');
  assert.equal(surveyDestination('survey.gobizit.ai', '/he/'), '/survey/he/');
  assert.equal(surveyDestination('Survey.GoBizIT.ai', '/es/extra'), '/survey/es/extra');
});

test('the main site keeps /es and the homepage', () => {
  assert.equal(surveyDestination('gobizit.ai', '/es'), null);
  assert.equal(surveyDestination('gobizit.ai', '/es/'), null);
  assert.equal(surveyDestination('www.gobizit.ai', '/'), null);
  assert.equal(surveyDestination('www.gobizit.ai', '/es/blogs/'), null);
  assert.equal(surveyDestination('gobizitai.vercel.app', '/es/'), null);
});

test('survey paths that are already under /survey are not rewritten again', () => {
  assert.equal(surveyDestination('survey.gobizit.ai', '/survey/es/'), null);
  assert.equal(surveyDestination('survey.gobizit.ai', '/api/survey-lead/'), null);
});
