require("../../build/global");
const Event = require("../../build/lib/FakeEvent").default;
const {
    add_completion_callback,
    assert_array_equals,
    assert_equals,
    assert_false,
    assert_key_equals,
    assert_not_equals,
    assert_throws,
    assert_true,
    async_test,
    createdb,
    createdb_for_multiple_tests,
    fail,
    format_value,
    indexeddb_test,
    promise_test,
    setup,
    step_timeout,
    test,
} = require("../support-node");

const document = {};
const window = global;



indexeddb_test(
  (t, db) => {
    const store = db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const store = tx.objectStore('store');
    [NaN, Infinity, -Infinity, -1, -Number.MAX_SAFE_INTEGER].forEach(count => {
      assert_throws(TypeError(), () => { store.getAllKeys(null, count); },
                    `getAllKeys with count ${count} count should throw TypeError`);
    });
    t.done();
  },
  `IDBObjectStore.getAllKeys() uses [EnforceRange]`
);
