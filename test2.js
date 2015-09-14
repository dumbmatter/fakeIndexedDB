var fakeIndexedDB = require('./');
var FDBKeyRange = require('./lib/FDBKeyRange');

var request = fakeIndexedDB.open('test', 3);
request.onupgradeneeded = function () {
    var db = request.result;
    var store = db.createObjectStore("books", {keyPath: "x"});
    store.createIndex("by_title", "val");

    console.time('put');
    for (var i = 0; i < 10000; i++) {
        store.put({x: i, val: Math.random()});
    }
}
request.onsuccess = function (event) {
    console.timeEnd('put');
    var db = event.target.result;
    var tx = db.transaction("books");
    var store = tx.objectStore("books");

    console.time('get');
    for (var i = 0; i < 10000; i++) {
        store.get(i);
    }

    tx.oncomplete = function () {
        console.timeEnd('get');
        console.log('All done!');
    };
};