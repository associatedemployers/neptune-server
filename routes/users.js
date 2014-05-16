// Users Route
console.log("STARTUP: Loaded users route.");

var mongo = require('mongodb'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	atob = require('atob'),
	token = require('.././config/tokens'),
	bcrypt = require('bcrypt');

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

exports.changePassword = function(req, res) {
	var type = req.query.type,
		id = req.query.account_id,
		oldPassword = req.query.old_password,
		email = req.query.email;
	var collc = (type == "employer") ? 'employerusers' : 'users';
	if(!type || !id || !req.query.new_password || !email) {
		res.json({
			'status': 'in error',
			'error': 'Missing fields'
		});
		return;
	}
	db.collection(collc, function(err, collection) {
		collection.findOne({ '_id': new BSON.ObjectID(id), 'login.email': email }, function (err, result) {
			if(err) throw err;
			if(result) {
				if(bcrypt.compareSync(atob(oldPassword), result.login.password)) {
					var salt = bcrypt.genSaltSync(10),
						newPassword = bcrypt.hashSync(req.query.new_password, salt);
					collection.update({'_id': new BSON.ObjectID(id), 'login.email': email}, { $set: { 'login.password': newPassword } }, function(err, numUpdated) {
						if(err) {
							res.json({
								status: 'in error',
								error: err
							});
						} else {
							res.json({
								'status': 'ok'
							});
						}
					});
				} else {
					res.status(401).send("Incorrect password.");
				}
			} else {
				res.json({
					'status': 'in error',
					'error': "Couldn't find account."
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
	db.collection('users', function (err, collection) {
		collection.findAndModify({'_id': new BSON.ObjectID(user_data._id)}, [], { $addToSet: { 'applications': application } }, function (err, result) {
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
	
	db.collection('users', function (err, collection) {
		collection.find({'_id':new BSON.ObjectID(id)}).toArray(function (err, results) {
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
			status: 'error',
			error: 'no page'
		});
	}
	db.collection('content', function(err, collection) {
		collection.findOne({ 'page': page }, function (err, result) {
			if(err) {
				console.error(err);
				res.status(500).json({
					'status': 'error',
					'error': err
				});
			} else {
				if(!result || result == null) {
					res.status(404).json({
						status: 'error',
						error: 'no page'
					});
				} else {
					res.json(result);
				}
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
	db.collection('users', function (err, collection) {
		collection.findAndModify({ '_id': new BSON.ObjectID(user_id) }, [], { $addToSet: { 'saved_jobs': job } }, {remove:false, new:true}, function (err, result) {
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
				sendRecoveryEmail(email, result, 'users');
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
				sendRecoveryEmail(email, result, 'employerusers');
				res.json({
					'status': 'ok'
				});
			}
		});
	});
}

exports.recoverPassword = function (req, res, next) {
	var recovery_id = req.params.recovery;
	db.collection('password_recovery', function (err, collection) {
		collection.findOne({ '_id': new BSON.ObjectID(recovery_id) }, function (err, result) {
			if(err) {
				res.json({
					status: 'in error',
					error: err
				});
				throw err;
			}
			if(!result) {
				res.json({
					status: 'in error',
					error: 'No recovery request found.'
				});
			} else {
				console.log(result);
				changePassword(req.query.password, result);
				res.json({
					status: 'ok'
				});
			}
		});
	})
}

function changePassword (password, ro) {
	console.log(ro.type);
	db.collection(ro.type, function (err, collection) {
		var salt = bcrypt.genSaltSync(10),
			hash = bcrypt.hashSync(password, salt);
		collection.findAndModify({ '_id': new BSON.ObjectID(ro.user_id) }, [], { $set: { 'login.password': hash } }, { remove: false }, function (err, doc) {
			if(err) throw err;
			deleteRecovery(ro);
		});
	});
}

function deleteRecovery (ro) {
	db.collection('password_recovery', function (err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(ro._id.toString()) }, function (err, doc) {
			if(err) throw err;
		});
	});
}



function sendRecoveryEmail (email, result, type) {
	db.collection('password_recovery', function (err, collection) {
		collection.findOne({ user_id: result._id.toString() }, function (err, item) {
			if(err) throw err;
			if(item) {
				collection.remove({'_id': new BSON.ObjectID(item._id.toString())}, function (err) {
					if(err) throw err;
				});
			}
			collection.insert({
				user_id: result._id.toString(),
				type: type
			}, function (err, recovery) {
				recovery = recovery[0];
				var transport = nodemailer.createTransport("sendmail"),
					mailTemplate = mailtemplate.passwordRecovery(email, result.name.first, recovery._id.toString());
				transport.sendMail({
					from: "no-reply@jobjupiter.com",
					to: email,
					subject: "Let's get your password reset, " + result.name.first + '!',
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
			});
		});
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

exports.fetchJobAlerts = function (req, res, next) {
	var id = req.query.user_id;
	if(!id) {
		res.send('Invalid Request.');
	}
	db.collection('alerts', function(err, collection) {
		collection.find({ 'user_id': id }).sort({ 'time_stamp': -1 }).toArray(function(err, results) {
			if(err) {
				res.status(500).send(err);
				console.error(err);
			} else {
				if(results) {
					res.json(results);
				} else {
					res.json([]);
				}
			}
		});
	});
}

exports.createJobAlert = function (req, res, next) {
	var alertObject = req.query.alert_object;
	if(!alertObject || !alertObject.keywords || !alertObject.keywords.array || !alertObject.keywords.text || !alertObject.frequency || !alertObject.frequency.text || !alertObject.frequency.value || !alertObject.user_id || !alertObject.email || !alertObject.time_stamp) {
		res.send('Invalid Request.');
	}
	db.collection('alerts', function(err, collection) {
		collection.insert(alertObject, { upsert: true }, function(err, result) {
			if(err) {
				res.json({
					status: 'in error',
					error: err
				});
				console.error(err);
			} else {
				res.json({
					status: 'ok'
				});
			}
		});
	});
}

exports.deleteJobAlert = function (req, res, next) {
	var alert_id = req.query.alert_id,
		user_id = req.query.user_id;
	if(!alert_id || !user_id) {
		res.send('Invalid Request.');
	}
	db.collection('alerts', function(err, collection) {
		collection.remove({ '_id': new BSON.ObjectID(alert_id), 'user_id': user_id }, function(err, result) {
			if(err) {
				res.json({
					status: 'in error',
					error: err
				});
				console.error(err);
			} else {
				res.json({
					status: 'ok'
				});
			}
		});
	});
}