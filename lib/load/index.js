const path = require('path'),
      fs = require('fs'),
      globSync = require('glob').sync,
      auth = require('../middleware/auth'),
      join = path.resolve,
      { Router } = require('express'),
      readdir = fs.readdirSync,
      { debug } = require('./winston')(),
      mongoose = require('mongoose');

const root = `${__dirname}/../routes`;

const opTypes = {
  c: {
    middleware: require('../resource/create'),
    verb: 'post',
    path: '/'
  },
  r: [{
    middleware: require('../resource/show'),
    verb: 'get',
    path: '/:id'
  }, {
    middleware: require('../resource/index'),
    verb: 'get',
    path: '/'
  }],
  u: {
    middleware: require('../resource/update'),
    verb: 'put',
    path: '/:id'
  },
  d: {
    middleware: require('../resource/destroy'),
    verb: 'delete',
    path: '/:id'
  }
};

function getOpsForString (str) {
  return str.split('').reduce((ops, letter) => {
    let op = opTypes[letter],
        opPush = Array.isArray(op) ? op : [ op ];

    opPush.forEach(o => ops.push(o));
    return ops;
  }, []);
}

function parseRoute (conf, path, opts, mod = {}) {
  let _opts = typeof opts === 'string' ? { middleware: opts } : opts,
      _path = path,
      mwareAuth = conf.auth ? auth(conf.auth) : null;

  if ((_path || '').split(' ').length > 1) {
    let pathArr = _path.split(' ');
    _path = pathArr[1];
    _opts.verb = pathArr[0];
  }

  let fullPath = conf.prefix ? `/${conf.prefix}${_path}` : _path;

  if (_opts.ops) {
    let opArray = getOpsForString(_opts.ops);

    return opArray.forEach(op => {
      let compiledOp = op.middleware({ model: mongoose.model(opts.model) }),
          mware = conf.auth ? [ mwareAuth, compiledOp ] : compiledOp;

      debug(`Setting up route: ${op.verb} ${fullPath} (resource)`);
      this[op.verb](`${fullPath}${op.path}`, mware);
    });
  }

  debug({
    conf,
    fullPath,
    _opts,
    mod
  });

  if (!mod[_opts.middleware]) {
    throw new Error(`${conf.prefix || path} is missing export#${conf.middleware}`);
  }

  let verb = (_opts.verb || 'get').toLowerCase(),
      mware = conf.auth ? [ mwareAuth, mod[_opts.middleware] ] : mod[_opts.middleware];

  debug(`Setting up route: ${verb} ${fullPath}`);
  this[verb](fullPath, mware);
}

module.exports = (app, prefix) => {
  let baseRouter = new Router();
  globSync('../models/**/index.js', { cwd: __dirname }).map(require);

  readdir(root).forEach(file => {
    const dir = join(root, file),
          stat = fs.lstatSync(dir);

    if (stat.isDirectory()) {
      let conf = require(dir + '/config.json');
      conf.name = conf.useFileName === false ? conf.name : file;
      conf.directory = dir;

      if (!conf.routes) {
        return;
      }

      for (let path in conf.routes) {
        if (conf.routes.hasOwnProperty(path)) {
          let mod;

          try {
            mod = require(dir);
          } catch (e) {
            // Failed to load module
            return debug(`Failed to load module: ${dir}`);
          }

          parseRoute.call(baseRouter, conf, path, conf.routes[path], mod);
        }
      }
    }
  });

  app.use(prefix || '/', baseRouter);
};
