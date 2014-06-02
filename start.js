var server = require('./apiserver'),
	nodemailer = require('nodemailer'),
	integrations = require('./routes/external-integrations');
integrations.slack.api.status("is going up.");
server.starthttps(3000);
server.starthttp(3001);
integrations.slack.api.status("is up.");

process.on('uncaughtException', function (err) {
	console.error(err.stack);
	var transport = nodemailer.createTransport("sendmail");
	transport.sendMail({
		from: 'notifications@jobjupiter.com',
		to: 'james@aehr.org',
		subject: "Uncaught Exception Occurred: " + err.message,
		text: err.stack
	}, function (mailerr) {
		if (mailerr) console.error(mailerr);
		integrations.slack.api.error(err, function () {
			process.exit(1);
		});
	});
});

process.on('SIGINT', function () {
	integrations.slack.api.status("is intentionally going down.");
	process.exit(1);
});