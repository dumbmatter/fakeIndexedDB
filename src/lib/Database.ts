import FDBDatabase from "../FDBDatabase.js";
import FDBTransaction from "../FDBTransaction.js";
import ObjectStore from "./ObjectStore.js";
import { queueTask } from "./scheduling.js";
import dbManager from "./LevelDBManager.js";

// http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-database
class Database {
    public deletePending = false;
    public readonly transactions: FDBTransaction[] = [];
    public readonly rawObjectStores: Map<string, ObjectStore> = new Map();
    public connections: FDBDatabase[] = [];

    public readonly name: string;
    public version: number;

    constructor(name: string, version: number) {
        this.name = name;
        this.version = version;

        this.processTransactions = this.processTransactions.bind(this);

        // Load existing structure
        const dbStructure = dbManager.getDatabaseStructure(name);
        if (process.env.DB_VERBOSE === "1") {
            console.log("Loaded db struct", dbStructure);
        }
        if (dbStructure && dbStructure.version === version) {
            for (const [osName, osData] of Object.entries(
                dbStructure.objectStores,
            )) {
                const objectStore = new ObjectStore(
                    this,
                    osName,
                    osData.keyPath,
                    osData.autoIncrement,
                );
                this.rawObjectStores.set(osName, objectStore);
            }
        }
    }

    // Method to save the current structure
    public async saveStructure() {
        await dbManager.saveDatabaseStructure(this);
    }

    public processTransactions() {
        queueTask(() => {
            const anyRunning = this.transactions.some((transaction) => {
                return (
                    transaction._started && transaction._state !== "finished"
                );
            });

            if (!anyRunning) {
                const next = this.transactions.find((transaction) => {
                    return (
                        !transaction._started &&
                        transaction._state !== "finished"
                    );
                });

                if (next) {
                    next.addEventListener("complete", this.processTransactions);
                    next.addEventListener("abort", this.processTransactions);
                    next._start();
                }
            }
        });
    }
}

export default Database;
