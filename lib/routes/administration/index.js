const AdminUser = require('../../models/AdminUser'),
      Session = require('../../models/Session'),
      respond = require('../../util/respond'),
      Promise = require('bluebird'),
      bcp = Promise.promisifyAll(require('bcrypt'));

/* Also handles activation */
exports.login = (req, res) => {
  const payload  = req.body,
        { email, password } = payload || {};

  if (!email || !password) {
    return respond.error.res(res, 'Provide a payload in your request with login details');
  }

  AdminUser.findOne({
    email,
    password: { $exists: true }
  })
  .exec()
  .then(user => {
    if (!user) {
      return res.status(401).send('User not found.');
    }

    return bcp.compareAsync(password, user.password)
    .then(matches => {
      if (matches) {
        return Promise.resolve(() => {
          if (!user.activatedOn) {
            user.activatedOn = new Date();
            user.activationKey = undefined;
            return user.save();
          }
        })
        .then(() => {
          const sessionData = {
            userId: user._id.toString(),
            email:  user.email
          };

          return Session.create(user._id, sessionData, 'Session', 'user', 'AdminUser');
        })
        .then(session => {
          res.send({
            token:      session.publicKey,
            expiration: session.expiration,
            user:       session.user.toString()
          });
        });
      }

      respond.code.unauthorized(res, 'Invalid password');
    });
  })
  .catch(respond.error.callback(res));
};
