import { BinaryWriter } from '../shared/binaryWriter.js';
import * as enums from '../shared/wsEnums.js';
import type { ExtWebSocket, Message } from "./interfaces.js";
import type { User } from './user.js';

export class Channel {
    readonly clients: ExtWebSocket[] = [];
    readonly users: User[] = [];
    readonly messages: Message[] = [];
    constructor(public readonly id: string) { }
    private removeOldMessages() {
        while (this.messages.length > 200) {
            this.messages.shift();
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
                .uint32(message.user.id);
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
                        .date(message.date)
                        .string(message.user.name)
                        .string(message.address)
                        .string(message.text);
                    break;
                case enums.MESSAGE_IMAGE:
                    writer
                        .date(message.date)
                        .string(message.user.name)
                        .string(message.address)
                        .u8array(message.image);
                    break;
            }
        });
    }
    clientJoin(client: ExtWebSocket) {
        if (this.clients.includes(client)) {
            return;
        }

        const user = client.user;
        this.clients.push(client);

        if (this.users.includes(user)) {
            return;
        }

        this.users.push(user);
        this.messages.push({
            type: enums.MESSAGE_SYSTEM,
            event: enums.SERVER_USER_JOIN,
            user,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_JOIN)
            .uint32(user.id)
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
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_LEFT)
            .uint32(user.id);
        this.broadcast(writer.getBuffer());
    }
    clientNameChange(client: ExtWebSocket, oldName: string, newName: string) {
        const user = client.user;

        this.messages.push({
            type: enums.MESSAGE_SYSTEM_NAME_CHANGE,
            user,
            oldName,
            newName,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_NAME)
            .uint32(user.id)
            .string(oldName)
            .string(newName);
        this.broadcast(writer.getBuffer());
    }
    clientMessageText(client: ExtWebSocket, text: string) {
        const user = client.user;
        const date = new Date();

        this.messages.push({
            type: enums.MESSAGE_TEXT,
            user,
            address: user.address,
            text,
            date,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_TEXT)
            .uint32(user.id)
            .string(user.address)
            .date(date)
            .string(text);
        this.broadcast(writer.getBuffer());
    }
    clientMessageImage(client: ExtWebSocket, image: Uint8Array) {
        const user = client.user;
        const date = new Date();

        this.messages.push({
            type: enums.MESSAGE_IMAGE,
            user,
            address: user.address,
            image,
            date,
        });
        this.removeOldMessages();

        const writer = new BinaryWriter();
        writer
            .uint8(enums.SERVER_USER_MESSAGE)
            .uint8(enums.MESSAGE_IMAGE)
            .uint32(user.id)
            .string(user.address)
            .date(date)
            .u8array(image);
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
