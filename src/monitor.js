// -----------------------------------------------------------------------------
// The monitor: which gauges are followed, their readings, the states published
// to Gladys and the scene triggers. Everything the SDK handlers, the action and
// the widget need goes through it (src/app.js wires it).
//
// Followed stations: the "Stations" field and "around my house" of the
// configuration (MAX_STATIONS at most), plus every station whose device the
// user created (deleting the device stops following it).
//
// Scheduling: the devices are published with should_poll: false (the core does
// not poll external devices reliably, GladysAssistant/Gladys#3198). The monitor
// runs a cycle at the configured interval: ONE PEGELONLINE request for every
// followed gauge (current measurements and characteristic values). The station
// list, needed to resolve names and numbers and to find the gauges around the
// house, is downloaded only when needed and kept a week in memory.
//
// States: `publishChangedStates` sends only what changed, plus a heartbeat every
// 12 hours. A reading older than 6 hours is never sent again as if it were
// fresh: the values stop, the "Last reading" feature says since when.
//
// Logs: at info, only the lifecycle (start, stations followed, a gauge going
// silent or coming back, a state change). A failure that repeats at every
// cycle is logged once, then at debug until it recovers, with one line at
// recovery. LOG_LEVEL=debug shows every cycle. The coordinates of the house
// are never logged nor sent: the gauges around it are chosen locally.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { HOME_STATIONS, MAX_STATIONS, normalizeName } from './config.js';
import { LIQUID_STATE, buildDevice, capabilities, stationIds, stationUuidOfId } from './devices.js';
import { distanceKm } from './geo.js';
import { MARK_NAMES, READINGS, STATE_NAMES, STATUS, formatDate, join, render } from './messages.js';
import { LEVEL_STATES, MARKS, PegelOnline, SERIES } from './pegelonline.js';

const logger = createLogger({ name: 'pegelonline' });

export const WIDGET_KEY = 'stations';
export const TRIGGERS = {
  STATE_CHANGED: 'state_changed',
  MARK_CROSSED: 'mark_crossed',
  NAVIGATION_STOPPED: 'navigation_stopped',
  NAVIGATION_RESUMED: 'navigation_resumed',
};

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  // Without a newer reading, a value is not published again as a fresh one.
  // Some gauges deliver their 15-minute values in batches, a few hours late.
  staleAfterMs: 6 * HOUR,
  // The station list (names, numbers, coordinates) is downloaded again after a week.
  referentialMaxAgeMs: 7 * DAY,
  // A failed download of the station list is tried again after this delay.
  referentialRetryMs: HOUR,
  // The stations around the house are chosen again once a day.
  homeMaxAgeMs: DAY,
  // A state remembered for longer fires no trigger when it changes (restart).
  memoryMs: DAY,
  // Heights kept for the trend.
  historyMs: 3 * HOUR,
  heartbeatMs: 12 * HOUR,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
};

// Below this rise per hour, a level is steady: 1 cm (0.01 m).
const STEADY_PER_HOUR = { cm: 1, m: 0.01 };
// A level must go this far back below a mark before crossing it again counts:
// readings wobbling around the mark fire one event, not one per cycle.
const MARK_HYSTERESIS = { cm: 2, m: 0.02 };
// Gauges asked for a fresh reading when choosing those around the house.
const HOME_CANDIDATES = 15;

/**
 * Rising, steady or falling, from heights newest first (`{ t, v }`); null when
 * there is no height 45 minutes to 2 hours older than the newest.
 */
export function trendOf(heights, unit = 'cm') {
  const [latest] = heights;
  if (!latest) {
    return null;
  }
  const earlier = heights.find((point) => latest.t - point.t >= 45 * MINUTE);
  if (!earlier || latest.t - earlier.t > 2 * HOUR) {
    return null;
  }
  const perHour = (latest.v - earlier.v) / ((latest.t - earlier.t) / HOUR);
  const steady = STEADY_PER_HOUR[unit] ?? STEADY_PER_HOUR.m;
  if (perHour >= steady) {
    return 'rising';
  }
  return perHour <= -steady ? 'falling' : 'steady';
}

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js
   * @param {Function} [options.fetch] fetch, for PEGELONLINE
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.api = new PegelOnline({ fetch: fetchImpl });
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // The station list, in memory only: { stations, fetchedAt }.
    this.referential = null;
    this.referentialFailedAt = -Infinity;
    // Stations of the configuration, in order (field, then house).
    this.configured = [];
    this.problems = { unknown: [], noHouse: false, tooMany: false };
    this.resolved = false;
    this.lastCycleAt = -Infinity;
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.rerun = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1) {
      this.data = { ...emptyData(), ...saved };
    }
    // Scheduled first: a failure below must not leave the integration without cycles.
    this.schedule();
    await this.runCycle();
    await this.publishDiscovered();
    logger.info(
      `Started: ${this.followed().length} station(s) followed, refreshed every ${config.refreshMinutes} min`,
    );
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    if (!this.cycleTimer) {
      this.schedule();
    }
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates(this.created());
    this.requestRefresh();
  }

  async reconfigure(config) {
    const before = this.followed().join(',');
    this.config = config;
    this.data.home = null;
    this.resolved = false;
    // A cycle already running reads the old configuration: run another one after it.
    await this.runCycle({ again: true });
    await this.publishDiscovered();
    const after = this.followed();
    if (after.join(',') !== before) {
      logger.info(`Configuration saved: ${after.length} station(s) followed`);
    }
    this.schedule();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  save() {
    return this.store.save(this.data);
  }

  // --- Which stations ----------------------------------------------------------

  /** Station uuids whose device exists in Gladys. */
  created() {
    return [
      ...new Set(
        (this.gladys.devices ?? [])
          .map((device) => stationUuidOfId(this.gladys, device.external_id))
          .filter(Boolean),
      ),
    ];
  }

  isCreated(uuid) {
    const id = stationIds(this.gladys, uuid).device;
    return (this.gladys.devices ?? []).some((device) => device.external_id === id);
  }

  /** Every followed station: the configured ones, then the created ones. */
  followed() {
    return [...new Set([...this.configured, ...this.created()])];
  }

  /** What the integration knows of a station, a created device filling the gaps. */
  station(uuid) {
    const known = this.data.stations[uuid];
    if (known) {
      return known;
    }
    const device = (this.gladys.devices ?? []).find(
      (item) => stationUuidOfId(this.gladys, item.external_id) === uuid,
    );
    if (!device) {
      return null;
    }
    const param = (name) => device.params?.find((p) => p.name === name)?.value;
    const features = new Map(
      (device.features ?? []).map((f) => [f.external_id.split(':').pop(), f]),
    );
    const km = Number(param('RIVER_KM'));
    return {
      uuid,
      number: param('STATION_NUMBER') ?? null,
      name: device.name ?? uuid,
      river: param('RIVER') ?? null,
      km: param('RIVER_KM') !== undefined && Number.isFinite(km) ? km : null,
      has: {
        height: features.has('height'),
        heightUnit: features.get('height')?.unit === 'cm' ? 'cm' : 'm',
        flow: features.has('flow'),
        water_temperature: features.has('water_temperature'),
        air_temperature: features.has('air_temperature'),
        state: features.has('state'),
        navigation: features.has('navigation'),
      },
    };
  }

  /** The station list, downloaded when missing or a week old; null when unavailable. */
  async stationList() {
    const now = this.now();
    const fresh =
      this.referential && now - this.referential.fetchedAt < this.timings.referentialMaxAgeMs;
    if (fresh || now - this.referentialFailedAt < this.timings.referentialRetryMs) {
      return this.referential?.stations ?? null;
    }
    try {
      const stations = await this.api.referential();
      this.referential = { stations, fetchedAt: now };
      this.recovered('referential', 'PEGELONLINE station list downloaded again');
      logger.debug(`Station list: ${stations.length} stations`);
    } catch (err) {
      this.referentialFailedAt = now;
      this.failed('referential', 'warn', `Cannot download the station list: ${err.message}`);
    }
    return this.referential?.stations ?? null;
  }

  /** The station a token of the configuration designates, from the list. */
  static find(stations, token) {
    if (token.kind === 'number') {
      return stations.find((station) => station.number === token.value) ?? null;
    }
    const wanted = normalizeName(token.value);
    return (
      stations.find((station) =>
        [station.shortname, station.longname, station.name].some(
          (name) => normalizeName(name) === wanted,
        ),
      ) ?? null
    );
  }

  /**
   * Resolve the configuration into station uuids. Uuids are taken as they
   * are (the readings say whether they exist); names and numbers need the
   * station list. Without it, the stations found before are kept.
   */
  async resolve() {
    const problems = { unknown: [], noHouse: false, tooMany: false };
    const uuids = [];
    const add = (uuid) => {
      if (!uuids.includes(uuid)) {
        uuids.push(uuid);
      }
    };
    const needList =
      this.config.homeRadiusKm > 0 || this.config.stations.some((token) => token.kind !== 'uuid');
    const stations = needList ? await this.stationList() : null;
    let complete = !needList || stations !== null;
    for (const token of this.config.stations) {
      if (token.kind === 'uuid') {
        add(token.value);
      } else if (stations) {
        const station = Monitor.find(stations, token);
        if (station) {
          add(station.uuid);
        } else {
          problems.unknown.push(token.text);
        }
      }
    }
    if (this.config.homeRadiusKm > 0 && stations) {
      try {
        const home = await this.homeStations(stations);
        if (home === null) {
          problems.noHouse = true;
        } else {
          home.forEach(add);
        }
        this.recovered('home', 'Stations around the house chosen again');
      } catch (err) {
        complete = false;
        this.failed(
          'home',
          'warn',
          `Cannot choose the stations around the house yet: ${err.message}`,
        );
      }
    }
    if (uuids.length > MAX_STATIONS) {
      problems.tooMany = true;
      uuids.length = MAX_STATIONS;
    }
    // A failed resolution keeps the stations found before it.
    this.configured = complete ? uuids : [...new Set([...this.configured, ...uuids])];
    this.problems = complete
      ? problems
      : { ...problems, unknown: [...new Set([...this.problems.unknown, ...problems.unknown])] };
    this.resolved = complete;
    for (const name of problems.unknown) {
      this.failed(`unknown:${name}`, 'warn', `Unknown station: ${name}`);
    }
  }

  /**
   * The first house of Gladys that has a location, or null. A failure to read
   * the houses throws with `strict` (the stations are chosen again later), and
   * resolves null otherwise (the search then asks for a location).
   */
  async house({ strict = false } = {}) {
    try {
      const houses = await this.gladys.getHouses();
      return (
        houses.find(
          (house) => Number.isFinite(house.latitude) && Number.isFinite(house.longitude),
        ) ?? null
      );
    } catch (err) {
      if (strict) {
        throw new Error(`cannot read the houses of Gladys: ${err.message}`);
      }
      this.failed('houses', 'warn', `Cannot read the houses of Gladys: ${err.message}`);
      return null;
    }
  }

  /** Stations of the list around a point, nearest first, with their distance. */
  static around(stations, origin, radiusKm) {
    return stations
      .filter((station) => station.latitude !== null && station.longitude !== null)
      .map((station) => ({
        station,
        km: distanceKm(origin.latitude, origin.longitude, station.latitude, station.longitude),
      }))
      .filter(({ km }) => km <= radiusKm)
      .sort((a, b) => a.km - b.km);
  }

  /**
   * The nearest gauges around the house that measure a water level and sent it
   * lately (HOME_STATIONS at most), chosen again once a day; null without a
   * located house.
   */
  async homeStations(stations) {
    const radius = this.config.homeRadiusKm;
    const cached = this.data.home;
    if (
      cached &&
      cached.radiusKm === radius &&
      this.now() - cached.at < this.timings.homeMaxAgeMs
    ) {
      return cached.uuids;
    }
    const house = await this.house({ strict: true });
    if (!house) {
      return null;
    }
    const candidates = Monitor.around(
      stations.filter((station) => station.series.W),
      house,
      radius,
    ).slice(0, HOME_CANDIDATES);
    const live = await this.api.stations(candidates.map(({ station }) => station.uuid));
    const uuids = candidates
      .map(({ station }) => live.get(station.uuid))
      .filter((station) => station && this.isFresh(station.series.W?.current?.t))
      .slice(0, HOME_STATIONS)
      .map((station) => {
        this.data.stations[station.uuid] ??= { ...station, fetchedAt: this.now() };
        return station.uuid;
      });
    // The house coordinates are not stored: only the radius and the stations.
    this.data.home = { radiusKm: radius, uuids, at: this.now() };
    return uuids;
  }

  // --- Discovery and connection status -----------------------------------------

  discoveredDevices() {
    return this.followed()
      .map((uuid) => this.station(uuid))
      .filter(Boolean)
      .map((station) => buildDevice(this.gladys, station, this.config.language));
  }

  async publishDiscovered() {
    await this.gladys.publishDiscoveredDevices(this.discoveredDevices());
  }

  async updateConnectionStatus() {
    const { unknown, noHouse, tooMany } = this.problems;
    const parts = [];
    // A failed weekly download of the list is harmless while the old list serves.
    if (this.failing.has('readings') || (this.failing.has('referential') && !this.referential)) {
      parts.push(render(STATUS, 'down'));
    }
    if (this.failing.has('home')) {
      parts.push(render(STATUS, 'homeFailed'));
    }
    if (unknown.length > 0) {
      parts.push(render(STATUS, 'unknown', { names: unknown.join(', ') }));
    }
    if (noHouse) {
      parts.push(render(STATUS, 'noHouse'));
    }
    if (tooMany) {
      parts.push(render(STATUS, 'tooMany', { max: MAX_STATIONS }));
    }
    if (this.resolved && this.followed().length === 0 && unknown.length === 0 && !noHouse) {
      parts.push(render(STATUS, 'none'));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    const connected = !this.failing.has('readings') && this.resolved;
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const uuid = stationUuidOfId(this.gladys, device.external_id);
    if (!uuid) {
      return;
    }
    if (!this.data.readings[uuid]) {
      await this.runCycle({ again: true });
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates([uuid]);
    this.requestRefresh();
  }

  async onDeviceDeleted() {
    // A station only followed through its device is no longer followed.
    await this.publishDiscovered();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    const uuid = stationUuidOfId(this.gladys, device.external_id);
    if (!uuid) {
      return;
    }
    // Read again only if the last cycle is older than half the interval.
    if (this.now() - this.lastCycleAt >= (this.config.refreshMinutes * MINUTE) / 2) {
      await this.runCycle();
    } else {
      await this.publishStates([uuid]);
    }
  }

  // --- Cycles ------------------------------------------------------------------

  /** Run a cycle; `again`: if one is running, run a new one once it is over. */
  runCycle({ again = false } = {}) {
    if (this.stopped) {
      return this.running;
    }
    if (this.running) {
      if (again) {
        this.rerun ??= this.running.then(() => {
          this.rerun = null;
          return this.runCycle();
        });
        return this.rerun;
      }
      return this.running;
    }
    this.running = this.cycle()
      .then(() => this.recovered('cycle', 'Refresh cycles work again'))
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  async cycle() {
    this.lastCycleAt = this.now();
    const before = this.discoveredKey();
    // Cheap when the station list is fresh: it is downloaded once a week.
    await this.resolve();
    const uuids = this.followed();
    const changed = await this.refreshReadings(uuids);
    this.forget(uuids);
    if (this.discoveredKey() !== before) {
      await this.publishDiscovered();
    }
    await this.publishStates(this.created());
    await this.updateConnectionStatus();
    await this.save();
    logger.debug(`Refresh cycle: ${uuids.length} station(s)`);
    if (changed) {
      this.requestRefresh();
    }
  }

  discoveredKey() {
    return JSON.stringify(this.discoveredDevices());
  }

  /** Drop what is kept of the stations no longer followed (the house ones change). */
  forget(followed) {
    for (const table of [this.data.stations, this.data.readings, this.data.memory]) {
      for (const uuid of Object.keys(table)) {
        if (!followed.includes(uuid)) {
          delete table[uuid];
        }
      }
    }
  }

  readingOf(uuid) {
    this.data.readings[uuid] ??= { history: [] };
    return this.data.readings[uuid];
  }

  isFresh(time) {
    return typeof time === 'number' && this.now() - time <= this.timings.staleAfterMs;
  }

  /** Read the stations from PEGELONLINE; resolves true when a reading changed. */
  async refreshReadings(uuids) {
    if (uuids.length === 0) {
      return false;
    }
    let live;
    try {
      live = await this.api.stations(uuids);
      this.recovered('readings', 'PEGELONLINE answers again');
    } catch (err) {
      this.failed('readings', 'warn', `PEGELONLINE unreachable: ${err.message}`);
      return false;
    }
    // Configured uuids PEGELONLINE does not know: shown in the status.
    const missing = this.configured.filter((uuid) => !live.has(uuid));
    if (missing.length > 0) {
      this.problems.unknown = [...new Set([...this.problems.unknown, ...missing])];
      for (const uuid of missing) {
        this.failed(`unknown:${uuid}`, 'warn', `Unknown station: ${uuid}`);
      }
    }
    let changed = false;
    for (const [uuid, station] of live) {
      this.data.stations[uuid] = { ...station, fetchedAt: this.now() };
      changed = (await this.fold(uuid, station)) || changed;
    }
    for (const uuid of uuids) {
      changed = this.noteSilence(uuid) || changed;
    }
    return changed;
  }

  /** Fold the current measurements of a station; fire the triggers of a new level. */
  async fold(uuid, station) {
    const reading = this.readingOf(uuid);
    let changed = false;
    for (const key of SERIES) {
      const current = station.series[key]?.current;
      if (!current || current.t < (reading[key]?.t ?? -Infinity)) {
        continue;
      }
      const isNew = reading[key]?.t !== current.t;
      changed ||= isNew || reading[key]?.v !== current.v;
      reading[key] = { t: current.t, v: current.v };
      if (key === 'W') {
        changed ||= reading.state !== current.state || reading.navigation !== current.navigation;
        reading.state = current.state;
        reading.navigation = current.navigation;
        if (isNew) {
          const unit = capabilities(station).heightUnit;
          reading.history = [
            { t: current.t, v: current.v },
            ...reading.history.filter(
              (point) => point.t < current.t && current.t - point.t <= this.timings.historyMs,
            ),
          ];
          const trend = trendOf(reading.history, unit);
          changed ||= trend !== reading.trend;
          reading.trend = trend;
          if (this.isFresh(current.t)) {
            await this.levelEvents(uuid, station, current);
          }
        }
      }
    }
    return changed;
  }

  /** One info line when a station goes silent, one when it comes back. */
  noteSilence(uuid) {
    const reading = this.readingOf(uuid);
    const silent = !this.isFresh(this.lastReadingAt(uuid));
    if (silent === reading.silent) {
      return false;
    }
    const wasKnown = reading.silent !== undefined;
    reading.silent = silent;
    if (silent) {
      reading.trend = null;
    }
    const name = this.station(uuid)?.name ?? uuid;
    if (!wasKnown) {
      logger.debug(`${name}: ${silent ? 'no recent reading' : 'readings are fresh'}`);
    } else if (silent) {
      logger.info(`${name}: no new reading for ${this.timings.staleAfterMs / HOUR} hours`);
    } else {
      logger.info(`${name}: readings are back`);
    }
    return true;
  }

  /** Last reading time of a station (ms), or null. */
  lastReadingAt(uuid) {
    const reading = this.data.readings[uuid];
    const times = SERIES.map((key) => reading?.[key]?.t).filter((t) => typeof t === 'number');
    return times.length > 0 ? Math.max(...times) : null;
  }

  // --- Scene triggers ------------------------------------------------------------

  /**
   * Compare a new water level with what is remembered: the low / normal / high
   * state, the navigation state and the side of every mark. A memory older than
   * a day (a long restart) is renewed without firing anything.
   */
  async levelEvents(uuid, station, current) {
    const memory = (this.data.memory[uuid] ??= { marks: {} });
    const now = this.now();
    const recent = (entry) => entry && now - entry.at <= this.timings.memoryMs;
    const events = [];

    if (LEVEL_STATES.includes(current.state)) {
      const previous = memory.state;
      memory.state = { value: current.state, at: now };
      if (recent(previous) && previous.value !== current.state) {
        logger.info(`${station.name}: water level ${previous.value} -> ${current.state}`);
        events.push([TRIGGERS.STATE_CHANGED, { state: current.state, previous: previous.value }]);
      }
    }

    if (LEVEL_STATES.includes(current.navigation)) {
      const above = current.navigation === 'high';
      const previous = memory.navigation;
      memory.navigation = { above, at: now };
      if (recent(previous) && previous.above !== above) {
        logger.info(
          `${station.name}: ${above ? 'above' : 'back below'} the highest navigable level`,
        );
        events.push([above ? TRIGGERS.NAVIGATION_STOPPED : TRIGGERS.NAVIGATION_RESUMED, {}]);
      }
    }

    const W = station.series.W;
    const unit = capabilities(station).heightUnit;
    const hysteresis = MARK_HYSTERESIS[unit] ?? MARK_HYSTERESIS.m;
    for (const mark of MARKS) {
      const value = W.marks[mark];
      if (value === undefined) {
        continue;
      }
      const previous = memory.marks[mark];
      let side;
      if (!recent(previous) || previous.value !== value) {
        side = current.v >= value ? 'above' : 'below';
      } else if (previous.side === 'below' && current.v >= value) {
        side = 'above';
        events.push([TRIGGERS.MARK_CROSSED, { mark, value, direction: 'rising' }]);
      } else if (previous.side === 'above' && current.v <= value - hysteresis) {
        side = 'below';
        events.push([TRIGGERS.MARK_CROSSED, { mark, value, direction: 'falling' }]);
      } else {
        side = previous.side;
      }
      memory.marks[mark] = { side, value, at: now };
    }

    if (events.length === 0 || !this.isCreated(uuid)) {
      return;
    }
    for (const [key, details] of events) {
      await this.gladys
        .publishSceneEvent(key, this.eventData(key, uuid, station, current, details, W, unit))
        .catch((err) => logger.warn(`${key} event refused: ${err.message}`));
    }
  }

  eventData(key, uuid, station, current, details, W, unit) {
    const language = this.config.language;
    const base = {
      station: stationIds(this.gladys, uuid).device,
      station_name: station.name,
      river: station.river ?? null,
      height: current.v,
      unit,
    };
    if (key === TRIGGERS.STATE_CHANGED) {
      return {
        ...base,
        state: details.state,
        state_name: STATE_NAMES[language][details.state],
        previous_state: details.previous,
        previous_state_name: STATE_NAMES[language][details.previous],
      };
    }
    if (key === TRIGGERS.MARK_CROSSED) {
      return {
        ...base,
        mark: details.mark,
        mark_name: MARK_NAMES[language][details.mark],
        mark_value: details.value,
        direction: details.direction,
      };
    }
    return { ...base, hsw: W.marks.HSW ?? null };
  }

  // --- States ------------------------------------------------------------------

  /** The states of the given stations whose device exists. */
  statesOf(uuids) {
    const states = [];
    const language = this.config.language;
    for (const uuid of uuids) {
      const station = this.station(uuid);
      if (!station || !this.isCreated(uuid)) {
        continue;
      }
      const ids = stationIds(this.gladys, uuid);
      const has = capabilities(station);
      const reading = this.data.readings[uuid] ?? {};
      const fresh = (key) => reading[key] && this.isFresh(reading[key].t);
      const push = (id, state) => states.push({ device_feature_external_id: id, state });
      if (has.height && fresh('W')) {
        push(ids.height, reading.W.v);
        if (has.state && LEVEL_STATES.includes(reading.state)) {
          push(ids.state, LIQUID_STATE[reading.state]);
        }
        if (has.navigation && LEVEL_STATES.includes(reading.navigation)) {
          push(ids.navigation, LIQUID_STATE[reading.navigation]);
        }
      }
      if (has.flow && fresh('Q')) {
        push(ids.flow, reading.Q.v);
      }
      if (has.water_temperature && fresh('WT')) {
        push(ids.water_temperature, reading.WT.v);
      }
      if (has.air_temperature && fresh('LT')) {
        push(ids.air_temperature, reading.LT.v);
      }
      const last = this.lastReadingAt(uuid);
      if (last !== null) {
        const date = formatDate(last, language);
        states.push({
          device_feature_external_id: ids.last_reading,
          text: this.isFresh(last) ? date : READINGS[language].staleSince({ date }),
        });
      }
    }
    return states;
  }

  async publishStates(uuids) {
    const states = this.statesOf(uuids);
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }

  /** What the widget shows of one station. */
  view(uuid) {
    const station = this.station(uuid) ?? { uuid, name: uuid, river: null, number: null };
    const has = capabilities(station);
    const reading = this.data.readings[uuid] ?? {};
    const last = this.lastReadingAt(uuid);
    const fresh = this.isFresh(last);
    const value = (key) => (reading[key] && this.isFresh(reading[key].t) ? reading[key].v : null);
    const height = value('W');
    return {
      uuid,
      number: station.number ?? null,
      name: station.name,
      river: station.river ?? null,
      has,
      unit: has.heightUnit ?? 'cm',
      height,
      flow: value('Q'),
      waterTemperature: value('WT'),
      state: height !== null && LEVEL_STATES.includes(reading.state) ? reading.state : null,
      navigation:
        height !== null && LEVEL_STATES.includes(reading.navigation) ? reading.navigation : null,
      trend: fresh ? (reading.trend ?? null) : null,
      lastReadingAt: last,
      fresh,
    };
  }

  /** The time of the newest reading shown, for the attribution. */
  updatedAt(uuids) {
    const times = uuids.map((uuid) => this.lastReadingAt(uuid)).filter((t) => t !== null);
    return times.length > 0 ? Math.max(...times) : null;
  }

  // --- Search -------------------------------------------------------------------

  /** Stations matching the words (name, river; accents, case and umlauts ignored). */
  static matches(station, words) {
    const haystack = normalizeName(
      `${station.shortname} ${station.longname} ${station.water ?? ''} ${station.river ?? ''}`,
    );
    return words.every((word) => haystack.includes(normalizeName(word)));
  }
}

function emptyData() {
  return {
    version: 1,
    stations: {},
    home: null,
    readings: {},
    memory: {},
  };
}
