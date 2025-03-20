module.exports = {
  apps: [{
    name: 'TecnoHope',
    script: 'index.js',
    cwd: 'C:/Users/Administrator/Desktop/Bots/TecnoHope', // Diretório de trabalho do bot
    max_memory_restart: process.env.MAX_MEMORY || '512M',
    env: {
      NODE_ENV: 'production',
      MAX_MEMORY: '512M'  // valor padrão
    },
    error_file: 'logs/error.log',
    out_file: 'logs/out.log',
    merge_logs: true,
    time: true
  }]
}; 