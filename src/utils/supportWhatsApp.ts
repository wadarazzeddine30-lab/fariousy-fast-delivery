import {
  Agency,
  CityTariff,
  CompanySettings,
  PACKAGE_STATUS_CONFIG,
  PackageItem,
  UserProfile
} from '../types';

export type SupportIssueCategory = 'retour' | 'pickup' | 'paiement' | 'autre';

export interface ResolvedSupportContact {
  whatsappRaw: string;
  whatsappDigits: string;
  agentName: string;
  teamLabel: string;
  regionLabel: string;
}

const normalize = (value?: string): string =>
  (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

export const normalizeWhatsAppDigits = (phone?: string): string => {
  if (!phone) return '';
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) {
    digits = digits.slice(1);
  }
  if (digits.startsWith('00')) {
    digits = digits.slice(2);
  }
  // Convert Moroccan local format 06.../07.../05... to 212...
  if (digits.startsWith('0') && digits.length === 10) {
    digits = '212' + digits.slice(1);
  }
  return digits.replace(/\D/g, '');
};

const isUsablePhone = (phone?: string): boolean => {
  return normalizeWhatsAppDigits(phone).length >= 9;
};

const REGION_HUB_FALLBACK_CITIES: Record<string, string[]> = {
  casablanca: ['casablanca', 'mohammedia', 'berrechid', 'settat', 'el jadida', 'bouskoura', 'dar bouazza'],
  rabat: ['rabat', 'sale', 'temara', 'kenitra', 'skhirat', 'khemisset'],
  tanger: ['tanger', 'tetouan', 'larache', 'al hoceima', 'chefchaouen', 'fnideq', 'martil', 'ouazzane'],
  marrakech: ['marrakech', 'safi', 'essaouira', 'beni mellal', 'ouarzazate', 'kelaat sraghna', 'benguerir'],
  laayoune: ['laayoune', 'layoune', 'dakhla', 'boujdour', 'smara', 'guelmim', 'tan tan', 'tarfaya', 'agadir', 'inezgane', 'tiznit']
};

export const resolveOrderSupportContact = (
  pkg: PackageItem,
  context: {
    cities: CityTariff[];
    agencies: Agency[];
    users: UserProfile[];
    companySettings: CompanySettings;
  }
): ResolvedSupportContact => {
  const { cities, agencies, users, companySettings } = context;
  const orderCityNorm = normalize(pkg.city);

  // Find matching city metadata & region
  const cityMeta = cities.find(c => normalize(c.name) === orderCityNorm);
  const regionName = cityMeta?.region || pkg.city || 'Réseau National';

  // 1. Explicit support WhatsApp configured directly on CityTariff
  if (cityMeta && isUsablePhone(cityMeta.supportWhatsapp)) {
    const raw = cityMeta.supportWhatsapp!;
    return {
      whatsappRaw: raw,
      whatsappDigits: normalizeWhatsAppDigits(raw),
      agentName: cityMeta.supportAgentName?.trim() || `Support ${cityMeta.name}`,
      teamLabel: `Support ${cityMeta.region || cityMeta.name}`,
      regionLabel: regionName
    };
  }

  // 2. Active employee / support agent assigned directly to this city or region
  const regionalEmployee = users.find(u => {
    if (!['employee', 'admin', 'super_admin'].includes(u.role)) return false;
    if (u.status === 'inactive' || u.accountStatus === 'suspendu') return false;
    const phone = u.whatsapp || u.phone;
    if (!isUsablePhone(phone)) return false;
    const userCity = normalize(u.city);
    if (!userCity) return false;
    if (userCity === orderCityNorm) return true;
    if (cityMeta?.region && normalize(cityMeta.region).includes(userCity)) return true;
    return false;
  });

  if (regionalEmployee) {
    const raw = regionalEmployee.whatsapp || regionalEmployee.phone;
    return {
      whatsappRaw: raw,
      whatsappDigits: normalizeWhatsAppDigits(raw),
      agentName: regionalEmployee.name,
      teamLabel: regionalEmployee.agencyName || `Support ${regionalEmployee.city || regionName}`,
      regionLabel: regionName
    };
  }

  // 3. Matching Agency / Hub by city, destination/current agency name, or regional coverage
  const activeAgencies = agencies.filter(a => a.active !== false);
  const exactAgency =
    activeAgencies.find(a => normalize(a.city) === orderCityNorm) ||
    activeAgencies.find(
      a =>
        (pkg.destinationAgency && normalize(a.name) === normalize(pkg.destinationAgency)) ||
        (pkg.currentAgency && normalize(a.name) === normalize(pkg.currentAgency))
    );

  const hubCityMatch = !exactAgency
    ? Object.entries(REGION_HUB_FALLBACK_CITIES).find(([, list]) =>
        list.some(item => orderCityNorm.includes(item) || item.includes(orderCityNorm))
      )?.[0]
    : undefined;

  const regionalAgency =
    exactAgency ||
    (hubCityMatch
      ? activeAgencies.find(a => normalize(a.city).includes(hubCityMatch))
      : undefined) ||
    activeAgencies.find(
      a =>
        cityMeta?.region &&
        (normalize(cityMeta.region).includes(normalize(a.city)) ||
          normalize(a.notes).includes(normalize(pkg.city)))
    );

  if (regionalAgency && isUsablePhone(regionalAgency.managerPhone || regionalAgency.phone)) {
    const raw = (regionalAgency.managerPhone || regionalAgency.phone)!;
    return {
      whatsappRaw: raw,
      whatsappDigits: normalizeWhatsAppDigits(raw),
      agentName: regionalAgency.managerName || `Responsable ${regionalAgency.city}`,
      teamLabel: regionalAgency.name,
      regionLabel: regionName
    };
  }

  // 4. Fallback to global company WhatsApp / phone
  const fallbackPhone = isUsablePhone(companySettings.whatsapp)
    ? companySettings.whatsapp
    : isUsablePhone(companySettings.phone)
    ? companySettings.phone
    : '+212661000001';

  return {
    whatsappRaw: fallbackPhone,
    whatsappDigits: normalizeWhatsAppDigits(fallbackPhone),
    agentName: 'Support Central FARIOUSY',
    teamLabel: companySettings.companyName || 'Support Central',
    regionLabel: regionName
  };
};

export const buildOrderSupportWhatsAppUrl = (
  pkg: PackageItem,
  category: SupportIssueCategory,
  contact: ResolvedSupportContact
): string => {
  const categoryTitles: Record<SupportIssueCategory, string> = {
    retour: 'Problème retour (Retour non reçu, en retard ou incomplet)',
    pickup: 'Problème colis ramassé ou pickup (Colis pas ramassé, ramassage manqué)',
    paiement: 'Problème de paiement (Paiement, facture ou montant reçu)',
    autre: 'Autre question sur ce colis'
  };

  const statusLabel = PACKAGE_STATUS_CONFIG[pkg.status]?.label || pkg.status;
  const shopLabel = pkg.clientCompany || pkg.clientName || 'Boutique';

  const lines = [
    `Bonjour ${contact.agentName} (${contact.teamLabel}),`,
    ``,
    `*Demande de support / Réclamation colis*`,
    `• *N° Suivi :* ${pkg.trackingNumber}`,
    `• *Boutique :* ${shopLabel}`,
    `• *Ville / Région :* ${pkg.city} (${contact.regionLabel})`,
    `• *Destinataire :* ${pkg.recipientName} (${pkg.recipientPhone})`,
    `• *Montant COD :* ${pkg.codAmount} DH`,
    `• *Statut actuel :* ${statusLabel}`,
    `• *Motif :* ${categoryTitles[category]}`,
    ``,
    `Merci de nous aider sur cette commande.`
  ];

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${contact.whatsappDigits}?text=${text}`;
};

export const hasValidRecipientWhatsApp = (phone?: string): boolean => {
  return isUsablePhone(phone);
};

export const isPendingConfirmationStatus = (status?: string): boolean => {
  return ['nouveau', 'attente_ramassage', 'pas_de_reponse', 'reporte'].includes(status || '');
};

export const buildRecipientConfirmationWhatsAppUrl = (
  pkg: PackageItem,
  companyName?: string
): string => {
  const digits = normalizeWhatsAppDigits(pkg.recipientPhone);
  if (digits.length < 9) return '#';

  const recipientName = pkg.recipientName?.trim() || 'زبوننا الكريم';
  const itemDesc = pkg.description?.trim() || 'طلبية';
  const senderBrand = companyName?.trim() || pkg.clientCompany || pkg.clientName || 'FARIOUSY';

  const lines = [
    `سلام عليكم ${recipientName} 📦`,
    `معكم خدمة التوصيل *${senderBrand}*`,
    `طلبكم رقم: *#${pkg.trackingNumber}*`,
    `المنتوج: ${itemDesc}`,
    `المدينة: ${pkg.city || '-'}`,
    `المبلغ: *${pkg.codAmount} درهم*`,
    ``,
    `واش باغي تأكد هاد الطلبية باش نوصلوها لك؟`,
    `✅ للتأكيد: *نعم* (Je confirme)`,
    `❌ للإلغاء: *لا* (J'annule)`
  ];

  const text = encodeURIComponent(lines.join('\n'));
  return `https://wa.me/${digits}?text=${text}`;
};

