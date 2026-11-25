import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { PWAInstallModal } from './PWAInstallModal';
import { DriverRegisterModal } from '../auth/DriverRegisterModal';
import { getRememberMePreference } from '../../services/supabase';
import {
  Bike,
  Lock,
  Phone,
  Eye,
  EyeOff,
  LogIn,
  Smartphone,
  AlertCircle,
  Loader2,
  QrCode,
  ShieldCheck,
  UserPlus,
  Globe
} from 'lucide-react';

interface DriverApkLoginProps {
  onExitDriverMode?: () => void;
}

export const DriverApkLogin: React.FC<DriverApkLoginProps> = ({ onExitDriverMode }) => {
  const { login } = useAuth();
  const { isInstalled } = usePWAInstall();

  const [identifier, setIdentifier] = useState(() => {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem('fariousy_remembered_identifier') || '' : '';
    } catch {
      return '';
    }
  });
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState<boolean>(() => getRememberMePreference() ?? true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [showDriverRegister, setShowDriverRegister] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!identifier.trim() || !password) {
      setError('أدخل رقم الهاتف أو البريد الإلكتروني وكلمة المرور.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await login(identifier.trim(), password, rememberMe);
      if (!res.success) {
        setError(res.error || 'بيانات الدخول غير صحيحة.');
      }
    } catch (err: any) {
      setError(err?.message || 'تعذر الاتصال بالسيرفر.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-4 sm:p-6 select-none"
    >
      {/* Top Bar */}
      <div className="max-w-md w-full mx-auto flex items-center justify-between pt-1">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl bg-white p-1 shadow-md border border-slate-800">
            <img
              src="/pwa-192x192.png"
              alt="FARIOUSY Driver"
              className="w-full h-full object-contain rounded-lg"
            />
          </div>
          <div>
            <span className="text-sm font-black tracking-tight text-white block">FARIOUSY Driver</span>
            <span className="text-[10px] font-bold text-emerald-400">تطبيق الموزع الرسمي</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isInstalled && (
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow-md cursor-pointer"
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>تثبيت APK</span>
            </button>
          )}
          {onExitDriverMode && (
            <button
              type="button"
              onClick={onExitDriverMode}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 rounded-xl text-[11px] font-bold flex items-center gap-1 cursor-pointer"
              title="الموقع الرئيسي"
            >
              <Globe className="w-3.5 h-3.5" />
              <span>الموقع</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Login Card */}
      <div className="max-w-md w-full mx-auto my-6 bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-5">
        <div className="text-center space-y-2">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-red-600 to-rose-700 mx-auto flex items-center justify-center shadow-lg shadow-red-950/60">
            <Bike className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-black text-white">دخول الموزع (Livreur)</h1>
          <p className="text-xs text-slate-400">
            سجل الدخول لبدء جولتك، مسح الباركود، وتحصيل الطرود
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 text-slate-300">
            <QrCode className="w-4 h-4 text-red-400 shrink-0" />
            <span className="font-bold">سكانير التيكي السريع</span>
          </div>
          <div className="bg-slate-950/70 border border-slate-800 rounded-xl p-2.5 flex items-center gap-2 text-slate-300">
            <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
            <span className="font-bold">متابعة الصندوق مباشرة</span>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-950/70 border border-rose-700/60 rounded-2xl flex items-start gap-2 text-xs text-rose-200 font-bold">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">
              رقم الهاتف أو البريد الإلكتروني
            </label>
            <div className="relative">
              <Phone className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              <input
                type="text"
                autoComplete="username"
                placeholder="06xxxxxxxx أو email@fariousy.com"
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                dir="ltr"
                className="w-full pr-10 pl-3.5 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 block">كلمة المرور</label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-500 absolute right-3.5 top-3.5" />
              <input
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                dir="ltr"
                className="w-full pr-10 pl-10 py-3 bg-slate-950 border border-slate-800 rounded-2xl text-sm text-white placeholder-slate-500 focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                className="absolute left-3 top-3 text-slate-400 hover:text-white cursor-pointer"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={e => setRememberMe(e.target.checked)}
              className="rounded border-slate-700 bg-slate-950 text-red-600 focus:ring-red-500"
            />
            <span>تذكر حسابي في هذا الهاتف</span>
          </label>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 disabled:opacity-60 text-white rounded-2xl text-sm font-black flex items-center justify-center gap-2 shadow-xl shadow-red-950/60 cursor-pointer transition"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري تسجيل الدخول...</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>دخول لتطبيق الموزع</span>
              </>
            )}
          </button>
        </form>

        <div className="pt-3 border-t border-slate-800 flex items-center justify-between gap-2 text-xs">
          <button
            type="button"
            onClick={() => setShowDriverRegister(true)}
            className="text-red-400 hover:text-red-300 font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>تسجيل كموزع جديد</span>
          </button>

          {!isInstalled && (
            <button
              type="button"
              onClick={() => setShowInstallModal(true)}
              className="text-slate-400 hover:text-white font-bold underline cursor-pointer"
            >
              طريقة التثبيت APK
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="max-w-md w-full mx-auto text-center text-[11px] text-slate-500 pb-2">
        FARIOUSY DELIVERY SARL — تطبيق الموزعين v2.5
      </div>

      <PWAInstallModal isOpen={showInstallModal} onClose={() => setShowInstallModal(false)} />
      <DriverRegisterModal isOpen={showDriverRegister} onClose={() => setShowDriverRegister(false)} />
    </div>
  );
};
