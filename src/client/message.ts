import { DEFAULT_NAME } from "./constants.js";
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
    return `${date.getMonth()}/${date.getDate()} ${date.getHours()}:${minutes < 10 ? '0' + minutes : minutes}`;
}

export function createUserJoinMessage(userId: number, name: string): Message {
    const nameNode = text(name || DEFAULT_NAME);
    const node = div('chat-system');
    appendNodes(node, text('→ '), nameNode, text(' joined the channel'));
    return { userId, node, nameNode }
}

export function createUserLeftMessage(userId: number, name: string): Message {
    const nameNode = text(name || DEFAULT_NAME);
    const node = div('chat-system');
    appendNodes(node, text('← '), nameNode, text(' left the channel'));
    return { userId, node, nameNode }
}

export function createUserRenameMessage(userId: number, oldName: string, newName: string): Message {
    const nameNode = text();
    const node = div('chat-system');
    node.textContent = `~ ${oldName || DEFAULT_NAME} changed name to ${newName || DEFAULT_NAME}`;
    return { userId, node, nameNode }
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
    return { userId, node, nameNode };
}

export function createChatMessageImage(userId: number, name: string, address: string, date: Date, image: Uint8Array<ArrayBuffer>): Message {
    const { node, nameNode, messageNode } = createChatMessageBase(name, address, date);
    const src = URL.createObjectURL(new Blob([image], { type: 'image/png' }));
    const a = document.createElement('a');
    a.href = src;
    a.target = '_blank';
    const img = new Image();
    img.className = 'chat-message-image';
    img.src = src;
    a.appendChild(img);
    messageNode.appendChild(a);
    return { userId, node, nameNode };
}
