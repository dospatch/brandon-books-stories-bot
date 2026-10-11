# Brandon Books & Stories

Discord bot and community system for **Brandon D. Coleman Jr. — Books & Stories**.

**Tagline:** 📖 Real Stories • Bigger Purpose

This repository powers the Brandon Books & Stories Discord community, including server setup, community information, applications, reader reviews, private feedback, announcements, deployment notifications, and the connected public website.

## Project Structure

```
brandon-books-stories-bot/
├── .github/
│   └── workflows/
│       └── deploy-notification.yml
├── src/
│   ├── index.js
│   ├── applications.js
│   └── reviews.js
├── website/
│   ├── index.html
│   ├── styles.css
│   ├── changelog.html
│   └── changelog.js
├── .env.example
├── CHANGELOG.md
├── Dockerfile
├── package.json
├── railway.json
└── README.md
```

## Discord Bot Features

### Community Commands

- `/help` — View available bot commands.
- `/ping` — Check bot response.
- `/books` — Browse the five-book series and official purchase information.
- `/recommend` — Get a reading recommendation by theme.
- `/about` — Learn about Brandon and the creative project.
- `/aboutmedia` — Show official media links.
- `/community` — Learn how members can participate.
- `/website` — Access the public Books & Stories website.
- `/serverinfo` — View community server information.
- `/announce` — Post an official community announcement (owner only).
- `/authorupdate` — Publish an author or creative-project update (owner only).
- `/giveaway` — Publish a giveaway announcement (owner only; entry tracking is manual).
- `/promotion` — Post the current Book 1 promotion (owner only).
- `/publishingupdate` — Post the latest publishing update (owner only).
- `/readerprompt` — Post a discussion starter (staff only).
- `/setup-author-server` — Set up the intended community structure (owner only).
- `/staff` — Open the private staff dashboard.
- `/apply` — Start a private community application.
- `/review` — Submit a reader review for a book.
- `/feedback` — Send private feedback to staff.
- `/ping` and `/help` — Check bot response and list commands.

## Reader Reviews

The `/review` system lets readers select a book and submit a 1–5 rating, written review, and optional favorite part. Approved submissions are published to `⭐・reader-reviews`.

Website reviews use the Vercel `/api/review` endpoint and are forwarded to the running Discord bot's `/reviews/webhook` endpoint, where they are posted automatically in `⭐・reader-reviews`.

## Amazon Review Alerts

The bot accepts authenticated review-alert events at `POST /amazon-reviews/webhook` and posts them to `⭐・amazon-reviews`. Configure `AMAZON_REVIEW_WEBHOOK_SECRET` in the hosting environment and send it as the `x-amazon-review-secret` header. Payload fields: `book` (required), `rating` (1–5), `url` (HTTPS public Amazon review/listing URL), and optional `reviewerName`, `title`, `review`, `asin`, `date`, and `id`. Duplicate events are suppressed using the supplied review ID or URL.

**Important:** This webhook is the Discord delivery endpoint, not an Amazon review feed. Amazon's Customer Feedback API provides aggregated review-topic insights rather than a general real-time feed of individual public reviews. Connect a permitted review-monitoring source that can send webhooks before expecting automatic detections. Only include reviewer information publicly displayed by Amazon; do not send private personal data.

## Deployment Verification

The production bot registers its slash commands directly to the Brandon Books & Stories guild on startup. The current command set includes `/staff`, and the website review bridge is configured for automatic delivery to Discord.

## Project

**Brandon D. Coleman Jr. — Books & Stories**

📖 Real Stories • Bigger Purpose


<!-- Deployment trigger: staff dashboard + website review bridge -->
