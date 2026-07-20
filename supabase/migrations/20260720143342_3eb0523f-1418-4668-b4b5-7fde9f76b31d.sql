INSERT INTO public.floors (number, name, theme, layout, source_type)
SELECT 99, '遊戲區', 'dark', 'rect4', 'manual'
WHERE NOT EXISTS (SELECT 1 FROM public.floors WHERE number = 99);