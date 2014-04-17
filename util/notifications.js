// Jobs Route
console.log("STARTUP: Loaded notification system.");

var mongo = require('mongodb'),
	fs = require('fs'),
	http = require('follow-redirects').http,
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates');
	
var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(err) {
		console.log("Couldn't connect on notification system");
	}
});

exports.newApplication = function (req, res, next) {
	var job_info = req.job_info;
	var user_data = req.query.user_data;
	var resume = req.query.resume;
	var cover_letter = req.query.cover_letter;
	
	var user_template = mailtemplate.jobNotification_user(user_data.name, job_info.display.title, job_info.name.company);
	var employer_template = mailtemplate.jobNotification_employer(user_data.name, job_info, cover_letter);
	
	var path = req.query.resume,
		path = path.replace("../../", "http://www.jobjupiter.com:80/"),
		filename = path.split("/").pop();
	http.get(path, function (fileresponse) {
		if (fileresponse.statusCode === 200) {
			fileresponse.pipe(fs.createWriteStream(__dirname + '/../emailed_resumes/' + filename));
			fileresponse.on('end', function() {
				path = __dirname + '/../emailed_resumes/' + filename;
				var transport = nodemailer.createTransport("sendmail");
				transport.sendMail({ //send the user notification
					from: "Job Jupiter <notifications@jobjupiter.com>",
					to: req.user_email,
					subject: "Good luck " + user_data.name.first + "!",
					text: user_template.plain,
					html: user_template.html
				}, function(error, response){
					if(error){
						console.error(error);
					} else {
						transport.sendMail({
							from: "Job Jupiter <notifications@jobjupiter.com>",
							to: req.employer_email,
							subject: "New Application for " + job_info.display.title + ".",
							text: employer_template.plain,
							html: employer_template.html,
							attachments: [
								{
									filePath: path
								}
							]
						}, function(error, response){
							if(error){
								console.error(error);
							}
							transport.close(); // shut down the connection pool, no more messages
							next();
						});	
					}
				});
			});
		} else {
			console.error('The address is unavailable. (%d)', fileresponse.statusCode);
		}
	});
}

exports.sendExportedApplication = function(req, res, next) {
	var ao = req.query.applicant;
	var emailTo = req.query.email;
	var employer_id = req.query.employer_id;
	if(!ao || !emailTo || !employer_id) {
		res.json({
			'status': 'Missing a field.'
		});
		return;
	}
	var template = mailtemplate.exportApplication(ao, employer_id);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({ //send the user notification
		from: "Job Jupiter <notifications@jobjupiter.com>",
		to: emailTo,
		subject: "Exported Application: " + ao.applicant.name.first + " " + ao.applicant.name.last,
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
			transport.close();
		} else {
			transport.close(); // shut down the connection pool, no more messages
			res.json({
				'status': 'ok'
			});
		}
	});
}

exports.sendExportedApplications = function(req, res, next) {
	var aos = req.query.applicants;
	var emailTo = req.query.email;
	var employer_id = req.query.employer_id;
	if(!aos || !emailTo || !employer_id) {
		res.json({
			'status': 'Missing a field.'
		});
		return;
	}
	var template = mailtemplate.exportApplications(aos, employer_id);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({ //send the apps
		from: "Job Jupiter <notifications@jobjupiter.com>",
		to: emailTo,
		subject: "Exported Applications from jobjupiter.com",
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
			transport.close();
		} else {
			transport.close(); // shut down the connection pool, no more messages
			res.json({
				'status': 'ok'
			});
		}
	});
}

exports.sendNewAdminUser = function (req, res, next) {
	var template = mailtemplate.newAdminUser(req.query.user, req.verfurl);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <no-reply@jobjupiter.com>",
		to: req.query.user.login.email,
		subject: "Please activate your administrative account",
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
		}
		transport.close(); // shut down the connection pool, no more messages
	});
}

exports.listingStatusChange = function (req, res, next) {
	var template = mailtemplate.listingStatusChange(req.query.active, req.query.reason, req.query.title);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <notifications@jobjupiter.com>",
		to: req.query.email,
		subject: "Listing Status Change for " + req.query.title,
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
		}
		transport.close(); // shut down the connection pool, no more messages
	});
}

exports.listingExpired = function (title, company, email, id) {
	if(!email) return;
	var template = mailtemplate.listingExpired(title, company, "http://jobjupiter.com/#!/renew/" + id.toString());
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <notifications@jobjupiter.com>",
		to: email,
		subject: 'Your listing "' + title + '" has expired on jobjupiter.com',
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
		}
		transport.close(); // shut down the connection pool, no more messages
	});
}

exports.deletedEmployer = function (req, res, next) {
	if(!req.query.email) { return }
	var template = mailtemplate.deletedEmployer(req.query.name.company);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <no-reply@jobjupiter.com>",
		to: req.query.email,
		subject: 'Your employer account has been removed on jobjupiter.com',
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
		}
		transport.close(); // shut down the connection pool, no more messages
	});
}

exports.fetchAdminEmail = function (req, res, next) {
	db.collection('content', function(err, collection) {
		collection.findOne({'page': 'administration_emails'}, function (err, result) {
			if(err) {
				console.error(err);
				res.json({
					'status': 'in error',
					'error': err
				});
			} else {
				req.adminEmails = (!result.content) ? false : result.content;
				next();
			}
		});
	});
}

exports.sendContactMessage = function (req, res, next) {
	var mo = req.query.message;
	var adminEmails = (!req.adminEmails) ? null : req.adminEmails.join(', ');
	if(!mo.email || !mo.message || !mo.subject) {
		res.json({
			'status': 'in error',
			'error': 'Missing information.'
		});
		return;
	}
	if(!adminEmails) {
		res.json({
			'status': 'in error',
			'error': 'Administration is not accepting messages at this time.'
		});
		return;
	}
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <no-reply@jobjupiter.com>",
		to: adminEmails,
		subject: 'New message: ' + mo.subject,
		html: 'Message from ' + mo.name + ': <br />' + mo.message + '<br /><br />' + 'Reply to: ' + mo.email
	}, function(error, response) {
		if(error){
			console.error(error);
			res.json({
				'status': 'in error',
				'error': 'Error sending message. ' + error
			});
		} else {
			res.json({
				'status': 'ok',
			});
		}
		transport.close();
	});
}

exports.sendJobAlert = function (a) {
	var compiledJobList = compileJobList(a.jobs_on_alert);
	var template = mailtemplate.jobAlert(a, compiledJobList);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: "Job Jupiter <notifications@jobjupiter.com>",
		to: a.email,
		subject: a.jobs_on_alert.length + ' new jobs for your alert, ' + a.keywords.text,
		generateTextFromHTML: true,
		html: template
	}, function(error, response) {
		transport.close(); // shut down the connection pool, no more messages
		if(error){
			console.error(error);
		} else {
		}
	});
}

function compileJobList (jobs) {
	var html = "";
	jobs.forEach(function(job) {
		html = html + '<table class="container"><tr><td><table class="row"><tr><td class="wrapper"><table class="six columns"><tr><td class="left-text-pad"><a href="http://jobjupiter.com/#!/job/' + job._id + '"><strong>' + job.display.title + ' @ ' + job.name.company + '</strong></a><br/><p>' + job.display.description.short + '</p></td><td class="expander"></td></tr></table></td><td class="wrapper last"><table class="six columns"><tr><td class="left-text-pad" style="text-align: right;"><p><strong>' + job.location.city + ', ' + job.location.state + '</strong></p></td><td class="expander"></td></tr></table></td></tr></table></td></tr></table><hr />';
	});
	return html;
}