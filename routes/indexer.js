// Indexing Engine
console.log("STARTUP: Loaded indexer.");

var mongo = require('mongodb'),
	fs = require('fs'),
	textract = require('textract');

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
        console.log("STARTUP: Connected to database on indexer.");
    } else {
		console.log(exception['1001']);
	}
});

exports.indexFile = function (req, res, next) {
	console.log(JSON.stringify(req.body));
	var path = req.body.path,
		ext = req.body.extension,
		ext = ext.toString().toLowerCase();
	if(ext == "pdf" || ext == "doc" || ext == "docx" || ext == "rtf" || ext == "txt") {
		if(ext == "rtf") {
			textract("application/msword", path, function(err, text) {
				console.log(err);
				console.log(text);
				res.send(text);
			});
		} else {
			textract(path, function(err, text) {
				console.log(err);
				console.log(text);
				res.send(text);
			});
		}
	} else {
		res.send("File type not supported.");
	}
}