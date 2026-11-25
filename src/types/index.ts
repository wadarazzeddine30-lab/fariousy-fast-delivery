export type UserRole = 'super_admin' | 'admin' | 'employee' | 'driver' | 'client' | 'partner';

export type PackageStatus =
  | 'nouveau'
  | 'attente_ramassage'
  | 'ramasse'
  | 'en_stock'
  | 'en_transit'
  | 'arrive_destination'
  | 'en_cours_livraison'
  | 'livre'
  | 'pas_de_reponse'
  | 'probleme_livraison'
  | 'reporte'
  | 'refuse'
  | 'retour_en_cours'
  | 'retourne'
  | 'annule';

export interface StatusMeta {
  code: PackageStatus;
  label: string;
  step: number;
  badgeClass: string;
  dotColor: string;
  category: 'preparation' | 'transit' | 'delivery' | 'delivered' | 'issue' | 'return';
}

export const PACKAGE_STATUS_CONFIG: Record<PackageStatus, StatusMeta> = {
  nouveau: {
    code: 'nouveau',
    label: 'Nouveau colis',
    step: 1,
    badgeClass: 'bg-slate-100 text-slate-700 border border-slate-200',
    dotColor: '#64748b',
    category: 'preparation'
  },
  attente_ramassage: {
    code: 'attente_ramassage',
    label: 'En attente de ramassage',
    step: 2,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotColor: '#d97706',
    category: 'preparation'
  },
  ramasse: {
    code: 'ramasse',
    label: 'Ramassé',
    step: 3,
    badgeClass: 'bg-blue-50 text-blue-700 border border-blue-200',
    dotColor: '#2563eb',
    category: 'preparation'
  },
  en_stock: {
    code: 'en_stock',
    label: 'En stock (Agence)',
    step: 4,
    badgeClass: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    dotColor: '#4f46e5',
    category: 'transit'
  },
  en_transit: {
    code: 'en_transit',
    label: 'En transit inter-villes',
    step: 5,
    badgeClass: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
    dotColor: '#0891b2',
    category: 'transit'
  },
  arrive_destination: {
    code: 'arrive_destination',
    label: 'Arrivé à destination',
    step: 6,
    badgeClass: 'bg-sky-50 text-sky-700 border border-sky-200',
    dotColor: '#0284c7',
    category: 'transit'
  },
  en_cours_livraison: {
    code: 'en_cours_livraison',
    label: 'En cours de livraison',
    step: 7,
    badgeClass: 'bg-orange-50 text-orange-700 border border-orange-200',
    dotColor: '#ea580c',
    category: 'delivery'
  },
  livre: {
    code: 'livre',
    label: 'Livré',
    step: 8,
    badgeClass: 'bg-emerald-50 text-emerald-800 border border-emerald-200',
    dotColor: '#16a34a',
    category: 'delivered'
  },
  pas_de_reponse: {
    code: 'pas_de_reponse',
    label: 'Pas de réponse',
    step: 9,
    badgeClass: 'bg-amber-50 text-amber-800 border border-amber-200',
    dotColor: '#d97706',
    category: 'issue'
  },
  probleme_livraison: {
    code: 'probleme_livraison',
    label: 'Problème de livraison (مشكلة)',
    step: 9,
    badgeClass: 'bg-red-100 text-red-800 border border-red-300',
    dotColor: '#dc2626',
    category: 'issue'
  },
  reporte: {
    code: 'reporte',
    label: 'Livraison reportée',
    step: 9,
    badgeClass: 'bg-yellow-50 text-yellow-800 border border-yellow-200',
    dotColor: '#ca8a04',
    category: 'issue'
  },
  refuse: {
    code: 'refuse',
    label: 'Refusé par destinataire',
    step: 10,
    badgeClass: 'bg-rose-50 text-rose-700 border border-rose-200',
    dotColor: '#e11d48',
    category: 'issue'
  },
  retour_en_cours: {
    code: 'retour_en_cours',
    label: 'Retour en cours',
    step: 11,
    badgeClass: 'bg-purple-50 text-purple-700 border border-purple-200',
    dotColor: '#9333ea',
    category: 'return'
  },
  retourne: {
    code: 'retourne',
    label: 'Retourné au client',
    step: 12,
    badgeClass: 'bg-red-50 text-red-700 border border-red-200',
    dotColor: '#dc2626',
    category: 'return'
  },
  annule: {
    code: 'annule',
    label: 'Annulé',
    step: 13,
    badgeClass: 'bg-neutral-100 text-neutral-600 border border-neutral-300',
    dotColor: '#525252',
    category: 'issue'
  }
};

export interface PackageHistoryItem {
  id: string;
  timestamp: string;
  status: PackageStatus;
  statusLabel: string;
  updatedBy: string;
  role: UserRole;
  location: string;
  comment: string;
  photoUrl?: string;
}

export interface PackageProblemReport {
  id: string;
  category: string;
  categoryLabel: string;
  description: string;
  photoBase64?: string;
  reportedBy: string;
  reportedById?: string;
  reportedAt: string;
  resolved?: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  adminNote?: string;
}

export interface SavedAddress {
  id: string;
  ownerId: string;
  label: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhone2?: string;
  city: string;
  zone?: string;
  address: string;
  notes?: string;
  usageCount?: number;
  createdAt: string;
  lastUsedAt?: string;
}

export interface PackageItem {
  id: string;
  trackingNumber: string;
  shopId?: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientCompany: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhone2?: string;
  city: string;
  address: string;
  productPrice: number; // Montant du produit
  deliveryFee: number; // Frais de livraison FARIOUSY
  codAmount: number; // Montant total à encaisser auprès du client destinataire (souvent productPrice)
  description: string;
  notes?: string;
  status: PackageStatus;
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverComment?: string;
  callProofUrl?: string;
  partnerId?: string;
  partnerName?: string;
  partnerTrackingNumber?: string;
  partnerShipmentId?: string;
  partnerLabelUrl?: string;
  partnerSyncStatus?: 'none' | 'pending' | 'synced' | 'failed';
  partnerLastSyncAt?: string;
  isInboundFromPartner?: boolean;
  isTransferredToPartner?: boolean;
  partnerTrackingId?: string;
  currentAgency: string;
  destinationAgency?: string;
  isPaidToClient: boolean;
  clientPaymentId?: string;
  returnReason?: string;
  lastMovedAt: string;
  createdAt: string;
  history: PackageHistoryItem[];

  // Options de livraison à la réception (فتح الطرد / القياس / الاستبدال / قابل للكسر)
  allowOpen?: boolean;
  allowTry?: boolean;
  isFragile?: boolean;

  // Colis d'échange (استبدال طرد غير مرغوب فيه)
  isExchange?: boolean;
  exchangeTrackingNumber?: string;
  exchangeReason?: string;
  exchangeItemDescription?: string;

  // Emplacement Stock (ربط الطرد بالسطوك في المستودع)
  stockLocationId?: string;
  stockPosition?: string;

  // Comptabilité et Tarification Partenaire (شحال حاسب التوصيل والمحاسبة)
  partnerDeliveryFee?: number;
  partnerSettled?: boolean;
  deliveredBy?: 'partner' | 'admin';

  // Signalement de problème de livraison avec photo (مشكلة في التوصيل)
  problemReport?: PackageProblemReport;

  // Confirmation client (مركز التأكيد وتتبع أداء العمال)
  confirmationStatus?: 'en_attente' | 'confirme' | 'pas_de_reponse' | 'reporte' | 'annule' | 'injoignable';
  confirmationAttempts?: number;
  confirmedById?: string;
  confirmedByName?: string;
  confirmedAt?: string;
  confirmationNote?: string;
  confirmationChannel?: 'whatsapp' | 'appel' | 'sms' | 'manuel';
  lastConfirmationAttemptAt?: string;
}

export type AccountStatus = 'en_attente' | 'approuve' | 'refuse' | 'suspendu';

export interface UserPermissions {
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
  modules: string[]; // 'clients' | 'packages' | 'drivers' | 'employees' | 'partners' | 'cities' | 'stock' | 'finance' | 'settings' | 'logs'
}

export interface UserProfile {
  id: string;
  shopId?: string;
  name: string;
  email: string;
  role: UserRole;
  phone: string;
  whatsapp?: string;
  companyName?: string; // Nom de la boutique
  city?: string;
  address?: string; // Adresse complète de ramassage
  activityType?: string; // Type d'activité commerciale
  bankName?: string; // Nom de la banque (ex: Attijariwafa bank)
  bankRib?: string; // RIB bancaire (24 chiffres)
  cinNumber?: string; // Numéro CIN pour les livreurs et marchands
  cinPhotoUrl?: string; // Photo CIN (Recto / الواجهة الأمامية)
  cinBackPhotoUrl?: string; // Photo CIN (Verso / الواجهة الخلفية)
  driverPhotoUrl?: string; // Photo personnelle du livreur (الصورة الشخصية)
  avatarUrl?: string; // Photo de profil / avatar
  status: AccountStatus | 'active' | 'inactive' | 'pending';
  accountStatus?: AccountStatus;
  statusReason?: string; // Motif de refus ou de suspension
  agencyId?: string;
  agencyName?: string;
  customRates?: Record<string, number>; // city -> rate
  approvedAt?: string;
  approvedBy?: string;
  driverPlate?: string;
  driverVehicle?: string;
  vehicleType?: DriverVehicleType;
  // Driver Remuneration & Revenue Configuration
  driverFeePerDelivery?: number; // Commission par colis livré en MAD (défaut: 10 MAD)
  driverFixedSalary?: number; // Forfait ou salaire fixe journalier ou mensuel en MAD
  driverSalaryType?: 'per_package' | 'fixed_plus_package' | 'monthly_fixed'; // Mode de calcul du revenu
  driverPickupFee?: number; // Prime par ramassage effectué en MAD (défaut: 5 MAD)
  driverBonusThreshold?: number; // Seuil bonus de colis livrés
  driverBonusAmount?: number; // Montant du bonus en MAD
  permissions?: string[];
  granularPermissions?: UserPermissions;
  employeeRole?: EmployeeSubRole;
  assignedCities?: string[]; // Villes assignées (Responsable villes / Support)
  dailyTargetConfirmations?: number;
  password?: string;
  registeredAt: string;
}

export type EmployeeSubRole =
  | 'support'
  | 'responsable_villes'
  | 'confirmatrice'
  | 'agent_hub'
  | 'superviseur'
  | 'polyvalent';

export type DriverVehicleType = 'Moto' | 'Voiture' | 'Vélo' | 'Fourgonnette' | 'Autre';

export interface DriverRegistrationRequest {
  id: string;
  fullName: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  cinNumber: string;
  cinPhotoUrl?: string; // Photo CIN (Recto / الواجهة الأمامية)
  cinBackPhotoUrl?: string; // Photo CIN (Verso / الواجهة الخلفية)
  driverPhotoUrl?: string; // Photo personnelle du livreur (الصورة الشخصية)
  vehicleType: DriverVehicleType;
  driverPlate?: string;
  status: 'en_attente' | 'approuve' | 'refuse';
  rejectionReason?: string;
  submittedAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  password?: string;
  notes?: string;
}

export interface CityTariff {
  id: string;
  name: string;
  region: string;
  defaultFee: number;
  returnFee: number;
  deliveryDelayHours: number;
  active: boolean;
  supportWhatsapp?: string;
  supportAgentName?: string;
}

export interface PickupRequest {
  id: string;
  trackingId: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  clientCompany: string;
  address: string;
  city: string;
  packageCount: number;
  requestedDate: string;
  timeSlot: 'matin' | 'apres_midi' | 'urgent';
  notes?: string;
  status: 'en_attente' | 'acceptee' | 'affectee' | 'terminee' | 'refusee';
  driverId?: string;
  driverName?: string;
  rejectionReason?: string;
  createdAt: string;
  completedAt?: string;
}

export type AgencyType = 'hub_principal' | 'agence_regionale' | 'centre_tri' | 'point_relais';

export interface Agency {
  id: string;
  name: string;
  city: string;
  address: string;
  phone: string;
  email?: string;
  managerName: string;
  managerPhone?: string;
  managerEmail?: string;
  managerId?: string;
  type?: AgencyType;
  active?: boolean;
  storageCapacity?: number;
  notes?: string;
  createdAt?: string;
}

export type PartnerAuthType = 'bearer' | 'api_key_header' | 'basic' | 'custom_header' | 'none';
export type PartnerApiAdapterType = 'olivraison' | 'generic_rest' | 'amana_express' | 'chronopost_ctm' | 'cathedis' | 'custom_adapter';

export interface PartnerFailedTransmission {
  id: string;
  packageId?: string;
  trackingNumber: string;
  message: string;
  timestamp: string;
}

export interface PartnerApiConfig {
  enabled: boolean;
  baseUrl: string;
  authType: PartnerAuthType;
  apiKey?: string; // Stored masked on client, proxy sent on server
  apiSecret?: string;
  headerName?: string; // e.g. 'X-API-KEY' or 'apikey' or 'Authorization'
  username?: string;
  password?: string;
  adapterType: PartnerApiAdapterType;
  endpoints: {
    createShipment: string; // e.g. '/api/v1/parcels' or '/shipments'
    getTracking: string; // e.g. '/api/v1/parcels/:tracking'
    syncStatus: string; // e.g. '/api/v1/parcels/state'
    webhookInbound?: string; // Endpoint identifier for inbound packages
  };
  webhookSecret?: string; // Secret / Bearer token for verifying inbound webhooks
  syncFrequencyMinutes?: number;
  autoSync: boolean;
  autoDispatch?: boolean;
  tokenExpiresAt?: string;
  lastWebhookAt?: string;
  createdParcelsCount?: number;
  failedTransmissions?: PartnerFailedTransmission[];
  lastTestedAt?: string;
  lastTestStatus?: 'success' | 'error';
  lastTestMessage?: string;
  lastTestLatencyMs?: number;
  lastSyncedAt?: string;
  customMapping?: {
    trackingKey?: string;
    recipientNameKey?: string;
    phoneKey?: string;
    cityKey?: string;
    addressKey?: string;
    codKey?: string;
  };
}

export interface PartnerSettlement {
  id: string;
  date: string;
  amount: number;
  packageCount?: number;
  type?: 'gains' | 'versement';
  reference?: string;
  paymentMethod: 'virement' | 'especes' | 'cheque' | 'autre';
  notes?: string;
  registeredBy?: string;
}

export interface PartnerApiToken {
  id: string;
  name: string;
  token: string;
  createdAt: string;
  lastUsedAt?: string;
}

export interface Partner {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  address?: string;
  website?: string;
  logoUrl?: string;
  registeredAt?: string;
  active: boolean;
  notes?: string;
  // Tarification et Comptabilité Partenaire (بشحال حاسب التوصيل والمحاسبة)
  deliveryFee?: number; // Tarif de livraison par défaut convenu par colis (MAD) - بشحال حاسب ليا التوصيل
  returnFee?: number; // Tarif de retour convenu par colis (MAD)
  cityTariffs?: Record<string, number>; // المدن المغطاة + ثمن التوصيل الخاص بكل مدينة (DH)
  settlements?: PartnerSettlement[]; // Versements & règlements reçus du partenaire
  // Partner API Integration
  apiConfig?: PartnerApiConfig;
  webhookUrl?: string;
  webhookToken?: string;
  apiTokens?: PartnerApiToken[];
  totalSent?: number;
  totalReceived?: number;
  totalDelivered?: number;
  totalReturned?: number;
  totalPending?: number;
  errorCount?: number;
}

export interface PartnerSyncLog {
  id: string;
  timestamp: string;
  partnerId: string;
  partnerName: string;
  direction: 'outbound_send' | 'inbound_receive' | 'status_sync' | 'webhook_received' | 'connection_test';
  status: 'success' | 'error' | 'warning';
  statusCode?: number;
  endpoint: string;
  message: string;
  packageCount?: number;
  trackingNumbers?: string[];
  requestPayloadPreview?: string;
  responsePayloadPreview?: string;
  errorDetails?: string;
  durationMs?: number;
}

export interface ClientPayment {
  id: string;
  reference: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  date: string;
  packageCount: number;
  totalCollected: number; // Somme des COD encaissés
  totalDeliveryFees: number; // Somme des frais de livraison déduits
  packagingFees?: number; // ثمن التغليف (لومبلاج) المقتطع
  extraDeductions?: number; // أي مصاريف إضافية / ديون أخرى مقتطعة
  deductionNotes?: string; // تفاصيل الاقتطاعات
  settledDebtIds?: string[]; // معرفات الديون والمصاريف المصفاة ضمن هذا التحويل
  netAmount: number; // totalCollected - totalDeliveryFees - (packagingFees || 0) - (extraDeductions || 0)
  status: 'paye' | 'en_attente' | 'annule';
  paymentMethod: 'Virement bancaire' | 'Espèces' | 'Chèque' | 'Versement';
  notes?: string;
  packageIds: string[];
  receiptImageUrl?: string; // صورة التحويل البنكي المرفقة
  receiptFileName?: string;
  receiptUploadedAt?: string;
}

export interface BankTransferReceipt {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany: string;
  clientPhone?: string;
  clientBankName?: string;
  clientBankRib?: string;
  paymentId?: string;
  reference: string;
  amount: number;
  transferDate: string;
  bankName?: string;
  notes?: string;
  imageUrl: string;
  fileName?: string;
  uploadedBy?: string;
  createdAt: string;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  timestamp: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  read: boolean;
  targetRole?: UserRole;
  targetClientId?: string;
}

export type NotificationAudienceScope =
  | 'all'
  | 'clients'
  | 'drivers'
  | 'employees'
  | 'user';

export interface UserNotificationMessage {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'alert';
  createdAt: string;
  senderId?: string;
  senderName: string;
  senderRole: UserRole;
  targetScope: NotificationAudienceScope;
  targetRole?: UserRole;
  targetUserId?: string;
  targetUserEmail?: string;
  targetUserName?: string;
  readByUserIds: string[];
  deletedByUserIds: string[];
  isRead?: boolean;
  readCount?: number;
}

export interface AuditLogItem {
  id: string;
  userId?: string;
  userName?: string;
  userRole?: UserRole;
  action?: string;
  actionType?: 'CREATE' | 'UPDATE' | 'DELETE' | 'CANCEL' | 'ARCHIVE' | 'APPROVE' | 'REJECT' | 'STATUS_CHANGE';
  entity?: string;
  module?: 'clients' | 'packages' | 'drivers' | 'employees' | 'partners' | 'cities' | 'agencies' | 'stock' | 'finance' | 'settings' | 'roles' | 'vehicles';
  entityId?: string;
  entityLabel?: string;
  timestamp: string;
  oldValue?: string;
  newValue?: string;
  details?: string;
}

export interface CompanySettings {
  companyName: string;
  brandTagline: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  facebookUrl?: string;
  instagramUrl?: string;
  address: string;
  rc: string;
  patente: string;
  ifNumber: string;
  ice: string;
  defaultReturnFee: number;
  defaultDeliveryFee: number;
  deliveryDelayHours: number;
  defaultDeliveryDelay?: string;
  autoSmsNotice?: boolean;
  autoWhatsappNotice?: boolean;
  enableSmsNotifications?: boolean;
  enableWhatsappAlerts?: boolean;
  enableAutoClientNotifications?: boolean;
  whatsappProvider?: 'webhook' | 'meta_cloud';
  whatsappPhoneNumberId?: string;
  whatsappWebhookUrl?: string;
  whatsappApiToken?: string;
  whatsappNotifyTarget?: 'recipient' | 'merchant' | 'both';
  whatsappNotifyStatuses?: string[];
  whatsappCustomTemplate?: string;
}

export interface StockLocationItem {
  id: string;
  trackingNumber: string;
  packageId: string;
  hubName: string;
  zone: string;
  shelf: string;
  bin: string;
  status: 'en_stock' | 'en_preparation' | 'en_transit' | 'sorti';
  
  // Liaison Client & Expéditeur (ربط السطوك بالزبون)
  clientId?: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  
  // Détails colis lié (ربط السطوك بالطرود)
  recipientName?: string;
  destinationCity?: string;
  codAmount?: number;
  isExchange?: boolean;

  enteredAt?: string;
  lastAuditedAt?: string;
  lastMovedAt?: string;
  notes?: string;
}

export interface ClientDebtItem {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  packageId?: string;
  trackingNumber?: string;
  debtType?: 'emballage' | 'frais_supplementaires' | 'frais_retour' | 'avance_fonds' | 'regularisation' | 'frais_livraison_impayes';
  reason?: string;
  quantity?: number;
  unitPrice?: number;
  amount: number;
  isSettled?: boolean;
  status?: 'en_attente' | 'regle';
  settledAt?: string;
  paymentId?: string;
  notes?: string;
  createdAt: string;
}

export type ClientMessageCategory =
  | 'reclamation_colis'
  | 'retard_livraison'
  | 'changement_adresse'
  | 'ramassage'
  | 'facturation_cod'
  | 'autre';

export type ClientMessagePriority = 'faible' | 'normale' | 'urgente';

export type ClientMessageStatus = 'nouveau' | 'en_cours' | 'resolu' | 'ferme';

export interface ClientMessageReply {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: 'client' | 'admin' | 'employee' | 'support';
  message: string;
  createdAt: string;
}

export interface ClientMessage {
  id: string;
  clientId: string;
  clientName: string;
  clientCompany?: string;
  clientPhone?: string;
  clientEmail?: string;
  category: ClientMessageCategory;
  priority: ClientMessagePriority;
  status: ClientMessageStatus;
  subject: string;
  message: string;
  packageTrackingNumber?: string;
  packageId?: string;
  createdAt: string;
  updatedAt: string;
  replies: ClientMessageReply[];
  resolvedAt?: string;
  resolvedBy?: string;
}

export type BonType = 'delivery' | 'client';

export type BonStatus = 'en_attente' | 'en_cours' | 'valide' | 'termine' | 'annule';

export interface BonItem {
  id: string; // e.g. "bon-123456"
  bonNumber: string; // e.g. "BDL-2026-0001" or "BC-2026-0001"
  type: BonType; // 'delivery' | 'client'
  date: string; // YYYY-MM-DD
  createdAt: string;
  status: BonStatus;
  
  // For Bon Delivery (Livreur / Distribution):
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  driverVehicle?: string;
  city?: string;
  agency?: string;
  
  // For Bon Client (Ramassage / Dépôt):
  clientId?: string;
  clientName?: string;
  clientCompany?: string;
  clientPhone?: string;
  
  // Packages included in this Bon:
  packageIds: string[];
  totalPackages: number;
  totalCodAmount: number;
  
  // Real-time delivery progress (for Bon Delivery):
  deliveredCount?: number;
  noAnswerCount?: number;
  postponedCount?: number;
  refusedCount?: number;
  totalCollectedAmount?: number;
  
  notes?: string;
  createdByName: string;
  createdByRole: string;
  closedAt?: string;
  closedBy?: string;
}

// ================= VEHICLE & FLEET TYPES (المركبات والتتبع) =================
export type VehicleOwnership = 'societe' | 'prive' | 'loue' | 'leasing';

export type VehicleStatus = 'actif' | 'en_tournee' | 'maintenance' | 'hors_service';

export interface VehicleTrackingTelemetry {
  latitude: number;
  longitude: number;
  locationName: string;
  speedKmH: number;
  heading: string;
  ignition: boolean;
  status: 'en_mouvement' | 'a_l_arret' | 'au_hub' | 'en_livraison';
  lastUpdated: string;
  batteryLevel?: number;
  odometerKm?: number;
  fuelLevelPercent?: number;
}

export interface Vehicle {
  id: string; // e.g. "veh-1"
  plateNumber: string; // e.g. "66-B66220"
  plateImage?: string; // photo ou scan de la plaque
  brand: string; // e.g. "Fizz", "Dacia", "Peugeot", "Toyota"
  model: string; // e.g. "Sanya", "Dokker", "Partner", "Hilux"
  year: number | string; // e.g. 2021, 2024
  color?: string; // e.g. "Blanc", "Noir", "Gris"
  ownership: VehicleOwnership; // 'societe' | 'prive' | 'loue' | 'leasing'
  status: VehicleStatus; // 'actif' | 'en_tournee' | 'maintenance' | 'hors_service'
  capacity?: string; // e.g. "500 kg", "25 colis"
  vehicleType: string; // "Moto", "Fourgonnette", "Voiture", "Camion"
  
  // Operational assignments & tracking
  driverId?: string;
  driverName?: string;
  driverPhone?: string;
  hubId?: string;
  city?: string;
  
  // Technical specs & maintenance
  currentMileage?: number; // en km
  fuelType?: 'diesel' | 'essence' | 'electrique' | 'hybride';
  fuelLevel?: number; // en % (0-100)
  lastVidangeMileage?: number;
  nextVidangeMileage?: number;
  insuranceExpiry?: string; // YYYY-MM-DD
  technicalVisitExpiry?: string; // YYYY-MM-DD
  vignetteExpiry?: string; // YYYY-MM-DD
  
  // Real-time GPS Tracking
  tracking?: VehicleTrackingTelemetry;
  
  notes?: string;
  createdAt: string;
}

// ================= CUSTOMER & DRIVER REVIEWS (آراء الزبائن فالشركة والليفرورز) =================
export type ReviewTargetType = 'company' | 'driver';

export interface CustomerReview {
  id: string;
  targetType: ReviewTargetType;
  rating: number; // 1..5
  comment: string;
  authorName: string;
  authorRole?: 'client' | 'destinataire' | 'visiteur';
  authorCity?: string;
  authorPhone?: string;
  driverId?: string;
  driverName?: string;
  trackingNumber?: string;
  isPublic: boolean;
  adminReply?: string;
  createdAt: string;
}

// ================= CLIENT FULFILLMENT STOCK (السطوك عند الزبون بالأكواد والفواتير) =================
export type ClientStockUnitStatus = 'en_attente' | 'en_stock' | 'expedie' | 'retourne';

export interface ClientStockUnit {
  id: string;
  unitCode: string; // Ex: FSU-261114-AB12-001
  productId: string;
  clientId: string;
  status: ClientStockUnitStatus;
  hubName?: string;
  zone?: string;
  shelf?: string;
  bin?: string;
  scannedAt?: string;
  scannedBy?: string;
  packageId?: string;
  packageTrackingNumber?: string;
  invoiceId?: string;
  dispatchedAt?: string;
  createdAt: string;
}

export interface ClientStockProduct {
  id: string;
  clientId: string;
  clientName?: string;
  clientCompany?: string;
  skuCode: string; // Ex: SKU-261114-AB12
  name: string;
  photoUrl?: string;
  category?: string;
  unitPrice: number;
  hubName?: string;
  initialQuantity: number;
  units: ClientStockUnit[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientStockMovement {
  id: string;
  productId: string;
  productName: string;
  clientId: string;
  type: 'entree_creation' | 'scan_stock' | 'sortie_colis' | 'ajout_quantite' | 'retour_stock';
  quantity: number;
  unitCodes: string[];
  packageId?: string;
  packageTrackingNumber?: string;
  invoiceId?: string;
  actorName?: string;
  notes?: string;
  createdAt: string;
}

export interface ClientStockInvoiceItem {
  productId: string;
  productName: string;
  photoUrl?: string;
  skuCode: string;
  quantity: number;
  unitPrice: number;
  unitCodes: string[];
  subtotal: number;
}

export interface ClientStockInvoice {
  id: string;
  invoiceNumber: string; // Ex: FAC-STK-2611-0001
  clientId: string;
  clientName: string;
  clientCompany?: string;
  clientPhone?: string;
  packageId: string;
  trackingNumber: string;
  recipientName: string;
  recipientCity: string;
  items: ClientStockInvoiceItem[];
  totalQuantity: number;
  productsValue: number;
  deliveryFee: number;
  totalCodAmount: number;
  status: 'generee' | 'payee';
  createdAt: string;
}

export interface WhatsappDispatchLog {
  id: string;
  packageId: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  merchantPhone?: string;
  status: string;
  statusLabel: string;
  message: string;
  provider?: 'webhook' | 'meta_cloud' | 'direct_link';
  targetAudience?: 'recipient' | 'merchant' | 'both';
  trackingUrl?: string;
  whatsappDirectUrl?: string;
  webhookConfigured: boolean;
  deliveryState: 'sent' | 'failed' | 'not_configured';
  httpStatus?: number;
  error?: string;
  createdAt: string;
}

export type SmartAlertCategory =
  | 'stalled_package'
  | 'return_alert'
  | 'unsettled_debt'
  | 'unscanned_stock';

export interface SmartAlertItem {
  id: string;
  category: SmartAlertCategory;
  severity: 'critical' | 'warning';
  title: string;
  description: string;
  meta: string;
  packageItem?: PackageItem;
  productId?: string;
  debtId?: string;
  hoursElapsed?: number;
  amountMad?: number;
}

// ================= CONFIRMATION CENTER & STAFF CONTROL (مركز التأكيد ومراقبة العمال) =================
export type ConfirmationOutcome =
  | 'confirme'
  | 'pas_de_reponse'
  | 'reporte'
  | 'annule'
  | 'injoignable'
  | 'whatsapp_sent';

export interface ConfirmationActionLog {
  id: string;
  packageId: string;
  trackingNumber: string;
  recipientName: string;
  recipientPhone: string;
  city: string;
  codAmount: number;
  employeeId: string;
  employeeName: string;
  employeeRole: string;
  outcome: ConfirmationOutcome;
  channel: 'whatsapp' | 'appel' | 'manuel';
  note?: string;
  timestamp: string;
}

export interface StaffPresenceRecord {
  userId: string;
  userName: string;
  userEmail: string;
  role: UserRole;
  employeeRole?: string;
  lastSeenAt: string;
  workStatus: 'working' | 'break' | 'off';
  currentShiftId?: string;
  currentShiftStartedAt?: string;
  currentPage?: string;
  lastActionAt?: string;
  lastActionLabel?: string;
}

export interface StaffWorkShift {
  id: string;
  userId: string;
  userName: string;
  date: string; // YYYY-MM-DD
  startedAt: string;
  endedAt?: string;
  lastTickAt: string;
  breakStartedAt?: string;
  pausedSeconds: number;
  workedSeconds: number;
  status: 'active' | 'break' | 'completed';
  closedBy?: string;
  notes?: string;
}

export interface StaffControlMemberOverview {
  user: UserProfile;
  isOnline: boolean;
  idleSeconds: number;
  lastSeenAt?: string;
  activeSessionsCount: number;
  workStatus: 'working' | 'break' | 'off';
  currentShift?: StaffWorkShift | null;
  todayWorkedSeconds: number;
  weekWorkedSeconds: number;
  monthWorkedSeconds: number;
  todayFirstStartAt?: string;
  currentPage?: string;
  lastActionAt?: string;
  lastActionLabel?: string;
  performance: {
    todayActions: number;
    todayConfirmed: number;
    todayNoAnswer: number;
    todayPostponed: number;
    todayCancelled: number;
    todayWhatsAppSent: number;
    totalHandled: number;
    totalConfirmed: number;
    totalNoAnswer: number;
    totalPostponed: number;
    totalCancelled: number;
    totalWhatsAppSent: number;
    confirmationRate: number;
    deliveredOfConfirmedRate: number;
    confirmedCodTotal: number;
    confirmationsPerHour: number;
  };
}

// ================= CUSTOMER BLACKLIST (اللائحة السوداء للزبناء) =================
export interface BlacklistEntry {
  id: string;
  phone: string;
  normalizedPhone: string;
  customerName?: string;
  city?: string;
  reason: string;
  comment: string;
  reportedById: string;
  reportedByName: string;
  reportedByCompany?: string;
  reportedByRole: UserRole;
  createdAt: string;
  updatedAt?: string;
}



