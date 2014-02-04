// Users Route
console.log("STARTUP: Loaded users route.");

var mongo = require('mongodb');

var exception = {
	'1000_2': "API ERROR 1000:2: Users Collection Does Not Exist.",
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on users route.");
        db.collection('users', function(err, collection) {
            if (err) {
                console.log(exception['1001_2']);
            }
        });
    } else {
		console.log(exception['1001']);
	}
});

exports.addUser = function(req, res, next) {
	req.body.account_data.activated = false;
	var account = req.body.account_data;
	if(!account) {
		res.send({
			'created': false,
			'error': "No data sent with request."
		});
		return;
	}
		
	db.collection('users', function(err, collection) {
		collection.insert(account, {safe:true}, function(err, result) {
			if(err) {
				req.account.error = true;
				res.send({
					'created': false,
					'error': 'Internal Error: ' + err
				});
			} else {
				req.body.userid = result[0]._id;
				res.send({
					'created': true
				});
				if(account.privacy.index_resume) {
					next();
				}
			}
		});
	});
}

exports.fetchAll = function(req, res) {
	console.log("Opened jobs fetchAll() function in users route.");	
}

exports.fetchByID = function(req, res) {
	console.log("Opened jobs fetchByID() function in users route.");
}

