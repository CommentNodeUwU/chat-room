import { createServer, IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import proxy from 'express-http-proxy';
import { WebSocketServer } from 'ws';
import { BinaryReader } from '../shared/binaryReader.js';
import { BinaryWriter } from '../shared/binaryWriter.js';
import * as enums from '../shared/wsEnums.js';
import config from '../../config.json' with { type: 'json' };
import type { ExtWebSocket } from './interfaces.js';
import { findOrCreateUser, saveUserMetadata } from './user.js';
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

const uploadRoot = path.join('/tmp', 'chat-room');
const uploadsDir = path.join(uploadRoot, 'uploads');
await fs.promises.mkdir(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

app.post('/upload', async (req, res) => {
    const filenameHeader = req.headers['x-upload-filename'];
    const mimeHeader = req.headers['x-upload-mime'];
    const filename = typeof filenameHeader === 'string' ? decodeURIComponent(filenameHeader) : 'upload';
    const mime = typeof mimeHeader === 'string' ? mimeHeader : 'application/octet-stream';
    const maxBytes = config.maxFileBytes;
    const tempPath = path.join(uploadsDir, `${crypto.randomBytes(16).toString('hex')}.tmp`);
    const hash = crypto.createHash('sha256');
    let size = 0;

    const sizeTransform = new Transform({
        transform(chunk, _encoding, callback) {
            size += chunk.length;
            if (size > maxBytes) {
                callback(new Error('FILE_TOO_LARGE'));
                return;
            }
            hash.update(chunk);
            callback(null, chunk);
        }
    });

    try {
        await pipeline(req, sizeTransform, fs.createWriteStream(tempPath, { flags: 'wx' }));
    } catch (error: any) {
        await fs.promises.unlink(tempPath).catch(() => undefined);
        if (error?.message === 'FILE_TOO_LARGE') {
            return res.status(413).json({ error: 'file too large' });
        }
        console.error('Upload failed', error);
        return res.status(500).json({ error: 'upload failed' });
    }

    const fileHash = hash.digest('hex');
    const ext = path.extname(sanitizeFilename(filename)) || extensionFromMime(mime || '');
    const storedFilename = `${fileHash}${ext}`;
    const storedPath = path.join(uploadsDir, storedFilename);

    try {
        await fs.promises.access(storedPath);
        await fs.promises.unlink(tempPath).catch(() => undefined);
    } catch {
        await fs.promises.rename(tempPath, storedPath);
    }

    uploadHashes.set(fileHash, storedFilename);
    res.json({ url: `/uploads/${encodeURIComponent(storedFilename)}` });
});

const uploadHashes = new Map<string, string>();
for (const entry of await fs.promises.readdir(uploadsDir)) {
    const match = entry.match(/^([0-9a-f]{64})(\..+)?$/);
    if (match) {
        uploadHashes.set(match[1], entry);
    }
}

function sanitizeFilename(filename: string) {
    return path.basename(filename || 'upload').replace(/[^a-zA-Z0-9._-]/g, '_');
}

function extensionFromMime(mime: string) {
    const normalized = (mime || '').toLowerCase();
    if (normalized === 'image/jpeg') return '.jpg';
    if (normalized === 'image/png') return '.png';
    if (normalized === 'image/gif') return '.gif';
    if (normalized === 'image/webp') return '.webp';
    if (normalized === 'video/mp4') return '.mp4';
    if (normalized === 'video/webm') return '.webm';
    if (normalized === 'video/ogg') return '.ogv';
    return '';
}

type SavedUpload = { url: string; filePath: string; fileHash: string };

async function saveUpload(filename: string, data: Uint8Array, mime?: string): Promise<SavedUpload> {
    const hash = crypto.createHash('sha256').update(data).digest('hex');
    const existingFilename = uploadHashes.get(hash);
    if (existingFilename) {
        const existingPath = path.join(uploadsDir, existingFilename);
        try {
            await fs.promises.access(existingPath);
            return { url: `/uploads/${encodeURIComponent(existingFilename)}`, filePath: existingPath, fileHash: hash };
        } catch {
            // Fall through and recreate if the file was removed accidentally.
        }
    }

    const sanitized = sanitizeFilename(filename);
    const ext = path.extname(sanitized) || extensionFromMime(mime || '');
    const storedFilename = `${hash}${ext}`;
    const filePath = path.join(uploadsDir, storedFilename);
    await fs.promises.writeFile(filePath, data);
    uploadHashes.set(hash, storedFilename);
    return { url: `/uploads/${encodeURIComponent(storedFilename)}`, filePath, fileHash: hash };
}

function getUploadMetadataFromUrl(url: string) {
    try {
        const parsed = new URL(url, 'http://localhost');
        if (parsed.pathname.startsWith('/uploads/')) {
            const filename = decodeURIComponent(path.basename(parsed.pathname));
            const filePath = path.join(uploadsDir, filename);
            const fileHash = path.parse(filename).name;
            return { filePath, fileHash };
        }
    } catch {
        // ignore bad URLs
    }
    return { filePath: undefined, fileHash: undefined };
}

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

async function handleChatMessage(client: ExtWebSocket, reader: BinaryReader) {
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
            const upload = await saveUpload(`${Date.now()}.png`, image, 'image/png');
            user.channel.clientMessageImage(client, upload.url, upload.filePath, upload.fileHash);
            break;
        }
        case enums.MESSAGE_IMAGE_URL: {
            const url = reader.string();
            const { filePath, fileHash } = getUploadMetadataFromUrl(url);
            user.channel.clientMessageImage(client, url, filePath, fileHash);
            break;
        }
        case enums.MESSAGE_FILE_URL: {
            const filename = reader.string();
            const mime = reader.string();
            const url = reader.string();
            const { filePath, fileHash } = getUploadMetadataFromUrl(url);
            user.channel.clientMessageFile(client, filename, mime, url, filePath, fileHash);
            break;
        }
        case enums.MESSAGE_FILE: {
            const filename = reader.string();
            const mime = reader.string();
            const data = reader.u8array();
            if (data.length > config.maxFileBytes) {
                console.warn(`Rejected file from user ${user.id}: ${filename} (${data.length} bytes) exceeds limit`);
                break;
            }
            const upload = await saveUpload(filename, data, mime);
            user.channel.clientMessageFile(client, filename, mime, upload.url, upload.filePath, upload.fileHash);
            break;
        }
        case enums.MESSAGE_VIDEO_URL: {
            const filename = reader.string();
            const mime = reader.string();
            const url = reader.string();
            const { filePath, fileHash } = getUploadMetadataFromUrl(url);
            user.channel.clientMessageVideo(client, filename, mime, url, filePath, fileHash);
            break;
        }
        case enums.MESSAGE_VIDEO: {
            const filename = reader.string();
            const mime = reader.string();
            const data = reader.u8array();
            if (data.length > config.maxFileBytes) {
                console.warn(`Rejected video from user ${user.id}: ${filename} (${data.length} bytes) exceeds limit`);
                break;
            }
            const upload = await saveUpload(filename, data, mime);
            user.channel.clientMessageVideo(client, filename, mime, upload.url, upload.filePath, upload.fileHash);
            break;
        }
        case enums.MESSAGE_AUDIO_URL: {
            const filename = reader.string();
            const mime = reader.string();
            const url = reader.string();
            const { filePath, fileHash } = getUploadMetadataFromUrl(url);
            user.channel.clientMessageAudio(client, filename, mime, url, filePath, fileHash);
            break;
        }
        case enums.MESSAGE_AUDIO: {
            const filename = reader.string();
            const mime = reader.string();
            const data = reader.u8array();
            if (data.length > config.maxFileBytes) {
                console.warn(`Rejected audio from user ${user.id}: ${filename} (${data.length} bytes) exceeds limit`);
                break;
            }
            const upload = await saveUpload(filename, data, mime);
            user.channel.clientMessageAudio(client, filename, mime, upload.url, upload.filePath, upload.fileHash);
            break;
        }
        default:
            throw new Error(`Unknown message type ${type}`);
    }
}

async function handleClientMessage(client: ExtWebSocket, reader: BinaryReader) {
    const user = client.user;
    const type = reader.uint8();
    switch (type) {
        case enums.CLIENT_MESSAGE: {
            await handleChatMessage(client, reader);
            break;
        }
        case enums.CLIENT_SET_NAME: {
            const oldName = user.name;
            const newName = reader.string();
            if (oldName !== newName) {
                user.name = newName;
                user.channel.clientNameChange(client, oldName, newName);
                saveUserMetadata(user).catch(console.error);
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
    ws.on('message', async (data: ArrayBuffer) => {
        try {
            if (data instanceof ArrayBuffer) {
                const reader = new BinaryReader(new Uint8Array(data));
                await handleClientMessage(ws, reader);
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
            saveUserMetadata(user).catch(console.error);
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
