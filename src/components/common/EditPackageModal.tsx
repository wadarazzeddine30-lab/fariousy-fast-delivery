import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Save, X } from 'lucide-react';
import { PackageItem } from '../../types';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { getUserAssignedCities, isCityAllowedForUser } from '../../utils/employeePermissions';
import { formatMAD } from '../../utils/barcode';

interface EditPackageModalProps {
  packageItem: PackageItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved?: (updated: Partial<PackageItem>) => void;
}

export const EditPackageModal: React.FC<EditPackageModalProps> = ({
  packageItem,
  isOpen,
  onClose,
  onSaved
}) => {
  const { cities, users, updatePackage } = useDatabase();
  const { currentUser, isClient, isEmployee } = useAuth();

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);
  const assignedCities = useMemo(() => getUserAssignedCities(currentUser), [currentUser]);

  const availableCities = useMemo(() => {
    const base =
      isEmployee && assignedCities.length > 0
        ? cities.filter(c => isCityAllowedForUser(currentUser, c.name))
        : cities;
    if (
      packageItem?.city &&
      !base.some(c => c.name.toLowerCase() === packageItem.city.toLowerCase())
    ) {
      return [
        { id: `current-${packageItem.city}`, name: packageItem.city, defaultFee: packageItem.deliveryFee || 35 } as any,
        ...base
      ];
    }
    return base;
  }, [cities, isEmployee, assignedCities, currentUser, packageItem]);

  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [productPrice, setProductPrice] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(35);
  const [codAmount, setCodAmount] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [driverId, setDriverId] = useState('');
  const [allowOpen, setAllowOpen] = useState(false);
  const [allowTry, setAllowTry] = useState(false);
  const [isFragile, setIsFragile] = useState(false);
  const [isExchange, setIsExchange] = useState(false);

  useEffect(() => {
    if (!packageItem || !isOpen) return;
    const fee = Number(packageItem.deliveryFee ?? 35);
    const cod = Number(packageItem.codAmount ?? 0);
    const prod =
      packageItem.productPrice !== undefined && packageItem.productPrice !== null
        ? Number(packageItem.productPrice)
        : Math.max(0, Math.round((cod - fee) * 100) / 100);

    setRecipientName(packageItem.recipientName || '');
    setRecipientPhone(packageItem.recipientPhone || '');
    setCity(packageItem.city || '');
    setAddress(packageItem.address || '');
    setProductPrice(prod);
    setDeliveryFee(fee);
    setCodAmount(cod);
    setDescription(packageItem.description || '');
    setNotes(packageItem.notes || '');
    setDriverId(packageItem.driverId || '');
    setAllowOpen(Boolean(packageItem.allowOpen));
    setAllowTry(Boolean(packageItem.allowTry));
    setIsFragile(Boolean(packageItem.isFragile));
    setIsExchange(Boolean(packageItem.isExchange));
  }, [packageItem, isOpen]);

  if (!isOpen || !packageItem) return null;

  const handleCityChange = (nextCity: string) => {
    setCity(nextCity);
    if (!isClient) {
      const matched = cities.find(c => c.name.toLowerCase() === nextCity.toLowerCase());
      if (matched && typeof matched.defaultFee === 'number') {
        const nextFee = matched.defaultFee;
        setDeliveryFee(nextFee);
        setCodAmount(Math.round((productPrice + nextFee) * 100) / 100);
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanProduct = Math.max(0, Number(productPrice) || 0);
    const cleanFee = isClient ? Number(packageItem.deliveryFee ?? deliveryFee) : Math.max(0, Number(deliveryFee) || 0);
    const cleanCod = Math.max(0, Math.round((cleanProduct + cleanFee) * 100) / 100);

    const assignedDriver = !isClient ? drivers.find(d => d.id === driverId) : undefined;

    const updates: Partial<PackageItem> = {
      recipientName: recipientName.trim(),
      recipientPhone: recipientPhone.trim(),
      city,
      address: address.trim(),
      productPrice: cleanProduct,
      codAmount: isClient ? Math.max(0, Number(codAmount) || cleanCod) : cleanCod,
      description: description.trim(),
      notes: notes.trim(),
      allowOpen,
      allowTry,
      isFragile,
      isExchange
    };

    if (!isClient) {
      updates.deliveryFee = cleanFee;
      updates.driverId = driverId || undefined;
      updates.driverName = assignedDriver?.name || undefined;
    }

    updatePackage(
      packageItem.id,
      updates,
      currentUser ? { name: currentUser.name, role: currentUser.role, id: currentUser.id } : undefined
    );

    if (onSaved) {
      onSaved(updates);
    }
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 max-h-[92vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center shrink-0">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                تعديل الكموند — <span className="font-mono force-ltr">{packageItem.trackingNumber}</span>
              </h3>
              <span className="text-[11px] text-slate-500 block">
                {packageItem.clientCompany || packageItem.clientName || 'Boutique'}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                اسم الزبون (Destinataire) *
              </label>
              <input
                type="text"
                required
                value={recipientName}
                onChange={e => setRecipientName(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                رقم الهاتف (Téléphone) *
              </label>
              <input
                type="tel"
                required
                value={recipientPhone}
                onChange={e => setRecipientPhone(e.target.value)}
                className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 force-ltr"
              />
            </div>
          </div>

          <div className={`grid grid-cols-1 ${!isClient ? 'sm:grid-cols-2' : ''} gap-3`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                المدينة (Ville de destination) *
              </label>
              <select
                value={city}
                onChange={e => handleCityChange(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold"
              >
                {availableCities.map(c => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {!isClient && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  الموزع المكلف (Livreur)
                </label>
                <select
                  value={driverId}
                  onChange={e => setDriverId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500 font-semibold"
                >
                  <option value="">بدون موزع (في الانتظار)</option>
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.city})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              العنوان الكامل (Adresse) *
            </label>
            <textarea
              rows={2}
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {!isClient ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ثمن المنتوج (MAD) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={productPrice}
                  onChange={e => {
                    const p = Math.max(0, Number(e.target.value) || 0);
                    setProductPrice(p);
                    setCodAmount(Math.round((p + deliveryFee) * 100) / 100);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">حصة التاجر</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  مصاريف التوصيل (MAD) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={deliveryFee}
                  onChange={e => {
                    const f = Math.max(0, Number(e.target.value) || 0);
                    setDeliveryFee(f);
                    setCodAmount(Math.round((productPrice + f) * 100) / 100);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
                <span className="text-[10px] text-slate-400 block mt-0.5">أتعاب التوصيل</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-red-600 mb-1">
                  المجموع COD للتحصيل (MAD)
                </label>
                <input
                  type="number"
                  readOnly
                  value={codAmount}
                  className="w-full px-3 py-2 text-xs font-mono font-black bg-red-50 border border-red-300 rounded-xl text-red-700 focus:outline-none"
                />
                <span className="text-[10px] text-red-600 font-medium block mt-0.5">
                  = {formatMAD(productPrice + deliveryFee)}
                </span>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  ثمن المنتوج (MAD) *
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  required
                  value={productPrice}
                  onChange={e => {
                    const p = Math.max(0, Number(e.target.value) || 0);
                    setProductPrice(p);
                    setCodAmount(Math.round((p + Number(packageItem.deliveryFee ?? 0)) * 100) / 100);
                  }}
                  className="w-full px-3 py-2 text-xs font-mono font-bold bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-red-600 mb-1">
                  المبلغ المطلوب عند التسليم (COD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={codAmount}
                  onChange={e => setCodAmount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full px-3 py-2 text-xs font-mono font-black bg-red-50 border border-red-200 rounded-xl text-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              محتوى الطلبية (Description)
            </label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="مثال: حذاء، لباس، منتوج تجميل..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              ملاحظات التوصيل (Remarques)
            </label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="مثال: الاتصال قبل التوصيل، التوصيل بعد الزوال..."
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>

          {/* Delivery Options */}
          <div>
            <span className="block text-xs font-bold text-slate-700 mb-1.5">خيارات الطرد</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${allowOpen ? 'bg-emerald-50 border-emerald-300 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={allowOpen}
                  onChange={e => setAllowOpen(e.target.checked)}
                  className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                />
                <span>فتح الطرد</span>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${allowTry ? 'bg-blue-50 border-blue-300 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={allowTry}
                  onChange={e => setAllowTry(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>القياس</span>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${isExchange ? 'bg-amber-50 border-amber-300 text-amber-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={isExchange}
                  onChange={e => setIsExchange(e.target.checked)}
                  className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                />
                <span>استبدال</span>
              </label>
              <label className={`flex items-center gap-2 p-2.5 rounded-xl border text-xs font-bold cursor-pointer ${isFragile ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                <input
                  type="checkbox"
                  checked={isFragile}
                  onChange={e => setIsFragile(e.target.checked)}
                  className="rounded border-slate-300 text-rose-600 focus:ring-rose-500"
                />
                <span>قابل للكسر</span>
              </label>
            </div>
          </div>

          <div className="pt-3 flex justify-end gap-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>حفظ التعديلات</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
