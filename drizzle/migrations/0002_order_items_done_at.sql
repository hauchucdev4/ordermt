ALTER TABLE public.order_items ADD COLUMN IF NOT EXISTS done_at timestamptz;
UPDATE public.order_items SET done_at = created_at WHERE status = 'done' AND done_at IS NULL;
CREATE OR REPLACE FUNCTION public.set_order_item_done_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'done' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'done') THEN
    NEW.done_at = now();
  ELSIF NEW.status <> 'done' THEN
    NEW.done_at = NULL;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS trg_order_item_done_at ON public.order_items;
CREATE TRIGGER trg_order_item_done_at BEFORE INSERT OR UPDATE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.set_order_item_done_at();
CREATE INDEX IF NOT EXISTS idx_order_items_done_at ON public.order_items(done_at);