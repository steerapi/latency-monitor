'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _events = require('events');

var _events2 = _interopRequireDefault(_events);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; } /* global document */

var debug = require('debug')('latency-monitor:VisibilityChangeEmitter');

/**
 * Listen to page visibility change events (i.e. when the page is focused / blurred) by an event emitter.
 *
 * Warning: This does not work on all browsers, but should work on all modern browsers
 *
 * @example
 *
 *     const myVisibilityEmitter = new VisibilityChangeEmitter();
 *
 *     myVisibilityEmitter.on('visibilityChange', (pageInFocus) => {
 *        if ( pageInFocus ){
 *            // Page is in focus
 *            console.log('In focus');
 *        }
 *        else {
 *            // Page is blurred
 *            console.log('Out of focus');
 *        }
 *     });
 *     // To access the visibility state directly, call:
 *     console.log('Am I focused now? ' + myVisibilityEmitter.isVisible());
 *
 * @class VisibilityChangeEmitter
 */

var VisibilityChangeEmitter = function (_EventEmitter) {
  _inherits(VisibilityChangeEmitter, _EventEmitter);

  /**
   * Creates a VisibilityChangeEmitter
   */
  function VisibilityChangeEmitter() {
    _classCallCheck(this, VisibilityChangeEmitter);

    var _this = _possibleConstructorReturn(this, (VisibilityChangeEmitter.__proto__ || Object.getPrototypeOf(VisibilityChangeEmitter)).call(this));

    if (typeof document === 'undefined') {
      debug('This is not a browser, no "document" found. Stopping.');
      return _possibleConstructorReturn(_this);
    }
    _this._initializeVisibilityVarNames();
    _this._addVisibilityChangeListener();
    return _this;
  }

  /**
   * document.hidden and document.visibilityChange are the two variables we need to check for;
   * Since these variables are named differently in different browsers, this function sets
   * the appropriate name based on the browser being used. Once executed, tha actual names of
   * document.hidden and document.visibilityChange are found in this._hidden and this._visibilityChange
   * respectively
   * @private
   */


  _createClass(VisibilityChangeEmitter, [{
    key: '_initializeVisibilityVarNames',
    value: function _initializeVisibilityVarNames() {
      var hidden = void 0;
      var visibilityChange = void 0;
      if (typeof document.hidden !== 'undefined') {
        // Opera 12.10 and Firefox 18 and later support
        hidden = 'hidden';
        visibilityChange = 'visibilitychange';
      } else if (typeof document.mozHidden !== 'undefined') {
        hidden = 'mozHidden';
        visibilityChange = 'mozvisibilitychange';
      } else if (typeof document.msHidden !== 'undefined') {
        hidden = 'msHidden';
        visibilityChange = 'msvisibilitychange';
      } else if (typeof document.webkitHidden !== 'undefined') {
        hidden = 'webkitHidden';
        visibilityChange = 'webkitvisibilitychange';
      }
      this._hidden = hidden;
      this._visibilityChange = visibilityChange;
    }

    /**
     * Adds an event listener on the document that listens to changes in document.visibilityChange
     * (or whatever name by which the visibilityChange variable is known in the browser)
     * @private
     */

  }, {
    key: '_addVisibilityChangeListener',
    value: function _addVisibilityChangeListener() {
      if (typeof document.addEventListener === 'undefined' || typeof document[this._hidden] === 'undefined') {
        debug('Checking page visibility requires a browser that supports the Page Visibility API.');
      } else {
        // Handle page visibility change
        document.addEventListener(this._visibilityChange, this._handleVisibilityChange.bind(this), false);
      }
    }

    /**
     * The function returns ```true``` if the page is visible or ```false``` if the page is not visible and
     * ```undefined``` if the page visibility API is not supported by the browser.
     * @returns {Boolean|void} whether the page is now visible or not (undefined is unknown)
     */

  }, {
    key: 'isVisible',
    value: function isVisible() {
      if (this._hidden === undefined || document[this._hidden] === undefined) {
        return undefined;
      }

      return !document[this._hidden];
    }

    /**
     * The function that is called when document.visibilityChange has changed
     * It emits an event called visibilityChange and sends the value of document.hidden as a
     * parameter
     *
     * @private
     */

  }, {
    key: '_handleVisibilityChange',
    value: function _handleVisibilityChange() {
      var visible = !document[this._hidden];
      debug(visible ? 'Page Visible' : 'Page Hidden');
      // Emit the event
      this.emit('visibilityChange', visible);
    }
  }]);

  return VisibilityChangeEmitter;
}(_events2.default);

exports.default = VisibilityChangeEmitter;
//# sourceMappingURL=VisibilityChangeEmitter.js.map
