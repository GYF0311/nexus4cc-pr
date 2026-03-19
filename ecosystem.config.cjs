module.exports = {
  apps: [
    {
      name: 'nexus',
      cwd: '/mnt/c/Users/libra/work/nexus',
      script: 'server.js',
      env: {
        PORT: 59000,
        NODE_ENV: 'production',
      },
    },
  ],
};
