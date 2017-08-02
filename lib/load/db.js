/*
  Mongoose configuration
*/

const mongoose      = require('mongoose'),
      winston       = require('winston').loggers.get('default'),
      chalk         = require('chalk'),
      { getConfig } = require('../../config');

let connection;

mongoose.Promise = require('bluebird');

exports.init = function (closeExisting, db, address, singleton) {
  var _db = process.env.environment === 'test' ? 'neptunetest' : db ? db : 'neptune',
      _address = address || getConfig('MONGODB_SERVER') || 'localhost',
      dbOptions = _db;

  if (getConfig('MONGODB_REPL')) {
    let members = parseFloat(getConfig('MONGODB_REPL_MEMBERS')),
        mongodPort = parseFloat(getConfig('MONGODB_REPL_PORT')) || 27017,
        replicaSet = getConfig('MONGODB_REPL_SET') || 'n0';

    _address = 'mongodb://';

    for (var i = 0; i < members; i++) {
      _address += 'mongo' + i + '.jobjupiter.com:' + mongodPort;

      if (i + 1 !== members) {
        _address += ',';
      } else {
        _address += '/neptune?replicaSet=' + replicaSet;
      }
    }
  }

  if (_address.indexOf('replicaSet') > -1) {
    dbOptions = {
      db: { 'native_parser': true },
      replset: {
        poolSize: 10,
        socketOptions: {
          keepAlive: 1000,
          connectTimeoutMS: 30000
        }
      },
      server: {
        poolSize: 5,
        socketOptions: {
          keepAlive: 1000,
          connectTimeoutMS: 30000
        }
      }
    };
  }

  if (closeExisting) {
    mongoose.connection.close();
    winston.debug(chalk.dim('Connecting to', _address, 'on', _db, 'db...'));
    return mongoose.connect(_address, dbOptions);
  }

  if (!connection && !singleton) {
    mongoose.connection.close();
    winston.debug(chalk.dim('Connecting to', _address, 'on', _db, 'db...'));
    connection = mongoose.connect(_address, dbOptions);
    return connection;
  } else if (singleton) {
    winston.debug(chalk.dim('Singleton connection to', _address, 'db...'));
    return mongoose.createConnection(_address + '/' + _db);
  } else {
    winston.debug(chalk.dim('Returning existing connection'));
    return connection;
  }
};
