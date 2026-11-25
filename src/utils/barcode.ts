/**
 * Pure SVG Barcode Generator (Code 128 / Code 39 style)
 * Clean, lightweight, zero dependencies, crisp vector print.
 */

// Simple pseudo-code 128 pattern generator for standard tracking numbers
export function generateBarcodeSVG(code: string, height = 48): string {
  const safeCode = String(code || '').slice(0, 128);
  const safeHeight = Number.isFinite(height) && height > 0 ? Math.min(Math.round(height), 300) : 48;
  const escapedCode = safeCode
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Use character ASCII codes to generate predictable bar widths
  let bars = '1101'; // start guard
  for (let i = 0; i < safeCode.length; i++) {
    const charCode = safeCode.charCodeAt(i);
    const pattern = (charCode * 7919) % 1024;
    const binary = pattern.toString(2).padStart(10, '0');
    // alternate 1 and 0
    bars += binary.replace(/00/g, '0').replace(/11/g, '110');
  }
  bars += '11011'; // stop guard

  let x = 10;
  let rects = '';
  const barWidth = 2;

  for (let i = 0; i < bars.length; i++) {
    if (bars[i] === '1') {
      rects += `<rect x="${x}" y="4" width="${barWidth}" height="${safeHeight}" fill="#111827" />`;
    }
    x += barWidth;
  }

  const totalWidth = x + 10;
  return `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${safeHeight + 22}" class="w-full max-w-xs h-auto">
      ${rects}
      <text x="${totalWidth / 2}" y="${safeHeight + 17}" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="600" fill="#111827" letter-spacing="1.5">
        ${escapedCode}
      </text>
    </svg>
  `;
}

function getStoredLang(lang?: string): string {
  if (lang) return lang;
  if (typeof window === 'undefined') return 'fr';
  try {
    return localStorage.getItem('fariousy_language') || 'fr';
  } catch {
    return 'fr';
  }
}

export function formatMAD(amount: number | string | undefined | null, lang?: string): string {
  const activeLang = getStoredLang(lang);
  const parsed = amount === undefined || amount === null || amount === '' ? 0 : Number(amount);
  const safeAmount = Number.isFinite(parsed) ? parsed : 0;
  const numStr = safeAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (activeLang === 'ar') {
    return `${numStr} د.م.`;
  }
  return `${numStr} MAD`;
}

export function formatDate(dateStr?: string | null, lang?: string): string {
  if (!dateStr) return '-';
  try {
    const activeLang = getStoredLang(lang);
    const locale = activeLang === 'ar' ? 'ar-MA' : activeLang === 'en' ? 'en-US' : 'fr-FR';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return String(dateStr);
  }
}

export function formatDateTime(dateStr?: string | null, lang?: string): string {
  if (!dateStr) return '-';
  try {
    const activeLang = getStoredLang(lang);
    const locale = activeLang === 'ar' ? 'ar-MA' : activeLang === 'en' ? 'en-US' : 'fr-FR';
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    return `${d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' })} ${d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return String(dateStr);
  }
}

export function getStatusLabel(status: string, lang?: string): string {
  const activeLang = getStoredLang(lang);

  const arStatus: Record<string, string> = {
    nouveau: 'طرد جديد',
    attente_ramassage: 'في انتظار الاستلام',
    ramasse: 'تم الاستلام من المتجر',
    en_stock: 'بالمستودع (الوكالة)',
    au_hub: 'بوكالة التوزيع',
    en_transit: 'قيد النقل بين المدن',
    arrive_destination: 'وصل إلى وجهته',
    en_cours_livraison: 'قيد التوصيل للزبون',
    livre: 'تم التسليم بنجاح',
    refuse: 'مرفوض من الزبون',
    reporte: 'تم تأجيل التسليم',
    retour_en_cours: 'قيد الإرجاع للمستودع',
    retourne: 'مرتجع للمرسل',
    annule: 'ملغى'
  };

  const enStatus: Record<string, string> = {
    nouveau: 'New Package',
    attente_ramassage: 'Awaiting Pickup',
    ramasse: 'Picked Up',
    en_stock: 'In Hub / Stock',
    au_hub: 'At Hub Agency',
    en_transit: 'In Transit',
    arrive_destination: 'Arrived at Destination',
    en_cours_livraison: 'Out for Delivery',
    livre: 'Delivered',
    refuse: 'Refused by Recipient',
    reporte: 'Postponed',
    retour_en_cours: 'Returning to Hub',
    retourne: 'Returned to Sender',
    annule: 'Cancelled'
  };

  const frStatus: Record<string, string> = {
    nouveau: 'Nouveau colis',
    attente_ramassage: 'Attente Ramassage',
    ramasse: 'Colis Ramassé',
    en_stock: 'En Stock (Agence)',
    au_hub: 'Au Hub Agence',
    en_transit: 'En Transit Inter-villes',
    arrive_destination: 'Arrivé à destination',
    en_cours_livraison: 'En Cours de Livraison',
    livre: 'Livré',
    refuse: 'Refusé',
    reporte: 'Reporté',
    retour_en_cours: 'Retour en cours',
    retourne: 'Retourné',
    annule: 'Annulé'
  };

  if (activeLang === 'ar') return arStatus[status] || status;
  if (activeLang === 'en') return enStatus[status] || status;
  return frStatus[status] || status;
}

export function getStatusBadgeColor(status: string): string {
  switch (status) {
    case 'livre':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'en_cours_livraison':
      return 'bg-amber-100 text-amber-900 border-amber-200';
    case 'en_transit':
    case 'au_hub':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'ramasse':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'attente_ramassage':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'retourne':
    case 'annule':
      return 'bg-rose-100 text-rose-800 border-rose-200';
    default:
      return 'bg-slate-100 text-slate-700 border-slate-200';
  }
}

