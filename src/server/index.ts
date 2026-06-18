import { createServer, IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import proxy from 'express-http-proxy';
import { WebSocketServer } from 'ws';
import { BinaryReader } from '../shared/binaryReader.js';
import { BinaryWriter } from '../shared/binaryWriter.js';
import * as enums from '../shared/wsEnums.js';
import config from '../../config.json' with { type: 'json' };
import type { ExtWebSocket } from './interfaces.js';
import { findOrCreateUser } from './user.js';
import { findOrCreateChannel } from './channel.js';

const port = config.port;
const production = process.env.NODE_ENV === 'production';

const app = express();

// Serve stickers folder and provide a JSON index (mounted before proxy/dev server)
const stickersDir = path.join(process.cwd(), 'stickers');
app.use('/stickers', express.static(stickersDir));

app.get('/stickers.json', async (_req, res) => {
    try {
        const packs: Array<{ name: string; files: string[] }> = [];
        if (!fs.existsSync(stickersDir)) {
            return res.json(packs);
        }
        const entries = await fs.promises.readdir(stickersDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) continue;
            const packName = entry.name;
            const packPath = path.join(stickersDir, packName);
            const files = await fs.promises.readdir(packPath);
            const images = files.filter(f => /\.(gif|png|webp|jpg|jpeg)$/i.test(f)).map(f => `/stickers/${encodeURIComponent(packName)}/${encodeURIComponent(f)}`);
            if (images.length) {
                packs.push({ name: packName, files: images });
            }
        }
        res.json(packs);
    } catch (e) {
        console.error('Failed to read stickers', e);
        res.status(500).json({ error: 'failed' });
    }
});
const server = createServer(app);
const wss = new WebSocketServer<typeof ExtWebSocket>({ noServer: true });

const pingInterval = setInterval(() => {
    for (const ws of wss.clients) {
        if (!ws.isAlive) {
            ws.terminate();
            return;
        }
        ws.isAlive = false;
        ws.ping();
    }
}, 30000);

function getAddress(req: IncomingMessage) {
    return (req.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() || req.socket.remoteAddress || '';
}

function handleChatMessage(client: ExtWebSocket, reader: BinaryReader) {
    const user = client.user;
    const type = reader.uint8();
    switch (type) {
        case enums.MESSAGE_TEXT: {
            const message = reader.string();
            if (!message.trim()) {
                break;
            }
            user.channel.clientMessageText(client, message);
            break;
        }
        case enums.MESSAGE_IMAGE: {
            const image = reader.u8array();
            user.channel.clientMessageImage(client, image);
            break;
        }
        case enums.MESSAGE_FILE: {
            const filename = reader.string();
            const mime = reader.string();
            const data = reader.u8array();
            const maxBytes = 512 * 1024 * 1024; // 512MB
            if (data.length > maxBytes) {
                console.warn(`Rejected file from user ${user.id}: ${filename} (${data.length} bytes) exceeds limit`);
                break;
            }
            user.channel.clientMessageFile(client, filename, mime, data);
            break;
        }
        case enums.MESSAGE_VIDEO: {
            const filename = reader.string();
            const mime = reader.string();
            const data = reader.u8array();
            const maxBytes = 512 * 1024 * 1024; // 512MB
            if (data.length > maxBytes) {
                console.warn(`Rejected video from user ${user.id}: ${filename} (${data.length} bytes) exceeds limit`);
                break;
            }
            user.channel.clientMessageVideo(client, filename, mime, data);
            break;
        }
        default:
            throw new Error(`Unknown message type ${type}`);
    }
}

function handleClientMessage(client: ExtWebSocket, reader: BinaryReader) {
    const user = client.user;
    const type = reader.uint8();
    switch (type) {
        case enums.CLIENT_MESSAGE: {
            handleChatMessage(client, reader);
            break;
        }
        case enums.CLIENT_SET_NAME: {
            const oldName = user.name;
            const newName = reader.string();
            if (oldName !== newName) {
                user.name = newName;
                user.channel.clientNameChange(client, oldName, newName);
            }
            break;
        }
        case enums.CLIENT_SET_CHANNEL: {
            const id = reader.string();
            const newChannel = findOrCreateChannel(id);
            user.channel.clientLeft(client);
            user.channel = newChannel;
            newChannel.clientJoin(client);
            const writer = new BinaryWriter();
            writer.uint8(enums.SERVER_CHANNEL);
            newChannel.writeChannel(writer);
            client.send(writer.getBuffer());
            break;
        }
        default:
            throw new Error(`Unknown action ${type}`);
    }
}

wss.on('connection', ws => {
    ws.isAlive = true;
    ws.on('error', console.error);
    ws.on('pong', () => ws.isAlive = true);
    ws.on('message', (data: ArrayBuffer) => {
        try {
            if (data instanceof ArrayBuffer) {
                const reader = new BinaryReader(new Uint8Array(data));
                handleClientMessage(ws, reader);
            }
        } catch (e) {
            console.error(e);
        }
    });
    ws.on('close', () => {
        ws.user.channel.clientLeft(ws);
    });

    const user = ws.user;
    const channel = user.channel;
    const writer = new BinaryWriter();
    writer
        .uint8(enums.SERVER_JOINED)
        .uint32(user.id)
        .string(user.token)
        .string(user.name)
        .string(user.address)
        .string(channel.id);
    channel.clientJoin(ws);
    channel.writeChannel(writer);
    ws.send(writer.getBuffer());
});

wss.on('close', () => {
    clearInterval(pingInterval);
});

server.on('upgrade', (req, socket, head) => {
    try {
        socket.on('error', console.error);
        if (!req.url) {
            socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
            socket.destroy();
            return;
        }
        const url = new URL(req.url, 'ws://localhost/');
        if (url.pathname !== '/ws') {
            socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
            socket.destroy();
            return;
        }
        const token = url.searchParams.get('t') ?? '';
        const name = url.searchParams.get('name');
        const user = findOrCreateUser(token);
        user.address = getAddress(req);
        if (name) {
            user.name = name;
        }
        wss.handleUpgrade(req, socket, head, ws => {
            ws.binaryType = 'arraybuffer';
            ws.user = user;
            wss.emit('connection', ws, req);
        });
    } catch (e) {
        console.error(e);
        socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
        socket.destroy();
    }
});

if (production) {
    app.use(express.static('dist/client'));
    app.use((_req, res, _next) => res.sendStatus(404));
} else {
    app.use(proxy(`http://localhost:${port + 1}`));
}

server.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}/`);
});
