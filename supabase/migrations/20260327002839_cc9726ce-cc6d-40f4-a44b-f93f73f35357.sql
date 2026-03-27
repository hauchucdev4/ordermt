
-- Manager can manage tables (insert, update, delete) for their restaurant
CREATE POLICY "Managers can insert tables" ON public.tables
FOR INSERT TO public
WITH CHECK (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

CREATE POLICY "Managers can update tables" ON public.tables
FOR UPDATE TO public
USING (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

CREATE POLICY "Managers can delete tables" ON public.tables
FOR DELETE TO public
USING (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

-- Manager can manage menu items for their restaurant
CREATE POLICY "Managers can insert menu items" ON public.menu_items
FOR INSERT TO public
WITH CHECK (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

CREATE POLICY "Managers can update menu items" ON public.menu_items
FOR UPDATE TO public
USING (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

CREATE POLICY "Managers can delete menu items" ON public.menu_items
FOR DELETE TO public
USING (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

-- Manager can create orders (for their restaurant)
CREATE POLICY "Managers can create orders" ON public.orders
FOR INSERT TO public
WITH CHECK (
  get_user_role(auth.uid()) = 'manager'
  AND restaurant_id = get_user_restaurant(auth.uid())
);

-- Manager can insert order items
CREATE POLICY "Managers can insert order items" ON public.order_items
FOR INSERT TO public
WITH CHECK (
  order_id IN (
    SELECT o.id FROM orders o
    WHERE o.restaurant_id = get_user_restaurant(auth.uid())
  )
  AND get_user_role(auth.uid()) = 'manager'
);
