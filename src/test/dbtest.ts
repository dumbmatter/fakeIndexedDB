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
    return fakeIndexedDB;
}

// Helper function to initialize the database
async function initializeDB(fakeIndexedDB: any): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = fakeIndexedDB.open("test", 4);

        request.onerror = (event: IDBErrorEvent) => {
            console.error("Database error:", event.target.error);
            reject(new Error("Failed to open database"));
        };

        request.onupgradeneeded = (event: any) => {
            const db = event.target.result;
            console.log("Initializing test database...");

            // Create books store with indexes
            if (!db.objectStoreNames.contains("books")) {
                const store = db.createObjectStore("books", {
                    keyPath: "isbn",
                });
                store.createIndex("by_title", "title", { unique: true });
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
            }
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

async function runTests(cycle = 1) {
    let db;
    try {
        console.log(`\n${"=".repeat(20)}`);
        console.log(`📋 Starting Test Cycle ${cycle}`);
        console.log(`${"=".repeat(20)}\n`);

        // Initialize environment first
        const fakeIndexedDB = await initEnvironment();
        console.log("Environment initialized");

        // Only delete database before first cycle
        if (cycle === 1) {
            await deleteDatabase(fakeIndexedDB);
        }

        db = await initializeDB(fakeIndexedDB);
        let failedTests = 0;

        // Run all tests and count failures
        const tests = [
            { name: "Basic Read Operation", fn: testRead },
            { name: "Create Operation", fn: testCreate },
            { name: "Update Operation", fn: testUpdate },
            { name: "Delete Operation", fn: testDelete },
            { name: "Range Queries", fn: testRangeQueries },
            { name: "Index Queries", fn: testIndexQueries },
        ];

        for (const test of tests) {
            try {
                await test.fn(db);
            } catch (error) {
                failedTests++;
                logTestResult(test.name, false, error.message);
            }
        }

        // Cycle summary
        console.log(`\n${"-".repeat(20)}`);
        console.log(`Cycle ${cycle} Summary:`);
        console.log(`✅ Passed: ${tests.length - failedTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`${"-".repeat(20)}\n`);

        // Close the database connection after tests
        if (db) {
            db.close();
        }

        // Add a small delay before next cycle
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Run additional cycles
        if (cycle < 3) {
            await runTests(cycle + 1);
        }
    } catch (error) {
        console.error(`\n❌ Critical Error in Cycle ${cycle}:`, error);
    } finally {
        // Ensure database is closed even if an error occurred
        if (db) {
            db.close();
        }
    }
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

async function testCreate(db: IDBDatabase) {
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction("books", "readwrite");
        const store = tx.objectStore("books");
        let passed = false;

        const newBook = {
            title: "Modern Stone Tools",
            author: "Betty",
            isbn: 567890,
            price: 34.99,
        };

        const addRequest = store.add(newBook);
        addRequest.onsuccess = () => {
            // Verify the book was added
            const getRequest = store.get(567890);
            getRequest.onsuccess = (event: any) => {
                const book = event.target.result;
                passed = book && book.title === newBook.title;
                logTestResult(
                    "Create Test - Modern Stone Tools",
                    passed,
                    passed ? undefined : "Book was not found after creation",
                );
                resolve();
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

async function testRangeQueries(db: IDBDatabase) {
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

// Run all tests
runTests().catch(console.error);
