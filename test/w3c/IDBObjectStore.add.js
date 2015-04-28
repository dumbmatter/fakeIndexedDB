var assert = require('assert');
var FDBRequest = require('../../lib/FDBRequest');
var DataError = require('../../lib/errors/DataError');
var InvalidStateError = require('../../lib/errors/InvalidStateError');
var ReadOnlyError = require('../../lib/errors/ReadOnlyError');
var support = require('./support');
var createdb = support.createdb;

describe('W3C IDBObjectStore.add Tests', function () {
    // idbobjectstore_add
    it('add with an inline key', function (done) {
        var db,
          record = { key: 1, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "key" });

            objStore.add(record);
        };

        open_rq.onsuccess = function(e) {
            var rq = db.transaction("store")
                       .objectStore("store")
                       .get(record.key);

            rq.onsuccess = function(e) {
                assert.equal(e.target.result.property, record.property);
                assert.equal(e.target.result.key, record.key);
                done();
            };
        };
    });

    // idbobjectstore_add2
    it('add with an out-of-line key', function (done) {
        var db,
          key = 1,
          record = { property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store");

            objStore.add(record, key);
        };

        open_rq.onsuccess = function(e) {
            var rq = db.transaction("store")
                       .objectStore("store")
                       .get(key);

            rq.onsuccess = function(e) {
                assert.equal(e.target.result.property, record.property);

                done();
            };
        };
    });

    // idbobjectstore_add3
    it('record with same key already exists', function (done) {
        var db,
          record = { key: 1, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "key" });
            objStore.add(record);

            var rq = objStore.add(record);
            rq.onsuccess = function () { throw new Error("success on adding duplicate record"); };

            rq.onerror = function(e) {
                assert.equal(e.target.error.name, "ConstraintError");
                assert.equal(rq.error.name, "ConstraintError");
                assert.equal(e.type, "error");

                e.preventDefault();
                e.stopPropagation();
            };
        };

        // Defer done, giving rq.onsuccess a chance to run
        open_rq.onsuccess = function(e) {
            done();
        }
    });

    // idbobjectstore_add4
    it('add where an index has unique:true specified', function (done) {
        var db,
          record = { key: 1, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { autoIncrement: true });
            objStore.createIndex("i1", "property", { unique: true });
            objStore.add(record);

            var rq = objStore.add(record);
            rq.onsuccess = function () { throw new Error("success on adding duplicate indexed record"); };

            rq.onerror = function(e) {
                assert.equal(rq.error.name, "ConstraintError");
                assert.equal(e.target.error.name, "ConstraintError");
                assert.equal(e.type, "error");

                e.preventDefault();
                e.stopPropagation();
            };
        };

        // Defer done, giving a spurious rq.onsuccess a chance to run
        open_rq.onsuccess = function(e) {
            done();
        }
    });

    // idbobjectstore_add5
    it("object store's key path is an object attribute", function (done) {
        var db,
          record = { test: { obj: { key: 1 } }, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "test.obj.key" });
            objStore.add(record);
        };

        open_rq.onsuccess = function(e) {
            var rq = db.transaction("store")
                       .objectStore("store")
                       .get(record.test.obj.key);

            rq.onsuccess = function(e) {
                assert.equal(e.target.result.property, record.property);

                done();
            };
        };
    });

    // idbobjectstore_add6
    it('autoIncrement and inline keys', function (done) {
        var db,
          record = { property: "data" },
          expected_keys = [ 1, 2, 3, 4 ];

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "key", autoIncrement: true });

            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
        };

        open_rq.onsuccess = function(e) {
            var actual_keys = [],
              rq = db.transaction("store")
                     .objectStore("store")
                     .openCursor();

            rq.onsuccess = function(e) {
                var cursor = e.target.result;

                if (cursor) {
                    actual_keys.push(cursor.value.key);
                    cursor.continue();
                }
                else {
                    assert.deepEqual(actual_keys, expected_keys);
                    done();
                }
            };
        };
    });

    // idbobjectstore_add7
    it('autoIncrement and out-of-line keys', function (done) {
        var db,
          record = { property: "data" },
          expected_keys = [ 1, 2, 3, 4 ];

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { autoIncrement: true });

            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
        };

        open_rq.onsuccess = function(e) {
            var actual_keys = [],
              rq = db.transaction("store")
                     .objectStore("store")
                     .openCursor();

            rq.onsuccess = function(e) {
                var cursor = e.target.result;

                if (cursor) {
                    actual_keys.push(cursor.key);
                    cursor.continue();
                }
                else {
                    assert.deepEqual(actual_keys, expected_keys);
                    done();
                }
            };
        };
    });

    // idbobjectstore_add8
    it('object store has autoIncrement:true and the key path is an object attribute', function (done) {
        var db,
          record = { property: "data" },
          expected_keys = [ 1, 2, 3, 4 ];

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;
            var objStore = db.createObjectStore("store", { keyPath: "test.obj.key", autoIncrement: true });

            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
            objStore.add(record);
        };

        open_rq.onsuccess = function(e) {
            var actual_keys = [],
              rq = db.transaction("store")
                     .objectStore("store")
                     .openCursor();

            rq.onsuccess = function(e) {
                var cursor = e.target.result;

                if (cursor) {
                    actual_keys.push(cursor.value.test.obj.key);
                    cursor.continue();
                }
                else {
                    assert.deepEqual(actual_keys, expected_keys);
                    done();
                }
            };
        };
    });

    // idbobjectstore_add9
    it("Attempt to add a record that does not meet the constraints of an object store's inline key requirements", function (done) {
        var record = { key: 1, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            var rq,
              db = e.target.result,
              objStore = db.createObjectStore("store", { keyPath: "key" });

            assert.throws(function() {
                rq = objStore.add(record, 1);
            }, DataError);

            assert.equal(rq, undefined);
            done();
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add10
    it("Attempt to call 'add' without an key parameter when the object store uses out-of-line keys", function (done) {
        var db,
          record = { property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var rq,
              objStore = db.createObjectStore("store", { keyPath: "key" });

            assert.throws(function() {
                rq = objStore.add(record);
            }, DataError);

            assert.equal(rq, undefined);
            done();
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add11
    it("Attempt to add a record where the record's key does not meet the constraints of a valid key", function (done) {
        var db,
          record = { key: { value: 1 }, property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var rq,
              objStore = db.createObjectStore("store", { keyPath: "key" });

            assert.throws(function() {
                rq = objStore.add(record);
            }, DataError);

            assert.equal(rq, undefined);
            done();
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add12
    it("Attempt to add a record where the record's in-line key is not defined", function (done) {
        var db,
          record = { property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var rq,
              objStore = db.createObjectStore("store", { keyPath: "key" });

            assert.throws(function() {
                rq = objStore.add(record);
            }, DataError);

            assert.equal(rq, undefined);
            done();
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add13
    it('Attempt to add a record where the out of line key provided does not meet the constraints of a valid key', function (done) {
        var db,
          record = { property: "data" };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var rq,
              objStore = db.createObjectStore("store");

            assert.throws(function() {
                rq = objStore.add(record, { value: 1 });
            }, DataError);

            assert.equal(rq, undefined);
            done();
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add14
    it('add a record where a value being indexed does not meet the constraints of a valid key', function (done) {
        var db,
          record = { key: 1, indexedProperty: { property: "data" } };

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function(e) {
            db = e.target.result;

            var rq,
              objStore = db.createObjectStore("store", { keyPath: "key" });

            objStore.createIndex("index", "indexedProperty");

            rq = objStore.add(record);

            assert(rq instanceof FDBRequest);
            rq.onsuccess = function() {
                done();
            }
        };
        open_rq.onsuccess = function () {};
    });

    // idbobjectstore_add15
    it('If the transaction this IDBObjectStore belongs to has its mode set to readonly, throw ReadOnlyError', function (done) {
        var db;

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function (event) {
            db = event.target.result;
            db.createObjectStore("store", {keyPath:"pKey"});
        }

        open_rq.onsuccess = function (event) {
            var txn = db.transaction("store");
            var ostore = txn.objectStore("store");
            assert.throws(function() {
                ostore.add({pKey: "primaryKey_0"});
            }, ReadOnlyError);
            done();
        }
    });

    // idbobjectstore_add16
    it('If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError', function (done) {
        var db,
            ostore;

        var open_rq = createdb(done);
        open_rq.onupgradeneeded = function (event) {
            db = event.target.result;
            ostore = db.createObjectStore("store", {keyPath:"pKey"});
            db.deleteObjectStore("store");
        }

        open_rq.onsuccess = function (event) {
            assert.throws(function() {
                ostore.add({pKey: "primaryKey_0"});
            }, InvalidStateError);
            done();
        }
    });
});