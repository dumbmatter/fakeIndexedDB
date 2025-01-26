import * as path from "path";
import { Level } from "level";
import { Record, DatabaseStructure } from "./types.js";
import Database from "./Database.js";
import { RecordStoreType, SEPARATOR } from "./RecordStore.js";
import { PathUtils } from "./PathUtils.js";

type RecordValue = Record | Record[];

class LevelDBManager {
    private static instance: LevelDBManager;
    private db: Level<string, any>;
    private cache: Map<string, RecordValue> = new Map();
    public isLoaded: boolean = false;
    private databaseStructures: Map<string, DatabaseStructure> = new Map();
    private pendingWrites: Promise<void>[] = [];

    private constructor(dbName: string) {
        this.db = new Level<string, any>(dbName, { valueEncoding: "json" });
    }

    public static getInstance(dbName: string): LevelDBManager {
        if (!LevelDBManager.instance) {
            LevelDBManager.instance = new LevelDBManager(dbName);
        }
        return LevelDBManager.instance;
    }

    public async loadCache() {
        console.log("Loading database structures and data into memory");
        try {
            // Load database structures
            let dbList: string[] = [];
            try {
                const dbListJson = await this.db.get("__db_list__");
                dbList = JSON.parse(dbListJson);
                console.log("Loaded database list:", dbList);
            } catch (error) {
                if (error.code === "LEVEL_NOT_FOUND") {
                    console.log(
                        "No existing database list found. Starting with an empty database.",
                    );
                    await this.db.put("__db_list__", JSON.stringify([]));
                } else {
                    throw error;
                }
            }

            for (const dbName of dbList) {
                try {
                    const dbStructureJson = await this.db.get(
                        PathUtils.createStructurePath(dbName),
                    );
                    const dbStructure: DatabaseStructure =
                        JSON.parse(dbStructureJson);
                    this.databaseStructures.set(dbName, dbStructure);
                } catch (error) {
                    if (error.code === "LEVEL_NOT_FOUND") {
                        console.log(
                            `No structure found for database ${dbName}. Skipping.`,
                        );
                    } else {
                        throw error;
                    }
                }
            }

            // Load actual data
            for await (const [key, value] of this.db.iterator()) {
                if (!key.startsWith("__")) {
                    // Skip structure keys
                    console.log(`Loading key type: ${key.split("/")[0]}`); // Log the type (index/object)
                    this.cache.set(key, value);
                    console.log("Loaded key:", key, "with value:", value);
                }
            }

            this.isLoaded = true;
            console.log("Database loaded into memory");
        } catch (error) {
            console.error("Error loading database:", error);
            this.cache.clear();
            this.databaseStructures.clear();
            throw error;
        }
    }

    public async saveDatabaseStructure(db: Database) {
        console.log("Saving database structure for:", db.name);
        const dbStructure: DatabaseStructure = {
            name: db.name,
            version: db.version,
            objectStores: {},
        };

        for (const [name, objectStore] of db.rawObjectStores) {
            console.log(`Processing object store: ${name}`);
            dbStructure.objectStores[name] = {
                keyPath: objectStore.keyPath,
                autoIncrement: objectStore.autoIncrement,
                indexes: {},
            };

            for (const [indexName, index] of objectStore.rawIndexes) {
                console.log(
                    `Processing index: ${indexName} for store: ${name}`,
                );
                dbStructure.objectStores[name].indexes[indexName] = {
                    keyPath: index.keyPath,
                    multiEntry: index.multiEntry,
                    unique: index.unique,
                };
            }
        }

        const dbList = Array.from(this.databaseStructures.keys());
        if (!dbList.includes(db.name)) {
            dbList.push(db.name);
            console.log("Updating database list:", dbList);
            const dbListPromise = this.db
                .put("__db_list__", JSON.stringify(dbList))
                .catch((err) => {
                    console.error("Error saving database list:", err);
                    throw err;
                })
                .finally(() => {
                    const index = this.pendingWrites.indexOf(dbListPromise);
                    if (index > -1) {
                        this.pendingWrites.splice(index, 1);
                    }
                });

            this.pendingWrites.push(dbListPromise);
            await dbListPromise;
        }

        this.databaseStructures.set(db.name, dbStructure);

        const structurePromise = this.db
            .put(
                PathUtils.createStructurePath(db.name),
                JSON.stringify(dbStructure),
            )
            .catch((err) => {
                console.error("Error saving database structure:", err);
                throw err;
            })
            .finally(() => {
                const index = this.pendingWrites.indexOf(structurePromise);
                if (index > -1) {
                    this.pendingWrites.splice(index, 1);
                }
            });

        console.log("Saving database structure", dbStructure);
        this.pendingWrites.push(structurePromise);
        await structurePromise;
    }

    public getDatabaseStructure(dbName: string): DatabaseStructure | undefined {
        return this.databaseStructures.get(dbName);
    }

    public getAllDatabaseStructures(): { [dbName: string]: DatabaseStructure } {
        if (!this.isLoaded)
            throw new Error(
                "Database not loaded yet. Manually call await dbManager.loadCache() before awaiting import of real-indexeddb/auto in any module",
            );
        return Object.fromEntries(this.databaseStructures);
    }

    public get(key: string): RecordValue | undefined {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        return this.cache.get(key);
    }

    public set(key: string, value: RecordValue) {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        console.log(`Setting key: ${key} with value:`, value);

        this.cache.set(key, value);

        const writePromise = this.db
            .put(key, value)
            .catch((err) => {
                console.error("Error writing record to persistence:", err);
                throw err;
            })
            .finally(() => {
                const index = this.pendingWrites.indexOf(writePromise);
                if (index > -1) {
                    this.pendingWrites.splice(index, 1);
                }
            });

        this.pendingWrites.push(writePromise);
    }

    public delete(key: string) {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        console.log(`Deleting key: ${key}`);
        this.cache.delete(key);

        const deletePromise = this.db
            .del(key)
            .catch((err) => {
                console.error("Error deleting record from persistence:", err);
                throw err;
            })
            .finally(() => {
                const index = this.pendingWrites.indexOf(deletePromise);
                if (index > -1) {
                    this.pendingWrites.splice(index, 1);
                }
            });

        this.pendingWrites.push(deletePromise);
    }

    public async deleteDatabaseStructure(dbName: string) {
        this.databaseStructures.delete(dbName);
        const dbList = Array.from(this.databaseStructures.keys());
        const promises = [
            this.db.put("__db_list__", JSON.stringify(dbList)),
            this.db.del(PathUtils.createStructurePath(dbName)),
        ];
        this.pendingWrites.push(...promises);
        await Promise.all(promises);
    }

    public getKeysStartingWith(prefix: string): string[] {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        return Array.from(this.cache.keys()).filter((key) =>
            key.startsWith(prefix),
        );
    }

    public getValuesForKeysStartingWith(
        storePath: string,
        type: RecordStoreType,
    ): Record[] {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        const validatedPrefix = `${type}${SEPARATOR}${storePath}`;
        console.log(`Getting values for ${type} store at path: ${storePath}`);

        const records: Record[] = [];
        for (const [key, value] of this.cache) {
            if (key.startsWith(validatedPrefix)) {
                console.log(
                    `Found matching record - key: ${key}, value:`,
                    value,
                );
                if (Array.isArray(value)) {
                    records.push(...value);
                } else {
                    records.push(value);
                }
            }
        }
        console.log(
            `Found ${records.length} records for ${type} store at ${storePath}`,
        );
        return records;
    }

    public async flushWrites(): Promise<void> {
        console.log("Flushing writes to disk", this.pendingWrites.length);
        if (this.pendingWrites.length === 0) return;

        const writes = [...this.pendingWrites];
        this.pendingWrites = [];

        try {
            // Process writes sequentially instead of in parallel
            for (const write of writes) {
                await write;
            }
            console.log(
                `Successfully flushed ${writes.length} pending writes to disk`,
            );
        } catch (error) {
            // Put failed writes back in the queue in their original order
            this.pendingWrites.unshift(...writes);
            throw error;
        }
    }
}

// Export the instance and the loadCache function
const dbManager = LevelDBManager.getInstance(
    path.resolve(process.cwd(), "indexeddb"),
);
export default dbManager;
