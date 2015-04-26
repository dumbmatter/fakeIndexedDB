var assert = require('assert');
var indexedDB = require('..');
var FDBOpenDBRequest = require('../lib/FDBOpenDBRequest');
var FDBRequest = require('../lib/FDBRequest');
var FDBTransaction = require('../lib/FDBTransaction');
var DataError = require('../lib/errors/DataError');
var InvalidAccessError = require('../lib/errors/InvalidAccessError');
var InvalidStateError = require('../lib/errors/InvalidStateError');
var NotFoundError = require('../lib/errors/NotFoundError');
var ReadOnlyError = require('../lib/errors/ReadOnlyError');
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
        it('IDBTransaction', function (done) {
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

    describe('IDBObjectStore.put()', function () {
        // idbobjectstore_put
        it('put with an inline key', function (done) {
            var db,
              record = { key: 1, property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "key" });

                objStore.put(record);
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

        // idbobjectstore_put2
        it('put with an out-of-line key', function (done) {
            var db,
              key = 1,
              record = { property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store");

                objStore.put(record, key);
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

        // idbobjectstore_put3
        it('record with same key already exists', function (done) {
            var db, success_event,
              record = { key: 1, property: "data" },
              record_put = { key: 1, property: "changed", more: ["stuff", 2] };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "key" });
                objStore.put(record);

                var rq = objStore.put(record_put);

                rq.onsuccess = function(e) {
                    success_event = true;
                };
            };

            open_rq.onsuccess = function(e) {
                assert(success_event);

                var rq = db.transaction("store")
                           .objectStore("store")
                           .get(1);

                rq.onsuccess = function(e) {
                    var rec = e.target.result;

                    assert.equal(rec.key, record_put.key);
                    assert.equal(rec.property, record_put.property);
                    assert.deepEqual(rec.more, record_put.more);

                    done();
                };
            };
        });

        // idbobjectstore_put4
        it.skip('put where an index has unique:true specified', function (done) {
            var db,
              record = { key: 1, property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { autoIncrement: true });
                objStore.createIndex("i1", "property", { unique: true });
                objStore.put(record);

                var rq = objStore.put(record);

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
                this.done();
            }
        });

        // idbobjectstore_put5
        it("object store's key path is an object attribute", function (done) {
            var db,
              record = { test: { obj: { key: 1 } }, property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "test.obj.key" });
                objStore.put(record);
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

        // idbobjectstore_put6
        it('autoIncrement and inline keys', function (done) {
            var db,
              record = { property: "data" },
              expected_keys = [ 1, 2, 3, 4 ];

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "key", autoIncrement: true });

                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
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

        // idbobjectstore_put7
        it('autoIncrement and out-of-line keys', function (done) {
            var db,
              record = { property: "data" },
              expected_keys = [ 1, 2, 3, 4 ];

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { autoIncrement: true });

                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
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

        // idbobjectstore_put8
        it('object store has autoIncrement:true and the key path is an object attribute', function (done) {
            var db,
              record = { property: "data" },
              expected_keys = [ 1, 2, 3, 4 ];

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "test.obj.key", autoIncrement: true });

                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
                objStore.put(record);
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

        // idbobjectstore_put9
        it("Attempt to put a record that does not meet the constraints of an object store's inline key requirements", function (done) {
            var record = { key: 1, property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                var rq,
                  db = e.target.result,
                  objStore = db.createObjectStore("store", { keyPath: "key" });

                assert.throws(function() {
                    rq = objStore.put(record, 1);
                }, DataError);

                assert.equal(rq, undefined);
                done();
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put10
        it("Attempt to call 'put' without an key parameter when the object store uses out-of-line keys", function (done) {
            var db,
              record = { property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;

                var rq,
                  objStore = db.createObjectStore("store", { keyPath: "key" });

                assert.throws(function() {
                    rq = objStore.put(record);
                }, DataError);

                assert.equal(rq, undefined);
                done();
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put11
        it("Attempt to put a record where the record's key does not meet the constraints of a valid key", function (done) {
            var db,
              record = { key: { value: 1 }, property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;

                var rq,
                  objStore = db.createObjectStore("store", { keyPath: "key" });

                assert.throws(function() {
                    rq = objStore.put(record, 1);
                }, DataError);

                assert.equal(rq, undefined);
                done();
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put12
        it("Attempt to put a record where the record's in-line key is not defined", function (done) {
            var db,
              record = { property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;

                var rq,
                  objStore = db.createObjectStore("store", { keyPath: "key" });

                assert.throws(function() {
                    rq = objStore.put(record, 1);
                }, DataError);

                assert.equal(rq, undefined);
                done();
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put13
        it('Attempt to put a record where the out of line key provided does not meet the constraints of a valid key', function (done) {
            var db,
              record = { property: "data" };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;

                var rq,
                  objStore = db.createObjectStore("store");

                assert.throws(function() {
                    rq = objStore.put(record, { value: 1 });
                }, DataError);

                assert.equal(rq, undefined);
                done();
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put14
        it.skip('Put a record where a value being indexed does not meet the constraints of a valid key', function (done) {
            var db,
              record = { key: 1, indexedProperty: { property: "data" } };

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;

                var rq,
                  objStore = db.createObjectStore("store", { keyPath: "key" });

                objStore.createIndex("index", "indexedProperty");

                rq = objStore.put(record);

                assert(rq instanceof FDBRequest);
                rq.onsuccess = function() {
                    done();
                }
            };
            open_rq.onsuccess = function () {};
        });

        // idbobjectstore_put15
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
                    ostore.put({pKey: "primaryKey_0"});
                }, ReadOnlyError);
                done();
            }
        });

        // idbobjectstore_put16
        it.skip('If the object store has been deleted, the implementation must throw a DOMException of type InvalidStateError', function (done) {
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
                    ostore.put({pKey: "primaryKey_0"});
                }, InvalidStateError);
                done();
            }
        });
    });

    describe('Key validity', function () {
        // key_invalid
        it('Invalid key', function (done) {
            var numChecks = 0;
            var numDone = 0;

            /*function is_cloneable(o) {
                try {
                    self.postMessage(o, '*');
                    return true;
                } catch (ex) {
                    return false;
                }
            }*/

            function invalid_key(desc, key) {
                numChecks += 1;

                var open_rq = createdb(done);
                var objStore, objStore2;

                // set the current test, and run it
                open_rq.onupgradeneeded = function(e) {
                    objStore = e.target.result.createObjectStore("store");
                    assert.throws(function() {
                        objStore.add("value", key);
                    }, DataError, desc);

                    /*if (is_cloneable(key)) {
                        objStore2 = e.target.result.createObjectStore("store2", { keyPath: ["x", "keypath"] });
                        assert.throws(function() {
                            objStore2.add({ x: "value", keypath: key });
                        }, DataError, desc);
                    }*/
                    
                    numDone += 1;
                    if (numDone === numChecks) {
                        done();
                    }
                };
                open_rq.onsuccess = function () {};
            }

            var fake_array = {
                length      : 0,
                constructor : Array
            };

            var ArrayClone = function(){};
            ArrayClone.prototype = Array;
            var ArrayClone_instance = new ArrayClone();

            // booleans
            invalid_key( 'true'  , true );
            invalid_key( 'false' , false );

            // null/NaN/undefined
            invalid_key( 'null'      , null );
            invalid_key( 'NaN'       , NaN );
            invalid_key( 'undefined' , undefined );
            invalid_key( 'undefined2');

            // functions
            invalid_key( 'function() {}', function(){} );

            // objects
            invalid_key( '{}'                           , {} );
            invalid_key( '{ obj: 1 }'                   , { obj: 1 });
            invalid_key( 'Math'                         , Math );
            //invalid_key( 'window'                       , window );
            invalid_key( '{length:0,constructor:Array}' , fake_array );
            invalid_key( 'Array clone’s instance'       , ArrayClone_instance );
            invalid_key( 'Array (object)'               , Array );
            invalid_key( 'String (object)'              , String );
            invalid_key( 'new String()'                 , new String() );
            invalid_key( 'new Number()'                 , new Number() );
            invalid_key( 'new Boolean()'                , new Boolean() );

            // arrays
            invalid_key( '[{}]'                     , [{}] );
            invalid_key( '[[], [], [], [[ Date ]]]' , [ [], [], [], [[ Date ]] ] );
            invalid_key( '[undefined]'              , [undefined] );
            invalid_key( '[,1]'                     , [,1] );
            //invalid_key( 'document.getElements'
            //            +'ByTagName("script")'      , document.getElementsByTagName("script") );

            //  dates
            invalid_key( 'new Date(NaN)'      , new Date(NaN) );
            invalid_key( 'new Date(Infinity)' , new Date(Infinity) );

            // regexes
            invalid_key( '/foo/'        , /foo/ );
            invalid_key( 'new RegExp()' , new RegExp() );

            var sparse = [];
            sparse[10] = "hei";
            invalid_key('sparse array', sparse);

            var sparse2 = [];
            sparse2[0]  = 1;
            sparse2[""] = 2;
            sparse2[2]  = 3;
            invalid_key('sparse array 2', sparse2);

            invalid_key('[[1], [3], [7], [[ sparse array ]]]', [ [1], [3], [7], [[ sparse2 ]] ]);

            // sparse3
            invalid_key( '[1,2,3,,]', [1,2,3,,] );

            var recursive = [];
            recursive.push(recursive);
            invalid_key('array directly contains self', recursive);

            var recursive2 = [];
            recursive2.push([recursive2]);
            invalid_key('array indirectly contains self', recursive2);

            var recursive3 = [recursive];
            invalid_key('array member contains self', recursive3);
        });

        // key_valid
        it('Valid key', function (done) {
            var numChecks = 0;
            var numDone = 0;

            function valid_key(desc, key) {
                numChecks += 1;

                var db;
                var open_rq = createdb(done);
                var store, store2;

                open_rq.onupgradeneeded = function(e) {
                    db = e.target.result;

                    store = db.createObjectStore("store");
                    assert(store.add('value', key) instanceof FDBRequest);

                    store2 = db.createObjectStore("store2", { keyPath: ["x", "keypath"] });
                    assert(store2.add({ x: 'v', keypath: key }) instanceof FDBRequest);
                };
                open_rq.onsuccess = function(e) {
                    var rq = db.transaction("store")
                               .objectStore("store")
                               .get(key)
                    rq.onsuccess = function(e) {
                        assert.equal(e.target.result, 'value')
                        var rq = db.transaction("store2")
                                   .objectStore("store2")
                                   .get(['v', key])
                        rq.onsuccess = function(e) {
                            assert.deepEqual(e.target.result, { x: 'v', keypath: key })
                            numDone += 1;
                            if (numDone === numChecks) {
                                done();
                            }
                        };
                    };
                }
            }

            // Date
            valid_key( 'new Date()'    , new Date() );
            valid_key( 'new Date(0)'   , new Date(0) );

            // Array
            valid_key( '[]'            , [] );
            valid_key( 'new Array()'   , new Array() );

            valid_key( '["undefined"]' , ['undefined'] );

            // Float
            valid_key( 'Infinity'      , Infinity );
            valid_key( '-Infinity'     , -Infinity );
            valid_key( '0'             , 0 );
            valid_key( '1.5'           , 1.5 );
            valid_key( '3e38'          , 3e38 );
            valid_key( '3e-38'         , 3e38 );

            // String
            valid_key( '"foo"'         , "foo" );
            valid_key( '"\\n"'         , "\n" );
            valid_key( '""'            , "" );
            valid_key( '"\\""'         , "\"" );
            valid_key( '"\\u1234"'     , "\u1234" );
            valid_key( '"\\u0000"'     , "\u0000" );
            valid_key( '"NaN"'         , "NaN" );
        });
    });

    describe('Key generator', function () {
        // keygenerator
        it('Keygenerator', function (done) {
            var numChecks = 0;
            var numDone = 0;

            function keygenerator(objects, expected_keys, desc, func) {
                numChecks += 1;
                var db;

                var open_rq = createdb(done);
                open_rq.onupgradeneeded = function(e) {
                    db = e.target.result;
                    var objStore = db.createObjectStore("store", { keyPath: "id", autoIncrement: true });

                    for (var i = 0; i < objects.length; i++)
                    {
                        if (objects[i] === null)
                            objStore.add({});
                        else
                            objStore.add({ id: objects[i] });
                    }
                };

                open_rq.onsuccess = function(e) {
                    var actual_keys = [],
                      rq = db.transaction("store")
                             .objectStore("store")
                             .openCursor();

                    rq.onsuccess = function(e) {
                        var cursor = e.target.result;

                        if (cursor) {
                            actual_keys.push(cursor.key.valueOf());
                            cursor.continue();
                        }
                        else {
                            assert.deepEqual(actual_keys, expected_keys, "keygenerator array");

                            numDone += 1;
                            if (numDone === numChecks) {
                                done();
                            }
                        }
                    };
                };
            }


            keygenerator([null, null, null, null],  [1, 2, 3, 4],
                "starts at one, and increments by one");

            keygenerator([2, null, 5, null, 6.66, 7],  [2, 3, 5, 6, 6.66, 7],
                "increments by one from last set key");

            keygenerator([-10, null, "6", 6.3, [10], -2, 4, null],   [-10, -2, 1, 4, 6.3, 7, "6", [10]],
                "don't increment when new key is not bigger than current");
        });

        // keygenerator-constrainterror
        it('ConstraintError when using same id as already generated', function (done) {
            var db,
              objects = [1, null, {id: 2}, null, 2.00001, 5, null, {id: 6} ],
              expected = [1, 2, 2.00001, 3, 5, 6],
              errors = 0;

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "id", autoIncrement: true });

                for (var i = 0; i < objects.length; i++)
                {
                    if (objects[i] === null)
                    {
                        objStore.add({});
                    }
                    else if (typeof objects[i] === "object")
                    {
                        (function (i) {
                            var rq = objStore.add(objects[i])
                            rq.onerror = function(e) {
                                errors++;

                                assert.equal(e.target.error.name, "ConstraintError");
                                assert.equal(e.type, "error");

                                e.stopPropagation();
                                e.preventDefault();
                            };
                            rq.onsuccess = function(e) {
                                assert.fail("Got rq.success when adding duplicate id " + objects[i].id);
                            };
                        }(i));
                    }
                    else
                        objStore.add({ id: objects[i] });
                }
            };

            open_rq.onsuccess = function(e) {
                var actual_keys = [],
                  rq = db.transaction("store")
                         .objectStore("store")
                         .openCursor();

                rq.onsuccess = function(e) {
                    var cursor = e.target.result;

                    if (cursor) {
                        actual_keys.push(cursor.key.valueOf());
                        cursor.continue();
                    }
                    else {
                        assert.equal(errors, 2, "expected ConstraintError's");

                        assert.equal(actual_keys.length, expected.length, "array length");
                        assert.deepEqual(actual_keys, expected, "keygenerator array");

                        done();
                    }
                };
            };
        });

        // keygenerator-overflow
        it('overflow', function (done) {
            var db,
              overflow_error_fired = false,
              objects =  [9007199254740991, null, "error", 2, "error" ],
              expected_keys = [2, 9007199254740991, 9007199254740992];

            var open_rq = createdb(done);
            open_rq.onupgradeneeded = function(e) {
                db = e.target.result;
                var objStore = db.createObjectStore("store", { keyPath: "id", autoIncrement: true });

                for (var i = 0; i < objects.length; i++)
                {
                    if (objects[i] === null)
                    {
                        objStore.add({});
                    }
                    else if (objects[i] === "error")
                    {
                        var rq = objStore.add({});
                        rq.onerror = function(e) {
                            overflow_error_fired = true;
                            assert.equal(e.target.error.name, "ConstraintError", "error name");
                            e.preventDefault();
                            e.stopPropagation();
                        };
                    }
                    else
                        objStore.add({ id: objects[i] });
                }
            };

            open_rq.onsuccess = function(e) {
                var actual_keys = [],
                  rq = db.transaction("store")
                         .objectStore("store")
                         .openCursor();

                rq.onsuccess = function(e) {
                    var cursor = e.target.result;

                    if (cursor) {
                        actual_keys.push(cursor.key.valueOf());
                        cursor.continue();
                    }
                    else {
                        assert(overflow_error_fired, "error fired on 'current number' overflow");
                        assert.deepEqual(actual_keys, expected_keys, "keygenerator array");

                        done();
                    }
                };
            };
        });
    });
});