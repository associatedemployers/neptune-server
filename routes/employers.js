// Employers Route
console.log("STARTUP: Loaded employers route.");

var mongo = require('mongodb');

var exception = {
	'1000_1': "API ERROR 1000:1: Employers Collection Does Not Exist.",
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('aejobs', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("Connected to database on employers route");
        db.collection('jobs', function(err, collection) {
            if (err) {
                console.log(exception['1001_1']);
            }
        });
    } else {
		console.log(exception['1001']);
	}
});

exports.fetchAll = function(req, res) {
	console.log("Opened jobs fetchAll() function in employers route.");	
}

exports.fetchByID = function(req, res) {
	console.log("Opened jobs fetchByID() function in employers route.");
}