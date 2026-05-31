// JaaS JWT Token Generator
// Generates signed JWT tokens for 8x8.vc (Jitsi as a Service) video calls
// Deploy: npx supabase functions deploy jaas-token --no-verify-jwt
// Env vars needed: JAAS_PRIVATE_KEY

import { getCorsHeaders } from '../_shared/cors.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SignJWT, importPKCS8, importRSAPrivateKey } from 'https://deno.land/x/jose@v5.2.2/index.ts';

const JAAS_APP_ID = Deno.env.get('JAAS_APP_ID') || 'vpaas-magic-cookie-cd11b47983b2480881514268912c6028';
const JAAS_KID = Deno.env.get('JAAS_KID') || 'vpaas-magic-cookie-cd11b47983b2480881514268912c6028/bd8234';

Deno.serve(async (req) => {
  // Per-request CORS headers — restricts to allowed origins
  const corsHeaders = getCorsHeaders(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify user has a Pro/Org plan (or is platform admin)
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('plan')
      .eq('id', user.id)
      .single();

    const userPlan = profileRow?.plan || 'free';
    const hasPro = userPlan === 'pro' || userPlan === 'org';

    // Check platform_admins table as fallback
    let isPlatformAdmin = false;
    if (!hasPro) {
      const { data: adminRow } = await supabase
        .from('platform_admins')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();
      isPlatformAdmin = !!adminRow;
    }

    if (!hasPro && !isPlatformAdmin) {
      return new Response(JSON.stringify({ error: 'Pro plan required for JaaS video calls' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

     // Parse request body
     const { roomName, userName, userAvatar, isModerator: requestedIsModerator } = await req.json();

     if (!roomName || !userName) {
       return new Response(JSON.stringify({ error: 'roomName and userName required' }), {
         status: 400,
         headers: { ...corsHeaders, 'Content-Type': 'application/json' },
       });
     }

     // Moderator status: honor client request if user is allowed to be moderator
     const isModerator = (requestedIsModerator === true) && (hasPro || isPlatformAdmin);

     // Import private key
     const privateKeyPem = Deno.env.get('JAAS_PRIVATE_KEY')!;
     let privateKey;
     try {
       // Try RSA private key (PKCS#1) first
       privateKey = await importRSAPrivateKey(privateKeyPem, 'RS256');
     } catch {
       // Fallback to PKCS#8 format
       privateKey = await importPKCS8(privateKeyPem, 'RS256');
     }

    const now = Math.floor(Date.now() / 1000);

    // Build JWT payload per JaaS specification
    const jwt = await new SignJWT({
      iss: 'chat',
      aud: 'jitsi',
      sub: JAAS_APP_ID,
      room: roomName, // just the room part, without appId prefix
      exp: now + 3 * 3600, // 3 hours
      nbf: now - 10,
      context: {
        user: {
          id: user.id,
          name: userName,
          avatar: userAvatar || '',
          email: user.email || '',
          moderator: isModerator ? 'true' : 'false',
        },
        features: {
          livestreaming: 'false',
          'outbound-call': 'false',
          'sip-outbound-call': 'false',
          transcription: 'false',
          recording: 'false',
        },
      },
    })
      .setProtectedHeader({ alg: 'RS256', kid: JAAS_KID, typ: 'JWT' })
      .sign(privateKey);

    return new Response(JSON.stringify({ token: jwt }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('JaaS token error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate token' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
