# AIGFStudio — Bulk AI Image Generation Pipeline

Generate 4,000 AI images from 200 faces using Google Gemini + Cloudinary.

## Architecture

```
200 faces × 20 prompts = 4,000 images

Upload faces → Supabase Storage
Store prompts → Supabase DB
Generate images → Google Gemini API (5 concurrent workers)
Save images → Cloudinary (organized by face/style)
Track jobs → Supabase DB (real-time progress)
```

## Quick Setup (15 minutes)

### 1. Clone and install
```bash
git clone <repo>
cd aigf-studio
npm install
cp .env.example .env.local
# Fill in your API keys in .env.local
```

### 2. Set up Supabase
1. Create project at https://supabase.com
2. Go to SQL Editor → paste contents of `supabase-migration.sql` → Run
3. Go to Storage → New Bucket → name it `faces` → set to private
4. Copy your URL and keys to `.env.local`

### 3. Set up Google Gemini
1. Go to https://aistudio.google.com/app/apikey
2. Create API key → copy to `GEMINI_API_KEY` in `.env.local`
3. Make sure billing is enabled on your Google Cloud project

### 4. Set up Cloudinary
1. Create account at https://cloudinary.com
2. Go to Dashboard → copy Cloud Name, API Key, API Secret
3. Add to `.env.local`

### 5. Run the app
```bash
npm run dev
# Open http://localhost:3000/dashboard
```

### 6. First-time workflow
1. **Prompts page** → Click "Seed 20 Default Prompts"
2. **Faces page** → Drag & drop up to 200 face images
3. **Dashboard** → Click "Start New Batch"
4. Watch the progress bar fill up!
5. **Gallery** → View and download all generated images

---

## File Structure

```
aigf-studio/
├── app/
│   ├── (dashboard)/
│   │   ├── dashboard/page.tsx    ← Live progress dashboard
│   │   ├── faces/page.tsx        ← Upload 200 face images
│   │   ├── prompts/page.tsx      ← Manage 20 style prompts
│   │   ├── gallery/page.tsx      ← View all generated images
│   │   └── jobs/page.tsx         ← Job queue monitor
│   └── api/
│       ├── batch/start/          ← POST: Start generation batch
│       ├── batch/pause/          ← POST: Pause batch
│       ├── batch/status/         ← GET: Live status + stats
│       ├── faces/upload/         ← POST: Upload face images
│       ├── prompts/seed/         ← POST: Seed default prompts
│       └── jobs/retry-failed/    ← POST: Retry / GET: Export CSV
├── lib/
│   ├── supabase.ts              ← Supabase client + helpers
│   ├── gemini.ts                ← Gemini API + retry logic
│   ├── cloudinary.ts            ← Cloudinary upload + gallery
│   └── queue.ts                 ← Concurrent worker (5 parallel)
├── types/index.ts               ← All TypeScript types + 20 prompts
├── supabase-migration.sql       ← Run this in Supabase SQL Editor
├── .env.example                 ← Copy to .env.local
└── package.json
```

---

## Cost Estimate

| Images | Gemini Model | Estimated Cost |
|--------|-------------|----------------|
| 4,000  | Gemini 2.0 Flash | ~$160–$200 |
| 4,000  | Gemini 1.5 Flash | ~$8–$40    |

*Use `gemini-1.5-flash` in `lib/gemini.ts` for lower cost with slightly lower quality.*

---

## Troubleshooting

**"Gemini did not return an image"**
→ Make sure billing is enabled on Google Cloud. Imagen requires paid tier.

**Rate limit errors (429)**  
→ Queue automatically waits 60s and retries. Reduce CONCURRENCY in `lib/queue.ts` from 5 to 2.

**Upload fails for large batches**
→ Supabase free tier has 1GB storage. Upgrade or use a smaller batch.

**Cloudinary images not appearing in gallery**
→ Check that your Cloudinary credentials are correct. Images are stored under `aigf/{face_label}/{style}`.
