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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')

    if (!supabaseUrl || !supabaseServiceKey || !supabaseAnonKey) {
      throw new Error('Missing backend environment configuration')
    }
    
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Verify the requesting user is authenticated
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      console.error('Missing or invalid authorization header')
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')

    // Validate JWT and get user using service role client
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    
    if (authError || !user) {
      console.error('JWT validation failed:', authError?.message || 'Invalid token')
      return new Response(
        JSON.stringify({ error: 'Unauthorized: ' + (authError?.message || 'Invalid token') }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestingUserId = user.id
    console.log('Authenticated user:', requestingUserId)

    // Check if user is admin
    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', requestingUserId)
      .in('role', ['admin', 'suporte'])
      .maybeSingle()

    if (roleError || !roleData) {
      console.error('Admin role check failed:', roleError?.message || 'Not an admin')
      return new Response(
        JSON.stringify({ error: 'Forbidden: Only admins can create employees' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get the admin's organization_id
    const { data: adminProfile, error: adminProfileError } = await supabaseAdmin
      .from('profiles')
      .select('organization_id')
      .eq('user_id', requestingUserId)
      .single()

    if (adminProfileError || !adminProfile) {
      console.error('Admin profile fetch failed:', adminProfileError?.message)
      return new Response(
        JSON.stringify({ error: 'Could not determine organization' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const organizationId = adminProfile.organization_id

    const body = await req.json()
    const { email, password, full_name, profileData, role: requestedRole, organization_id: targetOrgId } = body

    if (!email || !password || !full_name) {
      throw new Error('Email, password and full_name are required')
    }

    // Suporte users can specify a target organization
    const finalOrgId = (roleData.role === 'suporte' && targetOrgId) ? targetOrgId : organizationId
    const finalRole = requestedRole === 'admin' ? 'admin' : 'employee'

    console.log('Creating user:', email, 'role:', finalRole, 'for org:', finalOrgId)

    // Create user using admin API (doesn't affect current session)
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name },
    })

    if (createError) {
      console.error('Error creating user:', createError.message)
      throw createError
    }

    const newUserId = authData.user.id
    console.log('User created:', newUserId)

    // Create profile with organization_id
    const { error: profileInsertError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: newUserId,
        email,
        full_name,
        organization_id: finalOrgId,
        ...profileData,
      })

    if (profileInsertError) {
      console.error('Profile insert error:', profileInsertError.message)
    }

    // Create user role with organization_id
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: newUserId,
        role: finalRole,
        organization_id: finalOrgId,
      })

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError.message)
    }

    // Create hours balance with organization_id
    const { error: balanceError } = await supabaseAdmin
      .from('hours_balance')
      .insert({
        user_id: newUserId,
        balance_minutes: 0,
        organization_id: finalOrgId,
      })

    if (balanceError) {
      console.error('Balance insert error:', balanceError.message)
    }

    console.log('Employee creation completed successfully')

    return new Response(
      JSON.stringify({ success: true, user_id: newUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error: unknown) {
    console.error('Error:', error)
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
