# Revisión y mejora — Control laboral (IVORY37)

He reescrito la app en un único `index.html` **sin dependencias externas** y con el mismo
esquema de datos y la misma clave de `localStorage` (`ivory37_data_v1`), para que tus
registros actuales se sigan leyendo.

Si al abrir el archivo nuevo no aparecen tus datos (según el navegador, `file://` puede
tener un almacenamiento distinto), entra en **Ajustes → Restaurar** e importa el backup
JSON de la versión anterior.

---

## 1. Errores críticos que tenía la versión anterior

### 1.1. Se inventaba jornadas y, por tanto, nóminas

Tres funciones creaban datos que nadie había trabajado:

- `ensureFullYearData()` y `generateMissingJornadas()` añadían **todos los días
  laborables desde el 1 de enero de 2026 hasta hoy** con `entrada: "08:00"`,
  `salida: "16:00"`, 8 h y la nota `[CONFIRMADO] Jornada estándar.`
- `sanitizeConfirmedRecords()` rellenaba con 08:00–16:00 cualquier jornada marcada como
  confirmada que no tuviera fichaje.

Eso puede suponer cientos de jornadas ficticias y decenas de miles de euros de nóminas
que no existen. En una app de control laboral es el fallo más grave posible.

**Ahora:** no se crea ni se rellena nada automáticamente. La estimación es una opción
explícita en Ajustes, desactivada por defecto, que **no crea registros**: solo se usa para
el cálculo y se señala con la etiqueta «Incluye estimación». Además hay un botón
**«Quitar autogeneradas»** en Ajustes, pero solo elimina los registros creados con la
función explícita «Completar mes». No borra las jornadas históricas con nota «Jornada
estándar»: pueden representar trabajo real y se revisan a mano.

### 1.2. Fechas en UTC en una app con horario local

`new Date().toISOString().split('T')[0]` devuelve la fecha UTC, no la local. En Canary,
cerca de medianoche, el fichaje puede caer en el día anterior o siguiente. Lo mismo pasa
al hacer `new Date('2026-09-01')`: se interpreta como UTC y luego `getMonth()` puede
desplazar el mes.

**Ahora:** todas las fechas se construyen y se leen en horario local (`dateKey`,
`parseKey`), y `hoursBetween()` contempla turnos que cruzan medianoche.

### 1.3. El service worker nunca se registraba

```js
navigator.serviceWorker.register(URL.createObjectURL(new Blob([...])))
```

Un service worker no se puede registrar desde una URL `blob:`. La promesa fallaba siempre,
así que el modo offline que anunciaba la app no existía.

**Ahora:** la app no necesita service worker porque no hace **ninguna petición externa**.
Para convertirla en PWA instalable de verdad hacen falta un `manifest.webmanifest` y un
`sw.js` servidos por HTTP/HTTPS (ver «Siguientes pasos»).

### 1.4. Clases CSS que no existían

Se usaban `.mobile-only` y `.desktop-only` en el HTML, pero no estaban definidas en el
`<style>`. Resultado: las tarjetas móviles y la tabla de escritorio se renderizaban a la
vez, duplicando la lista.

**Ahora:** reglas `@media` reales para móvil/escritorio.

### 1.5. `#offline-indicator` no existía en el DOM

`setupOfflineDetection()` hacía `ind.classList` sobre un elemento que no estaba en el
HTML. Al perder la conexión lanzaba un `TypeError`.

**Ahora:** eliminado; no hay indicador que no funcione.

### 1.6. XSS / HTML injection

Las notas y conceptos se insertaban con `innerHTML` sin escapar (`${v.notas}`,
`${j.notas}`, etc.) y el importador aceptaba cualquier JSON. Un backup manipulado podía
inyectar HTML o scripts.

**Ahora:** todo pasa por `esc()` o por `textContent`; el importador valida estructura y
fechas antes de aceptar nada.

### 1.7. El PDF salía con el nombre corrupto

`jsPDF` usa Helvetica por defecto y no tiene glifos CJK: «工V龱尺7» se imprime mal.

**Ahora:** el informe se genera con la impresión del navegador (**Guardar como PDF**),
con las fuentes del sistema, texto seleccionable y el nombre correcto.

### 1.8. Riesgo real de perder datos por cuota

El logo aceptaba imágenes de hasta 2 MB y se guardaba en Base64 dentro de `localStorage`
(≈2,7 MB solo el logo). Sumado a los datos, se acerca al límite de 5 MB. No había
`try/catch` alrededor de `setItem`, así que el guardado podía fallar en silencio.

**Ahora:** el logo se reduce a 240 px, se captura el error de cuota y se avisa. También se
sincroniza entre pestañas con el evento `storage`.

### 1.9. `prompt()` y `confirm()`

Se usaban para editar importes y borrar registros: bloquean la interfaz, no se pueden
estilar y en móvil son incómodos.

**Ahora:** formularios y diálogos propios, con foco atrapado, cierre con `Escape` y
restauración del foco.

### 1.10. Accesibilidad

- `maximum-scale=1.0, user-scalable=no` impedía hacer zoom.
- Botones sin `aria-label`, sin `aria-live`, sin foco visible, sin etiquetas asociadas.
- El modal no gestionaba el foco.

**Ahora:** zoom permitido, `skip link`, `aria-current`, `aria-pressed`, `aria-live` para
avisos, foco visible, trampa de foco en el modal y etiquetas en todos los campos.

### 1.11. Dependencias externas

Tailwind Play CDN, Chart.js, jsPDF, Font Awesome y Google Fonts: más de 1 MB y la app
dejaba de funcionar sin conexión (y Tailwind CDN avisa de que no es para producción).

**Ahora:** 0 peticiones. CSS propio, iconos SVG inline, gráficas SVG/CSS y fuentes del
sistema. Abre igual con o sin internet.

### 1.12. Detalles varios

- `Date.now() + Math.random()` generaba IDs decimales; ahora son strings únicos.
- `deleteCurrentRecord()` tenía ramas (`payroll_delete`, `trip_delete`) que nunca se
  activaban.
- Los gráficos se destruían y recreaban en cada guardado; ahora son DOM puro.
- `scheduleNotifications()` podía disparar el aviso dos veces dentro del mismo minuto;
  ahora se deduplica por hora.
- El nombre «工V龱尺7» es mojibake de **IVORY37** (igual que el nombre de la carpeta).
  El valor por defecto ahora es `IVORY37`; si tienes el antiguo guardado, cámbialo en
  Ajustes.

---

## 2. Inconsistencias de cálculo corregidas

La versión anterior mezclaba peras y manzanas:

- «Total cobrado» sumaba nóminas confirmadas + extras pagadas + viajes pagados, pero
  «Pendiente» solo miraba viajes y extras, así que las nóminas pendientes no aparecían.
- El KPI «Valor Extras» incluía también las extras ya pagadas, aunque la etiqueta dijera
  «acumuladas».
- El donut mensual calculaba las horas con `entrada`/`salida`, que en tus registros
  provisionales están vacías: mostraba 0 % aunque hubiera 8 h por día.
- `getJornadaEstado()` devolvía `confirmado` por defecto, incluso sin fichaje ni nota.

**Ahora:**

```
Devengado = nóminas (importe oficial) + extras + viajes + nóminas manuales
Cobrado   = nóminas confirmadas + extras pagadas + viajes cobrados
Pendiente = Devengado − Cobrado
```

El donut es «cobrado / devengado», las barras son el pendiente real por mes y el estado
por defecto sin fichaje es **provisional**.

---

## 3. Mejoras funcionales añadidas

- **Fichaje** con cálculo real de horas, salida anticipada y turnos nocturnos.
- **Nueva jornada manual** (antes solo se podía fichar o editar una existente).
- **Búsqueda** por fecha/nota, filtro «extras sin pagar» y paginación (30 en 30).
- **Edición completa**: horario, horas, estado y notas; borrado dentro del modal.
- **Viajes**: editar, marcar/desmarcar cobrado, borrar.
- **Nóminas**: confirmar/deshacer, editar importe, recalcular, borrar.
- **Extras**: pagar/deshacer por jornada, con fecha de pago.
- **Informe PDF** del mes actual con resumen, detalle y viajes.
- **Backup JSON / CSV** con BOM para Excel y restauración con copia de seguridad previa.
- **Logo** redimensionado y persistente.
- **Multipestaña** sincronizada.
- **Recordatorios** a las 08:00 y 16:00, con deduplicación.
- **Modo estimación** opcional y transparente.
- **Limpieza segura** de las jornadas creadas con «Completar mes», sin tocar el histórico.

---

## 4. Cómo usarla

1. Abre `index.html` en el navegador. Funciona como archivo local.
2. Si no ves tus datos: **Ajustes → Restaurar** y elige el backup JSON.
3. Para notificaciones y para una futura PWA, sírvela por HTTP:

   ```bash
   cd "/home/ivory/工V龱尺ㄚ㇌7"
   python3 -m http.server 8080
   # http://localhost:8080
   ```

4. Descarga un backup antes de cambiar de navegador o borrar datos del sitio.

---

## 5. Siguientes pasos recomendados

1. **PWA real**: `manifest.webmanifest` + `sw.js` con caché *cache-first* y estrategia de
   actualización. Instalable en móvil.
2. **Separar el código**: `app.js`, `calc.js`, `ui.js`, `storage.js`. Hoy el archivo es
   cómodo de distribuir, pero 1.900 líneas en un solo HTML no escala.
3. **Tests de cálculo** (horas, nóminas, estimación, cambio de tarifa) con Vitest. Yo he
   validado los flujos con jsdom, pero conviene una suite permanente.
4. **Vacaciones, bajas y festivos**: hoy la estimación rellena cualquier día laborable; un
   calendario de ausencias lo haría correcto.
5. **Pausas / descansos** en el fichaje (comida) y redondeo configurable.
6. **Cifrado local** o passcode si el dispositivo es compartido.
7. **Informe PDF por mes elegible** (hoy imprime el mes en curso).
8. **Histórico de tarifas** por fecha, para que cambiar el precio/hora no altere meses
   anteriores.
9. **IndexedDB** si prevés muchos años de datos o adjuntos.
10. **Accesibilidad**: probar con teclado y lector de pantalla; añadir `aria-describedby`
    en los formularios.

---

## 6. Verificación realizada

- Sintaxis del script validada con `node --check`.
- Flujos probados con jsdom: alta/edición/borrado de jornada, fichaje, viaje y cobro,
  confirmación de nómina, ajustes con coma decimal, estimación, informe, importación,
  limpieza de autogeneradas y migración de un dataset con el formato antiguo.
- Sin errores de consola en ninguno de los flujos.
- DOM sin IDs duplicados, sin iconos rotos, sin campos sin etiqueta y sin recursos
  externos.

---

## Actualización 2.1 — perfil, logo y fichaje automático

Añadido después de la revisión inicial:

- **Mi perfil**: nombre, rol y foto propios en la barra lateral y en la cabecera móvil.
  Si no hay foto se usa el logo de la app; si tampoco hay logo, las iniciales.
  El perfil se edita desde la propia barra lateral o desde **Ajustes → Mi perfil**.
- **Logo mejorado**: `object-fit: contain` (antes se recortaba), fondo claro/oscuro
  elegible y ensanchado automático para logos apaisados.
- **Fichaje automático por horario**: si la app está abierta a la hora de entrada,
  ficha sola; a la hora de salida cierra la jornada. Solo actúa sobre registros
  creados por el propio automatismo, se marca con la etiqueta «Auto» y se puede
  desactivar. Nunca rellena días pasados en silencio.
- **«Según horario»**: crea la jornada de hoy con el horario habitual en un clic.
- **«Completar mes»**: rellena, con confirmación previa, los días laborables sin
  registro del mes en curso. Quedan marcados como Auto y se pueden borrar con
  «Quitar autogeneradas».
- **Confirmar provisionales**: recupera el antiguo «Confirmar todo», pero sin
  inventar fichajes ni horas.
- **Ajustes deduplicados** al importar: si una clave aparece repetida, gana la última.
- **Cierre de jornadas Auto antiguas**: si una jornada automática quedó abierta,
  se cierra al día siguiente a la hora de salida.

La generación masiva y silenciosa de jornadas de la versión anterior sigue
eliminada a propósito: era la causa principal de nóminas infladas. Ahora el mismo
resultado se obtiene de forma explícita con «Completar mes».

---

## Actualización 2.2.3 — gráfica con ejes y composición

- Eje Y, líneas de referencia y barras apiladas por concepto.
- Selector «Todo / Extras» para comparar la vista completa (1.540,18 €) con la
  histórica de solo extras (852,58 €).
- Leyenda y total por barra.
- El desglose aclara los 1.252,58 € de la versión anterior: extras + viajes, sin la
  nómina pendiente.

## Actualización 2.2.2 — pendiente transparente

- El KPI de pendiente abre un desglose con nóminas sin confirmar, horas extra sin pagar
  y viajes sin cobrar.
- La gráfica muestra el importe dentro de cada barra, no flotando en la parte superior,
  y aclara qué conceptos suma.
- Corregido el foco del modal cuando se abre sin botón de guardar.

## Actualización 2.2.1 — compatibilidad con datos reales

- Los backups antiguos migran `app_logo` a `custom_logo` y eliminan la clave duplicada,
  ahorrando unos 160 KB con un logo de 640×640.
- El nombre corrupto `工V龱尺ㄚ㇌7` / `工V龱尺7` se corrige a `IVORY37` al importar.
- Se elimina la marca interna `seeded_demo`.
- «Quitar autogeneradas» solo borra los registros creados con «Completar mes»; el
  histórico con nota «Jornada estándar» queda intacto.
- El gráfico «Pendiente por mes» omite los meses a cero para no llenar la vista de barras
  vacías.

## Actualización 2.2 — acabado premium

- **Panel**: saludo según la hora, nombre del perfil y resumen de lo pendiente.
- **Primeros pasos**: checklist con progreso (perfil, horario, primera jornada y copia de
  seguridad), descarte y opción de volver a mostrarlo desde Ajustes.
- **Confianza**: se registra la última copia de seguridad y se recuerda si han pasado más
  de 30 días.
- **Marca**: favicon dinámico con el color de la app o el logo, metadatos sociales y logo
  en el informe impreso.
- **Ajustes**: navegación por secciones y mejor jerarquía visual.
- **Móvil**: cabecera de Jornadas con la acción principal a ancho completo y avatar de
  perfil en la barra superior.
- **Detalles**: contraste de avatares, logos apaisados en la marca y vista previa del logo
  sin el icono de reserva superpuesto.
