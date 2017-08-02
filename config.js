const env = process.env;
const config = {
  port: env.port || 3000
};

exports.getConfig = (k) => config[k] || env[k];
exports.static = config;
