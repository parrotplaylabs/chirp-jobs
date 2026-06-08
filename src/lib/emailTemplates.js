function emailShell({ title, bodyHtml, year }) {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
      body { font-family: system-ui, sans-serif; background: #f8f9fa; margin: 0; padding: 24px; }
      .wrapper { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
      .header { background: #0b5ed7; color: #fff; padding: 20px 24px; }
      .body { padding: 24px; color: #212529; }
      .pin { font-size: 28px; font-weight: 700; letter-spacing: 4px; margin: 16px 0; }
      .btn { display: inline-block; background: #0b5ed7; color: #fff !important; text-decoration: none; padding: 10px 18px; border-radius: 8px; }
      .footer { padding: 16px 24px; font-size: 13px; color: #6c757d; background: #f8f9fa; }
    </style>
  </head>
  <body>
    <div class="wrapper">
      <div class="header"><h1 style="margin:0;font-size:20px;">Chirp Jobs</h1></div>
      <div class="body">${bodyHtml}</div>
      <div class="footer">
        &copy; ${year} Chirp Jobs
        <span style="margin: 0 6px;">|</span>
        Hatched by <a href="https://www.parrotplaylabs.com/" target="_blank" rel="noopener noreferrer" style="color:#6c757d;">Parrot Playlabs</a> 🦜
        <a href="https://github.com/parrotplaylabs" target="_blank" rel="noopener noreferrer" style="margin-left:4px;color:#6c757d;">@parrotplaylabs</a>
      </div>
    </div>
  </body>
</html>`;
}

export function jobActivationPinEmail({ pin, verifyUrl, year }) {
  const bodyHtml = `
    <h2 style="margin-top:0;">Verify your new job post</h2>
    <p>Use this PIN to activate your job immediately:</p>
    <div class="pin">${pin}</div>
    <p><a href="${verifyUrl}" class="btn">Activate job now</a></p>
    <p style="font-size:13px;color:#6c757d;">If the button does not work, copy this URL: ${verifyUrl}</p>
    <p>This PIN expires in 15 minutes.</p>`;
  return emailShell({ title: 'Your Chirp Jobs activation PIN', bodyHtml, year });
}

export function applicationActivationPinEmail({ job, pin, verifyUrl, year }) {
  const bodyHtml = `
    <h2 style="margin-top:0;">Verify your application</h2>
    <p>You applied for <strong>${job.title}</strong> at ${job.company_name}.</p>
    <p>Use this PIN to confirm your application:</p>
    <div class="pin">${pin}</div>
    <p><a href="${verifyUrl}" class="btn">Verify application</a></p>
    <p style="font-size:13px;color:#6c757d;">If the button does not work, copy this URL: ${verifyUrl}</p>
    <p>This PIN expires in 15 minutes.</p>`;
  return emailShell({ title: 'Verify your application PIN', bodyHtml, year });
}
