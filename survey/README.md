# בדיקת AI לעסק

Hebrew quiz for the 20 Nov 2026 networking event. The English site is unchanged. Host rewrites run only when the request host is `survey.gobizit.ai`.

| Where | URL |
| --- | --- |
| This repo | `survey/he/index.html` and `survey/he/gift-ai-prompts-he.pdf` |
| Every deployment, including preview | `/survey/he/` |
| Production, after the domain below is added | `https://survey.gobizit.ai/he` |

`https://survey.gobizit.ai/` and `https://survey.gobizit.ai/he/` serve the same page. The PDF link on the result screen is relative (`gift-ai-prompts-he.pdf`), so it resolves next to the page on both URLs.

The recommend API is `POST /api/survey-recommend/` on the same host. The trailing slash matches this project's `trailingSlash` setting, and a rewrite passes that path to the function. It is not rewritten onto the quiz folder.

## Cloudflare DNS

In the `gobizit.ai` zone, add:

| Type | Name | Target | Proxy status |
| --- | --- | --- | --- |
| CNAME | `survey` | `cname.vercel-dns.com` | DNS only (grey cloud) |

If the Vercel domain screen shows a different CNAME target, use that target.

Leave the record unproxied. An orange-cloud record sits in front of Vercel and usually blocks certificate issuance for the new hostname. TTL can stay on Auto.

## Vercel domain

On the existing project that already serves `gobizit.ai` (the `gobizitai` project). Do not create a second project.

1. Settings → Domains → Add `survey.gobizit.ai`.
2. Point it at Production. Do not turn it into a redirect to `gobizit.ai`.
3. Wait until the domain status is valid and Vercel has issued the certificate.
4. Open `https://survey.gobizit.ai/he` and confirm the Hebrew quiz. Open `https://gobizit.ai/` and confirm the English homepage is unchanged.

No further code change is required after the CNAME and the domain are in place.

## Environment variables

Set these in the Vercel project. Do not commit the values. Nobody in this change created a key.

| Name | Required | Purpose |
| --- | --- | --- |
| `AI_PROVIDER` | No | `anthropic` (preferred) or `openai`. When unset, Anthropic is used if `ANTHROPIC_API_KEY` is set, otherwise OpenAI if `OPENAI_API_KEY` is set. |
| `ANTHROPIC_API_KEY` | For Anthropic | Danny's Anthropic key. |
| `OPENAI_API_KEY` | For OpenAI | Danny's OpenAI key. |
| `ANTHROPIC_MODEL` | No | Default `claude-haiku-5-5` (cheap, fast). |
| `OPENAI_MODEL` | No | Default `gpt-6-luna` (cheap, fast). |
| `AI_MODEL` | No | Overrides the model for the selected provider. |

If `AI_PROVIDER=anthropic` and only the OpenAI key is set, the endpoint does not silently switch providers.

Apply the variables to Production when the real recommendations should go live. A deployment with no key still serves the quiz: the endpoint returns `{ "source": "rules", "fallback": true }` and the page keeps the built-in recommendation.

The server calls Anthropic `POST https://api.anthropic.com/v1/messages` or OpenAI `POST https://api.openai.com/v1/chat/completions`. The upstream call is aborted at 8 seconds. A timeout, HTTP error, or unusable reply uses the same silent fallback.

The model receives the eight answer indexes (as the fixed Hebrew labels), the score and level computed on the server, the level's rule, and the optional website string. It does not receive the name or email. The website is not fetched. Leads are not stored: `postLead` in the page is a stub for a later Zoho CRM connection and does not send or log personal data.

In-memory abuse limits, per function instance: body at most 8 KB, 30 requests per 10 minutes per IP, and 120 requests per minute overall. A shared venue network should still get through. Over the limit, the page falls back to the rule-based result.
