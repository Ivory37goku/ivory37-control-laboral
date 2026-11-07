# IVORY37 · Control laboral

Aplicación web de una sola página para registrar **jornadas, horas extra, viajes/dietas y nóminas**. Funciona sin conexión, no tiene dependencias externas y guarda los datos únicamente en el navegador.

## Funciones

- Fichaje de entrada/salida con cálculo real de horas (incluidos turnos nocturnos).
- **Fichaje automático** por horario habitual, con botón «Según horario» y «Completar mes» para los días sin registro.
- Registro manual y edición de jornadas, con estado confirmado/provisional y confirmación masiva.
- Horas extra por jornada y control de su pago.
- Viajes y dietas con estado cobrado/pendiente.
- Nóminas mensuales automáticas, confirmación y edición.
- Panel con **devengado, cobrado, pendiente y horas extra**, saludo personalizado y resumen contextual, con desglose del pendiente y gráfica por concepto (nóminas, extras y viajes).
- **Primeros pasos** con progreso, descarte y recordatorio de copia de seguridad.
- **Perfil personalizable**: nombre, rol, foto o logo en la barra lateral y en móvil.
- **Logo de la app** con fondo claro/oscuro, adaptación a logos apaisados y favicon dinámico.
- Informe imprimible (Guardar como PDF) con logo y cabecera de perfil.
- Backup JSON, exportación CSV, búsqueda, filtros y paginación.
- Datos en `localStorage`, con sincronización entre pestañas y aviso de última copia.

## Uso

Abre `index.html` en el navegador. No necesita instalación ni build.

Para notificaciones y para servirla por HTTP:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

## Datos

La app guarda todo en la clave `ivory37_data_v1` de `localStorage`. Usa **Ajustes → Backup JSON** con frecuencia y **Restaurar** para recuperarlo. El botón **Borrar todo** elimina los datos de este navegador. El panel recuerda cuándo hiciste la última copia y avisa si han pasado más de 30 días.

### Compatibilidad con backups antiguos

Al importar un backup de la versión anterior se migran automáticamente el logo
(`app_logo` → `custom_logo`), el nombre corrupto de la app y las claves duplicadas. Las
jornadas históricas no se borran: «Quitar autogeneradas» solo elimina las creadas con
«Completar mes».

## Perfil

En **Ajustes → Mi perfil** puedes poner tu nombre, tu rol y una foto. Si no pones foto se usa el logo de la app (cuando es cuadrado) o tus iniciales.

## Estructura

```
index.html     Aplicación completa (HTML + CSS + JS, sin dependencias)
README.md      Este archivo
MEJORAS.md     Revisión técnica: fallos corregidos y siguientes pasos
CHANGELOG.md   Historial de versiones
```

## Estado

Versión 2.2.3. Validada con pruebas de DOM (jsdom): fichaje manual y automático, edición y borrado de jornadas, viajes, nóminas, perfil, logo, estimación, importación, migración y checklist de primeros pasos.
