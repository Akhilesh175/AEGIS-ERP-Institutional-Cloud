import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { userId, role, token } = req.body;

  if (!userId || !role || !token) {
    return res.status(400).json({ error: 'Missing userId, role, or token parameter' });
  }

  try {
    const { error } = await supabaseAdmin
      .from('fcm_tokens')
      .upsert({
        user_id: userId,
        role,
        token,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'token'
      });

    if (error) {
      throw error;
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('Failed to register FCM Token:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
