# fake-indexeddb [![Build Status](https://travis-ci.org/dumbmatter/fakeIndexedDB.svg?branch=master)](https://travis-ci.org/dumbmatter/fakeIndexedDB)

This is a pure JS in-memory implementation of [the IndexedDB API](https://w3c.github.io/IndexedDB/). Its main utility is for testing IndexedDB-dependent code in Node.js.

## Installation

```sh
npm install --save-dev fake-indexeddb
```

or

```sh
yarn add --dev fake-indexeddb
```

## Use

Functionally, it works exactly like IndexedDB except data is not persisted to disk.

The easiest way to use it is to import `fake-indexeddb/auto`, which will put all the IndexedDB objects in the global scope:

```js
require("fake-indexeddb/auto");

var request = indexedDB.open("test", 3);
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

    tx.objectStore("books").index("by_title").get("Quarry Memories").addEventListener("success", function (event) {
        console.log("From index:", event.target.result);
    });
    tx.objectStore("books").openCursor(IDBKeyRange.lowerBound(200000)).onsuccess = function (event) {
        var cursor = event.target.result;
        if (cursor) {
            console.log("From cursor:", cursor.value);
            cursor.continue();
        }
    };
    tx.oncomplete = function () {
        console.log("All done!");
    };
};
```

Alternatively, you can import individual objects:

```js
var indexedDB = require("fake-indexeddb");
var IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

// The rest is the same as above.
```

When importing individual classes directly (like `var IDBKeyRange =
require("fake-indexeddb/lib/FDBKeyRange");` above), file names of all the objects are like the
normal IndexedDB ones except with F replacing I, e.g. `FDBIndex` instead of `IDBIndex`.

### With Dexie and other IndexedDB API wrappers

If you import `fake-indexeddb/auto` before calling `new Dexie()`, it should work:

```js
const Dexie = require("dexie");
require("fake-indexeddb/auto");

const db = new Dexie("MyDatabase");
```

The same likely holds true for other IndexedDB API wrappers like idb.

Alternatively, if you don't want to modify the global scope, then you need to explicitly pass the objects to Dexie:

```js
const Dexie = require("dexie");
const indexedDB = require("fake-indexeddb");
const IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");

const db = new Dexie("MyDatabase", { indexedDB: indexedDB, IDBKeyRange: IDBKeyRange });
```

### With Jest

To use this on a single Jest test suite, require `fake-indexeddb/auto` at the beginning of the test
file, as described above.

To use it on all Jest tests without having to require it in each file, add the auto setup script to the `setupFiles` in your Jest config:

```json
"jest": {
    ...
    "setupFiles": [
        "fake-indexeddb/auto"
    ]
}
```

### Wiping/resetting the indexedDB for a fresh state

If you are keeping your tests completely isolated you might want to "reset" the state of the mocked indexedDB. You can do this by creating a new `fakeIndexedDB` instance, which lets you have a totally fresh start.

```
require("fake-indexeddb/auto");
const FDBFactory = require("fake-indexeddb/lib/FDBFactory");

// Whenever you want a fresh indexedDB
indexedDB = new FDBFactory();
```

### With PhantomJS and other really old environments

PhantomJS (and other really old environments) are missing tons of modern JavaScript features. In fact, that may be why you use fake-indexeddb in such an environment! Prior to v3.0.0, fake-indexeddb imported core-js and automatically applied its polyfills. However, since most fake-indexeddb users are not using really old environments, I got rid of that runtime dependency in v3.0.0. To work around that, you can import core-js yourself before you import fake-indexeddb, like:

```js
require("core-js/stable");
var indexedDB = require("fake-indexeddb");
```

## Quality

Here's a comparison of fake-indexeddb and real browser IndexedDB implementations on [the W3C IndexedDB test suite](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) as of March 18, 2019:

| Implementation       | Percentage of files that pass completely |
| -------------------- | ---------------------------------------- |
| Chrome 73            | 99%                                      |
| Firefox 65           | 97%                                      |
| Safari 12            | 92%                                      |
| fake-indexeddb 3.0.0 | 87%                                      |
| Edge 18              | 61%                                      |

For browsers, I ran http://w3c-test.org/tools/runner/index.html and counted the passes. For fake-indexeddb, I ran `npm run test-w3c`.

87% is pretty good, right? Especially considering that fake-indexeddb runs in Node.js where failure is guaranteed for tests involving browser APIs like Web Workers. There are definitley still some weak points of fake-indexeddb, most of which are described in `src/test/web-platform-tests/run-all.js`. Your app will probably run fine, though.

## Potential applications:

1. Use as a mock database in unit tests.

2. Use the same API in Node.js and in the browser.

3. Support IndexedDB in old or crappy browsers.

4. Somehow use it within a caching layer on top of IndexedDB in the browser, since IndexedDB can be kind of slow.

5. Abstract the core database functions out, so what is left is a shell that allows the IndexedDB API to easily sit on top of many different backends.

6. Serve as a playground for experimenting with IndexedDB.

## License

Apache 2.0
