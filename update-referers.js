import YAML from 'yamljs';
import { each, endsWith } from 'lodash';
import fetch from 'node-fetch';

const url = 'https://s3-eu-west-1.amazonaws.com/snowplow-hosted-assets/third-party/referer-parser/referers-latest.yml';

fetch(url)
  .then(res => res.text())
  .then((yml) => {
    const rdb = YAML.parse(yml);
    const R = {};
    each(rdb, (conf, medium) => {
      each(conf, (info, name) => {
        each(info.domains, (domain) => {
          const dns = domain.endsWith('/') ? domain.substr(0,domain.length-1) : domain;
          R[dns] = { s:name, m: medium, q:info.parameters };
        });
      });
    });
    console.log(JSON.stringify(R));
  });
