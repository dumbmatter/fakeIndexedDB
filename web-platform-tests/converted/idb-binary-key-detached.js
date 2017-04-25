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
    test,
} = require("../support-node");

const document = {};
const window = global;



indexeddb_test(
  (t, db) => { db.createObjectStore('store'); },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');

    const buffer = new Uint8Array([1,2,3,4]).buffer;
    assert_equals(buffer.byteLength, 4);

    // Detach the ArrayBuffer by transferring it to a worker.
    const worker = new Worker(URL.createObjectURL(new Blob([])));
    worker.postMessage('', [buffer]);
    assert_equals(buffer.byteLength, 0);

    assert_throws(new TypeError, () => { store.put('', buffer); });
    t.done();
  },
  'Detached ArrayBuffer'
);

indexeddb_test(
  (t, db) => { db.createObjectStore('store'); },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const store = tx.objectStore('store');

    const array = new Uint8Array([1,2,3,4]);
    assert_equals(array.length, 4);

    // Detach the ArrayBuffer by transferring it to a worker.
    const worker = new Worker(URL.createObjectURL(new Blob([])));
    worker.postMessage('', [array.buffer]);
    assert_equals(array.length, 0);

    assert_throws(new TypeError, () => { store.put('', array); });
    t.done();
  },
  'Detached TypedArray'
);

