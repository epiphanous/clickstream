import joi from 'react-native-joi';
import Fingerprint2 from 'fingerprintjs2';
import jstz from 'jstimezonedetect';
import assign from 'lodash/assign';
import each from 'lodash/each';
import get from 'lodash/get';
import has from 'lodash/has';
import includes from 'lodash/includes';
import indexOf from 'lodash/indexOf';
import isArray from 'lodash/isArray';
import isEmpty from 'lodash/isEmpty';
import isNil from 'lodash/isNil';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import now from 'lodash/now';
import omit from 'lodash/omit';
import omitBy from 'lodash/omitBy';
import uniq from 'lodash/uniq';
import values from 'lodash/values';
//import map from 'lodash/map';
import UAParser from 'ua-parser-js';
import id64 from 'id64';
import Promise from 'promise-polyfill';
import GetIp from './GetIp';
import DefaultAsyncStorage from './DefaultAsyncStorage';
import DefaultSyncStorage from './DefaultSyncStorage';
import Referrer from './Referrer';

// don't make this an arrow function please
const noop = function () { };
// simple alias for creating a string schema
const jst = () => joi.string().trim();

// generate ids
const id64t = () => id64().replace(/\./g, '~');
const genDivolteId = () => `0:${now().toString(36)}:${id64t()}`;

const CSR_STATE_KEY = '__c_s_r__s_t_a_t_e__';
const CSR_QUERY_ARG = '_csr';
const DIVOLTE_PARTY_COOKIE_NAME = '_dvp';
const DIVOLTE_SESSION_COOKIE_NAME = '_dvs';
const KEYCLOAK_COOKIE_NAME = '_rtok';

// polyfill promise
if (typeof window !== 'undefined' && !window.Promise) {
  window.Promise = Promise;
}

// polyfill startsWith for ie11
if (!String.prototype.startsWith) {
  String.prototype.startsWith = function(searchString, position){
    position = position || 0;
    return this.substr(position, searchString.length) === searchString;
  };
}

/**
 * Clickstream class to manage/send clickstream events.
 */
class Clickstream {

  /**
   * Create a clickstream object. Many of the configuration parameters are useful for unit testing the
   * code. In most cases, you'll only need to set the `divolteUrl` option.
   * @param {object=}   config an optional configuration object
   * @param {any}       [config.root=window] the global object
   * @param {string=}   config.userId the id of the logged-in user (can also be set later with `setUserId()`)
   * @param {object=}   config.appInfo The app info object (can also be set later with `setAppInfo()`)
   * @param {string}    config.appInfo.id The application id (`aid` is an alias)
   * @param {string}    config.appInfo.name The application name (`an` is an alias)
   * @param {string=}   config.appInfo.version The application version (`av` is an alias)
   * @param {string=}   config.appInfo.installerId The application installer id (`aiid` is an alias)
   * @param {object=}   config.deviceInfo The device info object if running in react native (can also be set later with `setDeviceInfo()`)
   * @param {string=}   config.deviceInfo.id             the device identifier (not unique) (alias `uav`)
   * @param {string=}   config.deviceInfo.uniqueId       a unique device id (alias `did`)
   * @param {string=}   config.deviceInfo.name           the device name (alias `uaf`)
   * @param {string=}   config.deviceInfo.systemName     the system os name (alias `osf`)
   * @param {string=}   config.deviceInfo.systemVersion  the system os version (alias `osv`)
   * @param {string=}   config.deviceInfo.manufacturer   the manufacturer (alias `osd`)
   * @param {string=}   config.deviceInfo.model          the model number (alias `uat`)
   * @param {string=}   config.deviceInfo.brand          the brand (alias `uav`)
   * @param {string=}   config.deviceInfo.bundleId       the app's bundle id (alias `aid`)
   * @param {string=}   config.deviceInfo.buildNumber    the app's build number (alias `av`)
   * @param {string=}   config.deviceInfo.locale         the locale (alias `ul`)
   * @param {string=}   config.deviceInfo.country        the country (alias `geoid`)
   * @param {string=}   config.deviceInfo.timeZone       the timezone (alias `tz`)
   * @param {string=}   config.deviceInfo.userAgent      the user agent (alias `uas`)
   * @param {integer=}  config.deviceInfo.screenWidth    the screen width (`Dimensions.get('window').width`, alias `sw`)
   * @param {integer=}  config.deviceInfo.screenHeight   the screen height (`Dimensions.get('window').height`, alias `sh`)
   * @param {string=}   config.deviceInfo.deviceCategory `tablet` or cw`smartphone` (alias `uac`)
   * @param {string}    [config.globalName=clickstream] If set, install the clickstream object into the global namespace under this name.
   *                                      If empty, no global is installed.
   * @param {boolean}   [config.logging=false] true turns on logging, false disables logging
   * @param {boolean}   [config.autoFirePageView=false] automatically fire a pageview event
   * @param {integer}   [config.maxGeoWaitTime=0] number of milliseconds to wait for geolocation resolution (0=no geolocation)
   * @param {boolean}   [config.allowMultiplePageViews=false] allow multiple pageview events to be fired
   * @param {function=} config.pageLoadedMethod method used to determine if the page has been loaded (defaults to checking `document.readyState`)
   * @param {string=}   [config.divolteUrl=http://localhost:8290/divolte.js] the url of the divolte collector javascript library to use for sending clickstream events
   * @param {boolean}   [config.isReactNative=navigator.product === 'React Native'] true if running in a react native environment
   * @param {boolean=}  config.useJsonEndpoint indicates if the json endpoint should be used instead of the `divolte.js` transport (will be automatically set `true` if running in react native)
   * @param {string}    [config.jsonEnpoint=http://localhost:8290/json] the url to the json endpoint (if `useJsonEndpoint` is true)
   * @param {integer}   [config.maxSessionIdleTime=1800000] the maximum number of milliseconds between clickstream events before a new session is created when using the json endpoint
   * @param {object}    [config.asyncStorage=in-memory implementation] an asynchronous storage api object used to get/set party ids when using the json endpoint
   * @param {function=} config.asyncStorage.getItem a function that given a key will return a value from the storage
   * @param {function=} config.asyncStorage.setItem a function that given a key and value, will set the key to that value in storage
   * @param {function=} config.asyncStorage.removeItem a function that given a key, will remove the key from storage
   * @param {object}    [config.syncStorage=localStorage|sessionStorage|in-memory] a synchronous storage api object used to manage clickstream redirector state
   * @param {function=} config.syncStorage.getItem a function that given a key will return a value from sync storage
   * @param {function=} config.syncStorage.setItem a function that given a key and value, will set the key to that value in sync storage
   * @param {function=} config.syncStorage.removeItem a function that given a key, will remove the key from sync storage
   * @param {string}    [config.divoltePartyCookie=_dvp] the name of the divolte party cookie
   * @param {string}    [config.divolteSessionCookie=_dvs] the name of the divolte session cookie
   * @param {string}    [config.keycloakCookie=_rtok] the name of the keycloak JWT token cookie
   */
  constructor(config) {
    const optionDefaults = {
      allowMultiplePageViews: false,
      autoPageView: false,
      divolteUrl: 'http://localhost:8290/divolte.js',
      jsonEndpoint: 'http://localhost:8290/json',
      geoWaitTime: 0,
      globalName: 'clickstream',
      logging: false,
      pageLoadedMethod: this._isPageLoaded.bind(this),
      maxSessionIdleTime: 1800000,
      asyncStorage: new DefaultAsyncStorage(),
      syncStorage: new DefaultSyncStorage(),
      divoltePartyCookie: DIVOLTE_PARTY_COOKIE_NAME,
      divolteSessionCookie: DIVOLTE_SESSION_COOKIE_NAME,
      keycloakCookie: KEYCLOAK_COOKIE_NAME,
      usefp: true,
      useIpify: true,
      sendAutoExceptions: true,
      useUserAgentParser: true
    };
    // validate passed in options
    const parse = joi.validate(
      config,
      joi.object().keys({
        root: joi.any(),
        userId: jst(),
        isReactNative: joi.boolean(),
        useJsonEndpoint: joi.boolean(),
        appInfo: joi.object().keys({
          id: jst().required(),
          name: jst().required(),
          version: jst(),
          installerId: jst()
        }),
        deviceInfo: joi.object().keys({
          id: jst(),
          uniqueId: jst(),
          name: jst(),
          systemName: jst(),
          systemVersion: jst(),
          manufacturer: jst(),
          model: jst(),
          brand: jst(),
          bundleId: jst(),
          buildNumber: jst(),
          locale: jst(),
          country: jst(),
          timeZone: jst(),
          userAgent: jst(),
          screenWidth: joi.number().integer(),
          screenHeight: joi.number().integer(),
          deviceCategory: jst()
        }),
        globalName: jst().default(optionDefaults.globalName),
        logging: joi.boolean().default(optionDefaults.logging),
        autoPageView: joi.boolean().default(optionDefaults.autoPageView),
        autoPageViewPage: jst(),
        geoWaitTime: joi.number().integer().min(0).max(30000).default(optionDefaults.geoWaitTime),
        pageLoadedMethod: joi.func().arity(0).default(optionDefaults.pageLoadedMethod),
        allowMultiplePageViews: joi.boolean().default(optionDefaults.allowMultiplePageViews),
        divolteUrl: jst().uri().default(optionDefaults.divolteUrl),
        jsonEndpoint: jst().uri().default(optionDefaults.jsonEndpoint),
        asyncStorage: joi.object().default(optionDefaults.asyncStorage),
        syncStorage: joi.object().default(optionDefaults.syncStorage),
        maxSessionIdleTime: joi.number().integer().min(300000).default(optionDefaults.maxSessionIdleTime),
        usefp: joi.boolean().default(optionDefaults.usefp),
        useIpify: joi.boolean().default(optionDefaults.useIpify),
        sendAutoExceptions: joi.boolean().default(optionDefaults.sendAutoExceptions),
        useUserAgentParser: joi.boolean().default(optionDefaults.useUserAgentParser),
        divoltePartyCookie: jst().default(optionDefaults.divoltePartyCookie),
        divolteSessionCookie: jst().default(optionDefaults.divolteSessionCookie),
        keycloakCookie: jst().default(optionDefaults.keycloakCookie)
      }).default(optionDefaults)
    );
    if (parse.error) {
      throw parse.error;
    }
    const options = parse.value;

    /**
     * The `root` property points at the `global`, or `window` object, or some other object you pass
     * in to test the class.
     */
    this.root = options.root;
    if (typeof global === 'object' && !this.root) {
      this.root = global;
    }
    if (typeof window === 'object' && !this.root) {
      this.root = window;
    }

    // maybe polyfill atob
    if (!this.root.atob) {
      this.root.atob = require('base-64').decode;
    }

    /**
     * The `isReactNative` property determines if we are running in a react native application. It
     * is set automatically by testing whether the `navigator.product` value is `ReactNative`.
     */
    this.isReactNative = options.isReactNative;
    if (typeof this.isReactNative === 'undefined') {
      this.isReactNative = this._root('navigator.product') === 'ReactNative';
    }
    if (this.isReactNative) {
      // to support id64 on react native
      this.root.Buffer = this.root.Buffer || require('buffer').Buffer;
    }

    /**
     * The `asyncStorage` property has asynchronous `getItem(key)`, `setItem(key,value)`, and `removeItem(key)` methods.
     * They are used for party identifiers for the json endpoint.
     */
    this.asyncStorage = options.asyncStorage;

    /**
     * The `syncStorage` property has synchronous `getItem(key)`, `setItem(key,value)`, and `removeItem(key)` methods.
     * They are used for clickstream redirect processing.
     */
    this.syncStorage = options.syncStorage;

    /**
     * The `useJsonEndpoint` property determines if we send via the normal divolte.signal method or use
     * the raw json endpoint. This defaults to true if `isReactNative` is true.
     */
    this.useJsonEndpoint = options.useJsonEndpoint;
    if (typeof this.useJsonEndpoint === 'undefined') {
      this.useJsonEndpoint = this.isReactNative;
    }

    /**
     * The `jsonEndpoint` property determines the url to send json signals to when `useJsonEndpoint` is true
     * Defaults to `http://localhost:8290/json`.
     */
    this.jsonEndpoint = options.jsonEndpoint;

    /**
     * The number of signals sent via the json endpoint.
     */
    this.jsonSignalCount = 0;

    /**
     * The `maxSessionIdleTime` is the maximum time a session can remain idle before creating a new session
     * when `useJsonEndpoint` is true.
     */
    this.maxSessionIdleTime = options.maxSessionIdleTime;

    /**
     * The `_initTime` property is set internally to the time the clickstream object is initialized. It is used
     * internally by the clickstream class to determine if the `geoWaitTime` has expired and is used to set the
     * `tspl` (time since page load) key on fired events when the `performance` api is unavailable.
     */
    this._initTime = now();

    /**
     * The `_pageViewEventFired` property is a boolean generated internally to track if the page view event has
     * already fired in order to prevent multiple such events from firing if `allowMultiplePageViews` is `false`.
     */
    this._pageViewEventFired = false;

    /**
     * The `autoPageView` property is a boolean property that indicates if the caller
     * wants to automatically fire a page view event as soon as possible after initializing the clickstream object.
     * Defaults to `false`.
     */
    this.autoPageView = options.autoPageView;

    /**
     * Sets the `autoPageViewPage` property. The `autoPageViewPage` property is a string property that parameterizes
     * the auto page view event, if `autoPageView` is true. This is normally set to the url path of the page being viewed.
     * It will default to `location.pathname` if `autoPageView` is `true` and this property is unset.
     */
    this.autoPageViewPage = options.autoPageViewPage || this._root('location.pathname');

    /**
     * The `error` parameter is set internally when a setter or fire method is called with invalid parameters. All
     * `setXXX()` and `fireXXX()` methods return a boolean that is false if the requested parameters are invalid.
     * You may consult this property in order to discover the errors found during the most recent request.
     */
    this.error = null;

    /**
     * The `geoWaitTime` property controls if and how long to wait to obtain the user's
     * geolocation coordinates from the geolocation api. If set to zero, the geolocation api will not be accessed.
     * If set to a positive number, no clickstream events will be sent until either the geolocation api has returned
     * a location (or an error), or this number of milliseconds passes. Defaults to 10 seconds.
     */
    this.geoWaitTime = options.geoWaitTime;

    /**
     * The `_waitOnGeo` property is an internal boolean property, supplemental to `geoWaitTime`.
     * You don't need to get it and shouldn't set it. This turns off waiting for geolocation,
     * if the 'geoWaitTime` parameter is positive and the geolocation api has already returned
     * a response.
     */
    this._waitOnGeo = this.geoWaitTime > 0;

    /**
     * The `sendAutoExceptions` property is a boolean that controls whether or not clickstream api errors are
     * automatically reported to the clickstream server. A clickstream api error occurs when one of the
     * set api methods is called with improper values. Since these errors are not thrown by clickstream to
     * avoid uselessly interrupting the running application, this is a method to make sure bugs in the usage of
     * clickstream are made visible to the system itself. This is turned on by default. These are reported as
     * `exception` type clickstream events with a data source (`ds`) parameter set to `clickstream` to make them
     * easy to isolate and report on in a dashboard somewhere.
     */
    this.sendAutoExceptions = options.sendAutoExceptions;

    /**
     * The `useUserAgentParser` property is a boolean that controls whether we try to parse the user agent on
     * the client side or let the server side do it. Its better to let the server side do it, but depending on
     * how divolte is deployed, its possible that the user agent header isn't properly passed to divolte. This
     * defaults to true (unless we're in react native) for now.
     */
    this.useUserAgentParser = options.useUserAgentParser && !this.isReactNative;

    /**
     * An internal array of events that are queued for sending before divolte is ready.
     */
    this._queuedEvents = [];

    /**
     * The `logging` property is a boolean property that indicates if we should emit log
     * messages to the console. Defaults to `false`.
     */
    this.logging = options.logging;

    /**
     * The `pageLoadedMethod` property is a function that returns true if the browser page has been loaded.
     * It defaults to checking whether the `document.readyState` is set to `complete` or `loaded`. See the
     * `_isPageLoaded()` method code for details on the algoirthm.
     */
    this.pageLoadedMethod = options.pageLoadedMethod;

    /**
     * The `allowMultiplePageViews` property indicates if more than one
     * page view event is allowed to be sent. Defaults to `false`.
     */
    this.allowMultiplePageViews = options.allowMultiplePageViews;

    /**
     * The `divolteUrl` property is a url that points at the location of the divolte javascript library.
     * Defaults to `http://localhost:8290/divolte.js`.
     */
    this.divolteUrl = options.divolteUrl;

    /**
     * The `divoltePartyCookie` is the name of the divolte party cookie. Defaults to `_dvp`.
     */
    this.divoltePartyCookie = options.divoltePartyCookie;

    /**
     * The `divolteSessionCookie` is the name of the divolte session cookie. Defaults to `_dvs`.
     */
    this.divolteSessionCookie = options.divolteSessionCookie;

    /**
     * The `keycloakCookie` is the name of the keycloak jwt token cookie that contains the logged in subject. Defaults to '_rtok'.
     */
    this.keycloakCookie = options.keycloakCookie;

    /**
     * The `paused` property allows you to pause/resume the sending of events. When `paused` is true, no events are sent, but are queued instead.
     * When `paused` is set to false, any queued events are flushed. You may also call `pause()` and `resume()` to set and unset `paused`.
     */
    this.paused = false;

    /**
     * The `params` property holds all the parameters, persistent and ephemeral, that will be send to divolte. You
     * should not access this directly, but rather use the many `setXXX()` and `addXXX()` methods to mutate this
     * state.
     */
    this.params = {
      persistent: {},    // sent on all events
      ephemeral: {},     // set on next event only
      impressionLists: [],
      impressions: [],   // ephemeral impressions
      products: [],      // ephemeral products
      promotions: []     // ephemeral promotions
    };

    // extract query args
    this.queryArgs = {};
    this._parseQueryString();

    // install a global pointer to this object
    if (options.globalName) {
      this.root[options.globalName] = this;
    }

    if (options.userId) {
      if (!this.setUserId(options.userId)) {
        throw this.error;
      }
    }
    else {
      this.resetUserId();
    }

    if (options.appInfo) {
      if (!this.setAppInfo(options.appInfo)) {
        throw this.error;
      }
    }

    this.resetUserAgent();
    this.resetColorDepth();
    if (options.deviceInfo) {
      if (!this.setDeviceInfo(options.deviceInfo)) {
        throw this.error;
      }
    }

    // establish some initial context values
    this.resetDocEncoding();
    this.resetDocTitle();
    this.resetUserLanguage();
    this.resetJavaEnabled();
    this.resetCampaignInfo();
    this.resetGaAdwordsId();
    this.resetGaDataSource();
    this.tz = jstz.determine().name();
    this.resetTimeZone();

    if (options.usefp && !this.isReactNative) {
      const self = this;
      new Fingerprint2().get(function (fp) {
        self.setUniqueDeviceId.bind(self)(fp);
      });
    }

    if (options.useIpify) {
      GetIp(this.setClientIp.bind(this));
    }

    var csr = null;
    if (!this.isReactNative) {
      // process sessionStorage for redirector info
      this._processCsrStorage();

      // parse clickstream redirect request if present and valid
      csr = this._getValidCsr();
      if (csr) {
        // if we have a csr, we use json endpoint, force autoPageView and geoWait off
        this.useJsonEndpoint = true;
        this.jsonEndpoint = csr.j;
        this.autoPageView = false;
        this.geoWaitTime = 0;
      }
    }

    // initialize party and session identifiers if we're using json endpoint
    this.party = { id: genDivolteId() };
    this.partyIsNew = true;
    this.session = {};
    this.sessionIsNew = true;
    if (this.useJsonEndpoint) {
      this._parseDivolteCookies();
      this._updateSession();
    }
    if (this.isReactNative) {
      const _log = this._log.bind(this);
      const self = this;
      self.asyncStorage.getItem('party').then((party) => {
        if (party) {
          self.party = party;
        }
        else {
          self.asyncStorage.setItem('party', self.party).then(noop).catch((e) => { throw e; });
        }
      }).catch(_log);
    }

    // if we want auto geo location, get it going
    if (this.geoWaitTime > 0) {
      this._getGeoLocation();
    }

    // if we want to automatically fire a pageview
    if (this.autoPageView) {
      this.firePageView({ page: this.autoPageViewPage });
    }

    // process redirector info
    if (csr) this._processCsr(csr);

    // load divolte, then flush the queue to get started
    this._loadDivolte().then(this._flushQueue.bind(this)).catch((err) => {
      this._log(err);
    });
  }

  /**
   * Internal method to get vaue of a cookie in browser environment.
   * @param {string} name name of the cookie
   */
  _getCookie(name) {
    return this._root('document.cookie','')
      .replace(new RegExp(`(?:(?:^|.*;)\\s*${name}\\s*\\=\\s*([^;]*).*$)|^.*$`), RegExp.$1) || null;
  }

  /**
   * Internal method to parse the party and session divolte cookies, if they exist in our environment.
   */
  _parseDivolteCookies() {
    const dvp = this._getCookie(this.divoltePartyCookie);
    if (dvp) {
      this.party = { id: dvp };
      this.partyIsNew = false;
    }
    const dvs = this._getCookie(this.divolteSessionCookie);
    if (dvs) {
      this.session = { id: dvs, accessTime: now() };
      this.sessionIsNew = false;
    }
  }

  /**
   * Parse query args.
   * @return {object} hash of query args
   */
  _parseQueryString() {
    const args = {};
    this._root('location.search', '').substr(1).split('&').forEach((kv) => {
      const [key, val] = kv.split('=').map(this._root('decodeURIComponent', x => x));
      if (has(args, key)) {
        if (!isArray(args[key])) {
          args[key] = [args[key]];
        }
        args[key].push(val);
      }
      else {
        args[key] = val;
      }
    });
    this.queryArgs = args;
    return args;
  }

  /**
   * Returns the value of the named query `param`, or the `defaultValue`.
   * @param {string} param
   * @param {any} defaultValue
   */
  _getQueryArg(param, defaultValue) {
    return get(this.queryArgs, param, defaultValue);
  }

  /**
   * Process any local or session storage for click stream redirector state.
   */
  _processCsrStorage() {
    const csrStateString = this.syncStorage.getItem(CSR_STATE_KEY);
    let csrState = {};
    try {
      const self = this;
      csrState = JSON.parse(csrStateString);
      each(csrState, (params, storageKey) => {
        self._updateParams(params, storageKey);
      });
    }
    catch (e) {
      this._log(e);
    }
    this.syncStorage.removeItem(CSR_STATE_KEY);
  }

  /**
   * Parse a valid clickstream redirector request from query args or return null. A clickstream
   * request is pulled from the query string of the browser url. The name of the query arg *must* be
   * `_csr`. And it *must* be a url-safe base64 encoded string of serialized json with several
   * properties. Once parsed, the csr *must* have a `u` property with the value of the url to redirect
   * to after processing the csr. It *must* have either an `s` property with a valid csr state object
   * to store in localStorage for processing by the redirect url page, *or* it must have both an `e`
   * property holding an array of event types and payloads to send before redirecting, as well as a
   * `j` property defining the json endpoint to send those events to.
   * @return {object|null} a parsed javascript object or null if no valid request found
   */
  _getValidCsr() {
    const token = this._getQueryArg(CSR_QUERY_ARG);
    if (token) {
      const csr = this._parseCsrToken(token);
      if (has(csr, 'u') && isString(csr.u) &&
        (
          (has(csr,'e') && isArray(csr.e) && has(csr, 'j') && isString(csr.j))
          ||
          (has(csr, 's') && isObject(csr.s))
        )) {
        return csr;
      }
    }
    return null;
  }

  /**
   * Internal method to process a clickstream redirector request as parsed from the page url.
   * @param {object} csr a clickstream request object
   */
  _processCsr(csr) {
    let count = 0;
    if (has(csr, 'e')) {
      csr.e.forEach(e => {
        const eventType = get(e, 't');
        const eventPayload = get(e, 'p');
        if (!isEmpty(eventType)) {
          this.fire(eventType, eventPayload);
          count++;
        }
      });
    }
    if (has(csr, 's')) {
      this.syncStorage.setItem(CSR_STATE_KEY, JSON.stringify(csr.s));
    }
    this._handleRedirect(csr.u, count);
  }

  /**
   * Redirect page to requested location. This is used by click stream redirector functionality.
   * @param {string} url
   */
  _handleRedirect(url, expectedSignalCount, callCount = 0) {
    let redirect = this._root('location.replace');
    if (!redirect) {
      return;
    }
    // loop while expectedSignalCount > this.jsonSignalCount and call count < max call count
    const maxCallCount = 20;
    if (expectedSignalCount > this.jsonSignalCount && callCount < maxCallCount) {
      const self = this;
      setTimeout(() => {
        self._handleRedirect(url, expectedSignalCount, callCount + 1);
      }, 100);
    }
    else {
      this._log('redirecting to ' + url);
      redirect.bind(this._root('location'))(url);
    }
  }

  /**
   * Update the session id/access time appropriately based on the max session idle configuration.
   */
  _updateSession() {
    const idleTime = now() - (this.session.accessTime || 0);
    if (idleTime > this.maxSessionIdleTime) {
      this.session = { id: genDivolteId(), accessTime: now() };
      this.sessionIsNew = true;
    }
    else {
      if (idleTime > 0) this.session.accessTime = now();
    }
  }

  /**
   * Simple logging function that uses the `console.log` method if available and if `logging` option is on.
   */
  _log() {
    if (this.logging) {
      this._root('console.log', noop).apply(this._root('console'), arguments);
    }
  }

  /**
   * Returns an object with key 'tspl' and a value representing time since page loaded, in
   * milliseconds. This attempts to use the performance api if available, otherwise it returns
   * the number of millis since the constructor of this clickstream object was called.
   **/
  _tspl() {
    const perfNow = this._root('performance.now');
    const tspl = perfNow ? Math.round(perfNow.apply(this.root.performance)) : this._runDuration();
    return { tspl: tspl };
  }

  /**
   * Internal default method to check if the browser page has been loaded. This checks the
   * `document.readyState` to see if it matches `loaded` or `complete`, as is common in most browsers.
   */
  _isPageLoaded() {
    return this.isReactNative ? true : /(loaded|complete)/.test(this._root('document.readyState'));
  }

  /**
   * access a global variable, or return a default if its not available
   */
  _root(path, defaultValue = null) {
    return get(this.root, path, defaultValue);
  }

  /**
   * check if divolte is loaded
   * @return {boolean} true if loaded, false otherwise
   */
  _divolteIsLoaded() {
    return this.useJsonEndpoint ? true : this._root('divolte.signal') !== null;
  }

  /**
   * load divolte asynchronously
   * @return {Promise} a Promise
   */
  _loadDivolte() {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (self._divolteIsLoaded()) {
        resolve(self);
      } else {
        let r = false;
        const t = self._root('document').getElementsByTagName('script')[0],
          s = self._root('document').createElement('script');

        s.type = 'text/javascript';
        s.src = self.divolteUrl;
        s.async = true;
        s.onload = s.onreadystatechange = function () {
          if (!r && (!this.readyState || this.readyState == 'complete')) {
            r = true;
            resolve(self);
          }
        };
        s.onerror = s.onabort = reject;
        t.parentNode.insertBefore(s, t);
      }
    });
  }

  /**
   * Parse a base64 endcoded token.
   *
   * @param {string} token
   * @return {object} the parsed token as a javascript object
   */
  _parseCsrToken(token) {
    const base64 = token.replace('-', '+').replace('_', '/');
    const a2b = this.root.atob;
    let result = {};
    try {
      result = JSON.parse(a2b(base64));
      this._log(result);
    }
    catch (e) {
      this._log(e);
    }
    return result;
  }

  /**
   * Pause sending of events. While paused, fired events will be queued.
   */
  pause() {
    this.paused = true;
  }

  /**
   * Resume sending events. This flushes any events queued during the pause.
   */
  resume() {
    this.paused = false;
    this._flushQueue();
  }

  /**
   * Internal method to flush the queue of pending events. Fired events are queued prior to
   * divolte being ready and whenever pause() is called. Once divolte loads, or resume() is called,
   * this method sends all events in the queue, in order. Note we also queue set data values, so
   * the events will be flushed in order and with the appropriate data.
   */
  _flushQueue() {
    if (this._queuedEvents.length) {
      this._queuedEvents.forEach((q) => {
        this._log(`dequeue: ${q}`);
        q();
      });
      this._queuedEvents = [];
    }
  }

  /**
   * Either executes a function immediately (a fire or set method) or it queues it for later
   * execution if divolte is not ready or if we are in a paused state. Note that we attempt
   * to bind the function to an appropriate context. The bound function is queued. Usually,
   * the function is a closure, so once bound, all necessary data is encapsulated at the time
   * its queued, so the order of operations are properly respected when flushed later.
   * @param {function} method the function to be executed
   * @param {object=} context the context to bind the function to (defaults to clickstream object)
   */
  _execOrQueue(closure, context = this) {
    var func = this._maybeBind(closure, context);
    if (!this.paused && this._divolteIsLoaded()) {
      func();
    } else {
      this._queue(func);
    }
  }

  /**
   * Internal method to attempt to bind a context to the given closure. If closure is an unbound
   * function, it will be bound with the context (which defaults to `this` (the clickstream object)).
   * If closure is a function that is already bound, it is returned as is. If closure is a string,
   * it is assumed to be a method in the clickstream object and is bound to the clickstream object.
   * @param {function|string} closure the function or method name to bind
   * @param {object=} context an optional context to bind to (defaults to clickstream object)
   */
  _maybeBind(closure, context = this) {
    const func = typeof closure === 'string' ? this[closure] : closure;
    return func.hasOwnProperty('prototype') ? func.bind(context) : func;
  }

  /**
   * Queues a closure for later execution.
   * @param {function|string} closure the function or method name to queue
   */
  _queue(closure) {
    this._queuedEvents.push(this._maybeBind(closure));
  }

  /**
   * Return the number of milliseconds we've been running.
   * @return {number} duration since we were loaded
   */
  _runDuration() {
    return now() - this._initTime;
  }

  /**
   * Get geolocation via geolocation api
   */
  _getGeoLocation() {
    const geolocation = this._root('navigator.geolocation');
    let getCurrentPosition = function () { this._waitOnGeo = false; }.bind(this);
    let watchPosition = noop;
    if (geolocation) {
      getCurrentPosition = geolocation.getCurrentPosition.bind(geolocation);
      watchPosition = geolocation.watchPosition.bind(geolocation);
    }
    const updatePosition = function (position) {
      this._waitOnGeo = false;
      this._updateParams({
        lat: position.coords.latitude,
        lon: position.coords.longitude
      });
    }.bind(this);
    const failPosition = function (err) {
      this._log(err);
      this._waitOnGeo = false;
    }.bind(this);
    getCurrentPosition(updatePosition, failPosition);
    watchPosition(updatePosition, failPosition);
  }

  /**
   * Update multiple customParameters with the requested values. The key and value supplied must be
   * compatible with our divolte schema, as this value will be sent, as is, to divolte. It is a best
   * practice to use the many `setXXX()` methods to set particular values, as these methods ensure the
   * correct (if  cryptic) divolte compatible keys are used and the data types are validated.
   *
   * This method will queue the updates if needed.
   * @param {object} params a map of parameters to update
   * @param {string=} storageKey the type of parameter (`persistent`, `ephemeral`, `products`, `promotions`, or `impressions`, default is `persistent`)
   */
  updateParams(params, storageKey = 'persistent') {
    this._execOrQueue(function () {
      this._updateParams(params, storageKey);
    });
  }

  /**
   * Update a particular custom parameter with the requested value. The key and value supplied must be
   * compatible with our divolte schema, as this value will be sent, as is, to divolte. It is a best
   * practice to use the many `setXXX()` methods to set particular values, as these methods ensure the
   * correct (if  cryptic) divolte compatible keys are used and the data types are validated.
   *
   * This method will queue the update if needed.
   * @param {string} key the name of the parameter
   * @param {any} value the value of the parameter
   */
  updateParam(key, value, storageKey = 'persistent') {
    const obj = {};
    obj[key] = value;
    this.updateParams(obj, storageKey);
  }

  /**
   * Internal method to update all parameters. This is the method that executes once an update
   * has been executed (either directly or during a queue flush). Any values that are
   * `undefined`, `null`, or an empty string, will be removed from the `customParameters`
   * variable.
   * @param {object} params the parameters to update `customParameters` with
   * @param {string=} storageKey the type of parameter (`persistent`, `ephemeral`, `products`, `promotions`, or `impressions`, default is `persistent`)
   */
  _updateParams(params, storageKey = 'persistent') {
    if (storageKey === 'impressions') {
      const listName = params['ilnm'] ? params['ilnm'] : 'il1';
      let listIx = indexOf(this.params.impressionLists, listName);
      if (listIx === -1) {
        this.params.impressionLists.push(listName);
        this.params.impressions.push({ nm: listName, im: [] });
        listIx = this.params.impressions.length - 1;
      }
      this.params.impressions[listIx].im.push(omit(params, 'ilnm'));
    }
    else if (includes(['products', 'promotions'], storageKey)) {
      this.params[storageKey].push(params);
    }
    else {
      for (const p in params) {
        let value = params[p];
        if (typeof value === 'string') {
          value = value.trim();
        }
        if (typeof value === 'undefined' || value === null || value === '') {
          this._log(`remove ${storageKey} param '${p}'`);
          delete this.params[storageKey][p];
        } else {
          this._log(`set ${storageKey} param '${p}' to ${JSON.stringify(value)}`);
          this.params[storageKey][p] = value;
        }
      }
    }
  }

  /**
   * Removes the specified keys from `customParameters`. This method will queue the removal
   * if needed.
   * @param {array|string} keys an array of key names (or a single name) to remove
   * @param {string=} storageKey the type of parameter (`persistent` or `ephemeral`, default is `persistent`)
   */
  removeParams(keys, storageKey = 'persistent') {
    this._execOrQueue(function () {
      this._removeParams(keys, storageKey);
    });
  }

  /**
   * Removes the specified key from `customParameters`. This is syntactic sugar, but is effectively
   * an alias of the `removeParams()` method. This will queue the removal if needed.
   * @param {string} key a name to remove
   * @param {string=} storageKey the type of parameter (`persistent` or `ephemeral`, default is `persistent`)
   */
  removeParam(key, storageKey = 'persistent') {
    this.removeParams(key, storageKey);
  }

  /**
   * An internal method to actually do removal of one or more keys from customParameters.
   * @param {array|string} keys the keys to remove
   * @param {string=} storageKey the type of parameter (`persistent` or `ephemeral`, default is `persistent`)
   */
  _removeParams(keys, storageKey = 'persistent') {
    const removeKeys = typeof keys === 'string' ? [keys] : keys;
    for (const k in removeKeys) {
      const rk = removeKeys[k];
      this._log('remove clickstream param ' + rk);
      delete this.params[storageKey][rk];
    }
  }

  /**
   * Return the currently set custom parameters.
   * @return {object} the custom parameters already set
   * @param {string=} storageKey the type of parameter (`persistent`, `ephemeral`, `products`, `promotions`, or `impressions`, default is `persistent`)
   */
  getParams(storageKey = 'persistent') {
    return this.params[storageKey];
  }

  /**
   * Returns a particular custom parameter.
   * @param {string} param the name of the param to return
   * @param {string=} storageKey the type of parameter (`persistent` or `ephemeral`, default is `persistent`)
   * @return {any} the requested parameter value
   */
  getParam(param, storageKey = 'persistent') {
    return this.params[storageKey][param];
  }

  /**
   * The application info object.
   * @typedef {object} AppObject
   * @property {string}  id The application id (`aid` is an alias)
   * @property {string}  name the application name (`an` is an alias)
   * @property {string=} version the application version (`av` is an alias)
   * @property {string=} installerId the application installer id (`aiid` is an alias)
   */

  /**
   * Set the [application info](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#apptracking) parameters.
   * @param {AppObject} appObject
   * @return {boolean} true if successful, false otherwise
   */
  setAppInfo(appObject) {
    const data = joi.validate(
      appObject,
      joi.object().keys({
        aid: jst().label('id').required(),
        an: jst().label('name').required(),
        av: jst().label('version'),
        aiid: jst().label('installerId')
      }).required()
        .label('appObject')
        .rename('id', 'aid')
        .rename('name', 'an')
        .rename('version', 'av')
        .rename('installerId', 'aiid'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value);
    return true;
  }

  /**
   * Remove the [application info](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#apptracking) parameters.
   */
  resetAppInfo() {
    this.removeParams(['aid', 'an', 'av', 'aiid']);
  }

  /**
   * Set the timezone.
   */
  setTimeZone(tz) {
    const data = joi.validate(
      tz,
      jst().label('timeZone').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ tz: data.value });
    return true;
  }

  /**
   * Reset the time zone.
   */
  resetTimeZone() {
    if (this.tz) {
      this.setTimeZone(this.tz);
    }
    else {
      this.removeParam('tz');
    }
  }

  /**
   * The [device info](https://github.com/rebeccahughes/react-native-device-info) object (react native).
   * @typedef {object} DeviceObject
   * @property {string=}   id             the device identifier (not unique) (alias `uav`)
   * @property {string=}   uniqueId       a unique device id (alias `did`)
   * @property {string=}   name           the device name (alias `uaf`)
   * @property {string=}   systemName     the system os name (alias `osf`)
   * @property {string=}   systemVersion  the system os version (alias `osv`)
   * @property {string=}   manufacturer   the manufacturer (alias `osd`)
   * @property {string=}   model          the model number (alias `uat`)
   * @property {string=}   brand          the brand (alias `uav`)
   * @property {string=}   bundleId       the app's bundle id (alias `aid`)
   * @property {string=}   buildNumber    the app's build number (alias `av`)
   * @property {string=}   locale         the locale (alias `ul`)
   * @property {string=}   country        the country (alias `geoid`)
   * @property {string=}   timeZone       the timezone (alias `tz`)
   * @property {string=}   userAgent      the user agent (alias `uas`)
   * @property {integer=}  screenWidth    the screen width (`Dimensions.get('window').width`, alias `sw`)
   * @property {integer=}  screenHeight   the screen height (`Dimensions.get('window').height`, alias `sh`)
   * @property {boolean=}  deviceCategory TABLET or SMARTPHONE (alias `uac`)
   */

  parseRNDI(rndi, dims) {
    const di = omitBy({
      id: rndi.getDeviceId(),
      uniqueId: rndi.getUniqueID(),
      name: rndi.getDeviceName(),
      systemName: rndi.getSystemName(),
      systemVersion: rndi.getSystemVersion(),
      manufacturer: rndi.getManufacturer(),
      model: rndi.getModel(),
      brand: rndi.getBrand(),
      bundleId: rndi.getBundleId(),
      buildNumber: rndi.getBuildNumber(),
      locale: rndi.getDeviceLocale(),
      country: rndi.getDeviceCountry(),
      timeZone: rndi.getTimezone(),
      userAgent: rndi.getUserAgent(),
      deviceCategory: rndi.isTablet() ? 'tablet' : 'smartphone'
    }, isNil);
    if (has(dims, 'width')) {
      di.screenWidth = dims.width;
    }
    if (has(dims, 'height')) {
      di.screenHeight = dims.height;
    }
    return di;
  }

  /**
   * Set the [device info](https://github.com/rebeccahughes/react-native-device-info) parameters.
   * @param {DeviceObject} deviceInfo
   * @param {object=} dimensions object with screen height, width and scale (depth)
   * @return {boolean} true if successful, false otherwise
   */
  setDeviceInfo(deviceInfo, dimensions) {
    const di = (deviceInfo.hasOwnProperty('getUniqueID') && typeof deviceInfo.getUniqueID === 'function') ?
      this.parseRNDI(deviceInfo, dimensions) : deviceInfo;
    const data = joi.validate(
      di,
      joi.object().keys({
        uav: jst().label('id'),
        did: jst().label('uniqueId'),
        uan: jst().label('name'),
        osf: jst().label('systemName'),
        osv: jst().label('systemVersion'),
        osd: jst().label('manufacturer'),
        uat: jst().label('model'),
        uad: jst().label('brand'),
        ul: jst().label('locale'),
        geoid: jst().label('country'),
        tz: jst().label('timeZone'),
        uas: jst().label('userAgent'),
        sw: joi.number().integer().label('screenWidth'),
        sh: joi.number().integer().label('screenHeight'),
        aid: jst().label('bundleId'),
        av: jst().label('buildNumber'),
        uac: jst().label('deviceCategory')
      }).required()
        .min(1)
        .label('deviceObject')
        .rename('id', 'uav')
        .rename('uniqueId', 'did')
        .rename('name', 'uan')
        .rename('systemName', 'osf')
        .rename('systemVersion', 'osv')
        .rename('manufacturer', 'osd')
        .rename('model', 'uat')
        .rename('brand', 'uad')
        .rename('locale', 'ul')
        .rename('country', 'geoid')
        .rename('timeZone', 'tz')
        .rename('userAgent', 'uas')
        .rename('screenWidth', 'sw')
        .rename('screenHeight', 'sh')
        .rename('bundleId', 'aid')
        .rename('buildNumber', 'av')
        .rename('deviceCategory', 'uac'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value);
    return true;
  }

  /**
   * Remove the [device info](https://github.com/rebeccahughes/react-native-device-info) parameters.
   * Note this does not reset several params that are also set elsewhere with other calls, because
   * that would potentially cause confusion. If you set `ul`, `geoid`, `tz`, `aid`, or `av` with `setDeviceInfo()`,
   * and you want to reset them, you must call `resetUserLanguage()`, `resetGaGeoId()`, `resetTimeZone()`,
   * and/or `resetAppInfo()`, respectively, to reset these params.
   */
  resetDeviceInfo() {
    this.removeParams([
      'uav',
      'did',
      'uan',
      'osf',
      'osv',
      'osd',
      'uat',
      'uad',
      'uas',
      'sw',
      'sh',
      'sd',
      'uac'
    ]);
  }

  /**
   * Resets the user agent string parameter (`uas`) either by setting it to the window.navigator.userAgent property, if available,
   * or removing the `uas` parameter altogether.
   */
  resetUserAgent() {
    const uas = this._root('navigator.userAgent');
    if (uas && this.useUserAgentParser) {
      const result = (new UAParser(uas)).getResult();
      const platform = uniq(values(omitBy([
        result.device.vendor, result.device.model, result.os.name, result.os.version
      ],isNil))).join(' ');
      const uan = `${result.browser.name} ${result.browser.major}${platform ? ' on ':''}${platform}`;
      const params = {
        uas: uas,
        uan: uan,
        uaf: result.browser.name,
        uav: result.browser.version,
        osf: result.os.name,
        osv: result.os.version,
        osd: result.device.vendor,
        uac: result.device.type ? result.device.type : 'PC',
        uat: 'Browser'
      };
      this.updateParams(params);
    }
    else {
      this.removeParams(['uas','uan','uaf','uav','osf','osv','osd','uat','uac']);
    }
  }

  /**
   * Sets the unique device id parameter. This value is set automatically if the `usefp` option is turned on in the
   * constructor of the clickstream object (true by default). If so, we use a browser fingerprinting algorithm to
   * capture an md5 hash of entropy we find in an individual browser. It can also be set in the `setDeviceInfo()`
   * method if using the `react-native-device-info` package in a mobile app.
   * @param {string} deviceId the computed device id
   */
  setUniqueDeviceId(deviceId) {
    const data = joi.validate(
      deviceId,
      jst().label('deviceId').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ did: data.value });
    return true;
  }

  /**
   * Reset the unique device id parameter.
   */
  resetUniqueDeviceId() {
    this.removeParam('did');
  }

  /**
   * Set the client ip parameter. This value is set automatically if the `useIpify` option is turned on in the
   * constructor of the clickstream object (true by default). If so, we use a third party service at `http://api.ipify.org`
   * to get the ip address of the client. We use this because our kubernetes set up makes it difficult for divolte to
   * retrieve an accurate client ip from the request.
   * @param {string} clientIp the client ip address retrieved by ipify
   */
  setClientIp(clientIp) {
    const data = joi.validate(
      clientIp,
      jst().label('clientIp').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ rip: data.value });
    return true;
  }

  /**
   * Reset the client ip parameter.
   */
  resetClientIp() {
    this.removeParam('rip');
  }

  /**
   * Holds information about a campaign. The library attempts to construct this from `utm_`
   * prefixed parameters in the page url.
   * @typedef {object} CampaignObject
   * @property {string=} id the campaign id (`ci` is an alias)
   * @property {string=} name the campaign name (`cn` is an alias)
   * @property {string=} medium the campaign medium (`cm` is an alias)
   * @property {string=} source the campaign source (`cs` is an alias)
   * @property {string=} keyword the campaign keyword (`ck` is an alias)
   * @property {string=} content the campaign content (`cc` is an alias)
   */

  /**
   * Set the [campaign info](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#trafficsources) parameter.
   * @param {CampaignObject} campaignObject
   * @return {boolean} true if successful, false otherwise
   */
  setCampaignInfo(campaignObject) {
    const data = joi.validate(
      campaignObject,
      joi.object().keys({
        ci: jst().label('id'),
        cn: jst().label('name'),
        cs: jst().label('source'),
        cm: jst().label('medium'),
        ck: jst().label('keyword'),
        cc: jst().label('content')
      }).required()
        .min(1)
        .label('campaignObject')
        .rename('id', 'ci')
        .rename('name', 'cn')
        .rename('source', 'cs')
        .rename('medium', 'cm')
        .rename('keyword', 'ck')
        .rename('content', 'cc'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value);
    return true;
  }

  /**
   * Resets the [campaign info](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#trafficsources) parameters.
   * This removes any previously set values, then parses the page url query string to extract any `utm_xxx` tags.
   */
  resetCampaignInfo() {
    this.removeParams(['ci', 'cn', 'cs', 'cm', 'ck', 'cc']);
    const utm = {
      utm_id: 'id',
      utm_campaign: 'name',
      utm_source: 'source',
      utm_medium: 'medium',
      utm_term: 'keyword',
      utm_content: 'content'
    };
    const info = {};
    each(this.queryArgs, (v, k) => {
      if (has(utm, k)) {
        info[utm[k]] = v;
      }
    });
    if (isEmpty(info)) {
      const r = new Referrer(this._root('document.referrer'));
      r.updateInfo(info);
    }
    console.log(info);
    this.setCampaignInfo(info);
  }

  /**
   * Set the [content groups](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cg_) parameter.
   * @param {string[]|string} contentGroups array of content group strings (or a single string) (`cg` is an alias)
   * @return {boolean} true if successful, false otherwise
   */
  setContentGroups(contentGroups) {
    const data = joi.validate(
      contentGroups,
      joi.array().label('contentGroups').items(jst()).single().required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ cg: data.value });
    return true;
  }

  /**
   * Remove the [content groups](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#cg_) parameter.
   */
  resetContentGroups() {
    this.removeParam('cg');
  }

  /**
   * Sets custom dimensions. By default, the `storageKey` param is set to `ephemeral`, meaning
   * these dimensions will only be sent with the next event fired. You may change that the
   * `storageParameter` to `persistent` to send these dimensions with all future events. Note
   * that if you set both a persistent dimensions array, and an ephemeral one, the ephemeral
   * one will replace the persistent one on the next event. Then the persisent dimensions will
   * reappear on future events.
   * @param {string[]} dimensions array of dimension strings (alias `cdx`)
   * @param {string} [storageKey=ephemeral] indicates the type of parameter (`ephemeral` or `persistent`)
   * @return {boolean} true if successful, false otherwise
   */
  setCustomDimensions(dimensions, storageKey = 'ephemeral') {
    const data = joi.validate(
      dimensions,
      joi.array().label('dimensions').items(jst().max(150)).required().max(200),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ cdx: data.value }, storageKey);
    return true;
  }

  /**
   * Removes the custom dimensions (`cdx`) parameter from the requested storage (`ephemeral` or `persistent`)
   *  @param {string} [storageKey=ephemeral] indicates the type of parameter (`ephemeral` or `persistent`)
   */
  resetCustomDimensions(storageKey = 'ephemeral') {
    this.removeParam('cdx', storageKey);
  }

  /**
   * Sets custom metrics. By default, the `storageKey` param is set to `ephemeral`, meaning
   * these dimensions will only be sent with the next event fired. You may change that the
   * `storageParameter` to `persistent` to send these dimensions with all future events. Note
   * that if you set both a persistent dimensions array, and an ephemeral one, the ephemeral
   * one will replace the persistent one on the next event. Then the persisent dimensions will
   * reappear on future events.
   * @param {number[]} metrics array of metrics (integers, alias `cmx`)
   * @param {string} [storageKey=ephemeral] indicates the type of parameter (`ephemeral` or `persistent`)
   * @return {boolean} true if successful, false otherwise
   */
  setCustomMetrics(metrics, storageKey = 'ephemeral') {
    const data = joi.validate(
      metrics,
      joi.array().label('metrics').items(joi.number().integer()).required().max(200),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ cmx: data.value }, storageKey);
    return true;
  }

  /**
   * Removes the custom metrics (`cmx`) parameter from the requested storage (`ephemeral` or `persistent`)
   *  @param {string} [storageKey=ephemeral] indicates the type of parameter (`ephemeral` or `persistent`)
   */
  resetCustomMetrics(storageKey = 'ephemeral') {
    this.removeParam('cmx', storageKey);
  }

  /**
   * Sets the document encoding (`de`) parameter.
   * @param {string} encoding the encoding string (ie, 'UTF-8') (`de` is an alias)
   */
  setDocEncoding(encoding) {
    const data = joi.validate(
      encoding,
      jst().label('encoding').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ de: data.value });
    return true;
  }

  /**
   * Resets the document encoding (`de`) parameter based on values in the `document` object. This selects
   * the `document.characterSet`, or the `document.charset` or the `document.inputEncoding`. If none
   * of these are available, it removes the doc encoding parameter.
   */
  resetDocEncoding() {
    const encoding = this._root('document.characterSet') ||
      this._root('document.charset') ||
      this._root('document.inputEncoding');
    if (encoding) {
      this.setDocEncoding(encoding);
    }
    else {
      this.removeParam('de');
    }
  }

  /**
   * Sets the document title (`dt`) parameter.
   * @param {string} title the title
   * @return {boolean} true if successful, false otherwise
   */
  setDocTitle(title) {
    const data = joi.validate(
      title,
      jst().required().label('title'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ dt: data.value });
    return true;
  }

  /**
   * Resets the document title from the global `document.title`, if available, or removes the title
   * parameter.
   */
  resetDocTitle() {
    const title = this._root('document.title');
    if (title) {
      this.setDocTitle(title);
    }
    else {
      this.removeParam('dt');
    }
  }

  /**
   * An experiment info object.
   * @typedef {object} ExperimentObject
   * @property {string} expId the experiment id (alias `xid`)
   * @property {string} expVariant the experiment variant (alias `xvar`)
   */

  /**
   * Sets the content [experiment](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#experiments) parameters.
   * @param {ExperimentObject} experimentObject
   * @return {boolean} true if successful, false otherwise
   */
  setExperiment(experimentObject) {
    const data = joi.validate(
      experimentObject,
      joi.object().keys({
        xid: jst().required().label('expId'),
        xvar: jst().label('expVariant')
      }).required()
        .label('experimentObject')
        .rename('expId', 'xid')
        .rename('expVariant', 'xvar'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value);
    return true;
  }

  /**
   * Removes the [content experiment](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#experiments) parameters.
   */
  resetExperiment() {
    this.removeParams(['xid', 'xvar']);
  }

  /**
   * Sets the [geographical override](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#geoid) parameter.
   * @param {string} geoId a valid 2 letter country code of a google geographic criterion id (`geoid` is alias)
   * @return {boolean} true if successful, false otherwise
   */
  setGaGeoId(geoId) {
    const data = joi.validate(
      geoId,
      jst().label('geoId').regex(/^([A-Z]{2}|\d+)$/).required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ geoid: data.value });
    return true;
  }

  /**
   * Removes the [geographical override](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#geoid) parameter.
   */
  resetGaGeoId() {
    this.removeParam('geoid');
  }

  /**
   * Sets the [google analytics tracking/property id](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tid) parameter.
   * Having this parameter allows us to forward our collected clickstream parameters to google analytics for clients that use that service.
   * @param {string} trackingId the id in UA-XXXXxxxxxx-Yyyy format (`tid` is alias)
   * @return {boolean} true if successful, false otherwise
   */
  setGaTrackingId(trackingId) {
    const data = joi.validate(
      trackingId,
      jst().label('trackingId').regex(/^UA-\d{4,10}-\d{1,4}$/).required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ tid: data.value });
    return true;
  }

  /**
   * Remove the [google analytics tracking/property id](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#tid) property.
   */
  resetGaTrackingId() {
    this.removeParam('tid');
  }

  /**
   * Set the [java enabled](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#je) (`je`) property.
   * @param {boolean} enabled true if java is enabled, false otherwise (`je` is alias)
   * @return {boolean} true if successful, false otherwise
   */
  setJavaEnabled(enabled) {
    const data = joi.validate(
      enabled,
      joi.boolean().label('enabled').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ je: data.value });
    return true;
  }

  /**
   * Resets the [java enabled](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#je) (`je`) property
   * based on the global `navigator.javaEnabled()` function if available, otherwise set to false.
   */
  resetJavaEnabled() {
    const je = this._root('navigator.javaEnabled') || false;
    this.setJavaEnabled(typeof je === 'function' ? je.apply(this._root('navigator')) : je);
  }

  /**
   * Set the logged in user id (`uid`) parameter.
   * @param {string} userId the user id (`uid` is an alias)
   * @return {boolean} true if successful, false otherwise
   */
  setUserId(userId) {
    const data = joi.validate(
      userId,
      jst().label('userId').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ uid: data.value });
    return true;
  }

  /**
   * Remove the user id (`uid`) parameter.
   */
  resetUserId() {
    this.removeParam('uid');
    this._parseUserId();
  }

  /**
   * Internal method that looks for a keycloak cookie and parses the logged in user id from
   * it. This happens automatically at startup (if you haven't already set a user id manually
   * in the config options) and whenever `resetUserId()` is called. This routine looks first
   * for the cookie set by the `keycloakCookie` option (which defaults to `_rtok`). It assumes
   * the cookie named by `keycloakCookie` is a JWT token with a `sub` key in the payload that
   * identifies the current keycloak user. If it doesn't find that cookie, it looks for a
   * cookie called `KEYCLOAK_SESSION`, which is a keycloak session cookie available in the keycloak
   * server web pages.
   */
  _parseUserId() {
    const cookie = this._root('document.cookie');
    if (cookie) {
      each(cookie.split(/; */), (c) => {
        const [key, value] = c.split('=');
        if (key === this.keycloakCookie) {
          const token = value.split('.')[1];
          try {
            const jwtPayload = JSON.parse(atob(token));
            this._log('jwt payload=',jwtPayload);
            const subject = jwtPayload.sub;
            if (subject) {
              this.updateParams({ uid: subject });
              this._log('extracted user id from jwt token', subject);
            }
            else {
              this._log('WARNING: no subject found in jwt token');
            }
          }
          catch (ex) {
            this._log('failed to extract user id from jwt token', ex);
          }
        }
        else if (key === 'KEYCLOAK_SESSION') {
          const sessionUserId = decodeURIComponent(value).split('/')[1];
          this.updateParams({ uid: sessionUserId });
          return false;
        }
      });
    }
  }

  /**
   * Set the user language (`ul`) parameter.
   * @param {string} language a language/locale/culture code (`ul` is an alias)
   * @return {boolean} true if successful, false otherwise
   */
  setUserLanguage(language) {
    const data = joi.validate(
      language,
      jst().label('language').regex(/^[a-z]{2,3}(-[A-Z]{2,3})?(-[A-Za-z]{2,4})?$/).required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ ul: data.value });
    return true;
  }

  /* Reset the user language (`ul`) parameter. This method looks in `navigator.language`,
   * `navigator.userLanguage`, and `navigator.browserLanguage` if available, or removes the
   * parameter setting.
   */
  resetUserLanguage() {
    const language = this._root('navigator.language') ||
      this._root('navigator.userLanguage') ||
      this._root('navigator.browserLanguage');
    if (language) {
      this.setUserLanguage(language);
    }
    else {
      this.removeParam('ul');
    }
  }

  /**
   * Set the GA data source (`web` is browser default, `app` is mobile default).
   * @param {string} source the source
   * @return {boolean} true if successful, false otherwise
   */
  setGaDataSource(source) {
    const data = joi.validate(
      source,
      jst().label('source').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ ds: data.value });
    return true;
  }

  /**
   * Resets the data source to `web`.
   */
  resetGaDataSource() {
    this.updateParam('ds', this.isReactNative ? 'app' : 'web');
  }

  /**
   * Resets the screen color depth.
   */
  resetColorDepth() {
    this.updateParam('sd', this._root('screen.colorDepth',24));
  }

  /**
   * Sets the google adwords customer id.
   * @param {string} id the adwords customer id
   * @return {boolean} true if successful, false otherwise
   */
  setGaAdwordsId(id) {
    const data = joi.validate(
      id,
      jst().label('id').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ gclid: data.value });
    return true;
  }

  /**
   * Reset the google adwords customer id.
   */
  resetGaAdwordsId() {
    this.removeParam('gclid');
    if (has(this.queryArgs, 'gclid')) {
      this.updateParam('gclid', this.queryArgs['gclid']);
    }
  }

  /**
   * Sets the google display ads id.
   * @param {string} id the display ad id
   * @return {boolean} true if successful, false otherwise
   */
  setGaDisplayAdsId(id) {
    const data = joi.validate(
      id,
      jst().label('id').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ dclid: data.value });
    return true;
  }

  /**
   * Remove the google display ad id.
   */
  resetGaDisplayAdsId() {
    this.removeParam('dclid');
  }

  /**
   * Sets the link id (`linkid`) parameter in ephemeral storage. This is probably easier
   * to add to a particular `fireXXX()` method as an extra parameter using the key `linkid`,
   * but this method is here for consistency.
   * @param {string} id the link id
   * @return {boolean} true if successful, false otherwise
   */
  setLinkId(id) {
    const data = joi.validate(
      id,
      jst().label('id').required(),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams({ linkid: data.value }, 'ephemeral');
    return true;
  }

  /**
   * Remove the link id from ephemeral storage.
   */
  resetLinkId() {
    this.removeParam('linkid', 'ephemeral');
  }

  /**
   * Sets the non-interactive parameter to true in ephemeral params.
   * @return {boolean} always returns true
   */
  setNoninteractive() {
    this.updateParam('ni', true, 'ephemeral');
    return true;
  }

  /**
   * Removes the non-interactive key from ephemeral parameters.
   */
  resetNoninteractive() {
    this.removeParam('ni', 'ephemeral');
  }

  /**
   * Fires an event of the given type with the given parameters. If appropriate, the event
   * will be queued for firing later. Always returns true, indicating that no validation of
   * the passed in data happened, meaning no validation errors could occur.
   * @param {string} eventType the type of clickstream event
   * @param {object=} eventParams any additional parameters to send to divolte, in addition to
   *   previously accumulated params
   * @return {boolean} true always (since no validation happens on this method)
   */
  fire(eventType, eventParams) {
    this._execOrQueue(function () { this._fire(eventType, eventParams); });
    return true;
  }

  /**
   * Internal method to fire an event, either immediately or after having been flushed from
   * the queue. This method will postpone (via `setTimeout()`, but not re-queue) the firing of
   * the event, up to the `maxGeoWaitTime` option, if we are waiting to resolve the geo location
   * of the user. Otherwise, this method merges the stored `customParameters`, a current 'time
   * since page load' (`tspl`) parameter, and finally any extra params in `eventParams` and
   * invoke divolte's `signal()` method to actually send this to the divolte collector.
   * @param {string} eventType the type of clickstream event
   * @param {object=} eventParams any additional parameters to send to divolte, in addition to
   *   the ones already stored in `customParameters`
   */
  _fire(eventType, eventParams) {
    if (this._waitOnGeo && this._runDuration() < this.geoWaitTime) {
      setTimeout(function () {
        this._fire(eventType, eventParams);
      }.bind(this), 50);
    } else {
      const input = this.params;

      // assemble the values to emit
      const output = omitBy(assign({},
        input.persistent,
        input.ephemeral,
        input.products.length ? { pr: input.products } : {},
        input.promotions.length ? { promo: input.promotions } : {},
        input.impressions.length ? { il: input.impressions } : {},
        this._tspl(),
        eventParams
      ), isNil);

      this._log(`emit[${eventType}]${JSON.stringify(output)}`);

      // send it to divolte
      const jsonSignal = this.jsonSignal.bind(this);
      const signal = this.useJsonEndpoint ? jsonSignal : this._root('divolte.signal', jsonSignal);
      signal(eventType, output);

      // forget the ephemeral params
      input.ephemeral = {};
      input.products = [];
      input.promotions = [];
      input.impressions = [];
    }
  }

  /**
   * Send a fired signal to the divolte json endpoint.
   * @param {string} eventType the type of clickstream event
   * @param {object=} eventParams any additional parameters to send to divolte, in addition to
   *   the ones already stored in `customParameters`
   * @param {number} [callCount=0] supports waiting to fire the signal until a party identifier
   *      is provided by the storage mechanism (up to 10 secs)
   */
  jsonSignal(eventType, params, callCount = 0) {
    const jsig = this.jsonSignal.bind(this);
    // wait up to 10 secs for party id to be pulled from storage
    if (!this.party.id) {
      if (callCount < 100) {
        setTimeout(() => {
          jsig(eventType, params, ++callCount);
        }, 100);
        return;
      }
      // as last resort, just generate a new one (because the storage mech is broken i guess?)
      else {
        this.party.id = genDivolteId();
        this.partyIsNew = true;
      }
    }
    this._updateSession();

    const _log = this._log.bind(this);
    const self = this;
    const payload = JSON.stringify({
      session_id: this.session.id,
      event_id: id64t(),
      is_new_party: this.partyIsNew,
      is_new_session: this.sessionIsNew,
      client_timestamp_iso: new Date().toISOString(),
      event_type: eventType,
      parameters: params
    });
    _log(`sending event to json endpoint (party=${this.party.id}, payload=${payload})`);
    fetch(`${this.jsonEndpoint}?p=${this.party.id}`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: payload
    }).then((response) => {
      if (response.status !== 204) {
        const error = new Error(response.statusText);
        error.response = response;
        this.error = error;
        throw error;
      }
      else {
        self.partyIsNew = false;
        self.sessionIsNew = false;
        self.jsonSignalCount++;
      }
    }).catch(_log);
  }

  /**
   * Internal method to check if any data validation errors have occurred during a set() or fire() method,
   * and set the error object appropriately and returns true if errors occurred, false otherwise.
   * @param {object} data the data object response from a joi validation method
   * @param {object|null} error a joi validation error object or null if no error occurred
   * @param {any} value the value after joi validation
   * @return {boolean} true if the data had validation errors, false otherwise
   */
  _isInvalid(data) {
    if (data.error) {
      const details = data.error.details;
      this.error = {
        messages: details.map(e => e.message),
        keys: uniq(details.map(e => e.context.key))
      };
      this._log(this.error);
      // send exception to clickstream
      if (this.sendAutoExceptions) {
        this.fire('exception',{ds:'clickstream',exd:JSON.stringify(this.error), exf:false});
      }
      return true;
    }
    else {
      this.error = null;
      return false;
    }
  }

  /**
   * A parameter object for clickstream events of type `pageview`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} PageViewObject
   * @property {page=} page url of the page being viewed (defaults to location.href)
   */

  /**
   * Fire a [pageview hit](http://www.google.com).
   * @param {PageViewObject=} info
   * @return {boolean} true if successful, false if not
   */
  firePageView(info) {

    if (this._pageViewEventFired && !this.allowMultiplePageViews) {
      this._log('page view event already fired');
      return;
    }

    info = info || { page: this.autoPageViewPage };

    const data = joi.validate(
      info,
      joi.object().keys({
        page: jst().required()
      }),
      { allowUnknown: true, abortEarly: false }
    );

    if (this._isInvalid(data)) {
      return false;
    }

    // we need the page performance timing numbers, so we can't fire this before page is loaded
    if (!this._isPageLoaded()) {
      setTimeout(() => {
        this.firePageView(info);
      }, 10);
      return true;
    }

    // otherwise, fire it
    this._pageViewEventFired = true;
    this.fire('pageview', assign(
      {},
      this._getPageLoadTiming(),
      data.value
    ));
    return true;
  }

  /**
   * Page Load Timing object definition. These computations are based on the
   * [performance api](https://developer.mozilla.org/en-US/docs/Web/API/Performance), if
   * its available.
   * @typedef {object} PageLoadTimingObject
   * @property {number} plt page load time (`loadEvent - navigationStart`)
   * @property {number} pdt page down load time (`responseEnd - responseStart`)
   * @property {number} pln page load/network time (`(requestStart - navigationStart) +
        (responseEnd - responseStart)`)
   * @property {number} pls page load/server time (`responseStart - requestStart`)
   * @property {number} pld page load/content time (`domContentLoadedEventStart - responseEnd`)
   * @property {number} plf page load/fronteend time (`loadEventEnd - domContentLoadedEventStart`)
   * @property {number} dns dns time (`domainLookupEnd - domainLookupStart`)
   * @property {number} rrt redirect time (`redirectEnd - redirectStart`)
   * @property {number} tcp connect time (`connectEnd - connectStart`)
   * @property {number} srt source response time (`responseEnd - connectEnd`)
   * @property {number} dit dom interactive time (`domInterative - navigationStart`)
   * @property {number} clt content load time (`domContentLoadedEventStart - navigationStart`)
   */

  /**
   * Compute page load timing parameters using the performance api, if available.
   * @return {PageLoadTimingObject} timing object
   */
  _getPageLoadTiming() {
    const timing = {};
    const pt = this._root('performance.timing');
    if (pt) {
      timing.plt = pt.loadEventEnd - pt.navigationStart;
      timing.pdt = pt.responseEnd - pt.responseStart;
      timing.dns = pt.domainLookupEnd - pt.domainLookupStart;
      timing.rrt = pt.redirectEnd - pt.redirectStart;
      timing.tcp = pt.connectEnd - pt.connectStart;
      timing.srt = pt.responseEnd - pt.connectEnd;
      timing.dit = pt.domInteractive - pt.navigationStart;
      timing.clt = pt.domContentLoadedEventStart - pt.navigationStart;
      timing.pln = (pt.requestStart - pt.navigationStart) +
        (pt.responseEnd - pt.responseStart);
      timing.pls = pt.responseStart - pt.requestStart;
      timing.pld = pt.domContentLoadedEventStart - pt.responseEnd;
      timing.plf = pt.loadEventEnd - pt.domContentLoadedEventStart;
    }
    return timing;
  }

  /**
   * A parameter object for clickstream events of type `screenview`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} ScreenViewObject
   * @property {screen} name of the screen being viewed (alias `cd`)
   */

  /**
   * Fire a [`screenview` event](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#screenview).
   *
   * In addition to the key described below, you can set other keys in
   * `info` to have them sent with the event. These extra keys must be compatiable with the divolte
   * collector's schema to be received and properly stored.
   * @param {ScreenViewObject} info
   * @return {boolean} true if successful, false if not
   */
  fireScreenView(info) {
    const data = joi.validate(
      info,
      joi.object().keys({
        cd: jst().label('screen').required()
      }).required()
        .label('screenObject')
        .rename('screen', 'cd'),
      { allowUnknown: true, abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.fire('screenview', data.value);
    return true;
  }

  /**
   * A parameter object for clickstream events of type `event`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} EventInfo
   * @property {string} category the category of the event (`ec` is an alias)
   * @property {string} action the action of the event (`ea` is an alias)
   * @property {string=} label a label for the event (`el` is an alias)
   * @property {number=} value an integer value for the event (`ev` is an alias)
   */

  /**
   * Fire a [custom event](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#events).
   * @param {EventObject} info
   * @return {boolean} true if successful, false if not
   */
  fireEvent(info) {
    const data = joi.validate(
      info,
      joi.object().keys({
        ec: jst().label('category').required(),
        ea: jst().label('action').required(),
        el: jst().label('label'),
        ev: joi.number().integer().label('value')
      }).label('eventObject')
        .required()
        .rename('category', 'ec')
        .rename('action', 'ea')
        .rename('label', 'el')
        .rename('value', 'ev'),
      {
        allowUnknown: true,
        abortEarly: false
      }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.fire('event', data.value);
    return true;
  }

  /**
   * A parameter object for clickstream events of type `social`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} SocialObject
   * @property {string}  network the social network (`sn` is an alias)
   * @property {string}  action  the social action involved (`sa` is an alias)
   * @property {string}  target  the target of the action (usually a uri, `st` is an alias)
   */

  /**
   * Fire a [social event](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#social).
   * @param {SocialObject} info
   * @return {boolean} true if successful, false if not
   */
  fireSocial(info) {
    const data = joi.validate(
      info,
      joi.object().keys({
        sn: jst().label('network').required(),
        sa: jst().label('action').required(),
        st: jst().label('target').required()
      }).required()
        .label('socialObject')
        .rename('network', 'sn')
        .rename('action', 'sa')
        .rename('target', 'st'),
      { allowUnknown: true, abortEarly: false }
    );

    if (this._isInvalid(data)) {
      return false;
    }

    this.fire('social', data.value);
    return true;
  }

  /**
   * A parameter object for clickstream events of type `exception`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} ExceptionObject
   * @property {string}   message the exception message (`exd` is alias)
   * @property {boolean=} fatal true if the exception was fatal, false otherwise (`exf` is alias)

 */
  /**
   * Fire an [exception event](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#exception).
   * @param {ExceptionObject} info
   * @return {boolean} true if successful, false if not
   */
  fireException(info) {
    const data = joi.validate(
      info,
      joi.object().keys({
        exd: jst().label('message').required(),
        exf: joi.boolean().label('fatal').optional().default(false),
      }).required()
        .label('exceptionObject')
        .rename('message', 'exd')
        .rename('fatal', 'exf'),
      { allowUnknown: true, abortEarly: false }
    );

    if (this._isInvalid(data)) {
      return false;
    }
    this.fire('exception', data.value);
    return true;
  }

  /**
   * A parameter object for clickstream events of type `timing`.
   *
   * Any other parameters are allowed here as well, so long as their keys and values
   * are consistent with the target divolte schema and mapping.
   * @typedef {object} TimingObject
   * @param {string}  category the timing category (`utc` is an alias)
   * @param {string}  variable the timing variable measured (`utv` is an alias)
   * @param {number}  time the timing value (integer millis unix epoch, `utt` is an alias)
   * @param {string=} label an optional label (`utl` is an alias)
   */

  /**
   * Fire a [timing event](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters#timing).
   * @param {TimingObject} info
   * @return {boolean} true if successful, false if not
   */
  fireTiming(info) {
    const data = joi.validate(
      info,
      joi.object().keys({
        utc: jst().label('category').required(),
        utv: jst().label('variable').required(),
        utt: joi.number().integer().label('time').required().positive(),
        utl: jst().label('label').optional(),
      }).required()
        .label('timingObject')
        .rename('category', 'utc')
        .rename('variable', 'utv')
        .rename('time', 'utt')
        .rename('label', 'utl'),
      { allowUnknown: true, abortEarly: false }
    );

    if (this._isInvalid(data)) {
      return false;
    }
    this.fire('timing', data.value);
    return true;
  }

  /**
   * A product impression is a view or a click on some product information present on the page.
   * Product impressions are usually organized in a list.
   * @typedef {object} ImpressionObject
   * @property {string}   list the impression list name (alias `ilmn`)
   * @property {string}   id the product id
   * @property {string}   name the name of the product (alias `nm`)
   * @property {string}   category the product category (alias `ca`)
   * @property {number}   price the product price (alias `pr`)
   * @property {string=}  brand the brand of the product (alias `br`)
   * @property {string=}  variant the variant of the product (alias `va`)
   * @property {number=}  position the position of the impression in its impression list (alias `ps`)
   * @property {string[]} dimensions custom dimensions (alias `cd`)
   * @property {number[]} metrics custom metrics (alias `cm`)
   */

  /**
   * Add a product impression. This adds the impression to the ephemeral parameters that will be
   * sent with the next event.
   * @param {ImpressionObject} impressionObject
   * @return {boolean} true if successful, false otherwise
   */
  addImpression(impressionObject) {
    const data = joi.validate(
      impressionObject,
      joi.object().keys({
        ilnm: jst().label('list'),
        id: jst().required(),
        nm: jst().label('name').required(),
        ca: jst().label('category').required(),
        pr: joi.number().label('price'),
        br: jst().label('brand'),
        va: jst().label('variant'),
        ps: joi.number().integer().positive().label('position'),
        cd: joi.array().label('dimensions').items(jst().required()).max(200),
        cm: joi.array().label('metrics').items(joi.number().integer().required()).max(200)
      }).required()
        .label('impressionObject')
        .rename('list', 'ilnm')
        .rename('name', 'nm')
        .rename('category', 'ca')
        .rename('price', 'pr')
        .rename('brand', 'br')
        .rename('variant', 'va')
        .rename('position', 'ps')
        .rename('dimensions', 'cd')
        .rename('metrics', 'cm'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value, 'impressions');
    return true;
  }

  /**
   * An impression list object.
   * @typedef {object} ImpressionListObject
   * @property {string} name the name of the list
   * @property {ImpressionObject[]} impressions the impression objects
   */

  /**
   * Returns the current list of ephemeral impression object lists.
   * @return {ImpressionListObject[]} an array of impression object lists
   */
  getImpressions() {
    return this.getParams('impressions');
  }

  /**
   * Remove the current list of ephemeral impression objects.
   */
  resetImpressions() {
    this.params.impressions = [];
  }

  /**
   * A product that is part of a clickstream event.
   * @typedef {object} ProductObject
   * @property {string}  id the product id
   * @property {string}  name the product name (alias `nm`)
   * @property {string}  category the product category (alias `ca`)
   * @property {number}  price the product price (alias `pr`)
   * @property {number=} quantity the amount of the product (for add/remove/purchase/refund actions, alias `qt`)
   * @property {string=} brand the brand of the product (alias `br`)
   * @property {string=} variant the variant of the product (alias `va`)
   * @property {string=} coupon the coupon associated with the product (alias `cc`)
   * @property {number=}  position the position of the product in the list (alias `ps`)
   * @property {string[]} dimensions custom dimensions (alias `cd`)
   * @property {number[]} metrics custom metrics (alias `cm`)
   */

  /**
   * Add a product. This adds the product to the ephemeral parameters that will be
   * sent with the next event.
   * @param {ProductObject}  productObject the product info
   * @return {boolean} true if successful, false otherwise
   */
  addProduct(productObject) {
    const data = joi.validate(
      productObject,
      joi.object().keys({
        id: jst().label('id').required(),
        nm: jst().label('name').required(),
        ca: jst().label('category').required(),
        pr: joi.number().label('price').required().positive(),
        qt: joi.number().integer().label('quantity').positive(),
        br: jst().label('brand'),
        va: jst().label('variant'),
        cc: jst().label('coupon'),
        ps: joi.number().integer().label('position').positive(),
        cd: joi.array().label('dimensions').items(jst().required()).max(200),
        cm: joi.array().label('metrics').items(joi.number().integer().required()).max(200)
      }).required()
        .label('productObject')
        .rename('name', 'nm')
        .rename('category', 'ca')
        .rename('price', 'pr')
        .rename('quantity', 'qt')
        .rename('brand', 'br')
        .rename('variant', 'va')
        .rename('coupon', 'cc')
        .rename('position', 'ps')
        .rename('dimensions', 'cd')
        .rename('metrics', 'cm'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value, 'products');
    return true;
  }

  /**
   * Returns the current list of ephemeral product objects.
   * @return {ProductObject[]} an array of product objects
   */
  getProducts() {
    return this.getParams('products');
  }

  /**
   * Remove the current list of ephemeral product objects.
   */
  resetProducts() {
    this.params.products = [];
  }

  /**
   * A promotion object included with a clickstream event.
   * @typedef {object} PromoObject
   * @property {string}  id the id of the promotion
   * @property {string}  name the name of the promotion (alias `nm`)
   * @property {string=} creative the creative associated with the promotion (alias `cr`)
   * @property {string=} position the position of the creative on the page (alias `ps`)
   */

  /**
   * Add a promotion. This adds the promotion to the ephemeral parameters that will be
   * sent with the next event.
   * @param {PromoObject} promoObject
   * @return {boolean} true if successful, false otherwise
   */
  addPromotion(promoObject) {
    const data = joi.validate(
      promoObject,
      joi.object().keys({
        id: jst().label('id').required(),
        nm: jst().label('name').required(),
        cr: jst().label('creative'),
        ps: jst().label('position')
      }).required()
        .label('promoObject')
        .rename('name', 'nm')
        .rename('creative', 'cr')
        .rename('position', 'ps'),
      { abortEarly: false }
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value, 'promotions');
    return true;
  }

  /**
   * Returns the current list of ephemeral promotion objects.
   * @return {PromoObject[]} an array of promotion objects
   */
  getPromotions() {
    return this.getParams('promotions');
  }

  /**
   * Remove the current list of ephemeral promotion objects.
   */
  resetPromotions() {
    this.params.promotions = [];
  }

  /**
   * A product action object to define details of a clickstream event related to a product
   * action.
   * @typedef {object} ActionObject
   * @property {string}  action one of the product actions listed above (required, `promoa` is alias for `promo_click` actions, `pa` is alias for other actions)
   * @property {string=} list the list underlying the action (valid for `click` and `detail` actions, `pal` is an alias)
   * @property {number=} step the checkout step number (valid for `checkout` and `checkout_option` actions, `cos` is an alias)
   * @property {string=} option the checkout option (valid for `checkout` and `checkout_option` actions, `coo` is an alias)
   * @property {string=} id the transaction id (valid/required for `purchase` and `refund` actions, `ti` is an alias)
   * @property {string=} affiliation the transaction affiliation (valid for `purchase` and `refund` actions, `ta` is an alias)
   * @property {number=} revenue transaction revenue (valid for `purchase` and `refund` actions, `tr` is an alias)
   * @property {number=} shipping transaction shipping (valid for `purchase` and `refund` actions, `ts` is an alias)
   * @property {number=} tax transaction tax (valid for `purchase` and `refund` actions, `tt` is an alias)
   * @property {string=} coupon transaction coupon code (valid for `purchase` and `refund` actions, `tcc` is an alias)
   */

  /**
   * Set a product action. Possible actions are:
   *  - *click*	- A click on a product or product link for one or more products.
   *  - *detail* - A view of product details.
   *  - *add* -	Adding one or more products to a shopping cart.
   *  - *remove* - Remove one or more products from a shopping cart.
   *  - *checkout* - Initiating the checkout process for one or more products.
   *  - *checkout_option* - Sending the option value for a given checkout step.
   *  - *purchase* - The sale of one or more products.
   *  - *refund* - The refund of one or more products.
   *  - *promo_click* - A click on an internal promotion.
   *
   * This method adds the action and any additional parameters to the ephemeral parameters that will
   * be sent with the next event.
   * @param {ActionObject} actionObject
   * @return {boolean} true if successful, false otherwise
   */
  setProductAction(actionObject) {
    const data = joi.validate(
      actionObject,
      joi.alternatives().try(
        // click or detail actions
        joi.object().keys({
          pa: jst().label('action').valid(['click', 'detail']).required(),
          pal: jst().label('list')
        }).label('actionObject')
          .rename('action', 'pa')
          .rename('list', 'pal'),
        // add/remove from cart
        joi.object().keys({
          pa: jst().label('action').valid(['add', 'remove']).required()
        }).label('actionObject')
          .rename('action', 'pa'),
        // checkout/checkout_option
        joi.object().keys({
          pa: jst().label('action').valid('checkout').required(),
          cos: joi.number().integer().positive().required(),
          col: jst()
        }).label('actionObject')
          .rename('action', 'pa')
          .rename('step', 'cos')
          .rename('option', 'col'),
        // checkout_option
        joi.object().keys({
          pa: jst().label('action').valid('checkout_option').required(),
          cos: joi.number().integer().positive().required(),
          col: jst().required()
        }).label('actionObject')
          .rename('action', 'pa')
          .rename('step', 'cos')
          .rename('option', 'col'),
        // purchase/refund
        joi.object().keys({
          pa: jst().label('action').valid(['purchase', 'refund']).required(),
          ti: jst().required(),
          ta: jst(),
          tr: joi.number().required(),
          ts: joi.number(),
          tt: joi.number(),
          tcc: jst()
        }).label('actionObject')
          .rename('action', 'pa')
          .rename('id', 'ti')
          .rename('affiliation', 'ta')
          .rename('revenue', 'tr')
          .rename('shipping', 'ts')
          .rename('tax', 'tt')
          .rename('coupon', 'tcc'),
        // promotion click
        joi.object().keys({
          promoa: jst().label('action').valid('promo_click').required(),
        }).rename('action', 'promoa')
      ).required()
        .label('actionObject')
    );
    if (this._isInvalid(data)) {
      return false;
    }
    this.updateParams(data.value, 'ephemeral');
    return true;
  }

  /**
   * Reset product action parameters.
   */
  resetProductAction() {
    this.removeParams(['pa', 'promoa', 'pal', 'cos', 'col', 'ti', 'ta', 'tr', 'ts', 'tt', 'tcc'], 'ephemeral');
  }

}

/**
 * Exported factory to produce new `Clickstream` instances.
 */
export function factory(config) {
  return new Clickstream(config);
}
