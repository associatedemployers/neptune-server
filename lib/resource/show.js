const inflect = require('i')();

module.exports = options => {
  if ( !options || !options.model ) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.underscore(Model.modelName).toLowerCase();

  return function* () {
    let id = this.params[modelName];

    let q = { _id: id };

    if (options.forceCompanyQueryMerge !== false && this.user && Model.schema.path('company')) {
      q.company = this.user.company;
    }

    if ( options.forceEmployeeQueryMerge !== false && this.user && this.grant && this.grant.grantedToModel === 'Employee' ) {
      if ( Model.schema.path('employee') ) {
        q.employee = this.user._id;
      } else if ( Model.schema.path('employees') ) {
        q.employees = { $in: [ this.user._id ] };
      }
    }

    let queryPromise = Model.findOne(q);

    if ( options.populate ) {
      queryPromise.populate(options.populate);
    }

    if ( options.select ) {
      queryPromise.select(options.select);
    }

    let record = yield queryPromise.exec();

    if ( !record ) {
      this.status = 404;
      this.body = 'Could not find ' + modelName + ' with id ' + id;
      return;
    }

    this.status = 200;
    this.body = {};
    this.body[inflect.camelize(modelName, false)] = record.toObject({ virtuals: true });
  };
};
