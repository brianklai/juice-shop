# Environment Variables for OWASP Juice Shop

This document lists all environment variables that can be used to configure the OWASP Juice Shop application.

## Security-related Environment Variables

| Variable Name | Description | Default Value |
|--------------|-------------|---------------|
| `JUICE_SHOP_PRIVATE_KEY` | Private key used for JWT signing | See config/default.yml |
| `JUICE_SHOP_HMAC_SECRET` | Secret used for HMAC generation | See config/default.yml |

## Frontend Environment Variables

These are build-time variables used in the Angular frontend:

| Variable Name | Description | Default Value |
|--------------|-------------|---------------|
| `clientId` | Google OAuth client ID | See environment.ts |
| `testingUsername` | Username for testing | See environment.ts |
| `testingPassword` | Password for testing | See environment.ts |

## How to Use

For local development, you can set these environment variables before starting the application:

```bash
export JUICE_SHOP_PRIVATE_KEY="your-secure-key"
export JUICE_SHOP_HMAC_SECRET="your-secure-secret"
npm start
```

For production deployment, set these environment variables in your deployment environment.
