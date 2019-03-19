# clickstream.js

Clickstream support for react and react-native applications. This javascript library sends clickstream events to
a divolte server for processing through HDFS and Kafka. It supports a data model compatible with
[google analytics measurement protocol](https://developers.google.com/analytics/devguides/collection/protocol/v1/parameters),
including the following types of clicstream events:

  * pageview
  * screenview
  * event
  * social
  * exception
  * timing

## Install

```bash
yarn add clickstream
```

## View the docs

Once installed, you can view the [api docs](clickstream.html) to learn how to use this library.

```bash
open node_modules/clickstream/docs/index.html
```

## Usage

Once installed, you use the clickstream library like this:

### ES6/React/React Native/Node
```js
import * as Clickstream from 'clickstream';

const cs = Clickstream.factory(options);
```

### ES5/React/Node
```js
var Clickstream = require('clickstream');

var cs = Clickstream.factory(options);
```

### Browser
```html
<script src='/some/path/to/dist/clickstream.bundle.js'></script>
...
<script>
  var cs = Clickstream.factory(options);
</script>
```

The `options` passed into the `factory()` method are described in the [api docs](clickstream.html).

Unless you explicitly disable it (by sending an empty `globalName` option), the created
`cs` object will be installed globally on the `window` or `global` object
under the key `clickstream`. This means you can access this created clickstream object
anywhere in your code once its initialized.

So in some event handler, you just need to write `clickstream.fireXXX(...)` to invoke the
api.

## API

There are two types of api calls: *context setting* methods and *event firing* methods.

### Context Setting methods

The context setter calls are:

  * `addImpression(impressionObject)`
  * `addProduct(productObject)`
  * `addPromotion(promoObject)`
  * `setAppInfo(appObject)`
  * `setCampaignInfo(campaignObject)`
  * `setContentGroups(contentGroups)`
  * `setCustomDimensions(dimensions, storageKey = 'ephemeral')`
  * `setCustomMetrics(metrics, storageKey = 'ephemeral')`
  * `setDeviceInfo(deviceInfo, dimensions)`
  * `setDocEncoding(encoding)`
  * `setDocTitle(title)`
  * `setExperiment(experimentObject)`
  * `setGaAdwordsId(id)`
  * `setGaDataSource(source)`
  * `setGaDisplayAdsId(id)`
  * `setGaGeoId(geoId)`
  * `setGaTrackingId(trackingId)`
  * `setJavaEnabled(enabled)`
  * `setLinkId(id)`
  * `setNoninteractive()`
  * `setProductAction(actionObject)`
  * `setTimeZone(tz)`
  * `setUniqueDeviceId(deviceId)`
  * `setUserId(userId)`
  * `setUserLanguage(language)`
  * `updateParams(obj, storageKey = 'persistent')`
  * `updateParam(key, value, storageKey = 'persistent')`

Each setter has a corresponding `resetXXX()` method that will either remove the parameter
setting, or it will reset it to some default value. See the [API docs](clickstream.html) for
more details.

Most of these setters set *persistent* context, meaning the values are sent with all events
fired moving forward, until a `resetXXX()` method is called.

Some setters (`addProduct()`, `addPromotion()`, `addImpression()`, `setProductAction()`) set
*emphemeral* context, meaning the values are sent only with the next event that
is fired and then forgotten.

There are two general methods `updateParams(obj, storageKey)` and `resetParams(obj, storageKey)` (with corresponding
singular versions `updateParam(key, value, storageKey)` and `resetParam(key, storageKey)`) that update
and remove keys directly. These allow you to set any values. The `storageKey` parameter should
be set to `persistent` (the default), `ephemeral`, `product`, `impression`, or `promotion`
to indicate the kind of param you're setting or removing. The `obj` for `updateParams()` should
be an array of product, impression or promotion objects for those kinds of params, or a plain
object of key/value pairs for persistent or emphermal parameters. Note that arguments to these
methods are not validated in any way, and the key names of the parameters are not translated
from user-friendly names to the cryptic abbreviated names required by our backend divolte schema.
So you should use the specialized `setXXX()` and `resetXXX()` methods unless you have a very
specific purpose.

There is also a general `getParams(storageKey)` method that returns currently set parameters.
The `storageKey` parameter defaults to `persistent`, but may be set to any of the admissable
storage types.

### Event firing methods

The event firing methods include:

* `firePageView(PageViewObject)`
* `fireScreenView(ScreenViewObject)`
* `fireEvent(EventObject)`
* `fireSocial(SocialObject)`
* `fireException(ExceptionObject)`
* `fireTiming(TimingObject)`

There is also a general `fire({})` method that accepts an object of key/value pairs.

## Testing

You can run the tests with

```bash
yarn test
```

You can look at the `tests/all.js` file to get a sense of how to use the api.

