
-- Create the trigger on auth.users for new user profile creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Insert missing profile for the existing superadmin user
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT 
  '9155c4bd-87e5-4d87-a70b-c8488d8949c0',
  'superadmin1@devhub.ai.vn',
  'Super Admin 1',
  'superadmin'::app_role,
  'active'::profile_status
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = '9155c4bd-87e5-4d87-a70b-c8488d8949c0'
);
