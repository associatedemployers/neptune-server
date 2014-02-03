/*******************************

V0.1.1 (dev)

Main api.aejobs.org apiserver.js
(API SERVER) by AE Development
Node.js, Express.js, MongoDB

Creation Date: 2014/01/03

*******************************/

var express = require('express'),
nodemailer = require('nodemailer'),

/* Route Vars */
api = express(),
users = require('./routes/users'),
employers = require('./routes/employers'),
jobs = require('./routes/jobs'),
login = require('./routes/login'),
searchdb = require('./routes/searchdb'),

mailtemplates = require('./config/mail.templates'),
token = require('./config/tokens');
/* END Route Vars */

api.configure(function () {
    api.use(express.logger('dev'));
	api.use(express.json());
	api.use(express.urlencoded());
	api.use(function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*'); //allowed websites
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE'); //allowed request types
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
		next();
	});
});

function transformreq (req, res, next) {
	req.body = req.query;
	next();
}

//authorization controller
var auth = {
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
//end authorization controller object literal

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */

//jobs
api.get('/jobs', auth.get.guest, jobs.fetchAll); //function complete
api.get('/jobs/:id', auth.get.guest, jobs.fetchByID); //function complete
/*api.post('/jobs', auth.employer, jobs.addJob);
api.put('/jobs', auth.employer, employers.updateJob);
api.delete('/jobs', auth.employer, jobs.deleteJob);*/
api.get('/featured/jobs', auth.get.guest, jobs.fetchFeatured); //function complete

//users
api.get('/users', auth.get.admin, users.fetchAll);
api.get('/users/:id', auth.get.admin, users.fetchByID);
/*api.post('/users', auth.guest, users.addUser);
api.put('/users', auth.user, users.updateUser);
api.delete('/users', auth.user, users.deleteUser);*/

//employers
api.get('/search/employers/location/:state', auth.get.guest, employers.fetchByState, employers.radiusSearch);
api.get('/search/employers/tags', auth.get.guest, employers.fetchByTag);
api.get('/fetchtags/employers', auth.get.guest, employers.fetchAllTags);
api.get('/employers', auth.get.guest, employers.fetchAll); //function complete
api.get('/employers/:id', auth.get.guest, employers.fetchByID); //function complete
api.post('/employers', auth.post.guest, employers.addEmployer, employers.checkExistingEmail, employers.checkExistingCompany, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing);
api.get('/ie/employers', auth.get.guest, transformreq, employers.addEmployer, employers.checkExistingEmail, employers.checkExistingCompany, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing); //IE SUPPORT <10
api.get('/check-existing-employer-email', auth.get.guest, employers.checkExistingEmail, employers.checkComplete);
api.get('/check-existing-employer-company', auth.get.guest, employers.checkExistingCompany, employers.checkComplete);
/*api.put('/employers', auth.employer, employers.updateEmployer);
api.delete('/employers', auth.employer, jobs.deleteEmployer);*/
api.get('/featured/employers', auth.get.guest, employers.fetchFeatured); //function complete

//login server
api.post('/login', auth.post.guest, login.process);
api.get('/ie/login', auth.get.guest, transformreq, login.process); //IE SUPPORT <10

//search server
api.get('/search', auth.get.guest, searchdb.process);

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
END Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */

api.listen(3000);
console.log('Jobs API Listening on Port 3000...');