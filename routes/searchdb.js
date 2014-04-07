// searchdb route

console.log("STARTUP: Loaded searchdb route.");

var mongo = require('mongodb'),
	token = require('.././config/tokens');

var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on searchdb route, ready for queries.");
    } else {
		console.log(exception['1001']);
	}
});

exports.process = function(req, res, next) {
	if(!req.query.search_query) { res.json("No Keywords."); return; }
	var results = [],
		query = req.query.search_query.replace(",", " "),
		sarray = query.split(" "); //split the keywords
	sarray = sarray.filter(function(qs) {
		return qs.length > 2
	});
	db.collection('jobs', function(err, collection) { //connect to jobs collection
		collection.find({ active: true }).sort( { time_stamp: -1 } ).toArray(function(err, items) { //press all jobs into an array
			var results = [];
			items.forEach(function(item) { //iterate over the items array
				var s = JSON.stringify(item).toLowerCase(); //convert each item in items to a string
				var matched = true;
				sarray.forEach(function(qs) { //take the toArray converted query and iterate over it
					if(s.search(qs.toLowerCase()) < 0) { //if regex !finds the keyword in the item string,
						matched = false; //set matched to false
					}
				});
				if(matched) {
					results.push(item);	//push the item into the results array
				}
			});
			req.results = results;
			next();
		});
	});
}

exports.resumeSearch = function(req, res, next) {
	if(!req.query.search_query || req.query.search_token !== token.searchToken) {
		res.json([]);
		return;
	}
	var results = [],
		query = req.query.search_query.replace(",", " "),
		sarray = query.split(" ");
	req.resarr = [];
	sarray = sarray.filter(function(qs) {
		return qs.length > 1
	});
	if(sarray.length < 1) {
		res.json([]);
		return;
	}
	db.collection('resumes', function(err, collection) {
		collection.find().sort( { time_stamp: -1 } ).toArray(function(err, items) {
			var results = [];
			if(!items) {
				res.json([]);
				return;
			}
			items.forEach(function(item) {
				var s = JSON.stringify(item).toLowerCase();
				var matched = true;
				sarray.forEach(function(qs) {
					if(s.search(qs.toLowerCase()) < 0) {
						matched = false;
					}
				});
				if(matched) {
					var highlighted = item.extracted_text;
					sarray.forEach(function(qs) {
						highlighted = highlighted.replace(new RegExp("(" + qs + ")", 'gi'), '<span class="highlight">$1</span>');
					});
					highlighted = highlighted.replace(new RegExp('\\n', 'g'), '<br />');
					delete item.extracted_text;
					item.highlighted_text = highlighted;
					req.resarr.push(item);
				}
			});
			if (req.resarr.length > 0) {
				next();
			} else {
				res.json([]);
			}
		});
	});
}

exports.appendUser = function (req, res, next) {
	var resarr = req.resarr;
	req.results = [];
	var counter = 0;
	db.collection('users', function(err, collection) {
		resarr.forEach(function(resume) {
			collection.findOne({ '_id': resume.user_id }, function(err, result) {
				if(err) {
					console.error(err);
					return;
				} else {
					if(result) {
						counter++;
						delete result.login.password;
						resume.user = result;
					} else {
						counter++;
					}
					req.results.push(resume);
					if(counter == resarr.length) {
						next();
					}
				}
			});
		});
	});
}

exports.autocomplete = function(req, res, next) {	
	db.collection('jobs', function(err, collection) {
		collection.find().sort( { time_stamp: -1 } ).toArray(function(err, items) {
			var title_results = [],
				location_results = [],
				company_results = [];
			items.forEach(function(item) {
				if(!item.display) return;
				if(!item.display.title) return;
				title_results.push(item.display.title);
				if(!item.location) return;
				if(!item.location.city || !item.location.state) return;
				location_results.push(item.location.city + ", " + item.location.state);
				if(!item.name) return;
				if(!item.name.company) return;
				company_results.push(item.name.company);
			});
			var results = arrayUnique(title_results.concat(location_results).concat(company_results));
			req.results = results;
			next();
		});
	});
}

exports.sendResults = function(req, res) {
	res.json(req.results);	
}

function arrayUnique(array) {
    var a = array.concat();
    for(var i=0; i<a.length; ++i) {
        for(var j=i+1; j<a.length; ++j) {
            if(a[i] === a[j])
                a.splice(j--, 1);
        }
    }
    return a;
};