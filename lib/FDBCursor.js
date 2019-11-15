// This file is needed to maintain API compatibility with fake-indexeddb 1.x because of
// <https://github.com/Microsoft/TypeScript/issues/2719> and <http://stackoverflow.com/q/30302747/786644>. It should not
// be used internally, only externally.

module.exports = require("../build/FDBCursor").default;
