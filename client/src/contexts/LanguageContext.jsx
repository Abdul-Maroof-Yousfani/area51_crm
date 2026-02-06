import React, { createContext, useContext, useState, useCallback } from 'react';
import en from '../locales/en.json';
import ur from '../locales/ur.json';

const translations = { en, ur };

const LanguageContext = createContext();

export function LanguageProvider({ children }) {
  const [language, setLanguage] = useState('en'); // Default to English

  const toggleLanguage = useCallback(() => {
    setLanguage((prev) => (prev === 'ur' ? 'en' : 'ur'));
  }, []);

  const t = useCallback(
    (key) => {
      return translations[language][key] || key;
    },
    [language]
  );

  const isRTL = language === 'ur';

  return (
    <LanguageContext.Provider value={{ language, toggleLanguage, t, isRTL }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
