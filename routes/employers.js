// Employers Route
console.log("STARTUP: Loaded employers route.");

var mongo = require('mongodb'),
	gm = require('googlemaps'),
	haversine = require('haversine'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	md5 = require('MD5');

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
	 db.collection('employers', function(err, collection) {
		collection.find({featured: true}).sort( { time_stamp: -1 } ).toArray(function(err, items) {
            if(req.query.callback !== null) {
				res.jsonp(items);
			} else {
				res.json(items);
			}
        });
    });
}

exports.fetchAll = function(req, res) {
	db.collection('employers', function(err, collection) {
		collection.find( { 'listings': { $exists: true } } ).sort( { time_stamp: -1 } ).toArray(function(err, items) {
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
					'existing': true
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
	var a = (req.body.account_data) ? req.body.account_data.address : req.body.sync_data.address;
	if(!a.line1 && !a.city && !a.state && !a.zipcode) {
		next();
		return;
	}
	var adrstr = a.line1 + a.city + a.state + a.zipcode;
	gm.geocode(adrstr, function(err, data){
		if(req.body.account_data) {
			req.body.account_data.address.geo = {};
			req.body.account_data.address.geo.lat = data.results[0].geometry.location.lat;
			req.body.account_data.address.geo.lng = data.results[0].geometry.location.lng;
		} else {
			req.body.sync_data.address.geo = {};
			req.body.sync_data.address.geo.lat = data.results[0].geometry.location.lat;
			req.body.sync_data.address.geo.lng = data.results[0].geometry.location.lng;
		}
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
				var verificationLink =	md5(account.name.company);
				db.collection('verify', function(err, vrf) {
					vrf.insert({ 'employer_id': req.body.employerid, 'link_address': verificationLink }, { safe: true }, function(err, reslt) {
						
						var transport = nodemailer.createTransport("sendmail");
						var mailTemplate = mailtemplate.newEmployer(account.name, verificationLink);
						transport.sendMail({
							from: "no-reply@aejobs.org",
							to: account.login.email,
							subject: "Welcome to aejobs, " + account.name.company,
							text: mailTemplate.plain,
							html: mailTemplate.html
						}, function(error, response){
							if(error){
								console.log(error);
							}
							transport.close(); // shut down the connection pool, no more messages
						});
						next();
					});
				});
				
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
		collection.find({ 'listings': { $exists: true } }, { "profile.tags": 1, _id: 0 }).toArray(function(err, items) {
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
		collection.find({'listings': { $exists: true }, 'profile.tags': { $all: tags } }).toArray(function(err, items) {
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
		collection.find({'listings': { $exists: true }, "address.state": state }).sort( { time_stamp: -1 } ).toArray(function(err, items) {
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

exports.verifyAccount = function(req, res, next) {
	var vrf = req.query.id,
		e_id;
	db.collection('verify', function(err, collection) {
		collection.findOne({ 'link_address': vrf }, function(err, item) {
			if(err) {
				res.json({
					'verified': false,
					'error': err
				});
			} else {
				if(!item) {
					res.json({
						'verified': false,
						'alreadyUsed': true
					});
				} else {
					req.body.e_id = item.employer_id;
					collection.remove({ 'link_address': vrf }, function(err, numberOfRemoved) {
						if(err) {
							res.json({
								'verified': false,
								'error': err
							});
						} else {
							next();	
						}
					});
				}
			}
		});
	});
}

exports.writeAccount = function(req, res, next) {
	db.collection('employerusers', function(err, collection) {
		collection.update({ '_id': new BSON.ObjectID(req.body.e_id.toString()) }, { $set: { 'activated': true } }, function(err, result) {
			if(err) {
				res.json({
					'verified': false,
					'error': err
				});
			} else {
				next();
			}
		});
	});	
}

exports.writeListing = function(req, res) {
	db.collection('employers', function(err, collection) {
		collection.update({ 'employer_id': new BSON.ObjectID(req.body.e_id.toString()) }, { $set: { 'activated': true } }, function(err, result) {
			if(err) {
				res.json({
					'verified': false,
					'error': err
				});
			} else {
				res.json({
					'verified': true
				});
			}
		});
	});	
}

exports.addListingToAccount = function(req, res, next) {
	db.collection('employerusers', function(err, collection) {	
		collection.update( { '_id': new BSON.ObjectID(req.body.listing.employer_id) }, { $addToSet: { 'listings': req.listing_id } }, function(err, result) {
			next();
		});
	});		
}

exports.addListingToProfile = function(req, res) {
	db.collection('employers', function(err, collection) {	
		collection.update( { 'employer_id': new BSON.ObjectID(req.body.listing.employer_id) }, { $addToSet: { 'listings': req.listing_id } }, function(err, result) {
			res.send({
				'status': "created",
				'error': null
			});	
		});
	});
}

exports.firstSync = function(req, res, next) {
	var st = req.body.sync_type;
	var sync_data = req.body.sync_data;
	if(st == "profile") {
		db.collection('employerusers', function(err, collection) {
			collection.findAndModify( { '_id': new BSON.ObjectID(sync_data._id) }, [], { $set: { 'address': sync_data.address, 'profile.phone': sync_data.phone, 'profile.phone_formatted': sync_data.phone_formatted, 'profile.about': sync_data.profile.about, 'profile.tags': sync_data.profile.tags, 'profile.files': sync_data.profile.files } }, {remove:false, new:true}, function(err, result) {
				if(err) {
					res.send({
						'sync_status': 'error',
						'sync_error': 'mongo err on sync 1 - ' + err 
					});
				} else {
					if(result) {
						req.listings_arr = result.listings;
					}
					next();
				}
			});
		});
	}
}

exports.secondSync = function(req, res, next) {
	var st = req.body.sync_type;
	var sync_data = req.body.sync_data;
	var listarr = req.listings_arr;
	var locationob = {
		'city': sync_data.address.city,
		'state': sync_data.address.state	
	}
	if(st == "profile") {
		if(typeof listarr == "object") {
			db.collection('jobs', function(err, collection) {
				collection.update( { '_id': { $in: listarr } }, { $set: { 'display.description.about': sync_data.profile.about, 'location': locationob, 'display.picture': sync_data.profile.files.profile_pic } }, { multi: true }, function(err, result) {
					if(err) {
						res.send({
							'sync_status': 'error',
							'sync_error': 'mongo err on sync 2 - ' + err + '. Fatal error, please contact customer service.'
						});	
					} else {
						next();
					}
				});
			});
		} else {
			next();	
		}
	}
}

exports.thirdSync = function(req, res, next) {
	var st = req.body.sync_type;
	var sync_data = req.body.sync_data;
	if(st == "profile") {
		db.collection('employers', function(err, collection) {
			collection.update( { 'employer_id': new BSON.ObjectID(sync_data._id) }, { $set: { 'address': sync_data.address, 'profile.phone': sync_data.phone, 'profile.phone_formatted': sync_data.phone_formatted, 'profile.about': sync_data.profile.about, 'profile.tags': sync_data.profile.tags, 'profile.files': sync_data.profile.files } }, function(err, result) {
				if(err) {
					res.send({
						'sync_status': 'error',
						'sync_error': 'mongo err on sync 3 - ' + err + '. Fatal error, please contact customer service.'
					});	
				} else {
					next();
				}
			});
		});
	}
}

exports.syncOK = function(req, res) {
	res.send({
		'sync_status': 'ok'
	});
}

exports.fetchListings = function(req, res, next) {
	var employer_id = req.query.employer_id;
	if(!employer_id) {
		res.send([]);
		return;
	}
	db.collection('jobs', function(err, collection) {
		collection.find( { 'employer_id': employer_id, 'active': true } ).sort( { time_stamp: -1 } ).toArray(function(err, results) {
			if(err) {
				res.send([]);
			} else {
				res.json(results);
			}
		});
	});
}

exports.fetchOrders = function(req, res, next) {
	var employer_id = req.query.employer_id;
	if(!employer_id) {
		res.send([]);
		return;
	}
	db.collection('orders', function(err, collection) {
		collection.find( { 'employer_id': employer_id } ).sort( { time_stamp: -1 } ).toArray(function(err, results) {
			if(err) {
				res.send([]);
			} else {
				res.json(results);
			}
		});
	});
}

exports.fetchCards = function(req, res, next) {
	var employer_id = req.query.employer_id;
	if(!employer_id) {
		res.send([]);
		return;
	}
	db.collection('employerusers', function(err, collection) {
		collection.find({ '_id': new BSON.ObjectID(employer_id) }, { fields: { '_id': 0, 'stored_cards': 1 } }).toArray(function(err, results) {
			if(err) {
				res.send([]);
			} else {
				res.json(results[0].stored_cards);
			}
		});
	});
}

exports.deleteCard = function(req, res, next) {
	var employer_id = req.query.employer_id;
	var card = req.query.card;
	if(!employer_id || !card) {
		res.json({
			"status": "in error",
			"error": "No card sent in request."
		});
		return;
	}
	db.collection('employerusers', function(err, collection) {
		collection.update({ '_id': new BSON.ObjectID(employer_id) }, { $pull: { 'stored_cards': { 'token': card } } }, function(err, result) {
			if(err) {
				res.json({
					"status": "in error",
					"error": err
				});
			} else {
				res.json({
					"status": "ok"
				});
			}
		});
	});
}

exports.fetchApplications = function(req, res, next) {
	var employer_id = req.query.employer_id;
	if(!employer_id) {
		res.json({
			"status": "in error",
			"error": "No id sent in request."
		});
		return;
	}
	db.collection('jobs', function(err, collection) {
		collection.find({ 'employer_id': employer_id, 'applicants': { $exists: true } }).sort( { 'time_stamp': -1 } ).toArray(function (err, results) {
			if(err) {
				res.json({
					"status": "in error",
					"error": err
				});
			} else {
				console.log(err);
				console.log(results);
				res.json(results);
			}
		});
	});
}

exports.saveLabels = function(req, res, next) {
	var ido = req.query.ido;
	var employer_id = req.query.employer_id;
	var labels = req.query.labels;
	db.collection('jobs', function (err, collection) {
		collection.update({ 'employer_id': employer_id, '_id': new BSON.ObjectID(ido.listing_id), 'applicants': { $elemMatch: { 'applicant._id': ido.applicant_id } } }, { $set: { 'applicants.$.labels': labels } }, function (err, numUpdated) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err'
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		})
	});
}