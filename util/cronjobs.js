console.log("STARTUP: Loaded cron jobs");
var mongo = require('mongodb'),
	fs = require('fs'),
	textract = require('textract'),
	http = require('follow-redirects').http,
	cronJob = require('cron').CronJob,
	analytics = require('./analytics'),
	notifications = require('./notifications'),
	Promise = require('bluebird'),
	moment = require('moment');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var timeToExecute,
	numExpired = 0;

var running = [];

var memberApis = [
	{ url: 'http://associatedemployers.org/fetchEmails.php?token=aejobs', flag: 'AE' },
	{ url: 'https://www.employers.org/index.php?src=membership&srctype=membership_jobjupiter&direct=y', flag: 'CEA' }
];

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on cronjobs route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.memberCheck = function (callback) {
	timeToExecute = new Date().getTime();
	pullMembers(callback);
}

/*XXXXXXXXXXXXXXXXXXXXX
XXXX cron jobs XXXXXXXX
XXXXXXXXXXXXXXXXXXXXX*/

//AE Member Checker
var membercheck = new cronJob('* * * * *', function(){
	timeToExecute = new Date().getTime();
	pullMembers();
}, null, true);

var jobcheck = new cronJob('* * * * *', function(){
	if ( running[0] || process.env.developerMode ) {
		return;
	}

	timeToExecute = new Date().getTime();
	console.log("running job check");
	running[0] = true;
	runJobCheck();
}, null, true);

var alertTask = new cronJob('* * * * *', function(){
	if ( running[1] || process.env.developerMode ) {
		return;
	}
	console.log('running alert task');
	running[1] = true;
	fetchAlerts();
}, null, true);

var orderManagementTask = new cronJob('* * * * *', function(){
	console.log('running orderManagementTask');
	fetchOrders();
}, null, true);

var employerManagementTask = new cronJob('* * * * *', function(){
	console.log('running employerManagementTask');
	fetchEmployers();
}, null, true);

membercheck.start();
jobcheck.start();

function pullMembers (callback) {
	var parseArray = function (arr) {
		// Needed to remove inconsistencies
		return arr.map(function (item) {
			// Fix each string to lowercase and trim any whitespace
			return (item) ? item.toLowerCase().trim() : item;
		});
	};

	Promise.reduce(memberApis, function ( ret, memberProvider ) {
		return new Promise(function ( resolve, reject ) {
			console.log('Getting', memberProvider.flag, 'Memberships...');
			http.get(memberProvider.url, function (response) {
				var buffer = '';

				response.on('data', function (chunk) {
					buffer += chunk;
				});

				response.on('end', function (err) {
					try {
						// Pass the buffer, after being parsed, to the flagger
						flagAccounts(parseArray(JSON.parse(buffer)), memberProvider.flag, resolve);
					} catch ( err ) {
						reject(new Error(err));
					}
				});
			}).on('error', reject);
		}).then(function ( result ) {
			ret.push(result);
			return ret;
		})
	}, []).then(callback).catch(function ( err ) {
		console.error('Error retrieving members.');
		console.error(err);
	});
}

function flagAccounts (emails, membershipFlag, callback) {
	db.collection('employerusers', function (err, collection) {
		collection.update({'ae_member': { $exists: true }, 'membershipFlag': membershipFlag }, { $unset: { 'ae_member': "" } }, { multi: true }, function (err, result) {
			collection.update({'login.email': { $in: emails } }, { $set: { 'ae_member': true, 'membershipFlag': membershipFlag } }, { multi: true }, function (err, updated) {
				if (err) {
					console.error(err);
				} else {
					timeToExecute = (new Date().getTime() - timeToExecute) / 1000;
					console.log("Current", membershipFlag, "Members:", updated);
				}
				if (callback) callback();
			});
		});
	});
}

function runJobCheck () {
	db.collection('jobs', function (err, collection) {
		collection.find({ remove_on: { $exists: false } }).toArray(function (err, results) {
			if(err) {
				console.error(err);
				running[0] = false;
			} else {
				iterateJobs(results);
			}
		});
	});
}

function iterateJobs (jobs) {
	numExpired = 0;
	var len = (jobs) ? jobs.length : 0;
	var count = 0;
	jobs.forEach(function(job) {
		count++;
		if(!job.time_stamp) return running[0] = false;
		var dst = job.time_stamp.split(' ').shift().split('/'); // So we take the time stamp, split it into two based on the space between date and time, remove the last from our selection, and then split it again based on the '/' separator inbetween the dates. YYYY/MM/DD
		var date = addDays(new Date(dst[0], (dst[1] - 1), dst[2]), 30).getTime();
		var now = new Date().getTime();
		if(date < now) {
			expireJob(job._id);
			pullListing(job.employer_id, job._id.toString());
			if(!job.fed_from) {
				notifications.listingExpired(job.display.title, job.name.company, job.notification_email, job._id);
				db.collection('expired_jobs', function (err, collection) {
					collection.insert(job, function (err, result) {
						if (err) console.error(err);
					});
				});
			}
		}
		if(count == len) finishUpExpiration();
	});
}

function expireJob (id) {
	db.collection('jobs', function (err, collection) {
		collection.update({ '_id': id }, { $set: { 'active': false, 'inactive_reason': 'Set unactive via expiry bot', 'remove_on': moment().add("d", 30).format("YYYY/MM/DD HH:mm:ss") } }, function (err, num) {
			if(err) {
				console.error(err);
			} else if(num) {
				numExpired++;
				analytics.logJobExpiration();
			} else if(!num) {
				console.error('!!! Could not expire job (id: ' + id + ')');
			}
		});
	});
}

function pullListing (empid, id) {
	db.collection('employerusers', function(err, collection) {
		collection.update({ '_id': new BSON.ObjectID(empid) }, { $pull: { 'listings': id } }, function(err, num) {
			if(err) console.error(err);
		});
	});
}

function finishUpExpiration () {
	console.log('jobchecker complete');
	running[0] = false;
}

function addDays(date, days) {
	var d2 = new Date(date);
	d2.setDate(d2.getDate() + days);
	return d2;
}

function fetchAlerts () {
	db.collection('alerts', function(err, collection) {
		collection.find().toArray(function(err, alerts) {
			buildUpdateList(alerts);
		});
	});
}

function buildUpdateList (alerts) {
	if(!alerts) {
		running[1] = false;
		return console.log("No alerts to process");
	}
	var t = moment(),
		toUpdate = [];

	alerts.forEach(function (a) {
		if(a.last_updated) {
			var freq = parseFloat(a.frequency.value),
				lu = moment(a.last_updated, "YYYY/MM/DD HH:mm:ss");
			if(lu.isAfter(moment(t).subtract("d", freq))) return; //if the last update is after the current time minus the frequency, we don't need to update it
		}
		toUpdate.push(a); //if we made it here, push it into the update list
	});

	iterateAlerts(toUpdate);
}

function iterateAlerts (alerts) {
	var req = { query: {} },
		toNotify = [],
		t = moment();
	var alertCount = alerts.length,
		count = 0;
	console.log('found ' + alerts.length + ' alerts');
	if(!alerts) {
		running[1] = false;
		return console.log("No alerts to process");
	}
	alerts.forEach(function (a) {
		count++;
		var freq = parseFloat(a.frequency.value);
		req.query.search_query = a.keywords.text;
		var results = [],
			query = req.query.search_query.replace(",", " "),
			sarray = query.split(" "); //split the keywords
			sarray = sarray.filter(function(qs) {
				return qs.length > 2;
			});
		db.collection('jobs', function(err, collection) { //connect to jobs collection
			collection.find({ active: true, developer: { $exists: false } }).sort( { time_stamp: -1 } ).toArray(function(err, items) { //press all jobs into an array
				var results = [];
				items.forEach(function(item) { //iterate over the items array
					var s = JSON.stringify(item).toLowerCase(); //convert each item in items to a string
					var matched = true;
					sarray.forEach(function(qs) { //take the toArray converted query and iterate over it
						if(s.search(qs.toLowerCase()) < 0) { //if regex !finds the keyword in the item string,
							matched = false; //set matched to false
						}
					});
					if(matched) {
						results.push(item);	//push the item into the results array
					}
				});
				if(results == [] || !results) return;
				var nResults = [];
				results.forEach(function (result) {
					var lmatched = false;
					if(a.notified_of) {
						a.notified_of.forEach(function (job) {
							if(job == result._id.toString()) lmatched = true;
						});
					}
					var job_ts = moment(result.time_stamp, "YYYY/MM/DD HH:mm:ss"),
						ts = moment(t).subtract("days", freq);
					if(job_ts.isBefore(ts)) return;
					if(!lmatched) nResults.push(result);
				});
				if(nResults.length < 1) return;
				a.jobs_on_alert = nResults;
				toNotify.push(a); //if we made it here, push it into the email list
				if(count == alertCount) sendAlerts(toNotify);
			});
		});
	});
}

function sendAlerts (alerts) {
	if(!alerts) {
		running[1] = false;
		return console.log("No alerts to process");
	}
	alerts.forEach(function (a) {
		notifications.sendJobAlert(a);
		updateJBA(a);
	});
	finishUpAlerts(alerts);
}

function updateJBA (a) {
	var job_list = [];
	a.jobs_on_alert.forEach(function (job) {
		job_list.push(job._id.toString());
	});
	db.collection('alerts', function (err, collection) {
		collection.findAndModify({'_id': a._id}, [], { $set: { 'last_updated': moment().format("YYYY/MM/DD HH:mm:ss") }, $addToSet: { 'notified_of': { $each: job_list } } }, function(err, result) {
			if(err) {
				console.error(err);
			}
		});
	});
}

function finishUpAlerts (alerts) {
	running[1] = false;
	console.log("Completed processing on " + alerts.length + " alerts");
}

function fetchOrders () {
	db.collection('orders', function (err, collection) {
		collection.find().toArray(function (err, results) {
			if(err) console.error(err);
			iterateOrders(results);
		});
	});
}

function iterateOrders (orders) {
	if(!orders) return;
	var currentTime = moment();
	orders.forEach(function (order) {
		if(moment(order.time_stamp, "YYYY/MM/DD HH:mm:ss").add("d", 60).isBefore(currentTime)) {
			console.log("Sending order completed " + moment(order.time_stamp, "YYYY/MM/DD HH:mm:ss").fromNow() + " to Archive");
			archiveOrder(order);
		}
	});
}

function archiveOrder (order) {
	db.collection('orders_archived', function (err, collection) {
		collection.insert(order, function (err, result) {
			if(err) console.error(err);
			deleteOrder(order._id.toString());
		});
	});
}

function deleteOrder (id) {
	if(!id) console.error("Expected id, got " + id);
	db.collection('orders', function (err, collection) {
		collection.remove({'_id': new BSON.ObjectID(id)}, function (err, result) {
			if(err) console.error(err);
		});
	});
}

function fetchEmployers () {
	db.collection('employerusers', function (err, collection) {
		collection.find().toArray(function (err, results) {
			if(err) console.error(err);
			iterateEmployers(results, true);
		});
	});
	db.collection('employers', function (err, collection) {
		collection.find().toArray(function (err, results) {
			if(err) console.error(err);
			iterateEmployers(results);
		});
	});
}

function iterateEmployers (employers, users) {
	var currentTime = moment();
	employers.forEach(function (employer) {
		if(employer.featured && currentTime.isAfter(moment(employer.featured_expiration, "YYYY/MM/DD HH:mm:ss"))) {

			if(users) {
				defeatureEmployerListing(employer._id);
				notifications.defeaturedEmployer(employer);
			} else {
				defeatureEmployer(employer._id);
			}

		}
	});
}

function defeatureEmployer (id) {
	db.collection('employerusers', function (err, collection) {
		collection.update({ '_id': new BSON.ObjectID(id.toString()) }, { $set: { 'featured': false, 'featured_expiration': null } }, function (err, result) {
			if(err) console.error(err);
			defeatureEmployerListing(id);
		});
	});
}

function defeatureEmployerListing (id) {
	db.collection('employers', function (err, collection) {
		collection.update({ '_id': new BSON.ObjectID(id.toString()) }, { $set: { 'featured': false, 'featured_expiration': null } }, function (err, result) {
			if(err) console.error(err);
		});
	});
}
