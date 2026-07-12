// db.js — tiny promise-based wrapper around IndexedDB.
// The whole app talks to storage through window.Store, so no other file
// needs to know IndexedDB exists.
const Store = (() => {
    const DB_NAME = 'viewedTvDB';
    const STORE = 'entries';
    const VERSION = 1;

    let dbPromise;

    function open() {
        return (dbPromise ??= new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, VERSION);
            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(STORE)) {
                    db.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true });
                }
            };
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }));
    }

    // Runs one request inside a transaction and resolves with its result.
    function run(mode, action) {
        return open().then(db => new Promise((resolve, reject) => {
            const store = db.transaction(STORE, mode).objectStore(STORE);
            const request = action(store);
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        }));
    }

    return {
        all:    ()      => run('readonly', s => s.getAll()),
        add:    entry   => run('readwrite', s => s.add(entry)),
        remove: id      => run('readwrite', s => s.delete(id)),
        clear:  ()      => run('readwrite', s => s.clear()),
    };
})();

window.Store = Store;
