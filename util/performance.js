/* Performance Monitor */

var moment     = require('moment'),
    nodemailer = require('nodemailer'),
    os         = require('os'),
    _          = require('lodash');

module.exports = PerformanceMonitor;

/**
* PerformanceMonitor Constructor
* 
* @options {Object}
* 
* @return self
*/
function PerformanceMonitor ( options ) {
  this.options = options || {};

  return this;
}

/**
* PerformanceMonitor.memory
* 
* @limit      {Number} Limit before alert
* @multiplier {Number} Byte multiplier
* @check      {Number} Milliseconds in between memory checks
* 
* @return interval
*/
PerformanceMonitor.prototype.memory = function ( limit, multiplier, multiplierDescription, check ) {
  var self = this;

  // Defaults
  limit                 = limit                 || 400;
  multiplier            = multiplier            || 1000000;       // MB
  multiplierDescription = multiplierDescription || 'MB';
  check                 = check                 || 1000 * 60 * 5; // 5min

  var limitM = limit * multiplier;

  return setInterval(function () {

    var freeMemory = os.freemem() * multiplier;

    if( !freeMemory ) {
      return console.log('PerformanceMonitor :: Unable to get free memory!');
    }

    // If freeMemory is less than our allowed floor
    if( freeMemory < limitM && self._shouldSendAlert() ) {
      var diff = limitM - freeMemory;
      // Subject
      var s = 'PerformanceMonitor Alert :: Memory below limit';
      // Message
      var m = 'PerformanceMonitor is reporting an operating free memory of ' + 
              freeMemory + multiplierDescription + ' which is ' + diff + 
              multiplierDescription + ' below your limit of ' + limitM + 
              multiplierDescription + '. Report time:' + moment().format('YYYY/MM/DD HH:mm:ss');

      self._sendAlert(s, m, function ( err ) {
        if( err ) {
          console.log( err );
        }

        self.lastSentAlert = new Date();
      });
    }

  }, check);
};

/**
* PerformanceMonitor._sendAlert
* 
* Private
* 
* @subject  {String} Alert subject line
* @msg      {String} Alert body
* @callback {Function}
* 
* @return null
*/
PerformanceMonitor.prototype._sendAlert = function ( subject, msg, callback ) {
  var transport = nodemailer.createTransport("sendmail");

  var mailOptions = {
    from: 'notifications@jobjupiter.com',
    subject: subject,
    text: msg
  };

  mailOptions.to = ( _.isArray( this.options.to ) ) ? this.options.to.join('; ') : this.options.to;

  transport.sendMail(mailOptions, callback);

  if( this.options.integrationHook && typeof this.options.integrationHook === 'function' ) {
    this.options.integrationHook( msg );
  }
};

/**
* PerformanceMonitor._shouldSendAlert
* 
* Private
* 
* @return {Boolean} Alert frequency is not over limit
*/
PerformanceMonitor.prototype._shouldSendAlert = function () {
  var lsam        = moment(this.lastSentAlert),
      currentTime = moment(),
      frequency   = this.options.alertFrequency || '1 hour';

  return ( this.lastSentAlert && lsam.isValid() ) ? currentTime.isAfter( lsam.add( frequency ) ) : true;
};
