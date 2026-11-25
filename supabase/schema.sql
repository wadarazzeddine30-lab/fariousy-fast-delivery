-- =====================================================================
-- FARIOUSY DELIVERY — SUPABASE POSTGRESQL SCHEMA & RLS POLICIES
-- Système d'authentification, gestion des boutiques, inscriptions et tarifs
-- =====================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM POUR LES STATUTS DE COMPTE (Section 2)
CREATE TYPE account_status_enum AS ENUM (
  'en_attente',
  'approuve',
  'refuse',
  'suspendu'
);

CREATE TYPE user_role_enum AS ENUM (
  'admin',
  'employee',
  'driver',
  'client'
);

-- 3. TABLE: PROFILES (Profils Utilisateurs liés à Supabase Auth auth.users)
-- Note de sécurité : Les mots de passe sont gérés exclusivement par Supabase Auth (auth.users)
-- et sont hachés de manière irréversible via bcrypt. Aucun mot de passe en clair n'est stocké.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_enum NOT NULL DEFAULT 'client',
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  city TEXT NOT NULL,
  address TEXT,
  avatar_url TEXT,
  cin_number TEXT,
  cin_photo_url TEXT,
  cin_back_photo_url TEXT,
  driver_photo_url TEXT,
  driver_vehicle TEXT,
  driver_plate TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. TABLE: MERCHANT_SHOPS (Boutiques Clientes)
CREATE TABLE IF NOT EXISTS public.merchant_shops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  activity_type TEXT NOT NULL DEFAULT 'Commerce général',
  account_status account_status_enum NOT NULL DEFAULT 'en_attente',
  status_reason TEXT,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_shop_user UNIQUE (user_id)
);

-- 5. TABLE: REGISTRATION_REQUESTS (Demandes d'inscription des commerçants)
CREATE TABLE IF NOT EXISTS public.registration_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_name TEXT NOT NULL,
  manager_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  whatsapp TEXT,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  pickup_address TEXT NOT NULL,
  activity_type TEXT NOT NULL,
  status account_status_enum NOT NULL DEFAULT 'en_attente',
  status_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.profiles(id),
  notes TEXT
);

-- 6. TABLE: ADMIN_APPROVALS (Historique des validations administratives)
CREATE TABLE IF NOT EXISTS public.admin_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.merchant_shops(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES public.profiles(id),
  action account_status_enum NOT NULL, -- 'approuve', 'refuse', 'suspendu'
  reason TEXT,
  configured_rates JSONB DEFAULT '{}'::jsonb,
  action_timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. TABLE: CLIENT_TARIFFS (Tarifs spécifiques accordés par boutique et par ville)
CREATE TABLE IF NOT EXISTS public.client_tariffs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.merchant_shops(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL,
  delivery_fee NUMERIC(10, 2) NOT NULL CHECK (delivery_fee >= 0),
  return_fee NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT unique_shop_city_tariff UNIQUE (shop_id, city_name)
);

-- 8. TABLE: PACKAGES (Colis avec isolation client)
CREATE TABLE IF NOT EXISTS public.packages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tracking_number TEXT NOT NULL UNIQUE,
  shop_id UUID NOT NULL REFERENCES public.merchant_shops(id) ON DELETE RESTRICT,
  recipient_name TEXT NOT NULL,
  recipient_phone TEXT NOT NULL,
  destination_city TEXT NOT NULL,
  destination_address TEXT NOT NULL,
  item_description TEXT NOT NULL,
  cod_amount NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
  delivery_fee NUMERIC(10, 2) NOT NULL DEFAULT 35.00,
  status TEXT NOT NULL DEFAULT 'attente_ramassage',
  is_paid_to_client BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. TABLE: PICKUP_REQUESTS (Demandes de ramassage)
CREATE TABLE IF NOT EXISTS public.pickup_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.merchant_shops(id) ON DELETE CASCADE,
  pickup_date DATE NOT NULL,
  package_count INTEGER NOT NULL CHECK (package_count > 0),
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'en_attente', -- en_attente, affecte, en_cours, termine, annule
  driver_id UUID REFERENCES public.profiles(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. TABLE: AGENCY_EMPLOYEES (Gestion des employés d'agence)
CREATE TABLE IF NOT EXISTS public.agency_employees (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_name TEXT NOT NULL,
  city TEXT NOT NULL,
  permissions TEXT[] DEFAULT ARRAY['packages_manage', 'scanner', 'stock'],
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. TABLE: CLIENT_DEBTS (Gestion des dettes, retenues de retours et créances)
CREATE TABLE IF NOT EXISTS public.client_debts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.merchant_shops(id) ON DELETE CASCADE,
  package_id UUID REFERENCES public.packages(id),
  debt_type TEXT NOT NULL, -- 'frais_retour', 'avance_fonds', 'regularisation'
  amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
  is_settled BOOLEAN NOT NULL DEFAULT false,
  settled_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES — SÉCURITÉ ET ISOLATION DES DONNÉES
-- =====================================================================

-- Activer RLS sur toutes les tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registration_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_tariffs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agency_employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_debts ENABLE ROW LEVEL SECURITY;

-- Helper function: Vérifie si l'utilisateur connecté est administrateur
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ---------------------------------------------------------------------
-- POLITIQUES SUR PROFILES
-- ---------------------------------------------------------------------
-- Règle: Un utilisateur peut voir son propre profil, les admins voient tous les profils
CREATE POLICY "Users can view own profile or admins view all"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id OR public.is_admin());

-- Règle: Seul un utilisateur peut modifier son propre profil (hors rôle)
CREATE POLICY "Users can update own non-sensitive profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND (public.is_admin() OR role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
  );

-- ---------------------------------------------------------------------
-- POLITIQUES SUR MERCHANT_SHOPS (Section 2 & 5: isolation boutique)
-- ---------------------------------------------------------------------
-- Règle: Un client peut voir UNIQUEMENT sa propre boutique (si approuvée ou en attente)
-- Les admins ont accès en lecture à toutes les boutiques
CREATE POLICY "Clients see only their shop, admins see all"
  ON public.merchant_shops FOR SELECT
  USING (user_id = auth.uid() OR public.is_admin());

-- Règle: Les clients ne peuvent JAMAIS s'auto-approuver ou changer leur statut
-- Seuls les administrateurs peuvent modifier le statut, approuver, refuser ou suspendre
CREATE POLICY "Only admins can approve, reject or suspend shops"
  ON public.merchant_shops FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- POLITIQUES SUR REGISTRATION_REQUESTS
-- ---------------------------------------------------------------------
-- Règle: Tout le monde (y compris anonyme) peut soumettre une demande d'inscription
-- avec statut forcé à 'en_attente'
CREATE POLICY "Anyone can submit registration request"
  ON public.registration_requests FOR INSERT
  WITH CHECK (status = 'en_attente');

-- Règle: Seuls les administrateurs peuvent consulter et mettre à jour les demandes
CREATE POLICY "Only admins can view registration requests"
  ON public.registration_requests FOR SELECT
  USING (public.is_admin());

CREATE POLICY "Only admins can update registration requests"
  ON public.registration_requests FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- POLITIQUES SUR CLIENT_TARIFFS
-- ---------------------------------------------------------------------
-- Règle: Un client ne peut voir que les tarifs de sa propre boutique
CREATE POLICY "Clients see only their own tariffs"
  ON public.client_tariffs FOR SELECT
  USING (
    public.is_admin() OR
    shop_id IN (SELECT id FROM public.merchant_shops WHERE user_id = auth.uid())
  );

-- Règle: Seuls les administrateurs peuvent créer ou modifier les tarifs
CREATE POLICY "Only admins can configure tariffs"
  ON public.client_tariffs FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- POLITIQUES SUR PACKAGES & PICKUP_REQUESTS (Section 5: données isolées)
-- ---------------------------------------------------------------------
CREATE POLICY "Clients see only their packages"
  ON public.packages FOR SELECT
  USING (
    public.is_admin() OR
    shop_id IN (SELECT id FROM public.merchant_shops WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can create packages for their own shop"
  ON public.packages FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT id FROM public.merchant_shops
      WHERE user_id = auth.uid() AND account_status = 'approuve'
    )
  );

CREATE POLICY "Clients see only their pickups"
  ON public.pickup_requests FOR SELECT
  USING (
    public.is_admin() OR
    shop_id IN (SELECT id FROM public.merchant_shops WHERE user_id = auth.uid())
  );

CREATE POLICY "Clients can request pickups for their own shop"
  ON public.pickup_requests FOR INSERT
  WITH CHECK (
    shop_id IN (
      SELECT id FROM public.merchant_shops
      WHERE user_id = auth.uid() AND account_status = 'approuve'
    )
  );

-- ---------------------------------------------------------------------
-- POLITIQUES SUR DRIVERS (APPLICATION ANDROID LIVREUR)
-- ---------------------------------------------------------------------
-- Règle: Un livreur peut voir uniquement les colis qui lui sont affectés
CREATE POLICY "Drivers see assigned packages"
  ON public.packages FOR SELECT
  USING (
    public.is_admin() OR
    driver_id = auth.uid() OR
    shop_id IN (SELECT id FROM public.merchant_shops WHERE user_id = auth.uid())
  );

-- Règle: Un livreur peut mettre à jour le statut, les commentaires et la signature de ses colis affectés
CREATE POLICY "Drivers can update assigned packages status"
  ON public.packages FOR UPDATE
  USING (public.is_admin() OR driver_id = auth.uid())
  WITH CHECK (public.is_admin() OR driver_id = auth.uid());

-- ---------------------------------------------------------------------
-- TABLE: DRIVER_SETTLEMENTS (Versements et Caisse Livreurs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.driver_settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,
  agency_id TEXT NOT NULL DEFAULT 'Agence Principale',
  total_cod_amount NUMERIC(10, 2) NOT NULL CHECK (total_cod_amount >= 0),
  packages_count INTEGER NOT NULL CHECK (packages_count >= 0),
  voucher_reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'verse_agence', -- 'en_attente', 'verse_agence', 'valide'
  validated_by UUID REFERENCES public.profiles(id),
  notes TEXT,
  settled_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.driver_settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Drivers see own settlements and admins see all"
  ON public.driver_settlements FOR SELECT
  USING (public.is_admin() OR driver_id = auth.uid());

CREATE POLICY "Drivers can create settlement receipts"
  ON public.driver_settlements FOR INSERT
  WITH CHECK (driver_id = auth.uid() OR public.is_admin());

CREATE POLICY "Only admins can validate driver settlements"
  ON public.driver_settlements FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- ---------------------------------------------------------------------
-- REALTIME PUBLICATION SETUP
-- ---------------------------------------------------------------------
-- Activation du temps réel pour les tables clés
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'packages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'pickup_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pickup_requests;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'merchant_shops'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_shops;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_settlements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_settlements;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'delivery_partners'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.delivery_partners;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'partner_sync_logs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.partner_sync_logs;
  END IF;
END $$;

-- ---------------------------------------------------------------------
-- TABLE: DELIVERY_PARTNERS (Partenaires et Transporteurs Routiers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.delivery_partners (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  contact_person TEXT,
  phone TEXT NOT NULL,
  email TEXT,
  city TEXT NOT NULL DEFAULT 'Casablanca',
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  api_config JSONB DEFAULT '{}'::jsonb,
  total_sent INTEGER NOT NULL DEFAULT 0,
  total_received INTEGER NOT NULL DEFAULT 0,
  total_delivered INTEGER NOT NULL DEFAULT 0,
  total_returned INTEGER NOT NULL DEFAULT 0,
  total_pending INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- TABLE: PARTNER_SYNC_LOGS (Journaux de synchronisation API)
CREATE TABLE IF NOT EXISTS public.partner_sync_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  partner_id TEXT REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL,
  direction TEXT NOT NULL,
  status TEXT NOT NULL,
  status_code INTEGER,
  endpoint TEXT,
  message TEXT NOT NULL,
  package_count INTEGER DEFAULT 0,
  tracking_numbers TEXT[] DEFAULT ARRAY[]::TEXT[],
  request_payload_preview TEXT,
  response_payload_preview TEXT,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sync_logs ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- TABLE: CLIENT_MESSAGES (Messages, Support et Réclamations Clients)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.client_messages (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  client_id TEXT NOT NULL,
  client_name TEXT NOT NULL,
  client_company TEXT,
  client_phone TEXT,
  client_email TEXT,
  category TEXT NOT NULL DEFAULT 'autre', -- 'livraison', 'ramassage', 'paiement', 'reclamation', 'autre'
  priority TEXT NOT NULL DEFAULT 'normale', -- 'basse', 'normale', 'urgente'
  status TEXT NOT NULL DEFAULT 'nouveau', -- 'nouveau', 'en_cours', 'resolu', 'ferme'
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  package_tracking_number TEXT,
  package_id TEXT,
  replies JSONB DEFAULT '[]'::jsonb,
  resolved_at TIMESTAMPTZ,
  resolved_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin_or_employee()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'employee')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
BEGIN
  -- Delivery Partners Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'delivery_partners' AND policyname = 'Admins and employees can view partners') THEN
    CREATE POLICY "Admins and employees can view partners"
      ON public.delivery_partners FOR SELECT
      USING (public.is_admin_or_employee());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'delivery_partners' AND policyname = 'Only admins can modify partners') THEN
    CREATE POLICY "Only admins can modify partners"
      ON public.delivery_partners FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  -- Partner Sync Logs Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_sync_logs' AND policyname = 'Admins and employees can view sync logs') THEN
    CREATE POLICY "Admins and employees can view sync logs"
      ON public.partner_sync_logs FOR SELECT
      USING (public.is_admin_or_employee());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'partner_sync_logs' AND policyname = 'Only admins can manage sync logs') THEN
    CREATE POLICY "Only admins can manage sync logs"
      ON public.partner_sync_logs FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;

  -- Client Messages Policies
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_messages' AND policyname = 'Clients see own messages, staff see all') THEN
    CREATE POLICY "Clients see own messages, staff see all"
      ON public.client_messages FOR SELECT
      USING (
        public.is_admin_or_employee() OR
        client_id = auth.uid()::text OR
        client_id IN (SELECT id::text FROM public.merchant_shops WHERE user_id = auth.uid())
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_messages' AND policyname = 'Anyone can create support message') THEN
    CREATE POLICY "Anyone can create support message"
      ON public.client_messages FOR INSERT
      WITH CHECK (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'client_messages' AND policyname = 'Staff and owner can update messages') THEN
    CREATE POLICY "Staff and owner can update messages"
      ON public.client_messages FOR UPDATE
      USING (
        public.is_admin_or_employee() OR
        client_id = auth.uid()::text
      )
      WITH CHECK (
        public.is_admin_or_employee() OR
        client_id = auth.uid()::text
      );
  END IF;

  -- Realtime publication for client_messages
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'client_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.client_messages;
  END IF;
END $$;

-- =====================================================================
-- TABLE: DRIVER_REGISTRATION_REQUESTS (Demandes d'inscription Livreurs)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.driver_registration_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT NOT NULL,
  city TEXT NOT NULL,
  address TEXT NOT NULL,
  cin_number TEXT NOT NULL,
  cin_photo_url TEXT,
  cin_back_photo_url TEXT,
  driver_photo_url TEXT,
  vehicle_type TEXT NOT NULL CHECK (vehicle_type IN ('Moto', 'Voiture', 'Vélo', 'Fourgonnette', 'Autre')),
  driver_plate TEXT,
  status account_status_enum NOT NULL DEFAULT 'en_attente',
  rejection_reason TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Index pour recherche rapide et unicité
CREATE INDEX IF NOT EXISTS idx_driver_req_status ON public.driver_registration_requests (status);
CREATE INDEX IF NOT EXISTS idx_driver_req_phone ON public.driver_registration_requests (phone);
CREATE INDEX IF NOT EXISTS idx_driver_req_email ON public.driver_registration_requests (email);
CREATE INDEX IF NOT EXISTS idx_driver_req_cin ON public.driver_registration_requests (cin_number);

-- Activer RLS
ALTER TABLE public.driver_registration_requests ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  -- 1. Tout candidat peut soumettre sa demande avec statut forcé à 'en_attente'
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'driver_registration_requests' AND policyname = 'Public can submit driver registration request') THEN
    CREATE POLICY "Public can submit driver registration request"
      ON public.driver_registration_requests FOR INSERT
      WITH CHECK (status = 'en_attente');
  END IF;

  -- 2. Les administrateurs et employés peuvent consulter toutes les demandes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'driver_registration_requests' AND policyname = 'Admins and employees view driver registration requests') THEN
    CREATE POLICY "Admins and employees view driver registration requests"
      ON public.driver_registration_requests FOR SELECT
      USING (public.is_admin_or_employee());
  END IF;

  -- 3. Seuls les administrateurs et employés peuvent approuver ou refuser les demandes
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'driver_registration_requests' AND policyname = 'Admins and employees update driver registration requests') THEN
    CREATE POLICY "Admins and employees update driver registration requests"
      ON public.driver_registration_requests FOR UPDATE
      USING (public.is_admin_or_employee())
      WITH CHECK (public.is_admin_or_employee());
  END IF;

  -- 4. Seuls les administrateurs peuvent supprimer une demande
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'driver_registration_requests' AND policyname = 'Admins can delete driver registration requests') THEN
    CREATE POLICY "Admins can delete driver registration requests"
      ON public.driver_registration_requests FOR DELETE
      USING (public.is_admin());
  END IF;

  -- Realtime publication pour notification instantanée des admins
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'driver_registration_requests'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.driver_registration_requests;
  END IF;
END $$;




