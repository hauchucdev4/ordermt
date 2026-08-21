ALTER TABLE public.restaurants ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

DROP POLICY IF EXISTS "Staff can view their restaurant" ON public.restaurants;
CREATE POLICY "Staff can view their restaurant"
ON public.restaurants FOR SELECT
USING (id = public.get_user_restaurant(auth.uid()) AND deleted_at IS NULL);

CREATE OR REPLACE FUNCTION public.purge_expired_restaurants()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rid uuid;
  cnt integer := 0;
BEGIN
  FOR rid IN
    SELECT id FROM public.restaurants
    WHERE admin_id = auth.uid()
      AND deleted_at IS NOT NULL
      AND deleted_at < now() - interval '15 days'
  LOOP
    DELETE FROM public.order_items WHERE order_id IN (SELECT id FROM public.orders WHERE restaurant_id = rid);
    DELETE FROM public.orders WHERE restaurant_id = rid;
    DELETE FROM public.recipe_batches WHERE restaurant_id = rid;
    DELETE FROM public.recipe_ingredients WHERE recipe_id IN (SELECT id FROM public.recipes WHERE restaurant_id = rid);
    DELETE FROM public.recipes WHERE restaurant_id = rid;
    DELETE FROM public.menu_items WHERE restaurant_id = rid;
    DELETE FROM public.tables WHERE restaurant_id = rid;
    UPDATE public.profiles SET restaurant_id = NULL WHERE restaurant_id = rid;
    DELETE FROM public.restaurants WHERE id = rid;
    cnt := cnt + 1;
  END LOOP;
  RETURN cnt;
END;
$$;

REVOKE ALL ON FUNCTION public.purge_expired_restaurants() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_restaurants() TO authenticated;