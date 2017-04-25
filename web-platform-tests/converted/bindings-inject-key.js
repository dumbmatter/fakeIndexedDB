require("../../build/global.js");
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
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;



indexeddb_test(
  (t, db) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const request = tx.objectStore('store').put(
        'value', [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 'key']);

    const setter_called = false;
    Object.defineProperty(Object.prototype, '10', {
      configurable: true,
      set: t.step_func((value) => { setter_called = true; }),
    });
    request.onerror = t.unreached_func('request should not fail');
    request.onsuccess = t.step_func(() => {
      const result = request.result;
      assert_false(setter_called,
                   'Setter should not be called for key result.');
      assert_true(
          result.hasOwnProperty('10'),
          'Result should have own-property overriding prototype setter.');
      assert_equals(result[10], 'key',
                    'Result should have expected property.');

      delete Object.prototype['10'];
      t.done();
    });
  },
  'Returning keys to script should bypass prototype setters'
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'id'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').put({});
    const request = tx.objectStore('store').get(1);

    const setter_called = false;
    Object.defineProperty(Object.prototype, 'id', {
      configurable: true,
      set: t.step_func(function(value) { setter_called = true; }),
    });
    request.onerror = t.unreached_func('request should not fail');
    request.onsuccess = t.step_func(function() {
        const result = request.result;
      assert_false(setter_called,
                   'Setter should not be called for key result.');
      assert_true(
          result.hasOwnProperty('id'),
          'Result should have own-property overriding prototype setter.');
      assert_equals(result.id, 1,
                    'Own property should match primary key generator value');

      delete Object.prototype['id'];
      t.done();
    });
  },
  'Returning values to script should bypass prototype setters'
);

indexeddb_test(
  (t, db) => {
    db.createObjectStore('store', {autoIncrement: true, keyPath: 'a.b.c'});
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    tx.objectStore('store').put({});
    const request = tx.objectStore('store').get(1);

    Object.prototype.a = {b: {c: 'on proto'}};

    request.onerror = t.unreached_func('request should not fail');
    request.onsuccess = t.step_func(function() {
      const result = request.result;
      assert_true(result.hasOwnProperty('a'),
                  'Result should have own-properties overriding prototype.');
      assert_true(result.a.hasOwnProperty('b'),
                  'Result should have own-properties overriding prototype.');
      assert_true(result.a.b.hasOwnProperty('c'),
                  'Result should have own-properties overriding prototype.');
      assert_equals(result.a.b.c, 1,
                    'Own property should match primary key generator value');
      assert_equals(Object.prototype.a.b.c, 'on proto',
                  'Prototype should not be modified');
      t.done();
    });
  },
  'Returning values to script should bypass prototype chain'
);

