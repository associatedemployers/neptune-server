console.log("STARTUP: Loaded feed controller");
var mongo = require('mongodb'),
	http = require('follow-redirects').http,
	cronJob = require('cron').CronJob,
	analytics = require('./analytics'),
	notifications = require('./notifications'),
	moment = require('moment'),
	md5 = require('MD5');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on feedcontroller route.");
    } else {
		console.log(exception['1001']);
	}
});

/*XXXXXXXXXXXXXXXXXXXXX
XXXX cron jobs XXXXXXXX
XXXXXXXXXXXXXXXXXXXXX*/

var feedTask = new cronJob('* * * * *', function(){
	console.log('Started Feed Task');
	feedsController.fetch();
}, null, true);

var feedsController = {
	fetch: function () {
		db.collection('feeds', function (err, collection) {
			collection.find({'system_options.update.auto': "true"}).sort({ 'time_stamp': -1 }).toArray(function (err, feeds) {
				if(err) {
					throw new Error(err);
				} else {
					var t = moment(),
						feedList = [];
					feeds.forEach(function(feed) {
						if(feed.remove) return feedList.push(feed);
						if(feed.last_import) { //CHANGE TO LAST IMPORT
							if(moment(feed.last_import, "YYYY/MM/DD HH:mm:ss").isAfter(moment(t).subtract("d", feed.system_options.update.frequency))) return console.log('**has been updated');
						}
						feedList.push(feed);
					});
					if(feedList.length > 0) {
						feedsController.init(feedList);
					}
				}
			});
		});
	},
	init: function (feeds) {
		console.log("Importing " + feeds.length + " feed(s)...");
		feeds.forEach(function(feed) {
			feedsController.cleandb(feed);
		});
	},
	cleandb: function (feed) {
		if(feed.associated_ids) {
			if(feed.associated_ids.length < 1) {
				if(feed.remove) return feedsController.removeFeed(feed);
				return feedsController.callapi(feed);
			}
		} else {
			return feedsController.callapi(feed);
		}
		var bson_ids = [];
		feed.associated_ids.forEach(function(id) {
			bson_ids.push(new BSON.ObjectID(id.toString()));
		});
		db.collection('jobs', function (err, collection) {
			collection.remove({'_id': { $in: bson_ids }}, function (err, results) {
				if(err) {
					throw new Error(err);
				} else {
					if(feed.remove) {
						feedsController.removeFeed(feed);
					} else {
						feedsController.callapi(feed);
					}
				}
			});
		});
	},
	buildurl: function (feed) {
		var url;
		if(feed.api == "indeed") {
			url = "http://api.indeed.com/ads/apisearch?publisher=1194789839977044&format=json&v=2&highlight=0&useragent=JupiterAPI&sort=date&latlong=1&fromage=30&co=us&l=" + feed.api_options.city + "%2C+" + feed.api_options.state + "&radius=" + feed.api_options.radius + "&limit=" + feed.api_options.limit;
			if(feed.api_options.query) url += "&q=" + feed.api_options.query;
			if(feed.api_options.job_type) url += "&jt=" + feed.api_options.job_type;
		}
		return url;
	},
	callapi: function (feed) {
		var url = feedsController.buildurl(feed);
		var request = http.get(url, function (response) {
			var buffer = "", data;
			response.on("data", function (chunk) {
				buffer += chunk;
			});
			response.on("end", function (err) {
				data = JSON.parse(buffer);
				if(!data.results) throw new Error("no results, got buffer: " + buffer);
				if(parseFloat(feed.api_options.limit) > 25 && data.totalResults > 25) {
					return feedsController.getAdditionalPages(data, feed, url);
				}
				feedsController.checkDuplicates(data, feed, url);
			});
		}).on('error', function(e) {
			throw new Error(e.message);
		});
	},
	getAdditionalPages: function (data, feed, url) {
		var page = 1, request, endpoints = [],
			toGet = (parseFloat(feed.api_options.limit) < data.totalResults) ? Math.ceil(parseFloat(feed.api_options.limit - 25) / 25) : Math.ceil((data.totalResults - 25) / 25);
		for (var i = 0; i < toGet; i++) {
			endpoints.push(url + "&start=" + (page * 25));
			page++;
		}
		var requestsFulfilled = 0, requestsToFulfill = endpoints.length;
		endpoints.forEach(function(endpoint) {
			request = http.get(endpoint, function (response) {
				var buffer = "", ndata;
				response.on("data", function (chunk) {
					buffer += chunk;
				});
				response.on("end", function (err) {
					var ndata = JSON.parse(buffer);
					if(!ndata.results) throw new Error("no results, got buffer: " + buffer);
					data.results = data.results.concat(ndata.results);
					requestsFulfilled++;
					if(requestsFulfilled == requestsToFulfill) feedsController.checkDuplicates(data, feed, url);
				});
			}).on('error', function(e) {
				throw new Error(e.message);
			});
		});
	},
	checkDuplicates: function (data, feed) {
		if(data.results.length > parseFloat(feed.api_options.limit)) {
			data.results = data.results.slice(0, parseFloat(feed.api_options.limit) - 1);
		}
		var keys = [];
		data.results.forEach(function(result) {
			if(result.jobkey) {
				keys.push(result.jobkey);
			}
		});
		db.collection('jobs', function (err, collection) {
			collection.find({ 'feed_key': { $in: keys } }).sort({'time_stamp': -1 }).toArray(function (err, duplicates){
				if(err) {
					throw new Error(err);
				} else {
					if(duplicates.length > 0) {
						var count = 0;
						data.results = data.results.filter(function(result) {
							var notDupe = true;
							duplicates.forEach(function(duplicate) {
								if(duplicate.feed_key == result.jobkey) {
									notDupe = false;
									count++;
								}
							});
							return notDupe;
						});
						if(count > 0) feed.duplicates = count;
					}
					feedsController.mapData(data, feed);
				}
			});
		});
	},
	mapData: function (data, feed) {
		if(feed.api == "indeed") {
			var newResults = [];
			data.results.forEach(function(result) {
				if(result.source == "Job Jupiter" || result.expired) return;
				var date = result.date.split(' ');
				date.pop();
				date = date.join(' ');
				var listing = {
					location: {
						city: result.city,
						state: result.state,
						geo: {
							lat: result.latitude,
							lng: result.longitude
						}
					},
					display: {
						description: {
							short: result.snippet,
							long: result.snippet + '<br /><h3 class="text-center">Click "More Information" to learn more about this job...</h3>',
							about: ""
						},
						title: result.jobtitle,
						picture: 'https://www.gravatar.com/avatar/' + md5(result.jobkey) + '.jpg?s=64&d=identicon',
					},
					name: {
						company: result.company
					},
					alternate_url: result.url,
					featured: "false",
					notification_email: "FromFeed@jobjupiter.com",
					time_stamp: (date) ? moment(date, "ddd, DD MMM YYYY HH:mm:ss").format("YYYY/MM/DD HH:mm:ss") : moment().format("YYYY/MM/DD HH:mm:ss"),
					fed_from: feed.api,
					feed_key: result.jobkey,
					feed_time_stamp: moment().format("YYYY/MM/DD HH:mm:ss"),
					active: true
				};
				newResults.push(listing);
			});
			feedsController.injectResults(newResults, feed);
		} else {
			throw new Error("Feed not supported! API: " + feed.api);
		}
	},
	injectResults: function (data, feed) {
		if(data.length < 1) {
			return feedsController.touchFeed([], feed);
		}
		db.collection('jobs', function (err, collection) {
			collection.insert(data, function(err, injected) {
				if(err) {
					console.error(err);
					throw new Error(err.message);
				} else {
					var associatedids = [];
					injected.forEach(function(doc) {
						associatedids.push(doc._id.toString());
					});
					feedsController.touchFeed(associatedids, feed);
				}
			});
		});
	},
	touchFeed: function (ids, feed) {
		db.collection('feeds', function (err, collection) {
			collection.update({ '_id': new BSON.ObjectID(feed._id.toString()) }, { $set: { 'associated_ids': ids, 'last_import': moment().format("YYYY/MM/DD HH:mm:ss") }, $unset: { 'duplicates': '' } }, function (err, result) {
				if(err) {
					throw new Error(err);
				} else {
					if(feed.duplicates) {
						collection.update({ '_id': new BSON.ObjectID(feed._id.toString()) }, { $set: { 'duplicates': feed.duplicates } }, function (err, result) {
							if(err) {
								throw new Error(err);
							} else {
								console.log("Updated " + feed.name + " with duplicates");
							}
						});
					}
				}
			});
		});
	},
	removeFeed: function (feed) {
		db.collection('feeds', function (err, collection) {
			collection.remove({ '_id': new BSON.ObjectID(feed._id.toString()) }, function (err, result) {
				if(err) {
					throw new Error(err);
				}
			});
		});
	}
} 