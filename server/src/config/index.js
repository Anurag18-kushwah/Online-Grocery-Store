import 'dotenv/config';
import crypto from 'node:crypto';

const mode = process.env.STORE_MODE || (process.env.MONGODB_URI ? 'mongo' : '');
export const config = {
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || '',
  mongoUri: process.env.MONGODB_URI || '',
  storeMode: mode, // 'mongo' | 'local'
  jwtSecret: process.env.JWT_SECRET || '',
  razorpay: { keyId: process.env.RAZORPAY_KEY_ID || '', keySecret: process.env.RAZORPAY_KEY_SECRET || '', webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || '' },
  notifications: {
    adminEmail: process.env.ADMIN_NOTIFICATION_EMAIL || '',
    emailFrom: process.env.EMAIL_FROM || '',
    resendApiKey: process.env.RESEND_API_KEY || '',
    adminWhatsApp: process.env.ADMIN_WHATSAPP_TO || '',
    twilioAccountSid: process.env.TWILIO_ACCOUNT_SID || '',
    twilioAuthToken: process.env.TWILIO_AUTH_TOKEN || '',
    twilioWhatsAppFrom: process.env.TWILIO_WHATSAPP_FROM || '',
  },
  llm: {
    provider: process.env.LLM_PROVIDER || 'none', // none | bedrock | openai-compatible
    model: process.env.LLM_MODEL || process.env.BEDROCK_MODEL_ID || '',
    region: process.env.AWS_REGION || '',
    baseUrl: process.env.LLM_BASE_URL || '',
    apiKey: process.env.LLM_API_KEY || '',
    timeoutMs: Number(process.env.LLM_TIMEOUT_MS) || 12000,
  },
};

export function assertConfig() {
  if (!['mongo', 'local'].includes(config.storeMode)) throw new Error('No database configured. Set MONGODB_URI (MongoDB/Atlas) or STORE_MODE=local for the file-backed dev store. See README.');
  if (config.storeMode === 'mongo' && !config.mongoUri) throw new Error('STORE_MODE=mongo requires MONGODB_URI.');
  if (!config.jwtSecret) {
    if (process.env.NODE_ENV === 'production') throw new Error('JWT_SECRET is required in production.');
    config.jwtSecret = crypto.randomBytes(32).toString('hex'); // dev only: sessions reset on restart
    console.warn('[config] JWT_SECRET not set: using a random one (logins reset on restart).');
  }
}
