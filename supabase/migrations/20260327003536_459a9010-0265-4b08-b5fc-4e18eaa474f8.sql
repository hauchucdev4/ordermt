
-- SuperAdmin can view all menu_items
CREATE POLICY "Superadmins can view all menu items" ON public.menu_items
FOR SELECT TO public
USING (has_role(auth.uid(), 'superadmin'));

-- SuperAdmin can view all tables
CREATE POLICY "Superadmins can view all tables" ON public.tables
FOR SELECT TO public
USING (has_role(auth.uid(), 'superadmin'));

-- SuperAdmin can view all orders
CREATE POLICY "Superadmins can view all orders" ON public.orders
FOR SELECT TO public
USING (has_role(auth.uid(), 'superadmin'));

-- SuperAdmin can view all order_items
CREATE POLICY "Superadmins can view all order items" ON public.order_items
FOR SELECT TO public
USING (has_role(auth.uid(), 'superadmin'));
