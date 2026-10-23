// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, action
// messages, scene variables), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted".
// -----------------------------------------------------------------------------

import { LANGUAGES } from './config.js';

// Names of the low / normal / high states, as the Gladys front shows the
// level-sensor/liquid-state values.
export const STATE_NAMES = {
  en: { low: 'Low', normal: 'Normal', high: 'High' },
  fr: { low: 'Faible', normal: 'Normal', high: 'Élevé' },
  de: { low: 'Niedrig', normal: 'Normal', high: 'Hoch' },
  es: { low: 'Bajo', normal: 'Normal', high: 'Alto' },
};

// The characteristic water levels a scene can wait for (see MARKS).
export const MARK_NAMES = {
  en: {
    NNW: 'lowest low water (NNW)',
    MNW: 'mean low water (MNW)',
    MW: 'mean water (MW)',
    MHW: 'mean high water (MHW)',
    M_I: 'high water mark I',
    M_II: 'high water mark II',
    HHW: 'highest high water (HHW)',
  },
  fr: {
    NNW: 'plus basses eaux connues (NNW)',
    MNW: 'basses eaux moyennes (MNW)',
    MW: 'niveau moyen (MW)',
    MHW: 'hautes eaux moyennes (MHW)',
    M_I: 'cote de crue I',
    M_II: 'cote de crue II',
    HHW: 'plus hautes eaux connues (HHW)',
  },
  de: {
    NNW: 'niedrigster Niedrigwasserstand (NNW)',
    MNW: 'mittlerer Niedrigwasserstand (MNW)',
    MW: 'Mittelwasserstand (MW)',
    MHW: 'mittlerer Hochwasserstand (MHW)',
    M_I: 'Hochwassermarke I',
    M_II: 'Hochwassermarke II',
    HHW: 'höchster Hochwasserstand (HHW)',
  },
  es: {
    NNW: 'nivel mínimo histórico (NNW)',
    MNW: 'nivel bajo medio (MNW)',
    MW: 'nivel medio (MW)',
    MHW: 'nivel alto medio (MHW)',
    M_I: 'marca de crecida I',
    M_II: 'marca de crecida II',
    HHW: 'nivel máximo histórico (HHW)',
  },
};

export const TREND_NAMES = {
  en: { rising: 'rising', steady: 'steady', falling: 'falling' },
  fr: { rising: 'monte', steady: 'stable', falling: 'baisse' },
  de: { rising: 'steigt', steady: 'gleichbleibend', falling: 'fällt' },
  es: { rising: 'sube', steady: 'estable', falling: 'baja' },
};

// Values of the "Last reading" feature.
export const READINGS = {
  en: { staleSince: ({ date }) => `No new reading since ${date}` },
  fr: { staleSince: ({ date }) => `Pas de nouvelle mesure depuis le ${date}` },
  de: { staleSince: ({ date }) => `Keine neue Messung seit ${date}` },
  es: { staleSince: ({ date }) => `Sin nueva medición desde el ${date}` },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    down: 'PEGELONLINE does not answer: the readings will come back with it.',
    unknown: ({ names }) => `Unknown station: ${names}. Use "Find stations".`,
    noHouse: 'Around my house: give your house a location in Gladys (Settings, Houses).',
    tooMany: ({ max }) => `Only the first ${max} stations are followed.`,
    none: 'No station yet: fill in the configuration, or use "Find stations".',
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    down: 'PEGELONLINE ne répond pas : les mesures reviendront avec lui.',
    unknown: ({ names }) => `Station inconnue : ${names}. Utilisez « Chercher des stations ».`,
    noHouse:
      'Autour de ma maison : indiquez la position de votre maison dans Gladys (Paramètres, Maisons).',
    tooMany: ({ max }) => `Seules les ${max} premières stations sont suivies.`,
    none: 'Aucune station : remplissez la configuration, ou utilisez « Chercher des stations ».',
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    down: 'PEGELONLINE antwortet nicht: Die Messwerte kommen mit ihm zurück.',
    unknown: ({ names }) => `Unbekannte Station: ${names}. Nutze „Stationen suchen“.`,
    noHouse: 'Rund um mein Haus: Gib deinem Haus in Gladys einen Standort (Einstellungen, Häuser).',
    tooMany: ({ max }) => `Nur die ersten ${max} Stationen werden verfolgt.`,
    none: 'Noch keine Station: Fülle die Konfiguration aus oder nutze „Stationen suchen“.',
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    down: 'PEGELONLINE no responde: las mediciones volverán con él.',
    unknown: ({ names }) => `Estación desconocida: ${names}. Use «Buscar estaciones».`,
    noHouse: 'Alrededor de mi casa: indique la ubicación de su casa en Gladys (Ajustes, Casas).',
    tooMany: ({ max }) => `Solo se siguen las ${max} primeras estaciones.`,
    none: 'Aún no hay estaciones: rellene la configuración o use «Buscar estaciones».',
  },
};

// Messages of the "Find stations" action.
export const SEARCH = {
  en: {
    noHouse:
      'Your house has no location in Gladys: type a station name, a river (Rhein, Elbe…) or a gauge number.',
    none: 'No station found.',
    found: ({ count, total }) =>
      `${total > count ? `${count} of ${total}` : count} station(s). Copy the numbers into "Stations", then save:`,
    unavailable: 'PEGELONLINE does not answer, try again in a few minutes.',
    noRecent: 'no recent reading',
  },
  fr: {
    noHouse:
      "Votre maison n'a pas de position dans Gladys : tapez un nom de station, un cours d'eau (Rhein, Elbe…) ou un numéro de station.",
    none: 'Aucune station trouvée.',
    found: ({ count, total }) =>
      `${total > count ? `${count} sur ${total}` : count} station(s). Copiez les numéros dans « Stations », puis enregistrez :`,
    unavailable: 'PEGELONLINE ne répond pas, réessayez dans quelques minutes.',
    noRecent: 'pas de mesure récente',
  },
  de: {
    noHouse:
      'Dein Haus hat in Gladys keinen Standort: Gib einen Stationsnamen, ein Gewässer (Rhein, Elbe…) oder eine Pegelnummer ein.',
    none: 'Keine Station gefunden.',
    found: ({ count, total }) =>
      `${total > count ? `${count} von ${total}` : count} Station(en). Kopiere die Nummern in „Stationen“ und speichere:`,
    unavailable: 'PEGELONLINE antwortet nicht, versuche es in ein paar Minuten erneut.',
    noRecent: 'keine aktuelle Messung',
  },
  es: {
    noHouse:
      'Su casa no tiene ubicación en Gladys: escriba el nombre de una estación, un río (Rhein, Elbe…) o un número de estación.',
    none: 'No se ha encontrado ninguna estación.',
    found: ({ count, total }) =>
      `${total > count ? `${count} de ${total}` : count} estación(es). Copie los números en «Estaciones» y guarde:`,
    unavailable: 'PEGELONLINE no responde, inténtelo de nuevo en unos minutos.',
    noRecent: 'sin medición reciente',
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

/** A date in the user's time zone (TZ, set by the Gladys supervisor), e.g. "13/10 18:35". */
export function formatDate(time, language) {
  return new Intl.DateTimeFormat(language === 'en' ? 'en-GB' : language, {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(time));
}

/** A number in the user's language, e.g. "2,59" in French. */
export function formatNumber(value, language, digits = 2) {
  return new Intl.NumberFormat(language === 'en' ? 'en-GB' : language, {
    maximumFractionDigits: digits,
  }).format(value);
}

/** A water level with its unit, e.g. "387 cm" or "56,51 m". */
export function formatHeight(value, unit, language) {
  return unit === 'cm'
    ? `${formatNumber(value, language, 0)} cm`
    : `${formatNumber(value, language)} m`;
}
