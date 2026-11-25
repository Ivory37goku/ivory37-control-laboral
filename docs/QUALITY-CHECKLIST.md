# Control Laboral — comprobaciones de calidad

## Fallos de la 3.3.10 corregidos en la 3.3.12

Se revisaron el fichaje, la sincronización, las nóminas, las copias, la actualización y el panel. Los siguientes fallos se reprodujeron ejecutando el código de la aplicación con datos ficticios.

| Caso reproducido en 3.3.10 | Cobertura de regresión |
| --- | --- |
| Una sincronización durante «Editar jornada» podía confirmar el guardado mientras conservaba las horas anteriores. | Abrir la edición, aplicar datos remotos y guardar. Comprobar que se mantiene la nota remota y que la app detecta una edición incompatible o un registro eliminado. |
| Agotar el espacio producía un segundo error y ocultaba el aviso de guardado. | Simular el fallo, verificar que el dato persistido permanece intacto y reintentar desde el mismo formulario. |
| La copia local de Windows podía bloquear el guardado tras intentar usar un método del puente de Android. | Restaurar una copia antigua en la versión incluida en el instalador. Un respaldo con fechas inválidas deja intactos los datos locales. |
| Dos jornadas de 8 h a 12,50 €/h, añadidas en perfiles sin conexión, podían producir 300 € pendientes al combinarse. | Mezclar los registros y comprobar 200 € y una sola nómina automática visible. Los pagos confirmados o editados siguen disponibles. |

Si dos registros del mismo mes ya están confirmados o editados a mano, se conservan ambos. Su contenido puede reflejar pagos distintos que requieren la revisión del usuario.

## Comprobación automática

La 3.3.20 añade `npm run test:ui` y `npm run test:reliability` para recorridos de interfaz y almacenamiento real. Android incluye pruebas instrumentadas de avisos mediante `connectedAuditAndroidTest`. Resultados, instrucciones y límites en [Fiabilidad 3.3.20](RELIABILITY-3.3.20.md).

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
