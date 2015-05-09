var fakeIndexedDB = require('./');
var FDBKeyRange = require('./lib/FDBKeyRange');

var request = fakeIndexedDB.open('test', 3);
request.onupgradeneeded = function () {
    var db = request.result;
    var store = db.createObjectStore("books", {keyPath: "isbn"});
    store.createIndex("by_title", "title", {unique: true});

    store.put({title: "Quarry Memories", author: "Fred", isbn: 123456});
    store.put({title: "Water Buffaloes", author: "Fred", isbn: 234567});
    store.put({title: "Bedrock Nights", author: "Barney", isbn: 345678});
}
request.onsuccess = function (event) {
    var db = event.target.result;

    var tx = db.transaction("books");

    tx.objectStore("books").index("by_title").get("Quarry Memories").addEventListener('success', function (event) {
        console.log('From index:', event.target.result);
    });
    tx.objectStore("books").openCursor(FDBKeyRange.lowerBound(200000)).onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
            console.log('From cursor:', cursor.value);
            cursor.continue();
        }
    };
    tx.oncomplete = function () {
        console.log('All done!');
    };
};