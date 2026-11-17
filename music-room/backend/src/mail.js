import nodemailer from 'nodemailer';
import { config } from './config.js';

// Without SMTP configuration, mails are kept in an outbox and printed (dev / tests).
export const outbox = [];
let transport = null;
if (config.smtp.host) {
  transport = nodemailer.createTransport({
    host: config.smtp.host, port: config.smtp.port, secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

export async function sendMail(to, subject, text) {
  if (!transport) {
    outbox.push({ to, subject, text });
    if (outbox.length > 200) outbox.shift();
    if (process.env.NODE_ENV !== 'test') console.log(`[mail:dev] to=${to} subject="${subject}"\n${text}\n`);
    return;
  }
  await transport.sendMail({ from: config.mailFrom, to, subject, text });
}
