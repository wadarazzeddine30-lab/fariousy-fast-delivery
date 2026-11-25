import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { formatMAD } from '../../utils/barcode';
import { Banknote, CheckCircle2, Coins, Wallet } from 'lucide-react';
import { DeliveryEvolutionChart } from '../charts/DeliveryEvolutionChart';

export const DriverCash: React.FC = () => {
  const { currentUser } = useAuth();
  const { packages } = useDatabase();
  const { t, language, isRtl } = useLanguage();

  const [depositSuccess, setDepositSuccess] = useState(false);

  // Delivered parcels assigned to this driver
  const myDelivered = packages.filter(p => p.driverId === currentUser?.id && p.status === 'livre');
  const totalCashInHand = myDelivered.reduce((acc, p) => acc + (p.codAmount || 0), 0);

  // Driver personal revenue calculation
  const fee = currentUser?.driverFeePerDelivery ?? 10;
  const fixed = currentUser?.driverFixedSalary ?? 0;
  const salaryType = currentUser?.driverSalaryType ?? 'per_package';

  let myEarnings = 0;
  if (salaryType === 'per_package') {
    myEarnings = myDelivered.length * fee;
  } else if (salaryType === 'fixed_plus_package') {
    myEarnings = fixed + (myDelivered.length * fee);
  } else {
    myEarnings = fixed;
  }
  if (currentUser?.driverBonusThreshold && myDelivered.length >= currentUser.driverBonusThreshold) {
    myEarnings += (currentUser?.driverBonusAmount || 0);
  }

  const handleDepositToHub = () => {
    const confirmMsg = language === 'ar'
      ? `تأكيد دفع مبلغ ${formatMAD(totalCashInHand)} إلى صندوق الوكالة؟`
      : `Confirmer le versement de ${formatMAD(totalCashInHand)} à la caisse du Hub Agence ?`;

    if (confirm(confirmMsg)) {
      setDepositSuccess(true);
      setTimeout(() => setDepositSuccess(false), 4000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          {language === 'ar' ? 'صندوق الموزع والعمولات المستحقة' : 'Caisse & Rémunération Livreur'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'ar'
            ? 'متابعة المبالغ النقدية المحصلة لصالح الشركة واحتساب أرباحك وعمولاتك الشخصية'
            : 'Suivi des espèces COD collectées pour l\'entreprise et décompte de votre rémunération personnelle'}
        </p>
      </div>

      {depositSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            {language === 'ar'
              ? 'تم تسجيل وصل الإيداع بصندوق الوكالة بنجاح!'
              : 'Bordereau de versement caisse agence validé avec succès !'}
          </span>
        </div>
      )}

      {/* Dual Cards: Mon Revenu + Caisse COD */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Mon Revenu Personnel (Mes Gains) */}
        <div className="p-6 bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 text-white rounded-2xl shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-amber-100 font-black uppercase tracking-wider flex items-center gap-1.5">
                <Coins className="w-4 h-4 text-white" />
                <span>{language === 'ar' ? 'أرباحي وعمولاتي الشخصية' : 'Mon Revenu (Gains Personnels)'}</span>
              </span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold">
                {fee} MAD / {language === 'ar' ? 'طرد' : 'livraison'}
              </span>
            </div>

            <div className="text-3xl font-black font-mono text-white mt-2">
              {formatMAD(myEarnings)}
            </div>
            <p className="text-xs text-amber-100 mt-1">
              {language === 'ar'
                ? `محتسب على أساس ${myDelivered.length} طرد تم تسليمه بنجاح ${fixed > 0 ? `+ ${fixed} درهم ثابت` : ''}`
                : `Calculé sur ${myDelivered.length} livraisons réussies ${fixed > 0 ? `+ ${fixed} MAD fixe` : ''}`}
            </p>
          </div>

          <div className="pt-3 border-t border-white/20 text-xs text-amber-100 flex items-center justify-between">
            <span>
              {language === 'ar' ? 'طريقة الحساب : ' : 'Mode : '}
              <strong className="font-bold text-white">
                {salaryType === 'per_package'
                  ? (language === 'ar' ? 'بالعمولة على الطرد' : 'À la commission')
                  : salaryType === 'fixed_plus_package'
                  ? (language === 'ar' ? 'ثابت + عمولة' : 'Fixe + Commission')
                  : (language === 'ar' ? 'راتب ثابت' : 'Fixe')}
              </strong>
            </span>
            <span>{language === 'ar' ? 'تعريفة معتمدة من الإدارة' : 'Tarif validé par l\'administration'}</span>
          </div>
        </div>

        {/* Card 2: Cash In Hand Card (Caisse Agence) */}
        <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-4 h-4 text-emerald-400" />
                <span>{language === 'ar' ? 'المبالغ المحصلة (للإيداع بالوكالة)' : 'Caisse COD (À Reverser à l\'Agence)'}</span>
              </span>
              <span className="text-[10px] bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 font-mono">
                {currentUser?.city || 'Casablanca'}
              </span>
            </div>

            <div className="text-3xl font-black font-mono text-emerald-400 mt-2">
              {formatMAD(totalCashInHand)}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'ar'
                ? `المجموع المطابق لـ ${myDelivered.length} طرد مسلّم في جولتك`
                : `Correspondant à ${myDelivered.length} colis livrés sur votre tournée`}
            </p>
          </div>

          <button
            onClick={handleDepositToHub}
            disabled={totalCashInHand === 0}
            className="w-full py-2.5 text-xs font-bold text-slate-900 bg-emerald-400 hover:bg-emerald-300 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
          >
            <Banknote className="w-4 h-4" />
            <span>{language === 'ar' ? 'تأكيد إيداع المبلغ بصندوق الوكالة' : 'Effectuer versement caisse agence'}</span>
          </button>
        </div>
      </div>

      {/* Recharts Data Visualization: Évolution des livraisons réussies sur les 7 derniers jours */}
      <DeliveryEvolutionChart
        packages={myDelivered}
        title={language === 'ar' ? 'تطور عمليات التسليم الناجحة على مدار 7 أيام' : 'Évolution de vos Livraisons Réussies (7 derniers jours)'}
        subtitle={language === 'ar' ? 'رسم بياني يوضح الأداء اليومي والمبالغ المحصلة' : 'Performance quotidienne de vos livraisons sur votre tournée'}
        chartType="area"
        showCash={true}
      />

      {/* Deliveries Breakdown Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            {language === 'ar' ? 'تفاصيل الطرود المحصلة نقداً' : 'Détail des Colis Encaissés'}
          </h3>
          <span className="text-xs font-mono font-semibold text-slate-500">
            {myDelivered.length} {language === 'ar' ? 'طرد' : 'colis'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">{language === 'ar' ? 'رقم التتبع' : 'N° Suivi'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'المستلم' : 'Destinataire'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'المدينة والعنوان' : 'Ville & Adresse'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'المبلغ المحصل' : 'Espèces Encaissées'}</th>
                <th className="py-3 px-4 text-right">{language === 'ar' ? 'عمولتك' : 'Votre Commission'}</th>
                <th className="py-3 px-4">{language === 'ar' ? 'الحالة' : 'Statut'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myDelivered.map(p => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                  <td className="py-3 px-4 font-bold text-slate-800">{p.recipientName}</td>
                  <td className="py-3 px-4 text-slate-600">{p.city} - {p.address}</td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                    {formatMAD(p.codAmount)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-amber-800 text-xs">
                    +{formatMAD(fee)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                      {language === 'ar' ? 'تم التحصيل نقداً' : 'Encaissé en espèces'}
                    </span>
                  </td>
                </tr>
              ))}
              {myDelivered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    {language === 'ar'
                      ? 'لا توجد تحصيلات مسجلة في جولتك الحالية.'
                      : 'Aucun encaissement enregistré sur votre tournée.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
