import { BinaryWriter } from '../shared/binaryWriter.js';
import * as enums from '../shared/wsEnums.js';
import type { ExtWebSocket, Message } from "./interfaces.js";
import type { User } from './user.js';

const DEFAULT_TTL = 86400000; // 24 hours

export class Channel {
    readonly clients: ExtWebSocket[] = [];
    readonly users: User[] = [];
    readonly messages: Message[] = [];
    constructor(public readonly id: string) { }
    removeOldMessages() {
        const time = Date.now();

        while (this.messages.length > 200) {
            const removed = this.messages.shift();
            if (removed) {
                const writer = new BinaryWriter();
                writer
                    .uint8(enums.SERVER_DELETE_MESSAGE)
                    .uint8(removed.type)
                    .uint32(removed.user.id)
                    .float64(removed.time);
                this.broadcast(writer.getBuffer());
            }
        }

        for (let index = this.messages.length - 1; index >= 0; index--) {
            const message = this.messages[index];
            if (message.time + message.ttl < time) {
                this.messages.splice(index, 1);
                const writer = new BinaryWriter();
                writer
                    .uint8(enums.SERVER_DELETE_MESSAGE)
                    .uint8(message.type)
                    .uint32(message.user.id)
                    .float64(message.time);
                this.broadcast(writer.getBuffer());
            }
        }
    }
    private broadcast(data: Uint8Array) {
        for (const client of this.clients) {
            client.send(data);
        }
    }
    writeChannel(writer: BinaryWriter) {
        writer.array(this.users, user => {
            writer
                .uint32(user.id)
                .string(user.name)
                .string(user.address);
        });

        writer.array(this.messages, message => {
            writer
                .uint8(message.type)
                .uint32(message.user.id)
                .float64(message.time);
            switch (message.type) {
                case enums.MESSAGE_SYSTEM:
                    writer
                        .uint8(message.event)
                        .string(message.user.name);
                    break;
                case enums.MESSAGE_SYSTEM_NAME_CHANGE:
                    writer
                        .string(message.oldName)
                        .string(message.newName);
                    break;
                case enums.MESSAGE_TEXT:
                    writer
                        .string(message.user.name)
                        .string(message.address)
                        .string(message.text);
                    break;
                case enums.MESSAGE_IMAGE:
                    writer
                        .string(message.user.name)
                        .string(message.address)
                        .string((message as any).url);
                    break;
                case enums.MESSAGE_FILE:
                    writer
                        .string(message.user.name)
                        .string(message.address)
                        .string((message as any).filename)
                        .string((message as any).mime)
                        .string((message as any).url);
                    break;
                case enums.MESSAGE_VIDEO:
                    writer
                        .string(message.user.name)
                        .string(message.address)
                        .string((message as any).filename)
                        .string((message as any).mime)
                        .string((message as any).url);
                    break;
                case enums.MESSAGE_AUDIO:
                    writer
                        .string(message.user.name)
                        .string(message.address)
                        .string((message as any).filename)
                        .string((message as any).mime)
                        .string((message as any).url);
                    break;
            }
        });
    }
    clientJoin(client: ExtWebSocket) {
        if (this.clients.includes(client)) {
            return;
        }

        const user = client.user;
        const time = Date.now();
        this.clients.push(client);

        if (this.users.includes(user)) {
            return;
        }

        this.users.push(user);
        this.messages.push({
            type: enums.MESSAGE_SYSTEM,
            event: enums.SERVER_USER_JOIN,
            user,
            time,
            ttl: 10000,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_JOIN)
            .uint32(user.id)
            .float64(time)
            .string(user.name)
            .string(user.address);
        this.broadcast(writer.getBuffer());
    }
    clientLeft(client: ExtWebSocket) {
        const clientIndex = this.clients.indexOf(client);
        if (clientIndex === -1) {
            return;
        }

        this.clients.splice(clientIndex, 1);

        const user = client.user;
        const time = Date.now();
        if (this.clients.some(c => c.user === user)) {
            return;
        }

        const userIndex = this.users.indexOf(user);
        if (userIndex === -1) {
            return;
        }

        this.users.splice(userIndex, 1);
        this.messages.push({
            type: enums.MESSAGE_SYSTEM,
            event: enums.SERVER_USER_LEFT,
            user,
            time,
            ttl: 10000,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_LEFT)
            .uint32(user.id)
            .float64(time);
        this.broadcast(writer.getBuffer());
    }
    clientNameChange(client: ExtWebSocket, oldName: string, newName: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_SYSTEM_NAME_CHANGE,
            user,
            oldName,
            newName,
            time,
            ttl: DEFAULT_TTL,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_NAME)
            .uint32(user.id)
            .float64(time)
            .string(oldName)
            .string(newName);
        this.broadcast(writer.getBuffer());
    }
    clientMessageText(client: ExtWebSocket, text: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_TEXT,
            user,
            address: user.address,
            text,
            time,
            ttl: DEFAULT_TTL,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_TEXT)
            .uint32(user.id)
            .string(user.address)
            .float64(time)
            .string(text);
        this.broadcast(writer.getBuffer());
    }
    clientMessageImage(client: ExtWebSocket, url: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_IMAGE,
            user,
            address: user.address,
            url,
            time,
            ttl: DEFAULT_TTL,
        } as any);
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_IMAGE)
            .uint32(user.id)
            .string(user.address)
            .float64(time)
            .string(url);
        this.broadcast(writer.getBuffer());
    }

    clientMessageFile(client: ExtWebSocket, filename: string, mime: string, url: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_FILE,
            user,
            address: user.address,
            filename,
            mime,
            url,
            time,
            ttl: DEFAULT_TTL,
        } as any);
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_FILE)
            .uint32(user.id)
            .string(user.address)
            .float64(time)
            .string(filename)
            .string(mime)
            .string(url);
        this.broadcast(writer.getBuffer());
    }

    clientMessageVideo(client: ExtWebSocket, filename: string, mime: string, url: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_VIDEO,
            user,
            address: user.address,
            filename,
            mime,
            url,
            time,
            ttl: DEFAULT_TTL,
        } as any);
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_VIDEO)
            .uint32(user.id)
            .string(user.address)
            .float64(time)
            .string(filename)
            .string(mime)
            .string(url);
        this.broadcast(writer.getBuffer());
    }

    clientMessageAudio(client: ExtWebSocket, filename: string, mime: string, url: string) {
        const user = client.user;
        const time = Date.now();

        this.messages.push({
            type: enums.MESSAGE_AUDIO,
            user,
            address: user.address,
            filename,
            mime,
            url,
            time,
            ttl: DEFAULT_TTL,
        } as any);
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_AUDIO)
            .uint32(user.id)
            .string(user.address)
            .float64(time)
            .string(filename)
            .string(mime)
            .string(url);
        this.broadcast(writer.getBuffer());
    }
}

const channels = new Map<string, Channel>();

export function findOrCreateChannel(id: string) {
    let channel = channels.get(id);
    if (!channel) {
        channel = new Channel(id);
        channels.set(id, channel);
    }
    return channel;
}

setInterval(() => {
    for (const channel of channels.values()) {
        channel.removeOldMessages();
    }
}, 1000);
