// Custom XML Feed Builder
console.log("STARTUP: Loaded jobs route.");

var mongo = require('mongodb'),
	moment = require('moment'),
	builder = require('xmlbuilder');

var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(err) {
		console.log(exception['1001']);
    }
});

exports.fetchAllJobs = function (req, res, next) {
	db.collection('jobs', function (err, collection) {
		collection.find({'active': true, 'fed_from': { $exists: false }, developer: { $exists: false } }).sort({ 'time_stamp': -1 }).toArray(function (err, results) {
			if(err) {
				console.error(err);
				res.status(500).send("Error: " + err);
			} else {
				req.jobs = results;
				if(results.length > 0) {
					next();
				} else {
					res.send('No Jobs Available.');
				}
			}
		});
	});
}

exports.mapSimplyHiredFeed = function (req, res, next) {
	var jobs = req.jobs;
	if(!jobs) {
		req.xml = "";
		return next();
	}
	var xml_object = {};
	xml_object.jobs = [];
	//Get ready for some data mapping
	jobs.forEach(function(job) {
		var xml_job = {
			job: {
				title: job.display.title,
				'job-board-name': "Job Jupiter",
				'job-board-url': "http://www.jobjupiter.com",
				'job-code': job._id.toString(),
				'detail-url': "http://www.jobjupiter.com/#!/job/" + job._id.toString(),
				'apply-url': "http://www.jobjupiter.com/#!/job/" + job._id.toString() + "/apply",
				'job-category': job.display.category,
				description: {
					summary: { '#cdata': job.display.description.long.toString() },
					'full-time': (job.display.type == "Full-Time") ? 1 : "",
					'part-time': (job.display.type == "Part-Time") ? 1 : "",
					temporary: (job.display.type == "Temporary") ? 1 : "",
				},
				compensation: {
					'salary-amount': (job.display.compensation.amount) ? "$" + job.display.compensation.amount + "/" + job.display.compensation.type : "",
					benefits: (job.display.benefits) ? job.display.benefits : ""
				},
				'posted-date': moment(job.time_stamp, "YYYY/MM/DD HH:mm:ss").format("YYYY/MM/DD"),
				'close-date': moment(job.time_stamp, "YYYY/MM/DD HH:mm:ss").add("days", 30).format("YYYY/MM/DD"),
				location: {
					city: job.location.city,
					state: job.location.state,
					country: "US"
				},
				company: {
					name: job.name.company,
					description: job.display.description.about
				}
			}
		};
		xml_object.jobs.push(xml_job);
	});
	req.preparse_xml = xml_object;
	next();
}

exports.mapIndeedFeed = function (req, res, next) {
	var jobs = req.jobs;
	if(!jobs) {
		req.xml = "";
		return next();
	}
	var xml_object = {
		source: {
			publisher: "Job Jupiter",
			publisherurl: "http://www.jobjupiter.com",
			lastBuildDate: moment().format("ddd, DD MMM YYYY HH:mm:ss zz"),
			jobs: []
		}
	};
	//Get ready for some data mapping
	jobs.forEach(function(job) {
		var xml_job = {
			job: {
				title: { '#cdata': job.display.title },
				date: { '#cdata': moment(job.time_stamp, "YYYY/MM/DD HH:mm:ss").format("ddd, DD MMM YYYY HH:mm:ss zz") },
				referencenumber: { '#cdata': job._id.toString() },
				url: { '#cdata': "http://www.jobjupiter.com/#!/job/" + job._id.toString() },
				company: { '#cdata': job.name.company || '' },
				city: { '#cdata': job.location.city || '' },
				state: { '#cdata': job.location.state || '' },
				country: { '#cdata': "US" },
				description: { '#cdata': job.display.description.long.toString() },
				salary: { '#cdata': (job.display.compensation.amount) ? "$" + job.display.compensation.amount + "/" + job.display.compensation.type : "" },
				jobtype: { '#cdata': job.display.type.toLowerCase().replace('-', '') },
				category: { '#cdata': job.display.category || '' }
			}
		};
		xml_object.source.jobs.push(xml_job);
	});
	req.preparse_xml = xml_object;
	next();
}

exports.buildFeed = function (req, res, next) {
	var root = builder.create(req.preparse_xml, {version: '1.0', encoding: 'UTF-8', standalone: true, "last-updated": moment().format("YYYY/MM/DD HH:mm:ss")});
	req.xml = root.end({ pretty: true, indent: '    ', newline: '\n' });
	next();
};
