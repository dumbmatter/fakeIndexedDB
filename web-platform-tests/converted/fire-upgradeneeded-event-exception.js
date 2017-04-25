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

function fire_upgradeneeded_event_test(func, description) {
  async_test(t => {
    const dbname = document.location + '-' + t.name;
    const del = indexedDB.deleteDatabase(dbname);
    del.onerror = t.unreached_func('deleteDatabase should succeed');
    const open = indexedDB.open(dbname, 1);
    open.onsuccess = t.unreached_func('open should fail');
    func(t, open);
  }, description);
}

fire_upgradeneeded_event_test((t, open) => {
  let tx;
  open.onupgradeneeded = () => {
    tx = open.transaction;
    throw Error();
  };
  open.onerror = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in upgradeneeded handler');

fire_upgradeneeded_event_test((t, open) => {
  let tx;
  open.addEventListener('upgradeneeded', () => {
    tx = open.transaction;
    throw Error();
  });
  open.onerror = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in upgradeneeded listener');

fire_upgradeneeded_event_test((t, open) => {
  let tx;
  open.addEventListener('upgradeneeded', () => {
    // No-op.
  });
  open.addEventListener('upgradeneeded', () => {
    tx = open.transaction;
    throw Error();
  });
  open.onerror = t.step_func_done(() => {
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in second upgradeneeded listener');

fire_upgradeneeded_event_test((t, open) => {
  let tx;
  let second_listener_called = false;
  open.addEventListener('upgradeneeded', () => {
    open.result.createObjectStore('s');
    throw Error();
  });
  open.addEventListener('upgradeneeded', t.step_func(() => {
    second_listener_called = true;
    tx = open.transaction;
    assert_true(is_transaction_active(tx, 's'),
                'Transaction should be active until dispatch completes');
  }));
  open.onerror = t.step_func_done(() => {
    assert_true(second_listener_called);
    assert_equals(tx.error.name, 'AbortError');
  });
}, 'Exception in first upgradeneeded listener, tx active in second');

