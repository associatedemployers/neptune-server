// Employers Route
console.log("STARTUP: Loaded analytics route.");

var mongo = require('mongodb'),
	braintree = require('braintree'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates');
	
var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on analytics route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.logApplication = function (req, res, next) {
	db.collection('analytics', function (err, collection) {
		collection.update({'type': 'applications'}, { $inc: { 'data': 1 } }, { upsert: true }, function (err, result) {
			if(err) {
				console.log(err);
			}
		});
	});
}

exports.logJobExpiration = function (req, res, next) {
	db.collection('analytics', function (err, collection) {
		collection.update({'type': 'expired_listings'}, { $inc: { 'data': 1 } }, { upsert: true }, function (err, result) {
			if(err) {
				console.log(err);
			}
		});
	});
}

exports.countApplications = function (req, res, next) {
	db.collection('analytics', function (err, collection) {
		collection.find({'type': 'applications'}).toArray(function(err, result) {
			if(err) {
				console.error(err);
			} else {
				req.applications = result[0].data;
				next();
			}
		});
	});
}

exports.countResumes = function (req, res, next) {
	db.collection('resumes', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			req.resumes = count;
			next();
		});
	});
}

exports.countOrdersToday = function (req, res, next) {
	db.collection('orders', function (err, collection) {
		var date = new Date();
		var month = ( (date.getMonth() + 1).toString().length == 1 ) ? "0" + ( ( date.getMonth() + 1 ).toString() ) : ( date.getMonth() + 1 ).toString();
		var day = ( (date.getDate().toString()).length == 1 ) ? "0" + ( date.getDate().toString() ) : date.getDate().toString()
		var dstring = date.getFullYear() + "/" + month + "/" + day;
		console.log(dstring);
		collection.count({ 'time_stamp': { $regex: dstring, $options: 'g'} }, function(err, count) {
			if(err) {
				console.error(err);
			}
			req.orders = count;
			next();
		});
	});
}

exports.countOrders = function (req, res, next) {
	db.collection('orders', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			req.total_orders = count;
			next();
		});
	});
}

exports.countEmployers = function (req, res, next) {
	db.collection('employerusers', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			req.employers = count;
			next();
		});
	});
}

exports.countActiveEmployers = function (req, res, next) {
	db.collection('employers', function (err, collection) {
		collection.count({ 'listings': { $exists: true } }, function(err, count) {
			if(err) {
				console.error(err);
			}
			req.active_employers = count;
			next();
		});
	});
}

exports.countUsers = function (req, res, next) {
	db.collection('users', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			req.users = count;
			next();
		});
	});
}

exports.countListings = function (req, res, next) {
	db.collection('jobs', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			req.listings = count;
			next();
		});
	});
}

exports.sendQuick = function (req, res, next) {
	res.json({
		'resumes': req.resumes,
		'orders': req.orders
	});
}

exports.sendFull = function (req, res, next) {
	res.json({
		'resumes': req.resumes,
		'orders': req.orders,
		'total_orders': req.total_orders,
		'employers': req.employers,
		'active_employers': req.active_employers,
		'users': req.users,
		'listings': req.listings,
		'applications': req.applications,
	});
}

exports.sendAdvanced = function (req, res, next) {
	req.timeToFetch = (new Date().getTime() - req.queryTime) / 1000;
	res.json({
		'stats': req.stats,
		'timeToFetch': req.timeToFetch
	});
}

exports.getDS = function (req, res, next) {
	req.queryTime = new Date().getTime();
	req.stats = [];
	db.stats(1024, function(err, stats) {
		if(err) console.log(err);
		req.stats.push(stats);
		next();
	});
}

exports.getCSemployerusers = function (req, res, next) {
	db.collection('employerusers', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSresumes = function (req, res, next) {
	db.collection('resumes', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSorders = function (req, res, next) {
	db.collection('orders', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSusers = function (req, res, next) {
	db.collection('users', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSemployers = function (req, res, next) {
	db.collection('employers', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSjobs = function (req, res, next) {
	db.collection('jobs', function(err, collection) {
		collection.stats(1024, function(err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}