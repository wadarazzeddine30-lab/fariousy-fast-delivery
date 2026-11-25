import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  PackageCheck,
  Scan,
  Truck,
  Warehouse,
  X,
  AlertCircle,
  Boxes,
  Building2,
  MapPin,
  Clock,
  Volume2,
  VolumeX,
  ImagePlus
} from 'lucide-react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { useDatabase } from '../context/DatabaseContext';
import { useAuth } from '../context/AuthContext';
import { ClientStockProduct, ClientStockUnit, PackageItem } from '../types';
import { formatMAD } from '../utils/barcode';
import { PartnerDeliveryChoiceModal, PartnerDeliveryChoiceResult } from './common/PartnerDeliveryChoiceModal';
import { isPackageAssignedToPartner, resolvePackagePartner } from '../utils/partnerTariffs';

type ScanActionType = 'reception_stock' | 'depart_livraison' | 'arrivee_agence' | 'marquer_livre' | 'marquer_retour';

interface SessionScanEntry {
  id: string;
  code: string;
  trackingNumber: string;
  recipientName?: string;
  city?: string;
  codAmount?: number;
  agencyName: string;
  action: ScanActionType;
  success: boolean;
  message: string;
  scannedAt: string;
}

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultAction?: ScanActionType;
  initialAgencyName?: string;
}

const SCANNER_READER_ID = 'fariousy-agency-camera-reader';
const SCANNER_PHOTO_DECODER_ID = 'fariousy-agency-photo-decoder';

export const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  defaultAction = 'reception_stock',
  initialAgencyName
}) => {
  const {
    packages,
    agencies,
    partners,
    users,
    scanBarcodeAction,
    updatePackage,
    changePackageStatus,
    clientStockProducts,
    scanClientStockUnit,
    dispatchClientStockUnit
  } = useDatabase();
  const { currentUser } = useAuth();

  const [inputCode, setInputCode] = useState('');
  const [selectedAction, setSelectedAction] = useState<ScanActionType>(defaultAction);
  const [selectedAgencyName, setSelectedAgencyName] = useState<string>('');
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraRetryTick, setCameraRetryTick] = useState(0);
  const [photoDecoding, setPhotoDecoding] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [sessionScans, setSessionScans] = useState<SessionScanEntry[]>([]);
  const [lastScannedResult, setLastScannedResult] = useState<{
    success: boolean;
    message: string;
    agencyName?: string;
    pkg?: PackageItem;
    stockProduct?: ClientStockProduct;
    stockUnit?: ClientStockUnit;
  } | null>(null);
  const [pendingPartnerDeliverPkg, setPendingPartnerDeliverPkg] = useState<PackageItem | null>(null);
  const [isSavingPartnerDelivery, setIsSavingPartnerDelivery] = useState(false);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const html5QrRef = useRef<Html5Qrcode | null>(null);
  const lastDecodedRef = useRef<{ code: string; at: number }>({ code: '', at: 0 });
  const executeScanRef = useRef<(code: string) => Promise<void>>(async () => {});

  const drivers = useMemo(() => users.filter(u => u.role === 'driver'), [users]);
  const activeAgencies = useMemo(
    () => agencies.filter(a => a.active !== false),
    [agencies]
  );
  const agencyOptions = activeAgencies.length > 0 ? activeAgencies : agencies;

  // Live active parcel counts per agency
  const agencyParcelCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    packages.forEach(p => {
      if (!p.currentAgency) return;
      if (['livre', 'retourne', 'annule'].includes(p.status)) return;
      const key = p.currentAgency.trim().toLowerCase();
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [packages]);

  // Resolve default agency when modal opens or initialAgencyName changes
  useEffect(() => {
    if (!isOpen) return;
    setSelectedAction(defaultAction);

    const resolveInitialAgency = () => {
      if (initialAgencyName && initialAgencyName.trim()) {
        const matched = agencyOptions.find(
          a => a.name.trim().toLowerCase() === initialAgencyName.trim().toLowerCase()
        );
        return matched ? matched.name : initialAgencyName.trim();
      }
      if (currentUser?.agencyId || currentUser?.agencyName) {
        const userAgency = agencyOptions.find(
          a =>
            (currentUser.agencyId && a.id === currentUser.agencyId) ||
            (currentUser.agencyName && a.name.trim().toLowerCase() === currentUser.agencyName.trim().toLowerCase())
        );
        if (userAgency) return userAgency.name;
      }
      const userCity = currentUser?.city?.trim().toLowerCase();
      if (userCity) {
        const cityAgency = agencyOptions.find(
          a => a.city.trim().toLowerCase() === userCity
        );
        if (cityAgency) return cityAgency.name;
      }
      return agencyOptions[0]?.name || 'Hub Central Casablanca';
    };

    setSelectedAgencyName(resolveInitialAgency());
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [isOpen, initialAgencyName, defaultAction, agencyOptions, currentUser?.agencyId, currentUser?.agencyName, currentUser?.city]);

  useEffect(() => {
    if (drivers.length > 0 && !selectedDriverId) {
      setSelectedDriverId(drivers[0].id);
    }
  }, [drivers, selectedDriverId]);

  const selectedAgencyObj = useMemo(
    () =>
      agencyOptions.find(
        a => a.name.trim().toLowerCase() === selectedAgencyName.trim().toLowerCase()
      ) || null,
    [agencyOptions, selectedAgencyName]
  );

  const effectiveAgencyName = selectedAgencyName.trim() || agencyOptions[0]?.name || 'Hub Central Casablanca';

  const playBeep = useCallback(
    (success: boolean) => {
      if (!soundEnabled) return;
      try {
        const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        if (success) {
          osc.frequency.setValueAtTime(920, ctx.currentTime);
          osc.frequency.setValueAtTime(1380, ctx.currentTime + 0.07);
          gain.gain.setValueAtTime(0.18, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.2);
        } else {
          osc.frequency.setValueAtTime(280, ctx.currentTime);
          gain.gain.setValueAtTime(0.24, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.24);
          osc.start(ctx.currentTime);
          osc.stop(ctx.currentTime + 0.24);
        }
        setTimeout(() => {
          ctx.close().catch(() => {});
        }, 500);
        if ('vibrate' in navigator) {
          navigator.vibrate(success ? [80, 40, 80] : [200]);
        }
      } catch {
        // Ignore audio errors
      }
    },
    [soundEnabled]
  );

  const stopCameraSafely = useCallback(async () => {
    const instance = html5QrRef.current;
    html5QrRef.current = null;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
    } catch {
      // Ignore stop error if already stopped
    }
    try {
      await instance.clear();
    } catch {
      // Ignore clear error
    }
  }, []);

  const handleExecuteScan = useCallback(
    async (codeToScan: string) => {
      const cleanRaw = codeToScan.trim();
      const clean = cleanRaw.toUpperCase();
      if (!clean) return;

      // 1. Check if code matches a Client Stock Unit (FSU-...) or Product SKU (SKU-...)
      const isStockCode =
        clean.startsWith('FSU-') ||
        clean.startsWith('SKU-') ||
        clientStockProducts.some(
          p => p.skuCode.toUpperCase() === clean || p.units.some(u => u.unitCode.toUpperCase() === clean)
        );

      if (isStockCode) {
        const isExitAction = selectedAction === 'depart_livraison' || selectedAction === 'marquer_livre';
        const stockRes = isExitAction
          ? await dispatchClientStockUnit(clean, {
              actorName: currentUser?.name || effectiveAgencyName,
              notes:
                selectedAction === 'depart_livraison'
                  ? `إخراج تلقائي عبر سكان ${effectiveAgencyName} (Départ livraison)`
                  : `إخراج تلقائي عبر سكان ${effectiveAgencyName} (Livré)`
            })
          : await scanClientStockUnit(clean, {
              hubName: effectiveAgencyName,
              actorName: currentUser?.name || effectiveAgencyName
            });
        playBeep(stockRes.success);
        setLastScannedResult({
          success: stockRes.success,
          message: stockRes.message,
          agencyName: effectiveAgencyName,
          stockProduct: stockRes.product,
          stockUnit: stockRes.unit
        });
        setSessionScans(prev => [
          {
            id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            code: clean,
            trackingNumber: stockRes.unit?.unitCode || stockRes.product?.skuCode || clean,
            recipientName: stockRes.product?.name,
            city: stockRes.product?.clientCompany || stockRes.product?.clientName,
            agencyName: effectiveAgencyName,
            action: selectedAction,
            success: stockRes.success,
            message: stockRes.message,
            scannedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          },
          ...prev
        ].slice(0, 30));
        setInputCode('');
        setTimeout(() => inputRef.current?.focus(), 40);
        return;
      }

      // Extract tracking candidate for partner-deliver check
      const extractedMatch = clean.match(/(?:FAR|COL|PKG|FSU|SKU)-[A-Z0-9-]+/);
      const lookupCode = extractedMatch ? extractedMatch[0] : clean;

      const matchedPkg = packages.find(
        p =>
          p.trackingNumber.trim().toUpperCase() === lookupCode ||
          p.id.trim().toUpperCase() === lookupCode ||
          (p.partnerTrackingId && p.partnerTrackingId.trim().toUpperCase() === lookupCode)
      );
      if (
        selectedAction === 'marquer_livre' &&
        matchedPkg &&
        matchedPkg.status !== 'livre' &&
        isPackageAssignedToPartner(matchedPkg, partners)
      ) {
        setPendingPartnerDeliverPkg(matchedPkg);
        setInputCode('');
        return;
      }

      const driver = drivers.find(d => d.id === selectedDriverId);

      const res = scanBarcodeAction(
        cleanRaw,
        selectedAction,
        {
          driverId: selectedDriverId,
          driverName: driver?.name,
          agencyName: effectiveAgencyName,
          agencyId: selectedAgencyObj?.id,
          location: effectiveAgencyName
        },
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined
      );

      playBeep(res.success);

      setLastScannedResult({
        success: res.success,
        message: res.message,
        agencyName: effectiveAgencyName,
        pkg: res.packageItem
      });

      setSessionScans(prev => [
        {
          id: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          code: lookupCode,
          trackingNumber: res.packageItem?.trackingNumber || lookupCode,
          recipientName: res.packageItem?.recipientName,
          city: res.packageItem?.city,
          codAmount: res.packageItem?.codAmount,
          agencyName: effectiveAgencyName,
          action: selectedAction,
          success: res.success,
          message: res.message,
          scannedAt: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        },
        ...prev
      ].slice(0, 30));

      setInputCode('');
      setTimeout(() => inputRef.current?.focus(), 40);
    },
    [
      clientStockProducts,
      selectedAction,
      dispatchClientStockUnit,
      scanClientStockUnit,
      currentUser,
      effectiveAgencyName,
      selectedAgencyObj?.id,
      packages,
      partners,
      drivers,
      selectedDriverId,
      scanBarcodeAction,
      playBeep
    ]
  );

  useEffect(() => {
    executeScanRef.current = handleExecuteScan;
  }, [handleExecuteScan]);

  // Decode barcode / QR from a captured photo (fallback if live video is blocked or unavailable)
  const handlePhotoScanFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    setPhotoDecoding(true);
    setCameraError(null);
    try {
      let decoded: string | null = null;

      // 1. Try native BarcodeDetector first if available (very fast on Android WebView / Chrome)
      const BarcodeDetectorClass = (window as any).BarcodeDetector;
      if (BarcodeDetectorClass && typeof createImageBitmap === 'function') {
        try {
          const bitmap = await createImageBitmap(file);
          const detector = new BarcodeDetectorClass({
            formats: ['qr_code', 'code_128', 'code_39', 'code_93', 'ean_13', 'ean_8', 'data_matrix', 'itf']
          });
          const codes = await detector.detect(bitmap);
          bitmap.close?.();
          if (Array.isArray(codes) && codes.length > 0 && codes[0]?.rawValue) {
            decoded = String(codes[0].rawValue);
          }
        } catch {
          // fall through to Html5Qrcode.scanFile
        }
      }

      // 2. Fallback to Html5Qrcode.scanFile
      if (!decoded) {
        const photoQr = new Html5Qrcode(SCANNER_PHOTO_DECODER_ID, {
          verbose: false,
          formatsToSupport: [
            Html5QrcodeSupportedFormats.QR_CODE,
            Html5QrcodeSupportedFormats.CODE_128,
            Html5QrcodeSupportedFormats.CODE_39,
            Html5QrcodeSupportedFormats.CODE_93,
            Html5QrcodeSupportedFormats.EAN_13,
            Html5QrcodeSupportedFormats.EAN_8,
            Html5QrcodeSupportedFormats.DATA_MATRIX,
            Html5QrcodeSupportedFormats.ITF
          ]
        });
        try {
          decoded = await photoQr.scanFile(file, false);
        } finally {
          try {
            photoQr.clear();
          } catch {}
        }
      }

      if (decoded && decoded.trim()) {
        await executeScanRef.current(decoded.trim());
      } else {
        setCameraError("ما قدرناش نقراو الباركود/QR فهاد الصورة. قرّب الكاميرا مزيان للباركود وحاول مرة أخرى.");
      }
    } catch {
      setCameraError("ما بانش باركود أو QR واضح فهاد الصورة. صوّر التيكيت بوضوح أكثر أو دخل الكود يدوياً.");
    } finally {
      setPhotoDecoding(false);
    }
  }, []);

  // Real Html5Qrcode camera lifecycle (supports QR + Code128 + Code39 + EAN13 + ITF + DataMatrix)
  useEffect(() => {
    if (!isOpen || !cameraActive) {
      void stopCameraSafely();
      setCameraStarting(false);
      return;
    }

    let cancelled = false;
    setCameraError(null);
    setCameraStarting(true);

    const createFreshQrScanner = () =>
      new Html5Qrcode(SCANNER_READER_ID, {
        verbose: false,
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.CODE_93,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.EAN_8,
          Html5QrcodeSupportedFormats.DATA_MATRIX,
          Html5QrcodeSupportedFormats.ITF
        ],
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });

    const startScanner = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError("الكاميرا المباشرة غير مدعومة هنا. استعمل زر «تصوير الكود بالكاميرا» أو الدوشيت.");
          setCameraActive(false);
          setCameraStarting(false);
        }
        return;
      }

      await stopCameraSafely();
      // Wait a tick for the DOM node to mount
      await new Promise(resolve => setTimeout(resolve, 70));
      if (cancelled) return;

      const readerEl = document.getElementById(SCANNER_READER_ID);
      if (!readerEl) {
        setCameraStarting(false);
        return;
      }

      // Pre-warm Android WebView / browser camera permission cleanly before Html5Qrcode starts
      try {
        let probeStream: MediaStream | null = null;
        try {
          probeStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' } },
            audio: false
          });
        } catch (probeErr: any) {
          const probeName = String(probeErr?.name || probeErr?.message || '');
          if (/NotAllowedError|Permission|denied|SecurityError/i.test(probeName)) {
            throw probeErr;
          }
          probeStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        }
        probeStream?.getTracks().forEach(t => t.stop());
        // Give Android camera hardware a short moment to release before Html5Qrcode opens it
        await new Promise(resolve => setTimeout(resolve, 120));
      } catch (permErr: any) {
        if (cancelled) return;
        console.warn('Camera permission error:', permErr);
        const errText = String(permErr?.name || permErr?.message || permErr || '');
        if (/NotAllowedError|Permission|denied|SecurityError/i.test(errText)) {
          setCameraError(
            "تم رفض إذن الكاميرا (Autorisation refusée). فعّل إذن الكاميرا للتطبيق من إعدادات الهاتف ثم اضغط «إعادة المحاولة»، أو استعمل زر «تصوير الكود»."
          );
        } else {
          setCameraError("تعذر فتح الكاميرا الآن. جرب «إعادة المحاولة» أو استعمل زر «تصوير الكود» / الدوشيت.");
        }
        setCameraActive(false);
        setCameraStarting(false);
        return;
      }

      if (cancelled) return;

      const scanConfig = {
        fps: 10
      };

      const onDecoded = (decodedText: string) => {
        const normalized = decodedText.trim().toUpperCase();
        if (!normalized) return;
        const now = Date.now();
        if (
          lastDecodedRef.current.code === normalized &&
          now - lastDecodedRef.current.at < 2500
        ) {
          return;
        }
        lastDecodedRef.current = { code: normalized, at: now };
        void executeScanRef.current(decodedText);
      };

      let started = false;
      let lastErr: any = null;

      // Attempt 1: Rear camera via facingMode
      try {
        const qr1 = createFreshQrScanner();
        html5QrRef.current = qr1;
        await qr1.start({ facingMode: 'environment' }, scanConfig, onDecoded, () => {});
        started = true;
      } catch (err1: any) {
        lastErr = err1;
        await stopCameraSafely();
      }

      // Attempt 2: Enumerate cameras and start fresh instance by deviceId
      if (!started && !cancelled) {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (cameras && cameras.length > 0 && !cancelled) {
            const preferred =
              cameras.find(c => /back|rear|environment|الخلفي/i.test(c.label)) || cameras[cameras.length - 1];
            const qr2 = createFreshQrScanner();
            html5QrRef.current = qr2;
            await qr2.start(preferred.id, scanConfig, onDecoded, () => {});
            started = true;
          }
        } catch (err2: any) {
          lastErr = err2;
          await stopCameraSafely();
        }
      }

      // Attempt 3: Default front/any camera fallback
      if (!started && !cancelled) {
        try {
          const qr3 = createFreshQrScanner();
          html5QrRef.current = qr3;
          await qr3.start({ facingMode: 'user' }, scanConfig, onDecoded, () => {});
          started = true;
        } catch (err3: any) {
          lastErr = err3 || lastErr;
          await stopCameraSafely();
        }
      }

      if (cancelled) return;

      if (started) {
        setCameraStarting(false);
      } else {
        console.warn('Camera scanner error:', lastErr);
        const errText = String(lastErr?.name || lastErr?.message || lastErr || '');
        if (/NotAllowedError|Permission|denied|SecurityError/i.test(errText)) {
          setCameraError(
            "تم رفض إذن الكاميرا (Autorisation refusée). فعّل إذن الكاميرا للتطبيق من إعدادات الهاتف ثم اضغط «إعادة المحاولة»، أو استعمل زر «تصوير الكود»."
          );
        } else {
          setCameraError("تعذر تشغيل الكاميرا المباشرة الآن. استعمل زر «تصوير الكود بالكاميرا» أو الدوشيت / الإدخال اليدوي.");
        }
        setCameraActive(false);
        setCameraStarting(false);
      }
    };

    void startScanner();

    return () => {
      cancelled = true;
      void stopCameraSafely();
    };
  }, [isOpen, cameraActive, cameraRetryTick, stopCameraSafely]);

  // Stop camera when modal closes
  useEffect(() => {
    if (!isOpen) {
      setCameraActive(false);
      void stopCameraSafely();
    }
  }, [isOpen, stopCameraSafely]);

  if (!isOpen) return null;

  const handleConfirmPartnerDelivery = async (result: PartnerDeliveryChoiceResult) => {
    if (!pendingPartnerDeliverPkg) return;
    const pkg = pendingPartnerDeliverPkg;
    const matchedPartner = resolvePackagePartner(pkg, partners);
    const partnerLabel = matchedPartner?.name || pkg.partnerName || pkg.destinationAgency || 'الشريك';

    setIsSavingPartnerDelivery(true);
    try {
      updatePackage(
        pkg.id,
        {
          deliveredBy: result.deliveredBy,
          partnerDeliveryFee: result.deliveredBy === 'partner' ? result.partnerFee : 0
        },
        currentUser ? { name: currentUser.name, role: currentUser.role, id: currentUser.id } : undefined
      );

      const comment =
        result.deliveredBy === 'partner'
          ? `تم التوصيل من طرف الشريك (${partnerLabel}) عبر سكان ${effectiveAgencyName} — أتعاب الشريك: ${result.partnerFee} DH | الربح الصافي: ${result.profit} DH`
          : `تم التوصيل من طرف الإدارة (FARIOUSY) عبر سكان ${effectiveAgencyName} — أتعاب الشريك: 0 DH | الربح الصافي: ${result.profit} DH`;

      await changePackageStatus(
        pkg.id,
        'livre',
        comment,
        effectiveAgencyName,
        currentUser ? { name: currentUser.name, role: currentUser.role } : undefined,
        { currentAgency: effectiveAgencyName }
      );

      playBeep(true);
      setLastScannedResult({
        success: true,
        agencyName: effectiveAgencyName,
        message:
          result.deliveredBy === 'partner'
            ? `✅ ${pkg.trackingNumber} : ليفري من طرف الشريك (${partnerLabel}) — توصيل الشريك: ${result.partnerFee} DH | ربحك الصافي: +${result.profit} DH`
            : `✅ ${pkg.trackingNumber} : ليفري من طرف الإدارة — أتعاب الشريك: 0 DH | ربحك الصافي: +${result.profit} DH`,
        pkg: {
          ...pkg,
          status: 'livre',
          currentAgency: effectiveAgencyName,
          deliveredBy: result.deliveredBy,
          partnerDeliveryFee: result.deliveredBy === 'partner' ? result.partnerFee : 0
        }
      });
      setPendingPartnerDeliverPkg(null);
    } finally {
      setIsSavingPartnerDelivery(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void handleExecuteScan(inputCode);
  };

  const currentAgencySessionScans = sessionScans.filter(
    s => s.agencyName.toLowerCase() === effectiveAgencyName.toLowerCase()
  );
  const currentAgencySuccessCount = currentAgencySessionScans.filter(s => s.success).length;
  const currentAgencyLiveCount = agencyParcelCounts[effectiveAgencyName.toLowerCase()] || 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-black/65 backdrop-blur-xs no-print">
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]">
        {/* Hidden container for photo-based QR/Barcode decoding */}
        <div id={SCANNER_PHOTO_DECODER_ID} className="hidden" />
        <input
          ref={photoInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handlePhotoScanFile}
          className="hidden"
        />

        {/* Header (Compact & Pinned) */}
        <div className="shrink-0 flex items-center justify-between gap-2 px-3.5 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-red-600 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Scan className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-base font-black truncate">
                سكان استلام الكوليات — كل أجونص وسكان ديالها
              </h3>
              <p className="text-[10px] sm:text-[11px] text-slate-300 truncate">
                Scanner par Agence · Douchette USB/Bluetooth · Caméra QR & Code-barres
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setSoundEnabled(v => !v)}
              title={soundEnabled ? 'كتم الصوت' : 'تفعيل صوت السكان'}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              {soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Single Unified Scrollable Body (Agency Strip + Actions + Camera + Results) */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
          {/* Dedicated Per-Agency Selector Strip */}
          <div className="px-3.5 py-3 sm:px-5 sm:py-3.5 bg-gradient-to-r from-red-50 via-white to-amber-50/60 border-b border-red-100 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-red-600 shrink-0" />
                <span className="text-xs font-black text-slate-900">
                  اختر الأجونص ديال السكان (Agence active) :
                </span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-600 text-white text-[11px] font-extrabold shadow-2xs">
                <Warehouse className="w-3.5 h-3.5 shrink-0" />
                <span>فلاجونص: {effectiveAgencyName}</span>
                <span className="px-1.5 py-0.2 rounded bg-white/20 font-mono text-[10px]">
                  {currentAgencyLiveCount} colis
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              {agencyOptions.map(agency => {
                const isSelected = agency.name.trim().toLowerCase() === effectiveAgencyName.toLowerCase();
                const count = agencyParcelCounts[agency.name.trim().toLowerCase()] || 0;
                return (
                  <button
                    key={agency.id}
                    type="button"
                    onClick={() => {
                      setSelectedAgencyName(agency.name);
                      setTimeout(() => inputRef.current?.focus(), 40);
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-red-600 text-white border-red-600 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-red-300 hover:bg-red-50/50'
                    }`}
                  >
                    <MapPin className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-white' : 'text-red-500'}`} />
                    <span>{agency.name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-black ${
                        isSelected ? 'bg-red-800 text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-3.5 sm:p-5 space-y-4">
          {/* Action Type Selector */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-2">
              شنو بغيتي تدير فاش تسكاني الكوليا؟ (Opération du scan) :
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setSelectedAction('reception_stock')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                  selectedAction === 'reception_stock'
                    ? 'border-emerald-600 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-500/30'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Warehouse className="w-4 h-4 shrink-0 text-emerald-600" />
                <div className="leading-tight">
                  <span className="block">استلام فالأجونص</span>
                  <span className="text-[10px] font-medium opacity-75">شديت الكوليا (En stock)</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('arrivee_agence')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                  selectedAction === 'arrivee_agence'
                    ? 'border-blue-600 bg-blue-50 text-blue-800 ring-1 ring-blue-500/30'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Building2 className="w-4 h-4 shrink-0 text-blue-600" />
                <div className="leading-tight">
                  <span className="block">وصول لأجونص الوجهة</span>
                  <span className="text-[10px] font-medium opacity-75">Arrivée destination</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('depart_livraison')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                  selectedAction === 'depart_livraison'
                    ? 'border-amber-600 bg-amber-50 text-amber-800 ring-1 ring-amber-500/30'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Truck className="w-4 h-4 shrink-0 text-amber-600" />
                <div className="leading-tight">
                  <span className="block">توجيه لليفرور</span>
                  <span className="text-[10px] font-medium opacity-75">Départ livraison</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('marquer_livre')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                  selectedAction === 'marquer_livre'
                    ? 'border-red-600 bg-red-50 text-red-700 ring-1 ring-red-500/30'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <PackageCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <div className="leading-tight">
                  <span className="block">تأكيد ليفري</span>
                  <span className="text-[10px] font-medium opacity-75">Valider livraison</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setSelectedAction('marquer_retour')}
                className={`flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold border transition-all text-left cursor-pointer ${
                  selectedAction === 'marquer_retour'
                    ? 'border-rose-600 bg-rose-50 text-rose-800 ring-1 ring-rose-500/30'
                    : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
              >
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                <div className="leading-tight">
                  <span className="block">استلام روتور</span>
                  <span className="text-[10px] font-medium opacity-75">Réception retour</span>
                </div>
              </button>
            </div>

            {selectedAction === 'depart_livraison' && (
              <div className="mt-3 p-3 bg-amber-50/70 border border-amber-200 rounded-xl">
                <label className="block text-xs font-bold text-amber-900 mb-1">
                  اختر الليفرور المكلف بالتوزيع :
                </label>
                <select
                  value={selectedDriverId}
                  onChange={e => setSelectedDriverId(e.target.value)}
                  className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  {drivers.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.city} - {d.driverVehicle || 'Véhicule'})
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Douchette / Manual Input Form */}
          <form onSubmit={handleSubmit} className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-bold text-slate-700">
                سكاني بالدوشيت أو دخل كود الكوليا (Code-barres / Tracking) :
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    if (cameraActive) {
                      setCameraActive(false);
                    } else {
                      setCameraActive(true);
                      setCameraRetryTick(t => t + 1);
                    }
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    cameraActive
                      ? 'bg-rose-100 text-rose-700 hover:bg-rose-200'
                      : 'bg-slate-900 text-white hover:bg-slate-800'
                  }`}
                >
                  <Camera className="w-3.5 h-3.5 shrink-0" />
                  <span>{cameraActive ? 'إيقاف الكاميرا' : 'سكان بالكاميرا (QR / Barcode)'}</span>
                </button>
                <button
                  type="button"
                  disabled={photoDecoding}
                  onClick={() => photoInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
                >
                  <ImagePlus className="w-3.5 h-3.5 shrink-0 text-red-600" />
                  <span>{photoDecoding ? 'جاري القراءة...' : 'تصوير الكود'}</span>
                </button>
              </div>
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1 min-w-0">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputCode}
                  onChange={e => setInputCode(e.target.value)}
                  placeholder="Ex: FAR-2601-8491 — جاهز للدوشيت..."
                  autoFocus
                  className="w-full px-3.5 py-2.5 sm:px-4 sm:py-3 text-sm font-mono font-bold bg-slate-50 border-2 border-slate-300 rounded-xl focus:bg-white focus:border-red-500 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>
              <button
                type="submit"
                className="px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shrink-0 shadow-xs flex items-center gap-1.5 cursor-pointer"
              >
                <span>تأكيد السكان</span>
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </form>

          {/* Camera error notice */}
          {cameraError && (
            <div className="p-3 text-xs bg-amber-50 text-amber-900 rounded-xl border border-amber-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
              <span>{cameraError}</span>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => photoInputRef.current?.click()}
                  className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg transition cursor-pointer flex items-center gap-1"
                >
                  <ImagePlus className="w-3.5 h-3.5" />
                  <span>تصوير الكود</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCameraError(null);
                    setCameraActive(true);
                    setCameraRetryTick(t => t + 1);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg transition cursor-pointer"
                >
                  إعادة المحاولة
                </button>
              </div>
            </div>
          )}

          {/* Live Camera QR & Barcode Decoder */}
          {cameraActive && (
            <div className="relative w-full rounded-xl overflow-hidden bg-slate-950 border-2 border-red-500/70 shadow-inner">
              <div id={SCANNER_READER_ID} className="w-full min-h-[240px]" />
              {cameraStarting && (
                <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center text-white text-xs gap-2">
                  <div className="w-7 h-7 border-2 border-white/30 border-t-red-500 rounded-full animate-spin" />
                  <span className="font-bold">جاري تشغيل كاميرا السكان...</span>
                </div>
              )}
              <div className="px-3 py-2 bg-slate-900/95 text-white text-[11px] flex items-center justify-between">
                <span className="font-bold text-emerald-400">
                  ● قارئ QR و الباركود مفعّل — الأجونص: {effectiveAgencyName}
                </span>
                <span className="text-slate-400">وجّه الكاميرا للتيكيت</span>
              </div>
            </div>
          )}

          {/* Scan Result Feedback Banner */}
          {lastScannedResult && (
            <div
              className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                lastScannedResult.success
                  ? 'bg-emerald-50 border-emerald-300 text-emerald-950'
                  : 'bg-rose-50 border-rose-300 text-rose-950'
              }`}
            >
              {lastScannedResult.success ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="flex-1 text-xs">
                <p className="font-black text-sm leading-snug">{lastScannedResult.message}</p>
                {lastScannedResult.pkg && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-700">
                    <div>
                      <span className="text-[10px] text-slate-500 block">المستلم / المدينة:</span>
                      <span className="font-bold">
                        {lastScannedResult.pkg.recipientName} ({lastScannedResult.pkg.city})
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">الأجونص الحالية:</span>
                      <span className="inline-flex items-center gap-1 font-extrabold text-emerald-700">
                        <Warehouse className="w-3 h-3" />
                        {lastScannedResult.pkg.currentAgency || lastScannedResult.agencyName}
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block">مبلغ COD:</span>
                      <span className="font-mono font-black text-slate-900">
                        {formatMAD(lastScannedResult.pkg.codAmount)}
                      </span>
                    </div>
                  </div>
                )}
                {lastScannedResult.stockProduct && (
                  <div className="mt-2 pt-2 border-t border-emerald-200 flex items-center gap-3 text-slate-700">
                    {lastScannedResult.stockProduct.photoUrl ? (
                      <img
                        src={lastScannedResult.stockProduct.photoUrl}
                        alt={lastScannedResult.stockProduct.name}
                        className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center shrink-0">
                        <Boxes className="w-6 h-6 text-slate-400" />
                      </div>
                    )}
                    <div className="text-xs space-y-0.5">
                      <div className="font-black text-slate-900">{lastScannedResult.stockProduct.name}</div>
                      <div className="text-[11px] text-slate-600">
                        {lastScannedResult.stockProduct.clientCompany || lastScannedResult.stockProduct.clientName}
                        {lastScannedResult.stockUnit ? ` · ${lastScannedResult.stockUnit.unitCode}` : ''}
                      </div>
                      <div className="text-[11px] font-bold text-emerald-700">
                        متوفر فالسطوك: {lastScannedResult.stockProduct.units.filter(u => u.status === 'en_stock').length} / {lastScannedResult.stockProduct.units.length}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Session Scan Log for the Active Agency */}
          {currentAgencySessionScans.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 overflow-hidden">
              <div className="px-3.5 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between text-xs">
                <span className="font-black text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-red-600" />
                  <span>سجل السكان فهاد الجلسة — {effectiveAgencyName}</span>
                </span>
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-mono font-black text-[11px]">
                  {currentAgencySuccessCount} مسكانية بنجاح
                </span>
              </div>
              <div className="divide-y divide-slate-200/70 max-h-40 overflow-y-auto">
                {currentAgencySessionScans.map(entry => (
                  <div key={entry.id} className="px-3.5 py-2 flex items-center justify-between gap-2 text-xs bg-white">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-black text-slate-900">{entry.trackingNumber}</span>
                        {entry.success ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                            فلاجونص ✓
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                            خطأ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">
                        {entry.recipientName ? `${entry.recipientName} (${entry.city || ''})` : entry.message}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      {typeof entry.codAmount === 'number' && (
                        <span className="font-mono font-bold text-slate-800 block">{formatMAD(entry.codAmount)}</span>
                      )}
                      <span className="text-[10px] font-mono text-slate-400">{entry.scannedAt}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Quick scan chips for pending parcels */}
          {packages.length > 0 && (
            <div className="pt-1">
              <span className="text-[11px] font-bold text-slate-500 block mb-2">
                كوليات جاهزة للسكان السريع بنقرة واحدة نحو «{effectiveAgencyName}» :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {packages
                  .filter(p => !['livre', 'retourne', 'annule'].includes(p.status))
                  .slice(0, 6)
                  .map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => void handleExecuteScan(p.trackingNumber)}
                      className="px-2.5 py-1 text-xs font-mono bg-slate-100 hover:bg-red-50 hover:border-red-300 hover:text-red-700 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                    >
                      {p.trackingNumber} ({p.city})
                    </button>
                  ))}
              </div>
            </div>
          )}
          </div>
        </div>

        {/* Footer */}
        <div className="shrink-0 px-3.5 py-2.5 sm:px-5 sm:py-3 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 text-[11px] sm:text-xs text-slate-500">
          <span className="truncate">متوافق مع الدوشيت (USB / Bluetooth) وكاميرا الهاتف</span>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 px-4 py-2 font-bold text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            إغلاق (Fermer)
          </button>
        </div>
      </div>

      {pendingPartnerDeliverPkg && (() => {
        const matchedPartner = resolvePackagePartner(pendingPartnerDeliverPkg, partners);
        const matchedDriver = pendingPartnerDeliverPkg.driverId
          ? drivers.find(d => d.id === pendingPartnerDeliverPkg.driverId)
          : undefined;
        return (
          <PartnerDeliveryChoiceModal
            isOpen={Boolean(pendingPartnerDeliverPkg)}
            pkg={pendingPartnerDeliverPkg}
            partner={matchedPartner}
            driverFeePerDelivery={Number(matchedDriver?.driverFeePerDelivery ?? 0)}
            isSubmitting={isSavingPartnerDelivery}
            onCancel={() => setPendingPartnerDeliverPkg(null)}
            onConfirm={result => void handleConfirmPartnerDelivery(result)}
          />
        );
      })()}
    </div>
  );
};
