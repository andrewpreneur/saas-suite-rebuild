import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useUser } from '@/contexts/UserContext';
import { translations, type SupportedLanguage, type TranslationStrings } from '@/translations';

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: TranslationStrings;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { actualEmail, user } = useUser();
  const email = actualEmail?.trim().toLowerCase();
  const [language, setLanguageState] = useState<SupportedLanguage>('en');

  // Load language preference from Supabase
  useEffect(() => {
    let active = true;
    setLanguageState('en');
    if (!email) return;
    
    const loadLanguage = async () => {
      const { data } = await supabase
        .from('saas_suite_users')
        .select('language')
        .ilike('email', email)
        .maybeSingle();
      
      const saved = data?.language ?? user?.user_metadata?.language;
      if (active && typeof saved === 'string' && saved in translations) {
        setLanguageState(saved as SupportedLanguage);
      }
    };
    
    void loadLanguage();
    return () => { active = false; };
  }, [email, user?.id]);

  const setLanguage = async (lang: SupportedLanguage) => {
    if (!email) throw new Error('Please sign in to save your language.');
    if (!(lang in translations)) throw new Error('Unsupported language.');
    const { data, error } = await supabase
        .from('saas_suite_users')
        .update({ language: lang } as any)
        .eq('email', email)
        .select('language');
    if (error) throw error;
    // Team admins have no personal agency row; save their own preference in Auth.
    if (!data?.length) {
      const { error: authError } = await supabase.auth.updateUser({ data: { language: lang } });
      if (authError) throw authError;
    }
    setLanguageState(lang);
  };

  const t = translations[language] || translations.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
