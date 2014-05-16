/*******************************

Main api.jobjupiter.com apiserver.js
(API SERVER) by AE Development
Node.js, Express.js, MongoDB

Creation Date: 2014/01/03

*******************************/

var express = require('express'),
	nodemailer = require('nodemailer'),
	fs = require("fs"),
	http = require('http'),
	https = require('https'),

	privateKey = fs.readFileSync('cert/key.pem').toString(),
	certificate = fs.readFileSync('cert/certificate.pem').toString(),
	chain = fs.readFileSync('cert/ca.pem').toString(),
	
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
	feedbuilder = require('./util/feedbuilder'),
	feedcontroller = require('./util/feedcontroller'),

	mailtemplates = require('./config/mail.templates'),
	
	auth = require('./config/authorization-router')
	tokenauth = require('./config/authorization-token-router');
	/* END Route Vars */

api.configure(function () {
	api.use(express.compress());
    api.use(express.logger('dev'));
	api.use(express.json());
	api.use(express.urlencoded());
	api.use(function (req, res, next) {
		res.setHeader('Access-Control-Allow-Origin', '*');
		res.setHeader('Access-Control-Allow-Methods', 'GET, POST');//allowed request types
		res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');
		next();
	});
});

function transformreq (req, res, next) {
	req.body = req.query;
	next();
}

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */

api.get('/fetch-page-content', tokenauth.get.guest, users.fetchPageContent);// Test Covered
api.get('/maintenance-mode', tokenauth.get.guest, administration.getMaintenanceStatus);// Test Covered

api.get('/send-message', tokenauth.get.guest, notifications.fetchAdminEmail, notifications.sendContactMessage);

//jobs
api.get('/jobs', tokenauth.get.guest, jobs.fetchAll);// Test Covered
api.get('/jobs/:id', tokenauth.get.guest, jobs.fetchByID);// Test Covered
api.get('/job/category-count', tokenauth.get.guest, jobs.categoryCount);
api.get('/job/expired/:id', auth.jwtcheck, tokenauth.get.employer, jobs.fetchExpiredListing);
api.get('/job/save/:id', auth.jwtcheck, tokenauth.get.employer, jobs.saveListing);
api.get('/job/apply/:id', tokenauth.get.guest, jobs.newApplication, users.newApplication, users.fetchEmail, jobs.fetchEmail, jobs.fetchInfo, notifications.newApplication, analytics.logApplication);
api.post('/jobs', auth.jwtcheck, tokenauth.post.employer, jobs.geocode, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile);
api.get('/ie/job/add', auth.jwtcheck, tokenauth.get.employer, transformreq, jobs.geocode, jobs.addJob, employers.addListingToAccount, employers.addListingToProfile);
api.get('/featured/jobs', tokenauth.get.guest, jobs.fetchFeatured);// Test Covered
api.get('/random-featured/jobs/:count', tokenauth.get.guest, jobs.fetchRandomFeatured);// Test Covered

//users
api.post('/users', tokenauth.post.guest, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);
api.get('/ie/users', tokenauth.get.guest, transformreq, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, users.addUser, indexer.indexFile, indexer.saveResume);
api.get('/users/save-job', auth.jwtcheck, tokenauth.get.user, users.saveJob);
api.get('/users/fetch-saved-jobs', auth.jwtcheck, tokenauth.get.user, users.fetchSavedJobs);
api.get('/users/delete-saved-job', auth.jwtcheck, tokenauth.get.user, users.deleteSavedJob);
api.get('/users/recover-password', tokenauth.get.guest, users.checkUserPassword, users.checkEmployerPassword);
api.get('/users/fetch-applications', auth.jwtcheck, tokenauth.get.user, users.fetchApplications);
api.get('/users/fetch-job-alerts', auth.jwtcheck, tokenauth.get.user, users.fetchJobAlerts);
api.get('/users/remove-application', auth.jwtcheck, tokenauth.get.user, users.removeApplication, employers.removeApplication);
api.get('/users/change-email', tokenauth.get.guest, users.checkExistingEmailEmployer, users.checkExistingEmailUser, users.changeEmail, employers.resendVerification);
api.get('/users/update-preferences', auth.jwtcheck, tokenauth.get.user, users.updatePreferences, indexer.removeResume, indexer.indexFile, indexer.saveToUser, indexer.saveResume);
api.get('/users/create-alert', auth.jwtcheck, tokenauth.get.user, users.createJobAlert);
api.get('/users/delete-alert', auth.jwtcheck, tokenauth.get.user, users.deleteJobAlert);

//employers
api.get('/search/employers/location/:state', tokenauth.get.guest, employers.fetchByState, employers.radiusSearch);
api.get('/search/employers/tags', tokenauth.get.guest, employers.fetchByTag);
api.get('/fetchtags/employers', tokenauth.get.guest, employers.fetchAllTags);
api.get('/employers', tokenauth.get.guest, employers.fetchAll);
api.get('/employers/:id', tokenauth.get.guest, employers.fetchByID, employers.appendListings);
api.post('/employers', tokenauth.post.guest, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing);
api.get('/ie/employers', tokenauth.get.guest, transformreq, employers.addEmployer, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.geocode, employers.createEmployerAccount, employers.addEmployerListing);//IE SUPPORT <10 
api.get('/check-existing-email', tokenauth.get.guest, employers.checkExistingUserEmail, employers.checkExistingEmployerEmail, employers.checkComplete);
api.get('/check-existing-employer-company', tokenauth.get.guest, employers.checkExistingCompany, employers.checkComplete);
api.get('/validate-coupon', auth.jwtcheck, tokenauth.get.employer, transaction.validateCoupon);
api.get('/process-order', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, transaction.process, transaction.storeOrder, transaction.oneTime, transaction.storeCard, employers.unlockResumes, employers.featureAccount, employers.featureAccountListing, employers.addScreeningServiceToListing);
api.get('/featured/employers', tokenauth.get.guest, employers.fetchFeatured);
api.get('/random-featured/employers/:count', tokenauth.get.guest, employers.fetchRandomFeatured);
api.get('/employer/verify-account', tokenauth.get.guest, employers.verifyAccount, employers.writeAccount, employers.writeListing);
api.get('/employer/resume-search-token', auth.jwtcheck, tokenauth.get.employer, employers.checkExpiration);
api.get('/employer/resume-search', auth.jwtcheck, tokenauth.get.employer, searchdb.resumeSearch, searchdb.appendUser, searchdb.sendResults);

api.get('/employer/account/applications', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.fetchApplications);
api.get('/employer/account/applicant-labels/save', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.saveLabels);
api.post('/employer/sync', auth.jwtcheck, tokenauth.post.employer, auth.isEmployer, employers.geocode, employers.firstSync, employers.secondSync, employers.thirdSync, employers.syncOK);
api.get('/employer/ie/sync', transformreq, auth.jwtcheck, auth.isEmployer, tokenauth.post.employer, employers.geocode, employers.firstSync, employers.secondSync, employers.thirdSync, employers.syncOK);
api.get('/employer/account/listings', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.fetchListings);
api.get('/employer/account/orders', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.fetchOrders);
api.get('/employer/account/saved-cards', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.fetchCards);
api.get('/employer/account/saved-cards/delete', auth.jwtcheck, tokenauth.get.employer, auth.isEmployer, employers.deleteCard);

api.get('/employer/account/export-application/email', auth.jwtcheck, tokenauth.get.employer, notifications.sendExportedApplication);
api.get('/employer/account/export-applications/email', auth.jwtcheck, tokenauth.get.employer, notifications.sendExportedApplications);
api.get('/employer/resend-verification', auth.jwtcheck, tokenauth.get.employer, employers.resendVerification);

api.get('/account/change-password', tokenauth.get.guest, users.changePassword);
api.get('/account/recovery/:recovery', tokenauth.get.guest, users.recoverPassword);

//login server
api.post('/login', tokenauth.post.guest, login.checkemp, login.checkusr);
api.get('/ie/login', tokenauth.get.guest, transformreq, login.checkemp, login.checkusr);//IE SUPPORT <10 

//search server
api.get('/search', tokenauth.get.guest, searchdb.process, searchdb.sendResults);
api.get('/autocomplete', tokenauth.get.guest, searchdb.autocomplete, searchdb.sendResults);


//administration
api.get('/admin/login', tokenauth.get.guest, administration.login);
api.get('/admin/add-user', tokenauth.get.admin, administration.checkExistingEmail, administration.createNewUser, notifications.sendNewAdminUser);
api.get('/admin/edit-user', tokenauth.get.admin, administration.editAdminUser);
api.get('/admin/delete-admin-user', tokenauth.get.admin, administration.deleteAdminUser);
api.get('/admin/fetch-administration-users', tokenauth.get.admin, administration.fetchAdminUsers);
api.get('/admin/analytics/quick', tokenauth.get.admin, analytics.countResumes, analytics.countExpirations, analytics.countOrdersToday, analytics.sendQuick);
api.get('/admin/analytics/orders', tokenauth.get.admin, analytics.fetchOrderData);
api.get('/admin/analytics/full', tokenauth.get.admin, analytics.countResumes, analytics.countOrdersToday, analytics.countOrders, analytics.countEmployers, analytics.countActiveEmployers, analytics.countUsers, analytics.countListings, analytics.countApplications, analytics.sendFull);
api.get('/admin/analytics/advanced', tokenauth.get.admin, analytics.getDS, analytics.getCSemployers, analytics.getCSemployerusers, analytics.getCSjobs, analytics.getCSresumes, analytics.getCSusers, analytics.getCSorders, analytics.sendAdvanced);
api.get('/admin/fetch-appdata', tokenauth.get.admin, administration.fetchAppdata);// Test Covered
api.get('/admin/fetch-announcements', tokenauth.get.admin, administration.fetchAnnouncements);
api.get('/admin/create-announcement', tokenauth.get.admin, administration.createAnnouncement);
api.get('/admin/remove-announcement', tokenauth.get.admin, administration.removeAnnouncement);
api.get('/admin/fetch-content', tokenauth.get.admin, administration.fetchContent);
api.get('/admin/fetch-orders', tokenauth.get.admin, administration.fetchOrders);
api.get('/admin/fetch-listings', tokenauth.get.admin, administration.fetchListings);
api.get('/admin/change-listing-status', tokenauth.get.admin, administration.setListingStatus, notifications.listingStatusChange);
api.get('/admin/fetch-resumes', tokenauth.get.admin, administration.fetchResumes, administration.appendUser, administration.sendResults);
api.get('/admin/fetch-employers', tokenauth.get.admin, administration.fetchEmployers, administration.appendAccount, administration.sendResults);
api.get('/admin/delete-employer', tokenauth.get.admin, administration.deleteEmployerListing, administration.deleteEmployerAccount, notifications.deletedEmployer);
api.get('/admin/fetch-users', tokenauth.get.admin, administration.fetchUsers);
api.get('/admin/delete-user', tokenauth.get.admin, administration.deleteUserAccount, administration.deleteUserResume);
api.get('/admin/update-content', tokenauth.get.admin, administration.updateContent);// Test Covered
api.get('/admin/add-image-to-rotation', tokenauth.get.admin, administration.addImageToRotation);
api.get('/admin/remove-image-from-rotation', tokenauth.get.admin, administration.removeImageFromRotation);

api.get('/admin/feeds/register', tokenauth.get.admin, administration.registerFeed);
api.get('/admin/feeds', tokenauth.get.admin, administration.fetchFeeds);
api.get('/admin/feeds/remove', tokenauth.get.admin, administration.removeFeed);

api.get('/admin/activate', tokenauth.get.guest, administration.activateAccount);

//Load Test Verfication
api.get('/loaderio-0e9d2a52cecd9630bef3ccc93d4f120a/', function (req, res) {
	var body = 'loaderio-0e9d2a52cecd9630bef3ccc93d4f120a';
	res.setHeader('Content-Type', 'text/plain');
	res.setHeader('Content-Length', Buffer.byteLength(body));
	res.end(body);
});

api.get('/simply-hired-xml/jobs.xml', feedbuilder.fetchAllJobs, feedbuilder.mapSimplyHiredFeed, feedbuilder.buildFeed, function (req, res) {
	var body = req.xml;
	res.setHeader('Content-Type', 'text/xml;charset=utf-8;');
	res.setHeader('Content-Length', Buffer.byteLength(body));
	res.end(body);
});

api.get('/indeed-xml/jobs.xml', feedbuilder.fetchAllJobs, feedbuilder.mapIndeedFeed, feedbuilder.buildFeed, function (req, res) {
	var body = req.xml;
	res.setHeader('Content-Type', 'text/xml;charset=utf-8;');
	res.setHeader('Content-Length', Buffer.byteLength(body));
	res.end(body);
});

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
END Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */
exports.starthttps = function (port) {
	return https.createServer({
		key: privateKey,
		cert: certificate,
		ca: chain
	}, api).listen(port, function () {
		console.log('Jupiter Secure API Listening on Port', port, '...');
	});
}

exports.starthttp = function (port) {
	return http.createServer(api).listen(port, function () {
		console.log('Jupiter API Listening on Port', port, '...');
	});
}

exports.app = api;