// Users Route
console.log("STARTUP: Loaded users route.");

var mongo = require('mongodb'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	atob = require('atob');

var exception = {
	'1000_2': "API ERROR 1000:2: Users Collection Does Not Exist.",
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
var recoveredEmails = [];
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
				
				var transport = nodemailer.createTransport("sendmail");
				var mailTemplate = mailtemplate.newUser(account.name);
				transport.sendMail({
					from: "no-reply@jobjupiter.com",
					to: account.login.email,
					subject: "Welcome from JobJupiter, " + account.name.first,
					text: mailTemplate.plain,
					html: mailTemplate.html
				}, function(error, response){
					if(error){
						console.log(error);
					}
					transport.close(); // shut down the connection pool, no more messages
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

exports.changePassword = function(req, res) {
	var type = req.query.type,
		id = req.query.account_id,
		newPassword = req.query.new_password,
		oldPassword = req.query.old_password,
		email = req.query.email;
	var collc = (type == "employer") ? 'employerusers' : 'users';
	if(!type || !id || !newPassword || !oldPassword || !email) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return
	}
	db.collection(collc, function(err, collection) {
		collection.update({'_id': new BSON.ObjectID(id), 'login.email': email, 'login.password': oldPassword}, { $set: { 'login.password': newPassword } }, function(err, numUpdated) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': err
				});
			} else if(numUpdated < 1) {
				res.json({
					'status': 'in error',
					'error': "Couldn't find account."
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.newApplication = function(req, res, next) {
	var id = req.params.id;
	var user_data = req.query.user_data;
	var application = {
		'job_id': id,
		'resume': req.query.resume,
		'cover_letter': req.query.cover_letter,
		'time_stamp': user_data.time_stamp,
		'job_title': req.job_data.display.title,
		'company': req.job_data.name.company
	};
	db.collection('users', function(err, collection) {
		collection.findAndModify({'_id': new BSON.ObjectID(user_data._id)}, [], { $addToSet: { 'applications': application } }, function(err, result) {
			if(err) {
				res.json({
					'status': 'Mongo Error: ' + err
				});
			} else {
				res.json({
					'status': 'ok'
				});
				next(); //transport to notification processes!
			}
		});
	});
}

exports.fetchEmail = function(req, res, next) {
	var id = req.query.user_data._id;
	
	db.collection('users', function(err, collection) {
		collection.find({'_id':new BSON.ObjectID(id)}).toArray(function(err, results) {
			if(err) {
				console.log(err);
			} else {
				req.user_email = results[0].login.email;
				next();
			}
		});
	});
}

exports.fetchPageContent = function (req, res, next) {
	var page = req.query.page;
	if(!page) {
		res.status(404).json({
			'status': 'error',
			'error': 'no page'
		});
	}
	db.collection('content', function(err, collection) {
		collection.findOne({'page': page}, function(err, result) {
			if(err) {
				console.log(err);
				res.status(500).json({
					'status': 'error',
					'error': err
				});
			} else {
				res.json(result);
			}
		});
	});
}

exports.saveJob = function (req, res, next) {
	var user_id = req.query.user_id,
		job = req.query.job;	
	if(!user_id || !job || !job.time_stamp || !job.job_id || !job.title) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return
	}
	db.collection('users', function(err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(user_id) }, [], { $addToSet: { 'saved_jobs': job } }, {remove:false, new:true}, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.fetchSavedJobs = function (req, res, next) {
	var user_id = req.query.user_id,
		password = atob(req.query.password);	
	if(!user_id || !password) {
		res.json({
			'error': 'Missing fields'
		});
		return
	}
	db.collection('users', function(err, collection) {
		collection.findOne({ '_id': new BSON.ObjectID(user_id), 'login.password': password }, { fields: { '_id': 0, 'saved_jobs': 1 } }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'error': err
				});
			} else if(result.saved_jobs) {
				res.json(result.saved_jobs);
			} else {
				res.json([]);
			}
		});
	});
}

exports.deleteSavedJob = function (req, res, next) {
	var user_id = req.query.user_id,
		password = atob(req.query.password),
		job_id = req.query.job_id;	
	if(!user_id || !password || !job_id) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return
	}
	db.collection('users', function(err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(user_id), 'login.password': password,  }, [], { $pull: { 'saved_jobs': {'job_id': job_id } } }, { remove: false, new: true }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': err
				});
			} else {
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.checkUserPassword = function (req, res, next) {
	var email = req.query.email;
	var matched = false;
	if(recoveredEmails.length > 0) {
		recoveredEmails.forEach(function(em) {
			if(em == email) {
				matched = true;
			}
		});
	}
	if(matched) {
		res.json({
			'status': 'in error',
			'error': 'This email has already received a reminder recently. Please try again later.'
		});
		return;
	}
	filterRecovered(email);
	db.collection('users', function(err, collection) {
		collection.findOne({ 'login.email': email }, function(err, result) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': err
				});
			} else if(!result) {
				next();
			} else {
				sendRecoveryEmail(email, result);
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.checkEmployerPassword = function (req, res, next) {
	var email = req.query.email;
	db.collection('employerusers', function(err, collection) {
		collection.findOne({ 'login.email': email }, function(err, result) {
			if(err) {
				res.json({
					'status': 'in error',
					'error': err
				});
			} else if(!result) {
				res.json({
					'status': 'in error',
					'error': 'no users found with that email'
				});
			} else {
				sendRecoveryEmail(email, result);
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

function sendRecoveryEmail (email, result) {
	var transport = nodemailer.createTransport("sendmail");
	var mailTemplate = mailtemplate.passwordRecovery(email, result.name.first, result.login.password);
	transport.sendMail({
		from: "no-reply@jobjupiter.com",
		to: email,
		subject: "Here is your password reminder, " + result.name.first,
		text: mailTemplate.plain,
		html: mailTemplate.html
	}, function(error, response){
		if(error){
			console.log(error);
			res.json({
				'status': 'in error',
				'error': 'Email server error ' + error
			});
		} else {
			transport.close(); // shut down the connection pool, no more messages
		}
	});
}

function filterRecovered (email) {
	recoveredEmails.push(email);
	setTimeout(function () {
		recoveredEmails = recoveredEmails.filter(function(em) {
			return em !== email;
		});
	}, (60 * 1000) * 10) //disallow resend for 10 minutes. Will reduce any spam that **may** occur.
}

exports.fetchApplications = function (req, res, next) {
	var email = req.query.email;
	var password = req.query.password;
	var id = req.query.user_id;
	if(!email || !password || !id) {
		res.send('Invalid Request.');
	}
	db.collection('users', function(err, collection) {
		collection.findOne({ '_id': new BSON.ObjectID(id), 'login.password': password, 'login.email': email }, { fields: { '_id': 0, 'applications': 1 } }, function(err, result) {
			if(err) {
				res.status(500).send(err);
				console.error(err);
			} else if(result.applications) {
				res.json(result.applications);
			} else {
				res.json([]);
			}
		});
	});
}

exports.removeApplication = function (req, res, next) {
	var user = req.query.user,
		job_id = req.query.job_id;
	if(!user.password || !user.email || !user._id || !job_id) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return
	}
	db.collection('users', function(err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(user._id), 'login.password': user.password, 'login.email': user.email }, [], { $pull: { 'applications': {'job_id': job_id } } }, { remove: false, new: true }, function(err, result) {
			if(err) {
				console.log(err);
				res.json({
					'status': 'in error',
					'error': err
				});
			} else {
				next();
			}
		});
	});
}

exports.changeEmail = function (req, res, next) {
	var q = req.query;
	var password = q.password,
		id = q.id,
		email = q.email,
		login_type = q.login_type;
	if(!password || !email || !id || !login_type) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return;
	}
	if(login_type == "employer") {
		db.collection('employerusers', function(err, collection) {
			collection.findAndModify({ '_id': new BSON.ObjectID(id), 'login.password': password }, [], { $set: { 'login.email': email } }, { remove: false }, function(err, result) {
				if(err) {
					console.log(err);
					res.json({
						'status': 'in error',
						'error': err
					});
				} else {
					if(!result) {
						res.json({
							'status': 'in error',
							'error': 'Could not update email. Please contact us for assistance.'
						});
					} else {
						next();
					}
				}
			});
		});
	} else {
		db.collection('users', function(err, collection) {
			collection.findAndModify({ '_id': new BSON.ObjectID(id), 'login.password': password }, [], { $set: { 'login.email': email } }, { remove: false }, function(err, result) {
				if(err) {
					console.log(err);
					res.json({
						'status': 'in error',
						'error': err
					});
				} else {
					if(!result) {
						res.json({
							'status': 'in error',
							'error': 'Could not update email. Please contact us for assistance.'
						});
					} else {
						res.json({
							'status': 'ok'
						});
					}
				}
			});
		});
	}
}

exports.checkExistingEmailEmployer = function (req, res, next) {
	req.query.email = req.query.email.replace(/(^\s+|\s+$)/g,'');
	db.collection('employerusers', function(err, collection) {
		collection.findOne({'login.email': req.query.email}, function(err, result) {
			if(result) {
				res.send({
					'status': 'in error',
					'error': 'An account already exists with that email address.'
				});
			} else {
				next();
			}
		});
	});
}

exports.checkExistingEmailUser = function (req, res, next) {
	db.collection('users', function(err, collection) {
		collection.findOne({'login.email': req.query.email}, function(err, result) {
			if(result) {
				res.send({
					'status': 'in error',
					'error': 'An account already exists with that email address.'
				});
			} else {
				next();
			}
		});
	});
}

exports.updatePreferences = function (req, res, next) {
	var user_id = req.query.user_id;
	var preferences = req.query.preferences;
	if(!user_id || !preferences) {
		res.json({
			'status': 'in error',
			'error': 'fields missing'
		});
	}
	if(preferences.resume) {//compile for indexer
		req.body.account_data = {};
		req.body.account_data.resume = {
			'path': preferences.resume.path,
			'extension': preferences.resume.path.replace('../../', '').split('.').pop()
		};
		req.body.userid = user_id;
	}
	db.collection('users', function(err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(user_id) }, [], { $set: { 'privacy': preferences.privacy } }, function(err, result) {
			if(err) {
				console.error(err);
				res.json({
					'status': 'in error',
					'error': 'mongo err: ' + err
				});
				return;
			}
			if(preferences.resume) {
					req.sendReq = true;
					next();
			} else {
				res.json({
					'status': 'ok',
				});
			}
		});
	});
}