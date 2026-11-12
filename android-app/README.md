# Control laboral para Android

Este proyecto empaqueta la app web en una aplicación Android local (Android 7.0 / API 24 o posterior). No abre Chrome ni necesita conexión para cargar la interfaz. Usa Android System WebView para mostrar los archivos incluidos.

La APK Android es la versión 3.1.2. En el primer inicio puede mostrar «Cargando Control laboral…» mientras Android prepara WebView; después aparece el panel principal.

## Abrir y generar APK

1. Instala/abre Android Studio y elige **Open**.
2. Selecciona esta carpeta `android-app`.
3. Si Android Studio pide instalar Android SDK Platform 37, acéptalo. Selecciona JDK 17 para Gradle si te lo pregunta.
4. Espera a que termine la sincronización y pulsa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Android Studio mostrará la ubicación de `app-debug.apk`. También puedes ejecutar en Windows `gradlew.bat assembleDebug`; el resultado queda en `app/build/outputs/apk/debug/app-debug.apk`.

El APK de depuración se puede instalar directamente para uso personal. Para publicar en Play Store hay que crear y guardar tu propia clave de firma de versión.

## Uso y datos

- El HTML y los iconos se compilan dentro de la app, así que la interfaz funciona sin conexión.
- La app almacena los datos en el almacenamiento privado de Android. No se comparten automáticamente con Firefox ni con GitHub Pages.
- Para moverlos desde la PWA publicada: en la web abre **Ajustes → Backup JSON**; en Android usa **Ajustes → Restaurar**.
- Los botones de backup/CSV abren el selector Android para guardar y los backups se importan con el selector del sistema.
- La impresión del informe usa el diálogo de impresión de Android.
- Los recordatorios de entrada/salida funcionan mientras Control laboral está abierta. Android preguntará permiso para notificaciones.
- Pulsa atrás para volver dentro de la app y, al llegar a la pantalla principal, salir.

## Seguridad y mantenimiento

La app no declara permiso de Internet, no permite tráfico web, bloquea navegación remota dentro de WebView y sirve los assets con `WebViewAssetLoader`. Si se cambia el HTML de la PWA, copia la nueva versión a `app/src/main/assets/index.html` y conserva el pequeño puente Android indicado en el archivo.

El proyecto necesita internet la primera vez para descargar Gradle y las dependencias de compilación. La APK final no lo necesita para abrir la app.
