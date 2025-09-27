import "../../wpt-env.js";

let cursor,db,result,store,value;


'use strict';

self.addEventListener('message', async event => {
  const action = event.data.action;
  let response = null;
  switch(action) {
    case 'get-database-names': {
      const dbInfos = await self.indexedDB.databases();
      response = dbInfos.map(dbInfo => dbInfo.name);
      break;
    }

    case 'delete-database': {
      const dbName = event.data.name;
      await new Promise((resolve, reject) => {
        const request = indexedDB.deleteDatabase(dbName);
        request.onsuccess = resolve;
        request.onerror = reject;
      });
      response = true;
      break;
    }
  }
  event.source.postMessage({ action, response }, event.origin);
  window.close();
});

// Make up for the fact that the opener of a cross-origin window has no way of
// knowing when the window finishes loading.
if (window.opener !== null) {
  window.opener.postMessage({ action: null, response: 'ready' }, '*');
}
