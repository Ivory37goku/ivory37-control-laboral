# Auditoría de seguridad · Control Laboral

> Actualización: la [segunda auditoría de la 3.3.16](AUDIT-3.3.16.md) incorpora la prueba transaccional RLS, la APK en emulador y las nuevas correcciones. Este informe conserva el estado de la revisión anterior.

Fecha: 19 de noviembre de 2026. Versión de las correcciones: **3.3.14**. Creador: **工V龱尺ㄚ㇌7**.

## Resultado y alcance

Revisión del código de la PWA, sincronización, recuperación local, envoltorios Android/Electron, dependencias npm y configuración real de PostgreSQL mediante el conector de Supabase. Las consultas al servidor inspeccionaron catálogos y permisos; no se extrajeron contraseñas, hashes ni registros personales. No es una certificación ni una garantía de ausencia de vulnerabilidades.

Las tablas `ivory37_sync` y `gestion_clientes` tienen RLS activado. Sus seis políticas actuales limitan SELECT, INSERT y UPDATE de `authenticated` a `auth.uid() = user_id`, también en WITH CHECK para escrituras. No se encontraron concesiones de tablas del esquema `auth` a PUBLIC, anon ni authenticated. No se ejecutó una prueba con dos cuentas reales: las pruebas de cambio de cuenta usan sesiones simuladas.

La configuración incluida contiene una clave **publishable**, destinada al cliente; no es una clave administrativa. El barrido de patrones de los archivos actualmente versionados no encontró claves privadas, claves `sb_secret_` ni tokens GitHub. No sustituye una revisión completa del historial ni de secretos en servicios externos.

## Hallazgos y medidas

| Hallazgo | Riesgo | Resultado |
| --- | --- | --- |
| `rls_auto_enable()` tenía EXECUTE concedido a roles del cliente siendo SECURITY DEFINER. | Permiso innecesario. Devuelve `event_trigger`: no se ha demostrado una explotación por RPC. | Revocado en el servidor para PUBLIC, anon y authenticated mediante la migración `restrict_rls_event_helper_execution`. El evento interno de activación de RLS se conserva. SQL reproducible en `supabase/security-hardening.sql`. |
| Las copias nativas duplicaban todo localStorage, incluidos tokens de sesión. | Quien accediera a esa copia podría reutilizar una sesión vigente sin conocer la contraseña. | Se copian y restauran exclusivamente claves de datos de la app. Se ignoran tokens de copias antiguas; las copias se regeneran al arrancar normalmente. Una migración puede requerir volver a iniciar sesión. No se revocan automáticamente sesiones anteriores. |
| Cambiar de cuenta conservaba el mismo conjunto local y podía enviarlo a la nueva cuenta. | Mezcla y divulgación de datos entre cuentas usadas en un mismo perfil. | Vinculación local al primer usuario que sincroniza desde esta versión; otra cuenta queda bloqueada antes de acceder a la tabla. Para otra cuenta, usar un perfil de navegador o de sistema separado. No oculta los datos locales al usuario del dispositivo ni identifica retrospectivamente a su propietario antes de actualizar. |
| La respuesta de una sincronización podía continuar tras cerrar sesión. | Aplicar datos de la cuenta anterior fuera de su sesión. | Comprobaciones antes y después de las lecturas y escrituras; una respuesta con sesión cambiada se descarta. Una escritura ya enviada no puede cancelarse retrospectivamente. |
| No había una política CSP en el documento. | Una futura inyección HTML podía ejecutar scripts o enviar datos fuera de la app con menos restricciones. | CSP limita scripts a archivos propios, conexiones a su origen y al proyecto Supabase, y bloquea objetos, marcos, base y formularios. Los estilos en línea siguen permitidos por la interfaz actual. CSP complementa el escape HTML; no lo reemplaza. |
| El campo de contraseña se vaciaba solo tras un acceso correcto. | Permanencia innecesaria de la contraseña en el formulario tras un error. | Se vacía al enviar, y se elimina la referencia de la variable propia al terminar. No equivale a un borrado verificable de memoria JavaScript ni del gestor de contraseñas. |

## Pendiente de configuración y distribución

1. **Protección contra contraseñas filtradas desactivada.** Confirmado por el asesor real de Supabase antes y después de las correcciones. Activarla en Authentication → configuración de contraseñas del proyecto. La documentación indica que requiere Pro o superior; no se ha cambiado el plan ni generado costes. El conector disponible no expone la edición de esta configuración.
2. **Política de contraseñas del servidor.** El alta actual de la app admite seis caracteres. Revisar y endurecer la longitud mínima en Supabase; preferir frases de contraseña largas. No se ha verificado la configuración efectiva de longitud, confirmación de correo, CAPTCHA, límites de Auth, reautenticación ni MFA del administrador. No basta con validar en el formulario: un atacante puede llamar al API directamente.
3. **Sesiones y datos locales.** El SDK sigue guardando la sesión en localStorage para mantener el acceso entre reinicios. CSP reduce exposición a inyecciones, pero no protege frente a malware, extensiones con permisos o un dispositivo desbloqueado. Las copias JSON de jornadas y nóminas contienen datos personales sin cifrar. No compartirlas públicamente. Valorar almacenes nativos protegidos y bloqueo local en otra entrega, con migración probada.
4. **Firmas de distribución.** El APK generado es de depuración; Windows no tiene configurado un certificado comercial de firma. Antes de distribuir a terceros, preparar una clave Android de producción custodiada fuera del repositorio y firma Windows. No reemplazar la clave Android existente sin plan de actualización: puede impedir instalar encima y conservar datos.
5. **Dependencias de compilación.** `npm audit --omit=dev` informa cero avisos. La auditoría completa informa seis moderados en la cadena de electron-builder/minimatch, relacionados con denegación de servicio al procesar patrones. No se han forzado actualizaciones mayores incompatibles ni una bajada de electron-builder. Los archivos del SDK Supabase incluidos directamente y los componentes nativos no quedan cubiertos por npm audit.
6. **Cabeceras del alojamiento.** La CSP es meta; `frame-ancestors` necesita cabecera HTTP y no queda cubierto. Revisar el alojamiento si se requiere protección completa frente a clickjacking. El navegador o WebView actualizado también forma parte de la seguridad.

## Validación realizada

- Suite de sintaxis y **70 pruebas**: fichajes, nóminas, sincronización con guardados simultáneos, conflictos, copias, exportación e integridad de las versiones web/Android.
- Nuevas regresiones: exclusión y rechazo de tokens en recuperación; bloqueo de segunda cuenta; contraseña vaciada antes de la petición; cierre de sesión durante lectura remota.
- Arranque de la página real en Electron con un perfil temporal: interfaz y módulo de sincronización cargados sin errores JavaScript inesperados. Intentos de script en línea y atributo onerror bloqueados por CSP. No se inició sesión con una cuenta real.
- Compilación Android y Windows completada; se compararon los scripts y el HTML empaquetados con el código revisado y se verificó la versión de Windows. No se verificó instalación ni inicio de sesión en un teléfono físico.
- Asesor de seguridad de Supabase tras retirar EXECUTE: desaparecieron los dos avisos de la función; permanece el aviso de contraseñas filtradas.
- Las comprobaciones automáticas no son una prueba de penetración independiente. No se han probado recuperación de cuenta, entrega de correo, ataques de fuerza bruta ni autenticación en un teléfono físico.

## Estado de aplicación

La retirada de permisos está aplicada en **Supabase**. Las medidas del cliente pertenecen a **3.3.14** y requieren instalar esa versión o publicar y actualizar la PWA; no modifican por sí solas una APK ya instalada. El historial de versiones se conserva en `CHANGELOG.md`.

## Referencias

- [Supabase: seguridad de contraseñas y almacenamiento bcrypt](https://supabase.com/docs/guides/auth/password-security)
- [Supabase: sesiones y tokens](https://supabase.com/docs/guides/auth/sessions)
- [Supabase: aislamiento por filas](https://supabase.com/docs/guides/database/postgres/row-level-security)

Supabase documenta que almacena hashes bcrypt con sal, no contraseñas recuperables en texto. Robar un token de sesión sigue permitiendo actuar como el usuario mientras sea válido; por eso también se ha revisado la recuperación local.
