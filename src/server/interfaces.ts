import type { WebSocket } from 'ws';
import * as enums from '../shared/wsEnums.js';
import type { User } from './user.js';

export declare class ExtWebSocket extends WebSocket {
    isAlive: boolean;
    user: User;
}

export interface MessageBase {
    type: number;
    time: number;
    ttl: number;
}

export interface MessageSystem extends MessageBase {
    type: typeof enums.MESSAGE_SYSTEM;
    user: User;
    event: number;
}

export interface MessageSystemNameChange extends MessageBase {
    type: typeof enums.MESSAGE_SYSTEM_NAME_CHANGE;
    user: User;
    oldName: string;
    newName: string;
}

export interface MessageText extends MessageBase {
    type: typeof enums.MESSAGE_TEXT;
    user: User;
    address: string;
    text: string;
}

export interface MessageImage extends MessageBase {
    type: typeof enums.MESSAGE_IMAGE;
    user: User;
    address: string;
    url: string;
    filePath?: string;
    fileHash?: string;
}

export interface MessageFile extends MessageBase {
    type: typeof enums.MESSAGE_FILE;
    user: User;
    address: string;
    filename: string;
    mime: string;
    url: string;
    filePath?: string;
    fileHash?: string;
}

export interface MessageVideo extends MessageBase {
    type: typeof enums.MESSAGE_VIDEO;
    user: User;
    address: string;
    filename: string;
    mime: string;
    url: string;
    filePath?: string;
    fileHash?: string;
}

export interface MessageAudio extends MessageBase {
    type: typeof enums.MESSAGE_AUDIO;
    user: User;
    address: string;
    filename: string;
    mime: string;
    url: string;
    filePath?: string;
    fileHash?: string;
}

export type Message = MessageSystem | MessageSystemNameChange | MessageText | MessageImage | MessageFile | MessageVideo | MessageAudio;
