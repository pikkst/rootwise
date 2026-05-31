// JaaS Webhook — logs video call lifecycle events
// Endpoint: https://dgysayvohbmtysjemgyo.supabase.co/functions/v1/jaas-webhook
// Deploy: supabase functions deploy jaas-webhook --no-verify-jwt
// Config: JaaS Dashboard → Webhooks → set URL above + bot token as Bearer header

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('JAAS_WEBHOOK_SECRET') || '';

Deno.serve(async (req) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, content-type, x-jaas-signature, x-8x8-signature',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const body = await req.text();
    const contentType = req.headers.get('content-type') || '';
    let eventPayload: any;

    try {
      eventPayload = contentType.includes('application/json') ? JSON.parse(body) : JSON.parse(body);
    } catch {
      eventPayload = { raw: body };
    }

    // Optional secret validation — JaaS can send bot token in Authorization header
    const authHeader = req.headers.get('authorization') || '';
    const signatureHeader = req.headers.get('x-jaas-signature') || req.headers.get('x-8x8-signature') || '';
    
    if (WEBHOOK_SECRET && authHeader !== `Bearer ${WEBHOOK_SECRET}` && !signatureHeader) {
      return new Response('Unauthorized', { status: 401, headers: corsHeaders });
    }

    const eventType = eventPayload?.event?.type || eventPayload?.type || 'unknown';
    const roomName = eventPayload?.event?.room?.name || eventPayload?.room_name || null;
    const userId = eventPayload?.event?.participant?.userId || eventPayload?.user_id || null;
    const participantId = eventPayload?.event?.participant?.id || eventPayload?.participant_id || null;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { error } = await supabase.from('jaas_events').insert({
      event_type: eventType,
      room_name: roomName,
      user_id: userId,
      participant_id: participantId,
      payload: eventPayload,
    });

    if (error) {
      console.error('Failed to insert jaas_event:', error);
      return new Response(JSON.stringify({ error: 'db_error', detail: error.message }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ ok: true, eventType }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('JaaS webhook error:', err);
    return new Response(JSON.stringify({ error: err.message || 'webhook_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
