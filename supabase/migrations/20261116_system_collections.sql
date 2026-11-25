-- =====================================================================
-- FARIOUSY DELIVERY — PERSISTENT SYSTEM COLLECTIONS (CITIES, SETTINGS, ETC.)
-- Garantit que les tarifs des villes, paramètres entreprise et tarifs clients
-- ne soient jamais perdus lors des redémarrages ou mises à jour serveur.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.system_collections (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.system_collections ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'system_collections' AND policyname = 'Admins manage system collections'
  ) THEN
    CREATE POLICY "Admins manage system collections"
      ON public.system_collections FOR ALL
      USING (public.is_admin())
      WITH CHECK (public.is_admin());
  END IF;
END $$;
