-- ==============================================================================
-- Medisignal Africa - Ghana Synthetic Seed Data
-- SYNTHETIC DEMONSTRATION DATA - not official Ghanaian government records
-- ==============================================================================

INSERT INTO public.facilities (id, name, district, region, country, facility_type, latitude, longitude)
VALUES
  -- Teaching Hospitals (0801-0803)
  ('00000000-0000-0000-0000-000000000801', 'Korle Bu Teaching Hospital', 'Accra', 'Greater Accra', 'Ghana', 'Teaching Hospital', 5.5500, -0.2260),
  ('00000000-0000-0000-0000-000000000802', 'Komfo Anokye Teaching Hospital', 'Kumasi', 'Ashanti', 'Ghana', 'Teaching Hospital', 6.7000, -1.6167),
  ('00000000-0000-0000-0000-000000000803', 'Tamale Teaching Hospital', 'Tamale', 'Northern', 'Ghana', 'Teaching Hospital', 9.4009, -0.8393),

  -- Regional Hospitals (0804-0813)
  ('00000000-0000-0000-0000-000000000804', 'Ridge Hospital', 'Accra', 'Greater Accra', 'Ghana', 'Regional Hospital', 5.5670, -0.1980),
  ('00000000-0000-0000-0000-000000000805', 'Effia Nkwanta Regional Hospital', 'Sekondi-Takoradi', 'Western', 'Ghana', 'Regional Hospital', 4.9333, -1.7000),
  ('00000000-0000-0000-0000-000000000806', 'Cape Coast Teaching Hospital', 'Cape Coast', 'Central', 'Ghana', 'Regional Hospital', 5.1054, -1.2466),
  ('00000000-0000-0000-0000-000000000807', 'Ho Teaching Hospital', 'Ho', 'Volta', 'Ghana', 'Regional Hospital', 6.6008, 0.4713),
  ('00000000-0000-0000-0000-000000000808', 'Koforidua Regional Hospital', 'Koforidua', 'Eastern', 'Ghana', 'Regional Hospital', 6.0833, -0.2500),
  ('00000000-0000-0000-0000-000000000809', 'Sunyani Regional Hospital', 'Sunyani', 'Bono', 'Ghana', 'Regional Hospital', 7.3392, -2.3268),
  ('00000000-0000-0000-0000-000000000810', 'Bolgatanga Regional Hospital', 'Bolgatanga', 'Upper East', 'Ghana', 'Regional Hospital', 10.7856, -0.8514),
  ('00000000-0000-0000-0000-000000000811', 'Wa Regional Hospital', 'Wa', 'Upper West', 'Ghana', 'Regional Hospital', 10.0601, -2.5099),
  ('00000000-0000-0000-0000-000000000812', 'Tema General Hospital', 'Tema', 'Greater Accra', 'Ghana', 'Regional Hospital', 5.6667, -0.0167),
  ('00000000-0000-0000-0000-000000000813', 'Techiman Holy Family Hospital', 'Techiman', 'Bono East', 'Ghana', 'Regional Hospital', 7.5833, -1.9333),

  -- District Hospitals (0814-0830)
  ('00000000-0000-0000-0000-000000000814', 'Kaneshie Polyclinic', 'Accra', 'Greater Accra', 'Ghana', 'District Hospital', 5.5667, -0.2333),
  ('00000000-0000-0000-0000-000000000815', 'La General Hospital', 'Accra', 'Greater Accra', 'Ghana', 'District Hospital', 5.5667, -0.1667),
  ('00000000-0000-0000-0000-000000000816', 'Mamprobi Polyclinic', 'Accra', 'Greater Accra', 'Ghana', 'District Hospital', 5.5333, -0.2500),
  ('00000000-0000-0000-0000-000000000817', 'Suntreso Government Hospital', 'Kumasi', 'Ashanti', 'Ghana', 'District Hospital', 6.7000, -1.6333),
  ('00000000-0000-0000-0000-000000000818', 'Manhyia Government Hospital', 'Kumasi', 'Ashanti', 'Ghana', 'District Hospital', 6.7000, -1.6000),
  ('00000000-0000-0000-0000-000000000819', 'Tafo Government Hospital', 'Kumasi', 'Ashanti', 'Ghana', 'District Hospital', 6.7167, -1.6167),
  ('00000000-0000-0000-0000-000000000820', 'Atonsu Agogo Hospital', 'Kumasi', 'Ashanti', 'Ghana', 'District Hospital', 6.6667, -1.6000),
  ('00000000-0000-0000-0000-000000000821', 'Tarkwa Municipal Hospital', 'Tarkwa', 'Western', 'Ghana', 'District Hospital', 5.3000, -1.9833),
  ('00000000-0000-0000-0000-000000000822', 'Winneba Government Hospital', 'Winneba', 'Central', 'Ghana', 'District Hospital', 5.3500, -0.6333),
  ('00000000-0000-0000-0000-000000000823', 'Keta Municipal Hospital', 'Keta', 'Volta', 'Ghana', 'District Hospital', 5.9167, 0.9833),
  ('00000000-0000-0000-0000-000000000824', 'Hohoe Municipal Hospital', 'Hohoe', 'Volta', 'Ghana', 'District Hospital', 7.1500, 0.4667),
  ('00000000-0000-0000-0000-000000000825', 'Nkawkaw Government Hospital', 'Nkawkaw', 'Eastern', 'Ghana', 'District Hospital', 6.5500, -0.7667),
  ('00000000-0000-0000-0000-000000000826', 'Berekum Holy Family Hospital', 'Berekum', 'Bono', 'Ghana', 'District Hospital', 7.4500, -2.5833),
  ('00000000-0000-0000-0000-000000000827', 'Navrongo War Memorial Hospital', 'Navrongo', 'Upper East', 'Ghana', 'District Hospital', 10.8833, -1.0833),
  ('00000000-0000-0000-0000-000000000828', 'Lawra District Hospital', 'Lawra', 'Upper West', 'Ghana', 'District Hospital', 10.6333, -2.8833),
  ('00000000-0000-0000-0000-000000000829', 'Yendi Municipal Hospital', 'Yendi', 'Northern', 'Ghana', 'District Hospital', 9.4333, -0.0167),
  ('00000000-0000-0000-0000-000000000830', 'Salaga Government Hospital', 'Salaga', 'Savannah', 'Ghana', 'District Hospital', 8.5500, -0.5167),

  -- Polyclinics / PHCs (0831-0840)
  ('00000000-0000-0000-0000-000000000831', 'Adabraka Polyclinic', 'Accra', 'Greater Accra', 'Ghana', 'Polyclinic', 5.5500, -0.2000),
  ('00000000-0000-0000-0000-000000000832', 'Kaneshie Health Centre', 'Accra', 'Greater Accra', 'Ghana', 'Health Centre', 5.5667, -0.2333),
  ('00000000-0000-0000-0000-000000000833', 'Ashaiman Polyclinic', 'Ashaiman', 'Greater Accra', 'Ghana', 'Polyclinic', 5.7000, -0.0333),
  ('00000000-0000-0000-0000-000000000834', 'Madina Polyclinic', 'Accra', 'Greater Accra', 'Ghana', 'Polyclinic', 5.6833, -0.1667),
  ('00000000-0000-0000-0000-000000000835', 'Bantama Health Centre', 'Kumasi', 'Ashanti', 'Ghana', 'Health Centre', 6.7000, -1.6333),
  ('00000000-0000-0000-0000-000000000836', 'Asokwa Health Centre', 'Kumasi', 'Ashanti', 'Ghana', 'Health Centre', 6.6667, -1.6000),
  ('00000000-0000-0000-0000-000000000837', 'Takoradi Polyclinic', 'Sekondi-Takoradi', 'Western', 'Ghana', 'Polyclinic', 4.9000, -1.7500),
  ('00000000-0000-0000-0000-000000000838', 'Koforidua Central Health Centre', 'Koforidua', 'Eastern', 'Ghana', 'Health Centre', 6.0833, -0.2500),
  ('00000000-0000-0000-0000-000000000839', 'Tamale Central Health Centre', 'Tamale', 'Northern', 'Ghana', 'Health Centre', 9.4009, -0.8393),
  ('00000000-0000-0000-0000-000000000840', 'Bolgatanga Health Centre', 'Bolgatanga', 'Upper East', 'Ghana', 'Health Centre', 10.7856, -0.8514)
ON CONFLICT (id) DO NOTHING;

SELECT 'Ghana facilities' AS entity, count(*) FROM public.facilities WHERE country = 'Ghana';
