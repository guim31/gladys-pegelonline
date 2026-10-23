# PEGELONLINE

Brings the **water levels of the German federal waterways** (Rhine, Elbe, Danube, Moselle,
Main, Weser, Oder, the canals and the coast: about 800 gauges) into Gladys, from
**PEGELONLINE**, the open data service of the Wasserstraßen- und Schifffahrtsverwaltung des
Bundes (WSV). No account, no key.

> **Raw values, not a flood warning service.** Data can be late, missing or wrong, and the
> integration depends on your Gladys, your Internet access and a public service. In a flood,
> follow the official warnings (the flood warning service of your Land, your municipality,
> 112). This integration is not affiliated with the WSV.

## What you get

- **One device per gauge** you follow: the **water level** (in cm, as on pegelonline.wsv.de),
  the **flow** in m³/s, the **water and air temperatures** when the gauge measures them, the
  **state** of the level (low, normal, high) and the **navigation level** (below or above the
  highest navigable water level, HSW) when the gauge has these references, and the date of
  the last reading.
- A gauge that stops sending is shown as such ("No new reading since…"): an old value is never
  sent again as if it were fresh.
- Four **scene triggers**: the state changes (low, normal, high), a characteristic water level
  is crossed (mean water, mean high water, high water marks I and II of the Rhine…), the level
  rises above the highest navigable level, and falls back below it.
- A **dashboard widget**: your gauges, their level, its trend (rising, steady, falling) and
  their state.
- A **"Find stations"** button that lists the gauges around your house, by name, by river or by
  number, with their current level.

## Requirements

- Gladys Assistant **5.1.0** or later.
- Internet access from Gladys: the integration reads `www.pegelonline.wsv.de`.
- For "around my house": the location of your house in Gladys (Settings, Houses). The
  integration asks for it at installation (the "location" permission). It is only used inside
  the container to find the nearest gauges: never sent to PEGELONLINE, never stored nor logged.
- Germany only: PEGELONLINE covers the federal waterways, not the smaller rivers of the Länder.

## Configuration

### Settings

| Setting                       | What it does                                                                                                                   |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Stations                      | Gauge numbers or station names, separated by commas: `2730010, Kaub, Passau Donau`. The address of a gauge page also works.    |
| Around my house               | Also follows the 3 nearest gauges that send readings, within 10, 20 or 50 km of your house.                                    |
| Refresh interval              | 15, 20 or 30 minutes. One request covers every station.                                                                        |
| Language of the feature names | Names of the features of new devices (Water level, Flow…), and language of the "Last reading" text and of the scene variables. |

Save, then open the **Discover** tab of the integration and create the devices you want. A
followed station stays followed as long as its device exists, even if you remove it from the
configuration.

### Finding your stations

Click **"Find stations"** in the configuration. Leave the field empty to list the gauges around
your house (20 km, or the distance chosen), or type:

- a station name: `Köln`, `Koeln` or `KÖLN` (case, accents and umlauts are ignored);
- a river: `Rhein`, `Mosel`, `Elbe` (the 10 nearest, or the first 10 in river order);
- both: `Rhein Bonn`;
- a gauge number: `2730010`.

Each line gives the number, the name, the river and its kilometre, the distance from your house
and the current level, or "no recent reading". Copy the numbers into "Stations", then save.

## Devices

| Feature                     | Type in Gladys     | Value                                                                                     |
| --------------------------- | ------------------ | ----------------------------------------------------------------------------------------- |
| Water level                 | Liquid depth (cm)  | Level above the gauge zero, in cm; in m for the few gauges given above a datum.           |
| Flow (m³/s)                 | Water flow         | In m³/s (Gladys has no m³/s unit: the name says it).                                      |
| Water temperature           | Temperature (°C)   | When the gauge measures it.                                                               |
| Air temperature             | Temperature (°C)   | When the gauge measures it.                                                               |
| Water level state (MNW/MHW) | Liquid level state | Low below the mean low water (MNW), High above the mean high water (MHW), Normal between. |
| Navigation level (HSW)      | Liquid level state | High above the highest navigable water level (HSW), Normal below.                         |
| Last reading                | Text               | Date of the last measurement, or "No new reading since…".                                 |

A feature only exists when the gauge provides it. The **water level is not a depth**: it is the
reading of the gauge staff, above its own zero. Compare it with the characteristic levels of
the same gauge (visible on its PEGELONLINE page), not with another gauge. The device
parameters hold the station uuid, its number, its river and its kilometre.

The water level, flow and temperatures are numeric features: Gladys scenes can already compare
them with any value of your own ("Water level above 650 cm").

## Dashboard widget

Add the **PEGELONLINE** widget to a dashboard.

- **Without setting**: one line per followed gauge (10 at most) with its level and trend,
  coloured by its state: blue low, green normal, red high or above the navigable level, grey
  without a state or without a recent reading. A heading lists the gauges in high water.
- **With a station chosen**: its live level, flow and water temperature, then its state,
  navigation level, trend and last reading, and a link to its PEGELONLINE page.

## Scene triggers

| Trigger                                | Filters                                    | Variables                                                                         |
| -------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------- |
| Water level state changes              | Station, new state (low, normal, high)     | Station name, river, water level, unit, state, previous state (code and words)    |
| Characteristic water level crossed     | Station, mark, direction (rising, falling) | Station name, river, water level, unit, mark code and words, its value, direction |
| Above the highest navigable level      | Station                                    | Station name, river, water level, unit, HSW                                       |
| Back below the highest navigable level | Station                                    | Station name, river, water level, unit, HSW                                       |

The marks offered: NNW (lowest known), MNW (mean low), MW (mean), MHW (mean high), high water
marks I and II (Rhine: navigation restricted, then stopped) and HHW (highest known). A gauge
only fires the marks it has. A level must go 2 cm back below a mark before a new rise counts:
a level wobbling around a mark fires once. The states come from PEGELONLINE itself.

Triggers only fire for a device you created, on a fresh reading, and not after a restart longer
than a day.

## Scene examples

- **Rhine flood**: "Characteristic water level crossed", station Köln, mark "High water mark
  I", rising → send a message: "{{station_name}}: {{height}} {{unit}}, above {{mark_name}}".
- **Cellar watch**: "Water level state changes", your gauge, new state High → switch on the
  pump socket and notify the family.
- **Boat trip**: "Above the highest navigable level", station Kaub → message "No navigation on
  the {{river}}"; "Back below the highest navigable level" → "Navigation open again".
- **Low water**: "Water level state changes", new state Low → a reminder to check the moorings.

## Data sources, licence and quotas

- Data: **PEGELONLINE**, Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), licence
  **DL-DE->Zero-2.0** (free use, no attribution required; the widget names the source anyway).
- Values are **raw data**, published before any check by the WSV: they can be corrected later.
- No account, no key, no documented quota. The integration stays light: **one request per
  refresh** for every followed gauge (15 minutes by default, the measurement interval), and the
  station list (about 300 kB) once a week, only when names, numbers or "around my house" need
  it.

## Troubleshooting

- **"Unknown station"**: check the spelling or use "Find stations", then copy the number.
- **"PEGELONLINE does not answer"**: the service or your Internet access is down; the values
  come back by themselves.
- **"Around my house" adds nothing**: give your house a location (Settings, Houses), or choose
  a larger distance: German gauges can be far apart.
- **No state or navigation feature**: the gauge has no MNW/MHW or HSW reference (lakes,
  reservoirs, many tidal gauges).
- **"No new reading since…"**: the gauge sends late or not at all; some send their values in
  batches, a few hours late.
- Logs: in Gladys, the integration logs; set `LOG_LEVEL=debug` for every cycle.

## Limits

- Developed without the hardware: feedback welcome. Tested against recorded answers of the real
  service; no live test in a Gladys installation yet.
- Federal waterways only: no gauge of the Länder services (for instance the Bavarian or
  Baden-Württemberg flood centres).
- No forecasts: PEGELONLINE publishes measurements only.
- 20 stations at most from the configuration (plus the ones whose device you created).
- The feature names are frozen when the device is created: changing the language later only
  changes the texts sent afterwards.
