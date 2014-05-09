var assert = require('chai').should(),
	request = require('superagent'),
	testconfig = require('.././config/test-config'),
	tokens = require('.././config/tokens');

var u = testconfig.api;

describe('Content Routes', function () {
	var tu = u + '/fetch-page-content';
	describe('Static pages route', function () {	
		it('should return a proper about page', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest, page: 'about' })
				.end(function (err, res) {
					if(err) throw err;
					assertPage(res, done);
			});
		});
		it('should return a proper terms page', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest, page: 'terms' })
				.end(function (err, res) {
					if(err) throw err;
					assertPage(res, done);
			});
		});
		it('should return a proper privacy page', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest, page: 'privacy' })
				.end(function (err, res) {
					if(err) throw err;
					assertPage(res, done);
			});
		});
		it('should return a proper pricing page', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest, page: 'pricing' })
				.end(function (err, res) {
					if(err) throw err;
					var page = res.body;
					res.ok.should.equal(true);
					page.should.be.an('object');
					page.should.have.property('content');
					page.content.should.have.property('members').and.have.property('featured').and.have.property('listing');
					page.content.should.have.property('non_members').and.have.property('featured').and.have.property('listing');
					done();
			});
		});
		it('should return a 404 with no page defined', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest })
				.end(function (err, res) {
					res.status.should.equal(404);
					done();
				});
		});
		it('should return a 404 with an invalid page defined', function (done) {
			request
				.get(tu)
				.query({ token: tokens.guest, page: 'wrongpage' })
				.end(function (err, res) {
					res.status.should.equal(404);
					done();
				});
		});
	});
});

function assertPage (res, done) {
	var page = res.body;
	res.ok.should.equal(true);
	page.should.be.an('object');
	page.should.have.property('content');
	page.content.should.have.property('text');
	page.content.should.have.property('time_stamp');
	page.content.text.should.be.a('string');
	done();
}