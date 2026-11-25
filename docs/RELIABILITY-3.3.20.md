# Fiabilidad · Control Laboral 3.3.20

22 de noviembre de 2026 · Creador: **工V龱尺ㄚ㇌7**

## Los siete frentes

| Frente | Implementación |
| --- | --- |
| Almacenamiento | Datos, copias y seguimiento de sincronización pasan a IndexedDB. La migración relee y compara los valores antes de retirar sus copias de localStorage. Las sesiones del SDK no se migran ni se incluyen en copias de jornadas. |
| Escritura y recuperación | El formulario espera a la transacción antes de confirmar el guardado. Un aborto conserva el dato anterior y deja abierto el formulario. Antes de guardar se conserva una copia previa; las restauraciones validan el contenido. Dos ventanas no pueden sobrescribir silenciosamente el mismo estado antiguo. |
| Nube | El contador de revisión avanza por encima de las revisiones conocidas, incluso con un reloj atrasado. Realtime conserva consultas de respaldo: cada 30 segundos si está caído, y una comprobación de seguridad a los cinco minutos si funciona. Se conserva el control de conflictos y de cambio de cuenta. |
| Cálculos | Se añaden 50 escenarios contables dentro de una prueba que combina tarifas históricas, horas extra pagadas o pendientes, viajes y nóminas. Se comprueban devengado = cobrado + pendiente y valor de extras = extras cobradas + pendientes. |
| Cuenta y acceso local | Recuperación por correo, verificación mediante código o dirección final del enlace, comprobación del correo de la identidad y cambio de contraseña. PIN opcional de 6–12 cifras derivado mediante PBKDF2-SHA256 con sal aleatoria y 210.000 iteraciones; bloqueo al abrir o tras cinco minutos fuera de la app. |
| Recordatorios Android | AlarmManager y receptor nativo sin dependencia de una pantalla abierta. Se reprograman tras reinicio, cambio de fecha/zona y actualización de paquete. Usan el horario habitual y el último fichaje conocido por este dispositivo. |
| Actualizaciones y entregas | Consulta manual de la última versión publicada en GitHub, comparación numérica y enlace al repositorio oficial. Versiones iguales, antiguas, borradores o preliminares no provocan un anuncio de actualización. Nuevos recorridos de interfaz y fiabilidad añadidos al workflow de Windows. |

Se añade «Deshacer último borrado» en Ajustes → Datos y copias. Recupera los registros eliminados sin sustituir otros registros que hayan cambiado después. La copia previa permite recuperar el estado anterior a la última operación guardada. Las pestañas se renderizan al mostrarse.

## Uso

- **PIN:** Ajustes → Privacidad y recordatorios. Para cambiarlo o quitarlo se necesita el PIN actual. El bloqueo está desactivado hasta que se configura.
- **Recordatorios:** actívalos con el botón de notificaciones y concede el permiso de Android. Se pueden desactivar desde Privacidad y recordatorios.
- **Contraseña olvidada:** indica tu correo y abre «Recuperar contraseña». Solicita el mensaje, abre su enlace y utiliza la dirección final de recuperación, o el código si la plantilla de correo lo incluye. Introduce la nueva contraseña. No compartas el código ni el enlace.
- **Actualización:** «Comprobar actualización» consulta versiones publicadas. La instalación es manual y mantiene el identificador y el perfil de datos. Exporta un JSON antes de actualizar.

## Comprobaciones reproducibles

```sh
npm run check
npm run test:ui
npm run test:reliability
```

La suite contiene **85 pruebas**. Los recorridos de Electron usan un perfil temporal y datos ficticios. Cubren fichaje, edición, confirmación de nómina, borrado y deshacer, cinco pantallas, escape de HTML, copia/restauración y reinicio. La prueba de fiabilidad comprueba migración desde localStorage, conservación de claves de Auth, transacciones abortadas, un fallo de guardado desde el formulario real, edición concurrente desde dos ventanas, 7 MB con reinicio, PIN correcto/incorrecto y comparación de versiones.

Android tiene la variante `.audit`, separada de la instalación del usuario, y pruebas instrumentadas en `ReminderTest.java`. No se modifica ni se borra la instalación personal para comprobarlas.

Resultados de esta entrega:

- **Electron:** recorridos de interfaz y fiabilidad aprobados con la 3.3.20.
- **Android WebView:** fichaje, edición, confirmación de nómina, borrado y deshacer, cinco pestañas, copia/restauración y reinicio sin conexión aprobados con la 3.3.20.
- **Android instrumentado:** dos pruebas aprobadas. Se comprueban las condiciones de entrada/salida y desactivación; además, una alarma real del sistema alcanza el receptor y publica la notificación sin abrir una Activity. No se verifica una detención forzada desde Ajustes.
- **Paquetes:** APK 3.3.20, código 29, depuración desactivada y mismo certificado que la 3.3.19. Recursos incorporados al APK y al archivo ASAR de Windows comparados con el código final: coinciden.
- **Dependencias:** auditoría npm completa sin avisos conocidos. No sustituye la revisión de AndroidX, WebView ni del SDK distribuido como archivo.
- **Entrega local:** `Control Laboral 3.3.20.apk` y `Control Laboral Setup 3.3.20.exe` en Descargas.

## Alcance y límites

- IndexedDB tiene una cuota dependiente del dispositivo. Se solicita almacenamiento persistente cuando el navegador lo admite; no equivale a una copia externa ni protege frente a desinstalar la app o borrar sus datos.
- El documento de nube mantiene su límite independiente de 5 MB. Esta versión no migra el esquema productivo a filas por registro ni elimina ese límite. Local y nube presentan estados separados.
- Los recordatorios son **inexactos**: Android puede retrasarlos por Doze o ahorro de batería. Forzar la detención de la app desde Ajustes puede impedirlos hasta volver a abrirla. No se promete precisión al minuto en todos los teléfonos. [Referencia de Android](https://developer.android.com/develop/background-work/services/alarms).
- El PIN protege la pantalla; **no cifra** IndexedDB, el perfil del dispositivo ni las copias JSON. No sustituye el bloqueo y cifrado del sistema. El PIN no se sincroniza ni se exporta con los datos de jornadas.
- Recuperación probada con respuestas controladas del SDK. No se enviaron mensajes a usuarios reales ni se declara validado el circuito de correo SMTP de producción. Los límites de envío y las plantillas del proyecto condicionan el correo. [Referencia de Supabase](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail).
- Revisión Supabase: las políticas siguen restringidas a `auth.uid() = user_id`. El asesor mantiene el aviso de protección contra contraseñas filtradas desactivada; su activación exigió Pro en la revisión anterior y se mantiene el plan gratuito. [Detalle de la protección](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).
- La APK conserva la firma heredada y el instalador Windows no tiene certificado de editor. No se han contratado servicios de pago.
- La revisión original de 17 hallazgos incluía cuestiones adicionales, como el cálculo de tiempo en transiciones horarias, el día de nómina configurable y un protocolo de sincronización por deltas. No se presentan como resueltas por estas siete mejoras.

Las compilaciones se entregan para instalar localmente. Esta revisión no publica ni fusiona cambios en GitHub ni aplica migraciones a datos de producción.
