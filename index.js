const { getConfig } = require('./config');

const api = require('./server')({
  // options
});

api.listen(getConfig('port'));
