-- =============================================================================
-- FARIOUSY DELIVERY - Standalone Capacitor APK Direct Supabase Migration
-- Idempotent migration enabling 100% direct client SDK access with proper RLS,
-- optional parcel/profile metadata columns, and safe SECURITY DEFINER RPCs for
-- pre-auth identifier resolution (username/phone -> email) & public tracking.
-- =============================================================================

-- 1. Optional columns on public.packages for full direct CRUD (comments, options, history)
ALTER TABLE public.packages
  ADD COLUMN IF NOT EXISTS driver_comment TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS current_agency TEXT DEFAULT 'Agence Principale',
  ADD COLUMN IF NOT EXISTS call_proof_url TEXT,
  ADD COLUMN IF NOT EXISTS allow_open BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_try BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_fragile BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_exchange BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS exchange_tracking_number TEXT,
  ADD COLUMN IF NOT EXISTS exchange_reason TEXT,
  ADD COLUMN IF NOT EXISTS exchange_item_description TEXT,
  ADD COLUMN IF NOT EXISTS history JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS problem_report JSONB;

-- 2. Optional columns on public.profiles & public.merchant_shops
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_rib TEXT,
  ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'approuve',
  ADD COLUMN IF NOT EXISTS status_reason TEXT,
  ADD COLUMN IF NOT EXISTS agency_id TEXT,
  ADD COLUMN IF NOT EXISTS agency_name TEXT,
  ADD COLUMN IF NOT EXISTS employee_role TEXT,
  ADD COLUMN IF NOT EXISTS permissions JSONB,
  ADD COLUMN IF NOT EXISTS granular_permissions JSONB,
  ADD COLUMN IF NOT EXISTS assigned_cities JSONB,
  ADD COLUMN IF NOT EXISTS daily_target_confirmations INTEGER,
  ADD COLUMN IF NOT EXISTS driver_fee_per_delivery NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS driver_fixed_salary NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS driver_salary_type TEXT,
  ADD COLUMN IF NOT EXISTS driver_pickup_fee NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS driver_bonus_threshold INTEGER,
  ADD COLUMN IF NOT EXISTS driver_bonus_amount NUMERIC(10, 2);

ALTER TABLE public.merchant_shops
  ADD COLUMN IF NOT EXISTS bank_name TEXT,
  ADD COLUMN IF NOT EXISTS bank_rib TEXT,
  ADD COLUMN IF NOT EXISTS cin_number TEXT,
  ADD COLUMN IF NOT EXISTS cin_photo_url TEXT,
  ADD COLUMN IF NOT EXISTS cin_back_photo_url TEXT;

-- Ensure system_collections exists
CREATE TABLE IF NOT EXISTS public.system_collections (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Role helper functions (SECURITY DEFINER to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(role::text) IN ('admin', 'super_admin', 'employee', 'ops')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin_or_super()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND LOWER(role::text) IN ('admin', 'super_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 4. Safe pre-auth RPC: Resolve login identifier (email, username/full_name, shop_name, or phone) -> Auth email
CREATE OR REPLACE FUNCTION public.resolve_login_identifier(p_identifier TEXT)
RETURNS TABLE (
  email TEXT,
  role TEXT,
  full_name TEXT,
  phone TEXT
) AS $$
DECLARE
  v_raw TEXT := TRIM(COALESCE(p_identifier, ''));
  v_lower TEXT := LOWER(v_raw);
  v_digits TEXT := REGEXP_REPLACE(v_raw, '\D', '', 'g');
  v_tail TEXT := RIGHT(v_digits, 9);
BEGIN
  IF v_raw = '' THEN
    RETURN;
  END IF;

  -- Direct match on profiles (email, exact full_name, or phone/whatsapp)
  RETURN QUERY
  SELECT p.email::text, p.role::text, p.full_name::text, p.phone::text
  FROM public.profiles p
  WHERE
    LOWER(TRIM(COALESCE(p.email, ''))) = v_lower
    OR LOWER(TRIM(COALESCE(p.full_name, ''))) = v_lower
    OR (LENGTH(v_digits) >= 8 AND (
      RIGHT(REGEXP_REPLACE(COALESCE(p.phone, ''), '\D', '', 'g'), 9) = v_tail
      OR RIGHT(REGEXP_REPLACE(COALESCE(p.whatsapp, ''), '\D', '', 'g'), 9) = v_tail
    ))
  LIMIT 1;

  IF FOUND THEN
    RETURN;
  END IF;

  -- Secondary match on merchant_shops (shop_name, manager_name, email, phone)
  RETURN QUERY
  SELECT COALESCE(p.email, s.email)::text,
         COALESCE(p.role::text, 'client'),
         COALESCE(s.manager_name, p.full_name, s.shop_name)::text,
         COALESCE(s.phone, p.phone)::text
  FROM public.merchant_shops s
  LEFT JOIN public.profiles p ON p.id = s.user_id
  WHERE
    LOWER(TRIM(COALESCE(s.email, ''))) = v_lower
    OR LOWER(TRIM(COALESCE(s.shop_name, ''))) = v_lower
    OR LOWER(TRIM(COALESCE(s.manager_name, ''))) = v_lower
    OR (LENGTH(v_digits) >= 8 AND (
      RIGHT(REGEXP_REPLACE(COALESCE(s.phone, ''), '\D', '', 'g'), 9) = v_tail
      OR RIGHT(REGEXP_REPLACE(COALESCE(s.whatsapp, ''), '\D', '', 'g'), 9) = v_tail
    ))
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.resolve_login_identifier(TEXT) TO anon, authenticated;

-- 5. Safe public RPC: Track package by tracking number without leaking sensitive PII
CREATE OR REPLACE FUNCTION public.track_package_public(p_tracking_number TEXT)
RETURNS TABLE (
  id UUID,
  tracking_number TEXT,
  status TEXT,
  destination_city TEXT,
  current_agency TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  history JSONB
) AS $$
DECLARE
  v_code TEXT := UPPER(TRIM(COALESCE(p_tracking_number, '')));
BEGIN
  IF v_code = '' THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.tracking_number::text,
    p.status::text,
    p.destination_city::text,
    COALESCE(p.current_agency, 'Agence Principale')::text,
    p.created_at,
    p.updated_at,
    COALESCE(p.history, '[]'::jsonb)
  FROM public.packages p
  WHERE UPPER(TRIM(p.tracking_number)) = v_code
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

GRANT EXECUTE ON FUNCTION public.track_package_public(TEXT) TO anon, authenticated;

-- 6. Updated RLS Policies for Standalone APK direct client SDK access

-- public.profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_staff());

DROP POLICY IF EXISTS "profiles_insert_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_insert_self_or_staff" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id OR public.is_staff());

DROP POLICY IF EXISTS "profiles_update_self_or_staff" ON public.profiles;
CREATE POLICY "profiles_update_self_or_staff" ON public.profiles
  FOR UPDATE USING (auth.uid() = id OR public.is_staff());

DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
  FOR DELETE USING (public.is_admin_or_super());

-- public.merchant_shops
ALTER TABLE public.merchant_shops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "shops_select_self_or_staff" ON public.merchant_shops;
CREATE POLICY "shops_select_self_or_staff" ON public.merchant_shops
  FOR SELECT USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "shops_insert_self_or_staff" ON public.merchant_shops;
CREATE POLICY "shops_insert_self_or_staff" ON public.merchant_shops
  FOR INSERT WITH CHECK (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "shops_update_self_or_staff" ON public.merchant_shops;
CREATE POLICY "shops_update_self_or_staff" ON public.merchant_shops
  FOR UPDATE USING (user_id = auth.uid() OR public.is_staff());

DROP POLICY IF EXISTS "shops_delete_admin" ON public.merchant_shops;
CREATE POLICY "shops_delete_admin" ON public.merchant_shops
  FOR DELETE USING (public.is_admin_or_super());

-- public.packages
ALTER TABLE public.packages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "packages_select_role_scoped" ON public.packages;
CREATE POLICY "packages_select_role_scoped" ON public.packages
  FOR SELECT USING (
    public.is_staff()
    OR driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = packages.shop_id AND ms.user_id = auth.uid()
    )
    -- Allow drivers to look up unassigned packages during barcode ticket scanning
    OR (
      driver_id IS NULL AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND LOWER(pr.role::text) = 'driver'
      )
    )
  );

DROP POLICY IF EXISTS "packages_insert_staff_or_approved_client" ON public.packages;
CREATE POLICY "packages_insert_staff_or_approved_client" ON public.packages
  FOR INSERT WITH CHECK (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = packages.shop_id
        AND ms.user_id = auth.uid()
        AND ms.account_status = 'approuve'
    )
  );

DROP POLICY IF EXISTS "packages_update_role_scoped" ON public.packages;
CREATE POLICY "packages_update_role_scoped" ON public.packages
  FOR UPDATE USING (
    public.is_staff()
    OR driver_id = auth.uid()
    OR (
      driver_id IS NULL AND EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND LOWER(pr.role::text) = 'driver'
      )
    )
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = packages.shop_id AND ms.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "packages_delete_staff_or_owner" ON public.packages;
CREATE POLICY "packages_delete_staff_or_owner" ON public.packages
  FOR DELETE USING (
    public.is_staff()
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = packages.shop_id
        AND ms.user_id = auth.uid()
        AND packages.status IN ('en_preparation', 'attente_ramassage', 'en_attente')
    )
  );

-- public.system_collections (cities, settings, stock, notifications, auxiliary state)
ALTER TABLE public.system_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "system_collections_public_read_safe_keys" ON public.system_collections;
CREATE POLICY "system_collections_public_read_safe_keys" ON public.system_collections
  FOR SELECT USING (
    auth.role() = 'authenticated'
    OR key IN ('system_state', 'auxiliary_state')
  );

DROP POLICY IF EXISTS "system_collections_authenticated_write" ON public.system_collections;
CREATE POLICY "system_collections_authenticated_write" ON public.system_collections
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- public.pickup_requests
ALTER TABLE public.pickup_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pickups_authenticated_access" ON public.pickup_requests;
CREATE POLICY "pickups_authenticated_access" ON public.pickup_requests
  FOR ALL USING (
    public.is_staff()
    OR driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = pickup_requests.shop_id AND ms.user_id = auth.uid()
    )
  )
  WITH CHECK (
    public.is_staff()
    OR driver_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.merchant_shops ms
      WHERE ms.id = pickup_requests.shop_id AND ms.user_id = auth.uid()
    )
  );

-- public.delivery_partners & partner_sync_logs
ALTER TABLE public.delivery_partners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partners_staff_all" ON public.delivery_partners;
CREATE POLICY "partners_staff_all" ON public.delivery_partners
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

ALTER TABLE public.partner_sync_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "partner_logs_staff_all" ON public.partner_sync_logs;
CREATE POLICY "partner_logs_staff_all" ON public.partner_sync_logs
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- public.client_messages
ALTER TABLE public.client_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "client_messages_scoped" ON public.client_messages;
CREATE POLICY "client_messages_scoped" ON public.client_messages
  FOR ALL USING (auth.uid() = client_id OR public.is_staff())
  WITH CHECK (auth.uid() = client_id OR public.is_staff());

-- public.driver_registration_requests
ALTER TABLE public.driver_registration_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "driver_reg_public_insert" ON public.driver_registration_requests;
CREATE POLICY "driver_reg_public_insert" ON public.driver_registration_requests
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "driver_reg_staff_all" ON public.driver_registration_requests;
CREATE POLICY "driver_reg_staff_all" ON public.driver_registration_requests
  FOR ALL USING (public.is_staff()) WITH CHECK (public.is_staff());

-- Enable Realtime on packages for live multi-device APK synchronization
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'packages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.packages;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
