import { createClient, RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { PackageItem, PackageStatus, UserProfile } from '../types';

// Real Supabase project host
export const REAL_SUPABASE_URL = 'https://vplhnaqjdpicfsogjihk.supabase.co';

export function sanitizeSupabaseUrl(input?: string): string {
  if (!input || typeof input !== 'string') return REAL_SUPABASE_URL;
  const trimmed = input.trim();
  if (trimmed.startsWith('sb_') || trimmed.startsWith('eyJ')) {
    return REAL_SUPABASE_URL;
  }
  const match = trimmed.match(/https?:\/\/[^\s"'<>]+/i);
  if (match) {
    let urlStr = match[0].replace(/[.,;:)\]]+$/, '');
    urlStr = urlStr.replace('yplhnagidpicfsogjihk', 'vplhnaqjdpicfsogjihk');
    try {
      const parsed = new URL(urlStr);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        return parsed.origin;
      }
    } catch {
      // Fallback below
    }
  }
  return REAL_SUPABASE_URL;
}

const rawViteUrl = ((import.meta.env.VITE_SUPABASE_URL as string) || '').trim();
const DEFAULT_SUPABASE_URL = sanitizeSupabaseUrl(rawViteUrl);

// Support anon/publishable key only (never embed service_role key in client/APK)
const rawViteKey = ((import.meta.env.VITE_SUPABASE_ANON_KEY as string) || '').trim();
const viteUrlIsKey = rawViteUrl.startsWith('sb_publishable_') || rawViteUrl.startsWith('eyJ');
export const DEFAULT_SUPABASE_ANON_KEY = rawViteKey || (viteUrlIsKey ? rawViteUrl : '');

// Client-side Supabase client initialized with anonymous/publishable key only
export const supabaseClient: SupabaseClient = createClient(
  DEFAULT_SUPABASE_URL,
  DEFAULT_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

/**
 * Creates a non-persisting isolated Supabase Auth client so that an Admin
 * creating a new Client, Driver, or Employee via auth.signUp() never overwrites
 * or logs out the Admin's active session.
 */
export function createIsolatedAuthClient(): SupabaseClient {
  return createClient(
    DEFAULT_SUPABASE_URL,
    DEFAULT_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: 'fariousy_isolated_signup_noop'
      }
    }
  );
}

export const AUTH_SESSION_STORAGE_KEY = 'fariousy_auth_session';
export const REMEMBER_ME_STORAGE_KEY = 'fariousy_remember_me';

export function getRememberMePreference(): boolean {
  if (typeof window === 'undefined') return true;
  try {
    if (sessionStorage.getItem(REMEMBER_ME_STORAGE_KEY) === '0') return false;
    if (localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === '0') return false;
    return true;
  } catch {
    return true;
  }
}

export function getStoredAuthSession(): { token?: string; user?: any } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw =
      sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY) ||
      localStorage.getItem(AUTH_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveStoredAuthSession(
  payload: { token?: string; user: any },
  rememberMe?: boolean
): void {
  if (typeof window === 'undefined') return;
  const persist = rememberMe !== undefined ? rememberMe : getRememberMePreference();
  const serialized = JSON.stringify(payload);
  try {
    if (persist) {
      localStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
      localStorage.setItem(REMEMBER_ME_STORAGE_KEY, '1');
      sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    } else {
      sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, serialized);
      sessionStorage.setItem(REMEMBER_ME_STORAGE_KEY, '0');
      localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
      localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    }
  } catch {
    // ignore storage quota errors
  }
}

export function clearStoredAuthSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    localStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
    sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    sessionStorage.removeItem(REMEMBER_ME_STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function isJwtTokenExpired(token?: string | null, bufferMs = 15000): boolean {
  if (!token || typeof token !== 'string') return false;
  if (token.startsWith('far_sec_')) return false;
  const parts = token.split('.');
  if (parts.length !== 3) return false;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    const decoded = typeof atob === 'function' ? atob(padded) : '';
    if (!decoded) return false;
    const payload = JSON.parse(decoded);
    if (typeof payload?.exp === 'number') {
      return payload.exp * 1000 <= Date.now() + bufferMs;
    }
    return false;
  } catch {
    return false;
  }
}

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  let token: string | null = null;

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.access_token) {
      const isExpiringSoon =
        (session.expires_at ? session.expires_at * 1000 < Date.now() + 30000 : false) ||
        isJwtTokenExpired(session.access_token, 30000);
      if (isExpiringSoon) {
        const { data: refreshed } = await supabaseClient.auth.refreshSession();
        if (refreshed?.session?.access_token) {
          token = refreshed.session.access_token;
        }
      } else {
        token = session.access_token;
      }
    }
  } catch {}

  if (!token) {
    const stored = getStoredAuthSession();
    if (stored?.token && !isJwtTokenExpired(stored.token, 5000)) {
      token = stored.token;
    }
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// =============================================================================
// INTERNAL HELPERS: UUID, SANITIZATION, SNAPSHOT PERSISTENCE (system_collections)
// =============================================================================

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function isUuid(val?: string | null): boolean {
  return Boolean(val && UUID_REGEX.test(String(val).trim()));
}

function isMissingColumnError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42703' ||
    code === 'PGRST204' ||
    (msg.includes('column') && (msg.includes('does not exist') || msg.includes('schema cache') || msg.includes('could not find')))
  );
}

export function extractMissingColumnName(err: any): string | null {
  const msg = String(err?.message || '');
  // PostgREST: Could not find the 'partner_id' column of 'packages' in the schema cache
  const pgrstMatch = msg.match(/could not find the ['"]([^'"]+)['"] column/i);
  if (pgrstMatch?.[1]) return pgrstMatch[1];
  // Postgres: column "partner_id" of relation "packages" does not exist
  const pgQuotedMatch = msg.match(/column\s+"([^"]+)"/i);
  if (pgQuotedMatch?.[1]) return pgQuotedMatch[1];
  // Postgres unquoted: column packages.partner_id does not exist
  const pgBareMatch = msg.match(/column\s+(?:[a-z0-9_]+\.)?([a-z0-9_]+)\s+does not exist/i);
  if (pgBareMatch?.[1]) return pgBareMatch[1];
  return null;
}

function isMissingTableError(err: any): boolean {
  const code = String(err?.code || '');
  const msg = String(err?.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('could not find the table') ||
    (msg.includes('relation') && msg.includes('does not exist'))
  );
}

function normalizePhoneDigits(phone?: string | null): string {
  return String(phone || '').replace(/\D/g, '');
}

function phoneMatches(a?: string | null, b?: string | null): boolean {
  const da = normalizePhoneDigits(a);
  const db = normalizePhoneDigits(b);
  if (!da || !db) return false;
  if (da === db) return true;
  if (da.length >= 8 && db.length >= 8) {
    return da.slice(-8) === db.slice(-8);
  }
  return false;
}

export function generateSafeUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Local cache keys for offline resilience on Capacitor Android APK
const SNAPSHOT_LOCAL_PREFIX = 'fariousy_sb_snapshot_';
const snapshotMemoryCache = new Map<string, any>();
const snapshotWriteQueues = new Map<string, Promise<any>>();
const snapshotLastTs = new Map<string, number>();

function getSnapshotTimestamp(val: any): number {
  if (!val || typeof val !== 'object') return 0;
  const raw = val.updatedAt || val.updated_at;
  if (!raw) return 0;
  const ms = Date.parse(String(raw));
  return Number.isFinite(ms) ? ms : 0;
}

function nextMonotonicIso(key: string): string {
  const prev = snapshotLastTs.get(key) || 0;
  const next = Math.max(Date.now(), prev + 1);
  snapshotLastTs.set(key, next);
  return new Date(next).toISOString();
}

function enqueueSnapshotOp<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = snapshotWriteQueues.get(key) || Promise.resolve();
  const next = previous
    .catch(() => undefined)
    .then(() => fn());
  snapshotWriteQueues.set(
    key,
    next.catch(() => undefined)
  );
  return next;
}

function readLocalSnapshot<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${SNAPSHOT_LOCAL_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeLocalSnapshot<T>(key: string, value: T): void {
  snapshotMemoryCache.set(key, value);
  const ts = getSnapshotTimestamp(value);
  if (ts > (snapshotLastTs.get(key) || 0)) {
    snapshotLastTs.set(key, ts);
  }
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${SNAPSHOT_LOCAL_PREFIX}${key}`, JSON.stringify(value));
  } catch {
    // ignore storage quota errors
  }
}

export const SNAPSHOT_KEYS = {
  SYSTEM_STATE: { key: 'system_state', fallbackPartnerId: '__fariousy_system_state__' },
  CLIENT_STOCK: { key: 'client_stock_state', fallbackPartnerId: '__fariousy_client_stock__' },
  AUXILIARY: { key: 'auxiliary_state', fallbackPartnerId: '__fariousy_auxiliary_state__' },
  USER_NOTIFICATIONS: { key: 'user_notifications_state', fallbackPartnerId: '__fariousy_user_notifications__' }
} as const;

async function persistSnapshotToRemote<T = any>(
  key: string,
  value: T,
  fallbackPartnerId?: string
): Promise<boolean> {
  const now = new Date().toISOString();

  // 1. Primary: upsert into public.system_collections (with schema-safe retry without updated_at)
  try {
    let { error } = await supabaseClient
      .from('system_collections')
      .upsert({ key, value, updated_at: now }, { onConflict: 'key' });
    if (error && isMissingColumnError(error)) {
      const retry = await supabaseClient
        .from('system_collections')
        .upsert({ key, value }, { onConflict: 'key' });
      error = retry.error;
    }
    if (!error) return true;
    console.warn(`[Supabase Snapshot] system_collections upsert failed for "${key}":`, error.message);
  } catch (err: any) {
    console.warn(`[Supabase Snapshot] system_collections error for "${key}":`, err?.message || err);
  }

  // 2. Secondary fallback: delivery_partners JSON row
  if (fallbackPartnerId) {
    try {
      let { error } = await supabaseClient
        .from('delivery_partners')
        .upsert(
          {
            id: fallbackPartnerId,
            name: `System Snapshot (${key})`,
            status: 'inactive',
            api_config: value,
            updated_at: now
          },
          { onConflict: 'id' }
        );
      if (error && isMissingColumnError(error)) {
        const retry = await supabaseClient
          .from('delivery_partners')
          .upsert(
            {
              id: fallbackPartnerId,
              name: `System Snapshot (${key})`,
              api_config: value
            },
            { onConflict: 'id' }
          );
        error = retry.error;
      }
      if (!error) return true;
      console.warn(`[Supabase Snapshot] delivery_partners fallback failed for "${key}":`, error.message);
    } catch (err: any) {
      console.warn(`[Supabase Snapshot] delivery_partners fallback error for "${key}":`, err?.message || err);
    }
  }

  return false;
}

export async function loadSupabaseSnapshot<T = any>(
  key: string,
  fallbackPartnerId?: string
): Promise<T | null> {
  const localMem = snapshotMemoryCache.get(key) as T | undefined;
  const localDisk = readLocalSnapshot<T>(key);
  const localBest =
    getSnapshotTimestamp(localMem) >= getSnapshotTimestamp(localDisk)
      ? (localMem ?? localDisk)
      : (localDisk ?? localMem ?? null);
  const localTs = getSnapshotTimestamp(localBest);

  let remoteVal: T | null = null;

  // 1. Primary: public.system_collections
  try {
    const { data, error } = await supabaseClient
      .from('system_collections')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data?.value && typeof data.value === 'object') {
      remoteVal = data.value as T;
    }
  } catch {}

  // 2. Secondary fallback: public.delivery_partners JSON row (legacy compatibility)
  if (!remoteVal && fallbackPartnerId) {
    try {
      const { data, error } = await supabaseClient
        .from('delivery_partners')
        .select('api_config')
        .eq('id', fallbackPartnerId)
        .maybeSingle();

      if (!error && data?.api_config && typeof data.api_config === 'object') {
        remoteVal = data.api_config as T;
      }
    } catch {}
  }

  const remoteTs = getSnapshotTimestamp(remoteVal);

  // Never let an older remote snapshot overwrite a newer locally-saved snapshot
  if (localBest && (!remoteVal || (localTs > 0 && localTs > remoteTs))) {
    snapshotMemoryCache.set(key, localBest);
    if (localTs > remoteTs) {
      // Opportunistically push newer local snapshot to Supabase in background
      persistSnapshotToRemote(key, localBest, fallbackPartnerId).catch(() => {});
    }
    return localBest;
  }

  if (remoteVal) {
    writeLocalSnapshot(key, remoteVal);
    return remoteVal;
  }

  return localBest ?? null;
}

export async function saveSupabaseSnapshot<T = any>(
  key: string,
  value: T,
  fallbackPartnerId?: string
): Promise<boolean> {
  const stamped =
    value && typeof value === 'object'
      ? ({ ...(value as any), updatedAt: nextMonotonicIso(key) } as T)
      : value;
  writeLocalSnapshot(key, stamped);
  return persistSnapshotToRemote(key, stamped, fallbackPartnerId);
}

export interface AuxiliaryStateSnapshot {
  packages: PackageItem[];
  deletedPackageIds: string[];
  reviews: any[];
  packageOptions: Record<string, any>;
  packageOverrides: Record<string, any>;
  problemReports: Record<string, any>;
  driverMeta: Record<string, any>;
  kycDocuments: Record<string, any>;
  clientBankMeta: Record<string, { bankName?: string; bankRib?: string }>;
  userSavedAddresses: Record<string, any[]>;
  whatsappLogs: any[];
  visitorStats: {
    totalVisits: number;
    uniqueVisitors: string[];
    dailyVisits: Record<string, number>;
    recentVisits: Array<{ ts: string; path: string; device?: string; referrer?: string }>;
  };
  securitySettings: {
    sessionTimeoutMinutes: number;
    requireStrongPasswords: boolean;
    requireAdminApprovalForClients: boolean;
    maxLoginAttempts: number;
    enableAuditTrail: boolean;
    twoFactorEnforced: boolean;
    ipRestrictionEnabled: boolean;
    allowedIps: string[];
  };
  updatedAt?: string;
}

const DEFAULT_AUXILIARY_STATE: AuxiliaryStateSnapshot = {
  packages: [],
  deletedPackageIds: [],
  reviews: [],
  packageOptions: {},
  packageOverrides: {},
  problemReports: {},
  driverMeta: {},
  kycDocuments: {},
  clientBankMeta: {},
  userSavedAddresses: {},
  whatsappLogs: [],
  visitorStats: {
    totalVisits: 0,
    uniqueVisitors: [],
    dailyVisits: {},
    recentVisits: []
  },
  securitySettings: {
    sessionTimeoutMinutes: 480,
    requireStrongPasswords: true,
    requireAdminApprovalForClients: true,
    maxLoginAttempts: 5,
    enableAuditTrail: true,
    twoFactorEnforced: false,
    ipRestrictionEnabled: false,
    allowedIps: []
  }
};

function normalizeAuxiliaryState(loaded: Partial<AuxiliaryStateSnapshot> | null): AuxiliaryStateSnapshot {
  if (!loaded || typeof loaded !== 'object') {
    return { ...DEFAULT_AUXILIARY_STATE };
  }
  return {
    ...DEFAULT_AUXILIARY_STATE,
    ...loaded,
    packages: Array.isArray(loaded.packages) ? loaded.packages : [],
    deletedPackageIds: Array.isArray(loaded.deletedPackageIds) ? loaded.deletedPackageIds : [],
    reviews: Array.isArray(loaded.reviews) ? loaded.reviews : [],
    packageOptions: loaded.packageOptions && typeof loaded.packageOptions === 'object' ? loaded.packageOptions : {},
    packageOverrides: loaded.packageOverrides && typeof loaded.packageOverrides === 'object' ? loaded.packageOverrides : {},
    problemReports: loaded.problemReports && typeof loaded.problemReports === 'object' ? loaded.problemReports : {},
    driverMeta: loaded.driverMeta && typeof loaded.driverMeta === 'object' ? loaded.driverMeta : {},
    kycDocuments: loaded.kycDocuments && typeof loaded.kycDocuments === 'object' ? loaded.kycDocuments : {},
    clientBankMeta: loaded.clientBankMeta && typeof loaded.clientBankMeta === 'object' ? loaded.clientBankMeta : {},
    userSavedAddresses: loaded.userSavedAddresses && typeof loaded.userSavedAddresses === 'object' ? loaded.userSavedAddresses : {},
    whatsappLogs: Array.isArray(loaded.whatsappLogs) ? loaded.whatsappLogs : [],
    visitorStats: {
      ...DEFAULT_AUXILIARY_STATE.visitorStats,
      ...(loaded.visitorStats || {})
    },
    securitySettings: {
      ...DEFAULT_AUXILIARY_STATE.securitySettings,
      ...(loaded.securitySettings || {})
    }
  };
}

export async function loadAuxiliaryState(): Promise<AuxiliaryStateSnapshot> {
  const loaded = await loadSupabaseSnapshot<Partial<AuxiliaryStateSnapshot>>(
    SNAPSHOT_KEYS.AUXILIARY.key,
    SNAPSHOT_KEYS.AUXILIARY.fallbackPartnerId
  );
  return normalizeAuxiliaryState(loaded);
}

export async function patchAuxiliaryState(
  updater: (current: AuxiliaryStateSnapshot) => AuxiliaryStateSnapshot | void
): Promise<AuxiliaryStateSnapshot> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.AUXILIARY.key, async () => {
    const cached = snapshotMemoryCache.get(SNAPSHOT_KEYS.AUXILIARY.key);
    const current = cached
      ? normalizeAuxiliaryState(cached)
      : await loadAuxiliaryState();
    const cloned: AuxiliaryStateSnapshot = JSON.parse(JSON.stringify(current));
    const result = updater(cloned) || cloned;
    result.updatedAt = nextMonotonicIso(SNAPSHOT_KEYS.AUXILIARY.key);
    await saveSupabaseSnapshot(
      SNAPSHOT_KEYS.AUXILIARY.key,
      result,
      SNAPSHOT_KEYS.AUXILIARY.fallbackPartnerId
    );
    return result;
  });
}

export interface SystemStateSnapshot {
  systemCollections: Record<string, any>;
  companySettings?: Record<string, any>;
  updatedAt?: string;
}

function normalizeSystemState(loaded: Partial<SystemStateSnapshot> | null): SystemStateSnapshot {
  if (!loaded || typeof loaded !== 'object') {
    return { systemCollections: {}, companySettings: {} };
  }
  return {
    systemCollections: loaded.systemCollections && typeof loaded.systemCollections === 'object' ? loaded.systemCollections : {},
    companySettings: loaded.companySettings && typeof loaded.companySettings === 'object' ? loaded.companySettings : {},
    updatedAt: loaded.updatedAt
  };
}

export async function loadSystemState(): Promise<SystemStateSnapshot> {
  const loaded = await loadSupabaseSnapshot<SystemStateSnapshot>(
    SNAPSHOT_KEYS.SYSTEM_STATE.key,
    SNAPSHOT_KEYS.SYSTEM_STATE.fallbackPartnerId
  );
  return normalizeSystemState(loaded);
}

export async function saveSystemState(next: SystemStateSnapshot): Promise<boolean> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.SYSTEM_STATE.key, async () => {
    const cached = snapshotMemoryCache.get(SNAPSHOT_KEYS.SYSTEM_STATE.key);
    const base = cached ? normalizeSystemState(cached) : { systemCollections: {}, companySettings: {} };
    const merged: SystemStateSnapshot = {
      systemCollections: {
        ...(base.systemCollections || {}),
        ...(next.systemCollections || {})
      },
      companySettings: {
        ...(base.companySettings || {}),
        ...(next.companySettings || {})
      }
    };
    return saveSupabaseSnapshot(
      SNAPSHOT_KEYS.SYSTEM_STATE.key,
      merged,
      SNAPSHOT_KEYS.SYSTEM_STATE.fallbackPartnerId
    );
  });
}

export async function saveSystemCollectionDirect(key: string, value: any): Promise<boolean> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.SYSTEM_STATE.key, async () => {
    const cached = snapshotMemoryCache.get(SNAPSHOT_KEYS.SYSTEM_STATE.key);
    const current = cached ? normalizeSystemState(cached) : await loadSystemState();
    const next: SystemStateSnapshot = {
      ...current,
      systemCollections: {
        ...(current.systemCollections || {}),
        [key]: value
      }
    };
    return saveSupabaseSnapshot(
      SNAPSHOT_KEYS.SYSTEM_STATE.key,
      next,
      SNAPSHOT_KEYS.SYSTEM_STATE.fallbackPartnerId
    );
  });
}

export async function patchSystemCollectionDirect<T = any>(
  key: string,
  updater: (current: T) => T
): Promise<T> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.SYSTEM_STATE.key, async () => {
    const cached = snapshotMemoryCache.get(SNAPSHOT_KEYS.SYSTEM_STATE.key);
    const current = cached ? normalizeSystemState(cached) : await loadSystemState();
    const prevVal = current.systemCollections?.[key] as T;
    const nextVal = updater(prevVal);
    const next: SystemStateSnapshot = {
      ...current,
      systemCollections: {
        ...(current.systemCollections || {}),
        [key]: nextVal
      }
    };
    await saveSupabaseSnapshot(
      SNAPSHOT_KEYS.SYSTEM_STATE.key,
      next,
      SNAPSHOT_KEYS.SYSTEM_STATE.fallbackPartnerId
    );
    return nextVal;
  });
}

export async function saveCompanySettingsDirect(patch: Record<string, any>): Promise<Record<string, any>> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.SYSTEM_STATE.key, async () => {
    const cached = snapshotMemoryCache.get(SNAPSHOT_KEYS.SYSTEM_STATE.key);
    const current = cached ? normalizeSystemState(cached) : await loadSystemState();
    const nextSettings = {
      ...(current.companySettings || {}),
      ...(patch || {})
    };
    const next: SystemStateSnapshot = {
      ...current,
      companySettings: nextSettings
    };
    await saveSupabaseSnapshot(
      SNAPSHOT_KEYS.SYSTEM_STATE.key,
      next,
      SNAPSHOT_KEYS.SYSTEM_STATE.fallbackPartnerId
    );
    return nextSettings;
  });
}

export interface ClientStockSnapshot {
  products: any[];
  movements: any[];
  invoices: any[];
  updatedAt?: string;
}

export async function loadClientStockState(): Promise<ClientStockSnapshot> {
  const loaded = await loadSupabaseSnapshot<ClientStockSnapshot>(
    SNAPSHOT_KEYS.CLIENT_STOCK.key,
    SNAPSHOT_KEYS.CLIENT_STOCK.fallbackPartnerId
  );
  return {
    products: Array.isArray(loaded?.products) ? loaded!.products : [],
    movements: Array.isArray(loaded?.movements) ? loaded!.movements : [],
    invoices: Array.isArray(loaded?.invoices) ? loaded!.invoices : [],
    updatedAt: loaded?.updatedAt
  };
}

export async function saveClientStockState(next: ClientStockSnapshot): Promise<boolean> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.CLIENT_STOCK.key, async () => {
    return saveSupabaseSnapshot(
      SNAPSHOT_KEYS.CLIENT_STOCK.key,
      next,
      SNAPSHOT_KEYS.CLIENT_STOCK.fallbackPartnerId
    );
  });
}

export async function loadUserNotificationsState(): Promise<{ userNotifications: any[]; updatedAt?: string }> {
  const loaded = await loadSupabaseSnapshot<{ userNotifications: any[]; updatedAt?: string }>(
    SNAPSHOT_KEYS.USER_NOTIFICATIONS.key,
    SNAPSHOT_KEYS.USER_NOTIFICATIONS.fallbackPartnerId
  );
  return {
    userNotifications: Array.isArray(loaded?.userNotifications) ? loaded!.userNotifications : [],
    updatedAt: loaded?.updatedAt
  };
}

export async function saveUserNotificationsState(userNotifications: any[]): Promise<boolean> {
  return enqueueSnapshotOp(SNAPSHOT_KEYS.USER_NOTIFICATIONS.key, async () => {
    return saveSupabaseSnapshot(
      SNAPSHOT_KEYS.USER_NOTIFICATIONS.key,
      { userNotifications },
      SNAPSHOT_KEYS.USER_NOTIFICATIONS.fallbackPartnerId
    );
  });
}

// Helper to get active actor info from Supabase Auth session + local stored profile (supports admin impersonation)
export async function getAuthenticatedActor(): Promise<{
  id: string;
  email: string;
  role: string;
  name: string;
  companyName?: string;
  shopId?: string;
  isImpersonating: boolean;
  impersonatorRole?: string;
} | null> {
  const stored = getStoredAuthSession();
  const isImpersonating =
    typeof window !== 'undefined' &&
    Boolean(
      sessionStorage.getItem('fariousy_impersonator_admin') ||
        localStorage.getItem('fariousy_impersonator_admin')
    );
  let impersonatorRole: string | undefined;
  if (isImpersonating && typeof window !== 'undefined') {
    try {
      const imp = JSON.parse(
        sessionStorage.getItem('fariousy_impersonator_admin') ||
          localStorage.getItem('fariousy_impersonator_admin') ||
          '{}'
      );
      impersonatorRole = imp?.role;
    } catch {}
  }

  let authUser: any = null;
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    authUser = session?.user || null;
  } catch {}

  if (isImpersonating && stored?.user?.id) {
    return {
      id: stored.user.id,
      email: stored.user.email || '',
      role: String(stored.user.role || 'client').toLowerCase(),
      name: stored.user.name || stored.user.companyName || 'Utilisateur',
      companyName: stored.user.companyName,
      shopId: stored.user.shopId,
      isImpersonating: true,
      impersonatorRole
    };
  }

  if (authUser?.id) {
    const storedMatches = stored?.user?.id === authUser.id;
    return {
      id: authUser.id,
      email: authUser.email || stored?.user?.email || '',
      role: String(
        (storedMatches ? stored?.user?.role : undefined) ||
          authUser.user_metadata?.role ||
          'client'
      ).toLowerCase(),
      name:
        (storedMatches ? stored?.user?.name : undefined) ||
        authUser.user_metadata?.full_name ||
        authUser.email?.split('@')[0] ||
        'Utilisateur',
      companyName: storedMatches ? stored?.user?.companyName : undefined,
      shopId: storedMatches ? stored?.user?.shopId : undefined,
      isImpersonating: false
    };
  }

  if (stored?.user?.id) {
    return {
      id: stored.user.id,
      email: stored.user.email || '',
      role: String(stored.user.role || 'client').toLowerCase(),
      name: stored.user.name || 'Utilisateur',
      companyName: stored.user.companyName,
      shopId: stored.user.shopId,
      isImpersonating
    };
  }

  return null;
}

export function isStaffRole(role?: string | null): boolean {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'super_admin' || r === 'superadmin' || r === 'employee' || r === 'ops';
}

// =============================================================================
// AUTH & PROFILE RESOLUTION (100% DIRECT SUPABASE SDK)
// =============================================================================

/**
 * Resolves a login identifier (email, username/full_name, shop name, or phone number)
 * directly via Supabase RPC `resolve_login_identifier` + direct table queries.
 */
export async function resolveLoginIdentifier(identifier: string): Promise<{
  success: boolean;
  email?: string;
  role?: string;
  name?: string;
  phone?: string;
  error?: string;
}> {
  const raw = (identifier || '').trim();
  if (!raw) {
    return { success: false, error: 'Identifiant requis.' };
  }

  if (raw.includes('@')) {
    return { success: true, email: raw.toLowerCase() };
  }

  const digits = normalizePhoneDigits(raw);

  // 1. Primary: SECURITY DEFINER RPC (works safely before authentication with strict RLS)
  try {
    const { data, error } = await supabaseClient.rpc('resolve_login_identifier', {
      p_identifier: raw
    });
    if (!error && Array.isArray(data) && data.length > 0 && data[0]?.email) {
      return {
        success: true,
        email: String(data[0].email).toLowerCase(),
        role: data[0].role,
        name: data[0].full_name,
        phone: data[0].phone
      };
    }
  } catch {}

  // 2. Direct fallback query on public.profiles (when RLS allows or authenticated)
  try {
    const { data: profByName } = await supabaseClient
      .from('profiles')
      .select('*')
      .ilike('full_name', raw)
      .limit(1)
      .maybeSingle();

    if (profByName?.email) {
      return {
        success: true,
        email: String(profByName.email).toLowerCase(),
        role: profByName.role,
        name: profByName.full_name,
        phone: profByName.phone
      };
    }

    if (digits.length >= 8) {
      const tail8 = digits.slice(-8);
      const { data: profsByPhone } = await supabaseClient
        .from('profiles')
        .select('*')
        .limit(100);

      const matchedProf = (profsByPhone || []).find(
        (p: any) => phoneMatches(p.phone, raw) || phoneMatches(p.whatsapp, raw) || normalizePhoneDigits(p.phone).endsWith(tail8)
      );
      if (matchedProf?.email) {
        return {
          success: true,
          email: String(matchedProf.email).toLowerCase(),
          role: matchedProf.role,
          name: matchedProf.full_name,
          phone: matchedProf.phone
        };
      }
    }
  } catch {}

  // 3. Direct fallback query on public.merchant_shops
  try {
    const { data: shopByName } = await supabaseClient
      .from('merchant_shops')
      .select('*')
      .ilike('shop_name', raw)
      .limit(1)
      .maybeSingle();

    if (shopByName?.email) {
      return {
        success: true,
        email: String(shopByName.email).toLowerCase(),
        role: 'client',
        name: shopByName.manager_name || shopByName.shop_name,
        phone: shopByName.phone
      };
    }

    if (digits.length >= 8) {
      const { data: shops } = await supabaseClient
        .from('merchant_shops')
        .select('*')
        .limit(100);

      const matchedShop = (shops || []).find(
        (s: any) => phoneMatches(s.phone, raw) || phoneMatches(s.whatsapp, raw)
      );
      if (matchedShop?.email) {
        return {
          success: true,
          email: String(matchedShop.email).toLowerCase(),
          role: 'client',
          name: matchedShop.manager_name || matchedShop.shop_name,
          phone: matchedShop.phone
        };
      }
    }
  } catch {}

  // 4. Fallback for phone-based synthetic emails created for drivers/merchants
  if (digits.length >= 8) {
    return {
      success: true,
      email: `${digits}@fariousy.com`,
      phone: raw
    };
  }

  return { success: false, error: 'Identifiant introuvable dans Supabase.' };
}

/**
 * Fetch profile directly from public.profiles table using Supabase Auth user ID.
 * Merges shop account_status, bank metadata, employee permissions, and driver metadata.
 */
export async function fetchUserProfileFromDb(userId: string, _accessToken?: string): Promise<any | null> {
  if (!userId) return null;

  try {
    const { data, error } = await supabaseClient
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    const enriched: any = { ...data };

    // Merge merchant shop data for clients
    if (String(data.role || '').toLowerCase() === 'client') {
      try {
        const { data: shop } = await supabaseClient
          .from('merchant_shops')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle();

        if (shop) {
          enriched.shop_id = shop.id;
          enriched.company_name = shop.shop_name || enriched.company_name;
          enriched.status = shop.account_status || 'approuve';
          enriched.account_status = shop.account_status || 'approuve';
          enriched.status_reason = shop.status_reason;
          enriched.approved_at = shop.approved_at;
          enriched.approved_by = shop.approved_by;
          enriched.city = shop.city || enriched.city;
          enriched.address = shop.pickup_address || enriched.address;
          enriched.phone = shop.phone || enriched.phone;
          enriched.whatsapp = shop.whatsapp || enriched.whatsapp;
          enriched.bank_name = shop.bank_name || enriched.bank_name;
          enriched.bank_rib = shop.bank_rib || enriched.bank_rib;
        }
      } catch {}
    }

    // Merge auxiliary metadata (bank info, driver fees, KYC docs) and employee permissions
    try {
      const [aux, sys] = await Promise.all([loadAuxiliaryState(), loadSystemState()]);
      const bankMeta = aux.clientBankMeta?.[userId] || (enriched.shop_id ? aux.clientBankMeta?.[enriched.shop_id] : undefined);
      if (bankMeta) {
        if (bankMeta.bankName && !enriched.bank_name) enriched.bank_name = bankMeta.bankName;
        if (bankMeta.bankRib && !enriched.bank_rib) enriched.bank_rib = bankMeta.bankRib;
      }

      const dMeta = aux.driverMeta?.[userId];
      if (dMeta) {
        Object.assign(enriched, {
          driver_fee_per_delivery: dMeta.driverFeePerDelivery ?? enriched.driver_fee_per_delivery,
          driver_fixed_salary: dMeta.driverFixedSalary ?? enriched.driver_fixed_salary,
          driver_salary_type: dMeta.driverSalaryType ?? enriched.driver_salary_type,
          driver_pickup_fee: dMeta.driverPickupFee ?? enriched.driver_pickup_fee,
          driver_bonus_threshold: dMeta.driverBonusThreshold ?? enriched.driver_bonus_threshold,
          driver_bonus_amount: dMeta.driverBonusAmount ?? enriched.driver_bonus_amount,
          status: dMeta.status ?? enriched.status
        });
      }

      const employeesList = Array.isArray(sys.systemCollections?.employees)
        ? sys.systemCollections.employees
        : [];
      const matchedEmp = employeesList.find(
        (e: any) => e.id === userId || (data.email && String(e.email || '').toLowerCase() === String(data.email).toLowerCase())
      );
      if (matchedEmp) {
        enriched.agency_id = enriched.agency_id || matchedEmp.agencyId;
        enriched.agency_name = enriched.agency_name || matchedEmp.agencyName;
        enriched.permissions = enriched.permissions || matchedEmp.permissions;
        enriched.granular_permissions = enriched.granular_permissions || matchedEmp.granularPermissions;
        enriched.employee_role = enriched.employee_role || matchedEmp.employeeRole;
        enriched.assigned_cities = enriched.assigned_cities || matchedEmp.assignedCities;
        enriched.daily_target_confirmations =
          enriched.daily_target_confirmations ?? matchedEmp.dailyTargetConfirmations;
      }
    } catch {}

    return enriched;
  } catch (err) {
    console.warn('[Direct profile select failed]', err);
    return null;
  }
}

// =============================================================================
// CLIENTS CRUD (100% DIRECT SUPABASE SDK)
// =============================================================================

export async function fetchSupabaseClients(): Promise<{
  clients: UserProfile[];
  error: string | null;
}> {
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session?.user) {
      return { clients: [], error: 'Votre session a expiré. Veuillez vous reconnecter.' };
    }

    const [shopsRes, profsRes, aux] = await Promise.all([
      supabaseClient
        .from('merchant_shops')
        .select('*, profiles:user_id(*)')
        .order('created_at', { ascending: false }),
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'client')
        .order('created_at', { ascending: false }),
      loadAuxiliaryState()
    ]);

    if (shopsRes.error) {
      return { clients: [], error: `Erreur Supabase merchant_shops: ${shopsRes.error.message}` };
    }
    if (profsRes.error) {
      return { clients: [], error: `Erreur Supabase profiles: ${profsRes.error.message}` };
    }

    const shopsData = shopsRes.data || [];
    const profilesData = profsRes.data || [];
    const shopUserIds = new Set(shopsData.map((s: any) => s.user_id).filter(Boolean));
    const mergedClients: UserProfile[] = [];

    for (const shop of shopsData as any[]) {
      const uid = shop.user_id || shop.id;
      const bankMeta = aux.clientBankMeta?.[uid] || aux.clientBankMeta?.[shop.id];
      const kyc = aux.kycDocuments?.[uid] || aux.kycDocuments?.[shop.id] || (shop.email ? aux.kycDocuments?.[shop.email.toLowerCase()] : undefined);

      mergedClients.push({
        id: uid,
        shopId: shop.id,
        name: (shop.manager_name || shop.profiles?.full_name || shop.shop_name || 'Gérant').trim(),
        companyName: (shop.shop_name || '').trim() || shop.manager_name || shop.profiles?.full_name || 'Boutique',
        email: shop.email || shop.profiles?.email || '',
        phone: shop.phone || shop.profiles?.phone || '',
        whatsapp: shop.whatsapp || shop.profiles?.whatsapp || undefined,
        city: shop.city || shop.profiles?.city || 'Casablanca',
        address: shop.pickup_address || shop.profiles?.address || '',
        activityType: shop.activity_type || 'Commerce général',
        bankName: shop.bank_name || shop.profiles?.bank_name || bankMeta?.bankName || undefined,
        bankRib: shop.bank_rib || shop.profiles?.bank_rib || bankMeta?.bankRib || undefined,
        cinNumber: shop.cin_number || shop.profiles?.cin_number || kyc?.cinNumber || undefined,
        cinPhotoUrl: shop.cin_photo_url || shop.profiles?.cin_photo_url || kyc?.cinPhotoUrl || undefined,
        cinBackPhotoUrl: shop.cin_back_photo_url || shop.profiles?.cin_back_photo_url || kyc?.cinBackPhotoUrl || undefined,
        role: 'client',
        status: (shop.account_status as any) || 'en_attente',
        accountStatus: (shop.account_status as any) || 'en_attente',
        statusReason: shop.status_reason || undefined,
        approvedAt: shop.approved_at || undefined,
        approvedBy: shop.approved_by || undefined,
        registeredAt: shop.created_at || new Date().toISOString()
      });
    }

    for (const prof of profilesData as any[]) {
      if (!shopUserIds.has(prof.id)) {
        const bankMeta = aux.clientBankMeta?.[prof.id];
        const kyc = aux.kycDocuments?.[prof.id] || (prof.email ? aux.kycDocuments?.[prof.email.toLowerCase()] : undefined);
        mergedClients.push({
          id: prof.id,
          name: prof.full_name || 'Client',
          companyName: prof.company_name || prof.full_name || 'Client Individuel',
          email: prof.email || '',
          phone: prof.phone || '',
          whatsapp: prof.whatsapp || undefined,
          city: prof.city || 'Casablanca',
          address: prof.address || '',
          activityType: 'Commerce général',
          bankName: prof.bank_name || bankMeta?.bankName || undefined,
          bankRib: prof.bank_rib || bankMeta?.bankRib || undefined,
          cinNumber: prof.cin_number || kyc?.cinNumber || undefined,
          cinPhotoUrl: prof.cin_photo_url || kyc?.cinPhotoUrl || undefined,
          cinBackPhotoUrl: prof.cin_back_photo_url || kyc?.cinBackPhotoUrl || undefined,
          role: 'client',
          status: (prof.account_status as any) || 'approuve',
          accountStatus: (prof.account_status as any) || 'approuve',
          registeredAt: prof.created_at || new Date().toISOString()
        });
      }
    }

    return { clients: mergedClients, error: null };
  } catch (err: any) {
    return { clients: [], error: err.message || 'Erreur inattendue de connexion Supabase.' };
  }
}

export interface CreateClientPayload {
  shopName: string;
  managerName: string;
  phone: string;
  whatsapp?: string;
  email: string;
  city: string;
  address: string;
  activityType?: string;
  password?: string;
  isTest?: boolean;
}

/**
 * Creates a real client in Supabase (Auth via isolated client + public.profiles + public.merchant_shops).
 * Never clobbers the active Admin session and never uses service_role keys.
 */
export async function createSupabaseClient(payload: CreateClientPayload): Promise<{
  success: boolean;
  message?: string;
  client?: UserProfile;
  invitationLink?: string | null;
  error?: string;
  isTest?: boolean;
}> {
  try {
    const cleanEmail = (payload.email || '').trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      return { success: false, error: 'Adresse e-mail valide requise.' };
    }

    const tempPassword =
      (payload.password && payload.password.trim().length >= 6)
        ? payload.password.trim()
        : `Far${Math.floor(100000 + Math.random() * 900000)}!`;

    const isolatedAuth = createIsolatedAuthClient();
    const { data: signUpData, error: signUpErr } = await isolatedAuth.auth.signUp({
      email: cleanEmail,
      password: tempPassword,
      options: {
        data: {
          full_name: payload.managerName.trim(),
          role: 'client',
          phone: payload.phone.trim(),
          city: payload.city.trim()
        }
      }
    });

    if (signUpErr || !signUpData?.user?.id) {
      return {
        success: false,
        error: signUpErr?.message || 'Impossible de créer le compte client dans Supabase Auth.'
      };
    }

    const userId = signUpData.user.id;
    const now = new Date().toISOString();

    await supabaseClient.from('profiles').upsert(
      {
        id: userId,
        role: 'client',
        full_name: payload.managerName.trim(),
        email: cleanEmail,
        phone: payload.phone.trim(),
        whatsapp: (payload.whatsapp || payload.phone).trim(),
        city: payload.city.trim(),
        address: payload.address.trim(),
        updated_at: now
      },
      { onConflict: 'id' }
    );

    const { data: shopRow, error: shopErr } = await supabaseClient
      .from('merchant_shops')
      .upsert(
        {
          user_id: userId,
          shop_name: payload.shopName.trim(),
          manager_name: payload.managerName.trim(),
          phone: payload.phone.trim(),
          whatsapp: (payload.whatsapp || payload.phone).trim(),
          email: cleanEmail,
          city: payload.city.trim(),
          pickup_address: payload.address.trim(),
          activity_type: payload.activityType || 'Commerce général',
          account_status: 'approuve',
          approved_at: now,
          updated_at: now
        },
        { onConflict: 'user_id' }
      )
      .select()
      .maybeSingle();

    if (shopErr) {
      return {
        success: false,
        error: `Compte Auth créé, mais erreur merchant_shops : ${shopErr.message}`
      };
    }

    const createdClient: UserProfile = {
      id: userId,
      shopId: shopRow?.id,
      name: payload.managerName.trim(),
      companyName: payload.shopName.trim(),
      email: cleanEmail,
      phone: payload.phone.trim(),
      whatsapp: (payload.whatsapp || payload.phone).trim(),
      city: payload.city.trim(),
      address: payload.address.trim(),
      activityType: payload.activityType || 'Commerce général',
      role: 'client',
      status: 'approuve',
      accountStatus: 'approuve',
      registeredAt: now
    };

    return {
      success: true,
      message: `Client ${payload.shopName} créé sur Supabase. Mot de passe initial : ${tempPassword}`,
      client: createdClient,
      invitationLink: null,
      isTest: Boolean(payload.isTest)
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la création du client.'
    };
  }
}

export async function fetchTestEnvStatus(): Promise<{
  configured: boolean;
  productionUrl: string;
  message: string;
}> {
  return {
    configured: Boolean(DEFAULT_SUPABASE_URL && DEFAULT_SUPABASE_ANON_KEY),
    productionUrl: DEFAULT_SUPABASE_URL || REAL_SUPABASE_URL,
    message: 'Connexion directe Supabase Standalone active (Capacitor APK Ready).'
  };
}

export interface UpdateClientPayload {
  shopName: string;
  managerName: string;
  phone: string;
  whatsapp?: string;
  city: string;
  address: string;
  activityType?: string;
  bankName?: string;
  bankRib?: string;
}

export async function updateOwnClientProfile(payload: {
  userId?: string;
  companyName?: string;
  name?: string;
  email?: string;
  phone?: string;
  whatsapp?: string;
  city?: string;
  address?: string;
  bankName?: string;
  bankRib?: string;
}): Promise<{ success: boolean; profile?: UserProfile; error?: string }> {
  try {
    const actor = await getAuthenticatedActor();
    const targetId = payload.userId || actor?.id;
    if (!targetId) {
      return { success: false, error: 'Utilisateur non authentifié.' };
    }

    const now = new Date().toISOString();
    const baseProfileUpdate: Record<string, any> = {
      updated_at: now
    };
    if (payload.name !== undefined) baseProfileUpdate.full_name = payload.name.trim();
    if (payload.phone !== undefined) baseProfileUpdate.phone = payload.phone.trim();
    if (payload.whatsapp !== undefined) baseProfileUpdate.whatsapp = payload.whatsapp.trim();
    if (payload.city !== undefined) baseProfileUpdate.city = payload.city.trim();
    if (payload.address !== undefined) baseProfileUpdate.address = payload.address.trim();

    const fullProfileUpdate = {
      ...baseProfileUpdate,
      ...(payload.bankName !== undefined ? { bank_name: payload.bankName.trim() } : {}),
      ...(payload.bankRib !== undefined ? { bank_rib: payload.bankRib.trim() } : {})
    };

    const { error: profErr } = await supabaseClient
      .from('profiles')
      .update(fullProfileUpdate)
      .eq('id', targetId);

    if (profErr && isMissingColumnError(profErr)) {
      await supabaseClient.from('profiles').update(baseProfileUpdate).eq('id', targetId);
    }

    const shopUpdate: Record<string, any> = { updated_at: now };
    if (payload.companyName !== undefined) shopUpdate.shop_name = payload.companyName.trim();
    if (payload.name !== undefined) shopUpdate.manager_name = payload.name.trim();
    if (payload.phone !== undefined) shopUpdate.phone = payload.phone.trim();
    if (payload.whatsapp !== undefined) shopUpdate.whatsapp = payload.whatsapp.trim();
    if (payload.city !== undefined) shopUpdate.city = payload.city.trim();
    if (payload.address !== undefined) shopUpdate.pickup_address = payload.address.trim();

    const shopFullUpdate = {
      ...shopUpdate,
      ...(payload.bankName !== undefined ? { bank_name: payload.bankName.trim() } : {}),
      ...(payload.bankRib !== undefined ? { bank_rib: payload.bankRib.trim() } : {})
    };

    const { error: shopErr } = await supabaseClient
      .from('merchant_shops')
      .update(shopFullUpdate)
      .eq('user_id', targetId);

    if (shopErr && isMissingColumnError(shopErr)) {
      await supabaseClient.from('merchant_shops').update(shopUpdate).eq('user_id', targetId);
    }

    // Persist bank details in auxiliary snapshot as guaranteed backup
    if (payload.bankName !== undefined || payload.bankRib !== undefined) {
      await patchAuxiliaryState(aux => {
        aux.clientBankMeta[targetId] = {
          ...(aux.clientBankMeta[targetId] || {}),
          ...(payload.bankName !== undefined ? { bankName: payload.bankName.trim() } : {}),
          ...(payload.bankRib !== undefined ? { bankRib: payload.bankRib.trim() } : {})
        };
      });
    }

    const refreshed = await fetchUserProfileFromDb(targetId);
    const mapped: UserProfile = {
      id: targetId,
      shopId: refreshed?.shop_id,
      name: payload.name || refreshed?.full_name || actor?.name || 'Client',
      companyName: payload.companyName || refreshed?.company_name || actor?.companyName,
      email: payload.email || refreshed?.email || actor?.email || '',
      phone: payload.phone || refreshed?.phone || '',
      whatsapp: payload.whatsapp || refreshed?.whatsapp,
      city: payload.city || refreshed?.city || 'Casablanca',
      address: payload.address || refreshed?.address || '',
      bankName: payload.bankName ?? refreshed?.bank_name,
      bankRib: payload.bankRib ?? refreshed?.bank_rib,
      role: (refreshed?.role as any) || 'client',
      status: (refreshed?.account_status as any) || 'approuve',
      accountStatus: (refreshed?.account_status as any) || 'approuve',
      registeredAt: refreshed?.created_at || now
    };

    return { success: true, profile: mapped };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la sauvegarde du profil.'
    };
  }
}

export async function updateSupabaseClient(
  clientId: string,
  payload: UpdateClientPayload
): Promise<{
  success: boolean;
  message?: string;
  client?: UserProfile;
  error?: string;
}> {
  try {
    const now = new Date().toISOString();
    const baseProfileUpdate = {
      full_name: payload.managerName.trim(),
      phone: payload.phone.trim(),
      whatsapp: (payload.whatsapp || payload.phone).trim(),
      city: payload.city.trim(),
      address: payload.address.trim(),
      updated_at: now
    };
    const fullProfileUpdate = {
      ...baseProfileUpdate,
      ...(payload.bankName !== undefined ? { bank_name: payload.bankName.trim() } : {}),
      ...(payload.bankRib !== undefined ? { bank_rib: payload.bankRib.trim() } : {})
    };

    const { error: profErr } = await supabaseClient
      .from('profiles')
      .update(fullProfileUpdate)
      .eq('id', clientId);

    if (profErr && isMissingColumnError(profErr)) {
      await supabaseClient.from('profiles').update(baseProfileUpdate).eq('id', clientId);
    }

    const baseShopUpdate = {
      shop_name: payload.shopName.trim(),
      manager_name: payload.managerName.trim(),
      phone: payload.phone.trim(),
      whatsapp: (payload.whatsapp || payload.phone).trim(),
      city: payload.city.trim(),
      pickup_address: payload.address.trim(),
      activity_type: payload.activityType || 'Commerce général',
      updated_at: now
    };
    const fullShopUpdate = {
      ...baseShopUpdate,
      ...(payload.bankName !== undefined ? { bank_name: payload.bankName.trim() } : {}),
      ...(payload.bankRib !== undefined ? { bank_rib: payload.bankRib.trim() } : {})
    };

    let { error: shopErr } = await supabaseClient
      .from('merchant_shops')
      .update(fullShopUpdate)
      .eq('user_id', clientId);

    if (shopErr && isMissingColumnError(shopErr)) {
      const retry = await supabaseClient
        .from('merchant_shops')
        .update(baseShopUpdate)
        .eq('user_id', clientId);
      shopErr = retry.error;
    }

    if (payload.bankName !== undefined || payload.bankRib !== undefined) {
      await patchAuxiliaryState(aux => {
        aux.clientBankMeta[clientId] = {
          ...(aux.clientBankMeta[clientId] || {}),
          ...(payload.bankName !== undefined ? { bankName: payload.bankName.trim() } : {}),
          ...(payload.bankRib !== undefined ? { bankRib: payload.bankRib.trim() } : {})
        };
      });
    }

    if (shopErr) {
      return { success: false, error: shopErr.message };
    }

    const refreshed = await fetchUserProfileFromDb(clientId);
    return {
      success: true,
      message: 'Fiche client mise à jour sur Supabase.',
      client: {
        id: clientId,
        shopId: refreshed?.shop_id,
        name: payload.managerName.trim(),
        companyName: payload.shopName.trim(),
        email: refreshed?.email || '',
        phone: payload.phone.trim(),
        whatsapp: (payload.whatsapp || payload.phone).trim(),
        city: payload.city.trim(),
        address: payload.address.trim(),
        activityType: payload.activityType || 'Commerce général',
        bankName: payload.bankName ?? refreshed?.bank_name,
        bankRib: payload.bankRib ?? refreshed?.bank_rib,
        role: 'client',
        status: (refreshed?.account_status as any) || 'approuve',
        accountStatus: (refreshed?.account_status as any) || 'approuve',
        registeredAt: refreshed?.created_at || now
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la modification du client.'
    };
  }
}

export async function updateSupabaseClientBank(
  clientId: string,
  payload: { bankName?: string; bankRib?: string }
): Promise<{
  success: boolean;
  message?: string;
  bankName?: string;
  bankRib?: string;
  error?: string;
}> {
  try {
    const bankName = (payload.bankName || '').trim();
    const bankRib = (payload.bankRib || '').trim();
    const now = new Date().toISOString();

    await supabaseClient
      .from('profiles')
      .update({ bank_name: bankName, bank_rib: bankRib, updated_at: now })
      .eq('id', clientId)
      .then(() => {});

    await supabaseClient
      .from('merchant_shops')
      .update({ bank_name: bankName, bank_rib: bankRib, updated_at: now })
      .eq('user_id', clientId)
      .then(() => {});

    await patchAuxiliaryState(aux => {
      aux.clientBankMeta[clientId] = { bankName, bankRib };
    });

    return {
      success: true,
      message: 'Coordonnées bancaires (RIB) enregistrées sur Supabase.',
      bankName,
      bankRib
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la sauvegarde du RIB.'
    };
  }
}

export async function toggleSupabaseClientStatus(
  clientId: string,
  newStatus: 'suspendu' | 'approuve' | 'refuse',
  reason?: string
): Promise<{
  success: boolean;
  message?: string;
  error?: string;
}> {
  try {
    const actor = await getAuthenticatedActor();
    const now = new Date().toISOString();

    const { data: shopRow } = await supabaseClient
      .from('merchant_shops')
      .select('id, user_id')
      .eq('user_id', clientId)
      .maybeSingle();

    const targetShopId = shopRow?.id;

    const shopPatch: Record<string, any> = {
      account_status: newStatus,
      status_reason: reason || null,
      updated_at: now
    };
    if (newStatus === 'approuve') {
      shopPatch.approved_at = now;
      if (actor?.id && isUuid(actor.id)) {
        shopPatch.approved_by = actor.id;
      }
    }

    const { error: shopErr } = await supabaseClient
      .from('merchant_shops')
      .update(shopPatch)
      .eq(targetShopId ? 'id' : 'user_id', targetShopId || clientId);

    if (shopErr) {
      return { success: false, error: shopErr.message };
    }

    // Also log in admin_approvals when available
    if (targetShopId && actor?.id && isUuid(actor.id)) {
      await supabaseClient
        .from('admin_approvals')
        .insert({
          shop_id: targetShopId,
          admin_id: actor.id,
          decision: newStatus,
          reason: reason || null
        })
        .then(() => {});
    }

    return {
      success: true,
      message: `Statut du compte mis à jour : ${newStatus}.`
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors du changement de statut du client.'
    };
  }
}

export async function deleteSupabaseClient(
  clientId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    const { data: shop } = await supabaseClient
      .from('merchant_shops')
      .select('id')
      .eq('user_id', clientId)
      .maybeSingle();

    if (shop?.id) {
      await supabaseClient.from('packages').delete().eq('shop_id', shop.id);
      await supabaseClient.from('merchant_shops').delete().eq('id', shop.id);
    }

    const { error: profErr } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', clientId);

    if (profErr) {
      return { success: false, error: profErr.message };
    }

    return {
      success: true,
      message: 'Client et sa boutique supprimés de Supabase.'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur de suppression du client.' };
  }
}

export async function updateClientPasswordInSupabase(
  clientId: string,
  newPassword: string
): Promise<{
  success: boolean;
  message?: string;
  client?: { id: string; name: string; phone: string; email: string };
  newPassword?: string;
  error?: string;
}> {
  try {
    const { data: prof } = await supabaseClient
      .from('profiles')
      .select('id, full_name, phone, email')
      .eq('id', clientId)
      .maybeSingle();

    if (!prof?.email) {
      return { success: false, error: 'Client introuvable dans Supabase.' };
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    // If modifying own password, update directly
    if (session?.user?.id === clientId) {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        message: 'Mot de passe mis à jour directement dans Supabase Auth.',
        client: { id: prof.id, name: prof.full_name, phone: prof.phone || '', email: prof.email },
        newPassword
      };
    }

    // In standalone client-SDK mode (no service_role key), send a secure Supabase password reset email
    const { error: resetErr } = await supabaseClient.auth.resetPasswordForEmail(prof.email);
    if (resetErr) {
      return {
        success: false,
        error: `Réinitialisation par e-mail impossible (${resetErr.message}). En mode APK autonome sans clé serveur secrète, le changement de mot de passe d'un autre compte passe par l'e-mail de réinitialisation Supabase.`
      };
    }

    return {
      success: true,
      message: `Un lien sécurisé de réinitialisation du mot de passe a été envoyé à ${prof.email}.`,
      client: { id: prof.id, name: prof.full_name, phone: prof.phone || '', email: prof.email }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la réinitialisation du mot de passe.'
    };
  }
}

// =============================================================================
// DRIVERS CRUD (100% DIRECT SUPABASE SDK)
// =============================================================================

export interface CreateDriverPayload {
  fullName: string;
  phone: string;
  email?: string;
  password: string;
  city?: string;
  vehicleType?: string;
  driverPlate?: string;
  cinNumber?: string;
  cinPhotoUrl?: string;
  cinBackPhotoUrl?: string;
  driverPhotoUrl?: string;
  avatarUrl?: string;
  feePerDelivery?: number;
  fixedSalary?: number;
  salaryType?: 'per_package' | 'fixed_plus_package' | 'monthly_fixed';
  pickupFee?: number;
  status?: 'active' | 'inactive';
}

export interface UpdateDriverPayload {
  name?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  city?: string;
  driverVehicle?: string;
  driverPlate?: string;
  cinNumber?: string;
  cinPhotoUrl?: string;
  cinBackPhotoUrl?: string;
  driverPhotoUrl?: string;
  avatarUrl?: string;
  driverFeePerDelivery?: number;
  driverFixedSalary?: number;
  driverSalaryType?: 'per_package' | 'fixed_plus_package' | 'monthly_fixed';
  driverPickupFee?: number;
  driverBonusThreshold?: number;
  driverBonusAmount?: number;
  address?: string;
  whatsapp?: string;
  status?: UserProfile['status'];
}

export interface DriverCredentials {
  fullName: string;
  phone: string;
  email: string;
  password: string;
  city: string;
  vehicleType: string;
}

export async function fetchSupabaseDrivers(): Promise<{
  drivers: UserProfile[];
  error: string | null;
}> {
  try {
    const [profsRes, aux] = await Promise.all([
      supabaseClient
        .from('profiles')
        .select('*')
        .eq('role', 'driver')
        .order('created_at', { ascending: false }),
      loadAuxiliaryState()
    ]);

    if (profsRes.error) {
      return { drivers: [], error: `Erreur Supabase drivers: ${profsRes.error.message}` };
    }

    const drivers: UserProfile[] = (profsRes.data || []).map((row: any) => {
      const meta = aux.driverMeta?.[row.id] || {};
      const kyc = aux.kycDocuments?.[row.id] || (row.email ? aux.kycDocuments?.[row.email.toLowerCase()] : undefined) || {};

      return {
        id: row.id,
        name: row.full_name || 'Livreur',
        email: row.email || '',
        phone: row.phone || '',
        whatsapp: row.whatsapp || row.phone || undefined,
        city: row.city || 'Casablanca',
        address: row.address || '',
        role: 'driver',
        status: (meta.status || row.account_status || 'active') as any,
        driverVehicle: row.driver_vehicle || meta.driverVehicle || 'Moto',
        driverPlate: row.driver_plate || meta.driverPlate || '',
        cinNumber: row.cin_number || kyc.cinNumber || meta.cinNumber || undefined,
        cinPhotoUrl: row.cin_photo_url || kyc.cinPhotoUrl || meta.cinPhotoUrl || undefined,
        cinBackPhotoUrl: row.cin_back_photo_url || kyc.cinBackPhotoUrl || meta.cinBackPhotoUrl || undefined,
        driverPhotoUrl: row.driver_photo_url || row.avatar_url || kyc.driverPhotoUrl || meta.driverPhotoUrl || undefined,
        avatarUrl: row.avatar_url || row.driver_photo_url || meta.avatarUrl || undefined,
        driverFeePerDelivery: Number(meta.driverFeePerDelivery ?? row.driver_fee_per_delivery ?? 15),
        driverFixedSalary: Number(meta.driverFixedSalary ?? row.driver_fixed_salary ?? 0),
        driverSalaryType: meta.driverSalaryType || row.driver_salary_type || 'per_package',
        driverPickupFee: Number(meta.driverPickupFee ?? row.driver_pickup_fee ?? 5),
        driverBonusThreshold: meta.driverBonusThreshold ?? row.driver_bonus_threshold,
        driverBonusAmount: meta.driverBonusAmount ?? row.driver_bonus_amount,
        registeredAt: row.created_at || new Date().toISOString()
      };
    });

    return { drivers, error: null };
  } catch (err: any) {
    return {
      drivers: [],
      error: err.message || 'Erreur de connexion Supabase pour les livreurs.'
    };
  }
}

export async function createSupabaseDriver(payload: CreateDriverPayload): Promise<{
  success: boolean;
  driver?: UserProfile;
  credentials?: DriverCredentials;
  error?: string;
}> {
  try {
    const cleanPhone = (payload.phone || '').trim();
    const digits = normalizePhoneDigits(cleanPhone);
    const cleanEmail = (payload.email || '').trim().toLowerCase() || `${digits || Date.now()}@fariousy.com`;
    const cleanPassword = (payload.password || '').trim();

    if (!payload.fullName?.trim() || !cleanPhone) {
      return { success: false, error: 'Nom complet et téléphone du livreur requis.' };
    }
    if (cleanPassword.length < 6) {
      return { success: false, error: 'Le mot de passe doit contenir au moins 6 caractères.' };
    }

    const isolatedAuth = createIsolatedAuthClient();
    const { data: signUpData, error: signUpErr } = await isolatedAuth.auth.signUp({
      email: cleanEmail,
      password: cleanPassword,
      options: {
        data: {
          full_name: payload.fullName.trim(),
          role: 'driver',
          phone: cleanPhone,
          city: payload.city || 'Casablanca'
        }
      }
    });

    if (signUpErr || !signUpData?.user?.id) {
      return {
        success: false,
        error: signUpErr?.message || 'Erreur lors de la création du compte livreur sur Supabase Auth.'
      };
    }

    const driverId = signUpData.user.id;
    const now = new Date().toISOString();

    const baseProfile = {
      id: driverId,
      role: 'driver',
      full_name: payload.fullName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      whatsapp: cleanPhone,
      city: (payload.city || 'Casablanca').trim(),
      cin_number: payload.cinNumber || null,
      cin_photo_url: payload.cinPhotoUrl || null,
      cin_back_photo_url: payload.cinBackPhotoUrl || null,
      driver_photo_url: payload.driverPhotoUrl || payload.avatarUrl || null,
      avatar_url: payload.avatarUrl || payload.driverPhotoUrl || null,
      driver_vehicle: payload.vehicleType || 'Moto',
      driver_plate: payload.driverPlate || null,
      updated_at: now
    };

    const { error: profErr } = await supabaseClient
      .from('profiles')
      .upsert(baseProfile, { onConflict: 'id' });

    if (profErr && isMissingColumnError(profErr)) {
      await supabaseClient.from('profiles').upsert(
        {
          id: driverId,
          role: 'driver',
          full_name: payload.fullName.trim(),
          email: cleanEmail,
          phone: cleanPhone,
          whatsapp: cleanPhone,
          city: (payload.city || 'Casablanca').trim(),
          updated_at: now
        },
        { onConflict: 'id' }
      );
    } else if (profErr) {
      return { success: false, error: `Erreur profiles: ${profErr.message}` };
    }

    await patchAuxiliaryState(aux => {
      aux.driverMeta[driverId] = {
        driverVehicle: payload.vehicleType || 'Moto',
        driverPlate: payload.driverPlate || '',
        driverFeePerDelivery: payload.feePerDelivery ?? 15,
        driverFixedSalary: payload.fixedSalary ?? 0,
        driverSalaryType: payload.salaryType || 'per_package',
        driverPickupFee: payload.pickupFee ?? 5,
        status: payload.status || 'active',
        cinNumber: payload.cinNumber,
        cinPhotoUrl: payload.cinPhotoUrl,
        cinBackPhotoUrl: payload.cinBackPhotoUrl,
        driverPhotoUrl: payload.driverPhotoUrl || payload.avatarUrl
      };
    });

    const driver: UserProfile = {
      id: driverId,
      name: payload.fullName.trim(),
      email: cleanEmail,
      phone: cleanPhone,
      whatsapp: cleanPhone,
      city: (payload.city || 'Casablanca').trim(),
      role: 'driver',
      status: payload.status || 'active',
      driverVehicle: payload.vehicleType || 'Moto',
      driverPlate: payload.driverPlate || '',
      cinNumber: payload.cinNumber,
      cinPhotoUrl: payload.cinPhotoUrl,
      cinBackPhotoUrl: payload.cinBackPhotoUrl,
      driverPhotoUrl: payload.driverPhotoUrl || payload.avatarUrl,
      avatarUrl: payload.avatarUrl || payload.driverPhotoUrl,
      driverFeePerDelivery: payload.feePerDelivery ?? 15,
      driverFixedSalary: payload.fixedSalary ?? 0,
      driverSalaryType: payload.salaryType || 'per_package',
      driverPickupFee: payload.pickupFee ?? 5,
      registeredAt: now
    };

    return {
      success: true,
      driver,
      credentials: {
        fullName: driver.name,
        phone: cleanPhone,
        email: cleanEmail,
        password: cleanPassword,
        city: driver.city || 'Casablanca',
        vehicleType: driver.driverVehicle || 'Moto'
      }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la création du livreur.'
    };
  }
}

export async function updateSupabaseDriver(
  driverId: string,
  payload: UpdateDriverPayload
): Promise<{
  success: boolean;
  driver?: UserProfile;
  error?: string;
}> {
  try {
    const now = new Date().toISOString();
    const corePatch: Record<string, any> = { updated_at: now };
    if (payload.name || payload.fullName) corePatch.full_name = (payload.fullName || payload.name || '').trim();
    if (payload.phone !== undefined) corePatch.phone = payload.phone.trim();
    if (payload.whatsapp !== undefined) corePatch.whatsapp = payload.whatsapp.trim();
    if (payload.city !== undefined) corePatch.city = payload.city.trim();
    if (payload.address !== undefined) corePatch.address = payload.address.trim();

    const extendedPatch: Record<string, any> = {
      ...corePatch,
      ...(payload.driverVehicle !== undefined ? { driver_vehicle: payload.driverVehicle } : {}),
      ...(payload.driverPlate !== undefined ? { driver_plate: payload.driverPlate } : {}),
      ...(payload.cinNumber !== undefined ? { cin_number: payload.cinNumber } : {}),
      ...(payload.cinPhotoUrl !== undefined ? { cin_photo_url: payload.cinPhotoUrl } : {}),
      ...(payload.cinBackPhotoUrl !== undefined ? { cin_back_photo_url: payload.cinBackPhotoUrl } : {}),
      ...(payload.driverPhotoUrl !== undefined ? { driver_photo_url: payload.driverPhotoUrl } : {}),
      ...(payload.avatarUrl !== undefined ? { avatar_url: payload.avatarUrl } : {})
    };

    const { error } = await supabaseClient
      .from('profiles')
      .update(extendedPatch)
      .eq('id', driverId);

    if (error && isMissingColumnError(error)) {
      await supabaseClient.from('profiles').update(corePatch).eq('id', driverId);
    } else if (error) {
      return { success: false, error: error.message };
    }

    await patchAuxiliaryState(aux => {
      aux.driverMeta[driverId] = {
        ...(aux.driverMeta[driverId] || {}),
        ...(payload.driverVehicle !== undefined ? { driverVehicle: payload.driverVehicle } : {}),
        ...(payload.driverPlate !== undefined ? { driverPlate: payload.driverPlate } : {}),
        ...(payload.driverFeePerDelivery !== undefined ? { driverFeePerDelivery: payload.driverFeePerDelivery } : {}),
        ...(payload.driverFixedSalary !== undefined ? { driverFixedSalary: payload.driverFixedSalary } : {}),
        ...(payload.driverSalaryType !== undefined ? { driverSalaryType: payload.driverSalaryType } : {}),
        ...(payload.driverPickupFee !== undefined ? { driverPickupFee: payload.driverPickupFee } : {}),
        ...(payload.driverBonusThreshold !== undefined ? { driverBonusThreshold: payload.driverBonusThreshold } : {}),
        ...(payload.driverBonusAmount !== undefined ? { driverBonusAmount: payload.driverBonusAmount } : {}),
        ...(payload.status !== undefined ? { status: payload.status } : {}),
        ...(payload.cinNumber !== undefined ? { cinNumber: payload.cinNumber } : {}),
        ...(payload.cinPhotoUrl !== undefined ? { cinPhotoUrl: payload.cinPhotoUrl } : {}),
        ...(payload.cinBackPhotoUrl !== undefined ? { cinBackPhotoUrl: payload.cinBackPhotoUrl } : {}),
        ...(payload.driverPhotoUrl !== undefined ? { driverPhotoUrl: payload.driverPhotoUrl } : {}),
        ...(payload.avatarUrl !== undefined ? { avatarUrl: payload.avatarUrl } : {})
      };
    });

    const { drivers } = await fetchSupabaseDrivers();
    const updatedDriver = drivers.find(d => d.id === driverId);
    return {
      success: true,
      driver: updatedDriver
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la mise à jour du livreur.'
    };
  }
}

export async function deleteSupabaseDriver(
  driverId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    // Unassign packages before removing driver profile
    await supabaseClient
      .from('packages')
      .update({ driver_id: null, updated_at: new Date().toISOString() })
      .eq('driver_id', driverId);

    const { error } = await supabaseClient
      .from('profiles')
      .delete()
      .eq('id', driverId);

    if (error) {
      return { success: false, error: error.message };
    }

    await patchAuxiliaryState(aux => {
      delete aux.driverMeta[driverId];
    });

    return {
      success: true,
      message: 'Livreur supprimé définitivement de Supabase.'
    };
  } catch (err: any) {
    return { success: false, error: err.message || 'Erreur lors de la suppression du livreur.' };
  }
}

export async function updateDriverPasswordInSupabase(
  driverId: string,
  newPassword: string
): Promise<{
  success: boolean;
  message?: string;
  driver?: { id: string; name: string; phone: string; email: string };
  newPassword?: string;
  error?: string;
}> {
  try {
    const { data: prof } = await supabaseClient
      .from('profiles')
      .select('id, full_name, phone, email')
      .eq('id', driverId)
      .maybeSingle();

    if (!prof?.email) {
      return { success: false, error: 'Livreur introuvable dans Supabase.' };
    }

    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session?.user?.id === driverId) {
      const { error } = await supabaseClient.auth.updateUser({ password: newPassword });
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        message: 'Mot de passe mis à jour dans Supabase Auth.',
        driver: { id: prof.id, name: prof.full_name, phone: prof.phone || '', email: prof.email },
        newPassword
      };
    }

    const { error: resetErr } = await supabaseClient.auth.resetPasswordForEmail(prof.email);
    if (resetErr) {
      return {
        success: false,
        error: `Envoi du lien de réinitialisation impossible (${resetErr.message}).`
      };
    }

    return {
      success: true,
      message: `Un lien sécurisé de réinitialisation a été envoyé à ${prof.email}.`,
      driver: { id: prof.id, name: prof.full_name, phone: prof.phone || '', email: prof.email }
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la mise à jour du mot de passe.'
    };
  }
}

// =============================================================================
// PACKAGES CRUD, STATUS, COMMENTS, DRIVER ASSIGNMENT & SCANNING (100% DIRECT SDK)
// =============================================================================

export interface CreatePackagePayload {
  shopId: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  recipientName: string;
  recipientPhone: string;
  city: string;
  address: string;
  description?: string;
  productPrice: number;
  deliveryFee: number;
  codAmount: number;
  notes?: string;
  allowOpen?: boolean;
  allowTry?: boolean;
  isFragile?: boolean;
  isExchange?: boolean;
  exchangeTrackingNumber?: string;
  exchangeReason?: string;
  exchangeItemDescription?: string;
  stockLocationId?: string;
  stockPosition?: string;
}

function mapSupabasePackageRow(
  row: any,
  aux: AuxiliaryStateSnapshot,
  driversById: Map<string, { name: string; phone?: string }>
): PackageItem {
  const cod = Number(row.cod_amount || 0);
  const fee = Number(row.delivery_fee || 0);
  const opts = aux.packageOptions?.[row.id] || aux.packageOptions?.[row.tracking_number] || {};
  const override = aux.packageOverrides?.[row.id] || aux.packageOverrides?.[row.tracking_number] || {};
  const problem = row.problem_report || aux.problemReports?.[row.id] || override.problemReport;
  const driverId = override.driverId !== undefined ? (override.driverId || undefined) : (row.driver_id || undefined);
  const driverInfo = driverId ? driversById.get(driverId) : undefined;

  const rowUpdatedMs = Date.parse(String(row.updated_at || '')) || 0;
  const overrideUpdatedMs = Date.parse(String(override.overrideUpdatedAt || override.lastMovedAt || '')) || 0;
  const overrideIsNewer = overrideUpdatedMs > 0 && overrideUpdatedMs >= rowUpdatedMs;

  const resolvedCod = override.codAmount !== undefined ? Number(override.codAmount) : cod;
  const resolvedFee = override.deliveryFee !== undefined ? Number(override.deliveryFee) : fee;
  const resolvedProductPrice =
    override.productPrice !== undefined
      ? Number(override.productPrice)
      : Math.max(0, Math.round((resolvedCod - resolvedFee) * 100) / 100);

  const resolvedStatus = (
    overrideIsNewer && override.status
      ? override.status
      : row.status || override.status || 'attente_ramassage'
  ) as PackageStatus;

  const history =
    Array.isArray(override.history) && override.history.length > (Array.isArray(row.history) ? row.history.length : 0)
      ? override.history
      : Array.isArray(row.history) && row.history.length > 0
      ? row.history
      : Array.isArray(override.history)
      ? override.history
      : [];

  return {
    id: row.id,
    trackingNumber: row.tracking_number,
    shopId: row.shop_id,
    clientId: row.merchant_shops?.user_id || row.shop_id,
    clientName: row.merchant_shops?.manager_name || override.clientName || 'Gérant',
    clientCompany: row.merchant_shops?.shop_name || override.clientCompany || 'Boutique',
    clientPhone: row.merchant_shops?.phone || override.clientPhone || '',
    recipientName: override.recipientName ?? row.recipient_name,
    recipientPhone: override.recipientPhone ?? row.recipient_phone,
    recipientPhone2: override.recipientPhone2 ?? row.recipient_phone2 ?? undefined,
    city: override.city ?? row.destination_city ?? 'Casablanca',
    address: override.address ?? row.destination_address ?? '',
    description: override.description ?? row.item_description ?? '',
    notes: override.notes ?? row.notes ?? opts.notes ?? undefined,
    driverComment: override.driverComment ?? row.driver_comment ?? undefined,
    codAmount: resolvedCod,
    deliveryFee: resolvedFee,
    productPrice: resolvedProductPrice,
    status: resolvedStatus,
    currentAgency: override.currentAgency ?? row.current_agency ?? 'Agence Principale',
    destinationAgency: override.destinationAgency ?? row.destination_agency ?? undefined,
    driverId,
    driverName: driverInfo?.name || override.driverName || undefined,
    driverPhone: driverInfo?.phone || override.driverPhone || undefined,
    isPaidToClient: override.isPaidToClient !== undefined ? Boolean(override.isPaidToClient) : Boolean(row.is_paid_to_client),
    clientPaymentId: override.clientPaymentId ?? row.client_payment_id ?? undefined,
    returnReason: override.returnReason ?? row.return_reason ?? undefined,
    callProofUrl: override.callProofUrl ?? row.call_proof_url ?? undefined,
    allowOpen: override.allowOpen !== undefined ? Boolean(override.allowOpen) : (typeof row.allow_open === 'boolean' ? row.allow_open : opts.allowOpen),
    allowTry: override.allowTry !== undefined ? Boolean(override.allowTry) : (typeof row.allow_try === 'boolean' ? row.allow_try : opts.allowTry),
    isFragile: override.isFragile !== undefined ? Boolean(override.isFragile) : (typeof row.is_fragile === 'boolean' ? row.is_fragile : Boolean(opts.isFragile)),
    isExchange: override.isExchange !== undefined ? Boolean(override.isExchange) : (typeof row.is_exchange === 'boolean' ? row.is_exchange : Boolean(opts.isExchange)),
    exchangeTrackingNumber: override.exchangeTrackingNumber || row.exchange_tracking_number || opts.exchangeTrackingNumber || undefined,
    exchangeReason: override.exchangeReason || row.exchange_reason || opts.exchangeReason || undefined,
    exchangeItemDescription: override.exchangeItemDescription || row.exchange_item_description || opts.exchangeItemDescription || undefined,
    stockLocationId: override.stockLocationId || opts.stockLocationId || undefined,
    stockPosition: override.stockPosition || opts.stockPosition || undefined,
    problemReport: problem || undefined,
    partnerId: override.partnerId !== undefined ? (override.partnerId || undefined) : (row.partner_id || undefined),
    partnerName: override.partnerName !== undefined ? (override.partnerName || undefined) : (row.partner_name || undefined),
    partnerTrackingNumber: override.partnerTrackingNumber ?? row.partner_tracking_number ?? undefined,
    partnerShipmentId: override.partnerShipmentId ?? row.partner_shipment_id ?? undefined,
    partnerLabelUrl: override.partnerLabelUrl ?? row.partner_label_url ?? undefined,
    partnerSyncStatus: (override.partnerSyncStatus || row.partner_sync_status || undefined) as any,
    partnerLastSyncAt: override.partnerLastSyncAt || row.partner_last_sync_at || undefined,
    isInboundFromPartner: Boolean(override.isInboundFromPartner ?? row.is_inbound_from_partner),
    isTransferredToPartner: Boolean(override.isTransferredToPartner ?? row.is_transferred_to_partner),
    partnerTrackingId: override.partnerTrackingId ?? row.partner_tracking_id ?? undefined,
    partnerDeliveryFee: override.partnerDeliveryFee !== undefined ? Number(override.partnerDeliveryFee) : (row.partner_delivery_fee !== undefined && row.partner_delivery_fee !== null ? Number(row.partner_delivery_fee) : undefined),
    partnerSettled: override.partnerSettled !== undefined ? Boolean(override.partnerSettled) : (row.partner_settled !== undefined ? Boolean(row.partner_settled) : undefined),
    deliveredBy: (override.deliveredBy ?? row.delivered_by ?? undefined) as 'partner' | 'admin' | undefined,
    confirmationStatus: override.confirmationStatus ?? row.confirmation_status ?? undefined,
    confirmationAttempts: override.confirmationAttempts !== undefined ? Number(override.confirmationAttempts) : undefined,
    confirmedById: override.confirmedById ?? undefined,
    confirmedByName: override.confirmedByName ?? undefined,
    confirmedAt: override.confirmedAt ?? undefined,
    confirmationNote: override.confirmationNote ?? undefined,
    confirmationChannel: override.confirmationChannel ?? undefined,
    lastConfirmationAttemptAt: override.lastConfirmationAttemptAt ?? undefined,
    createdAt: row.created_at || new Date().toISOString(),
    lastMovedAt: (overrideIsNewer ? (override.overrideUpdatedAt || override.lastMovedAt) : row.updated_at) || override.lastMovedAt || row.created_at || new Date().toISOString(),
    history
  };
}

async function fetchDriversLookupMap(): Promise<Map<string, { name: string; phone?: string }>> {
  const map = new Map<string, { name: string; phone?: string }>();
  try {
    const { data } = await supabaseClient
      .from('profiles')
      .select('id, full_name, phone')
      .eq('role', 'driver');
    for (const d of data || []) {
      map.set(d.id, { name: d.full_name || 'Livreur', phone: d.phone || undefined });
    }
  } catch {}
  return map;
}

export async function fetchSupabasePackages(): Promise<{
  packages: PackageItem[];
  error: string | null;
}> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) {
      return { packages: [], error: 'Utilisateur non authentifié sur Supabase.' };
    }

    const role = actor.role;
    if (!actor.isImpersonating && (role === 'client' || role === 'boutique' || role === 'merchant')) {
      return fetchClientPackages();
    }
    if (!actor.isImpersonating && (role === 'driver' || role === 'livreur')) {
      return fetchDriverAssignedPackages(actor.id);
    }

    const [pkgRes, aux, driversMap] = await Promise.all([
      supabaseClient
        .from('packages')
        .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
        .order('created_at', { ascending: false }),
      loadAuxiliaryState(),
      fetchDriversLookupMap()
    ]);

    if (pkgRes.error) {
      return { packages: [], error: `Erreur Supabase packages: ${pkgRes.error.message}` };
    }

    const deletedSet = new Set(aux.deletedPackageIds || []);
    const mapped: PackageItem[] = (pkgRes.data || [])
      .filter((r: any) => !deletedSet.has(r.id))
      .map((r: any) => mapSupabasePackageRow(r, aux, driversMap));

    // Include any auxiliary-only fallback packages not yet in relational table
    const existingIds = new Set(mapped.map(p => p.id));
    for (const auxPkg of aux.packages || []) {
      if (auxPkg?.id && !existingIds.has(auxPkg.id) && !deletedSet.has(auxPkg.id)) {
        mapped.push(auxPkg);
      }
    }

    return { packages: mapped, error: null };
  } catch (err: any) {
    return { packages: [], error: err.message || 'Erreur inattendue de connexion Supabase pour les colis.' };
  }
}

export async function fetchClientPackages(): Promise<{
  packages: PackageItem[];
  error: string | null;
}> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) {
      return { packages: [], error: 'Utilisateur non authentifié sur Supabase.' };
    }

    // Find the client's merchant_shop(s)
    const { data: shops } = await supabaseClient
      .from('merchant_shops')
      .select('id, user_id, account_status')
      .eq('user_id', actor.id);

    const shopIds = (shops || []).map((s: any) => s.id);
    if (actor.shopId && !shopIds.includes(actor.shopId)) {
      shopIds.push(actor.shopId);
    }

    const [aux, driversMap] = await Promise.all([loadAuxiliaryState(), fetchDriversLookupMap()]);

    let query = supabaseClient
      .from('packages')
      .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
      .order('created_at', { ascending: false });

    if (shopIds.length > 0) {
      query = query.in('shop_id', shopIds);
    }

    const { data: rows, error: pkgErr } = await query;
    if (pkgErr) {
      return { packages: [], error: `Erreur Supabase packages: ${pkgErr.message}` };
    }

    const deletedSet = new Set(aux.deletedPackageIds || []);
    const mapped = (rows || [])
      .filter((r: any) => !deletedSet.has(r.id))
      .map((r: any) => mapSupabasePackageRow(r, aux, driversMap));

    return { packages: mapped, error: null };
  } catch (err: any) {
    return { packages: [], error: err.message || 'Erreur de connexion aux colis client.' };
  }
}

export async function fetchDriverAssignedPackages(driverId?: string): Promise<{
  packages: PackageItem[];
  error: string | null;
}> {
  try {
    const actor = await getAuthenticatedActor();
    const targetDriverId = driverId || actor?.id;
    if (!targetDriverId) {
      return { packages: [], error: 'Livreur non authentifié.' };
    }

    const [pkgRes, aux, driversMap] = await Promise.all([
      supabaseClient
        .from('packages')
        .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
        .eq('driver_id', targetDriverId)
        .order('created_at', { ascending: false }),
      loadAuxiliaryState(),
      fetchDriversLookupMap()
    ]);

    if (pkgRes.error) {
      return { packages: [], error: `Erreur Supabase packages livreur: ${pkgRes.error.message}` };
    }

    const deletedSet = new Set(aux.deletedPackageIds || []);
    const mapped = (pkgRes.data || [])
      .filter((r: any) => !deletedSet.has(r.id))
      .map((r: any) => mapSupabasePackageRow(r, aux, driversMap));

    return { packages: mapped, error: null };
  } catch (err: any) {
    return {
      packages: [],
      error: err.message || 'Erreur de connexion aux colis livreur.'
    };
  }
}

export async function createSupabasePackage(payload: CreatePackagePayload): Promise<{
  success: boolean;
  message?: string;
  package?: PackageItem;
  error?: string;
}> {
  try {
    const actor = await getAuthenticatedActor();
    if (!actor) {
      return { success: false, error: 'Session expirée. Veuillez vous reconnecter.' };
    }

    // Resolve merchant_shop ID cleanly (handles either shop.id or user_id)
    let resolvedShop: any = null;
    if (isUuid(payload.shopId)) {
      const { data: byId } = await supabaseClient
        .from('merchant_shops')
        .select('id, user_id, shop_name, manager_name, phone, city, account_status')
        .eq('id', payload.shopId)
        .maybeSingle();
      resolvedShop = byId;

      if (!resolvedShop) {
        const { data: byUser } = await supabaseClient
          .from('merchant_shops')
          .select('id, user_id, shop_name, manager_name, phone, city, account_status')
          .eq('user_id', payload.shopId)
          .maybeSingle();
        resolvedShop = byUser;
      }
    }

    if (!resolvedShop && !isStaffRole(actor.role)) {
      const { data: ownShop } = await supabaseClient
        .from('merchant_shops')
        .select('id, user_id, shop_name, manager_name, phone, city, account_status')
        .eq('user_id', actor.id)
        .maybeSingle();
      resolvedShop = ownShop;
    }

    // If still no shop row (e.g., admin creating parcel for a client without merchant_shops row yet), create one
    if (!resolvedShop && isUuid(payload.shopId)) {
      const { data: prof } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', payload.shopId)
        .maybeSingle();

      if (prof) {
        const { data: createdShop } = await supabaseClient
          .from('merchant_shops')
          .insert({
            user_id: prof.id,
            shop_name: payload.clientCompany || prof.full_name || 'Boutique',
            manager_name: payload.clientName || prof.full_name || 'Gérant',
            phone: payload.clientPhone || prof.phone || '',
            email: prof.email || '',
            city: prof.city || payload.city || 'Casablanca',
            pickup_address: prof.address || payload.address || '',
            account_status: 'approuve'
          })
          .select('id, user_id, shop_name, manager_name, phone, city, account_status')
          .maybeSingle();
        resolvedShop = createdShop;
      }
    }

    if (resolvedShop?.account_status === 'suspendu' && !isStaffRole(actor.role)) {
      return {
        success: false,
        error: 'Votre compte boutique est actuellement suspendu. Impossible de créer un colis.'
      };
    }

    const trackingNumber = `FAR-${Math.floor(10000000 + Math.random() * 90000000)}`;
    const now = new Date().toISOString();
    const cleanDesc = (payload.description || 'Colis e-commerce').trim();
    const fullDesc = payload.notes?.trim()
      ? `${cleanDesc} [Remarques: ${payload.notes.trim()}]`
      : cleanDesc;

    const initialHistory: import('../types').PackageHistoryItem[] = [
      {
        id: `hist-${Date.now()}`,
        status: 'attente_ramassage',
        statusLabel: 'En attente de ramassage',
        timestamp: now,
        location: resolvedShop?.city || payload.city || 'Agence Principale',
        comment: 'Colis créé et enregistré sur Supabase',
        updatedBy: actor.name || 'Système',
        role: (actor.role as any) || 'client'
      }
    ];

    const baseInsert: Record<string, any> = {
      shop_id: resolvedShop?.id || payload.shopId,
      tracking_number: trackingNumber,
      recipient_name: payload.recipientName.trim(),
      recipient_phone: payload.recipientPhone.trim(),
      destination_city: payload.city.trim(),
      destination_address: payload.address.trim(),
      item_description: fullDesc,
      cod_amount: Number(payload.codAmount || 0),
      delivery_fee: Number(payload.deliveryFee || 0),
      status: 'attente_ramassage',
      is_paid_to_client: false,
      created_at: now,
      updated_at: now
    };

    const extendedInsert: Record<string, any> = {
      ...baseInsert,
      notes: payload.notes?.trim() || null,
      current_agency: 'Agence Principale',
      allow_open: payload.allowOpen ?? true,
      allow_try: payload.allowTry ?? false,
      is_fragile: payload.isFragile ?? false,
      is_exchange: payload.isExchange ?? false,
      exchange_tracking_number: payload.exchangeTrackingNumber || null,
      exchange_reason: payload.exchangeReason || null,
      exchange_item_description: payload.exchangeItemDescription || null,
      history: initialHistory
    };

    let { data: inserted, error: insertErr } = await supabaseClient
      .from('packages')
      .insert(extendedInsert)
      .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
      .single();

    if (insertErr && isMissingColumnError(insertErr)) {
      const retry = await supabaseClient
        .from('packages')
        .insert(baseInsert)
        .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
        .single();
      inserted = retry.data;
      insertErr = retry.error;
    }

    if (insertErr || !inserted) {
      return {
        success: false,
        error: insertErr?.message || "Erreur lors de l'enregistrement du colis sur Supabase."
      };
    }

    // Store options & initial history in auxiliary state so they survive even without optional SQL columns
    await patchAuxiliaryState(aux => {
      aux.packageOptions[inserted.id] = {
        allowOpen: payload.allowOpen,
        allowTry: payload.allowTry,
        isFragile: payload.isFragile,
        isExchange: payload.isExchange,
        exchangeTrackingNumber: payload.exchangeTrackingNumber,
        exchangeReason: payload.exchangeReason,
        exchangeItemDescription: payload.exchangeItemDescription,
        notes: payload.notes,
        stockLocationId: payload.stockLocationId,
        stockPosition: payload.stockPosition
      };
      aux.packageOverrides[inserted.id] = {
        ...(aux.packageOverrides[inserted.id] || {}),
        history: initialHistory
      };
    });

    const createdPkg: PackageItem = {
      id: inserted.id,
      trackingNumber: inserted.tracking_number,
      shopId: inserted.shop_id,
      clientId: inserted.merchant_shops?.user_id || resolvedShop?.user_id || inserted.shop_id,
      clientName: inserted.merchant_shops?.manager_name || payload.clientName || 'Gérant',
      clientCompany: inserted.merchant_shops?.shop_name || payload.clientCompany || 'Boutique',
      clientPhone: inserted.merchant_shops?.phone || payload.clientPhone || '',
      recipientName: inserted.recipient_name,
      recipientPhone: inserted.recipient_phone,
      city: inserted.destination_city,
      address: inserted.destination_address,
      description: inserted.item_description,
      notes: payload.notes,
      codAmount: Number(inserted.cod_amount || payload.codAmount),
      deliveryFee: Number(inserted.delivery_fee || payload.deliveryFee),
      productPrice: Number(payload.productPrice ?? Math.max(0, Number(inserted.cod_amount || 0) - Number(inserted.delivery_fee || 0))),
      status: (inserted.status || 'attente_ramassage') as PackageStatus,
      currentAgency: 'Agence Principale',
      isPaidToClient: false,
      allowOpen: payload.allowOpen,
      allowTry: payload.allowTry,
      isFragile: payload.isFragile,
      isExchange: payload.isExchange,
      exchangeTrackingNumber: payload.exchangeTrackingNumber,
      exchangeReason: payload.exchangeReason,
      exchangeItemDescription: payload.exchangeItemDescription,
      stockLocationId: payload.stockLocationId,
      stockPosition: payload.stockPosition,
      createdAt: inserted.created_at || now,
      lastMovedAt: inserted.updated_at || now,
      history: initialHistory
    };

    return {
      success: true,
      message: `Colis ${createdPkg.trackingNumber} enregistré avec succès sur Supabase.`,
      package: createdPkg
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la création du colis.'
    };
  }
}

/**
 * Directly updates arbitrary fields of a package (recipient info, COD, notes, comments,
 * driver, agency, payment flag, partner metadata, history) in public.packages + auxiliary_state.
 */
export async function updatePackageInSupabase(
  packageId: string,
  updates: Partial<PackageItem> & { comment?: string }
): Promise<{
  success: boolean;
  message?: string;
  package?: PackageItem;
  error?: string;
}> {
  try {
    const now = new Date().toISOString();
    const corePatch: Record<string, any> = { updated_at: now };
    if (updates.recipientName !== undefined) corePatch.recipient_name = updates.recipientName;
    if (updates.recipientPhone !== undefined) corePatch.recipient_phone = updates.recipientPhone;
    if (updates.city !== undefined) corePatch.destination_city = updates.city;
    if (updates.address !== undefined) corePatch.destination_address = updates.address;
    if (updates.description !== undefined) corePatch.item_description = updates.description;
    if (updates.codAmount !== undefined) corePatch.cod_amount = Number(updates.codAmount);
    if (updates.deliveryFee !== undefined) corePatch.delivery_fee = Number(updates.deliveryFee);
    if (updates.status !== undefined) corePatch.status = updates.status;
    if (updates.isPaidToClient !== undefined) corePatch.is_paid_to_client = Boolean(updates.isPaidToClient);
    if (updates.driverId !== undefined) corePatch.driver_id = updates.driverId || null;

    const fullPatch: Record<string, any> = {
      ...corePatch,
      ...(updates.partnerId !== undefined ? { partner_id: updates.partnerId || null } : {}),
      ...(updates.partnerName !== undefined ? { partner_name: updates.partnerName || null } : {}),
      ...(updates.partnerTrackingNumber !== undefined ? { partner_tracking_number: updates.partnerTrackingNumber || null } : {}),
      ...(updates.partnerShipmentId !== undefined ? { partner_shipment_id: updates.partnerShipmentId || null } : {}),
      ...(updates.partnerLabelUrl !== undefined ? { partner_label_url: updates.partnerLabelUrl || null } : {}),
      ...(updates.partnerSyncStatus !== undefined ? { partner_sync_status: updates.partnerSyncStatus || null } : {}),
      ...(updates.partnerLastSyncAt !== undefined ? { partner_last_sync_at: updates.partnerLastSyncAt || null } : {}),
      ...(updates.driverComment !== undefined ? { driver_comment: updates.driverComment } : {}),
      ...(updates.comment !== undefined ? { driver_comment: updates.comment } : {}),
      ...(updates.notes !== undefined ? { notes: updates.notes } : {}),
      ...(updates.currentAgency !== undefined ? { current_agency: updates.currentAgency } : {}),
      ...(updates.destinationAgency !== undefined ? { destination_agency: updates.destinationAgency } : {}),
      ...(updates.callProofUrl !== undefined ? { call_proof_url: updates.callProofUrl } : {}),
      ...(updates.allowOpen !== undefined ? { allow_open: updates.allowOpen } : {}),
      ...(updates.allowTry !== undefined ? { allow_try: updates.allowTry } : {}),
      ...(updates.isFragile !== undefined ? { is_fragile: updates.isFragile } : {}),
      ...(updates.isExchange !== undefined ? { is_exchange: updates.isExchange } : {}),
      ...(updates.history !== undefined ? { history: updates.history } : {}),
      ...(updates.problemReport !== undefined ? { problem_report: updates.problemReport } : {}),
      ...(updates.deliveredBy !== undefined ? { delivered_by: updates.deliveredBy } : {}),
      ...(updates.partnerDeliveryFee !== undefined ? { partner_delivery_fee: Number(updates.partnerDeliveryFee) } : {}),
      ...(updates.partnerSettled !== undefined ? { partner_settled: Boolean(updates.partnerSettled) } : {})
    };

    let updatedRow: any = null;
    let dbErrorMsg: string | null = null;

    if (isUuid(packageId)) {
      const workingPatch: Record<string, any> = { ...fullPatch };
      for (let attempt = 0; attempt < 20; attempt++) {
        if (Object.keys(workingPatch).length === 0) break;
        const { data, error } = await supabaseClient
          .from('packages')
          .update(workingPatch)
          .eq('id', packageId)
          .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
          .maybeSingle();

        if (!error) {
          updatedRow = data;
          dbErrorMsg = null;
          break;
        }

        if (isMissingColumnError(error)) {
          const badCol = extractMissingColumnName(error);
          if (badCol && Object.prototype.hasOwnProperty.call(workingPatch, badCol)) {
            delete workingPatch[badCol];
            continue;
          }
          // Fall back to guaranteed base columns if column name couldn't be parsed
          if (attempt === 0) {
            const keys = Object.keys(workingPatch);
            for (const k of keys) {
              if (!Object.prototype.hasOwnProperty.call(corePatch, k)) {
                delete workingPatch[k];
              }
            }
            continue;
          }
        }

        dbErrorMsg = error.message;
        console.warn('[Supabase Package Update] Relational update warning:', error.message);
        break;
      }
    }

    // ALWAYS persist full updates in auxiliary packageOverrides (and aux.packages if fallback item)
    const aux = await patchAuxiliaryState(state => {
      const prev = state.packageOverrides[packageId] || {};
      const nextOverride: Record<string, any> = {
        ...prev,
        ...updates,
        lastMovedAt: now,
        overrideUpdatedAt: now
      };
      if (updates.comment !== undefined && !updates.driverComment) {
        nextOverride.driverComment = updates.comment;
      }
      state.packageOverrides[packageId] = nextOverride;

      // Also keep any aux-only fallback package in sync
      if (Array.isArray(state.packages) && state.packages.length > 0) {
        state.packages = state.packages.map(p =>
          p.id === packageId ? { ...p, ...updates, lastMovedAt: now } : p
        );
      }

      if (updates.problemReport !== undefined) {
        if (updates.problemReport) {
          state.problemReports[packageId] = updates.problemReport;
        } else {
          delete state.problemReports[packageId];
        }
      }
    });

    const driversMap = await fetchDriversLookupMap();
    const mapped = updatedRow ? mapSupabasePackageRow(updatedRow, aux, driversMap) : undefined;

    return {
      success: true,
      message: dbErrorMsg
        ? 'Colis mis à jour (synchronisé via état auxiliaire Supabase).'
        : 'Colis mis à jour avec succès sur Supabase.',
      package: mapped
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la mise à jour du colis.'
    };
  }
}

export async function updatePackageStatusInSupabase(
  packageId: string,
  newStatus: PackageStatus,
  comment?: string,
  extra?: { problemReport?: any; callProofUrl?: string; currentAgency?: string; location?: string }
): Promise<{
  success: boolean;
  message?: string;
  package?: PackageItem;
  error?: string;
}> {
  try {
    const actor = await getAuthenticatedActor();
    const now = new Date().toISOString();

    const auxBefore = await loadAuxiliaryState();
    const prevOverride = auxBefore.packageOverrides?.[packageId] || {};
    const prevHistory = Array.isArray(prevOverride.history) ? prevOverride.history : [];

    const historyEntry: import('../types').PackageHistoryItem = {
      id: `hist-${Date.now()}`,
      status: newStatus,
      statusLabel: newStatus,
      timestamp: now,
      location: extra?.location || extra?.currentAgency || prevOverride.currentAgency || 'Agence Principale',
      comment: comment || `Statut mis à jour : ${newStatus}`,
      updatedBy: actor?.name || 'Système',
      role: (actor?.role as any) || 'admin'
    };
    const nextHistory = [historyEntry, ...prevHistory].slice(0, 50);

    const res = await updatePackageInSupabase(packageId, {
      status: newStatus,
      ...(comment !== undefined ? { driverComment: comment } : {}),
      ...(extra?.callProofUrl !== undefined ? { callProofUrl: extra.callProofUrl } : {}),
      ...(extra?.currentAgency !== undefined ? { currentAgency: extra.currentAgency } : {}),
      ...(extra?.problemReport !== undefined ? { problemReport: extra.problemReport } : {}),
      history: nextHistory
    });

    if (!res.success) {
      return { success: false, error: res.error };
    }

    return {
      success: true,
      message: `Statut mis à jour : ${newStatus}`,
      package: res.package
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Erreur lors de la mise à jour du statut du colis.'
    };
  }
}

export async function assignPackagesToDriverInSupabase(
  packageIds: string[],
  driverId: string | null,
  updateStatus: boolean = false
): Promise<{
  success: boolean;
  message?: string;
  driverName?: string;
  updatedCount?: number;
  error?: string;
}> {
  try {
    if (!Array.isArray(packageIds) || packageIds.length === 0) {
      return { success: false, error: 'Aucun colis sélectionné.' };
    }

    let driverName = '';
    if (driverId) {
      const { data: drv } = await supabaseClient
        .from('profiles')
        .select('full_name')
        .eq('id', driverId)
        .maybeSingle();
      driverName = drv?.full_name || 'Livreur';
    }

    const now = new Date().toISOString();
    const patch: Record<string, any> = {
      driver_id: driverId || null,
      updated_at: now
    };
    if (updateStatus && driverId) {
      patch.status = 'en_cours_livraison';
    }

    const uuidIds = packageIds.filter(id => isUuid(id));
    if (uuidIds.length > 0) {
      const { error } = await supabaseClient
        .from('packages')
        .update(patch)
        .in('id', uuidIds);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    await patchAuxiliaryState(aux => {
      for (const pid of packageIds) {
        aux.packageOverrides[pid] = {
          ...(aux.packageOverrides[pid] || {}),
          driverId: driverId || undefined,
          driverName: driverName || undefined,
          ...(updateStatus && driverId ? { status: 'en_cours_livraison' } : {}),
          lastMovedAt: now
        };
      }
    });

    return {
      success: true,
      message: driverId
        ? `${packageIds.length} colis affecté(s) à ${driverName}.`
        : `${packageIds.length} colis désaffecté(s).`,
      driverName,
      updatedCount: packageIds.length
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || "Erreur lors de l'affectation du colis au livreur."
    };
  }
}

export async function deleteSupabasePackage(
  packageId: string
): Promise<{ success: boolean; message?: string; error?: string }> {
  try {
    if (isUuid(packageId)) {
      const { error } = await supabaseClient
        .from('packages')
        .delete()
        .eq('id', packageId);

      if (error) {
        return { success: false, error: error.message };
      }
    }

    await patchAuxiliaryState(aux => {
      if (!aux.deletedPackageIds.includes(packageId)) {
        aux.deletedPackageIds.push(packageId);
      }
      aux.packages = aux.packages.filter(p => p.id !== packageId);
      delete aux.packageOverrides[packageId];
      delete aux.packageOptions[packageId];
      delete aux.problemReports[packageId];
    });

    return {
      success: true,
      message: 'Colis supprimé définitivement de Supabase.'
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message || 'Échec de suppression du colis dans Supabase.'
    };
  }
}

export async function scanDriverTicket(
  code: string,
  claimIfAssigned: boolean = false,
  driverId?: string
): Promise<{
  success: boolean;
  packageItem?: PackageItem;
  autoClaimed?: boolean;
  assignedToOtherDriver?: boolean;
  assignedDriverName?: string;
  error?: string;
}> {
  try {
    const cleanCode = (code || '').trim();
    if (!cleanCode) {
      return { success: false, error: 'Code barre / numéro de suivi vide.' };
    }

    const actor = await getAuthenticatedActor();
    const targetDriverId = driverId || actor?.id;
    if (!targetDriverId) {
      return { success: false, error: 'Livreur non authentifié.' };
    }

    // Look up package by tracking_number (case-insensitive) or UUID
    let row: any = null;
    const { data: byTracking } = await supabaseClient
      .from('packages')
      .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
      .ilike('tracking_number', cleanCode)
      .maybeSingle();

    row = byTracking;

    if (!row && isUuid(cleanCode)) {
      const { data: byId } = await supabaseClient
        .from('packages')
        .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
        .eq('id', cleanCode)
        .maybeSingle();
      row = byId;
    }

    if (!row) {
      return {
        success: false,
        error: `Aucun colis trouvé avec le code "${cleanCode}".`
      };
    }

    const driversMap = await fetchDriversLookupMap();
    const existingDriverId = row.driver_id;
    const assignedToOtherDriver = Boolean(existingDriverId && existingDriverId !== targetDriverId);
    const assignedDriverName = existingDriverId ? driversMap.get(existingDriverId)?.name : undefined;

    let autoClaimed = false;
    if (!existingDriverId || claimIfAssigned) {
      const now = new Date().toISOString();
      const nextStatus: PackageStatus =
        row.status === 'attente_ramassage' || row.status === 'en_preparation'
          ? 'en_cours_livraison'
          : row.status;

      const { data: updated, error: updErr } = await supabaseClient
        .from('packages')
        .update({
          driver_id: targetDriverId,
          status: nextStatus,
          updated_at: now
        })
        .eq('id', row.id)
        .select('*, merchant_shops(id, user_id, shop_name, manager_name, phone, city)')
        .maybeSingle();

      if (!updErr && updated) {
        row = updated;
        autoClaimed = true;
      }
    }

    const aux = await loadAuxiliaryState();
    const mapped = mapSupabasePackageRow(row, aux, driversMap);

    return {
      success: true,
      packageItem: mapped,
      autoClaimed,
      assignedToOtherDriver: assignedToOtherDriver && !autoClaimed,
      assignedDriverName
    };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || 'Erreur lors de la vérification du ticket.'
    };
  }
}

/**
 * Public parcel tracking for LandingPage (direct Supabase RPC + fallback).
 * Returns only non-PII tracking metadata.
 */
export async function trackPublicPackageInSupabase(trackingNumber: string): Promise<{
  success: boolean;
  parcel?: {
    trackingNumber: string;
    status: string;
    city: string;
    currentAgency: string;
    codAmount?: number;
    driver?: { name: string; phone?: string } | null;
    createdAt: string;
    lastMovedAt: string;
    history: any[];
  };
  error?: string;
}> {
  const cleanCode = (trackingNumber || '').trim().toUpperCase();
  if (!cleanCode) {
    return { success: false, error: 'Numéro de suivi requis.' };
  }

  // 1. Primary: SECURITY DEFINER RPC (safe for unauthenticated visitors)
  try {
    const { data, error } = await supabaseClient.rpc('track_package_public', {
      p_tracking_number: cleanCode
    });
    if (!error && Array.isArray(data) && data.length > 0) {
      const r = data[0];
      return {
        success: true,
        parcel: {
          trackingNumber: r.tracking_number,
          status: r.status || 'attente_ramassage',
          city: r.destination_city || 'Maroc',
          currentAgency: r.current_agency || 'Agence Principale',
          codAmount: r.cod_amount !== undefined ? Number(r.cod_amount) : undefined,
          createdAt: r.created_at,
          lastMovedAt: r.updated_at || r.created_at,
          history: Array.isArray(r.history) ? r.history : []
        }
      };
    }
  } catch {}

  // 2. Fallback: direct packages query (works when authenticated or open SELECT)
  try {
    const { data: row } = await supabaseClient
      .from('packages')
      .select('id, tracking_number, status, destination_city, cod_amount, created_at, updated_at')
      .ilike('tracking_number', cleanCode)
      .maybeSingle();

    if (row) {
      const aux = await loadAuxiliaryState();
      const override = aux.packageOverrides?.[row.id] || {};
      return {
        success: true,
        parcel: {
          trackingNumber: row.tracking_number,
          status: override.status || row.status || 'attente_ramassage',
          city: override.city || row.destination_city || 'Maroc',
          currentAgency: override.currentAgency || 'Agence Principale',
          codAmount: override.codAmount !== undefined ? Number(override.codAmount) : Number(row.cod_amount || 0),
          driver: override.driverName ? { name: override.driverName } : null,
          createdAt: row.created_at,
          lastMovedAt: override.lastMovedAt || row.updated_at || row.created_at,
          history: Array.isArray(override.history) ? override.history : []
        }
      };
    }
  } catch {}

  // 3. Server API fallback (Express /api/public/track/:trackingNumber)
  if (typeof window !== 'undefined' && /^https?:$/i.test(window.location.protocol)) {
    try {
      const res = await fetch(`/api/public/track/${encodeURIComponent(cleanCode)}`, {
        method: 'GET',
        headers: { Accept: 'application/json' }
      });
      if (res.ok) {
        const json = await res.json();
        const p = json?.package || json?.parcel;
        if (json?.success && p) {
          return {
            success: true,
            parcel: {
              trackingNumber: p.trackingNumber || cleanCode,
              status: p.status || 'attente_ramassage',
              city: p.city || 'Maroc',
              currentAgency: p.currentAgency || 'Agence Principale',
              codAmount: p.codAmount !== undefined ? Number(p.codAmount) : undefined,
              driver: p.driver || null,
              createdAt: p.createdAt || new Date().toISOString(),
              lastMovedAt: p.lastMovedAt || p.createdAt || new Date().toISOString(),
              history: Array.isArray(p.history) ? p.history : []
            }
          };
        }
      }
    } catch {}
  }

  return { success: false, error: 'Colis introuvable.' };
}

// =============================================================================
// REALTIME SERVICE (BROADCAST + POSTGRES CHANGES + CROSS-TAB)
// =============================================================================

export interface RealtimePackageEvent {
  packageId: string;
  trackingNumber: string;
  oldStatus?: string;
  newStatus: string;
  newStatusLabel: string;
  recipientName: string;
  city: string;
  updatedBy: string;
  timestamp: string;
  codAmount: number;
  clientId: string;
}

export interface RealtimePickupEvent {
  pickupId: string;
  trackingId: string;
  clientCompany: string;
  city: string;
  packageCount: number;
  requestedDate: string;
  timeSlot: string;
  timestamp: string;
  clientId: string;
}

export interface RealtimeToastItem {
  id: string;
  title: string;
  message: string;
  type: 'status_changed' | 'new_pickup' | 'new_package';
  timestamp: string;
  badge?: string;
  badgeColor?: string;
  targetId?: string;
  clientId?: string;
  trackingNumber?: string;
}

export interface RealtimeUserNotificationEvent {
  notificationId: string;
  targetScope: string;
  targetUserId?: string;
  targetUserEmail?: string;
  title: string;
  message: string;
  createdAt: string;
}

class SupabaseRealtimeService {
  private client: SupabaseClient | null = null;
  private channel: RealtimeChannel | null = null;
  private crossTabChannel: BroadcastChannel | null = null;
  private listeners: Array<(toast: RealtimeToastItem) => void> = [];
  private statusListeners: Array<(status: 'connected' | 'connecting' | 'disconnected') => void> = [];
  private packageStatusListeners: Array<(event: RealtimePackageEvent) => void> = [];
  private userNotificationListeners: Array<(event: RealtimeUserNotificationEvent) => void> = [];
  private recentEventKeys = new Map<string, number>();
  public connectionStatus: 'connected' | 'connecting' | 'disconnected' = 'connecting';
  public customUrl: string = '';
  public customKey: string = '';
  public audioEnabled: boolean = true;

  constructor() {
    this.initClient();
    this.initCrossTab();
  }

  private initClient() {
    try {
      const savedUrl = (typeof window !== 'undefined' ? localStorage.getItem('fariousy_supabase_url') : null) || DEFAULT_SUPABASE_URL;
      const savedKey = (typeof window !== 'undefined' ? localStorage.getItem('fariousy_supabase_key') : null) || DEFAULT_SUPABASE_ANON_KEY;
      this.customUrl = savedUrl;
      this.customKey = savedKey;

      if (!savedUrl || !savedKey) {
        this.connectionStatus = 'disconnected';
        this.notifyStatus('disconnected');
        return;
      }

      // Reuse primary supabaseClient when credentials match to avoid duplicate GoTrue instances
      if (savedUrl === DEFAULT_SUPABASE_URL && savedKey === DEFAULT_SUPABASE_ANON_KEY) {
        this.client = supabaseClient;
      } else {
        this.client = createClient(savedUrl, savedKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          realtime: {
            params: {
              eventsPerSecond: 10
            }
          }
        });
      }

      this.setupChannel();
    } catch (e) {
      console.warn('Supabase client initialization notice:', e);
      this.connectionStatus = 'disconnected';
      this.notifyStatus('disconnected');
    }
  }

  private setupChannel() {
    if (!this.client) return;

    try {
      this.channel = this.client.channel('fariousy_realtime_channel', {
        config: {
          broadcast: { self: false }
        }
      });

      this.channel
        .on('broadcast', { event: 'package_status_changed' }, ({ payload }) => {
          this.handleIncomingPackageStatus(payload as RealtimePackageEvent);
        })
        .on('broadcast', { event: 'new_pickup_request' }, ({ payload }) => {
          this.handleIncomingPickup(payload as RealtimePickupEvent);
        })
        .on('broadcast', { event: 'user_notification_created' }, ({ payload }) => {
          this.handleIncomingUserNotification(payload as RealtimeUserNotificationEvent);
        })
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'packages' },
          (change: any) => {
            const newRow = change?.new;
            const oldRow = change?.old;
            if (newRow && (!oldRow || newRow.status !== oldRow.status)) {
              this.handleIncomingPackageStatus({
                packageId: newRow.id,
                trackingNumber: newRow.tracking_number || '',
                oldStatus: oldRow?.status,
                newStatus: newRow.status,
                newStatusLabel: newRow.status,
                recipientName: newRow.recipient_name || '',
                city: newRow.destination_city || '',
                updatedBy: 'Supabase Live',
                timestamp: newRow.updated_at || new Date().toISOString(),
                codAmount: Number(newRow.cod_amount || 0),
                clientId: newRow.shop_id || ''
              });
            }
          }
        )
        .subscribe(status => {
          if (status === 'SUBSCRIBED') {
            this.connectionStatus = 'connected';
            this.notifyStatus('connected');
          } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            this.connectionStatus = 'disconnected';
            this.notifyStatus('disconnected');
          }
        });
    } catch {
      this.connectionStatus = 'disconnected';
      this.notifyStatus('disconnected');
    }
  }

  private initCrossTab() {
    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      this.crossTabChannel = new BroadcastChannel('fariousy_supabase_realtime_local');
      this.crossTabChannel.onmessage = (event) => {
        const { type, payload } = event.data;
        if (type === 'package_status_changed') {
          this.handleIncomingPackageStatus(payload);
        } else if (type === 'new_pickup_request') {
          this.handleIncomingPickup(payload);
        } else if (type === 'user_notification_created') {
          this.handleIncomingUserNotification(payload);
        }
      };
    }
  }

  public updateCredentials(url: string, key: string) {
    if (url && key) {
      localStorage.setItem('fariousy_supabase_url', url);
      localStorage.setItem('fariousy_supabase_key', key);
      this.customUrl = url;
      this.customKey = key;
      if (this.channel) {
        this.channel.unsubscribe();
      }
      this.initClient();
    }
  }

  public resetCredentials() {
    localStorage.removeItem('fariousy_supabase_url');
    localStorage.removeItem('fariousy_supabase_key');
    this.customUrl = DEFAULT_SUPABASE_URL;
    this.customKey = DEFAULT_SUPABASE_ANON_KEY;
    this.initClient();
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  public async syncRecord(table: string, action: 'insert' | 'update' | 'delete', data: any, idField = 'id') {
    const db = this.client || supabaseClient;
    try {
      if (action === 'insert') {
        const { data: res, error } = await db.from(table).insert(data).select();
        return { success: !error, data: res, error };
      } else if (action === 'update') {
        const idVal = data[idField];
        const { data: res, error } = await db.from(table).update(data).eq(idField, idVal).select();
        return { success: !error, data: res, error };
      } else if (action === 'delete') {
        const idVal = typeof data === 'object' ? data[idField] : data;
        const { data: res, error } = await db.from(table).delete().eq(idField, idVal);
        return { success: !error, data: res, error };
      }
      return { success: true };
    } catch (err) {
      return { success: false, error: err };
    }
  }

  public broadcastStatusChange(event: RealtimePackageEvent) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'package_status_changed',
        payload: event
      });
    }

    if (this.crossTabChannel) {
      this.crossTabChannel.postMessage({
        type: 'package_status_changed',
        payload: event
      });
    }

    this.handleIncomingPackageStatus(event);
  }

  public broadcastNewPickup(event: RealtimePickupEvent) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'new_pickup_request',
        payload: event
      });
    }

    if (this.crossTabChannel) {
      this.crossTabChannel.postMessage({
        type: 'new_pickup_request',
        payload: event
      });
    }

    this.handleIncomingPickup(event);
  }

  public broadcastUserNotification(event: RealtimeUserNotificationEvent) {
    if (this.channel) {
      this.channel.send({
        type: 'broadcast',
        event: 'user_notification_created',
        payload: event
      });
    }

    if (this.crossTabChannel) {
      this.crossTabChannel.postMessage({
        type: 'user_notification_created',
        payload: event
      });
    }

    this.handleIncomingUserNotification(event);
  }

  private handleIncomingUserNotification(payload: RealtimeUserNotificationEvent) {
    this.userNotificationListeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('Error in userNotificationListener:', err);
      }
    });
  }

  private handleIncomingPackageStatus(payload: RealtimePackageEvent) {
    const dedupeKey = `${payload.packageId || payload.trackingNumber}:${payload.newStatus}`;
    const now = Date.now();
    const prevTs = this.recentEventKeys.get(dedupeKey);
    if (prevTs && now - prevTs < 1500) {
      return;
    }
    this.recentEventKeys.set(dedupeKey, now);
    if (this.recentEventKeys.size > 100) {
      const oldestKey = this.recentEventKeys.keys().next().value;
      if (oldestKey) this.recentEventKeys.delete(oldestKey);
    }

    this.playAudioNotification(payload.newStatus === 'livre' ? 'success' : payload.newStatus === 'refuse' || payload.newStatus === 'retourne' ? 'alert' : 'info');

    const toast: RealtimeToastItem = {
      id: 'toast-' + Date.now() + Math.random().toString(36).substring(2, 5),
      title: `⚡ Colis ${payload.trackingNumber} : ${payload.newStatusLabel}`,
      message: `Destinataire : ${payload.recipientName} (${payload.city}) · Mis à jour par ${payload.updatedBy}`,
      type: 'status_changed',
      timestamp: payload.timestamp,
      badge: payload.newStatusLabel,
      badgeColor:
        payload.newStatus === 'livre'
          ? 'bg-emerald-600'
          : payload.newStatus === 'refuse' || payload.newStatus === 'retourne'
          ? 'bg-rose-600'
          : 'bg-red-600',
      targetId: payload.packageId,
      clientId: payload.clientId,
      trackingNumber: payload.trackingNumber
    };

    this.notifyToast(toast);

    this.packageStatusListeners.forEach(cb => {
      try {
        cb(payload);
      } catch (err) {
        console.warn('Error in packageStatusListener:', err);
      }
    });
  }

  private handleIncomingPickup(payload: RealtimePickupEvent) {
    this.playAudioNotification('info');

    const toast: RealtimeToastItem = {
      id: 'toast-' + Date.now() + Math.random().toString(36).substring(2, 5),
      title: `📥 Nouveau Ramassage : ${payload.trackingId}`,
      message: `${payload.clientCompany} demande la collecte de ${payload.packageCount} colis (${payload.city}) pour le ${payload.requestedDate}`,
      type: 'new_pickup',
      timestamp: payload.timestamp,
      badge: `${payload.packageCount} colis`,
      badgeColor: 'bg-amber-600',
      targetId: payload.pickupId
    };

    this.notifyToast(toast);
  }

  public playAudioNotification(kind: 'info' | 'success' | 'alert' = 'info') {
    if (!this.audioEnabled || typeof window === 'undefined') return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      if (kind === 'success') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(523.25, ctx.currentTime);
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime + 0.1);
        osc2.stop(ctx.currentTime + 0.35);
      } else if (kind === 'alert') {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.setValueAtTime(330, ctx.currentTime + 0.12);

        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
      } else {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.25);
      }

      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 600);
    } catch {
      // Audio autoplay policy fallback
    }
  }

  public onToast(callback: (toast: RealtimeToastItem) => void) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  public onPackageStatusChanged(callback: (event: RealtimePackageEvent) => void) {
    this.packageStatusListeners.push(callback);
    return () => {
      this.packageStatusListeners = this.packageStatusListeners.filter(cb => cb !== callback);
    };
  }

  public onUserNotificationCreated(callback: (event: RealtimeUserNotificationEvent) => void) {
    this.userNotificationListeners.push(callback);
    return () => {
      this.userNotificationListeners = this.userNotificationListeners.filter(cb => cb !== callback);
    };
  }

  public onStatusChange(callback: (status: 'connected' | 'connecting' | 'disconnected') => void) {
    this.statusListeners.push(callback);
    callback(this.connectionStatus);
    return () => {
      this.statusListeners = this.statusListeners.filter(cb => cb !== callback);
    };
  }

  private notifyToast(toast: RealtimeToastItem) {
    this.listeners.forEach(cb => cb(toast));
  }

  private notifyStatus(status: 'connected' | 'connecting' | 'disconnected') {
    this.statusListeners.forEach(cb => cb(status));
  }
}

export const supabaseRealtime = new SupabaseRealtimeService();
