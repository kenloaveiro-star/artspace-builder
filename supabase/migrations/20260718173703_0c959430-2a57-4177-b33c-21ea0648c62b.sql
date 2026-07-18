ALTER TABLE public.floor_assets REPLICA IDENTITY FULL;
ALTER TABLE public.artworks REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.floor_assets;
ALTER PUBLICATION supabase_realtime ADD TABLE public.artworks;