# Auditoría de seguimiento · Control Laboral 3.3.19

21 de noviembre de 2026 · Creador: **工V龱尺ㄚ㇌7**

Esta revisión responde a los 17 hallazgos aportados. No implica que todos estén cerrados. Conserva los cambios de interfaz y seguridad anteriores y no modifica datos de producción de Supabase.

## Correcciones verificadas

| Hallazgo | Resultado |
| --- | --- |
| 1 · Coma decimal | `1,234` se interpreta como 1.234, igual que `1.234`. `1.234,56` conserva el formato español agrupado. Las comas múltiples sin decimal explícito se rechazan. No se recalculan importes históricos ya guardados; conviene comprobarlos si se introdujeron con el formato afectado. |
| 2 · PDF Android | El informe preparado llama a `AndroidBridge.printReport()`. En escritorio mantiene la impresión web. Si falla, se muestra un error. |
| 3 · Avisos Android, parte interactiva | Permiso, estado y avisos utilizan los métodos nativos, incluso sin API web Notification. La actualización del permiso desde Android refresca la etiqueta. La programación con la app cerrada sigue pendiente. |
| 5 · Borrados automáticos | Se eliminan dos filtros destructivos. Una automática coincidente con una manual completa se conserva como provisional y no participa en los cálculos confirmados. Mantiene identificador, horas, notas y evidencia de pago. Debe revisarse desde Jornadas; no se fusionan ni descartan sus extras automáticamente. |
| 6 · Tarifas | Caché del historial normalizado y de la versión elegida por fecha. Cambiar el historial invalida la caché; los valores de respaldo se consultan actualizados. |
| 11 · Identificadores | Nuevos registros con UUID v4 criptográfico. Alternativa mediante getRandomValues cuando randomUUID no está disponible. Los identificadores existentes permanecen intactos. |
| 15 · Recursos Android | `npm run sync:android` copia los recursos declarados para distribución. Gradle ejecuta la copia antes de compilar. Se mantiene la comprobación de igualdad de recursos. |
| 16 · Pruebas, parcialmente | Se añaden seis pruebas de comportamiento: importes, UUID, invalidación de tarifas, puente Android, impresión de escritorio y conservación de duplicados con invariante contable. Ya existe un recorrido DOM real en Electron y WebView mediante `scripts/qa-ui.cjs`; ahora también se ejecuta con `npm run test:ui`. Las comprobaciones estáticas de empaquetado siguen siendo útiles y se conservan. |

## Pendientes de la auditoría

| Hallazgo | Trabajo pendiente |
| --- | --- |
| 3 · Segundo plano | Programador nativo, reprogramación tras reinicio/cambio de zona y pruebas con app cerrada. El temporizador JS actual requiere la app abierta. |
| 4 · Almacenamiento | Migración transaccional a IndexedDB con compatibilidad de arranque, backup nativo, importación, sync y recuperación ante fallo. La cuota del documento en nube es un límite separado y también requiere revisión. |
| 7 y 8 · Renderizado | Índice de jornadas por fecha y pestañas con invalidación selectiva; comprobar importación, cambios remotos y cambio de día para evitar vistas obsoletas. |
| 9 y 10 · Sync | Polling de respaldo adaptativo y revisiones que no dependan exclusivamente del reloj. Mantener pruebas de edición durante sincronización y conflictos antes de modificar el protocolo compartido por dispositivos. |
| 12 · Contraseña olvidada | Recuperación completa con retorno, token y formulario de nueva contraseña. Enviar un correo sin implementar el retorno no resuelve el flujo de APK y EXE. |
| 13 · Registro | No se ha cerrado el registro público del proyecto compartido. Cambiarlo puede afectar también a Gestión Clientes; requiere decidir el modelo de altas. |
| 14 · Bloqueo | Acceso local protegido pendiente. Un PIN de interfaz por sí solo no cifra los datos ni protege frente a acceso al perfil del dispositivo. |
| 16 · Más recorridos | Ampliar pruebas DOM con confirmación de nómina, escenarios contables y concurrencia; las pruebas existentes no cubren todos los caminos. |
| 17 · Otros | Día de nómina configurable, nombre de app, actualizaciones Electron, deshacer y cálculo fechado en transiciones horarias de Canarias. Ninguno se declara resuelto aquí. |

## Validación

- `npm run check`: sintaxis correcta y **82 pruebas aprobadas**.
- `npm run test:ui`: recorrido real Electron aprobado; fichaje, edición manual, navegación, escape de HTML, copia/restauración, reinicio y anchos 320/390/768/1440.
- Compilación Android release y audit completada. La variante audit tiene datos separados.
- Emulador Android: fichaje, edición, navegación, escape HTML, copia/restauración y reinicio sin conexión aprobados con la 3.3.19. El test espera ahora la carga efectiva, en lugar de depender de 900 ms fijos.
- El botón PDF de la interfaz abrió `com.android.printspooler/.ui.PrintActivity`; se verificó mediante el estado de actividades de Android. Se comprobó el permiso nativo y una notificación de prueba registrada por el sistema. No se completó el guardado del PDF en un archivo.
- APK release: versión 3.3.19, código 28, sin indicador debuggable y mismo certificado que la APK 3.3.17. Instalador Windows generado. Ambos archivos están en Descargas.
- No se han contratado servicios ni certificados de pago.

Las pruebas de puente con dobles verifican que el JavaScript selecciona el método correcto. Las comprobaciones adicionales del emulador no equivalen a una prueba en un teléfono físico ni validan recordatorios con la aplicación cerrada.
