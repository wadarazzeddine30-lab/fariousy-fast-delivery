import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { updateOwnClientProfile } from '../../services/supabase';
import { formatMAD } from '../../utils/barcode';
import {
  Building,
  MapPin,
  Save,
  CheckCircle2,
  Sliders,
  Bookmark,
  Plus,
  Trash2,
  Sparkles,
  Landmark,
  CreditCard,
  Copy,
  Check,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { DeliveryEvolutionChart } from '../charts/DeliveryEvolutionChart';

const MOROCCAN_BANKS = [
  'Attijariwafa bank (التجاري وفا بنك)',
  'CIH Bank',
  'Banque Populaire (البنك الشعبي)',
  'Bank of Africa / BMCE',
  'Société Générale Maroc (SGMB)',
  'Crédit du Maroc (CDM)',
  'Crédit Agricole du Maroc (CAM)',
  'Al Barid Bank (البريد بنك)',
  'Bank Assafa (بنك الصفاء)',
  'Umnia Bank (أمنية بنك)',
  'Al Akhdar Bank (البنك الأخضر)',
  'CFG Bank',
  'Dar Al Amane'
];

export const ClientProfile: React.FC = () => {
  const { currentUser, updateCurrentUser } = useAuth();
  const {
    cities,
    updateClient,
    packages,
    savedAddresses,
    addSavedAddress,
    deleteSavedAddress
  } = useDatabase();
  const { language } = useLanguage();

  const [companyName, setCompanyName] = useState(currentUser?.companyName || '');
  const [name, setName] = useState(currentUser?.name || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [address, setAddress] = useState(currentUser?.address || '');
  const [city, setCity] = useState(currentUser?.city || 'Casablanca');

  // Bank details state
  const resolveBankPreset = (rawBank?: string) => {
    const clean = (rawBank || '').trim();
    if (!clean) return { option: '', custom: '' };
    const matched = MOROCCAN_BANKS.find(b => b.toLowerCase() === clean.toLowerCase());
    if (matched) return { option: matched, custom: '' };
    return { option: '__other__', custom: clean };
  };

  const initialBank = resolveBankPreset(currentUser?.bankName);
  const [selectedBankOption, setSelectedBankOption] = useState(initialBank.option);
  const [customBankName, setCustomBankName] = useState(initialBank.custom);
  const [bankRib, setBankRib] = useState((currentUser?.bankRib || '').replace(/[^0-9]/g, '').slice(0, 24));
  const [ribCopied, setRibCopied] = useState(false);

  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingBank, setIsSavingBank] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [bankSaveSuccess, setBankSaveSuccess] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    setCompanyName(currentUser.companyName || '');
    setName(currentUser.name || '');
    setEmail(currentUser.email || '');
    setPhone(currentUser.phone || '');
    setAddress(currentUser.address || '');
    setCity(currentUser.city || 'Casablanca');
    const resolved = resolveBankPreset(currentUser.bankName);
    setSelectedBankOption(resolved.option);
    setCustomBankName(resolved.custom);
    setBankRib((currentUser.bankRib || '').replace(/[^0-9]/g, '').slice(0, 24));
  }, [
    currentUser?.id,
    currentUser?.companyName,
    currentUser?.name,
    currentUser?.email,
    currentUser?.phone,
    currentUser?.address,
    currentUser?.city,
    currentUser?.bankName,
    currentUser?.bankRib
  ]);

  // Saved addresses state
  const [newAddrLabel, setNewAddrLabel] = useState('');
  const [newAddrName, setNewAddrName] = useState('');
  const [newAddrPhone, setNewAddrPhone] = useState('');
  const [newAddrCity, setNewAddrCity] = useState(cities[0]?.name || 'Casablanca');
  const [newAddrFull, setNewAddrFull] = useState('');
  const [addrNotice, setAddrNotice] = useState<string | null>(null);

  const mySavedAddresses = useMemo(
    () =>
      savedAddresses
        .filter(a => a.ownerId === currentUser?.id)
        .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0)),
    [savedAddresses, currentUser?.id]
  );

  // Client's packages & delivered packages
  const myClientPackages = packages.filter(
    p => p.clientId === currentUser?.id || (p.shopId && p.shopId === currentUser?.id)
  );
  const clientDelivered = myClientPackages.filter(p => p.status === 'livre');

  const handleAddSavedAddr = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !newAddrName.trim() || !newAddrPhone.trim() || !newAddrFull.trim()) return;
    addSavedAddress({
      ownerId: currentUser.id,
      label: newAddrLabel.trim() || `${newAddrName.trim()} — ${newAddrCity}`,
      recipientName: newAddrName.trim(),
      recipientPhone: newAddrPhone.trim(),
      city: newAddrCity,
      address: newAddrFull.trim()
    });
    setNewAddrLabel('');
    setNewAddrName('');
    setNewAddrPhone('');
    setNewAddrFull('');
    setAddrNotice('تم حفظ العنوان بنجاح! تقدر تختارو بكليك واحد فاش تزيد طرد جديد.');
    setTimeout(() => setAddrNotice(null), 3000);
  };

  const handleImportFrequentAddresses = () => {
    if (!currentUser) return;
    const existingKeys = new Set(mySavedAddresses.map(a => `${a.recipientPhone.trim()}-${a.address.trim().toLowerCase()}`));
    let imported = 0;
    for (const p of myClientPackages) {
      const key = `${(p.recipientPhone || '').trim()}-${(p.address || '').trim().toLowerCase()}`;
      if (!p.recipientPhone || !p.address || existingKeys.has(key)) continue;
      existingKeys.add(key);
      addSavedAddress({
        ownerId: currentUser.id,
        label: `${p.recipientName} — ${p.city}`,
        recipientName: p.recipientName,
        recipientPhone: p.recipientPhone,
        city: p.city,
        address: p.address
      });
      imported++;
      if (imported >= 10) break;
    }
    setAddrNotice(
      imported > 0
        ? `تم استيراد ${imported} عنوان من طلباتك السابقة بنجاح.`
        : 'جميع عناوينك السابقة محفوظة مسبقاً.'
    );
    setTimeout(() => setAddrNotice(null), 3000);
  };

  const cleanRibDigits = bankRib.replace(/[^0-9]/g, '');
  const resolvedBankName =
    selectedBankOption === '__other__' ? customBankName.trim() : selectedBankOption.trim();
  const isRibValid = cleanRibDigits.length === 24;

  const handleCopyRib = () => {
    if (!cleanRibDigits) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(cleanRibDigits).catch(() => {});
      setRibCopied(true);
      setTimeout(() => setRibCopied(false), 2000);
    }
  };

  const handleSaveBankOnly = async () => {
    if (!currentUser) return;
    setProfileError(null);
    setBankSaveSuccess(false);

    if (cleanRibDigits.length !== 24) {
      setProfileError(
        language === 'ar'
          ? 'رقم الحساب البنكي (RIB) خاصو يكون مكون من 24 رقم بالضبط.'
          : 'Le numéro RIB bancaire doit contenir exactement 24 chiffres.'
      );
      return;
    }

    if (!resolvedBankName) {
      setProfileError(
        language === 'ar'
          ? 'عافاك اختار نوع البنك مع رقم الحساب البنكي (RIB).'
          : 'Veuillez sélectionner le nom / type de votre banque.'
      );
      return;
    }

    const bankUpdates = {
      bankName: resolvedBankName,
      bankRib: cleanRibDigits
    };

    setIsSavingBank(true);
    try {
      const apiRes = await updateOwnClientProfile({
        userId: currentUser.id,
        ...bankUpdates
      });

      if (!apiRes.success) {
        setProfileError(apiRes.error || 'Erreur lors de la sauvegarde du RIB.');
        return;
      }

      updateClient(currentUser.id, bankUpdates, {
        name: currentUser.name,
        role: currentUser.role
      });
      updateCurrentUser(bankUpdates);

      setBankSaveSuccess(true);
      setTimeout(() => setBankSaveSuccess(false), 3500);
    } catch (err: any) {
      setProfileError(err?.message || 'Erreur lors de la sauvegarde du RIB.');
    } finally {
      setIsSavingBank(false);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setProfileError(null);
    setSaveSuccess(false);
    setBankSaveSuccess(false);

    if (cleanRibDigits.length > 0 && cleanRibDigits.length !== 24) {
      setProfileError(
        language === 'ar'
          ? 'رقم الحساب البنكي (RIB) خاصو يكون مكون من 24 رقم بالضبط.'
          : 'Le numéro RIB bancaire doit contenir exactement 24 chiffres.'
      );
      return;
    }

    if (cleanRibDigits.length === 24 && !resolvedBankName) {
      setProfileError(
        language === 'ar'
          ? 'عافاك اختار نوع البنك مع رقم الحساب البنكي (RIB).'
          : 'Veuillez sélectionner le nom / type de votre banque.'
      );
      return;
    }

    const updates = {
      companyName: companyName.trim() || currentUser.companyName || currentUser.name || 'Boutique',
      name: name.trim() || currentUser.name || 'Client',
      email: email.trim() || currentUser.email || '',
      phone: phone.trim() || currentUser.phone || '',
      address: address.trim(),
      city: city.trim() || currentUser.city || 'Casablanca',
      bankName: resolvedBankName,
      bankRib: cleanRibDigits
    };

    setIsSavingProfile(true);
    try {
      const apiRes = await updateOwnClientProfile({
        userId: currentUser.id,
        ...updates
      });

      if (!apiRes.success) {
        setProfileError(apiRes.error || 'Erreur lors de la sauvegarde.');
        setIsSavingProfile(false);
        return;
      }

      updateClient(currentUser.id, updates, {
        name: currentUser.name,
        role: currentUser.role
      });
      updateCurrentUser(updates);

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3500);
    } catch (err: any) {
      setProfileError(err?.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          {language === 'ar' ? 'ملف التاجر وإعدادات الحساب' : 'Profil Client & Paramètres du Compte'}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {language === 'ar'
            ? 'بيانات الاتصال، الحساب البنكي للتحويلات (RIB)، عنوان الاستلام وجدول التعريفات'
            : 'Informations de facturation, coordonnées bancaires (RIB), adresses de collecte et grille tarifaire'}
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>
            {language === 'ar'
              ? 'تم حفظ البيانات ومعلومات الحساب البنكي بنجاح في النظام!'
              : 'Vos coordonnées et informations bancaires ont été enregistrées avec succès !'}
          </span>
        </div>
      )}

      {profileError && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs flex items-center gap-2 font-bold">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{profileError}</span>
        </div>
      )}

      {/* Recharts Data Visualization: Évolution des livraisons réussies sur les 7 derniers jours */}
      <DeliveryEvolutionChart
        packages={clientDelivered}
        title={language === 'ar' ? 'تطور تسليم طرود متجرك (آخر 7 أيام)' : 'Évolution des Livraisons de Votre Boutique (7 derniers jours)'}
        subtitle={language === 'ar' ? 'عدد الطرود المسلمة بنجاح إلى زبنائك في مختلف المدن' : 'Nombre de colis livrés avec succès à vos clients à travers le réseau Fariousy'}
        chartType="area"
        showCash={true}
      />

      {/* Profile Form */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-5">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Building className="w-4 h-4 text-red-600" />
          <span>{language === 'ar' ? 'بيانات المتجر والمسؤول' : 'Informations de l\'Entreprise & Contact'}</span>
        </h3>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'الاسم التجاري للمتجر / العلامة' : 'Nom Commercial de la Marque'}
              </label>
              <input
                type="text"
                required
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'اسم المسير / المدير' : 'Nom du Responsable Gérant'}
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'البريد الإلكتروني' : 'Adresse Email'}
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'رقم الهاتف الرئيسي (واتساب)' : 'Téléphone Principal (WhatsApp)'}
              </label>
              <input
                type="tel"
                required
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="w-full text-xs font-mono tabular-nums force-ltr bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'عنوان المستودع / الاستلام الدائم' : 'Adresse de Collecte Permanente'}
              </label>
              <input
                type="text"
                value={address}
                onChange={e => setAddress(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {language === 'ar' ? 'المدينة الرئيسية' : 'Ville'}
              </label>
              <input
                type="text"
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
              />
            </div>
          </div>

          {/* Coordonnées Bancaires (نوع البنك & RIB Bancaire) */}
          <div className="pt-5 mt-5 border-t border-slate-200 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Landmark className="w-4 h-4 text-red-600" />
                <span>
                  {language === 'ar'
                    ? 'معلومات الحساب البنكي للتحويلات (RIB Bancaire)'
                    : 'Coordonnées Bancaires (Virements CRBT / RIB)'}
                </span>
              </h4>
              <span className="text-[11px] text-slate-500">
                {language === 'ar'
                  ? 'يتم استخدام هذا الحساب لتحويل مستحقاتك المالية'
                  : 'Utilisé pour le versement de vos fonds COD'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === 'ar' ? 'نوع / اسم البنك (Banque)' : 'Type / Nom de la Banque (نوع البنك)'}
                </label>
                <select
                  value={selectedBankOption}
                  onChange={e => {
                    const val = e.target.value;
                    setSelectedBankOption(val);
                    if (val !== '__other__') setCustomBankName('');
                  }}
                  className="w-full text-xs font-medium bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                >
                  <option value="">
                    {language === 'ar' ? '— اختر نوع البنك —' : '— Sélectionnez votre banque —'}
                  </option>
                  {MOROCCAN_BANKS.map(bank => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                  <option value="__other__">
                    {language === 'ar' ? 'بنك آخر (Autre banque)' : 'Autre banque (بنك آخر)'}
                  </option>
                </select>

                {selectedBankOption === '__other__' && (
                  <input
                    type="text"
                    value={customBankName}
                    onChange={e => setCustomBankName(e.target.value)}
                    placeholder={
                      language === 'ar' ? 'اكتب اسم البنك هنا...' : 'Saisissez le nom de votre banque...'
                    }
                    className="mt-2 w-full text-xs bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700">
                    {language === 'ar' ? 'رقم الحساب البنكي (RIB - 24 رقم)' : 'RIB Bancaire (24 chiffres)'}
                  </label>
                  <span
                    className={`text-[11px] font-mono tabular-nums font-bold ${
                      cleanRibDigits.length === 0
                        ? 'text-slate-400'
                        : isRibValid
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                    }`}
                  >
                    {cleanRibDigits.length} / 24
                  </span>
                </div>
                <div className="relative flex items-center">
                  <CreditCard className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={24}
                    value={bankRib}
                    onChange={e => {
                      const digitsOnly = e.target.value.replace(/[^0-9]/g, '').slice(0, 24);
                      setBankRib(digitsOnly);
                      if (profileError) setProfileError(null);
                    }}
                    placeholder="007810000123456789012345"
                    className="w-full text-xs font-mono tabular-nums tracking-wider force-ltr bg-slate-50 border border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500"
                  />
                  {cleanRibDigits.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyRib}
                      title="Copier le RIB"
                      className="absolute right-2.5 p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition cursor-pointer"
                    >
                      {ribCopied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  )}
                </div>
                <div className="mt-1 flex items-center justify-between text-[11px]">
                  {cleanRibDigits.length === 0 ? (
                    <span className="text-slate-400">
                      {language === 'ar'
                        ? 'أدخل 24 رقم الخاص بالحساب البنكي بدون فراغات'
                        : 'Saisissez les 24 chiffres de votre RIB marocain'}
                    </span>
                  ) : isRibValid ? (
                    <span className="text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {language === 'ar' ? 'رقم RIB صحيح (24 رقماً)' : 'Format RIB valide (24 chiffres)'}
                    </span>
                  ) : (
                    <span className="text-amber-700 font-medium">
                      {language === 'ar'
                        ? `باقي ${24 - cleanRibDigits.length} رقم لإكمال RIB`
                        : `Encore ${24 - cleanRibDigits.length} chiffre(s) requis`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {bankSaveSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs flex items-center gap-2 font-bold">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  {language === 'ar'
                    ? 'تم حفظ الحساب البنكي (RIB) بنجاح!'
                    : 'RIB bancaire enregistré avec succès !'}
                </span>
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleSaveBankOnly}
                disabled={isSavingBank || isSavingProfile}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-60 rounded-xl transition-colors cursor-pointer"
              >
                {isSavingBank ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Landmark className="w-3.5 h-3.5 text-red-600" />}
                <span>{language === 'ar' ? 'حفظ الحساب البنكي فقط (RIB)' : 'Enregistrer uniquement le RIB'}</span>
              </button>
            </div>
          </div>

          <div className="pt-3 flex justify-end">
            <button
              type="submit"
              disabled={isSavingProfile}
              className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              {isSavingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>{language === 'ar' ? 'حفظ البيانات' : 'Enregistrer les coordonnées'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* 📍 SAVED ADDRESSES (عناوين محفوظة) */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Bookmark className="w-4 h-4 text-amber-500" />
              <span>العناوين المحفوظة (Adresses fréquentes — اختيار بكليك واحد)</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              سجل العناوين اللي كتتعامل معاهم بزاف باش تعمرهم بكليك واحد عند إضافة أي طرد جديد
            </p>
          </div>
          {myClientPackages.length > 0 && (
            <button
              type="button"
              onClick={handleImportFrequentAddresses}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition cursor-pointer shrink-0"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>استيراد من طلباتي السابقة</span>
            </button>
          )}
        </div>

        {addrNotice && (
          <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{addrNotice}</span>
          </div>
        )}

        <form onSubmit={handleAddSavedAddr} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              value={newAddrLabel}
              onChange={e => setNewAddrLabel(e.target.value)}
              placeholder="الاسم المختصر (مثال: متجر المعاريف)"
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
            />
            <input
              type="text"
              required
              value={newAddrName}
              onChange={e => setNewAddrName(e.target.value)}
              placeholder="اسم المستلم *"
              className="text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
            />
            <input
              type="tel"
              required
              value={newAddrPhone}
              onChange={e => setNewAddrPhone(e.target.value)}
              placeholder="رقم الهاتف *"
              className="text-xs font-mono bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
            />
            <select
              value={newAddrCity}
              onChange={e => setNewAddrCity(e.target.value)}
              className="text-xs font-semibold bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
            >
              {cities.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              required
              value={newAddrFull}
              onChange={e => setNewAddrFull(e.target.value)}
              placeholder="العنوان الكامل والحي *"
              className="flex-1 text-xs bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
            />
            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>حفظ العنوان</span>
            </button>
          </div>
        </form>

        {mySavedAddresses.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400 border border-dashed border-slate-200 rounded-xl">
            لا توجد عناوين محفوظة بعد. أضف أول عنوان أو استورده من طلباتك السابقة.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {mySavedAddresses.map(addr => (
              <div
                key={addr.id}
                className="p-3.5 bg-white border border-slate-200 rounded-xl flex items-start justify-between gap-2 hover:border-amber-300 transition"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                    <span className="text-xs font-extrabold text-slate-900 truncate">{addr.label}</span>
                    {addr.usageCount ? (
                      <span className="text-[10px] font-mono bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded font-bold">
                        ×{addr.usageCount}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-xs text-slate-700 font-semibold">
                    {addr.recipientName} • <span className="font-mono text-red-600">{addr.recipientPhone}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 truncate">
                    <strong>{addr.city}</strong> — {addr.address}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => deleteSavedAddress(addr.id)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                  title="حذف"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Mes Tarifs Spécifiques (Negotiated rates table) */}
      <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <Sliders className="w-4 h-4 text-slate-700" />
          <span>{language === 'ar' ? 'جدول التعريفات المعتمدة لحسابك' : 'Grille Tarifaire Négociée pour Votre Compte'}</span>
        </h3>
        <p className="text-xs text-slate-500 -mt-2">
          {language === 'ar'
            ? 'تطبق هذه التعريفات تلقائياً عند تسجيل أي طرد جديد'
            : 'Tarifs appliqués automatiquement lors de la création de vos colis'}
        </p>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">{language === 'ar' ? 'مدينة الوجهة' : 'Ville Destination'}</th>
                <th className="py-2.5 px-4 text-center">{language === 'ar' ? 'مدة التوصيل' : 'Délai d\'Acheminement'}</th>
                <th className="py-2.5 px-4 text-right">{language === 'ar' ? 'التعريفة المطبقة' : 'Tarif Appliqué'}</th>
                <th className="py-2.5 px-4 text-center">{language === 'ar' ? 'نوع التعريفة' : 'Type de Tarif'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {cities.map(c => {
                const customRate = currentUser?.customRates?.[c.name];
                const appliedRate = customRate !== undefined ? customRate : c.defaultFee;
                const isSpecial = customRate !== undefined;

                return (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-bold text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4 text-center font-mono">{c.deliveryDelayHours}h</td>
                    <td className="py-2.5 px-4 text-right font-mono font-black text-slate-900">
                      {formatMAD(appliedRate)}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isSpecial ? 'bg-red-100 text-red-800' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {isSpecial
                          ? (language === 'ar' ? '★ تعريفة شريك تفضيلية' : '★ Tarif Partenaire Négocié')
                          : (language === 'ar' ? 'تعريفة عادية' : 'Tarif Standard')}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
