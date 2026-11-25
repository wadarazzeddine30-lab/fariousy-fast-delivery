import { BlacklistEntry } from '../types';

export const BLACKLIST_REASONS: Array<{ value: string; label: string }> = [
  { value: 'كيلغي الطلبيات بزاف', label: 'كيلغي الطلبيات بزاف (Annule souvent)' },
  { value: 'كيتفلا / ما جادش فالشراء', label: 'كيتفلا / ما جادش فالشراء (Faux acheteur)' },
  { value: 'لا يرد بعد التأكيد', label: 'لا يرد بعد التأكيد (Ne répond plus)' },
  { value: 'يرفض الاستلام عند الليفرور', label: 'يرفض الاستلام عند الوصول (Refus à la livraison)' },
  { value: 'عنوان أو معلومات وهمية', label: 'عنوان أو معلومات وهمية (Fausse adresse)' },
  { value: 'أخرى', label: 'سبب آخر' }
];

/**
 * Normalizes Moroccan & international phone numbers into a canonical 9-digit suffix
 * so 0661234567, +212 661-23-45-67, 00212661234567, 212661234567 all match identically.
 */
export function normalizeBlacklistPhone(phone?: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';

  let cleaned = digits;
  if (cleaned.startsWith('00212') && cleaned.length >= 13) {
    cleaned = cleaned.slice(5);
  } else if (cleaned.startsWith('212') && cleaned.length >= 11) {
    cleaned = cleaned.slice(3);
  }

  cleaned = cleaned.replace(/^0+/, '');
  if (cleaned.length >= 8) {
    return cleaned.slice(-9);
  }
  return cleaned;
}

export interface BlacklistMatchSummary {
  normalizedPhone: string;
  matches: BlacklistEntry[];
  reportCount: number;
  latestComment: string;
  latestReason: string;
  reasons: string[];
}

export function matchBlacklistPhone(
  phone: string | undefined,
  entries: BlacklistEntry[]
): BlacklistMatchSummary {
  const normalizedPhone = normalizeBlacklistPhone(phone);
  if (normalizedPhone.length < 8 || !Array.isArray(entries) || entries.length === 0) {
    return {
      normalizedPhone,
      matches: [],
      reportCount: 0,
      latestComment: '',
      latestReason: '',
      reasons: []
    };
  }

  const matches = entries
    .filter(e => (e.normalizedPhone || normalizeBlacklistPhone(e.phone)) === normalizedPhone)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt).getTime() - new Date(a.updatedAt || a.createdAt).getTime());

  const reasons = Array.from(new Set(matches.map(m => m.reason).filter(Boolean)));
  return {
    normalizedPhone,
    matches,
    reportCount: matches.length,
    latestComment: matches[0]?.comment || '',
    latestReason: matches[0]?.reason || '',
    reasons
  };
}
