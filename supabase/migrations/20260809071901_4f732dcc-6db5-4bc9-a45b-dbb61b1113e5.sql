CREATE TABLE public.recipe_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  recipe_id uuid REFERENCES public.recipes(id) ON DELETE SET NULL,
  recipe_name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 1,
  ingredients jsonb NOT NULL DEFAULT '[]'::jsonb,
  note text,
  created_by uuid,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recipe_batches TO authenticated;
GRANT ALL ON public.recipe_batches TO service_role;

ALTER TABLE public.recipe_batches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Batches select" ON public.recipe_batches
  FOR SELECT TO authenticated USING (public.can_access_recipes(restaurant_id));

CREATE POLICY "Batches insert" ON public.recipe_batches
  FOR INSERT TO authenticated WITH CHECK (public.can_access_recipes(restaurant_id) AND created_by = auth.uid());

CREATE POLICY "Batches delete" ON public.recipe_batches
  FOR DELETE TO authenticated USING (
    public.can_access_recipes(restaurant_id) AND (
      created_by = auth.uid()
      OR EXISTS (SELECT 1 FROM public.restaurants r WHERE r.id = restaurant_id AND r.admin_id = auth.uid())
    )
  );

CREATE INDEX idx_recipe_batches_restaurant_created ON public.recipe_batches (restaurant_id, created_at DESC);