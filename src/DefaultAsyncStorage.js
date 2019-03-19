import AsyncStorageWrapper from './AsyncStorageWrapper';
import MemoryStorage from './MemoryStorage';

/**
 * Default async storage interface.
 */
export default class DefaultAsyncStorage {
  constructor(storage) {
    const st = storage || new AsyncStorageWrapper(new MemoryStorage());
    this.getItem = st.getItem.bind(st);
    this.setItem = st.setItem.bind(st);
    this.removeItem = st.removeItem.bind(st);
  }
}
