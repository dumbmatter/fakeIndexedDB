var assert = require('assert');
var indexedDB = require('..');
var FDBOpenDBRequest = require('../lib/FDBOpenDBRequest');
var FDBTransaction = require('../lib/FDBTransaction');
var InvalidAccessError = require('../lib/errors/InvalidAccessError');
var InvalidStateError = require('../lib/errors/InvalidStateError');
var NotFoundError = require('../lib/errors/NotFoundError');
var TypeError = require('../lib/errors/TypeError');
var support = require('./support');
var createdb = support.createdb;

describe('W3C Web Platform Tests', function () {
    describe('IDBDatabase.transaction()', function () {
        // idbdatabase_transaction
        it('attempt to open a transaction with invalid scope', function (done) {
            var open_rq = createdb(done);

            open_rq.onupgradeneeded = function () {};
            open_rq.onsuccess = function (e) {
                var db = e.target.result;
                assert.throws(function () {
                    db.transaction('non-existing');
                }, NotFoundError);
                done();
            };
        });

        // idbdatabase_transaction2
        it('opening a transaction defaults to a read-only mode', function (done) {
            var db;
            var open_rq = createdb(done);

            open_rq.onupgradeneeded = function (e) {
                db = e.target.result;
                db.createObjectStore('readonly');
            };
            open_rq.onsuccess = function () {
                var txn = db.transaction('readonly');
                assert.equal(txn.mode, 'readonly');

                done();
            };
        });

        // idbdatabase_transaction3
        it('attempt to open a transaction from closed database connection', function (done) {
            var db;
            var open_rq = createdb(done);

            open_rq.onupgradeneeded = function (e) {
                db = e.target.result;
                db.createObjectStore('test');
            };
            open_rq.onsuccess = function () {
                db.close();

                assert.throws(function () {
                    db.transaction('test');
                }, InvalidStateError);

                done();
            };
        });

        // idbdatabase_transaction4
        it('attempt to open a transaction with invalid mode', function (done) {
            var db;
            var open_rq = createdb(done);

            open_rq.onupgradeneeded = function (e) {
                db = e.target.result;
                db.createObjectStore('test');
            };
            open_rq.onsuccess = function () {
                assert.throws(function () {
                    db.transaction('test', 'whatever');
                }, TypeError);

                done();
            };
        });

        // idbdatabase_transaction5
        it('If storeNames is an empty list, the implementation must throw a DOMException of type InvalidAccessError', function (done) {
            var db;
            var open_rq = createdb(done);

            open_rq.onupgradeneeded = function () {};
            open_rq.onsuccess = function (e) {
                db = e.target.result;
                assert.throws(function () {
                    db.transaction([]);
                }, InvalidAccessError);

                done();
            };
        });
    });
    describe('IDBTransaction', function () {
        // idbtransaction
        it('(no name)', function (done) {
            var db;
            var open_rq = indexedDB.open("idbtransaction-" + new Date().getTime() + Math.random());

            assert.equal(open_rq.transaction, null, "IDBOpenDBRequest.transaction");
            assert.equal(open_rq.source, null, "IDBOpenDBRequest.source");
            assert.equal(open_rq.readyState, "pending", "IDBOpenDBRequest.readyState");

            assert(open_rq instanceof FDBOpenDBRequest, "open_rq instanceof FDBOpenDBRequest");
            //assert.equal(open_rq + "", "[object FDBOpenDBRequest]", "FDBOpenDBRequest (open_rq)");

            open_rq.onupgradeneeded = function (e) {
                assert.equal(e.target, open_rq, "e.target is reusing the same FDBOpenDBRequest");
                assert.equal(e.target.transaction, open_rq.transaction, "FDBOpenDBRequest.transaction");

                assert(e.target.transaction instanceof FDBTransaction, "transaction instanceof FDBTransaction");
                done();
            };
        });
        // idbtransaction-oncomplete
        it('complete event', function (done) {
            var db;
            var open_rq = createdb(done);
            var stages = [];

            open_rq.onupgradeneeded = function (e) {
                stages.push("upgradeneeded");

                db = e.target.result;
                db.createObjectStore('store');

                e.target.transaction.oncomplete = function () {
                    stages.push("complete");
                };
            };
            open_rq.onsuccess = function () {
                stages.push("success");

                assert.deepEqual(stages, ["upgradeneeded",
                                          "complete",
                                          "success"]);
                done();
            };
        });

        // transaction-create_in_versionchange
        it('Attempt to create new transactions inside a versionchange transaction', function (done) {
            var db;
            var open_rq = createdb(done);
            var events = [];

            function log(msg) {
                return function(e) {
                    if(e && e.target && e.target.error)
                        events.push(msg + ": " + e.target.error.name)
                    else if(e && e.target && e.target.result !== undefined)
                        events.push(msg + ": " + e.target.result)
                    else
                        events.push(msg)
                };
            }

            open_rq.onupgradeneeded = function(e) {
                db = e.target.result

                db.createObjectStore("store")
                    .add("versionchange1", 1)
                    .addEventListener("success", log("versionchange_add.success"))

                assert.throws(function () {
                    db.transaction("store");
                }, InvalidStateError);

                e.target.transaction
                    .objectStore("store")
                    .count(2)
                    .addEventListener("success", log("versionchange_count.success"))

                assert.throws(function () {
                    db.transaction("store", "readwrite");
                }, InvalidStateError);

                open_rq.transaction
                    .objectStore("store")
                    .add("versionchange2", 2)
                    .addEventListener("success", log("versionchange_add2.success"));

                open_rq.transaction.oncomplete = function(e) {
                    log("versionchange_txn.complete")(e);

                    db.transaction("store")
                        .objectStore("store")
                        .count()
                        .addEventListener("success", log("complete_count.success"));
                }
            };

            open_rq.onsuccess = function(e) {
                log("open_rq.success")(e);

                var txn = db.transaction("store", "readwrite");
                txn.objectStore("store")
                    .put("woo", 1)
                    .addEventListener("success", log("complete2_get.success"));

                txn.oncomplete = function(e) {
                    assert.deepEqual(events, ["versionchange_add.success: 1",
                                              "versionchange_count.success: 0",
                                              "versionchange_add2.success: 2",
                                              "versionchange_txn.complete",
                                              "open_rq.success: [object Object]",
                                              "complete_count.success: 2",
                                              "complete2_get.success: 1"], "events");
                    done();
                };
            };
        });
    });
});