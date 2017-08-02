const path = require('path'),
      fs = require('fs'),
      globSync = require('glob').sync,
      auth = require('../auth'),
      join = path.resolve,
      readdir = fs.readdirSync,
      mongoose = require('mongoose');

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
  let _opts = typeof opts === 'string' ? { middleware: opts, verb: path.split(' ')[0] } : opts,
      fullPath = conf.prefix ? `/${conf.prefix}${path}` : path,
      mwareAuth = conf.auth ? auth(conf.auth) : null;

  if (_opts.ops) {
    let opArray = getOpsForString(_opts.ops);

    return opArray.forEach(op => {
      let compiledOp = op.middleware({ model: mongoose.model(opts.model) }),
          mware = conf.auth ? [ mwareAuth, compiledOp ] : compiledOp;

      this[op.verb](`${fullPath}${op.path}`, mware);
    });
  }

  let verb = (_opts.verb || 'get').toLowerCase(),
      mware = conf.auth ? [ mwareAuth, mod[conf.middleware] ] : mod[conf.middleware];

  this[verb](fullPath, mware);
}

module.exports = (app) => {
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
          }

          parseRoute.call(conf, app, path, conf.routes[path], mod);
        }
      }
    }
  });
};
