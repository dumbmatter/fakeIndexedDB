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


setup({allow_uncaught_exception:true});

function fire_success_event_test(func, description) {
  indexeddb_test(
    (t, db) => {
      db.createObjectStore('s');
    },
    (t, db) => {
      const tx = db.transaction('s');
      tx.oncomplete = t.unreached_func('transaction should abort');
      const store = tx.objectStore('s');
      const request = store.get(0);
      func(t, db, tx, request);
    },
    description);
}

fire_success_event_test((t, db, tx, request) => {
  request.onsuccess = () => {
    throw Error();
  };
  tx.onabort = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in success event handler on request');

fire_success_event_test((t, db, tx, request) => {
  request.addEventListener('success', () => {
    throw Error();
  });
  tx.onabort = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in success event listener on request');

fire_success_event_test((t, db, tx, request) => {
  request.addEventListener('success', () => {
    // no-op
  });
  request.addEventListener('success', () => {
    throw Error();
  });
  tx.onabort = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in second success event listener on request');

fire_success_event_test((t, db, tx, request) => {
  let second_listener_called = false;
  request.addEventListener('success', () => {
    throw Error();
  });
  request.addEventListener('success', t.step_func(() => {
    second_listener_called = true;
    assert_true(is_transaction_active(tx, 's'),
                'Transaction should be active until dispatch completes');
  }));
  tx.onabort = t.step_func_done(() => {
    assert_true(second_listener_called);
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in first success event listener, tx active in second');

