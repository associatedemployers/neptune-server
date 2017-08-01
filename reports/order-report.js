var mongo = require('mongodb'),
    moment = require('moment'),
    Promise = require('bluebird'),
    _ = require('lodash'),
    fs = require('fs');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

var start = new Date(2015, 5, 1),
    end = new Date(2016, 5, 1);

var allOrders, csvArray = [];

var columns = [ 'type', 'membershipFlag', 'listing_name', 'featured', 'time_stamp', 'total', 'employer.name.company', 'employer.address.line1', 'employer.address.city', 'employer.address.state' ];

db.open(function(err, db) {
  if ( err ) {
    throw err;
  }

  db.collection('orders', function (err, collection) {
    collection.find({ email: { $ne: 'dev@aehr.org' } }).toArray(function (err, orders) {
      allOrders = [].concat(orders);

      db.collection('orders_archived', function ( err, archive ) {
        archive.find({ email: { $ne: 'dev@aehr.org' } }).toArray(function (err, archived) {
          allOrders = allOrders.concat(archived).map(order => {
            order.created = moment(order.time_stamp, 'YYYY/MM/DD hh:mm:ss').toDate();
            return order;
          })
          .filter(order => {
            var m = moment(order.created);
            return m.isBefore(end) && m.isAfter(start) && parseFloat(order.total) > 0;
          });

          console.log(allOrders.length, 'orders');

          csvArray.push(columns);

          db.collection('employers', function ( err, employers ) {
            Promise.map(allOrders, order => {
              return new Promise(resolve => {
                employers.findOne({ _id: new BSON.ObjectID(order.employer_id) }, function(err, employer) {
                  order.employer = employer;
                  resolve(order);
                });
              });
            })
            .each(order => {
              csvArray.push(columns.map(column => '"' + _.get(order, column) + '"'));
            })
            .then(() => {
              var csv = csvArray.map(arr => arr.join(',')).join('\n');
              fs.writeFile(moment().format('MDYYhmmss') + '_order_report.csv', csv, err => {
                if ( err ) throw err;
                process.exit();
              });
            })
          });
        });
      })
    });
  });
});
