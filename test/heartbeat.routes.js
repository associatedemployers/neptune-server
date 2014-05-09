var assert = require('chai').should(),
	request = require('superagent'),
	testconfig = require('.././config/test-config'),
	tokens = require('.././config/tokens');

var u = testconfig.api;

describe('Heartbeat Routes', function () {
	describe('Maintenance', function () {
		it('should return an object', function (done) {
			request
				.get(u + '/fetch-page-content')
				.query({ token: tokens.guest, page: 'maintenance' })
				.end(function (err, res) {
					if(err) throw err;
					res.status.should.equal(200);
					res.body.should.be.an('object');
					done();
				});
		});
	});
	describe('Admin Appdata', function () {
		it('should return an object', function (done) {
			request
				.get(u + '/admin/fetch-appdata')
				.query({ token: tokens.admin })
				.end(function (err, res) {
					if(err) throw err;
					res.status.should.equal(200);
					res.body.should.be.an('object');
					done();
				});
		});
	});
});