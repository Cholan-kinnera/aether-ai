/**
 * AETHER Environmental Standards & Reference Constants
 * 
 * IMPORTANT ARCHITECTURAL RULE:
 * EPA AQI calculations and WHO 2021 Air Quality Guidelines are structurally distinct:
 * - US EPA AQI is an indexed metric (0 - 500 scale) with piecewise linear pollutant breakpoints.
 * - WHO 2021 Guidelines are absolute concentration thresholds (µg/m³) based on epidemiological hazard data.
 * These metrics MUST NOT be conflated in data models or user presentations.
 */

// ============================================================================
// 1. US EPA AQI BREAKPOINTS (40 CFR Part 58, Appendix G)
// ============================================================================

export interface AQIBreakpoint {
  category: 'Good' | 'Moderate' | 'Unhealthy for Sensitive Groups' | 'Unhealthy' | 'Very Unhealthy' | 'Hazardous';
  aqiLow: number;
  aqiHigh: number;
  // Concentration ranges (µg/m³ for particulate, ppb/ppm for gases)
  pm25Low: number;
  pm25High: number;
  pm10Low: number;
  pm10High: number;
  no2LowPpb: number;
  no2HighPpb: number;
  o3Low8hPpb: number;
  o3High8hPpb: number;
  so2Low1hPpb: number;
  so2High1hPpb: number;
  coLowPpm: number;
  coHighPpm: number;
  // Accessible dual-encoding parameters
  colorHex: string;
  badgeLabel: string;
  iconName: string;
  healthAdvisory: string;
}

export const EPA_AQI_BREAKPOINTS: ReadonlyArray<AQIBreakpoint> = [
  {
    category: 'Good',
    aqiLow: 0,
    aqiHigh: 50,
    pm25Low: 0.0,
    pm25High: 9.0, // Updated 2024 revised standard (9.0 µg/m³)
    pm10Low: 0,
    pm10High: 54,
    no2LowPpb: 0,
    no2HighPpb: 53,
    o3Low8hPpb: 0,
    o3High8hPpb: 54,
    so2Low1hPpb: 0,
    so2High1hPpb: 35,
    coLowPpm: 0.0,
    coHighPpm: 4.4,
    colorHex: '#10B981', // Accessible Green (passes WCAG 2.1 AA)
    badgeLabel: 'Good',
    iconName: 'ShieldCheck',
    healthAdvisory: 'Air quality is satisfactory and poses little or no health risk.',
  },
  {
    category: 'Moderate',
    aqiLow: 51,
    aqiHigh: 100,
    pm25Low: 9.1,
    pm25High: 35.4,
    pm10Low: 55,
    pm10High: 154,
    no2LowPpb: 54,
    no2HighPpb: 100,
    o3Low8hPpb: 55,
    o3High8hPpb: 70,
    so2Low1hPpb: 36,
    so2High1hPpb: 75,
    coLowPpm: 4.5,
    coHighPpm: 9.4,
    colorHex: '#F59E0B', // Accessible Amber
    badgeLabel: 'Moderate',
    iconName: 'AlertCircle',
    healthAdvisory: 'Air quality is acceptable; unusually sensitive individuals may experience mild symptoms.',
  },
  {
    category: 'Unhealthy for Sensitive Groups',
    aqiLow: 101,
    aqiHigh: 150,
    pm25Low: 35.5,
    pm25High: 55.4,
    pm10Low: 155,
    pm10High: 254,
    no2LowPpb: 101,
    no2HighPpb: 360,
    o3Low8hPpb: 71,
    o3High8hPpb: 85,
    so2Low1hPpb: 76,
    so2High1hPpb: 185,
    coLowPpm: 9.5,
    coHighPpm: 12.4,
    colorHex: '#F97316', // Accessible Orange
    badgeLabel: 'USG',
    iconName: 'AlertTriangle',
    healthAdvisory: 'Children, the elderly, and people with respiratory or cardiovascular disease should reduce prolonged outdoor exertion.',
  },
  {
    category: 'Unhealthy',
    aqiLow: 151,
    aqiHigh: 200,
    pm25Low: 55.5,
    pm25High: 125.4,
    pm10Low: 255,
    pm10High: 354,
    no2LowPpb: 361,
    no2HighPpb: 649,
    o3Low8hPpb: 86,
    o3High8hPpb: 105,
    so2Low1hPpb: 186,
    so2High1hPpb: 304,
    coLowPpm: 12.5,
    coHighPpm: 15.4,
    colorHex: '#EF4444', // Accessible Red
    badgeLabel: 'Unhealthy',
    iconName: 'ShieldAlert',
    healthAdvisory: 'Everyone may begin to experience health effects; members of sensitive groups may experience more serious health effects.',
  },
  {
    category: 'Very Unhealthy',
    aqiLow: 201,
    aqiHigh: 300,
    pm25Low: 125.5,
    pm25High: 225.4,
    pm10Low: 355,
    pm10High: 424,
    no2LowPpb: 650,
    no2HighPpb: 1249,
    o3Low8hPpb: 106,
    o3High8hPpb: 200,
    so2Low1hPpb: 305,
    so2High1hPpb: 604,
    coLowPpm: 15.5,
    coHighPpm: 30.4,
    colorHex: '#8B5CF6', // Accessible Purple
    badgeLabel: 'Very Unhealthy',
    iconName: 'AlertOctagon',
    healthAdvisory: 'Health alert: The risk of health effects is increased for everyone.',
  },
  {
    category: 'Hazardous',
    aqiLow: 301,
    aqiHigh: 500,
    pm25Low: 225.5,
    pm25High: 500.0,
    pm10Low: 425,
    pm10High: 604,
    no2LowPpb: 1250,
    no2HighPpb: 2049,
    o3Low8hPpb: 201,
    o3High8hPpb: 600,
    so2Low1hPpb: 605,
    so2High1hPpb: 1004,
    coLowPpm: 30.5,
    coHighPpm: 50.4,
    colorHex: '#881337', // Accessible Maroon
    badgeLabel: 'Hazardous',
    iconName: 'Skull',
    healthAdvisory: 'Health warning of emergency conditions: Everyone is more likely to be affected.',
  },
];

// ============================================================================
// 2. WHO 2021 GLOBAL AIR QUALITY GUIDELINES (AQGs)
// ============================================================================

export interface WHOGuidelineTarget {
  pollutant: string;
  averagingTime: '24-hour' | 'Annual' | 'Peak-season';
  aqgLevel: number; // In µg/m³, except CO in mg/m³
  unit: string;
  interimTarget1: number;
  interimTarget2: number;
  interimTarget3: number;
  interimTarget4?: number;
}

export const WHO_2021_GUIDELINES: Record<string, WHOGuidelineTarget> = {
  pm25_annual: {
    pollutant: 'PM2.5',
    averagingTime: 'Annual',
    aqgLevel: 5,
    unit: 'µg/m³',
    interimTarget1: 35,
    interimTarget2: 25,
    interimTarget3: 15,
    interimTarget4: 10,
  },
  pm25_24h: {
    pollutant: 'PM2.5',
    averagingTime: '24-hour',
    aqgLevel: 15,
    unit: 'µg/m³',
    interimTarget1: 75,
    interimTarget2: 50,
    interimTarget3: 37.5,
    interimTarget4: 25,
  },
  pm10_24h: {
    pollutant: 'PM10',
    averagingTime: '24-hour',
    aqgLevel: 45,
    unit: 'µg/m³',
    interimTarget1: 150,
    interimTarget2: 100,
    interimTarget3: 75,
    interimTarget4: 50,
  },
  no2_24h: {
    pollutant: 'NO2',
    averagingTime: '24-hour',
    aqgLevel: 25,
    unit: 'µg/m³',
    interimTarget1: 120,
    interimTarget2: 50,
    interimTarget3: 25,
  },
  o3_peak: {
    pollutant: 'Ozone (O3)',
    averagingTime: 'Peak-season',
    aqgLevel: 60,
    unit: 'µg/m³',
    interimTarget1: 100,
    interimTarget2: 70,
    interimTarget3: 60,
  },
};

// ============================================================================
// 3. HUMAN RESPIRATION RATES & EXPOSURE CONSTANTS (EPA Exposure Factors Handbook)
// ============================================================================

export interface VentilationRateProfile {
  activity: string;
  ventilationRateLitersPerMin: number; // L/min (m³ = L / 1000)
  description: string;
}

export const ACTIVITY_VENTILATION_RATES: Record<string, VentilationRateProfile> = {
  sedentary: {
    activity: 'Rest / Sedentary (Sitting, Reading)',
    ventilationRateLitersPerMin: 10.0,
    description: 'Resting respiratory rate, low minute volume',
  },
  light_walking: {
    activity: 'Light Walking (3.0 km/h)',
    ventilationRateLitersPerMin: 22.0,
    description: 'Casual walking, school commutes',
  },
  brisk_walking: {
    activity: 'Brisk Walking (5.5 km/h)',
    ventilationRateLitersPerMin: 32.0,
    description: 'Active urban commute',
  },
  jogging: {
    activity: 'Jogging (8.5 km/h)',
    ventilationRateLitersPerMin: 55.0,
    description: 'Moderate aerobic exercise, mouth breathing activated',
  },
  cycling_intense: {
    activity: 'Intense Cycling / Running (>12 km/h)',
    ventilationRateLitersPerMin: 75.0,
    description: 'High cardiovascular demand, deep alveolar penetration',
  },
};
