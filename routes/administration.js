// Administration Route
console.log("STARTUP: Loaded administration route.");

var mongo = require('mongodb'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	atob = require('atob'),
	token = require('.././config/tokens');

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
        console.log("STARTUP: Connected to database on administration route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.login = function (req, res, next) {
	var email = req.query.email;
	var pass = req.query.password;
	db.collection('administrationusers', function(err, collection) {
		collection.findOne({'login.email': email, 'login.password': atob(pass)}, function(err, result) { //base64 decoding the password ~~ an extra layer of security just in case
			if(err) {
				console.log("LOG: Error occurred in login.process(): " + err);
				res.status(500).json("API Server error in login.process");	
				return;
			}
			if(result) {
				result['adminToken'] = token.admin;
				res.status(200).json(result);
			}
		});
    });
}