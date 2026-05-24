module.exports = {
  apps: [{
    name: 'crystal-bot',
    script: 'app.js',
    node_args: '',
    watch: false,
    env: {
      NODE_ENV: 'production',
    },
    env_development: {
      NODE_ENV: 'development',
    },
  }],
};
