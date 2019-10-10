module.exports = {
  apps : [{
    name: 'app2',
    script: '/home/thierry/app2/src/server.ts',
    cwd: '/home/thierry/app2',
    args: '',
    log_file: 'app2.log',
    time: true,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '300M',
    env: { NODE_SQLSERVER: 'sqljs', NODE_PORT: '4202'}
  }]
};
