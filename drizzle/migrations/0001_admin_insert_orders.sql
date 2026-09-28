CREATE POLICY "Admins can create orders" ON public.orders FOR INSERT TO authenticated
WITH CHECK (restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid() AND r.deleted_at IS NULL));
CREATE POLICY "Admins can create order items" ON public.order_items FOR INSERT TO authenticated
WITH CHECK (order_id IN (SELECT o.id FROM public.orders o JOIN public.restaurants r ON r.id = o.restaurant_id WHERE r.admin_id = auth.uid()));