// Users Route
console.log("STARTUP: Loaded users route.");

var mongo = require('mongodb'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates');

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
					from: "no-reply@aejobs.org",
					to: account.login.email,
					subject: "Welcome to aejobs" + account.name.first,
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
	var time_stamp = req.query.time_stamp;
	
	var application = {
		'job_id': id,
		'time_stamp': time_stamp
	}
	
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