import React from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { AlertTriangle, ArrowLeft, ArrowRight } from 'lucide-react';

interface ImpersonationBannerProps {
  onBackToAdmin?: () => void;
}

export const ImpersonationBanner: React.FC<ImpersonationBannerProps> = ({ onBackToAdmin }) => {
  const { isImpersonating, currentUser, stopImpersonation, impersonatorAdmin } = useAuth();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  if (!isImpersonating || !currentUser) {
    return null;
  }

  const handleReturn = () => {
    stopImpersonation();
    if (onBackToAdmin) {
      onBackToAdmin();
    }
  };

  const isDriver = currentUser.role === 'driver';
  const isPartner = currentUser.role === 'partner';
  const roleLabel = isAr
    ? isDriver
      ? 'موزع'
      : isPartner
      ? 'شريك'
      : 'زبون'
    : isDriver
    ? 'Livreur'
    : isPartner
    ? 'Partenaire'
    : 'Client';
  const displayName = currentUser.companyName || currentUser.name || (isAr ? 'مستخدم' : 'Utilisateur');
  const ReturnArrow = isRtl ? ArrowRight : ArrowLeft;

  return (
    <div className="bg-red-600 text-white px-3 sm:px-5 py-2.5 shadow-lg z-[9999] sticky top-0 border-b border-red-700/80 animate-fadeIn">
      <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs sm:text-sm">
        {/* Info */}
        <div className={`flex items-center gap-2.5 text-center ${isRtl ? 'sm:text-right' : 'sm:text-left'}`}>
          <span className="p-1.5 bg-white/20 rounded-lg text-white shrink-0">
            <AlertTriangle className="w-4 h-4 text-amber-300 animate-pulse" />
          </span>
          <div className="leading-tight">
            <div className="flex items-center gap-2 flex-wrap justify-center sm:justify-start font-bold">
              <span>{isAr ? 'أنت تتصفح الآن حساب :' : 'Vous consultez le compte de :'}</span>
              <span className="bg-white text-red-700 px-2 py-0.5 rounded font-black shadow-xs">
                {displayName}
              </span>
              <span className="bg-red-800/80 text-red-100 text-[11px] px-2 py-0.5 rounded-full font-mono">
                {roleLabel}
              </span>
            </div>
            <p className="text-[11px] text-red-100/90 font-medium hidden sm:block mt-0.5">
              {isAr
                ? `وضع المعاينة والتحكم المباشر في حساب ${roleLabel} (المدير : ${impersonatorAdmin?.name || 'Admin'})`
                : `Mode aperçu et contrôle direct du compte ${roleLabel} (Administrateur : ${impersonatorAdmin?.name || 'Admin'})`}
            </p>
          </div>
        </div>

        {/* Return Button */}
        <button
          onClick={handleReturn}
          className="bg-white hover:bg-red-50 text-red-700 active:scale-95 transition-all px-4 py-1.5 rounded-xl font-black text-xs sm:text-sm shadow-md flex items-center gap-2 shrink-0 cursor-pointer border border-white/40"
        >
          <ReturnArrow className="w-4 h-4 text-red-600" />
          <span>{isAr ? 'الرجوع إلى لوحة الإدارة' : "Retour à l'administration"}</span>
        </button>
      </div>
    </div>
  );
};
