// -----------------------------------------------------------------------------
// The "Find stations" action, on the recorded station list.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HOUSE, KOELN_NUMBER, captureLogs, createWorld } from './helpers/world.js';

async function search(t, fields, options = {}) {
  const world = await createWorld(options);
  t.after(() => world.app.stop());
  const ack = await world.fake.action('search_stations', fields);
  assert.equal(ack.success, true);
  return { message: ack.data.message, world };
}

test('empty: the gauges around the house, nearest first, with their level', async (t) => {
  const { message } = await search(t, {}, {});
  const lines = message.de.split('\n');
  assert.equal(lines[0], '1 Station(en). Kopiere die Nummern in „Stationen“ und speichere:');
  assert.equal(lines[1], '2730010 — Köln (Rhein, km 688), 0,9 km, 64 cm');
});

test('a larger radius', async (t) => {
  const { message } = await search(t, { radius: '50' });
  assert.deepEqual(
    message.en
      .split('\n')
      .slice(1)
      .map((line) => line.split(' — ')[0]),
    ['2730010', '2710080', '2750010', '27100700'],
  );
});

test('a river, then a river and a name; umlauts and case ignored', async (t) => {
  const { message } = await search(t, { query: 'mosel' }, { houses: [] });
  assert.match(message.fr, /^10 sur 30 station\(s\)\./);
  assert.match(message.fr.split('\n')[1], /^\d+ — .* \(Mosel, km /);
  const both = await search(t, { query: 'Rhein koeln' }, { houses: [] });
  assert.equal(both.message.en.split('\n').length, 2);
  assert.match(both.message.en, /2730010 — Köln \(Rhein, km 688\), 64 cm/);
});

test('a gauge number and a page address', async (t) => {
  const { message } = await search(t, { query: KOELN_NUMBER });
  assert.match(message.en, /2730010 — Köln/);
  const page = await search(t, {
    query: 'https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=10091008',
  });
  assert.match(page.message.en, /10091008 — Passau Donau \(Donau, km 2[.,]226[.,]7\)/);
});

test('a stale gauge says so', async (t) => {
  const { message } = await search(t, { query: 'Mellumplate' });
  assert.match(message.en, /9420010 — Mellumplate \(Jade, km 31[.,]1\), .* no recent reading/);
});

test('nothing found, no located house, PEGELONLINE unavailable', async (t) => {
  assert.equal((await search(t, { query: 'Seine' })).message.en, 'No station found.');
  assert.match((await search(t, {}, { houses: [] })).message.fr, /^Votre maison n'a pas/);
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.api.down = 'network';
  const ack = await world.fake.action('search_stations', { query: 'Rhein' });
  assert.match(ack.data.message.en, /PEGELONLINE does not answer/);
});

test('one info line per search, without the house coordinates', async (t) => {
  const lines = captureLogs(t, 'debug');
  await search(t, { radius: '50' });
  const info = lines.filter((line) => line.level === 'info').map((line) => line.text);
  assert.ok(info.some((text) => /Station search: 4 station\(s\) found/.test(text)));
  const all = lines.map((line) => line.text).join('\n');
  assert.doesNotMatch(all, new RegExp(String(HOUSE.latitude).replace('.', '\\.')));
});
