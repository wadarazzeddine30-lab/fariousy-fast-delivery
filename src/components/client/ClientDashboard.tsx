import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { PackageItem, PACKAGE_STATUS_CONFIG } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import {
  Package,
  Clock,
  Truck,
  CheckCircle2,
  RotateCcw,
  Banknote,
  Plus,
  CalendarCheck,
  TrendingUp,
  ArrowUpRight,
  ShieldAlert,
  Wallet,
  MessageSquare,
  MessageCircle,
  Edit2
} from 'lucide-react';
import { OrderWhatsAppSupportModal } from './OrderWhatsAppSupportModal';
import { CreateClientMessageModal } from './CreateClientMessageModal';
import { SmartAlertsPanel } from '../common/SmartAlertsPanel';
import { EditPackageModal } from '../common/EditPackageModal';

interface ClientDashboardProps {
  onOpenAddPackage: () => void;
  onViewPackage: (pkg: PackageItem) => void;
  onNavigateTab: (tab: any) => void;
}

export const ClientDashboard: React.FC<ClientDashboardProps> = ({
  onOpenAddPackage,
  onViewPackage,
  onNavigateTab
}) => {
  const { currentUser } = useAuth();
  const { packages, payments, pickups } = useDatabase();
  const { translateStatus, isRtl } = useLanguage();
  const [selectedSupportPackage, setSelectedSupportPackage] = useState<PackageItem | null>(null);
  const [selectedMessagePackage, setSelectedMessagePackage] = useState<PackageItem | null>(null);
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);

  // Strict client data isolation: only packages of current client!
  const myShopId = (currentUser as any)?.shopId;
  const myPackages = packages.filter(
    p =>
      p.clientId === currentUser?.id ||
      (Boolean(p.shopId) && (p.shopId === currentUser?.id || (Boolean(myShopId) && p.shopId === myShopId))) ||
      (Boolean(myShopId) && p.clientId === myShopId)
  );
  const myPickups = pickups.filter(p => p.clientId === currentUser?.id);
  const myPayments = payments.filter(p => p.clientId === currentUser?.id);

  // Status counters
  const totalPackages = myPackages.length;
  const pendingCount = myPackages.filter(p => ['nouveau', 'attente_ramassage'].includes(p.status)).length;
  const inDeliveryCount = myPackages.filter(p => ['en_cours_livraison', 'en_transit', 'ramasse', 'en_stock', 'arrive_destination'].includes(p.status)).length;
  const deliveredCount = myPackages.filter(p => p.status === 'livre').length;
  const returnedCount = myPackages.filter(p => ['retour_en_cours', 'retourne', 'refuse'].includes(p.status)).length;

  // Financial calculations
  const totalCollected = myPackages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.codAmount || 0), 0);

  const totalDeliveryFees = myPackages
    .filter(p => p.status === 'livre')
    .reduce((acc, p) => acc + (p.deliveryFee || 0), 0);

  const alreadyPaidOut = myPayments
    .filter(p => p.status === 'paye')
    .reduce((acc, p) => acc + p.netAmount, 0);

  // Available balance ready for transfer (net = COD - fees of unpaid delivered parcels)
  const availableBalance = myPackages
    .filter(p => p.status === 'livre' && !p.isPaidToClient)
    .reduce((acc, p) => acc + ((p.codAmount || 0) - (p.deliveryFee || 0)), 0);

  const totalNetEarned = totalCollected - totalDeliveryFees;

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-red-600 uppercase tracking-wider">Espace E-Commerce</span>
          </div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Bonjour, {currentUser?.companyName || currentUser?.name}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Suivez vos expéditions, vos ramassages et vos encaissements en temps réel
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => onNavigateTab('client_messages')}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
          >
            <MessageSquare className="w-4 h-4 text-slate-700" />
            <span>Support & Messages</span>
          </button>

          <button
            onClick={() => onNavigateTab('client_pickups')}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded-xl shadow-2xs transition-colors"
          >
            <CalendarCheck className="w-4 h-4 text-red-600" />
            <span>Demander Ramassage</span>
          </button>

          <button
            onClick={onOpenAddPackage}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Créer un Colis</span>
          </button>
        </div>
      </div>

      {/* Merchant Automated Smart Alerts (كوليات متوقفة +48h، مرتجعات، ديون، سطوك غير مسكان) */}
      {currentUser?.id && (
        <SmartAlertsPanel
          clientId={currentUser.id}
          onViewPackage={onViewPackage}
          onNavigateTab={onNavigateTab}
        />
      )}

      {/* Package KPIs (Section 2.A: Total, En attente, En livraison, Livrés, Retournés) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div
          onClick={() => onNavigateTab('client_packages')}
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Mes Colis</span>
            <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-slate-900 tabular-nums">
            {totalPackages}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Total expédiés</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Attente</span>
            <div className="p-2 rounded-xl bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-amber-600 tabular-nums">
            {pendingCount}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Prêts au ramassage</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">En Livraison</span>
            <div className="p-2 rounded-xl bg-orange-50 text-orange-600">
              <Truck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-orange-600 tabular-nums">
            {inDeliveryCount}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">En cours de tournée</span>
        </div>

        <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Livrés</span>
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-emerald-600 tabular-nums">
            {deliveredCount}
          </div>
          <span className="text-[10px] text-emerald-700 font-medium mt-0.5 block">Encaissés avec succès</span>
        </div>

        <div
          onClick={() => onNavigateTab('client_returns')}
          className="p-4 bg-white rounded-2xl border border-slate-200 hover:border-slate-300 shadow-2xs cursor-pointer transition-all"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Retournés</span>
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600">
              <RotateCcw className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black font-mono text-rose-600 tabular-nums">
            {returnedCount}
          </div>
          <span className="text-[10px] text-slate-500 font-medium mt-0.5 block">Refusés / Retours</span>
        </div>
      </div>

      {/* Financial Section (Section 2.A: Montants encaissés, disponibles, déjà versés, solde restant) */}
      <div className="p-6 bg-slate-900 text-white rounded-2xl shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Wallet className="w-5 h-5 text-red-500" />
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-200">
              Bilan Financier & Encaissements Marchand
            </h3>
          </div>
          <button
            onClick={() => onNavigateTab('client_finance')}
            className="text-xs font-bold text-red-400 hover:text-red-300 flex items-center gap-1"
          >
            <span>Voir mes relevés</span>
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
          {/* Montants Encaissés (COD) */}
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Montants Encaissés
            </span>
            <div className="mt-1.5 text-xl font-black font-mono text-white tabular-nums">
              {formatMAD(totalCollected)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Valeur marchande collectée</span>
          </div>

          {/* Frais de Livraison Déduits */}
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Frais Livraison Déduits
            </span>
            <div className="mt-1.5 text-xl font-black font-mono text-red-400 tabular-nums">
              -{formatMAD(totalDeliveryFees)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Prestations FARIOUSY</span>
          </div>

          {/* Déjà Versés */}
          <div className="p-4 bg-slate-800/80 rounded-xl border border-slate-700/60">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Montants Déjà Versés
            </span>
            <div className="mt-1.5 text-xl font-black font-mono text-emerald-400 tabular-nums">
              {formatMAD(alreadyPaidOut)}
            </div>
            <span className="text-[10px] text-slate-400 mt-0.5 block">Règlements virés sur votre RIB</span>
          </div>

          {/* Solde Restant Disponible */}
          <div className="p-4 bg-red-950/60 rounded-xl border border-red-700/60">
            <span className="text-[11px] text-red-300 font-bold uppercase tracking-wider block">
              Solde Restant Disponible
            </span>
            <div className="mt-1.5 text-xl font-black font-mono text-emerald-300 tabular-nums">
              {formatMAD(availableBalance)}
            </div>
            <span className="text-[10px] text-red-300 mt-0.5 block">À recevoir au prochain virement</span>
          </div>
        </div>
      </div>

      {/* Recent Parcels & Active Pickups */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Parcels Table */}
        <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">Mes Derniers Envois</h3>
            <button
              onClick={() => onNavigateTab('client_packages')}
              className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center gap-1"
            >
              <span>Tous mes colis</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">N° Suivi</th>
                  <th className="py-2.5 px-3">Destinataire</th>
                  <th className="py-2.5 px-3">Ville</th>
                  <th className="py-2.5 px-3 text-right">Montant COD</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {myPackages.slice(0, 5).map(pkg => {
                  const config = PACKAGE_STATUS_CONFIG[pkg.status] || {
                    label: pkg.status || 'Inconnu',
                    badgeClass: 'bg-slate-100 text-slate-700'
                  };
                  return (
                    <tr key={pkg.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900 force-ltr">{pkg.trackingNumber}</td>
                      <td className="py-2.5 px-3 text-slate-800 font-medium">{pkg.recipientName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{pkg.city}</td>
                      <td className={`py-2.5 px-3 font-mono font-bold text-slate-900 ${isRtl ? 'text-left' : 'text-right'}`}>
                        {formatMAD(pkg.codAmount)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${config.badgeClass}`}>
                          {translateStatus(pkg.status)}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center justify-end gap-1.5">
                          {['nouveau', 'attente_ramassage'].includes(pkg.status) && (
                            <button
                              type="button"
                              onClick={() => setEditingPackage(pkg)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg transition-colors cursor-pointer"
                              title="تعديل الكموند"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>تعديل</span>
                            </button>
                          )}
                          <button
                            onClick={() => setSelectedSupportPackage(pkg)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-bold text-white bg-[#1f9d55] hover:bg-[#198748] rounded-lg transition-colors cursor-pointer"
                            title="Contacter le support WhatsApp de la région"
                          >
                            <MessageCircle className="w-3 h-3" />
                            <span>Support</span>
                          </button>
                          <button
                            onClick={() => onViewPackage(pkg)}
                            className="px-2 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                          >
                            Suivre
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {myPackages.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Vous n'avez pas encore créé de colis.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pickups Side Card */}
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-amber-600" />
                <span>Mes Ramassages</span>
              </h3>
              <button
                onClick={() => onNavigateTab('client_pickups')}
                className="text-xs font-bold text-red-600 hover:text-red-700"
              >
                Gérer
              </button>
            </div>

            <div className="space-y-2">
              {myPickups.slice(0, 3).map(p => (
                <div key={p.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-mono font-bold text-slate-900">{p.trackingId}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        p.status === 'en_attente'
                          ? 'bg-amber-100 text-amber-800'
                          : p.status === 'affectee'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}
                    >
                      {p.status === 'en_attente' ? 'En attente' : p.status === 'affectee' ? 'Livreur affecté' : 'Terminé'}
                    </span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    {p.packageCount} colis · Date : {p.requestedDate}
                  </div>
                </div>
              ))}

              {myPickups.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">
                  Aucune demande de ramassage en cours
                </p>
              )}
            </div>
          </div>

          <button
            onClick={() => onNavigateTab('client_pickups')}
            className="w-full py-2.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition-colors text-center"
          >
            Nouvelle demande de ramassage
          </button>
        </div>
      </div>

      <OrderWhatsAppSupportModal
        isOpen={Boolean(selectedSupportPackage)}
        onClose={() => setSelectedSupportPackage(null)}
        packageItem={selectedSupportPackage}
        onOpenInternalMessage={pkg => setSelectedMessagePackage(pkg)}
      />

      <CreateClientMessageModal
        isOpen={Boolean(selectedMessagePackage)}
        onClose={() => setSelectedMessagePackage(null)}
        preselectedPackage={selectedMessagePackage}
      />

      <EditPackageModal
        packageItem={editingPackage}
        isOpen={Boolean(editingPackage)}
        onClose={() => setEditingPackage(null)}
      />
    </div>
  );
};
