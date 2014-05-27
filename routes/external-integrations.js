// Integrations
// Uses external webhooks for custom integrations
console.log('STARTUP: Loaded Integrations.');

var https = require('https'),
	moment = require('moment'),
	qs = require('qs'),
	token = require('.././config/tokens');

exports.slack = {
	signup: {
		user: function (user) {
			slackapi.send(
				"A new user has signed up on Job Jupiter. Welcome " + user.name.first + "!"
			);
		},
		employer: function (employer) {
			slackapi.send(
				"A new employer has signed up on Job Jupiter. Welcome " + employer.name.company + "! <https://jobjupiter.com/#!/employer/" + employer._id.toString() + "|Check their page out!>"
			);
		},
		listing: function (listing) {
			slackapi.send(
				listing.name.company + ' has just posted "' + listing.display.title + '"! <https://jobjupiter.com/#!/job/' + listing._id + '|Check it out!>'
			);
		}
	}
};

var slackapi = {
	send: function (textdata) {
		slackapi.callWebhook(slackapi.buildPayload(textdata));
	},
	buildPayload: function (textdata) {
		var data = {
			username: "Jupiter-Bot",
			icon_url: "http://api.jobjupiter.com/jupiterbot.png",
			text: textdata
		}
		return JSON.stringify(data);
	},
	callWebhook: function (payload) {
		var httpOptions = {
				host: 'aehr.slack.com',
				path: '/services/hooks/incoming-webhook?token=' + token.slack_integration,
				method: 'POST',
				headers: {
					'Content-Length': payload.length
				}
			},
			request = https.request(httpOptions, function (response) {
				var buffer = "", data;
				response.on("data", function (chunk) {
					buffer += chunk;
				});
			}).on('error', function(err) {
				throw err.message;
			});
		request.write(payload);
		request.end();
	}
}