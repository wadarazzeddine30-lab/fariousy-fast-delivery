import React, { useState, useRef } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { Vehicle, VehicleOwnership, VehicleStatus } from '../../types';
import {
  Car,
  Upload,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Truck,
  Image as ImageIcon,
  X,
  Plus,
  ShieldCheck,
  Calendar,
  Fuel,
  Gauge,
  User,
  MapPin
} from 'lucide-react';

interface AdminVehicleAddProps {
  onBackToList: () => void;
  onVehicleCreated?: (vehicle: Vehicle) => void;
}

export const AdminVehicleAdd: React.FC<AdminVehicleAddProps> = ({
  onBackToList,
  onVehicleCreated
}) => {
  const { addVehicle, users, agencies, cities } = useDatabase();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form State
  const [plateNumber, setPlateNumber] = useState('');
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [year, setYear] = useState('2026');
  const [color, setColor] = useState('');
  
  // Extra Details State
  const [ownership, setOwnership] = useState<VehicleOwnership>('societe');
  const [status, setStatus] = useState<VehicleStatus>('actif');
  const [capacity, setCapacity] = useState('');
  const [vehicleType, setVehicleType] = useState('Fourgonnette');
  
  // Operational details
  const [driverId, setDriverId] = useState('');
  const [city, setCity] = useState('Laâyoune');
  const [currentMileage, setCurrentMileage] = useState('');
  const [fuelType, setFuelType] = useState<'diesel' | 'essence' | 'electrique'>('diesel');
  const [fuelLevel, setFuelLevel] = useState('80');
  const [insuranceExpiry, setInsuranceExpiry] = useState('2027-06-30');
  const [technicalVisitExpiry, setTechnicalVisitExpiry] = useState('2027-06-30');
  const [notes, setNotes] = useState('');

  // Image Upload State
  const [plateImage, setPlateImage] = useState<string | null>(null);
  const [imageFileName, setImageFileName] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Drivers list
  const drivers = users.filter(u => u.role === 'driver');

  // Handle Image Upload
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('L\'image dépasse 2MB. Veuillez choisir une image plus légère.');
      return;
    }

    setImageFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      setPlateImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveImage = () => {
    setPlateImage(null);
    setImageFileName(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanPlate = plateNumber.trim();
    if (!cleanPlate) {
      setFormError('Le numéro de plaque d\'immatriculation est obligatoire.');
      return;
    }

    setIsSubmitting(true);

    try {
      const selectedDriver = drivers.find(d => d.id === driverId);

      const created = addVehicle({
        plateNumber: cleanPlate,
        plateImage: plateImage || undefined,
        brand: brand.trim() || 'Véhicule',
        model: model.trim() || 'Modèle standard',
        year: year ? Number(year) || 2026 : 2026,
        color: color.trim() || 'Blanc',
        ownership,
        status,
        capacity: capacity.trim() || undefined,
        vehicleType: vehicleType.trim() || 'Fourgonnette',
        driverId: driverId || undefined,
        driverName: selectedDriver ? selectedDriver.name : undefined,
        driverPhone: selectedDriver ? selectedDriver.phone : undefined,
        city: city || 'Laâyoune',
        currentMileage: currentMileage ? Number(currentMileage) : 10000,
        fuelType,
        fuelLevel: Number(fuelLevel) || 80,
        insuranceExpiry,
        technicalVisitExpiry,
        notes: notes.trim() || undefined
      });

      if (onVehicleCreated) {
        onVehicleCreated(created);
      }
      onBackToList();
    } catch (err: any) {
      setFormError(err.message || 'Une erreur est survenue lors de l\'enregistrement du véhicule.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-5 pb-10">
      {/* Top Navigation */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <button
            onClick={onBackToList}
            className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition cursor-pointer"
            title="Retour à la liste"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight">
              Ajouter un véhicule
            </h2>
            <p className="text-xs text-slate-500">
              Enregistrement d'un nouveau véhicule dans la flotte FARIOUSY DELIVERY
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onBackToList}
          className="text-xs font-bold text-slate-500 hover:text-slate-800 transition"
        >
          Annuler
        </button>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2 text-xs text-rose-800">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* ================= CARD 1: Image de la plaque (matches video 00:08) ================= */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Image de la plaque
          </h3>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageChange}
            accept="image/png, image/jpeg, image/jpg"
            className="hidden"
          />

          {!plateImage ? (
            /* Upload Drop Area matching video */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-red-200 hover:border-red-400 bg-red-50/20 rounded-2xl p-8 text-center cursor-pointer transition-all group flex flex-col items-center justify-center"
            >
              <div className="w-14 h-14 rounded-full bg-red-100/70 text-red-600 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <Upload className="w-7 h-7" />
              </div>
              <p className="text-xs font-bold text-slate-700">
                Télécharger l'image de la plaque
              </p>
              <p className="text-[11px] text-slate-400 mt-1">
                PNG, JPG, JPEG jusqu'à 2MB
              </p>

              <button
                type="button"
                className="mt-4 px-4 py-2 text-xs font-bold text-red-600 border border-red-300 hover:bg-red-50 rounded-xl transition cursor-pointer"
              >
                Sélectionner une image
              </button>
            </div>
          ) : (
            /* Uploaded Preview with Remove */
            <div className="relative border border-slate-200 rounded-2xl p-4 bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={plateImage}
                  alt="Aperçu de la plaque"
                  className="w-20 h-14 object-cover rounded-xl border border-slate-300 shadow-2xs"
                />
                <div>
                  <span className="text-xs font-bold text-slate-800 block">
                    {imageFileName || 'Image sélectionnée'}
                  </span>
                  <span className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Prête à être enregistrée</span>
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition"
                >
                  Changer
                </button>
                <button
                  type="button"
                  onClick={handleRemoveImage}
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg transition"
                  title="Supprimer l'image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* ================= CARD 2: Informations de base (matches video 00:08) ================= */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Informations de base
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Numéro de plaque * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Numéro de plaque *
              </label>
              <input
                type="text"
                required
                value={plateNumber}
                onChange={e => setPlateNumber(e.target.value)}
                placeholder="ex. ABC-1234 (ou 66-B66220)"
                className="w-full text-xs font-mono font-bold bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Marque */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Marque
              </label>
              <input
                type="text"
                value={brand}
                onChange={e => setBrand(e.target.value)}
                placeholder="ex. Toyota, Honda, Fizz"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Modèle */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Modèle
              </label>
              <input
                type="text"
                value={model}
                onChange={e => setModel(e.target.value)}
                placeholder="ex. Camry, Civic, Sanya"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Année */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Année
              </label>
              <input
                type="number"
                value={year}
                onChange={e => setYear(e.target.value)}
                placeholder="2026"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Couleur */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Couleur
              </label>
              <input
                type="text"
                value={color}
                onChange={e => setColor(e.target.value)}
                placeholder="ex. Blanc, Noir"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
        </div>

        {/* ================= CARD 3: Détails supplémentaires (matches video 00:08) ================= */}
        <div className="p-6 bg-white border border-slate-200 rounded-2xl shadow-2xs space-y-4">
          <h3 className="text-sm font-extrabold text-slate-900">
            Détails supplémentaires
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Propriété * */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Propriété *
              </label>
              <select
                required
                value={ownership}
                onChange={e => setOwnership(e.target.value as VehicleOwnership)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="societe">Société (Propriété de l'entreprise)</option>
                <option value="prive">Privé (Appartient au livreur)</option>
                <option value="loue">Loué (Location externe)</option>
                <option value="leasing">En leasing (Crédit-bail)</option>
              </select>
            </div>

            {/* Statut */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Statut
              </label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as VehicleStatus)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="actif">Actif (Prêt à rouler)</option>
                <option value="en_tournee">En tournée (Sur le terrain)</option>
                <option value="maintenance">En maintenance (Garage / Vidange)</option>
                <option value="hors_service">Hors service</option>
              </select>
            </div>

            {/* Capacité */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Capacité
              </label>
              <input
                type="text"
                value={capacity}
                onChange={e => setCapacity(e.target.value)}
                placeholder="ex. 500 kg (ou 25 colis)"
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Type de véhicule */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type de véhicule
              </label>
              <select
                value={vehicleType}
                onChange={e => setVehicleType(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="Fourgonnette">Fourgonnette (Dokker, Partner, Kangoo)</option>
                <option value="Moto">Moto (Fizz Sanya, TMAX, C90)</option>
                <option value="Camion">Camion (Isuzu, Canter, Master)</option>
                <option value="Voiture">Voiture commerciale (Clio, Dacia Sandero)</option>
                <option value="Autre">Autre véhicule</option>
              </select>
            </div>

            {/* Chauffeur / Livreur assigné */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Chauffeur / Livreur assigné
              </label>
              <select
                value={driverId}
                onChange={e => setDriverId(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="">Sélectionner un chauffeur (Optionnel)</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.city || 'Maroc'}) - {d.phone}
                  </option>
                ))}
              </select>
            </div>

            {/* Hub / Ville */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ville / Hub assigné
              </label>
              <select
                value={city}
                onChange={e => setCity(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-medium"
              >
                <option value="Laâyoune">Hub Principal Laâyoune</option>
                <option value="Casablanca">Hub Central Casablanca</option>
                <option value="Rabat">Agence Régionale Rabat</option>
                <option value="Tanger">Agence Nord Tanger Med</option>
                <option value="Marrakech">Marrakech</option>
                <option value="Agadir">Agadir</option>
                <option value="Fès">Fès</option>
              </select>
            </div>

            {/* Kilométrage initial */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Kilométrage initial (km)
              </label>
              <input
                type="number"
                value={currentMileage}
                onChange={e => setCurrentMileage(e.target.value)}
                placeholder="ex. 15000"
                className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>

            {/* Carburant */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Type de carburant
              </label>
              <select
                value={fuelType}
                onChange={e => setFuelType(e.target.value as any)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white font-medium"
              >
                <option value="diesel">Diesel (Gazole)</option>
                <option value="essence">Essence (Sans plomb)</option>
                <option value="electrique">Électrique</option>
              </select>
            </div>

            {/* Assurance */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date d'expiration assurance
              </label>
              <input
                type="date"
                value={insuranceExpiry}
                onChange={e => setInsuranceExpiry(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
              />
            </div>

            {/* Visite technique */}
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Date visite technique
              </label>
              <input
                type="date"
                value={technicalVisitExpiry}
                onChange={e => setTechnicalVisitExpiry(e.target.value)}
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900"
              />
            </div>

            {/* Notes */}
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Notes et conditions particulières
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Remarques, équipement du véhicule, numéro de carte grise..."
                className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl p-3 text-slate-900 focus:bg-white"
              />
            </div>
          </div>
        </div>

        {/* Submit Button (matches red button in video) */}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onBackToList}
            className="px-5 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition"
          >
            Annuler
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-2 px-6 py-2.5 text-xs font-black text-white bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl shadow-xs transition-all cursor-pointer disabled:opacity-50"
          >
            <Car className="w-4 h-4" />
            <span>{isSubmitting ? 'Enregistrement...' : 'Ajouter le véhicule'}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
