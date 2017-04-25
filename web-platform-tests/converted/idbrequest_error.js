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


async_test(t => {
  var open = createdb(t);
  open.onupgradeneeded = t.step_func(e => {
    var db = e.target.result;
    db.createObjectStore('store');
  });
  open.onsuccess = t.step_func(e => {
    var db = e.target.result;
    var request = db.transaction('store').objectStore('store').get(0);

    assert_equals(request.readyState, 'pending');
    assert_throws('InvalidStateError', () => request.error,
                  'IDBRequest.error should throw if request is pending');
    t.done();
  });
}, 'IDBRequest.error throws if ready state is pending');
