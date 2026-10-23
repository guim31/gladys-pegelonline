// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake PEGELONLINE serving the
// recorded answer of test/fixtures (filtered the way the real API filters), a
// manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { Store } from '../../src/store.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Berlin';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8'));

// The recorded measurements end at 15:00 (Berlin) on 23/10/2026: the clock
// starts 10 minutes later.
export const START = Date.parse('2026-10-23T13:10:00Z');

// A house in Köln-Deutz (public coordinates of the Deutz station).
export const HOUSE = {
  id: 'house-1',
  name: 'Haus',
  selector: 'haus',
  latitude: 50.9409,
  longitude: 6.9749,
};

// Rhine, W and Q, every state and navigation mark (MNW, MHW, HSW, M_I, M_II).
export const KOELN = 'a6ee8177-107b-47dd-bcfd-30960ccc6e9c';
export const KOELN_NUMBER = '2730010';
// Rhine, W and Q, state but no navigation state.
export const BONN = '593647aa-9fea-43ec-a7d6-6476a76ae868';
// Danube, W, water and air temperature, no flow.
export const PASSAU = '9f12c405-35ac-4d90-9b7b-023be355867e';
// Elbe, W and Q.
export const DRESDEN = '70272185-b2b3-4178-96b8-43bea330dcae';
// Eder reservoir: W in m above the gauge datum (m+PNP), no state.
export const EDERTALSPERRE = 'c6e9f744-4dbf-4e8e-a219-cab051ec610c';
// Jade, tidal: last reading on 11/10, state "commented".
export const MELLUMPLATE = 'c8b9a2b6-b783-417f-8479-3a0d732fb901';

/** Fake PEGELONLINE. `api.down`: 'network' (connection refused), a status (503) or false. */
export function createApi() {
  const stations = structuredClone(fixture('pegelonline/stations-2026-10-23.json'));
  const iso = (time) => new Date(time).toISOString().replace(/\.\d{3}Z$/, '+00:00');
  const series = (uuid, name) =>
    stations.find((s) => s.uuid === uuid)?.timeseries.find((t) => t.shortname === name);

  const api = {
    stations,
    down: false,
    requests: [],

    /** A new water level (and optionally state / navigation state, flow) of a station. */
    setLevel(uuid, time, value, { state, navigation, flow } = {}) {
      const W = series(uuid, 'W');
      W.currentMeasurement = {
        ...W.currentMeasurement,
        timestamp: iso(time),
        value,
        ...(state ? { stateMnwMhw: state } : {}),
        ...(navigation ? { stateNswHsw: navigation } : {}),
      };
      if (flow !== undefined) {
        series(uuid, 'Q').currentMeasurement = { timestamp: iso(time), value: flow };
      }
    },

    /** The value of a characteristic water level of a station. */
    mark(uuid, name) {
      return series(uuid, 'W').characteristicValues.find((c) => c.shortname === name).value;
    },

    answer(url) {
      if (!url.pathname.endsWith('/stations.json')) {
        return null;
      }
      const params = url.searchParams;
      let list = stations;
      if (params.has('ids')) {
        const ids = params.get('ids').split(',');
        list = list.filter((s) => ids.includes(s.uuid) || ids.includes(s.number));
      }
      return list.map((station) => {
        const copy = structuredClone(station);
        if (params.get('includeTimeseries') !== 'true') {
          delete copy.timeseries;
          return copy;
        }
        for (const item of copy.timeseries) {
          if (params.get('includeCurrentMeasurement') !== 'true') {
            delete item.currentMeasurement;
          }
          if (params.get('includeCharacteristicValues') !== 'true') {
            delete item.characteristicValues;
          }
        }
        return copy;
      });
    },

    async fetch(input) {
      const url = new URL(input);
      api.requests.push(url);
      if (api.down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (api.down) {
        return { status: api.down, text: async () => 'Service Unavailable' };
      }
      const body = api.answer(url);
      if (body === null) {
        return {
          status: 404,
          text: async () => JSON.stringify({ status: 404, message: 'Not found' }),
        };
      }
      return { status: 200, text: async () => JSON.stringify(body) };
    },
  };
  return api;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {Array} [options.houses] houses of Gladys
 * @param {object} [options.api] from createApi
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers] true: the monitor's own timer runs (mock it)
 */
export async function createWorld({
  config = {},
  devices = [],
  houses = [HOUSE],
  api = createApi(),
  connect = true,
  timers = false,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-pegelonline-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices, houses });
  const store = new Store(dataDir);
  const app = registerHandlers(gladys, {
    store,
    fetch: api.fetch,
    timers,
    now: clock.now,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, api, clock, store, dataDir };
}

/** The device published for a station uuid, from the last discovery list. */
export const discovered = (world, uuid) =>
  world.fake.discoveredDevices.find((device) =>
    device.params.some((p) => p.name === 'STATION_UUID' && p.value === uuid),
  );

/** Create the device of a station in Gladys, as the user would. */
export async function create(world, uuid) {
  const device = discovered(world, uuid);
  if (!device) {
    throw new Error(`${uuid} is not in the discovered devices`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 15) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}
