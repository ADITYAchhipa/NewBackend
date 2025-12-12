# Environment Variables for Secure OTP System

Add these variables to your `.env` file:

```bash
# ============ REQUIRED ============

# Resend Email Service (replaces SendGrid)
# Get your API key from: https://resend.com/api-keys
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx

# Email sender address
FROM_EMAIL=onboarding@resend.dev  # Use your verified domain in production

# JWT Secret (you probably already have this)
JWT_SECRET=your_super_secret_jwt_key

# ============ OPTIONAL ============

# Environment mode
NODE_ENV=development  # Set to 'production' for production

# OTP Configuration
OTP_EXPIRY_MINUTES=5           # How long OTP is valid (default: 5)
OTP_RATE_LIMIT_PER_HOUR=3      # Max OTP requests per hour (default: 3)
MAX_OTP_ATTEMPTS=5             # Max verification attempts (default: 5)

# reCAPTCHA v3 (optional - skipped in development)
# Get keys from: https://www.google.com/recaptcha/admin
RECAPTCHA_SECRET_KEY=your_recaptcha_secret_key
RECAPTCHA_SITE_KEY=your_recaptcha_site_key

# Skip captcha verification (development only!)
SKIP_CAPTCHA=true
```

## Quick Setup

1. **Get Resend API Key:**
   - Sign up at [resend.com](https://resend.com)
   - Go to API Keys → Create new key
   - Copy and paste into `RESEND_API_KEY`

2. **For Development:**
   - Use `FROM_EMAIL=onboarding@resend.dev` (Resend's test domain)
   - Set `SKIP_CAPTCHA=true` to bypass reCAPTCHA

3. **For Production:**
   - Verify your domain in Resend
   - Set `FROM_EMAIL` to your verified domain email
   - Set `NODE_ENV=production`
   - Set up reCAPTCHA and remove `SKIP_CAPTCHA`
