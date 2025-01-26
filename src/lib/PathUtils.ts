import { RecordStoreType, SEPARATOR } from "./RecordStore.js";
import { Key } from "./types.js";

export class PathUtils {
    static createStorePath(
        dbName: string,
        storeName: string,
        type: RecordStoreType,
        key?: Key,
    ): string {
        const basePath = `${type}${SEPARATOR}${dbName}/${storeName}`;
        return key !== undefined ? `${basePath}/${key}` : basePath;
    }

    static createIndexPath(
        dbName: string,
        storeName: string,
        indexName: string,
        key?: Key,
    ): string {
        return (
            this.createStorePath(dbName, storeName, "index", key) +
            (key ? "" : `/${indexName}`)
        );
    }

    static createStructurePath(dbName: string, storeName?: string): string {
        if (storeName) {
            return `__db_structure__${dbName}/${storeName}`;
        }
        return `__db_structure__${dbName}`;
    }

    static parseStorePath(path: string): {
        type: RecordStoreType;
        dbName: string;
        storeName: string;
        key?: string;
    } {
        const [type, ...parts] = path.split(SEPARATOR);
        const [dbName, storeName, key] = parts[0].split("/");
        return {
            type: type as RecordStoreType,
            dbName,
            storeName,
            key,
        };
    }
}
