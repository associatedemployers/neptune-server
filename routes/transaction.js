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
	if(order.savedCard && order.savedCard !== false && order.savedCard !== "false") {
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
			var template;
			if(order.type == "listing") {
				template = mailtemplate.newListing(order.billing.name, result.transaction.id, order.total);
			} else if(order.type == "resumes") {
				template = mailtemplate.resumeAccess(order.billing.name, result.transaction.id, order.total);
			} else if(order.type == "featured_account") {
				template = mailtemplate.featuredAccount(order.billing.name, result.transaction.id, order.total);
			}
			var transport = nodemailer.createTransport("sendmail");
			transport.sendMail({
				from: "no-reply@jobjupiter.com",
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
	req.savingCard = order.card.save;
	delete order.card;
	delete order.orderResult.transaction.shipping;
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

exports.storeCard = function(req, res, next) {
	var order = req.query.order;
	if(req.savingCard) {
		db.collection('employerusers', function(err, collection) {	
			collection.update( { '_id': new BSON.ObjectID(order.employer_id) }, { $addToSet: { 'stored_cards': { 'token': req.transactionResult.transaction.creditCard.token, 'masked_number': req.transactionResult.transaction.creditCard.maskedNumber } } }, function(err, result) {
				if(order.type == "resumes") {
					next();
				} else {
					res.send({
						'status': "processed"
					});
				}
			});
		});
	} else {
		if(order.type == "resumes" || order.type == "featured_account") {
			next();
		} else {
			res.send({
				'status': "processed"
			});
		}
	}
}

exports.validateCoupon = function(req, res, next) {
	var couponCode = req.query.code,
		emp_id = req.query.employer_id,
		product = req.query.product,
		sc, c;
	if(!product || !emp_id || !couponCode) {	
		res.send({
			'status': 'in error',
			'error': 'Missing information.'
		});
		return;
	}
	db.collection('content', function(err, collection) {
		collection.findOne({'page': 'coupons'}, function(err, result) {
			if(err) {
				res.send({
					'status': 'in error',
					'error': err
				});
			} else {
				result.content.forEach(function(coupon) {
					if(coupon.code == couponCode) {
						if(coupon.product == product) {
							if(coupon.one_time == true) {
								c = true;
								var x = false;
								coupon.used.forEach(function(emp) {
									if(emp == emp_id) return x = true;
								});
								if(x) return;
							}
							if(coupon.expiration == "never") {
								sc = coupon;
							} else {
								var dst = job.time_stamp.split(' ').shift().split('/');
								var date = new Date(dst[0], (dst[1] - 1), dst[2]).getTime();
								var now = new Date().getTime();
								if(date < now) {
									sc = coupon;
								}
							}
						}
					}
				});
				if(sc) {
					delete sc.used;
					if(c) {
						collection.findAndModify({'page': 'coupons', 'used': { $in: [ emp_id ] } }, [], { $push: { 'used': emp_id } }, { remove: false, new: true }, function(err, result) {
							if(err) {
								console.error(err);
								res.send({
									'status': 'in error',
									'error': err
								});
							} else {
								res.send({
									'status': 'ok',
									'coupon': sc
								});
							}
						});
					} else {
						res.send({
							'status': 'ok',
							'coupon': sc
						});
					}
				} else {
					res.send({
						'status': 'in error',
						'error': 'No coupon found with that code.'
					});
				}
			}
		});
	});
}