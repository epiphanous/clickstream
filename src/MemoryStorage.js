import get from 'lodash/get';

/**
 * Basic in-memory storage interface.
 */
export default class MemoryStorage {
  constructor() {
    this.storage = {};
  }
  getItem(key) {
    return get(this.storage, key);
  }
  setItem(key, val) {
    this.storage[key] = val;
    return val;
  }
  removeItem(key) {
    const data = this.storage[key];
    delete(this.storage[key]);
    return data;
  }
}
