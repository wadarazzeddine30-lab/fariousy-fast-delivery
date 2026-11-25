import { Agency, CityTariff, ClientDebtItem, ClientMessage, ClientPayment, DriverRegistrationRequest, PackageItem, Partner, PickupRequest, UserProfile } from '../types';

export const INITIAL_AGENCIES: Agency[] = [
  {
    id: 'agency-layoune',
    name: 'Hub Principal Laâyoune',
    city: 'Laâyoune',
    address: 'Boulevard Mekka, Près Gare Routière, Quartier Al Wahda',
    phone: '+212 528 89 40 10',
    email: 'hub.layoune@livraison.ma',
    managerName: 'Azzeddine Wadar',
    managerPhone: '+212 661 22 33 44',
    managerEmail: 'a.wadar@livraison.ma',
    type: 'hub_principal',
    active: true,
    storageCapacity: 5000,
    notes: 'Hub logistique principal pour la région Sud et Sahara',
    createdAt: '2024-01-15'
  },
  {
    id: 'agency-casa',
    name: 'Hub Central Casablanca',
    city: 'Casablanca',
    address: 'Zone Industrielle Sidi Maârouf, Lot 14',
    phone: '+212 522 89 40 10',
    email: 'hub.casa@livraison.ma',
    managerName: 'Amine Benjelloun',
    managerPhone: '+212 662 11 22 33',
    managerEmail: 'a.benjelloun@livraison.ma',
    type: 'hub_principal',
    active: true,
    storageCapacity: 8000,
    notes: 'Hub central de tri national et distribution Grand Casablanca',
    createdAt: '2024-01-10'
  },
  {
    id: 'agency-rabat',
    name: 'Agence Régionale Rabat',
    city: 'Rabat',
    address: 'Avenue Annakhil, Secteur 21, Hay Riad',
    phone: '+212 537 68 20 40',
    email: 'agence.rabat@livraison.ma',
    managerName: 'Fatima-Zahra El Idrissi',
    managerPhone: '+212 663 33 44 55',
    managerEmail: 'fz.idrissi@livraison.ma',
    type: 'agence_regionale',
    active: true,
    storageCapacity: 3500,
    notes: 'Agence régionale desservant Rabat, Salé et Témara',
    createdAt: '2024-02-01'
  },
  {
    id: 'agency-tanger',
    name: 'Agence Nord Tanger Med',
    city: 'Tanger',
    address: 'Boulevard Mohammed VI, Zone Franche Tanger Med',
    phone: '+212 539 34 12 90',
    email: 'agence.tanger@livraison.ma',
    managerName: 'Tariq Mansouri',
    managerPhone: '+212 664 55 66 77',
    managerEmail: 't.mansouri@livraison.ma',
    type: 'agence_regionale',
    active: true,
    storageCapacity: 4000,
    notes: 'Plateforme régionale Nord, Tanger, Tétouan et zone portuaire',
    createdAt: '2024-02-15'
  },
  {
    id: 'agency-kech',
    name: 'Agence Sud Marrakech',
    city: 'Marrakech',
    address: 'Zone Industrielle Sidi Ghanem, Rue Principale N° 88',
    phone: '+212 524 45 78 11',
    email: 'agence.marrakech@livraison.ma',
    managerName: 'Kenza Alaoui',
    managerPhone: '+212 665 77 88 99',
    managerEmail: 'k.alaoui@livraison.ma',
    type: 'agence_regionale',
    active: true,
    storageCapacity: 3000,
    notes: 'Distribution régionale Marrakech, Safi et Essaouira',
    createdAt: '2024-03-01'
  }
];

export const INITIAL_CITIES: CityTariff[] = [
  { id: 'city-1', name: 'Casablanca', region: 'Grand Casablanca', defaultFee: 25, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-2', name: 'Rabat', region: 'Rabat-Salé-Kénitra', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-3', name: 'Marrakech', region: 'Marrakech-Safi', defaultFee: 35, returnFee: 15, deliveryDelayHours: 48, active: true },
  { id: 'city-4', name: 'Tanger', region: 'Tanger-Tétouan-Al Hoceïma', defaultFee: 35, returnFee: 15, deliveryDelayHours: 48, active: true },
  { id: 'city-5', name: 'Fès', region: 'Fès-Meknès', defaultFee: 35, returnFee: 15, deliveryDelayHours: 48, active: true },
  { id: 'city-6', name: 'Meknès', region: 'Fès-Meknès', defaultFee: 35, returnFee: 15, deliveryDelayHours: 48, active: true },
  { id: 'city-7', name: 'Agadir', region: 'Souss-Massa', defaultFee: 40, returnFee: 20, deliveryDelayHours: 48, active: true },
  { id: 'city-8', name: 'Oujda', region: 'Oriental', defaultFee: 45, returnFee: 20, deliveryDelayHours: 72, active: true },
  { id: 'city-9', name: 'Kénitra', region: 'Rabat-Salé-Kénitra', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-10', name: 'Mohammedia', region: 'Grand Casablanca', defaultFee: 25, returnFee: 10, deliveryDelayHours: 24, active: true },
  // Tarifs ajoutés depuis la grille complète (لي كاينة خليها ولي مكيناش زيدها)
  { id: 'city-11', name: 'Laâyoune', region: 'Sud', defaultFee: 15, returnFee: 0, deliveryDelayHours: 24, active: true },
  { id: 'city-12', name: 'Akhfennir', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-13', name: 'Assa', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-14', name: 'Boujdour', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-15', name: 'Dakhla', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-16', name: 'Es-Semara', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-17', name: 'El Marsa', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-18', name: 'Guelmim', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-19', name: 'Tarfaya', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-20', name: 'Tiznit', region: 'Souss-Massa', defaultFee: 30, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-21', name: 'Tan-Tan', region: 'Sud', defaultFee: 30, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-22', name: 'Arfoud', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-23', name: 'Azilal', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-24', name: 'Agdez', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-25', name: 'Aït Ourir', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-26', name: 'Aït Melloul', region: 'Souss-Massa', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-27', name: 'Azemmour', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-28', name: 'Bouznika', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-29', name: 'Boumalne Dadès', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-30', name: 'Ben Guerir', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-31', name: 'Benslimane', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-32', name: 'Bir Gandouz', region: 'Sud', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-33', name: 'Boumia', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-34', name: 'Belfaa', region: 'Souss-Massa', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-35', name: 'Berrechid', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-36', name: 'Béni Mellal', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-37', name: 'Berkane', region: 'Oriental', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-38', name: 'Chichaoua', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-39', name: 'Chefchaouen', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-40', name: 'Demnate', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-41', name: 'Errachidia', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-42', name: 'Essaouira', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-43', name: 'El Hoceïma', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-44', name: 'El Jadida', region: 'Doukkala', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-45', name: 'Figuig', region: 'Oriental', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-46', name: 'Fnideq', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-47', name: 'Fkih Ben Saleh', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-48', name: 'Guercif', region: 'Oriental', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-49', name: 'El Hajeb', region: 'Fès-Meknès', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-50', name: 'Ifrane', region: 'Fès-Meknès', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-51', name: 'Ksar Sghir', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-52', name: 'Ksar El Kebir', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-53', name: 'Khémisset', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-54', name: "Kelaat M'Gouna", region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-55', name: 'Khénifra', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-56', name: 'Kasba Tadla', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-57', name: 'Kelaat Sraghna', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-58', name: 'Larache', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-59', name: "M'diq", region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-60', name: 'Midelt', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-61', name: "M'hamid El Ghizlane", region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-62', name: 'Mrirt', region: 'Béni Mellal', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-63', name: 'Midar', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-64', name: 'Missour', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-65', name: 'Merzouga', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-66', name: 'Nador', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-67', name: 'Oualidia', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-68', name: 'Ouazzane', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-69', name: 'Ouarzazate', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-70', name: 'Rissani', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-71', name: 'Rich', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-72', name: 'Sidi Kacem', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-73', name: 'Sefrou', region: 'Fès-Meknès', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-74', name: 'Sidi Ifni', region: 'Sud', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-75', name: 'Safi', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-76', name: 'Skoura', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-77', name: 'Skhirat', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-78', name: 'Salé', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-79', name: 'Settat', region: 'Casablanca-Settat', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-80', name: 'Saïdia', region: 'Oriental', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-81', name: 'Sidi Yahya El Gharb', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-82', name: 'Sidi Slimane', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-83', name: 'Taza', region: 'Fès-Meknès', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-84', name: 'Tazenakht', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-85', name: 'Tata', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-86', name: 'Tinjdad', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-87', name: 'Timahdite', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-88', name: 'Tétouan', region: 'Nord', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-89', name: 'Tinghir', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-90', name: 'Témara', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 24, active: true },
  { id: 'city-91', name: 'Taounate', region: 'Fès-Meknès', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-92', name: 'Taliouine', region: 'Souss-Massa', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-93', name: 'Taroudant', region: 'Souss-Massa', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-94', name: 'Tiflet', region: 'Rabat-Salé-Kénitra', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-95', name: 'Youssoufia', region: 'Marrakech-Safi', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true },
  { id: 'city-96', name: 'Zagora', region: 'Sud Est', defaultFee: 45, returnFee: 10, deliveryDelayHours: 72, active: true },
  { id: 'city-97', name: 'Zaïda', region: 'Tafilalt', defaultFee: 45, returnFee: 10, deliveryDelayHours: 48, active: true }
];

export const INITIAL_PARTNERS: Partner[] = [];

export const INITIAL_PARTNER_LOGS: import('../types').PartnerSyncLog[] = [];

export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-admin',
    name: 'Azzeddine Wadar',
    email: 'wadarazzeddine30@gmail.com',
    role: 'super_admin',
    phone: '+212 661 00 00 01',
    companyName: 'FARIOUSY DELIVERY SARL',
    city: 'Laâyoune',
    address: 'Siège Social - Laâyoune / Casablanca',
    status: 'active',
    registeredAt: '2025-01-01'
  }
];

export const INITIAL_PACKAGES: PackageItem[] = [];

export const INITIAL_PICKUPS: PickupRequest[] = [];

export const INITIAL_PAYMENTS: ClientPayment[] = [];

export const INITIAL_DEBTS: import('../types').ClientDebtItem[] = [];

export const INITIAL_COMPANY_SETTINGS: import('../types').CompanySettings = {
  companyName: 'FARIOUSY DELIVERY SARL',
  brandTagline: 'Fast Delivery — Réseau Logistique National',
  phone: '+212 522 89 40 10',
  whatsapp: '+212 661 00 00 01',
  email: 'direction@fariousy.com',
  website: 'https://app.fariousy.com',
  facebookUrl: 'https://www.facebook.com/share/1CtkWNXorU/',
  instagramUrl: 'https://www.instagram.com/fariousy1?exln=MTdma2tqZm51c2w4dg==',
  address: 'Laâyoune / Zone Industrielle Sidi Maârouf, Casablanca, Maroc',
  rc: '543210 - Casablanca',
  patente: '34125890',
  ifNumber: '40219876',
  ice: '002349182000045',
  defaultReturnFee: 15,
  defaultDeliveryFee: 35,
  deliveryDelayHours: 24,
  defaultDeliveryDelay: '24h - 48h',
  autoSmsNotice: true,
  autoWhatsappNotice: true,
  enableSmsNotifications: true,
  enableWhatsappAlerts: true,
  enableAutoClientNotifications: true,
  whatsappProvider: 'webhook',
  whatsappPhoneNumberId: '',
  whatsappWebhookUrl: '',
  whatsappApiToken: '',
  whatsappNotifyTarget: 'both',
  whatsappNotifyStatuses: ['ramasse', 'en_cours_livraison', 'livre', 'retourne', 'probleme_livraison'],
  whatsappCustomTemplate:
    '📦 {{company}} : السلام عليكم {{recipient}}، الطرد ديالك {{tracking}} ({{city}}) ولات الحالة ديالو: {{status}}. المبلغ عند الاستلام: {{cod}} DH. التتبع المباشر: {{tracking_url}}'
};

export const INITIAL_STOCK_LOCATIONS: import('../types').StockLocationItem[] = [];

export const INITIAL_AUDIT_LOGS: import('../types').AuditLogItem[] = [];

export const INITIAL_CLIENT_MESSAGES: ClientMessage[] = [];

export const INITIAL_DRIVER_REQUESTS: DriverRegistrationRequest[] = [];

export const INITIAL_VEHICLES: import('../types').Vehicle[] = [];


