import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type MobileLanguage = 'en' | 'si' | 'ta';

const STORAGE_KEY = 'app_language';

let currentLanguage: MobileLanguage = 'en';
let isLoaded = false;
const listeners = new Set<(lang: MobileLanguage) => void>();

function notifyAll() {
  listeners.forEach((listener) => listener(currentLanguage));
}

export function getCurrentLanguage(): MobileLanguage {
  return currentLanguage;
}

export async function loadLanguageFromStorage(): Promise<MobileLanguage> {
  if (isLoaded) return currentLanguage;
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'si' || stored === 'ta') {
    currentLanguage = stored;
  }
  isLoaded = true;
  return currentLanguage;
}

export async function setCurrentLanguage(next: MobileLanguage): Promise<void> {
  currentLanguage = next;
  await AsyncStorage.setItem(STORAGE_KEY, next);
  notifyAll();
}

export function subscribeLanguage(listener: (lang: MobileLanguage) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAppLanguage() {
  const [language, setLanguage] = useState<MobileLanguage>(getCurrentLanguage());

  useEffect(() => {
    let mounted = true;
    void loadLanguageFromStorage().then((loaded) => {
      if (mounted) setLanguage(loaded);
    });
    const unsub = subscribeLanguage((lang) => {
      if (mounted) setLanguage(lang);
    });
    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  return { language, setLanguage: setCurrentLanguage };
}
