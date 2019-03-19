import qs from 'qs';
import { each, has, isEmpty, filter } from 'lodash';
import rdb from './rdb.json';

const parse = require('url-parse');

/**
 * Parse a referer url.
 */
export default class Referrer {

  constructor(referrerUrl) {
    const ownDomain = process.env.OWN_DOMAIN || 'epiphanous.io';
    const ownSource = process.env.OWN_SOURCE || 'Epiphanous';
    this.source = null;
    this.medium = 'unknown';
    this.keyword = null;
    const referrer = parse(referrerUrl, {});
    this.host = referrer.hostname;
    this.path = referrer.pathname;
    this.query = qs.parse(referrer.query) || {};
    if (isEmpty(this.host)) {
      this.medium = '(none)';
      this.source = 'direct';
    }
    else if (this.host.endsWith(ownDomain)) {
      this.medium = 'Internal';
      this.source = ownSource;
    }
    else {
      this.medium = 'Referral';
      this.source = this.host;
      this.process();
    }
  }

  updateInfo(info) {
    const { source, medium, keyword } = this;
    info.source = source;
    info.medium = medium;
    if (keyword) info.keyword = keyword;
  }

  processPath(p) {
    const key = p ? `${this.host}/${p}` : this.host;
    console.log(key);
    const ref = rdb[key];
    if (ref) {
      this.medium = ref.m;
      this.source = ref.s;
      if (ref.m === 'search' && ref.q) {
        each(ref.q, (q) => {
          if (has(this.query, q)) {
            this.keyword = this.query[q];
          }
        });
      }
      return true;
    }
    return false;
  }

  process() {
    const paths = filter(this.path.split('/'), x => !isEmpty(x));
    if (!this.processPath()) {
      for (let i=paths.length; i>0; i--) {
        const p = paths.slice(0,i).join('/');
        if (this.processPath(p)) break;
      }
    }
  }

}

