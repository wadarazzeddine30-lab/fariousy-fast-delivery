import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { PackageItem, UserProfile } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { isCityAllowedForUser } from '../../utils/employeePermissions';
import {
  Truck,
  Plus,
  Scan,
  CheckCircle2,
  AlertCircle,
  Phone,
  Mail,
  MapPin,
  X,
  Search,
  PackagePlus,
  ShieldCheck,
  Award,
  Edit2,
  Trash2,
  Download,
  Filter,
  DollarSign,
  Check,
  Coins,
  Calculator,
  Wallet,
  Receipt,
  Printer,
  TrendingUp,
  Sparkles,
  Key,
  Lock,
  Eye,
  EyeOff,
  Copy,
  ExternalLink,
  MessageCircle,
  Loader2,
  Share2,
  Smartphone,
  LogIn,
  CreditCard,
  ZoomIn
} from 'lucide-react';
import { getLocalKycDocs, saveLocalKycDocs } from '../../utils/kycStorage';
import { KycPhotoUpload } from '../common/KycPhotoUpload';
import { DriverApkExportModal } from '../driver/DriverApkExportModal';

interface AdminDriversProps {
  onOpenScanner: () => void;
  onViewPackage: (pkg: PackageItem) => void;
  openAddNonce?: number;
}

export const AdminDrivers: React.FC<AdminDriversProps> = ({
  onOpenScanner,
  onViewPackage,
  openAddNonce
}) => {
  const {
    users,
    packages,
    cities,
    addDriver,
    createDriverAccount,
    updateDriverPassword,
    updateDriver,
    deleteDriver,
    toggleDriverStatus,
    assignPackageToDriver,
    addAuditLog
  } = useDatabase();
  const { currentUser, switchRole, impersonateUser } = useAuth();

  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');

  const [showAddDriverModal, setShowAddDriverModal] = useState(false);

  React.useEffect(() => {
    if (openAddNonce) {
      setShowAddDriverModal(true);
    }
  }, [openAddNonce]);
  const [editingDriver, setEditingDriver] = useState<UserProfile | null>(null);
  const [driverToDelete, setDriverToDelete] = useState<UserProfile | null>(null);
  const [selectedDriverDetail, setSelectedDriverDetail] = useState<UserProfile | null>(null);
  const [previewDriverPhoto, setPreviewDriverPhoto] = useState<{ src: string; title: string } | null>(null);
  const [showLoadModalDriver, setShowLoadModalDriver] = useState<UserProfile | null>(null);
  const [loadSearchQuery, setLoadSearchQuery] = useState('');
  const [packageToUnassign, setPackageToUnassign] = useState<{ pkg: PackageItem; driver: UserProfile } | null>(null);
  const [isUnassigningPackage, setIsUnassigningPackage] = useState(false);

  // Add / Edit Driver Form State
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('Laâyoune'); // Default: Laâyoune
  const [vehicle, setVehicle] = useState('Moto');
  const [vehicleType, setVehicleType] = useState<'Moto' | 'Voiture'>('Moto');
  const [plate, setPlate] = useState('');
  const [driverCin, setDriverCin] = useState('');
  const [driverProfilePhoto, setDriverProfilePhoto] = useState('');
  const [driverCinPhoto, setDriverCinPhoto] = useState('');
  const [driverCinBackPhoto, setDriverCinBackPhoto] = useState('');
  const [driverPassword, setDriverPassword] = useState('');
  const [showDriverPassword, setShowDriverPassword] = useState(false);
  const [driverStatus, setDriverStatus] = useState<'active' | 'inactive'>('active');
  const [feePerDelivery, setFeePerDelivery] = useState<number>(10);
  const [fixedSalary, setFixedSalary] = useState<number>(0);
  const [salaryType, setSalaryType] = useState<'per_package' | 'fixed_plus_package' | 'monthly_fixed'>('per_package');
  const [pickupFee, setPickupFee] = useState<number>(5);
  const [isSubmittingDriver, setIsSubmittingDriver] = useState(false);
  const [addDriverError, setAddDriverError] = useState<string | null>(null);

  // Success Created Driver Modal State
  const [createdCredentials, setCreatedCredentials] = useState<{
    fullName: string;
    phone: string;
    email: string;
    password: string;
    city: string;
    vehicleType: string;
    loginUrl: string;
  } | null>(null);
  const [copiedSuccess, setCopiedSuccess] = useState(false);

  // Reset Password Modal State
  const [resetPasswordDriver, setResetPasswordDriver] = useState<UserProfile | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState<string | null>(null);
  const [resetSuccessCredentials, setResetSuccessCredentials] = useState<{
    fullName: string;
    phone: string;
    email: string;
    newPassword: string;
  } | null>(null);
  const [copiedResetSuccess, setCopiedResetSuccess] = useState(false);

  // Dedicated Driver Revenue Modal State
  const [editingRevenueDriver, setEditingRevenueDriver] = useState<UserProfile | null>(null);
  const [revenueFeePerDelivery, setRevenueFeePerDelivery] = useState<number>(10);
  const [revenueFixedSalary, setRevenueFixedSalary] = useState<number>(0);
  const [revenueSalaryType, setRevenueSalaryType] = useState<'per_package' | 'fixed_plus_package' | 'monthly_fixed'>('per_package');
  const [revenuePickupFee, setRevenuePickupFee] = useState<number>(5);
  const [revenueBonusThreshold, setRevenueBonusThreshold] = useState<number>(20);
  const [revenueBonusAmount, setRevenueBonusAmount] = useState<number>(50);

  // Driver Settlement / Fiche de Décompte Modal State
  const [settlementDriver, setSettlementDriver] = useState<UserProfile | null>(null);
  const [cashSettlementConfirm, setCashSettlementConfirm] = useState<{ driver: UserProfile; amount: number } | null>(null);
  const [driverToast, setDriverToast] = useState<{ message: string; type: 'success' | 'warning' } | null>(null);
  const [showDriverApkModal, setShowDriverApkModal] = useState(false);

  const showDriverToast = (message: string, type: 'success' | 'warning' = 'success') => {
    setDriverToast({ message, type });
    setTimeout(() => setDriverToast(null), 4000);
  };

  const drivers = users.filter(
    u => u.role === 'driver' && (currentUser?.role !== 'employee' || isCityAllowedForUser(currentUser, u.city))
  );

  const filteredDrivers = drivers.filter(d => {
    const matchesSearch =
      d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      d.phone.includes(searchTerm) ||
      (d.driverPlate && d.driverPlate.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesCity = cityFilter === 'all' || d.city === cityFilter;
    return matchesSearch && matchesCity;
  });

  // Password Generator Helper (strong, easy to read, satisfies Supabase Auth)
  const generateSecurePassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    const symbols = '!@#$%*';
    let res = 'Far';
    for (let i = 0; i < 4; i++) {
      res += letters.charAt(Math.floor(Math.random() * letters.length));
    }
    for (let i = 0; i < 2; i++) {
      res += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    res += symbols.charAt(Math.floor(Math.random() * symbols.length));
    return res;
  };

  const handleOpenAddDriverModal = () => {
    setName('');
    setPhone('');
    setEmail('');
    setCity('Laâyoune'); // Exigence : Laâyoune par défaut
    setVehicleType('Moto');
    setVehicle('Moto');
    setPlate('');
    setDriverCin('');
    setDriverProfilePhoto('');
    setDriverCinPhoto('');
    setDriverCinBackPhoto('');
    setDriverStatus('active');
    setDriverPassword(generateSecurePassword());
    setShowDriverPassword(true);
    setFeePerDelivery(10);
    setFixedSalary(0);
    setSalaryType('per_package');
    setPickupFee(5);
    setAddDriverError(null);
    setShowAddDriverModal(true);
  };

  const handleOpenResetPassword = (driver: UserProfile) => {
    setResetPasswordDriver(driver);
    setNewPassword(generateSecurePassword());
    setShowNewPassword(true);
    setResetPasswordError(null);
    setResetSuccessCredentials(null);
    setCopiedResetSuccess(false);
  };

  const handleCopyCredentials = (creds: {
    fullName: string;
    phone: string;
    email: string;
    password?: string;
    newPassword?: string;
    city?: string;
    vehicleType?: string;
    loginUrl?: string;
  }, isReset = false) => {
    const pass = creds.password || creds.newPassword || '';
    const loginLink = creds.loginUrl || (typeof window !== 'undefined' ? window.location.origin : 'https://fariousy.ma');
    const text = [
      `🚚 ACCÈS LIVREUR — FARIOUSY DELIVERY`,
      `====================================`,
      `👤 Nom : ${creds.fullName}`,
      `📱 Identifiant / Téléphone : ${creds.phone}`,
      `📧 E-mail : ${creds.email}`,
      `🔑 Mot de passe : ${pass}`,
      creds.city ? `📍 Zone d'affectation : ${creds.city} (${creds.vehicleType || 'Véhicule'})` : '',
      `🌐 Connexion : ${loginLink}`,
      `====================================`,
      `💡 Note : Vous pouvez vous connecter indifféremment avec votre numéro de téléphone ou votre adresse e-mail.`
    ].filter(Boolean).join('\n');

    if (navigator?.clipboard) {
      navigator.clipboard.writeText(text);
    }
    if (isReset) {
      setCopiedResetSuccess(true);
      setTimeout(() => setCopiedResetSuccess(false), 2500);
    } else {
      setCopiedSuccess(true);
      setTimeout(() => setCopiedSuccess(false), 2500);
    }
  };

  const getWhatsAppLink = (phone: string, text: string) => {
    let clean = phone.replace(/\D/g, '');
    if (clean.startsWith('0')) {
      clean = '212' + clean.slice(1);
    } else if (!clean.startsWith('212')) {
      clean = '212' + clean;
    }
    return `https://wa.me/${clean}?text=${encodeURIComponent(text)}`;
  };

  const handleAddDriverSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddDriverError(null);

    const cleanName = name.trim();
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    const cleanPassword = driverPassword.trim();

    if (!cleanName) {
      setAddDriverError('Le nom complet du livreur est obligatoire.');
      return;
    }
    if (!cleanPhone || cleanPhone.length < 8) {
      setAddDriverError('Un numéro de téléphone valide (au moins 8 chiffres) est obligatoire pour la connexion.');
      return;
    }
    if (!cleanPassword || cleanPassword.length < 6) {
      setAddDriverError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setIsSubmittingDriver(true);
    try {
      const res = await createDriverAccount({
        fullName: cleanName,
        phone: cleanPhone,
        email: email.trim() || undefined,
        password: cleanPassword,
        city: city || 'Laâyoune',
        vehicleType: vehicleType,
        driverPlate: plate.trim() || undefined,
        cinNumber: driverCin.trim().toUpperCase() || undefined,
        cinPhotoUrl: driverCinPhoto || undefined,
        cinBackPhotoUrl: driverCinBackPhoto || undefined,
        driverPhotoUrl: driverProfilePhoto || undefined,
        avatarUrl: driverProfilePhoto || undefined,
        feePerDelivery: Number(feePerDelivery) || 10,
        fixedSalary: Number(fixedSalary) || 0,
        salaryType: salaryType,
        pickupFee: Number(pickupFee) || 5,
        status: driverStatus
      });

      if (!res.success || !res.credentials) {
        setAddDriverError(res.error || 'Erreur lors de la création du livreur.');
        return;
      }

      setShowAddDriverModal(false);
      setCreatedCredentials({
        fullName: res.credentials.fullName,
        phone: res.credentials.phone,
        email: res.credentials.email,
        password: res.credentials.password,
        city: res.credentials.city,
        vehicleType: res.credentials.vehicleType,
        loginUrl: typeof window !== 'undefined' ? window.location.origin : 'https://fariousy.ma'
      });
      setCopiedSuccess(false);
    } catch (err: any) {
      setAddDriverError(err.message || 'Erreur inattendue de création.');
    } finally {
      setIsSubmittingDriver(false);
    }
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordDriver) return;
    setResetPasswordError(null);

    const cleanPass = newPassword.trim();
    if (!cleanPass || cleanPass.length < 6) {
      setResetPasswordError('Le mot de passe doit comporter au moins 6 caractères.');
      return;
    }

    setIsResettingPassword(true);
    try {
      const res = await updateDriverPassword(resetPasswordDriver.id, cleanPass);
      if (!res.success) {
        setResetPasswordError(res.error || 'Erreur lors de la réinitialisation du mot de passe.');
        return;
      }

      setResetSuccessCredentials({
        fullName: resetPasswordDriver.name,
        phone: resetPasswordDriver.phone,
        email: resetPasswordDriver.email,
        newPassword: cleanPass
      });
      setCopiedResetSuccess(false);
    } catch (err: any) {
      setResetPasswordError(err.message || 'Erreur serveur.');
    } finally {
      setIsResettingPassword(false);
    }
  };

  const handleOpenEdit = (driver: UserProfile) => {
    const localKyc = getLocalKycDocs([driver.id, driver.email]);
    setEditingDriver(driver);
    setName(driver.name);
    setEmail(driver.email);
    setPhone(driver.phone);
    setCity(driver.city || 'Casablanca');
    setVehicle(driver.driverVehicle || 'Fourgonnette');
    setPlate(driver.driverPlate || '');
    setDriverCin(driver.cinNumber || localKyc?.cinNumber || '');
    setDriverProfilePhoto(driver.driverPhotoUrl || driver.avatarUrl || localKyc?.driverPhotoUrl || '');
    setDriverCinPhoto(driver.cinPhotoUrl || localKyc?.cinPhotoUrl || '');
    setDriverCinBackPhoto(driver.cinBackPhotoUrl || localKyc?.cinBackPhotoUrl || '');
    setFeePerDelivery(driver.driverFeePerDelivery ?? 10);
    setFixedSalary(driver.driverFixedSalary ?? 0);
    setSalaryType(driver.driverSalaryType ?? 'per_package');
    setPickupFee(driver.driverPickupFee ?? 5);
  };

  const handleUpdateDriverSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDriver) return;

    const cleanCin = driverCin.trim().toUpperCase() || undefined;

    updateDriver(editingDriver.id, {
      name,
      email,
      phone,
      city,
      driverVehicle: vehicle,
      driverPlate: plate,
      cinNumber: cleanCin,
      cinPhotoUrl: driverCinPhoto || undefined,
      cinBackPhotoUrl: driverCinBackPhoto || undefined,
      driverPhotoUrl: driverProfilePhoto || undefined,
      avatarUrl: driverProfilePhoto || undefined,
      driverFeePerDelivery: Number(feePerDelivery),
      driverFixedSalary: Number(fixedSalary),
      driverSalaryType: salaryType,
      driverPickupFee: Number(pickupFee)
    });

    saveLocalKycDocs([editingDriver.id, email], {
      cinNumber: cleanCin,
      cinPhotoUrl: driverCinPhoto || undefined,
      cinBackPhotoUrl: driverCinBackPhoto || undefined,
      driverPhotoUrl: driverProfilePhoto || undefined
    });

    addAuditLog({
      action: 'Modification livreur',
      entity: 'livreur',
      entityId: editingDriver.id,
      details: `Mise à jour des coordonnées et barème de rémunération de ${name} (${feePerDelivery} MAD/livraison)`
    });

    setEditingDriver(null);
  };

  const handleOpenRevenueModal = (driver: UserProfile) => {
    setEditingRevenueDriver(driver);
    setRevenueFeePerDelivery(driver.driverFeePerDelivery ?? 10);
    setRevenueFixedSalary(driver.driverFixedSalary ?? 0);
    setRevenueSalaryType(driver.driverSalaryType ?? 'per_package');
    setRevenuePickupFee(driver.driverPickupFee ?? 5);
    setRevenueBonusThreshold(driver.driverBonusThreshold ?? 20);
    setRevenueBonusAmount(driver.driverBonusAmount ?? 50);
  };

  const handleSaveRevenueModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRevenueDriver) return;

    updateDriver(editingRevenueDriver.id, {
      driverFeePerDelivery: Number(revenueFeePerDelivery),
      driverFixedSalary: Number(revenueFixedSalary),
      driverSalaryType: revenueSalaryType,
      driverPickupFee: Number(revenuePickupFee),
      driverBonusThreshold: Number(revenueBonusThreshold),
      driverBonusAmount: Number(revenueBonusAmount)
    });

    addAuditLog({
      action: 'Modification barème revenu livreur',
      entity: 'livreur',
      entityId: editingRevenueDriver.id,
      details: `Revenu ajusté pour ${editingRevenueDriver.name} : ${revenueFeePerDelivery} MAD/livraison, Fixe ${revenueFixedSalary} MAD (${revenueSalaryType})`
    });

    setEditingRevenueDriver(null);
  };

  const handleConfirmDeleteDriver = async (reason?: string) => {
    if (!driverToDelete) return;
    const target = driverToDelete;
    setDriverToDelete(null);
    await deleteDriver(target.id, reason || 'Suppression demandée');
  };

  const handleExportCSV = () => {
    const data = filteredDrivers.map(d => {
      const assigned = packages.filter(p => p.driverId === d.id);
      const delivered = assigned.filter(p => p.status === 'livre');
      const cash = delivered.reduce((acc, p) => acc + (p.codAmount || 0), 0);
      const fee = d.driverFeePerDelivery ?? 10;
      const fixed = d.driverFixedSalary ?? 0;
      const salaryType = d.driverSalaryType ?? 'per_package';
      let earnings = 0;
      if (salaryType === 'per_package') earnings = delivered.length * fee;
      else if (salaryType === 'fixed_plus_package') earnings = fixed + (delivered.length * fee);
      else earnings = fixed;
      if (d.driverBonusThreshold && delivered.length >= d.driverBonusThreshold) {
        earnings += (d.driverBonusAmount || 0);
      }

      return {
        ID: d.id,
        Nom: d.name,
        Email: d.email,
        Telephone: d.phone,
        Ville: d.city,
        Vehicule: d.driverVehicle || 'N/A',
        Matricule: d.driverPlate || 'N/A',
        Statut: d.status,
        Colis_Assigne: assigned.length,
        Colis_Livre: delivered.length,
        Tarif_Par_Colis_MAD: fee,
        Mode_Remuneration: salaryType,
        Forfait_Fixe_MAD: fixed,
        Revenu_Total_Livreur_MAD: earnings,
        Cash_COD_Collecte_Pour_Agence_MAD: cash
      };
    });

    exportCSV(data, `fariousy_livreurs_et_revenus_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  const handleAssignSinglePackage = (packageId: string, driver: UserProfile) => {
    assignPackageToDriver(packageId, driver.id, driver.name);
  };

  const handleSettleDriverCash = (driver: UserProfile, amount: number) => {
    if (amount <= 0) {
      showDriverToast("Aucun cash en attente d'encaissement pour ce livreur.", 'warning');
      return;
    }
    setCashSettlementConfirm({ driver, amount });
  };

  const confirmSettleDriverCash = () => {
    if (!cashSettlementConfirm) return;
    const { driver, amount } = cashSettlementConfirm;
    addAuditLog({
      userName: 'Administrateur',
      userRole: 'admin',
      actionType: 'CREATE',
      module: 'finance',
      action: 'Encaissement cash livreur',
      entity: 'finance',
      entityId: driver.id,
      entityLabel: `Cash ${driver.name}`,
      details: `Réception de ${formatMAD(amount)} versée par le livreur ${driver.name}`
    });
    setCashSettlementConfirm(null);
    showDriverToast(`Encaissement de ${formatMAD(amount)} validé avec succès.`, 'success');
  };

  return (
    <div className="space-y-5">
      {driverToast && (
        <div
          className={`px-4 py-3 rounded-xl text-xs font-bold flex items-center justify-between border shadow-xs ${
            driverToast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{driverToast.message}</span>
          <button onClick={() => setDriverToast(null)} className="p-1 opacity-70 hover:opacity-100">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion de la Flotte des Livreurs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tournées, chargement par scan/recherche, encaissements cash, gestion des comptes et performances
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter CSV</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Scan className="w-4 h-4 text-red-600" />
            <span>Charger par Scan</span>
          </button>

          <button
            onClick={() => setShowDriverApkModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-800 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded-xl shadow-2xs transition-colors cursor-pointer"
            title="تصدير أو تثبيت تطبيق الموزع APK"
          >
            <Smartphone className="w-4 h-4 text-amber-600" />
            <span>تصدير تطبيق الموزع (APK)</span>
          </button>

          <button
            onClick={handleOpenAddDriverModal}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Livreur</span>
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Rechercher livreur par nom, tel, matricule..."
            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="text-xs font-semibold px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Toutes les zones ({drivers.length})</option>
            {cities.map(c => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Driver Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDrivers.map(driver => {
          const assignedPackages = packages.filter(p => p.driverId === driver.id);
          const activeTourPackages = assignedPackages.filter(p => p.status === 'en_cours_livraison');
          const deliveredPackages = assignedPackages.filter(p => p.status === 'livre');
          const returnedPackages = assignedPackages.filter(p =>
            ['refuse', 'retour_en_cours', 'retourne'].includes(p.status)
          );

          // Cash collected by this driver for Fariousy (COD collecté à reverser à la caisse)
          const cashCollected = deliveredPackages.reduce((acc, p) => acc + (p.codAmount || 0), 0);
          const totalHandled = deliveredPackages.length + returnedPackages.length;
          const deliveryRate = totalHandled > 0 ? Math.round((deliveredPackages.length / totalHandled) * 100) : 100;

          // Driver personal revenue / earnings calculation
          const fee = driver.driverFeePerDelivery ?? 10;
          const fixed = driver.driverFixedSalary ?? 0;
          const salaryType = driver.driverSalaryType ?? 'per_package';
          let driverEarnings = 0;
          if (salaryType === 'per_package') {
            driverEarnings = deliveredPackages.length * fee;
          } else if (salaryType === 'fixed_plus_package') {
            driverEarnings = fixed + (deliveredPackages.length * fee);
          } else {
            driverEarnings = fixed;
          }
          if (driver.driverBonusThreshold && deliveredPackages.length >= driver.driverBonusThreshold) {
            driverEarnings += (driver.driverBonusAmount || 0);
          }

          return (
            <div
              key={driver.id}
              className={`p-5 bg-white border rounded-2xl shadow-2xs space-y-4 hover:border-slate-300 transition-all flex flex-col justify-between ${
                driver.status === 'inactive' ? 'opacity-70 bg-slate-50/80 border-slate-300' : 'border-slate-200'
              }`}
            >
              <div>
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const localKyc = getLocalKycDocs([driver.id, driver.email]);
                      const photo = driver.driverPhotoUrl || driver.avatarUrl || localKyc?.driverPhotoUrl;
                      if (photo) {
                        return (
                          <button
                            type="button"
                            onClick={() => setPreviewDriverPhoto({ src: photo, title: `صورة السائق — ${driver.name}` })}
                            className="w-10 h-10 rounded-xl overflow-hidden border border-amber-300 shadow-2xs shrink-0 cursor-pointer"
                            title="عرض صورة السائق"
                          >
                            <img src={photo} alt={driver.name} className="w-full h-full object-cover" />
                          </button>
                        );
                      }
                      return (
                        <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-sm shrink-0">
                          <Truck className="w-5 h-5" />
                        </div>
                      );
                    })()}
                    <div>
                      <h3 className="text-sm font-extrabold text-slate-900">{driver.name}</h3>
                      <p className="text-[11px] text-slate-500 font-mono">Zone : {driver.city || 'Laâyoune'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                        driver.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {driver.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                    <button
                      onClick={() => {
                        switchRole('driver', driver);
                      }}
                      className="px-2 py-1 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg flex items-center gap-1 cursor-pointer"
                      title="التحكم في حساب وتطبيق هذا الليفرور"
                    >
                      <Smartphone className="w-3.5 h-3.5 text-amber-600" />
                      <span>دخول حسابه</span>
                    </button>
                    <button
                      onClick={() => handleOpenResetPassword(driver)}
                      className="p-1 text-slate-400 hover:text-amber-600 rounded cursor-pointer"
                      title="Modifier ou réinitialiser le mot de passe"
                    >
                      <Key className="w-3.5 h-3.5 text-amber-600" />
                    </button>
                    <button
                      onClick={() => handleOpenRevenueModal(driver)}
                      className="p-1 text-slate-400 hover:text-amber-600 rounded"
                      title="Éditer le revenu & barème"
                    >
                      <Coins className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleOpenEdit(driver)}
                      className="p-1 text-slate-400 hover:text-blue-600 rounded"
                      title="Modifier informations livreur"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setDriverToDelete(driver)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                      title="Désactiver ou supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                    </button>
                  </div>
                </div>

                {/* Details Vehicle */}
                <div className="mt-3 p-2.5 bg-slate-50 rounded-xl text-xs space-y-1 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-[11px] text-slate-400">Véhicule :</span>
                    <span className="font-semibold text-slate-800">{driver.driverVehicle || 'Fourgonnette'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-slate-400">Matricule :</span>
                    <span className="font-mono font-bold text-slate-900">{driver.driverPlate || '12345-A-1'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[11px] text-slate-400">Téléphone :</span>
                    <span className="font-mono text-slate-800">📞 {driver.phone}</span>
                  </div>
                </div>

                {/* KPI Metrics */}
                <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">En cours</span>
                    <span className="font-mono font-extrabold text-orange-600 text-sm">
                      {activeTourPackages.length}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Livrés</span>
                    <span className="font-mono font-extrabold text-emerald-600 text-sm">
                      {deliveredPackages.length}
                    </span>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg">
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Retours</span>
                    <span className="font-mono font-extrabold text-rose-600 text-sm">
                      {returnedPackages.length}
                    </span>
                  </div>
                </div>

                {/* SECTION: REVENU & RÉMUNÉRATION DU LIVREUR */}
                <div className="mt-3 p-3 bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200/90 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-amber-700" />
                      <span className="text-[11px] font-black text-amber-950 uppercase tracking-wide">
                        Revenu Livreur
                      </span>
                    </div>
                    <button
                      onClick={() => handleOpenRevenueModal(driver)}
                      className="px-2 py-0.5 text-[10px] font-black text-amber-900 bg-amber-200/80 hover:bg-amber-300 rounded-lg border border-amber-300 transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <Coins className="w-3 h-3 text-amber-800" />
                      <span>Éditer Revenu</span>
                    </button>
                  </div>

                  <div className="flex items-end justify-between pt-1">
                    <div>
                      <div className="text-[10px] text-amber-800 font-medium">
                        {salaryType === 'per_package' && (
                          <span>Barème : <strong className="font-bold text-amber-950">{fee} MAD</strong> / livraison</span>
                        )}
                        {salaryType === 'fixed_plus_package' && (
                          <span>Fixe : <strong className="font-bold text-amber-950">{fixed} MAD</strong> + <strong className="font-bold text-amber-950">{fee} MAD</strong>/colis</span>
                        )}
                        {salaryType === 'monthly_fixed' && (
                          <span>Forfait Fixe : <strong className="font-bold text-amber-950">{fixed} MAD</strong></span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Gains calculés ({deliveredPackages.length} livrés)
                      </div>
                    </div>

                    <div className="text-right">
                      <span className="font-mono font-black text-sm text-amber-900 block">
                        {formatMAD(driverEarnings)}
                      </span>
                      <button
                        onClick={() => setSettlementDriver(driver)}
                        className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline cursor-pointer"
                      >
                        Fiche Décompte
                      </button>
                    </div>
                  </div>
                </div>

                {/* Encaissements Cash Card (Pour l'agence) */}
                <div className="mt-3 p-3 bg-slate-900 text-white rounded-xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">
                      Cash collecté à reverser :
                    </span>
                    <span className="font-mono font-black text-emerald-400 text-sm">
                      {formatMAD(cashCollected)}
                    </span>
                  </div>
                  <div className="text-right">
                    <button
                      onClick={() => handleSettleDriverCash(driver, cashCollected)}
                      className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold rounded-lg text-[10px] transition-colors cursor-pointer"
                    >
                      Valider Dépôt
                    </button>
                    <span className="text-[10px] text-slate-400 block mt-1">Succès: {deliveryRate}%</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                <button
                  onClick={() => impersonateUser(driver)}
                  title="Se connecter directement sur le compte de ce livreur (دخول لحساب الليفرور)"
                  className="px-3 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 shadow-xs"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connexion (دخول)</span>
                </button>

                <button
                  onClick={() => setShowLoadModalDriver(driver)}
                  className="flex-1 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition-colors text-center flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PackagePlus className="w-3.5 h-3.5" />
                  <span>Charger Colis</span>
                </button>

                <button
                  onClick={() => setSelectedDriverDetail(driver)}
                  className="px-3 py-2 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  Tournée ({assignedPackages.length})
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Driver Tour Detail Modal */}
      {selectedDriverDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Tournée de Livraison — {selectedDriverDetail.name} ({selectedDriverDetail.city})
                </h3>
                <p className="text-xs text-slate-500">
                  Véhicule : {selectedDriverDetail.driverVehicle} — Matricule : {selectedDriverDetail.driverPlate}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    impersonateUser(selectedDriverDetail);
                    setSelectedDriverDetail(null);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  title="Se connecter directement sur le compte de ce livreur (دخول لحساب الليفرور)"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Connexion au compte (دخول)</span>
                </button>
                <button onClick={() => setSelectedDriverDetail(null)} className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {(() => {
                const localKyc = getLocalKycDocs([selectedDriverDetail.id, selectedDriverDetail.email]);
                const pUrl = selectedDriverDetail.driverPhotoUrl || selectedDriverDetail.avatarUrl || localKyc?.driverPhotoUrl;
                const cFront = selectedDriverDetail.cinPhotoUrl || localKyc?.cinPhotoUrl;
                const cBack = selectedDriverDetail.cinBackPhotoUrl || localKyc?.cinBackPhotoUrl;
                const cNum = selectedDriverDetail.cinNumber || localKyc?.cinNumber;
                if (!pUrl && !cFront && !cBack && !cNum) return null;
                return (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-slate-800 flex items-center gap-1.5">
                        <CreditCard className="w-4 h-4 text-red-600" />
                        <span>وثائق السائق (الصورة الشخصية + البطاقة الوطنية)</span>
                      </span>
                      {cNum && (
                        <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                          CIN: {cNum}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
                      {pUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewDriverPhoto({ src: pUrl, title: `الصورة الشخصية — ${selectedDriverDetail.name}` })}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-24 cursor-pointer"
                        >
                          <img src={pUrl} alt={selectedDriverDetail.name} className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-1.5 py-1 flex items-center justify-between">
                            <span>الصورة</span>
                            <ZoomIn className="w-3 h-3" />
                          </div>
                        </button>
                      )}
                      {cFront && (
                        <button
                          type="button"
                          onClick={() => setPreviewDriverPhoto({ src: cFront, title: `CIN Recto — ${selectedDriverDetail.name}` })}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-24 cursor-pointer"
                        >
                          <img src={cFront} alt="CIN Recto" className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-1.5 py-1 flex items-center justify-between">
                            <span>CIN الأمام</span>
                            <ZoomIn className="w-3 h-3" />
                          </div>
                        </button>
                      )}
                      {cBack && (
                        <button
                          type="button"
                          onClick={() => setPreviewDriverPhoto({ src: cBack, title: `CIN Verso — ${selectedDriverDetail.name}` })}
                          className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white h-24 cursor-pointer"
                        >
                          <img src={cBack} alt="CIN Verso" className="w-full h-full object-cover" />
                          <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-1.5 py-1 flex items-center justify-between">
                            <span>CIN الخلف</span>
                            <ZoomIn className="w-3 h-3" />
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}

              <div className="border border-slate-200 rounded-xl overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">N° Suivi</th>
                      <th className="py-2.5 px-3">Destinataire</th>
                      <th className="py-2.5 px-3">Téléphone</th>
                      <th className="py-2.5 px-3">Adresse</th>
                      <th className="py-2.5 px-3 text-right">Montant COD</th>
                      <th className="py-2.5 px-3">Statut</th>
                      <th className="py-2.5 px-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {packages
                      .filter(p => p.driverId === selectedDriverDetail.id)
                      .map(p => (
                        <tr key={p.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                          <td className="py-2.5 px-3 font-medium text-slate-800">{p.recipientName}</td>
                          <td className="py-2.5 px-3 font-mono text-red-600 font-semibold">{p.recipientPhone}</td>
                          <td className="py-2.5 px-3 text-slate-600 max-w-[200px] truncate">{p.address}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-black">{formatMAD(p.codAmount)}</td>
                          <td className="py-2.5 px-3 font-semibold">{p.status}</td>
                          <td className="py-2.5 px-3 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => {
                                  setSelectedDriverDetail(null);
                                  onViewPackage(p);
                                }}
                                className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                              >
                                Détails
                              </button>
                              <button
                                type="button"
                                disabled={isUnassigningPackage}
                                onClick={() => setPackageToUnassign({ pkg: p, driver: selectedDriverDetail })}
                                title="حذف الكوليا من الليفرور (Retirer du livreur)"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg cursor-pointer transition disabled:opacity-50"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>حذف</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {packages.filter(p => p.driverId === selectedDriverDetail.id).length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-400">
                          Aucun colis n'est actuellement affecté à ce livreur
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => {
                  impersonateUser(selectedDriverDetail);
                  setSelectedDriverDetail(null);
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <LogIn className="w-4 h-4" />
                <span>Connexion au compte du livreur (دخول لحساب الليفرور)</span>
              </button>

              <button
                onClick={() => setSelectedDriverDetail(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Load Packages Modal */}
      {showLoadModalDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Charger des Colis dans la Tournée de {showLoadModalDriver.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Sélectionnez les colis prêts en stock ou en préparation pour cette tournée
                </p>
              </div>
              <button onClick={() => setShowLoadModalDriver(null)} className="p-2 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={loadSearchQuery}
                  onChange={e => setLoadSearchQuery(e.target.value)}
                  placeholder="Rechercher par N° de suivi, destinataire, ville..."
                  className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-4">
              {(() => {
                const currentlyAssigned = packages
                  .filter(p => p.driverId === showLoadModalDriver.id)
                  .filter(p =>
                    loadSearchQuery === '' ||
                    p.trackingNumber.toLowerCase().includes(loadSearchQuery.toLowerCase()) ||
                    p.recipientName.toLowerCase().includes(loadSearchQuery.toLowerCase())
                  );
                if (currentlyAssigned.length === 0) return null;
                return (
                  <div className="space-y-2">
                    <div className="text-[11px] font-black uppercase tracking-wide text-indigo-700 flex items-center justify-between">
                      <span>الكوليات المعطية حالياً لهاد الليفرور ({currentlyAssigned.length})</span>
                    </div>
                    {currentlyAssigned.map(p => (
                      <div
                        key={p.id}
                        className="p-3 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono font-bold text-slate-900">{p.trackingNumber}</span>
                            <span className="font-bold text-indigo-700">{p.city}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-700 font-medium">{p.recipientName}</span>
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            {p.address} — COD: <strong className="font-mono text-slate-900">{formatMAD(p.codAmount)}</strong>
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isUnassigningPackage}
                          onClick={() => setPackageToUnassign({ pkg: p, driver: showLoadModalDriver })}
                          title="حذف الكوليا من الليفرور"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer disabled:opacity-50"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <div className="space-y-2">
                <div className="text-[11px] font-black uppercase tracking-wide text-slate-500">
                  Colis disponibles à charger
                </div>
                {packages
                  .filter(p => p.driverId !== showLoadModalDriver.id && (!p.driverId || p.status === 'en_stock' || p.status === 'nouveau' || p.status === 'arrive_destination'))
                  .filter(p =>
                    loadSearchQuery === '' ||
                    p.trackingNumber.toLowerCase().includes(loadSearchQuery.toLowerCase()) ||
                    p.recipientName.toLowerCase().includes(loadSearchQuery.toLowerCase())
                  )
                  .map(p => (
                    <div
                      key={p.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-slate-900">{p.trackingNumber}</span>
                          <span className="font-bold text-red-600">{p.city}</span>
                          <span className="text-slate-400">·</span>
                          <span className="text-slate-600 font-medium">{p.recipientName}</span>
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {p.address} — COD: <strong className="font-mono text-slate-900">{formatMAD(p.codAmount)}</strong>
                        </div>
                      </div>

                      <button
                        onClick={() => handleAssignSinglePackage(p.id, showLoadModalDriver)}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer"
                      >
                        + Charger
                      </button>
                    </div>
                  ))}
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                onClick={() => setShowLoadModalDriver(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl"
              >
                Terminer le chargement
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Driver Modal */}
      {showAddDriverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Nouveau Livreur & Compte d'Accès</h3>
                  <p className="text-[11px] text-slate-500">
                    Création du compte Supabase Auth & affectation du rôle Livreur
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddDriverModal(false)}
                disabled={isSubmittingDriver}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddDriverSubmit} className="p-6 overflow-y-auto space-y-4">
              {addDriverError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2.5 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <span>{addDriverError}</span>
                </div>
              )}

              {/* 1. Nom complet */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nom complet du livreur <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ex: Tariq Mansouri"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>

              {/* 2. Téléphone & Email */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Numéro de téléphone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="06 61 00 00 00"
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Utilisé comme identifiant de connexion par le livreur
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Email <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="laisse vide pour génération auto"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Généré auto si non renseigné (ex: 0612345678@fariousy.com)
                  </p>
                </div>
              </div>

              {/* 3. Mot de passe & Générateur */}
              <div className="bg-slate-50/80 p-3.5 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-bold text-slate-800">
                    Mot de passe de connexion <span className="text-red-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setDriverPassword(generateSecurePassword());
                      setShowDriverPassword(true);
                    }}
                    className="flex items-center gap-1 text-[11px] font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-0.5 rounded-lg border border-red-200 transition-colors cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Générer un mot de passe sécurisé</span>
                  </button>
                </div>

                <div className="relative">
                  <input
                    type={showDriverPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    value={driverPassword}
                    onChange={e => setDriverPassword(e.target.value)}
                    placeholder="Au moins 6 caractères"
                    className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowDriverPassword(!showDriverPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    title={showDriverPassword ? 'Masquer' : 'Afficher'}
                  >
                    {showDriverPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-500">
                  Transmis au livreur pour lui permettre d'accéder à son application mobile.
                </p>
              </div>

              {/* 4. Zone / Ville (Défaut : Laâyoune) & Type de véhicule (Moto / Voiture) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Zone / Ville de livraison <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full text-xs font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {/* S'assurer que Laâyoune est disponible */}
                    {cities.some(c => c.name === 'Laâyoune') ? null : (
                      <option value="Laâyoune">Laâyoune (Par défaut)</option>
                    )}
                    {cities.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name} {c.name === 'Laâyoune' ? '(Par défaut)' : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Type de véhicule <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleType('Moto');
                        setVehicle('Moto');
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        vehicleType === 'Moto'
                          ? 'bg-red-50 border-red-500 text-red-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>🏍️ Moto</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setVehicleType('Voiture');
                        setVehicle('Voiture');
                      }}
                      className={`flex items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                        vehicleType === 'Voiture'
                          ? 'bg-red-50 border-red-500 text-red-700 shadow-2xs'
                          : 'bg-slate-50 border-slate-300 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span>🚗 Voiture</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* 5. Matricule & Statut initial */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Matricule d'immatriculation <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={plate}
                    onChange={e => setPlate(e.target.value)}
                    placeholder="Ex: 56789-A-26"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Statut initial du compte
                  </label>
                  <div className="flex items-center gap-2 h-[38px] px-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Actif (Accès immédiat à l'App Livreur)</span>
                  </div>
                </div>
              </div>

              {/* 5b. Photo de profil & Carte Nationale (CIN) */}
              <div className="bg-slate-50/90 p-3.5 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                      Photo de Profil & Carte Nationale (CIN)
                    </span>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500">Enregistré en base</span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Numéro de CIN <span className="text-slate-400 font-normal">(Optionnel)</span>
                  </label>
                  <input
                    type="text"
                    value={driverCin}
                    onChange={e => setDriverCin(e.target.value)}
                    placeholder="Ex: BK123456"
                    className="w-full text-xs font-mono uppercase bg-white border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <KycPhotoUpload
                  lang="fr"
                  variant="portrait"
                  captureMode="user"
                  label="Photo du profil du livreur"
                  sublabel="Photo d'identité claire du livreur (affichée sur sa fiche)"
                  value={driverProfilePhoto}
                  onChange={setDriverProfilePhoto}
                  disabled={isSubmittingDriver}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <KycPhotoUpload
                    lang="fr"
                    variant="id_card"
                    captureMode="environment"
                    label="Carte Nationale (Recto)"
                    sublabel="Face avant lisible de la CIN"
                    value={driverCinPhoto}
                    onChange={setDriverCinPhoto}
                    disabled={isSubmittingDriver}
                  />
                  <KycPhotoUpload
                    lang="fr"
                    variant="id_card"
                    captureMode="environment"
                    label="Carte Nationale (Verso)"
                    sublabel="Optionnel — face arrière"
                    value={driverCinBackPhoto}
                    onChange={setDriverCinBackPhoto}
                    disabled={isSubmittingDriver}
                  />
                </div>
              </div>

              {/* 6. Rémunération & Barème */}
              <div className="pt-2 border-t border-slate-200 bg-amber-50/60 p-3.5 rounded-xl border border-amber-200 space-y-2.5">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Rémunération & Barème Initial
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Commission par colis (MAD) *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      value={feePerDelivery}
                      onChange={e => setFeePerDelivery(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Forfait Fixe / Base (MAD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fixedSalary}
                      onChange={e => setFixedSalary(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode de calcul</label>
                    <select
                      value={salaryType}
                      onChange={e => setSalaryType(e.target.value as any)}
                      className="w-full text-xs bg-white border border-amber-300 rounded-xl px-2.5 py-2 text-slate-900"
                    >
                      <option value="per_package">À la commission par colis</option>
                      <option value="fixed_plus_package">Fixe + Commission</option>
                      <option value="monthly_fixed">Salaire fixe forfaitaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Prime ramassage (MAD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={pickupFee}
                      onChange={e => setPickupFee(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  disabled={isSubmittingDriver}
                  onClick={() => setShowAddDriverModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingDriver}
                  className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  {isSubmittingDriver ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Création en cours...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Créer le livreur & générer les accès</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Success Created Driver Modal (Section 3 : Copier les accès & WhatsApp) */}
      {createdCredentials && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="p-6 bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-center">
              <div className="w-12 h-12 rounded-full bg-white/20 mx-auto flex items-center justify-center mb-3">
                <CheckCircle2 className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-lg font-black tracking-tight">Livreur créé avec succès !</h3>
              <p className="text-xs text-white/90 mt-1">
                Le compte a été enregistré dans Supabase avec le rôle <strong>Livreur</strong>.
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2.5 text-xs">
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Nom complet :</span>
                  <span className="font-extrabold text-slate-900">{createdCredentials.fullName}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Téléphone (Identifiant) :</span>
                  <span className="font-mono font-bold text-slate-900">📱 {createdCredentials.phone}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">E-mail :</span>
                  <span className="font-mono text-slate-700">{createdCredentials.email}</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Mot de passe :</span>
                  <span className="font-mono font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                    🔑 {createdCredentials.password}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                  <span className="text-slate-500 font-medium">Zone d'affectation :</span>
                  <span className="font-semibold text-slate-800">
                    📍 {createdCredentials.city} ({createdCredentials.vehicleType})
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-slate-500 font-medium">Lien de connexion :</span>
                  <span className="font-mono text-[11px] text-blue-600 truncate max-w-[200px]">
                    {createdCredentials.loginUrl}
                  </span>
                </div>
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 leading-relaxed">
                💡 <strong>Important :</strong> Le livreur peut se connecter directement sur l'application en utilisant son <strong>numéro de téléphone</strong> et son <strong>mot de passe</strong>. Il sera automatiquement redirigé vers l'espace mobile Livreur.
              </div>

              {/* Action Buttons: Copier les accès & WhatsApp */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(createdCredentials, false)}
                  className={`flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                    copiedSuccess
                      ? 'bg-emerald-600 text-white border-emerald-600'
                      : 'bg-slate-900 hover:bg-black text-white border-slate-900'
                  }`}
                >
                  {copiedSuccess ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Accès copiés !</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>Copier les accès</span>
                    </>
                  )}
                </button>

                <a
                  href={getWhatsAppLink(
                    createdCredentials.phone,
                    `Bonjour ${createdCredentials.fullName},\n\nBienvenue dans l'équipe FARIOUSY DELIVERY ! 🚀\nVoici vos identifiants pour accéder à votre espace livreur :\n\n📱 Identifiant / Téléphone : ${createdCredentials.phone}\n🔑 Mot de passe : ${createdCredentials.password}\n📍 Zone : ${createdCredentials.city} (${createdCredentials.vehicleType})\n🌐 Connexion : ${createdCredentials.loginUrl}\n\nBonne tournée !`
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors cursor-pointer"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Envoyer par WhatsApp</span>
                </a>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => setCreatedCredentials(null)}
                  className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Reset Driver Password Modal */}
      {resetPasswordDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <Key className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">Modifier le Mot de Passe</h3>
                  <p className="text-[11px] text-slate-500">Livreur : {resetPasswordDriver.name}</p>
                </div>
              </div>
              <button
                onClick={() => setResetPasswordDriver(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {resetSuccessCredentials ? (
              <div className="p-6 space-y-4">
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-1">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600 mx-auto" />
                  <h4 className="text-sm font-black text-emerald-950">Mot de passe mis à jour !</h4>
                  <p className="text-xs text-emerald-800">
                    Le nouveau mot de passe a été enregistré dans Supabase Auth.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Livreur :</span>
                    <span className="font-bold text-slate-900">{resetSuccessCredentials.fullName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone / ID :</span>
                    <span className="font-mono font-bold text-slate-900">{resetSuccessCredentials.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Nouveau mot de passe :</span>
                    <span className="font-mono font-extrabold text-red-600 bg-red-50 px-2 py-0.5 rounded border border-red-200">
                      {resetSuccessCredentials.newPassword}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => handleCopyCredentials(resetSuccessCredentials, true)}
                    className={`flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      copiedResetSuccess
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-900 hover:bg-black text-white border-slate-900'
                    }`}
                  >
                    {copiedResetSuccess ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Copié !</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copier les accès</span>
                      </>
                    )}
                  </button>

                  <a
                    href={getWhatsAppLink(
                      resetSuccessCredentials.phone,
                      `Bonjour ${resetSuccessCredentials.fullName},\n\nVotre mot de passe FARIOUSY DELIVERY a été réinitialisé :\n\n📱 Identifiant : ${resetSuccessCredentials.phone}\n🔑 Nouveau mot de passe : ${resetSuccessCredentials.newPassword}\n🌐 Connexion : ${window.location.origin}\n\nBonne livraison !`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-1.5 px-3.5 py-2 text-xs font-bold rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white shadow-xs transition-colors cursor-pointer"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>WhatsApp</span>
                  </a>
                </div>

                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setResetPasswordDriver(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="p-6 space-y-4">
                {resetPasswordError && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-start gap-2 text-xs text-red-800">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <span>{resetPasswordError}</span>
                  </div>
                )}

                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Livreur :</span>
                    <span className="font-bold text-slate-900">{resetPasswordDriver.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Téléphone (ID) :</span>
                    <span className="font-mono font-bold text-slate-900">{resetPasswordDriver.phone}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Zone :</span>
                    <span className="text-slate-800">{resetPasswordDriver.city || 'Laâyoune'}</span>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold text-slate-800">
                      Nouveau mot de passe <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setNewPassword(generateSecurePassword());
                        setShowNewPassword(true);
                      }}
                      className="flex items-center gap-1 text-[10px] font-bold text-red-600 hover:text-red-700 bg-red-50 px-2 py-0.5 rounded-lg border border-red-200 cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Générer</span>
                    </button>
                  </div>

                  <div className="relative">
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={newPassword}
                      onChange={e => setNewPassword(e.target.value)}
                      placeholder="Nouveau mot de passe (min 6 car.)"
                      className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl pl-3.5 pr-10 py-2.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="pt-3 border-t flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={isResettingPassword}
                    onClick={() => setResetPasswordDriver(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Annuler
                  </button>
                  <button
                    type="submit"
                    disabled={isResettingPassword}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isResettingPassword ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Mise à jour...</span>
                      </>
                    ) : (
                      <>
                        <Key className="w-3.5 h-3.5" />
                        <span>Mettre à jour le mot de passe</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Edit Driver Modal */}
      {editingDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg max-h-[92vh] bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <h3 className="text-base font-bold text-slate-900">
                Modifier le Livreur — {editingDriver.name}
              </h3>
              <button onClick={() => setEditingDriver(null)} className="p-2 text-slate-400 hover:text-slate-600 cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateDriverSubmit} className="p-6 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom complet</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Téléphone</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville</label>
                  <select
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  >
                    {cities.map(c => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Véhicule</label>
                  <input
                    type="text"
                    value={vehicle}
                    onChange={e => setVehicle(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Matricule</label>
                  <input
                    type="text"
                    value={plate}
                    onChange={e => setPlate(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Numéro CIN</label>
                  <input
                    type="text"
                    value={driverCin}
                    onChange={e => setDriverCin(e.target.value)}
                    placeholder="Ex: BK123456"
                    className="w-full text-xs font-mono uppercase bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              {/* Photo de profil & CIN dans le modal d'édition */}
              <div className="bg-slate-50/90 p-3 rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center gap-1.5">
                  <CreditCard className="w-4 h-4 text-red-600" />
                  <span className="text-xs font-black text-slate-900 uppercase tracking-wide">
                    Photo de Profil & Carte Nationale (CIN)
                  </span>
                </div>

                <KycPhotoUpload
                  lang="fr"
                  variant="portrait"
                  captureMode="user"
                  label="Photo du profil du livreur"
                  value={driverProfilePhoto}
                  onChange={setDriverProfilePhoto}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <KycPhotoUpload
                    lang="fr"
                    variant="id_card"
                    captureMode="environment"
                    label="Carte Nationale (Recto)"
                    value={driverCinPhoto}
                    onChange={setDriverCinPhoto}
                  />
                  <KycPhotoUpload
                    lang="fr"
                    variant="id_card"
                    captureMode="environment"
                    label="Carte Nationale (Verso)"
                    value={driverCinBackPhoto}
                    onChange={setDriverCinBackPhoto}
                  />
                </div>
              </div>

              {/* Rémunération dans le modal d'édition */}
              <div className="pt-3 border-t border-slate-200 space-y-3 bg-amber-50/60 p-3 rounded-xl border border-amber-200">
                <div className="flex items-center gap-1.5">
                  <Coins className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-black text-amber-950 uppercase tracking-wide">
                    Barème de Rémunération du Livreur
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Commission par colis (MAD) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={feePerDelivery}
                      onChange={e => setFeePerDelivery(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Forfait / Fixe (MAD)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={fixedSalary}
                      onChange={e => setFixedSalary(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950 focus:ring-2 focus:ring-amber-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Mode de calcul</label>
                    <select
                      value={salaryType}
                      onChange={e => setSalaryType(e.target.value as any)}
                      className="w-full text-xs bg-white border border-amber-300 rounded-xl px-2.5 py-2 text-slate-900"
                    >
                      <option value="per_package">À la commission par colis</option>
                      <option value="fixed_plus_package">Fixe + Commission</option>
                      <option value="monthly_fixed">Salaire fixe forfaitaire</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">Prime ramassage (MAD)</label>
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={pickupFee}
                      onChange={e => setPickupFee(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-xl px-3 py-2 text-amber-950"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingDriver(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED MODAL: ÉDITER LE REVENU & RÉMUNÉRATION DU LIVREUR */}
      {editingRevenueDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-amber-100 bg-gradient-to-r from-amber-500 to-orange-500 text-white">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/20 rounded-xl backdrop-blur-xs">
                  <Coins className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">
                    Éditer le Revenu du Livreur
                  </h3>
                  <p className="text-xs text-amber-100">
                    {editingRevenueDriver.name} ({editingRevenueDriver.city}) — Rémunération & Commissions
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingRevenueDriver(null)}
                className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRevenueModal} className="p-6 space-y-4">
              <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
                Ce barème détermine les gains personnels du livreur. Chaque fois qu'il livre un colis avec succès, son revenu est automatiquement calculé et synchronisé en temps réel sur son tableau de bord et son application Android.
              </div>

              {/* Mode de calcul */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  Structure / Mode de Rémunération *
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setRevenueSalaryType('per_package')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      revenueSalaryType === 'per_package'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">À la commission</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">X MAD / colis livré</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevenueSalaryType('fixed_plus_package')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      revenueSalaryType === 'fixed_plus_package'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">Fixe + Commission</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Forfait + variable</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRevenueSalaryType('monthly_fixed')}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      revenueSalaryType === 'monthly_fixed'
                        ? 'border-amber-500 bg-amber-50 font-bold text-amber-950 ring-2 ring-amber-500/20'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span className="block text-[11px] font-bold">Fixe forfaitaire</span>
                    <span className="block text-[10px] text-slate-500 mt-0.5">Salaire mensuel/jour</span>
                  </button>
                </div>
              </div>

              {/* Tarif par colis et fixe */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Tarif par Colis Livré (MAD) *
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      required
                      min="0"
                      step="0.5"
                      value={revenueFeePerDelivery}
                      onChange={e => setRevenueFeePerDelivery(parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-12 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      MAD
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Généralement 8 à 15 MAD au Maroc
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Forfait Fixe Journalier / Base (MAD)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="1"
                      value={revenueFixedSalary}
                      onChange={e => setRevenueFixedSalary(parseFloat(e.target.value) || 0)}
                      className="w-full text-sm font-mono font-black bg-slate-50 border border-slate-300 rounded-xl pl-3 pr-12 py-2.5 text-slate-900 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:outline-hidden"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                      MAD
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-500 mt-1 block">
                    Optionnel (indemnité ou fixe)
                  </span>
                </div>
              </div>

              {/* Primes additionnelles */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prime Ramassage
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="0.5"
                      value={revenuePickupFee}
                      onChange={e => setRevenuePickupFee(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl pl-2.5 pr-8 py-2 text-slate-900"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      MAD
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Seuil Bonus Colis
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={revenueBonusThreshold}
                    onChange={e => setRevenueBonusThreshold(parseInt(e.target.value) || 0)}
                    placeholder="25"
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Prime Performance
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      step="5"
                      value={revenueBonusAmount}
                      onChange={e => setRevenueBonusAmount(parseFloat(e.target.value) || 0)}
                      className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl pl-2.5 pr-8 py-2 text-slate-900"
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                      MAD
                    </span>
                  </div>
                </div>
              </div>

              {/* SIMULATEUR EN DIRECT */}
              <div className="p-3 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1">
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Simulateur de Gains en Direct</span>
                  </span>
                  <span className="text-[10px] text-slate-400">Hypothèse : 25 livraisons / jour</span>
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-slate-300 text-[11px]">
                    25 colis × {revenueFeePerDelivery} MAD {revenueSalaryType !== 'per_package' ? `+ ${revenueFixedSalary} MAD fixe` : ''} {25 >= revenueBonusThreshold ? `+ ${revenueBonusAmount} MAD bonus` : ''} :
                  </span>
                  <span className="font-mono font-black text-emerald-400 text-base">
                    {formatMAD(
                      (revenueSalaryType === 'monthly_fixed'
                        ? revenueFixedSalary
                        : (25 * revenueFeePerDelivery) + (revenueSalaryType === 'fixed_plus_package' ? revenueFixedSalary : 0)) +
                      (25 >= revenueBonusThreshold ? revenueBonusAmount : 0)
                    )}
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingRevenueDriver(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-black text-slate-950 bg-amber-400 hover:bg-amber-300 rounded-xl shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  <Coins className="w-4 h-4 text-slate-950" />
                  <span>Enregistrer le Barème de Revenu</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DEDICATED MODAL: FICHE DE DÉCOMPTE & REÇU DE PAIE DU LIVREUR */}
      {settlementDriver && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <Receipt className="w-5 h-5 text-amber-600" />
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Décompte de Rémunération — {settlementDriver.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Bordereau de paie & justification des gains de tournée
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSettlementDriver(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs">
              {/* Header Info */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Livreur</span>
                  <span className="font-bold text-slate-900">{settlementDriver.name}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Téléphone</span>
                  <span className="font-mono text-slate-800">{settlementDriver.phone}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Zone / Ville</span>
                  <span className="font-bold text-red-600">{settlementDriver.city}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-bold block uppercase">Date d'édition</span>
                  <span className="font-mono text-slate-700">{new Date().toLocaleDateString('fr-FR')}</span>
                </div>
              </div>

              {/* Delivery Details */}
              {(() => {
                const assigned = packages.filter(p => p.driverId === settlementDriver.id);
                const delivered = assigned.filter(p => p.status === 'livre');
                const cashCollected = delivered.reduce((acc, p) => acc + (p.codAmount || 0), 0);
                const fee = settlementDriver.driverFeePerDelivery ?? 10;
                const fixed = settlementDriver.driverFixedSalary ?? 0;
                const salaryType = settlementDriver.driverSalaryType ?? 'per_package';

                let baseCommission = delivered.length * fee;
                if (salaryType === 'monthly_fixed') baseCommission = 0;
                const bonusEarned = (settlementDriver.driverBonusThreshold && delivered.length >= settlementDriver.driverBonusThreshold)
                  ? (settlementDriver.driverBonusAmount || 0)
                  : 0;

                const totalDriverEarnings = (salaryType === 'monthly_fixed' ? fixed : baseCommission + fixed) + bonusEarned;

                return (
                  <div className="space-y-4">
                    {/* Financial Summary */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* Box 1: Driver Earnings */}
                      <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-xl space-y-2">
                        <span className="text-[11px] font-black text-amber-900 uppercase tracking-wide flex items-center gap-1.5">
                          <Coins className="w-4 h-4 text-amber-600" />
                          <span>Revenu Net Livreur à Payer</span>
                        </span>
                        <div className="text-2xl font-black font-mono text-amber-950">
                          {formatMAD(totalDriverEarnings)}
                        </div>
                        <div className="text-[11px] text-amber-800 space-y-0.5 pt-1 border-t border-amber-200">
                          <div className="flex justify-between">
                            <span>Commissions livraisons ({delivered.length} × {fee} MAD) :</span>
                            <span className="font-mono font-bold">{formatMAD(baseCommission)}</span>
                          </div>
                          {fixed > 0 && (
                            <div className="flex justify-between">
                              <span>Forfait / Fixe :</span>
                              <span className="font-mono font-bold">{formatMAD(fixed)}</span>
                            </div>
                          )}
                          {bonusEarned > 0 && (
                            <div className="flex justify-between text-emerald-700 font-bold">
                              <span>Prime de performance :</span>
                              <span className="font-mono">+{formatMAD(bonusEarned)}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Box 2: Agency COD Collection */}
                      <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
                        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide flex items-center gap-1.5">
                          <Wallet className="w-4 h-4 text-emerald-400" />
                          <span>Cash COD Encaissé (Agence)</span>
                        </span>
                        <div className="text-2xl font-black font-mono text-emerald-400">
                          {formatMAD(cashCollected)}
                        </div>
                        <div className="text-[11px] text-slate-400 space-y-0.5 pt-1 border-t border-slate-800">
                          <div className="flex justify-between">
                            <span>Nombre de colis encaissés :</span>
                            <span className="font-mono font-bold text-white">{delivered.length} colis</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Solde restant après déduction :</span>
                            <span className="font-mono font-bold text-white">
                              {formatMAD(Math.max(0, cashCollected - totalDriverEarnings))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Table of Delivered Parcels */}
                    <div>
                      <h4 className="font-bold text-slate-800 mb-2">Colis Livrés & Commissions Associées</h4>
                      <div className="border border-slate-200 rounded-xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">N° Suivi</th>
                              <th className="py-2 px-3">Destinataire</th>
                              <th className="py-2 px-3 text-right">Cash COD</th>
                              <th className="py-2 px-3 text-right">Commission Livreur</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {delivered.map(p => (
                              <tr key={p.id} className="hover:bg-slate-50">
                                <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.trackingNumber}</td>
                                <td className="py-2 px-3 text-slate-700">{p.recipientName} ({p.city})</td>
                                <td className="py-2 px-3 text-right font-mono font-bold">{formatMAD(p.codAmount)}</td>
                                <td className="py-2 px-3 text-right font-mono font-bold text-amber-700">
                                  +{formatMAD(fee)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
              <button
                onClick={() => handleOpenRevenueModal(settlementDriver)}
                className="px-3.5 py-2 text-xs font-bold text-amber-900 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Modifier le Barème</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimer Décompte</span>
                </button>
                <button
                  onClick={() => {
                    const driverName = settlementDriver.name;
                    setSettlementDriver(null);
                    showDriverToast(`Paiement de la rémunération du livreur ${driverName} clôturé.`, 'success');
                  }}
                  className="px-4 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Valider Règlement Livreur
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Cash Settlement Confirmation Modal */}
      {cashSettlementConfirm && (
        <ConfirmActionModal
          isOpen={true}
          title="Validation d'Encaissement Cash"
          message={`Confirmez-vous la réception de ${formatMAD(cashSettlementConfirm.amount)} versée par ${cashSettlementConfirm.driver.name} en agence ?`}
          confirmLabel="Valider l'encaissement"
          onConfirm={confirmSettleDriverCash}
          onCancel={() => setCashSettlementConfirm(null)}
        />
      )}

      {/* Unassign Parcel From Driver Confirmation Modal */}
      {packageToUnassign && (
        <ConfirmActionModal
          isOpen={true}
          title="حذف الكوليا من الليفرور"
          message={`هل أنت متأكد من حذف الكوليا ${packageToUnassign.pkg.trackingNumber} (${packageToUnassign.pkg.recipientName}) من الليفرور ${packageToUnassign.driver.name}؟ غادي ترجع للسطوك وتولي متاحة لتعيينها لليفرور آخر.`}
          confirmLabel="تأكيد الحذف من الليفرور"
          isDestructive={true}
          requireReason={false}
          onConfirm={async () => {
            const target = packageToUnassign;
            setPackageToUnassign(null);
            setIsUnassigningPackage(true);
            try {
              await assignPackageToDriver(
                target.pkg.id,
                null,
                undefined,
                true,
                currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
              );
            } finally {
              setIsUnassigningPackage(false);
            }
          }}
          onCancel={() => setPackageToUnassign(null)}
        />
      )}

      {/* Delete / Deactivate Driver Confirmation Modal */}
      {driverToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title={`Suppression / Désactivation du Livreur`}
          message={`Êtes-vous sûr de vouloir retirer le livreur ${driverToDelete.name} ? Ses livraisons historiques resteront archivées dans la base de données.`}
          confirmLabel="Confirmer la suppression"
          isDestructive={true}
          requireReason={true}
          onConfirm={handleConfirmDeleteDriver}
          onCancel={() => setDriverToDelete(null)}
        />
      )}
      {/* Lightbox Photo Preview Modal */}
      {previewDriverPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4 no-print"
          onClick={() => setPreviewDriverPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="text-xs sm:text-sm font-bold truncate">{previewDriverPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewDriverPhoto(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/40 max-h-[80vh]">
              <img
                src={previewDriverPhoto.src}
                alt={previewDriverPhoto.title}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Driver APK Export Modal */}
      <DriverApkExportModal
        isOpen={showDriverApkModal}
        onClose={() => setShowDriverApkModal(false)}
        onOpenDriverView={() => {
          window.location.href = '/?app=driver';
        }}
      />
    </div>
  );
};
