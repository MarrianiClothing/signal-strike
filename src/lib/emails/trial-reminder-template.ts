interface TrialReminderProps {
  amount: string;
  chargeDate: string;
  manageUrl: string;
}

export function trialReminderHtml({
  amount,
  chargeDate,
  manageUrl,
}: TrialReminderProps): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Your Signal Strike trial ends in 2 days</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#e5e5e5;-webkit-text-size-adjust:100%;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0a0a0a;">
  <tr>
    <td align="center" style="padding:40px 20px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;width:100%;background:#141414;border:1px solid #2a2a2a;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #2a2a2a;">
            <div style="font-family:Georgia,'Times New Roman',serif;font-size:22px;letter-spacing:3px;color:#C9A84C;text-transform:uppercase;font-weight:normal;">Signal Strike</div>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h1 style="margin:0 0 24px;font-family:Georgia,'Times New Roman',serif;font-size:28px;font-weight:normal;color:#ffffff;line-height:1.3;">Your trial ends in 2 days</h1>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#cfcfcf;">Hi there,</p>
            <p style="margin:0 0 20px;font-size:16px;line-height:1.6;color:#cfcfcf;">A quick heads-up: your Signal Strike free trial ends on <strong style="color:#ffffff;">${chargeDate}</strong>. Your card on file will be charged <strong style="color:#C9A84C;">${amount}</strong> and your subscription will continue without interruption.</p>
            <p style="margin:0 0 32px;font-size:16px;line-height:1.6;color:#cfcfcf;">Nothing to do — your access stays exactly where it is. If you'd like to change plans, update billing, or cancel before the renewal, you can do it all from your account.</p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
              <tr>
                <td style="background:#C9A84C;border-radius:4px;">
                  <a href="${manageUrl}" style="display:inline-block;padding:14px 32px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:#0a0a0a;text-decoration:none;">Manage Subscription</a>
                </td>
              </tr>
            </table>
            <p style="margin:0;font-size:14px;line-height:1.6;color:#888888;">Questions? Just reply to this email — it goes straight to us.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #2a2a2a;background:#0f0f0f;">
            <p style="margin:0 0 4px;font-size:12px;line-height:1.5;color:#888888;">The Signal Strike team</p>
            <p style="margin:0;font-size:12px;line-height:1.5;color:#666666;">Hilltop Ave LLC · <a href="https://strike.hilltopave.com" style="color:#888888;text-decoration:none;">strike.hilltopave.com</a></p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function trialReminderText({
  amount,
  chargeDate,
  manageUrl,
}: TrialReminderProps): string {
  return `Your Signal Strike trial ends in 2 days

Hi there,

A quick heads-up: your Signal Strike free trial ends on ${chargeDate}. Your card on file will be charged ${amount} and your subscription will continue without interruption.

Nothing to do — your access stays exactly where it is. If you'd like to change plans, update billing, or cancel before the renewal, you can do it all from your account:

${manageUrl}

Questions? Just reply to this email.

— The Signal Strike team
Hilltop Ave LLC
https://strike.hilltopave.com
`;
}
