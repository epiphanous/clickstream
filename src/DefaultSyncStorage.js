import get from 'lodash/get';
import MemoryStorage from './MemoryStorage';

/**
 * Default sync storage interface.
 */
export default class DefaultSyncStorage {
  constructor(storage) {
    const root = global || window || {};
    const st = storage || (typeof window !== 'undefined' && window.top !== window ? new MemoryStorage() : 
      get(root, 'localStorage', get(root, 'sessionStorage', new MemoryStorage())));
    this.getItem = st.getItem.bind(st);
    this.setItem = st.setItem.bind(st);
    this.removeItem = st.removeItem.bind(st);
  }
}
