// -----------------------------------------------------------------------------
// The PEGELONLINE client and the HTTP helper, on the recorded answer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HttpError, USER_AGENT, getJson } from '../src/http.js';
import { PegelOnline, parseStation, stationPage, titleCase } from '../src/pegelonline.js';
import { DRESDEN, KOELN, MELLUMPLATE, createApi, fixture } from './helpers/world.js';

const raw = (uuid) => fixture('pegelonline/stations-2026-10-23.json').find((s) => s.uuid === uuid);

test('a station: names in title case, river, series W/Q with marks in the unit of W', () => {
  const station = parseStation(raw(KOELN));
  assert.equal(station.name, 'Köln');
  assert.equal(station.river, 'Rhein');
  assert.equal(station.number, '2730010');
  assert.deepEqual(Object.keys(station.series), ['Q', 'W']);
  assert.deepEqual(station.series.W.current, {
    t: Date.parse('2026-10-23T15:00:00+02:00'),
    v: 64,
    state: 'low',
    navigation: 'normal',
  });
  assert.equal(station.series.W.marks.HSW, 830);
  assert.equal(station.series.W.marks.M_I, 620);
  assert.deepEqual(station.series.Q.marks, {});
  assert.equal(parseStation(raw(MELLUMPLATE)).series.W.current.state, 'commented');
  assert.equal(parseStation(raw(DRESDEN)).series.Q.current.v, 95.8);
});

test('title case keeps mixed-case names and gauge abbreviations', () => {
  assert.equal(titleCase('PASSAU DONAU'), 'Passau Donau');
  assert.equal(titleCase('Sankt Aldegund UP'), 'Sankt Aldegund UP');
  assert.equal(titleCase('FRANKFURT AM MAIN OP'), 'Frankfurt am Main OP');
  assert.equal(
    titleCase('BERLIN-SPANDAUER-SCHIFFFAHRTSKANAL'),
    'Berlin-Spandauer-Schifffahrtskanal',
  );
});

test('one request for several stations, with the measurements and the marks', async () => {
  const api = createApi();
  const client = new PegelOnline({ fetch: api.fetch });
  const stations = await client.stations([KOELN, DRESDEN, 'unknown-uuid']);
  assert.deepEqual([...stations.keys()].sort(), [DRESDEN, KOELN].sort());
  assert.equal(api.requests.length, 1);
  const params = api.requests[0].searchParams;
  assert.equal(params.get('includeCurrentMeasurement'), 'true');
  assert.equal(params.get('includeCharacteristicValues'), 'true');
  assert.deepEqual(await client.stations([]), new Map());
  assert.equal(api.requests.length, 1, 'no request for no station');
});

test('the station list carries the series but no measurement', async () => {
  const api = createApi();
  const list = await new PegelOnline({ fetch: api.fetch }).referential();
  assert.equal(list.length, 77);
  const koeln = list.find((s) => s.uuid === KOELN);
  assert.deepEqual(Object.keys(koeln.series), ['Q', 'W']);
  assert.equal(koeln.series.W.current, null);
  assert.equal(api.requests[0].searchParams.get('includeCurrentMeasurement'), null);
});

test('HTTP failures become an HttpError: status, network, timeout, not JSON', async () => {
  const answer = (status, text) => async () => ({ status, text: async () => text });
  await assert.rejects(getJson(answer(503, ''), 'https://x.test/a'), {
    name: 'HttpError',
    message: 'x.test: HTTP 503',
    status: 503,
  });
  await assert.rejects(getJson(answer(200, '<html>'), 'https://x.test/a'), {
    message: 'x.test: the answer is not JSON',
  });
  await assert.rejects(
    getJson(async () => {
      throw new TypeError('fetch failed');
    }, 'https://x.test/a'),
    { message: 'x.test: fetch failed' },
  );
  await assert.rejects(
    getJson(
      async () => {
        throw Object.assign(new Error('aborted'), { name: 'TimeoutError' });
      },
      'https://x.test/a',
      { timeoutMs: 5000 },
    ),
    (err) => err instanceof HttpError && err.message === 'x.test: no answer in 5 s',
  );
  await assert.rejects(
    new PegelOnline({ fetch: answer(200, '{}') }).stations([KOELN]),
    /unexpected/,
  );
});

test('every request names the integration and asks for JSON; the page of a gauge', async () => {
  let headers;
  await getJson(async (url, options) => {
    headers = options.headers;
    return { status: 200, text: async () => '[]' };
  }, 'https://x.test/a');
  assert.equal(headers['User-Agent'], USER_AGENT);
  assert.equal(headers.Accept, 'application/json');
  assert.equal(
    stationPage('2730010'),
    'https://www.pegelonline.wsv.de/gast/stammdaten?pegelnr=2730010',
  );
});
