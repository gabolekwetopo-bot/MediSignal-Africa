import { useEffect, useState } from 'react';
import { supabase } from '../supabase';
import type { ShortageRadarRow, Facility } from '../types';
import { useCountry } from '../context/CountryContext';

export function useShortageRadar() {
  const { country } = useCountry();
  const [data, setData] = useState<ShortageRadarRow[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [radarResult, facilitiesResult] = await Promise.all([
        supabase.rpc('get_shortage_radar', { country_filter: country }),
        country
          ? supabase
              .from('facilities')
              .select('id, name, district, region, country, facility_type, latitude, longitude')
              .eq('country', country)
          : supabase
              .from('facilities')
              .select('id, name, district, region, country, facility_type, latitude, longitude'),
      ]);

      if (cancelled) return;

      if (radarResult.error) {
        setError(radarResult.error.message);
        setData([]);
      } else {
        setData((radarResult.data ?? []) as ShortageRadarRow[]);
      }

      if (!facilitiesResult.error) {
        console.log('[radar] facilities raw:', facilitiesResult.data); console.log('[radar] facilities error:', facilitiesResult.error); console.log('[radar] facilities count:', facilitiesResult.data?.length); setFacilities((facilitiesResult.data ?? []) as Facility[]);
      }

      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [country]);

  return { data, facilities, loading, error };
}

