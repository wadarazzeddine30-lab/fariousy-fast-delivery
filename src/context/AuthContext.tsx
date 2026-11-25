import React, { createContext, useContext, useEffect, useState } from 'react';
import { AccountStatus, UserProfile, UserRole } from '../types';
import { useDatabase } from './DatabaseContext';
import {
  supabaseClient,
  fetchUserProfileFromDb,
  resolveLoginIdentifier,
  loadAuxiliaryState,
  patchAuxiliaryState,
  getStoredAuthSession,
  saveStoredAuthSession,
  clearStoredAuthSession,
  getRememberMePreference,
  isJwtTokenExpired
} from '../services/supabase';
import { saveLocalKycDocs } from '../utils/kycStorage';

export interface LoginResult {
  success: boolean;
  error?: string;
  accountStatus?: AccountStatus | string;
  user?: UserProfile;
}

interface AuthContextType {
  currentUser: UserProfile | null;
  currentRole: UserRole;
  pendingReviewUser: UserProfile | null;
  switchRole: (role: UserRole, specificUserOrId?: string | UserProfile) => void;
  login: (email: string, password?: string, rememberMe?: boolean) => Promise<LoginResult>;
  registerBoutiqueUser: (data: {
    shopName: string;
    managerName: string;
    phone: string;
    whatsapp?: string;
    email: string;
    city: string;
    pickupAddress: string;
    activityType?: string;
    password?: string;
    cinNumber?: string;
    cinPhotoUrl?: string;
    cinBackPhotoUrl?: string;
  }) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  logout: () => Promise<void>;
  clearPendingReview: () => void;
  refreshProfile: () => Promise<UserProfile | null>;
  updateCurrentUser: (updates: Partial<UserProfile>) => void;
  isSuperAdmin: boolean;
  isAdmin: boolean;
  isEmployee: boolean;
  isDriver: boolean;
  isClient: boolean;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  impersonatorAdmin: UserProfile | null;
  isImpersonating: boolean;
  impersonateUser: (targetUser: UserProfile) => void;
  stopImpersonation: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Maps a database row from public.profiles to the client UserProfile object
 */
function mapProfileToUser(profile: any, authUser?: any, overrideRole?: UserRole): UserProfile {
  const rawRole = String(overrideRole || profile.role || 'client').toLowerCase().trim();
  const role: UserRole =
    rawRole === 'super_admin' || rawRole === 'superadmin'
      ? 'super_admin'
      : rawRole === 'admin'
      ? 'admin'
      : rawRole === 'employee' || rawRole === 'ops'
      ? 'employee'
      : rawRole === 'driver' || rawRole === 'livreur'
      ? 'driver'
      : 'client';

  const rawStatus = profile.account_status || profile.accountStatus || profile.status;
  const status: AccountStatus | 'active' = (rawStatus as AccountStatus) || 'approuve';
  const rawShopId = profile.shop_id || profile.shopId || undefined;

  return {
    id: profile.id || authUser?.id || `usr-${Date.now()}`,
    ...(rawShopId ? { shopId: rawShopId } : {}),
    name: profile.full_name || profile.name || authUser?.email?.split('@')[0] || 'Utilisateur',
    email: profile.email || authUser?.email || '',
    role,
    phone: profile.phone || '',
    whatsapp: profile.whatsapp || undefined,
    companyName: profile.company_name || profile.companyName || profile.full_name || profile.name || 'FARIOUSY DELIVERY',
    city: profile.city || 'Casablanca',
    address: profile.address || '',
    bankName: profile.bank_name || profile.bankName || undefined,
    bankRib: profile.bank_rib || profile.bankRib || undefined,
    status,
    accountStatus: (profile.account_status || profile.accountStatus || rawStatus) as AccountStatus,
    statusReason: profile.status_reason || profile.statusReason || undefined,
    agencyId: profile.agency_id || profile.agencyId || undefined,
    agencyName: profile.agency_name || profile.agencyName || undefined,
    permissions: Array.isArray(profile.permissions) ? profile.permissions : undefined,
    granularPermissions: profile.granular_permissions || profile.granularPermissions || undefined,
    employeeRole: profile.employee_role || profile.employeeRole || undefined,
    assignedCities: Array.isArray(profile.assigned_cities)
      ? profile.assigned_cities
      : Array.isArray(profile.assignedCities)
      ? profile.assignedCities
      : undefined,
    dailyTargetConfirmations:
      profile.daily_target_confirmations ?? profile.dailyTargetConfirmations ?? undefined,
    registeredAt: profile.created_at || profile.registeredAt || new Date().toISOString()
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { users } = useDatabase();

  const [pendingReviewUser, setPendingReviewUser] = useState<UserProfile | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [impersonatorAdmin, setImpersonatorAdmin] = useState<UserProfile | null>(() => {
    try {
      if (typeof window !== 'undefined') {
        const saved =
          sessionStorage.getItem('fariousy_impersonator_admin') ||
          localStorage.getItem('fariousy_impersonator_admin');
        return saved ? JSON.parse(saved) : null;
      }
      return null;
    } catch {
      return null;
    }
  });

  // Direct Supabase Auth session restoration + public.profiles hydration
  useEffect(() => {
    let isMounted = true;

    async function loadActiveSession() {
      const isImpersonatingCheck =
        typeof window !== 'undefined' &&
        Boolean(
          sessionStorage.getItem('fariousy_impersonator_admin') ||
            localStorage.getItem('fariousy_impersonator_admin')
        );

      // 1. Immediate UI hydration from stored session when impersonating or cached
      const stored = getStoredAuthSession();
      if (stored?.user && isImpersonatingCheck) {
        if (isMounted) {
          setCurrentUser(stored.user);
          setIsAuthLoading(false);
        }
        return;
      }

      if (!getRememberMePreference() && !stored?.user) {
        if (isMounted) {
          setCurrentUser(null);
          setIsAuthLoading(false);
        }
        return;
      }

      if (stored?.user && isMounted) {
        setCurrentUser(stored.user);
        setIsAuthLoading(false);
      }

      // 2. Verify active Supabase Auth session directly
      try {
        const { data: { session }, error } = await supabaseClient.auth.getSession();
        if (error || !session?.user) {
          if (isMounted) {
            clearStoredAuthSession();
            setCurrentUser(null);
            setIsAuthLoading(false);
          }
          return;
        }

        let activeAccessToken = session.access_token;
        if (isJwtTokenExpired(activeAccessToken, 15000)) {
          const { data: refreshed } = await supabaseClient.auth.refreshSession();
          if (refreshed?.session?.access_token) {
            activeAccessToken = refreshed.session.access_token;
          }
        }

        const profile = await fetchUserProfileFromDb(session.user.id, activeAccessToken);
        if (isMounted) {
          if (profile) {
            const mappedUser = mapProfileToUser(profile, session.user);
            saveStoredAuthSession({ token: activeAccessToken, user: mappedUser });
            setCurrentUser(mappedUser);
          } else {
            await supabaseClient.auth.signOut();
            clearStoredAuthSession();
            setCurrentUser(null);
          }
          setIsAuthLoading(false);
        }
      } catch (err) {
        console.warn('[Auth Initialization notice]', err);
        if (isMounted) {
          setIsAuthLoading(false);
        }
      }
    }

    loadActiveSession();

    const handleVisibilityOrFocus = async () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        try {
          const isImpersonatingCheck =
            typeof window !== 'undefined' &&
            Boolean(
              sessionStorage.getItem('fariousy_impersonator_admin') ||
                localStorage.getItem('fariousy_impersonator_admin')
            );
          if (isImpersonatingCheck) return;

          const { data: { session } } = await supabaseClient.auth.getSession();
          if (session?.user) {
            let activeAccessToken = session.access_token;
            if (isJwtTokenExpired(activeAccessToken, 15000)) {
              const { data: refreshed } = await supabaseClient.auth.refreshSession();
              if (refreshed?.session?.access_token) {
                activeAccessToken = refreshed.session.access_token;
              }
            }
            const profile = await fetchUserProfileFromDb(session.user.id, activeAccessToken);
            if (isMounted && profile) {
              const mappedUser = mapProfileToUser(profile, session.user);
              saveStoredAuthSession({ token: activeAccessToken, user: mappedUser });
              setCurrentUser(mappedUser);
            }
          }
        } catch (err) {
          console.warn('[Focus profile recheck notice]', err);
        }
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleVisibilityOrFocus);
      document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    }

    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event, session) => {
      const isImpersonatingCheck =
        typeof window !== 'undefined' &&
        Boolean(
          sessionStorage.getItem('fariousy_impersonator_admin') ||
            localStorage.getItem('fariousy_impersonator_admin')
        );
      if (isImpersonatingCheck) return;

      if (session?.user) {
        const profile = await fetchUserProfileFromDb(session.user.id, session.access_token);
        if (isMounted) {
          if (profile) {
            const mappedUser = mapProfileToUser(profile, session.user);
            saveStoredAuthSession({ token: session.access_token, user: mappedUser });
            setCurrentUser(mappedUser);
          } else {
            setCurrentUser(null);
          }
        }
      } else if (event === 'SIGNED_OUT') {
        if (isMounted) {
          clearStoredAuthSession();
          setCurrentUser(null);
          setPendingReviewUser(null);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      if (typeof window !== 'undefined') {
        window.removeEventListener('focus', handleVisibilityOrFocus);
        document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      }
    };
  }, []);

  const handleRoleRouting = (user: UserProfile): LoginResult => {
    if (user.role === 'client') {
      const status = user.status;
      if (status === 'en_attente' || status === 'pending') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'en_attente',
          user,
          error:
            "Votre demande d'inscription Boutique est en cours de validation par l'administration FARIOUSY DELIVERY."
        };
      }
      if (status === 'refuse') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'refuse',
          user,
          error: user.statusReason || "Votre demande d'inscription a été refusée."
        };
      }
      if (status === 'suspendu') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'suspendu',
          user,
          error: user.statusReason || 'Votre compte boutique est actuellement suspendu.'
        };
      }
    }

    if (user.role === 'driver') {
      const status = user.status;
      if (status === 'en_attente' || status === 'pending') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'en_attente',
          user,
          error:
            "Votre demande d'inscription Livreur est en cours de validation par l'administration FARIOUSY DELIVERY."
        };
      }
      if (status === 'refuse') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'refuse',
          user,
          error: user.statusReason || "Votre candidature de livreur n'a pas été retenue."
        };
      }
      if (status === 'suspendu') {
        setPendingReviewUser(user);
        return {
          success: false,
          accountStatus: 'suspendu',
          user,
          error: user.statusReason || 'Votre compte livreur est actuellement suspendu.'
        };
      }
    }

    setPendingReviewUser(null);
    setCurrentUser(user);
    return { success: true, user };
  };

  /**
   * 100% Direct Supabase Auth Login supporting:
   * - Email + password
   * - Username (full_name / shop_name) + password
   * - Phone number + password
   */
  const login = async (identifier: string, password?: string, rememberMe = true): Promise<LoginResult> => {
    const rawIdentifier = (identifier || '').trim();
    const cleanPassword = (password || '').trim();

    if (!rawIdentifier) {
      return {
        success: false,
        error: "Veuillez saisir votre nom d'utilisateur, numéro de téléphone ou adresse e-mail."
      };
    }

    if (!cleanPassword) {
      return {
        success: false,
        error: 'Veuillez saisir votre mot de passe.'
      };
    }

    let targetEmail = rawIdentifier.toLowerCase();

    if (!rawIdentifier.includes('@')) {
      const cleanDigits = rawIdentifier.replace(/\D/g, '');
      const matchedUser = users.find(u => {
        const uPhone = (u.phone || '').replace(/\D/g, '');
        const uWhatsapp = (u.whatsapp || '').replace(/\D/g, '');
        const uName = (u.name || '').trim().toLowerCase();
        const uComp = (u.companyName || '').trim().toLowerCase();
        return (
          uName === targetEmail ||
          uComp === targetEmail ||
          u.phone === rawIdentifier ||
          (cleanDigits.length >= 8 && uPhone.endsWith(cleanDigits.slice(-8))) ||
          (cleanDigits.length >= 8 && uWhatsapp.endsWith(cleanDigits.slice(-8)))
        );
      });

      if (matchedUser?.email) {
        targetEmail = matchedUser.email.toLowerCase();
      } else {
        const res = await resolveLoginIdentifier(rawIdentifier);
        if (res.success && res.email) {
          targetEmail = res.email.toLowerCase();
        } else if (cleanDigits.length >= 8) {
          targetEmail = `${cleanDigits}@fariousy.com`;
        } else {
          return {
            success: false,
            error: "Aucun compte trouvé pour cet identifiant. Essayez avec votre adresse e-mail ou numéro de téléphone."
          };
        }
      }
    }

    let authUser: any = null;
    let accessToken: string | undefined;

    try {
      const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
        email: targetEmail,
        password: cleanPassword
      });

      if (authError || !authData.user) {
        const msg = authError?.message || '';
        let translatedError = 'Identifiant ou mot de passe incorrect.';
        if (msg.includes('Invalid login credentials')) {
          translatedError = 'Numéro de téléphone / identifiant ou mot de passe incorrect.';
        } else if (msg.includes('Email not confirmed')) {
          translatedError = 'Veuillez confirmer votre adresse e-mail avant de vous connecter.';
        } else if (msg) {
          translatedError = msg;
        }
        return { success: false, error: translatedError };
      }

      authUser = authData.user;
      accessToken = authData.session?.access_token;
    } catch (err: any) {
      return {
        success: false,
        error: `Erreur lors de la communication avec Supabase Auth : ${err.message}`
      };
    }

    const profile = await fetchUserProfileFromDb(authUser.id, accessToken);
    if (!profile) {
      await supabaseClient.auth.signOut();
      setCurrentUser(null);
      return {
        success: false,
        error:
          "Compte authentifié sur Supabase, mais aucun profil utilisateur n'a été trouvé dans public.profiles. Veuillez contacter l'administrateur."
      };
    }

    const rawRole = String(profile.role || '').toLowerCase().trim();
    let mappedRole: UserRole;
    if (rawRole === 'super_admin' || rawRole === 'superadmin') {
      mappedRole = 'super_admin';
    } else if (rawRole === 'admin') {
      mappedRole = 'admin';
    } else if (rawRole === 'employee' || rawRole === 'ops') {
      mappedRole = 'employee';
    } else if (rawRole === 'driver' || rawRole === 'livreur') {
      mappedRole = 'driver';
    } else if (rawRole === 'client' || rawRole === 'boutique') {
      mappedRole = 'client';
    } else {
      await supabaseClient.auth.signOut();
      setCurrentUser(null);
      return {
        success: false,
        error: `Rôle utilisateur "${rawRole}" non reconnu. Accès refusé.`
      };
    }

    const userProfile: UserProfile = mapProfileToUser(profile, authUser, mappedRole);

    if (typeof window !== 'undefined' && accessToken) {
      saveStoredAuthSession({ token: accessToken, user: userProfile }, rememberMe);
      try {
        if (rememberMe) {
          localStorage.setItem('fariousy_remembered_identifier', rawIdentifier);
        } else {
          localStorage.removeItem('fariousy_remembered_identifier');
        }
      } catch {}
      window.dispatchEvent(new Event('fariousy_auth_changed'));
    }

    return handleRoleRouting(userProfile);
  };

  const switchRole = (role: UserRole, specificUserOrId?: string | UserProfile) => {
    if (!currentUser && !impersonatorAdmin) return;
    const isCallerPrivileged = Boolean(
      impersonatorAdmin ||
        currentUser?.role === 'super_admin' ||
        currentUser?.role === 'admin' ||
        currentUser?.role === 'employee'
    );
    if (!isCallerPrivileged) return;

    setPendingReviewUser(null);

    const resolveTokenForUser = (): string | undefined => {
      if (typeof window !== 'undefined') {
        try {
          const impToken =
            sessionStorage.getItem('fariousy_impersonator_token') ||
            localStorage.getItem('fariousy_impersonator_token');
          if (impToken) return impToken;
          const saved = getStoredAuthSession();
          if (saved?.token && typeof saved.token === 'string') return saved.token;
        } catch {}
      }
      return undefined;
    };

    if (specificUserOrId && typeof specificUserOrId === 'object' && specificUserOrId.id) {
      const targetUser: UserProfile = {
        ...specificUserOrId,
        role: role || specificUserOrId.role
      };
      if (typeof window !== 'undefined') {
        saveStoredAuthSession({ token: resolveTokenForUser(), user: targetUser });
        window.dispatchEvent(new Event('fariousy_auth_changed'));
      }
      setCurrentUser(targetUser);
      return;
    }

    if (typeof specificUserOrId === 'string' && specificUserOrId.trim()) {
      const targetUser = users.find(u => u.id === specificUserOrId);
      if (targetUser) {
        if (typeof window !== 'undefined') {
          saveStoredAuthSession({ token: resolveTokenForUser(), user: targetUser });
          window.dispatchEvent(new Event('fariousy_auth_changed'));
        }
        setCurrentUser(targetUser);
        return;
      }
    }

    if ((role === 'admin' || role === 'super_admin') && impersonatorAdmin) {
      if (typeof window !== 'undefined') {
        saveStoredAuthSession({ token: resolveTokenForUser(), user: impersonatorAdmin });
        window.dispatchEvent(new Event('fariousy_auth_changed'));
      }
      setCurrentUser(impersonatorAdmin);
      return;
    }

    const firstMatching =
      users.find(u => u.role === role && (u.status === 'active' || u.status === 'approuve')) ||
      users.find(u => u.role === role);
    if (firstMatching) {
      if (typeof window !== 'undefined') {
        saveStoredAuthSession({ token: resolveTokenForUser(), user: firstMatching });
        window.dispatchEvent(new Event('fariousy_auth_changed'));
      }
      setCurrentUser(firstMatching);
    }
  };

  /**
   * 100% Direct Supabase Auth + public.profiles + public.merchant_shops Registration
   */
  const registerBoutiqueUser = async (data: {
    shopName: string;
    managerName: string;
    phone: string;
    whatsapp?: string;
    email: string;
    city: string;
    pickupAddress: string;
    activityType?: string;
    password?: string;
    cinNumber?: string;
    cinPhotoUrl?: string;
    cinBackPhotoUrl?: string;
  }): Promise<{ success: boolean; user?: UserProfile; error?: string }> => {
    try {
      const cleanEmail = (data.email || '').trim().toLowerCase();
      const cleanPassword = (data.password || '').trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        return { success: false, error: 'Adresse e-mail valide requise.' };
      }
      if (cleanPassword.length < 6) {
        return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
      }

      const aux = await loadAuxiliaryState();
      const sec: any = aux.securitySettings || {};
      if (sec.allowPublicClientRegistration === false) {
        return {
          success: false,
          error: "Les inscriptions publiques sont temporairement désactivées par l'administration."
        };
      }
      const requireApproval = sec.requireAdminApprovalForClients !== false;
      const initialAccountStatus: AccountStatus = requireApproval ? 'en_attente' : 'approuve';

      const { data: signUpData, error: signUpErr } = await supabaseClient.auth.signUp({
        email: cleanEmail,
        password: cleanPassword,
        options: {
          data: {
            full_name: data.managerName.trim(),
            role: 'client',
            phone: data.phone.trim(),
            city: data.city.trim()
          }
        }
      });

      if (signUpErr || !signUpData?.user?.id) {
        return {
          success: false,
          error: signUpErr?.message || "Erreur lors de la création du compte sur Supabase Auth."
        };
      }

      const userId = signUpData.user.id;
      const now = new Date().toISOString();

      await supabaseClient.from('profiles').upsert(
        {
          id: userId,
          role: 'client',
          full_name: data.managerName.trim(),
          email: cleanEmail,
          phone: data.phone.trim(),
          whatsapp: (data.whatsapp || data.phone).trim(),
          city: data.city.trim(),
          address: data.pickupAddress.trim(),
          cin_number: data.cinNumber || null,
          cin_photo_url: data.cinPhotoUrl || null,
          cin_back_photo_url: data.cinBackPhotoUrl || null,
          updated_at: now
        },
        { onConflict: 'id' }
      );

      const { data: shopRow } = await supabaseClient
        .from('merchant_shops')
        .upsert(
          {
            user_id: userId,
            shop_name: data.shopName.trim(),
            manager_name: data.managerName.trim(),
            phone: data.phone.trim(),
            whatsapp: (data.whatsapp || data.phone).trim(),
            email: cleanEmail,
            city: data.city.trim(),
            pickup_address: data.pickupAddress.trim(),
            activity_type: data.activityType || 'Commerce général',
            account_status: initialAccountStatus,
            approved_at: initialAccountStatus === 'approuve' ? now : null,
            updated_at: now
          },
          { onConflict: 'user_id' }
        )
        .select()
        .maybeSingle();

      if (data.cinPhotoUrl || data.cinBackPhotoUrl || data.cinNumber) {
        await patchAuxiliaryState(s => {
          s.kycDocuments[userId] = {
            cinNumber: data.cinNumber,
            cinPhotoUrl: data.cinPhotoUrl,
            cinBackPhotoUrl: data.cinBackPhotoUrl
          };
        });
        saveLocalKycDocs([userId, shopRow?.id, cleanEmail], {
          cinNumber: data.cinNumber,
          cinPhotoUrl: data.cinPhotoUrl,
          cinBackPhotoUrl: data.cinBackPhotoUrl
        });
      }

      const createdUser: UserProfile = {
        id: userId,
        shopId: shopRow?.id,
        name: data.managerName.trim(),
        companyName: data.shopName.trim(),
        email: cleanEmail,
        phone: data.phone.trim(),
        whatsapp: (data.whatsapp || data.phone).trim(),
        city: data.city.trim(),
        address: data.pickupAddress.trim(),
        activityType: data.activityType || 'Commerce général',
        cinNumber: data.cinNumber,
        cinPhotoUrl: data.cinPhotoUrl,
        cinBackPhotoUrl: data.cinBackPhotoUrl,
        role: 'client',
        status: initialAccountStatus,
        accountStatus: initialAccountStatus,
        registeredAt: now
      };

      const accessToken = signUpData.session?.access_token;
      if (requireApproval || !accessToken) {
        await supabaseClient.auth.signOut().catch(() => {});
        setPendingReviewUser(createdUser);
        setCurrentUser(null);
        return { success: true, user: createdUser };
      }

      setPendingReviewUser(null);
      if (typeof window !== 'undefined') {
        saveStoredAuthSession({ token: accessToken, user: createdUser });
        window.dispatchEvent(new Event('fariousy_auth_changed'));
      }
      setCurrentUser(createdUser);
      return { success: true, user: createdUser };
    } catch (err: any) {
      return { success: false, error: err.message || "Erreur lors de l'inscription sur Supabase." };
    }
  };

  const logout = async () => {
    try {
      if (typeof window !== 'undefined') {
        clearStoredAuthSession();
        sessionStorage.removeItem('fariousy_impersonator_admin');
        localStorage.removeItem('fariousy_impersonator_admin');
        sessionStorage.removeItem('fariousy_impersonator_token');
        localStorage.removeItem('fariousy_impersonator_token');
        const url = new URL(window.location.href);
        if (url.searchParams.has('app') || url.searchParams.has('mode')) {
          url.searchParams.delete('app');
          url.searchParams.delete('mode');
          window.history.replaceState({}, '', url.pathname);
        }
      }
      await supabaseClient.auth.signOut();
    } catch {
      // ignore signOut errors
    } finally {
      setImpersonatorAdmin(null);
      setCurrentUser(null);
      setPendingReviewUser(null);
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('fariousy_auth_changed'));
      }
    }
  };

  const refreshProfile = async (): Promise<UserProfile | null> => {
    try {
      if (isImpersonating || impersonatorAdmin) {
        return currentUser;
      }

      const { data: { session } } = await supabaseClient.auth.getSession();
      if (session?.user) {
        let activeAccessToken = session.access_token;
        if (isJwtTokenExpired(activeAccessToken, 15000)) {
          const { data: refreshed } = await supabaseClient.auth.refreshSession();
          if (refreshed?.session?.access_token) {
            activeAccessToken = refreshed.session.access_token;
          }
        }
        const profile = await fetchUserProfileFromDb(session.user.id, activeAccessToken);
        if (profile) {
          const mappedUser = mapProfileToUser(profile, session.user);
          saveStoredAuthSession({ token: activeAccessToken, user: mappedUser });
          setCurrentUser(mappedUser);
          return mappedUser;
        }
      }

      const parsed = getStoredAuthSession();
      if (currentUser) return currentUser;
      if (parsed?.user) {
        setCurrentUser(parsed.user);
        return parsed.user;
      }

      setCurrentUser(null);
      return null;
    } catch (e) {
      console.warn('[RefreshProfile notice]', e);
      return currentUser;
    }
  };

  const updateCurrentUser = (updates: Partial<UserProfile>) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const merged = { ...prev, ...updates };
      if (typeof window !== 'undefined') {
        const parsed = getStoredAuthSession();
        saveStoredAuthSession({ token: parsed?.token, user: merged });
      }
      return merged;
    });
  };

  const clearPendingReview = () => {
    setPendingReviewUser(null);
  };

  const isImpersonating = impersonatorAdmin !== null;

  const impersonateUser = (targetUser: UserProfile) => {
    if (!currentUser) return;

    const clientToImpersonate: UserProfile = {
      ...targetUser,
      role: targetUser.role || 'client'
    };

    const adminToSave =
      impersonatorAdmin ||
      (currentUser.role === 'admin' || currentUser.role === 'super_admin' || currentUser.role === 'employee'
        ? currentUser
        : null);
    if (!adminToSave) return;

    setImpersonatorAdmin(adminToSave);
    if (typeof window !== 'undefined') {
      try {
        sessionStorage.setItem('fariousy_impersonator_admin', JSON.stringify(adminToSave));
        localStorage.setItem('fariousy_impersonator_admin', JSON.stringify(adminToSave));
        const saved = getStoredAuthSession();
        const token = saved?.token;
        if (token) {
          sessionStorage.setItem('fariousy_impersonator_token', token);
          localStorage.setItem('fariousy_impersonator_token', token);
        }
        saveStoredAuthSession({ token, user: clientToImpersonate });
      } catch {}
    }

    setPendingReviewUser(null);
    setCurrentUser(clientToImpersonate);
  };

  const stopImpersonation = () => {
    if (!impersonatorAdmin) return;

    const restoredAdmin = impersonatorAdmin;
    setImpersonatorAdmin(null);
    if (typeof window !== 'undefined') {
      try {
        const preservedToken =
          sessionStorage.getItem('fariousy_impersonator_token') ||
          localStorage.getItem('fariousy_impersonator_token');
        sessionStorage.removeItem('fariousy_impersonator_admin');
        localStorage.removeItem('fariousy_impersonator_admin');
        sessionStorage.removeItem('fariousy_impersonator_token');
        localStorage.removeItem('fariousy_impersonator_token');

        const saved = getStoredAuthSession();
        saveStoredAuthSession({ token: preservedToken || saved?.token, user: restoredAdmin });
      } catch {}
    }

    setPendingReviewUser(null);
    setCurrentUser(restoredAdmin);
  };

  const currentRole: UserRole = currentUser ? currentUser.role : 'client';
  const isSuperAdmin =
    currentUser !== null &&
    (currentRole === 'super_admin' || currentUser.email === 'wadarazzeddine30@gmail.com');
  const isAdmin = currentUser !== null && (currentRole === 'admin' || currentRole === 'super_admin');
  const isEmployee = currentUser !== null && currentRole === 'employee';
  const isDriver = currentUser !== null && currentRole === 'driver';
  const isClient = currentUser !== null && currentRole === 'client';
  const isAuthenticated = currentUser !== null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentRole,
        pendingReviewUser,
        switchRole,
        login,
        registerBoutiqueUser,
        logout,
        clearPendingReview,
        refreshProfile,
        updateCurrentUser,
        isSuperAdmin,
        isAdmin,
        isEmployee,
        isDriver,
        isClient,
        isAuthenticated,
        isAuthLoading,
        impersonatorAdmin,
        isImpersonating,
        impersonateUser,
        stopImpersonation
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
