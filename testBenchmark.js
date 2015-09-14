var FDBFactory = require('./lib/FDBFactory');
var FDBKeyRange = require('./lib/FDBKeyRange');
var recordStoreAdapters = require('./lib/recordStoreAdapters');

var adapters = Object.keys(recordStoreAdapters);

function runBenchmark(adapters) {
    var adapter = adapters.shift();
    console.log('Testing ' + adapter + '...')

    var fdb = new FDBFactory({recordStoreAdapter: adapter});

    var request = fdb.open(adapter + '-test', 3);
    request.onupgradeneeded = function () {
        var db = request.result;
        var store = db.createObjectStore("books", {keyPath: "x"});
        store.createIndex("by_title", "val");

        console.time(adapter + ' put');
        for (var i = 0; i < 10000; i++) {
            store.put({x: i, val: Math.random()});
        }
    }
    request.onsuccess = function (event) {
        console.timeEnd(adapter + ' put');
        var db = event.target.result;
        var tx = db.transaction("books");
        var store = tx.objectStore("books");

        console.time(adapter + ' get');
        for (var i = 0; i < 10000; i++) {
            store.get(i);
        }

        tx.oncomplete = function () {
            console.timeEnd(adapter + ' get');
            console.log();

            if (adapters.length > 0) {
                runBenchmark(adapters);
            }
        };
    };
}

runBenchmark(adapters);