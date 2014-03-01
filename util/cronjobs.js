console.log("STARTUP: Loaded cron jobs");
var mongo = require('mongodb'),
	fs = require('fs'),
	textract = require('textract'),
	http = require('follow-redirects').http,
	cronJob = require('cron').CronJob,
	analytics = require('./analytics');
	
var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var timeToExecute;
var numExpired = 0;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on cronjobs route.");
    } else {
		console.log(exception['1001']);
	}
});

/*XXXXXXXXXXXXXXXXXXXXX
XXXX cron jobs XXXXXXXX
XXXXXXXXXXXXXXXXXXXXX*/

//AE Member Checker
var membercheck = new cronJob('* * * * *', function(){
	timeToExecute = new Date().getTime();
	http.get('http://associatedemployers.org/fetchEmails.php?token=aejobs', function (response) { 
		var buffer = "";
		
		response.on("data", function (chunk) {
			buffer += chunk;
		}); 
		
		response.on("end", function (err) {
			buffer = buffer.replace(RegExp('"', "g"), '').toLowerCase().split(",");
			flagAccounts(buffer);
		});
	});
}, null, true);

var jobcheck = new cronJob('* * * * *', function(){
	timeToExecute = new Date().getTime();
	runJobCheck();
}, null, true);

membercheck.start();
jobcheck.start();

function flagAccounts (emails) {
	db.collection('employerusers', function(err, collection) {
		collection.update({'ae_member': { $exists: true } }, { $unset: { 'ae_member': "" } }, { multi: true }, function(err, result) {
			collection.update({'login.email': { $in: emails } }, { $set: { 'ae_member': true } }, { multi: true }, function(err, updated) {
				if(err) {
					console.error(err);
				} else {
					timeToExecute = (new Date().getTime() - timeToExecute) / 1000;
					console.log("Current AE Members: " + updated + " | Operation took " + timeToExecute + "sec");
				}
			});
		});
	});
}

function runJobCheck () {
	db.collection('jobs', function(err, collection) {
		collection.find({ 'active': true }).toArray(function(err, results) {
			if(err) {
				console.error(err);
			} else {
				iterateJobs(results);
			}
		});
	});
}

function iterateJobs (jobs) {
	jobs.forEach(function(job) {
		var dst = job.time_stamp.split(' ').shift().split('/'); //So we take the time stamp, split it into two based on the space between date and time, remove the last from our selection, and then split it again based on the '/' separator inbetween the dates. YYYY/MM/DD
		var date = addDays(new Date(dst[0], (dst[1] - 1), dst[2]), 30).getTime();
		var now = new Date().getTime();
		if(date < now) {
			expireJob(job._id);
		}
	});
	finishUpExpiration();
}

function expireJob (id) {
	db.collection('jobs', function(err, collection) {
		collection.update({ '_id': new BSON.ObjectID(id) }, { $set: { 'active': false } }, function(err, num) {
			if(err) {
				console.error(err);
			} else if(num) {
				numExpired++;
				analytics.logJobExpiration();
			} else if(!num) {
				console.log('!!! Could not expire job (id: ' + id + ')');
			}
		});
	});
}

function finishUpExpiration () { 
	console.log('jobchecker complete | Expired ' + numExpired + ' listings');
	numExpired = 0;
}

function addDays(date, days) {
	var d2 = new Date(date);
	d2.setDate(d2.getDate() + days);
	return d2;
}