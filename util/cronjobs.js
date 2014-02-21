console.log("STARTUP: Loaded cron jobs");
var mongo = require('mongodb'),
	fs = require('fs'),
	textract = require('textract'),
	http = require('follow-redirects').http,
	cronJob = require('cron').CronJob;
var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
var timeToExecute; 
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

membercheck.start();

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