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
indexer = require('./routes/indexer'),
transaction = require('./routes/transaction'),
cronjobs = require('./util/cronjobs'),
analytics = require('./util/analytics'),

mailtemplates = require('./config/mail.templates'),
token = require('./config/tokens');
/* END Route Vars */

api.configure(function () {
    api.use(express.logger('dev'));
	api.use(express.json());
	api.use(express.urlencoded());
	api.use(function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*'); //allowed websites
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, PUT'); //allowed request types
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
api.get('/job/save/:id', auth.get.employer, jobs.saveListing);
api.get('/job/apply/:id', auth.get.guest, jobs.newApplication, users.newApplication, users.fetchEmail, jobs.fetchEmail, jobs.fetchInfo, jobs.sendNotifications);
api.post('/jobs', auth.post.employer, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile); 
api.get('/ie/job/add', auth.get.employer, transformreq, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile);
/*api.delete('/jobs', auth.employer, jobs.deleteJob);*/ //Don't know if we will use this one?...
api.get('/featured/jobs', auth.get.guest, jobs.fetchFeatured); //function complete

//users
api.get('/users', auth.get.admin, users.fetchAll);
api.get('/users/:id', auth.get.admin, users.fetchByID);
api.post('/users', auth.post.guest, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);//function complete
api.get('/ie/users', auth.get.guest, transformreq, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);//function complete
/*api.put('/users', auth.user, users.updateUser);
api.delete('/users', auth.user, users.deleteUser);*/

//employers
api.get('/search/employers/location/:state', auth.get.guest, employers.fetchByState, employers.radiusSearch);//function complete
api.get('/search/employers/tags', auth.get.guest, employers.fetchByTag);//function complete
api.get('/fetchtags/employers', auth.get.guest, employers.fetchAllTags);//function complete
api.get('/employers', auth.get.guest, employers.fetchAll); //function complete
api.get('/employers/:id', auth.get.guest, employers.fetchByID); //function complete
api.post('/employers', auth.post.guest, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing);//function complete
api.get('/ie/employers', auth.get.guest, transformreq, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing); //IE SUPPORT <10 //function complete
api.get('/check-existing-email', auth.get.guest,  employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.checkComplete);//function complete
api.get('/check-existing-employer-company', auth.get.guest,  employers.checkExistingCompany, employers.checkComplete);//function complete
api.get('/process-order', auth.get.employer, transaction.process, transaction.storeOrder, transaction.storeCard);//function complete
/*api.put('/employers', auth.employer, employers.updateEmployer);
api.delete('/employers', auth.employer, jobs.deleteEmployer);*/
api.get('/featured/employers', auth.get.guest, employers.fetchFeatured); //function complete
api.get('/employer/verify-account', auth.get.guest, employers.verifyAccount, employers.writeAccount, employers.writeListing); //function complete

api.post('/employer/sync', auth.post.employer, employers.geocode, employers.firstSync, employers.secondSync, employers.thirdSync, employers.syncOK);
api.get('/employer/account/listings', auth.get.employer, employers.fetchListings);
api.get('/employer/account/orders', auth.get.employer, employers.fetchOrders);
api.get('/employer/account/saved-cards', auth.get.employer, employers.fetchCards);
api.get('/employer/account/saved-cards/delete', auth.get.employer, employers.deleteCard);

api.get('/account/change-password', auth.get.guest, users.changePassword);

//login server
api.post('/login', auth.post.guest, login.checkemp, login.checkusr);//function complete
api.get('/ie/login', auth.get.guest, transformreq, login.checkemp, login.checkusr); //IE SUPPORT <10 //function complete

//search server
api.get('/search', auth.get.guest, searchdb.process, searchdb.sendResults); //function complete
api.get('/autocomplete', auth.get.guest, searchdb.autocomplete, searchdb.sendResults);

//Load Test Verfication
api.get('/loaderio-32d4c71c2728a25b39d9f6cc89a715d0/', function(req, res){
	var body = 'loaderio-32d4c71c2728a25b39d9f6cc89a715d0';
	res.setHeader('Content-Type', 'text/plain');
	res.setHeader('Content-Length', Buffer.byteLength(body));
	res.end(body);
});


/* XXXXXXXXXXXXXXXXXXXXXXXXXX
END Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */

api.listen(3000);
console.log('Jobs API Listening on Port 3000...');