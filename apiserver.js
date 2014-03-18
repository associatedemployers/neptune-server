/*******************************

V0.1.1 (dev)

Main api.jobjupiter.com apiserver.js
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
administration = require('./routes/administration'),
cronjobs = require('./util/cronjobs'),
notifications = require('./util/notifications'),
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

api.get('/fetch-page-content', auth.get.guest, users.fetchPageContent); //simple fetch content

//jobs
api.get('/jobs', auth.get.guest, jobs.fetchAll); //function complete
api.get('/jobs/:id', auth.get.guest, jobs.fetchByID); //function complete
api.get('/job/save/:id', auth.get.employer, jobs.saveListing);
api.get('/job/apply/:id', auth.get.guest, jobs.newApplication, users.newApplication, users.fetchEmail, jobs.fetchEmail, jobs.fetchInfo, notifications.newApplication, analytics.logApplication);
api.post('/jobs', auth.post.employer, jobs.geocode, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile); 
api.get('/ie/job/add', auth.get.employer, transformreq, jobs.geocode, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile);
/*api.delete('/jobs', auth.employer, jobs.deleteJob);*/ //Don't know if we will use this one?...
api.get('/featured/jobs', auth.get.guest, jobs.fetchFeatured); //function complete
api.get('/search/jobs/location/:state', auth.get.guest, jobs.fetchByState, jobs.radiusSearch);

//users
api.get('/users', auth.get.admin, users.fetchAll);
api.get('/user/:id', auth.get.admin, users.fetchByID);
api.post('/users', auth.post.guest, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);//function complete
api.get('/ie/users', auth.get.guest, transformreq, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);//function complete
api.get('/users/save-job', auth.get.user, users.saveJob);
api.get('/users/fetch-saved-jobs', auth.get.user, users.fetchSavedJobs);
api.get('/users/delete-saved-job', auth.get.user, users.deleteSavedJob);
api.get('/users/recover-password', auth.get.guest, users.checkUserPassword, users.checkEmployerPassword);
api.get('/users/fetch-applications', auth.get.user, users.fetchApplications);
api.get('/users/remove-application', auth.get.user, users.removeApplication, employers.removeApplication);
api.get('/users/change-email', auth.get.guest, users.checkExistingEmailEmployer, users.checkExistingEmailUser, users.changeEmail, employers.resendVerification);
/*api.put('/users', auth.user, users.updateUser);
api.delete('/users', auth.user, users.deleteUser);*/

//employers
api.get('/search/employers/location/:state', auth.get.guest, employers.fetchByState, employers.radiusSearch);//function complete
api.get('/search/employers/tags', auth.get.guest, employers.fetchByTag);//function complete
api.get('/fetchtags/employers', auth.get.guest, employers.fetchAllTags);//function complete
api.get('/employers', auth.get.guest, employers.fetchAll); //function complete
api.get('/employers/:id', auth.get.guest, employers.fetchByID, employers.appendListings); //function complete
api.post('/employers', auth.post.guest, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing);//function complete
api.get('/ie/employers', auth.get.guest, transformreq, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing); //IE SUPPORT <10 //function complete
api.get('/check-existing-email', auth.get.guest,  employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.checkComplete);//function complete
api.get('/check-existing-employer-company', auth.get.guest,  employers.checkExistingCompany, employers.checkComplete);//function complete
api.get('/process-order', auth.get.employer, transaction.process, transaction.storeOrder, transaction.storeCard, employers.unlockResumes);//function complete
/*api.put('/employers', auth.employer, employers.updateEmployer);
api.delete('/employers', auth.employer, jobs.deleteEmployer);*/
api.get('/featured/employers', auth.get.guest, employers.fetchFeatured); //function complete
api.get('/employer/verify-account', auth.get.guest, employers.verifyAccount, employers.writeAccount, employers.writeListing); //function complete
api.get('/employer/resume-search-token', auth.get.employer, employers.checkExpiration);
api.get('/employer/resume-search', auth.get.employer, searchdb.resumeSearch, searchdb.appendUser, searchdb.sendResults);

api.get('/employer/account/applications', auth.get.employer, employers.fetchApplications);
api.get('/employer/account/applicant-labels/save', auth.get.employer, employers.saveLabels);
api.post('/employer/sync', auth.post.employer, employers.geocode, employers.firstSync, employers.secondSync, employers.thirdSync, employers.syncOK);
api.get('/employer/account/listings', auth.get.employer, employers.fetchListings);
api.get('/employer/account/orders', auth.get.employer, employers.fetchOrders);
api.get('/employer/account/saved-cards', auth.get.employer, employers.fetchCards);
api.get('/employer/account/saved-cards/delete', auth.get.employer, employers.deleteCard);

api.get('/employer/account/export-application/email', auth.get.employer, notifications.sendExportedApplication);
api.get('/employer/account/export-applications/email', auth.get.employer, notifications.sendExportedApplications);
api.get('/employer/resend-verification', auth.get.employer, employers.resendVerification);

api.get('/account/change-password', auth.get.guest, users.changePassword);

//login server
api.post('/login', auth.post.guest, login.checkemp, login.checkusr);//function complete
api.get('/ie/login', auth.get.guest, transformreq, login.checkemp, login.checkusr); //IE SUPPORT <10 //function complete

//search server
api.get('/search', auth.get.guest, searchdb.process, searchdb.sendResults); //function complete
api.get('/autocomplete', auth.get.guest, searchdb.autocomplete, searchdb.sendResults);

//administration
api.get('/admin/login', auth.get.guest, administration.login);
api.get('/admin/add-user', auth.get.admin, administration.checkExistingEmail, administration.createNewUser, notifications.sendNewAdminUser);
api.get('/admin/edit-user', auth.get.admin, administration.editAdminUser);
api.get('/admin/delete-admin-user', auth.get.admin, administration.deleteAdminUser);
api.get('/admin/fetch-administration-users', auth.get.admin, administration.fetchAdminUsers);
api.get('/admin/analytics/quick', auth.get.admin, analytics.countResumes, analytics.countExpirations, analytics.countOrdersToday, analytics.sendQuick);
api.get('/admin/analytics/full', auth.get.admin, analytics.countResumes, analytics.countOrdersToday, analytics.countOrders, analytics.countEmployers, analytics.countActiveEmployers, analytics.countUsers, analytics.countListings, analytics.countApplications, analytics.sendFull);
api.get('/admin/analytics/advanced', auth.get.admin, analytics.getDS, analytics.getCSemployers, analytics.getCSemployerusers, analytics.getCSjobs, analytics.getCSresumes, analytics.getCSusers, analytics.getCSorders, analytics.sendAdvanced);
api.get('/admin/fetch-appdata', auth.get.admin, administration.fetchAppdata);
api.get('/admin/fetch-announcements', auth.get.admin, administration.fetchAnnouncements);
api.get('/admin/create-announcement', auth.get.admin, administration.createAnnouncement);
api.get('/admin/remove-announcement', auth.get.admin, administration.removeAnnouncement);
api.get('/admin/fetch-content', auth.get.admin, administration.fetchContent);
api.get('/admin/fetch-orders', auth.get.admin, administration.fetchOrders);
api.get('/admin/fetch-listings', auth.get.admin, administration.fetchListings);
api.get('/admin/change-listing-status', auth.get.admin, administration.setListingStatus, notifications.listingStatusChange);
api.get('/admin/fetch-resumes', auth.get.admin, administration.fetchResumes, administration.appendUser, administration.sendResults);
api.get('/admin/fetch-employers', auth.get.admin, administration.fetchEmployers, administration.appendAccount, administration.sendResults);
api.get('/admin/delete-employer', auth.get.admin, administration.deleteEmployerListing, administration.deleteEmployerAccount, notifications.deletedEmployer);
api.get('/admin/fetch-users', auth.get.admin, administration.fetchUsers);
api.get('/admin/delete-user', auth.get.admin, administration.deleteUserAccount, administration.deleteUserResume);
api.get('/admin/update-content', auth.get.admin, administration.updateContent);
api.get('/admin/add-image-to-rotation', auth.get.admin, administration.addImageToRotation);
api.get('/admin/remove-image-from-rotation', auth.get.admin, administration.removeImageFromRotation);

api.get('/admin/activate', auth.get.guest, administration.activateAccount);

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