# Cambios

## 3.3.23 — Abonos y resolución de conflictos

- Edición, eliminación e historial recuperable de abonos.
- Reconciliación de abonos por identificador y combinación de campos de jornadas con vista previa de horas.
- Capturas renovadas con datos ficticios.

## 3.3.22 — Cierre mensual y jornadas flexibles

- Cierre mensual con abonos, comparación de meses, fecha real de cobro, correcciones, anticipos, retenciones y complementos con tarifas fechadas.
- Turnos partidos, pausas en directo, plantillas, reparto de horas por proyecto, compensación con descanso e historial de edición.
- Resumen por periodo, pendientes, consulta de calendario, modo exterior y accesos directos Android.
- Copias cifradas verificables, importación con vista previa, demostración aislada y diagnóstico sin datos personales.
- Informes con opciones de privacidad, exportación mensual y justificantes locales.

## 3.3.21 — Aurora en toda la aplicación

- Acabado visual común para Resumen, Jornadas, Viajes, Pagos y Ajustes.
- Cabecera de fichaje más compacta en móvil, botón PDF junto al título y cifras de horas extra más visibles.
- Formularios, tablas, tarjetas, ventanas, navegación y estados con superficies y tipografía coherentes.
- Foco de teclado visible, zonas de interacción más amplias y respeto por movimiento reducido. La hoja visual no se aplica a impresión.
- Prueba autorizada de recuperación mediante el botón real de la app: una solicitud aceptada y entrega en Proton confirmada por el propietario. No se cambió la contraseña.

## 3.3.20 — Guardado duradero y fiabilidad

- Migración verificada de datos y seguimiento de nube a IndexedDB; las sesiones del SDK conservan su almacenamiento separado.
- Guardado confirmado al terminar la transacción; control de ediciones desde otra ventana y restauraciones con copia previa.
- Estado local separado del estado de nube, sondeo de respaldo para Realtime y contador de revisiones monotónico.
- Recuperación de contraseña por correo con código o enlace final, comprobación de identidad y limpieza de secretos.
- PIN local opcional de 6–12 cifras con derivación PBKDF2; no cifra los datos del dispositivo.
- Recordatorios nativos Android mediante AlarmManager y receptor sin actividad; reprogramación tras reinicio, actualización y cambio de hora/zona. Son inexactos y pueden retrasarse por ahorro de batería.
- Consulta de versiones publicadas en GitHub, sin instalar automáticamente ni anunciar una versión igual o anterior.
- Deshacer borrados, copia previa recuperable y renderizado de la pestaña visible.
- Pruebas contables, transacciones abortadas, migración, ventanas concurrentes, 7 MB y reinicio, bloqueo PIN y recorridos de nómina y deshacer.

## 3.3.19 — Importes, PDF y conservación de jornadas

- La coma sola siempre es decimal, incluso con tres cifras; las comas repetidas sin decimal explícito se rechazan.
- Android usa el puente nativo para impresión PDF, permisos y avisos con la aplicación abierta. Los recordatorios con la app cerrada siguen pendientes.
- Las jornadas automáticas coincidentes con una manual se conservan como provisionales para revisión, con sus horas, notas y evidencia de pago.
- Nuevos identificadores UUID criptográficos sin modificar los existentes. Caché de tarifas con invalidación al cambiar ajustes.
- Copia de recursos web a Android automatizada en preBuild y disponible con npm run sync:android.
- Nuevas pruebas de comportamiento para importes, puente Android, conservación, tarifas e identidad de registros.

## 3.3.18 — Evolución del resumen Aurora

- Cabecera con jerarquía más clara y fichaje destacado en un solo bloque.
- Indicadores de cobro con cifras más legibles y mejor adaptación a móvil.
- Filas mensuales y comparativa de extras con más contraste y espacio.
- Se conservan los controles, registros, cálculos, navegación y protecciones de la versión anterior.

## 3.3.17 — Seguridad sin servicios de pago

- Política de alta alineada con el servidor: 12 caracteres, mayúsculas, minúsculas, números y símbolos. El acceso con contraseñas existentes mantiene su validación anterior.
- Cambio seguro de contraseña activado y confirmación de correo verificada en Supabase.
- Corregida la dependencia minimatch de la herramienta de compilación; auditoría npm completa sin avisos.
- APK de uso personal con depuración desactivada y la firma anterior conservada para permitir actualizar.
- El proyecto permanece en el plan gratuito; sin contratación de Pro ni certificados de pago.

## 3.3.16 — Auditoría y continuidad de jornada

- Windows deniega permisos no utilizados por la app y mantiene los avisos locales.
- Una respuesta de sesión antigua no puede reactivar la sincronización tras cerrar sesión.
- Validación de estructura y límite conjunto de 50.000 registros en las copias importadas.
- El turno nocturno abierto conserva la salida disponible aunque exista otro registro cerrado hoy.
- El bloque de hoy ofrece revisar la jornada existente y distingue mejor sus estados.
- Las restauraciones actualizan también la copia nativa de recuperación.
- Prueba RLS transaccional en Supabase y recorrido de interfaz reproducible en Electron y APK de auditoría aislada.

## 3.3.15 — Un único bloque de fichaje

- Entrada, salida y registro manual reunidos en la tarjeta superior «Tu jornada de hoy».
- Eliminados los accesos repetidos de entrada y salida y el segundo contador circular del Resumen.
- El botón cambia de entrada a salida y se oculta al cerrar la jornada.

## 3.3.14 — Protección de sesiones y cuentas

- Las copias nativas y su restauración excluyen los tokens de inicio de sesión.
- Los datos locales quedan vinculados a una cuenta para impedir su envío accidental a otra.
- Se restringen scripts, conexiones, formularios y contenido incrustado mediante CSP.
- El campo de contraseña se vacía al enviar tanto un acceso válido como uno fallido.
- Auditoría del servidor y retirada de permisos de ejecución innecesarios.

## 3.3.13 — Panel Aurora

- Nuevo acabado de vidrio verde menta para el resumen, con la jornada de hoy y su estado en la cabecera.
- La tarjeta de hoy muestra la entrada o la salida según el fichaje que corresponda.
- El flujo de caja y la comparativa mensual conservan las horas extra, los importes y el detalle de cobro.

## 3.3.12 — Guardado, nóminas y Windows sin conexión

- Guardar una jornada, un viaje o una nómina con la sincronización en curso aplica la edición al registro actual y avisa si los mismos campos cambiaron en otro dispositivo.
- Un fallo de espacio mantiene abierto el formulario y permite reintentar el guardado.
- El panel, los pagos y los informes cuentan una sola propuesta de nómina automática por mes. Se conservan los importes confirmados y editados manualmente.
- Windows abre la versión incluida en el instalador. Las instalaciones anteriores recuperan una vez su copia local.

## 3.3.11 — Resumen mensual más legible

- Cabecera y accesos compactos, cuatro indicadores de cobros y horas, y tarjetas de vidrio inspiradas en Gestión Clientes.
- Flujo de caja con el pendiente y las horas extra junto a cada mes, incluso cuando el pendiente es cero.
- Comparativa mensual del valor esperado y el pago anotado, con diferencia e importe por hora extra confirmada.

## 3.3.10 — Protege las jornadas durante la sincronización

- Una sincronización que empezó antes de guardar ya no puede aplicar su copia anterior y quitar la jornada nueva.
- La sincronización vuelve a comparar los datos locales antes de escribir y antes de aplicar la respuesta; si hubo cambios, repite la mezcla con la jornada más reciente.
- Se añade una prueba que guarda jornadas durante la lectura y la escritura remotas.

## 3.3.9 — Arranque estable y sincronización sin conflictos falsos

- Android vuelve a ejecutar siempre la versión incluida en el APK, sin sustituirla silenciosamente por la web publicada.
- Los móviles que ya usaban la versión web migran sus datos locales una sola vez y conservan una copia antes de completar el cambio.
- La sincronización trata la pausa omitida y la pausa de cero minutos como el mismo dato; los descansos reales siguen generando cambios y conflictos cuando corresponde.
- Un error de guardado ya no vacía la jornada que se estaba editando en memoria.

## 3.3.8 — Fichajes visibles y actualización segura

- Guardar una jornada del día actual reutiliza la jornada existente, evitando que un fichaje automático vacío oculte las horas introducidas manualmente.
- El resumen diario prefiere el fichaje manual completo si quedaron registros duplicados de versiones anteriores.
- Los formularios ya no se cierran si el guardado local falla; se recuperan los datos guardados anteriormente.
- El aviso de actualización solo aparece si el service worker anuncia una versión superior a la que está abierta y se oculta mientras hay formularios o ajustes abiertos.
- El aviso queda detrás de los formularios para que no tape sus campos ni el botón Guardar.

## 3.3.7 — Estado de sincronización estable

- Las comprobaciones automáticas siguen manteniendo la nube al día, pero ya no hacen parpadear «Sincronizando» cuando no hay cambios.
- Aplicar una copia con distinto orden de campos o marcas técnicas ya no vuelve a encolar la misma sincronización.
- Los cambios reales de jornadas y pagos, y los errores de conexión, siguen reflejándose en el estado.

## 3.3.6 — Limpieza segura de conflictos de sincronización

- Las diferencias de orden de campos y las fechas técnicas de creación/actualización ya no generan conflictos entre dispositivos.
- Los conflictos anteriores cuyas dos versiones solo difieren en esos metadatos se retiran automáticamente del aviso, sin cambiar jornadas, pagos ni otros datos de trabajo.
- Los conflictos con diferencias reales se mantienen para revisión y ahora muestran qué campos son distintos.
- Web, Android y Windows comparten esta corrección; la PWA renueva su caché.

## 3.3.5 — Sincronización y horas mensuales más claras

- Se separa la última base compartida en la nube de las ediciones locales pendientes, para detectar cambios simultáneos sin perder la versión alternativa.
- Las horas extra aparecen en el eje de cada mes incluso cuando el importe pendiente es cero; las etiquetas son más legibles en móvil.
- Web y Android reciben los mismos recursos y una caché nueva para esta versión.
- Windows sigue generando solo el instalador.

## 3.3.4 — Horas extra en cada mes de la gráfica

- La gráfica muestra las horas extra confirmadas debajo de cada mes, junto a sus importes; el dato incluye tanto horas pagadas como pendientes.
- El desglose mensual usa la tarifa histórica de cada jornada y mantiene separadas las horas pagadas y pendientes.
- Mejoras internas en pausas, copias de seguridad y aplicación del color elegido, con comprobaciones automáticas para web, PWA, Windows y Android.
- La distribución de Windows genera solo el instalador.

## 3.3.3 — Pausas y cálculo neto del fichaje

- Se configura una pausa habitual en minutos y se puede cambiar en cada jornada; las jornadas anteriores conservan sus horas.
- El cálculo desde el horario, el cierre de fichaje y las jornadas creadas según el horario descuentan la pausa no computable.
- Los informes PDF y CSV y el detalle de jornadas muestran los minutos de pausa.
- El cálculo de turnos que cruzan medianoche usa los minutos exactos y evita perder un minuto al cerrar.

## 3.3.2 — Comparación del pago real de horas extra

- El desglose de horas extra aparece antes de la gráfica de flujo de caja para que se vea con más facilidad en móvil.
- Cada mes muestra horas confirmadas, valor calculado con su tarifa histórica y horas que la app marca como pagadas.
- Se puede anotar el total realmente recibido, incluidos pagos parciales, y ver cuánto falta o cuánto supera el valor calculado.
- El importe recibido se sincroniza y se incluye en las copias; sirve para comparar y no altera los estados de cobro.

## 3.3.1 — Referencia mensual de horas extra

- El flujo de caja muestra las horas extra confirmadas por mes y el valor calculado con la tarifa guardada para cada jornada.
- El desglose separa las horas marcadas como pagadas de las pendientes, para facilitar la comparación con el importe recibido.
- La gráfica conserva el total de dinero pendiente y también incluye los meses con extras ya pagadas.

## 3.3.0 — Tarifas históricas e informes por periodo

- Las tarifas normal, extra y la jornada diaria se pueden programar desde una fecha; los cálculos usan la tarifa vigente en cada jornada.
- Los cambios retroactivos piden confirmación. Las nóminas confirmadas o editadas manualmente se mantienen.
- Calendario con descansos, vacaciones, bajas, festivos y otras incidencias por fecha o periodo de hasta un año.
- Las incidencias excluyen días de estimaciones y de «Completar mes», sin modificar jornadas ya registradas.
- Informes PDF y CSV con selector de fechas, detalle de jornadas, tarifas aplicadas, incidencias, viajes y pagos.
- Los conflictos de edición entre dispositivos conservan la versión aplicada y la alternativa; se pueden revisar, restaurar o descartar.
- Separados los scripts de aplicación, PWA, tarifas, calendario, informes y efectos visuales.

## 3.2.3 — Nombre y logo oficiales

- Se aplica 工V龱尺ㄚ㇌7 como nombre de la PWA, APK, EXE, ventana y accesos directos.
- Se sustituye el icono anterior por el logo enviado, en web, Android y Windows.
- Se mantiene la carpeta de datos de Windows para conservar los datos existentes tras el cambio de nombre.

## 3.2.2 — Actualizaciones automáticas y backups visibles

- La PWA instalada aplica actualizaciones automáticamente cuando no hay formularios abiertos.
- La APK y el EXE cargan el HTML publicado dentro de la app; su primera actualización conserva
  el almacenamiento local y deja una copia para volver a la versión local si no hay conexión.
- Android y Windows ya usan el selector nativo al exportar JSON o CSV; la fecha del backup
  cambia solo cuando se completa el guardado.
- Se guarda una copia interna diaria y se indica dónde encontrar el archivo exportado.

## 3.2.1 — Tema verde neón y capturas renovadas

- Unificado el color principal en verde neón en el panel, los botones, los iconos y la APK.
- Las instalaciones que aún usaban el naranja predeterminado pasan al verde neón al abrirse;
  se conservan los colores personalizados.
- Renovadas las capturas con datos de ejemplo y ampliada la captura de sincronización.
- La APK Android oculta «Instalar app» dentro de la aplicación nativa.

## 3.2.0 — Sincronización entre dispositivos

- Añadida sincronización opcional entre PWA, APK y EXE mediante cuentas Supabase.
- La app mantiene el guardado local y permite seguir trabajando sin conexión; los cambios
  pendientes se sincronizan al volver a tener internet.
- Protegida la tabla con RLS por usuario y combinación por registro con marcas de borrado
  para conservar ediciones y eliminaciones entre dispositivos.
- Añadidos inicio de sesión, creación de cuenta, cierre de sesión y estado de sincronización
  en Ajustes → Nube.
- El APK solicita permiso de Internet solo para la sincronización y conserva los assets
  dentro de la app; además, oculta el botón «Instalar app» dentro de Android nativo.

## 3.1.2 — Arranque de la APK Android

- Se muestra «Cargando Control laboral…» mientras Android prepara WebView, en vez de dejar
  la ventana negra durante el primer inicio.
- Cada inicio carga el HTML local para evitar restaurar una sesión WebView vacía.

## 3.1.1 — Corrección de la APK Android

- Corregida la ruta de los archivos locales dentro del APK y retirado el bloqueo WebView
  que impedía cargarlos. La APK abre la app sin conexión.
- Si faltan assets locales, aparece una indicación para reinstalar en vez de quedarse en negro.

## 3.1.0 — PWA y protección de datos

- Añadidos manifest, iconos PNG válidos y service worker para GitHub Pages; la app queda
  disponible offline después de cargarla y ofrece instalación/actualizaciones controladas.
- Añadido `android-app/`, un proyecto Android offline con selector de archivos, impresión
  y notificaciones nativas para generar una APK sin abrir Chrome.
- Las jornadas provisionales ya no suman nómina ni extras pendientes hasta confirmarlas.
- Importar un backup valida fechas y solo reemplaza los datos si se pudo guardar completo.
- Rechazadas fechas imposibles y números con texto sobrante; exportación CSV protege las
  celdas que podrían ejecutarse como fórmulas.
- Añadido control para no regenerar una nómina automática que el usuario acaba de borrar.
- Al añadir o modificar extras ya pagadas, vuelven a quedar pendientes para revisión.
- Aclarados los mensajes de instalación, los límites del auto-fichaje y «Completar mes».

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
