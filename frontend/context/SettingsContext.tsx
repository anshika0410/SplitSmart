import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTheme } from '../theme';

interface SettingsContextType {
  isDarkMode: boolean;
  setIsDarkMode: (val: boolean) => void;
  pushEnabled: boolean;
  setPushEnabled: (val: boolean) => void;
  appLockEnabled: boolean;
  setAppLockEnabled: (val: boolean) => void;
  currency: string;
  setCurrency: (val: string) => void;
  currencySymbol: string;
  theme: any;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [pushEnabled, setPushEnabled] = useState(true);
  const [appLockEnabled, setAppLockEnabled] = useState(false);
  const [currency, setCurrency] = useState('INR (₹)');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from AsyncStorage on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const storedCurrency = await AsyncStorage.getItem('@settings_currency');
        const storedDarkMode = await AsyncStorage.getItem('@settings_dark_mode');
        const storedPush = await AsyncStorage.getItem('@settings_push');
        const storedAppLock = await AsyncStorage.getItem('@settings_app_lock');

        if (storedCurrency) setCurrency(storedCurrency);
        if (storedDarkMode !== null) setIsDarkMode(storedDarkMode === 'true');
        if (storedPush !== null) setPushEnabled(storedPush === 'true');
        if (storedAppLock !== null) setAppLockEnabled(storedAppLock === 'true');
      } catch (e) {
        console.error('Failed to load settings', e);
      } finally {
        setIsLoaded(true);
      }
    };
    loadSettings();
  }, []);

  // Save to AsyncStorage on change
  useEffect(() => {
    if (!isLoaded) return;
    const saveSettings = async () => {
      try {
        await AsyncStorage.setItem('@settings_currency', currency);
        await AsyncStorage.setItem('@settings_dark_mode', String(isDarkMode));
        await AsyncStorage.setItem('@settings_push', String(pushEnabled));
        await AsyncStorage.setItem('@settings_app_lock', String(appLockEnabled));
      } catch (e) {
        console.error('Failed to save settings', e);
      }
    };
    saveSettings();
  }, [currency, isDarkMode, pushEnabled, appLockEnabled, isLoaded]);

  const currencySymbol = currency.match(/\((.*?)\)/)?.[1] || '₹';
  const theme = getTheme(isDarkMode);

  return (
    <SettingsContext.Provider 
      value={{ 
        isDarkMode, setIsDarkMode, 
        pushEnabled, setPushEnabled, 
        appLockEnabled, setAppLockEnabled, 
        currency, setCurrency,
        currencySymbol,
        theme
      }}
    >
      {isLoaded ? children : null}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
