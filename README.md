# IVORY37 · Control laboral

Aplicación web de una sola página para registrar **jornadas, horas extra, viajes/dietas y nóminas**. Funciona sin conexión, no tiene dependencias externas y guarda los datos únicamente en el navegador.

## Funciones

- Fichaje de entrada/salida con cálculo real de horas (incluidos turnos nocturnos).
- Registro manual y edición de jornadas, con estado confirmado/provisional.
- Horas extra por jornada y control de su pago.
- Viajes y dietas con estado cobrado/pendiente.
- Nóminas mensuales automáticas, confirmación y edición.
- Panel con devengado, cobrado, pendiente y horas extra.
- Informe imprimible (Guardar como PDF), backup JSON y exportación CSV.
- Búsqueda, filtros y paginación.
- Tema oscuro, logo personalizable y color de marca.
- Datos en `localStorage`, con sincronización entre pestañas y copia de seguridad.

## Uso

Abre `index.html` en el navegador. No necesita instalación ni build.

Para notificaciones y para servirla por HTTP:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Datos

La app guarda todo en la clave `ivory37_data_v1` de `localStorage`. Usa **Ajustes → Backup JSON** con frecuencia y **Restaurar** para recuperarlo. El botón **Borrar todo** elimina los datos de este navegador.

## Estructura

```
index.html    Aplicación completa (HTML + CSS + JS, sin dependencias)
MEJORAS.md    Revisión técnica: fallos corregidos y siguientes pasos
README.md     Este archivo
```

## Estado

Versión 2.0. Validada con pruebas de DOM (jsdom): fichaje, edición y borrado de jornadas, viajes, nóminas, ajustes, estimación, importación y migración del formato anterior.
