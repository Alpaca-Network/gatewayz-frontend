module.exports = {
  apps: [
    {
      name: 'gatewayz-api',
      script: 'src/main.py',
      interpreter: '/home/user/gatewayz-backend/venv/bin/python',
      cwd: '/home/user/gatewayz-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G',
      env: {
        PORT: '8000',
        PYTHONUNBUFFERED: '1',
        PYTHONPATH: '/home/user/gatewayz-backend'
      },
      error_file: '/home/user/gatewayz-backend/logs/pm2-error.log',
      out_file: '/home/user/gatewayz-backend/logs/pm2-out.log',
      log_file: '/home/user/gatewayz-backend/logs/pm2-combined.log',
      time: true,
      merge_logs: true
    }
  ]
};
