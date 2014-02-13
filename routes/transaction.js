// Employers Route
console.log("STARTUP: Loaded transaction route.");

var mongo = require('mongodb'),
	braintree = require('braintree'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates');
	
var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var gateway = braintree.connect({
	environment: braintree.Environment.Sandbox,
	merchantId: "cygg57x8jkn35nwd",
	publicKey: "ngppkqdxpd77j2zk",
	privateKey: "f161459c37c5e3f634b3cf4aa9779d75"
});

var Server = mongo.Server,
    Db = mongo.Db,
    BSON = mongo.BSONPure;
 
var server = new Server('localhost', 27017, {auto_reconnect: true});
db = new Db('ae', server, {safe: true}, {strict: false});

db.open(function(err, db) {
    if(!err) {
        console.log("STARTUP: Connected to database on transaction route.");
    } else {
		console.log(exception['1001']);
	}
});

exports.process = function(req, res, next) {
	var order = req.query.order;
	var saleObject;
	if(order.savedCard) {
		saleObject = {
			amount: order.total,
			paymentMethodToken: order.savedCard,
			creditCard: {
				cvv: order.card.cvv
			},
			options: {
				submitForSettlement: true
			}
		}
	} else if(order.card.save) {
		saleObject = {
			amount: order.total,
			customer: {
				firstName: order.billing.name.first,
				lastName: order.billing.name.last
			},
			creditCard: {
				number: order.card.number,
				cvv: order.card.cvv,
				expirationMonth: order.card.expiration.month,
				expirationYear: order.card.expiration.year	
			},
			billing: {
				streetAddress: order.billing.address.line1,
				locality: order.billing.address.city,
				region: order.billing.address.state,
				postalCode: order.billing.address.zip
			},
			options: {
				submitForSettlement: true,
				storeInVaultOnSuccess: true
			}
		}
	} else {
		saleObject = {
			amount: order.total,
			customer: {
				firstName: order.billing.name.first,
				lastName: order.billing.name.last
			},
			creditCard: {
				number: order.card.number,
				cvv: order.card.cvv,
				expirationMonth: order.card.expiration.month,
				expirationYear: order.card.expiration.year	
			},
			billing: {
				streetAddress: order.billing.address.line1,
				locality: order.billing.address.city,
				region: order.billing.address.state,
				postalCode: order.billing.address.zip
			},
			options: {
				submitForSettlement: true
			}
		}
	}
	gateway.transaction.sale(saleObject, function(err, result) {
		if(result.success) {
			req.transactionResult = result;
			if(order.type == "listing") {
				var transport = nodemailer.createTransport("sendmail");
				var template = mailtemplate.newListing(order.billing.name, result.transaction.id, order.total);
				transport.sendMail({
					from: "no-reply@aejobs.org",
					to: order.email,
					subject: "Thanks for your order, " + order.billing.name.company,
					text: template.plain,
					html: template.html
				}, function(error, response){
					if(error){
						console.log(error);
					}
					transport.close(); // shut down the connection pool, no more messages
				});
			}	
			next();
		} else {
			res.json({
				'status': "in error",
				'error': result.message
			});
		}
	});
}

exports.storeOrder = function(req, res, next) {
	var order = req.query.order;
	order.orderResult = req.transactionResult;
	db.collection('orders', function(err, collection) {	
		collection.insert(order, {safe:true}, function(err, result) {
			if(err) {
				res.send({
					'status': "in error",
					'error': err
				});
			} else {
				next();
			}
		});
	});
}

exports.storeCard = function(req, res) {
	var order = req.query.order;
	if(order.card.save) {
		db.collection('employerusers', function(err, collection) {	
			collection.update( { '_id': new BSON.ObjectID(order.employer_id) }, { $addToSet: { 'stored_cards': { 'token': req.transactionResult.transaction.creditCard.token, 'masked_number': req.transactionResult.transaction.creditCard.maskedNumber } } }, function(err, result) {
				res.send({
					'status': "processed"
				});
			});
		});
	} else {
		res.send({
			'status': "processed"
		});
	}
}