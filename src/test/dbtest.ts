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
    const { default: fakeIndexedDB } = await import("../fakeIndexedDB");
    const { IDBKeyRange } = await import("../index");
    return { fakeIndexedDB, IDBKeyRange };
}

// Helper function to initialize the database
async function initializeDB(fakeIndexedDB: any): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = fakeIndexedDB.open("test");

        request.onerror = (event: IDBErrorEvent) => {
            console.error("Database error:", event.target.error);
            reject(new Error("Failed to open database"));
        };

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            console.log("Creating test database...");

            const store = db.createObjectStore("books", {
                keyPath: "isbn",
            });
            store.createIndex("by_title", "title", { unique: false });
            store.createIndex("by_author", "author", { unique: false });
            store.createIndex("by_price", "price", { unique: false });

            // Add sample data
            const sampleBooks = [
                {
                    title: "Quarry Memories",
                    author: "Fred",
                    isbn: 123456,
                    price: 19.99,
                },
                {
                    title: "Water Buffaloes",
                    author: "Fred",
                    isbn: 234567,
                    price: 29.99,
                },
                {
                    title: "Bedrock Nights",
                    author: "Barney",
                    isbn: 345678,
                    price: 15.99,
                },
                {
                    title: "Stone Age Cooking",
                    author: "Wilma",
                    isbn: 456789,
                    price: 24.99,
                },
            ];
            sampleBooks.forEach((book) => store.put(book));

            // Add initial cycle counter
            store.put({ isbn: "current_cycle", cycle: 0 });
        };

        request.onsuccess = (event: any) => resolve(event.target.result);
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

// Test result helper
function logTestResult(
    testName: string,
    passed: boolean,
    details: string = "",
) {
    const status = passed ? "✅ PASSED" : "❌ FAILED";
    const detailsStr = details ? ` - ${details}` : "";
    console.log(`${status} | ${testName}${detailsStr}`);
    return passed;
}

async function testRead(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readonly");
        const store = tx.objectStore("books");
        let passed = false;

        const request = store.get(123456);
        request.onsuccess = (event: any) => {
            const book = event.target.result;
            passed = book && book.title === "Quarry Memories";
            logTestResult(
                "Read Test - Quarry Memories",
                passed,
                passed
                    ? undefined
                    : `Expected "Quarry Memories", got "${book?.title || "undefined"}"`,
            );
            resolve();
        };

        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

async function testCreate(db: IDBDatabase): Promise<boolean> {
    return new Promise((resolve, reject) => {
        const tx = db.transaction("books", "readwrite");
        const store = tx.objectStore("books");
        let passed = false;

        const newBook = {
            title: `Modern Stone Tools ${Date.now()}`,
            author: "Betty",
            isbn: 567890 + Math.floor(Math.random() * 1000),
            price: 34.99,
        };

        const addRequest = store.add(newBook);
        addRequest.onsuccess = () => {
            const getRequest = store.get(newBook.isbn);
            getRequest.onsuccess = (event: any) => {
                const book = event.target.result;
                passed = book && book.title === newBook.title;
                logTestResult(
                    "Create Test - Modern Stone Tools",
                    passed,
                    passed ? undefined : "Book was not found after creation",
                );
                resolve(passed);
            };
        };

        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

async function testUpdate(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readwrite");
        const store = tx.objectStore("books");
        let passed = false;

        const updatedBook = {
            title: "Water Buffaloes",
            author: "Fred",
            isbn: 234567,
            price: 39.99,
        };

        const updateRequest = store.put(updatedBook);
        updateRequest.onsuccess = () => {
            // Verify the update
            const getRequest = store.get(234567);
            getRequest.onsuccess = (event: any) => {
                const book = event.target.result;
                passed = book && book.price === 39.99;
                logTestResult(
                    "Update Test - Water Buffaloes",
                    passed,
                    passed
                        ? undefined
                        : `Expected price 39.99, got ${book?.price}`,
                );
                resolve();
            };
        };

        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

async function testDelete(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readwrite");
        const store = tx.objectStore("books");
        let passed = false;

        const deleteRequest = store.delete(456789);
        deleteRequest.onsuccess = () => {
            // Verify the deletion
            const getRequest = store.get(456789);
            getRequest.onsuccess = (event: any) => {
                passed = !event.target.result;
                logTestResult(
                    "Delete Test - Stone Age Cooking",
                    passed,
                    passed ? undefined : "Book still exists after deletion",
                );
                resolve();
            };
        };

        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

async function testIndexQueries(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readonly");
        const store = tx.objectStore("books");
        let testsCompleted = 0;
        let testsPassed = 0;

        // Test author index
        store.index("by_author").getAll("Fred").onsuccess = (event: any) => {
            const books = event.target.result;
            const passed = books.length === 2;
            testsPassed += passed ? 1 : 0;
            testsCompleted++;
            logTestResult(
                'Index Query - Author "Fred"',
                passed,
                passed ? undefined : `Expected 2 books, got ${books.length}`,
            );
        };

        // Test title index
        store.index("by_title").get("Bedrock Nights").onsuccess = (
            event: any,
        ) => {
            const book = event.target.result;
            const passed = book && book.author === "Barney";
            testsPassed += passed ? 1 : 0;
            testsCompleted++;
            logTestResult(
                'Index Query - Title "Bedrock Nights"',
                passed,
                passed
                    ? undefined
                    : `Expected author "Barney", got "${book?.author || "undefined"}"`,
            );
        };

        tx.oncomplete = () => {
            logTestResult(
                "All Index Queries",
                testsPassed === 2,
                `${testsPassed}/${testsCompleted} passed`,
            );
            resolve();
        };
        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

async function testRangeQueries(db: IDBDatabase, IDBKeyRange: any) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readonly");
        const store = tx.objectStore("books");
        let booksInRange = 0;

        const priceRange = IDBKeyRange.bound(20, 35);
        store.index("by_price").openCursor(priceRange).onsuccess = (
            event: any,
        ) => {
            const cursor = event.target.result;
            if (cursor) {
                booksInRange++;
                console.log(
                    `  📚 Found in range: "${cursor.value.title}" ($${cursor.value.price})`,
                );
                cursor.continue();
            } else {
                const passed = booksInRange > 0;
                logTestResult(
                    "Range Query - Price $20-$35",
                    passed,
                    `Found ${booksInRange} books in range`,
                );
                resolve();
            }
        };

        tx.onerror = (event: any) =>
            reject(new Error(`Transaction failed: ${event.target.error}`));
    });
}

// Additional persistence scenarios you might want to test:
async function testPersistenceEdgeCases(fakeIndexedDB: any) {
    // Test large data persistence
    const largeDataTest = async () => {
        // Create large dataset
        const largeData = Array.from({ length: 1000 }, (_, i) => ({
            title: `Book ${i}`,
            author: `Author ${i}`,
            isbn: 1000000 + i,
            price: 9.99,
            description: "x".repeat(1000), // 1KB of data per book
        }));

        // Save, reload, verify
        // ... implementation similar to testPersistence
    };

    // Test concurrent access persistence
    const concurrentAccessTest = async () => {
        // Open multiple connections, make changes, verify persistence
        // ... implementation
    };

    // Test persistence after crash simulation
    const crashRecoveryTest = async () => {
        // Make changes, force close without proper shutdown, reload, verify
        // ... implementation
    };
}

async function runTests() {
    let db: IDBDatabase | undefined;
    try {
        // Initialize environment first
        const { fakeIndexedDB, IDBKeyRange } = await initEnvironment();
        console.log("Environment initialized");

        db = await initializeDB(fakeIndexedDB);

        // Type the currentCycle promise result
        const currentCycle = await new Promise<number>((resolve) => {
            if (!db) throw new Error("Database not initialized");
            const tx = db.transaction("books", "readwrite");
            const store = tx.objectStore("books");
            const request = store.get("current_cycle");

            request.onsuccess = (event: any) => {
                const result = event.target.result;
                resolve(result?.cycle || 0);
            };

            request.onerror = () => {
                resolve(0);
            };
        });

        const nextCycle = currentCycle + 1;

        console.log(`\n${"=".repeat(20)}`);
        console.log(`📋 Running Test Cycle ${nextCycle}`);
        console.log(`${"=".repeat(20)}\n`);

        let failedTests = 0;
        let totalTests = 0;

        // Run tests appropriate for this cycle
        const tests = [];

        switch (nextCycle) {
            case 1:
                tests.push({ name: "Initial Setup", fn: testCreate });
                break;
            case 2:
                tests.push(
                    { name: "Verify Persistence", fn: testRead },
                    { name: "Modify Data", fn: testUpdate },
                );
                break;
            case 3:
                tests.push(
                    { name: "Verify Updates", fn: testRead },
                    { name: "Query Tests", fn: testIndexQueries },
                    { name: "Range Tests", fn: testRangeQueries },
                );
                break;
            case 4:
                tests.push({ name: "Cleanup", fn: testDelete });
                break;
            default:
                console.log("All test cycles completed!");
                await deleteDatabase(fakeIndexedDB);
                process.exit(0);
        }

        // Run this cycle's tests
        for (const test of tests) {
            totalTests++;
            try {
                const result = await test.fn(db, IDBKeyRange);
                if (result === false) {
                    failedTests++;
                }
            } catch (error) {
                failedTests++;
                logTestResult(test.name, false, error.message);
            }
        }

        // Store next cycle number
        await new Promise<void>((resolve, reject) => {
            if (!db) throw new Error("Database not initialized");
            const tx = db.transaction("books", "readwrite");
            const store = tx.objectStore("books");

            const request = store.put({
                isbn: "current_cycle",
                cycle: nextCycle,
            });

            request.onsuccess = () => {
                console.log(`Saved cycle ${nextCycle}`);
                resolve();
            };

            request.onerror = (event: IDBErrorEvent) => {
                reject(
                    new Error(`Failed to save cycle: ${event.target.error}`),
                );
            };

            tx.onerror = () => reject(new Error("Transaction failed"));
        });

        // Cycle summary
        console.log(`\n${"-".repeat(20)}`);
        console.log(`Cycle ${nextCycle} Summary:`);
        console.log(`✅ Passed: ${totalTests - failedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`${"-".repeat(20)}\n`);

        // Ensure we close the database before exiting
        await dbManager.flushWrites();
        db.close();
        console.log("Database closed");

        if (failedTests > 0) {
            process.exit(1);
        } else {
            process.exit(0);
        }
    } catch (error) {
        console.error(`\n❌ Critical Error:`, error);
        await dbManager.flushWrites();
        if (db) db.close();
        process.exit(1);
    }
}

// Run single cycle
runTests().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
});
