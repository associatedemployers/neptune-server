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
		if(resm.path) {
			var path = req.body.account_data.resume.path,
				path = path.replace("../../", "http://www.jobjupiter.com:80/"),
				filename = path.split("/").pop(),
				ext = req.body.account_data.resume.extension,
				ext = ext.toString().toLowerCase();
			http.get(path, function (fileresponse) {
				if (fileresponse.statusCode === 200) {
					fileresponse.pipe(fs.createWriteStream(__dirname + '/../tmp_indexing/' + filename));
					fileresponse.on('end', function() {
						path = __dirname + '/../tmp_indexing/' + filename;
						if(ext == "pdf" || ext == "doc" || ext == "docx" || ext == "rtf" || ext == "txt") {
							if(ext == "rtf") {
								textract("application/msword", path, { 'preserveLineBreaks': true }, function(err, text) {
									if(err) {
										console.error(err);
										req.indexed = false;
										req.extractedText = "Error: " + err;
										if(req.sendReq) {
											res.json({
												'status': 'in error',
												'error': 'indexer err: ' + err
											});
										}
									} else {
										req.indexed = true;
										req.extractedText = text;
										next();
									}
									fs.unlink(path);
								});
							} else {
								textract(path, { 'preserveLineBreaks': true }, function(err, text) {
									if(err) {
										console.error(err);
										req.indexed = false;
										req.extractedText = "Error: " + err;
										if(req.sendReq) {
											res.json({
												'status': 'in error',
												'error': 'indexer err: ' + err
											});
										}
									} else {
										req.indexed = true;
										req.extractedText = text;
										next();
									}
									fs.unlink(path);
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
					if(req.sendReq) {
						res.json({
							'status': 'in error',
							'error': 'indexer err: file not available.'
						});
					}
				}
			});
		}
	}	
}

exports.removeResume = function (req, res, next) {
	db.collection('resumes', function(err, collection) {
		collection.remove({ 'user_id': req.body.userid }, function(err, result) {
			if(err) {
				console.error(err);
			} else {
				if(req.preferences.privacy.index_resume == "true") {
					next();
				} else {
					res.json({
						'status': 'ok'
					});
				}
			}
		});
	});
}

exports.saveResume = function (req, res, next) {
	db.collection('resumes', function(err, collection) {
		collection.insert({ 'user_id': req.body.userid, 'indexed': req.indexed, 'extracted_text': req.extractedText }, function(err, result) {
			if(err) {
				console.error("Fatal Error on 'saveToUser': " + err);
				if(req.sendReq) {
					res.json({
						'status': 'in error',
						'error': 'indexer err: ' + err
					});
				}
			} else {
				if(req.sendReq) {
					res.json({
						'status': 'ok'
					});
				}
			}
		});
	});
}