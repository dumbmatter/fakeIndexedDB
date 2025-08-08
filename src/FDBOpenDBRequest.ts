import FDBRequest from "./FDBRequest.js";
import { EventCallback } from "./lib/types.js";

class FDBOpenDBRequest extends FDBRequest {
    public onupgradeneeded: EventCallback | null = null;
    public onblocked: EventCallback | null = null;

    get [Symbol.toStringTag]() {
        return "IDBOpenDBRequest";
    }
}

export default FDBOpenDBRequest;
