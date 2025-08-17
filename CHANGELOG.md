# Development

- Fixed `fake-indexeddb/auto` import in browsers (#127 by @nolanlawson)

- Add new `forceCloseDatabase` API to simulate the database being abnormally closed, emitting a `"close"` event (#126 by @nolanlawson)

- Improve insert performance of `multiEntry` indexes (#125 by @nolanlawson)

- Improved handling of `Blob` and `File` objects (#124 by @nolanlawson)

# 6.1.0 (2025-08-08)

- Added support for new IndexedDB features: querying keys and values at the same time with `getAllRecords`, and passing a descending direction into `getAll`/`getAllKeys`. (#112 by @nolanlawson)

- Better DOMStringList polyfill that doesn't include various inappropriate array methods. (#66 by @dumbmatter)

- Updated the Web Platform Tests from 2019 to 2025 which improved test coverage and uncovered a few minor bugs that were fixed. (#117 by @nolanlawson)

# 6.0.1 (2025-05-09)

- #110 - Fix handling of "undefined value" vs "missing value" in IDBObjectStore.add/put when that value is at the keyPath and autoIncrement is true - it should throw an error if the keyPath value is undefined, but previously it was not.

# 6.0.0 (2024-05-20)

I made this a new major version because it includes a few changes that could in theory break something in some weird situations. But I think the vast majority of users (possibly all users?) won't have any issue upgrading.

- #48 - Switched to using `DOMException` errors rather than normal errors, since that's what the IndexedDB spec says to use, and Node.js now has a built-in DOMException in all supported versions.

- #93 - @bryan-codaio made the latest tweak to event scheduling, this time improving how `setImmediate` is used in some situations where people are mocking timers.

- #99 - @sjnho fixed handling of `Date` objects to account for some edge cases, including jsdom overriding the native `Date` constructor.

# 5.0.2 (2023-12-30)

- #94 - Improved performance of `IDBObjectStore.count` and `IDBIndex.count`.

# 5.0.1 (2023-10-25)

- #89 - Fixed bug where ArrayBuffer views were not being correctly handled when used as keys.

- #88 - Added explanation to README.md about how to use fake-indexeddb v5+ with jsdom, since a `structuredClone` polyfill is not included anymore.

# 5.0.0 (2023-10-13)

- Dropped support for Node.js 16, which allows me to get rid of the `structuredClone` polyfill, which reduces the package size by roughly 50%.

# 4.0.2 (2023-07-14)

- #84 - Fix the TypeScript types in some situations.

# 4.0.1 (2022-11-29)

- #79 - Added missing `request` accessor to the `FDBCursor` object. Thank you @mmacfadden for the PR!

# 4.0.0 (2022-07-02)

TLDR: Most users can upgrade without doing any extra work, but you might need to change `require("fake-indexeddb")` to `require("fake-indexeddb").default`. All other ways of importing fake-indexeddb (such as with `import`, or requiring sub-modules like `require("fake-indexeddb/auto")` or `require("fake-indexeddb/lib/FDBKeyRange")`) should continue working like normal.

Details:

- #23 - TypeScript support! As of version 4, fake-indexeddb includes TypeScript types. As you can see in types.d.ts, it's just using TypeScript's built-in IndexedDB types, rather than generating types from the fake-indexeddb code base. The reason I did this is for compatibility with your application code that may already be using TypeScript's IndexedDB types, so if I used something different for fake-indexeddb, it could lead to spurious type errors. In theory this could lead to other errors if there are differences between Typescript's IndexedDB types and fake-indexeddb's API, but currently I'm not aware of any difference.

- Added support for ES modules in addition to CommonJS modules. That means you can `import` or `require` and it should just work.

- **Breaking change:** The easiest way to use this module is still to import/require `"fake-indexeddb/auto"`. If instead you want to import an individual variable rather than populate the global scope with all of them, previously you would do `const indexedDB = require("fake-indexeddb");` for the main `indexedDB` variable and `const IDBKeyRange = require("fake-indexeddb/lib/FDBKeyRange");` for any of the other IndexedDB variables. In this release, I made everything a named export of the main package, so you can do:

   ```js
   import { indexedDB, IDBKeyRange } from "fake-indexeddb";
   ```

   or

   ```js
   const { indexedDB, IDBKeyRange } = require("fake-indexeddb");
   ```

   For backwards compatibility, the `require("fake-indexeddb/lib/FDBKeyRange")` syntax still is supported, but the new exports of the main module are a breaking change. `indexedDB` is still the default export, but in CommonJS you can't have both default and named exports, so the default export is really just an property named `"default"`. This may requrie changing requires of the root module like `require("fake-indexeddb")` to `require("fake-indexeddb").default`. Or switch to ES modules and `import` it :)

- **Breaking change:** Dropped support for versions of Node.js older than Node 12.

- **Breaking change:** For environments with a built-in `structuredClone` function (such as Node.js 17+), that is used rather than the `realistic-structured-clone` NPM module. There are some differences between the two implementations of the structured cloning algorithm, but probably nothing noticable, and probably all is in the direction of better spec compliance such as [this](https://github.com/dumbmatter/realistic-structured-clone/issues/8) or [this](https://github.com/dumbmatter/realistic-structured-clone/issues/10#issuecomment-966629946). There is also a minor performance increase with the built-in function - the test suite of fake-indexeddb runs about 5% faster.

# 3.1.8 (2022-06-08)

- #74 - Fixed error when adding undefined or null children in indexed objects, by @lukebrody

# 3.1.7 (2021-10-19)

- #71 - Fixed an error when used with jest/jsdom introduced in version 3.1.6.

# 3.1.6 (2021-10-19)

- #70 - Fixed performance regression in the previous version. Thank you @joshkel for figuring this out!

# 3.1.4 (2021-10-11)

- #67 - Fixed compatibility with jsdom by replacing all uses of `setImmediate` with `setTimeout`.

# 3.1.3 (2021-06-19)

- #65 - Got rid of constructor.name usage, since minifying can break it.

# 3.1.2 (2020-07-21)

- #54 - Fixed a bug where multiple transactions started at the same time could result in a transaction never resolving, if one of the transactions had no database operations inside it. Thank you @medmunds for both finding and fixing this bug!

# 3.1.1 (2020-07-15)

- #53 - Fixed a bug introduced in v3.1.0 where `FDBObjectStore.delete` resulted in an error when given a key range. Possibly a couple other situations with key ranges produced similar errors too.

# 3.1.0 (2020-07-02)

- #52 - Significant performance improvement. 5.5x faster on a real use case. Thank you @nolanlawson for this speed up!

# 3.0.2 (2020-06-10)

- #45 - Fix synchronous event firing in a transaction, which led to a stack overflow when used with Dexie's waitFor function.

# 3.0.1 (2020-05-25)

- #41 - Correctly roll back a record added to a store when an index constraint error occurs.

# 3.0.0 (2019-11-15)

- Stopped importing core-js by default. This means that, for people using fake-indexeddb in really old environments like PhantomJS, they will now need to import core-js like `require("core-js/stable");` (or something similar) before importing fake-indexeddb.

# 2.1.1 (2019-06-05)

- #30 - Fixed typo in the name of the `Event.timeStamp` property.

# 2.1.0 (2019-03-18)

- Added the ability to include `fake-indexeddb/auto` and have it populate all the global variables.
- Added support for `IDBTransaction.commit()` and `IDBFactory.databases()`.
- Fixed a couple minor edge cases to improve performance on the web platform tests from 85% to 87%.

# 2.0.6 (2019-03-14)

- Fixed issue #26, where event handlers were inappropriately not being called if they added or removed other handlers to the invoking listener in their callbacks.

# 2.0.5 (2019-02-07)

- Fixed issue #25 by importing core-js/shim rather than all of core-js.

# 2.0.4 (2018-02-22)

- Improved structured cloning, which fixes bugs when used with strange objects like https://github.com/dumbmatter/realistic-structured-clone/issues/5

# 2.0.3 (2017-05-09)

- Fixed issue #20 related to iterating over cursors with non-unique keys

# 2.0.2 (2017-05-01)

- Include core-js by default to make it work more easily in old environments like PhantomJS

# 2.0.1 (2017-04-29)

- Minor updates to README

# 2.0.0 (2017-04-29)

- Fully implements the [IndexedDB 2.0 API](https://hacks.mozilla.org/2016/10/whats-new-in-indexeddb-2-0/) (which technically still is a draft, but is probably not going to substantially change).
- Ported to TypeScript, which hopefully means less bugs.
- Dynamically runs [the W3C web-platform-tests](https://github.com/w3c/web-platform-tests/tree/master/IndexedDB) rather than using manually ported tests. This means it's easy to run new tests, and the tests written since the original release of fake-indexeddb turned up several minor bugs which have now been fixed. See `npm run test-w3c`.
