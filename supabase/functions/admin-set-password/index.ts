// Edge Function: admin-set-password
//
// Le pone una contraseña nueva a la cuenta de otra persona. Es lo que hace
// falta el día que alguien del taller pierde la suya: sin esto, la pantalla
// de acceso le dice "habla con el administrador" y el administrador no tiene
// forma de ayudarle desde la app.
//
// Solo la puede llamar alguien que ya está logueado como admin: se comprueba
// con su propio token ANTES de tocar la service role key, que solo existe
// aquí dentro (Supabase la inyecta sola; nunca viaja al navegador).
//
// A propósito NO pide la contraseña antigua: el sentido de esto es
// justamente que nadie la recuerda. Quien manda es el rol de quien llama.
//
// Desplegar: supabase functions deploy admin-set-password
// (o solo, en cada push, con .github/workflows/deploy-functions.yml)

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

    // Cliente con el token de quien llama, solo para saber quién es.
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
      return json({ error: 'Solo un administrador puede cambiar contraseñas' }, 403)
    }

    const body = await req.json().catch(() => null)
    const userId = typeof body?.user_id === 'string' ? body.user_id.trim() : ''
    const password = typeof body?.password === 'string' ? body.password : ''

    if (!userId) return json({ error: 'Falta saber a quién' }, 400)
    if (password.length < 8) {
      return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400)
    }

    // Esta es la única parte que necesita permisos de administrador.
    const adminClient = createClient(supabaseUrl, serviceRoleKey)

    // Que exista de verdad: si no, updateUserById devuelve un error críptico.
    const { data: destino, error: buscaError } = await adminClient
      .from('profiles')
      .select('id, email')
      .eq('id', userId)
      .single()

    if (buscaError || !destino) {
      return json({ error: 'Esa persona ya no está en el equipo' }, 404)
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      password,
    })

    if (updateError) {
      return json({ error: updateError.message }, 400)
    }

    // La que acaba de poner el administrador la han visto dos personas, así
    // que vuelve a marcarse como "prestada": la app le obligará a estrenar
    // una suya en cuanto entre.
    const { error: marcaError } = await adminClient
      .from('profiles')
      .update({ must_change_password: true })
      .eq('id', userId)

    if (marcaError) {
      return json({ error: marcaError.message }, 500)
    }

    return json({ ok: true, email: destino.email })
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : 'Error inesperado' }, 500)
  }
})
