// Login Route
console.log("STARTUP: Loaded login route.");

var mongo = require('mongodb'),
	atob = require('atob'),
	btoa = require('btoa'),
	token = require('.././config/tokens'),
	bcrypt = require('bcrypt'),
	jwt = require('jwt-simple');

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
        console.log("STARTUP: Connected to database on login route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.checkemp = function(req, res, next) {
	db.collection('employerusers', function(err, collection) {
		collection.findOne({ 'login.email': req.body.email }, function(err, result) {
			if (err) {
				console.log("LOG: Error occurred in login.process(): " + err);
				res.status(500).json("API Server error in login.process");
				return;
			}
			if(result && bcrypt.compareSync(atob(req.body.password), result.login.password)) {
				result['type'] = "employer";
				result.login.password = req.body.password;
				result.userToken = generateJWT(atob(req.body.password), result.login.email, token.employer);
				res.status(200).json(result); //sending back the result to the app with all user information.
			} else {
				next();
			}
		});
    });
}

exports.checkusr = function(req, res) {
	db.collection('users', function(err, collection) {
		collection.findOne({ 'login.email': req.body.email }, function(err, result) {// repeating the lookup in the users collection
			if (err) {
				console.log("LOG: Error occurred in login.process(): " + err);
				res.status(500).send("API Server error in login.process: " + err);
				return;
			}
			if(result && bcrypt.compareSync(atob(req.body.password), result.login.password)) {
				result['type'] = "user";
				result.login.password = req.body.password;
				result.userToken = generateJWT(atob(req.body.password), result.login.email, token.user);
				res.status(200).json(result); //sending back the result to the app with all user information.
			} else {
				res.status(200).json("User not found.");
			}
		});
	});
}

function generateJWT (pw, em, tk) {
	return jwt.encode({
		email: em,
		password: pw,
		token: tk
	}, token.jwtkey);
}