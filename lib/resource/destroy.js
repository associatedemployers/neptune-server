const inflect = require('i')(),
      respond = require('../util/respond');

module.exports = options => {
  if (!options || !options.model) {
    throw new Error('Required options not passed');
  }

  const Model = options.model,
        modelName = inflect.camelize(Model.modelName, false);

  return (req, res) => {
    const id = req.params.id;

    let q = { _id: id };

    // if (options.forceCompanyQueryMerge !== false && this.user ) {
    //   q.company = this.user.company;
    // }

    Model.findOne(q).exec()
    .then(record => {
      if (!record) {
        return respond.code.notfound(res, 'Could not find ' + modelName + ' with id ' + id);
      }

      return record.remove();
    })
    .then(() => res.status(204).end())
    .catch(respond.error.callback(res));
  };
};
