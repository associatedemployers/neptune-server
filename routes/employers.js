// Employers Route
console.log("STARTUP: Loaded employers route.");

var mongo = require('mongodb');

var exception = {
	'1000_2': "API ERROR 1000:2: Employers Collection Does Not Exist.",
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on employers route.");
        db.collection('employers', function(err, collection) {
            if (err) {
                console.log(exception['1001_2']);
            }
        });
    } else {
		console.log(exception['1001']);
	}
});

exports.fetchFeatured = function(req, res) {
	console.log("LOG: Opened employers fetchFeatured() function in employers route.");
	 db.collection('employers', function(err, collection) {
		collection.find({featured: true}).toArray(function(err, items) {
            if(req.query.callback !== null) {
				res.jsonp(items);
			} else {
				res.json(items);
			}
        });
    });
}

exports.fetchAll = function(req, res) {
	console.log("LOG: Opened employers fetchAll() function in employers route.");
	 db.collection('employers', function(err, collection) {
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
	console.log("LOG: Opened employers fetchByID() function in employers route.");
	console.log("LOG: Opening connection to retrieve employer: " + id);
	if(id.length !== 24) {
		if(req.query.callback !== null) {
			res.status(404).jsonp("Not Found");
		} else {
			res.status(404).json("Not Found");
		}
		return;
	}
	db.collection('employers', function(err, collection) {
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

exports.addEmployer = function(req, res, next) {
	var account = req.body.account_data;
	
	if(!account) {
		res.send({
			'created': false,
			'error': "No data sent with request."
		});
		return;
	}
	
	delete account.profile.about;
	delete account.tags;

	db.collection('employerusers', function(err, collection) {
		collection.findOne({'login.email': account.login.email}, function(err, result) {
			if(result) {
				res.send({
					'created': false,
					'error': 'An account already exists with that email address.'
				});
				return;
			}
		});
		collection.findOne({'name.company': account.name.company}, function(err, result) {
			if(result) {
				res.send({
					'created': false,
					'error': 'An account already exists with that company name.'
				});
				return;
			}
		});
		
		collection.insert(account, {safe:true}, function(err, result) {
			if(err) {
				res.send({
					'created': false,
					'error': 'Internal Error: ' + err
				});
			} else {
				req.employerid = result._id;
				next();
			}
		});
	});
}

exports.addEmployerListing  = function(req, res) {
	var account = req.body.account_data;
	var related_id = req.employerid;
	var listing = account;
	
	//adding on to the listing object before injection
	listing.employer_id = related_id;
	listing.featured = false;
	
	//make sure to delete things you don't want sent with a simple get req.
	delete listing.name.first;
	delete listing.name.last;
	delete listing.login;
	
	db.collection('employers', function(err, collection) {
		collection.insert(listing, {safe:true}, function(err, result) {
			if(err) {
				res.send({
					'created': false,
					'error': 'Internal Error: ' + err
				});
			} else {
				res.send({
					'created':true
				});
			}
		});
	});
}