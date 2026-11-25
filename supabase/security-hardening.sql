-- Aplicada el 2026-11-19 mediante Supabase MCP. No modifica filas ni las políticas de las apps.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
