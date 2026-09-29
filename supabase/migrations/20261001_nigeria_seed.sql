-- ==============================================================================
-- Medisignal Africa - Nigeria Synthetic Seed Data
-- SYNTHETIC DEMONSTRATION DATA - not official Nigerian government records
-- ==============================================================================

-- FACILITIES (60 total): 3 Teaching Hospitals, 8 Federal Medical Centres,
-- 12 State Specialist Hospitals, 22 General Hospitals, 15 Primary Health Centres
INSERT INTO public.facilities (id, name, district, region, country, facility_type, latitude, longitude)
VALUES
  -- Teaching Hospitals (0701-0703)
  ('00000000-0000-0000-0000-000000000701', 'Lagos University Teaching Hospital', 'Lagos', 'South-West', 'Nigeria', 'Teaching Hospital', 6.5244, 3.3792),
  ('00000000-0000-0000-0000-000000000702', 'University College Hospital Ibadan', 'Oyo', 'South-West', 'Nigeria', 'Teaching Hospital', 7.3775, 3.9470),
  ('00000000-0000-0000-0000-000000000703', 'Ahmadu Bello University Teaching Hospital', 'Kaduna', 'North-West', 'Nigeria', 'Teaching Hospital', 10.5222, 7.4383),

  -- Federal Medical Centres (0704-0711)
  ('00000000-0000-0000-0000-000000000704', 'Federal Medical Centre Abuja', 'FCT', 'North-Central', 'Nigeria', 'Federal Medical Centre', 9.0579, 7.4951),
  ('00000000-0000-0000-0000-000000000705', 'Federal Medical Centre Owerri', 'Imo', 'South-East', 'Nigeria', 'Federal Medical Centre', 5.4836, 7.0332),
  ('00000000-0000-0000-0000-000000000706', 'Federal Medical Centre Yola', 'Adamawa', 'North-East', 'Nigeria', 'Federal Medical Centre', 9.2035, 12.4954),
  ('00000000-0000-0000-0000-000000000707', 'Federal Medical Centre Makurdi', 'Benue', 'North-Central', 'Nigeria', 'Federal Medical Centre', 7.7322, 8.5391),
  ('00000000-0000-0000-0000-000000000708', 'Federal Medical Centre Umuahia', 'Abia', 'South-East', 'Nigeria', 'Federal Medical Centre', 5.5250, 7.4938),
  ('00000000-0000-0000-0000-000000000709', 'Federal Medical Centre Abeokuta', 'Ogun', 'South-West', 'Nigeria', 'Federal Medical Centre', 7.1557, 3.3451),
  ('00000000-0000-0000-0000-000000000710', 'Federal Medical Centre Birnin Kebbi', 'Kebbi', 'North-West', 'Nigeria', 'Federal Medical Centre', 12.4539, 4.1975),
  ('00000000-0000-0000-0000-000000000711', 'Federal Medical Centre Keffi', 'Nasarawa', 'North-Central', 'Nigeria', 'Federal Medical Centre', 8.8469, 7.8734),

  -- State Specialist Hospitals (0712-0723)
  ('00000000-0000-0000-0000-000000000712', 'Lagos State General Hospital Ikeja', 'Lagos', 'South-West', 'Nigeria', 'State Hospital', 6.6059, 3.3498),
  ('00000000-0000-0000-0000-000000000713', 'Kano State Specialist Hospital', 'Kano', 'North-West', 'Nigeria', 'State Hospital', 12.0022, 8.5920),
  ('00000000-0000-0000-0000-000000000714', 'Rivers State University Teaching Hospital', 'Rivers', 'South-South', 'Nigeria', 'State Hospital', 4.8156, 7.0498),
  ('00000000-0000-0000-0000-000000000715', 'Edo State Specialist Hospital', 'Edo', 'South-South', 'Nigeria', 'State Hospital', 6.3382, 5.6258),
  ('00000000-0000-0000-0000-000000000716', 'Enugu State University Teaching Hospital', 'Enugu', 'South-East', 'Nigeria', 'State Hospital', 6.4402, 7.4943),
  ('00000000-0000-0000-0000-000000000717', 'Kaduna State Specialist Hospital', 'Kaduna', 'North-West', 'Nigeria', 'State Hospital', 10.5264, 7.4388),
  ('00000000-0000-0000-0000-000000000718', 'Borno State Specialist Hospital', 'Borno', 'North-East', 'Nigeria', 'State Hospital', 11.8311, 13.1510),
  ('00000000-0000-0000-0000-000000000719', 'Plateau State Specialist Hospital', 'Plateau', 'North-Central', 'Nigeria', 'State Hospital', 9.8965, 8.8583),
  ('00000000-0000-0000-0000-000000000720', 'Akwa Ibom State Hospital', 'Akwa Ibom', 'South-South', 'Nigeria', 'State Hospital', 5.0377, 7.9128),
  ('00000000-0000-0000-0000-000000000721', 'Cross River State Hospital', 'Cross River', 'South-South', 'Nigeria', 'State Hospital', 5.9631, 8.3297),
  ('00000000-0000-0000-0000-000000000722', 'Osun State Specialist Hospital', 'Osun', 'South-West', 'Nigeria', 'State Hospital', 7.7667, 4.5667),
  ('00000000-0000-0000-0000-000000000723', 'Delta State Specialist Hospital', 'Delta', 'South-South', 'Nigeria', 'State Hospital', 6.2000, 6.7333),

  -- General Hospitals (0724-0745)
  ('00000000-0000-0000-0000-000000000724', 'General Hospital Lagos Island', 'Lagos', 'South-West', 'Nigeria', 'General Hospital', 6.4541, 3.3958),
  ('00000000-0000-0000-0000-000000000725', 'General Hospital Mushin', 'Lagos', 'South-West', 'Nigeria', 'General Hospital', 6.5236, 3.3491),
  ('00000000-0000-0000-0000-000000000726', 'General Hospital Ikorodu', 'Lagos', 'South-West', 'Nigeria', 'General Hospital', 6.6194, 3.5105),
  ('00000000-0000-0000-0000-000000000727', 'General Hospital Kano', 'Kano', 'North-West', 'Nigeria', 'General Hospital', 12.0022, 8.5167),
  ('00000000-0000-0000-0000-000000000728', 'General Hospital Port Harcourt', 'Rivers', 'South-South', 'Nigeria', 'General Hospital', 4.7774, 7.0134),
  ('00000000-0000-0000-0000-000000000729', 'General Hospital Benin City', 'Edo', 'South-South', 'Nigeria', 'General Hospital', 6.3382, 5.6258),
  ('00000000-0000-0000-0000-000000000730', 'General Hospital Onitsha', 'Anambra', 'South-East', 'Nigeria', 'General Hospital', 6.1417, 6.7884),
  ('00000000-0000-0000-0000-000000000731', 'General Hospital Aba', 'Abia', 'South-East', 'Nigeria', 'General Hospital', 5.1167, 7.3667),
  ('00000000-0000-0000-0000-000000000732', 'General Hospital Jos', 'Plateau', 'North-Central', 'Nigeria', 'General Hospital', 9.8965, 8.8583),
  ('00000000-0000-0000-0000-000000000733', 'General Hospital Ilorin', 'Kwara', 'North-Central', 'Nigeria', 'General Hospital', 8.4966, 4.5421),
  ('00000000-0000-0000-0000-000000000734', 'General Hospital Maiduguri', 'Borno', 'North-East', 'Nigeria', 'General Hospital', 11.8311, 13.1510),
  ('00000000-0000-0000-0000-000000000735', 'General Hospital Sokoto', 'Sokoto', 'North-West', 'Nigeria', 'General Hospital', 13.0059, 5.2476),
  ('00000000-0000-0000-0000-000000000736', 'General Hospital Bauchi', 'Bauchi', 'North-East', 'Nigeria', 'General Hospital', 10.3103, 9.8439),
  ('00000000-0000-0000-0000-000000000737', 'General Hospital Minna', 'Niger', 'North-Central', 'Nigeria', 'General Hospital', 9.6139, 6.5473),
  ('00000000-0000-0000-0000-000000000738', 'General Hospital Lokoja', 'Kogi', 'North-Central', 'Nigeria', 'General Hospital', 7.8023, 6.7333),
  ('00000000-0000-0000-0000-000000000739', 'General Hospital Ado-Ekiti', 'Ekiti', 'South-West', 'Nigeria', 'General Hospital', 7.6211, 5.2214),
  ('00000000-0000-0000-0000-000000000740', 'General Hospital Akure', 'Ondo', 'South-West', 'Nigeria', 'General Hospital', 7.2571, 5.2058),
  ('00000000-0000-0000-0000-000000000741', 'General Hospital Calabar', 'Cross River', 'South-South', 'Nigeria', 'General Hospital', 4.9757, 8.3417),
  ('00000000-0000-0000-0000-000000000742', 'General Hospital Uyo', 'Akwa Ibom', 'South-South', 'Nigeria', 'General Hospital', 5.0377, 7.9128),
  ('00000000-0000-0000-0000-000000000743', 'General Hospital Warri', 'Delta', 'South-South', 'Nigeria', 'General Hospital', 5.5167, 5.7500),
  ('00000000-0000-0000-0000-000000000744', 'General Hospital Owerri', 'Imo', 'South-East', 'Nigeria', 'General Hospital', 5.4836, 7.0332),
  ('00000000-0000-0000-0000-000000000745', 'General Hospital Gombe', 'Gombe', 'North-East', 'Nigeria', 'General Hospital', 10.2897, 11.1673),

  -- Primary Health Centres (0746-0760)
  ('00000000-0000-0000-0000-000000000746', 'Ikeja PHC', 'Lagos', 'South-West', 'Nigeria', 'Primary Health Centre', 6.6059, 3.3498),
  ('00000000-0000-0000-0000-000000000747', 'Surulere PHC', 'Lagos', 'South-West', 'Nigeria', 'Primary Health Centre', 6.5000, 3.3500),
  ('00000000-0000-0000-0000-000000000748', 'Yaba PHC', 'Lagos', 'South-West', 'Nigeria', 'Primary Health Centre', 6.5095, 3.3711),
  ('00000000-0000-0000-0000-000000000749', 'Nassarawa PHC Kano', 'Kano', 'North-West', 'Nigeria', 'Primary Health Centre', 12.0000, 8.5167),
  ('00000000-0000-0000-0000-000000000750', 'Sabon Gari PHC', 'Kano', 'North-West', 'Nigeria', 'Primary Health Centre', 12.0100, 8.5300),
  ('00000000-0000-0000-0000-000000000751', 'Diobu PHC', 'Rivers', 'South-South', 'Nigeria', 'Primary Health Centre', 4.7900, 6.9900),
  ('00000000-0000-0000-0000-000000000752', 'GRA PHC Benin', 'Edo', 'South-South', 'Nigeria', 'Primary Health Centre', 6.3400, 5.6300),
  ('00000000-0000-0000-0000-000000000753', 'Nsukka PHC', 'Enugu', 'South-East', 'Nigeria', 'Primary Health Centre', 6.8567, 7.3958),
  ('00000000-0000-0000-0000-000000000754', 'Kaduna South PHC', 'Kaduna', 'North-West', 'Nigeria', 'Primary Health Centre', 10.5167, 7.4333),
  ('00000000-0000-0000-0000-000000000755', 'Jos North PHC', 'Plateau', 'North-Central', 'Nigeria', 'Primary Health Centre', 9.9167, 8.8833),
  ('00000000-0000-0000-0000-000000000756', 'Ilorin East PHC', 'Kwara', 'North-Central', 'Nigeria', 'Primary Health Centre', 8.5000, 4.5500),
  ('00000000-0000-0000-0000-000000000757', 'Maiduguri PHC', 'Borno', 'North-East', 'Nigeria', 'Primary Health Centre', 11.8400, 13.1400),
  ('00000000-0000-0000-0000-000000000758', 'Sokoto South PHC', 'Sokoto', 'North-West', 'Nigeria', 'Primary Health Centre', 13.0000, 5.2400),
  ('00000000-0000-0000-0000-000000000759', 'Uyo PHC', 'Akwa Ibom', 'South-South', 'Nigeria', 'Primary Health Centre', 5.0400, 7.9200),
  ('00000000-0000-0000-0000-000000000760', 'Ado Ekiti PHC', 'Ekiti', 'South-West', 'Nigeria', 'Primary Health Centre', 7.6200, 5.2200)
ON CONFLICT (id) DO NOTHING;

-- Verification
SELECT 'Nigeria facilities' AS entity, count(*) FROM public.facilities WHERE country = 'Nigeria';
