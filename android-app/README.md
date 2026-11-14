# Control laboral para Android

Este proyecto empaqueta la app web en una aplicación Android local (Android 7.0 / API 24 o posterior). No abre Chrome ni necesita conexión para cargar la interfaz. Usa Android System WebView para mostrar los archivos incluidos. Internet se usa solo para la sincronización opcional con Supabase cuando inicias sesión.

La APK Android es la versión 3.2.1. En el primer inicio puede mostrar «Cargando Control laboral…» mientras Android prepara WebView; después aparece el panel principal.

## Abrir y generar APK

1. Instala/abre Android Studio y elige **Open**.
2. Selecciona esta carpeta `android-app`.
3. Si Android Studio pide instalar Android SDK Platform 37, acéptalo. Selecciona JDK 17 para Gradle si te lo pregunta.
4. Espera a que termine la sincronización y pulsa **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Android Studio mostrará la ubicación de `app-debug.apk`. También puedes ejecutar en Windows `gradlew.bat assembleDebug`; el resultado queda en `app/build/outputs/apk/debug/app-debug.apk`.

El APK de depuración se puede instalar directamente para uso personal. Para publicar en Play Store hay que crear y guardar tu propia clave de firma de versión.

## Uso y datos

- El HTML, el SDK de Supabase y los iconos se compilan dentro de la app, así que la interfaz sigue funcionando sin conexión.
- En **Ajustes → Nube**, crea una cuenta IVORY37 y usa la misma cuenta en el APK, el EXE y la PWA. La app mantiene copia local y sincroniza al recuperar internet.
- Si no inicias sesión, los datos permanecen solo en este dispositivo. También puedes moverlos manualmente con **Ajustes → Backup JSON** y **Restaurar**.
- Los botones de backup/CSV abren el selector Android para guardar y los backups se importan con el selector del sistema.
- La impresión del informe usa el diálogo de impresión de Android.
- Los recordatorios de entrada/salida funcionan mientras Control laboral está abierta. Android preguntará permiso para notificaciones.
- Pulsa atrás para volver dentro de la app y, al llegar a la pantalla principal, salir.

## Seguridad y mantenimiento

La app declara permiso de Internet para la API de Supabase, bloquea tráfico web en claro, bloquea navegación remota dentro de WebView y sirve los assets con `WebViewAssetLoader`. Si cambias la app web, copia `index.html`, `supabase-config.js`, `supabase-sync.js`, `sw.js` y `vendor/supabase.js` a `app/src/main/assets/` antes de compilar.

El proyecto necesita internet la primera vez para descargar Gradle y las dependencias de compilación. La APK final no lo necesita para abrir la app.
