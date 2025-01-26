import { RecordStoreType } from "./RecordStore.js";
import { Key } from "./types.js";
export const SEPARATOR = "/";

export class PathUtils {
    static DB_LIST_KEY = "__db_list__";
    static DB_STRUCTURE_KEY = "__db_structure__";
    static SPECIAL_KEYS = [PathUtils.DB_LIST_KEY, PathUtils.DB_STRUCTURE_KEY];

    static createObjectStoreKeyPath(dbName: string, storeName: string): string {
        return `${dbName}/${storeName}/`;
    }
    // For record store
    static createRecordStoreKeyPath(
        keyPrefix: string,
        type: RecordStoreType,
        key: Key,
    ): string {
        return type + SEPARATOR + keyPrefix + key.toString();
    }
}
