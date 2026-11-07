# 工V龱尺㇌7 | Control Laboral Pro 🥋

> **Dashboard Ejecutivo de Gestión Laboral & Nóminas Automáticas.**  
> Una solución web moderna, oscura y ultra-rápida para freelancers y trabajadores por cuenta ajena que necesitan controlar horas, extras, viajes y nóminas sin salir del navegador.

[![License](https://img.shields.io/badge/License-MIT-green.svg?style=flat-square)](LICENSE)

---

## ✨ Características Principales

### 📊 Dashboard Ejecutivo Premium
- **Visualización en Tiempo Real:** KPIs claros de Total Cobrado, Pendiente, Horas Extra Acumuladas y Valor Económico.
- **Objetivo Mensual Inteligente:** Gráfica donut que calcula tu ritmo diario necesario para cumplir las 168h/mes (o lo que configures).
- **Evolución Financiera:** Barras apiladas mostrando exactamente cuánto tienes pendiente de cobrar vs. lo ya liquidado.
- **Resumen de Nóminas:** Vista rápida de las últimas 3 nóminas generadas automáticamente con su estado (Confirmada/Pendiente).

### ⏱️ Fichaje & Jornadas
- **Botones Rápidos:** Registro de Entrada/Salida con un solo clic. Cálculo automático de horas normales (>8h = extra).
- **Gestión Flexible:** Editar horarios manualmente, añadir horas extra retrospectivas o confirmar jornadas provisionales en masa.
- **Filtros Avanzados:** Ver solo Confirmados, Provisionales o Jornadas con Extras.
- **Exportación Profesional:** Genera informes PDF detallados o exporta a Excel/CSV con un botón.

### 💰 Nóminas & Pagos Automatizados
- **Motor de Nóminas Auto-generadas:** Calcula mensualmente `Horas Normales × Tarifa Base`. No requiere intervención manual constante.
- **Control de Estado:** Diferencia clara entre nóminas *Automáticas* (pendientes de revisión), *Manuales* y *Confirmadas*.
- **Gestión de Extras Individuales:** Marca cada jornada con extras como "Pagada" o "Pendiente" independientemente.
- **Viajes & Dietas:** Registro separado de gastos de desplazamiento con marcaje de cobro.

### 🎨 Personalización Total (White-Label Ready)
- **Branding Dinámico:** Cambia el nombre de la App y el Color Primario desde Ajustes. La interfaz se adapta instantáneamente.
- **Logo Propio:** Sube tu logo (JPG/PNG/SVG) vía drag-and-drop o selector de archivos. Se muestra en header y notificaciones.
- **Tarifas Configurables:** Define tu precio/hora normal y extra. El sistema recalcula todo al guardar.
- **Modo Offline First:** Funciona sin internet. Los datos se guardan en LocalStorage y se sincronizan cuando vuelves online.

---

## 🛠️ Tecnologías Utilizadas

- **Frontend Framework:** HTML5 + Vanilla JavaScript (Sin frameworks pesados, máxima velocidad).
- **Estilos:** Tailwind CSS (CDN) + Custom Glassmorphism CSS.
- **Gráficas:** Chart.js v4 (Responsive & Dark Theme ready).
- **Iconos:** Font Awesome 6.
- **Tipografía:** Inter (UI) + JetBrains Mono (Datos/Números).
- **Almacenamiento:** Browser LocalStorage (Persistencia local segura).
- **Servicios:** Service Worker (Cache offline) + Web Notifications API.
- **Reportes:** jsPDF (Generación de PDF client-side).

---

## 🚀 Cómo Empezar

### Opción 1: Uso Directo (Recomendada)
Simplemente abre la aplicación web:
👉 **[Ver Demo Live](https://ivory37goku.github.io/ki-control/)**

### Opción 2: Instalación Local
Si quieres usarla en tu propio equipo o modificarla:

1. **Clona el repositorio:**
   ```bash
   git clone https://github.com/Ivory37goku/ki-control.git
   cd ki-control


   Abre el archivo:
Simplemente haz doble clic en index.html o sirve la carpeta con cualquier servidor estático (ej. VS Code Live Server):
bash
   # Si tienes Python instalado
   python -m http.server 8000
   # Luego visita http://localhost:8000
Configura tus datos:
Ve a la pestaña Ajustes.
Introduce tu Nombre de App, Color y Tarifas Horarias.
Sube tu Logo si deseas branding personalizado.
Pulsa Guardar Todo.
📸 Capturas de Pantalla
<img width="1920" height="945" alt="Captura de pantalla 2026-11-07 113528" src="https://github.com/user-attachments/assets/491e7dfd-b3d0-4758-9c81-0a1cf5595fa9" />
<img width="1920" height="927" alt="Captura de pantalla 2026-11-07 113515" src="https://github.com/user-attachments/assets/193387e3-6838-4219-967e-21209e3a8a98" />
<img width="1920" height="938" alt="Captura de pantalla 2026-11-07 113502" src="https://github.com/user-attachments/assets/63385493-520e-4ae5-9590-19fec71fe8cb" />
<img width="1920" height="952" alt="Captura de pantalla 2026-11-07 113321" src="https://github.com/user-attachments/assets/9fd5445e-395f-42bd-86e5-3fbc5dc10d16" />
<img width="1904" height="868" alt="Captura de pantalla 2026-11-07 113135" src="https://github.com/user-attachments/assets/f8bb34c2-36e3-4b7a-b94b-27b57bbdbf5a" />

Dashboard Principal
Gestión de Nóminas
Ajustes & Branding
Nota: Para generar estas imágenes, usa herramientas como Prism o simplemente toma screenshots de tu demo live.
🔒 Privacidad y Seguridad
Esta aplicación es 100% Client-Side.
❌ NO envía datos a servidores externos.
❌ NO tiene backend ni base de datos remota.
✅ Todos los registros (jornadas, nóminas, ajustes) se almacenan exclusivamente en el LocalStorage de tu navegador.
⚠️ Advertencia: Si borras la caché del navegador o usas modo incógnito, perderás los datos. Usa siempre la función "Descargar JSON" en Ajustes para hacer backups periódicos.
🤝 Contribuir
Las contribuciones son bienvenidas. Por favor, sigue estos pasos:
Haz Fork del proyecto.
Crea una rama para tu feature (git checkout -b feature/AmazingFeature).
Commit tus cambios (git commit -m 'Add some AmazingFeature').
Push a la rama (git push origin feature/AmazingFeature).
Abre un Pull Request.
📄 Licencia
Distribuido bajo la licencia MIT. Siéntete libre de usarlo, modificarlo y venderlo como servicio para tus clientes.
👨‍💻 Autor
Ivory37goku
GitHub | Portfolio
"El control laboral no debería ser complicado. Debería ser elegante."
