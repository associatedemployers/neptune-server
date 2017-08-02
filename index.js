const config = require('./config');

const api = require('./server')({
  // options
});

api.listen(config.port);
