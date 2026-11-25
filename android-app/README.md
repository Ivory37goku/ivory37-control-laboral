# Control Laboral para Android

La APK abre la versión incluida en el instalador en Android System WebView. El panel funciona sin internet y los registros se guardan en el dispositivo. Desde la 3.3.9, las instalaciones que cargaban la web recuperan su copia local una vez al actualizar.

## Abrir y generar APK

1. Instala/abre Android Studio y elige **Open**.
2. Selecciona esta carpeta `android-app`.
3. Instala Android SDK Platform 36 y selecciona JDK 17 para Gradle.
4. Espera a que termine la sincronización y pulsa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Android Studio mostrará la ubicación de `app-debug.apk`. También puedes ejecutar en Windows `gradlew.bat assembleDebug`; el resultado queda en `app/build/outputs/apk/debug/app-debug.apk`.

Para el APK de uso personal distribuido desde 3.3.17, ejecuta `gradlew.bat assembleRelease`: queda en `app/build/outputs/apk/release/app-release.apk`, con depuración de Java y código nativo desactivada.

Esta compilación conserva deliberadamente **la clave de firma heredada de las APK anteriores** (`signingConfigs.debug`) para permitir actualizar sin desinstalar ni perder datos. No equivale a una clave de producción nueva ni sirve como preparación para Play Store. Android no requiere comprar un certificado para firmar APK; antes de distribuir a terceros hay que custodiar una clave de producción y planificar la migración de identidad. No sustituir la clave sin probar la actualización.

`assembleAudit` genera un paquete de pruebas separado con sufijo `.audit`; nunca debe entregarse como actualización de la app habitual.

## Uso y datos

- Para actualizar, instala la APK nueva sobre la anterior con la misma firma.
- En **Ajustes → Nube**, crea una cuenta IVORY37 y usa la misma cuenta en el APK, el EXE y la PWA. La app mantiene copia local y sincroniza al recuperar internet.
- Si no inicias sesión, los datos permanecen solo en este dispositivo. También puedes moverlos manualmente con **Ajustes → Backup JSON** y **Restaurar**.
- Los botones de backup/CSV abren el selector Android para guardar; elige **Descargas** para encontrarlos. Los backups se importan con el selector del sistema.
- La impresión del informe usa el diálogo de impresión de Android.
- Los recordatorios de entrada/salida funcionan mientras Control laboral está abierta. Android preguntará permiso para notificaciones.
- Pulsa atrás para volver dentro de la app y, al llegar a la pantalla principal, salir.

## Seguridad y mantenimiento

WebView sirve los archivos incluidos en la APK con `WebViewAssetLoader`. La sincronización opcional utiliza Supabase por HTTPS. Los cambios del panel llegan a Android al reconstruir la APK.

El proyecto necesita internet la primera vez para descargar Gradle y las dependencias de compilación. La APK final no lo necesita para abrir la app.
## APK de prueba 3.3.23

`gradlew.bat assemblePreview` genera una APK con depuración desactivada y el identificador `com.ivory37.controllaboral.preview`. Aparece como **Control Laboral · Prueba** y puede convivir con la instalación anterior. Empieza con su propio almacenamiento. Para actualizar la instalación habitual hace falta firmar con el certificado de esa instalación.
