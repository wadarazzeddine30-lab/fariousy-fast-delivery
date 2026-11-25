import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  FacebookIcon,
  InstagramIcon,
  DEFAULT_FACEBOOK_URL,
  DEFAULT_INSTAGRAM_URL
} from './common/SocialIcons';
import {
  EMPLOYEE_ROLE_SHORT_LABELS,
  getUserAssignedCities,
  hasAnyEmployeePermission,
  hasEmployeePermission,
  isCityAllowedForUser
} from '../utils/employeePermissions';
import {
  LayoutDashboard,
  Package,
  Users,
  Truck,
  Handshake,
  MapPin,
  BadgeDollarSign,
  CalendarCheck,
  Warehouse,
  Scan,
  CornerDownLeft,
  User,
  ShieldCheck,
  Building,
  CheckCircle2,
  PlusCircle,
  Search,
  Tag,
  UserCheck,
  LogOut,
  Briefcase,
  FileImage,
  Settings,
  Network,
  MessageSquare,
  FileText,
  Send,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Code2,
  Car,
  Star,
  Boxes,
  RefreshCw,
  Clock,
  Key,
  Wallet,
  Headset,
  ShieldAlert,
  Receipt
} from 'lucide-react';

export type AdminSidebarAction =
  | { type: 'packages_list'; status?: 'all' | 'pending_group' | 'shipped_group' }
  | { type: 'packages_search' }
  | { type: 'clients_subtab'; subTab: 'liste' | 'ajouter' | 'demandes' | 'en_attente' | 'suspendus' }
  | { type: 'clients_search' }
  | { type: 'drivers_add' }
  | { type: 'partners_add' }
  | { type: 'stock_search' }
  | { type: 'bons_subtab'; subTab: 'client' | 'delivery' };

export type ActiveTab =
  | 'admin_dashboard'
  | 'admin_confirmation'
  | 'admin_packages'
  | 'admin_bons'
  | 'admin_clients'
  | 'admin_approvals'
  | 'admin_drivers'
  | 'admin_driver_approvals'
  | 'admin_vehicles'
  | 'admin_vehicle_add'
  | 'admin_employees'
  | 'admin_partners'
  | 'admin_partner_dispatch'
  | 'admin_api_partners'
  | 'admin_cities'
  | 'admin_hubs'
  | 'admin_finance'
  | 'admin_debts'
  | 'admin_pickups'
  | 'admin_stock'
  | 'admin_messages'
  | 'admin_reviews'
  | 'admin_blacklist'
  | 'admin_settings'
  | 'client_dashboard'
  | 'client_packages'
  | 'client_stock'
  | 'client_bons'
  | 'client_tracking'
  | 'client_pickups'
  | 'client_finance'
  | 'client_debts'
  | 'client_returns'
  | 'client_tariffs'
  | 'client_messages'
  | 'client_reviews'
  | 'client_blacklist'
  | 'client_profile'
  | 'driver_tour'
  | 'driver_cash'
  | 'partner_dashboard'
  | 'partner_packages'
  | 'partner_relances'
  | 'partner_returns'
  | 'partner_payments'
  | 'partner_receipts'
  | 'partner_api';

interface SidebarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: ActiveTab) => void;
  onAdminAction?: (action: AdminSidebarAction) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  onOpenScanner: () => void;
  onOpenAddPackage?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  onAdminAction,
  isOpenMobile,
  onCloseMobile,
  onOpenScanner,
  onOpenAddPackage
}) => {
  const { currentRole, isAdmin, isClient, isDriver, isEmployee, currentUser, logout } = useAuth();
  const { packages, pickups, users, clientMessages, reviews, driverRequests, bons, agencies, vehicles, transferReceipts, payments, partners, clientStockProducts, companySettings, blacklistEntries } = useDatabase();
  const { t, isRtl, language } = useLanguage();
  const facebookUrl = companySettings?.facebookUrl?.trim() || DEFAULT_FACEBOOK_URL;
  const instagramUrl = companySettings?.instagramUrl?.trim() || DEFAULT_INSTAGRAM_URL;

  const assignedCities = React.useMemo(() => getUserAssignedCities(currentUser), [currentUser]);
  const scopedPackages = React.useMemo(
    () => (isEmployee ? packages.filter(p => isCityAllowedForUser(currentUser, p.city)) : packages),
    [isEmployee, packages, currentUser]
  );
  const scopedPickups = React.useMemo(
    () => (isEmployee ? pickups.filter(p => isCityAllowedForUser(currentUser, p.city)) : pickups),
    [isEmployee, pickups, currentUser]
  );

  const canSee = (permId: string) => isAdmin || hasEmployeePermission(currentUser, permId);
  const canSeeAny = (permIds: string[]) => isAdmin || hasAnyEmployeePermission(currentUser, permIds);

  const pendingPickups = scopedPickups.filter(p => p.status === 'en_attente').length;
  const waitingConfirmationCount = scopedPackages.filter(
    p =>
      p.confirmationStatus !== 'confirme' &&
      p.confirmationStatus !== 'annule' &&
      ['nouveau', 'attente_ramassage', 'pas_de_reponse', 'reporte'].includes(p.status)
  ).length;
  const problemPackagesCount = scopedPackages.filter(
    p => p.status === 'probleme_livraison' || (p.problemReport && !p.problemReport.resolved)
  ).length;
  const pendingClients = users.filter(
    u => u.role === 'client' && (u.status === 'pending' || u.status === 'en_attente')
  ).length;
  const pendingDriverRequests = driverRequests.filter(
    r => r.status === 'en_attente' && (!isEmployee || isCityAllowedForUser(currentUser, r.city))
  ).length;
  const totalTransferReceiptsCount =
    transferReceipts.length + payments.filter(p => Boolean(p.receiptImageUrl)).length;
  const myTransferReceiptsCount =
    transferReceipts.filter(r => r.clientId === currentUser?.id).length +
    payments.filter(p => p.clientId === currentUser?.id && Boolean(p.receiptImageUrl)).length;
  const clientsCount = users.filter(u => u.role === 'client').length;
  const driversCount = users.filter(
    u => u.role === 'driver' && (!isEmployee || isCityAllowedForUser(currentUser, u.city))
  ).length;

  const pendingAdminMessages = clientMessages.filter(m => m.status === 'nouveau').length;
  const myClientMessages = clientMessages.filter(m => m.clientId === currentUser?.id);
  const clientActiveMessages = myClientMessages.filter(m => m.status === 'nouveau' || m.status === 'en_cours').length;

  // Partner-specific live counters
  const matchedPartner = currentRole === 'partner'
    ? partners.find(
        p =>
          p.id === currentUser?.id ||
          (currentUser?.email && p.email && p.email.toLowerCase() === currentUser.email.toLowerCase()) ||
          (currentUser?.companyName && p.name.toLowerCase() === currentUser.companyName.toLowerCase())
      )
    : undefined;
  const partnerParcels = currentRole === 'partner'
    ? packages.filter(
        pkg =>
          pkg.partnerId === (matchedPartner?.id || currentUser?.id) ||
          (matchedPartner?.name && pkg.destinationAgency === matchedPartner.name) ||
          (matchedPartner?.city && pkg.destinationAgency === `Agence ${matchedPartner.city}`)
      )
    : [];
  const partnerRelancesCount = partnerParcels.filter(pkg =>
    ['pas_de_reponse', 'reporte', 'probleme_livraison'].includes(pkg.status)
  ).length;
  const partnerReturnsCount = partnerParcels.filter(pkg =>
    ['retour_en_cours', 'retourne', 'refuse', 'annule'].includes(pkg.status)
  ).length;

  const [isDesktopCollapsed, setIsDesktopCollapsed] = React.useState(false);
  const [activeSubKey, setActiveSubKey] = React.useState<string>('');

  const [openAdminGroup, setOpenAdminGroup] = React.useState<string | null>(() => {
    if (['admin_packages', 'admin_pickups'].includes(activeTab)) return 'colis';
    if (['admin_clients', 'admin_approvals', 'admin_reviews'].includes(activeTab)) return 'clients';
    if (['admin_drivers', 'admin_driver_approvals'].includes(activeTab)) return 'livreurs';
    if (['admin_partners', 'admin_partner_dispatch', 'admin_api_partners'].includes(activeTab)) return 'partenaires';
    if (['admin_vehicles', 'admin_vehicle_add'].includes(activeTab)) return 'vehicules';
    if (['admin_finance', 'admin_debts'].includes(activeTab)) return 'finance';
    if (activeTab === 'admin_stock') return 'stock';
    if (activeTab === 'admin_bons') return 'bons';
    if (['admin_settings', 'admin_cities', 'admin_hubs'].includes(activeTab)) return 'parametres';
    return null;
  });

  React.useEffect(() => {
    if (['admin_packages', 'admin_pickups'].includes(activeTab)) setOpenAdminGroup('colis');
    else if (['admin_clients', 'admin_approvals', 'admin_reviews'].includes(activeTab)) setOpenAdminGroup('clients');
    else if (['admin_drivers', 'admin_driver_approvals'].includes(activeTab)) setOpenAdminGroup('livreurs');
    else if (['admin_partners', 'admin_partner_dispatch', 'admin_api_partners'].includes(activeTab)) setOpenAdminGroup('partenaires');
    else if (['admin_vehicles', 'admin_vehicle_add'].includes(activeTab)) setOpenAdminGroup('vehicules');
    else if (['admin_finance', 'admin_debts'].includes(activeTab)) setOpenAdminGroup('finance');
    else if (activeTab === 'admin_stock') setOpenAdminGroup('stock');
    else if (activeTab === 'admin_bons') setOpenAdminGroup('bons');
    else if (['admin_settings', 'admin_cities', 'admin_hubs'].includes(activeTab)) setOpenAdminGroup('parametres');
  }, [activeTab]);

  const toggleAdminGroup = (groupKey: string) => {
    if (isDesktopCollapsed) {
      setIsDesktopCollapsed(false);
      setOpenAdminGroup(groupKey);
      return;
    }
    setOpenAdminGroup(prev => (prev === groupKey ? null : groupKey));
  };

  const handleTabClick = (tab: ActiveTab, subKey?: string, action?: AdminSidebarAction) => {
    setActiveSubKey(subKey || '');
    onSelectTab(tab);
    if (action && onAdminAction) {
      onAdminAction(action);
    }
    onCloseMobile();
  };

  const handleLogout = async () => {
    try {
      await logout();
      onCloseMobile();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
  };

  return (
    <>
      {/* Mobile / Tablet Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-black/45 lg:hidden backdrop-blur-2xs"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed lg:static top-0 ${isRtl ? 'right-0' : 'left-0'} z-50 lg:z-30 h-dvh lg:h-full shrink-0 ${
          isDesktopCollapsed ? 'w-64 lg:w-[74px]' : 'w-64 lg:w-60 xl:w-64'
        } bg-slate-900 text-slate-300 flex flex-col justify-between transition-all duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0' : isRtl ? 'translate-x-full' : '-translate-x-full'
        }`}
      >
        {/* Top Branding & Scrollable Navigation Section */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col scrollbar-thin">
          <div className={`p-3.5 sm:p-4 border-b border-slate-800/80 flex items-center ${isDesktopCollapsed ? 'lg:justify-center justify-between' : 'justify-between'} gap-2 shrink-0`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src="/fariousy-logo.jpeg"
                onError={e => {
                  const img = e.currentTarget;
                  if (!img.dataset.fallback) {
                    img.dataset.fallback = '1';
                    img.src = '/pwa-192x192.png';
                  }
                }}
                alt="Logo FARIOUSY"
                className="w-9 h-9 object-contain rounded-full bg-white p-0.5 shrink-0"
              />
              {!isDesktopCollapsed && (
                <div className="min-w-0">
                  <span className="font-black text-white tracking-wider text-sm block leading-none truncate">
                    FARIOUSY
                  </span>
                  <span className="text-[10px] font-bold text-red-500 tracking-widest block uppercase truncate">
                    Fast Delivery
                  </span>
                </div>
              )}
            </div>
            {/* Desktop Quick Collapse Toggle */}
            <button
              type="button"
              onClick={() => setIsDesktopCollapsed(prev => !prev)}
              className="hidden lg:flex w-7 h-7 items-center justify-center text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-700 rounded-lg border border-slate-700/80 transition-colors cursor-pointer shrink-0"
              title={isDesktopCollapsed ? (language === 'ar' ? 'توسيع القائمة' : 'Développer le menu') : (language === 'ar' ? 'طي القائمة لتوسيع الشاشة' : 'Réduire le menu pour agrandir l’écran')}
            >
              {isDesktopCollapsed ? (
                <ChevronRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              ) : (
                <ChevronLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
              )}
            </button>
            {/* Mobile / Tablet Close Button */}
            <button
              type="button"
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
              title="Fermer le menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Role Banner */}
          {!isDesktopCollapsed && (
            <div className="px-4 py-3 mx-3 my-3 rounded-xl bg-slate-800/60 border border-slate-800 flex items-center justify-between shrink-0">
              <div className="truncate">
                <span className="text-[10px] text-slate-400 uppercase font-semibold tracking-wider block">
                  {isAdmin
                    ? t('sidebar.companyAdmin')
                    : isEmployee
                    ? EMPLOYEE_ROLE_SHORT_LABELS[currentUser?.employeeRole || 'confirmatrice']
                    : isDriver
                    ? t('sidebar.driverSpace')
                    : currentRole === 'partner'
                    ? t('sidebar.partnerSpace')
                    : t('sidebar.clientSpace')}
                </span>
                <span className="text-xs font-bold text-white truncate block">
                  {currentUser?.companyName || currentUser?.name}
                </span>
                {isEmployee && assignedCities.length > 0 && (
                  <span className="text-[10px] text-indigo-300 font-semibold truncate block mt-0.5">
                    {assignedCities.slice(0, 2).join('، ')}
                    {assignedCities.length > 2 ? ` (+${assignedCities.length - 2})` : ''}
                  </span>
                )}
              </div>
              {isAdmin && <ShieldCheck className="w-4 h-4 text-red-500 shrink-0" />}
              {isEmployee && <Headset className="w-4 h-4 text-sky-400 shrink-0" />}
              {isClient && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />}
              {isDriver && <Truck className="w-4 h-4 text-amber-500 shrink-0" />}
            </div>
          )}

          {/* Navigation Links based on role */}
          <nav className={`px-3 pb-4 space-y-1 text-xs ${isDesktopCollapsed ? 'pt-3' : 'pt-1'}`}>
            {/* ADMIN / EMPLOYEE MENU — Organized into Tableau de bord + FONCTIONS + CONTRÔLE */}
            {(isAdmin || isEmployee) && (
              <>
                {/* 0. Tableau de bord */}
                {canSee('dashboard') && (
                  <button
                    onClick={() => handleTabClick('admin_dashboard')}
                    title={t('sidebar.dashboard')}
                    className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                      activeTab === 'admin_dashboard'
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    {!isDesktopCollapsed && <span>{t('sidebar.dashboard')}</span>}
                  </button>
                )}

                {/* SECTION 1: FONCTIONS */}
                {canSeeAny([
                  'packages_manage',
                  'pickups',
                  'scanner',
                  'clients',
                  'reviews',
                  'drivers',
                  'partners',
                  'hubs',
                  'finance',
                  'stock',
                  'confirmation'
                ]) && (
                  !isDesktopCollapsed ? (
                    <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {language === 'ar' ? 'الوظائف (FONCTIONS)' : 'FONCTIONS'}
                    </div>
                  ) : (
                    <div className="my-2 border-t border-slate-800" />
                  )
                )}

                {/* 1. Colis */}
                {canSeeAny(['packages_manage', 'pickups', 'scanner']) && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('colis')}
                      title={language === 'ar' ? 'الطرود' : 'Colis'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_packages', 'admin_pickups'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Package className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'الطرود (Colis)' : 'Colis'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {(problemPackagesCount > 0 || pendingPickups > 0) && (
                            <span className="font-mono text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold force-ltr">
                              {problemPackagesCount + pendingPickups}
                            </span>
                          )}
                          {openAdminGroup === 'colis' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'colis' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        {canSee('packages_manage') && canSee('can_create') && (
                          <button
                            onClick={() => {
                              setActiveSubKey('colis_add');
                              onCloseMobile();
                              if (onOpenAddPackage) onOpenAddPackage();
                            }}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeSubKey === 'colis_add'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{language === 'ar' ? 'إضافة طرد (Ajouter)' : 'Ajouter'}</span>
                          </button>
                        )}

                        {canSee('packages_manage') && (
                          <button
                            onClick={() =>
                              handleTabClick('admin_packages', 'colis_liste', { type: 'packages_list', status: 'all' })
                            }
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_packages' && (!activeSubKey || activeSubKey === 'colis_liste')
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Package className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>{language === 'ar' ? 'قائمة الطرود (Liste)' : 'Liste'}</span>
                            </span>
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                              {scopedPackages.length}
                            </span>
                          </button>
                        )}

                        {canSee('pickups') && (
                          <button
                            onClick={() => handleTabClick('admin_pickups', 'colis_ramassage')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_pickups'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <CalendarCheck className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>{language === 'ar' ? 'الاستلام (Ramassage)' : 'Ramassage'}</span>
                            </span>
                            {pendingPickups > 0 && (
                              <span className="font-bold text-[9px] bg-red-600 text-white px-1.5 rounded-full force-ltr">
                                {pendingPickups}
                              </span>
                            )}
                          </button>
                        )}

                        {canSee('scanner') && (
                          <button
                            onClick={() => {
                              setActiveSubKey('colis_scanner');
                              onCloseMobile();
                              onOpenScanner();
                            }}
                            className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                          >
                            <Scan className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{language === 'ar' ? 'سكانير (Scanner)' : 'Scanner'}</span>
                          </button>
                        )}

                        {canSee('packages_manage') && (
                          <>
                            <button
                              onClick={() =>
                                handleTabClick('admin_packages', 'colis_attente', {
                                  type: 'packages_list',
                                  status: 'pending_group'
                                })
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_packages' && activeSubKey === 'colis_attente'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                <span>{language === 'ar' ? 'في الانتظار (En attente)' : 'En attente'}</span>
                              </span>
                              <span className="font-mono text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded force-ltr">
                                {
                                  scopedPackages.filter(p =>
                                    ['nouveau', 'attente_ramassage', 'recu_agence', 'reporte'].includes(p.status)
                                  ).length
                                }
                              </span>
                            </button>

                            <button
                              onClick={() =>
                                handleTabClick('admin_packages', 'colis_expedier', {
                                  type: 'packages_list',
                                  status: 'shipped_group'
                                })
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_packages' && activeSubKey === 'colis_expedier'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Send className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                <span>{language === 'ar' ? 'تم الإرسال (Expédier)' : 'Expédier'}</span>
                              </span>
                              <span className="font-mono text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded force-ltr">
                                {
                                  scopedPackages.filter(p =>
                                    ['ramasse', 'expedie', 'en_transit', 'arrive_agence', 'en_cours_livraison'].includes(
                                      p.status
                                    )
                                  ).length
                                }
                              </span>
                            </button>

                            <button
                              onClick={() =>
                                handleTabClick('admin_packages', 'colis_rechercher', { type: 'packages_search' })
                              }
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_packages' && activeSubKey === 'colis_rechercher'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>{language === 'ar' ? 'بحث (Rechercher)' : 'Rechercher'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Clients */}
                {canSeeAny(['clients', 'reviews']) && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('clients')}
                      title={language === 'ar' ? 'الزبناء والتجار' : 'Clients'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_clients', 'admin_approvals', 'admin_reviews'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Users className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'الزبناء (Clients)' : 'Clients'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {pendingClients > 0 && canSee('clients') && (
                            <span className="font-bold text-[10px] bg-amber-500 text-slate-950 px-1.5 rounded-full force-ltr">
                              {pendingClients}
                            </span>
                          )}
                          {openAdminGroup === 'clients' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'clients' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        {canSee('clients') && (
                          <>
                            {canSee('can_create') && (
                              <button
                                onClick={() =>
                                  handleTabClick('admin_clients', 'clients_ajouter', {
                                    type: 'clients_subtab',
                                    subTab: 'ajouter'
                                  })
                                }
                                className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                  activeTab === 'admin_clients' && activeSubKey === 'clients_ajouter'
                                    ? 'bg-red-50 text-red-700 font-bold'
                                    : 'text-slate-700 hover:bg-slate-100'
                                }`}
                              >
                                <PlusCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                                <span>{language === 'ar' ? 'إضافة تاجر (Ajouter)' : 'Ajouter'}</span>
                              </button>
                            )}

                            <button
                              onClick={() =>
                                handleTabClick('admin_clients', 'clients_liste', {
                                  type: 'clients_subtab',
                                  subTab: 'liste'
                                })
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_clients' && (!activeSubKey || activeSubKey === 'clients_liste')
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                                <span>{language === 'ar' ? 'لائحة التجار (Liste)' : 'Liste'}</span>
                              </span>
                              {clientsCount > 0 && (
                                <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                                  {clientsCount}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() =>
                                handleTabClick('admin_approvals', 'clients_nouveaux', {
                                  type: 'clients_subtab',
                                  subTab: 'demandes'
                                })
                              }
                              className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_approvals'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <span className="flex items-center gap-2">
                                <UserCheck className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                                <span>{language === 'ar' ? 'الزبناء الجدد (Nouveaux)' : 'Nouveaux clients'}</span>
                              </span>
                              {pendingClients > 0 && (
                                <span className="font-bold text-[9px] bg-amber-500 text-slate-950 px-1.5 rounded-full force-ltr">
                                  {pendingClients}
                                </span>
                              )}
                            </button>

                            <button
                              onClick={() =>
                                handleTabClick('admin_clients', 'clients_attente', {
                                  type: 'clients_subtab',
                                  subTab: 'en_attente'
                                })
                              }
                              className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                                activeTab === 'admin_clients' && activeSubKey === 'clients_attente'
                                  ? 'bg-red-50 text-red-700 font-bold'
                                  : 'text-slate-700 hover:bg-slate-100'
                              }`}
                            >
                              <Clock className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                              <span>{language === 'ar' ? 'في الانتظار (En attente)' : 'En attente'}</span>
                            </button>
                          </>
                        )}

                        {canSee('reviews') && (
                          <button
                            onClick={() => handleTabClick('admin_reviews', 'clients_avis')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_reviews'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Star className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                              <span>{language === 'ar' ? 'الآراء (Avis)' : 'Avis'}</span>
                            </span>
                            {reviews.length > 0 && (
                              <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                                {reviews.length}
                              </span>
                            )}
                          </button>
                        )}

                        {canSee('clients') && (
                          <button
                            onClick={() =>
                              handleTabClick('admin_clients', 'clients_rechercher', { type: 'clients_search' })
                            }
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_clients' && activeSubKey === 'clients_rechercher'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{language === 'ar' ? 'بحث (Rechercher)' : 'Rechercher'}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3. Livreur */}
                {canSee('drivers') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('livreurs')}
                      title={language === 'ar' ? 'الموزعون (Livreur)' : 'Livreur'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_drivers', 'admin_driver_approvals'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Truck className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'الموزع (Livreur)' : 'Livreur'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {pendingDriverRequests > 0 && (
                            <span className="font-bold text-[10px] bg-amber-500 text-slate-950 px-1.5 rounded-full animate-pulse force-ltr">
                              {pendingDriverRequests}
                            </span>
                          )}
                          {openAdminGroup === 'livreurs' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'livreurs' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        {canSee('can_create') && (
                          <button
                            onClick={() => handleTabClick('admin_drivers', 'livreur_ajouter', { type: 'drivers_add' })}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_drivers' && activeSubKey === 'livreur_ajouter'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{language === 'ar' ? 'إضافة موزع (Ajouter)' : 'Ajouter'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleTabClick('admin_drivers', 'livreur_liste')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_drivers' && activeSubKey !== 'livreur_ajouter'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{language === 'ar' ? 'قائمة الموزعين (Liste)' : 'Liste'}</span>
                          </span>
                          {driversCount > 0 && (
                            <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                              {driversCount}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleTabClick('admin_driver_approvals', 'livreur_demandes')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_driver_approvals'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <UserCheck className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                            <span>{t('sidebar.newDriversValidation', 'Demandes Livreurs')}</span>
                          </span>
                          {pendingDriverRequests > 0 && (
                            <span className="font-bold text-[9px] bg-amber-500 text-slate-950 px-1.5 rounded-full force-ltr">
                              {pendingDriverRequests}
                            </span>
                          )}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 4. Partenaires */}
                {canSee('partners') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('partenaires')}
                      title={language === 'ar' ? 'الشركاء' : 'Partenaires'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_partners', 'admin_partner_dispatch', 'admin_api_partners'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Handshake className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'الشركاء (Partenaires)' : 'Partenaires'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {partners.length > 0 && (
                            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-300 force-ltr">
                              {partners.length}
                            </span>
                          )}
                          {openAdminGroup === 'partenaires' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'partenaires' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        {canSee('can_create') && (
                          <button
                            onClick={() => handleTabClick('admin_partners', 'partenaires_ajouter', { type: 'partners_add' })}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_partners' && activeSubKey === 'partenaires_ajouter'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{language === 'ar' ? 'إضافة شريك (Ajouter)' : 'Ajouter'}</span>
                          </button>
                        )}

                        <button
                          onClick={() => handleTabClick('admin_partners', 'partenaires_liste')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_partners' && activeSubKey !== 'partenaires_ajouter'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Handshake className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{language === 'ar' ? 'لائحة الشركاء (Liste)' : 'Liste'}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                            {partners.length}
                          </span>
                        </button>

                        <button
                          onClick={() => handleTabClick('admin_partner_dispatch', 'partenaires_dispatch')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_partner_dispatch'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Send className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{t('sidebar.sendToPartner')}</span>
                          </span>
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded">
                            {t('sidebar.partnerBindBadge')}
                          </span>
                        </button>

                        <button
                          onClick={() => handleTabClick('admin_api_partners', 'partenaires_api')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_api_partners'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Network className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                            <span>API</span>
                          </span>
                          <span className="font-mono text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full font-bold">
                            REST
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 5. Véhicules */}
                {canSee('hubs') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('vehicules')}
                      title={language === 'ar' ? 'المركبات' : 'Véhicules'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_vehicles', 'admin_vehicle_add'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Car className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'المركبات (Véhicules)' : 'Véhicules'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        openAdminGroup === 'vehicules' ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                        )
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'vehicules' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        <button
                          onClick={() => handleTabClick('admin_vehicles', 'vehicules_all')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_vehicles'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Car className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{t('sidebar.allVehicles')}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                            {vehicles.length}
                          </span>
                        </button>

                        {canSee('can_create') && (
                          <button
                            onClick={() => handleTabClick('admin_vehicle_add', 'vehicules_add')}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_vehicle_add'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <PlusCircle className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{t('sidebar.addVehicle')}</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 6. Reçu/BRC & Finance */}
                {canSee('finance') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('finance')}
                      title={language === 'ar' ? 'المالية والتحويلات (Reçu/BRC)' : 'Reçu/BRC & Finance'}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_finance', 'admin_debts'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Receipt className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && (
                          <span>{language === 'ar' ? 'المالية و Reçu/BRC' : 'Reçu/BRC & Finance'}</span>
                        )}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {totalTransferReceiptsCount > 0 && (
                            <span className="font-mono text-[10px] bg-emerald-500 text-white px-1.5 rounded-full font-bold force-ltr">
                              {totalTransferReceiptsCount}
                            </span>
                          )}
                          {openAdminGroup === 'finance' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'finance' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        <button
                          onClick={() => handleTabClick('admin_debts', 'finance_debts')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_debts'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <FileImage className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
                            <span>{language === 'ar' ? 'مستحقات التجار +24h (Les Dettes)' : 'Les Dettes (+24h) / Reçus'}</span>
                          </span>
                          {totalTransferReceiptsCount > 0 && (
                            <span className="font-mono text-[9px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold force-ltr">
                              {totalTransferReceiptsCount}
                            </span>
                          )}
                        </button>

                        <button
                          onClick={() => handleTabClick('admin_finance', 'finance_paiements')}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_finance'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <BadgeDollarSign className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span>{t('sidebar.finance')}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 7. Gestion des stocks */}
                {canSee('stock') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('stock')}
                      title={t('sidebar.stock')}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        activeTab === 'admin_stock'
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Warehouse className="w-4 h-4 shrink-0" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'تدبير السطوك (Stock)' : 'Gestion des stocks'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        openAdminGroup === 'stock' ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                        )
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'stock' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        <button
                          onClick={() => handleTabClick('admin_stock', 'stock_rechercher', { type: 'stock_search' })}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_stock' && activeSubKey === 'stock_rechercher'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Search className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span>{language === 'ar' ? 'بحث (Rechercher)' : 'Rechercher'}</span>
                        </button>

                        <button
                          onClick={() => handleTabClick('admin_stock', 'stock_voir')}
                          className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_stock' && activeSubKey !== 'stock_rechercher'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <Warehouse className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                          <span>{language === 'ar' ? 'معاينة المخزون (Voir)' : 'Voir'}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 8. Demandes & Confirmation */}
                {canSee('confirmation') && (
                  <button
                    onClick={() => handleTabClick('admin_confirmation')}
                    title={t('sidebar.confirmationCenter', 'Demandes & Confirmation')}
                    className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                      activeTab === 'admin_confirmation'
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Headset className="w-4 h-4 shrink-0 text-emerald-400" />
                      {!isDesktopCollapsed && (
                        <span>{language === 'ar' ? 'الطلبات والتأكيد (Demandes)' : 'Demandes & Confirmation'}</span>
                      )}
                    </span>
                    {!isDesktopCollapsed && waitingConfirmationCount > 0 && (
                      <span className="font-mono text-[10px] bg-emerald-500 text-slate-950 px-1.5 py-0.5 rounded-full font-bold force-ltr">
                        {waitingConfirmationCount}
                      </span>
                    )}
                  </button>
                )}

                {/* SECTION 2: CONTRÔLE */}
                {(isAdmin || canSeeAny(['bons', 'blacklist', 'settings', 'cities_rates', 'hubs', 'messages'])) && (
                  !isDesktopCollapsed ? (
                    <div className="px-3 pt-4 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      {language === 'ar' ? 'المراقبة والتحكم (CONTRÔLE)' : 'CONTRÔLE'}
                    </div>
                  ) : (
                    <div className="my-2 border-t border-slate-800" />
                  )
                )}

                {/* 9. Bons */}
                {canSee('bons') && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('bons')}
                      title="Bons"
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        activeTab === 'admin_bons'
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="w-4 h-4 shrink-0 text-amber-400" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'البونات (Bons)' : 'Bons'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        <div className="flex items-center gap-1.5">
                          {bons.length > 0 && (
                            <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-300 force-ltr">
                              {bons.length}
                            </span>
                          )}
                          {openAdminGroup === 'bons' ? (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                          ) : (
                            <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                          )}
                        </div>
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'bons' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        <button
                          onClick={() => handleTabClick('admin_bons', 'bons_all')}
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_bons' && (!activeSubKey || activeSubKey === 'bons_all')
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{language === 'ar' ? 'جميع البونات (Bons)' : 'Bons'}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                            {bons.length}
                          </span>
                        </button>

                        <button
                          onClick={() =>
                            handleTabClick('admin_bons', 'bons_clients', { type: 'bons_subtab', subTab: 'client' })
                          }
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_bons' && activeSubKey === 'bons_clients'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Package className="w-3.5 h-3.5 shrink-0 text-indigo-600" />
                            <span>{language === 'ar' ? 'بونات التجار (Clients Bons)' : 'Clients Bons'}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                            {bons.filter(b => b.type === 'client').length}
                          </span>
                        </button>

                        <button
                          onClick={() =>
                            handleTabClick('admin_bons', 'bons_livreurs', { type: 'bons_subtab', subTab: 'delivery' })
                          }
                          className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                            activeTab === 'admin_bons' && activeSubKey === 'bons_livreurs'
                              ? 'bg-red-50 text-red-700 font-bold'
                              : 'text-slate-700 hover:bg-slate-100'
                          }`}
                        >
                          <span className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{language === 'ar' ? 'بونات الموزعين (Livreurs Bons)' : 'Livreurs Bons'}</span>
                          </span>
                          <span className="font-mono text-[10px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 force-ltr">
                            {bons.filter(b => b.type === 'delivery').length}
                          </span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* 10. Contrôle Équipe (Admin Only) */}
                {isAdmin && (
                  <button
                    onClick={() => handleTabClick('admin_employees')}
                    title={t('sidebar.employeesControl', 'مراقبة العمال والأداء')}
                    className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'gap-3 px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                      activeTab === 'admin_employees'
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                    }`}
                  >
                    <Briefcase className="w-4 h-4 shrink-0 text-amber-400" />
                    {!isDesktopCollapsed && <span>{t('sidebar.employeesControl', 'مراقبة العمال والأداء')}</span>}
                  </button>
                )}

                {/* 11. Blacklist */}
                {canSee('blacklist') && (
                  <button
                    onClick={() => handleTabClick('admin_blacklist')}
                    title={t('sidebar.blacklist', 'اللائحة السوداء (Blacklist)')}
                    className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                      activeTab === 'admin_blacklist'
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                      {!isDesktopCollapsed && <span>{t('sidebar.blacklist', 'اللائحة السوداء (Blacklist)')}</span>}
                    </span>
                    {!isDesktopCollapsed && blacklistEntries.length > 0 && (
                      <span className="font-mono text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold force-ltr">
                        {blacklistEntries.length}
                      </span>
                    )}
                  </button>
                )}

                {/* 12. Paramètres */}
                {canSeeAny(['settings', 'cities_rates', 'hubs']) && (
                  <div className="space-y-0.5">
                    <button
                      onClick={() => toggleAdminGroup('parametres')}
                      title={t('sidebar.settings')}
                      className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                        ['admin_settings', 'admin_cities', 'admin_hubs'].includes(activeTab)
                          ? 'bg-red-600 text-white font-bold shadow-xs'
                          : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Settings className="w-4 h-4 shrink-0 text-red-400" />
                        {!isDesktopCollapsed && <span>{language === 'ar' ? 'الإعدادات (Paramètres)' : 'Paramètres'}</span>}
                      </div>
                      {!isDesktopCollapsed && (
                        openAdminGroup === 'parametres' ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-300" />
                        ) : (
                          <ChevronRight className={`w-3.5 h-3.5 text-slate-400 ${isRtl ? 'rotate-180' : ''}`} />
                        )
                      )}
                    </button>

                    {!isDesktopCollapsed && openAdminGroup === 'parametres' && (
                      <div className="bg-white text-slate-700 rounded-xl shadow-md mx-1 my-1.5 p-1.5 space-y-0.5 border border-slate-200/80">
                        <div className="px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-slate-400">
                          PARAMÈTRES
                        </div>
                        {canSee('settings') && (
                          <button
                            onClick={() => handleTabClick('admin_settings', 'param_profil')}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_settings'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <Settings className="w-3.5 h-3.5 shrink-0 text-red-600" />
                            <span>{language === 'ar' ? 'الملف والنظام (Profil)' : 'Profil & Système'}</span>
                          </button>
                        )}

                        {canSee('cities_rates') && (
                          <button
                            onClick={() => handleTabClick('admin_cities', 'param_tarifs')}
                            className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_cities'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <MapPin className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                            <span>{t('sidebar.citiesTariffs')}</span>
                          </button>
                        )}

                        {canSee('hubs') && (
                          <button
                            onClick={() => handleTabClick('admin_hubs', 'param_hubs')}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer ${
                              activeTab === 'admin_hubs'
                                ? 'bg-red-50 text-red-700 font-bold'
                                : 'text-slate-700 hover:bg-slate-100'
                            }`}
                          >
                            <span className="flex items-center gap-2">
                              <Building className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                              <span>{t('sidebar.hubs')}</span>
                            </span>
                            <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded force-ltr">
                              {agencies.length}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 13. Messages */}
                {canSee('messages') && (
                  <button
                    onClick={() => handleTabClick('admin_messages')}
                    title={t('sidebar.clientMessages', 'Messages')}
                    className={`w-full flex items-center ${isDesktopCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-2.5 rounded-xl font-semibold transition-all ${isRtl ? 'text-right' : 'text-left'} cursor-pointer ${
                      activeTab === 'admin_messages'
                        ? 'bg-red-600 text-white font-bold shadow-xs'
                        : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <MessageSquare className="w-4 h-4 shrink-0 text-amber-400" />
                      {!isDesktopCollapsed && <span>{language === 'ar' ? 'الرسائل (Messages)' : 'Messages'}</span>}
                    </span>
                    {!isDesktopCollapsed && pendingAdminMessages > 0 && (
                      <span className="font-bold text-[10px] bg-red-600 text-white px-1.5 py-0.5 rounded-full force-ltr">
                        {pendingAdminMessages}
                      </span>
                    )}
                  </button>
                )}

                {/* Desktop Collapse Toggle Button (matching circular arrow in reference) */}
                <div className="hidden lg:flex justify-center pt-3">
                  <button
                    type="button"
                    onClick={() => setIsDesktopCollapsed(prev => !prev)}
                    title={isDesktopCollapsed ? 'Développer le menu' : 'Réduire le menu'}
                    className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {isDesktopCollapsed ? (
                      <ChevronRight className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                    ) : (
                      <ChevronLeft className={`w-4 h-4 ${isRtl ? 'rotate-180' : ''}`} />
                    )}
                  </button>
                </div>
              </>
            )}

            {/* CLIENT MENU */}
            {isClient && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('sidebar.sectionClient')}
                </div>

                {/* 1. Tableau de bord */}
                <button
                  onClick={() => handleTabClick('client_dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_dashboard'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientDashboard')}</span>
                </button>

                {/* 2. Ajouter un colis */}
                <button
                  onClick={() => {
                    onCloseMobile();
                    if (onOpenAddPackage) onOpenAddPackage();
                  }}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left bg-red-950/40 text-red-400 hover:bg-red-900/60 hover:text-white border border-red-900/40"
                >
                  <PlusCircle className="w-4 h-4 shrink-0 text-red-500" />
                  <span>{t('sidebar.clientAddPackage')}</span>
                </button>

                {/* 3. Liste de mes colis */}
                <button
                  onClick={() => handleTabClick('client_packages')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_packages'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>{t('sidebar.clientPackages')}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-300 force-ltr">
                    {packages.filter(p => {
                      const sId = (currentUser as any)?.shopId;
                      return (
                        p.clientId === currentUser?.id ||
                        (Boolean(p.shopId) && (p.shopId === currentUser?.id || (Boolean(sId) && p.shopId === sId))) ||
                        (Boolean(sId) && p.clientId === sId)
                      );
                    }).length}
                  </span>
                </button>

                {/* 3b. السطوك ديالي (Stock & Codes-barres) */}
                <button
                  onClick={() => handleTabClick('client_stock')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left cursor-pointer ${
                    activeTab === 'client_stock'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Boxes className="w-4 h-4 shrink-0 text-emerald-400" />
                    <span>{language === 'ar' ? 'السطوك ديالي' : 'Mon Stock (Fulfillment)'}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-emerald-300 force-ltr">
                    {clientStockProducts
                      .filter(p => {
                        if (!currentUser?.id || !p.clientId) return false;
                        const shopId = (currentUser as any)?.shopId;
                        return p.clientId === currentUser.id || (Boolean(shopId) && p.clientId === shopId);
                      })
                      .reduce((sum, p) => sum + p.units.filter(u => u.status === 'en_stock').length, 0)}
                  </span>
                </button>

                {/* 4. Mes Bons d'expédition */}
                <button
                  onClick={() => handleTabClick('client_bons')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_bons'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <FileText className="w-4 h-4 shrink-0 text-indigo-400" />
                    <span>{t('sidebar.clientBons', 'البونات ديالي (Bons Client)')}</span>
                  </div>
                  <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-300 force-ltr">
                    {bons.filter(b => b.type === 'client' && b.clientId === currentUser?.id).length}
                  </span>
                </button>

                {/* 5. Suivi des livraisons */}
                <button
                  onClick={() => handleTabClick('client_tracking')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_tracking'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <Search className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientTracking')}</span>
                </button>

                {/* 5. Demande de ramassage */}
                <button
                  onClick={() => handleTabClick('client_pickups')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_pickups'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <CalendarCheck className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientPickups')}</span>
                </button>

                {/* 6. Mes paiements */}
                <button
                  onClick={() => handleTabClick('client_finance')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_finance'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <BadgeDollarSign className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientFinance')}</span>
                </button>

                {/* 7. صور التحويلات البنكية (Reçus Bancaires) */}
                <button
                  onClick={() => handleTabClick('client_debts')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_debts'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <span className="flex items-center gap-3">
                    <FileImage className="w-4 h-4 shrink-0" />
                    <span>{t('sidebar.clientDebts')}</span>
                  </span>
                  {myTransferReceiptsCount > 0 && (
                    <span className="font-mono text-[10px] bg-emerald-500 text-white px-1.5 rounded-full font-bold force-ltr">
                      {myTransferReceiptsCount}
                    </span>
                  )}
                </button>

                {/* 8. Mes retours */}
                <button
                  onClick={() => handleTabClick('client_returns')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_returns'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <CornerDownLeft className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientReturns')}</span>
                </button>

                {/* 9. Mes tarifs */}
                <button
                  onClick={() => handleTabClick('client_tariffs')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_tariffs'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <Tag className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientTariffs')}</span>
                </button>

                {/* 10. Messagerie & Support Client */}
                <button
                  onClick={() => handleTabClick('client_messages')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_messages'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <MessageSquare className="w-4 h-4 shrink-0 text-red-400" />
                    <span>{t('sidebar.clientSupportMessages', 'Messagerie & Support')}</span>
                  </div>
                  {clientActiveMessages > 0 && (
                    <span className="font-bold text-[10px] bg-red-600 text-white px-1.5 py-0.2 rounded-full force-ltr">
                      {clientActiveMessages}
                    </span>
                  )}
                </button>

                {/* 10b. Avis Clients & Livreurs */}
                <button
                  onClick={() => handleTabClick('client_reviews')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_reviews'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Star className="w-4 h-4 shrink-0 text-amber-400" />
                    <span>{language === 'ar' ? 'آراء الزبائن والليفرورز' : 'Avis & Évaluations'}</span>
                  </div>
                  {reviews.filter(r => r.isPublic !== false).length > 0 && (
                    <span className="font-mono text-[10px] bg-slate-800 px-1.5 py-0.5 rounded-sm text-slate-300 force-ltr">
                      {reviews.filter(r => r.isPublic !== false).length}
                    </span>
                  )}
                </button>

                {/* 10c. Blacklist (اللائحة السوداء للزبناء) */}
                <button
                  onClick={() => handleTabClick('client_blacklist')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all text-left cursor-pointer ${
                    activeTab === 'client_blacklist'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <ShieldAlert className="w-4 h-4 shrink-0 text-rose-400" />
                    <span>{t('sidebar.blacklist', 'اللائحة السوداء (Blacklist)')}</span>
                  </div>
                  {blacklistEntries.length > 0 && (
                    <span className="font-mono text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded-full font-bold force-ltr">
                      {blacklistEntries.length}
                    </span>
                  )}
                </button>

                {/* 11. Mon profil */}
                <button
                  onClick={() => handleTabClick('client_profile')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'client_profile'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.clientProfile')}</span>
                </button>
              </>
            )}

            {/* DRIVER MENU */}
            {isDriver && (
              <>
                <div className="px-3 pt-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('sidebar.sectionDriver')}
                </div>

                <button
                  onClick={() => handleTabClick('driver_tour')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'driver_tour'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <Truck className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.driverTour')}</span>
                </button>

                <button
                  onClick={() => handleTabClick('driver_cash')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all text-left ${
                    activeTab === 'driver_cash'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <BadgeDollarSign className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.driverCash')}</span>
                </button>
              </>
            )}

            {/* PARTNER PORTAL MENU */}
            {currentRole === 'partner' && (
              <>
                <button
                  onClick={() => handleTabClick('partner_dashboard')}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_dashboard'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.partnerDashboard')}</span>
                </button>

                <div className="px-3 pt-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                  {t('sidebar.partnerFunctions', 'FONCTIONS')}
                </div>

                <button
                  onClick={() => handleTabClick('partner_packages')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_packages'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Package className="w-4 h-4 shrink-0" />
                    <span>{t('sidebar.partnerPackages')}</span>
                  </div>
                  <span
                    className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full font-bold force-ltr ${
                      activeTab === 'partner_packages'
                        ? 'bg-white text-red-600'
                        : 'bg-slate-800 text-slate-200'
                    }`}
                  >
                    {partnerParcels.length}
                  </span>
                </button>

                <button
                  onClick={() => handleTabClick('partner_relances')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_relances'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <RefreshCw className="w-4 h-4 shrink-0" />
                    <span>{t('sidebar.partnerRelances', 'Relances')}</span>
                  </div>
                  {partnerRelancesCount > 0 && (
                    <span className="font-mono text-[10px] bg-amber-500 text-slate-950 px-1.5 py-0.5 rounded-full font-bold force-ltr">
                      {partnerRelancesCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleTabClick('partner_returns')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_returns'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <CornerDownLeft className="w-4 h-4 shrink-0" />
                    <span>{t('sidebar.partnerReturns', 'Demandes de retour')}</span>
                  </div>
                  {partnerReturnsCount > 0 && (
                    <span className="font-mono text-[10px] bg-rose-500 text-white px-1.5 py-0.5 rounded-full font-bold force-ltr">
                      {partnerReturnsCount}
                    </span>
                  )}
                </button>

                <button
                  onClick={() => handleTabClick('partner_payments')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_payments'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <Wallet className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.partnerPayments')}</span>
                </button>

                <button
                  onClick={() => handleTabClick('partner_receipts')}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_receipts'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <Clock className="w-4 h-4 shrink-0" />
                  <span>{t('sidebar.partnerReceipts', 'Historique des reçus')}</span>
                </button>

                <button
                  onClick={() => handleTabClick('partner_api')}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl font-semibold transition-all cursor-pointer ${isRtl ? 'text-right' : 'text-left'} ${
                    activeTab === 'partner_api'
                      ? 'bg-red-600 text-white font-bold shadow-xs'
                      : 'hover:bg-slate-800/80 hover:text-white text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Key className="w-4 h-4 shrink-0 text-amber-400" />
                    <span className={activeTab === 'partner_api' ? 'text-white font-bold' : 'text-amber-300 font-bold'}>
                      {t('sidebar.partnerApi')}
                    </span>
                  </div>
                  <span className="font-mono text-[9px] bg-amber-500/20 text-amber-400 border border-amber-500/30 px-1.5 py-0.5 rounded-full font-bold">
                    REST
                  </span>
                </button>
              </>
            )}
          </nav>
        </div>

        {/* Bottom Actions: Scanner & Déconnexion */}
        <div className={`${isDesktopCollapsed ? 'p-2.5' : 'p-3.5'} border-t border-slate-800 space-y-2 shrink-0`}>
          {(!isEmployee || canSee('scanner')) && (
            <button
              onClick={onOpenScanner}
              title={t('sidebar.scanPackage')}
              className="w-full py-2 px-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-xs transition-colors cursor-pointer"
            >
              <Scan className="w-4 h-4 shrink-0" />
              {!isDesktopCollapsed && <span className="truncate">{t('sidebar.scanPackage')}</span>}
            </button>
          )}

          {/* Déconnexion button */}
          <button
            onClick={handleLogout}
            title={t('sidebar.logout')}
            className="w-full py-2 px-2.5 bg-slate-800 hover:bg-red-950/80 text-slate-300 hover:text-red-400 font-bold text-xs rounded-xl flex items-center justify-center gap-2 border border-slate-700/80 transition-colors cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isDesktopCollapsed && <span className="truncate">{t('sidebar.logout')}</span>}
          </button>

          {!isDesktopCollapsed && (
            <>
              <div className="flex items-center justify-center gap-2 pt-1">
                <a
                  href={facebookUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Facebook"
                  title="Facebook — FARIOUSY"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-[#1877F2] text-[#1877F2] hover:text-white border border-slate-700/80 hover:border-[#1877F2] flex items-center justify-center transition-colors"
                >
                  <FacebookIcon className="w-3.5 h-3.5" />
                </a>
                <a
                  href={instagramUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Instagram"
                  title="Instagram — @fariousy1"
                  className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-gradient-to-tr hover:from-[#F58529] hover:via-[#DD2A7B] hover:to-[#8134AF] text-pink-400 hover:text-white border border-slate-700/80 hover:border-pink-500 flex items-center justify-center transition-colors"
                >
                  <InstagramIcon className="w-3.5 h-3.5" />
                </a>
              </div>

              <div className="text-[10px] text-center text-slate-500 font-mono pt-0.5 force-ltr">
                {t('sidebar.version', 'FARIOUSY DELIVERY v1.0')}
              </div>
            </>
          )}
        </div>
      </aside>
    </>
  );
};
