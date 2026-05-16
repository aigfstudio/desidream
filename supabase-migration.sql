-- ============================================================
-- AIGFStudio — Supabase SQL Migration
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Enums ────────────────────────────────────────────────────────────────────

CREATE TYPE face_status AS ENUM ('pending', 'processing', 'done', 'failed');
CREATE TYPE job_status AS ENUM ('queued', 'processing', 'done', 'failed');
CREATE TYPE batch_status AS ENUM ('running', 'paused', 'completed', 'failed');

-- ─── Tables ───────────────────────────────────────────────────────────────────

CREATE TABLE faces (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label       TEXT NOT NULL,
  storage_url TEXT NOT NULL,
  status      face_status NOT NULL DEFAULT 'pending',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE prompts (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  style_name  TEXT NOT NULL,
  pose_name   TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE batch_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  total_jobs     INT NOT NULL DEFAULT 0,
  completed_jobs INT NOT NULL DEFAULT 0,
  failed_jobs    INT NOT NULL DEFAULT 0,
  started_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         batch_status NOT NULL DEFAULT 'running'
);

CREATE TABLE generation_jobs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  face_id             UUID NOT NULL REFERENCES faces(id) ON DELETE CASCADE,
  prompt_id           UUID NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
  batch_session_id    UUID REFERENCES batch_sessions(id) ON DELETE SET NULL,
  status              job_status NOT NULL DEFAULT 'queued',
  cloudinary_url      TEXT,
  cloudinary_public_id TEXT,
  error_message       TEXT,
  retry_count         INT NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at        TIMESTAMPTZ
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX idx_generation_jobs_status     ON generation_jobs(status);
CREATE INDEX idx_generation_jobs_face_id    ON generation_jobs(face_id);
CREATE INDEX idx_generation_jobs_session_id ON generation_jobs(batch_session_id);
CREATE INDEX idx_faces_status               ON faces(status);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE faces            ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompts          ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_jobs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_sessions   ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users full access (single admin app)
CREATE POLICY "admin_all" ON faces           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON prompts         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON generation_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "admin_all" ON batch_sessions  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── Storage Bucket ───────────────────────────────────────────────────────────

-- Run this separately in Supabase Dashboard → Storage → New Bucket
-- Bucket name: "faces"  (public: false)

-- ─── Realtime ─────────────────────────────────────────────────────────────────

-- Enable realtime on batch_sessions for live progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE batch_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE generation_jobs;

-- ─── Helper Functions ─────────────────────────────────────────────────────────

-- Function to get current batch stats
CREATE OR REPLACE FUNCTION get_batch_stats(session_id UUID)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total',      COUNT(*),
    'queued',     COUNT(*) FILTER (WHERE status = 'queued'),
    'processing', COUNT(*) FILTER (WHERE status = 'processing'),
    'done',       COUNT(*) FILTER (WHERE status = 'done'),
    'failed',     COUNT(*) FILTER (WHERE status = 'failed')
  ) INTO result
  FROM generation_jobs
  WHERE batch_session_id = session_id;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ─── Seed Default Prompts ─────────────────────────────────────────────────────
-- This is seeded via the app's /api/prompts/seed route,
-- but you can also run it manually here:

/*
INSERT INTO prompts (style_name, pose_name, prompt_text) VALUES
('Realistic',     'Casual Smile',         'Ultra-realistic portrait, soft studio lighting, casual warm smile, bokeh background, 4K quality, photorealistic skin texture'),
('Anime',         'Looking Away',         'Anime art style, cel-shaded illustration, looking to the side pensively, soft pastel background, detailed flowing hair, Studio Ghibli quality'),
('Oil Painting',  'Regal Seated',         'Classical oil painting style, seated pose, regal elegant posture, Renaissance-era aesthetic, rich warm tones, Rembrandt lighting'),
('Cyberpunk',     'City Night',           'Cyberpunk aesthetic, neon-lit city background, night scene, glowing cybernetic accents, futuristic street fashion, rain reflections'),
('Watercolor',    'Outdoor Garden',       'Soft watercolor painting, outdoor garden setting, natural golden lighting, flowy summer dress, pastel color palette, impressionistic style'),
('Studio Photo',  'Professional Headshot','Professional headshot photography, clean white background, business casual attire, confident warm expression, sharp focus, commercial quality'),
('Fantasy',       'Warrior Stance',       'High fantasy digital art, powerful warrior stance, ornate armor and weapon, dramatic cinematic lighting, epic mountain landscape background'),
('Vintage Film',  'Candid Laughing',      '1970s vintage film grain aesthetic, candid authentic laughing moment, warm golden Kodachrome tones, natural outdoor summer light'),
('Streetwear',    'Urban Cool',           'Modern streetwear fashion editorial, urban city setting, graffiti mural wall, cool confident pose, golden hour photography'),
('Ethereal',      'Eyes Closed Peaceful', 'Ethereal dreamy soft portrait, gentle glow, eyes closed in peace, floating cherry blossoms, pastel purple and pink tones'),
('Black and White','Dramatic Shadow',     'High contrast black and white portrait photography, dramatic Rembrandt shadows, moody introspective expression, cinematic framing'),
('Cottage Core',  'Reading in Nature',    'Cottage core aesthetic, reading a leather book in a sunlit meadow, white floral dress, soft warm morning sunlight, wildflowers'),
('Korean Drama',  'Shy Smile',            'Korean drama style portrait, soft dewy glass skin, shy warm smile, pink cherry blossom tree background, clean beauty makeup'),
('Futuristic',    'Holographic',          'Sci-fi futuristic portrait, holographic digital overlays, sleek metallic bodysuit, deep space nebula background, digital glitch effects'),
('Impressionist', 'Walking in Rain',      'French Impressionist painting style, walking with umbrella in rain, cobblestone Paris street, Monet-inspired color palette'),
('Gothic',        'Mysterious',           'Gothic dark romantic portrait, dramatic dark makeup, mysterious alluring expression, old stone castle background, candlelight'),
('Boho',          'Sunset Beach',         'Bohemian free-spirit style, golden sunset beach, flowy linen clothes, warm orange golden hour glow, relaxed carefree pose'),
('Pop Art',       'Bold Graphic',         'Andy Warhol pop art style, bold saturated block colors, halftone dot pattern, graphic comic outlines, vibrant neon background'),
('Cinematic',     'Action Scene',         'Hollywood blockbuster cinematic portrait, action hero pose, dramatic directional lighting, shallow depth of field, motion blur'),
('Minimalist',    'Clean Aesthetic',      'Ultra minimalist portrait, pure white seamless background, simple monochrome outfit, perfect even lighting, no clutter, high-end fashion editorial');
*/
