var Curl = require('dv-curl/lib/Curl');
var Cookie = require('tough-cookie').Cookie;
var CookieJar = require('tough-cookie').CookieJar;

var Browser = function () {
    var self = this;

    var globalHeaders = [
        'Accept: text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language: en-US,en;q=0.8,ru;q=0.6',
        'Accept-Encoding: gzip,deflate,sdch',
        'Connection: close',
        'User-Agent: Mozilla/5.0 (Windows NT 6.3; rv:27.0) Gecko/20100101 Firefox/27.0',
        'Cache-Control: max-age=0',
        'Expect: '  // remove "Expect: 100-continue" header
    ];

    var cookiejar = new CookieJar();
    var referer = '';

    self.get = function (url, callback) {
        return processRequest('GET', { url: url }, callback);
    };

    self.post = function (url, postData, callback) {
        return processRequest('POST', { url: url, postData: postData }, callback);
    };

    self.postEx = function (options, callback) {
        return processRequest('POST', options, callback);
    };

    self.setReferer = function (url) {
        referer = url;
    };

    var proxy = null;

    self.setProxy = function (host) {
        proxy = host;
    };

    function processRequest(method, options, callback) {
        var url = options.url;

        var responseHeaders = [ ];
        var responseStatus = 0;
        var responseBody = [ ];
        var callbackCalled = false;

        var headers = JSON.parse(JSON.stringify(globalHeaders)); // Cloning object
        var cookieString = cookiejar.getCookieStringSync(url);
        if (cookieString) {
            headers.push('Cookie: ' + cookieString);
        }
        if (referer) {
            headers.push('Referer: ' + referer);
        }
        if (options.contentType) {
            headers.push('Content-Type: ' + options.contentType);
        } else if (method == 'POST') {
            headers.push('Content-Type: application/x-www-form-urlencoded');
        }

        var curl = new Curl();
        curl.setopt('URL', url);
        curl.setopt('NOPROGRESS', true);
        curl.setopt('HTTPHEADER', headers);
        if (method == 'POST') {
            curl.setopt('POST', true);
            curl.setopt('POSTFIELDS', options.postData);
        }
        curl.setopt('FOLLOWLOCATION', true);
        curl.setopt('SSL_VERIFYHOST', false);
        curl.setopt('SSL_VERIFYPEER', false);
        curl.setopt('ACCEPT_ENCODING', 'gzip');
        if (proxy) {
            curl.setopt('PROXY', proxy);
        }

        curl.on('header', handleHeader);
        curl.on('error', handleError);
        curl.on('data', handleBody);
        curl.on('end', handleFinish);
        curl.perform();

        function handleError(error) {
            finishError(error.message);
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
                status: responseStatus, // curl.getinfo('RESPONSE_CODE'),
                contentType: curl.getinfo('CONTENT_TYPE'),
                headers: responseHeaders,
                body: Buffer.concat(responseBody)
            };
            for (var i in responseHeaders) {
                if(!responseHeaders.hasOwnProperty(i)) continue;
                var header = responseHeaders[i];

                if(/Set\-Cookie:/.test(header)) {
                    var cookie = Cookie.parse(header.replace('Set-Cookie: ', '').trim());
                    cookiejar.setCookieSync(cookie, url);
                }
            }
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
            curl.close();
            callbackCalled = true;
            if(error) {
                callback(error, null);
            } else {
                callback(null, result);
            }
        }
    }

};
module.exports = Browser;