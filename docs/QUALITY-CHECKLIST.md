# Control Laboral — comprobaciones de calidad

## Auditoría de la versión 3.3.10

Se revisaron el fichaje, la sincronización, las nóminas, las copias, la actualización y el panel. Los siguientes fallos se reprodujeron ejecutando el código de la aplicación con datos ficticios.

| Prioridad | Caso reproducido | Siguiente comprobación |
| --- | --- | --- |
| Alta | Una sincronización durante «Editar jornada» puede hacer que «Guardar» confirme la edición y conserve las horas anteriores. El formulario apunta al registro que había al abrirlo. | Abrir la edición, aplicar datos remotos, guardar y verificar las horas tras reabrir la app. Revisar también los formularios de extras, viajes y nóminas. |
| Alta | Si falla la escritura por falta de espacio, la ruta de recuperación lanza otro error antes de restaurar los datos y avisar. | Simular el fallo, comprobar que se conservan los datos y que se puede reintentar el guardado. |
| Alta | Al abrir la copia sin conexión de Windows, la app puede bloquear el guardado tras intentar usar un método del puente de Android. | Iniciar el EXE con una copia local existente y la web inaccesible. Comprobar lectura, guardado y reapertura. |
| Alta | Dos perfiles ficticios registraron una jornada de 8 h a 12,50 €/h en días distintos del mismo mes. La mezcla conservó dos nóminas automáticas. Tras recalcular, quedaron 200 € y 100 €, y el panel mostró 300 € pendientes cuando correspondían 200 €. | Repetir con dos dispositivos de prueba, verificar que solo se cuenta una nómina por mes y comprobar que se conservan los pagos confirmados. |

## Comprobación automática

En la raíz del repositorio, con Node.js 22:

```sh
npm run check
```

Incluye validación de sintaxis JavaScript y pruebas de tarifas históricas, calendario, CSV, copias, cálculo de horas y coherencia de los recursos de Android y web. Las pruebas de sincronización cubren guardados durante peticiones en curso, conflictos y relojes desfasados con una nube simulada. GitHub Actions ejecuta el mismo comando.

## Verificación manual antes de publicar

- Crear datos **ficticios** de turnos normales, nocturnos, descansos, extras, viajes y pagos. Comprobar importes a mano.
- Exportar una copia JSON, restaurarla en una instalación de pruebas y comparar todos los registros.
- Guardar jornadas durante una sincronización y comprobar que las horas se mantienen al recibir la respuesta. Probar también dos dispositivos sin conexión, la reconexión y la revisión de conflictos.
- Comprobar que el calendario y las tarifas funcionan con años bisiestos, cambios de mes y fechas inválidas.
- Comprobar en el panel las horas extra de cada mes, la tarifa histórica y el importe recibido. Incluir meses liquidados y distinguir un pago de 0 € de un importe sin registrar. Revisar la lectura en móvil y escritorio, con teclado, zoom y tamaño de fuente aumentado.
- Actualizar la APK encima de la anterior y comprobar que conserva las jornadas y abre sin internet. Revisar también la exportación, los permisos y las notificaciones.
- Instalar el EXE de Windows y verificar la persistencia, la exportación, el arranque sin internet y la actualización de la web con un formulario abierto.
- Revisar las reglas RLS y permisos Supabase con cuentas de prueba separadas.
- Verificar que las versiones y recursos de web, Android y Windows coinciden antes de crear la versión final.

## Seguridad de publicación

La publicación, la fusión a `main` y las migraciones de datos de producción requieren revisión y autorización expresa del propietario. La revisión incluye las comprobaciones automáticas y manuales anteriores.
