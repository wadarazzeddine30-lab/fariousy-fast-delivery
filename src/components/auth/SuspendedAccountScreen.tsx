import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { useLanguage } from '../../i18n/LanguageContext';
import { ShieldAlert, AlertTriangle, LogOut, RefreshCw, Phone, Mail, Store, ShieldCheck } from 'lucide-react';

interface SuspendedAccountScreenProps {
  user: UserProfile;
  onLogout: () => Promise<void>;
  onRefresh?: () => Promise<UserProfile | null>;
}

export const SuspendedAccountScreen: React.FC<SuspendedAccountScreenProps> = ({
  user,
  onLogout,
  onRefresh
}) => {
  const { language } = useLanguage();
  const isAr = language === 'ar';

  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [refreshNotice, setRefreshNotice] = useState<string | null>(null);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    setRefreshNotice(null);
    try {
      const refreshed = await onRefresh();
      if (refreshed && refreshed.status !== 'suspendu' && refreshed.accountStatus !== 'suspendu') {
        setRefreshNotice(
          isAr
            ? 'تمت إعادة تفعيل الحساب بنجاح! جاري التوجيه...'
            : 'Compte réactivé avec succès ! Redirection en cours...'
        );
      } else {
        setRefreshNotice(
          isAr ? 'الحساب لا يزال في حالة توقيف.' : 'Le compte est toujours sous statut suspendu.'
        );
      }
    } catch {
      setRefreshNotice(
        isAr ? 'حدث خطأ أثناء التحقق من الحالة.' : 'Erreur lors de la vérification du statut.'
      );
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-red-950 flex flex-col justify-center items-center p-4 sm:p-6 text-slate-100">
      <div className="max-w-xl w-full bg-slate-900/90 backdrop-blur-xl border border-red-500/30 rounded-2xl shadow-2xl p-6 sm:p-8 relative overflow-hidden">
        {/* Accent banner */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-red-600 via-amber-500 to-red-600" />

        {/* Header with Icon */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 shadow-lg shadow-red-500/10">
            <ShieldAlert className="w-9 h-9" />
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/30 mb-2">
            <AlertTriangle className="w-3.5 h-3.5" />
            {isAr ? 'تم إيقاف الولوج إلى فضاء الزبون' : 'Accès Espace Client Interrompu'}
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            {isAr ? 'تم توقيف حساب المتجر' : 'Compte Boutique Suspendu'}
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            {isAr
              ? 'فاريوسي دليفري — مراقبة الأمان والامتثال'
              : 'FARIOUSY DELIVERY — Contrôle de Sécurité & Conformité'}
          </p>
        </div>

        {/* Client & Store Details */}
        <div className="bg-slate-800/80 border border-slate-700/60 rounded-xl p-4 mb-5 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/50">
            <span className="flex items-center gap-1.5">
              <Store className="w-3.5 h-3.5 text-red-400" />
              {isAr ? 'المتجر' : 'Boutique'}
            </span>
            <span className="font-semibold text-slate-200">
              {user.companyName || user.name || (isAr ? 'متجر' : 'Boutique')}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 pb-2 border-b border-slate-700/50">
            <span>{isAr ? 'المسؤول' : 'Responsable'}</span>
            <span className="text-slate-300">{user.name}</span>
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>{isAr ? 'معرف تسجيل الدخول' : 'Identifiant de connexion'}</span>
            <span className="text-slate-300 font-mono text-[11px] force-ltr">{user.email}</span>
          </div>
        </div>

        {/* Reason Alert Box */}
        <div className="bg-red-950/40 border border-red-500/30 rounded-xl p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <div className="text-xs text-red-200/90 space-y-1">
              <p className="font-semibold text-red-300">
                {isAr ? 'سبب القرار الإداري :' : 'Motif de la décision administrative :'}
              </p>
              <p className="leading-relaxed bg-red-900/30 p-2.5 rounded-lg border border-red-500/20 text-slate-200 font-medium">
                {user.statusReason ||
                  (isAr
                    ? 'تم توقيف حساب المتجر مؤقتاً من طرف إدارة فاريوسي دليفري.'
                    : "Compte boutique temporairement suspendu par l'administration FARIOUSY DELIVERY.")}
              </p>
            </div>
          </div>
        </div>

        {/* Data Security Guarantee Notice */}
        <div className="bg-slate-800/50 border border-slate-700/40 rounded-xl p-4 mb-6 text-xs text-slate-300 space-y-2">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold">
            <ShieldCheck className="w-4 h-4" />
            <span>{isAr ? 'ضمان سلامة بياناتك' : "Garantie d'intégrité de vos données"}</span>
          </div>
          <p className="text-slate-400 leading-relaxed text-[11.5px]">
            {isAr ? (
              <>
                جميع معلوماتك، طرودك المسجلة، سجل التوصيل، المدفوعات والكشوفات المالية تبقى{' '}
                <strong>محفوظة بالكامل</strong> بأمان تام. فقط إنشاء شحنات جديدة وطلبات الاستلام متوقف مؤقتاً.
              </>
            ) : (
              <>
                Toutes vos informations, colis enregistrés, historique de livraison, paiements et relevés financiers
                restent <strong>intégralement conservés</strong> en toute sécurité. Seule l'émission de nouvelles
                expéditions et demandes de ramassage est momentanément interrompue.
              </>
            )}
          </p>
        </div>

        {/* Refresh feedback */}
        {refreshNotice && (
          <div className="mb-4 p-2.5 rounded-lg text-xs text-center font-medium bg-slate-800 border border-slate-700 text-amber-300">
            {refreshNotice}
          </div>
        )}

        {/* Actions Buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          {onRefresh && (
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing
                ? isAr
                  ? 'جاري التحقق...'
                  : 'Vérification...'
                : isAr
                ? 'التحقق من إعادة التفعيل'
                : 'Vérifier la réactivation'}
            </button>
          )}

          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white transition-colors shadow-lg shadow-red-600/20 disabled:opacity-50"
          >
            <LogOut className="w-3.5 h-3.5" />
            {isLoggingOut
              ? isAr
                ? 'جاري تسجيل الخروج...'
                : 'Déconnexion...'
              : isAr
              ? 'تسجيل الخروج'
              : 'Se déconnecter'}
          </button>
        </div>

        {/* Support Footer */}
        <div className="mt-6 pt-4 border-t border-slate-800 text-center text-xs text-slate-500">
          <p>
            {isAr
              ? 'لتسوية وضعية حسابك، يرجى التواصل مع الدعم التجاري :'
              : 'Pour faire régulariser votre compte, veuillez contacter le support commercial :'}
          </p>
          <div className="flex items-center justify-center gap-4 mt-2 text-slate-400 font-medium">
            <span className="flex items-center gap-1 text-[11.5px] force-ltr">
              <Phone className="w-3 h-3 text-red-400" />
              06 53 53 39 36
            </span>
            <span className="text-slate-600">•</span>
            <span className="flex items-center gap-1 text-[11.5px] force-ltr">
              <Mail className="w-3 h-3 text-red-400" />
              contact@fariousy.com
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
