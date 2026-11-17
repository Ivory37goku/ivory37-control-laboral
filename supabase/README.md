# Sincronización compartida IVORY37

El proyecto Supabase `ivory37-control-laboral` está en la región Central EU (Frankfurt).
La app usa la clave pública publishable guardada en `supabase-config.js`; no se incluye
ninguna clave secreta de administración.

## Base de datos de las dos aplicaciones

`setup.sql` prepara las dos tablas del proyecto:

- `public.ivory37_sync`: jornadas, viajes, pagos y ajustes de Control Laboral.
- `public.gestion_clientes`: leads, clientes, obras, tareas y finanzas de Gestión Clientes.

Las tablas tienen políticas Row Level Security independientes y cada cuenta autenticada solo
puede leer o actualizar su propia fila. El esquema inicial de Control Laboral ya estaba
aplicado, pero la tabla de Gestión Clientes faltaba en el proyecto. Ejecuta ahora el archivo
completo una vez en **SQL Editor**; se puede volver a ejecutar sin borrar los datos existentes.
El script también revoca el acceso RPC público a `public.rls_auto_enable()` si existe; el
disparador de base de datos puede seguir utilizándola al crear tablas.

## Cuentas de la app

Las cuentas creadas desde **Ajustes → Nube** son cuentas de Supabase Auth y son distintas de
la cuenta del Dashboard. Usa la misma cuenta en Control Laboral y Gestión Clientes, en PWA,
APK y EXE. La autenticación se comparte; las tablas mantienen los datos separados. Si el
proyecto exige confirmar correo, confirma el mensaje antes de iniciar sesión. El SMTP predeterminado
de Supabase para proyectos alojados solo envía a miembros de la organización; para admitir
otros correos hay que configurar un proveedor SMTP en Authentication.

## Datos y compilación

Los cambios se guardan primero en el dispositivo. La nube se actualiza cuando hay sesión e
internet; los borrados se representan con marcas para propagarlos entre dispositivos. Mantén
una copia JSON periódica desde Ajustes.

Al actualizar la app, incluye `supabase-config.js`, `supabase-sync.js` y `vendor/supabase.js`
en la PWA, en el paquete de escritorio y en `android-app/app/src/main/assets/`.
