import React, { createContext, useContext, useEffect, useState, useTransition, useRef, useCallback } from 'react';
import {
  INITIAL_AGENCIES,
  INITIAL_AUDIT_LOGS,
  INITIAL_CITIES,
  INITIAL_CLIENT_MESSAGES,
  INITIAL_COMPANY_SETTINGS,
  INITIAL_DEBTS,
  INITIAL_PARTNERS,
  INITIAL_PARTNER_LOGS,
  INITIAL_PAYMENTS,
  INITIAL_PICKUPS,
  INITIAL_STOCK_LOCATIONS,
  INITIAL_USERS,
  INITIAL_DRIVER_REQUESTS,
  INITIAL_VEHICLES
} from '../data/initialData';
import {
  Agency,
  AppNotification,
  AuditLogItem,
  BankTransferReceipt,
  BonItem,
  BonStatus,
  BonType,
  CityTariff,
  ClientDebtItem,
  ClientMessage,
  ClientMessageCategory,
  ClientMessagePriority,
  ClientMessageReply,
  ClientMessageStatus,
  ClientPayment,
  ClientStockInvoice,
  ClientStockMovement,
  ClientStockProduct,
  ClientStockUnit,
  CompanySettings,
  CustomerReview,
  DriverRegistrationRequest,
  DriverVehicleType,
  PACKAGE_STATUS_CONFIG,
  PackageHistoryItem,
  PackageItem,
  PackageProblemReport,
  PackageStatus,
  Partner,
  PartnerSettlement,
  PartnerSyncLog,
  PickupRequest,
  ReviewTargetType,
  SavedAddress,
  StockLocationItem,
  UserPermissions,
  UserProfile,
  UserRole,
  Vehicle,
  VehicleOwnership,
  VehicleStatus,
  WhatsappDispatchLog,
  SmartAlertItem,
  BlacklistEntry
} from '../types';
import { computeSmartAlerts } from '../utils/smartAlerts';
import { matchBlacklistPhone, BlacklistMatchSummary } from '../utils/blacklist';
import { createAutoStatusNotification } from '../services/userNotifications';
import {
  buildLiveTrackingUrl,
  DEFAULT_WHATSAPP_WATCHED_STATUSES
} from '../utils/trackingNotifications';
import {
  supabaseClient,
  supabaseRealtime,
  fetchSupabaseClients,
  fetchSupabasePackages,
  createSupabasePackage,
  updatePackageStatusInSupabase,
  updateSupabaseClient,
  patchAuxiliaryState,
  fetchSupabaseDrivers,
  assignPackagesToDriverInSupabase,
  createSupabaseDriver,
  updateSupabaseDriver,
  deleteSupabasePackage,
  deleteSupabaseClient,
  deleteSupabaseDriver,
  updateDriverPasswordInSupabase,
  updateClientPasswordInSupabase,
  toggleSupabaseClientStatus,
  getAuthHeaders,
  getStoredAuthSession,
  saveStoredAuthSession,
  CreateDriverPayload,
  DriverCredentials
} from '../services/supabase';
import { directSupabaseRequest } from '../services/supabaseDirectGateway';
import { saveLocalKycDocs } from '../utils/kycStorage';

interface DatabaseContextType {
  packages: PackageItem[];
  isPackagesLoading: boolean;
  refreshPackages: () => Promise<void>;
  users: UserProfile[];
  cities: CityTariff[];
  pickups: PickupRequest[];
  partners: Partner[];
  refreshPartners: () => Promise<void>;
  agencies: Agency[];
  payments: ClientPayment[];
  notifications: AppNotification[];
  auditLogs: AuditLogItem[];
  companySettings: CompanySettings;
  stockLocations: StockLocationItem[];
  clientDebts: ClientDebtItem[];
  transferReceipts: BankTransferReceipt[];
  clientMessages: ClientMessage[];
  reviews: CustomerReview[];
  publicDrivers: { id: string; name: string; city: string }[];
  refreshReviews: () => Promise<void>;
  submitReview: (payload: {
    targetType: ReviewTargetType;
    rating: number;
    comment: string;
    authorName: string;
    authorRole?: 'client' | 'destinataire' | 'visiteur';
    authorCity?: string;
    authorPhone?: string;
    driverId?: string;
    driverName?: string;
    trackingNumber?: string;
  }) => Promise<{ success: boolean; review?: CustomerReview; error?: string }>;
  updateReview: (
    id: string,
    updates: { isPublic?: boolean; adminReply?: string }
  ) => Promise<{ success: boolean; review?: CustomerReview; error?: string }>;
  deleteReview: (id: string) => Promise<{ success: boolean; error?: string }>;
  // Shared Customer Blacklist (اللائحة السوداء للزبناء)
  blacklistEntries: BlacklistEntry[];
  refreshBlacklist: () => Promise<void>;
  addBlacklistEntry: (payload: {
    phone: string;
    customerName?: string;
    city?: string;
    reason?: string;
    comment: string;
  }) => Promise<{ success: boolean; entry?: BlacklistEntry; error?: string }>;
  deleteBlacklistEntry: (id: string) => Promise<{ success: boolean; error?: string }>;
  findBlacklistMatches: (phone?: string) => BlacklistMatchSummary;
  // Client Fulfillment Stock (السطوك عند الزبون)
  clientStockProducts: ClientStockProduct[];
  clientStockMovements: ClientStockMovement[];
  clientStockInvoices: ClientStockInvoice[];
  refreshClientStock: (scope?: { clientId?: string; shopId?: string } | null) => Promise<void>;
  createClientStockProduct: (payload: {
    clientId: string;
    clientName?: string;
    clientCompany?: string;
    name: string;
    photoUrl?: string;
    category?: string;
    unitPrice: number;
    quantity: number;
    hubName?: string;
    notes?: string;
    actorName?: string;
  }) => Promise<{ success: boolean; product?: ClientStockProduct; error?: string }>;
  addClientStockUnits: (
    productId: string,
    quantity: number,
    actorName?: string
  ) => Promise<{ success: boolean; product?: ClientStockProduct; error?: string }>;
  scanClientStockUnit: (
    codeOrProductId: string,
    opts?: {
      hubName?: string;
      zone?: string;
      shelf?: string;
      bin?: string;
      actorName?: string;
      scanAllPending?: boolean;
    }
  ) => Promise<{
    success: boolean;
    message: string;
    product?: ClientStockProduct;
    unit?: ClientStockUnit;
  }>;
  dispatchClientStockUnit: (
    codeOrProductId: string,
    opts?: {
      clientId?: string;
      trackingNumber?: string;
      packageId?: string;
      actorName?: string;
      notes?: string;
    }
  ) => Promise<{
    success: boolean;
    message: string;
    product?: ClientStockProduct;
    unit?: ClientStockUnit;
  }>;
  deductClientStockForPackage: (payload: {
    clientId: string;
    shopId?: string;
    clientName: string;
    clientCompany?: string;
    clientPhone?: string;
    packageId: string;
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
    deliveryFee: number;
    items: { productId: string; quantity: number }[];
    actorName?: string;
  }) => Promise<{ success: boolean; invoice?: ClientStockInvoice; error?: string }>;
  restoreClientStockForPackage: (
    packageId: string,
    trackingNumber?: string,
    actorName?: string
  ) => Promise<{ success: boolean; restoredCount: number }>;
  updateClientStockInvoiceStatus: (
    invoiceId: string,
    status: 'generee' | 'payee'
  ) => Promise<{ success: boolean; invoice?: ClientStockInvoice; error?: string }>;
  deleteClientStockProduct: (productId: string) => Promise<{ success: boolean; error?: string }>;
  deleteClientStockUnit: (
    productId: string,
    unitId: string
  ) => Promise<{ success: boolean; product?: ClientStockProduct; error?: string }>;
  unreadOrdersBadgeCount: number;
  clearUnreadOrdersBadge: () => void;
  triggerNewOrderNotification: (trackingNumber?: string, recipientName?: string) => void;

  // Client Messaging Operations (Surface de message émis par le client)
  sendClientMessage: (
    data: {
      category: ClientMessageCategory;
      priority: ClientMessagePriority;
      subject: string;
      message: string;
      packageTrackingNumber?: string;
      packageId?: string;
    },
    clientUser?: { id: string; name: string; companyName?: string; phone?: string; email?: string }
  ) => ClientMessage;
  replyToClientMessage: (
    messageId: string,
    replyText: string,
    sender: { id: string; name: string; role: 'client' | 'admin' | 'employee' | 'support' }
  ) => void;
  updateClientMessageStatus: (
    messageId: string,
    status: ClientMessageStatus,
    resolvedBy?: string
  ) => void;
  deleteClientMessage: (messageId: string) => void;

  // Package Operations
  upsertPackageLocal: (pkg: PackageItem) => void;
  addPackage: (pkg: Omit<PackageItem, 'id' | 'trackingNumber' | 'createdAt' | 'lastMovedAt' | 'history' | 'isPaidToClient'>, currentUser?: { name: string; role: UserRole; id?: string }) => PackageItem;
  addMultiplePackages: (pkgs: Array<Omit<PackageItem, 'id' | 'trackingNumber' | 'createdAt' | 'lastMovedAt' | 'history' | 'isPaidToClient'>>, currentUser?: { name: string; role: UserRole; id?: string }) => PackageItem[];
  updatePackage: (id: string, updates: Partial<PackageItem>, currentUser?: { name: string; role: UserRole; id?: string }) => void;
  deletePackage: (id: string, reason?: string, currentUser?: { name: string; role: UserRole; id?: string }) => Promise<{ success: boolean; message: string; archived?: boolean }>;
  changePackageStatus: (
    packageId: string,
    newStatus: PackageStatus,
    comment?: string,
    location?: string,
    currentUser?: { name: string; role: UserRole },
    options?: { currentAgency?: string }
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  assignPackageToDriver: (
    packageId: string,
    driverId: string | null,
    driverName?: string,
    updateStatus?: boolean,
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  assignMultiplePackagesToDriver: (
    packageIds: string[],
    driverId: string | null,
    driverName?: string,
    updateStatus?: boolean,
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{ success: boolean; message?: string; error?: string }>;
  updatePackageStatus: (
    packageId: string,
    status: string,
    comment?: string,
    callProofUrl?: string
  ) => Promise<{ success: boolean; error?: string }>;
  reportPackageProblem: (params: {
    packageId: string;
    category: string;
    categoryLabel: string;
    description: string;
    photoBase64?: string;
    reportedBy?: { id?: string; name: string; role: UserRole };
  }) => Promise<{ success: boolean; error?: string }>;
  resolvePackageProblem: (
    packageId: string,
    adminNote?: string,
    resolvedBy?: string
  ) => Promise<{ success: boolean }>;
  transferPackageToPartner: (
    packageId: string,
    partnerName: string,
    partnerTrackingId: string,
    partnerId?: string,
    partnerFee?: number
  ) => Promise<{ success: boolean; error?: string }>;
  transferPackageAgency: (packageId: string, targetAgency: string, partnerId?: string, comment?: string, currentUser?: { name: string; role: UserRole }) => void;
  scanBarcodeAction: (
    trackingNumber: string,
    action: 'reception_stock' | 'depart_livraison' | 'arrivee_agence' | 'marquer_livre' | 'marquer_retour',
    extra?: { driverId?: string; driverName?: string; agencyName?: string; agencyId?: string; location?: string; comment?: string },
    currentUser?: { name: string; role: UserRole }
  ) => { success: boolean; message: string; packageItem?: PackageItem };

  // Client Operations
  addClient: (client: Omit<UserProfile, 'id' | 'registeredAt'>, currentUser?: { name: string; role: UserRole }) => UserProfile;
  registerBoutique: (data: {
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
  }) => UserProfile;
  updateClient: (id: string, updates: Partial<UserProfile>, currentUser?: { name: string; role: UserRole }) => void;
  deleteClient: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => Promise<{ success: boolean; message?: string; error?: string }>;
  toggleClientStatus: (id: string, status: 'active' | 'inactive', currentUser?: { name: string; role: UserRole }, skipServerSync?: boolean) => void;
  approveClient: (id: string, adminName?: string, customRates?: Record<string, number>) => void;
  rejectClient: (id: string, reason: string) => void;
  suspendClient: (id: string, reason: string) => void;
  updateClientRate: (clientId: string, city: string, rate: number) => void;
  removeClientRate: (clientId: string, city: string) => void;
  setClientCustomRates: (clientId: string, rates: Record<string, number>) => void;
  resetClientCustomRates: (clientId: string) => void;
  updateClientPassword: (
    clientId: string,
    newPassword: string,
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{
    success: boolean;
    message?: string;
    newPassword?: string;
    client?: { id: string; name: string; phone: string; email: string };
    error?: string;
  }>;

  // Driver Operations
  driverRequests: DriverRegistrationRequest[];
  submitDriverRegistration: (data: {
    fullName: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    cinNumber: string;
    cinPhotoUrl?: string;
    cinBackPhotoUrl?: string;
    driverPhotoUrl?: string;
    vehicleType: DriverVehicleType;
    driverPlate?: string;
    password?: string;
  }) => { success: boolean; request?: DriverRegistrationRequest; error?: string };
  approveDriverRegistration: (requestId: string, adminName?: string) => { success: boolean; driver?: UserProfile; message?: string };
  rejectDriverRegistration: (requestId: string, reason: string, adminName?: string) => { success: boolean; message?: string };
  deleteDriverRegistrationRequest: (requestId: string) => void;
  addDriver: (driver: Omit<UserProfile, 'id' | 'registeredAt' | 'role'>, currentUser?: { name: string; role: UserRole }) => UserProfile;
  createDriverAccount: (data: CreateDriverPayload, currentUser?: { name: string; role: UserRole }) => Promise<{
    success: boolean;
    driver?: UserProfile;
    credentials?: DriverCredentials;
    error?: string;
  }>;
  updateDriverPassword: (driverId: string, newPassword: string, currentUser?: { name: string; role: UserRole }) => Promise<{
    success: boolean;
    message?: string;
    newPassword?: string;
    driver?: { id: string; name: string; phone: string; email: string };
    error?: string;
  }>;
  updateDriver: (id: string, updates: Partial<UserProfile>, currentUser?: { name: string; role: UserRole }) => void;
  deleteDriver: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => Promise<{ success: boolean; message?: string; error?: string }>;
  toggleDriverStatus: (id: string, status: 'active' | 'inactive') => void;

  // Employee Operations
  addEmployee: (employee: Omit<UserProfile, 'id' | 'registeredAt'>, currentUser?: { name: string; role: UserRole }) => UserProfile;
  createEmployeeAccount: (
    payload: Omit<UserProfile, 'id' | 'registeredAt'> & { password: string },
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{ success: boolean; employee?: UserProfile; error?: string }>;
  updateEmployeeAccount: (
    id: string,
    updates: Partial<UserProfile> & { password?: string },
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{ success: boolean; employee?: UserProfile; error?: string }>;
  deleteEmployeeAccount: (
    id: string,
    reason?: string,
    currentUser?: { name: string; role: UserRole }
  ) => Promise<{ success: boolean; error?: string }>;
  updateEmployee: (id: string, updates: Partial<UserProfile>, currentUser?: { name: string; role: UserRole }) => void;
  deleteEmployee: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => void;
  toggleEmployeeStatus: (id: string, status?: 'active' | 'inactive') => void;
  updateUserPermissions: (userId: string, permissions: string[], granular?: UserPermissions, currentUser?: { name: string; role: UserRole }) => void;

  // Partner Operations
  addPartner: (partner: Omit<Partner, 'id'> & { password?: string }, currentUser?: { name: string; role: UserRole }) => Partner;
  updatePartner: (id: string, updates: Partial<Partner> & { password?: string }, currentUser?: { name: string; role: UserRole }) => void;
  deletePartner: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => void;
  partnerSyncLogs: PartnerSyncLog[];
  dispatchPackagesToPartner: (partnerId: string, packageIds: string[], forceResend?: boolean) => Promise<{ success: boolean; sentCount: number; errors: string[] }>;
  retryFailedPartnerTransmissions: (partnerId: string) => Promise<{ success: boolean; sentCount: number; errors: string[] }>;
  regeneratePartnerWebhookToken: (partnerId: string) => Promise<{ success: boolean; webhookToken?: string }>;
  syncPartnerStatuses: (partnerId: string) => Promise<{ success: boolean; updatedCount: number }>;
  testPartnerConnection: (partnerId: string, overrideConfig?: Partial<Partner['apiConfig']>) => Promise<{ success: boolean; latency: number; message: string; statusCode?: number }>;
  clearPartnerLogs: () => void;
  addPartnerSettlement: (partnerId: string, settlement: Omit<PartnerSettlement, 'id'>, currentUser?: { name: string; role: UserRole }) => void;

  // Cities Operations
  addCity: (city: Omit<CityTariff, 'id'>, currentUser?: { name: string; role: UserRole }) => CityTariff;
  updateCity: (id: string, updates: Partial<CityTariff>, currentUser?: { name: string; role: UserRole }) => void;
  deleteCity: (id: string, currentUser?: { name: string; role: UserRole }) => void;

  // Hubs & Agencies Operations (التحكم في Hubs والمسؤولين)
  addAgency: (agency: Omit<Agency, 'id'>, currentUser?: { name: string; role: UserRole }) => Agency;
  updateAgency: (id: string, updates: Partial<Agency>, currentUser?: { name: string; role: UserRole }) => void;
  deleteAgency: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => { success: boolean; message: string };

  // Pickup Operations
  createPickupRequest: (request: Omit<PickupRequest, 'id' | 'trackingId' | 'status' | 'createdAt'>) => PickupRequest;
  updatePickupStatus: (id: string, status: PickupRequest['status'], driverId?: string, driverName?: string, reason?: string) => void;
  deletePickupRequest: (id: string) => void;

  // Stock Operations
  addStockLocation: (location: Omit<StockLocationItem, 'id' | 'enteredAt' | 'lastAuditedAt'>, currentUser?: { name: string; role: UserRole }) => StockLocationItem;
  updateStockLocation: (id: string, updates: Partial<StockLocationItem>, currentUser?: { name: string; role: UserRole }) => void;
  deleteStockLocation: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => void;
  moveStockLocation: (id: string, zone: string, shelf: string, bin: string, notes?: string, currentUser?: { name: string; role: UserRole }) => void;

  // Financial Operations & Bank Transfer Receipts
  generateClientPayment: (
    clientId: string,
    packageIds: string[],
    paymentMethod: ClientPayment['paymentMethod'],
    notes?: string,
    currentUser?: { name: string; role: UserRole },
    deductionOptions?: {
      packagingFees?: number;
      extraDeductions?: number;
      deductionNotes?: string;
      settleDebtIds?: string[];
      receiptImageUrl?: string;
      receiptFileName?: string;
    }
  ) => ClientPayment;
  markPaymentPaid: (paymentId: string) => void;
  cancelPayment: (paymentId: string, reason: string, currentUser?: { name: string; role: UserRole }) => void;
  attachPaymentReceipt: (
    paymentId: string,
    receipt: { imageUrl: string; fileName?: string },
    currentUser?: { name: string; role: UserRole }
  ) => void;
  addTransferReceipt: (
    receipt: Omit<BankTransferReceipt, 'id' | 'createdAt' | 'reference'> & { reference?: string },
    currentUser?: { name: string; role: UserRole }
  ) => BankTransferReceipt;
  deleteTransferReceipt: (receiptId: string, currentUser?: { name: string; role: UserRole }) => void;
  addClientDebt: (debt: Omit<ClientDebtItem, 'id' | 'createdAt'>, currentUser?: { name: string; role: UserRole }) => ClientDebtItem;
  settleClientDebt: (debtId: string, currentUser?: { name: string; role: UserRole }) => void;
  deleteClientDebt: (debtId: string, currentUser?: { name: string; role: UserRole }) => void;

  // Audit Logs
  addAuditLog: (log: Omit<AuditLogItem, 'id' | 'timestamp'>) => void;
  clearAuditLogs: () => void;

  // Company Settings
  updateCompanySettings: (settings: Partial<CompanySettings>, currentUser?: { name: string; role: UserRole }) => void;

  // Bons (Bon Delivery & Bon Client)
  bons: BonItem[];
  createBonDelivery: (
    data: { driverId: string; packageIds: string[]; notes?: string; city?: string },
    user?: { name: string; role: string }
  ) => Promise<{ success: boolean; bon?: BonItem; error?: string }>;
  createBonClient: (
    data: { clientId: string; packageIds: string[]; notes?: string },
    user?: { name: string; role: string }
  ) => Promise<{ success: boolean; bon?: BonItem; error?: string }>;
  updateBonStatus: (
    bonId: string,
    status: BonStatus,
    notes?: string,
    user?: { name: string; role: string }
  ) => Promise<{ success: boolean; error?: string }>;
  deleteBon: (bonId: string) => Promise<{ success: boolean; error?: string }>;

  // Vehicles & Fleet Operations (المركبات والتتبع)
  vehicles: Vehicle[];
  addVehicle: (data: Omit<Vehicle, 'id' | 'createdAt'>, currentUser?: { name: string; role: UserRole }) => Vehicle;
  updateVehicle: (id: string, updates: Partial<Vehicle>, currentUser?: { name: string; role: UserRole }) => void;
  deleteVehicle: (id: string, reason?: string, currentUser?: { name: string; role: UserRole }) => { success: boolean; message: string };
  simulateVehicleTelemetry: (id: string) => void;

  // Saved Addresses (عناوين محفوظة)
  savedAddresses: SavedAddress[];
  addSavedAddress: (addr: Omit<SavedAddress, 'id' | 'createdAt' | 'usageCount'>) => SavedAddress;
  updateSavedAddress: (id: string, updates: Partial<SavedAddress>) => void;
  deleteSavedAddress: (id: string) => void;
  markSavedAddressUsed: (id: string) => void;

  // WhatsApp Webhook & Logs + Smart Alerts + Backup/Restore
  whatsappLogs: WhatsappDispatchLog[];
  refreshWhatsappLogs: () => Promise<void>;
  clearWhatsappLogs: () => Promise<void>;
  testWhatsappWebhook: (opts?: {
    provider?: 'webhook' | 'meta_cloud';
    phoneNumberId?: string;
    webhookUrl?: string;
    apiToken?: string;
    notifyTarget?: 'recipient' | 'merchant' | 'both';
    template?: string;
    recipientPhone?: string;
    recipientName?: string;
  }) => Promise<{ success: boolean; log?: WhatsappDispatchLog; error?: string; webhookConfigured?: boolean }>;
  smartAlerts: SmartAlertItem[];
  exportSystemBackup: () => Promise<{ success: boolean; message: string; fileName?: string }>;
  restoreSystemBackup: (backupPayload: any) => Promise<{ success: boolean; message: string }>;

  // Notifications & System
  addNotification: (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => void;
  markNotificationRead: (id: string) => void;
  clearNotifications: () => void;
  resetToDefaultData: () => void;
  wipeSystemData: () => Promise<{ success: boolean; message: string }>;
}

const STORAGE_KEYS = {
  PACKAGES: 'fariousy_packages_v1',
  USERS: 'fariousy_users_v1',
  CITIES: 'fariousy_cities_v1',
  PICKUPS: 'fariousy_pickups_v1',
  PARTNERS: 'fariousy_partners_v1',
  AGENCIES: 'fariousy_agencies_v1',
  VEHICLES: 'fariousy_vehicles_v1',
  PAYMENTS: 'fariousy_payments_v1',
  NOTIFICATIONS: 'fariousy_notifications_v1',
  AUDIT_LOGS: 'fariousy_audit_logs_v1',
  COMPANY_SETTINGS: 'fariousy_company_settings_v1',
  STOCK_LOCATIONS: 'fariousy_stock_locations_v1',
  CLIENT_DEBTS: 'fariousy_client_debts_v1',
  TRANSFER_RECEIPTS: 'fariousy_transfer_receipts_v1',
  PARTNER_LOGS: 'fariousy_partner_logs_v1',
  CLIENT_MESSAGES: 'fariousy_client_messages_v1',
  DRIVER_REQUESTS: 'fariousy_driver_requests_v1',
  BONS: 'fariousy_bons_v1',
  CLIENT_CUSTOM_RATES: 'fariousy_client_custom_rates_v1',
  SAVED_ADDRESSES: 'fariousy_saved_addresses_v1',
  PROBLEM_REPORTS: 'fariousy_problem_reports_v1',
  CLIENT_STOCK_PRODUCTS: 'fariousy_client_stock_products_v1',
  CLIENT_STOCK_MOVEMENTS: 'fariousy_client_stock_movements_v1',
  CLIENT_STOCK_INVOICES: 'fariousy_client_stock_invoices_v1',
  CLIENT_STOCK_BACKUP: 'fariousy_client_stock_backup_v1',
  CLIENT_STOCK_DELETED_IDS: 'fariousy_client_stock_deleted_ids_v1',
  STOCK_LOCATIONS_DELETED_IDS: 'fariousy_stock_locations_deleted_ids_v1'
};

const readDeletedIdSet = (storageKey: string): Set<string> => {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(storageKey);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return new Set();
  }
};

const recordDeletedId = (storageKey: string, id: string) => {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = readDeletedIdSet(storageKey);
    set.add(id);
    localStorage.setItem(storageKey, JSON.stringify(Array.from(set).slice(-300)));
  } catch {}
};

const clearDeletedId = (storageKey: string, id: string) => {
  if (typeof window === 'undefined' || !id) return;
  try {
    const set = readDeletedIdSet(storageKey);
    if (set.delete(id)) {
      localStorage.setItem(storageKey, JSON.stringify(Array.from(set)));
    }
  } catch {}
};

const stripOversizedProductPhotos = (products: ClientStockProduct[]): ClientStockProduct[] =>
  products.map(p =>
    p.photoUrl && p.photoUrl.length > 35000 ? { ...p, photoUrl: undefined } : p
  );

const safeSaveStockArray = (key: string, items: any[], isProducts = false) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, JSON.stringify(items));
  } catch {
    if (isProducts) {
      try {
        localStorage.setItem(key, JSON.stringify(stripOversizedProductPhotos(items as ClientStockProduct[])));
      } catch {}
    }
  }
};

const safeStorageSet = (key: string, value: string) => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage quota full (common in Android WebView ~5MB limit): evict expendable log caches and retry once
    try {
      const expendable = [
        STORAGE_KEYS.AUDIT_LOGS,
        STORAGE_KEYS.NOTIFICATIONS,
        STORAGE_KEYS.PARTNER_LOGS,
        STORAGE_KEYS.PROBLEM_REPORTS
      ];
      for (const k of expendable) {
        if (k !== key) localStorage.removeItem(k);
      }
      localStorage.setItem(key, value);
    } catch {
      // Never throw inside React effects or state updates; Supabase remains authoritative
    }
  }
};

const readClientStockDurableBackup = (): {
  products: ClientStockProduct[];
  movements: ClientStockMovement[];
  invoices: ClientStockInvoice[];
} => {
  if (typeof window === 'undefined') return { products: [], movements: [], invoices: [] };
  const deletedProductIds = readDeletedIdSet(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS);
  const parseArr = <T,>(key: string): T[] => {
    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  };
  let backup: { products?: ClientStockProduct[]; movements?: ClientStockMovement[]; invoices?: ClientStockInvoice[] } = {};
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLIENT_STOCK_BACKUP);
    backup = raw ? JSON.parse(raw) || {} : {};
  } catch {
    backup = {};
  }

  const mergeById = <T extends { id: string; updatedAt?: string; createdAt?: string }>(primary: T[], secondary: T[]): T[] => {
    const map = new Map<string, T>();
    for (const item of secondary) if (item?.id) map.set(item.id, item);
    for (const item of primary) {
      if (!item?.id) continue;
      const prev = map.get(item.id);
      if (!prev) {
        map.set(item.id, item);
      } else {
        const tNew = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const tOld = new Date(prev.updatedAt || prev.createdAt || 0).getTime();
        if (tNew >= tOld) map.set(item.id, item);
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  };

  const products = mergeById(
    parseArr<ClientStockProduct>(STORAGE_KEYS.CLIENT_STOCK_PRODUCTS),
    Array.isArray(backup.products) ? backup.products : []
  ).filter(p => !deletedProductIds.has(p.id));

  const movements = mergeById(
    parseArr<ClientStockMovement>(STORAGE_KEYS.CLIENT_STOCK_MOVEMENTS),
    Array.isArray(backup.movements) ? backup.movements : []
  ).filter(m => !deletedProductIds.has(m.productId));

  const invoices = mergeById(
    parseArr<ClientStockInvoice>(STORAGE_KEYS.CLIENT_STOCK_INVOICES),
    Array.isArray(backup.invoices) ? backup.invoices : []
  );

  return { products, movements, invoices };
};

const writeClientStockDurableBackup = (patch: {
  products?: ClientStockProduct[];
  movements?: ClientStockMovement[];
  invoices?: ClientStockInvoice[];
}) => {
  if (typeof window === 'undefined') return;
  if (patch.products) safeSaveStockArray(STORAGE_KEYS.CLIENT_STOCK_PRODUCTS, patch.products, true);
  if (patch.movements) safeSaveStockArray(STORAGE_KEYS.CLIENT_STOCK_MOVEMENTS, patch.movements, false);
  if (patch.invoices) safeSaveStockArray(STORAGE_KEYS.CLIENT_STOCK_INVOICES, patch.invoices, false);

  try {
    const existing = readClientStockDurableBackup();
    const deletedProductIds = readDeletedIdSet(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS);
    const mergeAll = <T extends { id: string; updatedAt?: string; createdAt?: string }>(prevList: T[], nextList?: T[]): T[] => {
      if (!nextList) return prevList;
      const map = new Map<string, T>();
      for (const item of prevList) if (item?.id) map.set(item.id, item);
      for (const item of nextList) if (item?.id) map.set(item.id, item);
      return Array.from(map.values()).sort(
        (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
      );
    };
    const nextBackup = {
      products: mergeAll(existing.products, patch.products).filter(p => !deletedProductIds.has(p.id)),
      movements: mergeAll(existing.movements, patch.movements).filter(m => !deletedProductIds.has(m.productId)),
      invoices: mergeAll(existing.invoices, patch.invoices)
    };
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENT_STOCK_BACKUP, JSON.stringify(nextBackup));
    } catch {
      try {
        localStorage.setItem(
          STORAGE_KEYS.CLIENT_STOCK_BACKUP,
          JSON.stringify({
            ...nextBackup,
            products: stripOversizedProductPhotos(nextBackup.products)
          })
        );
      } catch {}
    }
  } catch {}
};

const hasActiveAuthSession = (): boolean => {
  if (typeof window === 'undefined') return false;
  try {
    const parsed = getStoredAuthSession();
    return Boolean(parsed?.user && (parsed?.token || parsed?.user?.id));
  } catch {
    return false;
  }
};

const getSessionRole = (): string => {
  if (typeof window === 'undefined') return '';
  try {
    const parsed = getStoredAuthSession();
    return String(parsed?.user?.role || '').toLowerCase();
  } catch {
    return '';
  }
};

const isStaffSession = (): boolean => {
  const role = getSessionRole();
  return role === 'super_admin' || role === 'admin' || role === 'employee';
};

const isAdminSession = (): boolean => {
  const role = getSessionRole();
  return role === 'super_admin' || role === 'admin';
};

const authedFetch = async (resource: string, init: RequestInit = {}): Promise<Response> => {
  return directSupabaseRequest(resource, init);
};

const getStoredCustomRates = (): Record<string, Record<string, number>> => {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CLIENT_CUSTOM_RATES) : null;
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const saveStoredCustomRates = (ratesMap: Record<string, Record<string, number>>) => {
  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEYS.CLIENT_CUSTOM_RATES, JSON.stringify(ratesMap));
    }
    if (hasActiveAuthSession() && isStaffSession()) {
      authedFetch('/api/system-collections/clientCustomRates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: ratesMap })
      }).catch(() => {});
    }
  } catch {}
};

const LEGACY_DEMO_TEXT_REGEX = /TechZone Maroc|Glamour & Cosm|Boutique Mode Chic|Electro Casa|Yassine Bakkali|Client Démo|FAR-2601-TEST|Mounir Chaoui|Touria touria|Rachid Amrani|Karim Tazi|Yassine Berrada|Hassan Chraibi|Atlas Messagerie Express|Amana Express \/ Poste Maroc|Chronopost Maroc \/ CTM|\+212\s*661\s*99\s*88\s*77|\+212\s*662\s*33\s*44\s*55/i;

const LEGACY_DEMO_IDS = new Set([
  'pick-1', 'pick-2', 'pick-3', 'pick-4',
  'part-1', 'part-2', 'part-3', 'part-13',
  'veh-1', 'veh-2', 'veh-3', 'veh-4',
  'pay-1', 'pay-2', 'pay-3',
  'stk-1', 'stk-2', 'stk-3',
  'debt-1', 'debt-2', 'debt-3',
  'msg-1', 'msg-2', 'msg-3',
  'dreq-1', 'dreq-2', 'dreq-3',
  'log-1', 'log-2', 'log-3'
]);

const isLegacyDemoPickup = (p: any): boolean => {
  if (!p) return false;
  if (p.id && LEGACY_DEMO_IDS.has(String(p.id))) return true;
  const hay = [p.clientCompany, p.clientName, p.clientPhone, p.driverName, p.address].filter(Boolean).join(' ');
  return LEGACY_DEMO_TEXT_REGEX.test(hay);
};

const isLegacyDemoRecord = (item: any, legacyIds: string[] = []): boolean => {
  if (!item) return false;
  const idStr = item.id ? String(item.id) : '';
  if (idStr && (LEGACY_DEMO_IDS.has(idStr) || legacyIds.includes(idStr))) return true;
  const hay = [
    item.clientCompany,
    item.clientName,
    item.companyName,
    item.partnerName,
    item.name,
    item.driverName,
    item.contactPerson,
    item.subject,
    item.message,
    item.title,
    item.entityLabel,
    item.details,
    item.notes
  ]
    .filter(Boolean)
    .join(' ');
  return LEGACY_DEMO_TEXT_REGEX.test(hay);
};

const scrubLegacyDemoStorage = () => {
  if (typeof window === 'undefined') return;
  try {
    const cleanFlagKey = 'fariousy_prod_clean_v3';
    if (localStorage.getItem(cleanFlagKey) === '1') return;

    const listKeys = [
      STORAGE_KEYS.PICKUPS,
      STORAGE_KEYS.PARTNERS,
      STORAGE_KEYS.VEHICLES,
      STORAGE_KEYS.PAYMENTS,
      STORAGE_KEYS.NOTIFICATIONS,
      STORAGE_KEYS.AUDIT_LOGS,
      STORAGE_KEYS.STOCK_LOCATIONS,
      STORAGE_KEYS.CLIENT_DEBTS,
      STORAGE_KEYS.PARTNER_LOGS,
      STORAGE_KEYS.CLIENT_MESSAGES,
      STORAGE_KEYS.DRIVER_REQUESTS,
      STORAGE_KEYS.BONS
    ];

    for (const key of listKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter(
            (item: any) => !isLegacyDemoPickup(item) && !isLegacyDemoRecord(item)
          );
          if (filtered.length === 0) {
            localStorage.removeItem(key);
          } else if (filtered.length !== parsed.length) {
            localStorage.setItem(key, JSON.stringify(filtered));
          }
        }
      } catch {
        // Ignore malformed cache entries
      }
    }

    localStorage.setItem(cleanFlagKey, '1');
  } catch {
    // Ignore storage access errors
  }
};

scrubLegacyDemoStorage();

const DatabaseContext = createContext<DatabaseContextType | undefined>(undefined);

export const DatabaseProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, startTransition] = useTransition();

  // ---------------------------------------------------------------------------
  // NEW ORDERS BROWSER TAB NOTIFICATION CONTROLLER (الى جات كموند جديدة تطلع 1)
  // ---------------------------------------------------------------------------
  const [unreadOrdersBadgeCount, setUnreadOrdersBadgeCount] = useState<number>(0);
  const knownPackageIds = useRef<Set<string>>(new Set());
  const isInitialPackagesLoaded = useRef<boolean>(false);

  const playNewOrderChime = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();

      // Tone 1: 587.33 Hz
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime);
      gain1.gain.setValueAtTime(0.15, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.25);

      // Tone 2: 880 Hz
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12);
      gain2.gain.setValueAtTime(0.2, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.45);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.45);
      setTimeout(() => {
        ctx.close().catch(() => {});
      }, 650);
    } catch {
      // Audio autoplay policy
    }
  };

  const triggerNewOrderNotification = useCallback((trackingNumber?: string, recipientName?: string) => {
    setUnreadOrdersBadgeCount(prev => {
      const nextCount = prev + 1;
      if (typeof document !== 'undefined') {
        document.title = `(${nextCount}) FARIOUSY DELIVERY — Nouvelle Commande !`;
      }
      return nextCount;
    });

    playNewOrderChime();
  }, []);

  const clearUnreadOrdersBadge = useCallback(() => {
    setUnreadOrdersBadgeCount(0);
    if (typeof document !== 'undefined') {
      document.title = 'FARIOUSY DELIVERY — Fast Delivery';
    }
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      if (unreadOrdersBadgeCount > 0) {
        clearUnreadOrdersBadge();
      }
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [unreadOrdersBadgeCount, clearUnreadOrdersBadge]);

  // Étape 81 : Les colis proviennent exclusivement de Supabase Production (public.packages)
  // Suppression définitive de INITIAL_PACKAGES et de localStorage comme source de données des colis
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [isPackagesLoading, setIsPackagesLoading] = useState<boolean>(true);
  const recentlyCreatedPackagesRef = useRef<Array<{ pkg: PackageItem; savedAt: number }>>([]);
  const recentlyUpdatedPackagesRef = useRef<Map<string, { updates: Partial<PackageItem>; savedAt: number }>>(new Map());

  const upsertPackageLocal = useCallback((pkg: PackageItem) => {
    if (!pkg || !pkg.id) return;
    recentlyCreatedPackagesRef.current = [
      { pkg, savedAt: Date.now() },
      ...recentlyCreatedPackagesRef.current.filter(
        x => x.pkg.id !== pkg.id && x.pkg.trackingNumber !== pkg.trackingNumber
      )
    ];
    setPackages(prev => {
      const existsIdx = prev.findIndex(
        p => p.id === pkg.id || (pkg.trackingNumber && p.trackingNumber === pkg.trackingNumber)
      );
      if (existsIdx >= 0) {
        const copy = [...prev];
        copy[existsIdx] = { ...copy[existsIdx], ...pkg };
        return copy;
      }
      return [pkg, ...prev];
    });
  }, []);

  const getStoredProblemReports = (): Record<string, PackageProblemReport> => {
    try {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.PROBLEM_REPORTS) : null;
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  };

  const saveStoredProblemReports = (map: Record<string, PackageProblemReport>) => {
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEYS.PROBLEM_REPORTS, JSON.stringify(map));
      }
    } catch {}
  };

  const hasHydratedCollectionsRef = useRef(false);
  const lastSyncedCollectionJsonRef = useRef<Record<string, string>>({});
  const dirtyCollectionsRef = useRef<Set<string>>(new Set());
  const pendingSyncCollectionsRef = useRef<Record<string, any>>({});

  const syncCollectionToServer = useCallback((key: string, value: any) => {
    if (!hasActiveAuthSession() || !isStaffSession()) return;
    if ((key === 'employees' || key === 'partners' || key === 'auditLogs') && !isAdminSession()) return;
    try {
      const serialized = JSON.stringify(value);
      if (lastSyncedCollectionJsonRef.current[key] === serialized) return;
      if (!hasHydratedCollectionsRef.current) {
        // Queue change made before initial hydration completes so it is flushed instead of dropped
        pendingSyncCollectionsRef.current[key] = value;
        dirtyCollectionsRef.current.add(key);
        return;
      }
      lastSyncedCollectionJsonRef.current[key] = serialized;
      dirtyCollectionsRef.current.add(key);
      authedFetch(`/api/system-collections/${encodeURIComponent(key)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value })
      }).catch(() => {});
    } catch {}
  }, []);

  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.SAVED_ADDRESSES) : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.SAVED_ADDRESSES, JSON.stringify(savedAddresses));
    } catch {}
    if (!hasHydratedCollectionsRef.current || !hasActiveAuthSession()) return;
    try {
      const serialized = JSON.stringify(savedAddresses);
      if (lastSyncedCollectionJsonRef.current['savedAddresses'] === serialized) return;
      lastSyncedCollectionJsonRef.current['savedAddresses'] = serialized;
      authedFetch('/api/saved-addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addresses: savedAddresses })
      }).catch(() => {});
    } catch {}
  }, [savedAddresses]);

  const refreshPackages = useCallback(async () => {
    if (!hasActiveAuthSession()) {
      setIsPackagesLoading(false);
      return;
    }
    setIsPackagesLoading(true);
    try {
      const [res, serverProblems] = await Promise.all([
        fetchSupabasePackages(),
        authedFetch('/api/problem-reports')
          .then(r => (r.ok ? r.json() : null))
          .catch(() => null)
      ]);

      const localProblemMap = getStoredProblemReports();
      const mergedProblemMap: Record<string, PackageProblemReport> = {
        ...localProblemMap,
        ...(serverProblems?.reports || {})
      };
      if (serverProblems?.reports) {
        saveStoredProblemReports(mergedProblemMap);
      }

      if (!res.error && Array.isArray(res.packages)) {
        const nowMs = Date.now();
        const freshThresholdMs = 30000;
        // Prune stale recent updates
        for (const [k, entry] of recentlyUpdatedPackagesRef.current.entries()) {
          if (nowMs - entry.savedAt > freshThresholdMs) {
            recentlyUpdatedPackagesRef.current.delete(k);
          }
        }

        const merged = res.packages.map(rawPkg => {
          const pendingPatch = recentlyUpdatedPackagesRef.current.get(rawPkg.id);
          const pkg = pendingPatch ? { ...rawPkg, ...pendingPatch.updates } : rawPkg;
          const prob = pkg.problemReport || mergedProblemMap[pkg.id] || mergedProblemMap[pkg.trackingNumber];
          if (!prob) return pkg;
          return {
            ...pkg,
            status: !prob.resolved ? ('probleme_livraison' as PackageStatus) : pkg.status,
            problemReport: prob,
            callProofUrl: prob.photoBase64 || pkg.callProofUrl,
            driverComment: prob.description || pkg.driverComment
          };
        });
        const returnedKeys = new Set<string>();
        for (const m of merged) {
          if (m.id) returnedKeys.add(String(m.id).toLowerCase());
          if (m.trackingNumber) returnedKeys.add(String(m.trackingNumber).toLowerCase());
        }
        const recentToPreserve = recentlyCreatedPackagesRef.current.filter(item => {
          if (nowMs - item.savedAt > freshThresholdMs) return false;
          const idKey = String(item.pkg.id || '').toLowerCase();
          const trKey = String(item.pkg.trackingNumber || '').toLowerCase();
          return !returnedKeys.has(idKey) && !returnedKeys.has(trKey);
        });
        recentlyCreatedPackagesRef.current = recentToPreserve;
        setPackages(
          recentToPreserve.length > 0
            ? [...recentToPreserve.map(r => r.pkg), ...merged]
            : merged
        );
      }
    } catch (err) {
      console.warn('[DatabaseContext] Notice syncing Supabase packages:', err);
    } finally {
      setIsPackagesLoading(false);
    }
  }, []);

  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.USERS);
      if (saved) {
        const parsed: UserProfile[] = JSON.parse(saved);
        // Exclude all fictitious/mock clients and drivers that were stored in legacy localStorage
        return parsed.filter(u => u.role !== 'client' && u.role !== 'driver');
      }
      return INITIAL_USERS.filter(u => u.role !== 'client' && u.role !== 'driver');
    } catch {
      return INITIAL_USERS.filter(u => u.role !== 'client' && u.role !== 'driver');
    }
  });

  const canonicalCityKey = (name: string): string => {
    const compact = String(name || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
    const aliasMap: Record<string, string> = {
      tangier: 'tanger',
      fez: 'fes',
      elhoucima: 'elhoceima',
      alhouceima: 'elhoceima',
      alhoceima: 'elhoceima',
      hajeb: 'elhajeb',
      ksarkebir: 'ksarelkebir',
      mhamidghizlane: 'mhamidelghizlane',
      berkan: 'berkane',
      sidisliman: 'sidislimane',
      taounat: 'taounate',
      taliouin: 'taliouine',
      timhdit: 'timahdite',
      laarache: 'larache',
      skhourrehamna: 'skoura'
    };
    return aliasMap[compact] || compact;
  };

  const mergeMissingInitialCities = (existing: CityTariff[]): { merged: CityTariff[]; addedCount: number } => {
    const seen = new Set(existing.map(c => canonicalCityKey(c.name)));
    const additions: CityTariff[] = [];
    for (const initCity of INITIAL_CITIES) {
      const key = canonicalCityKey(initCity.name);
      if (!seen.has(key)) {
        seen.add(key);
        additions.push(initCity);
      }
    }
    if (additions.length === 0) return { merged: existing, addedCount: 0 };
    return { merged: [...existing, ...additions], addedCount: additions.length };
  };

  const areCitiesEqualToInitial = useCallback((list: CityTariff[]): boolean => {
    if (!Array.isArray(list) || list.length !== INITIAL_CITIES.length) return false;
    for (let i = 0; i < INITIAL_CITIES.length; i++) {
      const a = list[i];
      const b = INITIAL_CITIES[i];
      if (!a) return false;
      if (
        String(a.name || '') !== b.name ||
        String(a.region || '') !== b.region ||
        Number(a.defaultFee) !== Number(b.defaultFee) ||
        Number(a.returnFee) !== Number(b.returnFee) ||
        Number(a.deliveryDelayHours) !== Number(b.deliveryDelayHours) ||
        (a.active !== false) !== (b.active !== false)
      ) {
        return false;
      }
    }
    return true;
  }, []);

  const [cities, setCities] = useState<CityTariff[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CITIES);
      const parsed: CityTariff[] = saved ? JSON.parse(saved) : INITIAL_CITIES;
      const baseList = Array.isArray(parsed) && parsed.length > 0 ? parsed : INITIAL_CITIES;
      if (localStorage.getItem('fariousy_cities_video_import_v1') !== '1') {
        const { merged } = mergeMissingInitialCities(baseList);
        localStorage.setItem(STORAGE_KEYS.CITIES, JSON.stringify(merged));
        localStorage.setItem('fariousy_cities_video_import_v1', '1');
        return merged;
      }
      return baseList;
    } catch {
      return INITIAL_CITIES;
    }
  });

  const [pickups, setPickups] = useState<PickupRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PICKUPS);
      if (!saved) return INITIAL_PICKUPS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_PICKUPS;
      const cleaned = parsed.filter((p: PickupRequest) => !isLegacyDemoPickup(p));
      if (cleaned.length !== parsed.length) {
        localStorage.setItem(STORAGE_KEYS.PICKUPS, JSON.stringify(cleaned));
      }
      return cleaned;
    } catch {
      return INITIAL_PICKUPS;
    }
  });

  const [partners, setPartners] = useState<Partner[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTNERS);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((p: Partner) => !isLegacyDemoRecord(p, ['part-1', 'part-2', 'part-3', 'part-13']));
        }
      }
      return INITIAL_PARTNERS;
    } catch {
      return INITIAL_PARTNERS;
    }
  });

  const [agencies, setAgencies] = useState<Agency[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AGENCIES);
      if (saved !== null) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
      return INITIAL_AGENCIES;
    } catch {
      return INITIAL_AGENCIES;
    }
  });

  const [vehicles, setVehicles] = useState<Vehicle[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.VEHICLES);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((v: Vehicle) => !isLegacyDemoRecord(v, ['veh-1', 'veh-2', 'veh-3', 'veh-4']));
        }
      }
      return INITIAL_VEHICLES;
    } catch {
      return INITIAL_VEHICLES;
    }
  });

  const [payments, setPayments] = useState<ClientPayment[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PAYMENTS);
      if (!saved) return INITIAL_PAYMENTS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_PAYMENTS;
      return parsed.filter((p: ClientPayment) => !isLegacyDemoRecord(p, ['pay-1', 'pay-2', 'pay-3']));
    } catch {
      return INITIAL_PAYMENTS;
    }
  });

  const [notifications, setNotifications] = useState<AppNotification[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTIFICATIONS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((n: AppNotification) => !isLegacyDemoRecord(n));
    } catch {
      return [];
    }
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.AUDIT_LOGS);
      if (!saved) return INITIAL_AUDIT_LOGS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_AUDIT_LOGS;
      return parsed.filter((l: AuditLogItem) => !isLegacyDemoRecord(l));
    } catch {
      return INITIAL_AUDIT_LOGS;
    }
  });

  const [companySettings, setCompanySettings] = useState<CompanySettings>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.COMPANY_SETTINGS);
      return saved ? JSON.parse(saved) : INITIAL_COMPANY_SETTINGS;
    } catch {
      return INITIAL_COMPANY_SETTINGS;
    }
  });

  const [stockLocations, setStockLocations] = useState<StockLocationItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.STOCK_LOCATIONS);
      if (!saved) return INITIAL_STOCK_LOCATIONS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_STOCK_LOCATIONS;
      return parsed.filter((s: StockLocationItem) => !isLegacyDemoRecord(s, ['stk-1', 'stk-2', 'stk-3']));
    } catch {
      return INITIAL_STOCK_LOCATIONS;
    }
  });

  const [clientDebts, setClientDebts] = useState<ClientDebtItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENT_DEBTS);
      if (!saved) return INITIAL_DEBTS;
      const parsed = JSON.parse(saved);
      if (!Array.isArray(parsed)) return INITIAL_DEBTS;
      return parsed.filter((d: ClientDebtItem) => !isLegacyDemoRecord(d, ['debt-1', 'debt-2', 'debt-3']));
    } catch {
      return INITIAL_DEBTS;
    }
  });

  const [transferReceipts, setTransferReceipts] = useState<BankTransferReceipt[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.TRANSFER_RECEIPTS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });

  const [partnerSyncLogs, setPartnerSyncLogs] = useState<PartnerSyncLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.PARTNER_LOGS);
      if (!saved) return INITIAL_PARTNER_LOGS;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((l: PartnerSyncLog) => !isLegacyDemoRecord(l)) : INITIAL_PARTNER_LOGS;
    } catch {
      return INITIAL_PARTNER_LOGS;
    }
  });

  // Sync partner logs to localStorage & server
  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.PARTNER_LOGS, JSON.stringify(partnerSyncLogs.slice(0, 80)));
    syncCollectionToServer('partnerSyncLogs', partnerSyncLogs);
  }, [partnerSyncLogs, syncCollectionToServer]);

  // Customer & Driver Reviews state (source de vérité backend, 0 fausse donnée)
  const [reviews, setReviews] = useState<CustomerReview[]>([]);
  const [publicDrivers, setPublicDrivers] = useState<{ id: string; name: string; city: string }[]>([]);

  const refreshReviews = useCallback(async () => {
    try {
      const url = isStaffSession() ? '/api/reviews?all=1' : '/api/reviews';
      const res = await authedFetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          if (Array.isArray(data.reviews)) setReviews(data.reviews);
          if (Array.isArray(data.drivers)) setPublicDrivers(data.drivers);
        }
      }
    } catch {
      // ignore network fallback
    }
  }, []);

  // Shared Customer Blacklist state
  const [blacklistEntries, setBlacklistEntries] = useState<BlacklistEntry[]>([]);

  const refreshBlacklist = useCallback(async () => {
    if (!hasActiveAuthSession()) return;
    try {
      const res = await authedFetch('/api/blacklist');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.entries)) {
          setBlacklistEntries(data.entries);
        }
      }
    } catch {
      // ignore network errors
    }
  }, []);

  const findBlacklistMatches = useCallback(
    (phone?: string): BlacklistMatchSummary => {
      return matchBlacklistPhone(phone, blacklistEntries);
    },
    [blacklistEntries]
  );

  // Client Fulfillment Stock state (backend + durable localStorage backup cache)
  const [clientStockProducts, setClientStockProducts] = useState<ClientStockProduct[]>(() => {
    return readClientStockDurableBackup().products;
  });
  const [clientStockMovements, setClientStockMovements] = useState<ClientStockMovement[]>(() => {
    return readClientStockDurableBackup().movements;
  });
  const [clientStockInvoices, setClientStockInvoices] = useState<ClientStockInvoice[]>(() => {
    return readClientStockDurableBackup().invoices;
  });
  const lastStockScopeRef = useRef<{ clientId?: string; shopId?: string } | null>(null);

  useEffect(() => {
    if (!hasActiveAuthSession()) return;
    writeClientStockDurableBackup({ products: clientStockProducts });
  }, [clientStockProducts]);

  useEffect(() => {
    if (!hasActiveAuthSession()) return;
    writeClientStockDurableBackup({ movements: clientStockMovements });
  }, [clientStockMovements]);

  useEffect(() => {
    if (!hasActiveAuthSession()) return;
    writeClientStockDurableBackup({ invoices: clientStockInvoices });
  }, [clientStockInvoices]);

  const refreshClientStock = useCallback(async (scope?: { clientId?: string; shopId?: string } | null) => {
    if (!hasActiveAuthSession()) return;
    try {
      const effectiveScope = scope === undefined ? lastStockScopeRef.current : scope;
      if (scope !== undefined) {
        lastStockScopeRef.current = scope;
      }

      const params = new URLSearchParams();
      if (effectiveScope?.clientId) params.set('clientId', effectiveScope.clientId);
      if (effectiveScope?.shopId) params.set('shopId', effectiveScope.shopId);
      const qs = params.toString() ? `?${params.toString()}` : '';

      const res = await authedFetch(`/api/client-stock${qs}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success) {
          const serverProducts: ClientStockProduct[] = Array.isArray(data.products) ? data.products : [];
          const serverMovements: ClientStockMovement[] = Array.isArray(data.movements) ? data.movements : [];
          const serverInvoices: ClientStockInvoice[] = Array.isArray(data.invoices) ? data.invoices : [];

          const deletedProductIds = readDeletedIdSet(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS);
          const localBackup = readClientStockDurableBackup();
          const matchesScope = (ownerId?: string) => {
            if (!effectiveScope?.clientId && !effectiveScope?.shopId) return true;
            if (!ownerId) return false;
            return (
              (Boolean(effectiveScope.clientId) && ownerId === effectiveScope.clientId) ||
              (Boolean(effectiveScope.shopId) && ownerId === effectiveScope.shopId)
            );
          };

          const serverProdMap = new Map(serverProducts.map(p => [p.id, p]));
          const serverMovIds = new Set(serverMovements.map(m => m.id));
          const serverInvIds = new Set(serverInvoices.map(i => i.id));

          const productsToSync: ClientStockProduct[] = [];
          const mergedProdMap = new Map<string, ClientStockProduct>();
          for (const sp of serverProducts) {
            if (!deletedProductIds.has(sp.id)) mergedProdMap.set(sp.id, sp);
          }
          for (const lp of localBackup.products) {
            if (!matchesScope(lp.clientId) || deletedProductIds.has(lp.id)) continue;
            const sp = serverProdMap.get(lp.id);
            if (!sp) {
              mergedProdMap.set(lp.id, lp);
              productsToSync.push(lp);
            } else {
              const localTs = new Date(lp.updatedAt || lp.createdAt || 0).getTime();
              const serverTs = new Date(sp.updatedAt || sp.createdAt || 0).getTime();
              if (localTs > serverTs) {
                mergedProdMap.set(lp.id, lp);
                productsToSync.push(lp);
              }
            }
          }

          const missingLocalMovements = localBackup.movements.filter(
            m => matchesScope(m.clientId) && !deletedProductIds.has(m.productId) && !serverMovIds.has(m.id)
          );
          const missingLocalInvoices = localBackup.invoices.filter(
            inv => matchesScope(inv.clientId) && !serverInvIds.has(inv.id)
          );

          const mergedProducts = Array.from(mergedProdMap.values())
            .filter(p => !deletedProductIds.has(p.id))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          const mergedMovements = [...serverMovements, ...missingLocalMovements]
            .filter(m => !deletedProductIds.has(m.productId))
            .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());

          const mergedInvoices = [...serverInvoices, ...missingLocalInvoices].sort(
            (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
          );

          setClientStockProducts(mergedProducts);
          setClientStockMovements(mergedMovements);
          setClientStockInvoices(mergedInvoices);
          writeClientStockDurableBackup({
            products: mergedProducts,
            movements: mergedMovements,
            invoices: mergedInvoices
          });

          // Auto-recover any unsynced or newer local stock items back up to the server & Supabase
          if (productsToSync.length > 0 || missingLocalMovements.length > 0 || missingLocalInvoices.length > 0) {
            authedFetch('/api/client-stock/sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                products: productsToSync,
                movements: missingLocalMovements,
                invoices: missingLocalInvoices
              })
            }).catch(() => {});
          }
        }
      }
    } catch {
      // keep cached local state when offline
    }
  }, []);

  const [clientMessages, setClientMessages] = useState<ClientMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.CLIENT_MESSAGES);
      if (!saved) return INITIAL_CLIENT_MESSAGES;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((m: ClientMessage) => !isLegacyDemoRecord(m, ['msg-1', 'msg-2', 'msg-3']))
        : INITIAL_CLIENT_MESSAGES;
    } catch {
      return INITIAL_CLIENT_MESSAGES;
    }
  });

  // Sync client messages to localStorage & server
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.CLIENT_MESSAGES, JSON.stringify(clientMessages));
    } catch {
      // ignore
    }
    syncCollectionToServer('clientMessages', clientMessages);
  }, [clientMessages, syncCollectionToServer]);

  const [driverRequests, setDriverRequests] = useState<DriverRegistrationRequest[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.DRIVER_REQUESTS);
      if (!saved) return INITIAL_DRIVER_REQUESTS;
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed)
        ? parsed.filter((d: DriverRegistrationRequest) => !isLegacyDemoRecord(d, ['dreq-1', 'dreq-2', 'dreq-3']))
        : INITIAL_DRIVER_REQUESTS;
    } catch {
      return INITIAL_DRIVER_REQUESTS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.DRIVER_REQUESTS, JSON.stringify(driverRequests));
    } catch {
      // ignore
    }
    syncCollectionToServer('driverRequests', driverRequests);
  }, [driverRequests, syncCollectionToServer]);

  const [bons, setBons] = useState<BonItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.BONS);
      if (!saved) return [];
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((b: BonItem) => !isLegacyDemoRecord(b)) : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEYS.BONS, JSON.stringify(bons));
    } catch {
      // ignore
    }
    syncCollectionToServer('bons', bons);
  }, [bons, syncCollectionToServer]);

  const [whatsappLogs, setWhatsappLogs] = useState<WhatsappDispatchLog[]>([]);

  const refreshWhatsappLogs = useCallback(async () => {
    if (!hasActiveAuthSession() || !isStaffSession()) return;
    try {
      const res = await authedFetch('/api/notifications/whatsapp-logs');
      if (res.ok) {
        const data = await res.json();
        if (data?.success && Array.isArray(data.logs)) {
          setWhatsappLogs(data.logs);
        }
      }
    } catch {
      // ignore offline
    }
  }, []);

  const refreshPartners = useCallback(async () => {
    if (!hasActiveAuthSession()) return;
    const role = getSessionRole();
    if (!['super_admin', 'admin', 'employee', 'partner'].includes(role)) return;
    try {
      const res = await authedFetch('/api/partners');
      if (res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.success && Array.isArray(data.partners)) {
          lastSyncedCollectionJsonRef.current['partners'] = JSON.stringify(data.partners);
          setPartners(data.partners);
          try {
            localStorage.setItem(STORAGE_KEYS.PARTNERS, JSON.stringify(data.partners));
          } catch {}
        }
      }
    } catch {
      // keep existing state when offline
    }
  }, []);

  const hydrateServerCollections = useCallback(async () => {
    if (!hasActiveAuthSession()) {
      hasHydratedCollectionsRef.current = false;
      return;
    }
    try {
      const res = await authedFetch('/api/system-collections');
      if (res.ok) {
        const data = await res.json();
        const cols = (data?.collections || {}) as Record<string, any>;
        const recordLoaded = (k: string, v: any) => {
          try {
            lastSyncedCollectionJsonRef.current[k] = JSON.stringify(v);
          } catch {}
        };

        if (Object.prototype.hasOwnProperty.call(cols, 'cities') && Array.isArray(cols.cities) && cols.cities.length > 0) {
          let finalCities = cols.cities as CityTariff[];
          if (typeof window !== 'undefined' && localStorage.getItem('fariousy_cities_video_import_server_v1') !== '1') {
            const { merged, addedCount } = mergeMissingInitialCities(finalCities);
            finalCities = merged;
            safeStorageSet('fariousy_cities_video_import_server_v1', '1');
            if (addedCount > 0 && isStaffSession()) {
              authedFetch('/api/system-collections/cities', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: finalCities })
              }).catch(() => {});
            }
          }

          let localCities: CityTariff[] = [];
          try {
            const savedLocal = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.CITIES) : null;
            const parsedLocal = savedLocal ? JSON.parse(savedLocal) : null;
            if (Array.isArray(parsedLocal) && parsedLocal.length > 0) {
              localCities = parsedLocal;
            }
          } catch {}

          const serverIsUntouchedDefault = areCitiesEqualToInitial(finalCities);
          const localIsCustomized = localCities.length > 0 && !areCitiesEqualToInitial(localCities);

          if (localIsCustomized && serverIsUntouchedDefault && isStaffSession()) {
            // Preserve admin's customized local tariffs and push them to server + Supabase
            recordLoaded('cities', localCities);
            setCities(localCities);
            authedFetch('/api/system-collections/cities', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: localCities })
            }).catch(() => {});
          } else {
            recordLoaded('cities', finalCities);
            setCities(finalCities);
          }
        } else if (isStaffSession()) {
          authedFetch('/api/system-collections/cities', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: cities })
          }).catch(() => {});
        }

        if (Object.prototype.hasOwnProperty.call(cols, 'agencies') && Array.isArray(cols.agencies)) {
          recordLoaded('agencies', cols.agencies);
          setAgencies(cols.agencies);
        } else if (isStaffSession()) {
          authedFetch('/api/system-collections/agencies', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: agencies })
          }).catch(() => {});
        }

        const hydrateUserArrayCollection = <T extends { id?: string }>(
          key: string,
          serverVal: unknown,
          storageKey: string,
          setter: React.Dispatch<React.SetStateAction<T[]>>
        ) => {
          // Never overwrite collections that the user already edited in this active session
          if (dirtyCollectionsRef.current.has(key)) return;
          if (!Object.prototype.hasOwnProperty.call(cols, key) || !Array.isArray(serverVal)) return;
          if (!hasHydratedCollectionsRef.current && serverVal.length === 0) {
            try {
              const rawLocal = typeof window !== 'undefined' ? localStorage.getItem(storageKey) : null;
              const parsedLocal = rawLocal ? JSON.parse(rawLocal) : null;
              const localReal = Array.isArray(parsedLocal)
                ? parsedLocal.filter((item: any) => !isLegacyDemoRecord(item))
                : [];
              if (localReal.length > 0) {
                recordLoaded(key, localReal);
                setter(localReal);
                if (isStaffSession()) {
                  authedFetch(`/api/system-collections/${encodeURIComponent(key)}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ value: localReal })
                  }).catch(() => {});
                }
                return;
              }
            } catch {}
          }
          recordLoaded(key, serverVal);
          setter(serverVal as T[]);
        };

        hydrateUserArrayCollection('vehicles', cols.vehicles, STORAGE_KEYS.VEHICLES, setVehicles);
        if (!dirtyCollectionsRef.current.has('partners') && Object.prototype.hasOwnProperty.call(cols, 'partners') && Array.isArray(cols.partners) && cols.partners.length > 0) {
          recordLoaded('partners', cols.partners);
          setPartners(prev => (prev.length === 0 ? cols.partners : prev));
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'partnerSyncLogs') && Array.isArray(cols.partnerSyncLogs)) {
          recordLoaded('partnerSyncLogs', cols.partnerSyncLogs);
          setPartnerSyncLogs(cols.partnerSyncLogs);
        }
        hydrateUserArrayCollection('pickups', cols.pickups, STORAGE_KEYS.PICKUPS, setPickups);
        hydrateUserArrayCollection('payments', cols.payments, STORAGE_KEYS.PAYMENTS, setPayments);
        hydrateUserArrayCollection('clientDebts', cols.clientDebts, STORAGE_KEYS.CLIENT_DEBTS, setClientDebts);
        hydrateUserArrayCollection('transferReceipts', cols.transferReceipts, STORAGE_KEYS.TRANSFER_RECEIPTS, setTransferReceipts);
        hydrateUserArrayCollection('bons', cols.bons, STORAGE_KEYS.BONS, setBons);
        // Merge stockLocations safely so locally saved warehouse stock never disappears on server restart
        if (Object.prototype.hasOwnProperty.call(cols, 'stockLocations') && Array.isArray(cols.stockLocations)) {
          const deletedLocIds = readDeletedIdSet(STORAGE_KEYS.STOCK_LOCATIONS_DELETED_IDS);
          let localLocs: StockLocationItem[] = [];
          try {
            const rawLocal = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.STOCK_LOCATIONS) : null;
            const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
            if (Array.isArray(parsedLocal)) {
              localLocs = parsedLocal.filter(
                (item: any) => item?.id && !deletedLocIds.has(item.id) && !isLegacyDemoRecord(item)
              );
            }
          } catch {}
          const serverLocs = (cols.stockLocations as StockLocationItem[]).filter(
            item => item?.id && !deletedLocIds.has(item.id)
          );
          const serverIds = new Set(serverLocs.map(l => l.id));
          const missingLocal = localLocs.filter(l => !serverIds.has(l.id));
          const mergedLocs = [...serverLocs, ...missingLocal];
          recordLoaded('stockLocations', mergedLocs);
          setStockLocations(mergedLocs);
          if (missingLocal.length > 0 && isStaffSession()) {
            authedFetch('/api/system-collections/stockLocations', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: mergedLocs })
            }).catch(() => {});
          }
        } else if (isStaffSession()) {
          // Server has no stockLocations key yet — push local stockLocations if present
          try {
            const rawLocal = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEYS.STOCK_LOCATIONS) : null;
            const parsedLocal = rawLocal ? JSON.parse(rawLocal) : [];
            const deletedLocIds = readDeletedIdSet(STORAGE_KEYS.STOCK_LOCATIONS_DELETED_IDS);
            const localLocs = Array.isArray(parsedLocal)
              ? parsedLocal.filter((item: any) => item?.id && !deletedLocIds.has(item.id) && !isLegacyDemoRecord(item))
              : [];
            if (localLocs.length > 0) {
              recordLoaded('stockLocations', localLocs);
              setStockLocations(localLocs);
              authedFetch('/api/system-collections/stockLocations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ value: localLocs })
              }).catch(() => {});
            }
          } catch {}
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'savedAddresses') && Array.isArray(cols.savedAddresses)) {
          recordLoaded('savedAddresses', cols.savedAddresses);
          setSavedAddresses(cols.savedAddresses);
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'notifications') && Array.isArray(cols.notifications)) {
          recordLoaded('notifications', cols.notifications);
          setNotifications(cols.notifications);
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'auditLogs') && Array.isArray(cols.auditLogs)) {
          recordLoaded('auditLogs', cols.auditLogs);
          setAuditLogs(cols.auditLogs);
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'employees') && Array.isArray(cols.employees)) {
          recordLoaded('employees', cols.employees);
          setUsers(prev => {
            const external = prev.filter(u => u.role !== 'employee' && u.role !== 'admin' && u.role !== 'super_admin');
            return [...cols.employees, ...external];
          });
        }
        if (Object.prototype.hasOwnProperty.call(cols, 'clientCustomRates') && cols.clientCustomRates) {
          recordLoaded('clientCustomRates', cols.clientCustomRates);
          try {
            localStorage.setItem(STORAGE_KEYS.CLIENT_CUSTOM_RATES, JSON.stringify(cols.clientCustomRates));
          } catch {}
          const rateMap = cols.clientCustomRates as Record<string, Record<string, number>>;
          setUsers(prev =>
            prev.map(u => (u.role === 'client' ? { ...u, customRates: rateMap[u.id] || u.customRates || {} } : u))
          );
        }

        // Hydrate user-scoped saved addresses & role-scoped pickups/bons cleanly
        try {
          const addrRes = await authedFetch('/api/saved-addresses');
          if (addrRes.ok) {
            const addrData = await addrRes.json().catch(() => null);
            if (addrData?.success && Array.isArray(addrData.addresses)) {
              recordLoaded('savedAddresses', addrData.addresses);
              setSavedAddresses(addrData.addresses);
            }
          }
        } catch {}

        hasHydratedCollectionsRef.current = true;
      }
    } catch {
      // Allow future user saves even if initial hydration failed transiently
      if (hasActiveAuthSession()) {
        hasHydratedCollectionsRef.current = true;
      }
    } finally {
      if (hasActiveAuthSession()) {
        hasHydratedCollectionsRef.current = true;
        const pendingEntries = Object.entries(pendingSyncCollectionsRef.current);
        pendingSyncCollectionsRef.current = {};
        if (pendingEntries.length > 0 && isStaffSession()) {
          for (const [pKey, pVal] of pendingEntries) {
            try {
              lastSyncedCollectionJsonRef.current[pKey] = JSON.stringify(pVal);
            } catch {}
            authedFetch(`/api/system-collections/${encodeURIComponent(pKey)}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ value: pVal })
            }).catch(() => {});
          }
        }
      }
    }
  }, []);

  // Load company settings & reviews publicly; load protected data only when authenticated
  const loadAuthenticatedAppState = useCallback(() => {
    if (!hasActiveAuthSession()) return;
    hydrateServerCollections();

    authedFetch('/api/company-settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && data.settings) {
          setCompanySettings(prev => ({ ...prev, ...data.settings }));
          try {
            localStorage.setItem(STORAGE_KEYS.COMPANY_SETTINGS, JSON.stringify(data.settings));
          } catch {}
        }
      })
      .catch(() => {});

    const fetchServerMessages = async () => {
      try {
        const res = await authedFetch('/api/client-messages');
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.messages)) {
            const cleanMessages = data.messages.filter(
              (m: ClientMessage) => !isLegacyDemoRecord(m, ['msg-1', 'msg-2', 'msg-3'])
            );
            lastSyncedCollectionJsonRef.current['clientMessages'] = JSON.stringify(cleanMessages);
            setClientMessages(cleanMessages);
          }
        }
      } catch {
        // Fallback to local state
      }
    };
    fetchServerMessages();
    refreshPartners();
    refreshReviews();
    refreshBlacklist();
    refreshClientStock();
    refreshWhatsappLogs();
    refreshPackages();
  }, [hydrateServerCollections, refreshPartners, refreshReviews, refreshBlacklist, refreshClientStock, refreshWhatsappLogs]);

  useEffect(() => {
    // Public company branding, public city rates & public reviews load on all screens
    authedFetch('/api/company-settings')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && data.settings) {
          setCompanySettings(prev => ({ ...prev, ...data.settings }));
        }
      })
      .catch(() => {});

    directSupabaseRequest('public/cities')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && Array.isArray(data.cities) && data.cities.length > 0) {
          setCities(prev => {
            const localIsCustomized = prev.length > 0 && !areCitiesEqualToInitial(prev);
            if (localIsCustomized && !data.customized) {
              return prev;
            }
            return data.cities;
          });
        }
      })
      .catch(() => {});

    refreshReviews();
    loadAuthenticatedAppState();
  }, [loadAuthenticatedAppState, refreshReviews, areCitiesEqualToInitial]);

  // Inbound partner packages are synced directly via Supabase packages table + Realtime (no 7s polling storm)

  // Clean legacy localStorage packages key on mount
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEYS.PACKAGES);
    } catch {}
  }, []);

  // Étape 89 : Synchronisation en temps réel des changements de statut des colis (Supabase Realtime & CrossTab)
  useEffect(() => {
    const unsubscribe = supabaseRealtime.onPackageStatusChanged(event => {
      setPackages(prev =>
        prev.map(p => {
          if (p.id !== event.packageId && p.trackingNumber !== event.trackingNumber) return p;
          const nextStatus = event.newStatus as PackageStatus;
          const existingHist = Array.isArray(p.history) ? p.history : [];
          const lastHist = existingHist[existingHist.length - 1];
          const shouldAppendHistory = !lastHist || lastHist.status !== nextStatus;
          const nextHistory = shouldAppendHistory
            ? [
                ...existingHist,
                {
                  id: `h-rt-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
                  timestamp: event.timestamp || getNowFormatted(),
                  status: nextStatus,
                  statusLabel: event.newStatusLabel || PACKAGE_STATUS_CONFIG[nextStatus]?.label || nextStatus,
                  updatedBy: event.updatedBy || 'Suivi Temps Réel',
                  role: 'admin' as UserRole,
                  location: p.currentAgency || event.city || 'Maroc',
                  comment: `Mise à jour en direct : ${event.newStatusLabel || nextStatus}`
                }
              ]
            : existingHist;

          return {
            ...p,
            status: nextStatus,
            lastMovedAt: event.timestamp || new Date().toISOString(),
            history: nextHistory
          };
        })
      );
    });
    return () => unsubscribe();
  }, []);

  // Monitor newly incoming packages in real-time to trigger browser tab title & sound
  useEffect(() => {
    if (!isInitialPackagesLoaded.current) {
      if (packages.length > 0) {
        packages.forEach(p => knownPackageIds.current.add(p.id));
        isInitialPackagesLoaded.current = true;
      }
      return;
    }

    const newlyAdded = packages.filter(p => !knownPackageIds.current.has(p.id));
    if (newlyAdded.length > 0) {
      newlyAdded.forEach(p => knownPackageIds.current.add(p.id));
      triggerNewOrderNotification(newlyAdded[0].trackingNumber, newlyAdded[0].recipientName);
    }
  }, [packages, triggerNewOrderNotification]);

  // Sync clients, drivers, and driver registrations ONLY for authenticated staff sessions & on auth changes
  useEffect(() => {
    let isCancelled = false;

    async function syncStaffDirectories() {
      if (!hasActiveAuthSession() || !isStaffSession()) return;
      try {
        const [clientsRes, driversRes, driverReqResp] = await Promise.all([
          fetchSupabaseClients().catch(() => ({ error: 'err', clients: [] as UserProfile[] })),
          fetchSupabaseDrivers().catch(() => ({ error: 'err', drivers: [] as UserProfile[] })),
          authedFetch('/api/driver-registrations').catch(() => null)
        ]);

        if (!isCancelled && !clientsRes.error && Array.isArray(clientsRes.clients)) {
          const storedRates = getStoredCustomRates();
          const clientsWithRates = clientsRes.clients.map(c => ({
            ...c,
            customRates: storedRates[c.id] || c.customRates || {}
          }));
          setUsers(prev => {
            const nonClients = prev.filter(u => u.role !== 'client');
            return [...nonClients, ...clientsWithRates];
          });
        }

        if (!isCancelled && !driversRes.error && Array.isArray(driversRes.drivers)) {
          setUsers(prev => {
            const nonDrivers = prev.filter(u => u.role !== 'driver');
            return [...nonDrivers, ...driversRes.drivers];
          });
        }

        if (!isCancelled && driverReqResp && driverReqResp.ok) {
          const json = await driverReqResp.json().catch(() => ({}));
          const rawList = Array.isArray(json.requests)
            ? json.requests
            : Array.isArray(json.data)
            ? json.data
            : null;
          if (json.success && rawList) {
            setDriverRequests(prev => {
              const localByEmail = new Map(prev.map(r => [String(r.email || '').toLowerCase(), r]));
              const merged: DriverRegistrationRequest[] = rawList.map((srv: DriverRegistrationRequest) => {
                const local = localByEmail.get(String(srv.email || '').toLowerCase());
                return {
                  ...srv,
                  cinPhotoUrl: srv.cinPhotoUrl || local?.cinPhotoUrl,
                  cinBackPhotoUrl: srv.cinBackPhotoUrl || local?.cinBackPhotoUrl,
                  driverPhotoUrl: srv.driverPhotoUrl || local?.driverPhotoUrl,
                  password: local?.password || srv.password
                };
              });
              const serverEmails = new Set(merged.map(m => String(m.email || '').toLowerCase()));
              const localOnly = prev.filter(r => !serverEmails.has(String(r.email || '').toLowerCase()));
              return [...merged, ...localOnly];
            });
          }
        }
      } catch (err) {
        console.warn('[DatabaseContext] Staff directory sync notice:', err);
      }
    }

    syncStaffDirectories();

    const handleAuthChanged = () => {
      if (hasActiveAuthSession()) {
        loadAuthenticatedAppState();
        syncStaffDirectories();
      } else {
        hasHydratedCollectionsRef.current = false;
        dirtyCollectionsRef.current.clear();
        pendingSyncCollectionsRef.current = {};
        recentlyUpdatedPackagesRef.current.clear();
        knownPackageIds.current.clear();
        setPackages([]);
        setClientMessages([]);
        setClientStockProducts([]);
        setClientStockMovements([]);
        setClientStockInvoices([]);
        setWhatsappLogs([]);
        setBlacklistEntries([]);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('fariousy_auth_changed', handleAuthChanged);
    }

    return () => {
      isCancelled = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('fariousy_auth_changed', handleAuthChanged);
      }
    };
  }, [loadAuthenticatedAppState]);

  useEffect(() => {
    // Only persist internal non-client and non-driver users in localStorage & server
    const internalUsers = users.filter(u => u.role !== 'client' && u.role !== 'driver');
    safeStorageSet(STORAGE_KEYS.USERS, JSON.stringify(internalUsers));
    syncCollectionToServer('employees', internalUsers);
  }, [users, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.CITIES, JSON.stringify(cities));
    syncCollectionToServer('cities', cities);
  }, [cities, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.PICKUPS, JSON.stringify(pickups));
    syncCollectionToServer('pickups', pickups);
  }, [pickups, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.PARTNERS, JSON.stringify(partners));
  }, [partners]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.AGENCIES, JSON.stringify(agencies));
    syncCollectionToServer('agencies', agencies);
  }, [agencies, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.VEHICLES, JSON.stringify(vehicles));
    syncCollectionToServer('vehicles', vehicles);
  }, [vehicles, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.PAYMENTS, JSON.stringify(payments));
    syncCollectionToServer('payments', payments);
  }, [payments, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.NOTIFICATIONS, JSON.stringify(notifications.slice(0, 80)));
    syncCollectionToServer('notifications', notifications);
  }, [notifications, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.AUDIT_LOGS, JSON.stringify(auditLogs.slice(0, 100)));
    syncCollectionToServer('auditLogs', auditLogs);
  }, [auditLogs, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.COMPANY_SETTINGS, JSON.stringify(companySettings));
  }, [companySettings]);

  useEffect(() => {
    if (!hasActiveAuthSession()) return;
    safeStorageSet(STORAGE_KEYS.STOCK_LOCATIONS, JSON.stringify(stockLocations));
    syncCollectionToServer('stockLocations', stockLocations);
  }, [stockLocations, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.CLIENT_DEBTS, JSON.stringify(clientDebts));
    syncCollectionToServer('clientDebts', clientDebts);
  }, [clientDebts, syncCollectionToServer]);

  useEffect(() => {
    safeStorageSet(STORAGE_KEYS.TRANSFER_RECEIPTS, JSON.stringify(transferReceipts));
    syncCollectionToServer('transferReceipts', transferReceipts);
  }, [transferReceipts, syncCollectionToServer]);

  const getNowFormatted = () => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  // Helper for recording audit logs
  const addAuditLog = (log: Omit<AuditLogItem, 'id' | 'timestamp'>) => {
    const newLog: AuditLogItem = {
      ...log,
      id: 'log-' + Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString()
    };
    startTransition(() => {
      setAuditLogs(prev => [newLog, ...prev.slice(0, 99)]);
    });

    // Also sync to Supabase audit_logs table
    supabaseRealtime.syncRecord('audit_logs', 'insert', newLog);
  };

  const clearAuditLogs = () => {
    setAuditLogs([]);
  };

  // ---------------------------------------------------------------------------
  // PACKAGE OPERATIONS (CRUD + Safety)
  // ---------------------------------------------------------------------------
  const persistOptimisticPackageToSupabase = useCallback((tempPkg: PackageItem) => {
    createSupabasePackage({
      shopId: tempPkg.shopId || tempPkg.clientId || '',
      clientName: tempPkg.clientName,
      clientCompany: tempPkg.clientCompany,
      clientPhone: tempPkg.clientPhone,
      recipientName: tempPkg.recipientName,
      recipientPhone: tempPkg.recipientPhone,
      city: tempPkg.city,
      address: tempPkg.address,
      description: tempPkg.description,
      productPrice: tempPkg.productPrice,
      deliveryFee: tempPkg.deliveryFee,
      codAmount: tempPkg.codAmount,
      notes: tempPkg.notes,
      allowOpen: tempPkg.allowOpen,
      allowTry: tempPkg.allowTry,
      isFragile: tempPkg.isFragile,
      isExchange: tempPkg.isExchange,
      exchangeTrackingNumber: tempPkg.exchangeTrackingNumber,
      exchangeReason: tempPkg.exchangeReason,
      exchangeItemDescription: tempPkg.exchangeItemDescription,
      stockLocationId: tempPkg.stockLocationId,
      stockPosition: tempPkg.stockPosition
    })
      .then(async res => {
        if (res.success && res.package) {
          const savedPkg = res.package;
          recentlyCreatedPackagesRef.current = [
            { pkg: savedPkg, savedAt: Date.now() },
            ...recentlyCreatedPackagesRef.current.filter(
              x => x.pkg.id !== tempPkg.id && x.pkg.id !== savedPkg.id
            )
          ];
          setPackages(prev =>
            prev.map(p => (p.id === tempPkg.id ? { ...p, ...savedPkg } : p))
          );
        } else {
          // Fallback: persist in Supabase auxiliary_state.packages so it survives reload
          await patchAuxiliaryState(aux => {
            aux.packages = [tempPkg, ...(aux.packages || []).filter(p => p.id !== tempPkg.id)];
          }).catch(() => {});
        }
      })
      .catch(async () => {
        await patchAuxiliaryState(aux => {
          aux.packages = [tempPkg, ...(aux.packages || []).filter(p => p.id !== tempPkg.id)];
        }).catch(() => {});
      });
  }, []);

  const addPackage = (
    data: Omit<PackageItem, 'id' | 'trackingNumber' | 'createdAt' | 'lastMovedAt' | 'history' | 'isPaidToClient'>,
    currentUser?: { name: string; role: UserRole; id?: string }
  ): PackageItem => {
    const newId = 'pkg-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
    const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
    const trackingNumber = `FAR-${randomDigits}`;
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();

    const initialHistory: PackageHistoryItem = {
      id: 'h-' + Date.now(),
      timestamp: formattedNow,
      status: data.status,
      statusLabel: PACKAGE_STATUS_CONFIG[data.status]?.label || data.status,
      updatedBy: currentUser?.name || 'Système',
      role: currentUser?.role || 'admin',
      location: data.currentAgency || 'Hub Central Casablanca',
      comment: 'Création du colis dans le système'
    };

    const newPkg: PackageItem = {
      ...data,
      id: newId,
      trackingNumber,
      createdAt: isoNow,
      lastMovedAt: isoNow,
      isPaidToClient: false,
      history: [initialHistory]
    };

    upsertPackageLocal(newPkg);
    persistOptimisticPackageToSupabase(newPkg);

    addAuditLog({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'packages',
      entityId: newId,
      entityLabel: `Colis ${trackingNumber}`,
      details: `Création du colis pour ${data.recipientName} (${data.city}) — COD: ${data.codAmount} MAD`
    });

    addNotification({
      title: 'Nouveau colis créé',
      message: `${trackingNumber} enregistré pour ${data.recipientName} (${data.city}).`,
      type: 'info'
    });

    triggerNewOrderNotification(trackingNumber, data.recipientName);

    return newPkg;
  };

  const addMultiplePackages = (
    pkgsData: Array<Omit<PackageItem, 'id' | 'trackingNumber' | 'createdAt' | 'lastMovedAt' | 'history' | 'isPaidToClient'>>,
    currentUser?: { name: string; role: UserRole; id?: string }
  ): PackageItem[] => {
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();

    const createdList: PackageItem[] = pkgsData.map((data, idx) => {
      const newId = 'pkg-' + Date.now() + '-' + idx + '-' + Math.random().toString(36).slice(2, 5);
      const randomDigits = Math.floor(10000000 + Math.random() * 90000000);
      const trackingNumber = `FAR-${randomDigits}`;

      return {
        ...data,
        id: newId,
        trackingNumber,
        createdAt: isoNow,
        lastMovedAt: isoNow,
        isPaidToClient: false,
        history: [
          {
            id: 'h-' + Date.now() + '-' + idx,
            timestamp: formattedNow,
            status: data.status,
            statusLabel: PACKAGE_STATUS_CONFIG[data.status]?.label || data.status,
            updatedBy: currentUser?.name || 'Importateur',
            role: currentUser?.role || 'admin',
            location: data.currentAgency || 'Hub Central Casablanca',
            comment: 'Importation en masse'
          }
        ]
      };
    });

    const nowMs = Date.now();
    recentlyCreatedPackagesRef.current = [
      ...createdList.map(pkg => ({ pkg, savedAt: nowMs })),
      ...recentlyCreatedPackagesRef.current
    ];

    startTransition(() => {
      setPackages(prev => [...createdList, ...prev]);
    });

    // Persist each imported package to Supabase sequentially so nothing is lost on refresh
    (async () => {
      for (const tempPkg of createdList) {
        persistOptimisticPackageToSupabase(tempPkg);
        await new Promise(resolve => setTimeout(resolve, 60));
      }
    })();

    addAuditLog({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'packages',
      entityId: `bulk-${Date.now()}`,
      entityLabel: `${createdList.length} colis importés`,
      details: `Importation réussie de ${createdList.length} colis en masse`
    });

    return createdList;
  };

  const updatePackage = (
    id: string,
    updates: Partial<PackageItem>,
    currentUser?: { name: string; role: UserRole; id?: string }
  ) => {
    const isoNow = new Date().toISOString();
    const oldPkg = packages.find(p => p.id === id);

    const prevPending = recentlyUpdatedPackagesRef.current.get(id)?.updates || {};
    recentlyUpdatedPackagesRef.current.set(id, {
      updates: { ...prevPending, ...updates, lastMovedAt: isoNow },
      savedAt: Date.now()
    });

    recentlyCreatedPackagesRef.current = recentlyCreatedPackagesRef.current.map(entry =>
      entry.pkg.id === id ? { ...entry, pkg: { ...entry.pkg, ...updates, lastMovedAt: isoNow } } : entry
    );

    setPackages(prev =>
      prev.map(p => {
        if (p.id !== id) return p;
        return {
          ...p,
          ...updates,
          lastMovedAt: isoNow
        };
      })
    );

    if (oldPkg) {
      addAuditLog({
        userId: currentUser?.id || 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'UPDATE',
        module: 'packages',
        entityId: id,
        entityLabel: `Colis ${oldPkg.trackingNumber}`,
        oldValue: JSON.stringify({ recipient: oldPkg.recipientName, cod: oldPkg.codAmount, status: oldPkg.status }),
        newValue: JSON.stringify(updates),
        details: `Modification des informations du colis ${oldPkg.trackingNumber}`
      });
    }

    authedFetch(`/api/packages/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    }).catch(() => {});
  };

  // Suppression réelle et définitive dans Supabase Production (public.packages) et état local (purge complète)
  const deletePackage = async (
    id: string,
    reason = 'Suppression demandée par administrateur',
    currentUser?: { name: string; role: UserRole; id?: string }
  ): Promise<{ success: boolean; message: string; archived?: boolean }> => {
    const target = packages.find(p => p.id === id || p.trackingNumber === id);
    const targetId = target?.id || id;
    const targetTracking = target?.trackingNumber || '';
    const removedCod = Number(target?.codAmount || 0);

    const apiRes = await deleteSupabasePackage(targetId);
    if (!apiRes.success) {
      return {
        success: false,
        message: apiRes.error || 'Échec de suppression du colis dans Supabase.'
      };
    }

    const matchKeys = new Set<string>(
      [id, targetId, targetTracking].map(v => String(v || '').trim().toUpperCase()).filter(Boolean)
    );
    const matchesDeleted = (val?: string | null): boolean => {
      if (!val) return false;
      return matchKeys.has(String(val).trim().toUpperCase());
    };

    // 1. Packages
    setPackages(prev => prev.filter(p => !matchesDeleted(p.id) && !matchesDeleted(p.trackingNumber)));
    knownPackageIds.current.delete(targetId);
    knownPackageIds.current.delete(id);

    // 2. Problem reports (localStorage)
    const probMap = getStoredProblemReports();
    if (probMap[targetId] || probMap[id] || (targetTracking && probMap[targetTracking])) {
      delete probMap[targetId];
      delete probMap[id];
      if (targetTracking) delete probMap[targetTracking];
      saveStoredProblemReports(probMap);
    }

    // 3. Bons (remove parcel from packageIds, update totals, drop bon if empty)
    setBons(prev => {
      const next: BonItem[] = [];
      for (const bon of prev) {
        if (!Array.isArray(bon.packageIds)) {
          next.push(bon);
          continue;
        }
        const filteredIds = bon.packageIds.filter(pid => !matchesDeleted(pid));
        if (filteredIds.length !== bon.packageIds.length) {
          if (filteredIds.length === 0) continue;
          const removedCount = bon.packageIds.length - filteredIds.length;
          next.push({
            ...bon,
            packageIds: filteredIds,
            totalPackages: filteredIds.length,
            totalCodAmount:
              typeof bon.totalCodAmount === 'number' && removedCod > 0
                ? Math.max(0, bon.totalCodAmount - removedCod * removedCount)
                : bon.totalCodAmount
          });
        } else {
          next.push(bon);
        }
      }
      return next;
    });

    // 4. Client Debts
    setClientDebts(prev => prev.filter(d => !matchesDeleted(d.packageId) && !matchesDeleted(d.trackingNumber)));

    // 5. Payments (unlink package ID from packageIds)
    setPayments(prev =>
      prev.map(p => {
        if (!Array.isArray(p.packageIds)) return p;
        const filteredIds = p.packageIds.filter(pid => !matchesDeleted(pid));
        if (filteredIds.length === p.packageIds.length) return p;
        return {
          ...p,
          packageIds: filteredIds,
          packageCount: filteredIds.length
        };
      })
    );

    // 6. Client Messages / Claims
    setClientMessages(prev =>
      prev.filter(m => !matchesDeleted(m.packageId) && !matchesDeleted(m.packageTrackingNumber))
    );

    // 7. Partner Sync Logs
    setPartnerSyncLogs(prev => {
      const next: PartnerSyncLog[] = [];
      for (const log of prev) {
        if (Array.isArray(log.trackingNumbers) && log.trackingNumbers.length > 0) {
          const filteredTrks = log.trackingNumbers.filter(t => !matchesDeleted(t));
          if (filteredTrks.length !== log.trackingNumbers.length) {
            if (filteredTrks.length === 0) continue;
            next.push({ ...log, trackingNumbers: filteredTrks, packageCount: filteredTrks.length });
            continue;
          }
        }
        next.push(log);
      }
      return next;
    });

    // 8. WhatsApp logs & in-app notifications mentioning this tracking
    setWhatsappLogs(prev =>
      prev.filter(l => !matchesDeleted((l as any).packageId) && !matchesDeleted((l as any).trackingNumber))
    );
    if (targetTracking) {
      const trkUpper = targetTracking.toUpperCase();
      setNotifications(prev =>
        prev.filter(n => !`${n.title || ''} ${n.message || ''}`.toUpperCase().includes(trkUpper))
      );
    }

    // 9. Refresh restored stock units & whatsapp logs from server
    refreshClientStock().catch(() => {});
    refreshWhatsappLogs().catch(() => {});

    addAuditLog({
      userId: currentUser?.id || 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'packages',
      entityId: targetId,
      entityLabel: `Colis ${targetTracking || targetId}`,
      details: `حذف نهائي للكوليا ${targetTracking || targetId} من كلشي (Motif : ${reason})`
    });

    return {
      success: true,
      archived: false,
      message: apiRes.message || `تم حذف الكوليا ${targetTracking || targetId} نهائياً من النظام بالكامل.`
    };
  };

  const changePackageStatus = async (
    packageId: string,
    newStatus: PackageStatus,
    comment?: string,
    location?: string,
    currentUser?: { name: string; role: UserRole },
    options?: { currentAgency?: string }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();
    const targetPkg = packages.find(p => p.id === packageId);
    const nextAgency = options?.currentAgency?.trim() || undefined;

    const prevPending = recentlyUpdatedPackagesRef.current.get(packageId)?.updates || {};
    recentlyUpdatedPackagesRef.current.set(packageId, {
      updates: {
        ...prevPending,
        status: newStatus,
        ...(nextAgency ? { currentAgency: nextAgency } : {}),
        ...(comment ? { driverComment: comment } : {}),
        lastMovedAt: isoNow
      },
      savedAt: Date.now()
    });

    // 1. Mise à jour optimiste de l'interface locale
    setPackages(prev =>
      prev.map(p => {
        if (p.id !== packageId) return p;

        const resolvedStatusLabel = PACKAGE_STATUS_CONFIG[newStatus]?.label || newStatus;
        const historyItem: PackageHistoryItem = {
          id: 'h-' + Date.now(),
          timestamp: formattedNow,
          status: newStatus,
          statusLabel: resolvedStatusLabel,
          updatedBy: currentUser?.name || 'Superviseur',
          role: currentUser?.role || 'admin',
          location: nextAgency || location || p.currentAgency,
          comment: comment || `Changement de statut vers ${resolvedStatusLabel}`
        };

        return {
          ...p,
          status: newStatus,
          ...(nextAgency ? { currentAgency: nextAgency } : {}),
          lastMovedAt: isoNow,
          history: [...p.history, historyItem]
        };
      })
    );

    const newStatusLabel = PACKAGE_STATUS_CONFIG[newStatus]?.label || newStatus;

    // 2. Persistance dans Supabase Production (public.packages)
    let supabaseResult: { success: boolean; message?: string; error?: string } = {
      success: true,
      message: `Statut passé à "${newStatusLabel}"`,
      error: undefined
    };
    try {
      const res = await updatePackageStatusInSupabase(
        packageId,
        newStatus,
        comment,
        nextAgency || location ? { currentAgency: nextAgency, location: nextAgency || location } : undefined
      );
      if (!res.success) {
        supabaseResult = { success: false, message: undefined, error: res.error };
        console.warn('[Supabase Status Update Notice]', res.error);
        addNotification({
          title: 'Avertissement enregistrement Supabase',
          message: res.error || "Impossible d'enregistrer le statut dans public.packages",
          type: 'alert'
        });
      } else {
        supabaseResult = {
          success: true,
          message: res.message || `Statut du colis mis à jour avec succès dans Supabase Production.`,
          error: undefined
        };
      }
    } catch (err: any) {
      supabaseResult = { success: false, message: undefined, error: err.message };
      console.warn('[Supabase Status Update Error]', err);
    }

    if (targetPkg) {
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'STATUS_CHANGE',
        module: 'packages',
        entityId: packageId,
        entityLabel: `Colis ${targetPkg.trackingNumber}`,
        oldValue: targetPkg.status,
        newValue: newStatus,
        details: comment || `Statut passé à ${newStatusLabel}`
      });

      supabaseRealtime.broadcastStatusChange({
        packageId,
        trackingNumber: targetPkg.trackingNumber,
        oldStatus: targetPkg.status,
        newStatus,
        newStatusLabel,
        recipientName: targetPkg.recipientName,
        city: targetPkg.city,
        updatedBy: currentUser?.name || 'Système',
        timestamp: formattedNow,
        codAmount: targetPkg.codAmount,
        clientId: targetPkg.clientId
      });

      // Automatic persisted real-time notification to the parcel's client (Merchant / Boutique)
      if (companySettings.enableAutoClientNotifications !== false && targetPkg.clientId) {
        const matchedClient = users.find(
          u => u.id === targetPkg.clientId || (Boolean(targetPkg.shopId) && u.id === targetPkg.shopId)
        );
        createAutoStatusNotification({
          clientId: targetPkg.clientId,
          clientEmail: matchedClient?.email,
          clientName: targetPkg.clientCompany || targetPkg.clientName || matchedClient?.name,
          trackingNumber: targetPkg.trackingNumber,
          recipientName: targetPkg.recipientName,
          city: targetPkg.city,
          codAmount: targetPkg.codAmount,
          newStatus,
          statusLabel: newStatusLabel,
          updatedBy: currentUser?.name || 'FARIOUSY Suivi Direct',
          comment
        }).catch(() => {});
      }

      // Dispatch WhatsApp API / Webhook notification if enabled and configured for this status
      const watchedStatuses =
        companySettings.whatsappNotifyStatuses && companySettings.whatsappNotifyStatuses.length > 0
          ? companySettings.whatsappNotifyStatuses
          : DEFAULT_WHATSAPP_WATCHED_STATUSES;
      if (
        companySettings.enableWhatsappAlerts !== false &&
        companySettings.autoWhatsappNotice !== false &&
        watchedStatuses.includes(newStatus)
      ) {
        const matchedClient = users.find(
          u => u.id === targetPkg.clientId || (Boolean(targetPkg.shopId) && u.id === targetPkg.shopId)
        );
        const merchantWaPhone = targetPkg.clientPhone || matchedClient?.whatsapp || matchedClient?.phone;
        const trackingUrl = buildLiveTrackingUrl(targetPkg.trackingNumber, companySettings.website);

        authedFetch('/api/notifications/whatsapp-dispatch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            packageId: targetPkg.id,
            trackingNumber: targetPkg.trackingNumber,
            trackingUrl,
            recipientName: targetPkg.recipientName,
            recipientPhone: targetPkg.recipientPhone,
            merchantPhone: merchantWaPhone,
            driverName: targetPkg.driverName,
            status: newStatus,
            statusLabel: newStatusLabel,
            city: targetPkg.city,
            codAmount: targetPkg.codAmount,
            provider: companySettings.whatsappProvider || 'webhook',
            phoneNumberId: companySettings.whatsappPhoneNumberId,
            notifyTarget: companySettings.whatsappNotifyTarget || 'both'
          })
        })
          .then(r => (r.ok ? r.json() : null))
          .then(resData => {
            if (resData?.log) {
              setWhatsappLogs(prev => [resData.log, ...prev].slice(0, 100));
            }
          })
          .catch(() => {});
      }
    }

    if (newStatus === 'annule') {
      restoreClientStockForPackage(packageId, targetPkg?.trackingNumber, currentUser?.name || 'Système').catch(() => {});
    }

    addNotification({
      title: 'Statut de colis mis à jour',
      message: `${targetPkg?.trackingNumber || 'Colis'} : Statut passé à "${newStatusLabel}" ${supabaseResult.success ? '(Enregistré dans Supabase)' : ''}`,
      type: newStatus === 'livre' ? 'success' : newStatus === 'refuse' || newStatus === 'annule' ? 'alert' : 'info'
    });

    return supabaseResult;
  };

  const assignPackageToDriver = async (
    packageId: string,
    driverId: string | null,
    driverName?: string,
    updateStatus: boolean = false,
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return assignMultiplePackagesToDriver([packageId], driverId, driverName, updateStatus, currentUser);
  };

  const assignMultiplePackagesToDriver = async (
    packageIds: string[],
    driverId: string | null,
    driverName?: string,
    updateStatus: boolean = false,
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();

    // 1. Optimistic local update
    setPackages(prev =>
      prev.map(p => {
        if (!packageIds.includes(p.id)) return p;

        const newStatus: PackageStatus =
          updateStatus && driverId
            ? 'en_cours_livraison'
            : updateStatus && !driverId && p.status === 'en_cours_livraison'
            ? 'en_stock'
            : p.status;
        const historyItem: PackageHistoryItem = {
          id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
          timestamp: formattedNow,
          status: newStatus,
          statusLabel: PACKAGE_STATUS_CONFIG[newStatus]?.label || newStatus,
          updatedBy: currentUser?.name || 'Superviseur',
          role: currentUser?.role || 'admin',
          location: p.currentAgency,
          comment: driverId
            ? `Colis affecté au livreur ${driverName || 'Livreur'}`
            : 'Colis retiré du livreur (désaffecté)'
        };

        return {
          ...p,
          driverId: driverId || undefined,
          driverName: driverId ? (driverName || 'Livreur') : undefined,
          status: newStatus,
          lastMovedAt: isoNow,
          history: [...p.history, historyItem]
        };
      })
    );

    // 2. Persist in Supabase Production (public.packages.driver_id)
    let result: { success: boolean; message?: string; error?: string } = {
      success: true,
      message: `${packageIds.length} colis affecté(s)`,
      error: undefined
    };

    try {
      const res = await assignPackagesToDriverInSupabase(packageIds, driverId, updateStatus);
      if (!res.success) {
        result = { success: false, message: undefined, error: res.error };
        addNotification({
          title: "Avertissement affectation Supabase",
          message: res.error || "Impossible d'enregistrer l'affectation dans public.packages",
          type: 'alert'
        });
      } else {
        result = {
          success: true,
          message: res.message || `${packageIds.length} colis affecté(s) avec succès dans Supabase Production.`,
          error: undefined
        };
      }
    } catch (err: any) {
      result = { success: false, message: undefined, error: err.message };
    }

    // 3. Audit log & Notifications
    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'packages',
      entityId: packageIds.join(','),
      entityLabel: `${packageIds.length} colis`,
      details: driverId
        ? `Affectation de ${packageIds.length} colis au livreur ${driverName || 'Livreur'}`
        : `Désaffectation de ${packageIds.length} colis`
    });

    addNotification({
      title: driverId ? 'Colis affecté(s) au livreur' : 'Colis désaffecté(s)',
      message: `${packageIds.length} colis : ${driverId ? `Affecté(s) à ${driverName || 'Livreur'}` : 'Désaffecté(s)'} ${result.success ? '(Enregistré dans Supabase)' : ''}`,
      type: 'info'
    });

    // 4. Broadcast live tracking update + automatic client & WhatsApp notifications when moving to en_cours_livraison
    if (updateStatus && driverId) {
      const affectedPkgs = packages.filter(p => packageIds.includes(p.id));
      const newStatusLabel = PACKAGE_STATUS_CONFIG.en_cours_livraison.label;
      const watchedStatuses =
        companySettings.whatsappNotifyStatuses && companySettings.whatsappNotifyStatuses.length > 0
          ? companySettings.whatsappNotifyStatuses
          : DEFAULT_WHATSAPP_WATCHED_STATUSES;

      affectedPkgs.forEach(pkg => {
        supabaseRealtime.broadcastStatusChange({
          packageId: pkg.id,
          trackingNumber: pkg.trackingNumber,
          oldStatus: pkg.status,
          newStatus: 'en_cours_livraison',
          newStatusLabel,
          recipientName: pkg.recipientName,
          city: pkg.city,
          updatedBy: currentUser?.name || driverName || 'Superviseur',
          timestamp: formattedNow,
          codAmount: pkg.codAmount,
          clientId: pkg.clientId
        });

        const matchedClient = users.find(
          u => u.id === pkg.clientId || (Boolean(pkg.shopId) && u.id === pkg.shopId)
        );

        if (companySettings.enableAutoClientNotifications !== false && pkg.clientId) {
          createAutoStatusNotification({
            clientId: pkg.clientId,
            clientEmail: matchedClient?.email,
            clientName: pkg.clientCompany || pkg.clientName || matchedClient?.name,
            trackingNumber: pkg.trackingNumber,
            recipientName: pkg.recipientName,
            city: pkg.city,
            codAmount: pkg.codAmount,
            newStatus: 'en_cours_livraison',
            statusLabel: newStatusLabel,
            updatedBy: currentUser?.name || 'Superviseur',
            comment: `Affecté au livreur ${driverName || 'Livreur'}`
          }).catch(() => {});
        }

        if (
          companySettings.enableWhatsappAlerts !== false &&
          companySettings.autoWhatsappNotice !== false &&
          watchedStatuses.includes('en_cours_livraison')
        ) {
          const trackingUrl = buildLiveTrackingUrl(pkg.trackingNumber, companySettings.website);
          authedFetch('/api/notifications/whatsapp-dispatch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              packageId: pkg.id,
              trackingNumber: pkg.trackingNumber,
              trackingUrl,
              recipientName: pkg.recipientName,
              recipientPhone: pkg.recipientPhone,
              merchantPhone: pkg.clientPhone || matchedClient?.whatsapp || matchedClient?.phone,
              driverName: driverName || pkg.driverName,
              status: 'en_cours_livraison',
              statusLabel: newStatusLabel,
              city: pkg.city,
              codAmount: pkg.codAmount,
              provider: companySettings.whatsappProvider || 'webhook',
              phoneNumberId: companySettings.whatsappPhoneNumberId,
              notifyTarget: companySettings.whatsappNotifyTarget || 'both'
            })
          })
            .then(r => (r.ok ? r.json() : null))
            .then(resData => {
              if (resData?.log) {
                setWhatsappLogs(prev => [resData.log, ...prev].slice(0, 100));
              }
            })
            .catch(() => {});
        }
      });
    }

    return result;
  };

  const updatePackageStatus = async (
    packageId: string,
    status: string,
    comment?: string,
    callProofUrl?: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      let normalizedStatus: PackageStatus = 'reporte';
      const s = (status || '').toLowerCase();
      if (s === 'delivered' || s === 'livre') {
        normalizedStatus = 'livre';
      } else if (s === 'refused' || s === 'refuse') {
        normalizedStatus = 'refuse';
      } else if (s === 'cancelled' || s === 'annule') {
        normalizedStatus = 'annule';
      } else if (s === 'postponed' || s === 'reporte' || s === 'no_answer' || s === 'unreachable' || s === 'bad_address' || s === 'traveling') {
        normalizedStatus = 'reporte';
      } else if (PACKAGE_STATUS_CONFIG[s as PackageStatus]) {
        normalizedStatus = s as PackageStatus;
      }

      setPackages(prev =>
        prev.map(p =>
          p.id === packageId
            ? {
                ...p,
                status: normalizedStatus,
                driverComment: comment || p.driverComment,
                callProofUrl: callProofUrl || p.callProofUrl,
                lastMovedAt: new Date().toISOString()
              }
            : p
        )
      );

      const statusNote = comment || `Statut mis à jour par le livreur : ${status}`;
      const res = await changePackageStatus(packageId, normalizedStatus, statusNote, undefined, {
        name: 'Livreur',
        role: 'driver'
      });

      if (supabaseClient) {
        try {
          await supabaseClient
            .from('packages')
            .update({
              driver_comment: comment || null,
              call_proof_url: callProofUrl || null,
              status: normalizedStatus,
              updated_at: new Date().toISOString()
            })
            .eq('id', packageId);
        } catch (dbErr) {
          console.warn('[updatePackageStatus details sync notice]', dbErr);
        }
      }

      return { success: res.success, error: res.error };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la mise à jour de la livraison.' };
    }
  };

  const reportPackageProblem = async (params: {
    packageId: string;
    category: string;
    categoryLabel: string;
    description: string;
    photoBase64?: string;
    reportedBy?: { id?: string; name: string; role: UserRole };
  }): Promise<{ success: boolean; error?: string }> => {
    const { packageId, category, categoryLabel, description, photoBase64, reportedBy } = params;
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();
    const report: PackageProblemReport = {
      id: `prob-${Date.now()}`,
      category,
      categoryLabel,
      description,
      photoBase64,
      reportedBy: reportedBy?.name || 'Livreur',
      reportedById: reportedBy?.id,
      reportedAt: isoNow,
      resolved: false
    };

    const currentMap = getStoredProblemReports();
    currentMap[packageId] = report;
    const matchedPkg = packages.find(p => p.id === packageId);
    const targetTracking = matchedPkg?.trackingNumber || packageId;
    if (matchedPkg?.trackingNumber) {
      currentMap[matchedPkg.trackingNumber] = report;
    }

    setPackages(prev =>
      prev.map(p => {
        if (p.id !== packageId) return p;
        const historyItem: PackageHistoryItem = {
          id: 'h-' + Date.now(),
          timestamp: formattedNow,
          status: 'probleme_livraison',
          statusLabel: PACKAGE_STATUS_CONFIG.probleme_livraison.label,
          updatedBy: reportedBy?.name || 'Livreur',
          role: reportedBy?.role || 'driver',
          location: p.city || p.currentAgency,
          comment: `[${categoryLabel}] ${description}`,
          photoUrl: photoBase64
        };
        return {
          ...p,
          status: 'probleme_livraison',
          driverComment: description,
          callProofUrl: photoBase64 || p.callProofUrl,
          problemReport: report,
          lastMovedAt: isoNow,
          history: [...p.history, historyItem]
        };
      })
    );

    saveStoredProblemReports(currentMap);

    addNotification({
      title: `🚨 مشكلة في التوصيل (${targetTracking})`,
      message: `${reportedBy?.name || 'السائق'} بلّغ على مشكلة: ${categoryLabel} — ${description}`,
      type: 'alert',
      targetRole: 'admin'
    });

    addAuditLog({
      userId: reportedBy?.id || 'usr-driver',
      userName: reportedBy?.name || 'Livreur',
      userRole: reportedBy?.role || 'driver',
      actionType: 'STATUS_CHANGE',
      module: 'packages',
      entityId: packageId,
      entityLabel: `Colis ${targetTracking}`,
      newValue: 'probleme_livraison',
      details: `Signalement problème (${categoryLabel}): ${description}${photoBase64 ? ' [Photo jointe]' : ''}`
    });

    try {
      await authedFetch('/api/problem-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, report })
      });
      await updatePackageStatusInSupabase(
        packageId,
        'probleme_livraison',
        `[${categoryLabel}] ${description}`,
        { problemReport: report, callProofUrl: photoBase64 }
      );
      return { success: true };
    } catch (err: any) {
      return { success: true, error: err?.message };
    }
  };

  const resolvePackageProblem = async (
    packageId: string,
    adminNote?: string,
    resolvedBy: string = 'Administrateur'
  ): Promise<{ success: boolean }> => {
    const isoNow = new Date().toISOString();
    const formattedNow = getNowFormatted();
    const currentMap = getStoredProblemReports();
    const targetPkg = packages.find(p => p.id === packageId);
    const resolvedReport: PackageProblemReport | undefined =
      targetPkg?.problemReport || currentMap[packageId] || (targetPkg ? currentMap[targetPkg.trackingNumber] : undefined)
        ? {
            ...(targetPkg?.problemReport || currentMap[packageId] || currentMap[targetPkg!.trackingNumber]),
            resolved: true,
            resolvedAt: isoNow,
            resolvedBy,
            adminNote: adminNote || targetPkg?.problemReport?.adminNote
          }
        : undefined;

    if (resolvedReport) {
      currentMap[packageId] = resolvedReport;
      if (targetPkg?.trackingNumber) {
        currentMap[targetPkg.trackingNumber] = resolvedReport;
      }
    }
    saveStoredProblemReports(currentMap);

    setPackages(prev =>
      prev.map(p => {
        if (p.id !== packageId) return p;
        const historyItem: PackageHistoryItem = {
          id: 'h-' + Date.now(),
          timestamp: formattedNow,
          status: p.status === 'probleme_livraison' ? 'en_cours_livraison' : p.status,
          statusLabel: 'Problème traité par administration',
          updatedBy: resolvedBy,
          role: 'admin',
          location: p.currentAgency,
          comment: adminNote || 'تمت معالجة مشكلة التوصيل من طرف الإدارة'
        };
        return {
          ...p,
          status: p.status === 'probleme_livraison' ? 'en_cours_livraison' : p.status,
          problemReport: resolvedReport || p.problemReport,
          lastMovedAt: isoNow,
          history: [...p.history, historyItem]
        };
      })
    );

    try {
      await authedFetch(`/api/problem-reports/${encodeURIComponent(packageId)}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolvedBy, adminNote })
      });
      await updatePackageStatusInSupabase(
        packageId,
        'en_cours_livraison',
        adminNote || 'Problème résolu par administration'
      );
    } catch {}

    return { success: true };
  };

  const addSavedAddress = (
    addr: Omit<SavedAddress, 'id' | 'createdAt' | 'usageCount'>
  ): SavedAddress => {
    const newAddr: SavedAddress = {
      ...addr,
      id: `addr-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      usageCount: 0,
      createdAt: new Date().toISOString()
    };
    setSavedAddresses(prev => [newAddr, ...prev]);
    return newAddr;
  };

  const updateSavedAddress = (id: string, updates: Partial<SavedAddress>) => {
    setSavedAddresses(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));
  };

  const deleteSavedAddress = (id: string) => {
    setSavedAddresses(prev => prev.filter(a => a.id !== id));
  };

  const markSavedAddressUsed = (id: string) => {
    const now = new Date().toISOString();
    setSavedAddresses(prev =>
      prev.map(a =>
        a.id === id
          ? { ...a, usageCount: (a.usageCount || 0) + 1, lastUsedAt: now }
          : a
      )
    );
  };

  const transferPackageToPartner = async (
    packageId: string,
    partnerName: string,
    partnerTrackingId: string,
    partnerId?: string,
    partnerFee?: number
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const isoNow = new Date().toISOString();
      const targetPkg = packages.find(p => p.id === packageId);

      setPackages(prev =>
        prev.map(p =>
          p.id === packageId
            ? {
                ...p,
                isTransferredToPartner: true,
                partnerId: partnerId || p.partnerId,
                partnerName,
                partnerTrackingId,
                partnerDeliveryFee: partnerFee !== undefined ? partnerFee : p.partnerDeliveryFee,
                destinationAgency: partnerName,
                status: 'en_transit',
                lastMovedAt: isoNow
              }
            : p
        )
      );

      await authedFetch(`/api/packages/${encodeURIComponent(packageId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isTransferredToPartner: true,
          partnerId: partnerId || targetPkg?.partnerId,
          partnerName,
          partnerTrackingId,
          partnerDeliveryFee: partnerFee !== undefined ? partnerFee : targetPkg?.partnerDeliveryFee,
          destinationAgency: partnerName,
          status: 'en_transit',
          lastMovedAt: isoNow
        })
      }).catch(() => {});

      addNotification({
        title: 'Colis transféré au partenaire',
        message: `Le colis a été transféré à ${partnerName} (N° de suivi : ${partnerTrackingId}).`,
        type: 'info'
      });

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const transferPackageAgency = (
    packageId: string,
    targetAgency: string,
    partnerId?: string,
    comment?: string,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const formattedNow = getNowFormatted();
    const isoNow = new Date().toISOString();
    const targetPkg = packages.find(p => p.id === packageId);
    const historyItem: PackageHistoryItem = {
      id: 'h-' + Date.now(),
      timestamp: formattedNow,
      status: 'en_transit',
      statusLabel: PACKAGE_STATUS_CONFIG['en_transit'].label,
      updatedBy: currentUser?.name || 'Agent Opérations',
      role: currentUser?.role || 'employee',
      location: targetPkg?.currentAgency || 'Hub Central',
      comment: comment || `Transfert en transit vers ${targetAgency}`
    };

    setPackages(prev =>
      prev.map(p => {
        if (p.id !== packageId) return p;
        return {
          ...p,
          destinationAgency: targetAgency,
          partnerId: partnerId || p.partnerId,
          status: 'en_transit',
          lastMovedAt: isoNow,
          history: [...p.history, historyItem]
        };
      })
    );

    authedFetch(`/api/packages/${encodeURIComponent(packageId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destinationAgency: targetAgency,
        partnerId: partnerId || targetPkg?.partnerId,
        status: 'en_transit',
        lastMovedAt: isoNow,
        historyEntry: historyItem
      })
    }).catch(() => {});
  };

  const scanBarcodeAction = (
    trackingNumber: string,
    action: 'reception_stock' | 'depart_livraison' | 'arrivee_agence' | 'marquer_livre' | 'marquer_retour',
    extra?: { driverId?: string; driverName?: string; agencyName?: string; agencyId?: string; location?: string; comment?: string },
    currentUser?: { name: string; role: UserRole }
  ): { success: boolean; message: string; packageItem?: PackageItem } => {
    const rawTrimmed = String(trackingNumber || '').trim();
    const upperRaw = rawTrimmed.toUpperCase();
    // Extract tracking code if scanned from a QR URL or formatted thermal ticket payload
    const farMatch = upperRaw.match(/(?:FAR|COL|PKG|FSU|SKU)-[A-Z0-9-]+/);
    const cleanNumber = (farMatch ? farMatch[0] : upperRaw.split(/[\s?&#/]+/).pop() || upperRaw).trim();

    const pkg = packages.find(p => {
      const trk = (p.trackingNumber || '').trim().toUpperCase();
      const pid = (p.id || '').trim().toUpperCase();
      const partnerTrk = (p.partnerTrackingId || p.partnerTrackingNumber || '').trim().toUpperCase();
      return (
        trk === cleanNumber ||
        trk === upperRaw ||
        pid === cleanNumber ||
        pid === upperRaw ||
        (partnerTrk && (partnerTrk === cleanNumber || partnerTrk === upperRaw)) ||
        (cleanNumber.length >= 6 && (trk.includes(cleanNumber) || upperRaw.includes(trk)))
      );
    });

    if (!pkg) {
      supabaseRealtime.playAudioNotification('alert');
      return { success: false, message: `الكوليا ${cleanNumber} غير موجودة في النظام.` };
    }

    const selectedAgencyName = (extra?.agencyName || extra?.location || '').trim();
    let targetStatus: PackageStatus = pkg.status;
    let updatedAgency: string | undefined = undefined;
    let comment = extra?.comment || '';

    switch (action) {
      case 'reception_stock':
        targetStatus = 'en_stock';
        updatedAgency = selectedAgencyName || pkg.currentAgency || agencies[0]?.name || 'Hub Central Casablanca';
        comment = comment || `تم استلام الكوليا عبر السكان — موجودة الآن في الأجونص: ${updatedAgency}`;
        break;
      case 'depart_livraison':
        targetStatus = 'en_cours_livraison';
        updatedAgency = selectedAgencyName || pkg.currentAgency || undefined;
        comment =
          comment ||
          `خروج للتوزيع من ${updatedAgency || 'الأجونص'} مع الموزع ${extra?.driverName || 'Livreur'}`;
        break;
      case 'arrivee_agence':
        targetStatus = 'arrive_destination';
        updatedAgency = selectedAgencyName || pkg.currentAgency || `Agence ${pkg.city}`;
        comment = comment || `وصلت الكوليا عبر السكان إلى الأجونص: ${updatedAgency}`;
        break;
      case 'marquer_livre':
        targetStatus = 'livre';
        comment = comment || 'تم توصيل الكوليا بنجاح (سكان)';
        break;
      case 'marquer_retour':
        targetStatus = 'retourne';
        updatedAgency = selectedAgencyName || pkg.currentAgency || undefined;
        comment = comment || `تم استلام روتور الكوليا عبر السكان في الأجونص: ${updatedAgency || 'الأجونص'}`;
        break;
    }

    changePackageStatus(
      pkg.id,
      targetStatus,
      comment,
      updatedAgency || extra?.location,
      currentUser,
      updatedAgency ? { currentAgency: updatedAgency } : undefined
    );

    if (action === 'depart_livraison' && extra?.driverId) {
      assignPackageToDriver(pkg.id, extra.driverId, extra.driverName || 'Livreur', true, currentUser);
    }

    supabaseRealtime.playAudioNotification('success');

    const finalAgency = updatedAgency || pkg.currentAgency;
    const successMessage =
      action === 'reception_stock'
        ? `تم استلام الكوليا ${pkg.trackingNumber} — راها دابا فالأجونص: ${finalAgency}`
        : action === 'arrivee_agence'
        ? `وصلت الكوليا ${pkg.trackingNumber} لأجونص: ${finalAgency}`
        : `تم تحديث الكوليا ${pkg.trackingNumber} ← ${PACKAGE_STATUS_CONFIG[targetStatus]?.label || targetStatus}${finalAgency ? ` (${finalAgency})` : ''}`;

    return {
      success: true,
      message: successMessage,
      packageItem: { ...pkg, status: targetStatus, currentAgency: finalAgency }
    };
  };

  // ---------------------------------------------------------------------------
  // CLIENT OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------
  const addClient = (
    data: Omit<UserProfile, 'id' | 'registeredAt'>,
    currentUser?: { name: string; role: UserRole }
  ): UserProfile => {
    const newId = 'usr-client-' + Date.now();
    const newUser: UserProfile = {
      ...data,
      id: newId,
      role: data.role || 'client',
      registeredAt: new Date().toISOString().split('T')[0]
    };

    startTransition(() => {
      setUsers(prev => [...prev, newUser]);
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'clients',
      entityId: newId,
      entityLabel: `Client ${data.companyName || data.name}`,
      details: `Création du client ${data.name} (${data.companyName})`
    });

    supabaseRealtime.syncRecord('profiles', 'insert', newUser);

    return newUser;
  };

  const registerBoutique = (data: {
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
  }): UserProfile => {
    const newId = 'usr-client-' + Date.now();
    const nowStr = new Date().toISOString().split('T')[0];

    const newBoutique: UserProfile = {
      id: newId,
      name: data.managerName,
      companyName: data.shopName,
      email: data.email,
      phone: data.phone,
      whatsapp: data.whatsapp || data.phone,
      city: data.city,
      address: data.pickupAddress,
      activityType: data.activityType || 'Commerce général',
      cinNumber: data.cinNumber?.trim().toUpperCase(),
      cinPhotoUrl: data.cinPhotoUrl,
      cinBackPhotoUrl: data.cinBackPhotoUrl,
      role: 'client',
      status: 'en_attente',
      accountStatus: 'en_attente',
      registeredAt: nowStr
    };

    if (data.cinPhotoUrl || data.cinBackPhotoUrl || data.cinNumber) {
      saveLocalKycDocs([newId, data.email], {
        cinNumber: data.cinNumber?.trim().toUpperCase(),
        cinPhotoUrl: data.cinPhotoUrl,
        cinBackPhotoUrl: data.cinBackPhotoUrl
      });
    }

    startTransition(() => {
      setUsers(prev => [newBoutique, ...prev]);
    });

    addAuditLog({
      userId: newId,
      userName: data.managerName,
      userRole: 'client',
      actionType: 'CREATE',
      module: 'clients',
      entityId: newId,
      entityLabel: `Boutique ${data.shopName}`,
      details: `Inscription publique en attente de validation par l'administration`
    });

    addNotification({
      title: 'Nouvelle Inscription Boutique',
      message: `Demande reçue de la boutique "${data.shopName}" (${data.city}) par ${data.managerName}.`,
      type: 'info',
      targetRole: 'admin'
    });

    supabaseRealtime.playAudioNotification('info');

    return newBoutique;
  };

  const updateClient = (
    id: string,
    updates: Partial<UserProfile>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const existing = users.find(u => u.id === id);
    const merged: UserProfile = {
      ...(existing || ({ id, name: '', email: '', role: 'client', phone: '', status: 'approuve' } as UserProfile)),
      ...updates
    };

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== id) return u;
        return { ...u, ...updates };
      })
    );

    if (updates.customRates) {
      const allRates = getStoredCustomRates();
      allRates[id] = updates.customRates;
      saveStoredCustomRates(allRates);
    }

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'clients',
      entityId: id,
      entityLabel: `Client ${merged.companyName || merged.name || id}`,
      newValue: JSON.stringify(updates),
      details: `Mise à jour des informations client`
    });

    updateSupabaseClient(id, {
      shopName: merged.companyName || merged.name || 'Boutique',
      managerName: merged.name || merged.companyName || 'Gérant',
      phone: merged.phone || '',
      whatsapp: merged.whatsapp || merged.phone || '',
      city: merged.city || 'Casablanca',
      address: merged.address || '',
      activityType: merged.activityType || 'Commerce général',
      ...(updates.bankName !== undefined ? { bankName: updates.bankName } : {}),
      ...(updates.bankRib !== undefined ? { bankRib: updates.bankRib } : {})
    }).catch(() => {});
  };

  const deleteClient = async (
    id: string,
    reason = 'Suppression demandée par administrateur',
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const target = users.find(u => u.id === id);

    const apiRes = await deleteSupabaseClient(id);
    if (!apiRes.success) {
      return {
        success: false,
        error: apiRes.error || 'Échec de suppression du client dans Supabase.'
      };
    }

    const targetShopId = (target as { shopId?: string } | undefined)?.shopId;
    setUsers(prev => prev.filter(u => u.id !== id));
    setPackages(prev => prev.filter(p => p.clientId !== id && (!targetShopId || p.shopId !== targetShopId)));

    try {
      const allRates = getStoredCustomRates();
      if (allRates[id]) {
        delete allRates[id];
        saveStoredCustomRates(allRates);
      }
    } catch {}

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'clients',
      entityId: id,
      entityLabel: `Client ${target?.companyName || target?.name || id}`,
      details: `Suppression définitive dans Supabase du compte client : ${reason}`
    });

    return {
      success: true,
      message: apiRes.message || 'Client supprimé définitivement de Supabase.'
    };
  };

  const toggleClientStatus = (
    id: string,
    status: 'active' | 'inactive',
    currentUser?: { name: string; role: UserRole },
    skipServerSync?: boolean
  ) => {
    updateClient(
      id,
      { status, accountStatus: status === 'active' ? 'approuve' : 'suspendu' },
      currentUser
    );
    if (!skipServerSync) {
      toggleSupabaseClientStatus(id, status === 'active' ? 'approuve' : 'suspendu').catch(() => {});
    }
  };

  const approveClient = (
    id: string,
    adminName = 'Direction FARIOUSY',
    customRates?: Record<string, number>
  ) => {
    const nowFormatted = getNowFormatted();
    if (customRates && Object.keys(customRates).length > 0) {
      const allRates = getStoredCustomRates();
      allRates[id] = customRates;
      saveStoredCustomRates(allRates);
    }
    setUsers(prev =>
      prev.map(u => {
        if (u.id !== id) return u;
        return {
          ...u,
          status: 'approuve',
          accountStatus: 'approuve',
          approvedAt: nowFormatted,
          approvedBy: adminName,
          customRates: customRates || u.customRates
        };
      })
    );

    toggleSupabaseClientStatus(id, 'approuve', `Approuvé par ${adminName}`).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: adminName,
      userRole: 'super_admin',
      actionType: 'APPROVE',
      module: 'clients',
      entityId: id,
      entityLabel: `Client ID ${id}`,
      details: `Approbation du compte boutique par ${adminName}`
    });

    addNotification({
      title: 'Compte Boutique Approuvé !',
      message: `Votre compte FARIOUSY DELIVERY a été validé avec succès.`,
      type: 'success',
      targetClientId: id
    });

    supabaseRealtime.playAudioNotification('success');
  };

  const rejectClient = (id: string, reason: string) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id !== id) return u;
        return {
          ...u,
          status: 'refuse',
          accountStatus: 'refuse',
          statusReason: reason
        };
      })
    );

    toggleSupabaseClientStatus(id, 'refuse', reason).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: 'Direction FARIOUSY',
      userRole: 'super_admin',
      actionType: 'REJECT',
      module: 'clients',
      entityId: id,
      entityLabel: `Client ID ${id}`,
      details: `Refus de la demande d'inscription (Motif : ${reason})`
    });

    addNotification({
      title: 'Inscription Refusée',
      message: `La demande d'inscription a été refusée (Motif : ${reason}).`,
      type: 'alert',
      targetRole: 'admin'
    });

    supabaseRealtime.playAudioNotification('alert');
  };

  const suspendClient = (id: string, reason: string) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id !== id) return u;
        return {
          ...u,
          status: 'suspendu',
          accountStatus: 'suspendu',
          statusReason: reason
        };
      })
    );

    toggleSupabaseClientStatus(id, 'suspendu', reason).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: 'Direction FARIOUSY',
      userRole: 'super_admin',
      actionType: 'STATUS_CHANGE',
      module: 'clients',
      entityId: id,
      entityLabel: `Client ID ${id}`,
      details: `Suspension du compte boutique (Motif : ${reason})`
    });
  };

  const updateClientRate = (clientId: string, city: string, rate: number) => {
    const allCustomRates = getStoredCustomRates();
    const currentRates = { ...(allCustomRates[clientId] || {}), [city]: rate };
    allCustomRates[clientId] = currentRates;
    saveStoredCustomRates(allCustomRates);

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== clientId) return u;
        return {
          ...u,
          customRates: currentRates
        };
      })
    );
  };

  const removeClientRate = (clientId: string, city: string) => {
    const allCustomRates = getStoredCustomRates();
    if (allCustomRates[clientId]) {
      delete allCustomRates[clientId][city];
      saveStoredCustomRates(allCustomRates);
    }

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== clientId) return u;
        const newRates = { ...(u.customRates || {}) };
        delete newRates[city];
        return {
          ...u,
          customRates: newRates
        };
      })
    );
  };

  const setClientCustomRates = (clientId: string, rates: Record<string, number>) => {
    const allCustomRates = getStoredCustomRates();
    allCustomRates[clientId] = rates;
    saveStoredCustomRates(allCustomRates);

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== clientId) return u;
        return {
          ...u,
          customRates: rates
        };
      })
    );
  };

  const resetClientCustomRates = (clientId: string) => {
    const allCustomRates = getStoredCustomRates();
    delete allCustomRates[clientId];
    saveStoredCustomRates(allCustomRates);

    setUsers(prev =>
      prev.map(u => {
        if (u.id !== clientId) return u;
        return {
          ...u,
          customRates: {}
        };
      })
    );
  };

  const updateClientPassword = async (
    clientId: string,
    newPassword: string,
    currentUser?: { name: string; role: UserRole }
  ): Promise<{
    success: boolean;
    message?: string;
    newPassword?: string;
    client?: { id: string; name: string; phone: string; email: string };
    error?: string;
  }> => {
    const res = await updateClientPasswordInSupabase(clientId, newPassword);

    if (res.success) {
      setUsers(prev =>
        prev.map(u => {
          if (u.id !== clientId) return u;
          return {
            ...u,
            password: newPassword
          };
        })
      );

      const target = users.find(u => u.id === clientId);
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'UPDATE',
        module: 'clients',
        entityId: clientId,
        entityLabel: `Client ${target?.companyName || target?.name || clientId}`,
        details: `Réinitialisation sécurisée du mot de passe de la boutique (${target?.email || 'N/A'})`
      });
    }

    return res;
  };

  // ---------------------------------------------------------------------------
  // DRIVER REGISTRATION & APPROVAL OPERATIONS
  // ---------------------------------------------------------------------------
  const submitDriverRegistration = (data: {
    fullName: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    cinNumber: string;
    cinPhotoUrl?: string;
    cinBackPhotoUrl?: string;
    driverPhotoUrl?: string;
    vehicleType: DriverVehicleType;
    driverPlate?: string;
    password?: string;
  }): { success: boolean; request?: DriverRegistrationRequest; error?: string } => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanPhone = data.phone.trim();

    // Check if email or phone is already taken
    const existingUser = users.find(
      u => u.email.toLowerCase() === cleanEmail || u.phone.replace(/[^0-9]/g, '') === cleanPhone.replace(/[^0-9]/g, '')
    );

    if (existingUser && existingUser.status !== 'refuse') {
      return {
        success: false,
        error: "Cette adresse e-mail ou ce numéro de téléphone est déjà associé à un compte FARIOUSY DELIVERY."
      };
    }

    const newReqId =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
            const r = (Math.random() * 16) | 0;
            const v = ch === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
          });
    const newRequest: DriverRegistrationRequest = {
      id: newReqId,
      fullName: data.fullName.trim(),
      phone: cleanPhone,
      email: cleanEmail,
      city: data.city.trim(),
      address: data.address.trim(),
      cinNumber: data.cinNumber.trim().toUpperCase(),
      cinPhotoUrl: data.cinPhotoUrl,
      cinBackPhotoUrl: data.cinBackPhotoUrl,
      driverPhotoUrl: data.driverPhotoUrl,
      vehicleType: data.vehicleType,
      driverPlate: data.driverPlate?.trim() || '',
      status: 'en_attente',
      submittedAt: new Date().toISOString(),
      password: data.password
    };

    setDriverRequests(prev => [newRequest, ...prev]);

    // Also register a pending driver in users table so unapproved logins are safely blocked
    const driverUserId = `usr-driver-cand-${Date.now()}`;
    const pendingDriverUser: UserProfile = {
      id: driverUserId,
      name: data.fullName.trim(),
      email: cleanEmail,
      role: 'driver',
      phone: cleanPhone,
      city: data.city.trim(),
      address: data.address.trim(),
      cinNumber: data.cinNumber.trim().toUpperCase(),
      cinPhotoUrl: data.cinPhotoUrl,
      cinBackPhotoUrl: data.cinBackPhotoUrl,
      driverPhotoUrl: data.driverPhotoUrl,
      avatarUrl: data.driverPhotoUrl,
      driverVehicle: data.vehicleType,
      vehicleType: data.vehicleType,
      driverPlate: data.driverPlate?.trim() || '',
      status: 'en_attente',
      accountStatus: 'en_attente',
      driverFeePerDelivery: 10,
      driverFixedSalary: 0,
      driverSalaryType: 'per_package',
      driverPickupFee: 5,
      registeredAt: new Date().toISOString().split('T')[0]
    };

    saveLocalKycDocs([newReqId, driverUserId, cleanEmail], {
      cinNumber: data.cinNumber.trim().toUpperCase(),
      cinPhotoUrl: data.cinPhotoUrl,
      cinBackPhotoUrl: data.cinBackPhotoUrl,
      driverPhotoUrl: data.driverPhotoUrl
    });

    // Mirror registration to backend persistent storage (non-blocking)
    if (typeof fetch !== 'undefined') {
      authedFetch('/api/driver-registrations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: newReqId,
          fullName: newRequest.fullName,
          phone: newRequest.phone,
          email: newRequest.email,
          city: newRequest.city,
          address: newRequest.address,
          cinNumber: newRequest.cinNumber,
          cinPhotoUrl: data.cinPhotoUrl,
          cinBackPhotoUrl: data.cinBackPhotoUrl,
          driverPhotoUrl: data.driverPhotoUrl,
          vehicleType: newRequest.vehicleType,
          driverPlate: newRequest.driverPlate,
          password: data.password
        })
      }).catch(() => {});
    }

    setUsers(prev => {
      // Remove any previously rejected duplicate
      const filtered = prev.filter(u => u.email.toLowerCase() !== cleanEmail);
      return [...filtered, pendingDriverUser];
    });

    addAuditLog({
      userId: 'usr-system',
      userName: data.fullName.trim(),
      userRole: 'driver',
      actionType: 'CREATE',
      module: 'drivers',
      entityId: newReqId,
      entityLabel: `Demande Livreur ${data.fullName}`,
      details: `Nouvelle candidature livreur soumise (${data.vehicleType} - ${data.city})`
    });

    addNotification({
      title: 'Nouvelle Candidature Livreur',
      message: `${data.fullName} a postulé pour devenir livreur à ${data.city} (${data.vehicleType}).`,
      type: 'info',
      targetRole: 'admin'
    });

    supabaseRealtime.playAudioNotification('info');

    return { success: true, request: newRequest };
  };

  const approveDriverRegistration = (
    requestId: string,
    adminName = 'Direction FARIOUSY'
  ): { success: boolean; driver?: UserProfile; message?: string } => {
    const targetReq = driverRequests.find(r => r.id === requestId);
    if (!targetReq) {
      return { success: false, message: 'Demande non trouvée.' };
    }

    const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // Update request
    setDriverRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? { ...r, status: 'approuve', reviewedAt: nowFormatted, reviewedBy: adminName }
          : r
      )
    );

    let approvedDriver: UserProfile;

    // Check if user already exists
    const existingIndex = users.findIndex(
      u => u.email.toLowerCase() === targetReq.email.toLowerCase()
    );

    if (existingIndex !== -1) {
      const existing = users[existingIndex];
      approvedDriver = {
        ...existing,
        name: targetReq.fullName,
        role: 'driver',
        phone: targetReq.phone,
        city: targetReq.city,
        address: targetReq.address,
        cinNumber: targetReq.cinNumber,
        cinPhotoUrl: targetReq.cinPhotoUrl || existing.cinPhotoUrl,
        cinBackPhotoUrl: targetReq.cinBackPhotoUrl || existing.cinBackPhotoUrl,
        driverPhotoUrl: targetReq.driverPhotoUrl || existing.driverPhotoUrl,
        avatarUrl: targetReq.driverPhotoUrl || existing.avatarUrl || existing.driverPhotoUrl,
        driverVehicle: targetReq.vehicleType,
        vehicleType: targetReq.vehicleType,
        driverPlate: targetReq.driverPlate || existing.driverPlate || '',
        status: 'active',
        accountStatus: 'approuve',
        approvedAt: nowFormatted,
        approvedBy: adminName,
        statusReason: undefined
      };
      setUsers(prev => prev.map((u, i) => (i === existingIndex ? approvedDriver : u)));
    } else {
      // Create new driver in users
      approvedDriver = {
        id: `usr-driver-${Date.now()}`,
        name: targetReq.fullName,
        email: targetReq.email,
        role: 'driver',
        phone: targetReq.phone,
        city: targetReq.city,
        address: targetReq.address,
        cinNumber: targetReq.cinNumber,
        cinPhotoUrl: targetReq.cinPhotoUrl,
        cinBackPhotoUrl: targetReq.cinBackPhotoUrl,
        driverPhotoUrl: targetReq.driverPhotoUrl,
        avatarUrl: targetReq.driverPhotoUrl,
        driverVehicle: targetReq.vehicleType,
        vehicleType: targetReq.vehicleType,
        driverPlate: targetReq.driverPlate || '',
        status: 'active',
        accountStatus: 'approuve',
        approvedAt: nowFormatted,
        approvedBy: adminName,
        driverFeePerDelivery: 10,
        driverFixedSalary: 0,
        driverSalaryType: 'per_package',
        driverPickupFee: 5,
        registeredAt: new Date().toISOString().split('T')[0]
      };
      setUsers(prev => [...prev, approvedDriver]);
    }

    saveLocalKycDocs([approvedDriver.id, targetReq.id, targetReq.email], {
      cinNumber: targetReq.cinNumber,
      cinPhotoUrl: approvedDriver.cinPhotoUrl,
      cinBackPhotoUrl: approvedDriver.cinBackPhotoUrl,
      driverPhotoUrl: approvedDriver.driverPhotoUrl
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: adminName,
      userRole: 'super_admin',
      actionType: 'APPROVE',
      module: 'drivers',
      entityId: targetReq.id,
      entityLabel: `Livreur ${targetReq.fullName}`,
      details: `Validation et activation du compte livreur par ${adminName}`
    });

    addNotification({
      title: 'Compte Livreur Activé',
      message: `Félicitations ${targetReq.fullName}, votre candidature de livreur a été validée. Votre accès à l'application Livreur est désormais actif.`,
      type: 'success',
      targetRole: 'driver',
      targetClientId: approvedDriver.id
    });

    supabaseRealtime.playAudioNotification('success');

    // Sync approval to backend + provision real Supabase Auth/profile account for the driver
    if (typeof fetch !== 'undefined') {
      authedFetch(`/api/driver-registrations/${encodeURIComponent(requestId)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewedBy: adminName })
      }).catch(() => {});

      const existingSbDriver = users.find(
        u => u.role === 'driver' && u.email.toLowerCase() === targetReq.email.toLowerCase() && /^[0-9a-f]{8}-/i.test(u.id)
      );
      if (!existingSbDriver) {
        const tempPassword = targetReq.password && targetReq.password !== '********'
          ? targetReq.password
          : `Far@${targetReq.cinNumber || '2026'}`;
        createDriverAccount(
          {
            fullName: targetReq.fullName,
            email: targetReq.email,
            phone: targetReq.phone,
            city: targetReq.city,
            password: tempPassword,
            vehicleType: targetReq.vehicleType,
            driverPlate: targetReq.driverPlate || '',
            cinNumber: targetReq.cinNumber,
            cinPhotoUrl: targetReq.cinPhotoUrl,
            cinBackPhotoUrl: targetReq.cinBackPhotoUrl,
            driverPhotoUrl: targetReq.driverPhotoUrl,
            avatarUrl: targetReq.driverPhotoUrl
          },
          { name: adminName, role: 'admin' }
        ).catch(() => {});
      }
    }

    return {
      success: true,
      driver: approvedDriver,
      message: `Le livreur ${targetReq.fullName} a été validé avec succès et activé dans l'espace livreurs.`
    };
  };

  const rejectDriverRegistration = (
    requestId: string,
    reason: string,
    adminName = 'Direction FARIOUSY'
  ): { success: boolean; message?: string } => {
    const targetReq = driverRequests.find(r => r.id === requestId);
    if (!targetReq) {
      return { success: false, message: 'Demande non trouvée.' };
    }

    const nowFormatted = new Date().toISOString().replace('T', ' ').slice(0, 16);

    // Update request
    setDriverRequests(prev =>
      prev.map(r =>
        r.id === requestId
          ? {
              ...r,
              status: 'refuse',
              rejectionReason: reason,
              reviewedAt: nowFormatted,
              reviewedBy: adminName
            }
          : r
      )
    );

    // Update candidate in users if present
    setUsers(prev =>
      prev.map(u => {
        if (u.email.toLowerCase() === targetReq.email.toLowerCase()) {
          return {
            ...u,
            status: 'refuse',
            accountStatus: 'refuse',
            statusReason: reason
          };
        }
        return u;
      })
    );

    if (typeof fetch !== 'undefined') {
      authedFetch(`/api/driver-registrations/${encodeURIComponent(requestId)}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: reason.trim(), reviewedBy: adminName })
      }).catch(() => {});
    }

    addAuditLog({
      userId: 'usr-admin',
      userName: adminName,
      userRole: 'super_admin',
      actionType: 'REJECT',
      module: 'drivers',
      entityId: targetReq.id,
      entityLabel: `Candidat Livreur ${targetReq.fullName}`,
      details: `Refus de la candidature livreur (Motif : ${reason})`
    });

    addNotification({
      title: 'Candidature Livreur Refusée',
      message: `La candidature de ${targetReq.fullName} a été refusée (Motif: ${reason}).`,
      type: 'alert',
      targetRole: 'admin'
    });

    return {
      success: true,
      message: `La candidature de ${targetReq.fullName} a été refusée.`
    };
  };

  const deleteDriverRegistrationRequest = (requestId: string) => {
    setDriverRequests(prev => prev.filter(r => r.id !== requestId));
    if (typeof fetch !== 'undefined') {
      authedFetch(`/api/driver-registrations/${encodeURIComponent(requestId)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // DRIVER OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------
  const addDriver = (
    data: Omit<UserProfile, 'id' | 'registeredAt' | 'role'>,
    currentUser?: { name: string; role: UserRole }
  ): UserProfile => {
    const newId = 'usr-driver-' + Date.now();
    const newDriver: UserProfile = {
      ...data,
      id: newId,
      role: 'driver',
      registeredAt: new Date().toISOString().split('T')[0]
    };
    startTransition(() => {
      setUsers(prev => [...prev, newDriver]);
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'drivers',
      entityId: newId,
      entityLabel: `Livreur ${data.name}`,
      details: `Ajout du livreur ${data.name} (${data.driverVehicle || 'Véhicule'})`
    });

    return newDriver;
  };

  const createDriverAccount = async (
    data: CreateDriverPayload,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const res = await createSupabaseDriver(data);
    if (!res.success || !res.driver) {
      return {
        success: false,
        error: res.error || 'Erreur lors de la création du livreur dans Supabase.'
      };
    }

    const enrichedDriver: UserProfile = {
      ...res.driver,
      cinNumber: res.driver.cinNumber || data.cinNumber,
      cinPhotoUrl: res.driver.cinPhotoUrl || data.cinPhotoUrl,
      cinBackPhotoUrl: res.driver.cinBackPhotoUrl || data.cinBackPhotoUrl,
      driverPhotoUrl: res.driver.driverPhotoUrl || data.driverPhotoUrl || data.avatarUrl,
      avatarUrl: res.driver.avatarUrl || res.driver.driverPhotoUrl || data.driverPhotoUrl || data.avatarUrl
    };

    saveLocalKycDocs([enrichedDriver.id, enrichedDriver.email], {
      cinNumber: enrichedDriver.cinNumber,
      cinPhotoUrl: enrichedDriver.cinPhotoUrl,
      cinBackPhotoUrl: enrichedDriver.cinBackPhotoUrl,
      driverPhotoUrl: enrichedDriver.driverPhotoUrl
    });

    startTransition(() => {
      setUsers(prev => {
        const withoutOld = prev.filter(u => u.id !== enrichedDriver.id);
        return [...withoutOld, enrichedDriver];
      });
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'drivers',
      entityId: enrichedDriver.id,
      entityLabel: `Livreur ${enrichedDriver.name}`,
      details: `Création du compte livreur ${enrichedDriver.name} (${data.vehicleType || 'Moto'}) à ${data.city || 'Laâyoune'}`
    });

    return {
      success: true,
      driver: enrichedDriver,
      credentials: res.credentials
    };
  };

  const updateDriverPassword = async (
    driverId: string,
    newPassword: string,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const res = await updateDriverPasswordInSupabase(driverId, newPassword);
    if (!res.success) {
      return {
        success: false,
        error: res.error || 'Erreur lors de la mise à jour du mot de passe.'
      };
    }

    const targetUser = users.find(u => u.id === driverId);
    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'drivers',
      entityId: driverId,
      entityLabel: `Livreur ${targetUser?.name || driverId}`,
      details: `Réinitialisation sécurisée du mot de passe du livreur ${targetUser?.name || driverId}`
    });

    return {
      success: true,
      message: res.message,
      driver: res.driver,
      newPassword: res.newPassword
    };
  };

  const updateDriver = (
    id: string,
    updates: Partial<UserProfile>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const existing = users.find(u => u.id === id);
    const resolvedAvatar = updates.driverPhotoUrl ?? updates.avatarUrl;
    const mergedUpdates: Partial<UserProfile> = {
      ...updates,
      ...(resolvedAvatar !== undefined ? { driverPhotoUrl: resolvedAvatar, avatarUrl: resolvedAvatar } : {})
    };

    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...mergedUpdates } : u)));

    if (
      updates.cinNumber !== undefined ||
      updates.cinPhotoUrl !== undefined ||
      updates.cinBackPhotoUrl !== undefined ||
      updates.driverPhotoUrl !== undefined ||
      updates.avatarUrl !== undefined
    ) {
      saveLocalKycDocs([id, updates.email || existing?.email], {
        cinNumber: updates.cinNumber,
        cinPhotoUrl: updates.cinPhotoUrl,
        cinBackPhotoUrl: updates.cinBackPhotoUrl,
        driverPhotoUrl: resolvedAvatar
      });
    }

    updateSupabaseDriver(id, {
      name: updates.name,
      email: updates.email,
      phone: updates.phone,
      whatsapp: updates.whatsapp,
      city: updates.city,
      address: updates.address,
      driverVehicle: updates.driverVehicle,
      driverPlate: updates.driverPlate,
      cinNumber: updates.cinNumber,
      cinPhotoUrl: updates.cinPhotoUrl,
      cinBackPhotoUrl: updates.cinBackPhotoUrl,
      driverPhotoUrl: resolvedAvatar,
      avatarUrl: resolvedAvatar,
      driverFeePerDelivery: updates.driverFeePerDelivery,
      driverFixedSalary: updates.driverFixedSalary,
      driverSalaryType: updates.driverSalaryType,
      driverPickupFee: updates.driverPickupFee,
      driverBonusThreshold: updates.driverBonusThreshold,
      driverBonusAmount: updates.driverBonusAmount,
      status: updates.status
    }).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'drivers',
      entityId: id,
      entityLabel: `Livreur ID ${id}`,
      details: `Modification des informations du livreur`
    });
  };

  const deleteDriver = async (
    id: string,
    reason = 'Suppression demandée',
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    const target = users.find(u => u.id === id);

    const apiRes = await deleteSupabaseDriver(id);
    if (!apiRes.success) {
      return {
        success: false,
        error: apiRes.error || 'Échec de suppression du livreur dans Supabase.'
      };
    }

    setUsers(prev => prev.filter(u => u.id !== id));

    const affectedPackageIds = packages.filter(p => p.driverId === id).map(p => p.id);

    // Dissocier les colis en cours affectés à ce livreur
    setPackages(prev =>
      prev.map(p => (p.driverId === id ? { ...p, driverId: undefined, driverName: undefined } : p))
    );

    for (const pid of affectedPackageIds) {
      authedFetch(`/api/packages/${encodeURIComponent(pid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverId: null, driverName: null })
      }).catch(() => {});
    }

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'drivers',
      entityId: id,
      entityLabel: `Livreur ${target?.name || id}`,
      details: `Suppression définitive dans Supabase du livreur : ${reason}`
    });

    return {
      success: true,
      message: apiRes.message || 'Livreur supprimé définitivement de Supabase.'
    };
  };

  const toggleDriverStatus = (id: string, status: 'active' | 'inactive') => {
    updateDriver(id, { status });
  };

  // ---------------------------------------------------------------------------
  // EMPLOYEE & PERMISSIONS OPERATIONS (Section 3: Rôles et autorisations)
  // ---------------------------------------------------------------------------
  const addEmployee = (
    data: Omit<UserProfile, 'id' | 'registeredAt'>,
    currentUser?: { name: string; role: UserRole }
  ): UserProfile => {
    const newId = 'usr-emp-' + Date.now();
    const newEmp: UserProfile = {
      ...data,
      id: newId,
      role: 'employee',
      status: 'active',
      accountStatus: 'approuve',
      registeredAt: new Date().toISOString().split('T')[0],
      granularPermissions: data.granularPermissions || {
        canCreate: true,
        canEdit: true,
        canDelete: false,
        modules: ['packages', 'stock', 'scanner']
      }
    };

    startTransition(() => {
      setUsers(prev => [...prev, newEmp]);
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'employees',
      entityId: newId,
      entityLabel: `Employé ${data.name}`,
      details: `Création du collaborateur ${data.name} affecté à ${data.agencyName || 'Hub Agence'}`
    });

    return newEmp;
  };

  const updateEmployee = (
    id: string,
    updates: Partial<UserProfile>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    setUsers(prev => prev.map(u => (u.id === id ? { ...u, ...updates } : u)));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'employees',
      entityId: id,
      entityLabel: `Employé ID ${id}`,
      details: `Mise à jour des informations collaborateur`
    });
  };

  const deleteEmployee = (
    id: string,
    reason = 'Suppression demandée',
    currentUser?: { name: string; role: UserRole }
  ) => {
    const target = users.find(u => u.id === id);
    setUsers(prev => prev.filter(u => u.id !== id));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'employees',
      entityId: id,
      entityLabel: `Employé ${target?.name || id}`,
      details: `Suppression du compte employé : ${reason}`
    });
  };

  const createEmployeeAccount = async (
    data: Omit<UserProfile, 'id' | 'registeredAt'> & { password: string },
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; employee?: UserProfile; error?: string }> => {
    try {
      const res = await authedFetch('/api/admin/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success || !json.employee) {
        return { success: false, error: json.error || 'تعذر إنشاء حساب الموظف.' };
      }
      const created: UserProfile = json.employee;
      setUsers(prev => {
        const next = [created, ...prev.filter(u => u.id !== created.id)];
        const internal = next.filter(u => u.role !== 'client' && u.role !== 'driver');
        lastSyncedCollectionJsonRef.current['employees'] = JSON.stringify(internal);
        return next;
      });
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'CREATE',
        module: 'employees',
        entityId: created.id,
        entityLabel: `Employé ${created.name}`,
        details: `Création du compte employé avec accès sécurisé (${created.email})`
      });
      return { success: true, employee: created };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erreur réseau.' };
    }
  };

  const updateEmployeeAccount = async (
    id: string,
    updates: Partial<UserProfile> & { password?: string },
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; employee?: UserProfile; error?: string }> => {
    try {
      const res = await authedFetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'تعذر تحديث حساب الموظف.' };
      }
      const updatedEmp: UserProfile | undefined = json.employee;
      setUsers(prev => {
        const next = prev.map(u => (u.id === id ? { ...u, ...(updatedEmp || updates) } : u));
        const internal = next.filter(u => u.role !== 'client' && u.role !== 'driver');
        lastSyncedCollectionJsonRef.current['employees'] = JSON.stringify(internal);
        return next;
      });
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'UPDATE',
        module: 'employees',
        entityId: id,
        entityLabel: `Employé ${updatedEmp?.name || id}`,
        details: `Mise à jour du profil collaborateur`
      });
      return { success: true, employee: updatedEmp };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erreur réseau.' };
    }
  };

  const deleteEmployeeAccount = async (
    id: string,
    reason = 'Suppression demandée',
    currentUser?: { name: string; role: UserRole }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const target = users.find(u => u.id === id);
      const res = await authedFetch(`/api/admin/employees/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'تعذر حذف حساب الموظف.' };
      }
      setUsers(prev => {
        const next = prev.filter(u => u.id !== id);
        const internal = next.filter(u => u.role !== 'client' && u.role !== 'driver');
        lastSyncedCollectionJsonRef.current['employees'] = JSON.stringify(internal);
        return next;
      });
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Administrateur',
        userRole: currentUser?.role || 'admin',
        actionType: 'DELETE',
        module: 'employees',
        entityId: id,
        entityLabel: `Employé ${target?.name || id}`,
        details: `Suppression définitive du compte employé : ${reason}`
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'Erreur réseau.' };
    }
  };

  const toggleEmployeeStatus = (id: string, status?: 'active' | 'inactive') => {
    const target = users.find(u => u.id === id);
    const newStatus = status || (target?.status === 'active' ? 'inactive' : 'active');
    void updateEmployeeAccount(id, { status: newStatus });
  };

  const updateUserPermissions = (
    userId: string,
    permissions: string[],
    granular?: UserPermissions,
    currentUser?: { name: string; role: UserRole }
  ) => {
    setUsers(prev =>
      prev.map(u => {
        if (u.id !== userId) return u;
        return {
          ...u,
          permissions,
          granularPermissions: granular || u.granularPermissions
        };
      })
    );

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Super Admin',
      userRole: currentUser?.role || 'super_admin',
      actionType: 'UPDATE',
      module: 'roles',
      entityId: userId,
      entityLabel: `Permissions Utilisateur ${userId}`,
      details: `Mise à jour des permissions et droits d'accès granulaires`
    });
  };

  // ---------------------------------------------------------------------------
  // PARTNER OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------
  const addPartner = (data: Omit<Partner, 'id'> & { password?: string }, currentUser?: { name: string; role: UserRole }): Partner => {
    const { password, ...partnerFields } = data;
    const newId = 'part-' + Date.now();
    const newPartner: Partner = { ...partnerFields, id: newId };
    dirtyCollectionsRef.current.add('partners');
    startTransition(() => {
      setPartners(prev => [...prev, newPartner]);
    });

    authedFetch('/api/partners', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(password ? { ...newPartner, password } : newPartner)
    }).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'partners',
      entityId: newId,
      entityLabel: `Partenaire ${data.name}`,
      details: `Ajout du transporteur partenaire ${data.name}`
    });

    return newPartner;
  };

  const updatePartner = async (
    id: string,
    updates: Partial<Partner> & { password?: string },
    currentUser?: { name: string; role: UserRole }
  ) => {
    const { password, ...partnerUpdates } = updates;
    dirtyCollectionsRef.current.add('partners');
    setPartners(prev => prev.map(p => (p.id === id ? { ...p, ...partnerUpdates } : p)));

    await authedFetch(`/api/partners/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(password ? { ...partnerUpdates, password } : partnerUpdates)
    }).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'partners',
      entityId: id,
      entityLabel: `Partenaire ID ${id}`,
      details: `Mise à jour des informations partenaire`
    });
  };

  const addPartnerSettlement = (
    partnerId: string,
    settlement: Omit<PartnerSettlement, 'id'>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const newStl: PartnerSettlement = {
      ...settlement,
      id: 'stl-' + Date.now(),
      registeredBy: currentUser?.name || 'Administrateur'
    };

    const existingPartner = partners.find(p => p.id === partnerId);
    const updatedSettlements = [newStl, ...(existingPartner?.settlements || [])];

    dirtyCollectionsRef.current.add('partners');
    setPartners(prev =>
      prev.map(p => {
        if (p.id !== partnerId) return p;
        const currentList = p.settlements || [];
        return {
          ...p,
          settlements: [newStl, ...currentList]
        };
      })
    );

    authedFetch(`/api/partners/${encodeURIComponent(partnerId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ settlements: updatedSettlements })
    }).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'partners',
      entityId: partnerId,
      entityLabel: `Règlement partenaire`,
      details: `Enregistrement d'un versement de ${settlement.amount} DH (Mode: ${settlement.paymentMethod})`
    });

    addNotification({
      title: 'Versement partenaire enregistré',
      message: `Règlement de ${settlement.amount} DH enregistré pour le partenaire.`,
      type: 'success'
    });
  };

  const deletePartner = (id: string, reason = 'Suppression demandée', currentUser?: { name: string; role: UserRole }) => {
    const target = partners.find(p => p.id === id);
    dirtyCollectionsRef.current.add('partners');
    setPartners(prev => prev.filter(p => p.id !== id));

    authedFetch(`/api/partners/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    }).catch(() => {});

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'partners',
      entityId: id,
      entityLabel: `Partenaire ${target?.name || id}`,
      details: `Suppression du transporteur partenaire : ${reason}`
    });
  };

  const testPartnerConnection = async (
    partnerId: string,
    overrideConfig?: Partial<Partner['apiConfig']>
  ): Promise<{ success: boolean; latency: number; message: string; statusCode?: number }> => {
    try {
      const res = await authedFetch(`/api/partners/${partnerId}/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: overrideConfig ? JSON.stringify({ apiConfig: overrideConfig }) : undefined
      });
      const data = await res.json();

      if (data.partner) {
        setPartners(prev =>
          prev.map(p => (p.id === partnerId ? { ...p, ...data.partner, apiConfig: data.partner.apiConfig } : p))
        );
      } else {
        setPartners(prev =>
          prev.map(p =>
            p.id === partnerId
              ? {
                  ...p,
                  apiConfig: p.apiConfig
                    ? {
                        ...p.apiConfig,
                        lastTestedAt: new Date().toISOString(),
                        lastTestStatus: data.success ? 'success' : 'error',
                        lastTestMessage: data.message,
                        lastTestLatencyMs: data.latency
                      }
                    : undefined
                }
              : p
          )
        );
      }

      const logItem: PartnerSyncLog = {
        id: `log-${Date.now()}`,
        timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
        partnerId,
        partnerName: partners.find(p => p.id === partnerId)?.name || 'Partenaire',
        direction: 'connection_test',
        status: data.success ? 'success' : 'error',
        statusCode: data.statusCode || (data.success ? 200 : 502),
        endpoint: (overrideConfig as any)?.baseUrl || partners.find(p => p.id === partnerId)?.apiConfig?.baseUrl || '/ping',
        message: data.message,
        durationMs: data.latency || 0
      };
      setPartnerSyncLogs(prev => [logItem, ...prev.slice(0, 99)]);
      return data;
    } catch (err: any) {
      const errMsg = `Échec du test de connectivité : ${err.message || 'Serveur inaccessible'}`;
      return { success: false, latency: 0, message: errMsg };
    }
  };

  const applyDispatchServerResult = (partnerId: string, partnerName: string, data: any, selectedPackages: PackageItem[]) => {
    const updatedList = data.updatedPackages || data.packages || [];
    if (Array.isArray(updatedList) && updatedList.length > 0) {
      const updateMap = new Map(updatedList.map((u: any) => [u.id, u]));
      const nowIso = new Date().toISOString();
      const historyItemByPkgId = new Map<string, PackageHistoryItem>();

      for (const p of selectedPackages) {
        const up = updateMap.get(p.id) as any;
        if (!up) continue;
        const historyItem: PackageHistoryItem = {
          id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
          timestamp: getNowFormatted(),
          status: 'en_transit',
          statusLabel: 'En transit vers partenaire',
          updatedBy: 'API Gateway Fariousy',
          role: 'admin',
          location: p.currentAgency,
          comment: `Expédié via API à ${partnerName}. N° Suivi Partenaire : ${up.partnerTrackingNumber}`
        };
        historyItemByPkgId.set(p.id, historyItem);
        authedFetch(`/api/packages/${encodeURIComponent(p.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            partnerId,
            partnerName,
            partnerTrackingNumber: up.partnerTrackingNumber,
            partnerShipmentId: up.partnerShipmentId,
            partnerLabelUrl: up.partnerLabelUrl,
            partnerSyncStatus: 'synced',
            partnerLastSyncAt: nowIso,
            status: 'en_transit',
            destinationAgency: `Partenaire: ${partnerName}`,
            history: [...p.history, historyItem]
          })
        }).catch(() => {});
      }

      setPackages(prev =>
        prev.map(p => {
          const up = updateMap.get(p.id) as any;
          if (!up) return p;

          const historyItem: PackageHistoryItem = historyItemByPkgId.get(p.id) || {
            id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
            timestamp: getNowFormatted(),
            status: 'en_transit',
            statusLabel: 'En transit vers partenaire',
            updatedBy: 'API Gateway Fariousy',
            role: 'admin',
            location: p.currentAgency,
            comment: `Expédié via API à ${partnerName}. N° Suivi Partenaire : ${up.partnerTrackingNumber}`
          };

          return {
            ...p,
            partnerId,
            partnerName,
            partnerTrackingNumber: up.partnerTrackingNumber,
            partnerShipmentId: up.partnerShipmentId,
            partnerLabelUrl: up.partnerLabelUrl,
            partnerSyncStatus: 'synced',
            partnerLastSyncAt: nowIso,
            status: 'en_transit',
            destinationAgency: `Partenaire: ${partnerName}`,
            history: [...p.history, historyItem]
          };
        })
      );
    }

    if (data.partner) {
      setPartners(prev =>
        prev.map(p => (p.id === partnerId ? { ...p, ...data.partner, apiConfig: data.partner.apiConfig } : p))
      );
    } else {
      setPartners(prev =>
        prev.map(p => {
          if (p.id !== partnerId) return p;
          return {
            ...p,
            totalSent: (p.totalSent || 0) + (data.sentCount || 0),
            totalPending: (p.totalPending || 0) + (data.sentCount || 0),
            errorCount: Array.isArray(data.failedTransmissions) ? data.failedTransmissions.length : p.errorCount,
            apiConfig: p.apiConfig
              ? {
                  ...p.apiConfig,
                  failedTransmissions: data.failedTransmissions ?? p.apiConfig.failedTransmissions,
                  createdParcelsCount: (p.apiConfig.createdParcelsCount || p.totalSent || 0) + (data.sentCount || 0),
                  lastSyncedAt: data.sentCount > 0 ? new Date().toISOString() : p.apiConfig.lastSyncedAt
                }
              : undefined
          };
        })
      );
    }

    const logItem: PartnerSyncLog = {
      id: `log-${Date.now()}`,
      timestamp: new Date().toISOString().replace('T', ' ').slice(0, 16),
      partnerId,
      partnerName,
      direction: 'outbound_send',
      status: data.success ? 'success' : 'error',
      statusCode: data.success ? 201 : 422,
      endpoint: partners.find(p => p.id === partnerId)?.apiConfig?.endpoints?.createShipment || '/api/v1/parcels',
      message: data.message || `${data.sentCount || 0} colis transmis à ${partnerName}`,
      packageCount: data.sentCount || 0,
      trackingNumbers: selectedPackages.map(p => p.trackingNumber)
    };
    setPartnerSyncLogs(prev => [logItem, ...prev.slice(0, 99)]);
  };

  const dispatchPackagesToPartner = async (
    partnerId: string,
    packageIds: string[],
    forceResend = false
  ): Promise<{ success: boolean; sentCount: number; errors: string[] }> => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return { success: false, sentCount: 0, errors: ['Partenaire non trouvé'] };

    const selectedPackages = packages.filter(p => packageIds.includes(p.id));
    if (selectedPackages.length === 0) return { success: false, sentCount: 0, errors: ['Aucun colis trouvé'] };

    try {
      const res = await authedFetch(`/api/partners/${partnerId}/send-packages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: selectedPackages, forceResend })
      });
      const data = await res.json();

      applyDispatchServerResult(partnerId, partner.name, data, selectedPackages);

      if (data.success && data.sentCount > 0) {
        addAuditLog({
          userId: 'usr-admin',
          userName: 'Direction Fariousy',
          userRole: 'admin',
          actionType: 'UPDATE',
          module: 'partners',
          entityId: partnerId,
          entityLabel: `Partenaire ${partner.name}`,
          details: `Envoi de ${data.sentCount} colis via API`
        });
      }

      return data;
    } catch (err: any) {
      return {
        success: false,
        sentCount: 0,
        errors: [`Échec de transmission vers l'API ${partner.name} : ${err.message || 'Serveur injoignable'}`]
      };
    }
  };

  const retryFailedPartnerTransmissions = async (
    partnerId: string
  ): Promise<{ success: boolean; sentCount: number; errors: string[] }> => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return { success: false, sentCount: 0, errors: ['Partenaire non trouvé'] };

    const failedList = partner.apiConfig?.failedTransmissions || [];
    const failedIds = new Set(failedList.map(f => f.packageId).filter(Boolean));
    const failedTrackings = new Set(failedList.map(f => f.trackingNumber));
    const retryPackages = packages.filter(
      p => failedIds.has(p.id) || failedTrackings.has(p.trackingNumber)
    );

    try {
      const res = await authedFetch(`/api/partners/${partnerId}/retry-failed`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages: retryPackages })
      });
      const data = await res.json();
      applyDispatchServerResult(partnerId, partner.name, data, retryPackages);
      return data;
    } catch (err: any) {
      return {
        success: false,
        sentCount: 0,
        errors: [`Échec du réessai vers ${partner.name} : ${err.message || 'Serveur injoignable'}`]
      };
    }
  };

  const regeneratePartnerWebhookToken = async (
    partnerId: string
  ): Promise<{ success: boolean; webhookToken?: string }> => {
    try {
      const res = await authedFetch(`/api/partners/${partnerId}/regenerate-webhook-token`, {
        method: 'POST'
      });
      const data = await res.json();
      if (data.success && data.webhookToken) {
        setPartners(prev =>
          prev.map(p =>
            p.id === partnerId
              ? {
                  ...p,
                  ...(data.partner || {}),
                  webhookToken: data.webhookToken,
                  apiConfig: p.apiConfig
                    ? { ...p.apiConfig, ...(data.partner?.apiConfig || {}), webhookSecret: data.webhookToken }
                    : data.partner?.apiConfig
                }
              : p
          )
        );
        return { success: true, webhookToken: data.webhookToken };
      }
      return { success: false };
    } catch {
      return { success: false };
    }
  };

  const syncPartnerStatuses = async (partnerId: string): Promise<{ success: boolean; updatedCount: number }> => {
    const partner = partners.find(p => p.id === partnerId);
    if (!partner) return { success: false, updatedCount: 0 };

    try {
      const activePackages = packages.filter(p => p.partnerId === partnerId);
      const res = await authedFetch(`/api/partners/${partnerId}/sync-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activePackages })
      });
      const data = await res.json();

      if (data.success && data.updates) {
        const updateMap = new Map(data.updates.map((u: any) => [u.packageId, u]));
        const historyItemByPkgId = new Map<string, PackageHistoryItem>();

        for (const p of activePackages) {
          const up = updateMap.get(p.id) as any;
          if (!up) continue;
          const historyItem: PackageHistoryItem = {
            id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
            timestamp: getNowFormatted(),
            status: up.newStatus,
            statusLabel: PACKAGE_STATUS_CONFIG[up.newStatus as PackageStatus]?.label || up.newStatus,
            updatedBy: `Sync API (${partner.name})`,
            role: 'admin',
            location: p.city,
            comment: up.comment
          };
          historyItemByPkgId.set(p.id, historyItem);
          authedFetch(`/api/packages/${encodeURIComponent(p.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              status: up.newStatus,
              history: [...p.history, historyItem]
            })
          }).catch(() => {});
        }

        setPackages(prev =>
          prev.map(p => {
            const up = updateMap.get(p.id) as any;
            if (!up) return p;
            const historyItem: PackageHistoryItem = historyItemByPkgId.get(p.id) || {
              id: 'h-' + Date.now() + Math.random().toString(36).substring(2, 5),
              timestamp: getNowFormatted(),
              status: up.newStatus,
              statusLabel: PACKAGE_STATUS_CONFIG[up.newStatus as PackageStatus]?.label || up.newStatus,
              updatedBy: `Sync API (${partner.name})`,
              role: 'admin',
              location: p.city,
              comment: up.comment
            };
            return {
              ...p,
              status: up.newStatus,
              history: [...p.history, historyItem]
            };
          })
        );
      }
      if (data.partner) {
        setPartners(prev => prev.map(p => (p.id === partnerId ? { ...p, ...data.partner } : p)));
      }
      return data;
    } catch {
      return { success: false, updatedCount: 0 };
    }
  };

  const clearPartnerLogs = () => {
    setPartnerSyncLogs([]);
    authedFetch('/api/partners/logs', { method: 'DELETE' }).catch(() => {});
  };

  // ---------------------------------------------------------------------------
  // CITIES & TARIFFS OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------
  const addCity = (data: Omit<CityTariff, 'id'>, currentUser?: { name: string; role: UserRole }): CityTariff => {
    const newId = 'city-' + Date.now();
    const newCity: CityTariff = { ...data, id: newId };
    startTransition(() => {
      setCities(prev => [...prev, newCity]);
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'cities',
      entityId: newId,
      entityLabel: `Ville ${data.name}`,
      details: `Ajout d'une nouvelle ville avec tarif standard ${data.defaultFee} MAD`
    });

    return newCity;
  };

  const updateCity = (id: string, updates: Partial<CityTariff>, currentUser?: { name: string; role: UserRole }) => {
    setCities(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'cities',
      entityId: id,
      entityLabel: `Ville ID ${id}`,
      details: `Mise à jour des tarifs et délais`
    });
  };

  const deleteCity = (id: string, currentUser?: { name: string; role: UserRole }) => {
    const target = cities.find(c => c.id === id);
    setCities(prev => prev.filter(c => c.id !== id));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'cities',
      entityId: id,
      entityLabel: `Ville ${target?.name || id}`,
      details: `Suppression de la ville de la grille tarifaire`
    });
  };

  // ---------------------------------------------------------------------------
  // HUBS & AGENCIES LOGISTICS OPERATIONS (التحكم في Hubs والمسؤولين)
  // ---------------------------------------------------------------------------
  const addAgency = (data: Omit<Agency, 'id'>, currentUser?: { name: string; role: UserRole }): Agency => {
    const newId = 'agency-' + Date.now();
    const newAgency: Agency = {
      ...data,
      id: newId,
      active: data.active !== undefined ? data.active : true,
      type: data.type || 'agence_regionale',
      createdAt: data.createdAt || new Date().toISOString().split('T')[0]
    };

    startTransition(() => {
      setAgencies(prev => [...prev, newAgency]);
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'agencies',
      entityId: newId,
      entityLabel: `Hub / Agence ${data.name}`,
      details: `Création du Hub ${data.name} (${data.city}) avec le Responsable ${data.managerName}`
    });

    addNotification({
      title: 'Nouveau Hub créé',
      message: `Le hub "${data.name}" (${data.city}) a été créé avec ${data.managerName} comme responsable.`,
      type: 'success'
    });

    return newAgency;
  };

  const updateAgency = (id: string, updates: Partial<Agency>, currentUser?: { name: string; role: UserRole }) => {
    const target = agencies.find(a => a.id === id);
    setAgencies(prev => prev.map(a => (a.id === id ? { ...a, ...updates } : a)));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'agencies',
      entityId: id,
      entityLabel: `Hub ${updates.name || target?.name || id}`,
      details: `Mise à jour des informations et du responsable du Hub`
    });

    addNotification({
      title: 'Hub mis à jour',
      message: `Les informations du hub "${updates.name || target?.name || ''}" ont été enregistrées.`,
      type: 'info'
    });
  };

  const deleteAgency = (id: string, reason = 'Suppression demandée', currentUser?: { name: string; role: UserRole }): { success: boolean; message: string } => {
    const target = agencies.find(a => a.id === id);
    if (!target) {
      return { success: false, message: 'Hub ou agence introuvable.' };
    }

    // Safety check: verify if there are any active packages located at or routed to this hub
    const activePackagesInHub = packages.filter(
      p => (p.currentAgency?.toLowerCase() === target.name.toLowerCase() || p.destinationAgency?.toLowerCase() === target.name.toLowerCase()) &&
           p.status !== 'livre' && p.status !== 'retourne' && p.status !== 'annule'
    );

    if (activePackagesInHub.length > 0) {
      return {
        success: false,
        message: `Impossible de supprimer "${target.name}" : il y a actuellement ${activePackagesInHub.length} colis en transit ou en stock rattachés à ce Hub. Veuillez transférer ou clôturer ces colis avant de supprimer.`
      };
    }

    setAgencies(prev => prev.filter(a => a.id !== id));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'agencies',
      entityId: id,
      entityLabel: `Hub ${target.name}`,
      details: `Suppression du Hub : ${reason}`
    });

    addNotification({
      title: 'Hub supprimé',
      message: `Le hub "${target.name}" a été retiré du réseau logistique.`,
      type: 'warning'
    });

    return { success: true, message: `Le hub "${target.name}" a été supprimé avec succès.` };
  };

  // ---------------------------------------------------------------------------
  // VEHICLES & FLEET OPERATIONS (CRUD & TELEMETRY)
  // ---------------------------------------------------------------------------
  const addVehicle = (
    data: Omit<Vehicle, 'id' | 'createdAt'>,
    currentUser?: { name: string; role: UserRole }
  ): Vehicle => {
    const newId = `veh-${Date.now()}`;
    const newVehicle: Vehicle = {
      ...data,
      id: newId,
      createdAt: new Date().toISOString().split('T')[0],
      tracking: data.tracking || {
        latitude: 27.1536,
        longitude: -13.2033,
        locationName: data.city ? `Centre-ville, ${data.city}` : 'Laâyoune',
        speedKmH: 0,
        heading: 'Stationné',
        ignition: false,
        status: data.status === 'en_tournee' ? 'en_mouvement' : 'au_hub',
        lastUpdated: 'À l\'instant',
        batteryLevel: 98,
        odometerKm: data.currentMileage || 15000,
        fuelLevelPercent: data.fuelLevel || 80
      }
    };

    setVehicles(prev => [newVehicle, ...prev]);

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'vehicles',
      entityId: newId,
      entityLabel: `Véhicule ${newVehicle.plateNumber} (${newVehicle.brand} ${newVehicle.model})`,
      details: `Ajout du véhicule ${newVehicle.plateNumber} (${newVehicle.vehicleType}) à la flotte FARIOUSY (${newVehicle.city || 'Maroc'})`
    });

    addNotification({
      title: 'Nouveau Véhicule Enregistré',
      message: `Le véhicule ${newVehicle.plateNumber} (${newVehicle.brand} ${newVehicle.model}) a été ajouté à la flotte avec succès.`,
      type: 'success'
    });

    return newVehicle;
  };

  const updateVehicle = (
    id: string,
    updates: Partial<Vehicle>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const target = vehicles.find(v => v.id === id);
    setVehicles(prev => prev.map(v => (v.id === id ? { ...v, ...updates } : v)));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'vehicles',
      entityId: id,
      entityLabel: `Véhicule ${updates.plateNumber || target?.plateNumber || id}`,
      details: `Mise à jour des informations du véhicule ${target?.plateNumber || id}`
    });
  };

  const deleteVehicle = (
    id: string,
    reason = 'Suppression demandée',
    currentUser?: { name: string; role: UserRole }
  ): { success: boolean; message: string } => {
    const target = vehicles.find(v => v.id === id);
    if (!target) {
      return { success: false, message: 'Véhicule introuvable.' };
    }

    setVehicles(prev => prev.filter(v => v.id !== id));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'vehicles',
      entityId: id,
      entityLabel: `Véhicule ${target.plateNumber} (${target.brand} ${target.model})`,
      details: `Suppression du véhicule : ${reason}`
    });

    addNotification({
      title: 'Véhicule Retiré',
      message: `Le véhicule ${target.plateNumber} a été retiré de la flotte (${reason}).`,
      type: 'warning'
    });

    return { success: true, message: `Le véhicule ${target.plateNumber} a été supprimé avec succès.` };
  };

  const simulateVehicleTelemetry = (id: string) => {
    setVehicles(prev => prev.map(v => {
      if (v.id !== id) return v;
      const currentLat = v.tracking?.latitude || (v.city === 'Casablanca' ? 33.5731 : v.city === 'Rabat' ? 34.0209 : 27.1536);
      const currentLng = v.tracking?.longitude || (v.city === 'Casablanca' ? -7.5898 : v.city === 'Rabat' ? -6.8416 : -13.2033);
      const jitterLat = (Math.random() - 0.5) * 0.006;
      const jitterLng = (Math.random() - 0.5) * 0.006;
      const newSpeed = Math.floor(Math.random() * 48) + 12;
      const directions = ['Nord', 'Nord-Est', 'Est', 'Sud-Est', 'Sud', 'Ouest', 'Nord-Ouest'];
      const randomDirection = directions[Math.floor(Math.random() * directions.length)];

      return {
        ...v,
        status: 'en_tournee',
        tracking: {
          latitude: Number((currentLat + jitterLat).toFixed(5)),
          longitude: Number((currentLng + jitterLng).toFixed(5)),
          locationName: `En tournée, ${v.city || 'Laâyoune'}`,
          speedKmH: newSpeed,
          heading: randomDirection,
          ignition: true,
          status: 'en_mouvement',
          lastUpdated: 'À l\'instant',
          batteryLevel: 94,
          odometerKm: (v.currentMileage || 20000) + 1,
          fuelLevelPercent: Math.max(10, (v.fuelLevel || 75) - 1)
        }
      };
    }));
  };

  // ---------------------------------------------------------------------------
  // PICKUP OPERATIONS (CRUD)
  // ---------------------------------------------------------------------------
  const createPickupRequest = (
    data: Omit<PickupRequest, 'id' | 'trackingId' | 'status' | 'createdAt'>
  ): PickupRequest => {
    const newId = 'pick-' + Date.now();
    const trackingId = 'RAM-2026-' + String(pickups.length + 1).padStart(3, '0');
    const newReq: PickupRequest = {
      ...data,
      id: newId,
      trackingId,
      status: 'en_attente',
      createdAt: new Date().toISOString()
    };
    startTransition(() => {
      setPickups(prev => [newReq, ...prev]);
    });

    authedFetch('/api/pickups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newReq)
    }).catch(() => {});

    supabaseRealtime.broadcastNewPickup({
      pickupId: newId,
      trackingId,
      clientCompany: data.clientCompany,
      city: data.city,
      packageCount: data.packageCount,
      requestedDate: data.requestedDate,
      timeSlot: data.timeSlot,
      timestamp: getNowFormatted(),
      clientId: data.clientId
    });

    addAuditLog({
      userId: data.clientId,
      userName: data.clientName,
      userRole: 'client',
      actionType: 'CREATE',
      module: 'clients',
      entityId: newId,
      entityLabel: `Ramassage ${trackingId}`,
      details: `Demande de ramassage de ${data.packageCount} colis (${data.city})`
    });

    return newReq;
  };

  const updatePickupStatus = (
    id: string,
    status: PickupRequest['status'],
    driverId?: string,
    driverName?: string,
    reason?: string
  ) => {
    const completedAt = status === 'terminee' ? new Date().toISOString() : undefined;
    setPickups(prev =>
      prev.map(req => {
        if (req.id !== id) return req;
        return {
          ...req,
          status,
          driverId: driverId || req.driverId,
          driverName: driverName || req.driverName,
          rejectionReason: reason || req.rejectionReason,
          completedAt: completedAt || req.completedAt
        };
      })
    );
    authedFetch(`/api/pickups/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status,
        ...(driverId ? { driverId } : {}),
        ...(driverName ? { driverName } : {}),
        ...(reason ? { rejectionReason: reason } : {}),
        ...(completedAt ? { completedAt } : {})
      })
    }).catch(() => {});
  };

  const deletePickupRequest = (id: string) => {
    setPickups(prev => prev.filter(req => req.id !== id));
    if (typeof fetch !== 'undefined') {
      authedFetch(`/api/pickups/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      }).catch(() => {});
    }
  };

  // ---------------------------------------------------------------------------
  // BONS OPERATIONS (Bon Delivery Livreur & Bon Client Ramassage / Expédition)
  // ---------------------------------------------------------------------------
  const createBonDelivery = async (
    data: { driverId: string; packageIds: string[]; notes?: string; city?: string },
    user?: { name: string; role: string }
  ): Promise<{ success: boolean; bon?: BonItem; error?: string }> => {
    try {
      const driver = users.find(u => u.id === data.driverId);
      if (!driver) {
        return { success: false, error: 'Livreur introuvable dans le système.' };
      }
      if (!data.packageIds || data.packageIds.length === 0) {
        return { success: false, error: 'Veuillez sélectionner au moins un colis pour créer ce bon de livraison.' };
      }

      const selectedPackages = packages.filter(p => data.packageIds.includes(p.id));
      const totalCod = selectedPackages.reduce((sum, p) => sum + (p.codAmount || 0), 0);
      const year = new Date().getFullYear();
      const seq = String(bons.filter(b => b.type === 'delivery').length + 1).padStart(4, '0');
      const bonNumber = `BDL-${year}-${seq}`;

      const newBon: BonItem = {
        id: `bon-del-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bonNumber,
        type: 'delivery',
        date: new Date().toISOString().substring(0, 10),
        createdAt: new Date().toISOString(),
        status: 'en_cours',
        driverId: driver.id,
        driverName: driver.name,
        driverPhone: driver.phone,
        driverVehicle: driver.vehicleType || driver.driverVehicle || 'Moto',
        city: data.city || driver.city || 'Laâyoune',
        agency: driver.agencyName || companySettings.companyName || 'Hub FARIOUSY',
        packageIds: data.packageIds,
        totalPackages: selectedPackages.length,
        totalCodAmount: totalCod,
        deliveredCount: 0,
        noAnswerCount: 0,
        postponedCount: 0,
        refusedCount: 0,
        totalCollectedAmount: 0,
        notes: data.notes || '',
        createdByName: user?.name || 'Administrateur',
        createdByRole: user?.role || 'admin'
      };

      // Assign packages to driver and update their status to en_cours_livraison
      for (const pkg of selectedPackages) {
        await changePackageStatus(
          pkg.id,
          'en_cours_livraison',
          `Inclus dans le bon de livraison ${bonNumber} assigné à ${driver.name}`,
          data.city || driver.city || pkg.city,
          { name: user?.name || 'Système', role: (user?.role as UserRole) || 'admin' }
        );
      }

      setBons(prev => [newBon, ...prev]);

      await authedFetch('/api/bons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBon)
      }).catch(() => {});

      addNotification({
        type: 'info',
        title: 'Nouveau Bon de Livraison',
        message: `Bon ${bonNumber} créé pour le livreur ${driver.name} (${selectedPackages.length} colis, ${totalCod} MAD).`
      });

      return { success: true, bon: newBon };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la création du bon de livraison.' };
    }
  };

  const createBonClient = async (
    data: { clientId: string; packageIds: string[]; notes?: string },
    user?: { name: string; role: string }
  ): Promise<{ success: boolean; bon?: BonItem; error?: string }> => {
    try {
      const client = users.find(u => u.id === data.clientId);
      if (!client && !user) {
        return { success: false, error: 'Client introuvable dans le système.' };
      }
      if (!data.packageIds || data.packageIds.length === 0) {
        return { success: false, error: 'Veuillez sélectionner au moins un colis pour ce bon client.' };
      }

      const clientName = client?.companyName || client?.name || user?.name || 'Client';
      const clientPhone = client?.phone || '';
      const selectedPackages = packages.filter(p => data.packageIds.includes(p.id));
      const totalCod = selectedPackages.reduce((sum, p) => sum + (p.codAmount || 0), 0);
      const year = new Date().getFullYear();
      const seq = String(bons.filter(b => b.type === 'client').length + 1).padStart(4, '0');
      const bonNumber = `BC-${year}-${seq}`;

      const newBon: BonItem = {
        id: `bon-cli-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        bonNumber,
        type: 'client',
        date: new Date().toISOString().substring(0, 10),
        createdAt: new Date().toISOString(),
        status: 'en_attente',
        clientId: client?.id || data.clientId,
        clientName,
        clientCompany: client?.companyName || clientName,
        clientPhone,
        packageIds: data.packageIds,
        totalPackages: selectedPackages.length,
        totalCodAmount: totalCod,
        notes: data.notes || '',
        createdByName: user?.name || clientName,
        createdByRole: user?.role || 'client'
      };

      // Set package status to attente_ramassage if they were newly created
      for (const pkg of selectedPackages) {
        if (pkg.status === 'nouveau') {
          await changePackageStatus(
            pkg.id,
            'attente_ramassage',
            `Inclus dans le bon client ${bonNumber}`,
            pkg.city,
            { name: user?.name || clientName, role: (user?.role as UserRole) || 'client' }
          );
        }
      }

      setBons(prev => [newBon, ...prev]);

      await authedFetch('/api/bons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newBon)
      }).catch(() => {});

      addNotification({
        type: 'info',
        title: 'Nouveau Bon Client',
        message: `Bon d'expédition ${bonNumber} généré pour ${clientName} (${selectedPackages.length} colis).`
      });

      return { success: true, bon: newBon };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la génération du bon client.' };
    }
  };

  const updateBonStatus = async (
    bonId: string,
    status: BonStatus,
    notes?: string,
    user?: { name: string; role: string }
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const isClosing = status === 'termine' || status === 'valide';
      const closedAt = isClosing ? new Date().toISOString() : undefined;
      const closedBy = isClosing ? (user?.name || 'Administrateur') : undefined;
      setBons(prev =>
        prev.map(b => {
          if (b.id !== bonId) return b;
          return {
            ...b,
            status,
            notes: notes !== undefined ? notes : b.notes,
            closedAt: closedAt || b.closedAt,
            closedBy: closedBy || b.closedBy
          };
        })
      );
      await authedFetch(`/api/bons/${encodeURIComponent(bonId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          ...(notes !== undefined ? { notes } : {}),
          ...(closedAt ? { closedAt, closedBy } : {})
        })
      }).catch(() => {});
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la mise à jour du bon.' };
    }
  };

  const deleteBon = async (bonId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setBons(prev => prev.filter(b => b.id !== bonId));
      await authedFetch(`/api/bons/${encodeURIComponent(bonId)}`, {
        method: 'DELETE'
      }).catch(() => {});
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Erreur lors de la suppression.' };
    }
  };

  // ---------------------------------------------------------------------------
  // STOCK LOGISTICS OPERATIONS (Section 2: Gestion du Stock)
  // ---------------------------------------------------------------------------
  const persistStockLocationsNow = (nextList: StockLocationItem[]) => {
    try {
      localStorage.setItem(STORAGE_KEYS.STOCK_LOCATIONS, JSON.stringify(nextList));
      lastSyncedCollectionJsonRef.current['stockLocations'] = JSON.stringify(nextList);
    } catch {}
    if (hasActiveAuthSession() && isStaffSession()) {
      authedFetch('/api/system-collections/stockLocations', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: nextList })
      }).catch(() => {});
    }
  };

  const addStockLocation = (
    location: Omit<StockLocationItem, 'id' | 'enteredAt' | 'lastAuditedAt'>,
    currentUser?: { name: string; role: UserRole }
  ): StockLocationItem => {
    const newId = 'stk-' + Date.now();
    const nowIso = new Date().toISOString();
    const newLoc: StockLocationItem = {
      ...location,
      id: newId,
      enteredAt: nowIso,
      lastAuditedAt: nowIso
    };

    setStockLocations(prev => {
      const next = [newLoc, ...prev];
      persistStockLocationsNow(next);
      return next;
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Agent Stock',
      userRole: currentUser?.role || 'employee',
      actionType: 'CREATE',
      module: 'stock',
      entityId: newId,
      entityLabel: `Emplacement ${location.trackingNumber}`,
      details: `Entrée au stock : ${location.hubName} — ${location.zone} (Rayon: ${location.shelf}, Casier: ${location.bin})`
    });

    return newLoc;
  };

  const updateStockLocation = (
    id: string,
    updates: Partial<StockLocationItem>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const nowIso = new Date().toISOString();
    setStockLocations(prev => {
      const next = prev.map(item => (item.id === id ? { ...item, ...updates, lastAuditedAt: nowIso } : item));
      persistStockLocationsNow(next);
      return next;
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Agent Stock',
      userRole: currentUser?.role || 'employee',
      actionType: 'UPDATE',
      module: 'stock',
      entityId: id,
      entityLabel: `Emplacement ID ${id}`,
      details: `Correction d'emplacement de stock`
    });
  };

  const deleteStockLocation = (id: string, reason = 'Sortie de stock ou correction', currentUser?: { name: string; role: UserRole }) => {
    recordDeletedId(STORAGE_KEYS.STOCK_LOCATIONS_DELETED_IDS, id);
    setStockLocations(prev => {
      const next = prev.filter(item => item.id !== id);
      persistStockLocationsNow(next);
      return next;
    });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Agent Stock',
      userRole: currentUser?.role || 'employee',
      actionType: 'DELETE',
      module: 'stock',
      entityId: id,
      entityLabel: `Stock ID ${id}`,
      details: `Sortie de stock ou suppression d'entrée : ${reason}`
    });
  };

  const moveStockLocation = (
    id: string,
    zone: string,
    shelf: string,
    bin: string,
    notes?: string,
    currentUser?: { name: string; role: UserRole }
  ) => {
    updateStockLocation(id, { zone, shelf, bin, notes }, currentUser);
  };

  // ---------------------------------------------------------------------------
  // FINANCIAL OPERATIONS & DEBTS (Section 2: Paiements et dettes)
  // ---------------------------------------------------------------------------
  const generateClientPayment = (
    clientId: string,
    packageIds: string[],
    paymentMethod: ClientPayment['paymentMethod'],
    notes?: string,
    currentUser?: { name: string; role: UserRole },
    deductionOptions?: {
      packagingFees?: number;
      extraDeductions?: number;
      deductionNotes?: string;
      settleDebtIds?: string[];
      receiptImageUrl?: string;
      receiptFileName?: string;
    }
  ): ClientPayment => {
    const client = users.find(u => u.id === clientId);
    const clientPackages = packages.filter(p => packageIds.includes(p.id));

    const totalCollected = clientPackages.reduce((acc, p) => acc + (p.codAmount || 0), 0);
    const totalDeliveryFees = clientPackages.reduce((acc, p) => acc + (p.deliveryFee || 0), 0);

    const packagingFees = Math.max(0, Number(deductionOptions?.packagingFees || 0));
    const extraDeductions = Math.max(0, Number(deductionOptions?.extraDeductions || 0));
    const settleDebtIds = deductionOptions?.settleDebtIds || [];

    const settledDebtsAmount = clientDebts
      .filter(d => settleDebtIds.includes(d.id) && !d.isSettled)
      .reduce((acc, d) => acc + (d.amount || 0), 0);

    const netAmount = totalCollected - totalDeliveryFees - packagingFees - extraDeductions - settledDebtsAmount;
    const newPaymentId = 'pay-' + Date.now();

    const newPayment: ClientPayment = {
      id: newPaymentId,
      reference: 'REL-2026-' + String(payments.length + 1).padStart(4, '0'),
      clientId,
      clientName: client?.name || 'Client',
      clientCompany: client?.companyName || 'Entreprise',
      date: new Date().toISOString().split('T')[0],
      packageCount: clientPackages.length,
      totalCollected,
      totalDeliveryFees,
      packagingFees,
      extraDeductions: extraDeductions + settledDebtsAmount,
      deductionNotes: deductionOptions?.deductionNotes,
      settledDebtIds: settleDebtIds,
      netAmount,
      status: 'paye',
      paymentMethod,
      notes: notes || `Règlement effectué par ${paymentMethod}`,
      packageIds,
      receiptImageUrl: deductionOptions?.receiptImageUrl,
      receiptFileName: deductionOptions?.receiptFileName,
      receiptUploadedAt: deductionOptions?.receiptImageUrl ? new Date().toISOString() : undefined
    };

    setPackages(prev =>
      prev.map(p => {
        if (packageIds.includes(p.id)) {
          return { ...p, isPaidToClient: true, clientPaymentId: newPayment.id };
        }
        return p;
      })
    );

    for (const pid of packageIds) {
      authedFetch(`/api/packages/${encodeURIComponent(pid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaidToClient: true, clientPaymentId: newPayment.id })
      }).catch(() => {});
    }

    // Mark selected debts / packaging charges as settled
    if (settleDebtIds.length > 0) {
      const nowIso = new Date().toISOString();
      setClientDebts(prev =>
        prev.map(d =>
          settleDebtIds.includes(d.id)
            ? { ...d, isSettled: true, status: 'regle', settledAt: nowIso, paymentId: newPaymentId }
            : d
        )
      );
    }

    startTransition(() => {
      setPayments(prev => [newPayment, ...prev]);
    });

    const totalDeductedSummary = packagingFees + extraDeductions + settledDebtsAmount;
    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Responsable Finance',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'finance',
      entityId: newPayment.id,
      entityLabel: `Relevé ${newPayment.reference}`,
      details: `Génération du relevé de reversement CRBT pour ${newPayment.clientCompany} — Net: ${netAmount} MAD${
        totalDeductedSummary > 0 ? ` (Déductions emballage/extras: -${totalDeductedSummary} MAD)` : ''
      }`
    });

    addNotification({
      title: 'Paiement client généré',
      message: `Relevé ${newPayment.reference} de ${netAmount} MAD généré pour ${newPayment.clientCompany}.`,
      type: 'success',
      targetClientId: clientId
    });

    return newPayment;
  };

  const markPaymentPaid = (paymentId: string) => {
    setPayments(prev => prev.map(p => (p.id === paymentId ? { ...p, status: 'paye' } : p)));
  };

  const cancelPayment = (
    paymentId: string,
    reason: string,
    currentUser?: { name: string; role: UserRole }
  ) => {
    const target = payments.find(p => p.id === paymentId);
    if (!target) return;

    const affectedPkgIds = packages.filter(p => p.clientPaymentId === paymentId).map(p => p.id);
    // Dissocier les colis rattachés pour permettre une refacturation correcte
    setPackages(prev =>
      prev.map(p => (p.clientPaymentId === paymentId ? { ...p, isPaidToClient: false, clientPaymentId: undefined } : p))
    );
    for (const pid of affectedPkgIds) {
      authedFetch(`/api/packages/${encodeURIComponent(pid)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaidToClient: false, clientPaymentId: null })
      }).catch(() => {});
    }

    // Débloquer les dettes / frais d'emballage rattachés si annulé
    if (target.settledDebtIds && target.settledDebtIds.length > 0) {
      setClientDebts(prev =>
        prev.map(d =>
          target.settledDebtIds?.includes(d.id) || d.paymentId === paymentId
            ? { ...d, isSettled: false, status: 'en_attente', settledAt: undefined, paymentId: undefined }
            : d
        )
      );
    }

    // Marquer l'opération comme annulée
    setPayments(prev =>
      prev.map(p => (p.id === paymentId ? { ...p, status: 'annule', notes: `ANNULÉ : ${reason} (par ${currentUser?.name || 'Admin'})` } : p))
    );

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Administrateur',
      userRole: currentUser?.role || 'admin',
      actionType: 'CANCEL',
      module: 'finance',
      entityId: paymentId,
      entityLabel: `Paiement ${target.reference}`,
      details: `Annulation de l'opération financière : ${reason}`
    });

    addNotification({
      title: 'Opération Financière Annulée',
      message: `Le relevé ${target.reference} a été annulé (Motif : ${reason}). Les colis ont été débloqués.`,
      type: 'alert',
      targetClientId: target.clientId
    });
  };

  const addClientDebt = (
    debt: Omit<ClientDebtItem, 'id' | 'createdAt'>,
    currentUser?: { name: string; role: UserRole }
  ): ClientDebtItem => {
    const newId = 'debt-' + Date.now();
    const newDebt: ClientDebtItem = {
      ...debt,
      id: newId,
      createdAt: new Date().toISOString()
    };

    setClientDebts(prev => [newDebt, ...prev]);

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Finance',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'finance',
      entityId: newId,
      entityLabel: `Dette ${debt.clientCompany}`,
      details: `Inscription d'une créance de ${debt.amount} MAD (${debt.debtType}) pour ${debt.clientCompany}`
    });

    return newDebt;
  };

  const settleClientDebt = (debtId: string, currentUser?: { name: string; role: UserRole }) => {
    setClientDebts(prev =>
      prev.map(d => (d.id === debtId ? { ...d, isSettled: true, status: 'regle', settledAt: new Date().toISOString() } : d))
    );

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Finance',
      userRole: currentUser?.role || 'admin',
      actionType: 'UPDATE',
      module: 'finance',
      entityId: debtId,
      entityLabel: `Dette ID ${debtId}`,
      details: `Créance marquée comme régularisée / recouvrée`
    });
  };

  const deleteClientDebt = (debtId: string, currentUser?: { name: string; role: UserRole }) => {
    const target = clientDebts.find(d => d.id === debtId);
    setClientDebts(prev => prev.filter(d => d.id !== debtId));

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Finance',
      userRole: currentUser?.role || 'admin',
      actionType: 'DELETE',
      module: 'finance',
      entityId: debtId,
      entityLabel: `Déduction ${target?.clientCompany || debtId}`,
      details: `Suppression de l'imputation financière (${target?.reason || target?.debtType || 'Déduction'}: ${target?.amount || 0} MAD)`
    });
  };

  const attachPaymentReceipt = (
    paymentId: string,
    receipt: { imageUrl: string; fileName?: string },
    currentUser?: { name: string; role: UserRole }
  ) => {
    const target = payments.find(p => p.id === paymentId);
    const nowIso = new Date().toISOString();
    setPayments(prev =>
      prev.map(p =>
        p.id === paymentId
          ? {
              ...p,
              receiptImageUrl: receipt.imageUrl,
              receiptFileName: receipt.fileName || `recu_${p.reference}.jpg`,
              receiptUploadedAt: nowIso
            }
          : p
      )
    );

    if (target) {
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Finance',
        userRole: currentUser?.role || 'admin',
        actionType: 'UPDATE',
        module: 'finance',
        entityId: paymentId,
        entityLabel: `Reçu virement ${target.reference}`,
        details: `Ajout de la photo du virement bancaire pour ${target.clientCompany}`
      });

      addNotification({
        title: 'صورة التحويل البنكي متوفرة',
        message: `تم إرفاق صورة التحويل البنكي الخاصة بالكشف ${target.reference} (${target.netAmount} MAD).`,
        type: 'success',
        targetClientId: target.clientId
      });
    }
  };

  const addTransferReceipt = (
    receipt: Omit<BankTransferReceipt, 'id' | 'createdAt' | 'reference'> & { reference?: string },
    currentUser?: { name: string; role: UserRole }
  ): BankTransferReceipt => {
    const id = 'vir-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6);
    const reference =
      receipt.reference?.trim() ||
      `VIR-${new Date().getFullYear()}-${String(transferReceipts.length + 1).padStart(4, '0')}`;

    const newReceipt: BankTransferReceipt = {
      ...receipt,
      id,
      reference,
      uploadedBy: receipt.uploadedBy || currentUser?.name || 'Administration Finance',
      createdAt: new Date().toISOString()
    };

    setTransferReceipts(prev => [newReceipt, ...prev]);

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Finance',
      userRole: currentUser?.role || 'admin',
      actionType: 'CREATE',
      module: 'finance',
      entityId: id,
      entityLabel: `Reçu virement ${reference}`,
      details: `Envoi d'une preuve de virement bancaire (${newReceipt.amount} MAD) à ${newReceipt.clientCompany}`
    });

    addNotification({
      title: 'صورة تحويل بنكي جديدة متاحة للتنزيل',
      message: `تم إرسال وصل التحويل البنكي ${reference} بمبلغ ${newReceipt.amount} MAD لمتجركم.`,
      type: 'success',
      targetClientId: newReceipt.clientId
    });

    return newReceipt;
  };

  const deleteTransferReceipt = (receiptId: string, currentUser?: { name: string; role: UserRole }) => {
    const target = transferReceipts.find(r => r.id === receiptId);
    setTransferReceipts(prev => prev.filter(r => r.id !== receiptId));
    if (target) {
      addAuditLog({
        userId: 'usr-admin',
        userName: currentUser?.name || 'Finance',
        userRole: currentUser?.role || 'admin',
        actionType: 'DELETE',
        module: 'finance',
        entityId: receiptId,
        entityLabel: `Reçu virement ${target.reference}`,
        details: `Suppression du justificatif de virement bancaire de ${target.clientCompany}`
      });
    }
  };

  // ---------------------------------------------------------------------------
  // COMPANY SETTINGS OPERATIONS (Section 5: Paramètres)
  // ---------------------------------------------------------------------------
  const updateCompanySettings = (
    settings: Partial<CompanySettings>,
    currentUser?: { name: string; role: UserRole }
  ) => {
    setCompanySettings(prev => {
      const next = { ...prev, ...settings };
      try {
        localStorage.setItem(STORAGE_KEYS.COMPANY_SETTINGS, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });

    authedFetch('/api/company-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.success && data.settings) {
          setCompanySettings(prev => ({ ...prev, ...data.settings }));
        }
      })
      .catch(err => {
        console.warn('[DatabaseContext] Failed to persist company settings on server:', err);
      });

    addAuditLog({
      userId: 'usr-admin',
      userName: currentUser?.name || 'Super Admin',
      userRole: currentUser?.role || 'super_admin',
      actionType: 'UPDATE',
      module: 'settings',
      entityId: 'company_settings',
      entityLabel: 'Paramètres Entreprise',
      details: `Mise à jour des informations légales, grilles et paramètres de notification`
    });
  };

  // ---------------------------------------------------------------------------
  // NOTIFICATIONS & SYSTEM
  // ---------------------------------------------------------------------------
  const addNotification = (notif: Omit<AppNotification, 'id' | 'timestamp' | 'read'>) => {
    const newNotif: AppNotification = {
      ...notif,
      id: 'notif-' + Date.now() + Math.random().toString(36).substring(2, 6),
      timestamp: getNowFormatted(),
      read: false
    };
    setNotifications(prev => [newNotif, ...prev.slice(0, 40)]);
  };

  const markNotificationRead = (id: string) => {
    setNotifications(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  // ---------------------------------------------------------------------------
  // CLIENT MESSAGING OPERATIONS (Surface de message émis par le client)
  // ---------------------------------------------------------------------------
  const sendClientMessage = (
    data: {
      category: ClientMessageCategory;
      priority: ClientMessagePriority;
      subject: string;
      message: string;
      packageTrackingNumber?: string;
      packageId?: string;
    },
    clientUser?: { id: string; name: string; companyName?: string; phone?: string; email?: string }
  ): ClientMessage => {
    const newMsg: ClientMessage = {
      id: `msg-${Date.now()}`,
      clientId: clientUser?.id || 'client-anon',
      clientName: clientUser?.name || 'Client',
      clientCompany: clientUser?.companyName || 'Boutique Partenaire',
      clientPhone: clientUser?.phone,
      clientEmail: clientUser?.email,
      category: data.category,
      priority: data.priority,
      status: 'nouveau',
      subject: data.subject,
      message: data.message,
      packageTrackingNumber: data.packageTrackingNumber,
      packageId: data.packageId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replies: []
    };

    setClientMessages(prev => [newMsg, ...prev]);

    // Send notification to operations/admin
    addNotification({
      title: 'Nouveau message client reçu',
      message: `${newMsg.clientCompany || newMsg.clientName} : "${newMsg.subject}"`,
      type: 'info',
      targetRole: 'admin'
    });

    // Add audit log
    addAuditLog({
      userId: clientUser?.id || 'client',
      userName: clientUser?.name || 'Client',
      userRole: 'client',
      actionType: 'CREATE',
      module: 'clients',
      entityId: newMsg.id,
      entityLabel: `Message: ${newMsg.subject}`,
      details: `Message émis par ${newMsg.clientName} (${newMsg.category})`
    });

    // Asynchronously notify backend API
    authedFetch('/api/client-messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newMsg)
    }).catch(err => console.warn('[Message Sync Notice]', err.message));

    return newMsg;
  };

  const replyToClientMessage = (
    messageId: string,
    replyText: string,
    sender: { id: string; name: string; role: 'client' | 'admin' | 'employee' | 'support' }
  ) => {
    if (!replyText.trim()) return;

    const replyItem: ClientMessageReply = {
      id: `rep-${Date.now()}`,
      senderId: sender.id,
      senderName: sender.name,
      senderRole: sender.role,
      message: replyText.trim(),
      createdAt: new Date().toISOString()
    };

    setClientMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          const updatedStatus: ClientMessageStatus =
            sender.role === 'client'
              ? 'en_cours'
              : msg.status === 'nouveau'
              ? 'en_cours'
              : msg.status;

          return {
            ...msg,
            status: updatedStatus,
            updatedAt: new Date().toISOString(),
            replies: [...msg.replies, replyItem]
          };
        }
        return msg;
      })
    );

    // Notification
    if (sender.role === 'client') {
      addNotification({
        title: 'Réponse client reçue',
        message: `${sender.name} a répondu sur le ticket`,
        type: 'info',
        targetRole: 'admin'
      });
    } else {
      addNotification({
        title: 'Réponse du support Fariousy',
        message: `${sender.name} a répondu à votre message`,
        type: 'success',
        targetRole: 'client'
      });
    }

    // Backend sync
    authedFetch(`/api/client-messages/${messageId}/reply`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(replyItem)
    }).catch(err => console.warn('[Message Reply Sync Notice]', err.message));
  };

  const updateClientMessageStatus = (
    messageId: string,
    status: ClientMessageStatus,
    resolvedBy?: string
  ) => {
    setClientMessages(prev =>
      prev.map(msg => {
        if (msg.id === messageId) {
          return {
            ...msg,
            status,
            updatedAt: new Date().toISOString(),
            resolvedAt: status === 'resolu' || status === 'ferme' ? new Date().toISOString() : msg.resolvedAt,
            resolvedBy: status === 'resolu' || status === 'ferme' ? (resolvedBy || 'Support') : msg.resolvedBy
          };
        }
        return msg;
      })
    );

    // Backend sync
    authedFetch(`/api/client-messages/${messageId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, resolvedBy })
    }).catch(err => console.warn('[Message Status Sync Notice]', err.message));
  };

  const deleteClientMessage = (messageId: string) => {
    setClientMessages(prev => prev.filter(m => m.id !== messageId));
    authedFetch(`/api/client-messages/${messageId}`, {
      method: 'DELETE'
    }).catch(err => console.warn('[Message Delete Notice]', err.message));
  };

  const resetToDefaultData = () => {
    localStorage.removeItem(STORAGE_KEYS.PACKAGES);
    localStorage.removeItem(STORAGE_KEYS.USERS);
    localStorage.removeItem(STORAGE_KEYS.CITIES);
    localStorage.removeItem(STORAGE_KEYS.PICKUPS);
    localStorage.removeItem(STORAGE_KEYS.PARTNERS);
    localStorage.removeItem(STORAGE_KEYS.PAYMENTS);
    localStorage.removeItem(STORAGE_KEYS.NOTIFICATIONS);
    localStorage.removeItem(STORAGE_KEYS.AUDIT_LOGS);
    localStorage.removeItem(STORAGE_KEYS.COMPANY_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.STOCK_LOCATIONS);
    localStorage.removeItem(STORAGE_KEYS.CLIENT_DEBTS);
    localStorage.removeItem(STORAGE_KEYS.TRANSFER_RECEIPTS);
    localStorage.removeItem(STORAGE_KEYS.CLIENT_MESSAGES);
    localStorage.removeItem(STORAGE_KEYS.VEHICLES);

    setPackages([]);
    refreshPackages();
    setUsers(INITIAL_USERS);
    setCities(INITIAL_CITIES);
    setPickups(INITIAL_PICKUPS);
    setPartners(INITIAL_PARTNERS);
    setAgencies(INITIAL_AGENCIES);
    setVehicles(INITIAL_VEHICLES);
    setPayments(INITIAL_PAYMENTS);
    setAuditLogs(INITIAL_AUDIT_LOGS);
    setCompanySettings(INITIAL_COMPANY_SETTINGS);
    setStockLocations(INITIAL_STOCK_LOCATIONS);
    setClientDebts(INITIAL_DEBTS);
    setTransferReceipts([]);
    setClientMessages(INITIAL_CLIENT_MESSAGES);
    setReviews([]);
    setClientStockProducts([]);
    setClientStockMovements([]);
    setClientStockInvoices([]);
  };

  const wipeSystemData = async (): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await directSupabaseRequest('admin/system/wipe-data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        return {
          success: false,
          message: data?.error || data?.message || `Échec de la réinitialisation (HTTP ${res.status}).`
        };
      }

      Object.values(STORAGE_KEYS).forEach(k => {
        try {
          localStorage.removeItem(k);
        } catch (_) {}
      });

      setPackages([]);
      setPickups([]);
      setPayments([]);
      setBons([]);
      setAuditLogs([]);
      setNotifications([]);
      setStockLocations([]);
      setClientDebts([]);
      setTransferReceipts([]);
      setClientMessages([]);
      setReviews([]);
      setClientStockProducts([]);
      setClientStockMovements([]);
      setClientStockInvoices([]);
      setDriverRequests([]);
      setSavedAddresses([]);
      setVehicles([]);
      setPartners(INITIAL_PARTNERS);
      setPartnerSyncLogs([]);
      setWhatsappLogs([]);
      setUsers(INITIAL_USERS);

      await refreshPackages();

      return {
        success: true,
        message: data.message || 'Système entièrement vidé et réinitialisé avec succès.'
      };
    } catch (e: any) {
      return {
        success: false,
        message: e.message || 'Erreur lors de la réinitialisation du système.'
      };
    }
  };

  // ---------------------------------------------------------------------------
  // AUTOMATED SMART ALERTS (STALLED >48H, RETURNS, DEBTS, UNSCANNED STOCK)
  // ---------------------------------------------------------------------------
  const smartAlerts = React.useMemo(
    () =>
      computeSmartAlerts({
        packages,
        clientDebts,
        clientStockProducts
      }),
    [packages, clientDebts, clientStockProducts]
  );

  const triggeredAutoAlertIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!hasHydratedCollectionsRef.current || smartAlerts.length === 0) return;
    const criticalNew = smartAlerts.filter(
      a => a.severity === 'critical' && !triggeredAutoAlertIdsRef.current.has(a.id)
    );
    if (criticalNew.length === 0) return;

    criticalNew.slice(0, 3).forEach(alertItem => {
      triggeredAutoAlertIdsRef.current.add(alertItem.id);
      addNotification({
        title: `⚠️ تنبيه ذكي: ${alertItem.title}`,
        message: alertItem.description,
        type: 'alert'
      });
    });
    criticalNew.forEach(a => triggeredAutoAlertIdsRef.current.add(a.id));
  }, [smartAlerts]);

  // ---------------------------------------------------------------------------
  // WHATSAPP WEBHOOK TEST & LOGS MANAGEMENT
  // ---------------------------------------------------------------------------
  const clearWhatsappLogs = async () => {
    try {
      const res = await directSupabaseRequest('notifications/whatsapp-logs', {
        method: 'DELETE'
      });
      if (res.ok) {
        setWhatsappLogs([]);
      }
    } catch {
      // ignore
    }
  };

  const testWhatsappWebhook = async (opts?: {
    provider?: 'webhook' | 'meta_cloud';
    phoneNumberId?: string;
    webhookUrl?: string;
    apiToken?: string;
    notifyTarget?: 'recipient' | 'merchant' | 'both';
    template?: string;
    recipientPhone?: string;
    recipientName?: string;
  }): Promise<{ success: boolean; log?: WhatsappDispatchLog; error?: string; webhookConfigured?: boolean }> => {
    try {
      const trackingUrl = buildLiveTrackingUrl('FAR-TEST-WA01', companySettings.website);
      const res = await authedFetch('/api/notifications/whatsapp-dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          testMode: true,
          provider: opts?.provider || companySettings.whatsappProvider || 'webhook',
          phoneNumberId: opts?.phoneNumberId ?? companySettings.whatsappPhoneNumberId,
          webhookUrl: opts?.webhookUrl,
          apiToken: opts?.apiToken,
          notifyTarget: opts?.notifyTarget || companySettings.whatsappNotifyTarget || 'both',
          template: opts?.template,
          recipientPhone: opts?.recipientPhone || companySettings.whatsapp,
          recipientName: opts?.recipientName || 'Test Destinataire FARIOUSY',
          trackingNumber: 'FAR-TEST-WA01',
          trackingUrl,
          status: 'en_cours_livraison',
          statusLabel: 'En cours de livraison',
          city: 'Casablanca',
          codAmount: 250
        })
      });
      const data = await res.json();
      if (data?.log) {
        setWhatsappLogs(prev => [data.log, ...prev].slice(0, 100));
      }
      return {
        success: Boolean(data?.success),
        log: data?.log,
        error: data?.error,
        webhookConfigured: data?.webhookConfigured
      };
    } catch (e: any) {
      return {
        success: false,
        error: e?.message || 'Erreur lors du test Webhook WhatsApp'
      };
    }
  };

  // ---------------------------------------------------------------------------
  // FULL SYSTEM BACKUP & RESTORE (EXPORT / IMPORT JSON)
  // ---------------------------------------------------------------------------
  const exportSystemBackup = async (): Promise<{
    success: boolean;
    message: string;
    fileName?: string;
  }> => {
    try {
      const res = await directSupabaseRequest('admin/system/backup', {
        method: 'GET'
      });
      const data = await res.json();
      if (!res.ok || !data?.success || !data?.backup) {
        return {
          success: false,
          message: data?.error || 'Impossible de générer la sauvegarde JSON.'
        };
      }

      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}`;
      const fileName = `fariousy_backup_${stamp}.json`;

      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      addAuditLog({
        userId: 'usr-admin',
        userName: 'Super Admin',
        userRole: 'super_admin',
        actionType: 'CREATE',
        module: 'settings',
        entityId: 'system_backup',
        entityLabel: fileName,
        details: 'Téléchargement de la sauvegarde complète du système (JSON)'
      });

      return {
        success: true,
        fileName,
        message: `Sauvegarde complète téléchargée (${fileName}).`
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Erreur lors de l’exportation de la sauvegarde.'
      };
    }
  };

  const restoreSystemBackup = async (
    backupPayload: any
  ): Promise<{ success: boolean; message: string }> => {
    try {
      const res = await directSupabaseRequest('admin/system/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ backup: backupPayload })
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return {
          success: false,
          message: data?.message || data?.error || 'Échec de la restauration.'
        };
      }

      // Reset sync hashes & rehydrate every module from authoritative backend
      lastSyncedCollectionJsonRef.current = {};
      await Promise.all([
        hydrateServerCollections(),
        refreshPartners(),
        refreshPackages(),
        refreshReviews(),
        refreshBlacklist(),
        refreshClientStock(),
        refreshWhatsappLogs(),
        authedFetch('/api/company-settings')
          .then(r => (r.ok ? r.json() : null))
          .then(d => {
            if (d?.success && d.settings) setCompanySettings(prev => ({ ...prev, ...d.settings }));
          })
          .catch(() => {}),
        fetchSupabaseClients()
          .then(r => {
            if (!r.error && Array.isArray(r.clients)) {
              setUsers(prev => [...prev.filter(u => u.role !== 'client'), ...r.clients]);
            }
          })
          .catch(() => {}),
        fetchSupabaseDrivers()
          .then(r => {
            if (!r.error && Array.isArray(r.drivers)) {
              setUsers(prev => [...prev.filter(u => u.role !== 'driver'), ...r.drivers]);
            }
          })
          .catch(() => {})
      ]);

      const st = data.stats;
      const summary = st
        ? `${st.packages} colis, ${st.users} comptes, ${st.shops} boutiques, ${st.clientStockProducts} produits stock`
        : 'Données restaurées';

      return {
        success: true,
        message: `✅ Restauration réussie : ${summary}.`
      };
    } catch (e: any) {
      return {
        success: false,
        message: e?.message || 'Erreur réseau lors de la restauration.'
      };
    }
  };

  const submitReview = async (payload: {
    targetType: ReviewTargetType;
    rating: number;
    comment: string;
    authorName: string;
    authorRole?: 'client' | 'destinataire' | 'visiteur';
    authorCity?: string;
    authorPhone?: string;
    driverId?: string;
    driverName?: string;
    trackingNumber?: string;
  }): Promise<{ success: boolean; review?: CustomerReview; error?: string }> => {
    try {
      const res = await directSupabaseRequest('reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر إرسال الرأي.' };
      }
      if (data.review) {
        setReviews(prev => [data.review, ...prev.filter(r => r.id !== data.review.id)]);
      }
      return { success: true, review: data.review };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const updateReview = async (
    id: string,
    updates: { isPublic?: boolean; adminReply?: string }
  ): Promise<{ success: boolean; review?: CustomerReview; error?: string }> => {
    try {
      const res = await authedFetch(`/api/reviews/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر تحديث الرأي.' };
      }
      if (data.review) {
        setReviews(prev => prev.map(r => (r.id === id ? data.review : r)));
      }
      return { success: true, review: data.review };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const deleteReview = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authedFetch(`/api/reviews/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر حذف الرأي.' };
      }
      setReviews(prev => prev.filter(r => r.id !== id));
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const createClientStockProduct = async (payload: {
    clientId: string;
    clientName?: string;
    clientCompany?: string;
    name: string;
    photoUrl?: string;
    category?: string;
    unitPrice: number;
    quantity: number;
    hubName?: string;
    notes?: string;
    actorName?: string;
  }): Promise<{ success: boolean; product?: ClientStockProduct; error?: string }> => {
    try {
      const submitPayload = async (bodyPayload: typeof payload) => {
        const response = await authedFetch('/api/client-stock/products', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(bodyPayload)
        });
        const rawText = await response.text().catch(() => '');
        let parsed: any = {};
        try {
          parsed = rawText ? JSON.parse(rawText) : {};
        } catch {
          parsed = {};
        }
        return { response, parsed, rawText };
      };

      let { response: res, parsed: data } = await submitPayload(payload);

      // If proxy/server rejected payload due to large image (413 or non-JSON gateway error), retry once without photo
      if ((!res.ok || !data?.success) && payload.photoUrl && (res.status === 413 || (!data?.error && res.status >= 500))) {
        const retryResult = await submitPayload({ ...payload, photoUrl: undefined });
        if (retryResult.response.ok && retryResult.parsed?.success) {
          res = retryResult.response;
          data = retryResult.parsed;
        }
      }

      if (!res.ok || !data?.success) {
        const statusHint =
          res.status === 401
            ? 'انتهت صلاحية الجلسة. عافاك خرج وعاود تسجيل الدخول.'
            : res.status === 413
            ? 'حجم الصورة كبير بزاف. جرب صورة أصغر أو بدون صورة.'
            : res.status >= 500
            ? `الخادم ماجاوبش مؤقتاً (${res.status}). عاود المحاولة بعد ثواني.`
            : res.status
            ? `تعذر إضافة المنتوج للسطوك (رمز الخطأ ${res.status}).`
            : 'تعذر إضافة المنتوج للسطوك.';
        return { success: false, error: data?.error || statusHint };
      }

      if (data.product) {
        clearDeletedId(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS, data.product.id);
        setClientStockProducts(prev => {
          const next = [data.product, ...prev.filter(p => p.id !== data.product.id)];
          writeClientStockDurableBackup({ products: next });
          return next;
        });
      }
      if (data.movement) {
        setClientStockMovements(prev => {
          const next = [data.movement, ...prev];
          writeClientStockDurableBackup({ movements: next });
          return next;
        });
      }
      return { success: true, product: data.product };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const addClientStockUnits = async (
    productId: string,
    quantity: number,
    actorName?: string
  ): Promise<{ success: boolean; product?: ClientStockProduct; error?: string }> => {
    try {
      const res = await authedFetch(`/api/client-stock/products/${encodeURIComponent(productId)}/add-units`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity, actorName })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || `تعذر زيادة العدد (${res.status}).` };
      }
      if (data.product) {
        setClientStockProducts(prev => {
          const next = prev.map(p => (p.id === productId ? data.product : p));
          writeClientStockDurableBackup({ products: next });
          return next;
        });
      }
      if (data.movement) {
        setClientStockMovements(prev => {
          const next = [data.movement, ...prev];
          writeClientStockDurableBackup({ movements: next });
          return next;
        });
      }
      return { success: true, product: data.product };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const scanClientStockUnit = async (
    codeOrProductId: string,
    opts?: {
      hubName?: string;
      zone?: string;
      shelf?: string;
      bin?: string;
      actorName?: string;
      scanAllPending?: boolean;
    }
  ): Promise<{
    success: boolean;
    message: string;
    product?: ClientStockProduct;
    unit?: ClientStockUnit;
  }> => {
    try {
      const res = await authedFetch('/api/client-stock/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeOrProductId, ...(opts || {}) })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.product) {
        setClientStockProducts(prev => {
          const next = prev.map(p => (p.id === data.product.id ? data.product : p));
          writeClientStockDurableBackup({ products: next });
          return next;
        });
      }
      if (res.ok && data?.success) {
        await refreshClientStock();
      }
      return {
        success: Boolean(res.ok && data?.success),
        message: data?.message || data?.error || 'تعذر سكان القطعة.',
        product: data?.product,
        unit: data?.unit
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const dispatchClientStockUnit = async (
    codeOrProductId: string,
    opts?: {
      clientId?: string;
      trackingNumber?: string;
      packageId?: string;
      actorName?: string;
      notes?: string;
    }
  ): Promise<{
    success: boolean;
    message: string;
    product?: ClientStockProduct;
    unit?: ClientStockUnit;
  }> => {
    try {
      const res = await authedFetch('/api/client-stock/dispatch-unit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: codeOrProductId, ...(opts || {}) })
      });
      const data = await res.json().catch(() => ({}));
      if (data?.product) {
        setClientStockProducts(prev => {
          const next = prev.map(p => (p.id === data.product.id ? data.product : p));
          writeClientStockDurableBackup({ products: next });
          return next;
        });
      }
      if (data?.movement) {
        setClientStockMovements(prev => {
          const next = [data.movement, ...prev.filter(m => m.id !== data.movement.id)];
          writeClientStockDurableBackup({ movements: next });
          return next;
        });
      }
      if (res.ok && data?.success) {
        await refreshClientStock();
      }
      return {
        success: Boolean(res.ok && data?.success),
        message: data?.message || data?.error || 'تعذر إخراج القطعة من السطوك.',
        product: data?.product,
        unit: data?.unit
      };
    } catch (e: any) {
      return { success: false, message: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const deductClientStockForPackage = async (payload: {
    clientId: string;
    shopId?: string;
    clientName: string;
    clientCompany?: string;
    clientPhone?: string;
    packageId: string;
    trackingNumber: string;
    recipientName: string;
    recipientCity: string;
    deliveryFee: number;
    items: { productId: string; quantity: number }[];
    actorName?: string;
  }): Promise<{ success: boolean; invoice?: ClientStockInvoice; error?: string }> => {
    try {
      const res = await authedFetch('/api/client-stock/deduct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر خصم السطوك وتوليد الفاتورة.' };
      }
      if (Array.isArray(data.updatedProducts) && data.updatedProducts.length > 0) {
        const updatedMap = new Map<string, ClientStockProduct>(
          data.updatedProducts.map((p: ClientStockProduct) => [p.id, p])
        );
        setClientStockProducts(prev => prev.map(p => updatedMap.get(p.id) || p));
      }
      if (Array.isArray(data.movements) && data.movements.length > 0) {
        setClientStockMovements(prev => [...data.movements, ...prev]);
      }
      if (data.invoice) {
        setClientStockInvoices(prev => [data.invoice, ...prev.filter(i => i.id !== data.invoice.id)]);
      }
      await refreshClientStock();
      return { success: true, invoice: data.invoice };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const restoreClientStockForPackage = async (
    packageId: string,
    trackingNumber?: string,
    actorName?: string
  ): Promise<{ success: boolean; restoredCount: number }> => {
    try {
      const res = await authedFetch('/api/client-stock/restore-package', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageId, trackingNumber, actorName })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.success) {
        if (Array.isArray(data.updatedProducts) && data.updatedProducts.length > 0) {
          const updatedMap = new Map<string, ClientStockProduct>(
            data.updatedProducts.map((p: ClientStockProduct) => [p.id, p])
          );
          setClientStockProducts(prev => prev.map(p => updatedMap.get(p.id) || p));
        }
        if ((data.restoredCount || 0) > 0) {
          await refreshClientStock();
        }
        return { success: true, restoredCount: Number(data.restoredCount || 0) };
      }
      return { success: false, restoredCount: 0 };
    } catch {
      return { success: false, restoredCount: 0 };
    }
  };

  const updateClientStockInvoiceStatus = async (
    invoiceId: string,
    status: 'generee' | 'payee'
  ): Promise<{ success: boolean; invoice?: ClientStockInvoice; error?: string }> => {
    try {
      const res = await authedFetch(`/api/client-stock/invoices/${encodeURIComponent(invoiceId)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر تحديث حالة الفاتورة.' };
      }
      if (data.invoice) {
        setClientStockInvoices(prev => prev.map(i => (i.id === invoiceId ? data.invoice : i)));
      }
      return { success: true, invoice: data.invoice };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const deleteClientStockProduct = async (
    productId: string
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authedFetch(`/api/client-stock/products/${encodeURIComponent(productId)}`, {
        method: 'DELETE'
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 404) {
        recordDeletedId(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS, productId);
        setClientStockProducts(prev => {
          const next = prev.filter(p => p.id !== productId);
          writeClientStockDurableBackup({ products: next });
          return next;
        });
        setClientStockMovements(prev => {
          const next = prev.filter(m => m.productId !== productId);
          writeClientStockDurableBackup({ movements: next });
          return next;
        });
        await refreshClientStock();
        return { success: true };
      }
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر حذف المنتوج.' };
      }
      recordDeletedId(STORAGE_KEYS.CLIENT_STOCK_DELETED_IDS, productId);
      setClientStockProducts(prev => {
        const next = prev.filter(p => p.id !== productId);
        writeClientStockDurableBackup({ products: next });
        return next;
      });
      setClientStockMovements(prev => {
        const next = prev.filter(m => m.productId !== productId);
        writeClientStockDurableBackup({ movements: next });
        return next;
      });
      await refreshClientStock();
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const deleteClientStockUnit = async (
    productId: string,
    unitId: string
  ): Promise<{ success: boolean; product?: ClientStockProduct; error?: string }> => {
    try {
      const res = await authedFetch(
        `/api/client-stock/products/${encodeURIComponent(productId)}/units/${encodeURIComponent(unitId)}`,
        { method: 'DELETE' }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر حذف القطعة.' };
      }
      if (data.product) {
        setClientStockProducts(prev => prev.map(p => (p.id === productId ? data.product : p)));
      }
      await refreshClientStock();
      return { success: true, product: data.product };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const addBlacklistEntry = async (payload: {
    phone: string;
    customerName?: string;
    city?: string;
    reason?: string;
    comment: string;
  }): Promise<{ success: boolean; entry?: BlacklistEntry; error?: string }> => {
    try {
      const res = await authedFetch('/api/blacklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر تسجيل الرقم في اللائحة السوداء.' };
      }
      if (Array.isArray(data.entries)) {
        setBlacklistEntries(data.entries);
      } else if (data.entry) {
        await refreshBlacklist();
      }
      return { success: true, entry: data.entry };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  const deleteBlacklistEntry = async (id: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const res = await authedFetch(`/api/blacklist/${encodeURIComponent(id)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data?.success) {
        return { success: false, error: data?.error || 'تعذر حذف السجل.' };
      }
      if (Array.isArray(data.entries)) {
        setBlacklistEntries(data.entries);
      } else {
        setBlacklistEntries(prev => prev.filter(e => e.id !== id));
      }
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e?.message || 'خطأ في الاتصال بالخادم.' };
    }
  };

  return (
    <DatabaseContext.Provider
      value={{
        packages,
        isPackagesLoading,
        refreshPackages,
        users,
        cities,
        pickups,
        partners,
        refreshPartners,
        agencies,
        payments,
        notifications,
        auditLogs,
        companySettings,
        stockLocations,
        clientDebts,
        transferReceipts,
        clientMessages,
        reviews,
        publicDrivers,
        refreshReviews,
        submitReview,
        updateReview,
        deleteReview,
        blacklistEntries,
        refreshBlacklist,
        addBlacklistEntry,
        deleteBlacklistEntry,
        findBlacklistMatches,
        clientStockProducts,
        clientStockMovements,
        clientStockInvoices,
        refreshClientStock,
        createClientStockProduct,
        addClientStockUnits,
        scanClientStockUnit,
        dispatchClientStockUnit,
        deductClientStockForPackage,
        restoreClientStockForPackage,
        updateClientStockInvoiceStatus,
        deleteClientStockProduct,
        deleteClientStockUnit,
        unreadOrdersBadgeCount,
        clearUnreadOrdersBadge,
        triggerNewOrderNotification,

        // Client Messaging Operations
        sendClientMessage,
        replyToClientMessage,
        updateClientMessageStatus,
        deleteClientMessage,

        // Package Operations
        upsertPackageLocal,
        addPackage,
        addMultiplePackages,
        updatePackage,
        deletePackage,
        changePackageStatus,
        assignPackageToDriver,
        assignMultiplePackagesToDriver,
        updatePackageStatus,
        reportPackageProblem,
        resolvePackageProblem,
        transferPackageToPartner,
        transferPackageAgency,
        scanBarcodeAction,

        // Saved Addresses
        savedAddresses,
        addSavedAddress,
        updateSavedAddress,
        deleteSavedAddress,
        markSavedAddressUsed,

        // Client Operations
        addClient,
        registerBoutique,
        updateClient,
        deleteClient,
        toggleClientStatus,
        approveClient,
        rejectClient,
        suspendClient,
        updateClientRate,
        removeClientRate,
        setClientCustomRates,
        resetClientCustomRates,
        updateClientPassword,

        // Driver Operations
        driverRequests,
        submitDriverRegistration,
        approveDriverRegistration,
        rejectDriverRegistration,
        deleteDriverRegistrationRequest,
        addDriver,
        createDriverAccount,
        updateDriverPassword,
        updateDriver,
        deleteDriver,
        toggleDriverStatus,

        // Employee Operations
        addEmployee,
        createEmployeeAccount,
        updateEmployeeAccount,
        deleteEmployeeAccount,
        updateEmployee,
        deleteEmployee,
        toggleEmployeeStatus,
        updateUserPermissions,

        // Partner Operations
        addPartner,
        updatePartner,
        deletePartner,
        partnerSyncLogs,
        dispatchPackagesToPartner,
        retryFailedPartnerTransmissions,
        regeneratePartnerWebhookToken,
        syncPartnerStatuses,
        testPartnerConnection,
        clearPartnerLogs,
        addPartnerSettlement,

        // Cities Operations
        addCity,
        updateCity,
        deleteCity,

        // Hubs & Agencies Operations
        addAgency,
        updateAgency,
        deleteAgency,

        // Vehicles & Fleet Operations (المركبات والتتبع)
        vehicles,
        addVehicle,
        updateVehicle,
        deleteVehicle,
        simulateVehicleTelemetry,

        // Pickup Operations
        createPickupRequest,
        updatePickupStatus,
        deletePickupRequest,

        // Bons Operations (Bon Delivery & Bon Client)
        bons,
        createBonDelivery,
        createBonClient,
        updateBonStatus,
        deleteBon,

        // Stock Operations
        addStockLocation,
        updateStockLocation,
        deleteStockLocation,
        moveStockLocation,

        // Financial Operations
        generateClientPayment,
        markPaymentPaid,
        cancelPayment,
        attachPaymentReceipt,
        addTransferReceipt,
        deleteTransferReceipt,
        addClientDebt,
        settleClientDebt,
        deleteClientDebt,

        // Audit Logs
        addAuditLog,
        clearAuditLogs,

        // Settings
        updateCompanySettings,

        // WhatsApp Webhook & Smart Alerts & Backup/Restore
        whatsappLogs,
        refreshWhatsappLogs,
        clearWhatsappLogs,
        testWhatsappWebhook,
        smartAlerts,
        exportSystemBackup,
        restoreSystemBackup,

        // Notifications & Reset
        addNotification,
        markNotificationRead,
        clearNotifications,
        resetToDefaultData,
        wipeSystemData
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
};

export const useDatabase = () => {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error('useDatabase must be used within a DatabaseProvider');
  }
  return context;
};
