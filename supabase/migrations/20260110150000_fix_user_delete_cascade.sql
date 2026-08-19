-- ### PROFILES TABLE ###
-- 1. Drop the existing foreign key constraint on the profiles table.
-- The name is inferred from Supabase defaults, but might need adjustment if different.
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- 2. Re-add the constraint with ON DELETE CASCADE.
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;

-- ### USER_ROLES TABLE ###
-- 1. Drop the existing foreign key constraint on the user_roles table.
ALTER TABLE public.user_roles
DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

-- 2. Re-add the constraint with ON DELETE CASCADE.
ALTER TABLE public.user_roles
ADD CONSTRAINT user_roles_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE;
