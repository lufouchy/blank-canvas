import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // 1. Create organization
    const { data: org, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({ name: 'Gestão do Sistema', org_code: '55555' })
      .select('id')
      .single()

    if (orgError) {
      return new Response(JSON.stringify({ error: 'Org: ' + orgError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 2. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: 'lufouchy@hotmail.com',
      password: 'Jubaluba26',
      email_confirm: true,
    })

    if (authError) {
      return new Response(JSON.stringify({ error: 'Auth: ' + authError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    const userId = authData.user.id

    // 3. Create profile
    const { error: profileError } = await supabaseAdmin.from('profiles').insert({
      user_id: userId,
      full_name: 'Gestor do Sistema',
      email: 'lufouchy@hotmail.com',
      organization_id: org.id,
    })

    if (profileError) {
      return new Response(JSON.stringify({ error: 'Profile: ' + profileError.message }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      })
    }

    // 4. Create suporte role
    await supabaseAdmin.from('user_roles').insert({
      user_id: userId,
      role: 'suporte',
      organization_id: org.id,
    })

    // 5. Create hours balance
    await supabaseAdmin.from('hours_balance').insert({
      user_id: userId,
      balance_minutes: 0,
      organization_id: org.id,
    })

    return new Response(JSON.stringify({ success: true, userId, orgId: org.id }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    })
  }
})
