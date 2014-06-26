console.log("STARTUP: Loaded compare route");
var mongo = require('mongodb'),
	http = require('follow-redirects').http,
	moment = require('moment');

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;

var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on compare route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.process = function (req, res, next) {
	var locations = [],
		raw = [];
	req.results = [];
	if(!req.query.process_number) return res.json([]);
	db.collection('jobs', function (err, collection) {
		collection.find({'fed_from': { $exists: false } }).toArray(function (err, results) {
			if(err) {
				console.error(err);
			}
			console.log("looping through results->");
			results.forEach(function (result) {
				console.log("  ->In Result");
				var loc = result.location.city.toLowerCase() + "%2C+" + result.location.state.toLowerCase(), needsCreation = true, index;
				locations.forEach(function (obj) {
					if(loc == obj.location) {
						needsCreation = false;
					} else {
						index = locations.indexOf(obj);
					}
				});
				if(needsCreation) {
					locations.push({
						location: loc,
						listings: []
					});
					index = locations.length - 1;
				}
				console.log("  ->Location is", loc);
				console.log("  ->Pushing result");
				locations[index].listings.push(result);
			});
			var locationslen = locations.length,
				locationsProcessed = 1;
			console.log("locations to process", locationslen);
			if(locationslen < 1) return console.log('no results to process');
			locations.forEach(function (obj) {
				console.log("fulfilling location");
				var url = "http://api.indeed.com/ads/apisearch?publisher=1194789839977044&format=json&v=2&highlight=0&useragent=JupiterAPI&sort=date&latlong=1&fromage=30&co=us&l=" + obj.location + "&radius=50&limit=25";
				var page = 1, request, endpoints = [], toGet = parseFloat(req.query.process_number) / 25;
				endpoints.push(url);
				for (var i = 0; i < toGet; i++) {
					endpoints.push(url + "&start=" + (page * 25));
					page++;
				}
				var requestsFulfilled = 0, requestsToFulfill = endpoints.length;
				console.log("Requests to fill", requestsToFulfill);
				endpoints.forEach(function (endpoint) {
					console.log("fulfilling endpoint");
					return request = http.get(endpoint, function (response) {
						var buffer = "", ndata;
						response.on("data", function (chunk) {
							buffer += chunk;
						});
						response.on("end", function (err) {
							var ndata = JSON.parse(buffer);
							if(!ndata.results) throw new Error("no results, got buffer: " + buffer);
							console.log("got result");
							req.results = req.results.concat(ndata.results);
							if(requestsFulfilled < 1) {
								requestsFulfilled = 1;
							} else {
								requestsFulfilled++;
							}
							//console.log(requestsFulfilled, "/", requestsToFulfill);
							if(requestsFulfilled == requestsToFulfill) {
								console.log("Locations:", locationsProcessed, "/", locationslen);
								locationsProcessed++;
								console.log("Completed all requests on this location");
								if(locationsProcessed == locationslen) {
									console.log("completed all locations");
									req.locations = locations;
									next();
								}
							}
							console.log("locations processed", locationsProcessed);
						});
					}).on('error', function(e) {
						throw new Error(e.message);
					});
				});
				console.log('end endpoint processor');
			});
			console.log("end");
		});
	});	
}

exports.generate = function (req, res, next) {
	var returnObject = {
		total: {
			matches: 0,
			jobs: 0,
			processed: ( parseFloat(req.query.process_number) * 25 ) * req.locations.length
		},
		matches: [],
		unmatched: []
	};
	req.locations.forEach(function (obj) {
		obj.listings.forEach(function (listing) {
			var matched, indeedMatches = [], checkedListings = 0;
			returnObject.total.jobs++;
			req.results.forEach(function (indeed_listing) {
				indeed_listing.matched_company = indeed_listing.company.toLowerCase().trim() == listing.name.company.toLowerCase().trim();
				indeed_listing.matched_title = indeed_listing.jobtitle.toLowerCase().trim() == listing.display.title.toLowerCase().trim();
				if(indeed_listing.matched_company || indeed_listing.matched_title) {
					matched = true;
					indeedMatches.push(indeed_listing);
				}
				checkedListings++;
			});
			listing.total_checked = checkedListings;
			listing.total_matched = indeedMatches.length;
			if(matched) {
				returnObject.total.matches++;
				listing.indeed_matches = indeedMatches;
				returnObject.matches.push(listing);
			} else {
				returnObject.unmatched.push(listing);
			}
		});
	});
	res.json(returnObject);
}