import FDBCursor from "./FDBCursor";
import FDBIndex from "./FDBIndex";
import FDBObjectStore from "./FDBObjectStore";
import FDBTransaction from "./FDBTransaction";
import { InvalidStateError } from "./lib/errors";
import FakeEventTarget from "./lib/FakeEventTarget";
import { EventCallback } from "./lib/types";

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

    public toString() {
        return "[object IDBRequest]";
    }
}

export default FDBRequest;
