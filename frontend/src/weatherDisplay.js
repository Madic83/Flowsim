const WEATHER_PRESENTATION = {
  clear: { icon: '\u2600\ufe0f', label: 'Klart' },
  cloudy: { icon: '\u2601\ufe0f', label: 'Molnigt' },
  rain: { icon: '\ud83c\udf27\ufe0f', label: 'Regn' },
  lightRain: { icon: '\ud83c\udf26\ufe0f', label: 'Lätt regn' },
  heavyRain: { icon: '\ud83c\udf27\ufe0f', label: 'Kraftigt regn' },
  snow: { icon: '\u2744\ufe0f', label: 'Snöfall' },
  heavySnow: { icon: '\ud83c\udf28\ufe0f', label: 'Kraftigt snöfall' },
  storm: { icon: '\u26c8\ufe0f', label: 'Storm' },
  fog: { icon: '\ud83c\udf2b\ufe0f', label: 'Dimma' }
};

export function getWeatherPresentation(weather) {
  return WEATHER_PRESENTATION[weather] || WEATHER_PRESENTATION.clear;
}
