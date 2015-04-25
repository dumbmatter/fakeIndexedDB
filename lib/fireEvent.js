var Event = require('./Event');
var FDBVersionChangeEvent = require('./FDBVersionChangeEvent');

function fireEvent(type, request, result) {
    process.nextTick(function () {
        request.readyState = 'done';
        if (type === 'error') {
            request.error = result;
            var event = new Event();
            event.target = request;
            event.type = 'error';
            request.dispatchEvent(event);
        } else if (type === 'success') {
            request.result = result;
            var event = new Event();
            event.target = request;
            event.type = 'success';
            request.dispatchEvent(event);
        } else if (type === 'upgradeneeded') {
            request.result = result;
            request.transaction = result.transaction(result.objectStoreNames, 'versionchange')
            request.transaction.addEventListener('complete', function () {
                request.transaction = null;

                fireEvent('success', request, result);
            });

            var event = new FDBVersionChangeEvent();
            event.target = request;
            event.type = 'upgradeneeded';
            request.dispatchEvent(event);
        }
    });
}

module.exports = fireEvent;