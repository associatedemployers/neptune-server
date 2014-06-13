// Integrations
// Uses external webhooks for custom integrations
console.log('STARTUP: Loaded Integrations.');

var https = require('https'),
	moment = require('moment'),
	qs = require('qs'),
	tokens = require('.././config/tokens');
var bn = [ 'Jupiter-Bot', 'JupiterAPI-Bot' ];

exports.slack = {
	signup: {
		user: function (user) {
			slackapi.send(
				"A new user has signed up on Job Jupiter. Welcome " + user.name.first + "!",
				tokens.slack_integration.jupiter_channel,
				bn[0]
			);
		},
		employer: function (employer) {
			slackapi.send(
				"A new employer has signed up on Job Jupiter. Welcome " + employer.name.company + "! <https://jobjupiter.com/#!/employer/" + employer._id.toString() + "|Check their page out!>",
				tokens.slack_integration.jupiter_channel,
				bn[0]
			);
		},
		listing: function (listing) {
			var name = (listing.name) ? listing.name.company : "Someone";
			slackapi.send(
				name + ' has just posted "' + listing.display.title + '"! <https://jobjupiter.com/#!/job/' + listing._id + '|Check it out!>',
				tokens.slack_integration.jupiter_channel,
				bn[0]
			);
		}
	},
	api: {
		error: function (err, callback) {
			slackapi.send(
				'Oh no! There was an uncaught error, API is going down: ' + err.message + '\n\n' + 'STACK:\n' + err.stack,
				tokens.slack_integration.jupiter_api_channel,
				bn[1],
				callback
			);
		},
		status: function (status, callback) {
			slackapi.send(
				'Incoming status: API ' + status,
				tokens.slack_integration.jupiter_api_channel,
				bn[1],
				callback
			);
		}
	}
};

var slackapi = {
	send: function (textdata, channelToken, botName, callback) {
		slackapi.callWebhook(slackapi.buildPayload(textdata, botName), channelToken, callback);
	},
	buildPayload: function (textdata, botName) {
		var data = {
			username: botName,
			icon_url: "http://api.jobjupiter.com/jupiterbot.png",
			text: textdata
		}
		return JSON.stringify(data);
	},
	callWebhook: function (payload, channelToken, callback) {
		var httpOptions = {
				host: 'aehr.slack.com',
				path: '/services/hooks/incoming-webhook?token=' + channelToken,
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
		if(callback) callback();
	}
}