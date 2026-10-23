// -----------------------------------------------------------------------------
// PEGELONLINE REST API v2 (WSV, the German federal waterways administration):
// keyless, no account. Data licence DL-DE->Zero-2.0.
//
//   stations.json?includeTimeseries=true            the referential (~800 gauges)
//   stations.json?ids=<uuid>,<uuid>&include…=true   the followed gauges, with
//                                                   their current measurement
//                                                   and characteristic values,
//                                                   in ONE request per cycle
//
// Everything is turned into plain objects here, so the rest of the code never
// reads the API shapes. Series kept: W (water level), Q (flow, m³/s), WT
// (water temperature, °C) and LT (air temperature, °C).
// -----------------------------------------------------------------------------

import { getJson } from './http.js';

export const API_URL = 'https://www.pegelonline.wsv.de/webservices/rest-api/v2';
export const SITE_URL = 'https://www.pegelonline.wsv.de/gast/start';

/** The public page of a gauge, by its number. */
export const stationPage = (number) =>
  `https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=${encodeURIComponent(number)}`;

export const SERIES = ['W', 'Q', 'WT', 'LT'];

// Characteristic values a scene can wait for (manifest `mark_crossed`).
// M_I / M_II are the high water marks I and II of the Rhine (navigation
// restricted, then stopped); the others exist on most gauges.
export const MARKS = ['NNW', 'MNW', 'MW', 'MHW', 'M_I', 'M_II', 'HHW'];

// States of stateMnwMhw (water level compared with MNW and MHW) and stateNswHsw
// (compared with the highest navigable water level HSW) that say something;
// "unknown", "commented" and "out-dated" are ignored.
export const LEVEL_STATES = ['low', 'normal', 'high'];

// Words kept as written when an all-caps name is put in title case.
const KEEP_UPPER = new Set(['UP', 'OP', 'AMS', 'DFH', 'MLK', 'II', 'III', 'SH']);
const LOWER = new Set(['AM', 'AN', 'IM', 'IN', 'BEI', 'DER', 'DIE', 'DAS', 'OB', 'VOR', 'ZU']);

/** "PASSAU DONAU" → "Passau Donau", "Sankt Aldegund UP" unchanged. */
export function titleCase(text) {
  const value = String(text ?? '').trim();
  if (value !== value.toUpperCase()) {
    return value;
  }
  return value
    .split(' ')
    .map((word, index) => {
      if (KEEP_UPPER.has(word)) {
        return word;
      }
      if (index > 0 && LOWER.has(word)) {
        return word.toLowerCase();
      }
      return word
        .toLowerCase()
        .replace(/(^|[-./(])(\p{L})/gu, (_, sep, c) => sep + c.toUpperCase());
    })
    .join(' ');
}

const finite = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);

/** A timeseries of the API, reduced to what the integration uses. */
function parseSeries(raw) {
  const current = raw.currentMeasurement;
  const time = current ? Date.parse(current.timestamp) : NaN;
  const marks = {};
  for (const mark of raw.characteristicValues ?? []) {
    // Only marks in the unit of the series can be compared with it.
    if (finite(mark.value) !== null && mark.unit === raw.unit) {
      marks[mark.shortname] = mark.value;
    }
  }
  return {
    unit: raw.unit ?? null,
    current:
      current && Number.isFinite(time) && finite(current.value) !== null
        ? {
            t: time,
            v: current.value,
            state: current.stateMnwMhw ?? null,
            navigation: current.stateNswHsw ?? null,
          }
        : null,
    marks,
  };
}

/** A station of the API, reduced and renamed. */
export function parseStation(raw) {
  const series = {};
  for (const item of raw.timeseries ?? []) {
    if (SERIES.includes(item.shortname) && !series[item.shortname]) {
      series[item.shortname] = parseSeries(item);
    }
  }
  return {
    uuid: String(raw.uuid).toLowerCase(),
    number: raw.number ? String(raw.number) : null,
    name: titleCase(raw.longname || raw.shortname),
    shortname: raw.shortname ?? '',
    longname: raw.longname ?? '',
    river: raw.water?.longname ? titleCase(raw.water.longname) : null,
    water: raw.water?.shortname ?? null,
    km: finite(raw.km),
    latitude: finite(raw.latitude),
    longitude: finite(raw.longitude),
    series,
  };
}

export class PegelOnline {
  /**
   * @param {object} [options]
   * @param {Function} [options.fetch]
   */
  constructor({ fetch: fetchImpl } = {}) {
    this.fetch = fetchImpl ?? globalThis.fetch;
  }

  /** Every gauge, with the list of its series (no measurement): ~300 kB. */
  async referential() {
    const body = await getJson(this.fetch, `${API_URL}/stations.json?includeTimeseries=true`);
    if (!Array.isArray(body)) {
      throw new Error('PEGELONLINE: unexpected answer for the station list');
    }
    return body.map(parseStation);
  }

  /**
   * The given gauges (uuids), with current measurement and characteristic
   * values, in one request. Unknown uuids are simply missing from the answer.
   * @returns {Promise<Map<string, object>>} by uuid
   */
  async stations(uuids) {
    if (uuids.length === 0) {
      return new Map();
    }
    const url =
      `${API_URL}/stations.json?ids=${uuids.map(encodeURIComponent).join(',')}` +
      '&includeTimeseries=true&includeCurrentMeasurement=true&includeCharacteristicValues=true';
    const body = await getJson(this.fetch, url);
    if (!Array.isArray(body)) {
      throw new Error('PEGELONLINE: unexpected answer for the stations');
    }
    return new Map(body.map(parseStation).map((station) => [station.uuid, station]));
  }
}
