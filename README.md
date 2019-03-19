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
