// Login Route
console.log("STARTUP: Loaded login route.");

var mongo = require('mongodb'),
atob = require('atob');

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

exports.process = function(req, res) {
	console.log("LOG: Opened login process() function in login route.");
	var con = true;
	db.collection('employerusers', function(err, collection) {
		collection.findOne({'login.email': req.body.email, 'login.password': atob(req.body.password)}, function(err, result) { //base64 decoding the password ~~ an extra layer of security just in case
			if (err) {
				console.log("LOG: Error occurred in login.process(): " + err);
				if(req.query.callback !== null) {
					res.status(500).jsonp("API Server error in login.process");	
				} else {
					res.status(500).json("API Server error in login.process");	
				}
				return;
			}
			if(result) {
				result['type'] = "employer";
				if(req.query.callback !== null) {
					res.status(200).jsonp(result); //sending back the result to the app with all user information.
				} else {
					res.status(200).json(result); //sending back the result to the app with all user information.
				}
				return con = false;
			}
		});
    });
	
	db.collection('users', function(err, collection) {
		collection.findOne({"login.email":req.body.email, "login.password": atob(req.body.password)}, function(err, result) { //repeating the lookup in the users collection just in case
			if (err && con) {
				console.log("LOG: Error occurred in login.process(): " + err);
				res.status(500).send("API Server error in login.process: " + err);	
				return;
			}
			if(result && con) {
				result['type'] = "user";
				if(req.query.callback !== null) {
					res.status(200).jsonp(result); //sending back the result to the app with all user information.
				} else {
					res.status(200).json(result); //sending back the result to the app with all user information.
				}
			} else if(con) {
				if(req.query.callback !== null) {
					res.status(200).jsonp("User not found.");	
				} else {
					res.status(200).json("User not found.");	
				}
			}
		});
	});
}

var sessionToken = {
	create: function () {
		
	},
	store: function () {
		
	}
	
}