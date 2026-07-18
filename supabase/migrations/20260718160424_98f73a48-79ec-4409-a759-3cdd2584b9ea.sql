
CREATE TABLE public.floors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  number integer NOT NULL UNIQUE,
  name text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT 'wood',
  layout text NOT NULL DEFAULT 'rect4',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.floors TO anon, authenticated;
GRANT ALL ON public.floors TO service_role;

ALTER TABLE public.floors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Floors are viewable by everyone"
  ON public.floors FOR SELECT
  USING (true);

-- Seed default 1F
INSERT INTO public.floors (number, name, theme, layout)
VALUES (1, '1F 畫廊', 'wood', 'rect4');

-- Add floor_id to artworks
ALTER TABLE public.artworks
  ADD COLUMN floor_id uuid REFERENCES public.floors(id) ON DELETE RESTRICT;

-- Backfill: all existing artworks -> 1F
UPDATE public.artworks
SET floor_id = (SELECT id FROM public.floors WHERE number = 1);

ALTER TABLE public.artworks
  ALTER COLUMN floor_id SET NOT NULL;

CREATE INDEX idx_artworks_floor_id ON public.artworks(floor_id);
