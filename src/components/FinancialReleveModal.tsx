import React from 'react';
import { ClientPayment } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { formatMAD } from '../utils/barcode';
import { Printer, X, Download, FileImage } from 'lucide-react';
import { downloadImageUrl } from '../utils/imageCompress';

interface FinancialReleveModalProps {
  payment: ClientPayment | null;
  isOpen: boolean;
  onClose: () => void;
}

export const FinancialReleveModal: React.FC<FinancialReleveModalProps> = ({
  payment,
  isOpen,
  onClose
}) => {
  const { packages, companySettings } = useDatabase();

  if (!isOpen || !payment) return null;

  const relevantPackages = packages.filter(p => payment.packageIds.includes(p.id));

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Modal Toolbar */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 px-3.5 py-3 sm:px-6 sm:py-4 border-b border-slate-100 bg-slate-50">
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">Relevé de Paiement Client (Bordereau CRBT)</h3>
            <p className="text-[11px] sm:text-xs text-slate-500 font-mono">Réf : {payment.reference}</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimer</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Printable Document Paper */}
        <div className="flex-1 min-h-0 p-3 sm:p-6 overflow-y-auto overscroll-contain bg-slate-100 flex justify-center items-start">
          <div className="w-full max-w-[760px] bg-white p-4 sm:p-8 rounded-xl shadow-xs text-slate-900 space-y-5 sm:space-y-6 border border-slate-200">
            {/* Header Document */}
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b pb-4 sm:pb-6 border-slate-200">
              <div className="flex items-center gap-3">
                <img
                  src="/fariousy-logo.jpeg"
                  alt="FARIOUSY DELIVERY"
                  className="w-12 h-12 sm:w-16 sm:h-16 object-contain shrink-0"
                />
                <div className="min-w-0">
                  <h1 className="text-base sm:text-xl font-black tracking-tight text-slate-900">{companySettings?.companyName || 'FARIOUSY DELIVERY'}</h1>
                  <p className="text-[11px] sm:text-xs text-red-600 font-bold uppercase tracking-wider">Fast & Secure Delivery</p>
                  <p className="text-[11px] text-slate-500 mt-1">Siège : {companySettings?.address || 'Sidi Maârouf, Casablanca - Maroc'}</p>
                  <p className="text-[11px] text-slate-500">Tél : {companySettings?.phone || '+212 522 89 40 10'} | {companySettings?.email || 'contact@fariousy.com'}</p>
                </div>
              </div>

              <div className="sm:text-right">
                <span className="text-xs uppercase font-extrabold text-slate-400 tracking-wider block">
                  ÉTAT DE RÈGLEMENT
                </span>
                <span className="text-base sm:text-lg font-mono font-black text-slate-900">{payment.reference}</span>
                <p className="text-xs text-slate-600 mt-1">Date d'émission : <strong>{payment.date}</strong></p>
                <div className="mt-2 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                  {payment.status === 'paye' ? 'RÈGLEMENT PAYÉ' : 'EN ATTENTE'}
                </div>
              </div>
            </div>

            {/* Client Recipient Details */}
            <div className="p-3.5 sm:p-4 bg-slate-50 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  BÉNÉFICIAIRE :
                </span>
                <div className="font-extrabold text-sm text-slate-900">{payment.clientCompany}</div>
                <div className="text-slate-600 mt-0.5">Contact : {payment.clientName}</div>
                <div className="text-slate-600">Mode de paiement : <strong>{payment.paymentMethod}</strong></div>
              </div>

              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  RÉCAPITULATIF :
                </span>
                <div className="text-slate-600">Colis livrés dans ce lot : <strong className="font-mono">{payment.packageCount}</strong></div>
                <div className="text-slate-600">Total Encaissé (COD) : <strong className="font-mono">{formatMAD(payment.totalCollected)}</strong></div>
                <div className="text-slate-600">Frais de prestation retenus : <strong className="font-mono text-red-600">-{formatMAD(payment.totalDeliveryFees)}</strong></div>
              </div>
            </div>

            {/* Packages Breakdown Table */}
            <div>
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
                Détail des Colis Encaissés
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-x-auto">
                <table className="w-full text-left text-xs whitespace-nowrap">
                  <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3 font-mono">N° Suivi</th>
                      <th className="py-2.5 px-3">Destinataire</th>
                      <th className="py-2.5 px-3">Ville</th>
                      <th className="py-2.5 px-3 text-right">Montant Encaissé</th>
                      <th className="py-2.5 px-3 text-right">Frais Livraison</th>
                      <th className="py-2.5 px-3 text-right font-bold">Net Reversé</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {relevantPackages.map(p => (
                      <tr key={p.id} className="hover:bg-slate-50">
                        <td className="py-2 px-3 font-mono font-medium text-slate-900">{p.trackingNumber}</td>
                        <td className="py-2 px-3 text-slate-800">{p.recipientName}</td>
                        <td className="py-2 px-3 text-slate-600">{p.city}</td>
                        <td className="py-2 px-3 text-right font-mono">{formatMAD(p.codAmount)}</td>
                        <td className="py-2 px-3 text-right font-mono text-slate-500">-{formatMAD(p.deliveryFee)}</td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                          {formatMAD((p.codAmount || 0) - (p.deliveryFee || 0))}
                        </td>
                      </tr>
                    ))}
                    {relevantPackages.length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-center text-slate-400">
                          Aucun colis rattaché directement à cet affichage
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Financial Summary Calculation Card */}
            <div className="flex justify-end">
              <div className="w-full sm:w-80 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Total Encaissé Brut :</span>
                  <span className="font-mono font-semibold">{formatMAD(payment.totalCollected)}</span>
                </div>
                <div className="flex justify-between text-red-600">
                  <span>Frais de Livraison FARIOUSY :</span>
                  <span className="font-mono font-semibold">-{formatMAD(payment.totalDeliveryFees)}</span>
                </div>
                {(payment.packagingFees || 0) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Frais d&apos;Emballage (ثمن لومبلاج) :</span>
                    <span className="font-mono font-semibold">-{formatMAD(payment.packagingFees)}</span>
                  </div>
                )}
                {(payment.extraDeductions || 0) > 0 && (
                  <div className="flex justify-between text-rose-600">
                    <span>Autres Déductions / Dettes :</span>
                    <span className="font-mono font-semibold">-{formatMAD(payment.extraDeductions)}</span>
                  </div>
                )}
                {payment.deductionNotes && (
                  <div className="text-[11px] text-slate-500 bg-white border border-slate-200 rounded-lg p-2">
                    <span className="font-bold text-slate-700">Détail déductions : </span>
                    {payment.deductionNotes}
                  </div>
                )}
                <div className="pt-2 border-t border-slate-300 flex justify-between items-center text-sm">
                  <span className="font-black text-slate-900">NET À VERSER :</span>
                  <span className="font-black font-mono text-emerald-600 text-base">
                    {formatMAD(payment.netAmount)}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Transfer Receipt Proof Image (if attached) */}
            {payment.receiptImageUrl && (
              <div className="p-4 bg-emerald-50/60 border border-emerald-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
                    <FileImage className="w-4 h-4 text-emerald-600" />
                    <span>Justificatif du Virement Bancaire (صورة التحويل البنكي)</span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      downloadImageUrl(
                        payment.receiptImageUrl!,
                        payment.receiptFileName || `virement_${payment.reference}.jpg`
                      )
                    }
                    className="no-print inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg shadow-2xs transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>تنزيل الصورة / Télécharger</span>
                  </button>
                </div>
                <div className="bg-white border border-emerald-200 rounded-lg p-2 flex justify-center">
                  <img
                    src={payment.receiptImageUrl}
                    alt={`Preuve de virement ${payment.reference}`}
                    className="max-h-72 w-auto object-contain rounded"
                  />
                </div>
              </div>
            )}

            {/* Footer with Signatures */}
            <div className="pt-8 border-t border-slate-200 grid grid-cols-2 gap-8 text-xs text-slate-500">
              <div>
                <span className="block font-bold text-slate-700 mb-1">Pour FARIOUSY DELIVERY</span>
                <p className="text-[11px]">Direction Financière & Logistique</p>
                <div className="h-16 border-b border-dashed border-slate-300 mt-2" />
              </div>
              <div className="text-right">
                <span className="block font-bold text-slate-700 mb-1">Accusé de réception client</span>
                <p className="text-[11px]">{payment.clientCompany}</p>
                <div className="h-16 border-b border-dashed border-slate-300 mt-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs text-slate-500">Document légal édité automatiquement par FARIOUSY DELIVERY</span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};
