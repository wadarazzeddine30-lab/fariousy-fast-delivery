import React from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { PackageItem, PACKAGE_STATUS_CONFIG } from '../../types';
import { formatMAD, formatDate } from '../../utils/barcode';
import { CornerDownLeft, AlertCircle, Eye, Clock, ShieldAlert } from 'lucide-react';

interface ClientReturnsProps {
  onViewPackage: (pkg: PackageItem) => void;
}

export const ClientReturns: React.FC<ClientReturnsProps> = ({ onViewPackage }) => {
  const { currentUser } = useAuth();
  const { packages } = useDatabase();

  const myPackages = packages.filter(p => p.clientId === currentUser?.id || (p.shopId && p.shopId === currentUser?.id));
  const returnedPackages = myPackages.filter(p =>
    ['refuse', 'retour_en_cours', 'retourne'].includes(p.status)
  );

  return (
    <div className="space-y-5">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Gestion des Retours & Colis Non Livrés
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Suivez l'état des colis refusés ou non réclamés et les motifs déclarés par les destinataires
        </p>
      </div>

      {/* Summary Alert */}
      <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between text-xs text-rose-900">
        <div className="flex items-center gap-3">
          <CornerDownLeft className="w-5 h-5 text-rose-600 shrink-0" />
          <div>
            <span className="font-bold">Total Retours : {returnedPackages.length} colis</span>
            <p className="text-[11px] text-rose-700 mt-0.5">
              Les colis sont rapatriés automatiquement vers notre hub agence puis retournés à votre adresse lors du prochain ramassage.
            </p>
          </div>
        </div>
      </div>

      {/* Returns Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
            <tr>
              <th className="py-3 px-4">N° Suivi</th>
              <th className="py-3 px-4">Destinataire Initial</th>
              <th className="py-3 px-4">Ville</th>
              <th className="py-3 px-4">Motif / Raison du Retour</th>
              <th className="py-3 px-4 text-right">Montant Non Réclamé</th>
              <th className="py-3 px-4">Statut Retour</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {returnedPackages.map(pkg => {
              const config = PACKAGE_STATUS_CONFIG[pkg.status] || {
                label: pkg.status || 'Inconnu',
                badgeClass: 'bg-slate-100 text-slate-700'
              };
              return (
                <tr key={pkg.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{pkg.trackingNumber}</td>
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900 block">{pkg.recipientName}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{pkg.recipientPhone}</span>
                  </td>
                  <td className="py-3 px-4 font-bold text-slate-800">{pkg.city}</td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-md inline-block">
                      {pkg.returnReason || 'Destinataire injoignable ou refus'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">
                    {formatMAD(pkg.codAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${config.badgeClass}`}>
                      {config.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => onViewPackage(pkg)}
                      className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
                    >
                      Historique
                    </button>
                  </td>
                </tr>
              );
            })}

            {returnedPackages.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-400">
                  Excellente nouvelle ! Vous n'avez aucun colis retourné pour le moment.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
