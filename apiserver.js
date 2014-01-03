/*

V0.1 (dev)

Main api.aejobs.org apiserver.js
(API SERVER) by AE Development
Node.js, Express.js, MongoDB

Creation Date: 2014/01/03

*/

var express = require('express'),
//route vars
api = express(),
users = require('./routes/users'),
employers = require('./routes/employers'),
jobs = require('./routes/jobs');
//end route vars

/* SSSSSSSSSSSSSSSSSSSSSSSSSS
route controllers
SSSSSSSSSSSSSSSSSSSSSSSSSS */

//jobs
api.get('/jobs', auth.guest, jobs.fetchAll);
api.get('/jobs/:id', auth.guest, jobs.fetchByID);


//users
api.get('/users', auth.admin, jobs.fetchAll);
api.get('/users/:id', auth.admin, jobs.fetchByID);


//employers
api.get('/employers', auth.guest, jobs.fetchAll);
api.get('/employers/:id', auth.guest, jobs.fetchByID);

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
end route controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */


//authorization controller
var auth = {
	admin: function (req, res, next) {
		if (req.token !== token.admin) {
			res.send('Please Send a Token with your request.');
		} else {
			next();
		}
	},
	user: function (req, res, next) {
		if (req.token !== token.user) {
			res.send('Please Send a Token with your request.');
		} else {
			next();
		}
	},
	guest: function (req, res, next) {
		if (req.token !== token.guest) {
			res.send('Please Send a Token with your request.');
		} else {
			next();
		}
	}
}
//end authorization controller object literal


api.listen(3000);
console.log('Jobs API Listening on Port 3000...');