var Event = require('./Event');
var FDBVersionChangeEvent = require('./FDBVersionChangeEvent');

function fireEvent(type, request, result) {
    process.nextTick(function () {
        request.readyState = 'done';
        if (type === 'error') {
            request.error = result;
            if (request.onerror) {
                var event = new Event();
                event.target = request;
                event.type = 'error';
                request.onerror(event);
            }
        } else if (type === 'success') {
            request.result = result;
            if (request.onsuccess) {
                var event = new Event();
                event.target = request;
                event.type = 'success';
                request.onsuccess(event);
            }
        } else if (type === 'upgradeneeded') {
            request.result = result;
            request.transaction = result.transaction(result.objectStoreNames, 'versionchange')

            if (request.onupgradeneeded) {
                var event = new FDBVersionChangeEvent();
                event.target = request;
                event.type = 'upgradeneeded';
                request.onupgradeneeded(event);
            }

            request.transaction.oncomplete = function () {
                request.transaction = null;

                fireEvent('success', request, result);
            };
        }
    });
}

module.exports = fireEvent;