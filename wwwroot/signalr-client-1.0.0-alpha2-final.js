(function (f) { if (typeof exports === "object" && typeof module !== "undefined") { module.exports = f() } else if (typeof define === "function" && define.amd) { define([], f) } else { var g; if (typeof window !== "undefined") { g = window } else if (typeof global !== "undefined") { g = global } else if (typeof self !== "undefined") { g = self } else { g = this } g.signalR = f() } })(function () {
    var define, module, exports; return (function e(t, n, r) { function s(o, u) { if (!n[o]) { if (!t[o]) { var a = typeof require == "function" && require; if (!u && a) return a(o, !0); if (i) return i(o, !0); var f = new Error("Cannot find module '" + o + "'"); throw f.code = "MODULE_NOT_FOUND", f } var l = n[o] = { exports: {} }; t[o][0].call(l.exports, function (e) { var n = t[o][1][e]; return s(n ? n : e) }, l, l.exports, e, t, n, r) } return n[o].exports } var i = typeof require == "function" && require; for (var o = 0; o < r.length; o++)s(r[o]); return s })({
        1: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            class Base64EncodedHubProtocol {
                constructor(protocol) {
                    this.wrappedProtocol = protocol;
                    this.name = this.wrappedProtocol.name;
                    this.type = 1 /* Text */;
                }
                parseMessages(input) {
                    // The format of the message is `size:message;`
                    let pos = input.indexOf(":");
                    if (pos == -1 || input[input.length - 1] != ';') {
                        throw new Error("Invalid payload.");
                    }
                    let lenStr = input.substring(0, pos);
                    if (!/^[0-9]+$/.test(lenStr)) {
                        throw new Error(`Invalid length: '${lenStr}'`);
                    }
                    let messageSize = parseInt(lenStr, 10);
                    // 2 accounts for ':' after message size and trailing ';'
                    if (messageSize != input.length - pos - 2) {
                        throw new Error("Invalid message size.");
                    }
                    let encodedMessage = input.substring(pos + 1, input.length - 1);
                    // atob/btoa are browsers APIs but they can be polyfilled. If this becomes problematic we can use
                    // base64-js module
                    let s = atob(encodedMessage);
                    let payload = new Uint8Array(s.length);
                    for (let i = 0; i < payload.length; i++) {
                        payload[i] = s.charCodeAt(i);
                    }
                    return this.wrappedProtocol.parseMessages(payload.buffer);
                }
                writeMessage(message) {
                    let payload = new Uint8Array(this.wrappedProtocol.writeMessage(message));
                    let s = "";
                    for (let i = 0; i < payload.byteLength; i++) {
                        s += String.fromCharCode(payload[i]);
                    }
                    // atob/btoa are browsers APIs but they can be polyfilled. If this becomes problematic we can use
                    // base64-js module
                    let encodedMessage = btoa(s);
                    return `${encodedMessage.length.toString()}:${encodedMessage};`;
                }
            }
            exports.Base64EncodedHubProtocol = Base64EncodedHubProtocol;

        }, {}], 2: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            var TextMessageFormat;
            (function (TextMessageFormat) {
                const RecordSeparator = String.fromCharCode(0x1e);
                function write(output) {
                    return `${output}${RecordSeparator}`;
                }
                TextMessageFormat.write = write;
                function parse(input) {
                    if (input[input.length - 1] != RecordSeparator) {
                        throw new Error("Message is incomplete.");
                    }
                    let messages = input.split(RecordSeparator);
                    messages.pop();
                    return messages;
                }
                TextMessageFormat.parse = parse;
            })(TextMessageFormat = exports.TextMessageFormat || (exports.TextMessageFormat = {}));
            var BinaryMessageFormat;
            (function (BinaryMessageFormat) {
                // The length prefix of binary messages is encoded as VarInt. Read the comment in
                // the BinaryMessageParser.TryParseMessage for details.
                function write(output) {
                    // msgpack5 uses returns Buffer instead of Uint8Array on IE10 and some other browser
                    //  in which case .byteLength does will be undefined
                    let size = output.byteLength || output.length;
                    let lenBuffer = [];
                    do {
                        let sizePart = size & 0x7f;
                        size = size >> 7;
                        if (size > 0) {
                            sizePart |= 0x80;
                        }
                        lenBuffer.push(sizePart);
                    } while (size > 0);
                    // msgpack5 uses returns Buffer instead of Uint8Array on IE10 and some other browser
                    //  in which case .byteLength does will be undefined
                    size = output.byteLength || output.length;
                    let buffer = new Uint8Array(lenBuffer.length + size);
                    buffer.set(lenBuffer, 0);
                    buffer.set(output, lenBuffer.length);
                    return buffer.buffer;
                }
                BinaryMessageFormat.write = write;
                function parse(input) {
                    let result = [];
                    let uint8Array = new Uint8Array(input);
                    const maxLengthPrefixSize = 5;
                    const numBitsToShift = [0, 7, 14, 21, 28];
                    for (let offset = 0; offset < input.byteLength;) {
                        let numBytes = 0;
                        let size = 0;
                        let byteRead;
                        do {
                            byteRead = uint8Array[offset + numBytes];
                            size = size | ((byteRead & 0x7f) << (numBitsToShift[numBytes]));
                            numBytes++;
                        } while (numBytes < Math.min(maxLengthPrefixSize, input.byteLength - offset) && (byteRead & 0x80) != 0);
                        if ((byteRead & 0x80) !== 0 && numBytes < maxLengthPrefixSize) {
                            throw new Error("Cannot read message size.");
                        }
                        if (numBytes === maxLengthPrefixSize && byteRead > 7) {
                            throw new Error("Messages bigger than 2GB are not supported.");
                        }
                        if (uint8Array.byteLength >= (offset + numBytes + size)) {
                            // IE does not support .slice() so use subarray
                            result.push(uint8Array.slice
                                ? uint8Array.slice(offset + numBytes, offset + numBytes + size)
                                : uint8Array.subarray(offset + numBytes, offset + numBytes + size));
                        }
                        else {
                            throw new Error("Incomplete message.");
                        }
                        offset = offset + numBytes + size;
                    }
                    return result;
                }
                BinaryMessageFormat.parse = parse;
            })(BinaryMessageFormat = exports.BinaryMessageFormat || (exports.BinaryMessageFormat = {}));

        }, {}], 3: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            const HttpError_1 = require("./HttpError");
            class HttpClient {
                get(url, headers) {
                    return this.xhr("GET", url, headers);
                }
                options(url, headers) {
                    return this.xhr("OPTIONS", url, headers);
                }
                post(url, content, headers) {
                    return this.xhr("POST", url, headers, content);
                }
                xhr(method, url, headers, content) {
                    return new Promise((resolve, reject) => {
                        let xhr = new XMLHttpRequest();
                        xhr.open(method, url, true);
                        xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
                        if (headers) {
                            headers.forEach((value, header) => xhr.setRequestHeader(header, value));
                        }
                        xhr.send(content);
                        xhr.onload = () => {
                            if (xhr.status >= 200 && xhr.status < 300) {
                                resolve(xhr.response || xhr.responseText);
                            }
                            else {
                                reject(new HttpError_1.HttpError(xhr.statusText, xhr.status));
                            }
                        };
                        xhr.onerror = () => {
                            reject(new HttpError_1.HttpError(xhr.statusText, xhr.status));
                        };
                    });
                }
            }
            exports.HttpClient = HttpClient;

        }, { "./HttpError": 5 }], 4: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function (resolve, reject) {
                    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
                    step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
            };
            Object.defineProperty(exports, "__esModule", { value: true });
            const Transports_1 = require("./Transports");
            const HttpClient_1 = require("./HttpClient");
            const ILogger_1 = require("./ILogger");
            const Loggers_1 = require("./Loggers");
            class HttpConnection {
                constructor(url, options = {}) {
                    this.features = {};
                    this.logger = Loggers_1.LoggerFactory.createLogger(options.logging);
                    this.url = this.resolveUrl(url);
                    options = options || {};
                    this.httpClient = options.httpClient || new HttpClient_1.HttpClient();
                    this.connectionState = 0 /* Initial */;
                    this.options = options;
                }
                start() {
                    return __awaiter(this, void 0, void 0, function* () {
                        if (this.connectionState != 0 /* Initial */) {
                            return Promise.reject(new Error("Cannot start a connection that is not in the 'Initial' state."));
                        }
                        this.connectionState = 1 /* Connecting */;
                        this.startPromise = this.startInternal();
                        return this.startPromise;
                    });
                }
                startInternal() {
                    return __awaiter(this, void 0, void 0, function* () {
                        try {
                            let negotiatePayload = yield this.httpClient.options(this.url);
                            let negotiateResponse = JSON.parse(negotiatePayload);
                            this.connectionId = negotiateResponse.connectionId;
                            // the user tries to stop the the connection when it is being started
                            if (this.connectionState == 3 /* Disconnected */) {
                                return;
                            }
                            this.url += (this.url.indexOf("?") == -1 ? "?" : "&") + `id=${this.connectionId}`;
                            this.transport = this.createTransport(this.options.transport, negotiateResponse.availableTransports);
                            this.transport.onreceive = this.onreceive;
                            this.transport.onclose = e => this.stopConnection(true, e);
                            let requestedTransferMode = this.features.transferMode === 2 /* Binary */
                                ? 2 /* Binary */
                                : 1 /* Text */;
                            this.features.transferMode = yield this.transport.connect(this.url, requestedTransferMode);
                            // only change the state if we were connecting to not overwrite
                            // the state if the connection is already marked as Disconnected
                            this.changeState(1 /* Connecting */, 2 /* Connected */);
                        }
                        catch (e) {
                            this.logger.log(ILogger_1.LogLevel.Error, "Failed to start the connection. " + e);
                            this.connectionState = 3 /* Disconnected */;
                            this.transport = null;
                            throw e;
                        }
                        ;
                    });
                }
                createTransport(transport, availableTransports) {
                    if (!transport && availableTransports.length > 0) {
                        transport = Transports_1.TransportType[availableTransports[0]];
                    }
                    if (transport === Transports_1.TransportType.WebSockets && availableTransports.indexOf(Transports_1.TransportType[transport]) >= 0) {
                        return new Transports_1.WebSocketTransport(this.logger);
                    }
                    if (transport === Transports_1.TransportType.ServerSentEvents && availableTransports.indexOf(Transports_1.TransportType[transport]) >= 0) {
                        return new Transports_1.ServerSentEventsTransport(this.httpClient, this.logger);
                    }
                    if (transport === Transports_1.TransportType.LongPolling && availableTransports.indexOf(Transports_1.TransportType[transport]) >= 0) {
                        return new Transports_1.LongPollingTransport(this.httpClient, this.logger);
                    }
                    if (this.isITransport(transport)) {
                        return transport;
                    }
                    throw new Error("No available transports found.");
                }
                isITransport(transport) {
                    return typeof (transport) === "object" && "connect" in transport;
                }
                changeState(from, to) {
                    if (this.connectionState == from) {
                        this.connectionState = to;
                        return true;
                    }
                    return false;
                }
                send(data) {
                    if (this.connectionState != 2 /* Connected */) {
                        throw new Error("Cannot send data if the connection is not in the 'Connected' State");
                    }
                    return this.transport.send(data);
                }
                stop() {
                    return __awaiter(this, void 0, void 0, function* () {
                        let previousState = this.connectionState;
                        this.connectionState = 3 /* Disconnected */;
                        try {
                            yield this.startPromise;
                        }
                        catch (e) {
                            // this exception is returned to the user as a rejected Promise from the start method
                        }
                        this.stopConnection(/*raiseClosed*/ previousState == 2 /* Connected */);
                    });
                }
                stopConnection(raiseClosed, error) {
                    if (this.transport) {
                        this.transport.stop();
                        this.transport = null;
                    }
                    this.connectionState = 3 /* Disconnected */;
                    if (raiseClosed && this.onclose) {
                        this.onclose(error);
                    }
                }
                resolveUrl(url) {
                    // startsWith is not supported in IE
                    if (url.lastIndexOf("https://", 0) === 0 || url.lastIndexOf("http://", 0) === 0) {
                        return url;
                    }
                    if (typeof window === 'undefined' || !window || !window.document) {
                        throw new Error(`Cannot resolve '${url}'.`);
                    }
                    let parser = window.document.createElement("a");
                    parser.href = url;
                    let baseUrl = (!parser.protocol || parser.protocol === ":")
                        ? `${window.document.location.protocol}//${(parser.host || window.document.location.host)}`
                        : `${parser.protocol}//${parser.host}`;
                    if (!url || url[0] != '/') {
                        url = '/' + url;
                    }
                    let normalizedUrl = baseUrl + url;
                    this.logger.log(ILogger_1.LogLevel.Information, `Normalizing '${url}' to '${normalizedUrl}'`);
                    return normalizedUrl;
                }
            }
            exports.HttpConnection = HttpConnection;

        }, { "./HttpClient": 3, "./ILogger": 7, "./Loggers": 9, "./Transports": 11 }], 5: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            class HttpError extends Error {
                constructor(errorMessage, statusCode) {
                    super(errorMessage);
                    this.statusCode = statusCode;
                }
            }
            exports.HttpError = HttpError;

        }, {}], 6: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function (resolve, reject) {
                    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
                    step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
            };
            Object.defineProperty(exports, "__esModule", { value: true });
            const HttpConnection_1 = require("./HttpConnection");
            const Observable_1 = require("./Observable");
            const JsonHubProtocol_1 = require("./JsonHubProtocol");
            const Formatters_1 = require("./Formatters");
            const Base64EncodedHubProtocol_1 = require("./Base64EncodedHubProtocol");
            const ILogger_1 = require("./ILogger");
            const Loggers_1 = require("./Loggers");
            var Transports_1 = require("./Transports");
            exports.TransportType = Transports_1.TransportType;
            var HttpConnection_2 = require("./HttpConnection");
            exports.HttpConnection = HttpConnection_2.HttpConnection;
            var JsonHubProtocol_2 = require("./JsonHubProtocol");
            exports.JsonHubProtocol = JsonHubProtocol_2.JsonHubProtocol;
            var ILogger_2 = require("./ILogger");
            exports.LogLevel = ILogger_2.LogLevel;
            var Loggers_2 = require("./Loggers");
            exports.ConsoleLogger = Loggers_2.ConsoleLogger;
            exports.NullLogger = Loggers_2.NullLogger;
            class HubConnection {
                constructor(urlOrConnection, options = {}) {
                    options = options || {};
                    if (typeof urlOrConnection === "string") {
                        this.connection = new HttpConnection_1.HttpConnection(urlOrConnection, options);
                    }
                    else {
                        this.connection = urlOrConnection;
                    }
                    this.logger = Loggers_1.LoggerFactory.createLogger(options.logging);
                    this.protocol = options.protocol || new JsonHubProtocol_1.JsonHubProtocol();
                    this.connection.onreceive = (data) => this.processIncomingData(data);
                    this.connection.onclose = (error) => this.connectionClosed(error);
                    this.callbacks = new Map();
                    this.methods = new Map();
                    this.closedCallbacks = [];
                    this.id = 0;
                }
                processIncomingData(data) {
                    // Parse the messages
                    let messages = this.protocol.parseMessages(data);
                    for (var i = 0; i < messages.length; ++i) {
                        var message = messages[i];
                        switch (message.type) {
                            case 1 /* Invocation */:
                                this.invokeClientMethod(message);
                                break;
                            case 2 /* Result */:
                            case 3 /* Completion */:
                                let callback = this.callbacks.get(message.invocationId);
                                if (callback != null) {
                                    if (message.type == 3 /* Completion */) {
                                        this.callbacks.delete(message.invocationId);
                                    }
                                    callback(message);
                                }
                                break;
                            default:
                                this.logger.log(ILogger_1.LogLevel.Warning, "Invalid message type: " + data);
                                break;
                        }
                    }
                }
                invokeClientMethod(invocationMessage) {
                    let methods = this.methods.get(invocationMessage.target.toLowerCase());
                    if (methods) {
                        methods.forEach(m => m.apply(this, invocationMessage.arguments));
                        if (!invocationMessage.nonblocking) {
                            // TODO: send result back to the server?
                        }
                    }
                    else {
                        this.logger.log(ILogger_1.LogLevel.Warning, `No client method with the name '${invocationMessage.target}' found.`);
                    }
                }
                connectionClosed(error) {
                    let errorCompletionMessage = {
                        type: 3 /* Completion */,
                        invocationId: "-1",
                        error: error ? error.message : "Invocation cancelled due to connection being closed.",
                    };
                    this.callbacks.forEach(callback => {
                        callback(errorCompletionMessage);
                    });
                    this.callbacks.clear();
                    this.closedCallbacks.forEach(c => c.apply(this, [error]));
                }
                start() {
                    return __awaiter(this, void 0, void 0, function* () {
                        let requestedTransferMode = (this.protocol.type === 2 /* Binary */)
                            ? 2 /* Binary */
                            : 1 /* Text */;
                        this.connection.features.transferMode = requestedTransferMode;
                        yield this.connection.start();
                        var actualTransferMode = this.connection.features.transferMode;
                        yield this.connection.send(Formatters_1.TextMessageFormat.write(JSON.stringify({ protocol: this.protocol.name })));
                        this.logger.log(ILogger_1.LogLevel.Information, `Using HubProtocol '${this.protocol.name}'.`);
                        if (requestedTransferMode === 2 /* Binary */ && actualTransferMode === 1 /* Text */) {
                            this.protocol = new Base64EncodedHubProtocol_1.Base64EncodedHubProtocol(this.protocol);
                        }
                    });
                }
                stop() {
                    return this.connection.stop();
                }
                stream(methodName, ...args) {
                    let invocationDescriptor = this.createInvocation(methodName, args, false);
                    let subject = new Observable_1.Subject();
                    this.callbacks.set(invocationDescriptor.invocationId, (invocationEvent) => {
                        if (invocationEvent.type === 3 /* Completion */) {
                            let completionMessage = invocationEvent;
                            if (completionMessage.error) {
                                subject.error(new Error(completionMessage.error));
                            }
                            else if (completionMessage.result) {
                                subject.error(new Error("Server provided a result in a completion response to a streamed invocation."));
                            }
                            else {
                                // TODO: Log a warning if there's a payload?
                                subject.complete();
                            }
                        }
                        else {
                            subject.next(invocationEvent.item);
                        }
                    });
                    let message = this.protocol.writeMessage(invocationDescriptor);
                    this.connection.send(message)
                        .catch(e => {
                            subject.error(e);
                            this.callbacks.delete(invocationDescriptor.invocationId);
                        });
                    return subject;
                }
                send(methodName, ...args) {
                    let invocationDescriptor = this.createInvocation(methodName, args, true);
                    let message = this.protocol.writeMessage(invocationDescriptor);
                    return this.connection.send(message);
                }
                invoke(methodName, ...args) {
                    let invocationDescriptor = this.createInvocation(methodName, args, false);
                    let p = new Promise((resolve, reject) => {
                        this.callbacks.set(invocationDescriptor.invocationId, (invocationEvent) => {
                            if (invocationEvent.type === 3 /* Completion */) {
                                let completionMessage = invocationEvent;
                                if (completionMessage.error) {
                                    reject(new Error(completionMessage.error));
                                }
                                else {
                                    resolve(completionMessage.result);
                                }
                            }
                            else {
                                reject(new Error("Streaming methods must be invoked using HubConnection.stream"));
                            }
                        });
                        let message = this.protocol.writeMessage(invocationDescriptor);
                        this.connection.send(message)
                            .catch(e => {
                                reject(e);
                                this.callbacks.delete(invocationDescriptor.invocationId);
                            });
                    });
                    return p;
                }
                on(methodName, method) {
                    if (!methodName || !method) {
                        return;
                    }
                    methodName = methodName.toLowerCase();
                    if (!this.methods.has(methodName)) {
                        this.methods.set(methodName, []);
                    }
                    this.methods.get(methodName).push(method);
                }
                off(methodName, method) {
                    if (!methodName || !method) {
                        return;
                    }
                    methodName = methodName.toLowerCase();
                    let handlers = this.methods.get(methodName);
                    if (!handlers) {
                        return;
                    }
                    var removeIdx = handlers.indexOf(method);
                    if (removeIdx != -1) {
                        handlers.splice(removeIdx, 1);
                    }
                }
                onclose(callback) {
                    if (callback) {
                        this.closedCallbacks.push(callback);
                    }
                }
                createInvocation(methodName, args, nonblocking) {
                    let id = this.id;
                    this.id++;
                    return {
                        type: 1 /* Invocation */,
                        invocationId: id.toString(),
                        target: methodName,
                        arguments: args,
                        nonblocking: nonblocking
                    };
                }
            }
            exports.HubConnection = HubConnection;

        }, { "./Base64EncodedHubProtocol": 1, "./Formatters": 2, "./HttpConnection": 4, "./ILogger": 7, "./JsonHubProtocol": 8, "./Loggers": 9, "./Observable": 10, "./Transports": 11 }], 7: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            var LogLevel;
            (function (LogLevel) {
                LogLevel[LogLevel["Trace"] = 0] = "Trace";
                LogLevel[LogLevel["Information"] = 1] = "Information";
                LogLevel[LogLevel["Warning"] = 2] = "Warning";
                LogLevel[LogLevel["Error"] = 3] = "Error";
                LogLevel[LogLevel["None"] = 4] = "None";
            })(LogLevel = exports.LogLevel || (exports.LogLevel = {}));

        }, {}], 8: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            const Formatters_1 = require("./Formatters");
            class JsonHubProtocol {
                constructor() {
                    this.name = "json";
                    this.type = 1 /* Text */;
                }
                parseMessages(input) {
                    if (!input) {
                        return [];
                    }
                    // Parse the messages
                    let messages = Formatters_1.TextMessageFormat.parse(input);
                    let hubMessages = [];
                    for (var i = 0; i < messages.length; ++i) {
                        hubMessages.push(JSON.parse(messages[i]));
                    }
                    return hubMessages;
                }
                writeMessage(message) {
                    return Formatters_1.TextMessageFormat.write(JSON.stringify(message));
                }
            }
            exports.JsonHubProtocol = JsonHubProtocol;

        }, { "./Formatters": 2 }], 9: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            const ILogger_1 = require("./ILogger");
            class NullLogger {
                log(logLevel, message) {
                }
            }
            exports.NullLogger = NullLogger;
            class ConsoleLogger {
                constructor(minimumLogLevel) {
                    this.minimumLogLevel = minimumLogLevel;
                }
                log(logLevel, message) {
                    if (logLevel >= this.minimumLogLevel) {
                        console.log(`${ILogger_1.LogLevel[logLevel]}: ${message}`);
                    }
                }
            }
            exports.ConsoleLogger = ConsoleLogger;
            var LoggerFactory;
            (function (LoggerFactory) {
                function createLogger(logging) {
                    if (logging === undefined) {
                        return new ConsoleLogger(ILogger_1.LogLevel.Information);
                    }
                    if (logging === null) {
                        return new NullLogger();
                    }
                    if (logging.log) {
                        return logging;
                    }
                    return new ConsoleLogger(logging);
                }
                LoggerFactory.createLogger = createLogger;
            })(LoggerFactory = exports.LoggerFactory || (exports.LoggerFactory = {}));

        }, { "./ILogger": 7 }], 10: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            Object.defineProperty(exports, "__esModule", { value: true });
            class Subject {
                constructor() {
                    this.observers = [];
                }
                next(item) {
                    for (let observer of this.observers) {
                        observer.next(item);
                    }
                }
                error(err) {
                    for (let observer of this.observers) {
                        observer.error(err);
                    }
                }
                complete() {
                    for (let observer of this.observers) {
                        observer.complete();
                    }
                }
                subscribe(observer) {
                    this.observers.push(observer);
                }
            }
            exports.Subject = Subject;

        }, {}], 11: [function (require, module, exports) {
            "use strict";
            // Copyright (c) .NET Foundation. All rights reserved.
            // Licensed under the Apache License, Version 2.0. See License.txt in the project root for license information.
            var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
                return new (P || (P = Promise))(function (resolve, reject) {
                    function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
                    function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
                    function step(result) { result.done ? resolve(result.value) : new P(function (resolve) { resolve(result.value); }).then(fulfilled, rejected); }
                    step((generator = generator.apply(thisArg, _arguments || [])).next());
                });
            };
            Object.defineProperty(exports, "__esModule", { value: true });
            const HttpError_1 = require("./HttpError");
            const ILogger_1 = require("./ILogger");
            var TransportType;
            (function (TransportType) {
                TransportType[TransportType["WebSockets"] = 0] = "WebSockets";
                TransportType[TransportType["ServerSentEvents"] = 1] = "ServerSentEvents";
                TransportType[TransportType["LongPolling"] = 2] = "LongPolling";
            })(TransportType = exports.TransportType || (exports.TransportType = {}));
            class WebSocketTransport {
                constructor(logger) {
                    this.logger = logger;
                }
                connect(url, requestedTransferMode) {
                    return new Promise((resolve, reject) => {
                        url = url.replace(/^http/, "ws");
                        let webSocket = new WebSocket(url);
                        if (requestedTransferMode == 2 /* Binary */) {
                            webSocket.binaryType = "arraybuffer";
                        }
                        webSocket.onopen = (event) => {
                            this.logger.log(ILogger_1.LogLevel.Information, `WebSocket connected to ${url}`);
                            this.webSocket = webSocket;
                            resolve(requestedTransferMode);
                        };
                        webSocket.onerror = (event) => {
                            reject();
                        };
                        webSocket.onmessage = (message) => {
                            this.logger.log(ILogger_1.LogLevel.Trace, `(WebSockets transport) data received: ${message.data}`);
                            if (this.onreceive) {
                                this.onreceive(message.data);
                            }
                        };
                        webSocket.onclose = (event) => {
                            // webSocket will be null if the transport did not start successfully
                            if (this.onclose && this.webSocket) {
                                if (event.wasClean === false || event.code !== 1000) {
                                    this.onclose(new Error(`Websocket closed with status code: ${event.code} (${event.reason})`));
                                }
                                else {
                                    this.onclose();
                                }
                            }
                        };
                    });
                }
                send(data) {
                    if (this.webSocket && this.webSocket.readyState === WebSocket.OPEN) {
                        this.webSocket.send(data);
                        return Promise.resolve();
                    }
                    return Promise.reject("WebSocket is not in the OPEN state");
                }
                stop() {
                    if (this.webSocket) {
                        this.webSocket.close();
                        this.webSocket = null;
                    }
                }
            }
            exports.WebSocketTransport = WebSocketTransport;
            class ServerSentEventsTransport {
                constructor(httpClient, logger) {
                    this.httpClient = httpClient;
                    this.logger = logger;
                }
                connect(url, requestedTransferMode) {
                    if (typeof (EventSource) === "undefined") {
                        Promise.reject("EventSource not supported by the browser.");
                    }
                    this.url = url;
                    return new Promise((resolve, reject) => {
                        let eventSource = new EventSource(this.url);
                        try {
                            eventSource.onmessage = (e) => {
                                if (this.onreceive) {
                                    try {
                                        this.logger.log(ILogger_1.LogLevel.Trace, `(SSE transport) data received: ${e.data}`);
                                        this.onreceive(e.data);
                                    }
                                    catch (error) {
                                        if (this.onclose) {
                                            this.onclose(error);
                                        }
                                        return;
                                    }
                                }
                            };
                            eventSource.onerror = (e) => {
                                reject();
                                // don't report an error if the transport did not start successfully
                                if (this.eventSource && this.onclose) {
                                    this.onclose(new Error(e.message || "Error occurred"));
                                }
                            };
                            eventSource.onopen = () => {
                                this.logger.log(ILogger_1.LogLevel.Information, `SSE connected to ${this.url}`);
                                this.eventSource = eventSource;
                                // SSE is a text protocol
                                resolve(1 /* Text */);
                            };
                        }
                        catch (e) {
                            return Promise.reject(e);
                        }
                    });
                }
                send(data) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return send(this.httpClient, this.url, data);
                    });
                }
                stop() {
                    if (this.eventSource) {
                        this.eventSource.close();
                        this.eventSource = null;
                    }
                }
            }
            exports.ServerSentEventsTransport = ServerSentEventsTransport;
            class LongPollingTransport {
                constructor(httpClient, logger) {
                    this.httpClient = httpClient;
                    this.logger = logger;
                }
                connect(url, requestedTransferMode) {
                    this.url = url;
                    this.shouldPoll = true;
                    if (requestedTransferMode === 2 /* Binary */ && (typeof new XMLHttpRequest().responseType !== "string")) {
                        // This will work if we fix: https://github.com/aspnet/SignalR/issues/742
                        throw new Error("Binary protocols over XmlHttpRequest not implementing advanced features are not supported.");
                    }
                    this.poll(this.url, requestedTransferMode);
                    return Promise.resolve(requestedTransferMode);
                }
                poll(url, transferMode) {
                    if (!this.shouldPoll) {
                        return;
                    }
                    let pollXhr = new XMLHttpRequest();
                    pollXhr.onload = () => {
                        if (pollXhr.status == 200) {
                            if (this.onreceive) {
                                try {
                                    let response = transferMode === 1 /* Text */
                                        ? pollXhr.responseText
                                        : pollXhr.response;
                                    if (response) {
                                        this.logger.log(ILogger_1.LogLevel.Trace, `(LongPolling transport) data received: ${response}`);
                                        this.onreceive(response);
                                    }
                                    else {
                                        this.logger.log(ILogger_1.LogLevel.Information, "(LongPolling transport) timed out");
                                    }
                                }
                                catch (error) {
                                    if (this.onclose) {
                                        this.onclose(error);
                                    }
                                    return;
                                }
                            }
                            this.poll(url, transferMode);
                        }
                        else if (this.pollXhr.status == 204) {
                            if (this.onclose) {
                                this.onclose();
                            }
                        }
                        else {
                            if (this.onclose) {
                                this.onclose(new HttpError_1.HttpError(pollXhr.statusText, pollXhr.status));
                            }
                        }
                    };
                    pollXhr.onerror = () => {
                        if (this.onclose) {
                            // network related error or denied cross domain request
                            this.onclose(new Error("Sending HTTP request failed."));
                        }
                    };
                    pollXhr.ontimeout = () => {
                        this.poll(url, transferMode);
                    };
                    this.pollXhr = pollXhr;
                    this.pollXhr.open("GET", `${url}&_=${Date.now()}`, true);
                    if (transferMode === 2 /* Binary */) {
                        this.pollXhr.responseType = "arraybuffer";
                    }
                    // TODO: consider making timeout configurable
                    this.pollXhr.timeout = 120000;
                    this.pollXhr.send();
                }
                send(data) {
                    return __awaiter(this, void 0, void 0, function* () {
                        return send(this.httpClient, this.url, data);
                    });
                }
                stop() {
                    this.shouldPoll = false;
                    if (this.pollXhr) {
                        this.pollXhr.abort();
                        this.pollXhr = null;
                    }
                }
            }
            exports.LongPollingTransport = LongPollingTransport;
            const headers = new Map();
            function send(httpClient, url, data) {
                return __awaiter(this, void 0, void 0, function* () {
                    yield httpClient.post(url, data, headers);
                });
            }

        }, { "./HttpError": 5, "./ILogger": 7 }]
    }, {}, [6])(6)
});