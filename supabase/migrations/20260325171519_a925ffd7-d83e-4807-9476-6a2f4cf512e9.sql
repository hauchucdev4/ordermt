
-- Create role enum
CREATE TYPE public.app_role AS ENUM ('superadmin', 'admin', 'manager', 'staff', 'chef');

-- Create profile status enum
CREATE TYPE public.profile_status AS ENUM ('active', 'pending', 'locked');

-- Create table status enum
CREATE TYPE public.table_status AS ENUM ('empty', 'occupied');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('open', 'paid');

-- Create order item status enum
CREATE TYPE public.order_item_status AS ENUM ('new', 'preparing', 'done');

-- Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  phone TEXT,
  avatar_url TEXT,
  role app_role NOT NULL DEFAULT 'admin',
  restaurant_id UUID,
  status profile_status NOT NULL DEFAULT 'pending',
  lock_until TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Restaurants table
CREATE TABLE public.restaurants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  admin_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;

-- Add FK from profiles to restaurants
ALTER TABLE public.profiles ADD CONSTRAINT fk_profiles_restaurant FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE SET NULL;

-- Tables table
CREATE TABLE public.tables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status table_status NOT NULL DEFAULT 'empty',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Menu items table
CREATE TABLE public.menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Khác',
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  image_url TEXT,
  available BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- Orders table
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID NOT NULL REFERENCES public.tables(id) ON DELETE CASCADE,
  status order_status NOT NULL DEFAULT 'open',
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Order items table
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  status order_item_status NOT NULL DEFAULT 'new',
  note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- Security definer function for role checking
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = _user_id AND role = _role AND status = 'active'
  )
$$;

-- Get user role function
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE id = _user_id
$$;

-- Get user restaurant_id function
CREATE OR REPLACE FUNCTION public.get_user_restaurant(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT restaurant_id FROM public.profiles WHERE id = _user_id
$$;

-- Profile policies
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Superadmins can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can view restaurant staff" ON public.profiles
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'admin'
    AND (
      restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
      OR role = 'admin'
    )
  );

CREATE POLICY "Managers can view restaurant staff" ON public.profiles
  FOR SELECT USING (
    public.get_user_role(auth.uid()) = 'manager'
    AND restaurant_id = public.get_user_restaurant(auth.uid())
  );

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Superadmins can update any profile" ON public.profiles
  FOR UPDATE USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Superadmins can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can insert staff profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Managers can insert staff profiles" ON public.profiles
  FOR INSERT WITH CHECK (public.get_user_role(auth.uid()) = 'manager');

CREATE POLICY "Admins can update restaurant staff" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'admin'
    AND restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

CREATE POLICY "Managers can update restaurant staff" ON public.profiles
  FOR UPDATE USING (
    public.get_user_role(auth.uid()) = 'manager'
    AND restaurant_id = public.get_user_restaurant(auth.uid())
    AND role IN ('staff', 'chef')
  );

CREATE POLICY "Superadmins can delete profiles" ON public.profiles
  FOR DELETE USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can delete staff profiles" ON public.profiles
  FOR DELETE USING (
    public.get_user_role(auth.uid()) = 'admin'
    AND restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

-- Restaurant policies
CREATE POLICY "Admins can view own restaurants" ON public.restaurants
  FOR SELECT USING (admin_id = auth.uid());

CREATE POLICY "Staff can view their restaurant" ON public.restaurants
  FOR SELECT USING (id = public.get_user_restaurant(auth.uid()));

CREATE POLICY "Superadmins can view all restaurants" ON public.restaurants
  FOR SELECT USING (public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Admins can create restaurants" ON public.restaurants
  FOR INSERT WITH CHECK (admin_id = auth.uid() AND public.get_user_role(auth.uid()) = 'admin');

CREATE POLICY "Admins can update own restaurants" ON public.restaurants
  FOR UPDATE USING (admin_id = auth.uid());

CREATE POLICY "Admins can delete own restaurants" ON public.restaurants
  FOR DELETE USING (admin_id = auth.uid());

-- Tables policies
CREATE POLICY "Restaurant members can view tables" ON public.tables
  FOR SELECT USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
    OR restaurant_id = public.get_user_restaurant(auth.uid())
  );

CREATE POLICY "Admins can manage tables insert" ON public.tables
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

CREATE POLICY "Admins can manage tables update" ON public.tables
  FOR UPDATE USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

CREATE POLICY "Admins can manage tables delete" ON public.tables
  FOR DELETE USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

-- Menu items policies
CREATE POLICY "Restaurant members can view menu" ON public.menu_items
  FOR SELECT USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
    OR restaurant_id = public.get_user_restaurant(auth.uid())
  );

CREATE POLICY "Admins can manage menu insert" ON public.menu_items
  FOR INSERT WITH CHECK (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

CREATE POLICY "Admins can manage menu update" ON public.menu_items
  FOR UPDATE USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

CREATE POLICY "Admins can manage menu delete" ON public.menu_items
  FOR DELETE USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
  );

-- Orders policies
CREATE POLICY "Restaurant members can view orders" ON public.orders
  FOR SELECT USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
    OR restaurant_id = public.get_user_restaurant(auth.uid())
  );

CREATE POLICY "Staff can create orders" ON public.orders
  FOR INSERT WITH CHECK (
    restaurant_id = public.get_user_restaurant(auth.uid())
  );

CREATE POLICY "Restaurant members can update orders" ON public.orders
  FOR UPDATE USING (
    restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
    OR restaurant_id = public.get_user_restaurant(auth.uid())
  );

-- Order items policies
CREATE POLICY "Restaurant members can view order items" ON public.order_items
  FOR SELECT USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
      OR o.restaurant_id = public.get_user_restaurant(auth.uid())
    )
  );

CREATE POLICY "Staff can create order items" ON public.order_items
  FOR INSERT WITH CHECK (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.restaurant_id = public.get_user_restaurant(auth.uid())
    )
  );

CREATE POLICY "Restaurant members can update order items" ON public.order_items
  FOR UPDATE USING (
    order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
      OR o.restaurant_id = public.get_user_restaurant(auth.uid())
    )
  );

CREATE POLICY "Staff can delete new order items" ON public.order_items
  FOR DELETE USING (
    status = 'new'
    AND order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.restaurant_id = public.get_user_restaurant(auth.uid())
    )
  );

CREATE POLICY "Admins Managers can delete any order items" ON public.order_items
  FOR DELETE USING (
    public.get_user_role(auth.uid()) IN ('admin', 'manager')
    AND order_id IN (
      SELECT o.id FROM public.orders o
      WHERE o.restaurant_id IN (SELECT r.id FROM public.restaurants r WHERE r.admin_id = auth.uid())
      OR o.restaurant_id = public.get_user_restaurant(auth.uid())
    )
  );

-- Trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'admin'),
    CASE
      WHEN (NEW.raw_user_meta_data->>'role') = 'superadmin' THEN 'active'::profile_status
      WHEN (NEW.raw_user_meta_data->>'role') IN ('staff', 'chef', 'manager') THEN 'active'::profile_status
      ELSE 'pending'::profile_status
    END
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Enable realtime on key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('menu-images', 'menu-images', true);

CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Auth users can upload avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can update avatars" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');

CREATE POLICY "Anyone can view menu images" ON storage.objects FOR SELECT USING (bucket_id = 'menu-images');
CREATE POLICY "Auth users can upload menu images" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
CREATE POLICY "Auth users can update menu images" ON storage.objects FOR UPDATE USING (bucket_id = 'menu-images' AND auth.role() = 'authenticated');
