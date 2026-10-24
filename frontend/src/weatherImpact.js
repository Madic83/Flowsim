const WEATHER_PROFILES = {
  clear: { staff: 1, precipitation: 1 },
  cloudy: { staff: 1, precipitation: 1 },
  fog: { staff: 1, precipitation: 1 },
  rain: { staff: 0.85, precipitation: 1.2 },
  lightRain: { staff: 0.95, precipitation: 1.1 },
  heavyRain: { staff: 0.85, precipitation: 1.2 },
  snow: { staff: 0.9, precipitation: 1.15 },
  heavySnow: { staff: 0.8, precipitation: 1.15 },
  storm: { staff: 0.85, precipitation: 1.2 }
};

const TEMPERATURE_DETERIORATION_POINTS = [
  [-20, 1.6],
  [-10, 1.3],
  [0, 1.15],
  [10, 1.05],
  [20, 1],
  [35, 1.2],
  [40, 1.4]
];

function getWeatherProfile(environment = {}) {
  return WEATHER_PROFILES[environment.weather] || WEATHER_PROFILES.clear;
}

export function isDarkAtTime(simTime) {
  if (typeof simTime !== 'string') return false;
  const [hours, minutes] = simTime.split(':').map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return false;
  }
  return hours >= 20 || hours < 6;
}

function getTemperatureStaffFactor(temperatureC) {
  const temperature = Number.isFinite(Number(temperatureC)) ? Number(temperatureC) : 15;
  if (temperature >= 15) return 1;
  if (temperature >= 5) return 0.98;
  if (temperature >= 0) return 0.95;
  if (temperature >= -5) return 0.9;
  if (temperature >= -10) return 0.85;
  if (temperature >= -20) return 0.75;
  return 0.6;
}

function getTemperaturePatientFactor(temperatureC) {
  const temperature = Number.isFinite(Number(temperatureC)) ? Number(temperatureC) : 15;
  if (temperature <= TEMPERATURE_DETERIORATION_POINTS[0][0]) return TEMPERATURE_DETERIORATION_POINTS[0][1];
  const lastPoint = TEMPERATURE_DETERIORATION_POINTS[TEMPERATURE_DETERIORATION_POINTS.length - 1];
  if (temperature >= lastPoint[0]) return lastPoint[1];

  for (let index = 1; index < TEMPERATURE_DETERIORATION_POINTS.length; index += 1) {
    const [upperTemperature, upperFactor] = TEMPERATURE_DETERIORATION_POINTS[index];
    const [lowerTemperature, lowerFactor] = TEMPERATURE_DETERIORATION_POINTS[index - 1];
    if (temperature <= upperTemperature) {
      const progress = (temperature - lowerTemperature) / (upperTemperature - lowerTemperature);
      return lowerFactor + (upperFactor - lowerFactor) * progress;
    }
  }

  return 1;
}

export function getStaffEfficiency(environment = {}) {
  const profile = getWeatherProfile(environment);
  const windSpeed = Math.max(0, Number(environment.windSpeed) || 0);
  const windFactor = windSpeed > 20 ? 0.7 : windSpeed > 10 ? 0.9 : 1;
  const darknessFactor = environment.darkness ? (environment.lighting === false ? 0.85 : 0.95) : 1;

  return Math.max(0.1, getTemperatureStaffFactor(environment.temperatureC) * profile.staff * windFactor * darknessFactor);
}

export function getPatientDeteriorationFactor(environment = {}) {
  const profile = getWeatherProfile(environment);
  const windSpeed = Math.max(0, Number(environment.windSpeed) || 0);
  const windFactor = windSpeed > 15 ? 1.4 : windSpeed > 10 ? 1.2 : windSpeed > 5 ? 1.1 : 1;
  const exposureFactor = environment.surface === 'water'
    ? 2
    : environment.surface === 'wet'
      ? 1.4
      : profile.precipitation;
  const surfaceFactors = { asphalt: 1, grass: 1.05, snow: 1.15, ice: 1.2, wet: 1.25, water: 2 };
  const surfaceFactor = surfaceFactors[environment.surface] || 1;

  return getTemperaturePatientFactor(environment.temperatureC) * windFactor * exposureFactor * surfaceFactor;
}

export function getVehicleSpeedFactor(environment = {}) {
  const profileFactors = {
    clear: 1,
    cloudy: 1,
    fog: 0.75,
    rain: 0.8,
    lightRain: 0.9,
    heavyRain: 0.8,
    snow: 0.8,
    heavySnow: 0.65,
    storm: 0.65
  };
  const profileFactor = profileFactors[environment.weather] || 1;
  const windSpeed = Math.max(0, Number(environment.windSpeed) || 0);
  const windFactor = windSpeed > 20 ? 0.7 : windSpeed > 10 ? 0.9 : 1;

  return Math.max(0.35, profileFactor * windFactor);
}

export function scalePrehospitalWorkMinutes(baseMinutes, environment = {}) {
  if (baseMinutes <= 0) return baseMinutes;
  return Math.ceil(baseMinutes / getStaffEfficiency(environment));
}

export function scalePrehospitalWorkSeconds(baseSeconds, environment = {}) {
  if (baseSeconds <= 0) return baseSeconds;
  return Math.ceil(baseSeconds / getStaffEfficiency(environment));
}
