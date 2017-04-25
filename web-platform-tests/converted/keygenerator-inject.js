require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node");

const document = {};
const window = global;



indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    t.onabort = t.unreached_func('transaction should not abort');

    const store = tx.objectStore('store');

    store.put({name: 'n'}).onsuccess = t.step_func(e => {
      const key = e.target.result;
      assert_equals(key, 1, 'Key generator initial value should be 1');
      store.get(key).onsuccess = t.step_func(e => {
        const value = e.target.result;
        assert_equals(typeof value, 'object', 'Result should be object');
        assert_equals(value.name, 'n', 'Result should have name property');
        assert_equals(value.id, key, 'Key should be injected');
        t.done();
      });
    });
  },
  'Key is injected into value - single segment path');

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'a.b.id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    t.onabort = t.unreached_func('transaction should not abort');

    const store = tx.objectStore('store');

    store.put({name: 'n'}).onsuccess = t.step_func(e => {
      const key = e.target.result;
      assert_equals(key, 1, 'Key generator initial value should be 1');
      store.get(key).onsuccess = t.step_func(e => {
        const value = e.target.result;
        assert_equals(typeof value, 'object', 'Result should be object');
        assert_equals(value.name, 'n', 'Result should have name property');
        assert_equals(value.a.b.id, key, 'Key should be injected');
        t.done();
      });
    });
  },
  'Key is injected into value - multi-segment path');

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'a.b.id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    t.onabort = t.unreached_func('transaction should not abort');

    const store = tx.objectStore('store');

    store.put({name: 'n1', b: {name: 'n2'}}).onsuccess = t.step_func(e => {
      const key = e.target.result;
      assert_equals(key, 1, 'Key generator initial value should be 1');
      store.get(key).onsuccess = t.step_func(e => {
        const value = e.target.result;
        assert_equals(typeof value, 'object', 'Result should be object');
        assert_equals(value.name, 'n1', 'Result should have name property');
        assert_equals(value.b.name, 'n2', 'Result should have name property');
        assert_equals(value.a.b.id, key, 'Key should be injected');
        t.done();
      });
    });
  },
  'Key is injected into value - multi-segment path, partially populated');

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');

    assert_throws('DataError', () => {
      store.put(123);
    }, 'Key path should be checked against value');

    t.done();
  },
  'put() throws if key cannot be injected - single segment path');

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'a.b.id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');

    assert_throws('DataError', () => {
      store.put({a: 123});
    }, 'Key path should be checked against value');

    assert_throws('DataError', () => {
      store.put({a: {b: 123} });
    }, 'Key path should be checked against value');

    t.done();
  },
  'put() throws if key cannot be injected - multi-segment path');

