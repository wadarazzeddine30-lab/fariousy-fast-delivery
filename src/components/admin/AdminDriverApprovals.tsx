import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { DriverRegistrationRequest, DriverVehicleType } from '../../types';
import { formatDate } from '../../utils/barcode';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  Truck,
  UserCheck,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Phone,
  Mail,
  Shield,
  FileText,
  AlertCircle,
  Eye,
  Check,
  X,
  Trash2,
  Bike,
  Car,
  ChevronRight,
  ExternalLink,
  MessageCircle,
  Calendar,
  CreditCard,
  ZoomIn
} from 'lucide-react';

export const AdminDriverApprovals: React.FC = () => {
  const {
    driverRequests,
    cities,
    approveDriverRegistration,
    rejectDriverRegistration,
    deleteDriverRegistrationRequest
  } = useDatabase();

  const { t, language, isRtl } = useLanguage();

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'en_attente' | 'approuve' | 'refuse'>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [vehicleFilter, setVehicleFilter] = useState<string>('all');

  // Modals state
  const [selectedRequest, setSelectedRequest] = useState<DriverRegistrationRequest | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<DriverRegistrationRequest | null>(null);
  const [rejectingRequest, setRejectingRequest] = useState<DriverRegistrationRequest | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectionError, setRejectionError] = useState<string | null>(null);
  const [requestToDelete, setRequestToDelete] = useState<DriverRegistrationRequest | null>(null);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);
  const [previewPhoto, setPreviewPhoto] = useState<{ src: string; title: string } | null>(null);

  // Quick stats
  const totalRequests = driverRequests.length;
  const pendingRequests = driverRequests.filter(r => r.status === 'en_attente').length;
  const approvedRequests = driverRequests.filter(r => r.status === 'approuve').length;
  const rejectedRequests = driverRequests.filter(r => r.status === 'refuse').length;

  // Filtered list
  const filteredRequests = useMemo(() => {
    return driverRequests.filter(req => {
      const matchSearch =
        req.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        req.phone.includes(searchTerm) ||
        req.cinNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (req.driverPlate && req.driverPlate.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || req.status === statusFilter;
      const matchCity = cityFilter === 'all' || req.city === cityFilter;
      const matchVehicle = vehicleFilter === 'all' || req.vehicleType === vehicleFilter;

      return matchSearch && matchStatus && matchCity && matchVehicle;
    });
  }, [driverRequests, searchTerm, statusFilter, cityFilter, vehicleFilter]);

  // Handle Approve
  const handleConfirmApprove = () => {
    if (!approvingRequest) return;
    const res = approveDriverRegistration(approvingRequest.id, 'Direction FARIOUSY');
    if (res.success) {
      setActionSuccessMsg(res.message || 'Livreur approuvé avec succès.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      setApprovingRequest(null);
      if (selectedRequest?.id === approvingRequest.id) {
        setSelectedRequest(null);
      }
    }
  };

  // Handle Reject
  const handleConfirmReject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;
    if (!rejectionReason.trim()) {
      setRejectionError('Veuillez indiquer un motif de refus obligatoire.');
      return;
    }

    const res = rejectDriverRegistration(rejectingRequest.id, rejectionReason.trim(), 'Direction FARIOUSY');
    if (res.success) {
      setActionSuccessMsg(res.message || 'Demande refusée.');
      setTimeout(() => setActionSuccessMsg(null), 4000);
      setRejectingRequest(null);
      setRejectionReason('');
      setRejectionError(null);
      if (selectedRequest?.id === rejectingRequest.id) {
        setSelectedRequest(null);
      }
    }
  };

  // Handle Delete
  const handleConfirmDelete = () => {
    if (!requestToDelete) return;
    deleteDriverRegistrationRequest(requestToDelete.id);
    setRequestToDelete(null);
    if (selectedRequest?.id === requestToDelete.id) {
      setSelectedRequest(null);
    }
  };

  const getVehicleBadge = (type: DriverVehicleType) => {
    switch (type) {
      case 'Moto':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-50 text-amber-800 border border-amber-200">
            🛵 Moto
          </span>
        );
      case 'Voiture':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-800 border border-blue-200">
            🚗 Voiture
          </span>
        );
      case 'Vélo':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
            🚲 Vélo
          </span>
        );
      case 'Fourgonnette':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-800 border border-purple-200">
            🚐 Fourgonnette
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-800 border border-slate-200">
            🚚 {type}
          </span>
        );
    }
  };

  const getStatusBadge = (status: DriverRegistrationRequest['status']) => {
    switch (status) {
      case 'en_attente':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200 animate-pulse">
            <Clock className="w-3.5 h-3.5" />
            {language === 'ar' ? 'قيد الانتظار' : language === 'en' ? 'Pending' : 'En attente'}
          </span>
        );
      case 'approuve':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {language === 'ar' ? 'مقبول ومفعّل' : language === 'en' ? 'Approved' : 'Approuvé'}
          </span>
        );
      case 'refuse':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <XCircle className="w-3.5 h-3.5" />
            {language === 'ar' ? 'مرفوض' : language === 'en' ? 'Rejected' : 'Refusé'}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Card */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-red-500 to-red-600 text-white flex items-center justify-center shadow-md shadow-red-200">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {language === 'ar'
                    ? 'تفعيل الموزعين الجدد'
                    : language === 'en'
                    ? 'New Drivers Validation'
                    : 'Validation Nouveaux Livreurs'}
                </h1>
                <p className="text-xs sm:text-sm text-slate-500">
                  {language === 'ar'
                    ? 'إدارة ومراجعة طلبات الترشح لمهنة موزع في فاروسي دليفري وتفعيل حساباتهم'
                    : language === 'en'
                    ? 'Review, verify, and approve courier applications for Fariousy Delivery'
                    : "Examen des candidatures, validation administrative et activation des accès livreurs"}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Notice Badge */}
          {pendingRequests > 0 && (
            <div className="inline-flex items-center gap-2 px-3.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping" />
              <span>
                {pendingRequests}{' '}
                {language === 'ar'
                  ? 'طلب انضمام في انتظار المراجعة'
                  : language === 'en'
                  ? 'applications awaiting review'
                  : 'candidatures en attente de validation'}
              </span>
            </div>
          )}
        </div>

        {/* Success toast notification */}
        {actionSuccessMsg && (
          <div className="mt-4 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{actionSuccessMsg}</span>
          </div>
        )}

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-6">
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-100 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-slate-500 font-medium block">
                {language === 'ar' ? 'إجمالي الطلبات' : language === 'en' ? 'Total Requests' : 'Total Demandes'}
              </span>
              <span className="text-xl font-black text-slate-900 force-ltr">{totalRequests}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-bold shadow-xs">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-amber-800 font-semibold block">
                {language === 'ar' ? 'قيد الانتظار' : language === 'en' ? 'Pending' : 'En Attente'}
              </span>
              <span className="text-xl font-black text-amber-900 force-ltr">{pendingRequests}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200/80 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-xs">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-emerald-800 font-semibold block">
                {language === 'ar' ? 'مقبول ومفعّل' : language === 'en' ? 'Approved' : 'Approuvés'}
              </span>
              <span className="text-xl font-black text-emerald-900 force-ltr">{approvedRequests}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-rose-50/70 border border-rose-200/80 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-bold shadow-xs">
              <XCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-rose-800 font-semibold block">
                {language === 'ar' ? 'مرفوض' : language === 'en' ? 'Rejected' : 'Refusés'}
              </span>
              <span className="text-xl font-black text-rose-900 force-ltr">{rejectedRequests}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-4">
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Status Tabs */}
          <div className="flex flex-wrap items-center bg-slate-100 p-1 rounded-xl text-xs font-bold">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {language === 'ar' ? 'جميع الطلبات' : language === 'en' ? 'All' : 'Toutes'} ({totalRequests})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('en_attente')}
              className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 ${
                statusFilter === 'en_attente'
                  ? 'bg-amber-500 text-white shadow-xs'
                  : 'text-amber-800 hover:text-amber-950'
              }`}
            >
              <span>{language === 'ar' ? 'قيد الانتظار' : language === 'en' ? 'Pending' : 'En attente'}</span>
              <span className="px-1.5 py-0.2 bg-white/25 rounded-md text-[10px] force-ltr">
                {pendingRequests}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('approuve')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'approuve'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-emerald-800 hover:text-emerald-950'
              }`}
            >
              {language === 'ar' ? 'المقبولين' : language === 'en' ? 'Approved' : 'Approuvés'} ({approvedRequests})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('refuse')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                statusFilter === 'refuse'
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'text-rose-800 hover:text-rose-950'
              }`}
            >
              {language === 'ar' ? 'المرفوضين' : language === 'en' ? 'Rejected' : 'Refusés'} ({rejectedRequests})
            </button>
          </div>

          {/* Search & dropdown filters */}
          <div className="flex flex-col sm:flex-row items-center gap-2">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className={`w-4 h-4 text-slate-400 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2`} />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={
                  language === 'ar'
                    ? 'بحث بالاسم، رقم الهاتف، CIN...'
                    : language === 'en'
                    ? 'Search name, phone, CIN...'
                    : 'Rechercher par nom, tél, CIN...'
                }
                className={`w-full ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:bg-white`}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className={`absolute ${isRtl ? 'left-2.5' : 'right-2.5'} top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={e => setCityFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">{language === 'ar' ? 'جميع المدن' : language === 'en' ? 'All Cities' : 'Toutes les villes'}</option>
              {cities.map(c => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>

            {/* Vehicle Filter */}
            <select
              value={vehicleFilter}
              onChange={e => setVehicleFilter(e.target.value)}
              className="w-full sm:w-auto px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">{language === 'ar' ? 'جميع المركبات' : language === 'en' ? 'All Vehicles' : 'Tous véhicules'}</option>
              <option value="Moto">🛵 Moto</option>
              <option value="Voiture">🚗 Voiture</option>
              <option value="Vélo">🚲 Vélo</option>
              <option value="Fourgonnette">🚐 Fourgonnette</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main List / Cards */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 overflow-hidden">
        {filteredRequests.length === 0 ? (
          <div className="py-16 text-center text-slate-400">
            <Truck className="w-12 h-12 mx-auto stroke-[1.5] mb-3 opacity-40 text-slate-400" />
            <p className="text-base font-bold text-slate-700">
              {language === 'ar' ? 'لا توجد طلبات مطابقة' : language === 'en' ? 'No applications match criteria' : 'Aucune candidature trouvée'}
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {language === 'ar'
                ? 'جرب تغيير معايير البحث أو الفلترة'
                : language === 'en'
                ? 'Try adjusting your search query or filters'
                : 'Essayez de modifier vos filtres ou termes de recherche'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredRequests.map(req => (
              <div
                key={req.id}
                className="p-4 sm:p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                {/* Candidate Info */}
                <div className="flex items-start gap-3.5">
                  {req.driverPhotoUrl ? (
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto({ src: req.driverPhotoUrl!, title: `صورة السائق — ${req.fullName}` })}
                      className="w-11 h-11 rounded-2xl overflow-hidden shrink-0 border border-slate-300 shadow-xs cursor-pointer hover:ring-2 hover:ring-red-500 transition-all"
                      title="عرض الصورة الشخصية"
                    >
                      <img src={req.driverPhotoUrl} alt={req.fullName} className="w-full h-full object-cover" />
                    </button>
                  ) : (
                    <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-slate-100 to-slate-200 text-slate-700 flex items-center justify-center font-black text-sm shrink-0 border border-slate-300/60 shadow-xs">
                      {req.fullName
                        .split(' ')
                        .map(p => p[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </div>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-slate-900 text-sm sm:text-base">
                        {req.fullName}
                      </span>
                      {getStatusBadge(req.status)}
                      {getVehicleBadge(req.vehicleType)}
                    </div>

                    <div className="flex flex-wrap items-center gap-y-1 gap-x-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        <strong className="text-slate-700">{req.city}</strong> — {req.address}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-600 force-ltr">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {req.phone}
                      </span>
                      <span className="flex items-center gap-1">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        {req.email}
                      </span>
                      <span className="flex items-center gap-1 font-mono text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md font-bold">
                        <Shield className="w-3 h-3 text-slate-500" />
                        CIN: {req.cinNumber}
                      </span>
                      {req.cinPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => setPreviewPhoto({ src: req.cinPhotoUrl!, title: `CIN — ${req.fullName}` })}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold text-[11px] hover:bg-emerald-100 cursor-pointer"
                        >
                          <CreditCard className="w-3 h-3" />
                          <span>صورة CIN ✓</span>
                        </button>
                      )}
                    </div>

                    {req.driverPlate && (
                      <div className="text-xs text-slate-500 flex items-center gap-2 pt-0.5">
                        <span className="font-semibold text-slate-600">
                          {language === 'ar' ? 'الترقيم :' : language === 'en' ? 'Plate:' : 'Immatriculation :'}
                        </span>
                        <span className="font-mono bg-amber-50 text-amber-900 px-2 py-0.5 rounded border border-amber-200 font-bold force-ltr">
                          {req.driverPlate}
                        </span>
                      </div>
                    )}

                    {req.rejectionReason && req.status === 'refuse' && (
                      <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-800 mt-1 flex items-start gap-1.5">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                        <span>
                          <strong>{language === 'ar' ? 'سبب الرفض :' : language === 'en' ? 'Rejection Reason:' : 'Motif du refus :'}</strong>{' '}
                          {req.rejectionReason}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Date & Action Buttons */}
                <div className="flex flex-wrap items-center justify-between lg:justify-end gap-2.5 pt-2 lg:pt-0 border-t lg:border-t-0 border-slate-100">
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {req.submittedAt ? formatDate(req.submittedAt) : 'Récemment'}
                  </span>

                  <div className="flex items-center gap-1.5">
                    {/* View Details */}
                    <button
                      type="button"
                      onClick={() => setSelectedRequest(req)}
                      className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      title="Voir le dossier complet"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>{language === 'ar' ? 'تفاصيل' : language === 'en' ? 'Details' : 'Détails'}</span>
                    </button>

                    {/* Approve Button */}
                    {req.status !== 'approuve' && (
                      <button
                        type="button"
                        onClick={() => setApprovingRequest(req)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'قبول وتفعيل' : language === 'en' ? 'Approve' : 'Approuver'}</span>
                      </button>
                    )}

                    {/* Reject Button */}
                    {req.status !== 'refuse' && (
                      <button
                        type="button"
                        onClick={() => {
                          setRejectingRequest(req);
                          setRejectionReason('');
                          setRejectionError(null);
                        }}
                        className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                      >
                        <X className="w-3.5 h-3.5" />
                        <span>{language === 'ar' ? 'رفض' : language === 'en' ? 'Reject' : 'Refuser'}</span>
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      type="button"
                      onClick={() => setRequestToDelete(req)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer la demande"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ================= MODAL 1: CANDIDATE DETAIL DOSSIER ================= */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="p-5 sm:p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg">
                    {language === 'ar' ? 'ملف ترشح موزع' : language === 'en' ? 'Driver Application File' : 'Fiche Candidat Livreur'}
                  </h3>
                  <span className="text-xs text-slate-300 font-mono">
                    N° Dossier: {selectedRequest.id}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedRequest(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 sm:p-6 space-y-4 max-h-[75vh] overflow-y-auto text-xs sm:text-sm">
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="font-semibold text-slate-600">{language === 'ar' ? 'الحالة الحالية :' : 'Statut actuel :'}</span>
                {getStatusBadge(selectedRequest.status)}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'الاسم الكامل' : 'Nom complet'}</span>
                  <span className="font-bold text-slate-900 text-sm mt-0.5 block">{selectedRequest.fullName}</span>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'رقم البطاقة الوطنية (CIN)' : 'Numéro CIN'}</span>
                  <span className="font-mono font-bold text-slate-900 text-sm mt-0.5 block">{selectedRequest.cinNumber}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'رقم الهاتف' : 'Téléphone'}</span>
                  <a href={`tel:${selectedRequest.phone}`} className="font-mono font-bold text-red-600 hover:underline text-sm mt-0.5 block force-ltr">
                    {selectedRequest.phone}
                  </a>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'البريد الإلكتروني' : 'E-mail'}</span>
                  <a href={`mailto:${selectedRequest.email}`} className="font-medium text-slate-900 hover:underline text-xs mt-0.5 block truncate">
                    {selectedRequest.email}
                  </a>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'المدينة والعنوان' : 'Ville & Adresse'}</span>
                <span className="font-bold text-slate-800 text-sm mt-0.5 block">
                  {selectedRequest.city} — {selectedRequest.address}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'نوع المركبة' : 'Véhicule'}</span>
                  <div className="mt-1">{getVehicleBadge(selectedRequest.vehicleType)}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'رقم الترقيم' : 'Immatriculation'}</span>
                  <span className="font-mono font-bold text-slate-900 text-xs mt-1 block force-ltr">
                    {selectedRequest.driverPlate || 'Non applicable (Vélo)'}
                  </span>
                </div>
              </div>

              {selectedRequest.notes && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                  <span className="text-xs text-slate-500 font-medium block">{language === 'ar' ? 'ملاحظات' : 'Remarques'}</span>
                  <p className="text-xs text-slate-700 mt-0.5 italic">{selectedRequest.notes}</p>
                </div>
              )}

              {selectedRequest.rejectionReason && selectedRequest.status === 'refuse' && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200">
                  <span className="text-xs font-bold text-rose-800 block">{language === 'ar' ? 'سبب الرفض المسجل :' : 'Motif du refus enregistré :'}</span>
                  <p className="text-xs text-rose-900 mt-1 font-semibold">{selectedRequest.rejectionReason}</p>
                </div>
              )}

              {/* Documents & Justificatifs : Photo du livreur + CIN */}
              {(selectedRequest.driverPhotoUrl || selectedRequest.cinPhotoUrl || selectedRequest.cinBackPhotoUrl) && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <CreditCard className="w-4 h-4 text-red-600" />
                    <span>
                      {language === 'ar'
                        ? 'الوثائق والصور المرفقة (الصورة الشخصية + البطاقة الوطنية)'
                        : 'Documents & Photos (Photo personnelle + CIN)'}
                    </span>
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {selectedRequest.driverPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            src: selectedRequest.driverPhotoUrl!,
                            title: `الصورة الشخصية — ${selectedRequest.fullName}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square cursor-pointer"
                      >
                        <img
                          src={selectedRequest.driverPhotoUrl}
                          alt="Photo livreur"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
                          <span>الصورة الشخصية</span>
                          <ZoomIn className="w-3 h-3" />
                        </div>
                      </button>
                    )}

                    {selectedRequest.cinPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            src: selectedRequest.cinPhotoUrl!,
                            title: `CIN Recto (${selectedRequest.cinNumber}) — ${selectedRequest.fullName}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square cursor-pointer"
                      >
                        <img
                          src={selectedRequest.cinPhotoUrl}
                          alt="CIN Recto"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
                          <span>CIN (الأمام)</span>
                          <ZoomIn className="w-3 h-3" />
                        </div>
                      </button>
                    )}

                    {selectedRequest.cinBackPhotoUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setPreviewPhoto({
                            src: selectedRequest.cinBackPhotoUrl!,
                            title: `CIN Verso (${selectedRequest.cinNumber}) — ${selectedRequest.fullName}`
                          })
                        }
                        className="group relative rounded-xl overflow-hidden border border-slate-200 bg-white aspect-square cursor-pointer"
                      >
                        <img
                          src={selectedRequest.cinBackPhotoUrl}
                          alt="CIN Verso"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                        <div className="absolute inset-x-0 bottom-0 bg-black/65 text-white text-[10px] font-bold px-2 py-1 flex items-center justify-between">
                          <span>CIN (الخلف)</span>
                          <ZoomIn className="w-3 h-3" />
                        </div>
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons in Modal */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
                {selectedRequest.status !== 'approuve' && (
                  <button
                    type="button"
                    onClick={() => {
                      setApprovingRequest(selectedRequest);
                    }}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    <span>{language === 'ar' ? 'قبول وتفعيل الحساب' : 'Approuver le livreur'}</span>
                  </button>
                )}

                {selectedRequest.status !== 'refuse' && (
                  <button
                    type="button"
                    onClick={() => {
                      setRejectingRequest(selectedRequest);
                      setRejectionReason('');
                      setRejectionError(null);
                    }}
                    className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                    <span>{language === 'ar' ? 'رفض الطلب' : 'Refuser la demande'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: CONFIRM APPROVAL ================= */}
      {approvingRequest && (
        <ConfirmActionModal
          isOpen={true}
          onClose={() => setApprovingRequest(null)}
          onConfirm={handleConfirmApprove}
          title={
            language === 'ar'
              ? `تأكيد تفعيل حساب الموزع : ${approvingRequest.fullName}`
              : `Confirmer la validation du livreur : ${approvingRequest.fullName}`
          }
          message={
            language === 'ar'
              ? `عند الموافقة، سيتم تفعيل حساب ${approvingRequest.fullName} تلقائياً، وإضافته في "إدارة الموزعين"، وتمكينه من تسجيل الدخول إلى "تطبيق الموزع" لنقل الشحنات.`
              : `En validant cette candidature, le compte de ${approvingRequest.fullName} sera automatiquement activé avec le rôle Livreur, ajouté dans « Gestion des Livreurs » et son accès à l'application Livreur sera débloqué.`
          }
          confirmLabel={language === 'ar' ? 'تأكيد التفعيل' : 'Activer le livreur'}
          isDestructive={false}
        />
      )}

      {/* ================= MODAL 3: REJECT WITH MANDATORY REASON ================= */}
      {rejectingRequest && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl overflow-hidden border border-slate-100 animate-scaleUp">
            <div className="p-5 bg-rose-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-5 h-5" />
                <h3 className="font-bold text-base">
                  {language === 'ar' ? 'رفض طلب الانضمام' : 'Refuser la candidature'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setRejectingRequest(null)}
                className="w-7 h-7 rounded-full bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReject} className="p-5 space-y-4">
              <p className="text-xs text-slate-600">
                Vous êtes sur le point de refuser la candidature de{' '}
                <strong className="text-slate-900">{rejectingRequest.fullName}</strong> ({rejectingRequest.city}). Veuillez spécifier un motif clair.
              </p>

              {rejectionError && (
                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{rejectionError}</span>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {language === 'ar' ? 'سبب الرفض (إلزامي)' : 'Motif obligatoire du refus'}
                </label>
                <textarea
                  required
                  rows={3}
                  value={rejectionReason}
                  onChange={e => {
                    setRejectionReason(e.target.value);
                    if (rejectionError) setRejectionError(null);
                  }}
                  placeholder="Ex : Documents CIN ou permis non conformes, zone de livraison actuellement pourvue, véhicule inadapté..."
                  className="w-full p-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setRejectingRequest(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {language === 'ar' ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {language === 'ar' ? 'تأكيد الرفض' : 'Confirmer le refus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 4: CONFIRM DELETE ================= */}
      {requestToDelete && (
        <ConfirmActionModal
          isOpen={true}
          onClose={() => setRequestToDelete(null)}
          onConfirm={handleConfirmDelete}
          title="Supprimer la candidature"
          message={`Êtes-vous sûr de vouloir supprimer définitivement la candidature de ${requestToDelete.fullName} ? Cette action est irréversible.`}
          confirmLabel="Supprimer définitivement"
          isDestructive={true}
        />
      )}
      {/* ================= MODAL 5: LIGHTBOX PHOTO PREVIEW ================= */}
      {previewPhoto && (
        <div
          className="fixed inset-0 z-[70] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setPreviewPhoto(null)}
        >
          <div
            className="relative max-w-2xl w-full bg-slate-900 rounded-2xl overflow-hidden shadow-2xl border border-slate-700"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 text-white">
              <span className="text-xs sm:text-sm font-bold truncate">{previewPhoto.title}</span>
              <button
                type="button"
                onClick={() => setPreviewPhoto(null)}
                className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 flex items-center justify-center bg-black/40 max-h-[80vh]">
              <img
                src={previewPhoto.src}
                alt={previewPhoto.title}
                className="max-h-[72vh] w-auto object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
