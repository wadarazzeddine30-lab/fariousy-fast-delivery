-- =====================================================================
-- FARIOUSY DELIVERY — MIGRATION PRODUCTION VPS & SUPABASE
-- Migration non destructive : n'efface aucune table ni donnée existante
-- Date : 2026-10-30
-- =====================================================================

-- 1. EXTENSIONS REQUISES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. TABLE DES PARTENAIRES DE LIVRAISON (DELIVERY_PARTNERS)
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

-- Index pour recherche rapide
CREATE INDEX IF NOT EXISTS idx_delivery_partners_active ON public.delivery_partners(active);
CREATE INDEX IF NOT EXISTS idx_delivery_partners_city ON public.delivery_partners(city);

-- 3. TABLE DES JOURNAUX D'AUDIT ET SYNCHRONISATION API (PARTNER_SYNC_LOGS)
CREATE TABLE IF NOT EXISTS public.partner_sync_logs (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  partner_id TEXT REFERENCES public.delivery_partners(id) ON DELETE SET NULL,
  partner_name TEXT NOT NULL,
  direction TEXT NOT NULL, -- 'outbound_send', 'inbound_receive', 'status_sync', 'connection_test', 'webhook_received'
  status TEXT NOT NULL, -- 'success', 'error', 'pending'
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

CREATE INDEX IF NOT EXISTS idx_partner_sync_logs_partner_id ON public.partner_sync_logs(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_sync_logs_timestamp ON public.partner_sync_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_partner_sync_logs_status ON public.partner_sync_logs(status);

-- 4. MISE À JOUR DE LA TABLE PACKAGES (COLONNES D'INTÉGRATION PARTENAIRE)
DO $$
BEGIN
  -- Ajout colonne partner_id si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_id') THEN
    ALTER TABLE public.packages ADD COLUMN partner_id TEXT;
  END IF;

  -- Ajout colonne partner_name si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_name') THEN
    ALTER TABLE public.packages ADD COLUMN partner_name TEXT;
  END IF;

  -- Ajout colonne partner_tracking_number si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_tracking_number') THEN
    ALTER TABLE public.packages ADD COLUMN partner_tracking_number TEXT;
  END IF;

  -- Ajout colonne partner_shipment_id si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_shipment_id') THEN
    ALTER TABLE public.packages ADD COLUMN partner_shipment_id TEXT;
  END IF;

  -- Ajout colonne partner_label_url si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_label_url') THEN
    ALTER TABLE public.packages ADD COLUMN partner_label_url TEXT;
  END IF;

  -- Ajout colonne partner_sync_status si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_sync_status') THEN
    ALTER TABLE public.packages ADD COLUMN partner_sync_status TEXT DEFAULT 'idle';
  END IF;

  -- Ajout colonne partner_last_sync_at si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'partner_last_sync_at') THEN
    ALTER TABLE public.packages ADD COLUMN partner_last_sync_at TIMESTAMPTZ;
  END IF;

  -- Ajout colonne is_inbound_from_partner si inexistante
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'packages' AND column_name = 'is_inbound_from_partner') THEN
    ALTER TABLE public.packages ADD COLUMN is_inbound_from_partner BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 5. SÉCURITÉ ROW LEVEL SECURITY (RLS)
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_sync_logs ENABLE ROW LEVEL SECURITY;

-- Helper function: Vérifie si l'utilisateur est admin ou employé
CREATE OR REPLACE FUNCTION public.is_admin_or_employee()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role IN ('admin', 'employee')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Politiques pour delivery_partners
DO $$
BEGIN
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
END $$;

-- Politiques pour partner_sync_logs
DO $$
BEGIN
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
END $$;

-- 6. TEMPS RÉEL (REALTIME) POUR LES PARTENAIRES ET LOGS
DO $$
BEGIN
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

-- 7. SEED INITIAL DES TRANSPORTEURS MAROCAINS SI LA TABLE EST VIDE
INSERT INTO public.delivery_partners (id, name, contact_person, phone, email, city, active, notes, api_config, total_sent, total_received, total_delivered, total_returned, total_pending, error_count)
SELECT
  'part-1',
  'Atlas Messagerie Express',
  'Karim Tazi',
  '+212 661 22 33 44',
  'k.tazi@atlasexpress.ma',
  'Casablanca',
  true,
  'Transporteur partenaire régional pour le Grand Casablanca, Rabat et Tanger',
  '{
    "enabled": true,
    "baseUrl": "https://api.atlasexpress.ma/v1",
    "authType": "api_key_header",
    "headerName": "X-API-KEY",
    "apiKey": "sk_atlas_live_948271048291",
    "adapterType": "generic_rest",
    "endpoints": {
      "createShipment": "/shipments",
      "getTracking": "/tracking/:tracking",
      "syncStatus": "/shipments/statuses"
    },
    "webhookSecret": "whsec_atlas_demo_2026",
    "syncFrequencyMinutes": 15,
    "autoSync": true
  }'::jsonb,
  24, 8, 19, 2, 3, 0
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = 'part-1');

INSERT INTO public.delivery_partners (id, name, contact_person, phone, email, city, active, notes, api_config, total_sent, total_received, total_delivered, total_returned, total_pending, error_count)
SELECT
  'part-2',
  'Amana Express / Poste Maroc',
  'Direction Grands Comptes',
  '+212 537 20 00 00',
  'pro@amana.post.ma',
  'Rabat',
  true,
  'Ligne nationale couvrant plus de 400 villes et centres postaux au Maroc',
  '{
    "enabled": true,
    "baseUrl": "https://pro.amana.post.ma/api/v2",
    "authType": "bearer",
    "apiKey": "amana_jwt_token_prod_827192",
    "adapterType": "amana_express",
    "endpoints": {
      "createShipment": "/expeditions/creer",
      "getTracking": "/suivi/:tracking",
      "syncStatus": "/suivi/evenements"
    },
    "webhookSecret": "whsec_amana_prod_5928",
    "syncFrequencyMinutes": 30,
    "autoSync": true
  }'::jsonb,
  86, 0, 78, 4, 4, 0
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = 'part-2');

INSERT INTO public.delivery_partners (id, name, contact_person, phone, email, city, active, notes, api_config, total_sent, total_received, total_delivered, total_returned, total_pending, error_count)
SELECT
  'part-3',
  'Chronopost Maroc / CTM',
  'Service Affrètement Inter-villes',
  '+212 522 54 10 10',
  'messagerie@ctm.ma',
  'Casablanca',
  true,
  'Partenaire lignes régulières Nord-Sud (Marrakech, Agadir, Oujda, Fès, Meknès)',
  '{
    "enabled": true,
    "baseUrl": "https://api.chronopost.ma/shipping/v1",
    "authType": "basic",
    "username": "FARIOUSY_PRO",
    "password": "CTM_Password_2026!",
    "adapterType": "chronopost_ctm",
    "endpoints": {
      "createShipment": "/shipments/generate",
      "getTracking": "/tracking/details",
      "syncStatus": "/tracking/bulk"
    },
    "webhookSecret": "whsec_ctm_secret_8372",
    "syncFrequencyMinutes": 60,
    "autoSync": true
  }'::jsonb,
  42, 12, 38, 1, 3, 0
WHERE NOT EXISTS (SELECT 1 FROM public.delivery_partners WHERE id = 'part-3');
