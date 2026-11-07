# Cambios

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
