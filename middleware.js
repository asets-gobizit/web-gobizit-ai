import { next, rewrite } from '@vercel/functions/middleware';

const SURVEY_HOST = 'survey.gobizit.ai';

export function surveyDestination(host, pathname) {
  const name = String(host || '').replace(/:\d+$/, '').trim().toLowerCase();
  if (name !== SURVEY_HOST) return null;
  if (pathname === '/' || pathname === '') return '/survey/he/';
  if (pathname === '/he' || pathname === '/he/') return '/survey/he/';
  if (pathname === '/en' || pathname === '/en/') return '/survey/en/';
  if (pathname === '/es' || pathname === '/es/') return '/survey/es/';
  return null;
}

export const config = {
  matcher: ['/', '/he', '/he/', '/en', '/en/', '/es', '/es/']
};

export default function middleware(request) {
  const url = new URL(request.url);
  const dest = surveyDestination(request.headers.get('host'), url.pathname);
  if (!dest) return next();
  const target = new URL(dest, request.url);
  target.search = url.search;
  return rewrite(target);
}
