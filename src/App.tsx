/**
 * FARIOUSY DELIVERY — Application Professionnelle de Gestion Logistique & Livraison
 */
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { DatabaseProvider, useDatabase } from './context/DatabaseContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LanguageProvider, useLanguage } from './i18n/LanguageContext';
import { Navbar } from './components/Navbar';
import { Sidebar, ActiveTab, AdminSidebarAction } from './components/Sidebar';
import { LandingPage } from './components/public/LandingPage';
import { SuspendedAccountScreen } from './components/auth/SuspendedAccountScreen';
import { ThermalLabelModal } from './components/ThermalLabelModal';
import { BarcodeScannerModal } from './components/BarcodeScannerModal';
import { PackageDetailsModal } from './components/PackageDetailsModal';
import { AddPackageModal } from './components/AddPackageModal';
import { FinancialReleveModal } from './components/FinancialReleveModal';
import { RealtimeToastContainer } from './components/RealtimeToastContainer';
import { SupabaseRealtimeModal } from './components/SupabaseRealtimeModal';
import { ImpersonationBanner } from './components/common/ImpersonationBanner';
import { BlacklistManager, BlacklistPrefill } from './components/common/BlacklistManager';
import { ErrorBoundary } from './components/common/ErrorBoundary';
import { NotificationsCenterOverlay } from './components/notifications/NotificationsCenterOverlay';
import {
  clearReadUserNotifications,
  deleteUserNotification,
  fetchUserNotifications,
  markAllUserNotificationsRead,
  markUserNotificationRead,
  NotificationRecipientsPayload,
  sendAdminNotification,
  SendUserNotificationPayload
} from './services/userNotifications';

// Admin Views
import { AdminDashboard } from './components/admin/AdminDashboard';
import { AdminPackages } from './components/admin/AdminPackages';
import { AdminClients } from './components/admin/AdminClients';
import { AdminDrivers } from './components/admin/AdminDrivers';
import { AdminDriverApprovals } from './components/admin/AdminDriverApprovals';
import { AdminVehicles } from './components/admin/AdminVehicles';
import { AdminVehicleAdd } from './components/admin/AdminVehicleAdd';
import { AdminEmployees } from './components/admin/AdminEmployees';
import { ConfirmationCenter } from './components/admin/ConfirmationCenter';
import { AdminPartners } from './components/admin/AdminPartners';
import { AdminPartnerDispatch } from './components/admin/AdminPartnerDispatch';
import { AdminApiPartners } from './components/admin/AdminApiPartners';
import { PartnerApiAccess } from './components/partner/PartnerApiAccess';
import { PartnerPortal } from './components/partner/PartnerPortal';
import { AdminCitiesRates } from './components/admin/AdminCitiesRates';
import { AdminHubs } from './components/admin/AdminHubs';
import { AdminFinance } from './components/admin/AdminFinance';
import { AdminDebts } from './components/admin/AdminDebts';
import { AdminPickups } from './components/admin/AdminPickups';
import { AdminStock } from './components/admin/AdminStock';
import { AdminSettings } from './components/admin/AdminSettings';
import { AdminClientMessages } from './components/admin/AdminClientMessages';
import { AdminReviews } from './components/admin/AdminReviews';
import { BonsManagement } from './components/bons/BonsManagement';
import { trackAnalyticsVisitDirect, sendStaffHeartbeatDirect } from './services/supabaseDirectGateway';
import { supabaseRealtime } from './services/supabase';

// Client Views
import { ClientDashboard } from './components/client/ClientDashboard';
import { ClientPackages } from './components/client/ClientPackages';
import { ClientPickups } from './components/client/ClientPickups';
import { ClientFinance } from './components/client/ClientFinance';
import { ClientDebts } from './components/client/ClientDebts';
import { ClientReturns } from './components/client/ClientReturns';
import { ClientProfile } from './components/client/ClientProfile';
import { ClientTariffs } from './components/client/ClientTariffs';
import { ClientBons } from './components/client/ClientBons';
import { ClientTracking } from './components/client/ClientTracking';
import { ClientMessages } from './components/client/ClientMessages';
import { ClientReviews } from './components/client/ClientReviews';
import { ClientStock } from './components/client/ClientStock';

// Driver Views
import { DriverTour } from './components/driver/DriverTour';
import { DriverCash } from './components/driver/DriverCash';
import { DriverMobileApp } from './components/driver/DriverMobileApp';
import { DriverApkLogin } from './components/driver/DriverApkLogin';

import { BonType, ClientPayment, PackageItem, UserNotificationMessage } from './types';
import {
  EMPLOYEE_ROLE_LABELS,
  getFirstAllowedAdminTab,
  getUserAssignedCities,
  hasEmployeePermission,
  isCityAllowedForUser,
  isTabAllowedForUser
} from './utils/employeePermissions';
import { QrCode, Wallet, FileSpreadsheet, X, PhoneCall, CheckCircle2, Landmark, Search, MapPin, Headset } from 'lucide-react';

const MainApp: React.FC = () => {
  const {
    currentUser,
    currentRole,
    isAdmin,
    isClient,
    isDriver,
    isEmployee,
    isAuthLoading,
    logout,
    refreshProfile,
    isImpersonating,
    stopImpersonation
  } = useAuth();
  const { packages, users, refreshClientStock } = useDatabase();
  const { language, t, isRtl } = useLanguage();

  const [driverModeOverride, setDriverModeOverride] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('app') === 'driver' || params.get('mode') === 'driver';
    }
    return false;
  });

  const [activeTab, setActiveTab] = useState<ActiveTab>(() => {
    if (isAdmin || isEmployee) return 'admin_dashboard';
    if (isClient) return 'client_dashboard';
    if (isDriver) return 'driver_tour';
    return 'admin_dashboard';
  });
  const [tabHistory, setTabHistory] = useState<ActiveTab[]>([]);

  const defaultHomeTab = useMemo<ActiveTab>(() => {
    if (!currentUser) return 'admin_dashboard';
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return 'admin_dashboard';
    if (currentUser.role === 'employee') return getFirstAllowedAdminTab(currentUser) as ActiveTab;
    if (currentUser.role === 'client') return 'client_dashboard';
    if (currentUser.role === 'driver') return 'driver_tour';
    if (currentUser.role === 'partner') return 'partner_dashboard';
    return 'admin_dashboard';
  }, [currentUser]);

  const navigateToTab = useCallback(
    (nextTab: ActiveTab) => {
      if (activeTab === nextTab) return;
      setTabHistory(hist => [...hist.slice(-29), activeTab]);
      setActiveTab(nextTab);
      if (typeof window !== 'undefined') {
        try {
          window.history.pushState({ farTab: nextTab }, '');
        } catch {}
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [activeTab]
  );

  const canGoBack = tabHistory.length > 0 || activeTab !== defaultHomeTab;

  const handleGoBack = useCallback(() => {
    const nextHist = [...tabHistory];
    let targetTab: ActiveTab | null = null;
    while (nextHist.length > 0) {
      const candidate = nextHist.pop()!;
      if (candidate === activeTab) continue;
      if (currentUser?.role === 'employee' && !isTabAllowedForUser(currentUser, candidate)) {
        continue;
      }
      targetTab = candidate;
      break;
    }

    if (targetTab) {
      setTabHistory(nextHist);
      setActiveTab(targetTab);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }

    if (activeTab !== defaultHomeTab) {
      setTabHistory([]);
      setActiveTab(defaultHomeTab);
      if (typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [activeTab, tabHistory, currentUser, defaultHomeTab]);

  // Reset navigation stack when switching user account or role
  useEffect(() => {
    setTabHistory([]);
  }, [currentUser?.id, currentUser?.role]);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals state
  const [isAddPackageOpen, setIsAddPackageOpen] = useState(false);
  const [addPackageInitialMode, setAddPackageInitialMode] = useState<'single' | 'bulk' | 'excel'>('single');
  const [preselectedStockProductId, setPreselectedStockProductId] = useState<string | null>(null);
  const openAddPackageModal = (
    initial: 'single' | 'bulk' | 'excel' = 'single',
    stockProductId: string | null = null
  ) => {
    setAddPackageInitialMode(initial);
    setPreselectedStockProductId(stockProductId);
    setIsAddPackageOpen(true);
  };
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerAgencyName, setScannerAgencyName] = useState<string | undefined>(undefined);
  const openScannerModal = (agencyName?: string) => {
    setScannerAgencyName(agencyName);
    setIsScannerOpen(true);
  };
  const [isNotificationsOverlayOpen, setIsNotificationsOverlayOpen] = useState(false);
  const [userNotifications, setUserNotifications] = useState<UserNotificationMessage[]>([]);
  const [sentUserNotifications, setSentUserNotifications] = useState<UserNotificationMessage[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState(0);
  const [notificationRecipients, setNotificationRecipients] = useState<NotificationRecipientsPayload | undefined>(undefined);
  const [isNotificationsLoading, setIsNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const [isRealtimeModalOpen, setIsRealtimeModalOpen] = useState(false);
  const [isDriverCashModalOpen, setIsDriverCashModalOpen] = useState(false);
  const [selectedLabelPackage, setSelectedLabelPackage] = useState<PackageItem | null>(null);
  const [selectedDetailsPackage, setSelectedDetailsPackage] = useState<PackageItem | null>(null);
  const [selectedRelevePayment, setSelectedRelevePayment] = useState<ClientPayment | null>(null);

  // Support Android hardware/gesture back button and browser back button inside app pages
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handlePopState = () => {
      if (isNotificationsOverlayOpen) {
        setIsNotificationsOverlayOpen(false);
        return;
      }
      if (selectedDetailsPackage) {
        setSelectedDetailsPackage(null);
        return;
      }
      if (isAddPackageOpen) {
        setIsAddPackageOpen(false);
        return;
      }
      if (isScannerOpen) {
        setIsScannerOpen(false);
        return;
      }
      if (canGoBack) {
        handleGoBack();
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [canGoBack, handleGoBack, isNotificationsOverlayOpen, selectedDetailsPackage, isAddPackageOpen, isScannerOpen]);
  const [partnerDispatchPreselectedIds, setPartnerDispatchPreselectedIds] = useState<string[]>([]);
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [packageSearchFilter, setPackageSearchFilter] = useState<{ query: string; nonce: number } | null>(null);
  const [searchNotice, setSearchNotice] = useState<{ type: 'info' | 'warning'; message: string } | null>(null);
  const [blacklistPrefill, setBlacklistPrefill] = useState<BlacklistPrefill | null>(null);
  const [packageStatusFilter, setPackageStatusFilter] = useState<{ status: string; nonce: number } | null>(null);
  const [focusPackagesSearchNonce, setFocusPackagesSearchNonce] = useState(0);
  const [clientsSubTab, setClientsSubTab] = useState<{
    tab: 'liste' | 'ajouter' | 'demandes' | 'en_attente' | 'suspendus';
    nonce: number;
  } | null>(null);
  const [focusClientsSearchNonce, setFocusClientsSearchNonce] = useState(0);
  const [openAddDriverNonce, setOpenAddDriverNonce] = useState(0);
  const [openAddPartnerNonce, setOpenAddPartnerNonce] = useState(0);
  const [focusStockSearchNonce, setFocusStockSearchNonce] = useState(0);
  const [bonsSubTab, setBonsSubTab] = useState<{ tab: BonType; nonce: number } | null>(null);

  const handleAdminSidebarAction = (action: AdminSidebarAction) => {
    const now = Date.now();
    switch (action.type) {
      case 'packages_list':
        setPackageStatusFilter({ status: action.status || 'all', nonce: now });
        break;
      case 'packages_search':
        setPackageStatusFilter({ status: 'all', nonce: now });
        setFocusPackagesSearchNonce(n => n + 1);
        break;
      case 'clients_subtab':
        setClientsSubTab({ tab: action.subTab, nonce: now });
        break;
      case 'clients_search':
        setClientsSubTab({ tab: 'liste', nonce: now });
        setFocusClientsSearchNonce(n => n + 1);
        break;
      case 'drivers_add':
        setOpenAddDriverNonce(n => n + 1);
        break;
      case 'partners_add':
        setOpenAddPartnerNonce(n => n + 1);
        break;
      case 'stock_search':
        setFocusStockSearchNonce(n => n + 1);
        break;
      case 'bons_subtab':
        setBonsSubTab({ tab: action.subTab, nonce: now });
        break;
    }
  };

  const handleReportPackageToBlacklist = (pkg: PackageItem) => {
    setBlacklistPrefill({
      phone: pkg.recipientPhone || '',
      customerName: pkg.recipientName || '',
      city: pkg.city || '',
      nonce: Date.now()
    });
    navigateToTab(isClient ? 'client_blacklist' : 'admin_blacklist');
  };

  useEffect(() => {
    if (!searchNotice) return;
    const timer = setTimeout(() => setSearchNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [searchNotice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      if (sessionStorage.getItem('far_visit_recorded')) return;
      sessionStorage.setItem('far_visit_recorded', '1');
      trackAnalyticsVisitDirect({ userAgent: navigator.userAgent }).catch(() => {});
    } catch {
      // ignore storage access issues
    }
  }, []);

  // حساب الكاش المباشر للمهام اليومية
  const driverCashStats = useMemo(() => {
    const list = Array.isArray(packages) ? packages : [];
    const collected = list
      .filter((p: any) => p.status === 'delivered' || p.status === 'livre')
      .reduce((acc: number, p: any) => acc + (Number(p.codAmount || p.price || p.amount) || 0), 0);

    const pending = list
      .filter((p: any) => p.status !== 'delivered' && p.status !== 'livre' && p.status !== 'cancelled' && p.status !== 'retourne')
      .reduce((acc: number, p: any) => acc + (Number(p.codAmount || p.price || p.amount) || 0), 0);

    const deliveredCount = list.filter((p: any) => p.status === 'delivered' || p.status === 'livre').length;
    const totalCount = list.length;

    return { collected, pending, deliveredCount, totalCount };
  }, [packages]);

  // تصدير تقرير الصندوق لـ CSV
  const handleExportCashReport = () => {
    const list = Array.isArray(packages) ? packages : [];
    const rows = [
      ['Code Suivi', 'Destinataire', 'Telephone', 'Statut', 'Montant COD (DH)'],
      ...list.map((p: any) => [
        p.trackingNumber || p.id,
        p.clientName || p.recipientName || 'N/A',
        p.clientPhone || p.phone || 'N/A',
        p.status,
        String(p.codAmount || p.price || 0)
      ])
    ];

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + rows.map(e => e.join(';')).join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Rapport_Caisse_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const employeePermissionsKey = (currentUser?.permissions || []).join(',');
  const employeeAssignedCities = useMemo(() => getUserAssignedCities(currentUser), [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') {
      setActiveTab(prev => (prev.startsWith('admin_') ? prev : 'admin_dashboard'));
    } else if (currentUser.role === 'employee') {
      setActiveTab(prev => {
        if (prev.startsWith('admin_') && isTabAllowedForUser(currentUser, prev)) {
          return prev;
        }
        return getFirstAllowedAdminTab(currentUser) as ActiveTab;
      });
    } else if (currentUser.role === 'client') {
      setActiveTab(prev => (prev.startsWith('client_') ? prev : 'client_dashboard'));
    } else if (currentUser.role === 'driver') {
      setActiveTab(prev => (prev.startsWith('driver_') ? prev : 'driver_tour'));
    } else if (currentUser.role === 'partner') {
      setActiveTab(prev => (prev.startsWith('partner_') ? prev : 'partner_dashboard'));
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.employeeRole, employeePermissionsKey, activeTab]);

  // Isolate Client Stock feed strictly to the active authenticated client/shop (or all for Admin/Employee)
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role === 'client') {
      refreshClientStock({
        clientId: currentUser.id,
        shopId: (currentUser as any).shopId
      });
    } else if (
      currentUser.role === 'admin' ||
      currentUser.role === 'super_admin' ||
      currentUser.role === 'employee'
    ) {
      refreshClientStock(null);
    }
  }, [currentUser?.id, currentUser?.role, (currentUser as any)?.shopId, refreshClientStock]);

  // Global Staff Presence Heartbeat & Work Hours Tick (Admin + Employees)
  useEffect(() => {
    if (!currentUser) return;
    if (currentUser.role !== 'admin' && currentUser.role !== 'super_admin' && currentUser.role !== 'employee') {
      return;
    }

    let cancelled = false;
    const sendHeartbeat = async (_offline = false) => {
      if (cancelled) return;
      try {
        await sendStaffHeartbeatDirect({ activeTab });
      } catch {
        // ignore network hiccups
      }
    };

    void sendHeartbeat(false);
    const interval = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        void sendHeartbeat(false);
      }
    }, 25000);

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void sendHeartbeat(false);
      }
    };
    const handlePageHide = () => {
      void sendHeartbeat(true);
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pagehide', handlePageHide);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pagehide', handlePageHide);
    };
  }, [currentUser?.id, currentUser?.role, activeTab]);

  // Load Supabase-persisted user notifications in background (manual open via Bell icon)
  const loadUserNotifications = useCallback(async (silent = false) => {
    if (!currentUser?.id) return;
    if (!silent) setIsNotificationsLoading(true);
    try {
      const res = await fetchUserNotifications();
      if (res.success) {
        setUserNotifications(res.notifications);
        setUnreadNotificationsCount(res.unreadCount);
        if (res.sentNotifications) {
          setSentUserNotifications(res.sentNotifications);
        }
        if (res.recipients) {
          setNotificationRecipients(res.recipients);
        }
        setNotificationsError(null);
      } else if (!silent) {
        setNotificationsError(res.error || 'Impossible de charger les notifications.');
      }
    } finally {
      if (!silent) setIsNotificationsLoading(false);
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (!currentUser?.id) {
      setIsNotificationsOverlayOpen(false);
      setUserNotifications([]);
      setSentUserNotifications([]);
      setUnreadNotificationsCount(0);
      setNotificationRecipients(undefined);
      setNotificationsError(null);
      return;
    }

    const isSuspended =
      currentUser.role === 'client' &&
      (currentUser.status === 'suspendu' || currentUser.accountStatus === 'suspendu');
    if (isSuspended) return;

    void loadUserNotifications(true);

    // Instant Realtime bell refresh when an admin message or automatic parcel status alert arrives
    const unsubUserNotif = supabaseRealtime.onUserNotificationCreated(() => {
      void loadUserNotifications(true);
    });
    const unsubPkgStatus = supabaseRealtime.onPackageStatusChanged(() => {
      setTimeout(() => {
        void loadUserNotifications(true);
      }, 450);
    });

    const pollTimer = setInterval(() => {
      if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
        void loadUserNotifications(true);
      }
    }, 30000);

    return () => {
      clearInterval(pollTimer);
      unsubUserNotif();
      unsubPkgStatus();
    };
  }, [currentUser?.id, currentUser?.role, currentUser?.status, currentUser?.accountStatus, loadUserNotifications]);

  const handleMarkNotificationRead = useCallback(async (id: string) => {
    setUserNotifications(prev => {
      const next = prev.map(n => (n.id === id ? { ...n, isRead: true } : n));
      setUnreadNotificationsCount(next.filter(n => !n.isRead).length);
      return next;
    });
    const res = await markUserNotificationRead(id);
    if (!res.success) {
      void loadUserNotifications(true);
    }
  }, [loadUserNotifications]);

  const handleMarkAllNotificationsRead = useCallback(async () => {
    setUserNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    setUnreadNotificationsCount(0);
    const res = await markAllUserNotificationsRead();
    if (!res.success) {
      void loadUserNotifications(true);
    }
  }, [loadUserNotifications]);

  const handleDeleteUserNotification = useCallback(
    async (id: string, options?: { global?: boolean }) => {
      if (options?.global) {
        setSentUserNotifications(prev => prev.filter(n => n.id !== id));
      }
      setUserNotifications(prev => {
        const next = prev.filter(n => n.id !== id);
        setUnreadNotificationsCount(next.filter(n => !n.isRead).length);
        return next;
      });
      const res = await deleteUserNotification(id, options);
      if (!res.success) {
        void loadUserNotifications(true);
      }
    },
    [loadUserNotifications]
  );

  const handleClearReadUserNotifications = useCallback(async () => {
    setUserNotifications(prev => {
      const next = prev.filter(n => !n.isRead);
      setUnreadNotificationsCount(next.length);
      return next;
    });
    const res = await clearReadUserNotifications();
    if (!res.success) {
      void loadUserNotifications(true);
    }
  }, [loadUserNotifications]);

  const handleSendAdminNotification = useCallback(
    async (payload: SendUserNotificationPayload) => {
      const res = await sendAdminNotification(payload);
      if (res.success) {
        await loadUserNotifications(true);
      }
      return { success: res.success, error: res.error };
    },
    [loadUserNotifications]
  );

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full bg-[#dc2626] flex flex-col items-center justify-center p-4 text-white">
        <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin mb-4" />
        <span className="font-extrabold tracking-wider text-base">FARIOUSY DELIVERY</span>
        <span className="text-xs text-red-100 font-medium mt-1">
          {language === 'ar' ? 'جاري تحميل الجلسة الآمنة...' : 'Chargement de la session sécurisée...'}
        </span>
      </div>
    );
  }

  if (!currentUser) {
    if (driverModeOverride) {
      return (
        <DriverApkLogin
          onExitDriverMode={() => {
            setDriverModeOverride(false);
            try {
              const url = new URL(window.location.href);
              url.searchParams.delete('app');
              url.searchParams.delete('mode');
              window.history.replaceState({}, '', url.toString());
            } catch {
              // ignore
            }
          }}
        />
      );
    }
    return <LandingPage />;
  }

  const isSuspendedClient =
    currentUser &&
    currentUser.role === 'client' &&
    (currentUser.status === 'suspendu' || currentUser.accountStatus === 'suspendu');

  if (isSuspendedClient) {
    return (
      <SuspendedAccountScreen
        user={currentUser}
        onLogout={logout}
        onRefresh={refreshProfile}
      />
    );
  }

  if (isDriver || driverModeOverride) {
    return (
      <>
        {isImpersonating && (
          <ImpersonationBanner
            onBackToAdmin={() => {
              stopImpersonation();
              setActiveTab('admin_drivers');
            }}
          />
        )}
        <ErrorBoundary resetKey="driver_mobile">
          <DriverMobileApp
            onOpenNotifications={() => {
              setIsNotificationsOverlayOpen(true);
              void loadUserNotifications(false);
            }}
            unreadNotificationsCount={unreadNotificationsCount}
            onExitMobileView={() => {
              if (isImpersonating) {
                stopImpersonation();
                setActiveTab('admin_drivers');
              } else if (driverModeOverride && (isAdmin || isEmployee)) {
                setDriverModeOverride(false);
                const url = new URL(window.location.href);
                url.searchParams.delete('app');
                url.searchParams.delete('mode');
                window.history.replaceState({}, '', url.toString());
              } else {
                logout();
              }
            }}
          />
        </ErrorBoundary>
        <NotificationsCenterOverlay
          isOpen={isNotificationsOverlayOpen}
          onClose={() => setIsNotificationsOverlayOpen(false)}
          currentUser={currentUser}
          notifications={userNotifications}
          sentNotifications={sentUserNotifications}
          unreadCount={unreadNotificationsCount}
          isLoading={isNotificationsLoading}
          errorMessage={notificationsError}
          recipients={notificationRecipients}
          fallbackUsers={users}
          onRefresh={() => loadUserNotifications(false)}
          onMarkRead={handleMarkNotificationRead}
          onMarkAllRead={handleMarkAllNotificationsRead}
          onDeleteNotification={handleDeleteUserNotification}
          onClearRead={handleClearReadUserNotifications}
          onSendMessage={handleSendAdminNotification}
        />
        <RealtimeToastContainer />
      </>
    );
  }

  const handleSearchTracking = (rawQuery: string) => {
    const trimmed = rawQuery.trim();
    if (!trimmed) return;
    const cleanUpper = trimmed.toUpperCase();
    const digitsOnly = trimmed.replace(/\D/g, '');
    const myShopId = (currentUser as any)?.shopId;
    const scopedPackages = isClient
      ? packages.filter(
          p =>
            p.clientId === currentUser.id ||
            (Boolean(p.shopId) && (p.shopId === currentUser.id || (Boolean(myShopId) && p.shopId === myShopId))) ||
            (Boolean(myShopId) && p.clientId === myShopId)
        )
      : isEmployee
      ? packages.filter(p => isCityAllowedForUser(currentUser, p.city))
      : packages;

    const exactTracking = scopedPackages.find(
      p => (p.trackingNumber || '').toUpperCase() === cleanUpper || (p.id || '').toUpperCase() === cleanUpper
    );
    if (exactTracking) {
      setSearchNotice(null);
      setSelectedDetailsPackage(exactTracking);
      return;
    }

    const matches = scopedPackages.filter(p => {
      if ((p.trackingNumber || '').toUpperCase().includes(cleanUpper)) return true;
      if (p.recipientName && p.recipientName.toLowerCase().includes(trimmed.toLowerCase())) return true;
      if (digitsOnly.length >= 4) {
        const recDigits = String(p.recipientPhone || '').replace(/\D/g, '');
        const cliDigits = String(p.clientPhone || '').replace(/\D/g, '');
        const lastDigits = digitsOnly.length >= 9 ? digitsOnly.slice(-9) : digitsOnly;
        if (recDigits.includes(lastDigits) || cliDigits.includes(lastDigits)) return true;
      }
      return false;
    });

    if (matches.length === 1) {
      setSearchNotice(null);
      setSelectedDetailsPackage(matches[0]);
      return;
    }

    if (matches.length > 1) {
      setPackageSearchFilter({ query: trimmed, nonce: Date.now() });
      navigateToTab(isClient ? 'client_packages' : 'admin_packages');
      setSearchNotice({
        type: 'info',
        message:
          language === 'ar'
            ? `تم العثور على ${matches.length} طرود مطابقة لـ "${trimmed}".`
            : `${matches.length} colis trouvés pour « ${trimmed} ».`
      });
      return;
    }

    // Check if an unowned tracking exists (for client view)
    if (isClient) {
      const otherClientMatch = packages.find(
        p => (p.trackingNumber || '').toUpperCase() === cleanUpper || (p.id || '').toUpperCase() === cleanUpper
      );
      if (otherClientMatch) {
        setSearchNotice({
          type: 'warning',
          message:
            language === 'ar'
              ? 'هذا الطرد لا ينتمي إلى متجرك.'
              : "Ce colis n'appartient pas à votre boutique."
        });
        return;
      }
    }

    setSearchNotice({
      type: 'warning',
      message:
        language === 'ar'
          ? `لم يتم العثور على أي طرد مطابق لـ "${trimmed}".`
          : `Aucun colis trouvé pour « ${trimmed} ».`
    });
  };

  return (
    <div className="h-[calc(100dvh-var(--sat)-var(--sab))] w-full max-w-full bg-slate-100/70 text-slate-900 flex flex-col overflow-hidden">
      {isImpersonating && (
        <ImpersonationBanner
          onBackToAdmin={() => {
            stopImpersonation();
            navigateToTab(currentUser?.role === 'partner' ? 'admin_partners' : 'admin_clients');
          }}
        />
      )}
      <div className="flex-1 min-h-0 flex min-w-0 w-full overflow-hidden">
        {/* Sidebar Navigation */}
        <Sidebar
          activeTab={activeTab}
          onSelectTab={navigateToTab}
          onAdminAction={handleAdminSidebarAction}
          isOpenMobile={isMobileSidebarOpen}
          onCloseMobile={() => setIsMobileSidebarOpen(false)}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenAddPackage={() => openAddPackageModal('single')}
        />

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 flex flex-col min-w-0 w-full overflow-hidden">
          <Navbar
            onOpenScanner={() => openScannerModal()}
            onOpenRealtimeModal={() => setIsRealtimeModalOpen(true)}
            onToggleMobileSidebar={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
            onOpenNotifications={() => {
              setIsNotificationsOverlayOpen(true);
              void loadUserNotifications(false);
            }}
            unreadNotificationsCount={unreadNotificationsCount}
            canGoBack={canGoBack}
            onGoBack={handleGoBack}
          />

          {/* Independently scrollable content area so top Navbar & Logo remain 100% visible at all times */}
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-clip overscroll-contain">
          {/* Compact Quick Action Bar */}
          <div className="bg-slate-900 text-white px-2.5 sm:px-4 py-1.5 sm:py-2 flex items-center justify-between gap-2 border-b border-slate-800 w-full max-w-full">
            <div className="hidden sm:flex items-center gap-2 min-w-0">
              <span className="text-[11px] sm:text-xs font-bold tracking-wider text-slate-300 truncate">
                FARIOUSY Hub & Opérations
              </span>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto w-full sm:w-auto justify-start sm:justify-end">
              {(!isEmployee || hasEmployeePermission(currentUser, 'scanner')) && (
                <button
                  onClick={() => setIsScannerOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-xs transition whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <QrCode className="w-3.5 h-3.5 shrink-0" />
                  <span>Scanner</span>
                </button>
              )}
              {(!isEmployee || hasEmployeePermission(currentUser, 'finance')) && (
                <button
                  onClick={() => setIsDriverCashModalOpen(true)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition whitespace-nowrap shrink-0 cursor-pointer tabular-nums"
                >
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span>Caisse: {driverCashStats.collected} DH</span>
                </button>
              )}
              <button
                onClick={handleExportCashReport}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>Export CSV</span>
              </button>
            </div>
          </div>

          <main className="flex-1 min-w-0 w-full max-w-[1680px] mx-auto px-2.5 sm:px-4 lg:px-6 py-3 sm:py-5 pb-10">
            {/* Global Search Bar moved down below header for cleaner top bar spacing */}
            <div className="mb-4">
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (globalSearchQuery.trim()) {
                    handleSearchTracking(globalSearchQuery.trim());
                  }
                }}
                className="flex items-stretch max-w-xl"
              >
                <div className="relative flex-1 min-w-0">
                  <input
                    type="text"
                    value={globalSearchQuery}
                    onChange={e => setGlobalSearchQuery(e.target.value)}
                    placeholder={t('nav.searchPlaceholder')}
                    className={`w-full min-w-0 px-3.5 py-2.5 text-xs sm:text-sm bg-white border border-slate-200 ${
                      isRtl ? 'rounded-r-xl border-l-0 pl-8' : 'rounded-l-xl border-r-0 pr-8'
                    } focus:outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-800 placeholder:text-slate-400 shadow-2xs`}
                  />
                  {globalSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setGlobalSearchQuery('')}
                      aria-label="Effacer"
                      className={`absolute top-1/2 -translate-y-1/2 ${isRtl ? 'left-2' : 'right-2'} p-1 text-slate-400 hover:text-slate-700 cursor-pointer`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <button
                  type="submit"
                  aria-label="Rechercher"
                  title={t('nav.searchPlaceholder')}
                  className={`px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white ${
                    isRtl ? 'rounded-l-xl' : 'rounded-r-xl'
                  } flex items-center justify-center shrink-0 transition-colors cursor-pointer shadow-2xs`}
                >
                  <Search className="w-4 h-4" />
                </button>
              </form>
            </div>

            {searchNotice && (
              <div
                className={`mb-4 flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-xs font-bold ${
                  searchNotice.type === 'warning'
                    ? 'bg-amber-50 border-amber-200 text-amber-900'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                }`}
              >
                <span>{searchNotice.message}</span>
                <button
                  type="button"
                  onClick={() => setSearchNotice(null)}
                  className="p-1 rounded-lg hover:bg-black/5 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* ================= TAB VIEWS (PROTECTED BY ERROR BOUNDARY) ================= */}
            <ErrorBoundary resetKey={activeTab} compact>
            {/* ================= ADMIN & EMPLOYEE VIEWS ================= */}
            {(isAdmin || isEmployee) && (
              <>
                {isEmployee && (
                  <div
                    dir="rtl"
                    className="mb-4 flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Headset className="w-4 h-4 text-sky-600 shrink-0" />
                      <span className="font-extrabold text-slate-900">
                        {EMPLOYEE_ROLE_LABELS[currentUser?.employeeRole || 'confirmatrice']}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                      <span className="font-bold text-slate-600">نطاق المدن:</span>
                      {employeeAssignedCities.length > 0 ? (
                        employeeAssignedCities.map(c => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-indigo-50 text-indigo-800 border border-indigo-200 rounded-md text-[11px] font-bold"
                          >
                            {c}
                          </span>
                        ))
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-md text-[11px] font-bold">
                          جميع المدن
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {activeTab === 'admin_dashboard' && (
                  <AdminDashboard
                    onOpenAddPackage={() => openAddPackageModal('single')}
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onNavigateTab={tab => navigateToTab(tab)}
                  />
                )}

                {activeTab === 'admin_confirmation' && (
                  <ConfirmationCenter
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onReportToBlacklist={handleReportPackageToBlacklist}
                  />
                )}

                {activeTab === 'admin_packages' && (
                  <AdminPackages
                    onOpenAddPackage={() => openAddPackageModal('single')}
                    onOpenImportExcel={() => openAddPackageModal('excel')}
                    onOpenScanner={agencyName => openScannerModal(agencyName)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onPrintLabel={pkg => setSelectedLabelPackage(pkg)}
                    externalSearchQuery={packageSearchFilter}
                    externalStatusFilter={packageStatusFilter}
                    focusSearchNonce={focusPackagesSearchNonce}
                    onDispatchToPartner={(packageIds: string[]) => {
                      setPartnerDispatchPreselectedIds(packageIds);
                      navigateToTab('admin_partner_dispatch');
                    }}
                  />
                )}

                {activeTab === 'admin_bons' && <BonsManagement externalSubTab={bonsSubTab} />}

                {activeTab === 'admin_clients' && (
                  <AdminClients
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    defaultSubTab="liste"
                    externalSubTab={clientsSubTab}
                    focusSearchNonce={focusClientsSearchNonce}
                  />
                )}

                {activeTab === 'admin_approvals' && (
                  <AdminClients
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    defaultSubTab="demandes"
                    externalSubTab={clientsSubTab}
                    focusSearchNonce={focusClientsSearchNonce}
                  />
                )}

                {activeTab === 'admin_drivers' && (
                  <AdminDrivers
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    openAddNonce={openAddDriverNonce}
                  />
                )}

                {activeTab === 'admin_driver_approvals' && <AdminDriverApprovals />}

                {activeTab === 'admin_vehicles' && (
                  <AdminVehicles
                    onNavigateAdd={() => navigateToTab('admin_vehicle_add')}
                  />
                )}

                {activeTab === 'admin_vehicle_add' && (
                  <AdminVehicleAdd
                    onBackToList={() => navigateToTab('admin_vehicles')}
                    onVehicleCreated={() => navigateToTab('admin_vehicles')}
                  />
                )}

                {activeTab === 'admin_employees' && isAdmin && <AdminEmployees />}

                {activeTab === 'admin_partners' && (
                  <AdminPartners
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onOpenApiIntegration={() => navigateToTab('admin_api_partners')}
                    openAddNonce={openAddPartnerNonce}
                    onOpenDispatch={(packageIds?: string[]) => {
                      if (packageIds) setPartnerDispatchPreselectedIds(packageIds);
                      navigateToTab('admin_partner_dispatch');
                    }}
                  />
                )}

                {activeTab === 'admin_partner_dispatch' && (
                  <AdminPartnerDispatch
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onBackToList={() => navigateToTab('admin_partners')}
                    preselectedPackageIds={partnerDispatchPreselectedIds}
                  />
                )}

                {activeTab === 'admin_api_partners' && (
                  <AdminApiPartners
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'admin_cities' && <AdminCitiesRates />}

                {activeTab === 'admin_hubs' && (
                  <AdminHubs
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onOpenAgencyScanner={agencyName => openScannerModal(agencyName)}
                  />
                )}

                {activeTab === 'admin_finance' && (
                  <AdminFinance onOpenReleveModal={payment => setSelectedRelevePayment(payment)} />
                )}

                {activeTab === 'admin_debts' && (
                  <AdminDebts onViewPackage={pkg => setSelectedDetailsPackage(pkg)} />
                )}

                {activeTab === 'admin_pickups' && <AdminPickups />}

                {activeTab === 'admin_stock' && (
                  <AdminStock
                    onOpenScanner={agencyName => openScannerModal(agencyName)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    focusSearchNonce={focusStockSearchNonce}
                  />
                )}

                {activeTab === 'admin_messages' && (
                  <AdminClientMessages
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'admin_reviews' && <AdminReviews />}

                {activeTab === 'admin_blacklist' && <BlacklistManager prefill={blacklistPrefill} />}

                {activeTab === 'admin_settings' && <AdminSettings />}
              </>
            )}

            {/* ================= CLIENT VIEWS ================= */}
            {isClient && (
              <>
                <div
                  dir="rtl"
                  className="mb-5 flex items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-amber-950 shadow-2xs"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-700 border border-amber-200">
                    <Landmark className="w-4 h-4" />
                  </div>
                  <p className="text-xs sm:text-sm font-bold leading-relaxed">
                    زبناؤنا الكرام، نُحيطكم علمًا بأن معالجة التحويلات البنكية تتم خلال أيام العمل الرسمية فقط (من الإثنين إلى الجمعة)
                  </p>
                </div>

                {activeTab === 'client_dashboard' && (
                  <ClientDashboard
                    onOpenAddPackage={() => openAddPackageModal('single')}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onNavigateTab={tab => navigateToTab(tab)}
                  />
                )}

                {activeTab === 'client_packages' && (
                  <ClientPackages
                    onOpenAddPackage={() => openAddPackageModal('single')}
                    onOpenImportExcel={() => openAddPackageModal('excel')}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                    onPrintThermalLabel={pkg => setSelectedLabelPackage(pkg)}
                    onReportToBlacklist={handleReportPackageToBlacklist}
                    externalSearchQuery={packageSearchFilter}
                  />
                )}

                {activeTab === 'client_stock' && (
                  <ClientStock
                    onCreatePackageFromStock={productId =>
                      openAddPackageModal('single', productId || null)
                    }
                  />
                )}

                {activeTab === 'client_bons' && <ClientBons />}

                {activeTab === 'client_pickups' && <ClientPickups />}

                {activeTab === 'client_tracking' && (
                  <ClientTracking onViewPackage={pkg => setSelectedDetailsPackage(pkg)} />
                )}

                {activeTab === 'client_tariffs' && <ClientTariffs />}

                {activeTab === 'client_finance' && (
                  <ClientFinance onOpenReleveModal={payment => setSelectedRelevePayment(payment)} />
                )}

                {activeTab === 'client_debts' && <ClientDebts />}

                {activeTab === 'client_returns' && (
                  <ClientReturns onViewPackage={pkg => setSelectedDetailsPackage(pkg)} />
                )}

                {activeTab === 'client_messages' && (
                  <ClientMessages onViewPackage={pkg => setSelectedDetailsPackage(pkg)} />
                )}

                {activeTab === 'client_reviews' && <ClientReviews />}

                {activeTab === 'client_blacklist' && <BlacklistManager prefill={blacklistPrefill} />}

                {activeTab === 'client_profile' && <ClientProfile />}
              </>
            )}

            {/* ================= DRIVER VIEWS ================= */}
            {isDriver && (
              <>
                {activeTab === 'driver_tour' && (
                  <DriverTour
                    onOpenScanner={() => setIsScannerOpen(true)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'driver_cash' && <DriverCash />}
              </>
            )}

            {/* ================= PARTNER PORTAL VIEWS ================= */}
            {currentRole === 'partner' && (
              <>
                {activeTab === 'partner_dashboard' && (
                  <PartnerPortal
                    mode="dashboard"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_packages' && (
                  <PartnerPortal
                    mode="packages"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_relances' && (
                  <PartnerPortal
                    mode="relances"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_returns' && (
                  <PartnerPortal
                    mode="returns"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_payments' && (
                  <PartnerPortal
                    mode="payments"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_receipts' && (
                  <PartnerPortal
                    mode="receipts"
                    onNavigateTab={tab => navigateToTab(tab)}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}

                {activeTab === 'partner_api' && (
                  <PartnerApiAccess
                    partnerId={currentUser?.id}
                    onViewPackage={pkg => setSelectedDetailsPackage(pkg)}
                  />
                )}
              </>
            )}
            </ErrorBoundary>
          </main>
          </div>
        </div>
      </div>

      {/* Driver Cash Modal */}
      {isDriverCashModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setIsDriverCashModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Wallet className="w-5 h-5 text-emerald-600" />
              Récapitulatif Caisse Livreur
            </h3>
            <div className="space-y-3">
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-100 flex justify-between items-center">
                <div>
                  <div className="text-xs text-emerald-700 font-medium">Argent Encaissé (En Poche)</div>
                  <div className="text-2xl font-black text-emerald-800">{driverCashStats.collected} DH</div>
                </div>
                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              </div>
              <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 flex justify-between items-center">
                <div>
                  <div className="text-xs text-amber-700 font-medium">Colis Restants En Cours</div>
                  <div className="text-xl font-bold text-amber-800">{driverCashStats.pending} DH</div>
                </div>
                <div className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-1 rounded">
                  {driverCashStats.totalCount - driverCashStats.deliveredCount} colis
                </div>
              </div>
            </div>
            <div className="mt-6 flex gap-2">
              <button
                onClick={handleExportCashReport}
                className="flex-1 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition flex items-center justify-center gap-1.5"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                Télécharger Rapport (CSV)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <ThermalLabelModal
        packageItem={selectedLabelPackage}
        isOpen={Boolean(selectedLabelPackage)}
        onClose={() => setSelectedLabelPackage(null)}
      />

      <BarcodeScannerModal
        isOpen={isScannerOpen}
        initialAgencyName={scannerAgencyName}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerAgencyName(undefined);
        }}
      />

      <NotificationsCenterOverlay
        isOpen={isNotificationsOverlayOpen}
        onClose={() => setIsNotificationsOverlayOpen(false)}
        currentUser={currentUser}
        notifications={userNotifications}
        sentNotifications={sentUserNotifications}
        unreadCount={unreadNotificationsCount}
        isLoading={isNotificationsLoading}
        errorMessage={notificationsError}
        recipients={notificationRecipients}
        fallbackUsers={users}
        onRefresh={() => loadUserNotifications(false)}
        onMarkRead={handleMarkNotificationRead}
        onMarkAllRead={handleMarkAllNotificationsRead}
        onDeleteNotification={handleDeleteUserNotification}
        onClearRead={handleClearReadUserNotifications}
        onSendMessage={handleSendAdminNotification}
      />

      <PackageDetailsModal
        packageItem={selectedDetailsPackage}
        isOpen={Boolean(selectedDetailsPackage)}
        onClose={() => setSelectedDetailsPackage(null)}
        onOpenThermalLabel={pkg => setSelectedLabelPackage(pkg)}
      />

      <AddPackageModal
        isOpen={isAddPackageOpen}
        initialMode={addPackageInitialMode}
        preselectedStockProductId={preselectedStockProductId}
        onClose={() => {
          setIsAddPackageOpen(false);
          setPreselectedStockProductId(null);
        }}
        onSuccess={newPkg => {
          setSelectedLabelPackage(newPkg);
        }}
      />

      <FinancialReleveModal
        payment={selectedRelevePayment}
        isOpen={Boolean(selectedRelevePayment)}
        onClose={() => setSelectedRelevePayment(null)}
      />

      <SupabaseRealtimeModal
        isOpen={isRealtimeModalOpen}
        onClose={() => setIsRealtimeModalOpen(false)}
      />

      <RealtimeToastContainer
        onSelectPackageId={pkgId => {
          const found = packages.find(p => p.id === pkgId);
          if (found) setSelectedDetailsPackage(found);
        }}
        onNavigateTab={tab => navigateToTab(tab)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <LanguageProvider>
        <DatabaseProvider>
          <AuthProvider>
            <MainApp />
          </AuthProvider>
        </DatabaseProvider>
      </LanguageProvider>
    </ErrorBoundary>
  );
}