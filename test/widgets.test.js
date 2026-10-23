// -----------------------------------------------------------------------------
// The `stations` dashboard widget: the content fits the core vocabulary and
// budget (validateWidgetContent, empty array = rendered as sent), every bound
// feature exists on a published device, and the colours follow the state.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WIDGET_COLORS, validateWidgetContent } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from '../src/config.js';
import { WIDGET_KEY } from '../src/monitor.js';
import { stationValue } from '../src/widgets.js';
import {
  EDERTALSPERRE,
  KOELN,
  MELLUMPLATE,
  PASSAU,
  create,
  createWorld,
  cycle,
} from './helpers/world.js';

async function worldWith(t, uuids) {
  const world = await createWorld({ config: { stations: uuids.join(',') } });
  t.after(() => world.app.stop());
  const devices = [];
  for (const uuid of uuids) {
    devices.push(await create(world, uuid));
  }
  return { world, devices };
}

async function content(world, settings = {}, language = 'fr') {
  const ack = await world.fake.widgetGet(WIDGET_KEY, { settings, language, units: 'metric' });
  assert.equal(ack.success, true);
  return ack.data.content;
}

const features = (devices) =>
  new Set(devices.flatMap((device) => device.features.map((feature) => feature.external_id)));

test('the overview: one line per station, valid in every language', async (t) => {
  const { world } = await worldWith(t, [KOELN, PASSAU, EDERTALSPERRE, MELLUMPLATE]);
  for (const language of LANGUAGES) {
    const widget = await content(world, {}, language);
    assert.deepEqual(validateWidgetContent(widget), [], language);
    assert.equal(widget.components.find((c) => c.type === 'status').items.length, 4);
  }
  const widget = await content(world, {}, 'de');
  const [koeln, passau, eder, mellum] = widget.components.find((c) => c.type === 'status').items;
  assert.deepEqual(koeln, {
    label: 'Köln',
    value: '64 cm',
    color: WIDGET_COLORS.INFO,
    icon: 'clock',
  });
  assert.equal(passau.value, '387 cm');
  assert.deepEqual([eder.value, eder.color], ['219,48 m', WIDGET_COLORS.NEUTRAL]);
  assert.deepEqual(
    [mellum.value, mellum.color],
    ['Still seit 11.10., 10:54', WIDGET_COLORS.NEUTRAL],
  );
  assert.match(
    widget.components.find((c) => c.type === 'text').text,
    /^Quelle: PEGELONLINE \(WSV\) · /,
  );
  assert.deepEqual(widget.components.at(-1).link, {
    url: 'https://www.pegelonline.wsv.de/gast/start',
  });
});

test('high water adds a heading and colours the station; the trend shows', async (t) => {
  const { world } = await worldWith(t, [KOELN, PASSAU]);
  for (const level of [700, 720, 740, 760, 780]) {
    world.api.setLevel(KOELN, world.clock.now(), level, { state: 'high', navigation: 'normal' });
    await cycle(world, 15);
  }
  const widget = await content(world, {}, 'en');
  assert.deepEqual(validateWidgetContent(widget), []);
  assert.deepEqual(widget.components[0], {
    type: 'text',
    variant: 'heading',
    text: 'High water: Köln',
  });
  const [koeln] = widget.components.find((c) => c.type === 'status').items;
  assert.deepEqual(koeln, {
    label: 'Köln',
    value: '780 cm, rising',
    color: WIDGET_COLORS.DANGER,
    icon: 'trending-up',
  });
});

test('the detail of a station: bound tiles, state, navigation, trend, last reading', async (t) => {
  const { world, devices } = await worldWith(t, [KOELN, PASSAU]);
  for (const language of LANGUAGES) {
    for (const device of devices) {
      const widget = await content(world, { station: device.external_id }, language);
      assert.deepEqual(validateWidgetContent(widget), [], `${language} ${device.name}`);
      for (const tile of widget.components.filter((c) => c.device_feature)) {
        assert.ok(features(devices).has(tile.device_feature), tile.device_feature);
      }
    }
  }
  const widget = await content(world, { station: devices[0].external_id }, 'fr');
  assert.deepEqual(
    widget.components.filter((c) => c.type === 'value').map((c) => c.label),
    ["Hauteur d'eau", 'Débit'],
  );
  assert.deepEqual(
    widget.components.find((c) => c.type === 'status').items.map((i) => [i.label, i.value]),
    [
      ['État', 'Faible'],
      ['Navigation (HSW)', 'Sous la HSW'],
      ['Tendance', 'Inconnu'],
      ['Dernière mesure', '23/10 15:00'],
    ],
  );
  assert.deepEqual(widget.components.at(-1).link, {
    url: 'https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=2730010',
  });
  const passau = await content(world, { station: devices[1].external_id }, 'es');
  assert.deepEqual(
    passau.components.filter((c) => c.type === 'value').map((c) => c.label),
    ['Nivel del agua', 'Agua'],
  );
});

test('no station yet, and a station no longer followed', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await content(world, {}, 'de');
  assert.match(empty.components[0].text, /^Noch keine Station/);
  const gone = await content(world, { station: 'pegelonline:station:nope' }, 'en');
  assert.equal(gone.components[0].text, 'This station is no longer followed.');
});

test('a status value never exceeds 40 characters', () => {
  const view = { lastReadingAt: Date.parse('2026-10-23T13:00:00Z'), height: null, unit: 'cm' };
  for (const language of LANGUAGES) {
    assert.ok(stationValue(view, language).length <= 40);
  }
  assert.equal(stationValue({ lastReadingAt: null }, 'fr'), 'En attente');
});
