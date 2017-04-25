'use strict';

var assert = require('assert');
var fakeIndexedDB = require('../..');

describe('fakeIndexedDB Tests', function () {
    describe('Transaction Lifetime', function () {
        it('Transactions should be activated from queue based on mode', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {keyPath: 'key'});

                for (var i = 0; i < 10; i++) {
                    store.add({key: i, content: 'test' + i});
                }
            };

            var started = [];
            var completed = [];

            function startTx(db, mode, desc) {
                var tx = db.transaction('store', mode);
                tx.objectStore('store').get(1).onsuccess = function () {
                    // If this is one of the readwrite transactions or the first readonly after a readwrite, make sure we waited for all active transactions to finish before starting a new one
                    if (mode === 'readwrite' || started.length === 7) {
                        assert.equal(started.length, completed.length);
                    }

                    started.push(desc);
                    //console.log('start', desc);

                    tx.objectStore('store').get(2).onsuccess = function () {
                        tx.objectStore('store').get(3).onsuccess = function () {
                            tx.objectStore('store').get(4).onsuccess = function () {
                                tx.objectStore('store').get(5).onsuccess = function () {
                                    tx.objectStore('store').get(6);
                                };
                            };
                        };
                    };
                };
                tx.oncomplete = function () {
                    completed.push(desc);
                    //console.log('done', desc);

                    if (completed.length >= 12) {
                        done();
                    }
                };
            }

            request.onsuccess = function (e) {
                var db = e.target.result;

                var i;
                for (i = 0; i < 5; i++) {
                    startTx(db, 'readonly', '1-' + i);
                }
                startTx(db, 'readwrite', 2);
                startTx(db, 'readwrite', 3);
                for (i = 0; i < 5; i++) {
                    startTx(db, 'readonly', '4-' + i);
                }
            };
        });
    });
    describe('Transaction Rollback', function () {
        it('Rollback FDBObjectStore.add', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').count().onsuccess = function (e) {
                    assert.equal(e.target.result, 10);
                    tx.objectStore('store').add({content: 'SHOULD BE ROLLED BACK'});

                    tx.objectStore('store').get(11).onsuccess = function (e) {
                        assert.equal(e.target.result.content, 'SHOULD BE ROLLED BACK');
                        tx.abort();
                    };
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').count().onsuccess = function (e) {
                    assert.equal(e.target.result, 10);
                    tx2.objectStore('store').add({content: 'SHOULD BE 11TH RECORD'}); // add would fail if SHOULD BE ROLLED BACK was still there

                    tx2.objectStore('store').count().onsuccess = function (e) {
                        assert.equal(e.target.result, 11);
                    };
                    tx2.objectStore('store').get(11).onsuccess = function (e) {
                        assert.equal(e.target.result.content, 'SHOULD BE 11TH RECORD');
                    };
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback FDBObjectStore.clear', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').clear().onsuccess = function () {
                    tx.objectStore('store').count().onsuccess = function (e) {
                        assert.equal(e.target.result, 0);
                        tx.abort();
                    };
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').count().onsuccess = function (e) {
                    assert.equal(e.target.result, 10);
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback FDBObjectStore.delete', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').delete(2).onsuccess = function () {
                    tx.objectStore('store').count().onsuccess = function (e) {
                        assert.equal(e.target.result, 9);
                        tx.abort();
                    };
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').count().onsuccess = function (e) {
                    assert.equal(e.target.result, 10);
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback FDBObjectStore.put', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').put({content: 'SHOULD BE ROLLED BACK'}, 10);
                tx.objectStore('store').get(10).onsuccess = function (e) {
                    assert.equal(e.target.result.content, 'SHOULD BE ROLLED BACK');
                    tx.abort();
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').get(10).onsuccess = function (e) {
                    assert.equal(e.target.result.content, 'test10');
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback FDBCursor.delete', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').openCursor(3).onsuccess = function (e) {
                    var cursor = e.target.result;
                    var obj = cursor.value;
                    obj.content = 'SHOULD BE ROLLED BACK';
                    cursor.delete();
                    tx.objectStore('store').get(3).onsuccess = function (e) {
                        assert.equal(e.target.result, undefined);
                        tx.abort();
                    };
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').get(3).onsuccess = function (e) {
                    assert.equal(e.target.result.content, 'test3');
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback FDBCursor.update', function (done) {
            var request = fakeIndexedDB.open('test' + Math.random());
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;

                var tx = db.transaction('store', 'readwrite');
                tx.objectStore('store').openCursor(3).onsuccess = function (e) {
                    var cursor = e.target.result;
                    var obj = cursor.value;
                    obj.content = 'SHOULD BE ROLLED BACK';
                    cursor.update(obj);
                    tx.objectStore('store').get(3).onsuccess = function (e) {
                        assert.equal(e.target.result.content, 'SHOULD BE ROLLED BACK');
                        tx.abort();
                    };
                };

                var tx2 = db.transaction('store', 'readwrite');
                tx2.objectStore('store').get(3).onsuccess = function (e) {
                    assert.equal(e.target.result.content, 'test3');
                };

                tx2.oncomplete = function () { done(); };
            };
        });

        it('Rollback of versionchange transaction', function (done) {
            var dbName = 'test' + Math.random();
            var request = fakeIndexedDB.open(dbName);
            request.onupgradeneeded = function(e) {
                var db = e.target.result;
                var store = db.createObjectStore('store', {autoIncrement: true});
                store.createIndex('content', 'content');

                for (var i = 0; i < 10; i++) {
                    store.add({content: 'test' + (i + 1)});
                }
            };
            request.onsuccess = function (e) {
                var db = e.target.result;
                db.close();

                var request = fakeIndexedDB.open(dbName, 2);
                request.onupgradeneeded = function(e) {
                    var db = e.target.result;
                    var store = e.target.transaction.objectStore('store');

                    db.createObjectStore('store2', {autoIncrement: true});
                    assert.equal(db.objectStoreNames.length, 2);


                    store.createIndex('content2', 'content');
                    assert.equal(store.indexNames.length, 2);

                    store.add({content: 'SHOULD BE ROLLED BACK'});

                    store.deleteIndex('content');
                    assert.equal(store.indexNames.length, 1);

                    db.deleteObjectStore('store');
                    assert.equal(db.objectStoreNames.length, 1);

                    request.transaction.abort();
                };
                request.onerror = function () {
                    var request = fakeIndexedDB.open(dbName);
                    request.onsuccess = function(e) {
                        var db = e.target.result;
                        assert.equal(db.version, 1);
                        assert.equal(db.objectStoreNames.length, 1);

                        var tx = db.transaction('store');
                        var store = tx.objectStore('store');
                        assert(!store._rawObjectStore.deleted);
                        var index = store.index('content');
                        assert(!index._rawIndex.deleted);

                        store.count().onsuccess = function (e) {
                            assert.equal(e.target.result, 10);
                        };

                        index.get('test2').onsuccess = function (e) {
                            assert.deepEqual(e.target.result, {content: 'test2'});
                        };

                        assert.equal(store.indexNames.length, 1);

                        tx.oncomplete = function () { done(); };
                    };
                };
            };
        });
    });

    it('should allow index where not all records have keys', function (done) {
        var request = fakeIndexedDB.open('test' + Math.random());
        request.onupgradeneeded = function(e) {
            var db = e.target.result;
            var store = db.createObjectStore('store', {autoIncrement: true});
            store.createIndex('compound', ['a','b'], {unique: false });
        };
        request.onsuccess = function (e) {
            var db = e.target.result;

            var tx = db.transaction('store', 'readwrite');
            tx.objectStore('store').put({
                whatever: 'foo',
            });
            tx.onerror = function (e) {
                done(e.target.error);
            }

            tx.oncomplete = function () {
                var tx2 = db.transaction('store');
                var request = tx2.objectStore('store').get(1);

                request.onsuccess = function (e) {
                    assert.deepEqual(e.target.result, {
                        whatever: 'foo',
                    });
                }

                tx2.oncomplete = function () { done(); };
            };
        };
    });

    it("Properly handles compound keys (issue #18)", function(done) {
        var request = fakeIndexedDB.open("test", 3);
        request.onupgradeneeded = function () {
            var db = request.result;
            var store = db.createObjectStore("books", {keyPath: ["author", "isbn"]});
            store.createIndex("by_title", "title", {unique: true});

            store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
            store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
            store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});
        };
        request.onsuccess = function (event) {
            var db = event.target.result;

            var tx = db.transaction("books", "readwrite");
            tx.objectStore("books").openCursor(["Fred", 123456]).onsuccess = function(event2) {
                var cursor = event2.target.result;
                cursor.value.price = 5.99;
                cursor.update(cursor.value);
            };

            tx.oncomplete = function() {
                done();
            };
        };
});
});