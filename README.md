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
- `/books` — View the books and project information.
- `/about` — Learn about Brandon and the creative project.
- `/aboutmedia` — Show official media links.
- `/community` — Learn how members can participate.
- `/website` — Access the public Books & Stories website.
- `/serverinfo` — View community server information.
- `/announce` — Post an official community announcement.
- `/promotion` — Post the current Book 1 promotion.
- `/publishingupdate` — Post the latest publishing update.
- `/setup-author-server` — Set up the intended community structure.
- `/staff` — Open the private staff dashboard.
- `/apply` — Start a private community application.
- `/review` — Submit a reader review for a book.
- `/feedback` — Send private feedback to staff.

## Reader Reviews

The `/review` system lets readers select a book and submit a 1–5 rating, written review, and optional favorite part. Approved submissions are published to `⭐・reader-reviews`.

Website reviews use the Vercel `/api/review` endpoint and are forwarded to the running Discord bot's `/reviews/webhook` endpoint, where they are posted automatically in `⭐・reader-reviews`.

## Deployment Verification

The production bot registers its slash commands directly to the Brandon Books & Stories guild on startup. The current command set includes `/staff`, and the website review bridge is configured for automatic delivery to Discord.

## Project

**Brandon D. Coleman Jr. — Books & Stories**

📖 Real Stories • Bigger Purpose


<!-- Deployment trigger: staff dashboard + website review bridge -->
