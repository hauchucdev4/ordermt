CREATE OR REPLACE FUNCTION public.delete_order_item_and_reset(_item_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_table_id uuid;
  v_restaurant_id uuid;
  v_item_status public.order_item_status;
  v_role public.app_role;
  v_allowed boolean := false;
BEGIN
  SELECT oi.order_id, oi.status, o.table_id, o.restaurant_id
  INTO v_order_id, v_item_status, v_table_id, v_restaurant_id
  FROM public.order_items oi
  JOIN public.orders o ON o.id = oi.order_id
  WHERE oi.id = _item_id
    AND o.status = 'open';

  IF v_order_id IS NULL THEN
    RETURN false;
  END IF;

  v_role := public.get_user_role(auth.uid());
  v_allowed := public.has_role(auth.uid(), 'superadmin')
    OR EXISTS (
      SELECT 1 FROM public.restaurants r
      WHERE r.id = v_restaurant_id AND r.admin_id = auth.uid()
    )
    OR (public.get_user_restaurant(auth.uid()) = v_restaurant_id AND v_role = 'manager')
    OR (public.get_user_restaurant(auth.uid()) = v_restaurant_id AND v_role = 'staff' AND v_item_status = 'new');

  IF NOT v_allowed THEN
    RAISE EXCEPTION 'Bạn không có quyền xóa món này';
  END IF;

  DELETE FROM public.order_items WHERE id = _item_id;

  IF NOT EXISTS (SELECT 1 FROM public.order_items WHERE order_id = v_order_id) THEN
    DELETE FROM public.orders WHERE id = v_order_id AND status = 'open';
    UPDATE public.tables SET status = 'empty' WHERE id = v_table_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_order_item_and_reset(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_order_item_and_reset(uuid) TO service_role;