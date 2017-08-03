const inflect       = require('i')(),
      respond       = require('../util/respond'),
      friendlyError = require('../util/mongoose-friendly-error'),
      _             = require('lodash');

_.mixin(require('lodash-deep'));

module.exports = options => {
  if (!options || !options.model) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return (req, res) => {
    let id      = req.params.id,
        payload = this.request.body[modelName];

    if (!payload) {
      respond.error.res(res, 'Invalid request. Payload not available.');
    }

    for (let key in payload) {
      if (!payload.hasOwnProperty(key)) {
        continue;
      }

      let pathType = Model.schema.path(key);

      if (pathType && pathType.instance === 'Array' && payload[key] === '') {
        payload[key] = [];
      }
    }

    let q = { _id: id };

    Model.findOne(q).exec()
    .then(currentRecord => {
      if (!currentRecord) {
        return respond.code.notfound(res);
      }

      if (options.reservedKeys) {
        options.reservedKeys.forEach(key => {
          if (payload[key]) {
            delete payload[key];
          }
        });
      }

      Object.assign(currentRecord, payload);

      return currentRecord.validate()
      .then(() => currentRecord.save())
      .catch(err => res.status(400).send(friendlyError(err)));
    })
    .then(doc => {
      this.status(201).send({
        [modelName]: doc.toObject(options.toObjectOptions)
      });
    })
    .catch(respond.error.callback(res));
  };
};
