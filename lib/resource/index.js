const inflect    = require('i')(),
      { debug }  = require('winston'),
      chalk      = require('chalk'),
      Promise    = require('bluebird'),
      respond    = require('../util/respond'),
      _          = require('lodash'),
      parseQuery = require('../util/parse-query');

const migrateKeys = [ 'limit', 'page', 'sort', 'select', '_count', 'q', 'qKey', '_projection' ];

module.exports = (options = {}) => {
  var _populate = options.populate || '';

  return (req, res) => {
    debug(chalk.dim(JSON.stringify(this.request.body)));

    const Model = options.model,
          lowerCaseResource = inflect.camelize(inflect.underscore(Model.modelName).toLowerCase(), false);

    let query      = req.query ? parseQuery(req.query) : {},
        projection = query._projection,
        _count     = query._count,
        limit      = parseFloat(query.limit) || null,
        page       = parseFloat(query.page)  || 0,
        select     = query.select || '',
        skip       = page * limit,
        sort       = query.sort ? query.sort : options.sort ? options.sort : { created: 1 };

    const hasCompanyKey = !!Model.schema.path('company');

    if (hasCompanyKey && options.forceCompanyQueryMerge !== false && req.user && req.user.company) {
      query.company = req.user.company;
    }

    if (options.query) {
      query = _.assign(query, options.query);
    }

    if (query._distinct === true) {
      return Model.distinct(select).exec()
      .then(result => res.status(200).send(result))
      .catch(respond.error.callback(res));
    }

    if (query.ids) {
      query._id = {
        $in: query.ids
      };

      delete query.ids;
    }

    if (query.q && query.qKey) {
      query[query.qKey] = {
        $regex: query.q,
        $options: 'i'
      };
    }

    migrateKeys.forEach(k => delete query[k]);

    for (var key in query) {
      if (query.hasOwnProperty(key)) {
        var v = query[key];

        if (v === 'exists') {
          query[key] = {
            $exists: true
          };
        } else if (v === 'nexists') {
          query[key] = {
            $exists: false
          };
        }
      }
    }

    debug(chalk.dim(query, select, limit, page, skip, JSON.stringify(sort), projection));

    if (_count === true) {
      return Promise.all([
        Model.count({}).exec(),
        Model.count(query).exec()
      ])
      .spread((total, count) => res.status(200).send({ total, count }))
      .catch(respond.error.callback(res));
    }

    const queryPromise = Model.find(query, projection)
    .sort(sort)
    .skip(Math.abs(skip))
    .limit(Math.abs(limit))
    .select(select)
    .populate(_populate)
    .exec()
    .then(records => records.map(r => r.toObject({ virtuals: true })));

    Promise.all([
      Model.count(query).exec(),
      queryPromise
    ])
    .then((total, records) => res.status(200).send({
      meta: { total },
      [lowerCaseResource]: records
    }))
    .catch(respond.error.callback(res));
  };
};
