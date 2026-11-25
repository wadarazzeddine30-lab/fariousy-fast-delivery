import React, { useMemo } from 'react';
import { PackageItem } from '../../types';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  buildOrderSupportWhatsAppUrl,
  resolveOrderSupportContact,
  SupportIssueCategory
} from '../../utils/supportWhatsApp';
import {
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Headphones,
  MapPin,
  MessageSquare,
  RotateCcw,
  Truck,
  X
} from 'lucide-react';

interface OrderWhatsAppSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageItem: PackageItem | null;
  onOpenInternalMessage?: (pkg: PackageItem) => void;
}

const WhatsAppBadgeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg viewBox="0 0 32 32" fill="currentColor" className={className} aria-hidden="true">
    <path d="M16.04 3C8.86 3 3.04 8.82 3.04 16c0 2.52.72 4.98 2.08 7.1L3 29l6.08-2.02A12.93 12.93 0 0 0 16.04 29c7.18 0 13-5.82 13-13s-5.82-13-13-13Zm7.56 18.2c-.32.9-1.84 1.72-2.54 1.82-.66.1-1.5.14-2.42-.16-.56-.18-1.28-.42-2.2-.82-3.88-1.68-6.4-5.58-6.6-5.84-.2-.26-1.58-2.1-1.58-4s1-2.84 1.36-3.22c.36-.38.78-.48 1.04-.48h.74c.24 0 .56-.08.88.68.32.78 1.1 2.68 1.2 2.88.1.2.16.44.04.7-.12.26-.2.42-.38.64-.18.22-.38.48-.54.64-.18.18-.36.38-.16.74.2.36.9 1.48 1.94 2.4 1.34 1.18 2.46 1.56 2.82 1.74.36.18.58.14.8-.1.22-.24.92-1.08 1.16-1.44.24-.36.5-.3.84-.18.34.12 2.18 1.02 2.56 1.2.38.18.62.28.72.44.1.16.1.94-.22 1.84Z" />
  </svg>
);

export const OrderWhatsAppSupportModal: React.FC<OrderWhatsAppSupportModalProps> = ({
  isOpen,
  onClose,
  packageItem,
  onOpenInternalMessage
}) => {
  const { cities, agencies, users, companySettings } = useDatabase();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const supportContact = useMemo(() => {
    if (!packageItem) return null;
    return resolveOrderSupportContact(packageItem, {
      cities,
      agencies,
      users,
      companySettings
    });
  }, [packageItem, cities, agencies, users, companySettings]);

  if (!isOpen || !packageItem || !supportContact) return null;

  const categories: {
    id: SupportIssueCategory;
    title: string;
    subtitle: string;
    icon: React.ReactNode;
    iconBgClass: string;
  }[] = [
    {
      id: 'retour',
      title: isAr ? 'مشكلة في المرتجعات' : 'Problème retour',
      subtitle: isAr ? 'مرتجع لم يصل، متأخر أو ناقص' : 'Retour non reçu, en retard ou incomplet',
      icon: <RotateCcw className="w-5 h-5 text-amber-600" />,
      iconBgClass: 'bg-amber-50 border border-amber-100'
    },
    {
      id: 'pickup',
      title: isAr ? 'مشكلة في الاستلام أو الجمع' : 'Problème colis ramassé ou pickup',
      subtitle: isAr ? 'طرد لم يُجمع أو تم تفويت الاستلام' : 'Colis pas ramassé, ramassage manqué',
      icon: <Truck className="w-5 h-5 text-blue-600" />,
      iconBgClass: 'bg-blue-50 border border-blue-100'
    },
    {
      id: 'paiement',
      title: isAr ? 'مشكلة في الدفع' : 'Problème de paiement',
      subtitle: isAr ? 'الدفع، الفاتورة أو المبلغ المستلم' : 'Paiement, facture ou montant reçu',
      icon: <CreditCard className="w-5 h-5 text-purple-600" />,
      iconBgClass: 'bg-purple-50 border border-purple-100'
    },
    {
      id: 'autre',
      title: isAr ? 'أخرى' : 'Autre',
      subtitle: isAr ? 'أي استفسار آخر بخصوص هذا الطرد' : 'Toute autre question sur ce colis',
      icon: <Headphones className="w-5 h-5 text-emerald-700" />,
      iconBgClass: 'bg-emerald-50 border border-emerald-100'
    }
  ];

  const ArrowIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print"
    >
      <div
        onClick={e => e.stopPropagation()}
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95"
      >
        {/* Top Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-white">
          <h3 className="text-base font-extrabold text-slate-900">
            {isAr ? 'التواصل مع الدعم / شكاية' : 'Contacter le support / Réclamation'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            aria-label={isAr ? 'إغلاق' : 'Fermer'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4">
          {/* WhatsApp Header & Regional Routing Info */}
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-full bg-[#25D366] text-white flex items-center justify-center shrink-0 shadow-sm">
              <WhatsAppBadgeIcon className="w-7 h-7" />
            </div>
            <div className="min-w-0">
              <h4 className="text-base font-black text-slate-900">
                {isAr ? 'ما هي المشكلة؟' : 'Quel est le problème ?'}
              </h4>
              <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
                {isAr ? 'الطرد' : 'Colis'}{' '}
                <span className="font-mono font-bold text-slate-900 force-ltr">{packageItem.trackingNumber}</span>{' '}
                · {isAr ? 'سيتم فتح واتساب مباشرة مع الفريق المختص.' : "WhatsApp s'ouvre avec la bonne équipe."}
              </p>
            </div>
          </div>

          {/* Assigned Regional Team Badge */}
          <div className="px-3.5 py-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200 flex items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="w-4 h-4 text-emerald-700 shrink-0" />
              <div className="min-w-0">
                <div className="font-bold text-emerald-950 truncate">
                  {supportContact.teamLabel} ({packageItem.city})
                </div>
                <div className="text-[11px] text-emerald-800 truncate">
                  {isAr ? 'المسؤول :' : 'Responsable :'}{' '}
                  <span className="font-semibold">{supportContact.agentName}</span>
                </div>
              </div>
            </div>
            <span className="font-mono text-[11px] font-bold text-emerald-900 bg-white px-2 py-0.5 rounded-lg border border-emerald-200 shrink-0 force-ltr">
              {supportContact.whatsappRaw}
            </span>
          </div>

          {/* 4 Problem Category Cards */}
          <div className="space-y-2.5">
            {categories.map(cat => {
              const whatsappUrl = buildOrderSupportWhatsAppUrl(packageItem, cat.id, supportContact);
              return (
                <a
                  key={cat.id}
                  href={whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setTimeout(onClose, 250)}
                  className="group flex items-center justify-between gap-3 p-3.5 bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 rounded-2xl shadow-2xs transition-all cursor-pointer"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${cat.iconBgClass}`}
                    >
                      {cat.icon}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-slate-900 group-hover:text-emerald-800 transition-colors">
                        {cat.title}
                      </div>
                      <div className="text-xs text-slate-500 mt-0.5 leading-snug">
                        {cat.subtitle}
                      </div>
                    </div>
                  </div>
                  <ArrowIcon className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-all shrink-0" />
                </a>
              );
            })}
          </div>

          {/* Optional in-app message fallback */}
          {onOpenInternalMessage && (
            <div className="pt-2 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenInternalMessage(packageItem);
                }}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <MessageSquare className="w-3.5 h-3.5" />
                <span>
                  {isAr ? 'أو إرسال رسالة داخلية في التطبيق' : "Ou envoyer un message interne dans l'application"}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
