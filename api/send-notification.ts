import { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { getApps, initializeApp, cert, ServiceAccount } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Helper to safely format private key
function getPrivateKey(key: string) {
  if (!key) return '';
  return key.replace(/\\n/g, '\n');
}

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    let credentialCert: ServiceAccount | null = null;
    
    const serviceAccountStr = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountStr) {
      credentialCert = JSON.parse(serviceAccountStr);
    } else {
      const projectId = process.env.FIREBASE_PROJECT_ID;
      const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
      const privateKey = process.env.FIREBASE_PRIVATE_KEY;
      
      if (projectId && clientEmail && privateKey) {
        credentialCert = {
          projectId,
          clientEmail,
          privateKey: getPrivateKey(privateKey)
        };
      }
    }

    if (credentialCert) {
      initializeApp({
        credential: cert(credentialCert)
      });
      console.log('Firebase Admin SDK initialized successfully.');
    } else {
      console.warn('Firebase Admin credentials missing from environment variables.');
    }
  } catch (err: any) {
    console.error('Error initializing Firebase Admin SDK:', err.message);
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { schoolId, targetType, targetValue, title, content, type, senderId, recipientRole, priority } = req.body;

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
      recipient_id: uid,
      sender_id: senderId || null,
      recipient_role: recipientRole || null,
      title,
      content,
      message: content,
      type,
      category: type,
      priority: priority || 'MEDIUM',
      is_read: false,
      read_status: false
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
    let pushResult = { sentCount: 0, failedCount: 0, success: false };

    if (tokensList.length > 0) {
      if (getApps().length > 0) {
        try {
          const messages = tokensList.map(token => ({
            token,
            notification: { title, body: content },
            data: { schoolId, type, title, content }
          }));

          const response = await getMessaging().sendEach(messages);
          pushResult = {
            sentCount: response.successCount,
            failedCount: response.failureCount,
            success: true
          };
          console.log(`Successfully dispatched FCM push: ${response.successCount} sent, ${response.failureCount} failed.`);
        } catch (fcmError: any) {
          console.error('Firebase Admin SDK messaging send error:', fcmError.message);
          throw fcmError;
        }
      } else {
        return res.status(500).json({ error: 'Firebase Admin credentials are not configured on this Vercel deployment.' });
      }
    }

    return res.status(200).json({
      success: true,
      insertedCount: targetUserIds.length,
      fcmBroadcast: pushResult
    });
  } catch (err: any) {
    console.error('Failed to dispatch notifications:', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}
