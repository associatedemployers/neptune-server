var inflect       = require('i')(),
    _             = require('lodash'),
    friendlyError = require('../util/mongoose-friendly-error');

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  const Model = options.model,
        modelName = inflect.camelize(Model.modelName, false);

  return (req, res) => {
    const payload = req.body[modelName] || req.body;

    if (!payload || _.isEmpty(payload) ) {
      return res.status(400).send('Invalid request. Payload not available.');
    }

    // if ( this.user ) {
    //   let creatorPath = Model.schema.path('creator');
    //
    //   if ( creatorPath ) {
    //     payload.creator = creatorPath.options && creatorPath.options.ref === 'CompanyUser' ? this.user._id : this.user.employee ? this.user.employee._id : null;
    //   }
    //
    //   payload.company = this.user.company._id;
    // }

    const data = payload,
          pendingRecord = new Model(data);

    pendingRecord.validate()
    .then(() => pendingRecord.save())
    .then(doc => {
      this.status(201).send({
        [modelName]: doc.toObject(options.toObjectOptions)
      });
    })
    .catch(err => res.status(400).send(friendlyError(err)));
  };
};
