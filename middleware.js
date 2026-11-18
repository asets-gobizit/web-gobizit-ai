import { next, rewrite } from '@vercel/functions';
import { createRequire } from 'node:module';

const { surveyDestination } = createRequire(import.meta.url)('./survey/host-route.js');

export const config = {
  runtime: 'nodejs',
  matcher: ['/', '/he', '/he/:path*', '/en', '/en/:path*', '/es', '/es/:path*']
};

export default function middleware(request) {
  const url = new URL(request.url);
  const dest = surveyDestination(request.headers.get('host'), url.pathname);
  if (!dest) return next();
  const target = new URL(dest, request.url);
  target.search = url.search;
  return rewrite(target);
}
