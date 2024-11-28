import * as path from "path";
import { Level } from "level";
import { Record, DatabaseStructure } from "./types.js";
import Database from "./Database.js";
import { RecordStoreType, SEPARATOR } from "./RecordStore.js";

class LevelDBManager {
    private static instance: LevelDBManager;
    private db: Level<string, any>;
    private cache: Map<string, Record> = new Map();
    public isLoaded: boolean = false;
    private databaseStructures: Map<string, DatabaseStructure> = new Map();

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
            } catch (error) {
                if (error.code === "LEVEL_NOT_FOUND") {
                    console.log(
                        "No existing database list found. Starting with an empty database.",
                    );
                    // Initialize with an empty database list
                    await this.db.put("__db_list__", JSON.stringify([]));
                } else {
                    throw error;
                }
            }

            for (const dbName of dbList) {
                try {
                    const dbStructureJson = await this.db.get(
                        `__db_structure__${dbName}`,
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
            // console.log('Loaded databaseStructures:', this.databaseStructures);

            // Load actual data
            for await (const [key, value] of this.db.iterator()) {
                if (!key.startsWith("__")) {
                    // Skip structure keys
                    this.cache.set(key, value);
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
        const dbStructure: DatabaseStructure = {
            name: db.name,
            version: db.version,
            objectStores: {},
        };

        for (const [name, objectStore] of db.rawObjectStores) {
            dbStructure.objectStores[name] = {
                keyPath: objectStore.keyPath,
                autoIncrement: objectStore.autoIncrement,
                indexes: {},
            };

            for (const [indexName, index] of objectStore.rawIndexes) {
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
            await this.db.put("__db_list__", JSON.stringify(dbList));
        }
        // console.log("Saving database structure", dbStructure);
        this.databaseStructures.set(db.name, dbStructure);

        await this.db.put(
            `__db_structure__${db.name}`,
            JSON.stringify(dbStructure),
        );
        // console.log("Successfully saved");
    }

    public getDatabaseStructure(dbName: string): DatabaseStructure | undefined {
        return this.databaseStructures.get(dbName);
    }

    public getAllDatabaseStructures(): { [dbName: string]: DatabaseStructure } {
        if (!dbManager.isLoaded)
            throw new Error(
                "Database not loaded yet. Manually call await dbManager.loadCache() before awaiting import of real-indexeddb/auto in any module",
            );
        return Object.fromEntries(this.databaseStructures);
    }

    public get(key: string): Record | undefined {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        return this.cache.get(key);
    }

    public set(key: string, value: Record) {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        this.cache.set(key, value);
        this.db
            .put(key, value)
            .catch((err) => console.error("Error persisting record:", err));
    }

    public delete(key: string) {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        this.cache.delete(key);
        this.db
            .del(key)
            .catch((err) =>
                console.error("Error deleting record from persistence:", err),
            );
    }

    public async deleteDatabaseStructure(dbName: string) {
        this.databaseStructures.delete(dbName);
        const dbList = Array.from(this.databaseStructures.keys());
        await this.db.put("__db_list__", JSON.stringify(dbList));
        await this.db.del(`__db_structure__${dbName}`);
    }

    public getKeysStartingWith(prefix: string): string[] {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        return Array.from(this.cache.keys()).filter((key) =>
            key.startsWith(prefix),
        );
    }

    public getValuesForKeysStartingWith(
        prefix: string,
        type: RecordStoreType,
    ): Record[] {
        if (!this.isLoaded) throw new Error("Database not loaded yet");
        const validatedPrefix = type + SEPARATOR + prefix;

        return Array.from(this.cache.entries())
            .filter(([key]) => key.startsWith(validatedPrefix))
            .map(([, value]) => value);
    }
}

// Export the instance and the loadCache function
const dbManager = LevelDBManager.getInstance(
    path.resolve(process.cwd(), "indexeddb"),
);
export default dbManager;
