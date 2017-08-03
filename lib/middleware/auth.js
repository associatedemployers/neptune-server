/*
  auth/session middleware
*/
const winston = require('winston'),
      chalk   = require('chalk'),
      respond = require('../util/respond');

const userTypes = [ 'User', 'EmployerUser', 'AdminUser' ];

module.exports = function authMiddleware (opts = {}) {
  if (!opts.allow) {
    winston.log('debug', chalk.dim('options.allow is not specified - will use default'));
  }

  opts.allow = opts.allow ? typeof opts.allow === 'string' ? [ opts.allow ] : opts.allow : [ 'adminuser' ];

  return (req, res, next) => {
    const tokenHeader = req.header('X-API-Token'),
          token = tokenHeader || (opts.tokenFromQuery === true && req.query ? req.query.token : false);

    if (!token) {
      return res.status(401).send('This resource requires the "X-API-Token" header with a fresh and relevant session\'s token');
    }

    /* TODO: link session model static */
    ({ get: () => {} }).get(token)
    .then(ses => {
      if (!ses) {
        return res.status(401).send('The token you supplied could not be found - The session is either expired or non-existant');
      }

      if (ses.isExpired) {
        return res.status(401).send('Your session has expired');
      }

      if (opts.allow && ses.data.userType && opts.allow.split(' ').indexOf(ses.data.userType) < 0 ) {
        return res.status(401).send('User type not allowed');
      }

      req.session = ses;

      userTypes.forEach(t => {
        req.session.user[`is${t}`] = req.session.user.constructor.modelName === t;
      });

      next();
    })
    .catch(respond.error.callback(res));

  };
};
