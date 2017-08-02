var inflect = require('i')(),
    _ = require('lodash'),
    removeEmptyStrings = require('../util/payload-empty-to-null'),
    friendlyError = require('../../lib/util/mongoose-friendly-error');

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.camelize(Model.modelName, false);

  return function* () {
    var payload = this.request.body[modelName] || this.request.body;

    this.modelName = modelName;

    if ( !payload || _.isEmpty(payload) ) {
      this.status = 400;
      this.body = 'Invalid request. Payload not available.';
      return;
    }

    if ( !options.allowEmptyStrings ) {
      payload = removeEmptyStrings(payload);
    }

    if ( this.user ) {
      let creatorPath = Model.schema.path('creator');

      if ( creatorPath ) {
        payload.creator = creatorPath.options && creatorPath.options.ref === 'CompanyUser' ? this.user._id : this.user.employee ? this.user.employee._id : null;
      }

      payload.company = this.user.company._id;
    }

    var data = payload,
        pendingRecord = new Model(data);

    try {
      yield pendingRecord.validate();
    } catch ( validationError ) {
      var errors = friendlyError(validationError);
      this.status = 400;
      this.body = { errors };
      return;
    }

    var savedRecord = yield pendingRecord.save(),
        body = {};

    body[modelName] = savedRecord.toObject(options.toObjectOptions);

    this.status = 201;
    this.body = body;
  };
};
