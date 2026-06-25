/**
 * AEGIS ERP — Auto Subscription Expiry Writer & Alert Dispatcher
 * POST /api/expire-subscriptions
 *
 * Called by the client-side useSubscriptionLifecycle hook whenever it runs
 * (only for School Admins on mount / every 5 minutes / on Realtime updates).
 *
 * Enforces the 3-day advance warning schedule and automatic downgrade logic.
 * Inserts in-app notifications for School Admins, logs events permanently,
 * and handles automatic Freemium fallback if the subscription expires.
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl        = process.env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || '';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Date helpers ─────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split('T')[0];
}

function isValidUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

// ─── Alert configurations ──────────────────────────────────────────────────────

const ALERT_CONFIG: Record<string, { title: string; message: string; auditAction: string }> = {
  '3_DAYS': {
    title: '🔔 Subscription expires in 3 days',
    message: 'Your subscription will expire in 3 days. Renew now to avoid losing access to Premium features.',
    auditAction: 'Subscription expires in 3 days'
  },
  '2_DAYS': {
    title: '🔔 Subscription expires in 2 days',
    message: 'Your subscription expires in 2 days. Please renew your plan.',
    auditAction: 'Subscription expires in 2 days'
  },
  '1_DAY': {
    title: '🔔 Subscription expires tomorrow',
    message: 'Your subscription expires tomorrow. Renew now to avoid service interruption.',
    auditAction: 'Subscription expires tomorrow'
  },
  'TODAY': {
    title: '🔔 Subscription expires today',
    message: 'Your subscription expires today. Please renew immediately.',
    auditAction: 'Subscription expires today'
  },
  'EXPIRED': {
    title: '🔔 Subscription expired',
    message: 'Your subscription has expired. Premium features are now locked. Renew your subscription to restore access.',
    auditAction: 'Subscription expired'
  }
};

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Optional shared-secret protection to prevent public abuse
  const expireSecret = process.env.EXPIRE_SECRET;
  if (expireSecret) {
    const providedSecret = req.headers['x-expire-secret'] || req.body?.secret;
    if (providedSecret !== expireSecret) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
  }

  const { schoolId } = req.body;

  if (!schoolId || typeof schoolId !== 'string' || !isValidUUID(schoolId)) {
    return res.status(400).json({ error: 'schoolId (valid UUID) is required' });
  }

  const today = todayStr();
  const now   = new Date().toISOString();

  try {
    // ── 1. Fetch latest subscription row with alert tracking columns ──────────
    const { data: sub, error: subErr } = await supabaseAdmin
      .from('subscriptions')
      .select('id, plan_code, status, subscription_status, expiry_date, grace_end_date, billing_cycle, last_notification_date, notification_sent')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (subErr || !sub) {
      return res.status(200).json({
        expired: false,
        reason:  'no_subscription',
        plan:    'freemium',
      });
    }

    const expiryDate   = sub.expiry_date    as string | null;
    const graceEndDate = sub.grace_end_date as string | null;

    // ── 2. Evaluate days remaining and current alert level ────────────────────
    let daysRemaining = 0;
    if (expiryDate) {
      const todayDate = new Date(today + 'T00:00:00');
      const endDate   = new Date(expiryDate + 'T00:00:00');
      const diffMs    = endDate.getTime() - todayDate.getTime();
      daysRemaining   = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    let computedStatus: 'active' | 'grace_period' | 'expired' | 'trial';
    if (!expiryDate) {
      computedStatus = 'trial';
    } else if (today > (graceEndDate || expiryDate)) {
      computedStatus = 'expired';
    } else if (today > expiryDate) {
      computedStatus = 'grace_period';
    } else {
      computedStatus = 'active';
    }

    // Determine target alert level code
    let currentAlertLevel = 'NONE';
    if (computedStatus === 'expired') {
      currentAlertLevel = 'EXPIRED';
    } else if (computedStatus === 'grace_period') {
      currentAlertLevel = 'GRACE_PERIOD';
    } else if (daysRemaining === 0) {
      currentAlertLevel = 'TODAY';
    } else if (daysRemaining === 1) {
      currentAlertLevel = '1_DAY';
    } else if (daysRemaining === 2) {
      currentAlertLevel = '2_DAYS';
    } else if (daysRemaining === 3) {
      currentAlertLevel = '3_DAYS';
    }

    // ── 3. Check for duplicates: has this alert level already been sent today?
    const alreadyNotified =
      sub.last_notification_date === today &&
      sub.notification_sent === currentAlertLevel;

    // ── 4. Process warnings if not notified yet and is a valid alert level ────
    if (!alreadyNotified && currentAlertLevel !== 'NONE' && currentAlertLevel !== 'GRACE_PERIOD') {
      const cfg = ALERT_CONFIG[currentAlertLevel];
      if (cfg) {
        // Query School Admin(s) user IDs to send the warning to
        const { data: admins } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('school_id', schoolId)
          .eq('role', 'ADMIN');

        if (admins && admins.length > 0) {
          const notificationRows = admins.map((admin: { id: string }) => ({
            school_id: schoolId,
            user_id: admin.id,
            recipient_id: admin.id,
            sender_id: null,
            recipient_role: 'ADMIN',
            title: cfg.title,
            content: cfg.message,
            message: cfg.message,
            type: 'SYSTEM',
            category: 'SYSTEM',
            priority: 'HIGH',
            is_read: false,
            read_status: false,
            created_at: now
          }));

          // Insert into notifications
          const { error: notifErr } = await supabaseAdmin
            .from('notifications')
            .insert(notificationRows);

          if (notifErr) {
            console.error('[expire-subscriptions] failed to insert notification alerts:', notifErr.message);
          }
        }

        // Log notification event in subscription_notifications table
        try {
          await supabaseAdmin.from('subscription_notifications').insert({
            school_id: schoolId,
            notification_type: 'IN_APP',
            reminder_level: currentAlertLevel,
            status: 'SENT',
            payload: { daysRemaining, today, notifiedAt: now }
          });
        } catch (err) {
          console.error('[expire-subscriptions] notification logging failed:', err);
        }

        // Record warning / alert event in subscription_audit_logs
        try {
          await supabaseAdmin.from('subscription_audit_logs').insert({
            school_id:     schoolId,
            action:        cfg.auditAction === 'Subscription expired' ? 'EXPIRED' : 'EXPIRE_WARNING',
            plan:          sub.plan_code || 'unknown',
            billing_cycle: sub.billing_cycle,
            metadata: {
              alert_level:     currentAlertLevel,
              days_remaining:  daysRemaining,
              notified_at:     now,
              message:         cfg.message,
            },
          });
        } catch (err) {
          console.error('[expire-subscriptions] subscription audit write failed:', err);
        }

        // Record in platform audit_logs
        try {
          await supabaseAdmin.from('audit_logs').insert({
            school_id:   schoolId,
            action_type: cfg.auditAction === 'Subscription expired' ? 'SUBSCRIPTION_EXPIRED' : 'SUBSCRIPTION_EXPIRY_WARNING',
            module_name: 'BILLING',
            new_data: {
              alert_level:    currentAlertLevel,
              days_remaining: daysRemaining,
              logged_at:      now,
              message:        cfg.message
            },
          });
        } catch (err) {
          console.error('[expire-subscriptions] platform audit write failed:', err);
        }

        // Update tracking flags on the subscription row to ensure idempotency
        await supabaseAdmin
          .from('subscriptions')
          .update({
            last_notification_date: today,
            notification_sent:      currentAlertLevel,
            updated_at:             now
          })
          .eq('id', sub.id);
      }
    }

    // ── 5. Hard Expiry Downgrade Logic: write to DB if Status has Drifted ──────
    if (computedStatus === 'expired') {
      const alreadyExpiredInDb =
        sub.status === 'EXPIRED' && sub.subscription_status === 'expired';

      if (!alreadyExpiredInDb) {
        // Mark subscription as expired
        const { error: subUpdateErr } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status:              'EXPIRED',
            subscription_status: 'expired',
            last_notification_date: today,
            notification_sent:      'EXPIRED',
            updated_at:          now,
          })
          .eq('id', sub.id);

        if (subUpdateErr) {
          console.error('[expire-subscriptions] subscriptions update failed:', subUpdateErr.message);
          return res.status(500).json({ error: 'Failed to update subscription record to EXPIRED' });
        }

        // Downgrade school plan to FREEMIUM
        await supabaseAdmin
          .from('schools')
          .update({
            subscription_plan: 'FREEMIUM',
            updated_at:        now, // Triggers Supabase Realtime broadcast
          })
          .eq('id', schoolId);

        // Deactivate legacy school_subscriptions
        await supabaseAdmin
          .from('school_subscriptions')
          .update({ status: 'INACTIVE' })
          .eq('school_id', schoolId)
          .eq('status', 'ACTIVE');

        // Audit Log: School moved to Freemium
        try {
          await supabaseAdmin.from('subscription_audit_logs').insert({
            school_id:     schoolId,
            action:        'DOWNGRADED',
            plan:          'freemium',
            billing_cycle: sub.billing_cycle,
            metadata: {
              reason:          'automated_fallback_after_expiry',
              previous_plan:   sub.plan_code,
              downgraded_at:   now
            },
          });
        } catch (err) {
          console.error('[expire-subscriptions] downgrade audit failed:', err);
        }

        try {
          await supabaseAdmin.from('audit_logs').insert({
            school_id:   schoolId,
            action_type: 'SCHOOL_MOVED_TO_FREEMIUM',
            module_name: 'BILLING',
            new_data: {
              previous_plan: sub.plan_code,
              new_plan:      'freemium',
              expired_at:    now
            },
          });
        } catch (err) {
          console.error('[expire-subscriptions] platform downgrade audit failed:', err);
        }

        console.log(`[expire-subscriptions] School ${schoolId} subscription expired. Plan fell back to freemium.`);
      }

      return res.status(200).json({
        expired:       true,
        plan:          'freemium',
        previousPlan:  sub.plan_code || 'unknown',
        expiryDate:    expiryDate,
        alreadyExpiredInDb,
        message:       'Subscription has expired and school downgraded to Freemium.'
      });
    }

    // ── 6. Non-expired Return Response ───────────────────────────────────────
    return res.status(200).json({
      expired:       false,
      status:        computedStatus,
      daysRemaining,
      plan:          (sub.plan_code || 'freemium').toLowerCase(),
      message:       `Subscription is active. Warning Level: ${currentAlertLevel}.`
    });

  } catch (err: any) {
    console.error('[expire-subscriptions] Unhandled error:', err);
    return res.status(500).json({ error: 'Internal server error during subscription expiry processing' });
  }
}
