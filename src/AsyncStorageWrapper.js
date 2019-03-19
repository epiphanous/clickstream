
/**
 * Wrap storage api in a consistent promise based environment.
 */
export default class AsyncStorageWrapper {
  constructor(syncStorage) {
    this.storage = syncStorage;
  }

  promiseAction(value) {
    return new Promise((resolve)=>{resolve(value);});
  }

  getItem(key) {
    return this.promiseAction(this.storage.getItem(key));
  }

  setItem(key, val) {
    return this.promiseAction(this.storage.setItem(key, val));
  }

  removeItem(key) {
    return this.promiseAction(this.storage.removeItem(key));
  }
}