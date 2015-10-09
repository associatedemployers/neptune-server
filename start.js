var server = require('./apiserver'),
    nodemailer = require('nodemailer'),
    PerformanceMonitor = require('./util/performance'),
    integrations = require('./routes/external-integrations');

var monitor = new PerformanceMonitor({
	to: [
		'james@aehr.org',
		'greg@aehr.org'
	],
	alertFrequency: '1 hour',
	integrationHook: integrations.slack.api.status
}).memory(250, 1000000, 'MB', 1000 * 20);

integrations.slack.api.status("is going up.");

server.starthttps(process.env.securePort || 3000);
server.starthttp(process.env.unsecurePort || 3001);

integrations.slack.api.status("is up.");

process.on('uncaughtException', function ( err ) {
	console.error(err.stack);

	var transport = nodemailer.createTransport("sendmail");

	transport.sendMail({
			from:    'notifications@jobjupiter.com',
			to:      'james@aehr.org',
			subject: 'Uncaught Exception Occurred: ' + err.message,
			text:    err.stack
		}, function ( mailerr ) {
		if( mailerr ) console.error(mailerr);

		integrations.slack.api.error(err, function () {
			process.exit(1);
		});
	});

});

process.on('SIGINT', function () {
	integrations.slack.api.status("is intentionally going down.");
	process.exit(1);
});
