const inflect = require('i')(),
      respond = require('../util/respond');

module.exports = options => {
  if (!options || !options.model) {
    throw new Error('Required options not passed');
  }

  var Model = options.model,
      modelName = inflect.underscore(Model.modelName).toLowerCase();

  return (req, res) => {
    const id = req.params.id;

    let q = { _id: id },
        queryPromise = Model.findOne(q);

    if (options.populate) {
      queryPromise.populate(options.populate);
    }

    if (options.select) {
      queryPromise.select(options.select);
    }

    queryPromise.exec()
    .then(record => {
      if (!record) {
        return respond.code.notfound(res, 'Could not find ' + modelName + ' with id ' + id);
      }

      res.status(200).send({
        [inflect.camelize(modelName, false)]: record.toObject({ virtuals: true })
      });
    })
    .catch(respond.error.callback(res));
  };
};
