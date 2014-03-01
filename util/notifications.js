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
	
	var user_template = mailtemplate.jobNotification_user(user_data.name, job_info.display.title);
	var employer_template = mailtemplate.jobNotification_employer(user_data.name, job_info, cover_letter);
	
	var path = req.query.resume,
		path = path.replace("../../", "http://www.aejobs.org:80/dev/"),
		filename = path.split("/").pop();
	http.get(path, function (fileresponse) {
		if (fileresponse.statusCode === 200) {
			fileresponse.pipe(fs.createWriteStream(__dirname + '/../emailed_resumes/' + filename));
			fileresponse.on('end', function() {
				path = __dirname + '/../emailed_resumes/' + filename;
				var transport = nodemailer.createTransport("sendmail");
				transport.sendMail({ //send the user notification
					from: "notifications@aejobs.org",
					to: req.user_email,
					subject: "Good luck " + user_data.name.first + "!",
					text: user_template.plain,
					html: user_template.html
				}, function(error, response){
					if(error){
						console.error(error);
					} else {
						transport.sendMail({
							from: "notifications@aejobs.org",
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
		from: "notifications@aejobs.org",
		to: emailTo,
		subject: "Exported Application: " + ao.applicant.name.first + " " + ao.applicant.name.last,
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
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
		from: "notifications@aejobs.org",
		to: emailTo,
		subject: "Exported Applications from aejobs.org",
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
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
		from: "no-reply@aejobs.org",
		to: req.query.user.login.email,
		subject: "Please activate your administrative account",
		text: template.plain,
		html: template.html
	}, function(error, response) {
		if(error){
			console.error(error);
		} else {
			transport.close(); // shut down the connection pool, no more messages
		}
	});
}