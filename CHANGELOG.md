# 3.1.1 (2020-07-15)

- #54 - Fixed a bug where multiple transactions started at the same time could result in a transaction never resolving, if one of the transactions had no database operations inside it. Thank you @medmunds for both finding and fixing this bug!

# 3.1.1 (2020-07-15)

- #53 - Fixed a bug introduced in v3.1.0 where `FDBObjectStore.delete` resulted in an error when given a key range. Possibly a couple other situations with key ranges produced similar errors too.

# 3.1.0 (2020-07-02)

- #52 - Significant performance improvement. 5.5x faster on a real use case. Thank you @nolanlawson for this speed up!

# 3.0.2 (2020-06-10)

* #45 - Fix synchronous event firing in a transaction, which led to a stack overflow when used with Dexie's waitFor function.

# 3.0.1 (2020-05-25)

* #41 - Correctly roll back a record added to a store when an index constraint error occurs.

# 3.0.0 (2019-11-15)

* Stopped importing core-js by default. This means that, for people using fake-indexeddb in really old environments like PhantomJS, they will now need to import core-js like `require("core-js/stable");` (or something similar) before importing fake-indexeddb.

# 2.1.1 (2019-06-05)

* #30 - Fixed typo in the name of the `Event.timeStamp` property.

# 2.1.0 (2019-03-18)

* Added the ability to include `fake-indexeddb/auto` and have it populate all the global variables.
* Added support for `IDBTransaction.commit()` and `IDBFactory.databases()`.
* Fixed a couple minor edge cases to improve performance on the web platform tests from 85% to 87%.

# 2.0.6 (2019-03-14)

* Fixed issue #26, where event handlers were inappropriately not being called if they added or removed other handlers to the invoking listener in their callbacks.

# 2.0.5 (2019-02-07)

* Fixed issue #25 by importing core-js/shim rather than all of core-js.

# 2.0.4 (2018-02-22)

* Improved structured cloning, which fixes bugs when used with strange objects like https://github.com/dumbmatter/realistic-structured-clone/issues/5

# 2.0.3 (2017-05-09)

* Fixed issue #20 related to iterating over cursors with non-unique keys

# 2.0.2 (2017-05-01)

* Include core-js by default to make it work more easily in old environments like PhantomJS

# 2.0.1 (2017-04-29)

* Minor updates to README

# 2.0.0 (2017-04-29)

* Fully implements the [IndexedDB 2.0 API](https://hacks.mozilla.org/2016/10/whats-new-in-indexeddb-2-0/) (which technically still is a draft, but is probably not going to substantially change).
* Ported to TypeScript, which hopefully means less bugs.
* Dynamically runs [the W3C web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) rather than using manually ported tests. This means it's easy to run new tests, and the tests written since the original release of fake-indexeddb turned up several minor bugs which have now been fixed. See `npm run test-w3c`.
