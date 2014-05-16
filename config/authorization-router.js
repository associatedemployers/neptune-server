var token = require('./tokens'),
	mongo = require('mongodb'),
	atob = require('atob'),
	bcrypt = require('bcrypt'),
	jwt = require('jwt-simple');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
	db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
	console.log("STARTUP: Connected to database on authorization router.");
});


exports.isEmployer = function(req, res, next) {
	var e = req.email,
		p = req.password;
	db.collection('employerusers', function (err, collection) {
		collection.findOne({ 'login.email': e }, function (err, result) {
			if(err) {
				console.error(err);
				return res.status(500).send(err);
			}
			if(result && bcrypt.compareSync(p, result.login.password)) {
				req.account = result;
				next();
			} else {
				console.log("SECURITY LOG: User is not employer, yet tried to connect to a secured route.");
				return res.status(401).send("Not authorized to do that.");
			}
		});
	});
}

exports.jwtcheck = function (req, res, next) {
	var jwtd = (req.query.token) ? jwt.decode(req.query.token, token.jwtkey) : jwt.decode(req.body.token, token.jwtkey);
	if(jwtd.token) {
		if(req.query.token) {
			req.query.token = jwtd.token;
		} else if(req.body.token) {
			req.body.token = jwtd.token
		}
		req.email = jwtd.email;
		req.password = jwtd.password;
	}
	next();
}