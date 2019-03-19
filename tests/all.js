import test from 'tape';
import { each, omit, assign, has, isNumber, isPlainObject, isArray, keys, values } from 'lodash';
import { mocks } from 'mock-browser';
import MemoryStorage from '../src/MemoryStorage';
import * as Clickstream from '../src/clickstream';

let fireHistory = [];

const mockWindow = mocks.MockBrowser.createWindow();
mockWindow.divolte = {
  signal: (type, params) => {
    if (!(type === 'exception' && params && params.ds === 'clickstream')) {
      fireHistory.push([type, params]);
    }
  }
};
mockWindow.console = console;

const storage = new MemoryStorage();
const testState = {
  persistent: { a: 1, b: '2', c: 3, d: true },
  ephemeral: { e: 5, f: '6' }
};
storage.setItem('__c_s_r__s_t_a_t_e__',JSON.stringify(testState));

const loggingOption = false;
if (loggingOption) {
  console.log('initializing clickstream...');
}
const options = {
  root: mockWindow,
  usefp: false,
  useIpify: false,
  useUserAgentParser: false,
  //userId: 'testy',
  //appInfo: { id: 'app', name: 'the app' },
  logging: loggingOption,
  geoWaitTime: 0,
  sendAutoExceptions: false,
  syncStorage: storage,
  allowMultiplePageViews: true,
  pageLoadedMethod: function () { return true; }
};
const cs = Clickstream.factory(options);

const testSetReset = (t, func, params, setValues, resetValues, expectedMissing, storageKey) => {
  const setter = cs[`set${func}`];
  const resetter = cs[`reset${func}`];
  const keyset = keys(params);
  const notObj = !isPlainObject(setValues);
  if (notObj) {
    const obj = {};
    keyset.forEach((k) => { obj[k] = setValues; });
    setValues = obj;
  }
  if (typeof resetValues !== 'object') {
    const obj = {};
    keyset.forEach((k) => { obj[k] = resetValues; });
    resetValues = obj;
  }
  const result = setter.apply(cs, notObj ? values(setValues) : [setValues]);
  const actualProblems = result ? [] : cs.error.keys;
  if (actualProblems.length) {
    //console.log(cs.error);
  }
  const expectedProblems = expectedMissing ? expectedMissing : [];
  t.deepEqual(actualProblems, expectedProblems, 'expected exceptions');
  if (result) {
    keyset.forEach((k) => {
      const val = setValues[k];
      const eq = typeof val === 'object' ? 'deepEqual' : 'equal';
      t[eq](cs.getParam(params[k],storageKey), val, `set${func}(${k}=${val};${storageKey})`);
    });
    resetter.apply(cs);
    keyset.forEach((k) => {
      const val = resetValues[k];
      const eq = typeof val === 'object' ? 'deepEqual' : 'equal';
      t[eq](cs.getParam(params[k],storageKey), val, `reset${func}(${params[k]};${storageKey})`);
    });
  }
};

const testAddPPI = (t, func, setValues, expectedMissing) => {
  const params = {
    Product: {
      id: 'id',
      name: 'nm',
      category: 'ca',
      price: 'pr',
      quantity: 'qt',
      brand: 'br',
      variant: 'va',
      coupon: 'cc',
      position: 'ps',
      dimensions: 'cd',
      metrics: 'cm'
    },
    Impression: {
      list: 'ilnm',
      id: 'id',
      name: 'nm',
      category: 'ca',
      price: 'pr',
      brand: 'br',
      variant: 'va',
      position: 'ps',
      dimensions: 'cd',
      metrics: 'cm'
    },
    Promotion: {
      id: 'id',
      name: 'nm',
      creative: 'cr',
      position: 'ps'
    }
  }[func];
  const setter = cs[`add${func}`];
  const getter = cs[`get${func}s`];
  const resetter = cs[`reset${func}s`];
  const keyset = keys(params);
  const result = setter.apply(cs, isArray(setValues) ? setValues : [setValues]);
  const actualProblems = result ? [] : cs.error.keys;
  const expectedProblems = expectedMissing ? expectedMissing : [];
  //if (actualProblems.length) {
  //  console.log(actualProblems);
  //  console.log(expectedProblems);
  //}
  t.deepEqual(actualProblems, expectedProblems, 'expected exceptions');
  if (result) {
    let objs = getter.apply(cs);
    if (func === 'Impression') {
    //console.log(JSON.stringify(objs));
      objs = objs[0].im;
    }
    t.equal(isArray(objs),true,'is array');
    t.equal(objs.length,1,`one ${func} objects`);
    keyset.forEach((k) => {
      const val = setValues[k];
      t.equal(objs[0][params[k]], val, `add${func}(${k}=${val})`);
    });
    resetter.apply(cs);
    objs = getter.apply(cs);
    t.equal(isArray(objs),true,'is array');
    t.equal(objs.length,0,`zero ${func} objects`);
  }
};

const testFire = (t, func, args, expectedMissing, expectedType, expectedParams) => {
  fireHistory = [];
  const fireType = `fire${func}`;
  const fireFunc = cs[fireType];
  const result = fireFunc.apply(cs, isArray(args) ? args : [args]);
  const actualProblems = result ? [] : cs.error.keys;
  if (actualProblems.length) {
    //console.log(cs.error);
  }
  const expectedProblems = expectedMissing ? expectedMissing : [];
  t.deepEqual(actualProblems, expectedProblems, 'expected exceptions');
  t.equal(fireHistory.length, expectedProblems.length ? 0 : 1, 'number of events fired');
  if (actualProblems.length === 0) {
    const ev = fireHistory[0];
    t.equal(ev[0], expectedType, `fired ${expectedType} event`);
    let hasIntTspl = has(ev[1], 'tspl') && isNumber(ev[1].tspl);
    t.equal(hasIntTspl, true, 'event has numeric tspl');
    const obj = omit(ev[1], ['tspl']);
    t.deepEqual(obj, expectedParams, 'event has right params');
  }

};

let initParams = {
  de: 'UTF-8',
  je: false,
  ds: 'web',
  ul: 'en-US',
  tz: cs.tz,
  sd: 24,
  cm: '(none)',
  cs: 'direct'
};
if (options.userId) {
  initParams.uid = options.userId;
}
if (options.appInfo) {
  initParams.aid = options.appInfo.id;
  initParams.an = options.appInfo.name;
}
if (options.syncStorage) {
  each(testState.persistent, (v, k) => {
    initParams[k] = v;
  });
}

setTimeout(() => {
  test('get params', (t) => {
    const p = cs.getParams();
    t.deepEqual(p, initParams, 'getParams()');
    t.equal(cs.getParam('de'), 'UTF-8', 'getParam()');
    t.end();
  });
  test('update params', (t) => {
    cs.updateParams({ test: 1 });
    t.equal(cs.getParam('test'), 1, 'updateParams(map w/one key)');
    cs.updateParam('test', 2);
    t.equal(cs.getParam('test'), 2, 'updateParam(name,value)');
    cs.updateParams({ test: 3, ul: 'en-US' });
    t.equal(cs.getParam('test'), 3, 'updateParams(map w/multi keys)');
    t.equal(cs.getParam('ul'), 'en-US', 'updateParams(map w/multi keys)');
    t.end();
  });
  test('remove params', (t) => {
    cs.removeParams(['test']);
    const p = cs.getParams();
    t.equal(p.hasOwnProperty('test'), false, 'removeParams(array)');
    cs.updateParam('test2', 7);
    cs.removeParams('test2');
    t.equal(cs.getParam('test2'), undefined, 'removeParams(string)');
    cs.updateParam('test3', 17);
    cs.removeParam(['test3']);
    t.equal(cs.getParam('test3'), undefined, 'removeParam(array)');
    cs.updateParam('test4', 19);
    cs.removeParam('test4');
    t.equal(cs.getParam('test4'), undefined, 'removeParam(string)');
    t.end();
  });
  test('set/reset', (t) => {
    testSetReset(t, 'UserLanguage', { language: 'ul' }, 'de-DE', 'en-US');
    testSetReset(t, 'DocEncoding', { encoding: 'de' }, 'utf-16', 'UTF-8');
    testSetReset(t, 'DocTitle', { title: 'dt' }, 'shafendorf', undefined);
    testSetReset(t, 'JavaEnabled', { enabled: 'je' }, true, false);
    testSetReset(t, 'UserId', { userId: 'uid' }, 'smith', undefined);
    testSetReset(t, 'GaGeoId', { geoId: 'geoid' }, '123', undefined);
    testSetReset(t, 'GaTrackingId', { trackingId: 'tid' }, 'UA-123456-123', undefined);
    testSetReset(t, 'Experiment',
      { expId: 'xid', expVariant: 'xvar' },
      { expId: '123', expVariant: 'a' },
      undefined
    );
    testSetReset(t, 'AppInfo',
      { id: 'aid', name: 'an', version: 'av', installerId: 'aiid' },
      { id: '123', name: 'blah', version: 'v1.9', installerId: 'jockolocko' },
      undefined
    );
    testSetReset(t, 'CampaignInfo',
      { name: 'cn', source: 'cs', medium: 'cm', keyword: 'ck', content: 'cc' },
      {
        name: 'name', source: 'source', medium: 'medium', keyword: 'key,words',
        content: 'content'
      },
      { source: 'direct', medium: '(none)' }
    );
    testSetReset(t, 'ContentGroups',
      { groups: 'cg' },
      ['a/b/c', 'a/d/f'],
      undefined
    );
    testSetReset(t, 'CustomDimensions',
      { dimensions: 'cdx' },
      ['a','b','c'],
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'CustomMetrics',
      { metrics: 'cmx' },
      [1,2,3],
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'click' },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'click', list: 'yaya' },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'detail' },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'detail', list: 'yaya' },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'checkout', 'step': 1 },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'checkout', 'step': 1, option:'yaya' },
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'checkout_option', 'step': 1},
      undefined,
      ['action','col'],
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'checkout_option', 'step': 1, option: 'fizzy'},
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'add'},
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'remove'},
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'purchase'},
      undefined,
      ['action', 'ti'],
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'purchase', id: 'theid'},
      undefined,
      ['action','tr'],
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'pa' },
      { action: 'purchase', id: 'theid', revenue: 145},
      undefined,
      null,
      'ephemeral'
    );
    testSetReset(t, 'ProductAction',
      { action: 'promoa' },
      { action: 'promo_click' },
      undefined,
      null,
      'ephemeral'
    );
    testAddPPI(t, 'Product', [], ['productObject']);
    testAddPPI(t, 'Product', {}, ['id', 'name', 'category', 'price']);
    testAddPPI(t, 'Product', {id:'myid',name:'myname',category:'mycategory',price:23.34, position:2, coupon:'somecoupon'}, undefined);
    testAddPPI(t, 'Impression', [], ['impressionObject']);
    testAddPPI(t, 'Impression', {}, ['id','name','category']);
    testAddPPI(t, 'Impression', {id:'myid',name:'myname',category:'mycategory'}, undefined);
    testAddPPI(t, 'Promotion', [], ['promoObject']);
    testAddPPI(t, 'Promotion', {}, ['id','name']);
    testAddPPI(t, 'Promotion', {id:'myid',name:'myname'}, undefined);
    t.end();
  });
  test('logging', (t) => {
    t.equal(cs.logging, loggingOption, 'getLogging()');
    cs.logging = !loggingOption;
    t.equal(cs.logging, !loggingOption, `setLogging(${!loggingOption})`);
    cs.logging = loggingOption;
    t.equal(cs.logging, loggingOption, `setLogging(${loggingOption})`);
    t.end();
  });
  test('pause/resume', (t) => {
    t.deepEqual(cs._queuedEvents, [], 'empty queued events to start');
    const prevUid = cs.getParam('uid');
    cs.pause();
    const newUid = 'somenewuser';
    cs.setUserId(newUid);
    t.equal(cs.getParam('uid'), prevUid, 'setUserId after pause');
    const ev = cs._queuedEvents;
    t.equal(typeof ev === 'object' && ev.length === 1, true, 'got one queued event after pause');
    cs.resume();
    t.equal(cs.getParam('uid'), newUid, 'resume()');
    t.deepEqual(cs._queuedEvents, [], 'empty queued events after resume');
    cs.resetUserId();
    t.end();
  });
  test('csr state', (t) => {
    each(testState, (v, k) => {
      const p = cs.getParams(k);
      console.log(k,v,p);
      each(v, (x, y) => {
        t.equal(has(p, y) && p[y] === x, true, `${k}.${y} ok`);
      });
    });
    each(testState.ephemeral, (v, k) => {
      cs.removeParam(k, 'ephemeral');
    });
    t.end();
  });
  test('fire custom event', (t) => {
    testFire(t, '', 'testevent', null, 'testevent', initParams);
    const extraParams = { dog: 1, cat: 2 };
    testFire(t, '', ['test2event', extraParams], null, 'test2event', assign({}, initParams, extraParams));
    t.end();
  });
  test('firePageView', (t) => {
    testFire(t, 'PageView', [], null, 'pageview', assign({}, initParams, {page:'blank'}));
    testFire(t, 'PageView', {}, ['page'], 'pageview', initParams);
    const info = { page: 17 };
    testFire(t, 'PageView', info, ['page'], 'pageview', assign({}, initParams, info));
    info.page = 'mypage';
    testFire(t, 'PageView', info, null, 'pageview', assign({}, initParams, info));
    info.dog = 1;
    info.cat = 2;
    testFire(t, 'PageView', info, null, 'pageview', assign({}, initParams, info));
    t.end();
  });
  test('fireScreenView', (t) => {
    const info = { screen: 'screen' };
    testFire(t, 'ScreenView', [], ['screenObject'], 'screenview', initParams);
    testFire(t, 'ScreenView', {}, ['screen'], 'screenview', initParams);
    testFire(t, 'ScreenView', info, null, 'screenview', assign({}, initParams, { cd: info.screen }));
    const extraParams = { dog: 1, cat: 2 };
    testFire(t, 'ScreenView', assign({}, info, extraParams), null, 'screenview', assign({}, initParams, { cd: info.screen }, extraParams));
    t.end();
  });
  test('fireEvent', (t) => {
    testFire(t, 'Event', [], ['eventObject'], 'event', initParams);
    testFire(t, 'Event', {}, ['category', 'action'], 'event', initParams);
    const obj = { category: 'mycategory', action: 'myaction' };
    testFire(t, 'Event', obj, null, 'event', assign({}, { ec: obj.category, ea: obj.action }, initParams));
    obj.label = 'mylabel';
    obj.value = 'myvalue';
    testFire(t, 'Event', obj, ['value'], 'event', assign({}, { ec: obj.category, ea: obj.action, el: obj.label, ev: obj.value }, initParams));
    obj.value = 17;
    testFire(t, 'Event', obj, null, 'event', assign({}, { ec: obj.category, ea: obj.action, el: obj.label, ev: obj.value }, initParams));
    t.end();
  });
  test('fireSocial', (t) => {
    testFire(t, 'Social', [], ['socialObject'], 'social', initParams);
    testFire(t, 'Social', {}, ['network', 'action', 'target'], 'social', initParams);
    const obj = { network: 'facebook', action: 'like', target: 'http://example.com'};
    testFire(t, 'Social', obj, null, 'social', assign({}, initParams, {sn: obj.network, sa: obj.action, st:obj.target}));
    t.end();
  });
  test('fireException', (t) => {
    testFire(t, 'Exception', [], ['exceptionObject'], 'exception', initParams);
    testFire(t, 'Exception', {}, ['message'], 'exception', initParams);
    const obj = {message: 'warning'};
    testFire(t, 'Exception', obj, null, 'exception', assign({}, initParams, { exd: obj.message, exf: false }));
    obj.message = 'borked!';
    obj.fatal = true;
    testFire(t, 'Exception', obj, null, 'exception', assign({}, initParams, { exd: obj.message, exf: obj.fatal }));
    t.end();
  });
  test('fireTiming', (t) => {
    testFire(t, 'Timing', [], ['timingObject'], 'timing', initParams);
    testFire(t, 'Timing', {}, ['category', 'variable', 'time'], 'timing', initParams);
    const obj = { category: 'cat', variable: 'var', time: 'time' };
    testFire(t, 'Timing', obj, ['time'], 'timing', assign({}, initParams, { utc: obj.category, utv: obj.variable, utt: obj.time }));
    obj.time = 12323432423;
    testFire(t, 'Timing', obj, null, 'timing', assign({}, initParams, { utc: obj.category, utv: obj.variable, utt: obj.time }));
    obj.label = 'yaya';
    testFire(t, 'Timing', obj, null, 'timing', assign({}, initParams, { utc: obj.category, utv: obj.variable, utt: obj.time, utl: obj.label }));
    t.end();
  });
}, 1000);
