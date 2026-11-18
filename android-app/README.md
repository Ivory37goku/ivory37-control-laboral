# Control Laboral para Android

La APK abre la versión incluida en el instalador en Android System WebView. El panel funciona sin internet y los registros se guardan en el dispositivo. Desde la 3.3.9, las instalaciones que cargaban la web recuperan su copia local una vez al actualizar.

## Abrir y generar APK

1. Instala/abre Android Studio y elige **Open**.
2. Selecciona esta carpeta `android-app`.
3. Instala Android SDK Platform 36 y selecciona JDK 17 para Gradle.
4. Espera a que termine la sincronización y pulsa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Android Studio mostrará la ubicación de `app-debug.apk`. También puedes ejecutar en Windows `gradlew.bat assembleDebug`; el resultado queda en `app/build/outputs/apk/debug/app-debug.apk`.

El APK de depuración se puede instalar directamente para uso personal. Para publicar en Play Store hay que crear y guardar tu propia clave de firma de versión.

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
