// Employers Route
console.log("STARTUP: Loaded employers route.");

var mongo = require('mongodb'),
	gm = require('googlemaps'),
	haversine = require('haversine');

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
		collection.find().sort( { time_stamp: -1 } ).toArray(function(err, items) {
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
	req.body.account_data.activated = false;
	var account = req.body.account_data;
	
	if(!account) {
		res.send({
			'created': false,
			'error': "No data sent with request."
		});
	} else {
		next();	
	}
}

exports.checkExistingEmployerEmail = function(req, res, next) {
	if(req.body.account_data) {
		var account = req.body.account_data;
	} else {
		var account = {};
		account.login = {};
		account.login.email = req.query.email;
	}
	account.login.email = account.login.email.replace(/(^\s+|\s+$)/g,'');
	db.collection('employerusers', function(err, collection) {
		collection.findOne({'login.email': account.login.email}, function(err, result) {
			if(result) {
				res.send({
					'created': false,
					'error': 'An account already exists with that email address.'
				});
			} else {
				next();
			}
		});
	});
}

exports.checkExistingUserEmail = function(req, res, next) {
	if(req.body.account_data) {
		var account = req.body.account_data;
	} else {
		var account = {};
		account.login = {};
		account.login.email = req.query.email;
	}
	account.login.email = account.login.email.replace(/(^\s+|\s+$)/g,'');
	db.collection('users', function(err, collection) {
		collection.findOne({'login.email': account.login.email}, function(err, result) {
			if(result) {
				res.send({
					'created': false,
					'error': 'An account already exists with that email address.'
				});
			} else {
				next();
			}
		});
	});
}

exports.checkExistingCompany = function(req, res, next) {
	if(req.body.account_data) {
		var account = req.body.account_data;
	} else {
		var account = {};
		account.name = {};
		account.name.company = req.query.company;
	}
	account.name.company = account.name.company.replace(/(^\s+|\s+$)/g,'');
	db.collection('employerusers', function(err, collection) {	
		collection.findOne({'name.company': account.name.company}, function(err, result) {
			if(result) {
				res.send({
					'created': false,
					'error': 'An account already exists with that company name.'
				});
			} else {
				next();
			}
		});
	});
}

exports.checkComplete = function(req, res) {
	res.send({
		'existing': false
	});
}

exports.geocode = function(req, res, next) {
	var a = req.body.account_data.address;
	if(!a.line1 && !a.city && !a.state && !a.zipcode) {
		return;
	}
	var adrstr = a.line1 + a.city + a.state + a.zipcode;
	gm.geocode(adrstr, function(err, data){
		req.body.account_data.address.geo = {};
		req.body.account_data.address.geo.lat = data.results[0].geometry.location.lat;
		req.body.account_data.address.geo.lng = data.results[0].geometry.location.lng;
		next();
	});
}

exports.createEmployerAccount = function(req, res, next) {
	var account = req.body.account_data;
		
	db.collection('employerusers', function(err, collection) {	
		collection.insert(account, {safe:true}, function(err, result) {
			if(err) {
				req.account.error = true;
				res.send({
					'created': false,
					'error': 'Internal Error: ' + err
				});
			} else {
				req.body.employerid = result[0]._id;
				next();
			}
		});
	});
}

exports.addEmployerListing = function(req, res) {
	var account = req.body.account_data;
	
	var related_id = req.body.employerid;
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

exports.fetchAllTags = function(req, res) {
	db.collection('employers', function(err, collection) {
		collection.find({}, { "profile.tags": 1, _id: 0 }).toArray(function(err, items) {
			if(err) {
				res.send(err);
				return;
			} else {
				var tagResults = [];
				items.forEach(function(item) { //iterate over the result items
					if(!item.profile) { return; }
					if(!item.profile.tags) { return; }
					item.profile.tags.forEach(function(tag) { //iterate over the tags
						if(tagResults.indexOf(tag) < 0) {
							tagResults.push(tag);
						}
					});
				});
				res.json(tagResults);
			}
		});
	});
}

exports.fetchByTag = function(req, res) {
	var tags = req.query.tags;
	console.log(JSON.stringify(tags));
	db.collection('employers', function(err, collection) {
		collection.find({'profile.tags': { $all: tags } }).toArray(function(err, items) {
			if(err) {
				res.send(err);
				return;
			} else {
				res.json(items);
			}
		});
	});
}

exports.fetchByState = function(req, res, next) {
	var state = req.params.state;
	if(!state) {
		res.send("No state data received.");
		return;	
	}
	db.collection('employers', function(err, collection) {
		collection.find({ "address.state": state }).sort( { time_stamp: -1 } ).toArray(function(err, items) {
			if(err) {
				res.send(err);
				return;
			} else {
				req.dataArray = items;
				next();
			}
		});
	});
}

exports.radiusSearch = function(req, res, next) {
	var q = req.query;
	var r = req.query.radius;
	var items = req.dataArray,
		results = [],
		manifest = {
			'latitude': q.lat,
			'longitude': q.lng
		};
	items.forEach(function(item) { //iterate over the items array
		if(!item.address.geo) { return; }
		var item_geo = {
			'latitude': item.address.geo.lat,
			'longitude': item.address.geo.lng
		}
		if(haversine(manifest, item_geo, {'unit': 'mi'}) < r) { //distance less than search radius
			results.push(item);	//push the item into the results array
		}
	});
	res.json(results);
}