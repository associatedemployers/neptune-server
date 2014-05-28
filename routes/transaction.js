// Transaction Route
console.log("STARTUP: Loaded transaction route.");

var mongo = require('mongodb'),
	braintree = require('braintree'),
	nodemailer = require('nodemailer'),
	mailtemplate = require('.././config/mail.templates'),
	token = require('.././config/tokens');
	
var exception = {
	'1001': "API ERROR 1001: Failed To Open DB."
}

var gateway = braintree.connect({
	environment: braintree.Environment.Production,
	merchantId: token.braintree.merchantId,
	publicKey: token.braintree.publicKey,
	privateKey: token.braintree.privateKey
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
	if(order.savedCard && order.savedCard !== false && order.savedCard !== "false" && parseFloat(order.total) > 0) {
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
	} else if(order.card.save && parseFloat(order.total) > 0) {
		saleObject = {
			amount: order.total,
			customer: {
				firstName: order.billing.name.first,
				lastName: order.billing.name.last,
				email: order.email
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
	} else if(parseFloat(order.total) > 0) {
		saleObject = {
			amount: order.total,
			customer: {
				firstName: order.billing.name.first,
				lastName: order.billing.name.last,
				email: order.email
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
	if(parseFloat(order.total) > 0) {
		gateway.transaction.sale(saleObject, function(err, result) {
			if(err) {
				res.json({
					status: "in error",
					error: err
				});
				throw JSON.stringify(err);
			}
			if(result && result.success) {
				req.transactionResult = result;
				var template;
				if(order.type == "listing") {
					template = mailtemplate.newListing(order.billing.name, result.transaction.id, order.total);
				} else if(order.type == "resumes") {
					template = mailtemplate.resumeAccess(order.billing.name, result.transaction.id, order.total);
				} else if(order.type == "featured_account") {
					template = mailtemplate.featuredAccount(order.billing.name, result.transaction.id, order.total);
				} else if(order.type == "screening_service") {
					template = mailtemplate.screeningService(order.billing.name, result.transaction.id, order.total);
				}
				var transport = nodemailer.createTransport("sendmail");
				transport.sendMail({
					from: "Job Jupiter <no-reply@jobjupiter.com>",
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
					status: "in error",
					error: result.message
				});
			}
		});
	} else {
		var template;
		if(order.type == "listing") {
			template = mailtemplate.newListing(order.billing.name, "Free", order.total);
		} else if(order.type == "resumes") {
			template = mailtemplate.resumeAccess(order.billing.name, "Free", order.total);
		} else if(order.type == "featured_account") {
			template = mailtemplate.featuredAccount(order.billing.name, "Free", order.total);
		} else if(order.type == "screening_service") {
			template = mailtemplate.screeningService(order.billing.name, "Free", order.total);
		}
		var transport = nodemailer.createTransport("sendmail");
		transport.sendMail({
			from: "Job Jupiter <no-reply@jobjupiter.com>",
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
	}
}

exports.storeOrder = function(req, res, next) {
	var order = req.query.order;
	order.orderResult = req.transactionResult;
	req.savingCard = order.card.save;
	delete order.card;
	if(parseFloat(order.total) > 0) delete order.orderResult.transaction.shipping;
	db.collection('orders', function(err, collection) {
		collection.insert(order, {safe:true}, function(err, result) {
			if(err) {
				console.error(err);
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

exports.oneTime = function(req, res, next) {
	var couponCode = req.query.order.coupon,
		emp_id = req.query.order.employer_id;
	if(!couponCode || !req.query.order.coupon_onetime) return next();
	db.collection('content', function(err, collection) {
		collection.findAndModify({'page': 'coupons',  'content': { $elemMatch: { 'code': couponCode } } }, [], { $push: { 'content.$.used': emp_id } }, { remove: false, new: true }, function(err, result) {
			if(err) {
				console.error(err);
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
	if(req.savingCard && parseFloat(order.total) > 0) {
		db.collection('employerusers', function(err, collection) {	
			collection.update( { '_id': new BSON.ObjectID(order.employer_id) }, { $addToSet: { 'stored_cards': { 'token': req.transactionResult.transaction.creditCard.token, 'masked_number': req.transactionResult.transaction.creditCard.maskedNumber } } }, function(err, result) {
				if(order.type !== "listing") {
					next();
				} else {
					res.send({
						'status': "processed"
					});
				}
			});
		});
	} else {
		if(order.type !== "listing") {
			next();
		} else {
			res.send({
				'status': "processed"
			});
		}
	}
}

exports.validateCoupon = function(req, res, next) {
	var couponCode = req.query.code.toLowerCase(),
		emp_id = req.query.employer_id,
		product = req.query.product,
		sc;
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
					if(coupon.code.toLowerCase() == couponCode) {
						if(coupon.product == product) {
							if(coupon.one_time == "true") {
								var x = false;
								if(coupon.used) {
									coupon.used.forEach(function(emp) {
										if(emp == emp_id) return x = true;
									});
								}
								if(x) return;
							}
							if(coupon.expiration == "never") {
								sc = coupon;
							} else {
								var dst = coupon.expiration.split(' ').shift().split('/');
								var date = new Date(dst[0], (dst[1] - 1), dst[2]).getTime();
								var now = new Date().getTime();
								if(date > now) {
									sc = coupon;
								}
							}
						}
					}
				});
				if(sc) {
					delete sc.used;
					res.send({
						status: 'ok',
						coupon: sc
					});
				} else {
					res.send({
						status: 'in error',
						error: 'No coupon found with that code.'
					});
				}
			}
		});
	});
}