import React, { useState, useMemo } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Vehicle, VehicleStatus, VehicleOwnership } from '../../types';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  Car,
  Truck,
  Plus,
  Search,
  MapPin,
  Navigation,
  Fuel,
  Gauge,
  Activity,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Eye,
  Edit2,
  Trash2,
  Phone,
  User,
  Radio,
  RefreshCw,
  Wrench,
  ShieldCheck,
  FileText,
  X,
  Zap,
  Package,
  Layers,
  Building,
  SlidersHorizontal,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface AdminVehiclesProps {
  onNavigateAdd: () => void;
  onEditVehicle?: (vehicle: Vehicle) => void;
}

export const AdminVehicles: React.FC<AdminVehiclesProps> = ({
  onNavigateAdd,
  onEditVehicle
}) => {
  const {
    vehicles,
    deleteVehicle,
    updateVehicle,
    simulateVehicleTelemetry,
    users,
    packages,
    agencies
  } = useDatabase();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table');

  // Tracking Modal State (التتبع ديال المركبة)
  const [trackingVehicle, setTrackingVehicle] = useState<Vehicle | null>(null);
  const [isRefreshingGps, setIsRefreshingGps] = useState(false);

  // Delete Confirmation State
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle | null>(null);

  // Quick Edit Modal State
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [editStatus, setEditStatus] = useState<VehicleStatus>('actif');
  const [editDriverId, setEditDriverId] = useState<string>('');
  const [editMileage, setEditMileage] = useState<string>('');
  const [editCity, setEditCity] = useState<string>('');

  // Drivers list
  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);

  // Filtered vehicles
  const filteredVehicles = useMemo(() => {
    return vehicles.filter(v => {
      const matchSearch =
        v.plateNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
        v.model.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (v.driverName && v.driverName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (v.city && v.city.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStatus = statusFilter === 'all' || v.status === statusFilter;
      const matchType = typeFilter === 'all' || v.vehicleType.toLowerCase() === typeFilter.toLowerCase();
      const matchCity = cityFilter === 'all' || v.city === cityFilter;

      return matchSearch && matchStatus && matchType && matchCity;
    });
  }, [vehicles, searchTerm, statusFilter, typeFilter, cityFilter]);

  // Aggregate Metrics
  const stats = useMemo(() => {
    const total = vehicles.length;
    const enTournee = vehicles.filter(v => v.status === 'en_tournee' || v.tracking?.status === 'en_mouvement').length;
    const auHub = vehicles.filter(v => v.status === 'actif' && v.tracking?.status !== 'en_mouvement').length;
    const enMaintenance = vehicles.filter(v => v.status === 'maintenance' || v.status === 'hors_service').length;
    const totalKm = vehicles.reduce((sum, v) => sum + (v.currentMileage || 0), 0);
    return { total, enTournee, auHub, enMaintenance, totalKm };
  }, [vehicles]);

  // Helper for status badge
  const getStatusBadge = (status: VehicleStatus) => {
    switch (status) {
      case 'actif':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600"></span>
            <span>Actif</span>
          </span>
        );
      case 'en_tournee':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
            <span>En tournée</span>
          </span>
        );
      case 'maintenance':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
            <Wrench className="w-3 h-3 text-amber-600" />
            <span>Maintenance</span>
          </span>
        );
      case 'hors_service':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800 border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            <span>Hors service</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
            {status}
          </span>
        );
    }
  };

  const handleConfirmDelete = (reason?: string) => {
    if (!vehicleToDelete) return;
    deleteVehicle(vehicleToDelete.id, reason || 'Suppression depuis la liste des véhicules');
    setVehicleToDelete(null);
  };

  const handleOpenEdit = (v: Vehicle) => {
    if (onEditVehicle) {
      onEditVehicle(v);
    } else {
      setEditingVehicle(v);
      setEditStatus(v.status);
      setEditDriverId(v.driverId || '');
      setEditMileage(String(v.currentMileage || ''));
      setEditCity(v.city || 'Laâyoune');
    }
  };

  const handleSaveQuickEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;

    const selectedDriver = drivers.find(d => d.id === editDriverId);

    updateVehicle(editingVehicle.id, {
      status: editStatus,
      driverId: editDriverId || undefined,
      driverName: selectedDriver ? selectedDriver.name : editingVehicle.driverName,
      driverPhone: selectedDriver ? selectedDriver.phone : editingVehicle.driverPhone,
      city: editCity,
      currentMileage: editMileage ? Number(editMileage) : editingVehicle.currentMileage
    });

    setEditingVehicle(null);
  };

  const handleRefreshGps = (vehId: string) => {
    setIsRefreshingGps(true);
    simulateVehicleTelemetry(vehId);
    setTimeout(() => {
      setIsRefreshingGps(false);
      // update local reference if tracking modal is open
      const updated = vehicles.find(v => v.id === vehId);
      if (updated) setTrackingVehicle(updated);
    }, 600);
  };

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-red-100 text-red-600 flex items-center justify-center font-bold">
              <Car className="w-4 h-4" />
            </div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Véhicules & Télémétrie Flotte
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-800 font-mono">
              تتبع المركبات
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestion du parc automobile, motos, fourgonnettes et suivi GPS en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* View Mode Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex items-center border border-slate-200">
            <button
              onClick={() => setViewMode('table')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tableau
            </button>
            <button
              onClick={() => setViewMode('map')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer ${
                viewMode === 'map' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Radio className="w-3.5 h-3.5 text-red-600 animate-pulse" />
              <span>Carte GPS (التتبع)</span>
            </button>
          </div>

          {/* Add Vehicle Button (matches red button in video) */}
          <button
            onClick={onNavigateAdd}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Ajouter un véhicule</span>
          </button>
        </div>
      </div>

      {/* Fleet Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase">Total Flotte</span>
            <Car className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 font-mono">{stats.total}</span>
            <span className="text-xs text-slate-500">véhicules</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-blue-600 uppercase">En Tournée (Actifs)</span>
            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-blue-700 font-mono">{stats.enTournee}</span>
            <span className="text-xs text-slate-500">en mouvement</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-emerald-600 uppercase">Stationnés au Hub</span>
            <Building className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-700 font-mono">{stats.auHub}</span>
            <span className="text-xs text-slate-500">disponibles</span>
          </div>
        </div>

        <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-amber-600 uppercase">Maintenance & Révision</span>
            <Wrench className="w-4 h-4 text-amber-500" />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-700 font-mono">{stats.enMaintenance}</span>
            <span className="text-xs text-slate-500">au garage</span>
          </div>
        </div>
      </div>

      {/* Search & Filter Bar (matches video 00:04) */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Search input with "Plaque ou modèle" */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Plaque ou modèle (ex: 66-B66220, Fizz, Dokker...)"
            className="w-full pl-10 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 transition-all font-medium"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
          >
            <option value="all">Tous les statuts</option>
            <option value="actif">Actif</option>
            <option value="en_tournee">En tournée</option>
            <option value="maintenance">Maintenance</option>
            <option value="hors_service">Hors service</option>
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
          >
            <option value="all">Tous types</option>
            <option value="moto">Moto</option>
            <option value="fourgonnette">Fourgonnette</option>
            <option value="voiture">Voiture</option>
            <option value="camion">Camion</option>
          </select>

          {/* City / Hub Filter */}
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
          >
            <option value="all">Toutes villes</option>
            <option value="Laâyoune">Laâyoune</option>
            <option value="Casablanca">Casablanca</option>
            <option value="Rabat">Rabat</option>
            <option value="Tanger">Tanger</option>
          </select>
        </div>
      </div>

      {/* Main Content: Table View vs GPS Radar Map View */}
      {viewMode === 'table' ? (
        /* ================= TABLE MATCHING VIDEO 00:04 ================= */
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4 text-center w-12">#</th>
                  <th className="py-3 px-4">
                    <div className="flex items-center gap-1.5">
                      <Car className="w-3.5 h-3.5 text-slate-400" />
                      <span>Numéro de plaque</span>
                    </div>
                  </th>
                  <th className="py-3 px-4">Marque</th>
                  <th className="py-3 px-4">Modèle</th>
                  <th className="py-3 px-4">Année</th>
                  <th className="py-3 px-4">Chauffeur / Ville</th>
                  <th className="py-3 px-4">Statut</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredVehicles.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      <Car className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="font-medium">Aucun véhicule trouvé pour cette recherche.</p>
                      <button
                        onClick={onNavigateAdd}
                        className="mt-3 text-xs font-bold text-red-600 hover:underline"
                      >
                        + Ajouter un premier véhicule
                      </button>
                    </td>
                  </tr>
                ) : (
                  filteredVehicles.map((vehicle, idx) => {
                    const isMoving = vehicle.tracking?.status === 'en_mouvement';
                    return (
                      <tr
                        key={vehicle.id}
                        className="hover:bg-slate-50/80 transition-colors group"
                      >
                        {/* Index */}
                        <td className="py-3.5 px-4 text-center font-mono text-slate-400">
                          {idx + 1}
                        </td>

                        {/* Plaque Number (styled with Moroccan vehicle plate badge) */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-2">
                            <div className="px-2.5 py-1 bg-slate-900 text-white font-mono font-black text-xs rounded-lg border border-slate-700 tracking-wider shadow-2xs flex items-center gap-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
                              <span>{vehicle.plateNumber}</span>
                            </div>
                            {vehicle.vehicleType && (
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-medium">
                                {vehicle.vehicleType}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Marque */}
                        <td className="py-3.5 px-4 font-bold text-slate-800">
                          {vehicle.brand}
                        </td>

                        {/* Modèle */}
                        <td className="py-3.5 px-4 text-slate-700 font-medium">
                          {vehicle.model}
                        </td>

                        {/* Année */}
                        <td className="py-3.5 px-4 font-mono text-slate-600">
                          {vehicle.year}
                        </td>

                        {/* Driver & City */}
                        <td className="py-3.5 px-4">
                          <div className="text-xs">
                            <span className="font-bold text-slate-900 block">
                              {vehicle.driverName || 'Non assigné'}
                            </span>
                            <span className="text-[11px] text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3 text-red-500" />
                              <span>{vehicle.city || 'Maroc'}</span>
                            </span>
                          </div>
                        </td>

                        {/* Statut */}
                        <td className="py-3.5 px-4">
                          {getStatusBadge(vehicle.status)}
                        </td>

                        {/* Actions (matching video icons: View/GPS tracking, Edit, Delete) */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Live Tracking / Suivi button */}
                            <button
                              onClick={() => setTrackingVehicle(vehicle)}
                              className="p-1.5 text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-lg transition-colors cursor-pointer"
                              title="Télémétrie et suivi GPS en direct (التتبع)"
                            >
                              <Radio className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit button */}
                            <button
                              onClick={() => handleOpenEdit(vehicle)}
                              className="p-1.5 text-amber-600 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors cursor-pointer"
                              title="Modifier les informations"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete button (نقص المركبة) */}
                            <button
                              onClick={() => setVehicleToDelete(vehicle)}
                              className="p-1.5 text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                              title="Supprimer ce véhicule de la flotte"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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
        </div>
      ) : (
        /* ================= GPS RADAR / MAP VIEW (التتبع المباشر للأسطول) ================= */
        <div className="space-y-4">
          <div className="p-4 bg-slate-900 text-white rounded-2xl border border-slate-800 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Radio className="w-5 h-5 text-emerald-400 animate-pulse" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Radar GPS & Télémétrie des Véhicules en Temps Réel
                  </h3>
                  <p className="text-xs text-slate-400">
                    Positions satellites simulées pour Laâyoune, Casablanca, Rabat et Tanger
                  </p>
                </div>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-xs font-mono font-bold">
                {stats.enTournee} en circulation
              </span>
            </div>

            {/* Visual Grid of Vehicle Live Beacons */}
            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {filteredVehicles.map(vehicle => {
                const trk = vehicle.tracking;
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => setTrackingVehicle(vehicle)}
                    className="p-3.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 rounded-xl transition cursor-pointer group space-y-2.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-xs text-white bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                          {vehicle.plateNumber}
                        </span>
                        <span className="text-xs font-bold text-slate-300">
                          {vehicle.brand} {vehicle.model}
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-mono flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span>{trk?.speedKmH || 0} km/h</span>
                      </span>
                    </div>

                    <div className="text-xs text-slate-400 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-red-400 shrink-0" />
                        <span className="truncate">{trk?.locationName || vehicle.city || 'Maroc'}</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px]">
                        <span>Chauffeur : <strong className="text-white">{vehicle.driverName || 'N/A'}</strong></span>
                        <span className="font-mono text-slate-400">{vehicle.currentMileage || 0} km</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-700/60 flex items-center justify-between text-[10px] text-slate-400">
                      <span>Cap : {trk?.heading || 'Nord'}</span>
                      <span className="text-blue-400 group-hover:underline flex items-center gap-1">
                        <span>Ouvrir télémétrie</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================= LIVE TRACKING & TELEMETRY MODAL (التتبع ديال المركبة) ================= */}
      {trackingVehicle && (() => {
        const trk = trackingVehicle.tracking;
        const assignedDriver = drivers.find(d => d.id === trackingVehicle.driverId || d.name === trackingVehicle.driverName);
        const driverPackages = packages.filter(p => p.driverId === trackingVehicle.driverId && ['en_cours', 'en_distribution'].includes(p.status));

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
            <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
              {/* Header */}
              <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-red-600 text-white flex items-center justify-center font-bold shadow-xs">
                    <Radio className="w-5 h-5 animate-pulse" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-black text-sm bg-black px-2 py-0.5 rounded border border-slate-700 text-white">
                        {trackingVehicle.plateNumber}
                      </span>
                      <h3 className="text-base font-black text-white">
                        {trackingVehicle.brand} {trackingVehicle.model} ({trackingVehicle.year})
                      </h3>
                    </div>
                    <p className="text-xs text-slate-400">
                      Suivi GPS & Télémétrie en temps réel · {trackingVehicle.city || 'Maroc'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleRefreshGps(trackingVehicle.id)}
                    disabled={isRefreshingGps}
                    className="p-2 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition cursor-pointer disabled:opacity-50"
                    title="Actualiser la balise GPS"
                  >
                    <RefreshCw className={`w-4 h-4 ${isRefreshingGps ? 'animate-spin text-red-500' : ''}`} />
                  </button>
                  <button
                    onClick={() => setTrackingVehicle(null)}
                    className="p-2 text-slate-400 hover:text-white rounded-lg transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Visual Radar Card */}
                <div className="p-4 bg-linear-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl border border-slate-700 relative overflow-hidden shadow-inner">
                  <div className="absolute right-3 top-3 opacity-10">
                    <Navigation className="w-32 h-32" />
                  </div>

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
                        <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                          Signal GPS Actif — 12 Satellites
                        </span>
                      </div>
                      <h4 className="text-lg font-black text-white mt-1">
                        {trk?.locationName || `${trackingVehicle.city || 'Laâyoune'}, Maroc`}
                      </h4>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">
                        Lat: {trk?.latitude || '27.1536'} · Lng: {trk?.longitude || '-13.2033'}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="px-3.5 py-2 bg-white/10 rounded-xl border border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-300 block">Vitesse</span>
                        <span className="text-xl font-mono font-black text-white">
                          {trk?.speedKmH || 0} <span className="text-xs font-normal">km/h</span>
                        </span>
                      </div>
                      <div className="px-3.5 py-2 bg-white/10 rounded-xl border border-white/10 text-center">
                        <span className="text-[10px] uppercase font-bold text-slate-300 block">Cap</span>
                        <span className="text-sm font-bold text-emerald-300 mt-1 block">
                          {trk?.heading || 'Nord'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                    <span>Contact : <strong className={trk?.ignition ? 'text-emerald-400' : 'text-slate-400'}>{trk?.ignition ? 'Moteur en marche (Contact ON)' : 'Contact coupé (Arrêt)'}</strong></span>
                    <span>Dernière mise à jour : <strong className="text-slate-200">{trk?.lastUpdated || 'À l\'instant'}</strong></span>
                  </div>
                </div>

                {/* Telemetry Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                      <Gauge className="w-3.5 h-3.5 text-slate-400" />
                      <span>Kilométrage</span>
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                      {trackingVehicle.currentMileage ? trackingVehicle.currentMileage.toLocaleString() : '0'} km
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                      <Fuel className="w-3.5 h-3.5 text-amber-500" />
                      <span>Carburant</span>
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                      {trackingVehicle.fuelLevel ?? 75}%
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                      <Package className="w-3.5 h-3.5 text-red-500" />
                      <span>Colis à bord</span>
                    </span>
                    <span className="text-base font-black font-mono text-slate-900 mt-1 block">
                      {driverPackages.length} colis
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[10px] text-slate-500 uppercase font-bold block flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Assurance</span>
                    </span>
                    <span className="text-xs font-bold text-emerald-700 mt-1 block">
                      {trackingVehicle.insuranceExpiry || 'Valide 2027'}
                    </span>
                  </div>
                </div>

                {/* Assigned Driver Card */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center font-bold">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Livreur assigné</span>
                      <h5 className="text-xs font-bold text-slate-900">
                        {trackingVehicle.driverName || 'Aucun livreur actuellement assigné'}
                      </h5>
                      <span className="text-xs text-slate-500 font-mono">{trackingVehicle.driverPhone || '—'}</span>
                    </div>
                  </div>

                  {trackingVehicle.driverPhone && (
                    <a
                      href={`tel:${trackingVehicle.driverPhone}`}
                      className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition flex items-center gap-1.5"
                    >
                      <Phone className="w-3.5 h-3.5" />
                      <span>Appeler</span>
                    </a>
                  )}
                </div>

                {/* Maintenance & Inspections */}
                <div className="p-4 bg-amber-50/50 border border-amber-200/80 rounded-xl space-y-2 text-xs">
                  <h5 className="font-bold text-amber-950 flex items-center gap-1.5">
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>Rappels d'entretien & Visites techniques</span>
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-slate-700 pt-1">
                    <div>
                      <span className="text-slate-500 block text-[11px]">Prochaine vidange :</span>
                      <strong className="font-mono">{trackingVehicle.nextVidangeMileage ? `${trackingVehicle.nextVidangeMileage.toLocaleString()} km` : 'Dans 5 000 km'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Visite technique :</span>
                      <strong className="font-mono">{trackingVehicle.technicalVisitExpiry || '2027-05-10'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">Vignette fiscale :</span>
                      <strong className="font-mono">{trackingVehicle.vignetteExpiry || '2027-01-31'}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
                <button
                  onClick={() => handleRefreshGps(trackingVehicle.id)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition flex items-center gap-1.5 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingGps ? 'animate-spin text-red-600' : ''}`} />
                  <span>Actualiser position GPS</span>
                </button>

                <button
                  onClick={() => setTrackingVehicle(null)}
                  className="px-4 py-2 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 rounded-xl transition cursor-pointer"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================= QUICK EDIT MODAL ================= */}
      {editingVehicle && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-amber-600" />
                <span>Modifier le véhicule {editingVehicle.plateNumber}</span>
              </h3>
              <button onClick={() => setEditingVehicle(null)} className="p-1.5 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickEdit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Statut du véhicule</label>
                <select
                  value={editStatus}
                  onChange={e => setEditStatus(e.target.value as VehicleStatus)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white"
                >
                  <option value="actif">Actif (Disponible)</option>
                  <option value="en_tournee">En tournée (Sur le terrain)</option>
                  <option value="maintenance">En maintenance (Garage)</option>
                  <option value="hors_service">Hors service (Arrêt)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Chauffeur / Livreur assigné</label>
                <select
                  value={editDriverId}
                  onChange={e => setEditDriverId(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 focus:bg-white"
                >
                  <option value="">Aucun chauffeur (Non assigné)</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.city || 'Maroc'}) - {d.phone}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kilométrage actuel (km)</label>
                  <input
                    type="number"
                    value={editMileage}
                    onChange={e => setEditMileage(e.target.value)}
                    placeholder="28000"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Ville / Hub</label>
                  <input
                    type="text"
                    value={editCity}
                    onChange={e => setEditCity(e.target.value)}
                    placeholder="Laâyoune"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900"
                  />
                </div>
              </div>

              <div className="pt-2 border-t flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingVehicle(null)}
                  className="px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Enregistrer les modifications
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= DELETE CONFIRMATION MODAL (نقص المركبة) ================= */}
      {vehicleToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="Suppression de véhicule (نقص المركبة)"
          message={`Êtes-vous certain de vouloir supprimer définitivement le véhicule immatriculé ${vehicleToDelete.plateNumber} (${vehicleToDelete.brand} ${vehicleToDelete.model}) de la flotte FARIOUSY ?`}
          confirmLabel="Supprimer définitivement"
          isDestructive={true}
          requireReason={true}
          onConfirm={handleConfirmDelete}
          onCancel={() => setVehicleToDelete(null)}
        />
      )}
    </div>
  );
};
