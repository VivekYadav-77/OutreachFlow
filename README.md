# Local Gmail Outreach Automation System

Production-minded local app for legitimate personalized outreach through the official Gmail API.

## Prerequisites

- Node.js 22+
- Local PostgreSQL
- Google OAuth credentials with Gmail API enabled

## Setup

1. Copy `.env.example` to `server/.env` and fill in real values.
2. Create the PostgreSQL database referenced by `DATABASE_URL`.
3. Install dependencies:

```bash
npm install
```

4. Run migrations:

```bash
npm run db:migrate
```

5. Start the app:

```bash
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:4000`

## Compliance Notes

This project uses only the official Gmail API and OAuth 2.0. It does not use Gmail passwords, browser automation, Gmail web scraping, Selenium, Puppeteer, or Playwright. Sending limits and delays are user-configurable and are enforced locally; they are not intended to bypass Gmail policies or provider quotas.
