import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useDatabase } from '../../context/DatabaseContext';
import { useAuth } from '../../context/AuthContext';
import { useLanguage } from '../../i18n/LanguageContext';
import { ClientStockInvoice, ClientStockProduct } from '../../types';
import { compressImageFileToDataUrl } from '../../utils/imageCompress';
import { formatDateTime, formatMAD, generateBarcodeSVG } from '../../utils/barcode';
import { StockInvoiceModal } from './StockInvoiceModal';
import { ConfirmActionModal } from '../common/ConfirmActionModal';
import {
  Boxes,
  Plus,
  ImagePlus,
  QrCode,
  Printer,
  PackagePlus,
  FileText,
  History,
  Search,
  CheckCircle2,
  Clock,
  Truck,
  Trash2,
  X,
  Scan,
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';

interface ClientStockProps {
  onCreatePackageFromStock?: (preselectedProductId?: string) => void;
}

export const ClientStock: React.FC<ClientStockProps> = ({ onCreatePackageFromStock }) => {
  const {
    clientStockProducts,
    clientStockMovements,
    clientStockInvoices,
    agencies,
    refreshClientStock,
    createClientStockProduct,
    addClientStockUnits,
    scanClientStockUnit,
    dispatchClientStockUnit,
    deleteClientStockProduct,
    deleteClientStockUnit
  } = useDatabase();
  const { currentUser } = useAuth();
  const { language, isRtl } = useLanguage();
  const isAr = language === 'ar';

  const [scanningProductId, setScanningProductId] = useState<string | null>(null);
  const [dispatchingUnitCode, setDispatchingUnitCode] = useState<string | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<ClientStockProduct | null>(null);
  const [deletingUnitId, setDeletingUnitId] = useState<string | null>(null);
  const [cardFeedback, setCardFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  const [subTab, setSubTab] = useState<'products' | 'movements' | 'invoices'>('products');
  const [search, setSearch] = useState('');

  // Add Product Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [prodName, setProdName] = useState('');
  const [prodQtyInput, setProdQtyInput] = useState<string>('10');
  const [prodPriceInput, setProdPriceInput] = useState<string>('150');
  const [prodCategory, setProdCategory] = useState('');
  const [prodHub, setProdHub] = useState(agencies[0]?.name || 'Hub Central Casablanca');
  const [prodNotes, setProdNotes] = useState('');
  const [prodPhoto, setProdPhoto] = useState<string>('');
  const [isCompressingPhoto, setIsCompressingPhoto] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (currentUser?.id) {
      void refreshClientStock();
    }
  }, [currentUser?.id]);

  useEffect(() => {
    if (agencies.length > 0 && (!prodHub || !agencies.some(a => a.name === prodHub))) {
      setProdHub(agencies[0].name);
    }
  }, [agencies, prodHub]);

  // Unit Barcodes Sheet Modal State
  const [unitsProduct, setUnitsProduct] = useState<ClientStockProduct | null>(null);
  const [addUnitsQty, setAddUnitsQty] = useState<number>(5);
  const [isAddingUnits, setIsAddingUnits] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [scanFeedback, setScanFeedback] = useState<{ ok: boolean; msg: string } | null>(null);

  // Selected Invoice for Print/View
  const [selectedInvoice, setSelectedInvoice] = useState<ClientStockInvoice | null>(null);

  const isOwnedByCurrentClient = (ownerClientId?: string | null) => {
    if (!currentUser?.id || !ownerClientId) return false;
    const shopId = (currentUser as any)?.shopId;
    return ownerClientId === currentUser.id || (Boolean(shopId) && ownerClientId === shopId);
  };

  // Filter strictly for current client
  const myOwnedProducts = useMemo(
    () => clientStockProducts.filter(p => isOwnedByCurrentClient(p.clientId)),
    [clientStockProducts, currentUser?.id, (currentUser as any)?.shopId]
  );

  const myProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return myOwnedProducts.filter(p => {
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.skuCode.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q)) ||
        p.units.some(u => u.unitCode.toLowerCase().includes(q))
      );
    });
  }, [myOwnedProducts, search]);

  const myMovements = useMemo(
    () => clientStockMovements.filter(m => isOwnedByCurrentClient(m.clientId)),
    [clientStockMovements, currentUser?.id, (currentUser as any)?.shopId]
  );

  const myInvoices = useMemo(
    () => clientStockInvoices.filter(inv => isOwnedByCurrentClient(inv.clientId)),
    [clientStockInvoices, currentUser?.id, (currentUser as any)?.shopId]
  );

  // Live Calculated Totals
  const stats = useMemo(() => {
    let totalUnits = 0;
    let pendingUnits = 0;
    let inStockUnits = 0;
    let shippedUnits = 0;
    let totalInStockValue = 0;

    for (const p of myOwnedProducts) {
      totalUnits += p.units.length;
      const pending = p.units.filter(u => u.status === 'en_attente').length;
      const inStock = p.units.filter(u => u.status === 'en_stock').length;
      const shipped = p.units.filter(u => u.status === 'expedie').length;
      pendingUnits += pending;
      inStockUnits += inStock;
      shippedUnits += shipped;
      totalInStockValue += inStock * p.unitPrice;
    }

    return {
      skuCount: myOwnedProducts.length,
      totalUnits,
      pendingUnits,
      inStockUnits,
      shippedUnits,
      totalInStockValue,
      invoicesCount: myInvoices.length
    };
  }, [myOwnedProducts, myInvoices.length]);

  // Keep modal product synced when state updates
  const activeUnitsProduct = useMemo(() => {
    if (!unitsProduct) return null;
    return clientStockProducts.find(p => p.id === unitsProduct.id) || unitsProduct;
  }, [unitsProduct, clientStockProducts]);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFormError(null);
    setIsCompressingPhoto(true);
    try {
      const compressed = await compressImageFileToDataUrl(file, 440, 0.72, 70_000);
      setProdPhoto(compressed);
    } catch (err: any) {
      setFormError(
        err?.message ||
          (isAr ? 'تعذر قراءة الصورة المختارة. يمكنك الحفظ بدون صورة.' : "Impossible de lire l'image sélectionnée.")
      );
    } finally {
      setIsCompressingPhoto(false);
      e.target.value = '';
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!currentUser?.id) return;
    const parsedQty = parseInt(prodQtyInput, 10);
    const parsedPrice = parseFloat(prodPriceInput.replace(',', '.'));
    if (!prodName.trim() || prodName.trim().length < 2) {
      setFormError(isAr ? 'يرجى إدخال اسم المنتوج.' : 'Veuillez saisir le nom du produit.');
      return;
    }
    if (!Number.isFinite(parsedQty) || parsedQty < 1 || parsedQty > 500) {
      setFormError(isAr ? 'العدد يجب أن يكون بين 1 و 500 قطعة.' : 'La quantité doit être comprise entre 1 et 500.');
      return;
    }

    setIsSaving(true);
    const res = await createClientStockProduct({
      clientId: currentUser.id,
      clientName: currentUser.name,
      clientCompany: currentUser.companyName,
      name: prodName.trim(),
      photoUrl: prodPhoto || undefined,
      category: prodCategory.trim() || undefined,
      unitPrice: Number.isFinite(parsedPrice) && parsedPrice >= 0 ? parsedPrice : 0,
      quantity: parsedQty,
      hubName: prodHub || agencies[0]?.name || 'Hub Central Casablanca',
      notes: prodNotes.trim() || undefined,
      actorName: currentUser.companyName || currentUser.name
    });
    setIsSaving(false);

    if (!res.success || !res.product) {
      setFormError(res.error || 'تعذر حفظ المنتوج.');
      return;
    }

    // Reset & immediately show generated unit barcodes so client can print stickers
    setProdName('');
    setProdQtyInput('10');
    setProdPriceInput('150');
    setProdCategory('');
    setProdNotes('');
    setProdPhoto('');
    setShowAddModal(false);
    setUnitsProduct(res.product);
  };

  const handleAddMoreUnits = async () => {
    if (!activeUnitsProduct || addUnitsQty < 1) return;
    setIsAddingUnits(true);
    const res = await addClientStockUnits(
      activeUnitsProduct.id,
      addUnitsQty,
      currentUser?.companyName || currentUser?.name
    );
    setIsAddingUnits(false);
    if (res.success && res.product) {
      setUnitsProduct(res.product);
      setScanFeedback({
        ok: true,
        msg: isAr ? `تم توليد +${addUnitsQty} كود جديد بنجاح.` : `+${addUnitsQty} nouveaux codes générés.`
      });
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 1500);
  };

  const handlePrintAllUnitLabels = (product: ClientStockProduct) => {
    const oldFrame = document.getElementById('fariousy-unit-labels-iframe');
    if (oldFrame) oldFrame.remove();

    const iframe = document.createElement('iframe');
    iframe.id = 'fariousy-unit-labels-iframe';
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '10px';
    iframe.style.height = '10px';
    iframe.style.opacity = '0';
    iframe.style.border = '0';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (!doc) return;

    const cardsHtml = product.units
      .map(
        u => `
        <div class="sticker">
          <div class="hdr">
            <span>${product.clientCompany || product.clientName || 'FARIOUSY'}</span>
            <span>${product.skuCode}</span>
          </div>
          <div class="pname">${product.name}</div>
          <div class="bc">${generateBarcodeSVG(u.unitCode, 34)}</div>
          <div class="ftr">${formatMAD(product.unitPrice, language)} · ${u.status}</div>
        </div>`
      )
      .join('');

    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${product.name} — Barcodes</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; padding: 12px; background: #fff; color: #0f172a; }
            .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            .sticker { border: 1px dashed #94a3b8; border-radius: 8px; padding: 8px; text-align: center; page-break-inside: avoid; }
            .hdr { display: flex; justify-content: space-between; font-size: 9px; font-weight: bold; color: #475569; margin-bottom: 3px; }
            .pname { font-size: 11px; font-weight: 800; margin-bottom: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .bc svg { max-width: 100%; height: auto; }
            .ftr { font-size: 9px; color: #64748b; margin-top: 2px; font-family: monospace; }
            @media print { body { padding: 4px; } }
          </style>
        </head>
        <body>
          <div class="grid">${cardsHtml}</div>
        </body>
      </html>
    `);
    doc.close();
    setTimeout(() => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    }, 300);
  };

  return (
    <div className="space-y-6" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Page Header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-2xs space-y-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 flex items-center gap-2.5">
              <Boxes className="w-6 h-6 text-red-600" />
              <span>{isAr ? 'السطوك ديالي (المخزون بالأكواد والفواتير)' : 'Mon Stock & Fulfillment (Codes-barres & Factures)'}</span>
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              {isAr
                ? 'أدخل منتوجاتك بالصورة والعدد، السيستيم يعطي كود بار خاص بكل قطعة باش تتسكانا وتتحط فالسطوك، وعند إنشاء كوليا من السطوك كيتخصم أوتوماتيك وتتصدر فاتورة.'
                : 'Ajoutez vos produits avec photo et quantité. Chaque pièce reçoit un code-barres unique pour le scan en entrepôt et la déduction + facturation automatique lors de la création de colis.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onCreatePackageFromStock && (
              <button
                type="button"
                onClick={() => onCreatePackageFromStock()}
                className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 cursor-pointer transition shadow-xs"
              >
                <PackagePlus className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? 'إنشاء كوليا من السطوك' : 'Créer Colis depuis Stock'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setFormError(null);
                setShowAddModal(true);
              }}
              className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black flex items-center gap-2 cursor-pointer transition shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{isAr ? 'إضافة سطوك بالصورة والعدد' : 'Ajouter Produit au Stock'}</span>
            </button>
          </div>
        </div>

        {/* 5 Calculated Stock KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200">
            <span className="text-[11px] font-bold text-slate-500 block">
              {isAr ? 'المنتوجات (SKUs)' : 'Produits (SKUs)'}
            </span>
            <span className="text-xl font-black text-slate-900 mt-0.5 block force-ltr">{stats.skuCount}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200">
            <span className="text-[11px] font-bold text-amber-800 block">
              {isAr ? 'فانتظار السكان (المستودع)' : 'En attente de scan'}
            </span>
            <span className="text-xl font-black text-amber-900 mt-0.5 block force-ltr">{stats.pendingUnits}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200">
            <span className="text-[11px] font-bold text-emerald-800 block">
              {isAr ? 'متوفر حالياً فالسطوك' : 'Disponible en Stock'}
            </span>
            <span className="text-xl font-black text-emerald-900 mt-0.5 block force-ltr">{stats.inStockUnits}</span>
            <span className="text-[10px] font-mono text-emerald-700 force-ltr">
              {formatMAD(stats.totalInStockValue, language)}
            </span>
          </div>

          <div className="p-3.5 rounded-xl bg-blue-50/70 border border-blue-200">
            <span className="text-[11px] font-bold text-blue-800 block">
              {isAr ? 'مخرج فالكوليات' : 'Expédié (Colis)'}
            </span>
            <span className="text-xl font-black text-blue-900 mt-0.5 block force-ltr">{stats.shippedUnits}</span>
          </div>

          <div className="p-3.5 rounded-xl bg-red-50/70 border border-red-200">
            <span className="text-[11px] font-bold text-red-800 block">
              {isAr ? 'الفواتير الصادرة' : 'Factures Générées'}
            </span>
            <span className="text-xl font-black text-red-900 mt-0.5 block force-ltr">{stats.invoicesCount}</span>
          </div>
        </div>
      </div>

      {/* Sub-Tabs & Search */}
      <div className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setSubTab('products')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              subTab === 'products' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <Boxes className="w-4 h-4" />
            <span>{isAr ? `المنتوجات والأكواد (${myProducts.length})` : `Produits & Codes (${myProducts.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('invoices')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              subTab === 'invoices' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>{isAr ? `فواتير السطوك (${myInvoices.length})` : `Factures Stock (${myInvoices.length})`}</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('movements')}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer transition ${
              subTab === 'movements' ? 'bg-red-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
            }`}
          >
            <History className="w-4 h-4" />
            <span>{isAr ? `سجل الحركات (${myMovements.length})` : `Mouvements (${myMovements.length})`}</span>
          </button>
        </div>

        {subTab === 'products' && (
          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={isAr ? 'بحث بالاسم، SKU أو كود القطعة...' : 'Rechercher produit, SKU, code...'}
              className="w-full ps-9 pe-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800"
            />
          </div>
        )}
      </div>

      {/* ================= TAB 1: PRODUCTS ================= */}
      {subTab === 'products' && (
        <>
          {cardFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                cardFeedback.ok
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                  : 'bg-amber-50 border-amber-200 text-amber-900'
              }`}
            >
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{cardFeedback.msg}</span>
              </div>
              <button
                type="button"
                onClick={() => setCardFeedback(null)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {myProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-12 text-center space-y-3">
              <Boxes className="w-12 h-12 text-slate-300 mx-auto" />
              <p className="text-sm font-black text-slate-800">
                {isAr ? 'مازال مدخلتي حتى منتوج في السطوك ديالك' : 'Aucun produit enregistré dans votre stock'}
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                {isAr
                  ? 'اضغط على "إضافة سطوك بالصورة والعدد" باش تزيد سلعتك ويخرج لك السيستيم كود بار لكل قطعة وحدة بوحدة.'
                  : 'Cliquez sur "Ajouter Produit au Stock" pour saisir vos articles avec photo et quantité et générer un code-barres par unité.'}
              </p>
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black inline-flex items-center gap-2 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>{isAr ? 'إضافة أول منتوج للسطوك' : 'Ajouter mon premier produit'}</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {myProducts.map(prod => {
                const pendingCount = prod.units.filter(u => u.status === 'en_attente').length;
                const inStockCount = prod.units.filter(u => u.status === 'en_stock').length;
                const shippedCount = prod.units.filter(u => u.status === 'expedie').length;

                return (
                  <div
                    key={prod.id}
                    className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs flex flex-col justify-between"
                  >
                    <div className="p-4 space-y-3.5">
                      <div className="flex items-start gap-3">
                        {prod.photoUrl ? (
                          <img
                            src={prod.photoUrl}
                            alt={prod.name}
                            className="w-20 h-20 rounded-xl object-cover border border-slate-200 shrink-0 bg-slate-50"
                          />
                        ) : (
                          <div className="w-20 h-20 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                            <Boxes className="w-8 h-8 text-slate-400" />
                          </div>
                        )}

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="font-black text-sm text-slate-900 truncate">{prod.name}</h3>
                            <button
                              type="button"
                              onClick={() => setDeletingProduct(prod)}
                              title={isAr ? 'حذف المنتوج من السطوك' : 'Supprimer du stock'}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer transition-colors shrink-0"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <div className="text-[11px] font-mono font-bold text-slate-500 mt-0.5 force-ltr">
                            {prod.skuCode}
                          </div>
                          <div className="text-sm font-black text-red-600 mt-1 force-ltr">
                            {formatMAD(prod.unitPrice, language)}{' '}
                            <span className="text-[10px] font-normal text-slate-500">/ {isAr ? 'للقطعة' : 'unité'}</span>
                          </div>
                          {prod.hubName && (
                            <div className="text-[10px] text-slate-500 mt-0.5 truncate">{prod.hubName}</div>
                          )}
                        </div>
                      </div>

                      {/* Calculated Unit Breakdown */}
                      <div className="grid grid-cols-4 gap-1.5 text-center">
                        <div className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="text-[10px] text-slate-500 block">{isAr ? 'الكل' : 'Total'}</span>
                          <span className="font-black text-xs text-slate-900 force-ltr">{prod.units.length}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-amber-50 border border-amber-200">
                          <span className="text-[10px] text-amber-800 block">{isAr ? 'انتظار' : 'Attente'}</span>
                          <span className="font-black text-xs text-amber-900 force-ltr">{pendingCount}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-200">
                          <span className="text-[10px] text-emerald-800 block">{isAr ? 'فالسطوك' : 'Stock'}</span>
                          <span className="font-black text-xs text-emerald-900 force-ltr">{inStockCount}</span>
                        </div>
                        <div className="p-2 rounded-xl bg-blue-50 border border-blue-200">
                          <span className="text-[10px] text-blue-800 block">{isAr ? 'مخرج' : 'Sorti'}</span>
                          <span className="font-black text-xs text-blue-900 force-ltr">{shippedCount}</span>
                        </div>
                      </div>
                    </div>

                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 space-y-2">
                      {pendingCount > 0 && (
                        <button
                          type="button"
                          disabled={scanningProductId === prod.id}
                          onClick={async () => {
                            setScanningProductId(prod.id);
                            const r = await scanClientStockUnit(prod.id, {
                              hubName: prod.hubName,
                              actorName: currentUser?.companyName || currentUser?.name,
                              scanAllPending: true
                            });
                            setCardFeedback({ ok: r.success, msg: r.message });
                            setScanningProductId(null);
                          }}
                          className="w-full py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-xl text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Scan className="w-3.5 h-3.5" />
                          <span>
                            {scanningProductId === prod.id
                              ? '...'
                              : isAr
                              ? `تأكيد السكان للسطوك (${pendingCount})`
                              : `Confirmer scan en stock (${pendingCount})`}
                          </span>
                        </button>
                      )}

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setScanFeedback(null);
                            setUnitsProduct(prod);
                          }}
                          className="flex-1 py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-800 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <QrCode className="w-3.5 h-3.5 text-red-600" />
                          <span>{isAr ? `الأكواد (${prod.units.length})` : `Codes (${prod.units.length})`}</span>
                        </button>

                        {onCreatePackageFromStock && (
                          <button
                            type="button"
                            disabled={inStockCount === 0}
                            onClick={() => onCreatePackageFromStock(prod.id)}
                            title={
                              inStockCount === 0
                                ? isAr
                                  ? 'اسكان القطع أولاً باش يتفعلو فالسطوك'
                                  : 'Scannez au moins une unité pour expédier'
                                : undefined
                            }
                            className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <PackagePlus className="w-3.5 h-3.5" />
                            <span>{isAr ? 'إنشاء كوليا' : 'Créer Colis'}</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ================= TAB 2: AUTOMATIC INVOICES ================= */}
      {subTab === 'invoices' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          {myInvoices.length === 0 ? (
            <div className="p-10 text-center space-y-2">
              <FileText className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-bold text-slate-700">
                {isAr ? 'لا توجد فواتير سطوك بعد' : 'Aucune facture de stock générée'}
              </p>
              <p className="text-xs text-slate-500">
                {isAr
                  ? 'كل ما سيزيتي كوليا وسحبتيها من السطوك ديالك، السيستيم كيصدر ليها فاتورة تلقائياً هنا.'
                  : 'Chaque colis créé avec déduction de stock génère automatiquement sa facture ici.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 text-start">{isAr ? 'رقم الفاتورة' : 'N° Facture'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'الكوليا والمستلم' : 'Colis & Destinataire'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'السلع المسحوبة' : 'Articles Déduits'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'العدد' : 'Qté'}</th>
                    <th className="px-4 py-3 text-end">{isAr ? 'قيمة السلع' : 'Produits'}</th>
                    <th className="px-4 py-3 text-end">{isAr ? 'CRBT الكوليا' : 'Total CRBT'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'إجراء' : 'Action'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myInvoices.map(inv => (
                    <tr key={inv.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3">
                        <span className="font-mono font-black text-red-700 block force-ltr">{inv.invoiceNumber}</span>
                        <span className="text-[10px] text-slate-400">{formatDateTime(inv.createdAt, language)}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-mono font-bold text-slate-900 block force-ltr">{inv.trackingNumber}</span>
                        <span className="text-[11px] text-slate-500">
                          {inv.recipientName} · {inv.recipientCity}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {inv.items.map((it, idx) => (
                          <div key={idx} className="text-[11px]">
                            <span className="font-bold text-slate-800">{it.productName}</span>{' '}
                            <span className="text-slate-500">({it.quantity}×)</span>
                          </div>
                        ))}
                      </td>
                      <td className="px-4 py-3 text-center font-black force-ltr">{inv.totalQuantity}</td>
                      <td className="px-4 py-3 text-end font-mono font-bold force-ltr">
                        {formatMAD(inv.productsValue, language)}
                      </td>
                      <td className="px-4 py-3 text-end font-mono font-black text-slate-900 force-ltr">
                        {formatMAD(inv.totalCodAmount, language)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoice(inv)}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-red-600 text-white rounded-lg text-[11px] font-bold inline-flex items-center gap-1 cursor-pointer transition"
                        >
                          <Printer className="w-3.5 h-3.5" />
                          <span>{isAr ? 'عرض / طباعة' : 'Voir / Imprimer'}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= TAB 3: MOVEMENTS LEDGER ================= */}
      {subTab === 'movements' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-2xs">
          {myMovements.length === 0 ? (
            <div className="p-10 text-center text-xs text-slate-500">
              {isAr ? 'لا توجد حركات مسجلة بعد.' : 'Aucun mouvement enregistré.'}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-start">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="px-4 py-3 text-start">{isAr ? 'التاريخ' : 'Date'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'العملية' : 'Opération'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'المنتوج' : 'Produit'}</th>
                    <th className="px-4 py-3 text-center">{isAr ? 'الكمية' : 'Qté'}</th>
                    <th className="px-4 py-3 text-start">{isAr ? 'التفاصيل والأكواد' : 'Détails & Codes'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myMovements.map(mv => (
                    <tr key={mv.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 text-[11px] text-slate-500 font-mono">
                        {formatDateTime(mv.createdAt, language)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            mv.type === 'sortie_colis'
                              ? 'bg-red-50 text-red-700 border border-red-200'
                              : mv.type === 'scan_stock'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-amber-50 text-amber-800 border border-amber-200'
                          }`}
                        >
                          {mv.type === 'entree_creation'
                            ? isAr
                              ? 'تسجيل منتوج جديد'
                              : 'Création Stock'
                            : mv.type === 'ajout_quantite'
                            ? isAr
                              ? 'زيادة العدد'
                              : 'Ajout Quantité'
                            : mv.type === 'scan_stock'
                            ? isAr
                              ? 'سكان ودخول السطوك'
                              : 'Scan Entrée Stock'
                            : isAr
                            ? 'سحب أوتوماتيكي لكوليا'
                            : 'Sortie Colis'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">{mv.productName}</td>
                      <td className="px-4 py-3 text-center font-black force-ltr">
                        {mv.type === 'sortie_colis' ? `-${mv.quantity}` : `+${mv.quantity}`}
                      </td>
                      <td className="px-4 py-3 text-[11px] text-slate-600">
                        <div>{mv.notes}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {mv.unitCodes.slice(0, 4).map(c => (
                            <span key={c} className="px-1.5 py-0.5 rounded bg-slate-100 font-mono text-[10px] force-ltr">
                              {c}
                            </span>
                          ))}
                          {mv.unitCodes.length > 4 && (
                            <span className="text-[10px] text-slate-400">+{mv.unitCodes.length - 4}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ================= MODAL 1: ADD PRODUCT WITH PHOTO & QTY ================= */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Boxes className="w-5 h-5 text-red-400" />
                <h3 className="text-sm font-black">
                  {isAr ? 'إضافة منتوج جديد للسطوك (بالصورة والعدد)' : 'Ajouter un Produit au Stock'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-white rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateProduct} className="p-5 overflow-y-auto space-y-4">
              {/* Photo Upload */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  {isAr ? 'صورة المنتوج (اختياري)' : 'Photo du produit (optionnel)'}
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
                {prodPhoto ? (
                  <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-slate-200 bg-slate-50">
                    <img src={prodPhoto} alt="Preview" className="w-full h-full object-contain" />
                    <button
                      type="button"
                      onClick={() => setProdPhoto('')}
                      className="absolute top-2 end-2 px-2.5 py-1 bg-slate-900/80 text-white rounded-lg text-[11px] font-bold cursor-pointer"
                    >
                      {isAr ? 'تغيير الصورة' : 'Changer'}
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isCompressingPhoto}
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-8 border-2 border-dashed border-slate-300 hover:border-red-400 rounded-2xl bg-slate-50 hover:bg-red-50/30 flex flex-col items-center justify-center gap-2 text-slate-500 cursor-pointer transition disabled:opacity-60"
                  >
                    <ImagePlus className="w-8 h-8 text-red-500" />
                    <span className="text-xs font-bold text-slate-700">
                      {isCompressingPhoto
                        ? isAr
                          ? 'جاري ضغط الصورة...'
                          : "Compression de l'image..."
                        : isAr
                        ? 'اضغط لتحميل صورة المنتوج'
                        : 'Cliquez pour importer la photo du produit'}
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  {isAr ? 'اسم المنتوج *' : 'Nom du produit *'}
                </label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={e => setProdName(e.target.value)}
                  placeholder={isAr ? 'مثال: حذاء رياضي أسود مقاس 42' : 'Ex: Basket Sport Noir'}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isAr ? 'العدد (الكمية) *' : 'Quantité (Unités) *'}
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    required
                    value={prodQtyInput}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      setProdQtyInput(raw ? String(Math.min(500, parseInt(raw, 10))) : '');
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                  />
                  <span className="text-[10px] text-slate-500 block mt-1">
                    {isAr
                      ? `سيتم توليد ${parseInt(prodQtyInput, 10) || 0} كود بار مختلف (واحد لكل قطعة)`
                      : `${parseInt(prodQtyInput, 10) || 0} codes-barres individuels seront générés`}
                  </span>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isAr ? 'ثمن البيع للوحدة (MAD) *' : 'Prix unitaire (MAD) *'}
                  </label>
                  <input
                    type="number"
                    inputMode="decimal"
                    min={0}
                    step="any"
                    required
                    value={prodPriceInput}
                    onChange={e => {
                      const raw = e.target.value;
                      if (raw === '') {
                        setProdPriceInput('');
                        return;
                      }
                      setProdPriceInput(raw.replace(/^0+(?=\d)/, ''));
                    }}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-black text-slate-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isAr ? 'المستودع (Hub)' : 'Hub Entrepôt'}
                  </label>
                  <select
                    value={prodHub}
                    onChange={e => setProdHub(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                  >
                    {agencies.map(ag => (
                      <option key={ag.id} value={ag.name}>
                        {ag.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    {isAr ? 'الصنف (اختياري)' : 'Catégorie (optionnel)'}
                  </label>
                  <input
                    type="text"
                    value={prodCategory}
                    onChange={e => setProdCategory(e.target.value)}
                    placeholder={isAr ? 'ملابس، إلكترونيات...' : 'Mode, Beauté...'}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-800"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-bold text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 cursor-pointer"
                >
                  {isAr ? 'إلغاء' : 'Annuler'}
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-xs font-black cursor-pointer"
                >
                  {isSaving
                    ? isAr
                      ? 'جاري التوليد...'
                      : 'Génération...'
                    : isAr
                    ? 'حفظ وتوليد أكواد كل قطعة'
                    : 'Enregistrer & Générer les codes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ================= MODAL 2: UNIT BARCODES SHEET & STATUSES ================= */}
      {activeUnitsProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/65 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="px-5 py-4 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {activeUnitsProduct.photoUrl && (
                  <img
                    src={activeUnitsProduct.photoUrl}
                    alt={activeUnitsProduct.name}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                  />
                )}
                <div>
                  <h3 className="text-sm font-black">{activeUnitsProduct.name}</h3>
                  <p className="text-[11px] font-mono text-slate-400">
                    {activeUnitsProduct.skuCode} · {activeUnitsProduct.units.length}{' '}
                    {isAr ? 'قطعة بأكواد فردية' : 'unités codées'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePrintAllUnitLabels(activeUnitsProduct)}
                  className="px-3.5 py-2 bg-red-600 hover:bg-red-500 text-white rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  <span>{isAr ? 'طباعة ملصقات جميع القطع' : 'Imprimer toutes les étiquettes'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setUnitsProduct(null)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 bg-slate-50">
              {/* Quick Add More Units Bar */}
              <div className="bg-white p-3.5 rounded-xl border border-slate-200 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                  <Plus className="w-4 h-4 text-red-600" />
                  <span>{isAr ? 'زيادة كمية جديدة لهذا المنتوج:' : 'Ajouter de nouvelles unités :'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={addUnitsQty}
                    onChange={e => setAddUnitsQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="w-20 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center"
                  />
                  <button
                    type="button"
                    disabled={isAddingUnits}
                    onClick={handleAddMoreUnits}
                    className="px-3.5 py-1.5 bg-slate-900 hover:bg-red-600 text-white rounded-lg text-xs font-bold cursor-pointer"
                  >
                    {isAddingUnits ? '...' : isAr ? 'توليد وإضافة' : '+ Ajouter'}
                  </button>
                </div>
              </div>

              {scanFeedback && (
                <div
                  className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
                    scanFeedback.ok
                      ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-50 text-amber-800 border border-amber-200'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{scanFeedback.msg}</span>
                </div>
              )}

              {/* Unit Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {activeUnitsProduct.units.map((u, idx) => (
                  <div
                    key={u.id}
                    className={`bg-white rounded-xl border p-3 space-y-2 ${
                      u.status === 'en_stock'
                        ? 'border-emerald-300'
                        : u.status === 'expedie'
                        ? 'border-blue-300 bg-blue-50/20'
                        : 'border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-black text-slate-400">#{idx + 1}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1 ${
                          u.status === 'en_stock'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'expedie'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {u.status === 'en_stock' ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            <span>{isAr ? 'فالسطوك' : 'En Stock'}</span>
                          </>
                        ) : u.status === 'expedie' ? (
                          <>
                            <Truck className="w-3 h-3" />
                            <span>{isAr ? 'خرج فكوليا' : 'Expédié'}</span>
                          </>
                        ) : (
                          <>
                            <Clock className="w-3 h-3" />
                            <span>{isAr ? 'فانتظار السكان' : 'Attente Scan'}</span>
                          </>
                        )}
                      </span>
                    </div>

                    <div
                      className="flex justify-center bg-slate-50 rounded-lg p-1.5 border border-slate-100"
                      dangerouslySetInnerHTML={{ __html: generateBarcodeSVG(u.unitCode, 30) }}
                    />

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <button
                        type="button"
                        onClick={() => handleCopyCode(u.unitCode)}
                        className="font-mono font-bold text-slate-700 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer force-ltr"
                      >
                        {copiedCode === u.unitCode ? (
                          <Check className="w-3 h-3 text-emerald-600" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                        <span>{u.unitCode}</span>
                      </button>

                      <div className="flex items-center gap-1.5">
                        {u.status === 'en_attente' && (
                          <button
                            type="button"
                            onClick={async () => {
                              const r = await scanClientStockUnit(u.unitCode, {
                                hubName: activeUnitsProduct.hubName,
                                actorName: currentUser?.companyName || currentUser?.name
                              });
                              setScanFeedback({ ok: r.success, msg: r.message });
                            }}
                            className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title={isAr ? 'تأكيد السكان وإدخال القطعة للسطوك' : 'Confirmer le scan en stock'}
                          >
                            <Scan className="w-3 h-3" />
                            <span>{isAr ? 'سكان للسطوك' : 'Scanner'}</span>
                          </button>
                        )}

                        {u.status === 'en_stock' && (
                          <button
                            type="button"
                            disabled={dispatchingUnitCode === u.unitCode}
                            onClick={async () => {
                              setDispatchingUnitCode(u.unitCode);
                              const r = await dispatchClientStockUnit(u.unitCode, {
                                clientId: currentUser?.id,
                                actorName: currentUser?.companyName || currentUser?.name,
                                notes: isAr ? 'إخراج قطعة من السطوك' : 'Sortie manuelle depuis fiche stock'
                              });
                              setScanFeedback({ ok: r.success, msg: r.message });
                              setDispatchingUnitCode(null);
                            }}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-[10px] font-bold inline-flex items-center gap-1 cursor-pointer"
                            title={isAr ? 'إخراج هذه القطعة ونقصها من السطوك' : 'Sortir cette unité du stock'}
                          >
                            <Truck className="w-3 h-3" />
                            <span>{isAr ? 'إخراج قطعة' : 'Sortie'}</span>
                          </button>
                        )}

                        <button
                          type="button"
                          disabled={deletingUnitId === u.id}
                          onClick={async () => {
                            setDeletingUnitId(u.id);
                            const r = await deleteClientStockUnit(activeUnitsProduct.id, u.id);
                            setScanFeedback({
                              ok: r.success,
                              msg: r.success
                                ? isAr
                                  ? `تم حذف القطعة ${u.unitCode} بنجاح.`
                                  : `Unité ${u.unitCode} supprimée.`
                                : r.error || (isAr ? 'تعذر حذف القطعة.' : 'Erreur suppression unité.')
                            });
                            setDeletingUnitId(null);
                          }}
                          className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer disabled:opacity-40"
                          title={isAr ? 'حذف هذه القطعة' : 'Supprimer cette unité'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {u.status === 'en_stock' && u.zone && (
                      <div className="text-[10px] text-emerald-700 font-mono">
                        {u.hubName} · {u.zone} / {u.shelf} / {u.bin}
                      </div>
                    )}

                    {u.status === 'expedie' && u.packageTrackingNumber && (
                      <div className="text-[10px] text-blue-700 font-mono">
                        {isAr ? 'الكوليا:' : 'Colis:'} {u.packageTrackingNumber}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Modal */}
      <StockInvoiceModal
        invoice={selectedInvoice}
        isOpen={Boolean(selectedInvoice)}
        onClose={() => setSelectedInvoice(null)}
      />

      {/* Delete Stock Product Confirmation Modal */}
      {deletingProduct && (
        <ConfirmActionModal
          isOpen={true}
          title={isAr ? 'تأكيد حذف المنتوج من السطوك' : 'Confirmer la suppression du stock'}
          message={
            isAr
              ? `واش متأكد بغيتي تمسح "${deletingProduct.name}" (${deletingProduct.units.length} قطعة) من السطوك؟`
              : `Voulez-vous vraiment supprimer « ${deletingProduct.name} » (${deletingProduct.units.length} unité(s)) du stock ?`
          }
          confirmLabel={isAr ? 'نعم، مسح من السطوك' : 'Supprimer du stock'}
          cancelLabel={isAr ? 'إلغاء' : 'Annuler'}
          isDestructive={true}
          requireReason={false}
          onConfirm={async () => {
            const target = deletingProduct;
            setDeletingProduct(null);
            const res = await deleteClientStockProduct(target.id);
            if (res.success) {
              setCardFeedback({
                ok: true,
                msg: isAr ? `تم حذف "${target.name}" من السطوك بنجاح.` : `« ${target.name} » supprimé du stock.`
              });
            } else {
              setCardFeedback({
                ok: false,
                msg: res.error || (isAr ? 'تعذر حذف المنتوج من السطوك.' : 'Impossible de supprimer ce produit.')
              });
            }
          }}
          onCancel={() => setDeletingProduct(null)}
        />
      )}
    </div>
  );
};
