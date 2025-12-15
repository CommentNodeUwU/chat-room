import type { WebSocket } from 'ws';
import * as enums from '../shared/wsEnums.js';
import type { User } from './user.js';

export declare class ExtWebSocket extends WebSocket {
    isAlive: boolean;
    user: User;
}

export interface MessageSystem {
    type: typeof enums.MESSAGE_SYSTEM;
    user: User;
    event: number;
}

export interface MessageSystemNameChange {
    type: typeof enums.MESSAGE_SYSTEM_NAME_CHANGE;
    user: User;
    oldName: string;
    newName: string;
}

export interface MessageText {
    type: typeof enums.MESSAGE_TEXT;
    user: User;
    address: string;
    text: string;
    date: Date;
}

export interface MessageImage {
    type: typeof enums.MESSAGE_IMAGE;
    user: User;
    address: string;
    image: Uint8Array;
    date: Date;
}

export type Message = MessageSystem | MessageSystemNameChange | MessageText | MessageImage;
