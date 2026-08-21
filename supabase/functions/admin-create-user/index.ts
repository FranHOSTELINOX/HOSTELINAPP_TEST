// Edge Function: admin-create-user
//
// Crea una cuenta nueva (email + contraseña), la confirma y rellena su
// perfil (nombre, puesto, rol admin/user). Solo la puede llamar alguien
// que ya está logueado como admin: se comprueba con su propio token antes de usar la
// service role key, que solo existe aquí (Supabase la inyecta sola en cada
// función; nunca viaja al navegador).
//
// Desplegar: supabase functions deploy admin-create-user
// (o via .github/workflows/deploy-functions.yml en cada push)

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return json({ error: 'No autorizado' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    // Cliente con el token de quien llama, solo para comprobar quién es.
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })

    const { data: userData, error: userError } = await callerClient.auth.getUser()
    if (userError || !userData.user) {
      return json({ error: 'No autorizado' }, 401)
    }

    const { data: callerProfile, error: profileError } = await callerClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single()

    if (profileError || callerProfile?.role !== 'admin') {
      return json({ error: 'Solo un administrador puede crear usuarios' }, 403)
    }

    const body = await req.json().catch(() => null)
    const email = typeof body?.email === 'string' ? body.email.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''
    const fullName = typeof body?.full_name === 'string' ? body.full_name.trim() : ''
    const puesto = typeof body?.puesto === 'string' ? body.puesto.trim() : ''
    const role = body?.role === 'admin' ? 'admin' : 'user'

    if (!email || !password) {
      return json({ error: 'Email y contraseña son obligatorios' }, 400)
    }
    if (password.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    }

    // Esta es la única pieza que necesita permisos de administrador.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })

    if (createError || !created.user) {
      return json({ error: createError?.message ?? 'No se pudo crear el usuario' }, 400)
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({
        full_name: fullName || null,
        puesto: puesto || null,
        role,
      })
      .eq('id', created.user.id)

    if (updateError) {
      return json({ error: updateError.message }, 500)
    }

    return json({ ok: true, id: created.user.id })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, 500)
  }
})
