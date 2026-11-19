<p align="center">
  <img src="brand-icon.svg" alt="Control Laboral" width="104">
</p>

<h1 align="center">Control Laboral</h1>

<p align="center"><strong>Tu jornada, tus horas y tus cobros en un mismo lugar.</strong></p>
<p align="center">Creado por <strong>工V龱尺ㄚ㇌7</strong></p>

<p align="center">
  <a href="https://ivory37goku.github.io/ivory37-control-laboral/"><strong>Abrir la app web</strong></a>
  · <a href="#instalación">Instalación</a>
  · <a href="CHANGELOG.md">Novedades</a>
  · <a href="#créditos-y-autoría">Créditos</a>
</p>

<p align="center">
  <img alt="Versión del código 3.3.13" src="https://img.shields.io/badge/versión-3.3.13-b5eed8?labelColor=152824">
  <img alt="Android APK" src="https://img.shields.io/badge/Android-APK-b5eed8?labelColor=152824">
  <img alt="Windows Setup EXE" src="https://img.shields.io/badge/Windows-Setup_EXE-b5eed8?labelColor=152824">
  <img alt="Web PWA" src="https://img.shields.io/badge/Web-PWA-b5eed8?labelColor=152824">
</p>

Control Laboral permite registrar jornadas, calcular horas extra y comparar su valor con el dinero recibido. Incluye seguimiento de nóminas, viajes, calendario, informes y copias de seguridad. Está disponible para Android, Windows y navegador, con sincronización opcional entre dispositivos.

## Panel Aurora

La interfaz Aurora reúne la jornada de hoy, los accesos de fichaje y el resumen económico sobre tarjetas de vidrio verde menta. La tarjeta principal ofrece la entrada o la salida según el estado de la jornada.

<p align="center">
  <img src="docs/dashboard.jpg" alt="Panel Aurora de Control Laboral en escritorio con jornada, cobros y flujo de caja mensual" width="100%">
</p>

### En el móvil

<p align="center">
  <img src="docs/mobile.jpg" alt="Panel Aurora en móvil con la jornada de hoy y los accesos de fichaje" width="300">
  <img src="docs/mobile-cash.jpg" alt="Flujo de caja en móvil con euros pendientes y horas extra de cada mes" width="300">
</p>

Las horas extra permanecen visibles en los meses liquidados, aunque el importe pendiente sea 0 €. El flujo de caja muestra los últimos ocho meses con actividad.

### Horas extra y pago real

<p align="center">
  <img src="docs/extras-mensuales.jpg" alt="Comparativa mensual de horas extra con importe según tarifa, pago recibido, precio por hora y diferencia" width="100%">
</p>

Cada mes muestra las horas extra confirmadas, su valor según las tarifas históricas, el pago real anotado y la diferencia. El promedio recibido por hora se calcula sobre todas las horas extra confirmadas del mes. Anotar ese importe sirve para comparar y no cambia el estado de cobro de las jornadas.

> Las imágenes muestran esta aplicación con datos ficticios de demostración. La vista de escritorio corresponde al panel que también incluye el EXE de Windows.

## Funciones

| Área | Qué puedes hacer |
| --- | --- |
| Jornada de hoy | Fichar entrada y salida desde el panel y consultar el tiempo registrado. |
| Registro de jornadas | Añadir y editar turnos, incluir pausas no computables, registrar turnos nocturnos y confirmar jornadas provisionales. |
| Horas extra | Consultar horas por mes, tarifas históricas, importe recibido y diferencia con el valor esperado. |
| Nóminas | Consultar propuestas mensuales, editar importes y confirmar cobros. |
| Viajes | Registrar dietas y desplazamientos y marcar su estado de cobro. |
| Calendario | Anotar descansos, vacaciones, bajas, festivos y otras incidencias. |
| Informes | Consultar un período, exportar CSV e imprimir o guardar como PDF. |
| Copias | Exportar y restaurar JSON y recuperar la copia interna disponible. |
| Sincronización | Compartir datos entre instalaciones al iniciar sesión con la misma cuenta. |
| Personalización | Configurar nombre, foto, logotipo, horario y tarifas. |

## Instalación

| Plataforma | Instalación y actualización |
| --- | --- |
| **Android · APK** | Instala la APK correspondiente a la versión. Para conservar los datos, instala la actualización sobre la app existente con la misma firma. La APK incluye la interfaz y abre sin conexión. |
| **Windows · EXE** | Ejecuta el instalador **Control Laboral Setup** y sigue el asistente. Para actualizar, ejecuta el Setup nuevo sobre la instalación existente. La app incluye sus archivos y abre sin conexión. |
| **Web · PWA** | Abre la aplicación web. Usa **Instalar app** en un navegador compatible o **Compartir → Añadir a pantalla de inicio** en iPhone/iPad. Tras la primera carga, dispone de caché para abrir sin conexión. |

Los instaladores se generan desde este repositorio. Consulta las instrucciones para [Android](android-app/README.md) y [Windows](desktop/README.md). La versión del código y la disponible en la web dependen de la publicación de cada entrega.

La PWA ofrece un aviso cuando detecta una versión posterior. En Android y Windows, las nuevas versiones incluidas en el paquete requieren instalar su APK o Setup actualizado.

## Primeros pasos

1. Entra en **Ajustes → Mi perfil** y configura tu nombre y tu imagen.
2. Revisa las tarifas, las horas normales diarias, el horario habitual y la pausa.
3. Registra una jornada desde el panel o utiliza el formulario manual.
4. Revisa las horas extra del mes y anota el pago recibido para compararlo con tu tarifa.
5. Descarga una copia JSON desde **Ajustes → Datos y copias**.
6. Si quieres compartir datos entre dispositivos, inicia sesión con la misma cuenta en cada instalación.

## Datos y sincronización

Los registros se guardan en el dispositivo. La sincronización opcional usa Supabase y requiere conexión para iniciar sesión y enviar o recibir cambios.

Las ediciones incompatibles pueden requerir revisión. Si un registro cambia mientras está abierto su formulario, la aplicación comprueba los campos al guardar y avisa cuando hay un conflicto. Los pagos confirmados o editados a mano se conservan, por lo que conviene revisar los registros históricos si existen varios pagos del mismo mes.

Exporta copias JSON periódicamente. Borrar el almacenamiento del navegador o desinstalar la aplicación puede eliminar sus datos locales.

## Desarrollo

### Ejecutar la web

Desde la raíz del proyecto, inicia un servidor local y abre `http://localhost:8080`.

```bash
python -m http.server 8080
```

### Comprobar el proyecto

Con Node.js y npm instalados, utiliza el archivo de dependencias fijadas.

```bash
npm ci
npm run check
```

Las comprobaciones cubren sintaxis, cálculos de horas, tarifas, copias, exportación, sincronización simulada y regresiones de guardado y nóminas. El alcance de la revisión se documenta en la [guía de calidad](docs/QUALITY-CHECKLIST.md).

### Generar el EXE de Windows

```powershell
npm run dist:win:setup
```

El instalador queda en `desktop-dist/`. Para abrir la app durante el desarrollo, ejecuta `npm start`.

### Generar la APK de Android

El proyecto utiliza JDK 17 y Android SDK Platform 36. Desde la raíz, en Windows, ejecuta lo siguiente.

```powershell
cd android-app
.\gradlew.bat assembleDebug
```

La APK de depuración queda en `android-app/app/build/outputs/apk/debug/app-debug.apk`. Conserva la clave de firma al preparar actualizaciones. Más detalles en la [guía Android](android-app/README.md).

## Estructura

```text
index.html          Interfaz y estilos
app.js              Jornadas, panel, pagos y ajustes
work-hours.js       Duración de turnos y pausas
overtime-tools.js   Resumen de horas extra
rates.js            Tarifas históricas
calendar.js         Calendario e incidencias
reports.js          Exportación de informes
backup-tools.js     Validación y preparación de copias
theme-tools.js      Personalización de color
supabase-sync.js    Sincronización entre dispositivos
pwa.js / sw.js      Instalación y caché de la PWA
android-app/        Aplicación Android
desktop/            Aplicación Windows
supabase/           Esquema y configuración de la nube
tests/              Pruebas de regresión
docs/               Capturas y documentación
```

## Créditos y autoría

**Creador de Control Laboral — 工V龱尺ㄚ㇌7**

Proyecto publicado desde la cuenta [Ivory37goku](https://github.com/Ivory37goku). La identidad del creador se conserva en esta documentación y en los créditos del proyecto.

Control Laboral utiliza HTML, CSS y JavaScript, Android WebView, Electron y Supabase. Los componentes de terceros mantienen sus propias licencias.

## Licencia

Distribuido bajo [licencia MIT](LICENSE). El archivo de licencia conserva la atribución de copyright de Ivory37goku.

<p align="center"><strong>Control Laboral · Creado por 工V龱尺ㄚ㇌7</strong></p>
