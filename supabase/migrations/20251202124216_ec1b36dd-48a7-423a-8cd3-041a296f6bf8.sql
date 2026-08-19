-- ##################################################################
-- ENUMS ET TYPES
-- ##################################################################

CREATE TYPE public.room_status AS ENUM (
  'AVAILABLE',
  'BOOKED', 
  'OCCUPIED',
  'PENDING_CHECKOUT',
  'PENDING_CLEANING',
  'MAINTENANCE'
);

CREATE TYPE public.user_role AS ENUM (
  'ADMIN',
  'AGENT_RES',
  'AGENT_OP'
);

CREATE TYPE public.task_type AS ENUM (
  'NETTOYAGE',
  'REPARATION',
  'INVENTAIRE'
);

CREATE TYPE public.task_status AS ENUM (
  'TO_DO',
  'IN_PROGRESS',
  'COMPLETED'
);

CREATE TYPE public.payment_method AS ENUM (
  'CB',
  'CASH',
  'TRANSFERT',
  'CHEQUE'
);

-- ##################################################################
-- TABLE DES RÔLES UTILISATEURS (OBLIGATOIRE - Séparée des profiles)
-- ##################################################################

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role user_role NOT NULL DEFAULT 'AGENT_RES',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES PROFILES UTILISATEURS
-- ##################################################################

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES LOCATAIRES (TENANTS - CRM)
-- ##################################################################

CREATE TABLE public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom VARCHAR(100) NOT NULL,
  prenom VARCHAR(100) NOT NULL,
  telephone VARCHAR(20),
  email VARCHAR(150),
  id_document VARCHAR(100),
  notes TEXT,
  liste_noire BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES CHAMBRES (ROOMS)
-- ##################################################################

CREATE TABLE public.rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero VARCHAR(10) UNIQUE NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'SINGLE',
  floor INTEGER NOT NULL DEFAULT 1,
  capacite_max INTEGER NOT NULL DEFAULT 1,
  prix_base_nuit DECIMAL(10, 2) NOT NULL,
  prix_base_semaine DECIMAL(10, 2),
  prix_base_mois DECIMAL(10, 2),
  equipements TEXT[] DEFAULT '{}',
  description TEXT,
  status room_status NOT NULL DEFAULT 'AVAILABLE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES RÉSERVATIONS (BOOKINGS)
-- ##################################################################

CREATE TABLE public.bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES auth.users(id),
  
  date_debut_prevue TIMESTAMPTZ NOT NULL,
  date_fin_prevue TIMESTAMPTZ NOT NULL,
  
  check_in_reel TIMESTAMPTZ,
  check_out_reel TIMESTAMPTZ,
  
  prix_total DECIMAL(10, 2) NOT NULL,
  caution_encaissee DECIMAL(10, 2) DEFAULT 0.00,
  notes TEXT,
  
  status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES PAIEMENTS (PAYMENTS)
-- ##################################################################

CREATE TABLE public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  montant DECIMAL(10, 2) NOT NULL,
  date_paiement TIMESTAMPTZ DEFAULT now(),
  methode payment_method NOT NULL DEFAULT 'CB',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES TÂCHES (TASKS - Opérations et Maintenance)
-- ##################################################################

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  type_tache task_type NOT NULL DEFAULT 'NETTOYAGE',
  description TEXT,
  assigned_to_user_id UUID REFERENCES auth.users(id),
  status_tache task_status NOT NULL DEFAULT 'TO_DO',
  date_creation TIMESTAMPTZ DEFAULT now(),
  date_completion TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- TABLE DES INCIDENTS
-- ##################################################################

CREATE TABLE public.incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  reported_by UUID REFERENCES auth.users(id),
  description TEXT NOT NULL,
  severity VARCHAR(20) NOT NULL DEFAULT 'LOW',
  status VARCHAR(20) NOT NULL DEFAULT 'OPEN',
  photos TEXT[] DEFAULT '{}',
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;

-- ##################################################################
-- FONCTION DE VÉRIFICATION DES RÔLES (Security Definer)
-- ##################################################################

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role user_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Fonction pour vérifier si l'utilisateur est authentifié
CREATE OR REPLACE FUNCTION public.is_authenticated()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
$$;

-- ##################################################################
-- RLS POLICIES
-- ##################################################################

-- Profiles: Les utilisateurs peuvent voir tous les profils mais modifier seulement le leur
CREATE POLICY "Profiles are viewable by authenticated users"
ON public.profiles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile"
ON public.profiles FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- User Roles: Lecture pour tous les authentifiés, modification par admin
CREATE POLICY "User roles viewable by authenticated"
ON public.user_roles FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage user roles"
ON public.user_roles FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- Tenants: Accessible par tous les authentifiés
CREATE POLICY "Tenants viewable by authenticated users"
ON public.tenants FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Tenants manageable by authenticated users"
ON public.tenants FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Tenants updatable by authenticated users"
ON public.tenants FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Tenants deletable by admin"
ON public.tenants FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- Rooms: Accessible par tous les authentifiés
CREATE POLICY "Rooms viewable by authenticated users"
ON public.rooms FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Rooms manageable by admin and agents"
ON public.rooms FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Rooms updatable by authenticated users"
ON public.rooms FOR UPDATE
TO authenticated
USING (true);

CREATE POLICY "Rooms deletable by admin"
ON public.rooms FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'ADMIN'));

-- Bookings: Accessible par tous les authentifiés
CREATE POLICY "Bookings viewable by authenticated users"
ON public.bookings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Bookings manageable by authenticated users"
ON public.bookings FOR ALL
TO authenticated
USING (true);

-- Payments: Accessible par tous les authentifiés
CREATE POLICY "Payments viewable by authenticated users"
ON public.payments FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Payments manageable by authenticated users"
ON public.payments FOR ALL
TO authenticated
USING (true);

-- Tasks: Accessible par tous les authentifiés
CREATE POLICY "Tasks viewable by authenticated users"
ON public.tasks FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Tasks manageable by authenticated users"
ON public.tasks FOR ALL
TO authenticated
USING (true);

-- Incidents: Accessible par tous les authentifiés
CREATE POLICY "Incidents viewable by authenticated users"
ON public.incidents FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Incidents manageable by authenticated users"
ON public.incidents FOR ALL
TO authenticated
USING (true);

-- ##################################################################
-- TRIGGER: Création automatique du profil à l'inscription
-- ##################################################################

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (user_id, nom, prenom, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nom', 'Utilisateur'),
    COALESCE(NEW.raw_user_meta_data->>'prenom', 'Nouveau'),
    NEW.email
  );
  
  -- Par défaut, assigner le rôle AGENT_RES
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'AGENT_RES');
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ##################################################################
-- TRIGGER: Mise à jour automatique de updated_at
-- ##################################################################

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rooms_updated_at BEFORE UPDATE ON public.rooms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON public.bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();