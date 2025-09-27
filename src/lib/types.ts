import type FDBIndex from "../FDBIndex.js";
import type FDBKeyRange from "../FDBKeyRange.js";
import type FDBObjectStore from "../FDBObjectStore.js";
import type FDBRequest from "../FDBRequest.js";

export type CursorSource = FDBIndex | FDBObjectStore;

interface EventInCallback extends Event {
    target: any;
    error: Error | null;
}

export type EventCallback = (event: EventInCallback) => void;

export type EventType =
    | "abort"
    | "blocked"
    | "close"
    | "complete"
    | "error"
    | "success"
    | "upgradeneeded"
    | "versionchange";

export type FDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique";

export type KeyPath = string | string[];

export type Key = any;

export type CursorRange = Key | FDBKeyRange | undefined;

export type Value = any;

export interface Record {
    key: Key;
    value: Key | Value; // For indexes, will be Key. For object stores, will be Value.
}

export interface RequestObj {
    operation: () => void;
    request?: FDBRequest | undefined;
    source?: any;
}

export type RollbackLog = (() => void)[];

export type TransactionMode = "readonly" | "readwrite" | "versionchange";

// https://www.w3.org/TR/IndexedDB/#dictdef-idbgetalloptions
export interface FDBGetAllOptions {
    query?: FDBKeyRange | Key;
    count?: number;
    direction?: FDBCursorDirection;
}

// https://w3c.github.io/IndexedDB/#enumdef-idbtransactiondurability
export type FDBTransactionDurability = "default" | "strict" | "relaxed";

export type FDBTransactionOptions = {
    durability: FDBTransactionDurability;
};

// https://w3c.github.io/IndexedDB/#dictdef-idbdatabaseinfo
export type FDBDatabaseInfo = {
    name: string;
    version: number;
};
