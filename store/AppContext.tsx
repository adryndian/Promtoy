import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { FormData, GeneratedAsset } from '../types';

interface AppContextType {
  // User & Auth
  user: any | null;
  setUser: (user: any | null) => void;
  
  // UI State
  darkMode: boolean;
  toggleDarkMode: () => void;
  notification: string | null;
  showNotification: (msg: string) => void;
  
  // Generation State
  loading: boolean;
  setLoading: (status: boolean) => void;
  loadingStage: 'idle' | 'analyzing' | 'drafting' | 'finalizing';
  setLoadingStage: (stage: 'idle' | 'analyzing' | 'drafting' | 'finalizing') => void;
  result: GeneratedAsset | null;
  setResult: (result: GeneratedAsset | null) => void;
  formDataState: FormData | null;
  setFormDataState: (data: FormData | null) => void;
  
  // Settings
  activeProvider: string;
  setActiveProvider: (provider: string) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<any>(null);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('theme') === 'dark' || 
        (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
    }
    return false;
  });
  const [notification, setNotification] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'idle' | 'analyzing' | 'drafting' | 'finalizing'>('idle');
  const [result, setResult] = useState<GeneratedAsset | null>(null);
  const [formDataState, setFormDataState] = useState<FormData | null>(null);
  const [activeProvider, setActiveProvider] = useState<string>('gemini');

  // Load User Session pada saat pertama kali dimuat
  useEffect(() => {
    const storedUser = localStorage.getItem('ugc_user');
    if (storedUser) {
        setUser(JSON.parse(storedUser));
    }
  }, []);

  // Handle Dark Mode secara global
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  const toggleDarkMode = () => setDarkMode(!darkMode);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  return (
    <AppContext.Provider value={{
      user, setUser,
      darkMode, toggleDarkMode,
      notification, showNotification,
      loading, setLoading,
      loadingStage, setLoadingStage,
      result, setResult,
      formDataState, setFormDataState,
      activeProvider, setActiveProvider
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};