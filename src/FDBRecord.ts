import { Key } from "./lib/types";

class FDBRecord {
    private _key: Key;
    private _primaryKey: Key;
    private _value: any;

    constructor(key: Key, primaryKey: Key, value: any) {
        this._key = key;
        this._primaryKey = primaryKey;
        this._value = value;
    }

    get key() {
        return this._key;
    }

    set key(_) {
        /* for babel */
    }

    get primaryKey() {
        return this._primaryKey;
    }

    set primaryKey(_) {
        /* for babel */
    }

    get value() {
        return this._value;
    }

    set value(_) {
        /* for babel */
    }

    get [Symbol.toStringTag]() {
        return "IDBRecord";
    }
}

export default FDBRecord;
