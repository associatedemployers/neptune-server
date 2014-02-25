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

exports.logApplication = function () {
	db.collection('analytics', function (err, collection) {
		collection.update({'type': 'applications'}, { $inc: { 'data': 1 } }, function (err, result) {
			if(err) {
				console.log(err);
			}
		});
	});
}