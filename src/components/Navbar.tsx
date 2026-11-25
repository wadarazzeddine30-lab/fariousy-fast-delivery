import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDatabase } from '../context/DatabaseContext';
import { useLanguage } from '../i18n/LanguageContext';
import {
  Bell,
  Menu,
  LogOut,
  Shield,
  Truck,
  Store,
  Briefcase,
  Languages,
  Check,
  ArrowLeft,
  ArrowRight
} from 'lucide-react';

interface NavbarProps {
  onOpenScanner?: () => void;
  onOpenRealtimeModal: () => void;
  onToggleMobileSidebar: () => void;
  onOpenDriverApp?: () => void;
  onOpenNotifications?: () => void;
  unreadNotificationsCount?: number;
  canGoBack?: boolean;
  onGoBack?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenRealtimeModal,
  onToggleMobileSidebar,
  onOpenDriverApp,
  onOpenNotifications,
  unreadNotificationsCount = 0,
  canGoBack = false,
  onGoBack
}) => {
  const { currentUser, isAdmin, isClient, isDriver, isEmployee, logout, switchRole, isImpersonating, stopImpersonation } = useAuth();
  const {
    notifications,
    markNotificationRead,
    clearNotifications,
    unreadOrdersBadgeCount,
    clearUnreadOrdersBadge
  } = useDatabase();
  const { language, setLanguage, languages, t, isRtl } = useLanguage();

  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  const handleLogout = async () => {
    try {
      await logout();
    } catch (e) {
      console.warn('Logout notice:', e);
    }
  };

  const backLabel = language === 'ar' ? 'رجوع' : language === 'en' ? 'Back' : 'Retour';
  const backTooltip =
    language === 'ar'
      ? 'الرجوع إلى الصفحة الماضية'
      : language === 'en'
      ? 'Go back to previous page'
      : 'Retour à la page précédente';

  return (
    <header className="shrink-0 sticky top-0 z-40 bg-white border-b border-slate-200/80 shadow-2xs w-full max-w-full">
      <div className="flex items-center justify-between px-2 sm:px-5 h-14 sm:h-16 gap-1.5 sm:gap-3 min-w-0">
        {/* Leading Zone: Mobile/Tablet Menu + Back Arrow + Brand */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 shrink">
          <button
            type="button"
            onClick={onToggleMobileSidebar}
            aria-label="Menu"
            className="lg:hidden min-w-[36px] h-9 flex items-center justify-center text-slate-700 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          {onGoBack && (
            <button
              type="button"
              onClick={onGoBack}
              disabled={!canGoBack}
              aria-label={backTooltip}
              title={backTooltip}
              className={`min-w-[36px] h-9 px-2 sm:px-3 flex items-center justify-center gap-1.5 rounded-xl border text-xs font-bold whitespace-nowrap shrink-0 transition-all ${
                canGoBack
                  ? 'bg-slate-100 hover:bg-red-50 text-slate-800 hover:text-red-700 border-slate-200 hover:border-red-200 cursor-pointer active:scale-95'
                  : 'bg-slate-50 text-slate-400 border-slate-200/70 opacity-50 cursor-not-allowed'
              }`}
            >
              {isRtl ? (
                <ArrowRight className="w-4 h-4 shrink-0" />
              ) : (
                <ArrowLeft className="w-4 h-4 shrink-0" />
              )}
              <span className="hidden sm:inline">{backLabel}</span>
            </button>
          )}

          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <img
              src="/fariousy-logo.jpeg"
              onError={e => {
                const img = e.currentTarget;
                if (!img.dataset.fallback) {
                  img.dataset.fallback = '1';
                  img.src = '/pwa-192x192.png';
                }
              }}
              alt="FARIOUSY DELIVERY Logo"
              className="w-8 h-8 sm:w-10 sm:h-10 object-contain rounded-lg bg-white shrink-0"
            />
            <div className="min-w-0 truncate">
              <span className="font-extrabold text-slate-900 tracking-tight text-xs sm:text-base block leading-none truncate">
                FARIOUSY
              </span>
              <span className="text-[9px] sm:text-[10px] font-bold text-red-600 tracking-wider block mt-0.5 truncate">
                {t('nav.brandSubtitle')}
              </span>
            </div>
          </div>
        </div>

        {/* Right Action Zone */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {/* Language Selector Dropdown (FR / AR / EN) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setShowLangMenu(!showLangMenu);
                setShowProfileMenu(false);
                setShowNotifMenu(false);
              }}
              aria-label={t('languages.select')}
              title={`${t('languages.select')} (${languages.find(l => l.code === language)?.nativeName || ''})`}
              className="w-9 h-9 flex items-center justify-center text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer shrink-0"
            >
              <Languages className="w-4 h-4 text-slate-700" />
            </button>

            {showLangMenu && (
              <div
                className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-44 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-slate-150 p-2 z-50 animate-in fade-in slide-in-from-top-2`}
              >
                <div className="px-2 py-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-b border-slate-100 mb-1">
                  {t('languages.select')}
                </div>
                <div className="space-y-1">
                  {languages.map(lang => (
                    <button
                      key={lang.code}
                      onClick={() => {
                        setLanguage(lang.code);
                        setShowLangMenu(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-xl transition-colors cursor-pointer ${
                        language === lang.code
                          ? 'bg-red-50 text-red-600 font-black'
                          : 'hover:bg-slate-50 text-slate-700 font-semibold'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base leading-none">{lang.flag}</span>
                        <span>{lang.nativeName}</span>
                      </div>
                      {language === lang.code && <Check className="w-3.5 h-3.5 text-red-600" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Supabase Realtime Live Indicator Button */}
          <button
            onClick={onOpenRealtimeModal}
            title={t('nav.realtimeTooltip')}
            className="hidden sm:flex items-center gap-1.5 px-2.5 h-9 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl transition-colors border border-slate-200 cursor-pointer whitespace-nowrap shrink-0"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            <span className="hidden xl:inline font-mono text-[11px] font-bold text-slate-800">
              {t('nav.realtime')}
            </span>
          </button>

          {/* Quick App Livreur Android Button */}
          {onOpenDriverApp && (
            <button
              onClick={onOpenDriverApp}
              title={t('nav.driverAppTooltip')}
              className="flex items-center justify-center gap-1.5 min-w-[36px] h-9 px-2 sm:px-3 text-xs font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap shrink-0"
            >
              <Truck className="w-4 h-4 shrink-0" />
              <span className="hidden md:inline">{t('nav.driverApp')}</span>
            </button>
          )}

          {/* Notifications Trigger (Opens Full-Screen Notifications et Messages) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (unreadOrdersBadgeCount > 0) {
                  clearUnreadOrdersBadge();
                }
                setShowProfileMenu(false);
                setShowLangMenu(false);
                if (onOpenNotifications) {
                  setShowNotifMenu(false);
                  onOpenNotifications();
                } else {
                  setShowNotifMenu(!showNotifMenu);
                }
              }}
              aria-label="Notifications et Messages"
              title="Notifications et Messages"
              className="relative p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              <Bell className="w-5 h-5" />
              {unreadNotificationsCount > 0 ? (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 text-white font-mono tabular-nums font-bold text-[10px] rounded-full flex items-center justify-center shadow-xs">
                  {unreadNotificationsCount > 99 ? '99+' : unreadNotificationsCount}
                </span>
              ) : unreadOrdersBadgeCount > 0 ? (
                <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-red-600 text-white font-mono tabular-nums font-bold text-[10px] rounded-full shadow-xs">
                  {unreadOrdersBadgeCount}
                </span>
              ) : unreadCount > 0 && !onOpenNotifications ? (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-600 rounded-full" />
              ) : null}
            </button>

            {showNotifMenu && (
              <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-80 sm:w-96 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-slate-150 p-4 z-50 animate-in fade-in slide-in-from-top-2`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <span className="font-bold text-xs text-slate-900">
                    {t('nav.notifications')} ({notifications.length})
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={clearNotifications}
                      className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {t('nav.clearAll')}
                    </button>
                  </div>
                </div>

                <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto my-1">
                  {notifications.slice(0, 8).map(n => (
                    <div
                      key={n.id}
                      onClick={() => markNotificationRead(n.id)}
                      className={`py-2.5 px-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-colors ${
                        !n.read ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <span className="text-xs font-bold text-slate-800">{n.title}</span>
                        <span className="text-[10px] text-slate-400 font-mono force-ltr">
                          {n.timestamp.substring(11)}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-0.5">{n.message}</p>
                    </div>
                  ))}
                  {notifications.length === 0 && (
                    <div className="py-6 text-center text-xs text-slate-400">
                      {t('nav.noNotifications')}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* User Account Menu with role badge and Logout */}
          <div className="relative">
            <button
              onClick={() => {
                setShowProfileMenu(!showProfileMenu);
                setShowNotifMenu(false);
                setShowLangMenu(false);
              }}
              className="flex items-center gap-2 p-1.5 sm:px-3 sm:py-1.5 bg-slate-50 border border-slate-200 hover:bg-slate-100 rounded-xl transition-all cursor-pointer"
            >
              <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center font-bold text-xs">
                {currentUser?.name.charAt(0) || 'U'}
              </div>
              <div className="text-left hidden lg:block">
                <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[130px]">
                  {currentUser?.companyName || currentUser?.name}
                </span>
                <span className="text-[10px] text-red-600 font-bold block uppercase leading-tight">
                  {isAdmin
                    ? t('nav.roleAdmin')
                    : isEmployee
                    ? t('nav.roleEmployee')
                    : isDriver
                    ? t('nav.roleDriver')
                    : currentUser?.role === 'partner'
                    ? t('nav.rolePartner')
                    : t('nav.roleClient')}
                </span>
              </div>
            </button>

            {showProfileMenu && (
              <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} mt-2 w-72 max-w-[calc(100vw-1rem)] bg-white rounded-2xl shadow-xl border border-slate-150 p-3 z-50 animate-in fade-in slide-in-from-top-2`}>
                <div className="px-3 py-2 bg-slate-50 rounded-xl mb-2">
                  <div className="flex items-center gap-1.5 mb-1">
                    {isAdmin && <Shield className="w-3.5 h-3.5 text-red-600" />}
                    {isClient && <Store className="w-3.5 h-3.5 text-emerald-600" />}
                    {isDriver && <Truck className="w-3.5 h-3.5 text-amber-600" />}
                    {isEmployee && <Briefcase className="w-3.5 h-3.5 text-slate-600" />}
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                      {isAdmin
                        ? t('nav.accountAdmin')
                        : isClient
                        ? t('nav.accountClient')
                        : isDriver
                        ? t('nav.accountDriver')
                        : currentUser?.role === 'partner'
                        ? t('nav.accountPartner')
                        : t('nav.accountEmployee')}
                    </span>
                  </div>
                  <div className="font-extrabold text-xs text-slate-900">{currentUser?.name}</div>
                  {currentUser?.companyName && (
                    <div className="text-[11px] font-semibold text-red-600">
                      {currentUser.companyName}
                    </div>
                  )}
                  <div className="text-[11px] text-slate-500 font-mono force-ltr truncate mt-0.5">
                    {currentUser?.email}
                  </div>
                  {currentUser?.phone && (
                    <div className="text-[10px] text-slate-400 font-mono force-ltr mt-0.5">
                      {currentUser.phone}
                    </div>
                  )}
                </div>

                {/* Quick Switch back to Admin if currently impersonating */}
                {!isAdmin && (
                  <div className="pb-2 mb-2 border-b border-slate-100">
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        if (isImpersonating) {
                          stopImpersonation();
                        } else {
                          switchRole('admin');
                        }
                      }}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl transition-colors cursor-pointer"
                    >
                      <Shield className="w-3.5 h-3.5 text-red-600" />
                      <span>{t('nav.backToAdmin')}</span>
                    </button>
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('nav.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
