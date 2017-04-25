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
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const release_tx = keep_alive(tx, 'store');

    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    const request = tx.objectStore('store').get(0);
    request.onerror = t.unreached_func('request should succeed');
    request.onsuccess = () => {
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active during success handler');

      let saw_handler_promise = false;
      Promise.resolve().then(t.step_func(() => {
        saw_handler_promise = true;
        assert_true(is_transaction_active(tx, 'store'),
                    'Transaction should be active in handler\'s microtasks');
      }));

      setTimeout(t.step_func(() => {
        assert_true(saw_handler_promise);
        assert_false(is_transaction_active(tx, 'store'),
                     'Transaction should be inactive in next task');
        release_tx();
        t.done();
      }), 0);
    };
  },
  'Transactions are active during success handlers');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store');
    const release_tx = keep_alive(tx, 'store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    const request = tx.objectStore('store').get(0);
    request.onerror = t.unreached_func('request should succeed');
    request.addEventListener('success', () => {
      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active during success listener');

      let saw_listener_promise = false;
      Promise.resolve().then(t.step_func(() => {
        saw_listener_promise = true;
        assert_true(is_transaction_active(tx, 'store'),
                    'Transaction should be active in listener\'s microtasks');
      }));

      setTimeout(t.step_func(() => {
        assert_true(saw_listener_promise);
        assert_false(is_transaction_active(tx, 'store'),
                     'Transaction should be inactive in next task');
        release_tx();
        t.done();
      }), 0);
    });
  },
  'Transactions are active during success listeners');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const release_tx = keep_alive(tx, 'store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    tx.objectStore('store').put(0, 0);
    const request = tx.objectStore('store').add(0, 0);
    request.onsuccess = t.unreached_func('request should fail');
    request.onerror = e => {
      e.preventDefault();

      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active during error handler');

      let saw_handler_promise = false;
      Promise.resolve().then(t.step_func(() => {
        saw_handler_promise = true;
        assert_true(is_transaction_active(tx, 'store'),
                    'Transaction should be active in handler\'s microtasks');
      }));

      setTimeout(t.step_func(() => {
        assert_true(saw_handler_promise);
        assert_false(is_transaction_active(tx, 'store'),
                     'Transaction should be inactive in next task');
        release_tx();
        t.done();
      }), 0);
    };
  },
  'Transactions are active during error handlers');

indexeddb_test(
  (t, db, tx) => {
    db.createObjectStore('store');
  },
  (t, db) => {
    const tx = db.transaction('store', 'readwrite');
    const release_tx = keep_alive(tx, 'store');
    assert_true(is_transaction_active(tx, 'store'),
                'Transaction should be active after creation');

    tx.objectStore('store').put(0, 0);
    const request = tx.objectStore('store').add(0, 0);
    request.onsuccess = t.unreached_func('request should fail');
    request.addEventListener('error', e => {
      e.preventDefault();

      assert_true(is_transaction_active(tx, 'store'),
                  'Transaction should be active during error listener');

      let saw_listener_promise = false;
      Promise.resolve().then(t.step_func(() => {
        saw_listener_promise = true;
        assert_true(is_transaction_active(tx, 'store'),
                    'Transaction should be active in listener\'s microtasks');
      }));

      setTimeout(t.step_func(() => {
        assert_true(saw_listener_promise);
        assert_false(is_transaction_active(tx, 'store'),
                     'Transaction should be inactive in next task');
        release_tx();
        t.done();
      }), 0);
    });
  },
  'Transactions are active during error listeners');

