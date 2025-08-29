import { InvalidStateError } from "./lib/errors.js";
import FakeEventTarget from "./lib/FakeEventTarget.js";
import type FDBCursor from "./FDBCursor.js";
import type FDBIndex from "./FDBIndex.js";
import type FDBObjectStore from "./FDBObjectStore.js";
import type FDBTransaction from "./FDBTransaction.js";
import type { EventCallback } from "./lib/types.js";

class FDBRequest extends FakeEventTarget {
    public _result: any = null;
    public _error: Error | null | undefined = null;
    public source: FDBCursor | FDBIndex | FDBObjectStore | null = null;
    public transaction: FDBTransaction | null = null;
    public readyState: "done" | "pending" = "pending";
    public onsuccess: EventCallback | null = null;
    public onerror: EventCallback | null = null;

    public get error() {
        if (this.readyState === "pending") {
            throw new InvalidStateError();
        }
        return this._error;
    }

    public set error(value: any) {
        this._error = value;
    }

    public get result() {
        if (this.readyState === "pending") {
            throw new InvalidStateError();
        }
        return this._result;
    }

    public set result(value: any) {
        this._result = value;
    }

    get [Symbol.toStringTag]() {
        return "IDBRequest";
    }
}

export default FDBRequest;
