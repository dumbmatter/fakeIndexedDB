import "core-js/stable";
// @ts-ignore
import { indexedDB, IDBKeyRange } from "../../../build/index.js";

window.indexedDBmock = indexedDB;
window.IDBKeyRangemock = IDBKeyRange;
