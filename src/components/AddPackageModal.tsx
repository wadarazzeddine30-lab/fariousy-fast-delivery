import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as XLSX from 'xlsx';
import { PackageItem, SavedAddress, UserProfile } from '../types';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import {
  Plus,
  Trash2,
  X,
  PackagePlus,
  Layers,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Bookmark,
  MapPin,
  Sparkles,
  Truck,
  FileSpreadsheet,
  Upload,
  Download,
  Boxes,
  FileText,
  Printer,
  Minus,
  Scan,
  ShieldAlert
} from 'lucide-react';
import { ClientStockInvoice } from '../types';
import { StockInvoiceModal } from './client/StockInvoiceModal';
import { formatMAD } from '../utils/barcode';
import { createSupabasePackage } from '../services/supabase';
import { getBestDriverForTarget } from '../utils/driverMatcher';

interface AddPackageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (pkg: PackageItem) => void;
  initialMode?: 'single' | 'bulk' | 'excel';
  preselectedStockProductId?: string | null;
}

interface BulkRow {
  recipientName: string;
  recipientPhone: string;
  city: string;
  address: string;
  productPrice: number;
  description: string;
  notes: string;
  allowOpen?: boolean;
  allowTry?: boolean;
  isFragile?: boolean;
  isExchange?: boolean;
  stockProductId?: string;
  stockQty?: number;
}

interface ExcelRow {
  id: string;
  recipientName: string;
  recipientPhone: string;
  recipientPhone2: string;
  city: string;
  address: string;
  productPrice: number;
  description: string;
  notes: string;
  allowOpen?: boolean;
  allowTry?: boolean;
  isFragile?: boolean;
  isExchange?: boolean;
}

export const AddPackageModal: React.FC<AddPackageModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialMode = 'single',
  preselectedStockProductId = null
}) => {
  const {
    cities,
    users,
    packages,
    refreshPackages,
    upsertPackageLocal,
    addStockLocation,
    agencies,
    savedAddresses,
    addSavedAddress,
    deleteSavedAddress,
    markSavedAddressUsed,
    assignPackageToDriver,
    clientStockProducts,
    scanClientStockUnit,
    deductClientStockForPackage,
    refreshBlacklist,
    findBlacklistMatches
  } = useDatabase();
  const { currentUser, isClient } = useAuth();

  const [mode, setMode] = useState<'single' | 'bulk' | 'excel'>(initialMode);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [generatedStockInvoice, setGeneratedStockInvoice] = useState<ClientStockInvoice | null>(null);
  const [isInvoicePreviewOpen, setIsInvoicePreviewOpen] = useState<boolean>(false);

  // Stock Deduction Selection (productId -> quantity)
  const [useClientStock, setUseClientStock] = useState<boolean>(false);
  const [stockQuantities, setStockQuantities] = useState<Record<string, number>>({});
  const [scanningStockId, setScanningStockId] = useState<string | null>(null);

  // Excel import state
  const excelInputRef = useRef<HTMLInputElement | null>(null);
  const [excelRows, setExcelRows] = useState<ExcelRow[]>([]);
  const [excelFileName, setExcelFileName] = useState<string | null>(null);
  const [excelProgress, setExcelProgress] = useState<{ done: number; total: number } | null>(null);
  const [isDraggingExcel, setIsDraggingExcel] = useState(false);

  // Client Selection (Directement depuis les profils et boutiques Supabase)
  const clients = useMemo(() => users.filter(u => u.role === 'client'), [users]);
  const defaultClientId = isClient && currentUser ? currentUser.id : (clients[0]?.id || '');
  const [selectedClientId, setSelectedClientId] = useState(defaultClientId);

  // Keep selectedClientId strictly synced when logged in/impersonating as client or switching clients
  useEffect(() => {
    if (isClient && currentUser?.id) {
      setSelectedClientId(currentUser.id);
    } else if (!selectedClientId && clients.length > 0) {
      setSelectedClientId(clients[0].id);
    }
  }, [isOpen, isClient, currentUser?.id, clients, selectedClientId]);

  const selectedClient = useMemo(() => {
    if (isClient && currentUser) return currentUser;
    return users.find(u => u.id === selectedClientId) || clients[0];
  }, [isClient, currentUser, users, selectedClientId, clients]);

  const activeClientStockProducts = useMemo(() => {
    const ownerIds = new Set<string>();
    if (selectedClient?.id) ownerIds.add(selectedClient.id);
    const shopId = (selectedClient as any)?.shopId;
    if (shopId) ownerIds.add(shopId);
    if (ownerIds.size === 0) return [];
    return clientStockProducts.filter(p => Boolean(p.clientId) && ownerIds.has(p.clientId));
  }, [clientStockProducts, selectedClient]);

  // Reset stock selections cleanly whenever active client changes so Client A's stock never leaks to Client B
  const prevActiveClientIdRef = useRef<string | undefined>(selectedClient?.id);
  useEffect(() => {
    if (prevActiveClientIdRef.current !== selectedClient?.id) {
      prevActiveClientIdRef.current = selectedClient?.id;
      setUseClientStock(false);
      setStockQuantities({});
      setBulkRows(prev => prev.map(r => ({ ...r, stockProductId: undefined, stockQty: undefined })));
    }
  }, [selectedClient?.id]);

  useEffect(() => {
    if (isOpen) {
      void refreshBlacklist();
      setMode(initialMode);
      setSubmitError(null);
      setSuccessNotice(null);
      setGeneratedStockInvoice(null);
      setAllowOpen(false);
      setAllowTry(false);
      setIsFragile(false);
      setIsExchange(false);
      setExchangeTrackingNumber('');
      setExchangeItemDescription('');
      if (preselectedStockProductId) {
        const preProd = activeClientStockProducts.find(p => p.id === preselectedStockProductId);
        if (preProd) {
          setUseClientStock(true);
          setStockQuantities({ [preselectedStockProductId]: 1 });
          if (preProd.unitPrice > 0) {
            setProductPrice(preProd.unitPrice);
          }
          setDescription(`1x ${preProd.name}`);
        } else {
          setUseClientStock(false);
          setStockQuantities({});
        }
      } else {
        setUseClientStock(false);
        setStockQuantities({});
      }
    }
  }, [isOpen, initialMode, preselectedStockProductId, selectedClient?.id]);

  const selectedStockSelections = useMemo(() => {
    const validIds = new Set(activeClientStockProducts.map(p => p.id));
    return Object.entries(stockQuantities)
      .filter(([pid, q]) => q > 0 && validIds.has(pid))
      .map(([productId, quantity]) => ({ productId, quantity }));
  }, [stockQuantities, activeClientStockProducts]);

  // Single Form State
  const [recipientName, setRecipientName] = useState('');
  const [recipientPhone, setRecipientPhone] = useState('');
  const [recipientPhone2, setRecipientPhone2] = useState('');
  const [city, setCity] = useState(cities[0]?.name || 'Casablanca');
  const [address, setAddress] = useState('');
  const [productPrice, setProductPrice] = useState<number>(150);
  const [codAmount, setCodAmount] = useState<number>(150);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');

  // Live Blacklist check on single recipient phone(s)
  const singleBlacklistInfo = useMemo(() => {
    const primary = findBlacklistMatches(recipientPhone);
    const secondary = recipientPhone2.trim() ? findBlacklistMatches(recipientPhone2) : null;
    const seenIds = new Set<string>();
    const combinedMatches = [...primary.matches, ...(secondary?.matches || [])].filter(m => {
      if (seenIds.has(m.id)) return false;
      seenIds.add(m.id);
      return true;
    });
    return {
      isBlacklisted: combinedMatches.length > 0,
      matches: combinedMatches,
      reportCount: combinedMatches.length,
      latestComment: combinedMatches[0]?.comment || '',
      latestReason: combinedMatches[0]?.reason || ''
    };
  }, [recipientPhone, recipientPhone2, findBlacklistMatches]);

  // Saved Addresses (عناوين محفوظة)
  const [saveAddressChecked, setSaveAddressChecked] = useState<boolean>(false);
  const [savedAddressLabel, setSavedAddressLabel] = useState<string>('');
  const [appliedAddressId, setAppliedAddressId] = useState<string | null>(null);

  // Auto-assign closest driver option (for Admin/Employee)
  const [autoAssignClosestDriver, setAutoAssignClosestDriver] = useState<boolean>(false);

  const clientSavedAddresses = useMemo(() => {
    const ownerTargetId = selectedClient?.id || currentUser?.id;
    return savedAddresses
      .filter(a => a.ownerId === ownerTargetId || (!isClient && a.ownerId === 'global'))
      .sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0));
  }, [savedAddresses, selectedClient?.id, currentUser?.id, isClient]);

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);

  const suggestedDriver = useMemo(() => {
    return getBestDriverForTarget({
      targetCity: city,
      targetAddress: address,
      drivers,
      cities,
      packages
    });
  }, [city, address, drivers, cities, packages]);

  // Options à la livraison (فتح الطرد / القياس / الاستبدال / قابل للكسر : Oui / Non)
  const [allowOpen, setAllowOpen] = useState<boolean>(false);
  const [allowTry, setAllowTry] = useState<boolean>(false);
  const [isFragile, setIsFragile] = useState<boolean>(false);
  const [isExchange, setIsExchange] = useState<boolean>(false);
  const [exchangeTrackingNumber, setExchangeTrackingNumber] = useState<string>('');
  const [exchangeReason, setExchangeReason] = useState<string>('Taille incorrecte');
  const [exchangeItemDescription, setExchangeItemDescription] = useState<string>('');

  // Default options for Excel batch import
  const [excelAllowOpen, setExcelAllowOpen] = useState<boolean>(false);
  const [excelAllowTry, setExcelAllowTry] = useState<boolean>(false);
  const [excelIsFragile, setExcelIsFragile] = useState<boolean>(false);
  const [excelIsExchange, setExcelIsExchange] = useState<boolean>(false);

  // Warehouse Stock Linkage (ربط السطوك بالزبون والطرود)
  const [assignStock, setAssignStock] = useState<boolean>(false);
  const [stockHub, setStockHub] = useState<string>('Hub Central Casablanca');
  const [stockZone, setStockZone] = useState<string>('Zone A (Nord)');
  const [stockShelf, setStockShelf] = useState<string>('Rayon 01');
  const [stockBin, setStockBin] = useState<string>('Bac 01');

  // Bulk Rows State
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([
    {
      recipientName: '',
      recipientPhone: '',
      city: 'Casablanca',
      address: '',
      productPrice: 200,
      description: 'Article standard',
      notes: '',
      allowOpen: false,
      allowTry: false,
      isFragile: false,
      isExchange: false
    },
    {
      recipientName: '',
      recipientPhone: '',
      city: 'Rabat',
      address: '',
      productPrice: 350,
      description: 'Article standard',
      notes: '',
      allowOpen: false,
      allowTry: false,
      isFragile: false,
      isExchange: false
    }
  ]);
  // Résolution du tarif réel de livraison (Tarif négocié client prioritaire, sinon tarif standard)
  const getCityRate = (targetCity: string): { fee: number; isCustom: boolean; cityName: string } | null => {
    if (!targetCity) return null;
    const cleanCity = targetCity.trim().toLowerCase();

    // 1. Priorité aux tarifs négociés personnalisés de la boutique cliente
    if (selectedClient?.customRates) {
      for (const [cityName, rate] of Object.entries(selectedClient.customRates)) {
        if (cityName.toLowerCase() === cleanCity && typeof rate === 'number' && rate > 0) {
          return { fee: rate, isCustom: true, cityName };
        }
      }
    }

    // 2. Tarif standard de la ville configuré dans le système
    const foundCity = cities.find(c => c.name.toLowerCase() === cleanCity && c.active !== false);
    if (foundCity && typeof foundCity.defaultFee === 'number' && foundCity.defaultFee > 0) {
      return { fee: foundCity.defaultFee, isCustom: false, cityName: foundCity.name };
    }

    return null;
  };

  const currentRateInfo = getCityRate(city);
  const currentFee = currentRateInfo ? currentRateInfo.fee : null;

  // Calcul monétaire précis FARIOUSY DELIVERY (Étape 85) :
  // FORMULE OBLIGATOIRE : Total CRBT à encaisser = Prix article + Frais de livraison
  const computeCRBT = (price: number, fee: number | null): number => {
    const validPrice = Math.max(0, isNaN(price) ? 0 : Math.round(price * 100) / 100);
    if (fee === null || fee === undefined || fee <= 0) {
      return validPrice;
    }
    return Math.round((validPrice + fee) * 100) / 100;
  };

  const handlePriceChange = (val: number) => {
    const cleanVal = Math.max(0, isNaN(val) ? 0 : Math.round(val * 100) / 100);
    setProductPrice(cleanVal);
    setCodAmount(computeCRBT(cleanVal, currentFee));
  };

  const handleCityChange = (newCity: string) => {
    setCity(newCity);
    const newRate = getCityRate(newCity);
    setCodAmount(computeCRBT(productPrice, newRate ? newRate.fee : null));
  };

  // Recalcul automatique lorsque le client ou la ville change
  useEffect(() => {
    const rateInfo = getCityRate(city);
    setCodAmount(computeCRBT(productPrice, rateInfo ? rateInfo.fee : null));
  }, [selectedClientId, city, users, cities]);

  const handleApplySavedAddress = (saved: SavedAddress) => {
    setRecipientName(saved.recipientName);
    setRecipientPhone(saved.recipientPhone);
    setRecipientPhone2(saved.recipientPhone2 || '');
    setCity(saved.city);
    setAddress(saved.address);
    if (saved.notes) setNotes(saved.notes);
    const rateInfo = getCityRate(saved.city);
    setCodAmount(computeCRBT(productPrice, rateInfo ? rateInfo.fee : null));
    setAppliedAddressId(saved.id);
    setSaveAddressChecked(false);
    markSavedAddressUsed(saved.id);
  };

  const handleSingleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessNotice(null);

    if (!selectedClient) {
      setSubmitError("Veuillez sélectionner une boutique cliente. Si aucune boutique n'apparaît, créez-en une dans 'Admin → Clients'.");
      return;
    }

    if (!recipientName.trim() || !recipientPhone.trim() || !address.trim()) {
      setSubmitError('Veuillez remplir obligatoirement le nom, le numéro de téléphone et l\'adresse de livraison.');
      return;
    }

    const rateInfo = getCityRate(city);
    if (!rateInfo || rateInfo.fee <= 0) {
      setSubmitError(`Aucun tarif de livraison applicable n'est configuré pour la ville « ${city} ». L'enregistrement est bloqué jusqu'à sa configuration.`);
      return;
    }

    if (productPrice < 0 || isNaN(productPrice)) {
      setSubmitError("Le prix de l'article doit être un montant positif ou nul.");
      return;
    }

      const targetShopId = (selectedClient as any)?.shopId || selectedClient.id;
    if (!targetShopId) {
      setSubmitError("Identifiant de la boutique introuvable pour le client sélectionné.");
      return;
    }

    // Validate stock availability before creating the package if stock deduction is enabled
    if (useClientStock) {
      if (selectedStockSelections.length === 0) {
        setSubmitError('يرجى اختيار منتوج واحد على الأقل من السطوك أو إلغاء تفعيل السحب من السطوك.');
        return;
      }
      for (const sel of selectedStockSelections) {
        const prod = activeClientStockProducts.find(p => p.id === sel.productId);
        if (!prod) {
          setSubmitError('أحد المنتوجات المختارة غير موجود في السطوك.');
          return;
        }
        const avail = prod.units.filter(u => u.status === 'en_stock').length;
        if (avail < sel.quantity) {
          const pending = prod.units.filter(u => u.status === 'en_attente').length;
          setSubmitError(
            `الكمية المتوفرة فالسطوك لـ "${prod.name}" هي ${avail} قطعة مسكانة فقط (${pending} فانتظار السكان).`
          );
          return;
        }
      }
    }

    setIsSubmitting(true);

    try {
      let fullNotes = notes.trim();
      if (recipientPhone2.trim()) {
        fullNotes = fullNotes ? `Tél 2: ${recipientPhone2.trim()} | ${fullNotes}` : `Tél 2: ${recipientPhone2.trim()}`;
      }

      // Règle commerciale FARIOUSY : Total CRBT = Prix article + Frais de livraison
      const cleanProductPrice = Math.max(0, Math.round(productPrice * 100) / 100);
      const deliveryFee = rateInfo.fee;
      const expectedCRBT = Math.round((cleanProductPrice + deliveryFee) * 100) / 100;

      const stockPos = assignStock ? `${stockHub} - ${stockZone} - ${stockShelf} - ${stockBin}` : undefined;

      const stockSummaryDesc =
        useClientStock && selectedStockSelections.length > 0
          ? selectedStockSelections
              .map(sel => {
                const p = activeClientStockProducts.find(x => x.id === sel.productId);
                return p ? `${sel.quantity}x ${p.name}` : '';
              })
              .filter(Boolean)
              .join(' + ')
          : '';

      const res = await createSupabasePackage({
        shopId: targetShopId,
        clientName: selectedClient.name,
        clientCompany: selectedClient.companyName,
        clientPhone: selectedClient.phone,
        recipientName: recipientName.trim(),
        recipientPhone: recipientPhone.trim(),
        city: city.trim(),
        address: address.trim(),
        description: description.trim() || stockSummaryDesc || (isExchange ? "Colis d'échange" : 'Colis e-commerce'),
        productPrice: cleanProductPrice,
        deliveryFee: deliveryFee,
        codAmount: expectedCRBT,
        notes: fullNotes || undefined,
        // Options de livraison (Oui / Non)
        allowOpen,
        allowTry,
        isFragile,
        // Exchange (استبدال)
        isExchange: isExchange,
        exchangeTrackingNumber: isExchange ? exchangeTrackingNumber.trim().toUpperCase() : undefined,
        exchangeReason: isExchange ? exchangeReason : undefined,
        exchangeItemDescription: isExchange ? exchangeItemDescription.trim() : undefined,
        // Warehouse Stock link (ربط السطوك)
        stockPosition: stockPos
      });

      if (!res.success || !res.package) {
        setSubmitError(res.error || "Erreur lors de l'enregistrement du colis dans Supabase.");
        setIsSubmitting(false);
        return;
      }

      upsertPackageLocal(res.package);

      // Deduct from Client Stock & Auto-Generate Invoice if selected
      let createdInvoice: ClientStockInvoice | null = null;
      let stockDeductError: string | null = null;
      if (selectedStockSelections.length > 0 && res.package) {
        const dedRes = await deductClientStockForPackage({
          clientId: selectedClient.id,
          shopId: (selectedClient as any)?.shopId,
          clientName: selectedClient.name,
          clientCompany: selectedClient.companyName,
          clientPhone: selectedClient.phone,
          packageId: res.package.id,
          trackingNumber: res.package.trackingNumber,
          recipientName: res.package.recipientName,
          recipientCity: res.package.city,
          deliveryFee: deliveryFee,
          items: selectedStockSelections,
          actorName: currentUser?.name || selectedClient.name
        });
        if (dedRes.success && dedRes.invoice) {
          createdInvoice = dedRes.invoice;
          setGeneratedStockInvoice(dedRes.invoice);
        } else if (!dedRes.success) {
          stockDeductError = dedRes.error || 'تعذر خصم القطع من السطوك تلقائياً.';
          setSubmitError(stockDeductError);
        }
      }

      // Si l'option d'assignation au stock magasin est activée, lier directement au stock
      if (assignStock && res.package) {
        addStockLocation({
          packageId: res.package.id,
          trackingNumber: res.package.trackingNumber,
          hubName: stockHub,
          zone: stockZone,
          shelf: stockShelf,
          bin: stockBin,
          status: 'en_stock',
          notes: isExchange ? `Colis d'échange pour ${res.package.recipientName}` : `Stock client ${selectedClient?.companyName || selectedClient?.name}`,
          clientId: selectedClient?.id,
          clientName: selectedClient?.name,
          clientCompany: selectedClient?.companyName,
          clientPhone: selectedClient?.phone,
          recipientName: res.package.recipientName,
          destinationCity: res.package.city,
          codAmount: res.package.codAmount,
          isExchange: isExchange
        });
      }

      // Enregistrer dans les adresses favorites si demandé
      if (saveAddressChecked && (selectedClient?.id || currentUser?.id)) {
        addSavedAddress({
          ownerId: selectedClient?.id || currentUser?.id || 'global',
          label: savedAddressLabel.trim() || `${recipientName.trim()} — ${city.trim()}`,
          recipientName: recipientName.trim(),
          recipientPhone: recipientPhone.trim(),
          recipientPhone2: recipientPhone2.trim() || undefined,
          city: city.trim(),
          address: address.trim(),
          notes: notes.trim() || undefined
        });
      }

      // Auto-assigner au livreur le plus proche si activé par l'administrateur
      if (!isClient && autoAssignClosestDriver && suggestedDriver && res.package) {
        await assignPackageToDriver(
          res.package.id,
          suggestedDriver.driver.id,
          suggestedDriver.driver.name,
          false,
          currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
        );
      }

      setSuccessNotice(
        `Colis ${res.package.trackingNumber} enregistré avec succès ! Total CRBT : ${expectedCRBT} MAD${
          createdInvoice ? ` • تم خصم السطوك وتوليد الفاتورة ${createdInvoice.invoiceNumber}` : ''
        }${
          !isClient && autoAssignClosestDriver && suggestedDriver
            ? ` • تم التعيين تلقائياً للسائق: ${suggestedDriver.driver.name}`
            : ''
        }`
      );

      setRecipientName('');
      setRecipientPhone('');
      setRecipientPhone2('');
      setAddress('');
      setDescription('');
      setNotes('');
      setAppliedAddressId(null);

      // Actualiser immédiatement la liste des colis depuis Supabase
      await refreshPackages();

      if (onSuccess) {
        onSuccess(res.package);
      }

      if (!createdInvoice && !stockDeductError) {
        setTimeout(() => {
          onClose();
        }, 1400);
      } else if (createdInvoice) {
        setStockQuantities({});
        setUseClientStock(false);
      }
    } catch (err: any) {
      setSubmitError(err.message || "Erreur réseau lors de l'enregistrement du colis.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Bulk handlers
  const handleAddBulkRow = () => {
    setBulkRows([
      ...bulkRows,
      {
        recipientName: '',
        recipientPhone: '',
        city: 'Casablanca',
        address: '',
        productPrice: 200,
        description: 'Article standard',
        notes: '',
        allowOpen: false,
        allowTry: false,
        isFragile: false,
        isExchange: false
      }
    ]);
  };

  const handleRemoveBulkRow = (index: number) => {
    setBulkRows(bulkRows.filter((_, idx) => idx !== index));
  };

  const handleUpdateBulkRow = (index: number, field: keyof BulkRow, val: any) => {
    const updated = [...bulkRows];
    updated[index] = { ...updated[index], [field]: val };
    setBulkRows(updated);
  };

  const handleBulkSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessNotice(null);

    if (!selectedClient) {
      setSubmitError("Veuillez sélectionner une boutique cliente.");
      return;
    }

    const validRows = bulkRows.filter(r => r.recipientName.trim() && r.recipientPhone.trim() && r.address.trim());
    if (validRows.length === 0) {
      setSubmitError('Veuillez renseigner au moins une ligne complète (Nom, Téléphone et Adresse).');
      return;
    }

    // Contrôle préalable des tarifs et du stock de toutes les lignes
    const requestedStockTotals: Record<string, number> = {};
    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const rateInfo = getCityRate(row.city);
      if (!rateInfo || rateInfo.fee <= 0) {
        setSubmitError(`Ligne ${i + 1} (${row.recipientName || 'Destinataire'}) : Aucun tarif de livraison configuré pour la ville « ${row.city} ». L'enregistrement est bloqué.`);
        return;
      }
      if (row.productPrice < 0 || isNaN(row.productPrice)) {
        setSubmitError(`Ligne ${i + 1} (${row.recipientName}) : Le prix de l'article ne peut pas être négatif.`);
        return;
      }
      if (row.stockProductId) {
        const q = Math.max(1, row.stockQty || 1);
        requestedStockTotals[row.stockProductId] = (requestedStockTotals[row.stockProductId] || 0) + q;
      }
    }

    for (const [pid, totalNeed] of Object.entries(requestedStockTotals)) {
      const prod = activeClientStockProducts.find(p => p.id === pid);
      if (!prod) {
        setSubmitError('أحد المنتوجات المختارة من السطوك لا ينتمي لهذا الزبون.');
        return;
      }
      const avail = prod.units.filter(u => u.status === 'en_stock').length;
      if (avail < totalNeed) {
        setSubmitError(
          `الكمية المتوفرة فالسطوك لـ "${prod.name}" هي ${avail} فقط بينما طلبتِ ${totalNeed} قطعة.`
        );
        return;
      }
    }

    const targetShopId = (selectedClient as any)?.shopId || selectedClient.id;
    setIsSubmitting(true);

    try {
      let createdCount = 0;
      let deductedInvoicesCount = 0;
      const errors: string[] = [];
      let lastCreated: PackageItem | null = null;
      let lastInvoice: ClientStockInvoice | null = null;

      for (const row of validRows) {
        const rateInfo = getCityRate(row.city)!;
        const cleanProductPrice = Math.max(0, Math.round(row.productPrice * 100) / 100);
        const rowFee = rateInfo.fee;
        const rowCRBT = Math.round((cleanProductPrice + rowFee) * 100) / 100;

        const res = await createSupabasePackage({
          shopId: targetShopId,
          clientName: selectedClient.name,
          clientCompany: selectedClient.companyName,
          clientPhone: selectedClient.phone,
          recipientName: row.recipientName.trim(),
          recipientPhone: row.recipientPhone.trim(),
          city: row.city.trim(),
          address: row.address.trim(),
          description: row.description?.trim() || 'Colis e-commerce',
          productPrice: cleanProductPrice,
          deliveryFee: rowFee,
          codAmount: rowCRBT,
          notes: row.notes?.trim() || undefined,
          allowOpen: Boolean(row.allowOpen),
          allowTry: Boolean(row.allowTry),
          isFragile: Boolean(row.isFragile),
          isExchange: Boolean(row.isExchange)
        });

        if (res.success && res.package) {
          createdCount++;
          lastCreated = res.package;
          upsertPackageLocal(res.package);

          if (row.stockProductId) {
            const dedRes = await deductClientStockForPackage({
              clientId: selectedClient.id,
              shopId: (selectedClient as any)?.shopId,
              clientName: selectedClient.name,
              clientCompany: selectedClient.companyName,
              clientPhone: selectedClient.phone,
              packageId: res.package.id,
              trackingNumber: res.package.trackingNumber,
              recipientName: res.package.recipientName,
              recipientCity: res.package.city,
              deliveryFee: rowFee,
              items: [{ productId: row.stockProductId, quantity: Math.max(1, row.stockQty || 1) }],
              actorName: currentUser?.name || selectedClient.name
            });
            if (dedRes.success && dedRes.invoice) {
              deductedInvoicesCount++;
              lastInvoice = dedRes.invoice;
            } else if (!dedRes.success) {
              errors.push(dedRes.error || `Erreur stock ${row.recipientName}`);
            }
          }
        } else {
          errors.push(res.error || `Erreur destinataire ${row.recipientName}`);
        }
      }

      await refreshPackages();

      if (lastInvoice) {
        setGeneratedStockInvoice(lastInvoice);
      }

      if (createdCount > 0) {
        setSuccessNotice(
          `${createdCount} colis enregistré(s) avec succès !${
            deductedInvoicesCount > 0 ? ` • تم خصم السطوك وتوليد ${deductedInvoicesCount} فاتورة` : ''
          }`
        );
        if (errors.length > 0) {
          setSubmitError(errors.join(' | '));
        }
        if (onSuccess && lastCreated) {
          onSuccess(lastCreated);
        }
        if (!lastInvoice && errors.length === 0) {
          setTimeout(() => {
            onClose();
          }, 1400);
        }
      } else {
        setSubmitError(`Aucun colis n'a pu être créé : ${errors.join(', ')}`);
      }
    } catch (err: any) {
      setSubmitError(err.message || "Erreur inattendue lors de l'enregistrement groupé.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // ================= EXCEL IMPORT HELPERS =================
  const normalizeText = (val: unknown): string =>
    String(val ?? '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toLowerCase();

  const resolveMatchingCity = (rawCity: string): string => {
    const clean = normalizeText(rawCity);
    if (!clean) return cities[0]?.name || 'Casablanca';

    const exact = cities.find(c => normalizeText(c.name) === clean);
    if (exact) return exact.name;

    const aliases: Record<string, string> = {
      casa: 'Casablanca',
      darbeida: 'Casablanca',
      kesh: 'Marrakech',
      kech: 'Marrakech',
      mrk: 'Marrakech',
      rba: 'Rabat',
      tng: 'Tanger',
      tangier: 'Tanger',
      fez: 'Fès',
      fes: 'Fès',
      agadir: 'Agadir',
      meknes: 'Meknès',
      kenitra: 'Kénitra',
      oujda: 'Oujda',
      tetouan: 'Tétouan',
      mohammedia: 'Mohammedia',
      sale: 'Salé',
      temara: 'Témara'
    };
    const compact = clean.replace(/[^a-z0-9]/g, '');
    if (aliases[compact]) {
      const aliasTarget = cities.find(c => normalizeText(c.name) === normalizeText(aliases[compact]));
      if (aliasTarget) return aliasTarget.name;
    }

    const partial = cities.find(
      c => normalizeText(c.name).includes(clean) || clean.includes(normalizeText(c.name))
    );
    return partial ? partial.name : rawCity.trim();
  };

  const parsePriceValue = (raw: unknown): number => {
    if (typeof raw === 'number' && !isNaN(raw)) return Math.max(0, Math.round(raw * 100) / 100);
    const cleaned = String(raw ?? '')
      .replace(/[^\d.,-]/g, '')
      .replace(',', '.');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? 0 : Math.max(0, Math.round(parsed * 100) / 100);
  };

  const pickColumnValue = (record: Record<string, unknown>, candidates: string[]): string => {
    for (const [key, val] of Object.entries(record)) {
      const normKey = normalizeText(key).replace(/[_-]+/g, ' ');
      if (candidates.some(c => normKey === c || normKey.includes(c))) {
        const str = String(val ?? '').trim();
        if (str) return str;
      }
    }
    return '';
  };

  const handleDownloadExcelTemplate = () => {
    const city1 = cities[0]?.name || 'Casablanca';
    const city2 = cities[1]?.name || 'Rabat';
    const templateData = [
      {
        Destinataire: 'Youssef El Amrani',
        Telephone: '0661234567',
        'Telephone 2': '',
        Ville: city1,
        Adresse: 'Quartier Maarif, Rue 12, N 4',
        Prix: 200,
        Produit: 'Chaussures Sport',
        Notes: 'Appeler avant livraison'
      },
      {
        Destinataire: 'Salma Bennani',
        Telephone: '0662345678',
        'Telephone 2': '0537112233',
        Ville: city2,
        Adresse: 'Agdal, Avenue Fal Ould Oumeir',
        Prix: 350,
        Produit: 'Sac a main',
        Notes: ''
      }
    ];

    const ws = XLSX.utils.json_to_sheet(templateData);
    ws['!cols'] = [
      { wch: 22 },
      { wch: 15 },
      { wch: 15 },
      { wch: 16 },
      { wch: 32 },
      { wch: 10 },
      { wch: 22 },
      { wch: 24 }
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Colis');
    XLSX.writeFile(wb, 'modele_import_colis_fariousy.xlsx');
  };

  const parseExcelFile = async (file: File) => {
    setSubmitError(null);
    setSuccessNotice(null);

    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames[0];
      if (!firstSheetName) {
        setSubmitError('Le fichier Excel ne contient aucune feuille.');
        return;
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });

      if (!rawRows || rawRows.length === 0) {
        setSubmitError('Aucune ligne détectée dans ce fichier Excel.');
        return;
      }

      const normalizeExcelPhone = (raw: string): string => {
        const cleaned = String(raw || '').trim().replace(/[\s().-]+/g, '');
        if (!cleaned) return '';
        if (/^\+212[567]\d{8}$/.test(cleaned)) return `0${cleaned.slice(4)}`;
        if (/^212[567]\d{8}$/.test(cleaned)) return `0${cleaned.slice(3)}`;
        if (/^[567]\d{8}$/.test(cleaned)) return `0${cleaned}`;
        return String(raw || '').trim();
      };

      const parsedRows: ExcelRow[] = rawRows
        .map((rec, index) => {
          const recipientName = pickColumnValue(rec, [
            'destinataire',
            'nom complet',
            'nom du client',
            'nom client',
            'nom',
            'recipient',
            'client',
            'name',
            'الاسم الكامل',
            'اسم الزبون',
            'الاسم',
            'المرسل اليه',
            'الزبون'
          ]);
          const recipientPhone = normalizeExcelPhone(
            pickColumnValue(rec, [
              'telephone 1',
              'telephone',
              'tel 1',
              'tel',
              'phone',
              'gsm',
              'mobile',
              'numero',
              'رقم الهاتف',
              'الهاتف',
              'النمرة',
              'تليفون'
            ])
          );
          const recipientPhone2 = normalizeExcelPhone(
            pickColumnValue(rec, [
              'telephone 2',
              'tel 2',
              'tel2',
              'phone 2',
              'phone2',
              'الهاتف 2'
            ])
          );
          const rawCity = pickColumnValue(rec, ['ville', 'city', 'destination', 'المدينة', 'مدينة']);
          const matchedCity = resolveMatchingCity(rawCity);
          const rawAddress = pickColumnValue(rec, [
            'adresse',
            'address',
            'quartier',
            'secteur',
            'zone',
            'lieu',
            'العنوان الكامل',
            'العنوان',
            'عنوان',
            'الحي'
          ]);
          const address = rawAddress || matchedCity || '';
          const rawPrice = pickColumnValue(rec, [
            'prix article',
            'prix',
            'price',
            'montant',
            'cod',
            'crbt',
            'total',
            'السعر',
            'الثمن',
            'المبلغ'
          ]);
          const description = pickColumnValue(rec, [
            'produit',
            'description',
            'article',
            'product',
            'contenu',
            'المنتوج',
            'المنتج',
            'السلعة',
            'الوصف'
          ]);
          const notes = pickColumnValue(rec, ['notes', 'note', 'remarque', 'remarques', 'commentaire', 'ملاحظات', 'ملاحظة']);
          const parseBoolOption = (val: string, fallback: boolean): boolean => {
            const norm = normalizeText(val);
            if (!norm) return fallback;
            if (['oui', 'yes', 'true', '1', 'o', 'y', 'نعم'].includes(norm)) return true;
            if (['non', 'no', 'false', '0', 'n', 'لا'].includes(norm)) return false;
            return fallback;
          };
          const rawOpen = pickColumnValue(rec, ['ouvrir', 'ouvrir le colis', 'open', 'allow open', 'فتح']);
          const rawTry = pickColumnValue(rec, ['essayage', 'essayer', 'try', 'allow try', 'قياس']);
          const rawFragile = pickColumnValue(rec, ['fragile', 'fragil', 'attention fragile', 'attention fragil', 'قابل للكسر']);
          const rawExchange = pickColumnValue(rec, ['echange', 'exchange', 'change', 'استبدال']);

          return {
            id: `xls-${Date.now()}-${index}`,
            recipientName,
            recipientPhone,
            recipientPhone2,
            city: matchedCity,
            address,
            productPrice: parsePriceValue(rawPrice),
            description: description || 'Colis e-commerce',
            notes,
            allowOpen: rawOpen ? parseBoolOption(rawOpen, excelAllowOpen) : undefined,
            allowTry: rawTry ? parseBoolOption(rawTry, excelAllowTry) : undefined,
            isFragile: rawFragile ? parseBoolOption(rawFragile, excelIsFragile) : undefined,
            isExchange: rawExchange ? parseBoolOption(rawExchange, excelIsExchange) : undefined
          };
        })
        .filter(
          r =>
            r.recipientName ||
            r.recipientPhone ||
            r.address ||
            r.productPrice > 0
        );

      if (parsedRows.length === 0) {
        setSubmitError(
          'Impossible de trouver des données valides. Vérifiez les colonnes : Destinataire, Telephone, Ville, Adresse, Prix.'
        );
        return;
      }

      setExcelFileName(file.name);
      setExcelRows(parsedRows);
    } catch (err: any) {
      setSubmitError(err?.message || 'Erreur lors de la lecture du fichier Excel.');
    }
  };

  const handleExcelFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      parseExcelFile(file);
    }
    e.target.value = '';
  };

  const handleUpdateExcelRow = (index: number, field: keyof ExcelRow, val: any) => {
    setExcelRows(prev => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };
      return copy;
    });
  };

  const handleRemoveExcelRow = (index: number) => {
    setExcelRows(prev => prev.filter((_, idx) => idx !== index));
  };

  const excelValidStatus = useMemo(() => {
    return excelRows.map(row => {
      const rateInfo = getCityRate(row.city);
      const missingFields: string[] = [];
      if (!row.recipientName.trim()) missingFields.push('Nom');
      if (!row.recipientPhone.trim()) missingFields.push('Tél');
      if (!row.address.trim()) missingFields.push('Adresse');
      if (!rateInfo || rateInfo.fee <= 0) missingFields.push('Tarif ville');
      return {
        isValid: missingFields.length === 0,
        missingFields,
        fee: rateInfo?.fee ?? 0,
        crbt: Math.round((Math.max(0, row.productPrice || 0) + (rateInfo?.fee ?? 0)) * 100) / 100
      };
    });
  }, [excelRows, selectedClient, cities]);

  const validExcelCount = excelValidStatus.filter(s => s.isValid).length;

  const handleExcelSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);
    setSuccessNotice(null);

    if (!selectedClient) {
      setSubmitError('Veuillez sélectionner une boutique cliente.');
      return;
    }

    if (excelRows.length === 0) {
      setSubmitError('Veuillez d’abord importer un fichier Excel (.xlsx, .xls ou .csv).');
      return;
    }

    const invalidIndex = excelValidStatus.findIndex(s => !s.isValid);
    if (invalidIndex !== -1) {
      const badRow = excelRows[invalidIndex];
      const reason = excelValidStatus[invalidIndex].missingFields.join(', ');
      setSubmitError(
        `Ligne ${invalidIndex + 1} (${badRow.recipientName || 'Sans nom'}) incomplète : ${reason}. Corrigez ou supprimez la ligne avant d'importer.`
      );
      return;
    }

    const targetShopId = (selectedClient as any)?.shopId || selectedClient.id;
    setIsSubmitting(true);
    setExcelProgress({ done: 0, total: excelRows.length });

    try {
      let createdCount = 0;
      const errors: string[] = [];
      let lastCreated: PackageItem | null = null;

      for (let i = 0; i < excelRows.length; i++) {
        const row = excelRows[i];
        const rateInfo = getCityRate(row.city)!;
        const cleanProductPrice = Math.max(0, Math.round((row.productPrice || 0) * 100) / 100);
        const rowFee = rateInfo.fee;
        const rowCRBT = Math.round((cleanProductPrice + rowFee) * 100) / 100;

        let fullNotes = row.notes?.trim() || '';
        if (row.recipientPhone2?.trim()) {
          fullNotes = fullNotes ? `Tél 2: ${row.recipientPhone2.trim()} | ${fullNotes}` : `Tél 2: ${row.recipientPhone2.trim()}`;
        }

        const res = await createSupabasePackage({
          shopId: targetShopId,
          clientName: selectedClient.name,
          clientCompany: selectedClient.companyName,
          clientPhone: selectedClient.phone,
          recipientName: row.recipientName.trim(),
          recipientPhone: row.recipientPhone.trim(),
          city: row.city.trim(),
          address: row.address.trim(),
          description: row.description?.trim() || 'Colis e-commerce',
          productPrice: cleanProductPrice,
          deliveryFee: rowFee,
          codAmount: rowCRBT,
          notes: fullNotes || undefined,
          allowOpen: row.allowOpen !== undefined ? row.allowOpen : excelAllowOpen,
          allowTry: row.allowTry !== undefined ? row.allowTry : excelAllowTry,
          isFragile: row.isFragile !== undefined ? row.isFragile : excelIsFragile,
          isExchange: row.isExchange !== undefined ? row.isExchange : excelIsExchange
        });

        if (res.success && res.package) {
          createdCount++;
          lastCreated = res.package;
          upsertPackageLocal(res.package);
        } else {
          errors.push(`Ligne ${i + 1}: ${res.error || 'Erreur Supabase'}`);
        }

        setExcelProgress({ done: i + 1, total: excelRows.length });
      }

      await refreshPackages();

      if (createdCount > 0) {
        setSuccessNotice(
          `${createdCount} / ${excelRows.length} colis importés et enregistrés avec succès depuis Excel !${
            errors.length > 0 ? ` (${errors.length} erreur(s))` : ''
          }`
        );
        if (onSuccess && lastCreated) {
          onSuccess(lastCreated);
        }
        setExcelRows([]);
        setExcelFileName(null);
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setSubmitError(`Aucun colis importé : ${errors.slice(0, 3).join(' | ')}`);
      }
    } catch (err: any) {
      setSubmitError(err?.message || "Erreur inattendue lors de l'import Excel.");
    } finally {
      setIsSubmitting(false);
      setExcelProgress(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
              <PackagePlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Enregistrer de Nouveaux Colis</h3>
              <p className="text-xs text-slate-500">Ajout à l'unité ou saisie groupée multi-colis</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch between Single, Bulk and Excel */}
        <div className="px-6 pt-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-2 overflow-x-auto">
            <button
              type="button"
              onClick={() => setMode('single')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                mode === 'single'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <PackagePlus className="w-4 h-4" />
              <span>Colis Unique</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('bulk')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                mode === 'bulk'
                  ? 'border-red-600 text-red-600'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Layers className="w-4 h-4" />
              <span>Ajout Multiple (Grille)</span>
            </button>
            <button
              type="button"
              onClick={() => setMode('excel')}
              className={`flex items-center gap-1.5 pb-2.5 px-3 text-xs font-bold border-b-2 transition-all shrink-0 cursor-pointer ${
                mode === 'excel'
                  ? 'border-emerald-600 text-emerald-700'
                  : 'border-transparent text-slate-500 hover:text-emerald-700'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Importer Excel (.xlsx)</span>
            </button>
          </div>

          {!isClient && (
            <div className="flex items-center gap-2 pb-2">
              <span className="text-xs text-slate-500 font-medium">Expéditeur :</span>
              <select
                value={selectedClientId}
                onChange={e => setSelectedClientId(e.target.value)}
                className="text-xs font-semibold bg-slate-100 border border-slate-200 rounded-lg px-2.5 py-1 text-slate-800"
              >
                {clients.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.companyName || c.name} ({c.city})
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          {submitError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-800">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1 font-medium">{submitError}</div>
            </div>
          )}

          {successNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2 text-xs text-emerald-800">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div className="flex-1 font-bold">{successNotice}</div>
              </div>
              {generatedStockInvoice && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsInvoicePreviewOpen(true)}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-red-600 text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    <span>عرض وطباعة الفاتورة ({generatedStockInvoice.invoiceNumber})</span>
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3 py-1.5 bg-white border border-emerald-300 text-emerald-900 rounded-lg text-xs font-bold cursor-pointer"
                  >
                    إغلاق
                  </button>
                </div>
              )}
            </div>
          )}

          {clients.length === 0 && !isClient && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2.5 text-xs text-amber-800">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Aucune boutique cliente enregistrée dans Supabase Production.</p>
                <p className="text-[11px] text-amber-700 mt-0.5">
                  Veuillez créer une première boutique dans le menu « Admin → Clients » avant de pouvoir enregistrer des colis.
                </p>
              </div>
            </div>
          )}

          {mode === 'single' ? (
            <form id="single-package-form" onSubmit={handleSingleSubmit} className="space-y-4">
              {/* 📍 SAVED ADDRESSES 1-CLICK PICKER */}
              {clientSavedAddresses.length > 0 && (
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-amber-950 flex items-center gap-1.5">
                      <Bookmark className="w-3.5 h-3.5 text-amber-600" />
                      <span>العناوين المحفوظة (اختيار بكليك واحد — {clientSavedAddresses.length})</span>
                    </span>
                    <span className="text-[10px] text-amber-700 font-semibold">
                      كليكي على العنوان باش يتعمر تلقائياً
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {clientSavedAddresses.map(addr => {
                      const isApplied = appliedAddressId === addr.id;
                      return (
                        <div
                          key={addr.id}
                          className={`group inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 text-xs transition-all cursor-pointer ${
                            isApplied
                              ? 'bg-red-600 text-white border-red-600 shadow-xs'
                              : 'bg-white text-slate-800 border-amber-200 hover:border-red-400 hover:bg-red-50/40'
                          }`}
                          onClick={() => handleApplySavedAddress(addr)}
                          title={`${addr.recipientName} • ${addr.recipientPhone} • ${addr.address}`}
                        >
                          <MapPin className={`w-3.5 h-3.5 shrink-0 ${isApplied ? 'text-white' : 'text-red-500'}`} />
                          <div className="leading-tight">
                            <span className="font-bold block">{addr.label}</span>
                            <span className={`text-[10px] block ${isApplied ? 'text-red-100' : 'text-slate-500'}`}>
                              {addr.city} • {addr.recipientPhone}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={e => {
                              e.stopPropagation();
                              deleteSavedAddress(addr.id);
                              if (appliedAddressId === addr.id) setAppliedAddressId(null);
                            }}
                            className={`p-0.5 rounded opacity-60 hover:opacity-100 ${
                              isApplied ? 'hover:bg-red-700 text-white' : 'hover:bg-rose-100 text-rose-600'
                            }`}
                            title="حذف من العناوين المحفوظة"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Recipient Name */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Nom complet du destinataire *
                  </label>
                  <input
                    type="text"
                    required
                    value={recipientName}
                    onChange={e => setRecipientName(e.target.value)}
                    placeholder="Ex: Youssef El Amrani"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Recipient Phone */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Téléphone principal du destinataire *
                  </label>
                  <input
                    type="tel"
                    required
                    value={recipientPhone}
                    onChange={e => setRecipientPhone(e.target.value)}
                    placeholder="Ex: 06 61 23 45 67"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* Alternate Phone */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Téléphone secondaire (optionnel)
                  </label>
                  <input
                    type="tel"
                    value={recipientPhone2}
                    onChange={e => setRecipientPhone2(e.target.value)}
                    placeholder="Ex: 05 22 11 22 33"
                    className="w-full text-xs font-mono bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                {/* City */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Ville de destination *
                  </label>
                  <select
                    value={city}
                    onChange={e => handleCityChange(e.target.value)}
                    className="w-full text-xs font-semibold bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  >
                    {cities.map(c => {
                      const rate = getCityRate(c.name);
                      return (
                        <option key={c.id} value={c.name}>
                          {c.name} {rate ? `(${formatMAD(rate.fee)}${rate.isCustom ? ' - Négocié' : ''})` : '(Sans tarif)'} — Délai {c.deliveryDelayHours}h
                        </option>
                      );
                    })}
                  </select>
                </div>
              </div>

              {/* Instant Blacklist Warning Alert (Single Mode) */}
              {singleBlacklistInfo.isBlacklisted && (
                <div
                  dir="rtl"
                  className="p-3.5 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-950 space-y-2"
                >
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-black text-rose-900">
                          تنبيه: هاد الزبون فاللائحة السوداء (Blacklist) وراه كيلغي الطلبيات!
                        </p>
                        <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[10px] font-black font-mono tabular-nums whitespace-nowrap">
                          {singleBlacklistInfo.reportCount}{' '}
                          {singleBlacklistInfo.reportCount === 1 ? 'بلاغ' : 'بلاغات'}
                        </span>
                      </div>
                      <p className="text-[11px] font-bold text-rose-800 mt-0.5">
                        Attention : ce numéro figure dans la liste noire partagée — vérifiez avant d&apos;expédier.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pr-7">
                    {singleBlacklistInfo.matches.slice(0, 3).map(match => (
                      <div
                        key={match.id}
                        className="bg-white/90 border border-rose-200 rounded-lg px-2.5 py-2 text-[11px]"
                      >
                        <div className="flex flex-wrap items-center gap-2 font-bold text-rose-800">
                          <span>• {match.reason}</span>
                          <span className="text-slate-500 font-semibold">
                            ({match.reportedByCompany || match.reportedByName})
                          </span>
                        </div>
                        <p className="text-slate-900 font-semibold mt-0.5">
                          “{match.comment}”
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Address */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Adresse complète & Quartier *
                </label>
                <textarea
                  rows={2}
                  required
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  placeholder="Ex: Quartier Maârif, 42 Rue Abou Hanifa, Résidence Al Yassamine, Apt 6"
                  className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                />

                {/* Save to Favorites Toggle */}
                <div className="mt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveAddressChecked}
                      onChange={e => setSaveAddressChecked(e.target.checked)}
                      className="rounded border-slate-300 text-red-600 focus:ring-red-500 w-4 h-4"
                    />
                    <Bookmark className="w-3.5 h-3.5 text-amber-500" />
                    <span>حفظ هاد العنوان فـ العناوين المحفوظة للاستعمال السريع</span>
                  </label>
                  {saveAddressChecked && (
                    <input
                      type="text"
                      value={savedAddressLabel}
                      onChange={e => setSavedAddressLabel(e.target.value)}
                      placeholder={recipientName ? `${recipientName} — ${city}` : 'اسم مختصر للعنوان (مثال: متجر المعاريف)'}
                      className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1 text-slate-900 sm:w-56 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  )}
                </div>
              </div>

              {/* ⚡ SMART DRIVER SUGGESTION BANNER (Admin / Employee only) */}
              {!isClient && suggestedDriver && (
                <div className="p-3.5 bg-indigo-50/80 border border-indigo-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center shrink-0">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-extrabold text-indigo-950">
                          أقرب سائق مقترح لـ {city} : {suggestedDriver.driver.name}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                          {suggestedDriver.matchLabel}
                        </span>
                      </div>
                      <p className="text-[11px] text-indigo-700 mt-0.5">
                        {suggestedDriver.matchReason} • {suggestedDriver.driver.driverVehicle || 'Livreur'}
                      </p>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 px-3 py-1.5 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-900 cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      checked={autoAssignClosestDriver}
                      onChange={e => setAutoAssignClosestDriver(e.target.checked)}
                      className="rounded border-indigo-300 text-indigo-600 focus:ring-indigo-500 w-4 h-4"
                    />
                    <Truck className="w-3.5 h-3.5 text-indigo-600" />
                    <span>تعيين تلقائي</span>
                  </label>
                </div>
              )}

              {/* Financial Box - Étape 85 : Règle Commerciale FARIOUSY DELIVERY */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      Décomposition Financière (Règle FARIOUSY)
                    </span>
                    <span className="text-[10px] bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded-full">
                      Frais payés par le destinataire
                    </span>
                  </div>
                  <div className="text-[11px] font-mono text-slate-600 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
                    <span>CRBT = </span>
                    <span className="font-bold text-slate-800">{formatMAD(productPrice)}</span>
                    <span> + </span>
                    <span className="font-bold text-slate-800">{currentFee !== null ? formatMAD(currentFee) : '—'}</span>
                    <span> = </span>
                    <span className="font-extrabold text-red-600">{formatMAD(codAmount)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. Prix article */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      1. Prix article (MAD) *
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      required
                      value={productPrice}
                      onChange={e => handlePriceChange(Math.max(0, parseFloat(e.target.value) || 0))}
                      className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1 leading-tight">
                      Montant brut revenant au commerçant (sans déduction de frais)
                    </span>
                  </div>

                  {/* 2. Frais de livraison */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      2. Frais de livraison
                    </label>
                    <div className={`w-full text-xs font-mono font-bold border rounded-lg px-3 py-2 ${
                      currentFee !== null
                        ? 'bg-slate-200/80 border-slate-300 text-slate-700'
                        : 'bg-rose-50 border-rose-300 text-rose-700'
                    }`}>
                      {currentFee !== null ? formatMAD(currentFee) : 'Non configuré'}
                    </div>
                    <span className="text-[10px] block mt-1 leading-tight font-medium">
                      {currentRateInfo ? (
                        <span className={currentRateInfo.isCustom ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                          {currentRateInfo.isCustom ? '✓ Tarif négocié client' : `Tarif standard (${city})`}
                        </span>
                      ) : (
                        <span className="text-rose-600 font-bold">
                          ⚠ Aucun tarif configuré
                        </span>
                      )}
                    </span>
                  </div>

                  {/* 3. Total CRBT à encaisser */}
                  <div>
                    <label className="block text-xs font-bold text-red-600 mb-1 flex items-center justify-between">
                      <span>3. Total CRBT à encaisser</span>
                      <span className="text-[9px] bg-red-100 text-red-700 font-bold px-1.5 py-0.5 rounded">Auto</span>
                    </label>
                    <div className="w-full text-xs font-mono font-black bg-red-50 border-2 border-red-500 rounded-lg px-3 py-2 text-red-700 flex items-center justify-between shadow-2xs">
                      <span>{formatMAD(codAmount)}</span>
                      <span className="text-[10px] font-sans font-bold bg-red-600 text-white px-1.5 py-0.5 rounded">
                        Livreur
                      </span>
                    </div>
                    <span className="text-[10px] text-red-700 block mt-1 leading-tight font-medium">
                      Montant total encaissé par le livreur auprès du destinataire
                    </span>
                  </div>
                </div>

                {!currentRateInfo && (
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-800">
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>
                      Aucun tarif de livraison n'est configuré pour la ville « {city} ». L'enregistrement de ce colis est bloqué jusqu'à sa configuration.
                    </span>
                  </div>
                )}
              </div>

              {/* Description & Notes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Description du produit
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Ex: Chaussures Nike pointure 42 Noir"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Remarques livreur (horaire, code porte)
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={e => setNotes(e.target.value)}
                    placeholder="Ex: Livrer après 17h, appeler avant"
                    className="w-full text-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </div>
              </div>

              {/* SECTION 1 : خيارات التسليم عند الاستلام (Ouvrir le colis + Essayage + Échange + Attention FRAGILE : Oui / Non) */}
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-xs font-black text-slate-900 block">
                      خيارات التسليم (Ouvrir le colis • Essayage • Échange • Attention FRAGILE)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      حدد الاختيارات المسموح بها وحالة الطرد عند التسليم للزبون (Oui / Non)
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Option 1: Ouvrir le colis */}
                  <div className={`p-3 rounded-xl border transition-colors ${allowOpen ? 'bg-emerald-50/70 border-emerald-300' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">Ouvrir le colis</span>
                        <span className="text-[10px] text-slate-500">فتح الطرد للمعاينة</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${allowOpen ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {allowOpen ? 'Oui' : 'Non'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllowOpen(true)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          allowOpen
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Oui (نعم)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowOpen(false)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          !allowOpen
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Non (لا)
                      </button>
                    </div>
                  </div>

                  {/* Option 2: Essayage */}
                  <div className={`p-3 rounded-xl border transition-colors ${allowTry ? 'bg-blue-50/70 border-blue-300' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">Essayage</span>
                        <span className="text-[10px] text-slate-500">تجربة / قياس المنتوج</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${allowTry ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {allowTry ? 'Oui' : 'Non'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setAllowTry(true)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          allowTry
                            ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Oui (نعم)
                      </button>
                      <button
                        type="button"
                        onClick={() => setAllowTry(false)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          !allowTry
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Non (لا)
                      </button>
                    </div>
                  </div>

                  {/* Option 3: Échange */}
                  <div className={`p-3 rounded-xl border transition-colors ${isExchange ? 'bg-amber-50/90 border-amber-400' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">Échange</span>
                        <span className="text-[10px] text-slate-500">استبدال طرد قديم</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isExchange ? 'bg-amber-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {isExchange ? 'Oui' : 'Non'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsExchange(true)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isExchange
                            ? 'bg-amber-600 text-white border-amber-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Oui (نعم)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsExchange(false)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          !isExchange
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Non (لا)
                      </button>
                    </div>
                  </div>

                  {/* Option 4: Attention FRAGILE */}
                  <div className={`p-3 rounded-xl border transition-colors ${isFragile ? 'bg-rose-50/90 border-rose-400' : 'bg-white border-slate-200'}`}>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 flex items-center gap-1">
                          <AlertTriangle className={`w-3.5 h-3.5 shrink-0 ${isFragile ? 'text-rose-600' : 'text-slate-400'}`} />
                          <span>Attention FRAGILE</span>
                        </span>
                        <span className="text-[10px] text-slate-500">طرد قابل للكسر (عناية)</span>
                      </div>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isFragile ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'}`}>
                        {isFragile ? 'Oui' : 'Non'}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsFragile(true)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          isFragile
                            ? 'bg-rose-600 text-white border-rose-600 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Oui (نعم)
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsFragile(false)}
                        className={`py-1.5 text-xs font-bold rounded-lg border transition-all cursor-pointer ${
                          !isFragile
                            ? 'bg-slate-900 text-white border-slate-900 shadow-2xs'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        Non (لا)
                      </button>
                    </div>
                  </div>
                </div>

                {isExchange && (
                  <div className="pt-3 border-t border-amber-200 bg-amber-50/70 p-3 rounded-xl grid grid-cols-1 sm:grid-cols-3 gap-3 animate-fadeIn">
                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        رقم تتبع الطرد المراد استرجاعه (Tracking Ancien Colis)
                      </label>
                      <input
                        type="text"
                        value={exchangeTrackingNumber}
                        onChange={e => setExchangeTrackingNumber(e.target.value.toUpperCase())}
                        placeholder="Ex: FAR-20261110-001"
                        className="w-full text-xs font-mono font-bold bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        سبب الاستبدال (Motif d&apos;échange)
                      </label>
                      <select
                        value={exchangeReason}
                        onChange={e => setExchangeReason(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      >
                        <option value="Taille incorrecte">مقاس غير مناسب (Taille incorrecte)</option>
                        <option value="Couleur différente">لون مختلف (Couleur différente)</option>
                        <option value="Produit défectueux">منتوج به عيب (Produit défectueux)</option>
                        <option value="Changement de modèle">تغيير الموديل (Changement modèle)</option>
                        <option value="Autre raison">سبب آخر (Autre raison)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-amber-900 mb-1">
                        وصف المنتوج المسترجع (Article à reprendre)
                      </label>
                      <input
                        type="text"
                        value={exchangeItemDescription}
                        onChange={e => setExchangeItemDescription(e.target.value)}
                        placeholder="Ex: Chaussures pointure 40"
                        className="w-full text-xs bg-white border border-amber-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                      />
                    </div>

                    <div className="sm:col-span-3 text-[11px] text-amber-800 bg-amber-100/60 p-2 rounded-lg flex items-center gap-2">
                      <span>🔄</span>
                      <span>
                        سيتم إشعار الليفرور وطباعة تنبيه خاص في التيكي لتسليم هذا الطرد واسترجاع الطرد القديم من الزبون في نفس الوقت.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION 1B : السحب التلقائي من سطوك الزبون + فاتورة أوتوماتيكية */}
              {activeClientStockProducts.length > 0 && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white flex items-center justify-center shrink-0">
                        <Boxes className="w-4 h-4" />
                      </span>
                      <div>
                        <span className="text-xs font-black text-emerald-950 block">
                          السحب التلقائي من سطوك {selectedClient?.companyName || selectedClient?.name} + فاتورة
                        </span>
                        <span className="text-[11px] text-emerald-700">
                          القطعة كتحيد أوتوماتيك من السطوك وكتتصدر ليها فاتورة مباشرة مع الكوليا
                        </span>
                      </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={useClientStock}
                        onChange={e => {
                          const checked = e.target.checked;
                          setUseClientStock(checked);
                          if (!checked) setStockQuantities({});
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div className="pt-2 border-t border-emerald-200 space-y-2.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-60 overflow-y-auto pr-1">
                      {activeClientStockProducts.map(prod => {
                        const avail = prod.units.filter(u => u.status === 'en_stock').length;
                        const pending = prod.units.filter(u => u.status === 'en_attente').length;
                        const qty = stockQuantities[prod.id] || 0;

                        const updateQty = (nextQty: number) => {
                          const clamped = Math.max(0, Math.min(avail, nextQty));
                          const nextMap = { ...stockQuantities, [prod.id]: clamped };
                          if (clamped === 0) delete nextMap[prod.id];
                          setStockQuantities(nextMap);
                          setUseClientStock(Object.values(nextMap).some(v => v > 0));

                          // Auto-sync product price & description from selected stock products
                          let sumValue = 0;
                          const descParts: string[] = [];
                          for (const [pid, q] of Object.entries(nextMap)) {
                            const matched = activeClientStockProducts.find(x => x.id === pid);
                            if (matched && q > 0) {
                              sumValue += matched.unitPrice * q;
                              descParts.push(`${q}x ${matched.name}`);
                            }
                          }
                          if (sumValue > 0) {
                            handlePriceChange(sumValue);
                          }
                          if (descParts.length > 0) {
                            setDescription(descParts.join(' + '));
                          }
                        };

                        return (
                          <div
                            key={prod.id}
                            className={`p-2.5 rounded-xl border bg-white flex flex-col gap-2 ${
                              qty > 0 ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2.5">
                              <div className="flex items-center gap-2.5 min-w-0">
                                {prod.photoUrl ? (
                                  <img
                                    src={prod.photoUrl}
                                    alt={prod.name}
                                    className="w-11 h-11 rounded-lg object-cover border border-slate-200 shrink-0"
                                  />
                                ) : (
                                  <div className="w-11 h-11 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                                    <Boxes className="w-5 h-5 text-slate-400" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <div className="font-bold text-xs text-slate-900 truncate">{prod.name}</div>
                                  <div className="text-[10px] font-mono text-slate-500">
                                    {formatMAD(prod.unitPrice)} ·{' '}
                                    <span className={avail > 0 ? 'text-emerald-700 font-bold' : 'text-amber-700 font-bold'}>
                                      {avail} فالسطوك
                                    </span>
                                    {pending > 0 ? ` (${pending} انتظار)` : ''}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                <button
                                  type="button"
                                  disabled={qty <= 0}
                                  onClick={() => updateQty(qty - 1)}
                                  className="w-6 h-6 rounded-lg bg-slate-100 hover:bg-slate-200 disabled:opacity-40 flex items-center justify-center text-slate-700 cursor-pointer"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-6 text-center text-xs font-black text-slate-900 force-ltr">
                                  {qty}
                                </span>
                                <button
                                  type="button"
                                  disabled={qty >= avail}
                                  onClick={() => updateQty(qty + 1)}
                                  className="w-6 h-6 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white flex items-center justify-center cursor-pointer"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                            </div>

                            {avail === 0 && pending > 0 && (
                              <button
                                type="button"
                                disabled={scanningStockId === prod.id}
                                onClick={async () => {
                                  setScanningStockId(prod.id);
                                  await scanClientStockUnit(prod.id, {
                                    hubName: prod.hubName,
                                    actorName: currentUser?.name || selectedClient?.name,
                                    scanAllPending: true
                                  });
                                  setScanningStockId(null);
                                }}
                                className="w-full py-1 px-2 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                              >
                                <Scan className="w-3 h-3" />
                                <span>
                                  {scanningStockId === prod.id
                                    ? '...'
                                    : `تأكيد السكان للسطوك (${pending} قطعة) باش تسحب منها`}
                                </span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {selectedStockSelections.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-emerald-100/70 text-[11px] font-bold text-emerald-900 flex items-center gap-2">
                        <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span>
                          سيتم خصم {selectedStockSelections.reduce((s, x) => s + x.quantity, 0)} قطعة أوتوماتيك من السطوك وتوليد فاتورة فور تأكيد الكوليا.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* SECTION 2 : ربط السطوك بالزبون والطرود / EMPLACEMENT STOCK MAGASIN */}
              <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs">
                      📦
                    </span>
                    <div>
                      <span className="text-xs font-bold text-indigo-950 block">
                        ربط السطوك بالمستودع والزبون (Emplacement Stock Magasin)
                      </span>
                      <span className="text-[11px] text-indigo-700">
                        تخصيص مكان فوري لهذا الطرد في مستودع الفرع وربطه بملف الزبون
                      </span>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={assignStock}
                      onChange={e => setAssignStock(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>

                {assignStock && (
                  <div className="pt-2 border-t border-indigo-200 grid grid-cols-2 sm:grid-cols-4 gap-3 animate-fadeIn">
                    <div className="col-span-2 sm:col-span-1">
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                        الفرع / المستودع (Hub)
                      </label>
                      <select
                        value={stockHub}
                        onChange={e => setStockHub(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-indigo-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        {agencies && agencies.length > 0 ? (
                          agencies.map(a => (
                            <option key={a.id} value={a.name}>{a.name}</option>
                          ))
                        ) : (
                          <>
                            <option value="Hub Central Casablanca">Hub Central Casablanca</option>
                            <option value="Hub Rabat Centre">Hub Rabat Centre</option>
                            <option value="Hub Tanger Med">Hub Tanger Med</option>
                            <option value="Hub Marrakech Gueliz">Hub Marrakech Gueliz</option>
                            <option value="Hub Agadir Al Massira">Hub Agadir Al Massira</option>
                            <option value="Hub Fès Ville Nouvelle">Hub Fès Ville Nouvelle</option>
                          </>
                        )}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                        المنطقة (Zone)
                      </label>
                      <select
                        value={stockZone}
                        onChange={e => setStockZone(e.target.value)}
                        className="w-full text-xs font-semibold bg-white border border-indigo-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="Zone A (Nord)">Zone A (Nord)</option>
                        <option value="Zone B (Sud)">Zone B (Sud)</option>
                        <option value="Zone C (Centre)">Zone C (Centre)</option>
                        <option value="Zone R (Retours & Échanges)">Zone R (Retours & Échanges)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                        الرف (Rayon)
                      </label>
                      <input
                        type="text"
                        value={stockShelf}
                        onChange={e => setStockShelf(e.target.value)}
                        placeholder="Ex: Rayon 01"
                        className="w-full text-xs font-bold bg-white border border-indigo-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-indigo-900 mb-1">
                        الصندوق (Bac / Étagère)
                      </label>
                      <input
                        type="text"
                        value={stockBin}
                        onChange={e => setStockBin(e.target.value)}
                        placeholder="Ex: Bac 10"
                        className="w-full text-xs font-bold bg-white border border-indigo-300 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    <div className="col-span-2 sm:col-span-4 text-[11px] text-indigo-800 bg-indigo-100/60 p-2 rounded-lg flex items-center justify-between">
                      <span>🔗 مرتبط تلقائياً بالزبون : <strong className="text-indigo-950">{selectedClient?.companyName || selectedClient?.name || 'Client'}</strong></span>
                      <span className="font-mono text-[10px] text-indigo-600 font-bold">{stockZone} • {stockShelf} • {stockBin}</span>
                    </div>
                  </div>
                )}
              </div>
            </form>
          ) : mode === 'bulk' ? (
            /* Bulk Mode */
            <form id="bulk-package-form" onSubmit={handleBulkSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  Renseignez rapidement plusieurs colis en ligne :
                </span>
                <button
                  type="button"
                  onClick={handleAddBulkRow}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Ajouter une ligne</span>
                </button>
              </div>

              {(() => {
                const flaggedBulkCount = bulkRows.filter(
                  r => findBlacklistMatches(r.recipientPhone).reportCount > 0
                ).length;
                if (flaggedBulkCount === 0) return null;
                return (
                  <div
                    dir="rtl"
                    className="p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-center gap-2.5 text-xs font-black"
                  >
                    <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                    <span>
                      تنبيه: كاينين {flaggedBulkCount} أرقام فاللائحة السوداء (Blacklist) وراهم كيلغيو الطلبيات! راجع السطور المعلمة بالأحمر لتحت.
                    </span>
                  </div>
                );
              })()}

              {/* Bulk Table Header */}
              <div className="hidden sm:grid grid-cols-12 gap-2 px-3 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <span className="col-span-2">Destinataire *</span>
                <span className="col-span-2">Téléphone *</span>
                <span className="col-span-2">Ville *</span>
                <span className="col-span-2">Adresse *</span>
                <span className="col-span-1 text-right">Prix Art.</span>
                <span className="col-span-1 text-center">Frais</span>
                <span className="col-span-1 text-center text-red-600">Total CRBT</span>
                <span className="col-span-1 text-right">Action</span>
              </div>

              <div className="space-y-3">
                {bulkRows.map((row, idx) => {
                  const rowRate = getCityRate(row.city);
                  const rowFee = rowRate?.fee ?? 0;
                  const rowCleanPrice = Math.max(0, row.productPrice || 0);
                  const rowTotalCRBT = Math.round((rowCleanPrice + rowFee) * 100) / 100;
                  const rowBlacklist = findBlacklistMatches(row.recipientPhone);

                  return (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl space-y-2 text-xs border ${
                        rowBlacklist.reportCount > 0
                          ? 'bg-rose-50/70 border-rose-400'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="Nom complet *"
                            value={row.recipientName}
                            onChange={e => handleUpdateBulkRow(idx, 'recipientName', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-medium text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="tel"
                            placeholder="Téléphone *"
                            value={row.recipientPhone}
                            onChange={e => handleUpdateBulkRow(idx, 'recipientPhone', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 font-mono text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-2">
                          <select
                            value={row.city}
                            onChange={e => handleUpdateBulkRow(idx, 'city', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1.5 font-medium text-slate-900"
                          >
                            {cities.map(c => {
                              const cRate = getCityRate(c.name);
                              return (
                                <option key={c.id} value={c.name}>
                                  {c.name} ({cRate ? `${cRate.fee} DH` : '—'})
                                </option>
                              );
                            })}
                          </select>
                        </div>
                        <div className="sm:col-span-2">
                          <input
                            type="text"
                            placeholder="Adresse complète *"
                            value={row.address}
                            onChange={e => handleUpdateBulkRow(idx, 'address', e.target.value)}
                            className="w-full bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-900"
                          />
                        </div>
                        <div className="sm:col-span-1">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            placeholder="Prix"
                            value={row.productPrice}
                            onChange={e => handleUpdateBulkRow(idx, 'productPrice', Math.max(0, parseFloat(e.target.value) || 0))}
                            className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-1.5 font-mono font-bold text-slate-900 text-right"
                            title="Prix article revenant au commerçant"
                          />
                        </div>
                        <div className="sm:col-span-1 text-center font-mono text-[11px] font-semibold text-slate-600 bg-slate-200/70 rounded-lg py-1.5 px-1 border border-slate-300" title="Frais de livraison FARIOUSY">
                          {rowRate ? `${rowFee} DH` : '—'}
                        </div>
                        <div className="sm:col-span-1 text-center font-mono font-black text-[11px] text-red-700 bg-red-50 border border-red-200 rounded-lg py-1.5 px-1 shadow-2xs" title="Total CRBT = Prix article + Frais">
                          {rowTotalCRBT} DH
                        </div>
                        <div className="sm:col-span-1 flex justify-end">
                          {bulkRows.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveBulkRow(idx)}
                              className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg cursor-pointer"
                              title="Supprimer la ligne"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>

                      {rowBlacklist.reportCount > 0 && (
                        <div
                          dir="rtl"
                          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-rose-100 border border-rose-300 text-rose-900 text-[11px] font-bold"
                        >
                          <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0" />
                          <span>
                            اللائحة السوداء ({rowBlacklist.reportCount} بلاغات) — هاد الزبون كيلغي الطلبيات: “{rowBlacklist.latestComment}”
                          </span>
                        </div>
                      )}

                      {/* Per-row Oui / Non delivery options */}
                      <div className="flex flex-wrap items-center gap-3 pt-1.5 border-t border-slate-200/70">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Ouvrir:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'allowOpen', true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              row.allowOpen ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'allowOpen', false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              !row.allowOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Non
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Essayage:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'allowTry', true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              row.allowTry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'allowTry', false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              !row.allowTry ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Non
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-slate-600">Échange:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'isExchange', true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              row.isExchange ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'isExchange', false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              !row.isExchange ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Non
                          </button>
                        </div>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[11px] font-bold text-rose-700">Attention FRAGILE:</span>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'isFragile', true)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              row.isFragile ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Oui
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateBulkRow(idx, 'isFragile', false)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                              !row.isFragile ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                            }`}
                          >
                            Non
                          </button>
                        </div>
                      </div>

                      {activeClientStockProducts.length > 0 && (
                        <div className="flex flex-wrap items-center gap-2 pt-1.5 border-t border-slate-200/70">
                          <span className="text-[11px] font-bold text-emerald-800 flex items-center gap-1">
                            <Boxes className="w-3.5 h-3.5 text-emerald-600" />
                            <span>سحب من السطوك (اختياري):</span>
                          </span>
                          <select
                            value={row.stockProductId || ''}
                            onChange={e => {
                              const pid = e.target.value;
                              const updated = [...bulkRows];
                              if (!pid) {
                                updated[idx] = { ...updated[idx], stockProductId: undefined, stockQty: undefined };
                              } else {
                                const prod = activeClientStockProducts.find(p => p.id === pid);
                                updated[idx] = {
                                  ...updated[idx],
                                  stockProductId: pid,
                                  stockQty: updated[idx].stockQty || 1,
                                  productPrice: prod ? prod.unitPrice * (updated[idx].stockQty || 1) : updated[idx].productPrice,
                                  description: prod ? `${updated[idx].stockQty || 1}x ${prod.name}` : updated[idx].description
                                };
                              }
                              setBulkRows(updated);
                            }}
                            className="bg-white border border-emerald-300 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800"
                          >
                            <option value="">-- بدون سحب من السطوك --</option>
                            {activeClientStockProducts.map(p => {
                              const av = p.units.filter(u => u.status === 'en_stock').length;
                              return (
                                <option key={p.id} value={p.id} disabled={av === 0}>
                                  {p.name} ({av} متوفر — {formatMAD(p.unitPrice)})
                                </option>
                              );
                            })}
                          </select>
                          {row.stockProductId && (
                            <input
                              type="number"
                              min={1}
                              max={
                                activeClientStockProducts
                                  .find(p => p.id === row.stockProductId)
                                  ?.units.filter(u => u.status === 'en_stock').length || 1
                              }
                              value={row.stockQty || 1}
                              onChange={e => {
                                const q = Math.max(1, parseInt(e.target.value, 10) || 1);
                                const prod = activeClientStockProducts.find(p => p.id === row.stockProductId);
                                const updated = [...bulkRows];
                                updated[idx] = {
                                  ...updated[idx],
                                  stockQty: q,
                                  productPrice: prod ? prod.unitPrice * q : updated[idx].productPrice,
                                  description: prod ? `${q}x ${prod.name}` : updated[idx].description
                                };
                                setBulkRows(updated);
                              }}
                              className="w-16 bg-white border border-emerald-300 rounded-lg px-2 py-1 text-[11px] font-black text-center"
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </form>
          ) : (
            /* Excel Import Mode */
            <form id="excel-package-form" onSubmit={handleExcelSubmit} className="space-y-4">
              {/* Top actions: Template download & Info */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-start gap-2.5">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <p className="font-bold text-emerald-950">
                      Création en masse depuis un fichier Excel (.xlsx, .xls, .csv)
                    </p>
                    <p className="text-emerald-800 mt-0.5">
                      Colonnes attendues : <span className="font-mono font-semibold">Destinataire, Telephone, Ville, Adresse, Prix</span> (+ optionnel : Telephone 2, Produit, Notes).
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadExcelTemplate}
                  className="px-3.5 py-2 text-xs font-bold text-emerald-800 bg-white hover:bg-emerald-100 border border-emerald-300 rounded-xl shadow-2xs flex items-center gap-1.5 shrink-0 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger modèle (.xlsx)</span>
                </button>
              </div>

              {/* Default delivery options for Excel import */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="font-bold text-slate-700">خيارات التسليم الافتراضية لملف Excel :</span>
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600">Ouvrir le colis:</span>
                    <button
                      type="button"
                      onClick={() => setExcelAllowOpen(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        excelAllowOpen ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelAllowOpen(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        !excelAllowOpen ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Non
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600">Essayage:</span>
                    <button
                      type="button"
                      onClick={() => setExcelAllowTry(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        excelAllowTry ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelAllowTry(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        !excelAllowTry ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Non
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-slate-600">Échange:</span>
                    <button
                      type="button"
                      onClick={() => setExcelIsExchange(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        excelIsExchange ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelIsExchange(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        !excelIsExchange ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Non
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-rose-700">Attention FRAGILE:</span>
                    <button
                      type="button"
                      onClick={() => setExcelIsFragile(true)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        excelIsFragile ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      onClick={() => setExcelIsFragile(false)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                        !excelIsFragile ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-300'
                      }`}
                    >
                      Non
                    </button>
                  </div>
                </div>
              </div>

              {/* Hidden file input */}
              <input
                ref={excelInputRef}
                type="file"
                accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
                onChange={handleExcelFileChange}
                className="hidden"
              />

              {/* Drag & drop zone */}
              <div
                onClick={() => excelInputRef.current?.click()}
                onDragOver={e => {
                  e.preventDefault();
                  setIsDraggingExcel(true);
                }}
                onDragLeave={() => setIsDraggingExcel(false)}
                onDrop={e => {
                  e.preventDefault();
                  setIsDraggingExcel(false);
                  const dropped = e.dataTransfer.files?.[0];
                  if (dropped) parseExcelFile(dropped);
                }}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all ${
                  isDraggingExcel
                    ? 'border-emerald-500 bg-emerald-50'
                    : 'border-slate-300 bg-slate-50/70 hover:border-emerald-400 hover:bg-emerald-50/40'
                }`}
              >
                <Upload className="w-8 h-8 mx-auto text-emerald-600 mb-2" />
                <p className="text-xs font-bold text-slate-800">
                  {excelFileName
                    ? `Fichier chargé : ${excelFileName} (${excelRows.length} ligne(s)) — Cliquez pour changer`
                    : 'Cliquez ici ou glissez-déposez votre fichier Excel (.xlsx / .xls / .csv)'}
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Les tarifs de livraison et le Total CRBT sont calculés automatiquement par ville.
                </p>
              </div>

              {/* Progress indicator during import */}
              {excelProgress && (
                <div className="p-3 bg-slate-900 text-white rounded-xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between font-bold">
                    <span>Importation vers Supabase en cours...</span>
                    <span className="font-mono">{excelProgress.done} / {excelProgress.total}</span>
                  </div>
                  <div className="w-full h-2 bg-slate-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all"
                      style={{ width: `${Math.round((excelProgress.done / Math.max(1, excelProgress.total)) * 100)}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Editable Preview Table */}
              {excelRows.length > 0 && (
                <div className="space-y-2.5">
                  {(() => {
                    const excelFlagged = excelRows.filter(
                      r => findBlacklistMatches(r.recipientPhone).reportCount > 0
                    );
                    if (excelFlagged.length === 0) return null;
                    return (
                      <div
                        dir="rtl"
                        className="p-3 rounded-xl bg-rose-50 border-2 border-rose-400 text-rose-900 flex items-center gap-2.5 text-xs font-black"
                      >
                        <ShieldAlert className="w-5 h-5 text-rose-600 shrink-0" />
                        <span>
                          تنبيه: كاينين {excelFlagged.length} زبناء فهاد الملف مسجلين فاللائحة السوداء (Blacklist) وراهم كيلغيو الطلبيات!
                        </span>
                      </div>
                    );
                  })()}

                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">Aperçu avant création :</span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                        {validExcelCount} prêt(s)
                      </span>
                      {excelRows.length - validExcelCount > 0 && (
                        <span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold">
                          {excelRows.length - validExcelCount} à corriger
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setExcelRows([]);
                        setExcelFileName(null);
                      }}
                      className="text-xs font-bold text-rose-600 hover:underline cursor-pointer"
                    >
                      Vider la liste
                    </button>
                  </div>

                  <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 text-slate-600 uppercase text-[10px] font-bold">
                        <tr>
                          <th className="py-2 px-2">#</th>
                          <th className="py-2 px-2">Destinataire *</th>
                          <th className="py-2 px-2">Téléphone *</th>
                          <th className="py-2 px-2">Ville *</th>
                          <th className="py-2 px-2">Adresse *</th>
                          <th className="py-2 px-2 text-right">Prix</th>
                          <th className="py-2 px-2 text-right">CRBT</th>
                          <th className="py-2 px-2">État</th>
                          <th className="py-2 px-2 text-right">Suppr.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 bg-white">
                        {excelRows.map((row, idx) => {
                          const status = excelValidStatus[idx];
                          const bl = findBlacklistMatches(row.recipientPhone);
                          return (
                            <tr
                              key={row.id}
                              className={
                                bl.reportCount > 0
                                  ? 'bg-rose-50/80'
                                  : status.isValid
                                  ? ''
                                  : 'bg-rose-50/50'
                              }
                            >
                              <td className="py-1.5 px-2 font-mono text-slate-400">{idx + 1}</td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.recipientName}
                                  onChange={e => handleUpdateExcelRow(idx, 'recipientName', e.target.value)}
                                  className="w-32 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs font-medium"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.recipientPhone}
                                  onChange={e => handleUpdateExcelRow(idx, 'recipientPhone', e.target.value)}
                                  className={`w-28 border rounded px-2 py-1 text-xs font-mono ${
                                    bl.reportCount > 0
                                      ? 'bg-rose-100 border-rose-400 text-rose-900 font-bold'
                                      : 'bg-slate-50 border-slate-200'
                                  }`}
                                />
                                {bl.reportCount > 0 && (
                                  <span
                                    title={bl.latestComment}
                                    className="mt-1 inline-flex items-center gap-1 text-[10px] font-black text-rose-700"
                                  >
                                    <ShieldAlert className="w-3 h-3 shrink-0" />
                                    <span>Blacklist ({bl.reportCount})</span>
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2">
                                <select
                                  value={cities.some(c => c.name === row.city) ? row.city : ''}
                                  onChange={e => handleUpdateExcelRow(idx, 'city', e.target.value)}
                                  className={`w-32 border rounded px-1.5 py-1 text-xs font-semibold ${
                                    status.fee > 0
                                      ? 'bg-slate-50 border-slate-200 text-slate-800'
                                      : 'bg-rose-50 border-rose-300 text-rose-700'
                                  }`}
                                >
                                  {!cities.some(c => c.name === row.city) && (
                                    <option value="">
                                      {row.city ? `Inconnue: ${row.city}` : 'Choisir ville'}
                                    </option>
                                  )}
                                  {cities.map(c => (
                                    <option key={c.id} value={c.name}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="text"
                                  value={row.address}
                                  onChange={e => handleUpdateExcelRow(idx, 'address', e.target.value)}
                                  className="w-40 bg-slate-50 border border-slate-200 rounded px-2 py-1 text-xs"
                                />
                              </td>
                              <td className="py-1.5 px-2">
                                <input
                                  type="number"
                                  min="0"
                                  value={row.productPrice}
                                  onChange={e =>
                                    handleUpdateExcelRow(
                                      idx,
                                      'productPrice',
                                      Math.max(0, parseFloat(e.target.value) || 0)
                                    )
                                  }
                                  className="w-20 bg-slate-50 border border-slate-200 rounded px-1.5 py-1 text-xs font-mono text-right"
                                />
                              </td>
                              <td className="py-1.5 px-2 text-right font-mono font-bold text-red-700 whitespace-nowrap">
                                {status.crbt} DH
                              </td>
                              <td className="py-1.5 px-2 whitespace-nowrap">
                                {status.isValid ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                                    Prêt
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                                    {status.missingFields.join(', ')}
                                  </span>
                                )}
                              </td>
                              <td className="py-1.5 px-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExcelRow(idx)}
                                  className="p-1 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                                  title="Supprimer la ligne"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5 shrink-0">
          <span className="text-[11px] sm:text-xs text-slate-500 leading-snug">
            Règle FARIOUSY : Total CRBT = Prix article + Frais de livraison (payé par le destinataire).
          </span>
          <div className="flex items-center justify-end gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-3.5 sm:px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shrink-0"
            >
              Annuler
            </button>
            <button
              type="submit"
              form={
                mode === 'single'
                  ? 'single-package-form'
                  : mode === 'bulk'
                  ? 'bulk-package-form'
                  : 'excel-package-form'
              }
              disabled={
                isSubmitting ||
                (clients.length === 0 && !isClient) ||
                (mode === 'single' && (!currentRateInfo || currentFee === null || currentFee <= 0)) ||
                (mode === 'excel' && (excelRows.length === 0 || validExcelCount !== excelRows.length))
              }
              className={`flex items-center justify-center gap-2 px-4 sm:px-5 py-2.5 text-xs font-bold text-white rounded-xl shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shrink-0 ${
                mode === 'excel' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isSubmitting && <RefreshCw className="w-3.5 h-3.5 animate-spin shrink-0" />}
              <span className="whitespace-nowrap">
                {isSubmitting
                  ? 'Enregistrement...'
                  : mode === 'single'
                  ? 'Créer le colis'
                  : mode === 'bulk'
                  ? `Enregistrer les ${bulkRows.length} colis`
                  : `Importer ${excelRows.length} colis`}
              </span>
            </button>
          </div>
        </div>
      </div>

      <StockInvoiceModal
        invoice={generatedStockInvoice}
        isOpen={isInvoicePreviewOpen}
        onClose={() => setIsInvoicePreviewOpen(false)}
      />
    </div>
  );
};
