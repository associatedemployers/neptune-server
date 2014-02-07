// Indexing Engine
console.log("STARTUP: Loaded indexer.");

var mongo = require('mongodb'),
	fs = require('fs'),
	textract = require('textract'),
	http = require('follow-redirects').http;

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
	var resm = req.body.account_data.resume;	
	if(resm) {
		var path = req.body.account_data.resume.path,
			path = path.replace("../../", "http://www.aejobs.org:80/dev/"),
			filename = path.split("/").pop(),
			ext = req.body.account_data.resume.extension,
			ext = ext.toString().toLowerCase();
	}
	http.get(path, function (fileresponse) {
		if (fileresponse.statusCode === 200) {
			fileresponse.pipe(fs.createWriteStream(__dirname + '/../tmp_indexing/' + filename));
			fileresponse.on('end', function() {
				path = __dirname + '/../tmp_indexing/' + filename;
				if(ext == "pdf" || ext == "doc" || ext == "docx" || ext == "rtf" || ext == "txt") {
					if(ext == "rtf") {
						textract("application/msword", path, function(err, text) {
							if(err) {
								console.log(err);
								req.indexed = false;
								req.extractedText = "Error: " + err;
							} else {
								req.indexed = true;
								req.extractedText = text;
							}
							fs.unlink(path);
							next();
						});
					} else {
						textract(path, function(err, text) {
							if(err) {
								console.log(err);
								req.indexed = false;
								req.extractedText = "Error: " + err;
							} else {
								req.indexed = true;
								req.extractedText = text;
							}
							fs.unlink(path);
							next();
						});
					}
				} else {
					req.indexed = false;
					req.extractedText = "Error: User resume file type not supported. (." + ext + ")";
					fs.unlink(path);
					next();
				}
			});
		} else {
			console.error('The address is unavailable. (%d)', fileresponse.statusCode);
			req.indexed = false;
			req.extractedText = "Error: " + fileresponse.statusCode;
		}
	});
		
}

exports.saveResume = function (req, res, next) {
	db.collection('resumes', function(err, collection) {
		collection.insert({ 'user_id': req.body.userid, 'indexed': req.indexed, 'extracted_text': req.extractedText }, function(err, result) {
			if(err) {
				console.log("Fatal Error on 'saveToUser': " + err);
			}
		});
	});
}