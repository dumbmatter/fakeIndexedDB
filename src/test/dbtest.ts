import dbManager from "../lib/LevelDBManager";
import IDBDatabase from "../FDBDatabase";

interface IDBEvent {
    preventDefault: () => void;
}

interface IDBErrorEvent extends IDBEvent {
    target: {
        error: Error;
    };
}

// Initialize the IndexedDB environment
async function initEnvironment() {
    await dbManager.loadCache();
    // Import fakeIndexedDB after cache is loaded
    const { default: fakeIndexedDB } = await import("../fakeIndexedDB");
    return fakeIndexedDB;
}

// Helper function to initialize the database
async function initializeDB(fakeIndexedDB: any): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = fakeIndexedDB.open("test", 1);

        request.onerror = (event: IDBErrorEvent) => {
            console.error("Database error:", event.target.error);
            reject(new Error("Failed to open database"));
        };

        request.onupgradeneeded = () => {
            const db = request.result;
            console.log("Initializing test database...");

            // Create books store with indexes
            const store = db.createObjectStore("books", {
                keyPath: "id",
                autoIncrement: true,
            });
            store.createIndex("by_title", "title", { unique: true });
        };

        request.onsuccess = () => resolve(request.result);
    });
}

async function deleteDatabase(fakeIndexedDB: any) {
    return new Promise<void>((resolve, reject) => {
        const request = fakeIndexedDB.deleteDatabase("test");
        request.onsuccess = () => {
            console.log("Database deleted successfully");
            resolve();
        };
        request.onerror = () => reject(new Error("Could not delete database"));
    });
}

async function runTest() {
    try {
        console.log("\n=== Starting Test ===\n");

        // Initialize environment first
        const fakeIndexedDB = await initEnvironment();
        console.log("Environment initialized");

        // First cycle - Create DB and add record
        const db1 = await initializeDB(fakeIndexedDB);
        console.log("Database initialized for first cycle");

        await new Promise<void>((resolve, reject) => {
            const tx = db1.transaction("books", "readwrite");
            const store = tx.objectStore("books");

            const addReq = store.add({
                title: "Modern Stone Tools",
                author: "Fred",
            });
            addReq.onsuccess = () => {
                console.log("✅ First cycle: Book added successfully");
                db1.close();
                resolve();
            };
            addReq.onerror = (e: IDBEvent) => {
                e.preventDefault();
                console.error("❌ First cycle: Failed to add book");
                reject(new Error("Failed to add book in first cycle"));
            };
        });

        // Delete database
        await deleteDatabase(fakeIndexedDB);
        console.log("Database deleted between cycles");

        // Second cycle - Try to create same record
        const db2 = await initializeDB(fakeIndexedDB);
        console.log("Database initialized for second cycle");

        await new Promise<void>((resolve, reject) => {
            const tx = db2.transaction("books", "readwrite");
            const store = tx.objectStore("books");

            const addReq = store.add({
                title: "Modern Stone Tools",
                author: "Fred",
            });
            addReq.onsuccess = () => {
                console.log("✅ Second cycle: Book added successfully");
                db2.close();
                resolve();
            };
            addReq.onerror = (e: IDBEvent) => {
                e.preventDefault();
                console.error("❌ Second cycle: Got constraint error");
                reject(new Error("Got constraint error on second cycle"));
            };
        });

        console.log("\n✅ Test completed successfully!");
    } catch (error) {
        console.error("\n❌ Test failed:", error);
        process.exit(1);
    }
}

// Run the test
runTest();
