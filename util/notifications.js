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
	console.log(path);
	http.get(path, function (fileresponse) {
		console.log('fetching');
		if (fileresponse.statusCode === 200) {
			console.log('status ok');
			fileresponse.pipe(fs.createWriteStream(__dirname + '/../emailed_resumes/' + filename));
			fileresponse.on('end', function() {
				console.log('stream ended');
				path = __dirname + '/../emailed_resumes/' + filename;
				console.log('creating nodemailer transport');
				var transport = nodemailer.createTransport("sendmail");
				console.log('created.');
				transport.sendMail({ //send the user notification
					from: "notifications@aejobs.org",
					to: req.user_email,
					subject: "Good luck " + user_data.name.first + "!",
					text: user_template.plain,
					html: user_template.html
				}, function(error, response){
					if(error){
						console.log(error);
					} else {
						console.log('sent user email');
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
								console.log(error);
							}
							console.log('employer email: ', req.employer_email);
							console.log('user email: ', req.user_email);
							console.log('sent employer email, next line is response.');
							console.log(response);
							console.log('shutting down transport');
							transport.close(); // shut down the connection pool, no more messages
							console.log('transport shut down');
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