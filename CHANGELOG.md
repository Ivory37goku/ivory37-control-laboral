# Cambios

## 2.2.5 — KPIs como la foto de referencia

- Cuatro tarjetas: **Cobrado** (13.342,00 €), **A cobrar** (1.252,58 €),
  **Horas extra** (43,30 h) y **Valor extras** (852,58 €).
- Se retira «Devengado» de la primera fila para no añadir una cifra que la versión
  de referencia no mostraba.
- La tarjeta de horas extra vuelve a mostrar «Acumuladas año actual» y el valor de
  extras queda en su propia tarjeta.
- La nómina sin confirmar sigue fuera de «A cobrar» y se gestiona en Pagos.

## 2.2.4 — A cobrar como la versión que usas

- «A cobrar» = horas extra + viajes sin cobrar (1.252,58 €). La nómina sin confirmar
  (287,60 €) se gestiona en Pagos y no se suma aquí.
- «Flujo de caja (pend.)» vuelve a mostrar solo horas extra, como la gráfica antigua
  (364,27 / 433,18 / 55,13 €), con eje y barras.
- El pie de la gráfica suma los viajes pendientes y muestra el total a cobrar, para que
  no parezca que falta dinero.
- Devengado = cobrado + a cobrar (14.594,58 €), sin duplicar la nómina pendiente.

## 2.2.3 — Gráfica con ejes y composición

- Gráfica con eje Y, líneas de referencia y barras apiladas por concepto.
- Selector **Todo / Extras**: «Todo» suma nóminas + extras + viajes (1.540,18 €);
  «Extras» muestra solo horas extra (852,58 €), como la gráfica antigua.
- Leyenda de nóminas, extras y viajes, y total dentro de cada barra.
- El desglose explica los 1.252,58 € de la versión anterior (extras + viajes, sin nómina).

## 2.2.2 — Pendiente transparente

- El KPI «Pendiente» incluye un enlace **Ver desglose** con nóminas, extras y viajes.
- Los importes de la gráfica van dentro de cada barra, conectados a su altura.
- La gráfica explica que suma nóminas + extras + viajes sin cobrar.
- Corregido el foco del modal cuando no hay botón de guardar.

## 2.2.1 — Compatibilidad con datos reales

- Migración de backups antiguos: `app_logo` → `custom_logo`, nombre corrupto → `IVORY37`
  y eliminación de la clave interna `seeded_demo`.
- «Quitar autogeneradas» solo afecta a los registros creados con «Completar mes»; el
  histórico con nota «Jornada estándar» no se toca.
- El gráfico de pendientes omite los meses a cero.
- Verificado con un backup real de 230 jornadas, 12 nóminas, 3 viajes y logo de 640×640.

## 2.2 — Acabado premium

- Panel con saludo personalizado, resumen contextual y accesos rápidos.
- Checklist «Primeros pasos» con progreso, descarte y opción de volver a mostrarlo.
- Seguimiento de la última copia de seguridad y aviso si han pasado más de 30 días.
- Favicon dinámico, metadatos sociales y logo de la app en el informe impreso.
- Navegación por secciones en Ajustes y cabecera móvil más limpia.
- Mejoras de contraste en avatares, logotipos apaisados y vista previa del logo.
- El botón primario de Jornadas pasa a una fila completa en móvil.

## 2.1 — Perfil y fichaje automático

- Perfil personalizable: nombre, rol, foto o logo en la barra lateral y en móvil.
- Logo con fondo claro/oscuro, detección de logos apaisados y vista previa.
- Fichaje automático por horario, botón «Según horario» y «Completar mes».
- Confirmación masiva de jornadas provisionales.
- Cierre de jornadas automáticas antiguas y exclusión de la recreación al borrar.
- Ajustes deduplicados al importar y soporte de horarios con «a» como separador.

## 2.0 — Reescritura

- Eliminación de la generación silenciosa de jornadas y nóminas ficticias.
- Fechas en horario local y cálculo correcto de turnos nocturnos.
- Sin dependencias externas: CSS, iconos SVG y gráficas propias.
- Datos escapados, cuota de almacenamiento controlada y sincronización entre pestañas.
- Modales accesibles, búsqueda, filtros, paginación y exportación/restauración.
