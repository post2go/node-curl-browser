var Curl = require('node-curl/lib/Curl');
var Browser = function () {
    var self = this;

    var globalHeaders = [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'User-Agent: Mozilla/5.0 (Windows NT 6.3; rv:27.0) Gecko/20100101 Firefox/27.0'
    ];

    var cookies = [ ];

    self.post = function (url, postData, callback) {
        var responseHeaders = [ ];
        var responseStatus = 0;
        var responseBody = [ ];
        var callbackCalled = false;

        var headers;
        headers = globalHeaders;
        headers.push('Cookie: ' + cookies.join(';'));

        var curl = new Curl();
        curl.setopt('URL', url);
        curl.setopt('NOPROGRESS', true);
        curl.setopt('HTTPHEADER', headers);
        curl.setopt('POST', true);
        curl.setopt('POSTFIELDS', postData);
        curl.setopt('FOLLOWLOCATION', true);
        curl.on('header', handleHeader);
        curl.on('error', handleError);
        curl.on('data', handleBody);
        curl.on('end', handleFinish);
        curl.perform();

        function handleError(error) {
            finishError(error.message);
            curl.close();
        }

        function handleHeader(chunk) {
            var header = chunk.toString().replace("\r", '').replace("\n", '');
            if(chunk.length > 2) {
                if(header.substr(0, 4) === 'HTTP') {
                    var status = header.split(' ');
                    responseStatus = status[1];
                } else {
                    responseHeaders.push(header);
                }
            }
            return chunk.length;
        }

        function handleBody(chunk) {
            responseBody.push(chunk);
            return chunk.length;
        }

        function handleFinish() {
            var result = {
                responseStatus: responseStatus, // curl.getinfo('RESPONSE_CODE'),
                contentType: curl.getinfo('CONTENT_TYPE'),
                responseHeaders: responseHeaders,
                responseBody: Buffer.concat(responseBody)
            };
            for (var i in responseHeaders) {
                if(!responseHeaders.hasOwnProperty(i)) continue;
                var header = responseHeaders[i];

                if(/Set\-Cookie:/.test(header)) {
                    var cookie = header.split(';')[0].split(':')[1].trim();
                    cookies.push(cookie);
                }
            }
            curl.close();
            finishSuccess(result);
        }

        function finishSuccess(result) {
            finish(null, result);
        }

        function finishError(error) {
            finish({ error: error, url: url });
        }

        function finish(error, result) {
            if(callbackCalled) {
                console.log('trying to send callback twice: ' + config.url);
                console.trace();
                return;
            }
            callbackCalled = true;
            if(error) {
                callback(error, null);
            } else {
                callback(null, result);
            }
        }
    };
};
module.exports = Browser;