# Auditoría de Control Laboral · 3.3.16

**19 de noviembre de 2026 · Creador: 工V龱尺ㄚ㇌7**

## Resultado

Segunda revisión del código, funcionamiento, presentación y seguridad, sobre las mejoras 3.3.14–3.3.15. Se conservan el dashboard Aurora y el único bloque de fichaje. Se corrigieron cuatro problemas reproducibles y se añadieron restricciones de permisos en Windows. No es una certificación de seguridad ni una prueba de penetración independiente.

## Problemas corregidos

| Área | Comportamiento anterior | Resultado en 3.3.16 |
| --- | --- | --- |
| Sesiones | Una respuesta tardía de `getSession()` podía restaurar la referencia de una sesión cerrada y empezar a consultar datos. | Se compara la sesión y su generación antes de aceptar la respuesta; la recuperación inicial también descarta respuestas anteriores a un evento de Auth. Prueba reproducida antes de corregir. |
| Copias importadas | Solo se limitaba el número de jornadas; otras listas o su total podían superar ese límite. Una colección con formato incorrecto podía normalizarse a vacía. | Límite conjunto de 50.000 registros, validación de listas y objetos, manteniendo compatibilidad con copias antiguas sin colecciones opcionales. Pruebas reproducidas antes de corregir. |
| Turnos nocturnos | Un registro cerrado de hoy ocultaba la salida de un turno de ayer que seguía abierto. | Se priorizan los turnos abiertos de hoy y ayer. Se conserva el registro cerrado y aparece la salida correcta. Prueba reproducida antes de corregir. |
| Recuperación nativa | Restaurar JSON o una copia interna no actualizaba inmediatamente la copia del puente nativo. | Se actualiza también esa copia tras guardar correctamente la restauración; los tokens siguen excluidos. |
| Permisos Windows | No había una política explícita de denegación para permisos no usados por la app. | Cámara, micrófono, ubicación y otros permisos se deniegan; solo se permiten notificaciones desde el documento principal local. Verificado en el proceso principal real: ubicación `denied`, notificaciones `granted`. |

## Presentación y uso

- El bloque de hoy distingue los estados con una etiqueta y ofrece **Revisar jornada** cuando ya existe un registro, en lugar de abrir otro registro nuevo.
- Un turno de ayer abierto indica «Desde ayer a las …».
- Se mantiene un único control de entrada/salida. Las acciones tienen una altura mínima de 44 px.
- Se revisó la presentación real en WebView Android con datos ficticios y el desbordamiento horizontal en Electron a 320, 390, 768 y 1440 px.
- No se ha hecho una evaluación completa con lector de pantalla ni una certificación WCAG.

## Prueba pendiente añadida: aislamiento RLS real

Se ejecutó [el SQL transaccional](../supabase/tests/rls-isolation.sql) en el proyecto Supabase real. Crea dos usuarios ficticios y filas temporales dentro de una transacción, cambia al rol `authenticated` y configura el identificador de cada usuario como lo recibe PostgreSQL. Comprueba ambas tablas (`ivory37_sync` y `gestion_clientes`):

1. Cada usuario ve únicamente su propia fila.
2. Puede modificar su fila y no la del otro.
3. No puede insertar a nombre de otro, transferir la propiedad ni usar DELETE sin autorización.
4. El rol `anon` no puede consultar las tablas.

**Resultado: 24 comprobaciones de usuarios + 2 anónimas, todas correctas.** La transacción terminó en ROLLBACK. Una consulta posterior confirmó cero usuarios y cero filas de prueba restantes.

Esto prueba las reglas reales de PostgreSQL con identidades suministradas para el test. No equivale a probar dos inicios de sesión reales mediante correo, contraseña y tokens del servicio Auth; tampoco prueba recuperación de contraseña ni entrega de correo. No se leyeron contraseñas, hashes ni datos personales para ejecutar la prueba.

## Recorridos completos probados

Se ejecutó el mismo recorrido de interfaz con datos ficticios en Electron y en una APK de auditoría con identificador separado `com.ivory37.controllaboral.audit`. Esa APK no comparte datos con la instalación habitual.

| Comprobación | Electron | WebView de APK en emulador |
| --- | --- | --- |
| Una única acción de fichaje en Resumen | Correcto | Correcto |
| Entrada → salida → jornada cerrada | Correcto | Correcto |
| Revisar y guardar 8 h normales + 1 h extra | Correcto | Correcto |
| Crear viaje de 12,50 € | Correcto | Correcto |
| Navegar por las cinco pantallas | Correcto | Correcto |
| Notas con etiquetas HTML mostradas como texto, sin ejecutar contenido | Correcto | Correcto |
| Importar una copia JSON mediante el formulario y reiniciar | Correcto | Correcto |
| Actualizar APK de auditoría 3.3.15 → 3.3.16 conservando los datos ficticios | No aplica | Correcto |
| Reiniciar la APK con red deshabilitada en su WebView y conservar los datos | No aplica | Correcto |

El perfil de auditoría contenía una jornada y un viaje. Tras actualizar y arrancar sin red se conservaron ambos, incluida la hora extra. Estas comprobaciones se hicieron en un emulador; no en un teléfono físico ni con una cuenta real.

## Seguridad y dependencias

- El asesor actual de Supabase mantiene **un aviso**: protección contra contraseñas filtradas desactivada. Los permisos innecesarios retirados en la revisión anterior siguen sin aparecer como aviso.
- `npm audit --omit=dev`: **0 avisos**. Auditoría completa: **6 moderados** en la cadena de compilación de electron-builder/minimatch; siguen pendientes de una actualización compatible. No se ha forzado una bajada de versión ni una sustitución mayor sin comprobar compatibilidad.
- Escaneo de patrones de secretos en **300 blobs de texto** del historial Git: no se encontraron claves privadas, claves `sb_secret_` ni tokens GitHub con los patrones comprobados. Este resultado no descarta otros formatos de secretos.
- El SDK Supabase incluido como archivo, AndroidX y Chromium/WebView no están cubiertos por npm audit.

## Pendientes que no se deben confundir con fallos corregidos

- Activar protección contra contraseñas filtradas en Supabase, disponible en Pro o superior, y verificar la política del servidor: longitud, confirmación de correo, CAPTCHA, límites, reautenticación y MFA del administrador. No se cambió el plan ni se generaron costes.
- Probar recuperación de cuenta y correo con cuentas de prueba autorizadas. No se enviaron correos a personas.
- Sesiones persistentes en localStorage y copias de datos personales sin cifrar: siguen requiriendo un dispositivo protegido y una gestión cuidadosa de los backups.
- El APK entregable sigue usando firma de depuración y el instalador Windows carece de firma de editor. Preparar distribución firmada antes de entregarlo a terceros, conservando la continuidad de la clave Android.
- Verificar en un teléfono físico, con accesibilidad y condiciones de red reales. La prueba SQL no cubre el servicio Auth ni el transporte Realtime.
- La CSP meta no aporta `frame-ancestors`; esa protección requiere una cabecera HTTP del alojamiento.

## Repetir las pruebas

```powershell
npm run check
.\node_modules\.bin\electron.cmd scripts/qa-ui.cjs
```

Para Android, arrancar el emulador `emulator-5554`, compilar `assembleAudit`, instalar `app-audit.apk` y abrir su actividad. Después:

```powershell
node scripts/qa-ui.cjs --android
```

El script de Android resuelve exclusivamente el PID del paquete `.audit` y prepara su puerto de depuración. Los recorridos reinician **los datos ficticios del perfil de prueba**; no ejecutar adaptaciones contra el paquete habitual. La APK de auditoría nunca se distribuye como actualización de la app normal.

La suite contiene **75 pruebas** de sintaxis/regresión y se complementa con los recorridos de interfaz y la prueba SQL. La compilación no actualiza una APK instalada ni publica por sí sola la PWA.

## Referencias

- [Auditoría anterior](SECURITY-AUDIT.md)
- [Electron: recomendaciones de seguridad](https://www.electronjs.org/docs/latest/tutorial/security)
- [Supabase: Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase: seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security)
