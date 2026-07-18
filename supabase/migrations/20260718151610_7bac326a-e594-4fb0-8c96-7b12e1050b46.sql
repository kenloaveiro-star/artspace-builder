
CREATE TABLE public.artworks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL DEFAULT '',
  storage_path TEXT NOT NULL,
  width INT NOT NULL,
  height INT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.artworks TO anon;
GRANT SELECT ON public.artworks TO authenticated;
GRANT ALL ON public.artworks TO service_role;

ALTER TABLE public.artworks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Artworks are viewable by everyone"
  ON public.artworks FOR SELECT
  USING (true);
