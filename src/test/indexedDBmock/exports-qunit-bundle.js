import "core-js/stable";
import indexedDB from "../..";
import IDBKeyRange from "../../FDBKeyRange";

window.indexedDBmock = indexedDB;
window.IDBKeyRangemock = IDBKeyRange;
