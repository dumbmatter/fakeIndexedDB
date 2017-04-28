// This file is needed to maintain API compatibility with fake-indexeddb 1.x because of
// <https://github.com/Microsoft/TypeScript/issues/2719>. It should not be used internally, only externally.

import FDBFactory from "../FDBFactory";

export = FDBFactory;
