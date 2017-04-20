import FDBDatabase from "./FDBDatabase";
import FDBObjectStore from "./FDBObjectStore";
import FDBRequest from "./FDBRequest";
const {AbortError, InvalidStateError, NotFoundError, TransactionInactiveError} = require("./lib/errors");
import Event from "./lib/Event";
import EventTarget from "./lib/EventTarget";
import {EventCallback, RequestObj, RollbackLog, TransactionMode} from "./lib/types";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#transaction
class FDBTransaction extends EventTarget {
    public _started = false;
    public _active = true;
    public _finished = false; // Set true after commit or abort
    public _rollbackLog: RollbackLog = [];

    public mode: TransactionMode;
    public db: FDBDatabase;
    public error: Error | null = null;
    public onabort: EventCallback | null = null;
    public oncomplete: EventCallback | null = null;
    public onerror: EventCallback | null = null;

    private _scope: string[];
    private _requests: Array<{
        operation: () => void,
        request: FDBRequest,
    }> = [];

    constructor(storeNames: string[], mode: TransactionMode, db: FDBDatabase) {
        super();

        this._scope = storeNames;
        this.mode = mode;
        this.db = db;
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-aborting-a-transaction
    public _abort(errName: string | null) {
        for (const f of this._rollbackLog.reverse()) {
            f();
        }

        if (errName !== null) {
            const e = new Error();
            e.name = errName;
            this.error = e;
        }

// Should this directly remove from _requests?
        for (const {request} of this._requests) {
            if (request.readyState !== "done") {
                request.readyState = "done"; // This will cancel execution of this request's operation
                if (request.source) {
                    request.result = undefined;
                    request.error = new AbortError();

                    const event = new Event("error", {
                        bubbles: true,
                        cancelable: true,
                    });
                    event.eventPath = [this.db, this];
                    request.dispatchEvent(event);
                }
            }
        }

        setImmediate(() => {
            const event = new Event("abort", {
                bubbles: true,
                cancelable: false,
            });
            event.eventPath = [this.db];
            this.dispatchEvent(event);
        });

        this._finished = true;
    }

    public abort() {
        if (this._finished) {
            throw new InvalidStateError();
        }
        this._active = false;

        this._abort(null);
    }

    public objectStore(name: string) {
        const rawObjectStore = this.db._rawDatabase.rawObjectStores.get(name);
        if (this._scope.indexOf(name) < 0 || rawObjectStore === undefined) {
            throw new NotFoundError();
        }

        if (!this._active) {
            throw new InvalidStateError();
        }

        return new FDBObjectStore(this, rawObjectStore);
    }

    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-asynchronously-executing-a-request
    public _execRequestAsync(obj: RequestObj) {
        const source = obj.source;
        const operation = obj.operation;
        let request = obj.hasOwnProperty("request") ? obj.request : null;

        if (!this._active) {
            throw new TransactionInactiveError();
        }

        // Request should only be passed for cursors
        if (!request) {
            if (!source) {
                // Special requests like indexes that just need to run some code
                request = new FDBRequest();
            } else {
                request = new FDBRequest();
                request.source = source;
                request.transaction = (source as any).transaction;
            }
        }

        this._requests.push({
            request,
            operation,
        });

        return request;
    }

    public _start() {
        this._started = true;

        // Remove from request queue - cursor ones will be added back if necessary by cursor.continue and such
        let operation;
        let request;
        while (this._requests.length > 0) {
            const r = this._requests.shift();

            // This should only be false if transaction was aborted
            if (r && r.request.readyState !== "done") {
                request = r.request;
                operation = r.operation;
                break;
            }
        }

        if (request && operation) {
            if (!request.source) {
                // Special requests like indexes that just need to run some code, with error handling already built into
                // operation
                operation();
            } else {
                let defaultAction;
                let event;
                try {
                    const result = operation();
                    request.readyState = "done";
                    request.result = result;
                    request.error = undefined;

                    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-fire-a-success-event
                    this._active = true;
                    event = new Event("success", {
                        bubbles: false,
                        cancelable: false,
                    });
                } catch (err) {
                    request.readyState = "done";
                    request.result = undefined;
                    request.error = err;

                    // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-fire-an-error-event
                    this._active = true;
                    event = new Event("error", {
                        bubbles: true,
                        cancelable: true,
                    });

                    defaultAction = this._abort.bind(this, err.name);
                }

                try {
                    event.eventPath = [this.db, this];
                    request.dispatchEvent(event);

                    // You're supposed to set this._active to false here, but I'm skipping that.
                    // Why? Because scheduling gets tricky when promises are involved. I know that
                    // promises and IndexedDB transactions in general are tricky
                    // https://lists.w3.org/Archives/Public/public-webapps/2015AprJun/0126.html but
                    // for some reason I still tend to do it. So this line is commented out for me,
                    // and for any other masochists who do similar things. It doesn't seem to break
                    // any tests or functionality, and in fact if I uncomment this line it does make
                    // transaction/promise interactions wonky.
                    // this._active = false;
                } catch (err) {
// console.error(err);
                    this._abort("AbortError");
                    throw err;
                }

                // Default action of event
                if (!event.canceled) {
                    if (defaultAction) {
                        defaultAction();
                    }
                }
            }

            // On to the next one
            if (this._requests.length > 0) {
                this._start();
            } else {
                // Give it another chance for new handlers to be set before finishing
                setImmediate(this._start.bind(this));
            }
            return;
        }

        // Check if transaction complete event needs to be fired
        if (!this._finished) { // Either aborted or committed already
            this._active = false;
            this._finished = true;

            if (!this.error) {
                const event = new Event("complete");
                this.dispatchEvent(event);
            }
        }
    }

    public toString() {
        return "[object IDBRequest]";
    }
}

export default FDBTransaction;
