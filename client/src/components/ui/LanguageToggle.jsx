import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { Languages } from 'lucide-react';

export default function LanguageToggle({ compact = false }) {
  const { language, toggleLanguage } = useLanguage();

  const isUrdu = language === 'ur';

  if (compact) {
    // Compact version for mobile
    return (
      <button
        onClick={toggleLanguage}
        className="p-2 hover:bg-gray-100 rounded-lg transition-colors flex items-center gap-1"
        title={isUrdu ? 'Switch to English' : 'اردو میں بدلیں'}
      >
        <Languages className="w-5 h-5 text-gray-600" />
        <span className="text-xs font-bold text-gray-600">
          {isUrdu ? 'EN' : 'UR'}
        </span>
      </button>
    );
  }

  // Full toggle with sliding indicator
  return (
    <button
      onClick={toggleLanguage}
      className="flex items-center gap-2 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-full transition-all"
      title={isUrdu ? 'Switch to English' : 'اردو میں بدلیں'}
    >
      <div className="relative flex items-center bg-white rounded-full p-0.5 shadow-inner">
        {/* Sliding indicator */}
        <div
          className={`absolute h-6 w-8 bg-blue-500 rounded-full transition-transform duration-200 ${
            isUrdu ? 'translate-x-8' : 'translate-x-0'
          }`}
        />

        {/* EN Option */}
        <span
          className={`relative z-10 px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
            !isUrdu ? 'text-white' : 'text-gray-500'
          }`}
        >
          EN
        </span>

        {/* UR Option */}
        <span
          className={`relative z-10 px-2 py-0.5 text-xs font-bold rounded-full transition-colors ${
            isUrdu ? 'text-white' : 'text-gray-500'
          }`}
          style={{ fontFamily: 'Noto Nastaliq Urdu, serif' }}
        >
          اردو
        </span>
      </div>
    </button>
  );
}
