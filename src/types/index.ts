export type RiskLevel = 'Critical' | 'High' | 'Medium' | 'Low' | 'Insufficient Data';

export interface ShortageRadarRow {
  facility_id: string;
  facility_name: string;
  district: string;
  region: string;
  country: string;
  facility_type: string;
  medicine_id: string;
  medicine_name: string;
  medicine_category: string;
  unit: string;
  current_stock: number;
  avg_monthly_consumption: number;
  days_of_stock: number | null;
  projected_stockout_date: string | null;
  risk_level: RiskLevel;
  data_quality: string;
}

export interface Facility {
  id: string;
  name: string;
  district: string;
  region: string;
  country: string;
  facility_type: string;
  latitude: number | null;
  longitude: number | null;
}
