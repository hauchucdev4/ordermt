-- =====================================================================
-- ORDERMASTER — SNAPSHOT SCHEMA (read-only reference)
-- =====================================================================
-- File này là ảnh chụp toàn bộ schema hiện tại (tables, enums, functions,
-- RLS policies). KHÔNG dùng để chạy lại trên DB đã có dữ liệu — chỉ để
-- đọc, review, hoặc seed một project Supabase mới hoàn toàn.
--
-- Nguồn sự thật vẫn là các file trong supabase/migrations/.
-- Khi schema đổi, hãy cập nhật file này thủ công (hoặc xoá để regenerate).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ENUMS
-- ---------------------------------------------------------------------
CREATE TYPE public.app_role           AS ENUM ('superadmin','admin','manager','staff','chef');
CREATE TYPE public.order_item_status  AS ENUM ('new','preparing','done');
CREATE TYPE public.order_status       AS ENUM ('open','paid');
CREATE TYPE public.profile_status     AS ENUM ('active','pending','locked');
CREATE TYPE public.table_status       AS ENUM ('empty','occupied');

-- ---------------------------------------------------------------------
-- 2. TABLES
-- ---------------------------------------------------------------------

-- profiles: mở rộng auth.users với role, restaurant, trạng thái khoá
CREATE TABLE public.profiles (
  id            uuid PRIMARY KEY,                            -- = auth.users.id
  email         text NOT NULL,
  full_name     text,
  phone         text,
  avatar_url    text,
  role          public.app_role        NOT NULL DEFAULT 'admin',
  status        public.profile_status  NOT NULL DEFAULT 'pending',
  restaurant_id uuid,
  lock_until    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- restaurants: mỗi admin sở hữu nhiều nhà hàng
CREATE TABLE public.restaurants (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   uuid NOT NULL REFERENCES public.profiles(id),
  name       text NOT NULL,
  address    text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles
  ADD CONSTRAINT fk_profiles_restaurant
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);

-- tables: bàn trong nhà hàng
CREATE TABLE public.tables (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  name          text NOT NULL,
  status        public.table_status NOT NULL DEFAULT 'empty',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- menu_items: món trong menu
CREATE TABLE public.menu_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  name          text NOT NULL,
  category      text NOT NULL DEFAULT 'Khác',
  price         numeric NOT NULL DEFAULT 0,
  image_url     text,
  available     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- orders: hoá đơn của 1 bàn
CREATE TABLE public.orders (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id uuid NOT NULL REFERENCES public.restaurants(id),
  table_id      uuid NOT NULL REFERENCES public.tables(id),
  status        public.order_status NOT NULL DEFAULT 'open',
  total         numeric NOT NULL DEFAULT 0,
  paid_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- order_items: từng món trong order
CREATE TABLE public.order_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id      uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id  uuid NOT NULL REFERENCES public.menu_items(id),
  quantity      integer NOT NULL DEFAULT 1,
  status        public.order_item_status NOT NULL DEFAULT 'new',
  note          text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- 3. SECURITY DEFINER FUNCTIONS (dùng trong RLS, tránh đệ quy)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS public.app_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.get_user_restaurant(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role AND status = 'active'
  )
$$;

-- Trigger tạo profile tự động khi có user mới trong auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'admin'),
    CASE
      WHEN (NEW.raw_user_meta_data->>'role') = 'superadmin' THEN 'active'::public.profile_status
      WHEN (NEW.raw_user_meta_data->>'role') IN ('staff','chef','manager') THEN 'active'::public.profile_status
      ELSE 'pending'::public.profile_status
    END
  );
  RETURN NEW;
END;
$$;

-- Gắn trigger vào auth.users (chỉ chạy 1 lần khi seed project mới)
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ---------------------------------------------------------------------
-- 4. GRANTS
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.restaurants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tables      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_items  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orders      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.order_items TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Xem chi tiết policies trong các file supabase/migrations/*.sql
-- hoặc trong tài liệu docs/DATABASE.md (phần "Quyền truy cập").
