-- =====================================================================
-- FARIOUSY DELIVERY — MIGRATION: PHOTOS PROFIL & CIN LIVREURS
-- Ajoute les colonnes pour stocker les URLs de la photo de profil
-- et de la carte nationale (CIN recto/verso) dans public.profiles
-- et public.driver_registration_requests.
-- Migration non destructive et idempotente.
-- Date : 2026-11-13
-- =====================================================================

DO $$
BEGIN
  -- 1. Table public.profiles (comptes livreurs & utilisateurs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'avatar_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN avatar_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cin_number'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cin_number TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cin_photo_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cin_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'cin_back_photo_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN cin_back_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'driver_photo_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN driver_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'driver_vehicle'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN driver_vehicle TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'driver_plate'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN driver_plate TEXT;
  END IF;

  -- 2. Table public.driver_registration_requests (demandes d'inscription livreurs)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_registration_requests' AND column_name = 'cin_photo_url'
  ) THEN
    ALTER TABLE public.driver_registration_requests ADD COLUMN cin_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_registration_requests' AND column_name = 'cin_back_photo_url'
  ) THEN
    ALTER TABLE public.driver_registration_requests ADD COLUMN cin_back_photo_url TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'driver_registration_requests' AND column_name = 'driver_photo_url'
  ) THEN
    ALTER TABLE public.driver_registration_requests ADD COLUMN driver_photo_url TEXT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_profiles_cin_number ON public.profiles(cin_number);
