# PEGELONLINE

Lleva a Gladys los **niveles de agua de las vías navegables federales alemanas** (Rin, Elba,
Danubio, Mosela, Meno, Weser, Óder, los canales y la costa: unas 800 estaciones), desde
**PEGELONLINE**, el servicio de datos abiertos de la Wasserstraßen- und
Schifffahrtsverwaltung des Bundes (WSV). Sin cuenta, sin clave.

> **Valores brutos: no es un servicio de alerta de crecidas.** Los datos pueden llegar tarde,
> faltar o ser erróneos, y la integración depende de su Gladys, de su acceso a Internet y de un
> servicio público. En caso de crecida, siga los avisos oficiales (servicio de avisos del Land,
> su municipio, 112). Esta integración no está afiliada a la WSV.

## Lo que obtiene

- **Un dispositivo por estación seguida**: el **nivel del agua** (en cm, como en
  pegelonline.wsv.de), el **caudal** en m³/s, las **temperaturas del agua y del aire** cuando
  la estación las mide, el **estado** del nivel (bajo, normal, alto) y el **nivel de
  navegación** (por debajo o por encima del nivel máximo de navegación, HSW) cuando la estación
  tiene esas referencias, y la fecha de la última medición.
- Una estación que deja de enviar se indica como tal («Sin nueva medición desde…»): un valor
  antiguo nunca se vuelve a enviar como si fuera reciente.
- Cuatro **disparadores de escena**: el estado cambia (bajo, normal, alto), se cruza un nivel de
  referencia (nivel medio, nivel alto medio, marcas de crecida I y II del Rin…), el nivel supera
  el nivel máximo de navegación y vuelve a bajar de él.
- Un **widget de panel**: sus estaciones, su nivel, su tendencia (sube, estable, baja) y su
  estado.
- Un botón **«Buscar estaciones»** que enumera las estaciones alrededor de su casa, por nombre,
  por río o por número, con su nivel actual.

## Requisitos

- Gladys Assistant **5.1.0** o posterior.
- Acceso a Internet desde Gladys: la integración lee `www.pegelonline.wsv.de`.
- Para «Alrededor de mi casa»: la ubicación de su casa en Gladys (Ajustes, Casas). La
  integración la solicita en la instalación (permiso «ubicación»). Solo se usa dentro del
  contenedor para encontrar las estaciones más cercanas: nunca se envía a PEGELONLINE, nunca se
  guarda ni se escribe en los registros.
- Solo Alemania: PEGELONLINE cubre las vías navegables federales, no los ríos menores de los
  Länder.

## Configuración

### Ajustes

| Ajuste                                 | Efecto                                                                                                                                           |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Estaciones                             | Números o nombres de estaciones, separados por comas: `2730010, Kaub, Passau Donau`. La dirección de la página de una estación también sirve.    |
| Alrededor de mi casa                   | Sigue también las 3 estaciones más cercanas que envían mediciones, a 10, 20 o 50 km de su casa.                                                  |
| Intervalo de actualización             | 15, 20 o 30 minutos. Una sola solicitud cubre todas las estaciones.                                                                              |
| Idioma de los nombres de las funciones | Nombres de las funciones de los nuevos dispositivos (Nivel del agua, Caudal…) e idioma del texto «Última medición» y de las variables de escena. |

Guarde, abra la pestaña **Descubrir** de la integración y cree los dispositivos que desee. Una
estación seguida lo sigue estando mientras exista su dispositivo, aunque la quite de la
configuración.

### Encontrar sus estaciones

Pulse **«Buscar estaciones»** en la configuración. Deje el campo vacío para listar las
estaciones alrededor de su casa (20 km o la distancia elegida), o escriba:

- un nombre de estación: `Köln`, `Koeln` o `KÖLN` (se ignoran mayúsculas, acentos y diéresis);
- un río: `Rhein`, `Mosel`, `Elbe` (las 10 más cercanas, o las 10 primeras en el orden del río);
- ambos: `Rhein Bonn`;
- un número de estación: `2730010`.

Cada línea indica el número, el nombre, el río y su kilómetro, la distancia a su casa y el
nivel actual, o «sin medición reciente». Copie los números en «Estaciones» y guarde.

## Dispositivos

| Función                    | Tipo en Gladys               | Valor                                                                                                       |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Nivel del agua             | Profundidad del líquido (cm) | Nivel sobre el cero de la escala, en cm; en m para las pocas estaciones referidas a una altitud.            |
| Caudal (m³/s)              | Caudal de agua               | En m³/s (Gladys no tiene unidad m³/s: el nombre lo indica).                                                 |
| Temperatura del agua       | Temperatura (°C)             | Cuando la estación la mide.                                                                                 |
| Temperatura del aire       | Temperatura (°C)             | Cuando la estación la mide.                                                                                 |
| Estado del nivel (MNW/MHW) | Estado del nivel             | Bajo por debajo del nivel bajo medio (MNW), Alto por encima del nivel alto medio (MHW), Normal entre ambos. |
| Nivel de navegación (HSW)  | Estado del nivel             | Alto por encima del nivel máximo de navegación (HSW), Normal por debajo.                                    |
| Última medición            | Texto                        | Fecha de la última medición, o «Sin nueva medición desde…».                                                 |

Una función solo existe si la estación la proporciona. El **nivel del agua no es una
profundidad**: es la lectura de la escala, sobre su propio cero. Compárelo con los niveles de
referencia de la misma estación (visibles en su página de PEGELONLINE), no con otra estación.
Los parámetros del dispositivo contienen el uuid de la estación, su número, su río y su
kilómetro.

El nivel, el caudal y las temperaturas son funciones numéricas: las escenas de Gladys ya pueden
compararlos con un valor propio («Nivel del agua por encima de 650 cm»).

## Widget de panel

Añada el widget **PEGELONLINE** a un panel.

- **Sin ajuste**: una línea por estación seguida (10 como máximo) con su nivel y su tendencia,
  coloreada según su estado: azul bajo, verde normal, rojo alto o por encima del nivel de
  navegación, gris sin estado o sin medición reciente. Un título nombra las estaciones en aguas
  altas.
- **Con una estación elegida**: su nivel, su caudal y la temperatura del agua en directo,
  después su estado, su nivel de navegación, su tendencia y su última medición, y un enlace a su
  página de PEGELONLINE.

## Disparadores de escena

| Disparador                                | Filtros                                                    | Variables                                                                                 |
| ----------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| El estado del nivel cambia                | Estación, nuevo estado (bajo, normal, alto)                | Nombre de la estación, río, nivel, unidad, estado, estado anterior (código y en palabras) |
| Nivel de referencia cruzado               | Estación, nivel, sentido (sube por encima, vuelve a bajar) | Nombre de la estación, río, nivel, unidad, código y nombre del nivel, su valor, sentido   |
| Por encima del nivel máximo de navegación | Estación                                                   | Nombre de la estación, río, nivel, unidad, HSW                                            |
| Vuelve bajo el nivel máximo de navegación | Estación                                                   | Nombre de la estación, río, nivel, unidad, HSW                                            |

Los niveles ofrecidos: NNW (mínimo histórico), MNW (nivel bajo medio), MW (nivel medio), MHW
(nivel alto medio), marcas de crecida I y II (Rin: navegación restringida y después detenida) y
HHW (máximo histórico). Una estación solo dispara los niveles que tiene. El nivel debe volver a
bajar 2 cm por debajo de un nivel antes de que cuente una nueva subida: un nivel que oscila
alrededor de un nivel de referencia dispara una sola vez. Los estados proceden del propio
PEGELONLINE.

Los disparadores solo actúan para un dispositivo creado, con una medición reciente, y no
después de un reinicio de más de un día.

## Ejemplos de escenas

- **Crecida del Rin**: «Nivel de referencia cruzado», estación Köln, nivel «Marca de crecida
  I», sube por encima → enviar un mensaje: «{{station_name}}: {{height}} {{unit}}, por encima
  de la {{mark_name}}».
- **Vigilancia del sótano**: «El estado del nivel cambia», su estación, nuevo estado Alto →
  encender el enchufe de la bomba y avisar a la familia.
- **Salida en barco**: «Por encima del nivel máximo de navegación», estación Kaub → mensaje
  «Navegación detenida en el {{river}}»; «Vuelve bajo el nivel máximo de navegación» →
  «Navegación abierta de nuevo».
- **Aguas bajas**: «El estado del nivel cambia», nuevo estado Bajo → un recordatorio para
  revisar las amarras.

## Fuentes, licencia y cuotas

- Datos: **PEGELONLINE**, Wasserstraßen- und Schifffahrtsverwaltung des Bundes (WSV), licencia
  **DL-DE->Zero-2.0** (uso libre, sin obligación de citar; el widget cita la fuente igualmente).
- Los valores son **datos brutos**, publicados antes de cualquier control por la WSV: pueden
  corregirse después.
- Sin cuenta, sin clave, sin cuota documentada. La integración es ligera: **una solicitud por
  actualización** para todas las estaciones seguidas (15 minutos por defecto, el intervalo de
  medición), y la lista de estaciones (unos 300 kB) una vez por semana, solo si los nombres, los
  números o «Alrededor de mi casa» la necesitan.

## Solución de problemas

- **«Estación desconocida»**: compruebe la ortografía o use «Buscar estaciones» y copie el
  número.
- **«PEGELONLINE no responde»**: el servicio o su acceso a Internet no funciona; los valores
  vuelven solos.
- **«Alrededor de mi casa» no añade nada**: indique la ubicación de su casa (Ajustes, Casas) o
  elija una distancia mayor: las estaciones alemanas pueden estar alejadas.
- **Sin estado ni nivel de navegación**: la estación no tiene referencia MNW/MHW o HSW (lagos,
  embalses, muchas estaciones de marea).
- **«Sin nueva medición desde…»**: la estación envía con retraso o no envía; algunas envían
  sus valores por lotes, con unas horas de retraso.
- Registros: en Gladys, los registros de la integración; `LOG_LEVEL=debug` muestra cada ciclo.

## Límites

- Desarrollada sin el hardware: sus comentarios son bienvenidos. Probada con respuestas
  grabadas del servicio real; aún sin prueba en directo en una instalación de Gladys.
- Solo vías navegables federales: ninguna estación de los servicios de los Länder (por ejemplo,
  los centros de previsión de crecidas de Baviera o de Baden-Wurtemberg).
- Sin previsiones: PEGELONLINE solo publica mediciones.
- 20 estaciones como máximo desde la configuración (más aquellas cuyo dispositivo haya creado).
- Los nombres de las funciones se fijan al crear el dispositivo: cambiar el idioma después solo
  cambia los textos enviados a continuación.
