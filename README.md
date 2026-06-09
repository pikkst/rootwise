<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Rootwise: Intergenerational Wisdom Hub

A SaaS platform connecting generations through collaborative **Quests**, shared wisdom, and **AI-powered** tools to combat loneliness and foster lifelong learning.

## Tech Stack

- **Frontend:** React 19 + TypeScript + Tailwind CSS 4 + Vite
- **Backend:** Supabase (PostgreSQL + Auth + RLS)
- **AI:** Google Gemini API (quest generation, AI mentor chat)
- **Deploy:** Cloudflare Pages via GitHub Actions
- **Routing:** React Router v7 (SEO-friendly URLs)

## Project Structure

```
├── App.tsx                  # Root component with React Router
├── index.tsx                # Entry point
├── types.ts                 # TypeScript types & Supabase DB types
├── components/
│   ├── Navigation.tsx       # Top/bottom navigation bar
│   ├── QuestCard.tsx        # Quest card component
│   ├── AuthGuard.tsx        # Protected route wrapper
│   └── SEOHead.tsx          # Dynamic meta tags for SEO
├── pages/
│   ├── LandingPage.tsx      # Public landing / marketing page
│   ├── AuthPage.tsx         # Login & registration
│   ├── DashboardPage.tsx    # User dashboard with stats
│   ├── QuestsPage.tsx       # Browse & create quests
│   ├── CommunityPage.tsx    # Community groups
│   ├── AiNexusPage.tsx      # AI mentor chat
│   └── ProfilePage.tsx      # User profile management
├── services/
│   ├── supabase.ts          # Supabase client config
│   └── geminiService.ts     # Gemini AI service
├── hooks/
│   ├── useQuests.ts         # Quest CRUD operations
│   ├── useCommunities.ts    # Community membership
│   ├── useChatMessages.ts   # AI chat persistence
│   └── useConnections.ts    # Partner connections
├── context/
│   └── AuthContext.tsx       # Auth state management
├── public/
│   ├── _redirects            # Cloudflare SPA routing
│   ├── robots.txt            # SEO crawler rules
│   └── sitemap.xml           # SEO sitemap
├── .github/workflows/
│   └── deploy.yml            # GitHub Actions → Cloudflare Pages
└── supabase-schema.sql       # Database schema (run in Supabase SQL Editor)
```

## Setup

### 1. Install Node.js
Download from https://nodejs.org (LTS recommended)

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Supabase
1. Go to your [Supabase Dashboard](https://supabase.com/dashboard)
2. Open **SQL Editor** and paste the contents of `supabase-schema.sql`
3. Run the SQL to create all tables, RLS policies, and seed data

### 4. Set Environment Variables
Edit `.env.local`:
```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
GEMINI_API_KEY=your-gemini-api-key
```

### 5. Run Locally
```bash
npm run dev
```

### Local development and secret handling
- This repository is configured for a live deploy workflow where production secrets are provided by Cloudflare and Supabase at build/runtime.
- `local .env` may be intentionally empty in the repository. If you run locally, populate your local environment with the required variables first.
- Required variables for local development and production builds:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
  - `GEMINI_API_KEY` (for AI features)
- The project now fails fast if required client or server environment variables are missing, so missing config is detected immediately instead of causing hidden runtime failures.

## Deployment (Cloudflare Pages)

### Why Cloudflare Pages instead of GitHub Pages?
- **SEO-friendly**: proper HTTP headers, redirects, custom 404/SPA fallback
- **Global CDN**: edge-cached in 300+ locations
- **Custom domains**: free SSL, easy DNS config
- **Free tier**: unlimited sites, 500 builds/month

### Setup Steps
1. Create a [Cloudflare account](https://dash.cloudflare.com)
2. Create an [API token](https://dash.cloudflare.com/profile/api-tokens) with "Cloudflare Pages: Edit" permissions
3. Add these GitHub repository **Secrets** (Settings > Secrets):
   - `CLOUDFLARE_ACCOUNT_ID`
   - `CLOUDFLARE_API_TOKEN`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `GEMINI_API_KEY`
4. Push to `main` branch → auto-deploys!

### Custom Domain
After first deploy:
1. Go to Cloudflare Pages → your project → Custom domains
2. Add your domain
3. Update DNS records as instructed
