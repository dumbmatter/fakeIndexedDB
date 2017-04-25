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



async_test(t => {
  const dbname = document.location + '-' + t.name;
  indexedDB.deleteDatabase(dbname);
  const open = indexedDB.open(dbname);
  open.onsuccess = t.unreached_func('open should not succeed');
  open.onupgradeneeded = t.step_func(() => {
    const tx = open.transaction;
    tx.abort();
  });
  open.onerror = t.step_func(e => {
    assert_equals(e.target, open, 'event target should be request');
    assert_equals(e.type, 'error', 'Event type should be error');
    assert_true(e.bubbles, 'Event should bubble');
    assert_true(e.cancelable, 'Event should be cancelable');
    t.done();
  });
}, 'Properties of error event from failed open()');

