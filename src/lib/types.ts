import FDBIndex from "../FDBIndex";
import FDBKeyRange from "../FDBKeyRange";
import FDBObjectStore from "../FDBObjectStore";
import FDBRequest from "../FDBRequest";
import Event from "./Event";
import EventTarget from "./EventTarget";

export type CursorSource = FDBIndex | FDBObjectStore;

interface EventInCallback extends Event {
    target: any;
    error: Error | null;
}

export type EventCallback = (event: EventInCallback) => void;

export type EventType = "abort" | "blocked" | "complete" | "error" | "success" | "upgradeneeded" | "versionchange";

export type FDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique";

export type KeyPath = string | string[];

export type Key = any;

export type CursorRange =  Key | FDBKeyRange | void;

export type Value = any;

export interface Record {
    key: Key;
    value: Key | Value; // For indexes, will be Key. For object stores, will be Value.
}

export interface RequestObj {
    operation: () => void;
    request?: FDBRequest | void;
    source?: any;
}

export type RollbackLog = Array<() => void>;

export type TransactionMode = "readonly" | "readwrite" | "versionchange";
