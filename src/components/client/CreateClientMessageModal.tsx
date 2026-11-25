import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { useLanguage } from '../../i18n/LanguageContext';
import {
  ClientMessageCategory,
  ClientMessagePriority,
  PackageItem
} from '../../types';
import {
  X,
  Send,
  AlertTriangle,
  Package,
  Calendar,
  CreditCard,
  MapPin,
  HelpCircle,
  Clock,
  Sparkles,
  CheckCircle2
} from 'lucide-react';

interface CreateClientMessageModalProps {
  isOpen: boolean;
  onClose: () => void;
  preselectedPackage?: PackageItem | null;
  initialCategory?: ClientMessageCategory;
  onMessageSent?: (messageId: string) => void;
}

export const CATEGORY_CONFIG: Record<
  ClientMessageCategory,
  { label: string; icon: React.FC<{ className?: string }>; color: string }
> = {
  reclamation_colis: {
    label: 'Réclamation sur un colis',
    icon: Package,
    color: 'text-rose-600 bg-rose-50 border-rose-200'
  },
  retard_livraison: {
    label: 'Retard de livraison',
    icon: Clock,
    color: 'text-amber-600 bg-amber-50 border-amber-200'
  },
  changement_adresse: {
    label: "Changement d'adresse ou tél destinataire",
    icon: MapPin,
    color: 'text-sky-600 bg-sky-50 border-sky-200'
  },
  ramassage: {
    label: 'Demande de ramassage urgente',
    icon: Calendar,
    color: 'text-indigo-600 bg-indigo-50 border-indigo-200'
  },
  facturation_cod: {
    label: 'Paiement / Virement COD',
    icon: CreditCard,
    color: 'text-emerald-600 bg-emerald-50 border-emerald-200'
  },
  autre: {
    label: 'Autre question / Assistance',
    icon: HelpCircle,
    color: 'text-slate-600 bg-slate-50 border-slate-200'
  }
};

export const CreateClientMessageModal: React.FC<CreateClientMessageModalProps> = ({
  isOpen,
  onClose,
  preselectedPackage,
  initialCategory,
  onMessageSent
}) => {
  const { currentUser } = useAuth();
  const { packages, sendClientMessage } = useDatabase();
  const { t } = useLanguage();

  const [category, setCategory] = useState<ClientMessageCategory>(
    initialCategory || (preselectedPackage ? 'reclamation_colis' : 'retard_livraison')
  );
  const [priority, setPriority] = useState<ClientMessagePriority>('normale');
  const [selectedPackageId, setSelectedPackageId] = useState<string>(preselectedPackage?.id || '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [searchPackageQuery, setSearchPackageQuery] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);

  // Client packages only
  const clientPackages = packages.filter(
    p => p.clientId === currentUser?.id || !currentUser?.id
  );

  useEffect(() => {
    if (preselectedPackage) {
      setSelectedPackageId(preselectedPackage.id);
      setSubject(`Réclamation Colis ${preselectedPackage.trackingNumber} — ${preselectedPackage.recipientName} (${preselectedPackage.city})`);
    } else if (initialCategory) {
      setCategory(initialCategory);
    }
  }, [preselectedPackage, initialCategory]);

  if (!isOpen) return null;

  const linkedPackage = clientPackages.find(p => p.id === selectedPackageId);

  const filteredPackages = clientPackages.filter(p => {
    if (!searchPackageQuery.trim()) return true;
    const q = searchPackageQuery.toLowerCase();
    return (
      p.trackingNumber.toLowerCase().includes(q) ||
      p.recipientName.toLowerCase().includes(q) ||
      p.city.toLowerCase().includes(q)
    );
  });

  const handleSelectQuickSubject = (s: string) => {
    setSubject(s);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      alert('Veuillez saisir un objet et votre message.');
      return;
    }

    setIsSubmitting(true);

    try {
      const created = sendClientMessage(
        {
          category,
          priority,
          subject: subject.trim(),
          message: message.trim(),
          packageTrackingNumber: linkedPackage?.trackingNumber,
          packageId: linkedPackage?.id
        },
        currentUser
          ? {
              id: currentUser.id,
              name: currentUser.name,
              companyName: currentUser.companyName,
              phone: currentUser.phone,
              email: currentUser.email
            }
          : undefined
      );

      setSuccessNotice(true);
      setTimeout(() => {
        setIsSubmitting(false);
        setSuccessNotice(false);
        if (onMessageSent) onMessageSent(created.id);
        onClose();
        // Reset
        setSubject('');
        setMessage('');
        setSelectedPackageId('');
      }, 1000);
    } catch (err: any) {
      setIsSubmitting(false);
      alert('Erreur lors de l\'envoi du message : ' + err.message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-slate-900 via-slate-850 to-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-600/20 border border-red-500/30 flex items-center justify-center text-red-400">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Émettre un message au support logistique
              </h3>
              <p className="text-xs text-slate-300">
                Contact direct avec l'équipe dispatch & opérations Fariousy Delivery
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {successNotice ? (
          <div className="p-10 text-center space-y-4">
            <div className="w-16 h-16 rounded-full bg-emerald-50 border-2 border-emerald-500 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h4 className="text-lg font-bold text-slate-900">
              Message émis avec succès !
            </h4>
            <p className="text-sm text-slate-600 max-w-md mx-auto">
              Votre message a été transmis à l'équipe Fariousy Delivery. Vous recevrez une réponse dans votre espace support sous peu.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Category Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                1. Catégorie de votre demande <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {(Object.keys(CATEGORY_CONFIG) as ClientMessageCategory[]).map(catKey => {
                  const cfg = CATEGORY_CONFIG[catKey];
                  const Icon = cfg.icon;
                  const isSelected = category === catKey;
                  return (
                    <button
                      key={catKey}
                      type="button"
                      onClick={() => setCategory(catKey)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl text-left border text-xs font-semibold transition-all ${
                        isSelected
                          ? 'border-red-600 bg-red-50/80 text-red-900 ring-2 ring-red-500/20 font-bold'
                          : 'border-slate-200 bg-slate-50/50 hover:bg-slate-100 text-slate-700'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isSelected ? 'text-red-600' : 'text-slate-500'}`} />
                      <span className="truncate">{cfg.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Optional Package Link */}
            <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-slate-500" />
                  Associer un colis spécifique (facultatif mais recommandé)
                </label>
                {linkedPackage && (
                  <button
                    type="button"
                    onClick={() => setSelectedPackageId('')}
                    className="text-[11px] text-red-600 hover:underline"
                  >
                    Détacher le colis
                  </button>
                )}
              </div>

              {linkedPackage ? (
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-mono font-bold text-slate-900 block">
                      {linkedPackage.trackingNumber}
                    </span>
                    <span className="text-slate-600">
                      Destinataire : <strong className="text-slate-800">{linkedPackage.recipientName}</strong> ({linkedPackage.city}) • COD : {linkedPackage.codAmount} MAD
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                    {linkedPackage.status}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <input
                    type="text"
                    value={searchPackageQuery}
                    onChange={e => setSearchPackageQuery(e.target.value)}
                    placeholder="Rechercher par N° de suivi (FAR-...), nom du destinataire ou ville..."
                    className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                  {searchPackageQuery.trim() && (
                    <div className="max-h-36 overflow-y-auto border border-slate-200 bg-white rounded-lg divide-y divide-slate-100 shadow-xs">
                      {filteredPackages.length === 0 ? (
                        <div className="p-3 text-xs text-slate-500 text-center">
                          Aucun colis correspondant trouvé dans vos expéditions.
                        </div>
                      ) : (
                        filteredPackages.slice(0, 5).map(pkg => (
                          <button
                            key={pkg.id}
                            type="button"
                            onClick={() => {
                              setSelectedPackageId(pkg.id);
                              setSearchPackageQuery('');
                              if (!subject) {
                                setSubject(`Question sur le colis ${pkg.trackingNumber} (${pkg.recipientName})`);
                              }
                            }}
                            className="w-full text-left p-2 hover:bg-slate-50 flex items-center justify-between text-xs"
                          >
                            <div>
                              <span className="font-mono font-bold text-slate-900 block">{pkg.trackingNumber}</span>
                              <span className="text-slate-600">{pkg.recipientName} — {pkg.city}</span>
                            </div>
                            <span className="text-[11px] text-slate-500">{pkg.status}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Priority & Subject */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="sm:col-span-1">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Priorité
                </label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as ClientMessagePriority)}
                  className="w-full text-xs px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                >
                  <option value="normale">Normale</option>
                  <option value="urgente">⚠️ Urgente</option>
                  <option value="faible">Faible</option>
                </select>
              </div>

              <div className="sm:col-span-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Objet du message <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={e => setSubject(e.target.value)}
                  placeholder="Ex: Retard de livraison pour le client Maârif, changement de numéro..."
                  className="w-full text-xs px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
                />
              </div>
            </div>

            {/* Quick Suggestions for Subject */}
            <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
              <span className="text-slate-500 font-semibold flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-amber-500" /> Suggestions :
              </span>
              <button
                type="button"
                onClick={() => handleSelectQuickSubject('Colis non encore livré après 48h')}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Colis non livré
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickSubject('Nouveau numéro de téléphone destinataire')}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Correction téléphone
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickSubject('Changement d\'adresse de livraison')}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Changement adresse
              </button>
              <button
                type="button"
                onClick={() => handleSelectQuickSubject('Demande d\'annulation et retour expéditeur')}
                className="px-2 py-0.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
              >
                Annulation / Retour
              </button>
            </div>

            {/* Detailed Message Textarea */}
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Message détaillé <span className="text-red-500">*</span>
              </label>
              <textarea
                required
                rows={5}
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Expliquez précisément votre demande ou la situation du destinataire (instructions particulières, créneau de livraison souhaité, nouvelle adresse, etc.)..."
                className="w-full text-xs p-3.5 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 resize-none font-sans"
              />
            </div>

            {/* Footer Buttons */}
            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-sm transition-all disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                {isSubmitting ? 'Envoi en cours...' : 'Émettre le message au support'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
