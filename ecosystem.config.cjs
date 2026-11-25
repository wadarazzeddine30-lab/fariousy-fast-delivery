/**
 * FARIOUSY DELIVERY — Production PM2 Ecosystem Configuration
 * For VPS deployment on Node.js (Ubuntu / Debian / AlmaLinux / CentOS)
 * Domain: app.fariousy.com
 */

module.exports = {
  apps: [
    {
      name: 'fariousy-delivery',
      script: 'server.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000,
        APP_URL: 'https://app.fariousy.com'
      },
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      merge_logs: true
    }
  ]
};
