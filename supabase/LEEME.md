# Preparar la base de sincronización

La app guarda hoy los datos en cada dispositivo por separado. Esta configuración
crea una tabla privada en Supabase: cada cuenta solo puede leer y modificar su
propia copia mediante políticas RLS.

## Crear el proyecto

1. Entra en [Supabase](https://supabase.com/) e inicia sesión o crea tu cuenta.
2. Crea un proyecto, por ejemplo `ivory37-control-laboral`; selecciona una región
   de la Unión Europea y guarda la contraseña de base de datos en un lugar seguro.
3. Cuando el proyecto esté listo, abre **SQL Editor → New query**.
4. Copia y ejecuta todo el contenido de [`setup.sql`](setup.sql).
5. En **Project Settings → API**, copia la **Project URL** y la clave pública
   **Publishable** (o la clave heredada `anon`).

Para terminar la conexión, comparte aquí únicamente la URL y esa clave pública.
No compartas la contraseña de la base de datos, una clave `service_role` ni una
clave `secret`. La clave pública por sí sola no permite leer los datos: las
políticas de la tabla exigen una cuenta autenticada y limitan cada fila a su
propietario.

Después de recibir la configuración se puede conectar el mismo servicio a la PWA,
la APK y el EXE. Cada dispositivo tendrá que iniciar sesión con la misma cuenta.
La primera sincronización debe conservar la copia local y combinarla con la nube
para no perder jornadas, viajes, pagos ni ajustes existentes.
