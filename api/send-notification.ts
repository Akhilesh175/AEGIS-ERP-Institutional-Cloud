import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Exchange Google Service Account keys for a Firebase Messaging OAuth Access Token
function getGoogleAccessToken(serviceAccount: any): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const jwtHeader = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
      const now = Math.floor(Date.now() / 1000);
      const jwtClaim = Buffer.from(JSON.stringify({
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/firebase.messaging',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
      })).toString('base64url');

      const sign = crypto.createSign('RSA-SHA256');
      sign.update(`${jwtHeader}.${jwtClaim}`);
      const signature = sign.sign(serviceAccount.private_key, 'base64url');
      const jwt = `${jwtHeader}.${jwtClaim}.${signature}`;

      fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion: jwt
        })
      })
      .then(res => res.json())
      .then(data => {
        if (data.access_token) {
          resolve(data.access_token);
        } else {
          reject(new Error(data.error_description || 'OAuth token exchange failed'));
        }
      })
      .catch(reject);
    } catch (err) {
      reject(err);
    }
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { schoolId, targetType, targetValue, title, content, type } = req.body;

  if (!schoolId || !targetType || !title || !content || !type) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }

  try {
    let targetUserIds: string[] = [];

    // 1. Resolve User IDs based on target selection
    if (targetType === 'individual') {
      if (!targetValue) {
        return res.status(400).json({ error: 'Missing individual userId targetValue' });
      }
      targetUserIds = [targetValue];
    } else if (targetType === 'role') {
      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('role', targetValue)
        .eq('is_active', true);

      if (usersErr) throw usersErr;
      targetUserIds = users?.map(u => u.id) || [];
    } else if (targetType === 'school') {
      const { data: users, error: usersErr } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('school_id', schoolId)
        .eq('is_active', true);

      if (usersErr) throw usersErr;
      targetUserIds = users?.map(u => u.id) || [];
    }

    if (targetUserIds.length === 0) {
      return res.status(200).json({ success: true, message: 'No active target users matched the request criteria.' });
    }

    // 2. Insert rows into public.notifications
    const rowsToInsert = targetUserIds.map(uid => ({
      school_id: schoolId,
      user_id: uid,
      title,
      content,
      type,
      is_read: false
    }));

    const { error: insertErr } = await supabaseAdmin
      .from('notifications')
      .insert(rowsToInsert);

    if (insertErr) throw insertErr;

    // 3. Fetch FCM Registration tokens for target users
    const { data: tokensData, error: tokensErr } = await supabaseAdmin
      .from('fcm_tokens')
      .select('token')
      .in('user_id', targetUserIds);

    if (tokensErr) throw tokensErr;

    const tokensList = tokensData?.map(t => t.token) || [];

    // 4. Send FCM Push Messages if tokens exist
    let pushResult = { sentCount: 0, mockMode: true };

    if (tokensList.length > 0) {
      const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
      
      if (serviceAccountStr) {
        try {
          const serviceAccount = JSON.parse(serviceAccountStr);
          const accessToken = await getGoogleAccessToken(serviceAccount);
          const fcmUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
          
          let successCount = 0;

          // Dispatch to each token
          for (const token of tokensList) {
            const fcmRes = await fetch(fcmUrl, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                message: {
                  token,
                  notification: { title, body: content },
                  data: { schoolId, type, title, content }
                }
              })
            });

            if (fcmRes.ok) {
              successCount++;
            } else {
              const errBody = await fcmRes.json().catch(() => ({}));
              console.warn(`Failed to dispatch FCM push to token. Response:`, errBody);
            }
          }

          pushResult = { sentCount: successCount, mockMode: false };
        } catch (fcmError: any) {
          console.error('Firebase serverless OAuth/FCM dispatch error:', fcmError.message);
          // Fall back gracefully to mock log
          pushResult = { sentCount: tokensList.length, mockMode: true };
        }
      } else {
        // Fall back gracefully to mock log
        pushResult = { sentCount: tokensList.length, mockMode: true };
        console.log(`[FCM Mock Broadcast] Sent: "${title}" to tokens:`, tokensList);
      }
    }

    return res.status(200).json({
      success: true,
      insertedCount: targetUserIds.length,
      fcmBroadcase: pushResult
    });
  } catch (err: any) {
    console.error('Failed to dispatch notifications:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
