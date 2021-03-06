'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

var _get = require('lodash/get');

var _get2 = _interopRequireDefault(_get);

var _isFunction = require('lodash/isFunction');

var _isFunction2 = _interopRequireDefault(_isFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /* global window */


// import VisibilityChangeEmitter from './VisibilityChangeEmitter';

var debug = require('debug')('latency-monitor:LatencyMonitor');

/**
 * @typedef {Object} SummaryObject
 * @property {Number} events How many events were called
 * @property {Number} minMS What was the min time for a cb to be called
 * @property {Number} maxMS What was the max time for a cb to be called
 * @property {Number} avgMs What was the average time for a cb to be called
 * @property {Number} lengthMs How long this interval was in ms
 */

/**
 * A class to monitor latency of any async function which works in a browser or node. This works by periodically calling
 * the asyncTestFn and timing how long it takes the callback to be called. It can also periodically emit stats about this.
 * This can be disabled and stats can be pulled via setting dataEmitIntervalMs = 0.
 *
 * The default implementation is an event loop latency monitor. This works by firing periodic events into the event loop
 * and timing how long it takes to get back.
 *
 * @example
 * const monitor = new LatencyMonitor();
 * monitor.on('data', (summary) => console.log('Event Loop Latency: %O', summary));
 *
 * @example
 * const monitor = new LatencyMonitor({latencyCheckIntervalMs: 1000, dataEmitIntervalMs: 60000, asyncTestFn:ping});
 * monitor.on('data', (summary) => console.log('Ping Pong Latency: %O', summary));
 */

var LatencyMonitor = function (_EventEmitter) {
  _inherits(LatencyMonitor, _EventEmitter);

  /**
   * @param {Number} [latencyCheckIntervalMs=500] How often to add a latency check event (ms)
   * @param {Number} [dataEmitIntervalMs=5000] How often to summarize latency check events. null or 0 disables event firing
   * @param {function} [asyncTestFn] What cb-style async function to use
   * @param {Number} [latencyRandomPercentage=5] What percent (+/-) of latencyCheckIntervalMs should we randomly use? This helps avoid alignment to other events.
   */
  function LatencyMonitor() {
    var _ref = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : {},
        latencyCheckIntervalMs = _ref.latencyCheckIntervalMs,
        dataEmitIntervalMs = _ref.dataEmitIntervalMs,
        asyncTestFn = _ref.asyncTestFn,
        latencyRandomPercentage = _ref.latencyRandomPercentage;

    _classCallCheck(this, LatencyMonitor);

    var _this = _possibleConstructorReturn(this, (LatencyMonitor.__proto__ || Object.getPrototypeOf(LatencyMonitor)).call(this));

    var that = _this;

    // 0 isn't valid here, so its ok to use ||
    that.latencyCheckIntervalMs = latencyCheckIntervalMs || 500; // 0.5s
    that.latencyRandomPercentage = latencyRandomPercentage || 10;
    that._latecyCheckMultiply = 2 * (that.latencyRandomPercentage / 100.0) * that.latencyCheckIntervalMs;
    that._latecyCheckSubtract = that._latecyCheckMultiply / 2;

    that.dataEmitIntervalMs = dataEmitIntervalMs === null || dataEmitIntervalMs === 0 ? undefined : dataEmitIntervalMs || 5 * 1000; // 5s
    debug('latencyCheckIntervalMs: %s dataEmitIntervalMs: %s', that.latencyCheckIntervalMs, that.dataEmitIntervalMs);
    if (that.dataEmitIntervalMs) {
      debug('Expecting ~%s events per summary', that.latencyCheckIntervalMs / that.dataEmitIntervalMs);
    } else {
      debug('Not emitting summaries');
    }

    that.asyncTestFn = asyncTestFn; // If there is no asyncFn, we measure latency

    // If process: use high resolution timer
    if (process && process.hrtime) {
      debug('Using process.hrtime for timing');
      that.now = process.hrtime;
      that.getDeltaMS = function (startTime) {
        var hrtime = that.now(startTime);
        return hrtime[0] * 1000 + hrtime[1] / 1000000;
      };
      // Let's try for a timer that only monotonically increases
    } else if (typeof window !== 'undefined' && (0, _get2.default)(window, 'performance.now')) {
      debug('Using performance.now for timing');
      that.now = window.performance.now.bind(window.performance);
      that.getDeltaMS = function (startTime) {
        return Math.round(that.now() - startTime);
      };
    } else {
      debug('Using Date.now for timing');
      that.now = Date.now;
      that.getDeltaMS = function (startTime) {
        return that.now() - startTime;
      };
    }

    that._latencyData = that._initLatencyData();

    // We check for isBrowser because of browsers set max rates of timeouts when a page is hidden,
    // so we fall back to another library
    // See: http://stackoverflow.com/questions/6032429/chrome-timeouts-interval-suspended-in-background-tabs
    // if (isBrowser()) {
    // 	that._visibilityChangeEmitter = new VisibilityChangeEmitter();
    // 	that._visibilityChangeEmitter.on('visibilityChange', (pageInFocus) => {
    // 		if (pageInFocus) {
    // 			that._startTimers();
    // 		} else {
    // 			that._emitSummary();
    // 			that._stopTimers();
    // 		}
    // 	});
    // }

    // if (!that._visibilityChangeEmitter || that._visibilityChangeEmitter.isVisible()) {
    // 	that._startTimers();
    // }
    return _this;
  }

  _createClass(LatencyMonitor, [{
    key: 'start',
    value: function start() {
      this._startTimers();
    }
  }, {
    key: 'stop',
    value: function stop() {
      this._emitSummary();
      this._stopTimers();
    }

    /**
     * Start internal timers
     * @private
     */

  }, {
    key: '_startTimers',
    value: function _startTimers() {
      var _this2 = this;

      // Timer already started, ignore this
      if (this._checkLatencyID) {
        return;
      }
      this._checkLatency();
      if (this.dataEmitIntervalMs) {
        this._emitIntervalID = setInterval(function () {
          return _this2._emitSummary();
        }, this.dataEmitIntervalMs);
        if ((0, _isFunction2.default)(this._emitIntervalID.unref)) {
          this._emitIntervalID.unref(); // Doesn't block exit
        }
      }
    }

    /**
     * Stop internal timers
     * @private
     */

  }, {
    key: '_stopTimers',
    value: function _stopTimers() {
      if (this._checkLatencyID) {
        clearTimeout(this._checkLatencyID);
        this._checkLatencyID = undefined;
      }
      if (this._emitIntervalID) {
        clearInterval(this._emitIntervalID);
        this._emitIntervalID = undefined;
      }
    }

    /**
     * Emit summary only if there were events. It might not have any events if it was forced via a page hidden/show
     * @private
     */

  }, {
    key: '_emitSummary',
    value: function _emitSummary() {
      var summary = this.getSummary();
      if (summary.events > 0) {
        this.emit('data', summary);
      }
    }

    /**
     * Calling this function will end the collection period. If a timing event was already fired and somewhere in the queue,
     * it will not count for this time period
     * @returns {SummaryObject}
     */

  }, {
    key: 'getSummary',
    value: function getSummary() {
      // We might want to adjust for the number of expected events
      // Example: first 1 event it comes back, then such a long blocker that the next emit check comes
      // Then this fires - looks like no latency!!
      var latency = {
        events: this._latencyData.events,
        minMs: this._latencyData.minMs,
        maxMs: this._latencyData.maxMs,
        avgMs: this._latencyData.events ? this._latencyData.totalMs / this._latencyData.events : Number.POSITIVE_INFINITY,
        lengthMs: this.getDeltaMS(this._latencyData.startTime)
      };
      this._latencyData = this._initLatencyData(); // Clear

      debug('Summary: %O', latency);
      return latency;
    }

    /**
     * Randomly calls an async fn every roughly latencyCheckIntervalMs (plus some randomness). If no async fn is found,
     * it will simply report on event loop latency.
     *
     * @private
     */

  }, {
    key: '_checkLatency',
    value: function _checkLatency() {
      var _this3 = this;

      var that = this;
      // Randomness is needed to avoid alignment by accident to regular things in the event loop
      var randomness = Math.random() * that._latecyCheckMultiply - that._latecyCheckSubtract;

      // We use this to ensure that in case some overlap somehow, we don't take the wrong startTime/offset
      var localData = {
        deltaOffset: Math.ceil(that.latencyCheckIntervalMs + randomness),
        startTime: that.now()
      };

      var cb = function cb(value) {
        // We are already stopped, ignore this datapoint
        if (!_this3._checkLatencyID) {
          return;
        }

        var deltaMS = value;
        that._checkLatency(); // Start again ASAP

        // Add the data point. If this gets complex, refactor it
        that._latencyData.events++;
        that._latencyData.minMs = Math.min(that._latencyData.minMs, deltaMS);
        that._latencyData.maxMs = Math.max(that._latencyData.maxMs, deltaMS);
        that._latencyData.totalMs += deltaMS;
        debug('MS: %s Data: %O', deltaMS, that._latencyData);
      };
      debug('localData: %O', localData);

      this._checkLatencyID = setTimeout(function () {
        // This gets rid of including event loop
        if (that.asyncTestFn) {
          // Clear timing related things
          localData.deltaOffset = 0;
          localData.startTime = that.now();
          that.asyncTestFn(cb);
        } else {
          // setTimeout is not more accurate than 1ms, so this will ensure positive numbers. Add 1 to emitted data to remove.
          // This is not the best, but for now it'll be just fine. This isn't meant to be sub ms accurate.
          localData.deltaOffset -= 1;
          // If there is no function to test, we mean check latency which is a special case that is really cb => cb()
          // We avoid that for the few extra function all overheads. Also, we want to keep the timers different
          var deltaMS = that.getDeltaMS(localData.startTime) - localData.deltaOffset;
          cb(deltaMS);
        }
      }, localData.deltaOffset);

      if ((0, _isFunction2.default)(this._checkLatencyID.unref)) {
        this._checkLatencyID.unref(); // Doesn't block exit
      }
    }
  }, {
    key: '_initLatencyData',
    value: function _initLatencyData() {
      return {
        startTime: this.now(),
        minMs: Number.POSITIVE_INFINITY,
        maxMs: Number.NEGATIVE_INFINITY,
        events: 0,
        totalMs: 0
      };
    }
  }]);

  return LatencyMonitor;
}(_events2.default);

// function isBrowser() {
// 	return typeof window !== 'undefined';
// }

exports.default = LatencyMonitor;
//# sourceMappingURL=LatencyMonitor.js.map
