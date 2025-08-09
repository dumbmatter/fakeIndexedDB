import "../wpt-env.js";

let attrs,cursor,db,store,store2;

globalThis.title = "IndexedDB: Verify [SameObject] behavior of the global scope's indexedDB attribute";

// META: title=IndexedDB: Verify [SameObject] behavior of the global scope's indexedDB attribute
// META: global=window,worker

// Spec:
// "https://w3c.github.io/IndexedDB/#dom-windoworworkerglobalscope-indexeddb"

'use strict';

test(t => {
  assert_equals(
      self.indexedDB, self.indexedDB,
      'Attribute should yield the same object each time');
}, 'indexedDB is [SameObject]');
