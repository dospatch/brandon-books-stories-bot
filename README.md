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
- `/community` — Learn how members can participate.
- `/website` — Access the public Books & Stories website.
- `/serverinfo` — View community server information.
- `/announce` — Post an official community announcement.
- `/setup-author-server` — Set up the intended community structure.
- `/apply` — Start a private community application.
- `/review` — Submit a reader review for a book.
- `/feedback` — Send private feedback to staff.

## Applications

Members can apply through Discord for:

- ✍️ Author Team
- 🛡️ Moderator
- 📚 Book Reviewer

The application system provides:

1. Private application flow.
2. Discord DM instructions.
3. Application questions.
4. Private staff review channels.
5. Approve and Reject controls.
6. Applicant status updates through Discord DMs.

Reviewer access is limited to the configured Owner, Administrator, Moderator, and Author Team roles.

## Reader Reviews

The `/review` system lets readers select a book and submit:

- ⭐ Rating from 1–5
- 📝 Written review
- ❤️ Favorite part (optional)

Approved submissions are published to the `⭐・reader-reviews` channel.

## Private Feedback

The `/feedback` command provides a private feedback form.

Feedback is sent to the staff area with:

- Feedback category
- Member information
- Discord user ID
- Feedback message
- Timestamp

The member receives a private confirmation after submission.

## Discord Server Structure

The bot is designed around these community areas:

- 📌 **START HERE**
- 📚 **BOOKS**
- ✍️ **THE AUTHOR**
- 💬 **COMMUNITY**
- 📺 **MEDIA**
- 🤖 **BOT**
- 🔒 **STAFF**

The intended roles include:

- 👑 Owner
- 🛠️ Administrator
- 🛡️ Moderator
- ✍️ Author Team
- 📚 Reader
- ⭐ VIP Reader
- 🤖 Bot

The bot should not require Administrator permission when the required channel, role, and server permissions are configured correctly.

## Environment Variables

Create a `.env` file for local development or configure the equivalent variables in your hosting provider.

```env
DISCORD_TOKEN=your_bot_token
OWNER_ID=your_discord_user_id
WEBSITE_URL=https://your-website.example
BOOK_1_URL=
PART_2_URL=
BOT_UPDATES_CHANNEL_ID=
```

### Variable Reference

| Variable | Required | Purpose |
|---|---|---|
| `DISCORD_TOKEN` | Yes | Discord bot token |
| `OWNER_ID` | Yes | Discord user ID allowed to use owner-only functions |
| `WEBSITE_URL` | No | Public Books & Stories website |
| `BOOK_1_URL` | No | Purchase link for Book 1 |
| `PART_2_URL` | No | Purchase link for Part 2 |
| `BOT_UPDATES_CHANNEL_ID` | No | Channel for bot/deployment updates |

**Never commit a real Discord bot token to GitHub.**

## Installation

Requirements:

- Node.js 20 or newer
- npm
- A Discord application and bot
- A Discord server where the bot has been invited

Install dependencies:

```bash
npm install
```

Start the bot:

```bash
npm start
```

## Hosting

The bot is designed to run as a persistent Node.js service.

The current deployment can run through hosting such as **FadeHost**, with:

- Build command: `npm install`
- Start command: `npm start`
- Node.js: 22
- Port: `8080`

GitHub changes can be automatically redeployed by the connected hosting service.

## GitHub Automation

The repository includes:

`.github/workflows/deploy-notification.yml`

It can send Discord notifications when changes are pushed to the `main` branch.

Supported webhook secrets:

```
DISCORD_DEPLOY_WEBHOOK_URL
DISCORD_CHANGELOG_WEBHOOK_URL
```

These are configured as **GitHub Actions Secrets**, not normal application environment variables.

If a webhook secret is not configured, the workflow skips that notification instead of failing the deployment.

## Public Website

The repository also contains the public Books & Stories website:

- Main website
- About Brandon
- Books
- Stories & Writing
- Updates
- Media
- Contact
- Public project changelog

The website changelog reads project history from GitHub so public updates can reflect repository changes.

## Changelog

Project changes are documented in:

`CHANGELOG.md`

The public changelog is available through the website's Changelog page.

Changes are organized around:

- Added
- Improved
- Changed
- Updated

## Development Notes

The bot is built with:

- Node.js
- JavaScript
- discord.js v14
- dotenv

The project is intentionally organized so Discord commands, application handling, and review/feedback handling can be maintained separately.

## Safety & Configuration

- Keep `DISCORD_TOKEN` private.
- Keep GitHub webhook URLs private.
- Use Discord role permissions for staff access.
- Do not give the bot Administrator unless there is a specific operational reason.
- Test application, review, feedback, and announcement flows in the intended server before making major production changes.

## Project

**Brandon D. Coleman Jr. — Books & Stories**

📖 Real Stories • Bigger Purpose

The goal of this project is to create a welcoming community around books, stories, memories, writing, and creative projects.
