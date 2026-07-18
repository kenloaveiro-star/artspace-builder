-- Task 1: Feature 2 AI floors — schema additions

ALTER TABLE public.floors
  ADD COLUMN IF NOT EXISTS source_type text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS scene_json jsonb;

ALTER TABLE public.floors
  ADD CONSTRAINT floors_source_type_check
  CHECK (source_type IN ('manual', 'ai_text', 'ai_photo'));

CREATE TABLE public.floor_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  floor_id uuid NOT NULL REFERENCES public.floors(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('preset', 'sprite')),
  preset_id text,
  image_path text,
  color text,
  x double precision NOT NULL DEFAULT 0,
  y double precision NOT NULL DEFAULT 0,
  z double precision NOT NULL DEFAULT 0,
  rotation_y double precision NOT NULL DEFAULT 0,
  scale double precision NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.floor_assets TO anon, authenticated;
GRANT ALL ON public.floor_assets TO service_role;

ALTER TABLE public.floor_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Floor assets are viewable by everyone"
  ON public.floor_assets FOR SELECT
  USING (true);

CREATE INDEX floor_assets_floor_id_idx ON public.floor_assets(floor_id);