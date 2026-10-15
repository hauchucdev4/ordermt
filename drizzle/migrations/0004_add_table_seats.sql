ALTER TABLE public.tables ADD COLUMN seats integer;
ALTER TABLE public.tables ADD CONSTRAINT tables_seats_positive CHECK (seats IS NULL OR (seats >= 1 AND seats <= 999));
COMMENT ON COLUMN public.tables.seats IS 'Seat capacity; null means not yet specified for existing or imported tables.';