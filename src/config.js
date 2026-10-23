// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
//
// Select values are strings in the manifest (stored by Gladys as typed); the
// normalized config holds numbers.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Kilometres around the house where the nearest stations are followed; '0' = off.
// German gauges are sparser than French ones: up to 50 km.
export const HOME_RADII = ['0', '10', '20', '50'];

// Minutes between two readings. Gauges send a value every 15 minutes (some
// every hour): faster would only ask PEGELONLINE the same thing again.
export const REFRESH_INTERVALS = ['15', '20', '30'];

// Stations followed "around my house": the nearest ones that send readings.
export const HOME_STATIONS = 3;

// Upper bound of the stations taken from the configuration: one PEGELONLINE
// request covers them all, and the states stay far below the 300 per minute of
// the core.
export const MAX_STATIONS = 20;

export const DEFAULT_CONFIG = {
  stations: '',
  around_home: '0',
  refresh_interval: '15',
  language: 'fr',
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const UUID_IN_TEXT = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
// Gauge number (Pegelnummer): digits only, e.g. 2730010 for Köln.
const NUMBER = /^\d{3,10}$/;
// The PEGELONLINE page of a gauge: …/gast/stammdaten?pegelnr=2730010
const NUMBER_IN_URL = /[?&]pegelnr=(\d{3,10})\b/i;

/**
 * What one token of the "Stations" field designates: a station uuid, a gauge
 * number, or a name. Names may hold spaces ("Passau Donau"): tokens are only
 * separated by commas, semicolons and line breaks.
 */
export function parseToken(token) {
  const text = String(token ?? '').trim();
  const number = NUMBER_IN_URL.exec(text);
  if (number) {
    return { kind: 'number', value: number[1], text };
  }
  if (UUID.test(text) || (/^https?:\/\//i.test(text) && UUID_IN_TEXT.test(text))) {
    return { kind: 'uuid', value: UUID_IN_TEXT.exec(text)[0].toLowerCase(), text };
  }
  if (NUMBER.test(text)) {
    return { kind: 'number', value: text, text };
  }
  return { kind: 'name', value: text, text };
}

/** The tokens of the "Stations" field, duplicates removed. */
export function parseStations(text) {
  const seen = new Set();
  const tokens = [];
  for (const raw of String(text ?? '').split(/[,;\n]+/)) {
    if (!raw.trim()) {
      continue;
    }
    const token = parseToken(raw);
    const key = `${token.kind}:${normalizeName(token.value)}`;
    if (!seen.has(key)) {
      seen.add(key);
      tokens.push(token);
    }
  }
  return tokens;
}

/**
 * A name reduced for comparison: case, accents, umlauts written "oe" or "ö",
 * "ß" or "ss" and punctuation ignored, so "Koeln", "köln" and "KÖLN" match.
 */
export function normalizeName(text) {
  return String(text ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/ae/g, 'a')
    .replace(/oe/g, 'o')
    .replace(/ue/g, 'u')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const pick = (value, allowed, fallback) =>
  allowed.includes(String(value)) ? Number(value) : Number(fallback);

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  return {
    stations: parseStations(source.stations),
    homeRadiusKm: pick(source.around_home, HOME_RADII, DEFAULT_CONFIG.around_home),
    refreshMinutes: pick(
      source.refresh_interval,
      REFRESH_INTERVALS,
      DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}
