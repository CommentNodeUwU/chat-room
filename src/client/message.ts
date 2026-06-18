import { DEFAULT_NAME } from "./constants.js";
import * as enums from '../shared/wsEnums.js';
import type { Message } from "./interfaces.js";

function text(data = '') {
    return document.createTextNode(data);
}

function div(className: string) {
    const node = document.createElement('div');
    node.className = className;
    return node;
}

function appendNodes(parent: Node, ...nodes: Node[]) {
    for (const node of nodes) {
        parent.appendChild(node);
    }
}

function formatTime(date: Date) {
    const minutes = date.getMinutes();
    return `${date.getMonth() + 1}/${date.getDate()} ${date.getHours()}:${minutes < 10 ? '0' + minutes : minutes}`;
}

export function createUserJoinMessage(userId: number, name: string, time?: number): Message {
    const nameNode = text(name || DEFAULT_NAME);
    const node = div('chat-system');
    appendNodes(node, text('→ '), nameNode, text(' joined the channel'));
    return { type: enums.MESSAGE_SYSTEM, userId, time, node, nameNode }
}

export function createUserLeftMessage(userId: number, name: string, time?: number): Message {
    const nameNode = text(name || DEFAULT_NAME);
    const node = div('chat-system');
    appendNodes(node, text('← '), nameNode, text(' left the channel'));
    return { type: enums.MESSAGE_SYSTEM, userId, time, node, nameNode }
}

export function createUserRenameMessage(userId: number, oldName: string, newName: string, time?: number): Message {
    const nameNode = text();
    const node = div('chat-system');
    node.textContent = `~ ${oldName || DEFAULT_NAME} changed name to ${newName || DEFAULT_NAME}`;
    return { type: enums.MESSAGE_SYSTEM_NAME_CHANGE, userId, time, node, nameNode }
}

function createChatMessageBase(name: string, address: string, date: Date) {
    const node = div('chat-message');
    const headNode = div('chat-message-head');
    const timeNode = div('chat-message-time');
    timeNode.textContent = `${address} - ${formatTime(date)}`;
    const nameNode = div('chat-message-name');
    nameNode.textContent = name || DEFAULT_NAME;
    const messageNode = div('chat-message-message');
    appendNodes(headNode, nameNode, timeNode);
    appendNodes(node, headNode, messageNode);
    return { node, nameNode, messageNode };
}

export function createChatMessageText(userId: number, name: string, address: string, date: Date, text: string): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    messageNode.textContent = text;
    return { type: 2, userId, time: date.getTime(), node, nameNode };
}

export function createChatMessageImage(userId: number, name: string, address: string, date: Date, url: string, onClick?: (src: string) => void): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chat-message-image-button';
    if (onClick) {
        button.addEventListener('click', () => onClick(url));
    }
    const img = new Image();
    img.className = 'chat-message-image';
    img.src = url;
    button.appendChild(img);
    messageNode.appendChild(button);
    return { type: 3, userId, time: date.getTime(), node, nameNode };
}

export function createChatMessageVideo(userId: number, name: string, address: string, date: Date, filename: string, url: string): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    const video = document.createElement('video');
    video.className = 'chat-message-video';
    video.src = url;
    video.controls = true;
    video.preload = 'metadata';
    video.style.maxWidth = '100%';
    video.style.height = 'auto';
    messageNode.appendChild(video);
    const caption = document.createElement('div');
    caption.className = 'chat-message-video-filename';
    caption.textContent = filename;
    messageNode.appendChild(caption);
    return { type: enums.MESSAGE_VIDEO, userId, time: date.getTime(), node, nameNode } as Message;
}

export function createChatMessageAudio(userId: number, name: string, address: string, date: Date, filename: string, url: string): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    const audio = document.createElement('audio');
    audio.className = 'chat-message-audio';
    audio.src = url;
    audio.controls = true;
    audio.preload = 'none';
    audio.style.maxWidth = '100%';
    audio.style.display = 'block';
    messageNode.appendChild(audio);
    const caption = document.createElement('div');
    caption.className = 'chat-message-audio-filename';
    caption.textContent = filename;
    messageNode.appendChild(caption);
    return { type: enums.MESSAGE_AUDIO, userId, time: date.getTime(), node, nameNode } as Message;
}

export function createChatMessageFile(userId: number, name: string, address: string, date: Date, filename: string, url: string): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.textContent = filename;
    a.className = 'chat-message-file';
    messageNode.appendChild(a);
    return { type: enums.MESSAGE_FILE, userId, time: date.getTime(), node, nameNode } as Message;
}
