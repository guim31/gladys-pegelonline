// -----------------------------------------------------------------------------
// The monitor against the recorded PEGELONLINE answer of 23/10/2026: what is
// discovered and published, the internal timer, stale readings, the scene
// triggers, failures, restarts and the configuration paths.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAX_STATIONS } from '../src/config.js';
import { trendOf } from '../src/monitor.js';
import {
  BONN,
  DRESDEN,
  EDERTALSPERRE,
  HOUSE,
  KOELN,
  KOELN_NUMBER,
  MELLUMPLATE,
  PASSAU,
  START,
  create,
  createApi,
  createWorld,
  cycle,
  discovered,
  featureId,
} from './helpers/world.js';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const lastValue = (world, externalId) => world.fake.lastState(externalId);

async function followed(t, uuids, config = {}) {
  const world = await createWorld({ config: { stations: uuids.join(','), ...config } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const uuid of uuids) {
    devices.push(await create(world, uuid));
  }
  return { world, devices };
}

test('Köln: water level in cm, flow, state and navigation level, last reading', async (t) => {
  const { world, devices } = await followed(t, [KOELN]);
  const [device] = devices;
  assert.equal(device.name, 'Köln');
  assert.equal(device.model, 'PEGELONLINE · Rhein');
  assert.equal(device.should_poll, false);
  assert.deepEqual(
    device.params.map((p) => [p.name, p.value]),
    [
      ['STATION_UUID', KOELN],
      ['STATION_NUMBER', KOELN_NUMBER],
      ['RIVER', 'Rhein'],
      ['RIVER_KM', '688'],
    ],
  );
  assert.deepEqual(
    device.features.map((f) => [f.external_id.split(':').pop(), f.name, f.unit]),
    [
      ['height', "Hauteur d'eau", 'cm'],
      ['flow', 'Débit (m³/s)', undefined],
      ['state', "État du niveau d'eau (MNW/MHW)", undefined],
      ['navigation', 'Niveau de navigation (HSW)', undefined],
      ['last_reading', 'Dernière mesure', undefined],
    ],
  );
  assert.equal(lastValue(world, featureId(device, 'height')), 64);
  assert.equal(lastValue(world, featureId(device, 'flow')), 622);
  assert.equal(lastValue(world, featureId(device, 'state')), 0, 'low');
  assert.equal(lastValue(world, featureId(device, 'navigation')), 1, 'below HSW');
  assert.equal(lastValue(world, featureId(device, 'last_reading')), '23/10 15:00');
});

test('Passau: temperatures, no flow; Edertalsperre: level in m, no state', async (t) => {
  const { world, devices } = await followed(t, [PASSAU, EDERTALSPERRE], { language: 'de' });
  const [passau, eder] = devices;
  assert.equal(passau.name, 'Passau Donau');
  assert.deepEqual(
    passau.features.map((f) => f.name),
    [
      'Wasserstand',
      'Wassertemperatur',
      'Lufttemperatur',
      'Wasserstandslage (MNW/MHW)',
      'Schifffahrtswasserstand (HSW)',
      'Letzte Messung',
    ],
  );
  assert.equal(lastValue(world, featureId(passau, 'water_temperature')), 13.3);
  assert.equal(lastValue(world, featureId(passau, 'air_temperature')), 12.3);
  assert.deepEqual(
    eder.features.map((f) => [f.external_id.split(':').pop(), f.unit ?? null]),
    [
      ['height', 'm'],
      ['last_reading', null],
    ],
  );
  assert.equal(lastValue(world, featureId(eder, 'height')), 219.48);
});

test('one PEGELONLINE request per cycle for every station, by the internal timer', async (t) => {
  const timers = t.mock.timers;
  timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const world = await createWorld({
    config: { stations: [KOELN, BONN, PASSAU].join(',') },
    timers: true,
  });
  t.after(() => world.app.stop());
  await create(world, KOELN);
  world.api.requests.length = 0;
  world.clock.advance(15 * MINUTE);
  world.api.setLevel(KOELN, world.clock.now(), 70);
  timers.tick(15 * MINUTE);
  await world.monitor.running;
  assert.equal(world.api.requests.length, 1, 'uuids only: no station list');
  const ids = world.api.requests[0].searchParams.get('ids').split(',');
  assert.deepEqual(ids.sort(), [KOELN, BONN, PASSAU].sort());
  assert.equal(lastValue(world, featureId(discovered(world, KOELN), 'height')), 70);
});

test('only the changes are published, and a stable value again after 12 hours', async (t) => {
  // The SDK dates its memory of the published states with Date.now().
  t.mock.timers.enable({ apis: ['Date'], now: START });
  const { world, devices } = await followed(t, [KOELN]);
  const height = featureId(devices[0], 'height');
  const count = () =>
    world.fake.states.filter((s) => s.device_feature_external_id === height).length;
  const before = count();
  for (let i = 0; i < 47; i += 1) {
    t.mock.timers.tick(15 * MINUTE);
    world.api.setLevel(KOELN, world.clock.now() + 15 * MINUTE, 64);
    await cycle(world, 15);
  }
  assert.equal(count(), before, 'same value at a new time: nothing sent before 12 hours');
  t.mock.timers.tick(15 * MINUTE);
  world.api.setLevel(KOELN, world.clock.now() + 15 * MINUTE, 64);
  await cycle(world, 15);
  assert.equal(count(), before + 1, 'heartbeat');
  world.api.setLevel(KOELN, world.clock.now(), 65);
  await cycle(world, 1);
  assert.equal(count(), before + 2, 'a change');
});

test('a silent station is not published again as fresh, and says since when', async (t) => {
  const { world, devices } = await followed(t, [MELLUMPLATE]);
  const [device] = devices;
  assert.equal(lastValue(world, featureId(device, 'height')), undefined);
  assert.equal(
    lastValue(world, featureId(device, 'last_reading')),
    'Pas de nouvelle mesure depuis le 11/10 10:54',
  );
  assert.equal(
    device.features.some((f) => f.external_id.endsWith(':state')),
    false,
    'tidal marks only',
  );
});

test('a reading growing old: the values stop, "Last reading" says since when', async (t) => {
  const { world, devices } = await followed(t, [KOELN]);
  for (let i = 0; i < 25; i += 1) {
    await cycle(world, 15);
  }
  assert.equal(
    lastValue(world, featureId(devices[0], 'last_reading')),
    'Pas de nouvelle mesure depuis le 23/10 15:00',
  );
});

test('the trend compares the level with the one of about an hour before', () => {
  const at = (minutes, v) => ({ t: minutes * MINUTE, v });
  assert.equal(trendOf([at(60, 110), at(45, 105), at(0, 100)]), 'rising');
  assert.equal(trendOf([at(60, 90), at(0, 100)]), 'falling');
  assert.equal(trendOf([at(60, 100.5), at(0, 100)]), 'steady');
  assert.equal(trendOf([at(60, 1.03), at(0, 1)], 'm'), 'rising');
  assert.equal(trendOf([at(60, 100), at(30, 100)]), null, 'too short');
  assert.equal(trendOf([at(300, 100), at(0, 100)]), null, 'too old');
  assert.equal(trendOf([]), null);
});

test('state, navigation and mark triggers: one event per transition', async (t) => {
  const { world, devices } = await followed(t, [KOELN], { language: 'de' });
  const station = devices[0].external_id;
  const mw = world.api.mark(KOELN, 'MW');
  const now = () => world.clock.now();
  world.api.setLevel(KOELN, now(), mw + 10, { state: 'normal' });
  await cycle(world, 15);
  // Wobbling around MW: no new crossing until it really falls below.
  world.api.setLevel(KOELN, now(), mw - 1, { state: 'normal' });
  await cycle(world, 15);
  world.api.setLevel(KOELN, now(), mw + 1, { state: 'normal' });
  await cycle(world, 15);
  // 2 cm below the mark: the fall counts.
  world.api.setLevel(KOELN, now(), mw - 2, { state: 'normal' });
  await cycle(world, 15);
  const events = world.fake.sceneEvents.map((event) => [
    event.key,
    event.data.state ?? event.data.mark,
    event.data.direction ?? event.data.previous_state,
  ]);
  assert.deepEqual(events, [
    ['state_changed', 'normal', 'low'],
    // The Rhine was below its lowest known level (NNW) on 23/10/2026.
    ['mark_crossed', 'NNW', 'rising'],
    ['mark_crossed', 'MNW', 'rising'],
    ['mark_crossed', 'MW', 'rising'],
    ['mark_crossed', 'MW', 'falling'],
  ]);
  assert.deepEqual(world.fake.sceneEvents[0].data, {
    station,
    station_name: 'Köln',
    river: 'Rhein',
    height: mw + 10,
    unit: 'cm',
    state: 'normal',
    state_name: 'Normal',
    previous_state: 'low',
    previous_state_name: 'Niedrig',
  });
  assert.equal(world.fake.sceneEvents[3].data.mark_name, 'Mittelwasserstand (MW)');
  assert.equal(world.fake.sceneEvents[3].data.mark_value, mw);

  let seen = world.fake.sceneEvents.length;
  const hsw = world.api.mark(KOELN, 'HSW');
  world.api.setLevel(KOELN, now(), hsw + 5, { state: 'high', navigation: 'high' });
  await cycle(world, 15);
  const flood = world.fake.sceneEvents.slice(seen);
  const keys = flood.map((event) => event.key);
  assert.ok(keys.includes('navigation_stopped'));
  const stopped = flood.find((event) => event.key === 'navigation_stopped');
  assert.equal(stopped.data.hsw, world.api.mark(KOELN, 'HSW'));
  assert.deepEqual(
    flood
      .filter((event) => event.key === 'mark_crossed')
      .map((event) => event.data.mark)
      .sort(),
    ['M_I', 'M_II', 'MHW', 'MW'].sort(),
  );
  seen = world.fake.sceneEvents.length;
  world.api.setLevel(KOELN, now(), hsw - 300, { state: 'normal', navigation: 'normal' });
  await cycle(world, 15);
  assert.ok(world.fake.sceneEvents.slice(seen).some((e) => e.key === 'navigation_resumed'));
});

test('no trigger without a created device, nor for a stale reading or the first one', async (t) => {
  const world = await createWorld({ config: { stations: KOELN } });
  t.after(() => world.app.stop());
  world.api.setLevel(KOELN, world.clock.now(), 900, { state: 'high', navigation: 'high' });
  await cycle(world, 15);
  assert.deepEqual(world.fake.sceneEvents, [], 'no device');
  await create(world, KOELN);
  world.api.setLevel(KOELN, world.clock.now() - 7 * HOUR, 60, { state: 'low' });
  await cycle(world, 15);
  assert.deepEqual(world.fake.sceneEvents, [], 'stale');
});

test('the states remembered survive a restart; a day-old memory fires nothing', async (t) => {
  const api = createApi();
  const first = await createWorld({ api, config: { stations: KOELN } });
  const device = await create(first, KOELN);
  await first.app.stop();
  const second = await createWorld({
    api,
    config: { stations: KOELN },
    devices: [device],
    dataDir: first.dataDir,
    clock: first.clock,
  });
  t.after(() => second.app.stop());
  api.setLevel(KOELN, second.clock.now(), 300, { state: 'normal' });
  await cycle(second, 15);
  assert.ok(second.fake.sceneEvents.some((event) => event.key === 'state_changed'));

  const third = await createWorld({
    api,
    config: { stations: KOELN },
    devices: [device],
    dataDir: first.dataDir,
    clock: first.clock,
  });
  t.after(() => third.app.stop());
  third.clock.advance(2 * 24 * HOUR);
  api.setLevel(KOELN, third.clock.now(), 60, { state: 'low' });
  await cycle(third, 1);
  assert.deepEqual(third.fake.sceneEvents, []);
});

test('numbers, names (umlauts, case) and page addresses resolve through the station list', async (t) => {
  const world = await createWorld({
    config: {
      stations: `${KOELN_NUMBER}; kaub, Koeln\nhttps://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=501060, Nowhere`,
    },
  });
  t.after(() => world.app.stop());
  assert.deepEqual(world.monitor.followed().slice(0, 3), [
    KOELN,
    '1d26e504-7f9e-480a-b52c-5932be6549ab',
    DRESDEN,
  ]);
  const [status] = [world.fake.connectionStatus];
  assert.equal(status.connected, true);
  assert.match(status.message.fr, /Station inconnue : Nowhere/);
  assert.equal(world.api.requests.filter((u) => !u.searchParams.has('ids')).length, 1);
});

test('an unknown uuid is reported', async (t) => {
  const world = await createWorld({ config: { stations: '00000000-0000-0000-0000-000000000000' } });
  t.after(() => world.app.stop());
  assert.match(
    world.fake.connectionStatus.message.en,
    /Unknown station: 00000000-0000-0000-0000-000000000000/,
  );
  assert.deepEqual(world.fake.discoveredDevices, []);
});

test('PEGELONLINE unavailable: disconnected status, then back when it answers', async (t) => {
  const { world } = await followed(t, [KOELN]);
  world.api.down = 503;
  await cycle(world, 15);
  let status = world.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.de, /PEGELONLINE antwortet nicht/);
  world.api.down = false;
  await cycle(world, 15);
  status = world.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(status.message, undefined);
});

test('"around my house" adds the 3 nearest gauges that send readings', async (t) => {
  const world = await createWorld({ config: { around_home: '50' } });
  t.after(() => world.app.stop());
  const DUESSELDORF = '8f7e5f92-1153-4f93-acba-ca48670c8ca9';
  assert.deepEqual(world.monitor.followed(), [KOELN, BONN, DUESSELDORF]);
  assert.ok(
    world.api.requests.every((url) => !url.search.includes(String(HOUSE.latitude))),
    'the house location is never sent',
  );
});

test('"around my house" without a located house is reported', async (t) => {
  const world = await createWorld({ config: { around_home: '20' }, houses: [] });
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.fr, /Autour de ma maison/);
});

test('an empty configuration says what to do', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  assert.match(world.fake.connectionStatus.message.en, /No station yet/);
  assert.deepEqual(world.api.requests, [], 'nothing to ask');
});

test(`the configuration follows ${MAX_STATIONS} stations at most`, async (t) => {
  const uuids = createApi().stations.map((s) => s.uuid);
  const world = await createWorld({ config: { stations: uuids.join(',') } });
  t.after(() => world.app.stop());
  assert.equal(world.monitor.followed().length, MAX_STATIONS);
  assert.match(world.fake.connectionStatus.message.en, /first 20 stations/);
});

test('a created device stays followed once removed from the configuration', async (t) => {
  const { world } = await followed(t, [KOELN]);
  await world.fake.configUpdated({ stations: '' });
  await world.monitor.running;
  assert.deepEqual(world.monitor.followed(), [KOELN]);
  assert.ok(discovered(world, KOELN));
});

test('a created device gets all its states at once, and the widget is refreshed', async (t) => {
  const world = await createWorld({ config: { stations: KOELN } });
  t.after(() => world.app.stop());
  const refreshes = world.fake.widgetRefreshes.length;
  world.clock.advance(MINUTE);
  const device = await create(world, KOELN);
  assert.equal(lastValue(world, featureId(device, 'height')), 64);
  assert.ok(world.fake.widgetRefreshes.length > refreshes);
});

test('a reconnection publishes the devices and every state again', async (t) => {
  const { world, devices } = await followed(t, [KOELN]);
  const before = world.fake.states.length;
  await world.gladys.disconnect();
  await world.gladys.connect();
  assert.equal(world.fake.states.length, before * 2);
  assert.equal(world.fake.discoveredDevices[0].external_id, devices[0].external_id);
});

test('onPoll, should a Gladys call it: reads again only when the cycle is old', async (t) => {
  const { world, devices } = await followed(t, [KOELN]);
  const requests = world.api.requests.length;
  await world.fake.poll(devices[0]);
  assert.equal(world.api.requests.length, requests);
  world.clock.advance(10 * MINUTE);
  await world.fake.poll(devices[0]);
  assert.equal(world.api.requests.length, requests + 1);
});

test('a change remembered before the device creation fires; a device update republishes', async (t) => {
  const world = await createWorld({ config: { stations: '' } });
  t.after(() => world.app.stop());
  await world.fake.configUpdated({ stations: KOELN });
  await world.monitor.running;
  const device = await create(world, KOELN);
  world.api.setLevel(KOELN, world.clock.now(), 900, { state: 'high', navigation: 'high' });
  await cycle(world, 15);
  assert.ok(world.fake.sceneEvents.length > 0, 'the change from the first reading fires');
  const before = world.fake.states.length;
  world.gladys.forgetPublishedStates?.();
  await world.fake.deviceUpdated(device);
  assert.ok(world.fake.states.length > before, 'states published again after "Update"');
});

test('a configuration saved during a cycle is applied right after it', async (t) => {
  const world = await createWorld({ config: { stations: KOELN } });
  t.after(() => world.app.stop());
  const running = world.monitor.runCycle();
  const saved = world.fake.configUpdated({ stations: `${KOELN}, ${PASSAU}` });
  await running;
  await saved;
  await world.monitor.rerun;
  assert.deepEqual(world.monitor.followed(), [KOELN, PASSAU]);
  assert.ok(discovered(world, PASSAU));
});

test('a failed start keeps the internal timer, and a reconnection does not stack it', async (t) => {
  const timers = t.mock.timers;
  timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const gladysFail = { fail: true };
  const world = await createWorld({ config: { stations: KOELN }, timers: true, connect: false });
  t.after(() => world.app.stop());
  const publish = world.gladys.publishDiscoveredDevices.bind(world.gladys);
  t.mock.method(world.gladys, 'publishDiscoveredDevices', async (devices) => {
    if (gladysFail.fail) {
      throw new Error('HTTP 503');
    }
    return publish(devices);
  });
  await world.gladys.connect();
  await world.app.ready;
  assert.ok(world.monitor.cycleTimer, 'scheduled despite the failure');
  gladysFail.fail = false;
  const requests = world.api.requests.length;
  world.clock.advance(15 * MINUTE);
  timers.tick(15 * MINUTE);
  await world.monitor.running;
  assert.equal(world.api.requests.length, requests + 1);
});

test('the stations no longer followed are forgotten in /data', async (t) => {
  const world = await createWorld({ config: { stations: `${KOELN}, ${PASSAU}` } });
  t.after(() => world.app.stop());
  assert.ok(world.monitor.data.readings[PASSAU]);
  await world.fake.configUpdated({ stations: KOELN });
  await world.monitor.running;
  assert.equal(world.monitor.data.readings[PASSAU], undefined);
  assert.equal(world.monitor.data.stations[PASSAU], undefined);
  assert.ok(world.monitor.data.readings[KOELN]);
});

test('the houses of Gladys unreadable: no "give your house a location", tried again', async (t) => {
  const world = await createWorld({ config: { around_home: '20' }, connect: false });
  t.after(() => world.app.stop());
  const houses = t.mock.method(world.gladys, 'getHouses', async () => {
    throw new Error('HTTP 500');
  });
  await world.gladys.connect();
  await world.app.ready;
  await world.monitor.running;
  const status = world.fake.connectionStatus;
  assert.doesNotMatch(status.message.en, /give your house a location/);
  assert.match(status.message.en, /cannot be chosen yet/);
  houses.mock.restore();
  await cycle(world, 15);
  assert.deepEqual(world.monitor.followed(), [KOELN]);
  assert.equal(world.fake.connectionStatus.connected, true);
});
