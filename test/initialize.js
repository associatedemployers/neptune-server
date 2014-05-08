var assert = require('chai').should(),
	request = require('superagent'),
	testconfig = require('.././config/test-config'),
	tokens = require('.././config/tokens');

var u = testconfig.api;

var maintenanceMode = {
	content: {},
	page: "maintenance"
};

before(function (done) {
	maintenanceMode.content.status = "true";
	setMaintenanceMode(done);
});

after(function (done) {
	maintenanceMode.content.status = "false";// overwrite this so we can set it in the function
	setMaintenanceMode(done);
});

function setMaintenanceMode (done) {// get the done callback so we can exit after we actually set the mode
	request
		.get(u + '/admin/update-content')
		.query({ token: tokens.admin, perms: { edit: { content: true } }, update: maintenanceMode })
		.end(function (err, res) {
			if(err) throw err;
			done();
		});
}