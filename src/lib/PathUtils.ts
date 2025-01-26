import { RecordStoreType } from "./RecordStore.js";
import { Key } from "./types.js";
export const SEPARATOR = "_";

export class PathUtils {
    static createKeyPath(
        keyPrefix: string,
        type: RecordStoreType,
        key: Key,
    ): string {
        return type + SEPARATOR + keyPrefix + key.toString();
    }

    static createPrefixPath(keyPrefix: string, type: RecordStoreType): string {
        return type + SEPARATOR + keyPrefix;
    }
}
