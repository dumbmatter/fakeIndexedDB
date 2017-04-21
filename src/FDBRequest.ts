import FDBCursor from "./FDBCursor";
import FDBIndex from "./FDBIndex";
import FDBObjectStore from "./FDBObjectStore";
import FDBTransaction from "./FDBTransaction";
import FakeEventTarget from "./lib/FakeEventTarget";
import {EventCallback} from "./lib/types";

class FDBRequest extends FakeEventTarget {
    public result: any = null;
    public error: Error | null | undefined = null;
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
