import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { getSettings, saveSettings } from "@/lib/storage";

type Language = "zh" | "en";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (zh: string, en: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>("zh");

  useEffect(() => {
    const s = getSettings();
    if (s.language) setLanguageState(s.language);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    saveSettings({ language: lang });
  };

  const t = (zh: string, en: string) => (language === "zh" ? zh : en);

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextType {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
