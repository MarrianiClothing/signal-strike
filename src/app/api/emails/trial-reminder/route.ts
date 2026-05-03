import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import {
  trialReminderHtml,
  trialReminderText,
} from '@/lib/emails/trial-reminder-template';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Daily cron: sends a reminder email to users whose Stripe trial ends
 * in ~48 hours (window: 47–49h from now).
 *
 * Auth: Vercel cron sends `Authorization: Bearer <CRON_SECRET>`.
 * Idempotency: profiles.trial_reminder_sent_at is set after a successful send.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
    apiVersion: '2024-11-20.acacia',
  });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const resend = new Resend(process.env.RESEND_API_KEY!);

  const now = Math.floor(Date.now() / 1000);
  const windowStart = now + 47 * 3600;
  const windowEnd = now + 49 * 3600;

  const results = {
    checked: 0,
    sent: 0,
    skipped_outside_window: 0,
    skipped_already_sent: 0,
    skipped_no_trial_end: 0,
    errors: [] as string[],
  };

  try {
    let hasMore = true;
    let startingAfter: string | undefined;

    while (hasMore) {
      const subs: Stripe.ApiList<Stripe.Subscription> =
        await stripe.subscriptions.list({
          status: 'trialing',
          limit: 100,
          starting_after: startingAfter,
        });

      for (const sub of subs.data) {
        results.checked++;

        if (!sub.trial_end) {
          results.skipped_no_trial_end++;
          continue;
        }
        if (sub.trial_end < windowStart || sub.trial_end > windowEnd) {
          results.skipped_outside_window++;
          continue;
        }

        const customerId =
          typeof sub.customer === 'string' ? sub.customer : sub.customer.id;

        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, trial_reminder_sent_at')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        if (profileErr) {
          results.errors.push(`profile lookup ${customerId}: ${profileErr.message}`);
          continue;
        }
        if (!profile) {
          results.errors.push(`no profile for customer ${customerId}`);
          continue;
        }
        if (profile.trial_reminder_sent_at) {
          results.skipped_already_sent++;
          continue;
        }

        const { data: userData, error: userErr } =
          await supabase.auth.admin.getUserById(profile.id);
        if (userErr || !userData?.user?.email) {
          results.errors.push(
            `no auth email for profile ${profile.id}: ${userErr?.message ?? 'missing'}`
          );
          continue;
        }
        const email = userData.user.email;

        const item = sub.items.data[0];
        const unitAmount = item?.price?.unit_amount ?? 0;
        const currency = (item?.price?.currency ?? 'usd').toUpperCase();
        const formattedAmount = `$${(unitAmount / 100).toFixed(2)} ${currency}`;
        const chargeDate = new Date(sub.trial_end * 1000).toLocaleDateString(
          'en-US',
          { weekday: 'long', month: 'long', day: 'numeric' }
        );

        const manageUrl = 'https://strike.hilltopave.com/account';

        try {
          await resend.emails.send({
            from: 'Signal Strike <hello@hilltopave.com>',
            to: email,
            subject: 'Your Signal Strike trial ends in 2 days',
            html: trialReminderHtml({ amount: formattedAmount, chargeDate, manageUrl }),
            text: trialReminderText({ amount: formattedAmount, chargeDate, manageUrl }),
          });

          const { error: updateErr } = await supabase
            .from('profiles')
            .update({ trial_reminder_sent_at: new Date().toISOString() })
            .eq('id', profile.id);

          if (updateErr) {
            results.errors.push(
              `mark-sent failed for ${email} (email DID send): ${updateErr.message}`
            );
          }

          results.sent++;
        } catch (sendErr) {
          results.errors.push(
            `send failed for ${email}: ${sendErr instanceof Error ? sendErr.message : String(sendErr)}`
          );
        }
      }

      hasMore = subs.has_more;
      if (hasMore && subs.data.length > 0) {
        startingAfter = subs.data[subs.data.length - 1].id;
      } else {
        hasMore = false;
      }
    }

    return NextResponse.json(results);
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : String(err),
        results,
      },
      { status: 500 }
    );
  }
}
