# Fake IndexedDB [![Build Status](https://travis-ci.org/dumbmatter/fakeIndexedDB.svg?branch=master)](https://travis-ci.org/dumbmatter/fakeIndexedDB)

This is a pure JS in-memory implementation of [the IndexedDB API](http://www.w3.org/TR/2015/REC-IndexedDB-20150108/).

It passes [the W3C IndexedDB test suite](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) (a feat that all browsers except Chrome fail) plus a couple hundred more tests just to be sure. It also works well enough to run [fairly complex IndexedDB-based software](https://github.com/dumbmatter/basketball-gm/tree/fakeIndexedDB).

## Installation

```sh
npm install fake-indexeddb
```

## Use

Functionally, it works exactly like IndexedDB except data is not persisted to disk.

Use it as a shim to conditionally load it when IndexedDB is not present, such as in NodeJS or in really old browsers.

```js
require('fake-indexeddb/shim');

var request = indexedDB.open('test', 3);
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
    tx.objectStore("books").openCursor(IDBKeyRange.lowerBound(200000)).onsuccess = function (event) {
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
```

Or you can import individual functions directly. Variable names of all the objects are like the normal IndexedDB ones except with F replacing I, e.g. `FDBIndex` instead of `IDBIndex`.

```js
var fakeIndexedDB = require('fake-indexeddb');
var FDBKeyRange = require('fake-indexeddb/FDBKeyRange');

// ...same code as last example, but fakeIndexedDB instead of indexedDB and FDBKeyRange instead of IDBKeyRange
```

## Potential applications:

1. Use as a mock database in unit tests.

2. Use the same API in Node.js and in the browser.

3. Support IndexedDB in old or crappy browsers.

4. Somehow use it within a caching layer on top of IndexedDB in the browser, since IndexedDB can be kind of slow.

5. Abstract the core database functions out, so what is left is a shell that allows the IndexedDB API to easily sit on top of many different backends.

6. Serve as a playground for experimenting with IndexedDB.

## License

Apache 2.0
