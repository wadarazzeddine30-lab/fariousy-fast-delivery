import React, { useRef, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { ClientStockInvoice, ClientStockProduct, PackageItem, StockLocationItem } from '../../types';
import { formatMAD, formatDate, formatDateTime } from '../../utils/barcode';
import { exportCSV } from '../../utils/export';
import { compressImageFileToDataUrl } from '../../utils/imageCompress';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import { StockInvoiceModal } from '../client/StockInvoiceModal';
import {
  Warehouse,
  Scan,
  AlertTriangle,
  ArrowRightLeft,
  Building2,
  PackageCheck,
  Clock,
  Search,
  Filter,
  Plus,
  Edit2,
  Trash2,
  Download,
  MapPin,
  CheckCircle2,
  Layers,
  X,
  Boxes,
  FileText,
  QrCode,
  AlertCircle,
  ImagePlus,
  Truck
} from 'lucide-react';

interface AdminStockProps {
  onOpenScanner: (agencyName?: string) => void;
  onViewPackage: (pkg: PackageItem) => void;
  focusSearchNonce?: number;
}

export const AdminStock: React.FC<AdminStockProps> = ({
  onOpenScanner,
  onViewPackage,
  focusSearchNonce
}) => {
  const {
    packages,
    agencies,
    users,
    stockLocations,
    addStockLocation,
    updateStockLocation,
    deleteStockLocation,
    moveStockLocation,
    transferPackageAgency,
    addAuditLog,
    clientStockProducts,
    clientStockInvoices,
    scanClientStockUnit,
    createClientStockProduct,
    dispatchClientStockUnit,
    deleteClientStockProduct
  } = useDatabase();
  const { currentUser } = useAuth();

  const clients = users.filter(u => u.role === 'client');
  const [selectedClientFilter, setSelectedClientFilter] = useState<string>('all');
  const [selectedAgency, setSelectedAgency] = useState(() => agencies[0]?.name || 'Hub Central Casablanca');
  const [stockSearch, setStockSearch] = useState('');
  const stockSearchRef = useRef<HTMLInputElement | null>(null);
  React.useEffect(() => {
    if (agencies.length > 0 && !agencies.some(a => a.name.toLowerCase() === selectedAgency.toLowerCase())) {
      setSelectedAgency(agencies[0].name);
    }
  }, [agencies, selectedAgency]);
  React.useEffect(() => {
    if (focusSearchNonce) {
      setTimeout(() => stockSearchRef.current?.focus(), 60);
    }
  }, [focusSearchNonce]);
  const [showStationaryOnly, setShowStationaryOnly] = useState(false);
  const [activeTab, setActiveTab] = useState<'inventory' | 'locations' | 'stationary' | 'client_stock'>('inventory');

  // Client stock scan-in & invoice modal state
  const [clientScanCode, setClientScanCode] = useState('');
  const [clientScanZone, setClientScanZone] = useState('Zone Fulfillment A');
  const [clientScanShelf, setClientScanShelf] = useState('Rayon 01');
  const [clientScanBin, setClientScanBin] = useState('Bac F1');
  const [isScanningClientStock, setIsScanningClientStock] = useState(false);
  const [clientScanFeedback, setClientScanFeedback] = useState<{ success: boolean; message: string } | null>(null);
  const [selectedStockInvoice, setSelectedStockInvoice] = useState<ClientStockInvoice | null>(null);

  // Admin: Add Stock For Specific Client Modal State
  const [showAddClientStockModal, setShowAddClientStockModal] = useState(false);
  const [newStockClientId, setNewStockClientId] = useState<string>('');
  const [newStockName, setNewStockName] = useState('');
  const [newStockQty, setNewStockQty] = useState<number>(10);
  const [newStockPrice, setNewStockPrice] = useState<number>(150);
  const [newStockCategory, setNewStockCategory] = useState('');
  const [newStockPhoto, setNewStockPhoto] = useState('');
  const [isSavingClientStock, setIsSavingClientStock] = useState(false);
  const [clientStockFormError, setClientStockFormError] = useState<string | null>(null);
  const clientStockPhotoRef = useRef<HTMLInputElement | null>(null);

  // Modal states
  const [showAddLocationModal, setShowAddLocationModal] = useState(false);
  const [editingLocation, setEditingLocation] = useState<StockLocationItem | null>(null);
  const [locationToDelete, setLocationToDelete] = useState<StockLocationItem | null>(null);
  const [clientProductToDelete, setClientProductToDelete] = useState<ClientStockProduct | null>(null);
  const [movingLocation, setMovingLocation] = useState<StockLocationItem | null>(null);

  // Form states
  const [pkgTracking, setPkgTracking] = useState('');
  const [hubName, setHubName] = useState(selectedAgency);
  const [zone, setZone] = useState('Zone A (Nord)');
  const [shelf, setShelf] = useState('Rayon 01');
  const [bin, setBin] = useState('Bac 10');
  const [notes, setNotes] = useState('');

  // Move location form
  const [newZone, setNewZone] = useState('Zone B (Sud)');
  const [newShelf, setNewShelf] = useState('Rayon 02');
  const [newBin, setNewBin] = useState('Bac 05');
  const [moveReason, setMoveReason] = useState('Réorganisation magasin logistique');

  // Agency packages in stock
  const agencyStockPackages = packages.filter(p => {
    const isAgency = p.currentAgency.toLowerCase() === selectedAgency.toLowerCase();
    const inStockStatus = ['en_stock', 'nouveau', 'arrive_destination', 'retour_en_cours'].includes(p.status);
    return isAgency && inStockStatus;
  });

  // Stationary packages: packages that haven't moved for more than 48h
  const nowTime = new Date().getTime();
  const stationaryThresholdMs = 48 * 60 * 60 * 1000;

  const stationaryPackages = agencyStockPackages.filter(p => {
    const lastMoved = new Date(p.lastMovedAt || p.createdAt).getTime();
    return nowTime - lastMoved > stationaryThresholdMs;
  });

  const selectedFilterClientObj = clients.find(c => c.id === selectedClientFilter);
  const matchesSelectedClientFilter = (item: { clientId?: string; shopId?: string }) => {
    if (selectedClientFilter === 'all') return true;
    if (!item.clientId && !item.shopId) return false;
    const filterShopId = (selectedFilterClientObj as any)?.shopId;
    if (item.clientId && item.clientId === selectedClientFilter) return true;
    if (filterShopId && item.clientId === filterShopId) return true;
    if (item.shopId && item.shopId === selectedClientFilter) return true;
    if (filterShopId && item.shopId === filterShopId) return true;
    return false;
  };

  const displayedPackages = agencyStockPackages
    .filter(p => !showStationaryOnly || stationaryPackages.some(sp => sp.id === p.id))
    .filter(p => {
      if (!matchesSelectedClientFilter(p)) return false;
      if (!stockSearch) return true;
      return (
        p.trackingNumber.toLowerCase().includes(stockSearch.toLowerCase()) ||
        p.recipientName.toLowerCase().includes(stockSearch.toLowerCase()) ||
        p.city.toLowerCase().includes(stockSearch.toLowerCase()) ||
        (p.clientCompany && p.clientCompany.toLowerCase().includes(stockSearch.toLowerCase()))
      );
    });

  const displayedLocations = stockLocations.filter(loc => {
    const matchesHub = loc.hubName.toLowerCase() === selectedAgency.toLowerCase();
    if (!matchesSelectedClientFilter(loc)) return false;
    const matchesSearch =
      !stockSearch ||
      loc.trackingNumber.toLowerCase().includes(stockSearch.toLowerCase()) ||
      loc.zone.toLowerCase().includes(stockSearch.toLowerCase()) ||
      loc.shelf.toLowerCase().includes(stockSearch.toLowerCase()) ||
      (loc.clientCompany && loc.clientCompany.toLowerCase().includes(stockSearch.toLowerCase()));
    return matchesHub && matchesSearch;
  });

  const handleCreateStockLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pkgTracking.trim()) {
      return;
    }

    const cleanTracking = pkgTracking.trim().toUpperCase();
    const pkg = packages.find(p => p.trackingNumber.toUpperCase() === cleanTracking);

    addStockLocation({
      packageId: pkg ? pkg.id : `pkg-${Date.now()}`,
      trackingNumber: cleanTracking,
      hubName: selectedAgency,
      zone,
      shelf,
      bin,
      status: 'en_stock',
      notes,
      clientId: pkg?.clientId,
      clientName: pkg?.clientName,
      clientCompany: pkg?.clientCompany,
      clientPhone: pkg?.clientPhone,
      recipientName: pkg?.recipientName,
      destinationCity: pkg?.city,
      codAmount: pkg?.codAmount
    });

    setShowAddLocationModal(false);
    setPkgTracking('');
    setNotes('');
  };

  const handleConfirmMoveLocation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!movingLocation) return;

    moveStockLocation(movingLocation.id, newZone, newShelf, newBin, moveReason);
    setMovingLocation(null);
  };

  const handleConfirmDeleteLocation = (reason?: string) => {
    if (!locationToDelete) return;
    deleteStockLocation(locationToDelete.id, reason || 'Retrait stock');
    setLocationToDelete(null);
  };

  const handleExportStockCSV = () => {
    const data = displayedPackages.map(p => {
      const loc = stockLocations.find(l => l.packageId === p.id || l.trackingNumber === p.trackingNumber);
      return {
        Tracking: p.trackingNumber,
        Destinataire: p.recipientName,
        Ville_Destination: p.city,
        Montant_COD: p.codAmount,
        Statut: p.status,
        Hub_Actuel: p.currentAgency,
        Zone: loc?.zone || 'Non assigné',
        Rayon: loc?.shelf || 'Non assigné',
        Bac: loc?.bin || 'Non assigné',
        Dernier_Mouvement: formatDate(p.lastMovedAt || p.createdAt)
      };
    });
    exportCSV(data, `fariousy_inventaire_stock_${new Date().toISOString().substring(0, 10)}.csv`);
  };

  // Client Fulfillment Stock filtering (strict ID/shopId isolation)
  const filteredClientProducts = clientStockProducts.filter(prod => {
    if (!matchesSelectedClientFilter(prod)) return false;
    if (!stockSearch) return true;
    const q = stockSearch.toLowerCase();
    return (
      prod.name.toLowerCase().includes(q) ||
      prod.skuCode.toLowerCase().includes(q) ||
      (prod.clientName && prod.clientName.toLowerCase().includes(q)) ||
      (prod.clientCompany && prod.clientCompany.toLowerCase().includes(q)) ||
      prod.units.some(u => u.unitCode.toLowerCase().includes(q))
    );
  });

  const filteredClientInvoices = clientStockInvoices.filter(inv => {
    if (!matchesSelectedClientFilter(inv)) return false;
    if (!stockSearch) return true;
    const q = stockSearch.toLowerCase();
    return (
      inv.invoiceNumber.toLowerCase().includes(q) ||
      inv.trackingNumber.toLowerCase().includes(q) ||
      inv.clientName.toLowerCase().includes(q) ||
      (inv.clientCompany && inv.clientCompany.toLowerCase().includes(q))
    );
  });

  const handleScanClientUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = clientScanCode.trim().toUpperCase();
    if (!clean) return;
    setIsScanningClientStock(true);
    setClientScanFeedback(null);
    const res = await scanClientStockUnit(clean, {
      hubName: selectedAgency,
      zone: clientScanZone,
      shelf: clientScanShelf,
      bin: clientScanBin,
      actorName: currentUser?.name || 'Admin Hub'
    });
    setClientScanFeedback({ success: res.success, message: res.message });
    if (res.success) setClientScanCode('');
    setIsScanningClientStock(false);
  };

  const handleConfirmAllPendingUnits = async (productId: string) => {
    setIsScanningClientStock(true);
    setClientScanFeedback(null);
    const res = await scanClientStockUnit(productId, {
      hubName: selectedAgency,
      zone: clientScanZone,
      shelf: clientScanShelf,
      bin: clientScanBin,
      actorName: currentUser?.name || 'Admin Hub',
      scanAllPending: true
    });
    setClientScanFeedback({ success: res.success, message: res.message });
    setIsScanningClientStock(false);
  };

  const handleDispatchOneUnit = async (unitCode: string, ownerClientId: string) => {
    setIsScanningClientStock(true);
    setClientScanFeedback(null);
    const res = await dispatchClientStockUnit(unitCode, {
      clientId: ownerClientId,
      actorName: currentUser?.name || 'Admin Hub',
      notes: 'إخراج قطعة من المخزن (Admin Stock)'
    });
    setClientScanFeedback({ success: res.success, message: res.message });
    setIsScanningClientStock(false);
  };

  const handleAdminCreateClientStock = async (e: React.FormEvent) => {
    e.preventDefault();
    setClientStockFormError(null);
    const targetClient = clients.find(c => c.id === newStockClientId);
    if (!targetClient) {
      setClientStockFormError('يرجى اختيار الزبون (التاجر) أولاً.');
      return;
    }
    if (!newStockName.trim()) {
      setClientStockFormError('يرجى إدخال اسم المنتوج.');
      return;
    }
    if (!newStockQty || newStockQty < 1 || newStockQty > 500) {
      setClientStockFormError('الكمية يجب أن تكون بين 1 و 500.');
      return;
    }

    setIsSavingClientStock(true);
    const res = await createClientStockProduct({
      clientId: targetClient.id,
      clientName: targetClient.name,
      clientCompany: targetClient.companyName,
      name: newStockName.trim(),
      photoUrl: newStockPhoto || undefined,
      category: newStockCategory.trim() || undefined,
      unitPrice: Number(newStockPrice) || 0,
      quantity: Number(newStockQty),
      hubName: selectedAgency,
      actorName: currentUser?.name || 'Admin Hub'
    });
    setIsSavingClientStock(false);

    if (!res.success) {
      setClientStockFormError(res.error || 'تعذر حفظ السطوك للزبون.');
      return;
    }

    if (selectedClientFilter !== 'all' && selectedClientFilter !== targetClient.id) {
      setSelectedClientFilter('all');
    }
    setNewStockName('');
    setNewStockQty(10);
    setNewStockPrice(150);
    setNewStockCategory('');
    setNewStockPhoto('');
    setShowAddClientStockModal(false);
    setClientScanFeedback({
      success: true,
      message: `تم إضافة "${res.product?.name}" خصيصاً لمتجر ${targetClient.companyName || targetClient.name}.`
    });
  };

  return (
    <div className="space-y-5">
      {/* Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Gestion du Stock Logistique & Emplacements Hub
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Inventaire physique, zoning des rayons/bacs, traçabilité des mouvements et alertes colis immobilisés
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleExportStockCSV}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-slate-600" />
            <span>Exporter Inventaire</span>
          </button>

          <button
            onClick={() => setShowAddLocationModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-red-400" />
            <span>Assigner Emplacement</span>
          </button>

          <button
            onClick={() => onOpenScanner(selectedAgency)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Scan className="w-4 h-4" />
            <span>سكان {selectedAgency}</span>
          </button>
        </div>
      </div>

      {/* Agency Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
        {agencies.map(agency => {
          const count = packages.filter(
            p =>
              p.currentAgency.toLowerCase() === agency.name.toLowerCase() &&
              ['en_stock', 'nouveau', 'arrive_destination', 'retour_en_cours'].includes(p.status)
          ).length;
          return (
            <button
              key={agency.id}
              onClick={() => setSelectedAgency(agency.name)}
              className={`px-3.5 py-2 rounded-xl font-bold transition-all shrink-0 flex items-center gap-2 cursor-pointer ${
                selectedAgency.toLowerCase() === agency.name.toLowerCase()
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              <Warehouse className="w-3.5 h-3.5 text-red-500" />
              <span>{agency.name}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                  selectedAgency.toLowerCase() === agency.name.toLowerCase()
                    ? 'bg-red-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Stock Subtabs & Search */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 border border-slate-200 rounded-2xl shadow-2xs">
        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
          <button
            onClick={() => setActiveTab('inventory')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'inventory'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Inventaire Colis ({displayedPackages.length})
          </button>
          <button
            onClick={() => setActiveTab('client_stock')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'client_stock'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-emerald-800 bg-emerald-50 hover:bg-emerald-100'
            }`}
          >
            <Boxes className="w-3.5 h-3.5" />
            <span>سطوك الزبائن & الفواتير ({clientStockProducts.length})</span>
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
              activeTab === 'locations'
                ? 'bg-red-600 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Rayonnage & Bacs ({displayedLocations.length})
          </button>
          <button
            onClick={() => setActiveTab('stationary')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'stationary'
                ? 'bg-amber-600 text-white'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Immobilisés &gt; 48h ({stationaryPackages.length})</span>
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          {/* Client Filter Dropdown */}
          <select
            value={selectedClientFilter}
            onChange={e => setSelectedClientFilter(e.target.value)}
            className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">Tous les commerçants (Clients)</option>
            {clients.map(c => (
              <option key={c.id} value={c.id}>
                {c.companyName || c.name}
              </option>
            ))}
          </select>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              ref={stockSearchRef}
              type="text"
              value={stockSearch}
              onChange={e => setStockSearch(e.target.value)}
              placeholder="Rechercher par N° suivi, zone..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>

      {/* ================= TAB 1: INVENTAIRE ================= */}
      {activeTab === 'inventory' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">N° Suivi</th>
                  <th className="px-5 py-3">Destinataire & Ville</th>
                  <th className="px-5 py-3">Montant COD</th>
                  <th className="px-5 py-3">Statut Logistique</th>
                  <th className="px-5 py-3">Emplacement Rayon</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedPackages.map(pkg => {
                  const loc = stockLocations.find(
                    l => l.packageId === pkg.id || l.trackingNumber === pkg.trackingNumber
                  );
                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono font-bold text-slate-900">
                        {pkg.trackingNumber}
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-800 block">{pkg.recipientName}</span>
                        <span className="text-[11px] text-slate-500">{pkg.city}</span>
                      </td>
                      <td className="px-5 py-3 font-mono font-black text-slate-900">
                        {formatMAD(pkg.codAmount)}
                      </td>
                      <td className="px-5 py-3">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 uppercase">
                          {pkg.status}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        {loc ? (
                          <div className="flex items-center gap-1.5 text-[11px]">
                            <Layers className="w-3.5 h-3.5 text-blue-600" />
                            <span className="font-bold text-slate-900">{loc.zone}</span>
                            <span className="text-slate-400">/</span>
                            <span className="font-mono text-slate-700">{loc.shelf}</span>
                            <span className="text-slate-400">/</span>
                            <span className="font-mono text-slate-700">{loc.bin}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non assigné</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => onViewPackage(pkg)}
                          className="px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                        >
                          Détails
                        </button>
                      </td>
                    </tr>
                  );
                })}
                {displayedPackages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucun colis en stock pour ce hub.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 2: RAYONNAGE & BACS ================= */}
      {activeTab === 'locations' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px] tracking-wider">
                <tr>
                  <th className="px-5 py-3">N° Suivi Colis</th>
                  <th className="px-5 py-3">Zone de Stockage</th>
                  <th className="px-5 py-3">Rayon</th>
                  <th className="px-5 py-3">Bac / Casier</th>
                  <th className="px-5 py-3">Dernière Mise à Jour</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {displayedLocations.map(loc => (
                  <tr key={loc.id} className="hover:bg-slate-50/70">
                    <td className="px-5 py-3 font-mono font-bold text-slate-900">
                      {loc.trackingNumber}
                    </td>
                    <td className="px-5 py-3 font-bold text-blue-700">{loc.zone}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{loc.shelf}</td>
                    <td className="px-5 py-3 font-mono font-semibold text-slate-800">{loc.bin}</td>
                    <td className="px-5 py-3 text-[11px] text-slate-500 font-mono">
                      {formatDate(loc.lastAuditedAt || loc.enteredAt || '')}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setMovingLocation(loc);
                            setNewZone(loc.zone);
                            setNewShelf(loc.shelf);
                            setNewBin(loc.bin);
                          }}
                          className="px-2.5 py-1 text-xs font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg flex items-center gap-1 cursor-pointer"
                        >
                          <ArrowRightLeft className="w-3.5 h-3.5" />
                          <span>Déplacer</span>
                        </button>
                        <button
                          onClick={() => setLocationToDelete(loc)}
                          className="p-1 text-slate-400 hover:text-rose-600 rounded"
                          title="Supprimer ou corriger l'entrée"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {displayedLocations.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Aucun emplacement zoné pour ce hub.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 3: STATIONARY > 48H ================= */}
      {activeTab === 'stationary' && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs p-4 space-y-4">
          <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <span className="font-bold block">Alerte d'Immobilisation Magasin</span>
              <span>
                Ces colis séjournent depuis plus de 48 heures dans ce hub sans changement de statut. Une relance ou réexpédition est requise.
              </span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2.5">N° Suivi</th>
                  <th className="px-4 py-2.5">Destinataire</th>
                  <th className="px-4 py-2.5">Ville</th>
                  <th className="px-4 py-2.5">Statut Actuel</th>
                  <th className="px-4 py-2.5 text-right">Action Immédiate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stationaryPackages.map(pkg => (
                  <tr key={pkg.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{pkg.recipientName}</td>
                    <td className="px-4 py-2.5 text-slate-600">{pkg.city}</td>
                    <td className="px-4 py-2.5 font-semibold text-amber-700">{pkg.status}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        onClick={() => onViewPackage(pkg)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white font-bold rounded-lg cursor-pointer"
                      >
                        Traiter Colis
                      </button>
                    </td>
                  </tr>
                ))}
                {stationaryPackages.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-slate-400">
                      Aucun colis n'est actuellement en situation de blocage.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ================= TAB 4: CLIENT FULFILLMENT STOCK & INVOICES ================= */}
      {activeTab === 'client_stock' && (
        <div className="space-y-5">
          {/* Fast Barcode Scan-In Card */}
          <div className="bg-white border border-emerald-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    سكان دخول سطوك الزبائن (Scanner Douchette / Code Unité FSU)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    سكان كود القطعة (FSU-...) أو كود المنتوج (SKU-...) باش يتحط مباشرة فالسطوك ويتفعل للتاجر
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700">
                Hub: {selectedAgency}
              </span>
            </div>

            <form onSubmit={handleScanClientUnit} className="grid grid-cols-1 md:grid-cols-12 gap-2.5 items-end">
              <div className="md:col-span-5">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  كود الباركود (FSU-... أو SKU-...) *
                </label>
                <input
                  type="text"
                  value={clientScanCode}
                  onChange={e => setClientScanCode(e.target.value)}
                  placeholder="Ex: FSU-261114-XXXX-001"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Zone</label>
                <input
                  type="text"
                  value={clientScanZone}
                  onChange={e => setClientScanZone(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Rayon</label>
                <input
                  type="text"
                  value={clientScanShelf}
                  onChange={e => setClientScanShelf(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="md:col-span-1">
                <label className="block text-[11px] font-bold text-slate-700 mb-1">Bac</label>
                <input
                  type="text"
                  value={clientScanBin}
                  onChange={e => setClientScanBin(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isScanningClientStock || !clientScanCode.trim()}
                  className="w-full px-3 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Scan className="w-4 h-4" />
                  <span>تأكيد السكان</span>
                </button>
              </div>
            </form>

            {clientScanFeedback && (
              <div
                className={`p-3 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                  clientScanFeedback.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-rose-50 border-rose-200 text-rose-900'
                }`}
              >
                {clientScanFeedback.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{clientScanFeedback.message}</span>
              </div>
            )}
          </div>

          {/* Client Products Stock Grid */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <Boxes className="w-4 h-4 text-emerald-600" />
                <span>منتوجات وسطوك الزبائن ({filteredClientProducts.length})</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setClientStockFormError(null);
                  setNewStockClientId(
                    selectedClientFilter !== 'all' ? selectedClientFilter : clients[0]?.id || ''
                  );
                  setShowAddClientStockModal(true);
                }}
                className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة سطوك لزبون محدد</span>
              </button>
            </div>

            {filteredClientProducts.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-400">
                لا توجد منتوجات مخزنة لهذا الزبون حالياً.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredClientProducts.map(prod => {
                  const pendingUnits = prod.units.filter(u => u.status === 'en_attente');
                  const inStockUnits = prod.units.filter(u => u.status === 'en_stock');
                  const shippedUnits = prod.units.filter(u => u.status === 'expedie');
                  return (
                    <div
                      key={prod.id}
                      className="border border-slate-200 rounded-2xl p-3.5 bg-slate-50/60 flex flex-col justify-between gap-3"
                    >
                      <div className="flex items-start gap-3">
                        {prod.photoUrl ? (
                          <img
                            src={prod.photoUrl}
                            alt={prod.name}
                            className="w-16 h-16 rounded-xl object-cover border border-slate-200 shrink-0 bg-white"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-xl bg-slate-200/70 flex items-center justify-center shrink-0">
                            <Boxes className="w-7 h-7 text-slate-400" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="font-black text-sm text-slate-900 truncate">{prod.name}</div>
                            <button
                              type="button"
                              onClick={() => setClientProductToDelete(prod)}
                              title="حذف المنتوج من السطوك"
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-[11px] font-bold text-slate-600 truncate">
                            {prod.clientCompany || prod.clientName}
                          </div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5">{prod.skuCode}</div>
                          <div className="text-xs font-mono font-black text-emerald-700 mt-1">
                            {formatMAD(prod.unitPrice)}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
                        <div className="bg-amber-50 border border-amber-200 rounded-lg py-1.5">
                          <div className="font-mono font-black text-amber-800">{pendingUnits.length}</div>
                          <div className="text-[9px] font-bold text-amber-700">قيد الانتظار</div>
                        </div>
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg py-1.5">
                          <div className="font-mono font-black text-emerald-800">{inStockUnits.length}</div>
                          <div className="text-[9px] font-bold text-emerald-700">فالسطوك</div>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg py-1.5">
                          <div className="font-mono font-black text-blue-800">{shippedUnits.length}</div>
                          <div className="text-[9px] font-bold text-blue-700">مُخرج</div>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1.5">
                        {pendingUnits.length > 0 ? (
                          <button
                            type="button"
                            disabled={isScanningClientStock}
                            onClick={() => handleConfirmAllPendingUnits(prod.id)}
                            className="w-full py-2 px-3 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>تأكيد سكان الكل للسطوك ({pendingUnits.length})</span>
                          </button>
                        ) : (
                          <div className="text-center text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl py-1.5">
                            جميع القطع مسكانية ومنظمة فالسطوك
                          </div>
                        )}

                        {inStockUnits.length > 0 && (
                          <button
                            type="button"
                            disabled={isScanningClientStock}
                            onClick={() => handleDispatchOneUnit(inStockUnits[0].unitCode, prod.clientId)}
                            className="w-full py-1.5 px-3 rounded-xl text-[11px] font-bold bg-slate-900 hover:bg-red-600 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Truck className="w-3.5 h-3.5" />
                            <span>إخراج قطعة (-1) من السطوك</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Client Stock Auto-Invoices Table */}
          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-red-600" />
                <span>فواتير السطوك التلقائية ({filteredClientInvoices.length})</span>
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-2.5">N° Facture</th>
                    <th className="px-4 py-2.5">Client / Boutique</th>
                    <th className="px-4 py-2.5">Colis Tracking</th>
                    <th className="px-4 py-2.5">Articles & Qté</th>
                    <th className="px-4 py-2.5">Total Valeur</th>
                    <th className="px-4 py-2.5">Statut</th>
                    <th className="px-4 py-2.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredClientInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-mono font-bold text-slate-900">{inv.invoiceNumber}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-800 block">{inv.clientCompany || inv.clientName}</span>
                        <span className="text-[10px] text-slate-500">{formatDateTime(inv.createdAt)}</span>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-bold text-red-700">{inv.trackingNumber}</td>
                      <td className="px-4 py-2.5">
                        <span className="font-bold text-slate-900">{inv.totalQuantity} unité(s)</span>
                        <span className="text-[10px] text-slate-500 block">
                          {inv.items.map(i => `${i.productName} ×${i.quantity}`).join(', ')}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono font-black text-slate-900">
                        {formatMAD(inv.productsValue)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            inv.status === 'payee'
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {inv.status === 'payee' ? 'Payée / Validée' : 'Générée'}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => setSelectedStockInvoice(inv)}
                          className="px-3 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
                        >
                          عرض / طباعة
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filteredClientInvoices.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        لا توجد فواتير سطوك مولدة تلقائياً بعد.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Add Stock Location */}
      {showAddLocationModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <Warehouse className="w-4 h-4 text-red-600" />
                <span>Assigner un Colis au Rayonnage Hub</span>
              </h3>
              <button
                onClick={() => setShowAddLocationModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateStockLocation} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">N° de Suivi Colis *</label>
                <input
                  type="text"
                  required
                  value={pkgTracking}
                  onChange={e => setPkgTracking(e.target.value)}
                  placeholder="Ex: FAR-2026-98124"
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Hub Logistique</label>
                <input
                  type="text"
                  disabled
                  value={selectedAgency}
                  className="w-full px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-600 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Zone</label>
                  <input
                    type="text"
                    required
                    value={zone}
                    onChange={e => setZone(e.target.value)}
                    placeholder="Zone A"
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rayon</label>
                  <input
                    type="text"
                    required
                    value={shelf}
                    onChange={e => setShelf(e.target.value)}
                    placeholder="Rayon 01"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Bac / Casier</label>
                  <input
                    type="text"
                    required
                    value={bin}
                    onChange={e => setBin(e.target.value)}
                    placeholder="Bac 10"
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Notes / Instructions de stockage</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Marchandise fragile, colis volumineux..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddLocationModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Enregistrer l'emplacement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Move Stock Location */}
      {movingLocation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                <ArrowRightLeft className="w-4 h-4 text-cyan-600" />
                <span>Déplacer le Colis {movingLocation.trackingNumber}</span>
              </h3>
              <button
                onClick={() => setMovingLocation(null)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleConfirmMoveLocation} className="p-6 space-y-4">
              <div className="p-3 bg-slate-50 rounded-xl text-xs space-y-1">
                <span className="text-slate-400 block">Emplacement d'origine :</span>
                <span className="font-bold text-slate-800">
                  {movingLocation.zone} — {movingLocation.shelf} — {movingLocation.bin}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nouvelle Zone</label>
                  <input
                    type="text"
                    required
                    value={newZone}
                    onChange={e => setNewZone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nouveau Rayon</label>
                  <input
                    type="text"
                    required
                    value={newShelf}
                    onChange={e => setNewShelf(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nouveau Bac</label>
                  <input
                    type="text"
                    required
                    value={newBin}
                    onChange={e => setNewBin(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Motif du déplacement *</label>
                <input
                  type="text"
                  required
                  value={moveReason}
                  onChange={e => setMoveReason(e.target.value)}
                  placeholder="Ex: Préparation tournée matin, tri par ville..."
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setMovingLocation(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold text-white bg-cyan-600 hover:bg-cyan-700 rounded-xl shadow-xs cursor-pointer"
                >
                  Valider le transfert d'emplacement
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Correction Confirmation Modal */}
      {locationToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="Correction / Retrait d'Emplacement Stock"
          message={`Êtes-vous sûr de vouloir retirer le colis ${locationToDelete.trackingNumber} de l'emplacement ${locationToDelete.zone} / ${locationToDelete.shelf} / ${locationToDelete.bin} ?`}
          confirmLabel="Confirmer le retrait"
          isDestructive={true}
          requireReason={false}
          onConfirm={handleConfirmDeleteLocation}
          onCancel={() => setLocationToDelete(null)}
        />
      )}

      {/* Delete Client Stock Product Confirmation Modal */}
      {clientProductToDelete && (
        <ConfirmActionModal
          isOpen={true}
          title="حذف منتوج من سطوك الزبون"
          message={`هل تريد حذف "${clientProductToDelete.name}" (${clientProductToDelete.clientCompany || clientProductToDelete.clientName}) من السطوك نهائياً؟`}
          confirmLabel="نعم، حذف من السطوك"
          cancelLabel="إلغاء"
          isDestructive={true}
          requireReason={false}
          onConfirm={async () => {
            const target = clientProductToDelete;
            setClientProductToDelete(null);
            const res = await deleteClientStockProduct(target.id);
            setClientScanFeedback({
              success: res.success,
              message: res.success
                ? `تم حذف "${target.name}" من سطوك ${target.clientCompany || target.clientName} بنجاح.`
                : res.error || 'تعذر حذف المنتوج من السطوك.'
            });
          }}
          onCancel={() => setClientProductToDelete(null)}
        />
      )}

      <StockInvoiceModal
        invoice={selectedStockInvoice}
        isOpen={Boolean(selectedStockInvoice)}
        onClose={() => setSelectedStockInvoice(null)}
        canMarkPaid={true}
      />

      {/* Admin: Add Stock For Specific Client Modal */}
      {showAddClientStockModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-black">إضافة سطوك لزبون محدد</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddClientStockModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdminCreateClientStock} className="p-5 overflow-y-auto space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  اختر الزبون (صاحب السطوك) *
                </label>
                <select
                  required
                  value={newStockClientId}
                  onChange={e => setNewStockClientId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-900"
                >
                  <option value="">-- اختر التاجر --</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.companyName || c.name} ({c.city || 'Maroc'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">صورة المنتوج (اختياري)</label>
                <input
                  ref={clientStockPhotoRef}
                  type="file"
                  accept="image/*"
                  onChange={async e => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setClientStockFormError(null);
                    try {
                      const compressed = await compressImageFileToDataUrl(file, 440, 0.72, 70_000);
                      setNewStockPhoto(compressed);
                    } catch (err: any) {
                      setClientStockFormError(err?.message || 'تعذر قراءة الصورة.');
                    } finally {
                      e.target.value = '';
                    }
                  }}
                  className="hidden"
                />
                {newStockPhoto ? (
                  <div className="relative w-full h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={newStockPhoto} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setNewStockPhoto('')}
                      className="absolute top-2 right-2 px-2 py-1 bg-slate-900/80 text-white rounded text-[10px] font-bold cursor-pointer"
                    >
                      حذف
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => clientStockPhotoRef.current?.click()}
                    className="w-full py-4 border-2 border-dashed border-slate-300 hover:border-red-400 rounded-xl bg-slate-50 flex items-center justify-center gap-2 text-xs font-bold text-slate-600 cursor-pointer"
                  >
                    <ImagePlus className="w-4 h-4 text-red-500" />
                    <span>اضغط لإرفاق صورة المنتوج</span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">اسم المنتوج *</label>
                <input
                  type="text"
                  required
                  value={newStockName}
                  onChange={e => setNewStockName(e.target.value)}
                  placeholder="مثال: ساعة ذكية"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">العدد (الكمية) *</label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    required
                    value={newStockQty}
                    onChange={e => setNewStockQty(Math.max(1, Math.min(500, parseInt(e.target.value, 10) || 1)))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">ثمن البيع للقطعة (MAD) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={newStockPrice}
                    onChange={e => setNewStockPrice(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">الصنف (اختياري)</label>
                <input
                  type="text"
                  value={newStockCategory}
                  onChange={e => setNewStockCategory(e.target.value)}
                  placeholder="إلكترونيات، ملابس..."
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs"
                />
              </div>

              {clientStockFormError && (
                <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700">
                  {clientStockFormError}
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddClientStockModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-100 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSavingClientStock}
                  className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-black cursor-pointer"
                >
                  {isSavingClientStock ? '...' : 'حفظ وتوليد الأكواد'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
