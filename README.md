# IVORY37 · Control laboral 🥋

> **Panel personal de jornadas, horas extra, viajes y nóminas.**
> Una aplicación web de una sola página, sin dependencias y sin conexión, para saber
> qué has trabajado, qué te deben y qué has cobrado.

👉 **Demo:** https://ivory37goku.github.io/ivory37-control-laboral/

![Versión](https://img.shields.io/badge/version-3.1.0-orange)
![Licencia](https://img.shields.io/badge/license-MIT-green)
![Dependencias](https://img.shields.io/badge/dependencies-0-brightgreen)

---

## ✨ Características

### 📊 Panel

- Cuatro indicadores: **Cobrado, A cobrar, Horas extra y Valor extras**.
- **A cobrar** suma nóminas automáticas aún sin confirmar, extras confirmadas sin pagar
  y viajes pendientes. Las horas provisionales se excluyen hasta confirmarlas.
- **Flujo de caja (pend.)**: barras mensuales de horas extra con eje, total y aviso de
  los viajes pendientes.
- Desglose de lo pendiente y saludo personalizado.

### ⏱️ Fichaje y jornadas

- Entrada/salida con cálculo real de horas, incluidos turnos nocturnos.
- **Fichaje automático** por horario, botón «Según horario» y «Completar mes».
- Edición, borrado, filtros, búsqueda, paginación y confirmación masiva.
- Horas extra por jornada con control de pago independiente.

### 💰 Nóminas y pagos

- Nóminas mensuales automáticas, confirmación y edición.
- Viajes y dietas con estado cobrado/pendiente.
- Informe imprimible (**Guardar como PDF** del navegador) con logo y cabecera de perfil.

### 🎨 Personalización y datos

- **Perfil**: nombre, rol y foto o logo en la barra lateral y en móvil.
- **Logo de la app** con fondo claro/oscuro y adaptación a logos apaisados; favicon
  dinámico.
- Backup JSON, exportación CSV segura frente a fórmulas, restauración transaccional y
  aviso de la última copia.
- Datos en `localStorage`, sin servidor y con sincronización entre pestañas.
- **PWA instalable y offline** en GitHub Pages: manifest, iconos válidos, actualización
  controlada y copia en caché de la aplicación.

## 📸 Capturas

<p align="center">
  <img src="docs/dashboard.jpg" alt="Panel principal de IVORY37" width="100%">
</p>
<p align="center"><em>Panel principal · datos de ejemplo</em></p>

<p align="center">
  <img src="docs/jornadas.jpg" alt="Registro de jornadas" width="49%">
  <img src="docs/ajustes.jpg" alt="Ajustes, perfil y logo" width="49%">
</p>
<p align="center"><em>Jornadas y ajustes</em></p>

<p align="center">
  <img src="docs/mobile.jpg" alt="Vista móvil del panel" width="320">
</p>
<p align="center"><em>Vista móvil</em></p>

<p align="center"><em>Datos de ejemplo. La app no envía tus datos a ningún servidor.</em></p>

---

## 🛠️ Tecnologías

- **HTML5 + JavaScript vanilla**, sin frameworks ni build.
- **CSS propio**, iconos SVG inline y gráficas SVG/CSS.
- **Cero dependencias y cero peticiones externas** en la app.
- Informe mediante la impresión del navegador (sin jsPDF).
- **localStorage** para los datos. El service worker guarda la app para abrirla sin
  conexión después de la primera visita; la sincronización de los datos sigue siendo local
  al navegador y no se comparte entre dispositivos.

---

## 🚀 Cómo empezar

### PWA en GitHub Pages

Abre https://ivory37goku.github.io/ivory37-control-laboral/ desde Chrome/Edge en Android
(o Safari en iPhone/iPad). En Android usa el botón **Instalar app** o el menú del navegador;
en iOS usa **Compartir → Añadir a pantalla de inicio**. La app se puede abrir sin conexión
tras su primera carga.

GitHub Pages ya sirve el repositorio; al publicar los cambios en `main`, sus archivos de
raíz (`index.html`, `manifest.json`, `sw.js` e iconos) se actualizan allí automáticamente.

### APK para Android

El proyecto Android está en [`android-app/`](android-app/). La APK actual es 3.1.2 e incluye el
contenido web 3.1.0; abre la interfaz mediante Android WebView, sin lanzar Chrome ni necesitar
conexión. En Android Studio abre esa carpeta y compila **Build → Build Bundle(s) / APK(s) → Build APK(s)**; los pasos
completos y el comando `gradlew.bat assembleDebug` están en `android-app/README.md`.
La APK guarda los datos separadamente de GitHub Pages y Firefox: usa Backup JSON para
trasladarlos entre ambas.

### Uso directo

Abre `index.html` para usarla en el ordenador. La instalación PWA y el modo offline del
service worker requieren la dirección HTTPS de GitHub Pages (o un servidor local).

Para probarla por HTTP local:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

### Clonar

```bash
git clone https://github.com/Ivory37goku/ivory37-control-laboral.git
cd ivory37-control-laboral
```

> La antigua demo `/ki-control/` corresponde a una **versión anterior**. La versión
> actual está en https://ivory37goku.github.io/ivory37-control-laboral/ y en este
> repositorio (`index.html`).

### Primeros pasos

1. Abre **Ajustes → Mi perfil** y pon tu nombre.
2. Revisa **Tarifas y jornada** (precio/hora, jornada diaria y horario).
3. Si vienes de la versión anterior, entra en **Ajustes → Restaurar** e importa tu
   backup JSON. Se migran el logo y el nombre antiguos.

---

## 🔒 Privacidad

Esta aplicación es **100 % client-side**:

- No envía datos a servidores externos.
- No tiene backend ni base de datos remota.
- Jornadas, nóminas, ajustes y logo se guardan solo en el `localStorage` de ese navegador
  y esa dirección web. Para trasladar datos entre `file://`, GitHub Pages o dispositivos,
  exporta un Backup JSON e impórtalo en el otro sitio.

> **Aviso:** si borras los datos del sitio o usas modo incógnito, perderás la
> información. Descarga un **Backup JSON** con frecuencia desde Ajustes.

---

## 📁 Estructura

```
index.html     Aplicación web completa (HTML + CSS + JS, sin dependencias)
android-app/   Proyecto Android WebView y guía para compilar APK
docs/          Capturas para el README
README.md      Este archivo
CHANGELOG.md   Historial de versiones
MEJORAS.md     Revisión técnica y siguientes pasos
LICENSE        Licencia MIT
```

---

## 🤝 Contribuir

1. Haz un fork del proyecto.
2. Crea una rama: `git checkout -b feature/mi-mejora`.
3. Commit: `git commit -m 'Añade mi mejora'`.
4. Push: `git push origin feature/mi-mejora`.
5. Abre un Pull Request.

---

## 📄 Licencia

Distribuido bajo la licencia **MIT**. Consulta [LICENSE](LICENSE).

---

## 👨‍💻 Autor

**工V龱尺ㄚ㇌7**

> «El control laboral no debería ser complicado. Debería ser elegante.»
