// Administration Route
console.log("STARTUP: Loaded administration route.");

var mongo = require('mongodb'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	atob = require('atob'),
	token = require('.././config/tokens'),
	md5 = require('MD5');

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
		collection.findOne({'login.email': email, 'login.password': atob(pass), 'activated': true}, function(err, result) { //base64 decoding the password ~~ an extra layer of security just in case
			if(err) {
				console.log("LOG: Error occurred in login.process(): " + err);
				res.status(500).json("API Server error in login.process");	
				return;
			}
			if(result) {
				result['adminToken'] = token.admin;
				res.json(result);
			} else {
				res.json("User not found.");
			}
		});
    });
}

exports.fetchAdminUsers = function (req, res, next) {
	db.collection('administrationusers', function(err, collection) {
		collection.find().sort({ 'time_stamp': -1 }).toArray(function(err, results) {
			if(err) {
				console.log("LOG: Error occurred in administration fetch " + err);
				res.status(500).json("API Server error in login.process");	
				return;
			}
			if(results) {
				results.forEach(function(result) {
					delete result.login.password;
				});
				res.json(results);
			}
		});
    });
}

exports.createNewUser = function (req, res, next) {
	var user = req.query.user;
		user.verfurl = req.verfurl; //set some of these vars inside the user object.
		user.activated = false;
	for (var key in user.perms) {
		if(typeof user.perms[key] === "object") {
			for(var nestedkey in user.perms[key]) {
				user.perms[key][nestedkey] = user.perms[key][nestedkey] == "true";
			}
		} else {
			user.perms[key] = user.perms[key] == "true";
		}
	}
	db.collection('administrationusers', function(err, collection) {
		collection.insert(user, function(err, results) {
			if(err) {
				console.error(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
				next();
			}
		});
	});
}

exports.checkExistingEmail = function (req, res, next) {
	var user = req.query.user;
	if(!user || !user.name || !user.name.first || !user.name.last || !user.login || !user.login.email || !user.perms) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	}
	db.collection('administrationusers', function(err, collection) {
		collection.findOne({'login.email': user.login.email}, function(err, result) {
			if(result) {
				res.send({
					'status': 'in error',
					'error': 'An account already exists with that email address.'
				});
			} else {
				req.verfurl = md5(user.login.email);
				next();
			}
		});
	});
}

exports.activateAccount = function (req, res, next) {
	var password = req.query.password;
	var verfurl = req.query.verfurl;
	if(!verfurl || !password) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	}
	db.collection('administrationusers', function(err, collection) {
		collection.findAndModify( { 'verfurl': verfurl, 'activated': false}, [], { $set: { 'activated': true, 'login.password': atob(password), 'time_stamp': req.query.time_stamp } }, { remove: false, new: true }, function(err, result) {
			if(err) {
				res.send({
					'sync_status': 'in error',
					'sync_error': 'Mongo error: ' + err 
				});
			} else {
				if(result) {
					res.json({
						'status': 'ok',
						'email': result.login.email
					});
				} else {
					res.json({
						'status': 'in error',
						'error': 'Account is already activated or unavailable.'
					});
				}
			}
		});
	});
}

exports.deleteAdminUser = function (req, res, next) {
	var perms = req.query.perms;
	var id = req.query.id;
	if(!perms || !id) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.edit.administration_users) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('administrationusers', function(err, collection) {
		collection.remove({'_id': new BSON.ObjectID(id)}, function(err, num) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.editAdminUser = function (req, res, next) {
	var perms = req.query.perms;
	var user = req.query.user;
	if(!perms || !user || !user.name || !user.name.first || !user.name.last) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.edit.administration_users) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('administrationusers', function(err, collection) {
		collection.update({'_id': new BSON.ObjectID(user._id)}, { $set: { 'perms': user.perms, 'name': user.name } }, function(err, result) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.fetchAnnouncements = function (req, res, next) {
	db.collection('announcements', function(err, collection) {
		collection.find().sort({ 'time_stamp': -1 }).toArray(function(err, results) {
			if(err) {
				console.log(err);
			}
			if(results) {
				res.json(results);
			} else {
				res.json([]);
			}
		});
	});
}

exports.createAnnouncement = function (req, res, next) {
	var perms = req.query.perms;
	var announcement = req.query.announcement;
	if(!perms || !announcement || !announcement.title || !announcement.text || !announcement.creator || !announcement.time_stamp) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.create.announcements) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('announcements', function(err, collection) {
		collection.insert(announcement, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.removeAnnouncement = function (req, res, next) {
	var perms = req.query.perms;
	var id = req.query.id;
	if(!perms || !id) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.create.announcements) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('announcements', function(err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(id) }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.fetchAppdata = function (req, res, next) {
	db.collection('announcements', function (err, collection) {
		collection.count(function(err, count) {
			if(err) {
				console.error(err);
			}
			res.json({
				'announcements': count
			});
		});
	});
}

exports.fetchContent = function (req, res, next) {
	db.collection('content', function(err, collection) {
		collection.find().toArray(function(err, results) {
			if(err) {
				console.log(err);
			}
			if(results) {
				res.json(results);
			} else {
				res.json([]);
			}
		});
	});
}

exports.updateContent = function (req, res, next) {
	var perms = req.query.perms;
	var update = req.query.update;
	if(!perms || !update || !update.page) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.edit.content) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('content', function(err, collection) {
		collection.findAndModify({ 'page': update.page }, [], { $set: { 'content': update.content } }, { upsert: true, remove: false, new: true }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.fetchOrders = function (req, res, next) {
	var perms = req.query.perms;
	if(!perms) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.view.orders) {
		res.json([]);
		return;
	}
	var filters = {},
		qFilters = req.query.filters,
		limit = parseFloat(req.query.limit) || 100,
		page = parseFloat(req.query.page) || 1,
		sort = req.query.sort;
	for (var k in sort) {
		sort[k] = parseFloat(sort[k]);
	}
	if(qFilters) {
		for (var key in qFilters) {
			if(!filters.hasOwnProperty(key)) {// if we are not on a default
				if(qFilters[key] == 'NOT_SET') {
					filters[key] = {
						$exists: false
					}
				} else if(key == '_id') {
					filters[key] = new BSON.ObjectID(qFilters[key]);
				} else if(key.indexOf('REGEX:') > -1) {
					filters[key.replace('REGEX:', "")] = {
						$regex: qFilters[key],
						$options: 'i'
					};// support regex
				} else {
					filters[key] = qFilters[key];// overwrite it
				}
			}
		}
	}
	db.collection('orders', function (err, collection) {
		collection.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).toArray(function (err, items) {
			if(err) console.error(err);
			res.json(items);
		});
	});
}

exports.fetchListings = function (req, res, next) {
	var perms = req.query.perms;
	if(!perms) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.view.listings) {
		res.json([]);
		return;
	}
	var filters = {},
		qFilters = req.query.filters,
		limit = parseFloat(req.query.limit) || 100,
		page = parseFloat(req.query.page) || 1,
		sort = req.query.sort;
	for (var k in sort) {
		sort[k] = parseFloat(sort[k]);
	}
	if(qFilters) {
		for (var key in qFilters) {
			if(!filters.hasOwnProperty(key)) {// if we are not on a default
				var val = qFilters[key];
				if(val == "false" || val == "true") {
					filters[key] = (val == "true");
				} else if(val == 'NOT_SET') {
					filters[key] = {
						$exists: false
					}
				} else if(key == '_id') {
					filters[key] = new BSON.ObjectID(qFilters[key]);
				} else if(key.indexOf('REGEX:') > -1) {
					filters[key.replace('REGEX:', "")] = {
						$regex: val,
						$options: 'i'
					};// support regex
				} else {
					filters[key] = val;// overwrite it
				}
			}
		}
	}
	db.collection('jobs', function (err, collection) {
		collection.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).toArray(function (err, items) {
			if(err) console.error(err);
			res.json(items);
		});
	});
}

exports.setListingStatus = function (req, res, next) {
	var perms = req.query.perms;
	var id = req.query.id;
	var active = req.query.active;
	var inactiveReason = (!active) ? req.query.reason : null;
	if(!perms || !id || !req.query.email || !req.query.title) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.delete.listings) {
		res.json({
			'status': 'in error',
			'error': "You don't have permission to do that."
		});
		return;
	}
	db.collection('jobs', function(err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(id) }, [], { $set: { 'active': active, 'inactive_reason': inactiveReason } }, { remove: false, new: true }, function(err, result) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
				next();
			}
		});
	});
}

exports.fetchResumes = function (req, res, next) {
	var perms = req.query.perms;
	if(!perms) {
		res.json([]);
		return;
	} else if(!perms.view.resumes) {
		res.json([]);
		return;
	}
	db.collection('resumes', function(err, collection) {
		collection.find().toArray(function(err, results) {
			if(err) {
				console.error(err);
				res.json([]);
			} else {
				if(results.length > 0) {
					req.resarr = results;
					next();
				} else {
					res.json([]);
				}
			}
		});
	});
}

exports.appendUser = function (req, res, next) {
	var resarr = req.resarr;
	req.results = [];
	var counter = 0;
	db.collection('users', function(err, collection) {
		resarr.forEach(function(resume) {
			collection.findOne({ '_id': resume.user_id }, function(err, result) {
				if(err) {
					console.error(err);
					return;
				} else {
					if(result) {
						delete result.login.password;
						resume.user = result;
						req.results.push(resume);
					}
					counter++;
					if(counter == resarr.length) {
						next();
					}
				}
			});
		});
	});
}

exports.sendResults = function (req, res, next) {
	res.send(req.results);
}

exports.fetchEmployers = function (req, res, next) {
	var perms = req.query.perms;
	if(!perms) {
		res.json([]);
		return;
	} else if(!perms.view.employers) {
		res.json([]);
		return;
	}
	var filters = {},
		qFilters = req.query.filters,
		limit = parseFloat(req.query.limit) || 100,
		page = parseFloat(req.query.page) || 1,
		sort = req.query.sort;
	for (var k in sort) {
		sort[k] = parseFloat(sort[k]);
	}
	if(qFilters) {
		for (var key in qFilters) {
			if(!filters.hasOwnProperty(key)) {// if we are not on a default
				if(qFilters[key] == 'NOT_SET') {
					filters[key] = {
						$exists: false
					}
				} else if(key == '_id') {
					filters[key] = new BSON.ObjectID(qFilters[key]);
				} else if(key.indexOf('REGEX:') > -1) {
					filters[key.replace('REGEX:', "")] = {
						$regex: qFilters[key],
						$options: 'i'
					};// support regex
				} else {
					filters[key] = qFilters[key];// overwrite it
				}
			}
		}
	}
	db.collection('employers', function (err, collection) {
		collection.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).toArray(function (err, results) {
			if(err) {
				console.error(err);
				res.json([]);
			} else {
				if(results.length > 0) {
					req.emparr = results;
					next();
				} else {
					res.json([]);
				}
			}
		});
	});
}

exports.appendAccount = function (req, res, next) {
	var emparr = req.emparr;
	req.results = [];
	var counter = 0;
	db.collection('employerusers', function(err, collection) {
		emparr.forEach(function(employer) {
			collection.findOne({ '_id': employer.employer_id }, function(err, result) {
				if(err) {
					console.error(err);
					return;
				} else {
					if(result) {
						counter++;
						if(result.login) delete result.login.password
						employer.account = result;
						req.results.push(employer);	
					} else {
						counter++;
					}
					if(counter == emparr.length) {
						next();
					}
				}
			});
		});
	});
}

exports.deleteEmployerListing = function (req, res, next) {
	var perms = req.query.perms;
	var id = req.query.listing_id;
	if(!perms || !id || !req.query.account_id) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.delete.employers) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('employers', function(err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(id) }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				next();
			}
		});
	});
}

exports.deleteEmployerAccount = function (req, res, next) {
	var id = req.query.account_id;
	if(!id) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	}
	db.collection('employerusers', function(err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(id) }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				console.log(result);
				res.json({
					'status': 'ok'
				});
				next();
			}
		});
	});
}

exports.fetchUsers = function (req, res, next) {
	var perms = req.query.perms;
	if(!perms) {
		res.json([]);
		return;
	} else if(!perms.view.users) {
		res.json([]);
		return;
	}
	var filters = {},
		qFilters = req.query.filters,
		limit = parseFloat(req.query.limit) || 100,
		page = parseFloat(req.query.page) || 1,
		sort = req.query.sort;
	for (var k in sort) {
		sort[k] = parseFloat(sort[k]);
	}
	if(qFilters) {
		for (var key in qFilters) {
			if(!filters.hasOwnProperty(key)) {// if we are not on a default
				if(qFilters[key] == 'NOT_SET') {
					filters[key] = {
						$exists: false
					}
				} else if(key == '_id') {
					filters[key] = new BSON.ObjectID(qFilters[key]);
				} else if(key.indexOf('REGEX:') > -1) {
					filters[key.replace('REGEX:', "")] = {
						$regex: qFilters[key],
						$options: 'i'
					};// support regex
				} else {
					filters[key] = qFilters[key];// overwrite it
				}
			}
		}
	}
	db.collection('users', function (err, collection) {
		collection.find(filters).sort(sort).skip((page - 1) * limit).limit(limit).toArray(function (err, items) {
			if(err) console.error(err);
			res.json(items);
		});
	});
}

exports.deleteUserAccount = function (req, res, next) {
	var perms = req.query.perms;
	var id = req.query.user_id;
	console.log('got here first');
	if(!perms || !id) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.delete.users) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	console.log('continuing');
	db.collection('users', function(err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(id) }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				next();
			}
		});
	});
}

exports.deleteUserResume = function (req, res, next) {
	console.log('got here');
	var id = req.query.user_id;
	db.collection('resumes', function(err, collection) {
		collection.remove({ 'user_id': new BSON.ObjectID(id) }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.addImageToRotation = function (req, res, next) {
	var perms = req.query.perms;
	var image = req.query.image;
	if(!perms || !image) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.edit.content) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('content', function(err, collection) {
		collection.findAndModify({ 'page': 'image_rotation' }, [], { $addToSet: { 'content': image } }, { remove: false, new: true, upsert: true }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.removeImageFromRotation = function (req, res, next) {
	var perms = req.query.perms;
	var ts = req.query.ts;
	if(!perms || !ts) {
		res.json({
			'status': 'in error',
			'error': 'Missing information from request.'
		});
		return;
	} else if(!perms.edit || !perms.edit.content) {
		res.json({
			'status': 'in error',
			'error': 'You do not have the correct permissions to do that.'
		});
		return;
	}
	db.collection('content', function(err, collection) {
		collection.findAndModify({ 'page': 'image_rotation' }, [], { $pull: { 'content': { 'time_stamp': ts } } }, { remove: false, new: true}, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': 'Mongo err: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

//feed operations
exports.fetchFeeds = function (req, res, next) {
	db.collection('feeds', function(err, collection) {
		collection.find().sort({ 'time_stamp': -1 }).toArray(function(err, results) {
			if(err) {
				console.error(err);
				res.send("Error: " + err);
			} else {
				res.json(results);
			}
		});
	});
}

exports.registerFeed = function (req, res, next) {
	var fo = req.query.feed;
	if(!fo || !fo.name || !fo.api || !fo.api_options || !fo.system_options || !fo.time_stamp) return res.json({ status: 'in error', error: 'Missing information.' });
	db.collection('feeds', function(err, collection) {
		collection.insert(fo, function(err, result) {
			if(err) {
				console.error(err);
				res.json({
					status: 'in error',
					error: err
				});
			} else {
				res.json({
					status: 'ok'
				});
			}
		});
	});
}

exports.removeFeed = function (req, res, next) {
	var id = req.query.id;
	if(!id) return res.json({ status: 'in error', error: 'Missing information.' });
	db.collection('feeds', function(err, collection) {
		collection.update({ '_id': new BSON.ObjectID(id.toString()) }, { $set: { 'remove': true } }, function(err, result) {
			if(err) {
				console.error(err);
				res.json({
					status: 'in error',
					error: err
				});
			} else {
				res.json({
					status: 'ok'
				});
			}
		});
	});
}
//end feed operations

exports.getMaintenanceStatus = function (req, res, next) {
	db.collection('content', function(err, collection) {
		collection.findOne({'page': 'maintenance'}, function(err, result) {
			if(err) {
				console.error(err);
				res.status(500).json({
					'status': 'error',
					'error': err
				});
			} else {
				res.json({
					status: (!result.content) ? "false" : result.content.status
				});
			}
		});
	});
}