ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS max_restaurants integer NOT NULL DEFAULT 2;

CREATE OR REPLACE FUNCTION public.guard_max_restaurants()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.max_restaurants IS DISTINCT FROM OLD.max_restaurants
     AND NOT public.has_role(auth.uid(), 'superadmin') AND auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Chỉ superadmin được thay đổi giới hạn nhà hàng';
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_guard_max_restaurants ON public.profiles;
CREATE TRIGGER trg_guard_max_restaurants BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_max_restaurants();

CREATE OR REPLACE FUNCTION public.enforce_restaurant_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE lim integer; cnt integer;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.deleted_at IS NULL THEN RETURN NEW; END IF;
  SELECT max_restaurants INTO lim FROM public.profiles WHERE id = NEW.admin_id;
  SELECT count(*) INTO cnt FROM public.restaurants
    WHERE admin_id = NEW.admin_id AND deleted_at IS NULL AND id <> NEW.id;
  IF cnt >= COALESCE(lim, 2) THEN
    RAISE EXCEPTION 'Đã đạt giới hạn % nhà hàng. Liên hệ superadmin để mở thêm.', COALESCE(lim, 2);
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_enforce_restaurant_limit ON public.restaurants;
CREATE TRIGGER trg_enforce_restaurant_limit BEFORE INSERT OR UPDATE OF deleted_at ON public.restaurants
FOR EACH ROW EXECUTE FUNCTION public.enforce_restaurant_limit();