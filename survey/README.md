# בדיקת AI לעסק

Hebrew quiz for the 20 Nov 2026 networking event. The English site is unchanged. Host rewrites run only when the request host is `survey.gobizit.ai`.

| Where | URL |
| --- | --- |
| This repo | `survey/he/index.html` and `survey/he/gift-ai-prompts-he.pdf` |
| Every deployment, including preview | `/survey/he/` |
| Production, after the domain below is added | `https://survey.gobizit.ai/he` |
| English | `/survey/en/` and `https://survey.gobizit.ai/en` |
| Spanish (Spain) | `/survey/es/` and `https://survey.gobizit.ai/es` |

Hebrew stays right to left. English and Spanish are left to right. A language picker at the top links `/he`, `/en`, and `/es` on `survey.gobizit.ai`, and `/survey/he/`, `/survey/en/`, `/survey/es/` on every other host. Amounts on all three pages, including the missed-enquiry calculator and the lead email, use euros (`€24,356`). The recommendation is written in the page language. The root of `survey.gobizit.ai` still opens the Hebrew quiz.

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

The server calls Anthropic `POST https://api.anthropic.com/v1/messages` or OpenAI `POST https://api.openai.com/v1/chat/completions`. The upstream call is aborted at 12 seconds. A missing key, a timeout, an out-of-credit response, or any other model error uses the same silent fallback. The visitor's screen does not say that the model failed. The lead email to neo@ starts, in Hebrew on every language, with `✨ המלצה מותאמת אישית (AI)` or `📋 המלצה כללית (ללא AI)` plus `סיבה: אין מפתח API`, `סיבה: אין קרדיט`, `סיבה: תם הזמן`, or `סיבה: שגיאת AI`.

The model receives the eight answers as the fixed Hebrew labels, the score and level computed on the server, the level's rule, and the optional website string. It does not receive the name, email, or general comment. The website is not fetched.

## Multi-select scoring

Questions 2, 4, 5, 6, and 7 stay single-select. Each is a level or a range, and the points are the chosen index, 0 to 3.

Questions 1, 3, and 8 allow several answers. A hint says "אפשר לבחור כמה", the options use a checkbox, and "המשך" moves on.

- Question 1 (business type) is not scored. If "קליניקה או שירות שעובד עם תורים" is among the choices, chapter 06 is added.
- Question 3 (where leads live) is scored. One choice keeps its 0–3 points. Several choices score `min(2, highest choice)`. A split between places does not get the 3 points reserved for an up-to-date CRM that is the only system. If "וואטסאפ, מחברת או בראש" is among the choices, the level does not rise above B. If an up-to-date CRM is among the choices and the total score is 6 or less, the level rises to B.
- Question 8 (pains) is not scored. Each selected pain adds its booklet chapter and its diagnostic-call direction.

Questions 2, 4, and 5 still add the same website, response-time, and manual-hours notes as before.

## Lead email

`POST /api/survey-lead/` sends one plain-text email per completed quiz. The page calls it after the result is on screen, including whether the visitor saw the AI steps or the rule-based steps. Mail failure does not change the result.

Set these in the Vercel project. Do not commit the values.

| Name | Required | Purpose |
| --- | --- | --- |
| `SMTP_HOST` | For SMTP | Zoho Mail: `smtp.zoho.eu` |
| `SMTP_PORT` | For SMTP | `465` (implicit TLS). 587 also works. |
| `SMTP_USER` | For SMTP | Zoho mailbox username. |
| `SMTP_PASS` | For SMTP | Zoho mailbox password or app password. |
| `MAIL_FROM` | For either sender | From address, for example `GoBizIT <info@gobizit.ai>`. |
| `LEAD_TO` | No | Inbox. Default `neo@gobizit.ai`. |
| `RESEND_API_KEY` | Alternative | Used only when the SMTP host, user, and password are not all set. Still needs `MAIL_FROM`. |

SMTP is preferred. If neither SMTP nor Resend is configured, the route logs `survey-lead skipped not_configured` and returns without the visitor's details. The log line does not include the name, email, or comment.

The message includes the name, email, website, consent, every question with the chosen answers, the general comment (up to 1000 characters), score, level, the recommendation that was shown, whether that recommendation came from AI or the rules, the Jerusalem timestamp, and a short explanation of how the score and level were reached. If an AI key is configured, that explanation may be a short rewrite of the scoring facts. Otherwise it is written from the rules. The model does not receive the name or email.

Abuse limits on the lead route, per function instance: body at most 16 KB, a honeypot field, 20 requests per 10 minutes per IP, and 60 requests per minute overall.

In-memory limits on the recommendation route stay: body at most 8 KB, 30 requests per 10 minutes per IP, and 120 requests per minute overall.
