var assert = require('chai').should(),
	request = require('superagent'),
	testconfig = require('.././config/test-config'),
	tokens = require('.././config/tokens'),
	colors = require('colors');

var u = testconfig.api,
	silentFail, failedTests = 0;

describe('Job routes', function () {
	describe('fetch operations', function () {
		describe('for all jobs', function () {
			var jr = u + "/jobs";
			it('should return an array with length matching limit', function (done) {
				request
					.get(jr)
					.query({ token: tokens.guest, limit: 25, sort: {'time_stamp': -1} })
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						var results = res.body;
						results.should.be.an('array');
						results.should.have.length.below(26);
						if(results.length < 1) {
							console.log('        Silently failing these tests! No jobs to use.'.red);
							silentFail = true;
						}
						checkState();
						done();
					});
			});
			it('should return an array with length of no more than 100 if no limit is specified', function (done) {
				request
					.get(jr)
					.query({ token: tokens.guest, sort: {'time_stamp': -1} })
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						var results = res.body;
						results.should.be.an('array');
						results.should.have.length.below(101);
						done();
					});
			});
			it("shouldn't return duplicates", function (done) {
				if(checkState()) return done();
				request// get the first set of results
					.get(jr)
					.query({ token: tokens.guest, sort: {'time_stamp': -1} })
					.end(function (err, res) {// validate the first set
						if(err) throw err;
						res.ok.should.equal(true);
						var results_setone = res.body;
						results_setone.should.be.an('array');
						results_setone.should.have.length.below(101);
						request// get the second set of results
							.get(jr)
							.query({ token: tokens.guest, sort: {'time_stamp': -1}, page: 2 })
							.end(function (err, res) {
								if(err) throw err;
								res.ok.should.equal(true);
								var results_settwo = res.body;
								results_settwo.should.be.an('array');
								results_settwo.should.have.length.below(101);
								var result_list = [], count = 0;
								results_setone.forEach(function (item) {
									result_list[item._id] = item._id;
								});
								results_settwo.forEach(function (item) {
									result_list[item._id] = item._id;
								});
								for(var k in result_list) {
									if(result_list[k] == k) count++;
								}
								count.should.equal(results_settwo.length + results_setone.length);
								done();
							});
					});
			});
			it('should be optimized to omit pointless fields', function (done) {
				if(checkState()) return done();
				request
					.get(jr)
					.query({ token: tokens.guest, sort: {'time_stamp': -1}, page: 1 })// check a hundred results for the pointless fields
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						res.body.forEach(function (job) {
							var desc = job.display.description;
							desc.should.not.have.property('long');
							desc.should.not.have.property('about');
							job.should.not.have.property('alternate_url');
							job.should.not.have.property('applicants');
							job.should.not.have.property('screening');
						});
						done();
					});
			});
		});
		describe('for single job', function () {
			var jsr = u + "/jobs";
			it('should return the proper job for a given id', function (done) {
				if(checkState()) return done();
				request
					.get(jsr)
					.query({ token: tokens.guest, sort: {'time_stamp': -1}, limit: 1, page: 1 })// get a job to test with
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);

						var id = res.body[0]._id;
						jsr += '/' + id;
						
						request
							.get(jsr)
							.query({ token: tokens.guest })
							.end(function (err, res) {
								if(err) throw err;
								res.ok.should.equal(true);
								res.body.should.be.an('object');
								res.body.should.have.property('_id').and.equal(id);
								done();
							});
					});
			});
			it('should not include certain fields', function (done) {
				if(checkState()) return done();
				request
					.get(jsr)
					.query({ token: tokens.guest })
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						var job = res.body;
						job.should.not.have.property('applicants');
						job.should.not.have.property('screening');
						done();
					});
			});
			it('should return a 404 with an improper ID', function (done) {
				if(checkState()) return done();
				request
					.get(u + '/jobs/' + 'notabsonid')
					.query({ token: tokens.guest })
					.end(function (err, res) {
						if(err) throw err;
						res.status.should.equal(404);
						done();
					});
			});
			it('should return a 404 with a proper ID, but no job found', function (done) {
				if(checkState()) return done();
				request
					.get(u + '/jobs/' + '123456789123456789123456')
					.query({ token: tokens.guest })
					.end(function (err, res) {
						if(err) throw err;
						res.status.should.equal(404);
						done();
					});
			});
		});
		describe('for featured jobs', function () {
			it('should return a proper amount of random featured', function (done) {
				if(checkState()) return done();
				request
					.get(u + '/random-featured/jobs/5')
					.query({ token: tokens.guest })
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						res.body.should.be.an('array');
						res.body.should.have.length.below(6);
						done();
					});
			});
			it('should return a proper, optimized list of featured jobs', function (done) {
				if(checkState()) return done();
				request
					.get(u + '/featured/jobs')
					.query({ token: tokens.guest })
					.end(function (err, res) {
						if(err) throw err;
						res.ok.should.equal(true);
						res.body.should.be.an('array');
						var job = res.body[0];
						job.should.not.have.property('applicants');
						job.should.have.property('display').and.have.property('description').and.not.have.property('long');
						done();
					});
			});
		});
	});
});

function checkState () {
	if(silentFail) {
		failedTests++;
		console.log('        ' + failedTests + ' test(s) silently failed.'.red);
		return true;
	}
	return false;
}