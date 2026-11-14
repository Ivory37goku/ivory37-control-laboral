# Sincronización IVORY37

El proyecto Supabase `ivory37-control-laboral` está en la región Central EU (Frankfurt).
La app usa la clave pública publishable guardada en `supabase-config.js`; no se incluye
ninguna clave secreta de administración.

## Base de datos

`setup.sql` crea `public.ivory37_sync`, aplica Row Level Security y permite que cada usuario
autenticado lea o cambie únicamente la fila cuyo `user_id` coincide con `auth.uid()`. El
esquema ya se aplicó al proyecto. Si se prepara otro proyecto, ejecuta el archivo completo
una sola vez en **SQL Editor**.

## Cuentas de la app

Las cuentas creadas desde **Ajustes → Nube** son cuentas de Supabase Auth y son distintas de
la cuenta del Dashboard. Usa la misma cuenta de la app en PWA, APK y EXE. Si el proyecto
exige confirmar correo, confirma el mensaje antes de iniciar sesión. El SMTP predeterminado
de Supabase para proyectos alojados solo envía a miembros de la organización; para admitir
otros correos hay que configurar un proveedor SMTP en Authentication.

## Datos y compilación

Los cambios se guardan primero en el dispositivo. La nube se actualiza cuando hay sesión e
internet; los borrados se representan con marcas para propagarlos entre dispositivos. Mantén
una copia JSON periódica desde Ajustes.

Al actualizar la app, incluye `supabase-config.js`, `supabase-sync.js` y `vendor/supabase.js`
en la PWA, en el paquete de escritorio y en `android-app/app/src/main/assets/`.
