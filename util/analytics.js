// Employers Route
console.log("STARTUP: Loaded analytics route.");

var mongo = require('mongodb'),
	braintree = require('braintree'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	moment = require('moment');
	
var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function (err, db) {
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
		collection.find({'type': 'applications'}).toArray(function (err, result) {
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
		collection.count(function (err, count) {
			if(err) {
				console.error(err);
			}
			req.resumes = count;
			next();
		});
	});
}

exports.countExpirations = function (req, res, next) {
	db.collection('analytics', function (err, collection) {
		collection.findOne({'type': 'expired_listings'}, function (err, result) {
			if(err) {
				console.error(err);
			}
			req.expirations = result.data;
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
		collection.count({ 'time_stamp': { $regex: dstring, $options: 'g'} }, function (err, count) {
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
		collection.count(function (err, count) {
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
		collection.count(function (err, count) {
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
		collection.count({ 'listings': { $exists: true } }, function (err, count) {
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
		collection.count(function (err, count) {
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
		collection.count(function (err, count) {
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
		'orders': req.orders,
		'expirations': req.expirations
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
	db.stats(1024, function (err, stats) {
		if(err) console.log(err);
		req.stats.push(stats);
		next();
	});
}

exports.getCSemployerusers = function (req, res, next) {
	db.collection('employerusers', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSresumes = function (req, res, next) {
	db.collection('resumes', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSorders = function (req, res, next) {
	db.collection('orders', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSusers = function (req, res, next) {
	db.collection('users', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSemployers = function (req, res, next) {
	db.collection('employers', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.getCSjobs = function (req, res, next) {
	db.collection('jobs', function (err, collection) {
		collection.stats(1024, function (err, stats) {
			if(err) console.log(err);
			req.stats.push(stats);
			next();
		});
	});
}

exports.fetchOrderData = function (res, res, next) {
	console.log("Fetching Orders For Data Crunch...");
	db.collection('orders', function (err, collection) {
		collection.find().toArray(function (err, orders) {
			if(err) console.error(err);
			console.log("Got " + orders.length + " orders");
			if(!orders) return res.json(null);
			console.log("--->Sorting Orders");
			var ordersThisMonth = sortOrdersThisMonth(orders);
			console.log("SORTED ORDERS");
			console.log("--->Crunching Data");
			res.json(crunchOrderData(ordersThisMonth));
		});
	});
}

function sortOrdersThisMonth (orders) {
	var lastMonth = moment().subtract("d", 30);
	return orders.filter(function (order) {
		return moment(order.time_stamp, "YYYY/MM/DD HH:mm:ss").isAfter(lastMonth);
	});
}

function crunchOrderData (orders) {
	var data = [], days = 30;
	for (var i = 0; i < days; i++) {
		var day = moment().subtract("d", i), compute = [];
		orders.forEach(function (order) {
			if(moment(order.time_stamp).isSame(day, "day")) {
				compute.push({
					amount: order.total,
					success: (order.orderResult) ? order.orderResult.success : false,
					type: order.type
				});
			}
		});
		data[i] = { //init the object
			day: day.format("YYYY-MM-DD"), //format the actual day
			total: 0,
			num_successful: 0,
			type_listing: 0,
			type_resume_search: 0,
			type_featured_account: 0
		};
		compute.forEach(function (analytic) { //crunch the data
			data[i].total = data[i].total + parseFloat(analytic.amount);
			data[i].num_successful = (analytic.success) ? data[i].num_successful + 1 : data[i].num_successful;
			data[i].type_listing = (analytic.type == "listing") ? data[i].type_listing + 1 : data[i].type_listing;
			data[i].type_resume_search = (analytic.type == "resumes") ? data[i].type_resume_search + 1 : data[i].type_resume_search;
			data[i].type_featured_account = (analytic.type == "featured_account") ? data[i].type_featured_account + 1 : data[i].type_featured_account;
		});
	}
	return data;
}