# PEGELONLINE for Gladys Assistant

An external integration for [Gladys Assistant](https://gladysassistant.com) that brings the
**water levels of the German federal waterways** (Rhine, Elbe, Danube, Moselle, Main, Weser,
Oder, canals and coast: about 800 gauges) into Gladys, from
[PEGELONLINE](https://www.pegelonline.wsv.de), the open data service of the
Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV). Public open data, no account, no
key.

> **Raw values, not a flood warning service.** Data can be late, missing or wrong. In a flood,
> follow the official warnings. Not affiliated with the WSV.

Promised to ruegerth on the Gladys forum, as the German counterpart of
[gladys-vigicrues](https://github.com/guim31/gladys-vigicrues). For Swiss rivers and lakes, see
[LM1LC3N7/gladys-swiss-hydro](https://github.com/LM1LC3N7/gladys-swiss-hydro).

## Features

- **One device per gauge**: water level (cm, as on pegelonline.wsv.de; m for the few gauges
  given above a datum), flow (m³/s), water and air temperatures when measured, the state of the
  level (low below MNW, high above MHW, normal between: the Gladys "liquid level state"), the
  navigation level (above or below the highest navigable water level HSW) and the date of the
  last reading. A gauge that stops sending says so ("No new reading since…") instead of
  showing an old value as a fresh one.
- **Stations by number, by name or around your house** (the 3 nearest gauges that send
  readings, chosen inside the container from the location of your house in Gladys).
- **"Find stations"** in the Configuration screen: around your house, by name, by river
  ("Rhein", "Mosel Trier") or by number, with the river kilometre, distance and current level.
- **Scene triggers**: _Water level state changes_ (low, normal, high), _Characteristic water
  level crossed_ (NNW, MNW, MW, MHW, high water marks I and II, HHW; rising or falling, with a
  2 cm hysteresis on the fall), _Above the highest navigable level_ and _Back below_ it. A threshold of your
  own stays a Gladys device condition on the water level.
- **Dashboard widget**: the followed gauges with their level, trend and state, or the detail of
  one gauge with live tiles.
- Texts in English, French, German and Spanish.

## Requirements

- Gladys Assistant **5.1.0** or later (widgets and scene triggers).
- Internet access from Gladys to `www.pegelonline.wsv.de`.
- For "around my house": the location of your house in Gladys. The integration declares
  `location: true`, shown on the install screen.

## Installation

1. In Gladys, open **Integrations → Install from GitHub** and enter
   `https://github.com/guim31/gladys-pegelonline` (or install it from the catalog once it is
   listed). The install screen shows the **location** access it asks for.
2. In **Configuration**, press **Find stations**, copy the numbers you want into **Stations**
   (or choose **Around my house**), then save.
3. Open the **Discover** tab and press **Add to Gladys** on the gauges you want.

The user guide is in [`docs/en.md`](docs/en.md) ([français](docs/fr.md), [Deutsch](docs/de.md),
[español](docs/es.md)); Gladys links it from the Configuration screen.

## How it works

```
Integration container ──HTTPS──▶ www.pegelonline.wsv.de/webservices/rest-api/v2
      │                            stations.json?ids=…  one request per refresh
      │                            stations.json        station list, once a week
      │ SDK (WebSocket + host API)
      ▼
Gladys core ── devices, states, scene events, widget
```

- Devices are published with `should_poll: false` (the core does not poll external devices
  reliably, GladysAssistant/Gladys#3198): the integration refreshes itself every 15, 20 or 30
  minutes with **one** request for all the followed gauges (current measurement and
  characteristic values).
- The station list (~300 kB) is only downloaded when a name, a number or "around my house" needs
  it, and kept a week in memory. The house coordinates never leave the container.
- Only the changes are published, plus a heartbeat every 12 hours. After 6 hours without a new
  reading the values are no longer sent: Gladys shows their real age.
- `/data/pegelonline.json` keeps the followed gauges, the last readings (a few hours of levels
  for the trend) and the last states (so a change during a short restart still fires its
  trigger). Never the house coordinates.

## Limitations

- **Not a flood warning service.** No guarantee of delay or availability.
- **Not yet tested in a real Gladys installation: feedback welcome.** No hardware involved; tested against the live service and a recorded answer of PEGELONLINE (23/10/2026).
- Water levels are gauge readings above each gauge zero: not comparable between gauges, not
  depths.
- Federal waterways only (no gauges of the Länder services), no forecasts.
- 20 stations at most from the configuration (plus the ones whose device you created).

## Development

Node.js 22+, ESM, no build step. The only runtime dependency is
[`@gladysassistant/integration-sdk`](https://github.com/GladysAssistant/integration-sdk-js).

```bash
npm install
npm test              # node --test, against the SDK's fake Gladys and a recorded API answer
npm run lint
npm run format:check
npx github:GladysAssistant/integration-store --skip-image-check .   # store validator
```

```
index.js              SDK wiring (src/app.js registers the handlers)
src/app.js            handlers → monitor, configuration action, widget
src/monitor.js        followed gauges, refresh cycles, states, scene triggers
src/pegelonline.js    PEGELONLINE client and parsing
src/http.js           GET JSON with timeout and User-Agent
src/search.js         "Find stations" action
src/devices.js        Gladys device of a gauge (features, names)
src/widgets.js        dashboard widget
src/messages.js       texts sent from the container, four languages
src/geo.js            distances
src/store.js          /data persistence
src/config.js         configuration defaults and normalization
test/fixtures/        recorded PEGELONLINE answer (see its README)
```

Versions are bumped by the **Release** workflow (Actions → Release), never by hand.

## Credits

- Data: **PEGELONLINE**, Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), under the
  [Datenlizenz Deutschland – Zero – Version 2.0](https://www.govdata.de/dl-de/zero-2-0).
- The Home Assistant [`pegel_online`](https://www.home-assistant.io/integrations/pegel_online/)
  integration and its library [mib1185/aiopegelonline](https://github.com/mib1185/aiopegelonline)
  (both Apache-2.0), read for the API usage; no code copied.
- The cover shows the PEGELONLINE logo, from
  [pegelonline.wsv.de](https://www.pegelonline.wsv.de/gast/start), redrawn larger on the
  colours of the service.

Not affiliated with the WSV. PEGELONLINE is a service of the German federal waterways and
shipping administration.

## License

Apache-2.0, see [LICENSE](LICENSE).
