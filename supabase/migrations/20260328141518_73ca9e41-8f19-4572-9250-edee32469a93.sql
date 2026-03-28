-- Staff can update tables (to set status occupied/empty when ordering)
CREATE POLICY "Staff can update tables"
ON public.tables
FOR UPDATE
TO authenticated
USING (
  get_user_role(auth.uid()) IN ('staff'::app_role, 'chef'::app_role)
  AND restaurant_id = get_user_restaurant(auth.uid())
);