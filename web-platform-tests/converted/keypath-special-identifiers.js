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
    format_value,
    indexeddb_test,
    setup,
    test,
} = require("../support-node.js");

const document = {};
const window = global;



[
  {
    type: 'String',
    property: 'length',
    instance: 'abc',
  },
  {
    type: 'Array',
    property: 'length',
    instance: ['a', 'b', 'c'],
  },
  {
    type: 'Blob',
    property: 'size',
    instance: new Blob(['abc']),
  },
  {
    type: 'Blob',
    property: 'type',
    instance: new Blob([''], {type:'foo/bar'}),
  },
  {
    type: 'File',
    property: 'name',
    instance: new File([''], 'foo'),
  },
  {
    type: 'File',
    property: 'lastModified',
    instance: new File([''], '', {lastModified: 123}),
  },
  {
    type: 'File',
    property: 'lastModifiedDate',
    instance: new File([''], '', {lastModified: 123}),
  },
].forEach(function(testcase) {
  indexeddb_test(
    (t, db) => {
      db.createObjectStore(
          'store', {autoIncrement: true, keyPath: testcase.property});
    },
    (t, db) => {
      const key = testcase.instance[testcase.property];
      const tx = db.transaction('store', 'readwrite');
      tx.objectStore('store').put(testcase.instance);
      const request = tx.objectStore('store').get(key);
      request.onerror = t.unreached_func('request should not fail');
      request.onsuccess = t.step_func(function() {
        const result = request.result;
        assert_key_equals(result[testcase.property], key,
                          'Property should be used as key');
        t.done();
      });
    },
    'Type: ' + testcase.type + ', identifier: ' + testcase.property
  );
});

