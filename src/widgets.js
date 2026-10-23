// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `stations`.
//
// Without setting, one status line per followed station (10 at most): the
// water level and its trend, coloured by its state (closed palette of the
// widgets: high or above the navigable level danger, normal success, low info;
// neutral without a state or without a recent reading). A heading names the
// stations in high water.
//
// With a station chosen in the settings: its live water level, flow and water
// temperature tiles (bound to the device features), then its state,
// navigation level, trend and last reading.
//
// Both end with the source and its date and a link to PEGELONLINE.
// Budget: 2 texts, 1 status, 3 tiles, 1 button.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { stationIds, stationUuidOfId } from './devices.js';
import { STATE_NAMES, TREND_NAMES, formatDate, formatHeight } from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { SITE_URL, stationPage } from './pegelonline.js';

export const MAX_STATUS_ITEMS = 10;
export const TTL_SECONDS = 300;
const MAX_STATUS_TEXT = 40;

export const TEXT = {
  empty: {
    en: 'No station yet: fill in the configuration of the PEGELONLINE integration, then create the devices in the Discover tab.',
    fr: "Aucune station pour l'instant : remplissez la configuration de l'intégration PEGELONLINE, puis créez les appareils dans l'onglet Découverte.",
    de: 'Noch keine Station: Fülle die Konfiguration der Integration PEGELONLINE aus und lege dann die Geräte im Tab „Entdecken“ an.',
    es: 'Aún no hay estaciones: rellene la configuración de la integración PEGELONLINE y, después, cree los dispositivos en la pestaña Descubrir.',
  },
  gone: {
    en: 'This station is no longer followed.',
    fr: "Cette station n'est plus suivie.",
    de: 'Diese Station wird nicht mehr verfolgt.',
    es: 'Esta estación ya no se sigue.',
  },
  alert: {
    en: 'High water: ',
    fr: 'Hautes eaux : ',
    de: 'Hochwasser: ',
    es: 'Aguas altas: ',
  },
  height: { en: 'Water level', fr: "Hauteur d'eau", de: 'Wasserstand', es: 'Nivel del agua' },
  flow: { en: 'Flow', fr: 'Débit', de: 'Abfluss', es: 'Caudal' },
  waterTemperature: { en: 'Water', fr: 'Eau', de: 'Wasser', es: 'Agua' },
  state: { en: 'State', fr: 'État', de: 'Lage', es: 'Estado' },
  navigation: {
    en: 'Navigation (HSW)',
    fr: 'Navigation (HSW)',
    de: 'Schifffahrt (HSW)',
    es: 'Navegación (HSW)',
  },
  belowHsw: { en: 'Below HSW', fr: 'Sous la HSW', de: 'Unter HSW', es: 'Bajo el HSW' },
  aboveHsw: { en: 'Above HSW', fr: 'Au-dessus de la HSW', de: 'Über HSW', es: 'Sobre el HSW' },
  trend: { en: 'Trend', fr: 'Tendance', de: 'Tendenz', es: 'Tendencia' },
  lastReading: {
    en: 'Last reading',
    fr: 'Dernière mesure',
    de: 'Letzte Messung',
    es: 'Última medición',
  },
  silent: {
    en: 'Silent since ',
    fr: 'Muette depuis le ',
    de: 'Still seit ',
    es: 'Sin datos desde ',
  },
  waiting: { en: 'Waiting', fr: 'En attente', de: 'Wartet', es: 'En espera' },
  unknown: { en: 'Unknown', fr: 'Inconnu', de: 'Unbekannt', es: 'Desconocido' },
  source: {
    en: 'Source: PEGELONLINE (WSV)',
    fr: 'Source : PEGELONLINE (WSV)',
    de: 'Quelle: PEGELONLINE (WSV)',
    es: 'Fuente: PEGELONLINE (WSV)',
  },
  site: { en: 'PEGELONLINE', fr: 'PEGELONLINE', de: 'PEGELONLINE', es: 'PEGELONLINE' },
};

const t = (text, language) => text[language] ?? text.en;
const clip = (text, max = MAX_STATUS_TEXT) =>
  text.length <= max ? text : `${text.slice(0, max - 1)}…`;

const TREND_ICONS = { rising: 'trending-up', falling: 'trending-down', steady: 'minus' };
const STATE_COLORS = {
  low: WIDGET_COLORS.INFO,
  normal: WIDGET_COLORS.SUCCESS,
  high: WIDGET_COLORS.DANGER,
};

/** A station in high water: above MHW, or above the highest navigable level. */
const isHigh = (view) => view.state === 'high' || view.navigation === 'high';

/** Colour of a station line: its state, when the reading is recent. */
function colorOf(view) {
  if (view.height === null) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (isHigh(view)) {
    return WIDGET_COLORS.DANGER;
  }
  return STATE_COLORS[view.state] ?? WIDGET_COLORS.NEUTRAL;
}

/** The status value of a station, e.g. "387 cm, steigt" (40 characters at most). */
export function stationValue(view, language) {
  if (view.lastReadingAt === null) {
    return t(TEXT.waiting, language);
  }
  if (view.height === null) {
    return clip(`${t(TEXT.silent, language)}${formatDate(view.lastReadingAt, language)}`);
  }
  const height = formatHeight(view.height, view.unit, language);
  return clip(view.trend ? `${height}, ${TREND_NAMES[language][view.trend]}` : height);
}

function footer(monitor, uuids, language, link) {
  const updated = monitor.updatedAt(uuids);
  const source = t(TEXT.source, language);
  return [
    {
      type: 'text',
      variant: 'caption',
      text: updated === null ? source : `${source} · ${formatDate(updated, language)}`,
    },
    { type: 'button', label: t(TEXT.site, language), icon: 'external-link', link: { url: link } },
  ];
}

function overview(monitor, uuids, language) {
  const views = uuids.slice(0, MAX_STATUS_ITEMS).map((uuid) => monitor.view(uuid));
  const components = [];
  const high = views.filter((view) => view.height !== null && isHigh(view));
  if (high.length > 0) {
    components.push({
      type: 'text',
      variant: 'heading',
      text: clip(`${t(TEXT.alert, language)}${high.map((view) => view.name).join(', ')}`, 100),
    });
  }
  components.push({
    type: 'status',
    items: views.map((view) => ({
      label: clip(view.name),
      value: stationValue(view, language),
      color: colorOf(view),
      icon: view.trend ? TREND_ICONS[view.trend] : 'clock',
    })),
  });
  return [...components, ...footer(monitor, uuids, language, SITE_URL)];
}

function detail(monitor, uuid, language) {
  const view = monitor.view(uuid);
  const ids = stationIds(monitor.gladys, uuid);
  const components = [];
  if (view.has.height) {
    components.push({ type: 'value', label: t(TEXT.height, language), device_feature: ids.height });
  }
  if (view.has.flow) {
    components.push({ type: 'value', label: t(TEXT.flow, language), device_feature: ids.flow });
  }
  if (view.has.water_temperature) {
    components.push({
      type: 'value',
      label: t(TEXT.waterTemperature, language),
      device_feature: ids.water_temperature,
    });
  }
  const items = [];
  if (view.has.state) {
    items.push({
      label: t(TEXT.state, language),
      value: view.state ? STATE_NAMES[language][view.state] : t(TEXT.unknown, language),
      color: view.state ? STATE_COLORS[view.state] : WIDGET_COLORS.NEUTRAL,
    });
  }
  if (view.has.navigation) {
    const above = view.navigation === 'high';
    items.push({
      label: t(TEXT.navigation, language),
      value:
        view.navigation === null
          ? t(TEXT.unknown, language)
          : t(above ? TEXT.aboveHsw : TEXT.belowHsw, language),
      color:
        view.navigation === null
          ? WIDGET_COLORS.NEUTRAL
          : above
            ? WIDGET_COLORS.DANGER
            : WIDGET_COLORS.SUCCESS,
    });
  }
  if (view.has.height) {
    items.push({
      label: t(TEXT.trend, language),
      value: view.trend ? TREND_NAMES[language][view.trend] : t(TEXT.unknown, language),
      icon: view.trend ? TREND_ICONS[view.trend] : 'minus',
      color: WIDGET_COLORS.NEUTRAL,
    });
  }
  items.push({
    label: t(TEXT.lastReading, language),
    value:
      view.lastReadingAt === null
        ? t(TEXT.waiting, language)
        : formatDate(view.lastReadingAt, language),
    color: view.fresh ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.WARNING,
    icon: 'clock',
  });
  components.push({ type: 'status', items });
  const link = view.number ? stationPage(view.number) : SITE_URL;
  return [...components, ...footer(monitor, [uuid], language, link)];
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings, language = 'en' }) {
      const lang = STATE_NAMES[language] ? language : 'en';
      const created = monitor.created();
      const chosen = typeof settings?.station === 'string' ? settings.station : null;
      if (chosen) {
        const uuid = stationUuidOfId(monitor.gladys, chosen);
        const components =
          uuid && created.includes(uuid)
            ? detail(monitor, uuid, lang)
            : [{ type: 'text', variant: 'body', text: t(TEXT.gone, lang) }];
        return { ttl_seconds: TTL_SECONDS, components };
      }
      if (created.length === 0) {
        return {
          ttl_seconds: TTL_SECONDS,
          components: [{ type: 'text', variant: 'body', text: t(TEXT.empty, lang) }],
        };
      }
      return { ttl_seconds: TTL_SECONDS, components: overview(monitor, created, lang) };
    },
  },
};
