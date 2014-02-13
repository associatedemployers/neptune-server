// Jobs Route
console.log("STARTUP: Loaded jobs route.");

var mongo = require('mongodb');

var exception = {
	'1000_2': "API ERROR 1000:2: Jobs Collection Does Not Exist.",
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on jobs route.");
        db.collection('jobs', function(err, collection) {
            if (err) {
                console.log(exception['1001_2']);
            }
        });
    } else {
		console.log(exception['1001']);
	}
});

exports.fetchFeatured = function(req, res) {
	console.log("LOG: Opened jobs fetchFeatured() function in jobs route.");
	 db.collection('jobs', function(err, collection) {
		collection.find({featured: "true"}).toArray(function(err, items) {
			if(err) {
				res.send("error: " + err);	
			} else {
				res.json(items);
			}
        });
    });
}

exports.fetchAll = function(req, res) {
	console.log("LOG: Opened jobs fetchAll() function in jobs route.");
	 db.collection('jobs', function(err, collection) {
		collection.find().toArray(function(err, items) {
            if(req.query.callback !== null) {
				res.jsonp(items);
			} else {
				res.json(items);
			}
        });
    });
}

exports.fetchByID = function(req, res) {
	var id = req.params.id;
	console.log("LOG: Opened jobs fetchByID() function in jobs route.");
	console.log("LOG: Opening connection to retrieve job: " + id);
	if(id.length !== 24) {
		if(req.query.callback !== null) {
			res.status(404).jsonp("Not Found");
		} else {
			res.status(404).json("Not Found");
		}
		return;
	}
	db.collection('jobs', function(err, collection) {
		collection.findOne({'_id':new BSON.ObjectID(id)}, function(err, item) {
			if(err) {
				if(req.query.callback !== null) {
					res.status(404).jsonp("Not Found");
				} else {
					res.status(404).json("Not Found");
				}
				return;
			} else if(item == null) {
				if(req.query.callback !== null) {
					res.status(404).jsonp("Not Found");
				} else {
					res.status(404).json("Not Found");
				}
			} else {
				if(req.query.callback !== null) {
					res.jsonp(item);
				} else {
					res.json(item);
				}
			}
		});
	});
}

exports.addJob = function(req, res) {
	if(!req.body.listing) {
		res.send({
			'status': "in error",
			'error': "No data sent with request."
		});
		return;
	}
	var listing = req.body.listing;
	db.collection('jobs', function(err, collection) {
		collection.insert(listing, { safe: true }, function (err, result) {
			if(err) {
				res.send({
					'status': "in error",
					'error': "No data sent with request."
				});
			} else {
				res.send({
					'status': "created",
					'error': null
				});
			}
		});
	});
}