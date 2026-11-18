'use strict';

const SURVEY_HOST = 'survey.gobizit.ai';

function surveyDestination(host, pathname) {
  const name = String(host || '').replace(/:\d+$/, '').trim().toLowerCase();
  if (name !== SURVEY_HOST) return null;
  const path = pathname || '/';
  if (path === '/') return '/survey/he/';
  const match = path.match(/^\/(he|en|es)(\/.*)?$/);
  if (!match) return null;
  return '/survey/' + match[1] + (match[2] || '/');
}

module.exports = { surveyDestination };
