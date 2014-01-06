/*******************************

V0.1 (dev)

Main api.aejobs.org apiserver.js
(API SERVER) by AE Development
Node.js, Express.js, MongoDB

Creation Date: 2014/01/03

*******************************/

var express = require('express'),

/* Route Vars */
api = express(),
users = require('./routes/users'),
employers = require('./routes/employers'),
jobs = require('./routes/jobs');
/* END Route Vars */


/* XXXXXXXXXXXXXXXXXXXXXXXXXX
Route Controllers
XXXXXXXXXXXXXXXXXXXXXXXXXX */

//jobs
api.get('/jobs', auth.guest, jobs.fetchAll);
api.get('/jobs/:id', auth.guest, jobs.fetchByID);
api.post('/jobs', auth.employer, jobs.addJob);
api.put('/jobs', auth.employer, employers.updateJob);
api.delete('/jobs', auth.employer, jobs.deleteJob);

//users
api.get('/users', auth.admin, users.fetchAll);
api.get('/users/:id', auth.admin, users.fetchByID);
api.post('/users', auth.guest, users.addUser);
api.put('/users', auth.user, users.updateUser);
api.delete('/users', auth.user, users.deleteUser);


//employers
api.get('/employers', auth.guest, employers.fetchAll);
api.get('/employers/:id', auth.guest, employers.fetchByID);
api.post('/employers', auth.guest, employers.addEmployer);
api.put('/employers', auth.employer, employers.updateEmployer);
api.delete('/employers', auth.employer, jobs.deleteEmployer);

/* XXXXXXXXXXXXXXXXXXXXXXXXXX
END Route Controllers
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
	},
	employer: function (req, res, next) {
		if (req.token !== token.employer) {
			res.send('Please Send a Token with your request.');
		} else {
			next();
		}
	}
}
//end authorization controller object literal


api.listen(3000);
console.log('Jobs API Listening on Port 3000...');