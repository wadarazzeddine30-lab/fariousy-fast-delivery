import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { Agency, AgencyType, PackageItem, PACKAGE_STATUS_CONFIG } from '../../types';
import {
  Building2,
  Warehouse,
  Plus,
  Search,
  Trash2,
  Edit3,
  UserCheck,
  Phone,
  Mail,
  MapPin,
  Boxes,
  ShieldAlert,
  CheckCircle2,
  XCircle,
  Truck,
  Users,
  AlertTriangle,
  Layers,
  X,
  ExternalLink,
  ChevronRight,
  Info,
  Scan
} from 'lucide-react';

interface AdminHubsProps {
  onViewPackage?: (pkg: PackageItem) => void;
  onOpenAgencyScanner?: (agencyName: string) => void;
}

export const AdminHubs: React.FC<AdminHubsProps> = ({ onViewPackage, onOpenAgencyScanner }) => {
  const { agencies, addAgency, updateAgency, deleteAgency, packages, users, cities } = useDatabase();
  const { currentUser } = useAuth();

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('all');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingAgency, setEditingAgency] = useState<Agency | null>(null);
  const [agencyToDelete, setAgencyToDelete] = useState<Agency | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [inspectingHubPackages, setInspectingHubPackages] = useState<Agency | null>(null);
  const [quickManagerModalAgency, setQuickManagerModalAgency] = useState<Agency | null>(null);

  // Form State for Add / Edit
  const [formData, setFormData] = useState({
    name: '',
    city: 'Laâyoune',
    type: 'agence_regionale' as AgencyType,
    address: '',
    phone: '',
    email: '',
    managerName: '',
    managerPhone: '',
    managerEmail: '',
    storageCapacity: 3000,
    active: true,
    notes: ''
  });

  // Quick manager update state
  const [quickManagerData, setQuickManagerData] = useState({
    managerName: '',
    managerPhone: '',
    managerEmail: '',
    selectedEmployeeId: ''
  });

  // Calculate stats
  const stats = useMemo(() => {
    const totalHubs = agencies.length;
    const activeHubs = agencies.filter(a => a.active !== false).length;
    const totalCapacity = agencies.reduce((acc, a) => acc + (a.storageCapacity || 0), 0);

    // Active packages currently in any hub
    const hubActivePackages = packages.filter(
      p => p.status !== 'livre' && p.status !== 'retourne' && p.status !== 'annule'
    );

    return {
      totalHubs,
      activeHubs,
      totalCapacity,
      activePackagesCount: hubActivePackages.length
    };
  }, [agencies, packages]);

  // Map of active packages per agency
  const packagesPerAgency = useMemo(() => {
    const map: Record<string, PackageItem[]> = {};
    agencies.forEach(a => {
      map[a.name.toLowerCase()] = [];
    });

    packages.forEach(p => {
      if (p.status !== 'livre' && p.status !== 'retourne' && p.status !== 'annule' && p.currentAgency) {
        const key = p.currentAgency.toLowerCase();
        if (!map[key]) map[key] = [];
        map[key].push(p);
      }
    });

    return map;
  }, [agencies, packages]);

  // Map of staff / drivers attached to each agency
  const staffPerAgency = useMemo(() => {
    const map: Record<string, number> = {};
    agencies.forEach(a => {
      map[a.id] = 0;
    });

    users.forEach(u => {
      if (u.agencyId && map[u.agencyId] !== undefined) {
        map[u.agencyId]++;
      }
    });

    return map;
  }, [agencies, users]);

  // Filtered agencies
  const filteredAgencies = useMemo(() => {
    return agencies.filter(agency => {
      const matchesSearch =
        agency.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agency.city.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agency.managerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        agency.phone?.includes(searchTerm) ||
        agency.address?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesType =
        selectedTypeFilter === 'all' || agency.type === selectedTypeFilter;

      const matchesStatus =
        selectedStatusFilter === 'all' ||
        (selectedStatusFilter === 'active' && agency.active !== false) ||
        (selectedStatusFilter === 'inactive' && agency.active === false);

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [agencies, searchTerm, selectedTypeFilter, selectedStatusFilter]);

  // Open Add Modal
  const handleOpenAdd = () => {
    setFormData({
      name: '',
      city: cities[0]?.name || 'Laâyoune',
      type: 'agence_regionale',
      address: '',
      phone: '',
      email: '',
      managerName: '',
      managerPhone: '',
      managerEmail: '',
      storageCapacity: 3000,
      active: true,
      notes: ''
    });
    setIsAddModalOpen(true);
  };

  // Open Edit Modal
  const handleOpenEdit = (agency: Agency) => {
    setEditingAgency(agency);
    setFormData({
      name: agency.name,
      city: agency.city,
      type: agency.type || 'agence_regionale',
      address: agency.address || '',
      phone: agency.phone || '',
      email: agency.email || '',
      managerName: agency.managerName || '',
      managerPhone: agency.managerPhone || '',
      managerEmail: agency.managerEmail || '',
      storageCapacity: agency.storageCapacity || 3000,
      active: agency.active !== false,
      notes: agency.notes || ''
    });
  };

  // Open Quick Manager Modal
  const handleOpenQuickManager = (agency: Agency) => {
    setQuickManagerModalAgency(agency);
    setQuickManagerData({
      managerName: agency.managerName || '',
      managerPhone: agency.managerPhone || '',
      managerEmail: agency.managerEmail || '',
      selectedEmployeeId: agency.managerId || ''
    });
  };

  // Handle Save (Add or Update)
  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.city.trim() || !formData.managerName.trim()) {
      alert('Veuillez remplir le nom du hub, la ville et le nom du responsable.');
      return;
    }

    const agencyPayload = {
      name: formData.name.trim(),
      city: formData.city.trim(),
      type: formData.type,
      address: formData.address.trim(),
      phone: formData.phone.trim(),
      email: formData.email.trim() || undefined,
      managerName: formData.managerName.trim(),
      managerPhone: formData.managerPhone.trim() || undefined,
      managerEmail: formData.managerEmail.trim() || undefined,
      storageCapacity: Number(formData.storageCapacity) || 3000,
      active: formData.active,
      notes: formData.notes.trim() || undefined
    };

    if (editingAgency) {
      updateAgency(editingAgency.id, agencyPayload, {
        name: currentUser?.name || 'Administrateur',
        role: currentUser?.role || 'admin'
      });
      setEditingAgency(null);
    } else {
      addAgency(agencyPayload, {
        name: currentUser?.name || 'Administrateur',
        role: currentUser?.role || 'admin'
      });
      setIsAddModalOpen(false);
    }
  };

  // Handle Quick Manager Save
  const handleSaveQuickManager = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickManagerModalAgency || !quickManagerData.managerName.trim()) return;

    updateAgency(
      quickManagerModalAgency.id,
      {
        managerName: quickManagerData.managerName.trim(),
        managerPhone: quickManagerData.managerPhone.trim() || undefined,
        managerEmail: quickManagerData.managerEmail.trim() || undefined,
        managerId: quickManagerData.selectedEmployeeId || undefined
      },
      { name: currentUser?.name || 'Administrateur', role: currentUser?.role || 'admin' }
    );

    setQuickManagerModalAgency(null);
  };

  // Handle Delete Confirmation
  const handleConfirmDelete = () => {
    if (!agencyToDelete) return;
    setDeleteError(null);

    const result = deleteAgency(agencyToDelete.id, deleteReason || 'Suppression par l\'administrateur', {
      name: currentUser?.name || 'Administrateur',
      role: currentUser?.role || 'admin'
    });

    if (result.success) {
      setAgencyToDelete(null);
      setDeleteReason('');
      setDeleteError(null);
    } else {
      setDeleteError(result.message);
    }
  };

  // Helper for Type label
  const getTypeBadge = (type?: AgencyType) => {
    switch (type) {
      case 'hub_principal':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30">
            <Warehouse className="w-3.5 h-3.5" />
            Hub Principal (رئيسي)
          </span>
        );
      case 'centre_tri':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/30">
            <Boxes className="w-3.5 h-3.5" />
            Centre de Tri (مركز فرز)
          </span>
        );
      case 'point_relais':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/30">
            <MapPin className="w-3.5 h-3.5" />
            Point Relais (نقطة استلام)
          </span>
        );
      case 'agence_regionale':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
            <Building2 className="w-3.5 h-3.5" />
            Agence Régionale (جهوية)
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-3 bg-red-600/10 text-red-600 rounded-xl">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                  <span>التحكم في Hubs والمراكز اللوجستية</span>
                  <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md font-mono">
                    {agencies.length} Hubs
                  </span>
                </h1>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  إدارة شبكة الفروع والمستودعات: زيادة، حذف، تعديل المعلومات وتعيين المسؤولين على كل Hub.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleOpenAdd}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-sm shadow-sm hover:shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Plus className="w-5 h-5" />
              <span>زيد Hub جديد (Ajouter)</span>
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 dark:border-slate-800">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">Total Hubs</span>
              <Building2 className="w-4 h-4 text-slate-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalHubs}</span>
              <span className="text-xs text-emerald-600 font-bold">{stats.activeHubs} نشط</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">سعة التخزين الإجمالية</span>
              <Warehouse className="w-4 h-4 text-amber-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.totalCapacity.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">colis max</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">الكوليات النشطة بالشبكة</span>
              <Boxes className="w-4 h-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">
                {stats.activePackagesCount}
              </span>
              <span className="text-xs text-blue-600 font-bold">في التخزين والترانزيت</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/60 dark:border-slate-700/60">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 dark:text-slate-400">المسؤولين المباشرين</span>
              <Users className="w-4 h-4 text-purple-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalHubs}</span>
              <span className="text-xs text-purple-600 font-bold">Responsables assignés</span>
            </div>
          </div>
        </div>

        {/* Dedicated Per-Agency Quick Scanner Strip */}
        {onOpenAgencyScanner && agencies.length > 0 && (
          <div className="mt-5 pt-5 border-t border-slate-100 dark:border-slate-800">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-red-600 text-white flex items-center justify-center shrink-0">
                  <Scan className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-xs font-black text-slate-900 dark:text-white">
                    سكان فوري لكل أجونص — كل أجونص وسكان ديالها
                  </h2>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    كليكي على الأجونص باش تسكاني الكوليات لي شديتي ويطلعو مباشرة بلي راهم فلاجونص
                  </p>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {agencies
                .filter(a => a.active !== false)
                .map(agency => {
                  const count = (packagesPerAgency[agency.name.toLowerCase()] || []).length;
                  return (
                    <button
                      key={agency.id}
                      type="button"
                      onClick={() => onOpenAgencyScanner(agency.name)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-red-50 hover:bg-red-600 text-red-700 hover:text-white border border-red-200 hover:border-red-600 text-xs font-bold transition-all cursor-pointer group shadow-2xs"
                    >
                      <Scan className="w-3.5 h-3.5 shrink-0" />
                      <span>سكان {agency.name}</span>
                      <span className="px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black bg-white/80 text-red-700 group-hover:bg-red-800 group-hover:text-white">
                        {count}
                      </span>
                    </button>
                  );
                })}
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="relative w-full md:w-96">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="البحث باسم Hub، المدينة، المسؤول، الهاتف..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 text-sm bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={e => setSelectedTypeFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">كل الأنواع (Tous les types)</option>
              <option value="hub_principal">Hubs Principaux</option>
              <option value="agence_regionale">Agences Régionales</option>
              <option value="centre_tri">Centres de Tri</option>
              <option value="point_relais">Points Relais</option>
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatusFilter}
              onChange={e => setSelectedStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs font-bold rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="all">كل الحالات (Tous statuts)</option>
              <option value="active">نشط فقط (Actifs)</option>
              <option value="inactive">غير نشط (Inactifs)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Hubs Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredAgencies.map(agency => {
          const currentPkgs = packagesPerAgency[agency.name.toLowerCase()] || [];
          const staffCount = staffPerAgency[agency.id] || 0;
          const capacityPercent = agency.storageCapacity
            ? Math.min(100, Math.round((currentPkgs.length / agency.storageCapacity) * 100))
            : 0;

          return (
            <div
              key={agency.id}
              className={`bg-white dark:bg-slate-900 border rounded-2xl p-5 shadow-xs transition-all hover:shadow-md flex flex-col justify-between ${
                agency.active === false
                  ? 'border-slate-200 dark:border-slate-800 opacity-75'
                  : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
              }`}
            >
              <div>
                {/* Header: Name, City & Status */}
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-black text-slate-900 dark:text-white leading-tight">
                        {agency.name}
                      </h2>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mt-1 font-semibold">
                      <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                      <span>{agency.city}</span>
                      {agency.createdAt && (
                        <span className="text-[11px] text-slate-400">· Créé le {agency.createdAt}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1 shrink-0">
                    {getTypeBadge(agency.type)}
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full ${
                        agency.active !== false
                          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                          : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300'
                      }`}
                    >
                      {agency.active !== false ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          نشط (Actif)
                        </>
                      ) : (
                        <>
                          <XCircle className="w-3 h-3" />
                          معطل (Inactif)
                        </>
                      )}
                    </span>
                  </div>
                </div>

                {/* Address & Direct Phone */}
                <div className="mt-4 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs space-y-2">
                  <div className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                    <span className="font-bold text-slate-400 shrink-0">العنوان:</span>
                    <span className="line-clamp-2">{agency.address || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-200/50 dark:border-slate-700/50">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300 font-mono">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{agency.phone || 'Non renseigné'}</span>
                    </div>
                    {agency.email && (
                      <div className="flex items-center gap-1 text-slate-500 dark:text-slate-400 text-[11px]">
                        <Mail className="w-3 h-3" />
                        <span className="truncate max-w-[130px]">{agency.email}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Manager / المسؤول Card */}
                <div className="mt-4 p-3.5 rounded-xl bg-gradient-to-br from-red-50/50 to-amber-50/50 dark:from-red-950/20 dark:to-amber-950/20 border border-red-100 dark:border-red-900/30">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-red-700 dark:text-red-400">
                      <UserCheck className="w-4 h-4 text-red-600" />
                      <span>المسؤول عن الـ Hub (Responsable)</span>
                    </div>
                    <button
                      onClick={() => handleOpenQuickManager(agency)}
                      className="text-[11px] font-bold text-red-600 hover:text-red-700 dark:text-red-400 hover:underline"
                    >
                      تبديل المسؤول
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-red-600 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                      {agency.managerName
                        ? agency.managerName
                            .split(' ')
                            .map(n => n[0])
                            .slice(0, 2)
                            .join('')
                            .toUpperCase()
                        : 'M'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {agency.managerName || 'Aucun responsable'}
                      </p>
                      <div className="flex flex-col text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                        {agency.managerPhone && (
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {agency.managerPhone}
                          </span>
                        )}
                        {agency.managerEmail && (
                          <span className="flex items-center gap-1 truncate">
                            <Mail className="w-3 h-3 text-slate-400" />
                            {agency.managerEmail}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Capacity & Live Stock indicator */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1">
                      <Boxes className="w-3.5 h-3.5 text-slate-400" />
                      <span>الكوليات المخزنة حالياً:</span>
                    </span>
                    <button
                      onClick={() => setInspectingHubPackages(agency)}
                      className="font-black text-slate-900 dark:text-white hover:text-red-600 transition-colors flex items-center gap-1 group"
                    >
                      <span>{currentPkgs.length} colis</span>
                      <ChevronRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                    </button>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        capacityPercent > 85
                          ? 'bg-rose-500'
                          : capacityPercent > 60
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${Math.max(4, capacityPercent)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400">
                    <span>نسبة الإشغال: {capacityPercent}%</span>
                    <span>السعة: {agency.storageCapacity?.toLocaleString() || 3000} colis max</span>
                  </div>
                </div>

                {agency.notes && (
                  <p className="mt-3 text-xs text-slate-500 dark:text-slate-400 italic line-clamp-1 border-t border-slate-100 dark:border-slate-800 pt-2">
                    "{agency.notes}"
                  </p>
                )}
              </div>

              {/* Bottom Actions */}
              <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {onOpenAgencyScanner && (
                    <button
                      type="button"
                      onClick={() => onOpenAgencyScanner(agency.name)}
                      className="px-3 py-1.5 rounded-lg text-xs font-black text-white bg-red-600 hover:bg-red-700 shadow-2xs transition-colors flex items-center gap-1.5 cursor-pointer"
                    >
                      <Scan className="w-3.5 h-3.5" />
                      <span>سكان الأجونص</span>
                    </button>
                  )}
                  <button
                    onClick={() => setInspectingHubPackages(agency)}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <Boxes className="w-3.5 h-3.5 text-blue-500" />
                    <span>الكوليات ({currentPkgs.length})</span>
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => handleOpenEdit(agency)}
                    title="تعديل معلومات الـ Hub والمسؤول"
                    className="p-2 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => {
                      setAgencyToDelete(agency);
                      setDeleteReason('');
                      setDeleteError(null);
                    }}
                    title="حذف هذا الـ Hub (نقص Hub)"
                    className="p-2 text-rose-500 hover:text-rose-700 dark:text-rose-400 dark:hover:text-rose-300 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filteredAgencies.length === 0 && (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-12 text-center">
          <Warehouse className="w-12 h-12 mx-auto text-slate-400 mb-3" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white">لم يتم العثور على أي Hub</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            لا توجد فروع أو مراكز تطابق معايير البحث الحالية.
          </p>
          <button
            onClick={() => {
              setSearchTerm('');
              setSelectedTypeFilter('all');
              setSelectedStatusFilter('all');
            }}
            className="mt-4 px-4 py-2 text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-200"
          >
            إعادة ضبط الفلاتر
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: ADD / EDIT HUB */}
      {/* ========================================================================= */}
      {(isAddModalOpen || editingAgency) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs overflow-y-auto animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 shadow-2xl relative my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-red-600/10 text-red-600 rounded-xl">
                  <Building2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">
                    {editingAgency ? 'تعديل معلومات الـ Hub والمسؤول' : 'زيد Hub جديد (Ajouter un Hub)'}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    أدخل معلومات المركز اللوجستي وحدد المسؤول المباشر عنه.
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddModalOpen(false);
                  setEditingAgency(null);
                }}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitForm} className="mt-5 space-y-4">
              {/* Name & Type */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الـ Hub / Agence *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: Hub Principal Laâyoune"
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    نوع المركز (Type de Hub) *
                  </label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({ ...formData, type: e.target.value as AgencyType })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  >
                    <option value="hub_principal">Hub Principal (رئيسي إقليمي)</option>
                    <option value="agence_regionale">Agence Régionale (وكالة جهوية)</option>
                    <option value="centre_tri">Centre de Tri (مركز فرز محلي)</option>
                    <option value="point_relais">Point Relais (نقطة إيداع واستلام)</option>
                  </select>
                </div>
              </div>

              {/* City & Address */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المدينة (Ville) *
                  </label>
                  <input
                    type="text"
                    required
                    list="available-cities"
                    placeholder="المدينة (مثال: Laâyoune, Casablanca...)"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                  <datalist id="available-cities">
                    {cities.map(c => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    سعة التخزين القصوى (Capacité de stockage en colis)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    value={formData.storageCapacity}
                    onChange={e => setFormData({ ...formData, storageCapacity: Number(e.target.value) })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  العنوان التفصيلي (Adresse complète)
                </label>
                <input
                  type="text"
                  placeholder="مثال: Boulevard Mekka, Zone Industrielle Lot 12..."
                  value={formData.address}
                  onChange={e => setFormData({ ...formData, address: e.target.value })}
                  className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                />
              </div>

              {/* Hub Contact: Phone & Email */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    هاتف الـ Hub الثابت / المباشر (Téléphone Fixe / Standard)
                  </label>
                  <input
                    type="text"
                    placeholder="+212 528 XX XX XX"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    البريد الإلكتروني للـ Hub (Email officiel)
                  </label>
                  <input
                    type="email"
                    placeholder="hub.nom@livraison.ma"
                    value={formData.email}
                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Manager Section */}
              <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 space-y-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-red-600" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                    معلومات المسؤول على الـ Hub (Responsable d'agence) *
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-1">
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      اسم المسؤول الكامل *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Nom & Prénom"
                      value={formData.managerName}
                      onChange={e => setFormData({ ...formData, managerName: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      هاتف المسؤول المباشر
                    </label>
                    <input
                      type="text"
                      placeholder="+212 6XX XX XX XX"
                      value={formData.managerPhone}
                      onChange={e => setFormData({ ...formData, managerPhone: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                      بريد المسؤول الإلكتروني
                    </label>
                    <input
                      type="email"
                      placeholder="responsable@entreprise.ma"
                      value={formData.managerEmail}
                      onChange={e => setFormData({ ...formData, managerEmail: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Status & Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    حالة التشغيل (Statut)
                  </label>
                  <div className="flex items-center gap-4 mt-1">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="activeStatus"
                        checked={formData.active === true}
                        onChange={() => setFormData({ ...formData, active: true })}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span>نشط (Actif)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-300">
                      <input
                        type="radio"
                        name="activeStatus"
                        checked={formData.active === false}
                        onChange={() => setFormData({ ...formData, active: false })}
                        className="text-red-600 focus:ring-red-500"
                      />
                      <span>غير نشط (Inactif)</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    ملاحظات داخلية (Notes)
                  </label>
                  <input
                    type="text"
                    placeholder="ملاحظات حول التغطية أو ساعات العمل..."
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    className="w-full px-3.5 py-2.5 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddModalOpen(false);
                    setEditingAgency(null);
                  }}
                  className="px-4 py-2.5 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء (Annuler)
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                >
                  {editingAgency ? 'حفظ التغييرات (Enregistrer)' : 'زيد الـ Hub الآن (Créer le Hub)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: QUICK CHANGE MANAGER */}
      {/* ========================================================================= */}
      {quickManagerModalAgency && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-red-600/10 text-red-600 rounded-lg">
                  <UserCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900 dark:text-white">
                    تبديل وتعيين المسؤول على الـ Hub
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {quickManagerModalAgency.name} ({quickManagerModalAgency.city})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setQuickManagerModalAgency(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickManager} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اختيار من الموظفين المسجلين في النظام (Optionnel)
                </label>
                <select
                  value={quickManagerData.selectedEmployeeId}
                  onChange={e => {
                    const empId = e.target.value;
                    const emp = users.find(u => u.id === empId);
                    if (emp) {
                      setQuickManagerData({
                        selectedEmployeeId: emp.id,
                        managerName: emp.name,
                        managerPhone: emp.phone || '',
                        managerEmail: emp.email || ''
                      });
                    } else {
                      setQuickManagerData(prev => ({ ...prev, selectedEmployeeId: '' }));
                    }
                  }}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                >
                  <option value="">-- إدخال يدوي أو اختر موظف --</option>
                  {users
                    .filter(u => u.role === 'employee' || u.role === 'admin')
                    .map(u => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role} - {u.city || u.agencyId || 'Siège'})
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  اسم المسؤول الجديد *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Nom & Prénom du responsable"
                  value={quickManagerData.managerName}
                  onChange={e => setQuickManagerData({ ...quickManagerData, managerName: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  هاتف المسؤول المباشر
                </label>
                <input
                  type="text"
                  placeholder="+212 6XX XX XX XX"
                  value={quickManagerData.managerPhone}
                  onChange={e => setQuickManagerData({ ...quickManagerData, managerPhone: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني المهني
                </label>
                <input
                  type="email"
                  placeholder="email@livraison.ma"
                  value={quickManagerData.managerEmail}
                  onChange={e => setQuickManagerData({ ...quickManagerData, managerEmail: e.target.value })}
                  className="w-full px-3.5 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-red-500 text-slate-900 dark:text-white"
                />
              </div>

              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickManagerModalAgency(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs"
                >
                  تأكيد تعيين المسؤول
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL: DELETE HUB (نقص Hub) */}
      {/* ========================================================================= */}
      {agencyToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center gap-3 text-rose-600 mb-3">
              <div className="p-3 bg-rose-100 dark:bg-rose-950/50 rounded-xl">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 dark:text-white">
                  حذف الـ Hub (نقص Hub)
                </h3>
                <p className="text-xs text-rose-600 font-semibold">
                  تحذير: هذه العملية نهائية وتزيل المركز من الشبكة اللوجستية.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200/60 dark:border-slate-700 text-xs space-y-1 mb-4">
              <p>
                <span className="font-bold text-slate-500">اسم الـ Hub:</span>{' '}
                <span className="font-black text-slate-900 dark:text-white">{agencyToDelete.name}</span>
              </p>
              <p>
                <span className="font-bold text-slate-500">المدينة:</span> {agencyToDelete.city}
              </p>
              <p>
                <span className="font-bold text-slate-500">المسؤول الحالي:</span> {agencyToDelete.managerName}
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs text-rose-700 dark:text-rose-300 font-semibold mb-4 flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                <span>{deleteError}</span>
              </div>
            )}

            <div className="space-y-2 mb-4">
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                سبب الحذف (Motif de suppression)
              </label>
              <input
                type="text"
                placeholder="مثال: إغلاق الوكالة، نقل الأنشطة إلى فرع آخر..."
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-rose-500 text-slate-900 dark:text-white"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setAgencyToDelete(null);
                  setDeleteError(null);
                }}
                className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs"
              >
                تأكيد الحذف (نقص الـ Hub)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DRAWER / MODAL: INSPECT PACKAGES IN HUB */}
      {/* ========================================================================= */}
      {inspectingHubPackages && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-3xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600/10 text-blue-600 rounded-xl">
                  <Boxes className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>الكوليات المخزنة في: {inspectingHubPackages.name}</span>
                    <span className="text-xs bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded font-bold font-mono">
                      {(packagesPerAgency[inspectingHubPackages.name.toLowerCase()] || []).length} colis
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    المدينة: {inspectingHubPackages.city} · المسؤول: {inspectingHubPackages.managerName} ({inspectingHubPackages.managerPhone || 'Sans tél'})
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {onOpenAgencyScanner && (
                  <button
                    type="button"
                    onClick={() => {
                      const targetAgencyName = inspectingHubPackages.name;
                      setInspectingHubPackages(null);
                      onOpenAgencyScanner(targetAgencyName);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-black shadow-xs transition-colors cursor-pointer"
                  >
                    <Scan className="w-3.5 h-3.5" />
                    <span>سكان كوليا لهاد الأجونص</span>
                  </button>
                )}
                <button
                  onClick={() => setInspectingHubPackages(null)}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="mt-4 overflow-y-auto flex-1 pr-1 space-y-2">
              {(packagesPerAgency[inspectingHubPackages.name.toLowerCase()] || []).length === 0 ? (
                <div className="py-12 text-center text-slate-400">
                  <Boxes className="w-10 h-10 mx-auto mb-2 opacity-40" />
                  <p className="text-sm font-semibold">لا يوجد أي طرد مخزن في هذا الـ Hub حالياً.</p>
                </div>
              ) : (
                (packagesPerAgency[inspectingHubPackages.name.toLowerCase()] || []).map(pkg => {
                  const statusMeta = PACKAGE_STATUS_CONFIG[pkg.status];
                  return (
                  <div
                    key={pkg.id}
                    className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-slate-50/50 dark:bg-slate-800/40 flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-slate-900 dark:text-white">
                          {pkg.trackingNumber}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            statusMeta?.badgeClass || 'bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {statusMeta?.label || pkg.status}
                        </span>
                      </div>
                      <div className="text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                        <span>الزبون: <b>{pkg.clientName}</b></span>
                        <span>·</span>
                        <span>المستلم: <b>{pkg.recipientName}</b> ({pkg.city})</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="font-black text-slate-900 dark:text-white text-sm">
                          {pkg.codAmount} MAD
                        </span>
                        <p className="text-[10px] text-slate-400 font-mono">COD</p>
                      </div>

                      {onViewPackage && (
                        <button
                          onClick={() => {
                            onViewPackage(pkg);
                            setInspectingHubPackages(null);
                          }}
                          className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold text-xs"
                        >
                          تفاصيل
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
              <button
                onClick={() => setInspectingHubPackages(null)}
                className="px-4 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 rounded-xl hover:bg-slate-200"
              >
                إغلاق (Fermer)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
