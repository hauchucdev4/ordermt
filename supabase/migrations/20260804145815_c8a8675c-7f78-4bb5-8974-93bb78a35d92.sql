CREATE TABLE public.recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name text NOT NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.recipes(id) ON DELETE CASCADE,
  name text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'g',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_recipes_restaurant ON public.recipes(restaurant_id);
CREATE INDEX idx_recipe_ingredients_recipe ON public.recipe_ingredients(recipe_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipes TO authenticated;
GRANT ALL ON public.recipes TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_ingredients TO authenticated;
GRANT ALL ON public.recipe_ingredients TO service_role;

ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recipe_ingredients ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_recipes(_restaurant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = _restaurant_id AND r.admin_id = auth.uid()
  ) OR (
    public.get_user_restaurant(auth.uid()) = _restaurant_id
    AND public.get_user_role(auth.uid()) = 'chef'::app_role
  )
$$;

CREATE POLICY "Recipe access select" ON public.recipes FOR SELECT TO authenticated
  USING (public.can_access_recipes(restaurant_id));
CREATE POLICY "Recipe access insert" ON public.recipes FOR INSERT TO authenticated
  WITH CHECK (public.can_access_recipes(restaurant_id));
CREATE POLICY "Recipe access update" ON public.recipes FOR UPDATE TO authenticated
  USING (public.can_access_recipes(restaurant_id));
CREATE POLICY "Recipe access delete" ON public.recipes FOR DELETE TO authenticated
  USING (public.can_access_recipes(restaurant_id));

CREATE POLICY "Recipe ing select" ON public.recipe_ingredients FOR SELECT TO authenticated
  USING (recipe_id IN (SELECT id FROM public.recipes WHERE public.can_access_recipes(restaurant_id)));
CREATE POLICY "Recipe ing insert" ON public.recipe_ingredients FOR INSERT TO authenticated
  WITH CHECK (recipe_id IN (SELECT id FROM public.recipes WHERE public.can_access_recipes(restaurant_id)));
CREATE POLICY "Recipe ing update" ON public.recipe_ingredients FOR UPDATE TO authenticated
  USING (recipe_id IN (SELECT id FROM public.recipes WHERE public.can_access_recipes(restaurant_id)));
CREATE POLICY "Recipe ing delete" ON public.recipe_ingredients FOR DELETE TO authenticated
  USING (recipe_id IN (SELECT id FROM public.recipes WHERE public.can_access_recipes(restaurant_id)));

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_recipes_updated_at BEFORE UPDATE ON public.recipes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();