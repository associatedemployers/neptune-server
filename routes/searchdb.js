// searchdb route

console.log("STARTUP: Loaded searchdb route.");

var mongo = require('mongodb');

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
	query = req.query.search_query,
	sarray = query.split(" "); //split the keywords
	
	db.collection('jobs', function(err, collection) { //connect to jobs collection
		collection.find().toArray(function(err, items) { //press all jobs into an array
			var results = [];
			items.forEach(function(item) { //iterate over the items array
				delete item['_id'];
				var s = JSON.stringify(item).toLowerCase(); //convert each item in items to a string
				var matched = true;
				sarray.forEach(function(qs) { //take the toArray converted query and iterate over it
					if(s.search(qs.toLowerCase()) < 0) { //if regex finds the keyword in the item string,
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

exports.sendResults = function(req, res) {
	res.json(req.results);	
}