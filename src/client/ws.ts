import { BinaryWriter } from "../shared/binaryWriter.js";
import * as enums from '../shared/wsEnums.js';

let ws: WebSocket | null = null;

export function isWsCreated() {
    return !!ws;
}

export function isWsOpen() {
    return ws?.readyState === WebSocket.OPEN;
}

export function createWs(token: string, name?: string) {
    if (ws) {
        return ws;
    }

    const params = new URLSearchParams();
    params.set('t', token);
    if (name) {
        params.set('name', name);
    }

    const url = `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/ws?${params.toString()}`;
    ws = new WebSocket(url);
    ws.binaryType = 'arraybuffer';
    return ws;
}

export function closeWs() {
    if (ws) {
        ws.onopen = null;
        ws.onclose = null;
        ws.onerror = null;
        ws.onmessage = null;
        ws.close();
        ws = null;
    }
}

export function wsMessageText(text: string) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_TEXT)
        .string(text);
    ws!.send(writer.getBuffer());
}

export function wsMessageImage(image: Uint8Array) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_IMAGE)
        .u8array(image);
    ws!.send(writer.getBuffer());
}

export function wsMessageImageUrl(url: string) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_IMAGE_URL)
        .string(url);
    ws!.send(writer.getBuffer());
}

export function wsMessageFile(filename: string, mime: string, data: Uint8Array) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_FILE)
        .string(filename)
        .string(mime)
        .u8array(data);
    ws!.send(writer.getBuffer());
}

export function wsMessageVideo(filename: string, mime: string, data: Uint8Array) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_VIDEO)
        .string(filename)
        .string(mime)
        .u8array(data);
    ws!.send(writer.getBuffer());
}

export function wsMessageAudio(filename: string, mime: string, data: Uint8Array) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_MESSAGE)
        .uint8(enums.MESSAGE_AUDIO)
        .string(filename)
        .string(mime)
        .u8array(data);
    ws!.send(writer.getBuffer());
}

export function wsSetName(name: string) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_SET_NAME)
        .string(name);
    ws!.send(writer.getBuffer());
}

export function wsSetChannel(id: string) {
    if (!isWsOpen()) {
        return;
    }
    const writer = new BinaryWriter();
    writer
        .uint8(enums.CLIENT_SET_CHANNEL)
        .string(id);
    ws!.send(writer.getBuffer());
}
