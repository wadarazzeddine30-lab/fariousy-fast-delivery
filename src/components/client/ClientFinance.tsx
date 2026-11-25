import React, { useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { ClientPayment } from '../../types';
import { formatMAD } from '../../utils/barcode';
import { downloadImageUrl } from '../../utils/imageCompress';
import { Printer, Download, FileImage, Eye, X } from 'lucide-react';

interface ClientFinanceProps {
  onOpenReleveModal: (payment: ClientPayment) => void;
}

export const ClientFinance: React.FC<ClientFinanceProps> = ({ onOpenReleveModal }) => {
  const { currentUser } = useAuth();
  const { packages, payments, clientDebts } = useDatabase();
  const [previewReceipt, setPreviewReceipt] = useState<{ imageUrl: string; title: string; fileName: string } | null>(null);

  // Filter for this client only!
  const myPackages = packages.filter(p => p.clientId === currentUser?.id || (p.shopId && p.shopId === currentUser?.id));
  const myDelivered = myPackages.filter(p => p.status === 'livre');
  const myPayments = payments.filter(p => p.clientId === currentUser?.id);
  const myPendingDebts = clientDebts.filter(d => d.clientId === currentUser?.id && !d.isSettled && d.status !== 'regle');
  const pendingDeductions = myPendingDebts.reduce((acc, d) => acc + (d.amount || 0), 0);

  // Financial sums
  const totalCollected = myDelivered.reduce((acc, p) => acc + (p.codAmount || 0), 0);
  const totalFees = myDelivered.reduce((acc, p) => acc + (p.deliveryFee || 0), 0);

  const alreadyPaid = myPayments.filter(p => p.status === 'paye').reduce((acc, p) => acc + p.netAmount, 0);

  const grossPendingPayout = myDelivered
    .filter(p => !p.isPaidToClient)
    .reduce((acc, p) => acc + ((p.codAmount || 0) - (p.deliveryFee || 0)), 0);
  const pendingPayout = Math.max(0, grossPendingPayout - pendingDeductions);

  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="pb-2 border-b border-slate-200">
        <h2 className="text-xl font-black text-slate-900 tracking-tight">
          Gestion Financière & Encaissements CRBT
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Consultez l'historique complet de vos reversements bancaires et téléchargez vos relevés
        </p>
      </div>

      {/* KPI 4 Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
            Colis Livrés & Encaissés
          </span>
          <div className="mt-1.5 text-2xl font-black font-mono text-slate-900">
            {myDelivered.length} colis
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Total Brut : <strong className="text-slate-800">{formatMAD(totalCollected)}</strong>
          </span>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
            Frais de Livraison Déduits
          </span>
          <div className="mt-1.5 text-2xl font-black font-mono text-red-600">
            -{formatMAD(totalFees)}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            Tarifs convenus selon destination
          </span>
        </div>

        <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs">
          <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">
            Montants Déjà Versés
          </span>
          <div className="mt-1.5 text-2xl font-black font-mono text-emerald-600">
            {formatMAD(alreadyPaid)}
          </div>
          <span className="text-[11px] text-slate-500 mt-0.5 block">
            {myPayments.length} règlement(s) exécuté(s)
          </span>
        </div>

        <div className="p-5 bg-red-950/80 text-white rounded-2xl shadow-xs">
          <span className="text-[10px] text-red-300 uppercase font-bold tracking-wider block">
            Montants à Recevoir (Solde Net)
          </span>
          <div className="mt-1.5 text-2xl font-black font-mono text-emerald-300">
            {formatMAD(pendingPayout)}
          </div>
          <span className="text-[11px] text-red-200 mt-0.5 block">
            {pendingDeductions > 0
              ? `Après déduction de ${formatMAD(pendingDeductions)} (Emballage / Frais)`
              : 'En attente du prochain lot de virement'}
          </span>
        </div>
      </div>

      {/* Payouts Table */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">
            Historique de Mes Relevés & Virements Reçus
          </h3>
          <span className="text-xs text-slate-500 font-mono">{myPayments.length} relevé(s)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Réf. Relevé</th>
                <th className="py-3 px-4">Date Règlement</th>
                <th className="py-3 px-4 text-center">Nombre de Colis</th>
                <th className="py-3 px-4 text-right">Total Encaissé</th>
                <th className="py-3 px-4 text-right">Frais Déduits</th>
                <th className="py-3 px-4 text-right font-black">Net Reçu</th>
                <th className="py-3 px-4">Mode de Paiement</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {myPayments.map(payment => (
                <tr key={payment.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{payment.reference}</td>
                  <td className="py-3 px-4 font-mono text-slate-600">{payment.date}</td>
                  <td className="py-3 px-4 text-center font-mono font-bold text-slate-800">
                    {payment.packageCount}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-slate-700">
                    {formatMAD(payment.totalCollected)}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-red-600">
                    <div>-{formatMAD(payment.totalDeliveryFees)}</div>
                    {((payment.packagingFees || 0) + (payment.extraDeductions || 0)) > 0 && (
                      <div className="text-[10px] text-amber-700 font-bold">
                        -{formatMAD((payment.packagingFees || 0) + (payment.extraDeductions || 0))} (Emballage/Extras)
                      </div>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-emerald-700 text-sm">
                    {formatMAD(payment.netAmount)}
                  </td>
                  <td className="py-3 px-4">
                    <span className="font-semibold text-slate-800 block">{payment.paymentMethod}</span>
                    <span className="text-[10px] text-emerald-600 font-bold">✓ Virement Confirmé</span>
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center justify-end gap-1.5 flex-wrap">
                      {payment.receiptImageUrl && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewReceipt({
                                imageUrl: payment.receiptImageUrl!,
                                title: `${payment.reference} — ${formatMAD(payment.netAmount)}`,
                                fileName: payment.receiptFileName || `virement_${payment.reference}.jpg`
                              })
                            }
                            className="px-2.5 py-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="عرض صورة التحويل البنكي"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>صورة التحويل</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              downloadImageUrl(
                                payment.receiptImageUrl!,
                                payment.receiptFileName || `virement_${payment.reference}.jpg`
                              )
                            }
                            className="px-2.5 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                            title="تنزيل صورة التحويل البنكي"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>تنزيل</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => onOpenReleveModal(payment)}
                        className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5 text-red-600" />
                        <span>Relevé PDF</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {myPayments.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    Aucun relevé financier n'a encore été édité pour votre compte.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Preview Receipt Lightbox */}
      {previewReceipt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
          <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-slate-50">
              <div className="flex items-center gap-2 text-sm font-bold text-slate-900">
                <FileImage className="w-4 h-4 text-emerald-600" />
                <span>{previewReceipt.title}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadImageUrl(previewReceipt.imageUrl, previewReceipt.fileName)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>تنزيل الصورة</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewReceipt(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="p-4 bg-slate-900/5 overflow-auto flex items-center justify-center">
              <img
                src={previewReceipt.imageUrl}
                alt={previewReceipt.title}
                className="max-h-[70vh] w-auto object-contain rounded-xl shadow-xs"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
