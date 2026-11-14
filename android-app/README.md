# 工V龱尺ㄚ㇌7 para Android

Este proyecto abre la app publicada en GitHub Pages dentro de Android System WebView, sin abrir Chrome. La primera actualización conserva el almacenamiento de la APK anterior. La interfaz se actualiza dentro de la app y mantiene una copia local para trabajar sin conexión.

La APK Android es la versión 3.2.3. En el primer inicio puede mostrar «Cargando 工V龱尺ㄚ㇌7…» mientras Android prepara WebView y migra los datos locales; después aparece el panel principal.

## Abrir y generar APK

1. Instala/abre Android Studio y elige **Open**.
2. Selecciona esta carpeta `android-app`.
3. Si Android Studio pide instalar Android SDK Platform 37, acéptalo. Selecciona JDK 17 para Gradle si te lo pregunta.
4. Espera a que termine la sincronización y pulsa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Android Studio mostrará la ubicación de `app-debug.apk`. También puedes ejecutar en Windows `gradlew.bat assembleDebug`; el resultado queda en `app/build/outputs/apk/debug/app-debug.apk`.

El APK de depuración se puede instalar directamente para uso personal. Para publicar en Play Store hay que crear y guardar tu propia clave de firma de versión.

## Uso y datos

- La versión publicada se carga dentro de la app. Los assets locales de la APK actúan como respaldo si no hay conexión.
- En **Ajustes → Nube**, crea una cuenta IVORY37 y usa la misma cuenta en el APK, el EXE y la PWA. La app mantiene copia local y sincroniza al recuperar internet.
- Si no inicias sesión, los datos permanecen solo en este dispositivo. También puedes moverlos manualmente con **Ajustes → Backup JSON** y **Restaurar**.
- Los botones de backup/CSV abren el selector Android para guardar; elige **Descargas** para encontrarlos. Los backups se importan con el selector del sistema.
- La impresión del informe usa el diálogo de impresión de Android.
- Los recordatorios de entrada/salida funcionan mientras Control laboral está abierta. Android preguntará permiso para notificaciones.
- Pulsa atrás para volver dentro de la app y, al llegar a la pantalla principal, salir.

## Seguridad y mantenimiento

La app declara permiso de Internet para GitHub Pages y Supabase, bloquea tráfico web en claro y solo mantiene dentro de WebView el sitio publicado de IVORY37. Los assets locales se sirven con `WebViewAssetLoader` como respaldo. Al publicar el HTML en `main`, la misma app recibe las actualizaciones sin reconstruir la APK.

El proyecto necesita internet la primera vez para descargar Gradle y las dependencias de compilación. La APK final no lo necesita para abrir la app.
