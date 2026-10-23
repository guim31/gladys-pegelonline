# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

### Added

- One Gladys device per PEGELONLINE gauge of the German federal waterways: water level (cm, or m
  for the gauges given above a datum), flow (m³/s), water and air temperatures when measured,
  state of the level (low, normal, high against MNW and MHW), navigation level (against the
  highest navigable water level HSW) and the date of the last reading. A gauge without a new
  reading for 6 hours says "No new reading since…" instead of showing an old value as fresh.
- Stations chosen by number, name (umlauts and case ignored) or page address, or the 3 nearest
  gauges that send readings around the house (10, 20 or 50 km), chosen without sending the house
  location anywhere.
- "Find stations" in the Configuration screen: around the house, by name, by river or by number,
  with the river kilometre, distance and current level.
- Scene triggers "Water level state changes", "Characteristic water level crossed" (NNW, MNW, MW,
  MHW, high water marks I and II, HHW; rising or falling), "Above the highest navigable level"
  and "Back below the highest navigable level".
- Dashboard widget "PEGELONLINE": followed gauges with level, trend and state, or the detail of
  one gauge.
- Refresh every 15, 20 or 30 minutes by the integration itself, with one request for all the
  gauges, without relying on Gladys polling.
- Texts and documentation in English, French, German and Spanish.
