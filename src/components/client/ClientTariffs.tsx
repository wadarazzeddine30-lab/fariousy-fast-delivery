import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDatabase } from '../../context/DatabaseContext';
import { formatMAD } from '../../utils/barcode';
import { Tag, CheckCircle2, Clock, Calculator, ShieldCheck, MapPin, Search } from 'lucide-react';

export const ClientTariffs: React.FC = () => {
  const { currentUser } = useAuth();
  const { cities } = useDatabase();

  const [searchCity, setSearchCity] = useState('');
  const [simWeight, setSimWeight] = useState(1);
  const [simCity, setSimCity] = useState(cities[0]?.name || 'Casablanca');

  const filteredCities = cities.filter(c =>
    c.name.toLowerCase().includes(searchCity.toLowerCase())
  );

  const selectedSimCity = cities.find(c => c.name === simCity);
  const clientRate = currentUser?.customRates?.[simCity];
  const activeRate = clientRate !== undefined ? clientRate : (selectedSimCity?.defaultFee || 35);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight">
            Mes Tarifs de Livraison — Grille Officielle
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tarifs préférentiels négociés et délais d'acheminement accordés à votre boutique
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 border border-emerald-200">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Compte Boutique Approuvé</span>
          </span>
        </div>
      </div>

      {/* Boutique Summary Banner */}
      <div className="p-4 bg-white border border-slate-200 rounded-2xl shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">
            Boutique Partenaire
          </span>
          <h3 className="text-base font-extrabold text-slate-900">
            {currentUser?.companyName || currentUser?.name}
          </h3>
          <p className="text-xs text-slate-500">
            Responsable : {currentUser?.name} • Ville de ramassage : <strong>{currentUser?.city}</strong>
          </p>
        </div>

        {currentUser?.approvedBy && (
          <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-xs">
            <span className="text-slate-400 text-[10px] uppercase font-bold block">Approbation</span>
            <span className="text-slate-800 font-semibold">Validé par : {currentUser.approvedBy}</span>
            {currentUser.approvedAt && (
              <span className="text-slate-500 block text-[11px]">Le {currentUser.approvedAt}</span>
            )}
          </div>
        )}
      </div>

      {/* Simulator + Tariff Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Table: Mes Tarifs par Ville */}
        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Tag className="w-4 h-4 text-red-600" />
              <span>Grille Tarifaire par Ville de Destination</span>
            </h3>

            <div className="relative w-48">
              <input
                type="text"
                placeholder="Filtrer par ville..."
                value={searchCity}
                onChange={e => setSearchCity(e.target.value)}
                className="w-full text-xs bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl shadow-2xs overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Ville Destination</th>
                  <th className="py-3 px-4 text-center">Délai Garanti</th>
                  <th className="py-3 px-4 text-center">Tarif Standard</th>
                  <th className="py-3 px-4 text-right">Votre Tarif Négocié</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredCities.map(c => {
                  const hasCustom = currentUser?.customRates?.[c.name] !== undefined;
                  const finalFee = hasCustom ? currentUser!.customRates![c.name] : c.defaultFee;
                  const savings = c.defaultFee - finalFee;

                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-extrabold text-slate-900 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-600 shrink-0" />
                          <span>{c.name}</span>
                        </div>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-600">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          <span>{c.deliveryDelayHours}h</span>
                        </span>
                      </td>

                      <td className="py-3 px-4 text-center font-mono text-slate-400">
                        {c.defaultFee} MAD
                      </td>

                      <td className="py-3 px-4 text-right font-mono">
                        <span className="text-sm font-black text-red-600 block">
                          {formatMAD(finalFee)}
                        </span>
                        {hasCustom && savings > 0 && (
                          <span className="text-[10px] text-emerald-600 font-bold block">
                            Économie de {savings} MAD
                          </span>
                        )}
                        {!hasCustom && (
                          <span className="text-[10px] text-slate-400 block">Tarif standard</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {filteredCities.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400">
                      Aucune ville trouvée.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Simulator Widget */}
        <div className="space-y-4">
          <div className="p-5 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-red-600" />
              <span>Simulateur de Frais de Livraison</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-700 font-bold mb-1">Ville de Destination :</label>
                <select
                  value={simCity}
                  onChange={e => setSimCity(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-slate-900 font-semibold"
                >
                  {cities.map(c => (
                    <option key={c.id} value={c.name}>
                      {c.name} ({c.deliveryDelayHours}h)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-700 font-bold mb-1">Poids estimé :</label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="15"
                    value={simWeight}
                    onChange={e => setSimWeight(Number(e.target.value))}
                    className="flex-1 accent-red-600"
                  />
                  <span className="font-mono font-bold text-slate-800 w-12 text-right">
                    {simWeight} kg
                  </span>
                </div>
              </div>

              {/* Simulation Result */}
              <div className="mt-4 p-4 bg-red-50/70 border border-red-200 rounded-xl text-center space-y-1">
                <span className="text-[10px] text-red-700 font-bold uppercase tracking-wider block">
                  Tarif Net Appliqué
                </span>
                <div className="text-2xl font-black text-red-600 font-mono">
                  {formatMAD(activeRate)}
                </div>
                <span className="text-[11px] text-slate-600 block">
                  Délai moyen garanti : <strong>{selectedSimCity?.deliveryDelayHours} heures</strong>
                </span>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl text-[11px] text-slate-500 space-y-1">
                <p>✓ Ramassage gratuit inclus à votre dépôt</p>
                <p>✓ 3 tentatives de livraison avec confirmation SMS</p>
                <p>✓ Remboursement COD hebdomadaire garanti</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
