/*
  Global Response Handlers
  Simplifies & standardizes responses
*/
const winston = require('winston'),
      chalk   = require('chalk');

exports.error = {
  res (res, err, thr) {
    winston.log('debug', err);

    if (err.status === 400) {
      res.status(400).send('There was a problem with your request: ' + err.message);
      winston.debug(err);
      return;
    }

    if (thr) {
      res.status(500).send( err );
      winston.log('error', chalk.bgRed( err.stack || err ));
      throw new Error(err);
    } else {
      res.status(400).send( err );
    }
  },

  log (err) {
    winston.log('error', err);
  },

  callback (res, thr) {
    return err => {
      if (err.status === 400) {
        res.status(400).send('There was a problem with your request: ' + err.message);
        winston.debug(err);
        return;
      }

      if (thr) {
        res.status(500).send(err);
        winston.log('error', chalk.bgRed(err.stack || err));
        throw new Error(err);
      } else {
        res.status(400).send(err);
      }
    };
  }
};

exports.code = {
  unauthorized ( res, msg ) {
    res.status(401).send( msg || 'You are not authorized to access that resource.' );
  },
  notfound ( res, msg ) {
    res.status(404).send( msg || 'That resource was not found or is unavailable.' );
  },
  notimplemented ( res, msg ) {
    res.status(501).send( msg || 'This route has not been implemented yet.' );
  }
};
