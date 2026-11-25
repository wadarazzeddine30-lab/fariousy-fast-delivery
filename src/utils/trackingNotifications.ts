import { PACKAGE_STATUS_CONFIG, PackageStatus } from '../types';

export const DEFAULT_WHATSAPP_WATCHED_STATUSES: PackageStatus[] = [
  'ramasse',
  'en_cours_livraison',
  'livre',
  'retourne',
  'probleme_livraison'
];

export const DEFAULT_WHATSAPP_TEMPLATE =
  '📦 {{company}} : السلام عليكم {{recipient}}، الطرد ديالك {{tracking}} ({{city}}) ولات الحالة ديالو: {{status}}. المبلغ عند الاستلام: {{cod}} DH. التتبع المباشر: {{tracking_url}}';

export function normalizeWhatsAppPhone(phone?: string | null): string {
  const digits = String(phone || '').replace(/\D+/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }
  if (digits.startsWith('212') && digits.length >= 12) {
    return digits;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `212${digits.slice(1)}`;
  }
  if ((digits.startsWith('6') || digits.startsWith('7') || digits.startsWith('5')) && digits.length === 9) {
    return `212${digits}`;
  }
  return digits;
}

export function buildLiveTrackingUrl(trackingNumber: string, baseWebsite?: string): string {
  const cleanCode = String(trackingNumber || '').trim().toUpperCase();
  let origin = 'https://app.fariousy.com';
  if (typeof window !== 'undefined' && window.location?.origin && /^https?:\/\//i.test(window.location.origin)) {
    origin = window.location.origin;
  } else if (baseWebsite && /^https?:\/\//i.test(baseWebsite.trim())) {
    origin = baseWebsite.trim().replace(/\/+$/, '');
  }
  return `${origin}/?track=${encodeURIComponent(cleanCode)}`;
}

export function getRichStatusMeta(status: string, fallbackLabel?: string): {
  fr: string;
  ar: string;
  emoji: string;
  notifType: 'info' | 'success' | 'warning' | 'alert';
} {
  const s = String(status || '').toLowerCase();
  switch (s) {
    case 'nouveau':
    case 'attente_ramassage':
      return { fr: 'En attente de ramassage', ar: 'في انتظار الجمع', emoji: '📝', notifType: 'info' };
    case 'ramasse':
      return { fr: 'Ramassé', ar: 'تم الجمع (Ramassé)', emoji: '📦', notifType: 'info' };
    case 'en_stock':
    case 'en_transit':
    case 'arrive_agence':
      return {
        fr: PACKAGE_STATUS_CONFIG[s as PackageStatus]?.label || 'En transit / Agence',
        ar: s === 'en_transit' ? 'في الطريق بين المدن' : 'في الوكالة / المستودع',
        emoji: '🏢',
        notifType: 'info'
      };
    case 'en_cours_livraison':
      return { fr: 'En cours de livraison', ar: 'مع الموزع في طريق التوصيل (En cours)', emoji: '🚚', notifType: 'info' };
    case 'livre':
    case 'delivered':
      return { fr: 'Livré', ar: 'تم التسليم بنجاح (Livré)', emoji: '✅', notifType: 'success' };
    case 'reporte':
    case 'pas_de_reponse':
      return {
        fr: s === 'pas_de_reponse' ? 'Pas de réponse' : 'Reporté',
        ar: s === 'pas_de_reponse' ? 'لا يجيب' : 'مؤجل (Reporté)',
        emoji: '⏳',
        notifType: 'warning'
      };
    case 'probleme_livraison':
      return { fr: 'Problème livraison', ar: 'مشكل في التوصيل', emoji: '⚠️', notifType: 'alert' };
    case 'refuse':
    case 'annule':
      return {
        fr: s === 'refuse' ? 'Refusé' : 'Annulé',
        ar: s === 'refuse' ? 'مرفوض من الزبون' : 'ملغى',
        emoji: '❌',
        notifType: 'alert'
      };
    case 'en_retour':
    case 'retourne':
      return {
        fr: s === 'en_retour' ? 'En retour' : 'Retourné',
        ar: s === 'en_retour' ? 'في طريق الإرجاع (Retour)' : 'تم الإرجاع (Retourné)',
        emoji: '↩️',
        notifType: 'warning'
      };
    default:
      return {
        fr: fallbackLabel || PACKAGE_STATUS_CONFIG[s as PackageStatus]?.label || status,
        ar: fallbackLabel || status,
        emoji: '📦',
        notifType: 'info'
      };
  }
}

export function renderWhatsAppStatusMessage(
  template: string | undefined,
  params: {
    companyName?: string;
    trackingNumber: string;
    recipientName: string;
    status: string;
    statusLabel?: string;
    city?: string;
    codAmount?: number;
    driverName?: string;
    trackingUrl?: string;
  }
): string {
  const tpl = template && template.trim() ? template : DEFAULT_WHATSAPP_TEMPLATE;
  const meta = getRichStatusMeta(params.status, params.statusLabel);
  const trackingUrl = params.trackingUrl || buildLiveTrackingUrl(params.trackingNumber);
  const statusDisplay = `${meta.emoji} ${params.statusLabel || meta.fr}`;

  return tpl
    .replace(/\{\{company\}\}/g, params.companyName || 'FARIOUSY DELIVERY')
    .replace(/\{\{tracking\}\}/g, params.trackingNumber)
    .replace(/\{\{recipient\}\}/g, params.recipientName || 'الزبون')
    .replace(/\{\{status\}\}/g, statusDisplay)
    .replace(/\{\{status_ar\}\}/g, meta.ar)
    .replace(/\{\{city\}\}/g, params.city || 'Maroc')
    .replace(/\{\{cod\}\}/g, String(Number(params.codAmount || 0)))
    .replace(/\{\{driver\}\}/g, params.driverName || 'الموزع')
    .replace(/\{\{tracking_url\}\}/g, trackingUrl);
}

export function buildWhatsAppDirectLink(phone?: string | null, message?: string): string {
  const normalized = normalizeWhatsAppPhone(phone);
  const encodedText = encodeURIComponent(message || '');
  if (!normalized) {
    return `https://wa.me/?text=${encodedText}`;
  }
  return `https://wa.me/${normalized}?text=${encodedText}`;
}

export interface TrackingStage {
  id: 'created' | 'ramasse' | 'en_cours' | 'final';
  labelFr: string;
  labelAr: string;
  state: 'completed' | 'current' | 'upcoming' | 'issue';
}

export function getTrackingProgressStages(status: string): {
  stages: TrackingStage[];
  percent: number;
  isReturnOrIssue: boolean;
  isDelivered: boolean;
} {
  const s = String(status || '').toLowerCase();
  const isDelivered = s === 'livre' || s === 'delivered';
  const isReturn = s === 'en_retour' || s === 'retourne';
  const isIssue = s === 'refuse' || s === 'annule' || s === 'probleme_livraison' || s === 'reporte' || s === 'pas_de_reponse';
  const isReturnOrIssue = isReturn || isIssue;

  let stepIdx = 0;
  if (['ramasse', 'en_stock', 'en_transit', 'arrive_agence'].includes(s)) {
    stepIdx = 1;
  } else if (s === 'en_cours_livraison' || s === 'reporte' || s === 'pas_de_reponse' || s === 'probleme_livraison') {
    stepIdx = 2;
  } else if (isDelivered || isReturn || s === 'refuse' || s === 'annule') {
    stepIdx = 3;
  }

  const finalLabelFr = isReturn
    ? 'Retour'
    : s === 'refuse'
    ? 'Refusé'
    : s === 'annule'
    ? 'Annulé'
    : isIssue
    ? 'Incident'
    : 'Livré';

  const finalLabelAr = isReturn
    ? 'مرتجع (Retour)'
    : s === 'refuse'
    ? 'مرفوض'
    : s === 'annule'
    ? 'ملغى'
    : isIssue
    ? 'تأجيل / مشكل'
    : 'تم التسليم (Livré)';

  const stages: TrackingStage[] = [
    {
      id: 'created',
      labelFr: 'Enregistré',
      labelAr: 'تم التسجيل',
      state: stepIdx > 0 ? 'completed' : 'current'
    },
    {
      id: 'ramasse',
      labelFr: 'Ramassé',
      labelAr: 'تم الجمع',
      state: stepIdx > 1 ? 'completed' : stepIdx === 1 ? 'current' : 'upcoming'
    },
    {
      id: 'en_cours',
      labelFr: 'En cours',
      labelAr: 'في الطريق',
      state:
        stepIdx > 2
          ? 'completed'
          : stepIdx === 2
          ? isIssue
            ? 'issue'
            : 'current'
          : 'upcoming'
    },
    {
      id: 'final',
      labelFr: finalLabelFr,
      labelAr: finalLabelAr,
      state:
        stepIdx === 3
          ? isDelivered
            ? 'completed'
            : 'issue'
          : 'upcoming'
    }
  ];

  const percent = stepIdx === 0 ? 15 : stepIdx === 1 ? 45 : stepIdx === 2 ? 75 : 100;
  return { stages, percent, isReturnOrIssue, isDelivered };
}

export function triggerBrowserPushNotification(title: string, body: string, tag?: string): void {
  if (typeof window === 'undefined' || typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const notif = new Notification(title, {
      body,
      icon: '/fariousy-logo.jpeg',
      badge: '/pwa-192x192.png',
      tag: tag || `fariousy-${Date.now()}`
    });
    setTimeout(() => {
      try {
        notif.close();
      } catch {}
    }, 8000);
  } catch {
    // Ignore restricted environments (e.g. WebView without Web Notification API)
  }
}
