import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type Country = 'Botswana' | 'Ghana' | 'Kenya' | 'Nigeria' | null;

interface CountryContextValue {
  country: Country;
  setCountry: (c: Country) => void;
}

const CountryContext = createContext<CountryContextValue>({
  country: null,
  setCountry: () => {},
});

const STORAGE_KEY = 'medisignal.country';

export function CountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<Country>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'Botswana' || stored === 'Ghana' || stored === 'Kenya' || stored === 'Nigeria') return stored;
      return null;
    } catch {
      return null;
    }
  });

  const setCountry = (c: Country) => {
    setCountryState(c);
    try {
      if (c === null) localStorage.removeItem(STORAGE_KEY);
      else localStorage.setItem(STORAGE_KEY, c);
    } catch {}
  };

  return (
    <CountryContext.Provider value={{ country, setCountry }}>
      {children}
    </CountryContext.Provider>
  );
}

export function useCountry() {
  return useContext(CountryContext);
}

