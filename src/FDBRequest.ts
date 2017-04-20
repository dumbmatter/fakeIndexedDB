import FDBCursor from "./FDBCursor";
import FDBIndex from "./FDBIndex";
import FDBObjectStore from "./FDBObjectStore";
import FDBTransaction from "./FDBTransaction";
import EventTarget from "./lib/EventTarget";
import {EventCallback} from "./lib/types";

class FDBRequest extends EventTarget {
    public result: any = null;
    public error: Error | null | void = null;
    public source: FDBCursor | FDBIndex | FDBObjectStore | null = null;
    public transaction: FDBTransaction | null = null;
    public readyState: "done" | "pending" = "pending";
    public onsuccess: EventCallback | null = null;
    public onerror: EventCallback | null = null;

    public toString() {
        return "[object IDBRequest]";
    }
}

export default FDBRequest;
