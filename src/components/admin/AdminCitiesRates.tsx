import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { CityTariff, UserProfile } from '../../types';
import { formatMAD } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';
import { isCityAllowedForUser } from '../../utils/employeePermissions';
import {
  MapPin,
  Plus,
  Edit2,
  Trash2,
  Clock,
  X,
  Check,
  Download,
  Search,
  Tag,
  Store,
  SlidersHorizontal,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';

export const AdminCitiesRates: React.FC = () => {
  const {
    cities,
    users,
    addCity,
    updateCity,
    deleteCity,
    updateClientRate,
    removeClientRate,
    setClientCustomRates,
    resetClientCustomRates
  } = useDatabase();
  const { currentUser } = useAuth();

  // Active view tab: 'standard' (Grille standard) | 'custom' (Tarifs négociés par boutique)
  const [activeTab, setActiveTab] = useState<'standard' | 'custom'>('standard');

  // Search & Filters for Standard Cities
  const [citySearch, setCitySearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Search for Custom Rates by Client
  const [clientSearch, setClientSearch] = useState('');

  // Modals for Standard Cities
  const [showAddCityModal, setShowAddCityModal] = useState(false);
  const [editingCity, setEditingCity] = useState<CityTariff | null>(null);
  const [deletingCity, setDeletingCity] = useState<CityTariff | null>(null);
  const [showBulkAdjustModal, setShowBulkAdjustModal] = useState(false);
  const [bulkDeltaMAD, setBulkDeltaMAD] = useState<number>(0);

  // New City Form State
  const [newCityName, setNewCityName] = useState('');
  const [newRegion, setNewRegion] = useState('');
  const [newDefaultFee, setNewDefaultFee] = useState(35);
  const [newReturnFee, setNewReturnFee] = useState(15);
  const [newDeliveryDelay, setNewDeliveryDelay] = useState(48);
  const [newCityActive, setNewCityActive] = useState(true);
  const [newSupportAgentName, setNewSupportAgentName] = useState('');
  const [newSupportWhatsapp, setNewSupportWhatsapp] = useState('');

  // Modals for Client Negotiated Rates
  const [showAddCustomRateModal, setShowAddCustomRateModal] = useState(false);
  const [customRateClientId, setCustomRateClientId] = useState('');
  const [customRateCity, setCustomRateCity] = useState('');
  const [customRateMAD, setCustomRateMAD] = useState<number>(30);

  // Full Client Rate Editor Modal
  const [managingClientRates, setManagingClientRates] = useState<UserProfile | null>(null);
  const [tempRates, setTempRates] = useState<Record<string, number>>({});
  const [rateModalSearch, setRateModalSearch] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // All clients with role === 'client'
  const clients = useMemo(() => users.filter(u => u.role === 'client'), [users]);

  // Clients with at least one custom rate
  const clientsWithCustomRates = useMemo(
    () => clients.filter(c => c.customRates && Object.keys(c.customRates).length > 0),
    [clients]
  );

  // Filtered standard cities (recherche insensible aux accents + scope Responsable villes)
  const filteredCities = useMemo(() => {
    const norm = (val: string) =>
      val
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
    const q = norm(citySearch.trim());
    const isEmployeeUser = currentUser?.role === 'employee';
    return cities.filter(c => {
      if (isEmployeeUser && !isCityAllowedForUser(currentUser, c.name)) {
        return false;
      }
      const matchSearch =
        !q ||
        norm(c.name).includes(q) ||
        norm(c.region).includes(q);
      const matchStatus =
        statusFilter === 'all'
          ? true
          : statusFilter === 'active'
          ? c.active !== false
          : c.active === false;
      return matchSearch && matchStatus;
    });
  }, [cities, citySearch, statusFilter, currentUser]);

  // Stats
  const avgDeliveryFee = useMemo(() => {
    if (cities.length === 0) return 0;
    const sum = cities.reduce((acc, c) => acc + (c.defaultFee || 0), 0);
    return Math.round(sum / cities.length);
  }, [cities]);

  const avgReturnFee = useMemo(() => {
    if (cities.length === 0) return 0;
    const sum = cities.reduce((acc, c) => acc + (c.returnFee || 0), 0);
    return Math.round(sum / cities.length);
  }, [cities]);

  const avgDelay = useMemo(() => {
    if (cities.length === 0) return 0;
    const sum = cities.reduce((acc, c) => acc + (c.deliveryDelayHours || 0), 0);
    return Math.round(sum / cities.length);
  }, [cities]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: STANDARD CITIES
  // ---------------------------------------------------------------------------
  const handleAddCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCityName.trim()) return;

    // Check duplicate
    const exists = cities.some(c => c.name.toLowerCase() === newCityName.trim().toLowerCase());
    if (exists) {
      showToast(`La ville "${newCityName.trim()}" existe déjà dans la grille.`);
      return;
    }

    addCity({
      name: newCityName.trim(),
      region: newRegion.trim() || 'Région Nationale',
      defaultFee: Number(newDefaultFee) || 35,
      returnFee: Number(newReturnFee) || 15,
      deliveryDelayHours: Number(newDeliveryDelay) || 48,
      active: newCityActive,
      supportAgentName: newSupportAgentName.trim() || undefined,
      supportWhatsapp: newSupportWhatsapp.trim() || undefined
    });

    setShowAddCityModal(false);
    setNewCityName('');
    setNewRegion('');
    setNewDefaultFee(35);
    setNewReturnFee(15);
    setNewDeliveryDelay(48);
    setNewSupportAgentName('');
    setNewSupportWhatsapp('');
    showToast(`Ville "${newCityName.trim()}" ajoutée avec succès !`);
  };

  const handleEditCitySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCity) return;

    updateCity(editingCity.id, editingCity);
    showToast(`Tarifs et délais de "${editingCity.name}" modifiés avec succès.`);
    setEditingCity(null);
  };

  const handleConfirmDeleteCity = () => {
    if (!deletingCity) return;
    const name = deletingCity.name;
    deleteCity(deletingCity.id);
    setDeletingCity(null);
    showToast(`Ville "${name}" supprimée définitivement de la grille.`);
  };

  const handleToggleCityActive = (city: CityTariff) => {
    const newActive = city.active === false ? true : false;
    updateCity(city.id, { active: newActive });
    showToast(`Statut de "${city.name}" mis à jour : ${newActive ? 'Desservie' : 'Désactivée'}.`);
  };

  const handleBulkAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (bulkDeltaMAD === 0) return;

    cities.forEach(c => {
      const newFee = Math.max(5, (c.defaultFee || 35) + bulkDeltaMAD);
      updateCity(c.id, { defaultFee: newFee });
    });

    showToast(
      `Ajustement global appliqué : ${bulkDeltaMAD > 0 ? `+${bulkDeltaMAD}` : bulkDeltaMAD} MAD sur l'ensemble des villes.`
    );
    setShowBulkAdjustModal(false);
    setBulkDeltaMAD(0);
  };

  const handleExportCSV = () => {
    const data = cities.map(c => ({
      Ville: c.name,
      Region: c.region,
      Delai_Heures: c.deliveryDelayHours,
      Tarif_Standard_MAD: c.defaultFee,
      Frais_Retour_MAD: c.returnFee,
      Statut: c.active !== false ? 'Desservie' : 'Désactivée'
    }));
    exportCSV(data, `fariousy_grille_tarifs_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  // ---------------------------------------------------------------------------
  // HANDLERS: CLIENT NEGOTIATED RATES
  // ---------------------------------------------------------------------------
  const handleOpenClientRateEditor = (client: UserProfile) => {
    setManagingClientRates(client);
    setTempRates({ ...(client.customRates || {}) });
  };

  const handleSaveAllClientRates = () => {
    if (!managingClientRates) return;
    setClientCustomRates(managingClientRates.id, tempRates);
    showToast(`Grille personnalisée enregistrée pour ${managingClientRates.companyName || managingClientRates.name}`);
    setManagingClientRates(null);
  };

  const handleResetAllClientRates = (client: UserProfile) => {
    if (confirm(`Réinitialiser TOUS les tarifs négociés pour "${client.companyName || client.name}" au tarif standard ?`)) {
      resetClientCustomRates(client.id);
      showToast(`Tarifs réinitialisés au standard pour ${client.companyName || client.name}`);
      if (managingClientRates?.id === client.id) {
        setTempRates({});
      }
    }
  };

  const handleAddSingleCustomRate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customRateClientId || !customRateCity || !customRateMAD) return;

    updateClientRate(customRateClientId, customRateCity, Number(customRateMAD));
    const target = clients.find(c => c.id === customRateClientId);
    showToast(`Tarif de ${customRateMAD} MAD appliqué pour ${customRateCity} (${target?.companyName || target?.name})`);
    setShowAddCustomRateModal(false);
    setCustomRateClientId('');
    setCustomRateCity('');
    setCustomRateMAD(30);
  };

  const handleDeleteClientCityRate = (clientId: string, city: string, clientName: string) => {
    if (confirm(`Supprimer le tarif dérogatoire de "${city}" pour ${clientName} et rétablir le tarif standard ?`)) {
      removeClientRate(clientId, city);
      showToast(`Tarif de ${city} rétabli au standard pour ${clientName}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 bg-slate-900 text-white text-xs font-bold rounded-2xl shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-top-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Header & View Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Gestion & Contrôle des Tarifs
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-100 text-red-700">
              {cities.length} Villes
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            تبديل ومسح وإضافة — التحكم الكامل في تعرفة المدن والأسعار التفضيلية للزبناء
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex items-center p-1 bg-slate-100 rounded-xl border border-slate-200 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('standard')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeTab === 'standard'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <MapPin className="w-3.5 h-3.5 text-red-600" />
            <span>Grille des Villes ({cities.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('custom')}
            className={`flex items-center gap-2 px-4 py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
              activeTab === 'custom'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-red-600" />
            <span>Tarifs Négociés par Boutique ({clientsWithCustomRates.length})</span>
          </button>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* TAB 1: GRILLE STANDARD DES VILLES */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'standard' && (
        <div className="space-y-5">
          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Villes Desservies
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {cities.filter(c => c.active !== false).length}
                <span className="text-xs font-semibold text-slate-400 ml-1">/ {cities.length}</span>
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Tarif Moyen Standard
              </span>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatMAD(avgDeliveryFee)}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Frais Retour Moyen
              </span>
              <div className="text-xl font-black text-rose-600 mt-1">
                {formatMAD(avgReturnFee)}
              </div>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Délai Moyen Garanti
              </span>
              <div className="text-xl font-black text-indigo-600 mt-1">
                {avgDelay}h
              </div>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs">
            <div className="flex items-center gap-2 flex-1 max-w-md">
              <div className="relative w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={citySearch}
                  onChange={e => setCitySearch(e.target.value)}
                  placeholder="Rechercher une ville, région (ex: Tanger, Casa)..."
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                {citySearch && (
                  <button
                    onClick={() => setCitySearch('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value as any)}
                className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 cursor-pointer"
              >
                <option value="all">Toutes ({cities.length})</option>
                <option value="active">Desservies ({cities.filter(c => c.active !== false).length})</option>
                <option value="inactive">Désactivées ({cities.filter(c => c.active === false).length})</option>
              </select>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setShowBulkAdjustModal(true)}
                title="Ajustement global de tous les tarifs"
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                <span>Ajustement Global</span>
              </button>

              <button
                onClick={handleExportCSV}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                <span>Exporter CSV</span>
              </button>

              <button
                onClick={() => setShowAddCityModal(true)}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Ajouter une Ville</span>
              </button>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="hidden md:block bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3.5 px-4">Ville Destination</th>
                  <th className="py-3.5 px-4">Région Administrative</th>
                  <th className="py-3.5 px-4 text-center">Délai Garanti</th>
                  <th className="py-3.5 px-4 text-right">Tarif Livraison Standard</th>
                  <th className="py-3.5 px-4 text-right">Frais de Retour</th>
                  <th className="py-3.5 px-4 text-center">Statut</th>
                  <th className="py-3.5 px-4 text-right">Actions (تبديل / مسح)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCities.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      Aucune ville ne correspond à votre recherche "{citySearch}".
                    </td>
                  </tr>
                ) : (
                  filteredCities.map(city => {
                    const isActive = city.active !== false;
                    return (
                      <tr
                        key={city.id}
                        className={`hover:bg-slate-50/80 transition-colors ${
                          !isActive ? 'opacity-60 bg-slate-50/40' : ''
                        }`}
                      >
                        <td className="py-3.5 px-4 font-black text-slate-900">
                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                            <span>{city.name}</span>
                          </div>
                        </td>
                        <td className="py-3.5 px-4 text-slate-600">{city.region}</td>
                        <td className="py-3.5 px-4 text-center">
                          <span className="inline-flex items-center gap-1 font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                            <Clock className="w-3 h-3 text-slate-500" />
                            <span>{city.deliveryDelayHours}h</span>
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-black text-slate-900 text-sm">
                          {formatMAD(city.defaultFee)}
                        </td>
                        <td className="py-3.5 px-4 text-right font-mono font-bold text-rose-600">
                          {formatMAD(city.returnFee)}
                        </td>
                        <td className="py-3.5 px-4 text-center">
                          <button
                            onClick={() => handleToggleCityActive(city)}
                            title={isActive ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold cursor-pointer transition-colors ${
                              isActive
                                ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                            }`}
                          >
                            {isActive ? 'Desservie' : 'Désactivée'}
                          </button>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setEditingCity(city)}
                              title="تبديل: Modifier les tarifs et délais de cette ville"
                              className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3 text-slate-600" />
                              <span>تبديل</span>
                            </button>
                            <button
                              onClick={() => setDeletingCity(city)}
                              title="مسح: Supprimer définitivement cette ville"
                              className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3 text-rose-600" />
                              <span>مسح</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="md:hidden space-y-3">
            {filteredCities.map(city => {
              const isActive = city.active !== false;
              return (
                <div
                  key={city.id}
                  className={`p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3 ${
                    !isActive ? 'opacity-65' : ''
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-red-600 shrink-0" />
                      <div>
                        <h4 className="text-sm font-black text-slate-900">{city.name}</h4>
                        <span className="text-[11px] text-slate-500">{city.region}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleToggleCityActive(city)}
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isActive ? 'Desservie' : 'Désactivée'}
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-xs">
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Tarif</span>
                      <strong className="font-mono text-slate-900 font-black">
                        {formatMAD(city.defaultFee)}
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Retour</span>
                      <strong className="font-mono text-rose-600 font-black">
                        {formatMAD(city.returnFee)}
                      </strong>
                    </div>
                    <div className="bg-slate-50 p-2 rounded-xl">
                      <span className="text-[10px] text-slate-400 block font-semibold">Délai</span>
                      <strong className="font-mono text-slate-700 font-bold">{city.deliveryDelayHours}h</strong>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                    <button
                      onClick={() => setEditingCity(city)}
                      className="flex-1 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                      <span>تبديل</span>
                    </button>
                    <button
                      onClick={() => setDeletingCity(city)}
                      className="flex-1 py-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>مسح</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* TAB 2: TARIFS NÉGOCIÉS PAR BOUTIQUE */}
      {/* --------------------------------------------------------------------- */}
      {activeTab === 'custom' && (
        <div className="space-y-5">
          {/* Info Banner */}
          <div className="p-4 bg-gradient-to-r from-red-50 to-orange-50 border border-red-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Tag className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-sm font-black text-slate-900">
                  Tarifs Négociés & Grilles Préférentielles par Boutique
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  تحديد أسعار خاصة لكل عميل على حدة (Casablanca, Rabat, Tanger...) أو مسحها للعودة للتعرفة الأصلية
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                if (clients.length > 0) {
                  setCustomRateClientId(clients[0].id);
                  setCustomRateCity(cities[0]?.name || 'Casablanca');
                  setShowAddCustomRateModal(true);
                }
              }}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Attribuer un Tarif Négocié</span>
            </button>
          </div>

          {/* Search bar */}
          <div className="flex items-center justify-between gap-3 bg-white p-3.5 border border-slate-200 rounded-2xl shadow-2xs">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={clientSearch}
                onChange={e => setClientSearch(e.target.value)}
                placeholder="Rechercher une boutique (nom, gérant, ville)..."
                className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <span className="text-xs text-slate-500 font-bold hidden sm:inline">
              {clientsWithCustomRates.length} boutique(s) avec tarifs sur-mesure
            </span>
          </div>

          {/* Cards of clients with custom rates */}
          {clientsWithCustomRates.length === 0 ? (
            <div className="p-12 text-center bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
              <div className="w-12 h-12 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto">
                <Tag className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">
                Aucun tarif négocié actuellement configuré
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Toutes vos boutiques appliquent la grille standard des villes. Vous pouvez définir des tarifs réduits par boutique ci-dessous.
              </p>
              <button
                onClick={() => {
                  if (clients.length > 0) {
                    setCustomRateClientId(clients[0].id);
                    setCustomRateCity(cities[0]?.name || 'Casablanca');
                    setShowAddCustomRateModal(true);
                  }
                }}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer"
              >
                Définir un premier tarif négocié
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientsWithCustomRates
                .filter(c => {
                  const q = clientSearch.toLowerCase();
                  return (
                    (c.companyName || '').toLowerCase().includes(q) ||
                    (c.name || '').toLowerCase().includes(q) ||
                    (c.city || '').toLowerCase().includes(q)
                  );
                })
                .map(client => {
                  const ratesEntries = Object.entries(client.customRates || {});
                  return (
                    <div
                      key={client.id}
                      className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 hover:border-slate-300 transition-colors"
                    >
                      {/* Client Header */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-red-50 border border-red-100 flex items-center justify-center text-red-600 shrink-0">
                            <Store className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-sm font-black text-slate-900">
                              {client.companyName || client.name}
                            </h4>
                            <p className="text-xs text-slate-500">
                              {client.name} • <strong>{client.city}</strong> • {client.phone}
                            </p>
                          </div>
                        </div>

                        <span className="px-2.5 py-0.5 bg-red-50 border border-red-100 rounded-full text-[10px] font-bold text-red-700 shrink-0">
                          {ratesEntries.length} tarif(s) dérogatoire(s)
                        </span>
                      </div>

                      {/* City Rates Badges with delete button */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Villes avec tarifs négociés :
                        </span>
                        <div className="flex flex-wrap gap-2">
                          {ratesEntries.map(([cityName, rate]) => {
                            const standardCity = cities.find(c => c.name === cityName);
                            const standardFee = standardCity?.defaultFee || 35;
                            const diff = standardFee - rate;

                            return (
                              <div
                                key={cityName}
                                className="group inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs"
                              >
                                <MapPin className="w-3 h-3 text-red-600" />
                                <span className="font-extrabold text-slate-800">{cityName} :</span>
                                <span className="font-mono font-black text-red-600">{rate} MAD</span>
                                {diff > 0 && (
                                  <span className="text-[10px] font-bold text-emerald-600">
                                    (-{diff} MAD)
                                  </span>
                                )}

                                {/* Delete tag button (مسح) */}
                                <button
                                  onClick={() =>
                                    handleDeleteClientCityRate(
                                      client.id,
                                      cityName,
                                      client.companyName || client.name
                                    )
                                  }
                                  title={`مسح: Supprimer ce tarif spécial pour ${cityName} et rétablir le tarif standard (${standardFee} MAD)`}
                                  className="ml-1 p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer transition-colors"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2 flex-wrap">
                        <button
                          onClick={() => handleOpenClientRateEditor(client)}
                          className="px-3 py-1.5 text-xs font-bold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5 text-slate-600" />
                          <span>Gérer tous les tarifs (تبديل)</span>
                        </button>

                        <button
                          onClick={() => handleResetAllClientRates(client)}
                          title="مسح كافة التخفيضات والرجوع للتعرفة القياسية لجميع المدن"
                          className="px-3 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
                          <span>Réinitialiser au standard (مسح الكل)</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Clients without custom rates (quick shortcut to assign) */}
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-3">
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Autres Boutiques Actives (Grille Standard Actuelle)
            </h4>
            <div className="flex flex-wrap gap-2">
              {clients
                .filter(c => !c.customRates || Object.keys(c.customRates).length === 0)
                .map(client => (
                  <button
                    key={client.id}
                    onClick={() => handleOpenClientRateEditor(client)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors cursor-pointer"
                  >
                    <span>{client.companyName || client.name}</span>
                    <span className="text-[10px] text-slate-400 font-normal">({client.city})</span>
                    <Plus className="w-3.5 h-3.5 text-red-600" />
                  </button>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: AJOUTER UNE VILLE (STANDARD) */}
      {/* --------------------------------------------------------------------- */}
      {showAddCityModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">Ajouter une Nouvelle Ville</h3>
              </div>
              <button
                onClick={() => setShowAddCityModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCitySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Nom de la ville destination *
                </label>
                <input
                  type="text"
                  required
                  value={newCityName}
                  onChange={e => setNewCityName(e.target.value)}
                  placeholder="Ex: Tétouan, Agadir, Oujda..."
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Région Administrative
                </label>
                <input
                  type="text"
                  value={newRegion}
                  onChange={e => setNewRegion(e.target.value)}
                  placeholder="Ex: Tanger-Tétouan-Al Hoceïma"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tarif (MAD)</label>
                  <input
                    type="number"
                    min="5"
                    step="1"
                    required
                    value={newDefaultFee}
                    onChange={e => setNewDefaultFee(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Retour (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={newReturnFee}
                    onChange={e => setNewReturnFee(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Délai (H)</label>
                  <input
                    type="number"
                    min="12"
                    step="12"
                    required
                    value={newDeliveryDelay}
                    onChange={e => setNewDeliveryDelay(parseInt(e.target.value) || 24)}
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Responsable Support (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Support Casablanca"
                    value={newSupportAgentName}
                    onChange={e => setNewSupportAgentName(e.target.value)}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Support Région (Optionnel)
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +212 661 22 33 44"
                    value={newSupportWhatsapp}
                    onChange={e => setNewSupportWhatsapp(e.target.value)}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cityActiveCheck"
                  checked={newCityActive}
                  onChange={e => setNewCityActive(e.target.checked)}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 cursor-pointer"
                />
                <label htmlFor="cityActiveCheck" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Ville active immédiatement (desservie)
                </label>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddCityModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Ajouter la ville
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: MODIFIER UNE VILLE (تبديل) */}
      {/* --------------------------------------------------------------------- */}
      {editingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">
                  Modifier les Tarifs — {editingCity.name}
                </h3>
              </div>
              <button
                onClick={() => setEditingCity(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditCitySubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nom de la ville</label>
                <input
                  type="text"
                  required
                  value={editingCity.name}
                  onChange={e => setEditingCity({ ...editingCity, name: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Région Administrative</label>
                <input
                  type="text"
                  value={editingCity.region}
                  onChange={e => setEditingCity({ ...editingCity, region: e.target.value })}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tarif (MAD)</label>
                  <input
                    type="number"
                    min="5"
                    step="1"
                    required
                    value={editingCity.defaultFee}
                    onChange={e =>
                      setEditingCity({
                        ...editingCity,
                        defaultFee: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Retour (MAD)</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={editingCity.returnFee}
                    onChange={e =>
                      setEditingCity({
                        ...editingCity,
                        returnFee: parseFloat(e.target.value) || 0
                      })
                    }
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Délai (H)</label>
                  <input
                    type="number"
                    min="12"
                    step="12"
                    required
                    value={editingCity.deliveryDelayHours}
                    onChange={e =>
                      setEditingCity({
                        ...editingCity,
                        deliveryDelayHours: parseInt(e.target.value) || 24
                      })
                    }
                    className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Responsable Support (Optionnel)
                  </label>
                  <input
                    type="text"
                    placeholder="Ex: Support Région"
                    value={editingCity.supportAgentName || ''}
                    onChange={e => setEditingCity({ ...editingCity, supportAgentName: e.target.value })}
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    WhatsApp Support Région
                  </label>
                  <input
                    type="tel"
                    placeholder="Ex: +212 661 22 33 44"
                    value={editingCity.supportWhatsapp || ''}
                    onChange={e => setEditingCity({ ...editingCity, supportWhatsapp: e.target.value })}
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="cityActiveEdit"
                  checked={editingCity.active !== false}
                  onChange={e => setEditingCity({ ...editingCity, active: e.target.checked })}
                  className="w-4 h-4 text-red-600 rounded border-slate-300 cursor-pointer"
                />
                <label htmlFor="cityActiveEdit" className="text-xs font-bold text-slate-700 cursor-pointer">
                  Ville desservie activement
                </label>
              </div>

              <div className="pt-4 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingCity(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: SUPPRIMER UNE VILLE (مسح) */}
      {/* --------------------------------------------------------------------- */}
      {deletingCity && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-black text-slate-900">
                Supprimer la ville de {deletingCity.name} ?
              </h3>
              <p className="text-xs text-slate-500">
                تأكيد مسح المدينة: cette action supprimera définitivement {deletingCity.name} de la grille tarifaire (Tarif: {deletingCity.defaultFee} MAD).
              </p>
            </div>

            <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-xs text-rose-900 font-semibold text-center">
              Cette ville ne sera plus disponible comme destination lors de l'ajout de nouveaux colis.
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingCity(null)}
                className="flex-1 py-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCity}
                className="flex-1 py-2.5 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs cursor-pointer"
              >
                Confirmer la suppression
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: AJUSTEMENT GLOBAL (تبديل جماعي للأثمنة) */}
      {/* --------------------------------------------------------------------- */}
      {showBulkAdjustModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">Ajustement Global des Tarifs</h3>
              </div>
              <button
                onClick={() => setShowBulkAdjustModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              Appliquez une augmentation ou une réduction uniforme (en MAD) à l'ensemble des {cities.length} villes desservies.
            </p>

            <form onSubmit={handleBulkAdjustment} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Variation en MAD (positif pour augmenter, négatif pour réduire)
                </label>
                <input
                  type="number"
                  step="1"
                  required
                  value={bulkDeltaMAD}
                  onChange={e => setBulkDeltaMAD(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: +5 ou -5"
                  className="w-full text-base font-mono font-black bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 space-y-1">
                <span className="font-bold block">Aperçu du tarif moyen :</span>
                <div>
                  Actuel : <strong className="font-mono">{avgDeliveryFee} MAD</strong> ➔ Nouveau :{' '}
                  <strong className="font-mono text-red-600">
                    {Math.max(5, avgDeliveryFee + bulkDeltaMAD)} MAD
                  </strong>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBulkAdjustModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={bulkDeltaMAD === 0}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-xl shadow-xs cursor-pointer"
                >
                  Appliquer à toutes les villes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: ATTRIBUER UN TARIF NÉGOCIÉ (SIMPLE) */}
      {/* --------------------------------------------------------------------- */}
      {showAddCustomRateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-red-600" />
                <h3 className="text-base font-black text-slate-900">Attribuer un Tarif Négocié</h3>
              </div>
              <button
                onClick={() => setShowAddCustomRateModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSingleCustomRate} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Boutique / Client Partenaire *
                </label>
                <select
                  required
                  value={customRateClientId}
                  onChange={e => setCustomRateClientId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-bold"
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} ({c.city})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Ville Destination *
                </label>
                <select
                  required
                  value={customRateCity}
                  onChange={e => setCustomRateCity(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-slate-900 font-bold"
                >
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} (Standard : {c.defaultFee} MAD)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Tarif Spécial Accordé (MAD) *
                </label>
                <input
                  type="number"
                  min="5"
                  step="1"
                  required
                  value={customRateMAD}
                  onChange={e => setCustomRateMAD(parseFloat(e.target.value) || 0)}
                  placeholder="Ex: 25"
                  className="w-full text-base font-mono font-black bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-slate-900"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddCustomRateModal(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Enregistrer ce tarif
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --------------------------------------------------------------------- */}
      {/* MODAL: GESTION DE TOUS LES TARIFS D'UN CLIENT (ÉDITEUR COMPLET) */}
      {/* --------------------------------------------------------------------- */}
      {managingClientRates && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                  <Store className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-900">
                    Grille Tarifaire : {managingClientRates.companyName || managingClientRates.name}
                  </h3>
                  <p className="text-xs text-slate-500">
                    تبديل ومسح التعرفة الخاصة بهذه Boutique (Ville d'origine : {managingClientRates.city})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingClientRates(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions Bar */}
            <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="relative flex-1 max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Filtrer les villes..."
                  value={rateModalSearch}
                  onChange={e => setRateModalSearch(e.target.value)}
                  className="w-full text-xs bg-white border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const priceStr = prompt('Entrez le tarif unique en MAD pour TOUTES les villes :', '25');
                    if (priceStr) {
                      const priceNum = parseFloat(priceStr);
                      if (!isNaN(priceNum) && priceNum > 0) {
                        const newR: Record<string, number> = {};
                        cities.forEach(c => {
                          newR[c.name] = priceNum;
                        });
                        setTempRates(newR);
                      }
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Tarif unique partout
                </button>

                <button
                  type="button"
                  onClick={() => setTempRates({})}
                  title="مسح كافة الأسعار الخاصة والرجوع للتعرفة الأصلية"
                  className="px-2.5 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg cursor-pointer"
                >
                  Rétablir standard (مسح)
                </button>
              </div>
            </div>

            {/* Scrollable Cities List */}
            <div className="p-6 overflow-y-auto divide-y divide-slate-100 flex-1 space-y-3">
              {cities
                .filter(c => c.name.toLowerCase().includes(rateModalSearch.toLowerCase()))
                .map(city => {
                  const isCustom = tempRates[city.name] !== undefined;
                  const currentRate = isCustom ? tempRates[city.name] : city.defaultFee;

                  return (
                    <div
                      key={city.id}
                      className="pt-3 first:pt-0 flex items-center justify-between gap-4"
                    >
                      <div className="flex items-center gap-2.5">
                        <MapPin className="w-4 h-4 text-slate-400" />
                        <div>
                          <div className="font-black text-slate-900 text-xs">{city.name}</div>
                          <span className="text-[10px] text-slate-400">
                            Tarif standard : <strong>{city.defaultFee} MAD</strong>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isCustom && (
                          <button
                            type="button"
                            onClick={() => {
                              const copy = { ...tempRates };
                              delete copy[city.name];
                              setTempRates(copy);
                            }}
                            title="مسح التخفيض والرجوع للسعر الأصلي"
                            className="p-1.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <div className="relative w-28">
                          <input
                            type="number"
                            min="5"
                            step="1"
                            value={currentRate}
                            onChange={e => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val)) {
                                setTempRates({
                                  ...tempRates,
                                  [city.name]: val
                                });
                              }
                            }}
                            className={`w-full text-xs font-mono font-black text-right px-3 py-1.5 rounded-xl border ${
                              isCustom
                                ? 'bg-red-50/50 border-red-300 text-red-600'
                                : 'bg-slate-50 border-slate-200 text-slate-700'
                            }`}
                          />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 pointer-events-none">
                            MAD
                          </span>
                        </div>

                        <span
                          className={`w-20 text-center text-[10px] font-bold py-1 px-1.5 rounded-md ${
                            isCustom
                              ? 'bg-red-100 text-red-700'
                              : 'bg-slate-100 text-slate-500'
                          }`}
                        >
                          {isCustom ? 'Négocié' : 'Standard'}
                        </span>
                      </div>
                    </div>
                  );
                })}
            </div>

            {/* Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <span className="text-xs text-slate-500">
                {Object.keys(tempRates).length} ville(s) avec tarif personnalisé
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setManagingClientRates(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllClientRates}
                  className="px-5 py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  <span>Enregistrer la grille (حفظ)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
