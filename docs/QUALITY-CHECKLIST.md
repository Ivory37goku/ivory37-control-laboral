# Control Laboral — comprobaciones de calidad

Este documento describe comprobaciones reproducibles sin datos reales.

## Comprobación automática

En la raíz del repositorio, con Node.js 22:

```sh
npm run check
```

Incluye validación de sintaxis JavaScript y pruebas de tarifas históricas, calendario, CSV, sincronización (comprobaciones estáticas) y consistencia de recursos Android/web. GitHub Actions ejecuta el mismo comando al actualizar la rama.

## Verificación manual antes de publicar

- Crear datos **ficticios** de turnos normales, nocturnos, descansos, extras, viajes y pagos; comprobar importes a mano.
- Exportar una copia JSON, restaurarla en una instalación de pruebas y comparar todos los registros.
- Probar sin conexión y al recuperar internet en dos dispositivos; crear cambios concurrentes y verificar los conflictos.
- Comprobar que el calendario y las tarifas funcionan con años bisiestos, cambios de mes y fechas inválidas.
- Comprobar accesibilidad con teclado, lector de pantalla, zoom y tamaño de fuente aumentado.
- Generar e instalar la APK de prueba; comprobar WebView, exportación, permisos, notificaciones y recuperación sin internet.
- Generar y ejecutar Windows portable e instalador; verificar persistencia, exportación y actualización.
- Revisar las reglas RLS y permisos Supabase con cuentas de prueba separadas.
- Verificar que las versiones y recursos de web, Android y Windows coinciden antes de crear la versión final.

## Seguridad de publicación

No publicar, fusionar a `main` ni migrar datos de producción sin revisión y autorización expresa del propietario. Los tests automatizados **no sustituyen** las comprobaciones manuales anteriores.
