const express = require('express'),
      mongoose = require('mongoose'),
      chalk = require('chalk'),
      morgan = require('morgan'),
      bodyParser = require('body-parser'),
      { debug } = require('./lib/load/winston')(),
      version = require('./package').version,
      load = require('./lib/load');

module.exports = (opts) => {
  const app = express();

  if (!mongoose.connection.db) {
    require('./lib/load/db').init();
  }

  debug(chalk.dim('Setting server options...'));

  app.enable('trust proxy');

  if (opts.worker) {
    app.set('worker', opts.worker.id);
  }

  debug(chalk.dim('Setting up middleware...'));

  let logRoute = opts.verboseLogging || process.env.environment !== 'test';

  if (logRoute) {
    app.use(morgan('dev'));
  }

  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({
    extended: true
  }));

  if (opts.worker) {
    app.use((req, res, next) => {
      if (app.settings.worker) {
        res.set('X-Worker-Id', app.settings.worker);
        debug(chalk.dim('Request served by worker', app.settings.worker));
      }

      res.set('X-API-Version', version);
      res.set('X-Powered-By', 'Associated Employers');

      next();
    });
  }

  debug(chalk.dim('Loading APIs...'));
  load(app, '/api/v2/');

  return app;
};
