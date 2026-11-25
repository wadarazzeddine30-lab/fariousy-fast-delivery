import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import fr from './fr.json';
import ar from './ar.json';
import en from './en.json';
import { PackageStatus } from '../types';
import { startArabicDomTranslation, stopArabicDomTranslation } from './arabicDomTranslator';
import { translatePhraseToArabic } from './frToArDictionary';

export type Language = 'fr' | 'ar' | 'en';

export interface LanguageOption {
  code: Language;
  name: string;
  flag: string;
  nativeName: string;
}

export const AVAILABLE_LANGUAGES: LanguageOption[] = [
  { code: 'fr', name: 'Français', flag: '🇫🇷', nativeName: 'Français' },
  { code: 'ar', name: 'Arabe', flag: '🇲🇦', nativeName: 'العربية' },
  { code: 'en', name: 'Anglais', flag: '🇬🇧', nativeName: 'English' }
];

const STORAGE_KEY = 'fariousy_language';

type TranslationsDictionary = typeof fr;

const dictionaries: Record<Language, any> = {
  fr,
  ar,
  en
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  t: (key: string, fallback?: string) => string;
  translateStatus: (status: string) => string;
  languages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'fr' || saved === 'ar' || saved === 'en') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'fr';
  });

  const isRtl = language === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';

  // Apply dir & lang to document root and enable full Arabic runtime translation when language === 'ar'
  useEffect(() => {
    try {
      document.documentElement.dir = dir;
      document.documentElement.lang = language;
      localStorage.setItem(STORAGE_KEY, language);
    } catch {
      // ignore
    }

    if (language === 'ar') {
      startArabicDomTranslation(document.body);
      const originalAlert = window.alert.bind(window);
      window.alert = (msg?: any) => {
        const text = msg === undefined || msg === null ? '' : String(msg);
        originalAlert(translatePhraseToArabic(text));
      };
      return () => {
        window.alert = originalAlert;
        stopArabicDomTranslation();
      };
    } else {
      stopArabicDomTranslation();
    }
  }, [language, dir]);

  const setLanguage = (newLang: Language) => {
    setLanguageState(newLang);
  };

  /**
   * Safe dot-notation translator with fallback to FR, then to custom fallback or key.
   * Example: t('sidebar.dashboard') => "Tableau de bord" | "لوحة القيادة" | "Dashboard"
   */
  const t = (path: string, fallback?: string): string => {
    const keys = path.split('.');
    
    // 1. Try current language
    let current: any = dictionaries[language];
    for (const k of keys) {
      if (current && typeof current === 'object' && k in current) {
        current = current[k];
      } else {
        current = undefined;
        break;
      }
    }

    if (typeof current === 'string') {
      return current;
    }

    // 2. Try French default fallback
    let fallbackDict: any = dictionaries.fr;
    for (const k of keys) {
      if (fallbackDict && typeof fallbackDict === 'object' && k in fallbackDict) {
        fallbackDict = fallbackDict[k];
      } else {
        fallbackDict = undefined;
        break;
      }
    }

    if (typeof fallbackDict === 'string') {
      return fallbackDict;
    }

    // 3. Fallback argument or the key path itself
    return fallback || path;
  };

  /**
   * Helper to translate standard PackageStatus
   */
  const translateStatus = (status: string): string => {
    return t(`status.${status}`, status);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        dir,
        isRtl,
        t,
        translateStatus,
        languages: AVAILABLE_LANGUAGES
      }}
    >
      <div dir={dir} className={isRtl ? 'font-arabic' : ''}>
        {children}
      </div>
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
