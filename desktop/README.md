# 工V龱尺ㄚ㇌7 para Windows

Esta carpeta contiene el lanzador de escritorio. Abre el `index.html` local dentro de una ventana de Windows; no cambia la app web ni requiere Chrome para ejecutarse.

## Compilar los EXE

Desde la carpeta raíz del proyecto, en Windows:

```powershell
npm install
npm run dist:win
```

Los resultados aparecen en `desktop-dist/`:

- El instalador **Setup** instala la app en Windows y crea accesos directos.
- El EXE **Portable** se ejecuta sin instalar.

La primera compilación descarga Electron y el instalador NSIS. La interfaz se abre desde archivos locales y conserva el funcionamiento sin conexión. Al iniciar sesión en **Ajustes → Nube**, usa internet para sincronizar de forma privada los datos con la PWA y el APK.

## Ejecutar durante el desarrollo

```powershell
npm install
npm start
```

## Datos

Windows guarda una copia local en `%APPDATA%\IVORY37 Control Laboral`. Si inicias sesión con la misma cuenta IVORY37 en cada dispositivo, la app combina y sincroniza jornadas, viajes, pagos y ajustes. Sin iniciar sesión, cada instalación mantiene sus propios datos. Conserva también copias con **Ajustes → Backup JSON**.
