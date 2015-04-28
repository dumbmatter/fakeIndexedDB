# Fake IndexedDB [![Build Status](https://travis-ci.org/dumbmatter/fakeIndexedDB.svg?branch=master)](https://travis-ci.org/dumbmatter/fakeIndexedDB)

This is a pure JS in-memory implementation of the IndexedDB API. Current status is **very incomplete**, but hopefully that will change soon.

I'm not sure if it'll be possible to get all the transaction auto-committing semantics correct, but we'll see.

## Goals:

1. Finish implementing everything (very much a work in progress - please help!)

2. Run [the W3C IndexedDB test suite](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) on it (a fair amount of tests already pass if you run `npm test`), plus some extra tests just to be sure

## Potential applications:

1. Use the same database in Node.js/io.js and in the browser.

2. Support IndexedDB in old or crappy browsers.

3. Somehow use it within a caching layer in the browser, since real IndexedDB can be kind of slow.

## License

Apache 2.0
