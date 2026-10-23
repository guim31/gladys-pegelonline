// -----------------------------------------------------------------------------
// The configuration: tokens of the "Stations" field, name comparison, defaults.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_CONFIG, normalizeConfig, normalizeName, parseStations } from '../src/config.js';

test('station tokens: numbers, uuids, page addresses and names with spaces', () => {
  const tokens = parseStations(
    '2730010, Passau Donau; A6EE8177-107B-47DD-BCFD-30960CCC6E9C\n' +
      'https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=25700100,' +
      'https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations/9f12c405-35ac-4d90-9b7b-023be355867e.json, 2730010, ,',
  );
  assert.deepEqual(
    tokens.map(({ kind, value }) => [kind, value]),
    [
      ['number', '2730010'],
      ['name', 'Passau Donau'],
      ['uuid', 'a6ee8177-107b-47dd-bcfd-30960ccc6e9c'],
      ['number', '25700100'],
      ['uuid', '9f12c405-35ac-4d90-9b7b-023be355867e'],
    ],
  );
});

test('names compare without case, accents, umlauts nor punctuation', () => {
  assert.equal(normalizeName('KÖLN'), normalizeName('Koeln'));
  assert.equal(normalizeName('köln'), 'koln');
  assert.equal(normalizeName('Straßburg'), normalizeName('STRASSBURG'));
  assert.equal(normalizeName('Sankt  Aldegund-UP'), 'sankt aldegund up');
});

test('defaults, and unknown values fall back to them', () => {
  assert.deepEqual(normalizeConfig({}), {
    stations: [],
    homeRadiusKm: 0,
    refreshMinutes: 15,
    language: DEFAULT_CONFIG.language,
  });
  const config = normalizeConfig({ around_home: '7', refresh_interval: '1', language: 'it' });
  assert.deepEqual([config.homeRadiusKm, config.refreshMinutes, config.language], [0, 15, 'fr']);
  assert.equal(normalizeConfig({ around_home: '50', refresh_interval: '30' }).homeRadiusKm, 50);
  assert.deepEqual(normalizeConfig(null).stations, []);
});
