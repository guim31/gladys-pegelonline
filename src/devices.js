// -----------------------------------------------------------------------------
// One Gladys device per PEGELONLINE gauge.
//
// Features (couples checked against the Gladys front, v5.2, see
// test/gladys-rules.test.js), each only when the gauge measures it:
//   - height             level-sensor/liquid-depth: the water level W, in cm
//                        above the gauge zero as PEGELONLINE shows it (in m
//                        for the few gauges given in m above sea level);
//   - flow               water-valve/flow, in m³/s. Gladys has no m³/s unit
//                        (only m³/h): no unit, the name says it, the value
//                        reads like on pegelonline.wsv.de;
//   - water_temperature  temperature-sensor/decimal, °C;
//   - air_temperature    temperature-sensor/decimal, °C;
//   - state              level-sensor/liquid-state (Gladys LIQUID_STATE: 0 low,
//                        1 normal, 2 high): the level compared with the mean
//                        low (MNW) and mean high (MHW) water levels, when the
//                        gauge has both;
//   - navigation         level-sensor/liquid-state too: 2 (high) above the
//                        highest navigable water level HSW, 1 below, when the
//                        gauge has an HSW;
//   - last_reading       text/text: the date of the last measurement, or "no
//                        new reading since…" once the gauge is silent.
//
// Published with should_poll: false: the refresh runs in the container
// (src/monitor.js). The platform id is the station uuid PEGELONLINE gives,
// stable for the life of the gauge (its number is kept as a parameter).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
  DEVICE_FEATURE_UNITS,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'station';
export const FEATURE_KEYS = {
  HEIGHT: 'height',
  FLOW: 'flow',
  WATER_TEMPERATURE: 'water_temperature',
  AIR_TEMPERATURE: 'air_temperature',
  STATE: 'state',
  NAVIGATION: 'navigation',
  LAST_READING: 'last_reading',
};

// Gladys LIQUID_STATE values, shown "Low / Normal / High" by the front.
export const LIQUID_STATE = { low: 0, normal: 1, high: 2 };

// Display bounds (history chart, gauge). The highest German gauge reading is
// about 56 m in cm; levels in m above sea level stay under 1000 m.
export const HEIGHT_BOUNDS = { cm: [-1000, 6000], m: [-100, 1000] };
export const FLOW_BOUND_M3S = 50000;

/** The unit Gladys shows for a water level series ("cm", or "m" above a datum). */
export const heightUnit = (seriesUnit) => (seriesUnit === 'cm' ? 'cm' : 'm');

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: {
    height: 'Water level',
    flow: 'Flow (m³/s)',
    water_temperature: 'Water temperature',
    air_temperature: 'Air temperature',
    state: 'Water level state (MNW/MHW)',
    navigation: 'Navigation level (HSW)',
    last_reading: 'Last reading',
  },
  fr: {
    height: "Hauteur d'eau",
    flow: 'Débit (m³/s)',
    water_temperature: "Température de l'eau",
    air_temperature: "Température de l'air",
    state: "État du niveau d'eau (MNW/MHW)",
    navigation: 'Niveau de navigation (HSW)',
    last_reading: 'Dernière mesure',
  },
  de: {
    height: 'Wasserstand',
    flow: 'Abfluss (m³/s)',
    water_temperature: 'Wassertemperatur',
    air_temperature: 'Lufttemperatur',
    state: 'Wasserstandslage (MNW/MHW)',
    navigation: 'Schifffahrtswasserstand (HSW)',
    last_reading: 'Letzte Messung',
  },
  es: {
    height: 'Nivel del agua',
    flow: 'Caudal (m³/s)',
    water_temperature: 'Temperatura del agua',
    air_temperature: 'Temperatura del aire',
    state: 'Estado del nivel (MNW/MHW)',
    navigation: 'Nivel de navegación (HSW)',
    last_reading: 'Última medición',
  },
};

/** External ids of a station device and of its features. */
export function stationIds(gladys, uuid) {
  const ids = gladys.externalIds(DEVICE_TYPE, uuid);
  return {
    device: ids.device,
    ...Object.fromEntries(Object.values(FEATURE_KEYS).map((key) => [key, ids.feature(key)])),
  };
}

/** The station uuid of a device or feature external id (null if not ours). */
export function stationUuidOfId(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '').device;
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  return externalId.slice(prefix.length).split(':')[0] || null;
}

/**
 * What a station offers, from its series: which features, and the unit of its
 * water level. `station.series` is the parsed PEGELONLINE series (see
 * src/pegelonline.js); a station rebuilt from a Gladys device carries `has`.
 */
export function capabilities(station) {
  if (station.has) {
    return station.has;
  }
  const { W, Q, WT, LT } = station.series ?? {};
  return {
    height: Boolean(W),
    heightUnit: W ? heightUnit(W.unit) : null,
    flow: Boolean(Q),
    water_temperature: Boolean(WT),
    air_temperature: Boolean(LT),
    state: Boolean(W && W.marks.MNW !== undefined && W.marks.MHW !== undefined),
    navigation: Boolean(W && W.marks.HSW !== undefined),
  };
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

/**
 * The discovery payload of a station.
 * @param {object} gladys
 * @param {object} station see src/pegelonline.js parseStation
 * @param {string} language language of the feature names
 */
export function buildDevice(gladys, station, language = 'fr') {
  const ids = stationIds(gladys, station.uuid);
  const names = NAMES[language] ?? NAMES.fr;
  const has = capabilities(station);
  const C = DEVICE_FEATURE_CATEGORIES;
  const features = [];
  if (has.height) {
    const unit = has.heightUnit === 'cm' ? 'cm' : 'm';
    const [min, max] = HEIGHT_BOUNDS[unit];
    features.push(
      sensor(names.height, ids.height, C.LEVEL_SENSOR, TYPES.LEVEL_SENSOR.LIQUID_DEPTH, {
        unit: unit === 'cm' ? DEVICE_FEATURE_UNITS.CM : DEVICE_FEATURE_UNITS.M,
        keep_history: true,
        min,
        max,
      }),
    );
  }
  if (has.flow) {
    features.push(
      sensor(names.flow, ids.flow, C.WATER_VALVE, TYPES.WATER_VALVE.FLOW, {
        keep_history: true,
        min: -FLOW_BOUND_M3S,
        max: FLOW_BOUND_M3S,
      }),
    );
  }
  if (has.water_temperature) {
    features.push(
      sensor(
        names.water_temperature,
        ids.water_temperature,
        C.TEMPERATURE_SENSOR,
        TYPES.SENSOR.DECIMAL,
        { unit: DEVICE_FEATURE_UNITS.CELSIUS, keep_history: true, min: -5, max: 40 },
      ),
    );
  }
  if (has.air_temperature) {
    features.push(
      sensor(
        names.air_temperature,
        ids.air_temperature,
        C.TEMPERATURE_SENSOR,
        TYPES.SENSOR.DECIMAL,
        { unit: DEVICE_FEATURE_UNITS.CELSIUS, keep_history: true, min: -50, max: 60 },
      ),
    );
  }
  if (has.state) {
    features.push(
      sensor(names.state, ids.state, C.LEVEL_SENSOR, TYPES.LEVEL_SENSOR.LIQUID_STATE, {
        keep_history: true,
        min: 0,
        max: 2,
      }),
    );
  }
  if (has.navigation) {
    features.push(
      sensor(names.navigation, ids.navigation, C.LEVEL_SENSOR, TYPES.LEVEL_SENSOR.LIQUID_STATE, {
        keep_history: true,
        min: 0,
        max: 2,
      }),
    );
  }
  features.push(
    sensor(names.last_reading, ids.last_reading, C.TEXT, TYPES.TEXT.TEXT, {
      keep_history: false,
      min: 0,
      max: 0,
    }),
  );
  const params = [{ name: 'STATION_UUID', value: station.uuid }];
  if (station.number) {
    params.push({ name: 'STATION_NUMBER', value: station.number });
  }
  if (station.river) {
    params.push({ name: 'RIVER', value: station.river });
  }
  if (station.km !== null && station.km !== undefined) {
    params.push({ name: 'RIVER_KM', value: String(station.km) });
  }
  return {
    name: station.name,
    external_id: ids.device,
    model: station.river ? `PEGELONLINE · ${station.river}` : 'PEGELONLINE',
    should_poll: false,
    params,
    features,
  };
}
