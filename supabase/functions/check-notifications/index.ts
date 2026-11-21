import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    // 1. Fetch preferences
    const { data: prefs } = await supabaseClient
      .from('notification_prefs')
      .select('*')

    if (!prefs) return new Response(JSON.stringify({ ok: true, msg: 'No prefs' }), { headers: { 'Content-Type': 'application/json' } })

    const notificationsToInsert: any[] = []

    // Helper to add notification
    const addNotif = (userId: string, wsId: string, tipo: string, titulo: string, corpo: string) => {
      notificationsToInsert.push({
        user_id: userId,
        workspace_id: wsId,
        tipo,
        titulo,
        corpo,
        lida: false
      })
    }

    // Iterate over users with preferences
    for (const p of prefs) {
      const { user_id } = p
      
      // We would ideally fetch the active workspace or iterate all their workspaces
      const { data: memberships } = await supabaseClient
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user_id)
        
      if (!memberships || memberships.length === 0) continue
      const wsId = memberships[0].workspace_id

      // 2. Check budgets if orcamento_80 is enabled
      if (p.orcamento_80) {
        // Here we could sum transactions and compare with budgets
        // For brevity in this Edge Function template, we leave the actual calculation
        // logic. In a real scenario, you'd execute an RPC or query transactions.
      }

      // 3. Check upcoming invoices / bills
      if (p.venc_faturas) {
        // Query invoices closing in the next 3 days
        const { data: invoices } = await supabaseClient
          .from('invoices')
          .select('id, data_vencimento')
          .eq('workspace_id', wsId)
          .eq('paga', false)
          
        // ... filter dates and notify ...
      }
    }

    // Insert notifications in bulk
    if (notificationsToInsert.length > 0) {
      await supabaseClient.from('notifications').insert(notificationsToInsert)
      // Send Emails (e.g. via Resend or Supabase Auth hooks if applicable)
    }

    return new Response(JSON.stringify({ success: true, count: notificationsToInsert.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
