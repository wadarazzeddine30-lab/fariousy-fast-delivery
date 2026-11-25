export interface LocalKycDocument {
  cinNumber?: string;
  cinPhotoUrl?: string;
  cinBackPhotoUrl?: string;
  driverPhotoUrl?: string;
  updatedAt?: string;
}

const KYC_STORAGE_KEY = 'fariousy_kyc_docs_v1';

export function loadLocalKycMap(): Record<string, LocalKycDocument> {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(KYC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveLocalKycDocs(
  keys: (string | undefined | null)[],
  docs: Partial<LocalKycDocument>
): void {
  if (typeof window === 'undefined') return;
  try {
    const map = loadLocalKycMap();
    const existing = getLocalKycDocs(keys, map);
    const merged: LocalKycDocument = {
      cinNumber: docs.cinNumber ?? existing?.cinNumber,
      cinPhotoUrl: docs.cinPhotoUrl ?? existing?.cinPhotoUrl,
      cinBackPhotoUrl: docs.cinBackPhotoUrl ?? existing?.cinBackPhotoUrl,
      driverPhotoUrl: docs.driverPhotoUrl ?? existing?.driverPhotoUrl,
      updatedAt: new Date().toISOString()
    };
    for (const rawKey of keys) {
      if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
        map[rawKey.trim().toLowerCase()] = merged;
      }
    }
    localStorage.setItem(KYC_STORAGE_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage quota warnings silently
  }
}

export function getLocalKycDocs(
  keys: (string | undefined | null)[],
  existingMap?: Record<string, LocalKycDocument>
): LocalKycDocument | null {
  const map = existingMap || loadLocalKycMap();
  for (const rawKey of keys) {
    if (rawKey && typeof rawKey === 'string' && rawKey.trim()) {
      const found = map[rawKey.trim().toLowerCase()];
      if (found) return found;
    }
  }
  return null;
}
