import EventTarget from "./lib/EventTarget";
import {EventCallback} from "./lib/types";

class FDBRequest extends EventTarget {
    public result: any = null;
    public error: Error | null | void = null;
    public source: any = null;
    public transaction = null;
    public readyState: "done" | "pending" = "pending";
    public onsuccess: EventCallback | null = null;
    public onerror: EventCallback | null = null;

    public toString() {
        return "[object IDBRequest]";
    }
}

export default FDBRequest;
