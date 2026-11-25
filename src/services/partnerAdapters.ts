import { PackageItem, PackageStatus, Partner, PartnerApiConfig } from '../types';

/**
 * Normalizes Moroccan phone number into 06/07 standard format or +212
 */
export function sanitizeMoroccanPhone(phone: string): string {
  if (!phone) return '';
  const cleaned = phone.replace(/[^0-9+]/g, '');
  if (cleaned.startsWith('+212')) {
    return '0' + cleaned.slice(4);
  }
  if (cleaned.startsWith('212')) {
    return '0' + cleaned.slice(3);
  }
  return cleaned;
}

/**
 * Masks sensitive keys / passwords so they never appear in plain text in logs or client-facing views
 */
export function maskSecret(secret?: string): string {
  if (!secret) return '';
  if (secret.length <= 6) return '••••••';
  return secret.slice(0, 3) + '••••••••' + secret.slice(-3);
}

/**
 * Standard mapping between Moroccan courier / Olivraison status codes and Fariousy statuses
 */
export const STATUS_MAPPING: Record<string, PackageStatus> = {
  // Common keywords & partner codes
  NEW: 'nouveau',
  CREATED: 'nouveau',
  ENREGISTRE: 'nouveau',
  DEPOT: 'en_stock',
  IN_STOCK: 'en_stock',
  HUB_RECEIVED: 'en_stock',
  EN_TRANSIT: 'en_transit',
  IN_TRANSIT: 'en_transit',
  TRANSIT: 'en_transit',
  ON_A_TRIP: 'en_transit',
  OUT_FOR_DELIVERY: 'en_cours_livraison',
  OUTFORDELIVERY: 'en_cours_livraison',
  EN_LIVRAISON: 'en_cours_livraison',
  EN_COURS_DE_LIVRAISON: 'en_cours_livraison',
  EXPEDIE: 'en_cours_livraison',
  TOURNEE: 'en_cours_livraison',
  DELIVERED: 'livre',
  LIVRE: 'livre',
  LIVRÉ: 'livre',
  DISTRIBUE: 'livre',
  ENCAISSE: 'livre',
  POSTPONED: 'reporte',
  SCHEDULED: 'reporte',
  RELANCED: 'reporte',
  REPORTE: 'reporte',
  REPORTÉ: 'reporte',
  CLIENT_ABSENT: 'pas_de_reponse',
  UNREACHABLE: 'pas_de_reponse',
  OUTOFREACH: 'pas_de_reponse',
  OUT_OF_REACH: 'pas_de_reponse',
  NOT_RESPONDED: 'pas_de_reponse',
  NO_RESPONSE_1: 'pas_de_reponse',
  NO_RESPONSE_2: 'pas_de_reponse',
  NO_RESPONSE_3: 'pas_de_reponse',
  NO_RESPONSE_4: 'pas_de_reponse',
  PAS_DE_REPONSE: 'pas_de_reponse',
  ABSENT: 'pas_de_reponse',
  CLIENT_INJOIGNABLE: 'pas_de_reponse',
  PRICE_PROBLEM: 'probleme_livraison',
  INCORRECT_PHONE: 'probleme_livraison',
  NOT_SERIOUS: 'refuse',
  LOST: 'refuse',
  DAMAGED: 'refuse',
  REFUSED: 'refuse',
  PARCEL_REFUSED: 'refuse',
  REFUSE: 'refuse',
  REFUSÉ: 'refuse',
  CANCELED: 'annule',
  CANCELLED: 'annule',
  ANNULE: 'annule',
  RETURNED: 'retourne',
  RETOURNE: 'retourne',
  RETOURNÉ: 'retourne',
  RETOUR_HUB: 'retour_en_cours'
};

export const OLIVRAISON_ALLOWED_STATES: { label: string; internal: PackageStatus; desc: string }[] = [
  { label: 'Out For Delivery', internal: 'en_cours_livraison', desc: 'En cours de livraison' },
  { label: 'Delivered', internal: 'livre', desc: 'Livré & encaissé' },
  { label: 'Not Serious', internal: 'refuse', desc: 'Client non sérieux' },
  { label: 'Price Problem', internal: 'probleme_livraison', desc: 'Problème de prix' },
  { label: 'Client Absent', internal: 'pas_de_reponse', desc: 'Client absent' },
  { label: 'Incorrect Phone', internal: 'probleme_livraison', desc: 'Numéro incorrect' },
  { label: 'Unreachable', internal: 'pas_de_reponse', desc: 'Injoignable' },
  { label: 'No Response 1', internal: 'pas_de_reponse', desc: 'Pas de réponse 1' },
  { label: 'No Response 2', internal: 'pas_de_reponse', desc: 'Pas de réponse 2' },
  { label: 'No Response 3', internal: 'pas_de_reponse', desc: 'Pas de réponse 3' },
  { label: 'No Response 4', internal: 'pas_de_reponse', desc: 'Pas de réponse 4' },
  { label: 'Postponed', internal: 'reporte', desc: 'Reporté' },
  { label: 'Lost', internal: 'refuse', desc: 'Colis perdu' },
  { label: 'Damaged', internal: 'refuse', desc: 'Colis endommagé' },
  { label: 'Refused', internal: 'refuse', desc: 'Refusé' },
  { label: 'Canceled', internal: 'annule', desc: 'Annulé' },
  { label: 'Scheduled', internal: 'reporte', desc: 'Programmé' },
  { label: 'On A Trip', internal: 'en_transit', desc: 'En déplacement / transit' },
  { label: 'Relanced', internal: 'reporte', desc: 'Relancé' }
];

export const OLIVRAISON_BASE_URL = 'https://partners.olivraison.com';

export function buildOlivraisonPresetConfig(overrides?: Partial<PartnerApiConfig>): PartnerApiConfig {
  return {
    enabled: true,
    baseUrl: OLIVRAISON_BASE_URL,
    authType: 'bearer',
    adapterType: 'olivraison',
    endpoints: {
      createShipment: '/api/v1/parcels',
      getTracking: '/api/v1/parcels',
      syncStatus: '/api/v1/parcels/state',
      webhookInbound: '/api/webhooks/olivraison'
    },
    autoSync: true,
    autoDispatch: true,
    syncFrequencyMinutes: 15,
    ...overrides
  };
}

/**
 * Normalize external partner status code into Fariousy PackageStatus
 */
export function normalizePartnerStatus(partnerRawStatus: string): PackageStatus {
  if (!partnerRawStatus) return 'en_cours_livraison';
  const clean = partnerRawStatus.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return STATUS_MAPPING[clean] || 'en_cours_livraison';
}

/**
 * Validate parcel payload before dispatching to partner API
 * Returns descriptive French validation message if invalid, or null if valid.
 */
export function validatePartnerShipmentPayload(partner: Partner, pkg: PackageItem): string | null {
  const adapter = partner.apiConfig?.adapterType;
  if (adapter === 'olivraison') {
    const content = (pkg.description || '').trim();
    if (content.length < 5) {
      return 'Le champ contenu du colis est trop court — le partenaire exige au moins 5 caractères';
    }
    if (!pkg.recipientName || !pkg.recipientPhone || !pkg.city) {
      return 'Informations destinataire incomplètes (nom, téléphone ou ville manquant).';
    }
  }
  return null;
}

/**
 * Extract JWT expiration ISO timestamp if API key is a JWT token
 */
export function extractTokenExpiryIso(token?: string): string | undefined {
  if (!token || typeof token !== 'string') return undefined;
  const parts = token.split('.');
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonStr =
      typeof Buffer !== 'undefined'
        ? Buffer.from(base64, 'base64').toString('utf8')
        : atob(base64);
    const parsed = JSON.parse(jsonStr);
    if (typeof parsed?.exp === 'number') {
      return new Date(parsed.exp * 1000).toISOString();
    }
  } catch {
    // Ignore non-JWT tokens (e.g. api-... opaque keys)
  }
  return undefined;
}

/**
 * Build request payload for dispatching packages to a partner API based on their adapter type
 */
export function buildPartnerShipmentPayload(
  partner: Partner,
  pkg: PackageItem
): { url: string; headers: Record<string, string>; body: any } {
  const config = partner.apiConfig;
  const baseUrl = config?.baseUrl || (config?.adapterType === 'olivraison' ? OLIVRAISON_BASE_URL : 'https://api.partner.ma');
  const endpoint = config?.endpoints.createShipment || (config?.adapterType === 'olivraison' ? '/api/v1/parcels' : '/shipments');
  const fullUrl = baseUrl.replace(/\/$/, '') + '/' + endpoint.replace(/^\//, '');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'Fariousy-Delivery-Logistics/2.5'
  };

  // Configure authentication headers
  if (config?.authType === 'bearer' && config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  } else if (config?.authType === 'api_key_header' && config.apiKey) {
    const headerName = config.headerName || 'X-API-KEY';
    headers[headerName] = config.apiKey;
  } else if (config?.authType === 'basic' && config.username) {
    const creds = Buffer.from(`${config.username}:${config.password || ''}`).toString('base64');
    headers['Authorization'] = `Basic ${creds}`;
  } else if (config?.adapterType === 'olivraison' && config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`;
  }

  let body: any = {};

  switch (config?.adapterType) {
    case 'olivraison':
      body = {
        ref: pkg.trackingNumber,
        tracking_number: pkg.trackingNumber,
        recipient_name: pkg.recipientName,
        recipient_phone: sanitizeMoroccanPhone(pkg.recipientPhone),
        recipient_phone_2: pkg.recipientPhone2 ? sanitizeMoroccanPhone(pkg.recipientPhone2) : undefined,
        city: pkg.city,
        address: pkg.address || pkg.city,
        price: Number(pkg.codAmount || 0),
        cod: Number(pkg.codAmount || 0),
        content: (pkg.description || '').trim(),
        description: (pkg.description || '').trim(),
        note: pkg.notes || '',
        allow_open: Boolean(pkg.allowOpen),
        can_try: Boolean(pkg.allowTry),
        fragile: Boolean(pkg.isFragile),
        exchange: Boolean(pkg.isExchange)
      };
      break;

    case 'amana_express':
      body = {
        referenceInterne: pkg.trackingNumber,
        expediteur: {
          nom: 'FARIOUSY DELIVERY SARL',
          contact: pkg.clientCompany || pkg.clientName,
          telephone: pkg.clientPhone,
          ville: 'Casablanca'
        },
        destinataire: {
          nom: pkg.recipientName,
          telephone: sanitizeMoroccanPhone(pkg.recipientPhone),
          telephoneSecondaire: pkg.recipientPhone2 ? sanitizeMoroccanPhone(pkg.recipientPhone2) : undefined,
          ville: pkg.city,
          adresseComplete: pkg.address
        },
        service: 'AMANA_NATIONAL_EXPRESS',
        modeLivraison: 'A_DOMICILE',
        contreRemboursement: {
          montantCRBT: pkg.codAmount,
          devise: 'MAD'
        },
        marchandise: {
          designation: pkg.description || 'Colis e-commerce',
          poidsEstimeKg: 1.0,
          instructionsLivreur: pkg.notes
        }
      };
      break;

    case 'chronopost_ctm':
      body = {
        shipmentHeader: {
          customerAccountNumber: 'FAR-9021',
          senderRef: pkg.trackingNumber,
          shipDate: new Date().toISOString().split('T')[0]
        },
        consignee: {
          companyName: pkg.recipientName,
          contactName: pkg.recipientName,
          addressLine1: pkg.address,
          city: pkg.city,
          countryCode: 'MA',
          phone: sanitizeMoroccanPhone(pkg.recipientPhone)
        },
        packages: [
          {
            weightKg: 1.0,
            description: pkg.description || 'Marchandise diverse',
            specialInstructions: pkg.notes
          }
        ],
        cod: {
          amount: pkg.codAmount,
          currency: 'MAD'
        }
      };
      break;

    case 'cathedis':
      body = {
        fariousyCode: pkg.trackingNumber,
        client: pkg.clientCompany || pkg.clientName,
        recipient: {
          name: pkg.recipientName,
          phone: sanitizeMoroccanPhone(pkg.recipientPhone),
          city: pkg.city,
          address: pkg.address
        },
        codAmount: pkg.codAmount,
        notes: pkg.notes,
        productName: pkg.description
      };
      break;

    case 'generic_rest':
    default:
      // Configurable or generic REST schema
      const mapping = config?.customMapping;
      body = {
        [mapping?.trackingKey || 'trackingNumber']: pkg.trackingNumber,
        [mapping?.recipientNameKey || 'recipientName']: pkg.recipientName,
        [mapping?.phoneKey || 'phone']: sanitizeMoroccanPhone(pkg.recipientPhone),
        [mapping?.cityKey || 'city']: pkg.city,
        [mapping?.addressKey || 'address']: pkg.address,
        [mapping?.codKey || 'codAmount']: pkg.codAmount,
        senderCompany: pkg.clientCompany || 'Fariousy Network',
        packageDescription: pkg.description || 'Colis',
        deliveryNotes: pkg.notes || ''
      };
      break;
  }

  return { url: fullUrl, headers, body };
}

/**
 * Parses partner API response after shipment creation to extract tracking and confirmation
 */
export function extractPartnerTrackingFromResponse(
  adapterType: string,
  responseBody: any,
  fallbackTracking: string
): { partnerTrackingNumber: string; shipmentId?: string; labelUrl?: string } {
  if (!responseBody || typeof responseBody !== 'object') {
    return { partnerTrackingNumber: fallbackTracking || `PRT-${Date.now().toString().slice(-6)}` };
  }

  // Olivraison Partners format
  if (adapterType === 'olivraison') {
    const dataObj = responseBody.data || responseBody.parcel || responseBody;
    const num =
      dataObj?.ref ||
      dataObj?.tracking ||
      dataObj?.tracking_number ||
      dataObj?.trackingNumber ||
      responseBody.ref ||
      responseBody.tracking ||
      responseBody.id ||
      fallbackTracking;
    return {
      partnerTrackingNumber: String(num),
      shipmentId: dataObj?.id ? String(dataObj.id) : undefined,
      labelUrl: dataObj?.label_url || dataObj?.labelUrl ? String(dataObj.label_url || dataObj.labelUrl) : undefined
    };
  }

  // Amana Express format
  if (adapterType === 'amana_express') {
    const num = responseBody.numeroSuiviAmana || responseBody.trackingNumber || responseBody.barcode;
    return {
      partnerTrackingNumber: num || `AMN-${Date.now().toString().slice(-6)}`,
      shipmentId: responseBody.idBordereau || responseBody.id,
      labelUrl: responseBody.bordereauUrl || responseBody.etiquetteUrl
    };
  }

  // Chronopost CTM format
  if (adapterType === 'chronopost_ctm') {
    const num = responseBody.skybillNumber || responseBody.trackingId || responseBody.shipmentId;
    return {
      partnerTrackingNumber: num || `CTM-${Date.now().toString().slice(-6)}`,
      shipmentId: responseBody.shipmentId,
      labelUrl: responseBody.labelUrl
    };
  }

  // Generic or other
  const detectedTracking =
    responseBody.trackingNumber ||
    responseBody.partnerTrackingNumber ||
    responseBody.tracking ||
    responseBody.ref ||
    responseBody.barcode ||
    responseBody.id ||
    `PRT-${Date.now().toString().slice(-6)}`;

  return {
    partnerTrackingNumber: String(detectedTracking),
    shipmentId: responseBody.shipmentId ? String(responseBody.shipmentId) : undefined,
    labelUrl: responseBody.labelUrl ? String(responseBody.labelUrl) : undefined
  };
}

/**
 * Parses inbound package payload received from partner via webhook or API
 */
export function parseInboundPackagePayload(
  payload: any,
  partner: Partner
): {
  isValid: boolean;
  error?: string;
  packageData?: Partial<PackageItem>;
} {
  if (!payload || typeof payload !== 'object') {
    return { isValid: false, error: 'Payload JSON manquant ou invalide.' };
  }

  // Look for recipient name across standard Moroccan/English keys
  const recipientName =
    payload.recipientName || payload.destinataire?.nom || payload.recipient || payload.nomDestinataire || payload.customerName;
  const recipientPhone =
    payload.recipientPhone ||
    payload.destinataire?.telephone ||
    payload.phone ||
    payload.telephone ||
    payload.tel;
  const city =
    payload.city || payload.destinataire?.ville || payload.ville || payload.destinationCity;
  const address =
    payload.address ||
    payload.destinataire?.adresseComplete ||
    payload.destinataire?.adresse ||
    payload.adresse;
  const codAmount = Number(
    payload.codAmount ??
      payload.contreRemboursement?.montantCRBT ??
      payload.cod ??
      payload.montant ??
      payload.amount ??
      0
  );
  const description =
    payload.description || payload.marchandise?.designation || payload.product || 'Colis reçu via Partenaire';
  const partnerTracking =
    payload.partnerTrackingNumber || payload.numeroSuivi || payload.trackingNumber || payload.reference;

  if (!recipientName) {
    return { isValid: false, error: 'Le champ nom du destinataire est requis.' };
  }
  if (!recipientPhone) {
    return { isValid: false, error: 'Le numéro de téléphone du destinataire est requis.' };
  }
  if (!city) {
    return { isValid: false, error: 'La ville de livraison est requise.' };
  }
  if (!address) {
    return { isValid: false, error: "L'adresse de livraison est requise." };
  }

  const generatedTracking = `FAR-INB-${Math.floor(1000 + Math.random() * 9000)}-${Date.now().toString().slice(-4)}`;

  return {
    isValid: true,
    packageData: {
      trackingNumber: generatedTracking,
      partnerTrackingNumber: partnerTracking || `PRT-${Date.now().toString().slice(-6)}`,
      partnerId: partner.id,
      partnerName: partner.name,
      clientId: 'usr-client-partner',
      clientName: partner.name,
      clientPhone: partner.phone,
      clientCompany: partner.name,
      recipientName: String(recipientName),
      recipientPhone: sanitizeMoroccanPhone(String(recipientPhone)),
      city: String(city),
      address: String(address),
      codAmount: isNaN(codAmount) ? 0 : codAmount,
      productPrice: isNaN(codAmount) ? 0 : codAmount,
      deliveryFee: 35,
      description: String(description),
      notes: payload.notes || `Reçu via API Partenaire ${partner.name}`,
      status: 'nouveau',
      currentAgency: `Hub ${city}`,
      isPaidToClient: false,
      isInboundFromPartner: true,
      partnerSyncStatus: 'synced',
      partnerLastSyncAt: new Date().toISOString()
    }
  };
}
