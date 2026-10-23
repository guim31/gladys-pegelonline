# Test fixtures

- `gladys-feature-table.json`: the category/type couples, units and poll frequencies the Gladys
  core and front know (extracted from the Gladys code), used by `test/gladys-rules.test.js`.
- `pegelonline/stations-2026-10-23.json`: a real answer of
  `https://www.pegelonline.wsv.de/webservices/rest-api/v2/stations.json?includeTimeseries=true&includeCurrentMeasurement=true&includeCharacteristicValues=true`,
  recorded on 23/10/2026 at 15:10 (Berlin) and kept as is (public data of public gauges, licence
  DL-DE->Zero-2.0), reduced to 77 of the 786 stations: the Rhine and the Moselle, the Elbe around
  Dresden, Passau on the Danube, three Eder gauges (one in m above a datum) and Mellumplate, a
  tidal gauge silent since 11/10. The Rhine was then below its lowest known level (NNW) at Köln.

`test/helpers/world.js` serves it as the API would (`ids` filter, `include…` flags) and lets the
tests set new levels and states.
