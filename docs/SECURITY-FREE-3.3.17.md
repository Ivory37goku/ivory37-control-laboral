# Seguridad gratuita · Control Laboral 3.3.17

19 de noviembre de 2026 · Creador: **工V龱尺ㄚ㇌7**.

## Aplicado y comprobado

En el panel real de Supabase se guardaron y volvieron a abrir los ajustes del proveedor de correo:

- Longitud mínima de contraseña: **12 caracteres**.
- Requisitos: **minúsculas, mayúsculas, números y símbolos**.
- **Cambio seguro de contraseña activado**: exige una sesión reciente o reautenticación para los cambios contemplados por Supabase.
- Confirmación de correo activada; cambio seguro de correo activado; acceso anónimo desactivado.
- Límites existentes verificados: 30 registros/inicios de sesión por IP cada cinco minutos; 30 verificaciones OTP/enlace por IP cada cinco minutos; 150 renovaciones de token por IP cada cinco minutos. No se cambiaron para evitar bloqueos a usuarios que comparten conexión.

Esta política de Auth afecta al proyecto compartido por Control Laboral y Gestión Clientes. La validación del alta de Control Laboral se ha alineado con el servidor; el inicio de sesión conserva la validación anterior y no impone en el formulario una contraseña nueva a usuarios existentes. No se han cambiado contraseñas de personas ni cerrado sus sesiones.

La protección HaveIBeenPwned de Supabase se intentó activar y el servidor rechazó el guardado indicando que requiere Pro. Después se guardaron correctamente las mejoras gratuitas con esa función desactivada. **La organización sigue en Free y no se ha contratado ninguna suscripción**. El aviso de contraseñas filtradas del asesor permanece y se acepta como limitación del plan solicitado por el propietario.

## Dependencias

Las versiones vulnerables 9/10 de minimatch de la cadena de electron-builder se sustituyen por **11.0.6** mediante un override acotado en package.json y lockfile. Se conserva electron-builder 26.18.0. Se revisaron los cambios de API de minimatch y se completó el instalador Windows con la versión nueva; no se han probado empaquetados macOS ni Linux.

`npm audit` completo: **cero vulnerabilidades conocidas notificadas**, incluidas las dependencias de desarrollo. Esto no cubre el SDK incluido directamente, AndroidX ni el sistema WebView, ni constituye garantía de ausencia de vulnerabilidades.

## APK y Windows

La APK entregada usa `assembleRelease`, con `debuggable false` y `jniDebuggable false`. Se verificó el manifiesto empaquetado, la firma y los recursos. El certificado SHA-256 coincide con el de la APK 3.3.16, por lo que se conserva la identidad necesaria para actualizar. No se ha generado una clave nueva ni rotado la firma.

**Limitación de firma:** se sigue usando la clave heredada configurada como signingConfigs.debug; desactivar la depuración no convierte esa clave en una nueva clave de producción. No se ha preparado una publicación en Play Store ni una migración de firma para distribuir a terceros. El instalador Windows sigue sin certificado de editor: no hay uno válido con clave privada en el almacén del usuario revisado. No se ha creado un certificado autofirmado para aparentar confianza del sistema ni comprado un certificado.

## Pruebas

- **76 pruebas** de regresión y validación de sintaxis correctas.
- Política de altas probada con contraseñas ficticias; entrada de cuentas existentes conserva la validación previa.
- Recorrido Electron correcto: entrada/salida, edición de jornada, cinco pantallas, escape de notas HTML y restauración/reinicio; sin desbordamiento a 320, 390, 768 y 1440 px.
- APK release compilada y comprobada; instalador Windows compilado con minimatch actualizado. Los scripts y el HTML empaquetados coinciden con los revisados.
- La prueba RLS de 26 comprobaciones y la prueba de actualización/offline en emulador siguen documentadas en la auditoría 3.3.16. No se han repetido con contraseñas reales ni se ha probado la APK 3.3.17 en un teléfono físico.

## Lo que sigue requiriendo preparación adicional

CAPTCHA está desactivado. No se ha activado sin integrar y configurar un proveedor: hacerlo impediría registrarse e iniciar sesión con los clientes actuales. Su integración requeriría claves válidas del proveedor y probar PWA, APK y EXE. No se han creado cuentas externas ni aceptado términos en nombre del propietario.

El MFA de la cuenta administradora requiere que el propietario registre su dispositivo y custodie los códigos; no se ha hecho ni se afirma que esté activado. Tampoco se han enviado correos de recuperación a personas o cambiado credenciales para simular esa comprobación.

La protección de sesiones locales, backups sin cifrar y cabeceras del alojamiento conserva los límites descritos en el informe anterior. Ningún cambio de configuración publica automáticamente la PWA ni instala la APK nueva en un teléfono.

## Referencias

- [Auditoría 3.3.16](AUDIT-3.3.16.md)
- [Supabase: seguridad de contraseñas](https://supabase.com/docs/guides/auth/password-security)
- [Aviso corregido de minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249)
- [Cambios de API de minimatch 11](https://github.com/isaacs/minimatch/blob/main/changelog.md)
