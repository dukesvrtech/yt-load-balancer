const express = require('express');
const morgan = require("morgan");
const {createProxyMiddleware} = require('http-proxy-middleware');
const HashRing = require('hashring');
const ring = new HashRing([]);
const fs = require('fs/promises');
const backend = process.env.BACKEND || 'stage';

const mreSessionIdHeaderKey = 'x-ms-mixed-reality-extension-sessionid';
const router = req => {
    const sessionId = req.headers[mreSessionIdHeaderKey];
    if (sessionId) {
        console.log("Found session id", sessionId);
        const backend = ring.get(sessionId);
        console.log("Returning backend", backend, "for", sessionId);
        return `${req.secure ? 'wss:' : 'ws:'}${backend}`;
    } else {
        const backend = ring.get(req.url);
        return `${req.protocol}:${backend}`;
    }
}

const wsProxy = createProxyMiddleware({
    ws: true,
    changeOrigin: true,
    router,
});

const setupConsistentHash = async () => {
    try {
        const path = `./backends-${backend}.json`;
        console.log("Loading backends configuration", path)
        const raw = (await fs.readFile(path))?.toString();
        if (raw) {
            console.log("Configuring backends", raw);
            const data = JSON.parse(raw);
            for (const backend of data?.backends) {
                ring.add(backend);
            }
            const server = app.listen(PORT, HOST, async () => {
                console.log(`Starting Proxy at ${HOST}:${PORT}`);
            });

            server.on('upgrade', wsProxy.upgrade);
        }
    } catch (err) {
        throw err;
    }
}
// Create Express Server
const app = express();

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "";

// consistent hashing
// Logging
app.use(morgan('dev'));

// Proxy endpoints
app.use('', wsProxy);

setupConsistentHash();
