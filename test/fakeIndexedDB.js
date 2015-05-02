var assert = require('assert');
var fakeIndexedDB = require('..');

describe('fakeIndexedDB Tests', function () {
    it.skip('Transactions should be activated from queue based on mode', function (done) {
        var open_rq = fakeIndexedDB.open('test' + Math.random());
        open_rq.onupgradeneeded = function(e) {
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
console.log('start', desc);

                tx.objectStore('store').get(2).onsuccess = function () {
                    tx.objectStore('store').get(3).onsuccess = function () {
                        tx.objectStore('store').get(4).onsuccess = function () {
                            tx.objectStore('store').get(5).onsuccess = function () {
                                tx.objectStore('store').get(6);
                            }
                        }
                    }
                }
            }
            tx.oncomplete = function () {
                completed.push(desc);
console.log('done', desc);

                if (completed.length >= 12) {
                    done();
                }
            };
        }

        open_rq.onsuccess = function (e) {
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
})