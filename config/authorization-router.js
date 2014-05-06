var token = require('./tokens');

module.exports = {
	get: {
		admin: function (req, res, next) {
			if (req.query.token !== token.admin) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --ADMIN");
			} else {
				next();
			}
		},
		user: function (req, res, next) {
			if (req.query.token !== token.user) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --USER");
			} else {
				next();
			}
		},
		guest: function (req, res, next) {
			if (req.query.token !== token.guest) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --GUEST");
			} else {
				next();
			}
		},
		employer: function (req, res, next) {
			if (req.query.token !== token.employer) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --EMPLOYER");
			} else {
				next();
			}
		}
	},
	post: {
		admin: function (req, res, next) {
			if (req.body.token !== token.admin) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --ADMIN");
			} else {
				next();
			}
		},
		user: function (req, res, next) {
			if (req.body.token !== token.user) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --USER");
			} else {
				next();
			}
		},
		guest: function (req, res, next) {
			if (req.body.token !== token.guest) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --GUEST");
			} else {
				next();
			}
		},
		employer: function (req, res, next) {
			if (req.body.token !== token.employer) {
				res.send('Missing auth token from request.');
				console.log("SECURITY LOG: User attempted to connect without proper token. --EMPLOYER");
			} else {
				next();
			}
		}
	}
}