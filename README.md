# IVORY37 · Control laboral 🥋

> **Panel personal de jornadas, horas extra, viajes y nóminas.**
> Una aplicación web de una sola página, sin dependencias y sin conexión, para saber
> qué has trabajado, qué te deben y qué has cobrado.

![Versión](https://img.shields.io/badge/version-2.2.5-orange)
![Licencia](https://img.shields.io/badge/license-MIT-green)
![Dependencias](https://img.shields.io/badge/dependencies-0-brightgreen)

---

## ✨ Características

### 📊 Panel

- Cuatro indicadores: **Cobrado, A cobrar, Horas extra y Valor extras**.
- **A cobrar** = horas extra + viajes sin cobrar. La nómina sin confirmar se gestiona en
  Pagos y no se suma aquí, para no duplicarla.
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
- Backup JSON, exportación CSV, restauración y aviso de la última copia.
- Datos en `localStorage`, sin servidor y con sincronización entre pestañas.

---

## 🛠️ Tecnologías

- **HTML5 + JavaScript vanilla**, sin frameworks ni build.
- **CSS propio**, iconos SVG inline y gráficas SVG/CSS.
- **Cero dependencias y cero peticiones externas** en la app.
- Informe mediante la impresión del navegador (sin jsPDF).
- **localStorage** para los datos y un service worker no es necesario: la app funciona
  igual con o sin conexión.

---

## 🚀 Cómo empezar

### Uso directo

Abre `index.html` en el navegador. No necesita instalación ni servidor.

Para notificaciones y para servirla por HTTP:

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
> actual es este repositorio y el `index.html` incluido.

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
- Jornadas, nóminas, ajustes y logo se guardan solo en el `localStorage` del navegador.

> **Aviso:** si borras los datos del sitio o usas modo incógnito, perderás la
> información. Descarga un **Backup JSON** con frecuencia desde Ajustes.

---

## 📁 Estructura

```
index.html     Aplicación completa (HTML + CSS + JS, sin dependencias)
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

**Ivory37goku**

> «El control laboral no debería ser complicado. Debería ser elegante.»
