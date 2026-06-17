import { BinaryReader } from '../shared/binaryReader.js';
import * as enums from '../shared/wsEnums.js';
import { DEFAULT_NAME } from './constants.js';
import type { Message, User } from './interfaces.js';
import {
    createChatMessageImage, createChatMessageText, createUserJoinMessage, createUserLeftMessage, createUserRenameMessage
} from './message.js';
import './styles.scss';
import { closeWs, createWs, isWsCreated, wsMessageImage, wsMessageText, wsSetChannel, wsSetName } from './ws.js';

let myId = -1;
let myName = '';
let myAddr = '';
let myToken = '';
let channelId = '';

const users: User[] = [];
const messages: Message[] = [];

const userById = new Map<number, User>();

function element<T = HTMLElement>(id: string): T {
    return document.getElementById(id) as T;
}

const nameButton = element('user-button');
const nameText = element('user-name');
const addrText = element('user-addr');

const sidebarButton  = element('sidebar-button');
const sidebar = element('sidebar');
const content = element('content');

const connectDialog = element<HTMLDialogElement>('connect-dialog');

const nameDialog = element<HTMLDialogElement>('name-dialog');
const nameInput = element<HTMLInputElement>('name-input');
const tokenInput = element<HTMLInputElement>('token-input');
const channelInput = element<HTMLInputElement>('channel-input');
const nameOkButton = element('name-ok');
const nameCancelButton = element('name-cancel');

const userInfoDialog = element<HTMLDialogElement>('user-info-dialog');
const userInfoNameText = element('user-info-name');
const userInfoAddrText = element('user-info-addr');
const userInfoOkButton = element('user-info-ok');

const userList = element('user-list');
const chatList = element('chat-list');

const chatInput = element<HTMLInputElement>('chat-input');
// const emojiButton = element('emoji-button');
const imageButton = element('image-button');
const imageInput = element<HTMLInputElement>('image-input');
const sendButton = element('send-button');

function removeAllChildren(node: Node) {
    while (node.firstChild) {
        node.removeChild(node.firstChild);
    }
}

function updateUserName() {
    nameText.textContent = myName || DEFAULT_NAME;
    addrText.textContent = myAddr;
}

function addMessage(message: Message) {
    const scrollToBottom = chatList.scrollTop > chatList.scrollHeight - chatList.clientHeight * 1.5;

    messages.push(message);
    chatList.appendChild(message.node);

    setTimeout(() => {
        if (scrollToBottom) {
            chatList.scrollTop = chatList.scrollHeight;
        }
    }, 100);
}

function createUserItem(id: number, name: string, address: string): User {
    const node = document.createElement('div');
    node.className = 'user-item';
    node.textContent = name || DEFAULT_NAME;
    node.addEventListener('click', () => {
        userInfoNameText.textContent = user.name || DEFAULT_NAME;
        userInfoAddrText.textContent = user.address;
        userInfoDialog.showModal();
        userInfoOkButton.focus();
    });
    const user = { id, name, address, node };
    return user;
}

function createSystemMessageWithName(event: number, userId: number, name: string): Message {
    if (event === enums.SERVER_USER_JOIN) {
        return createUserJoinMessage(userId, name);
    } else {
        return createUserLeftMessage(userId, name);
    }
}

function clearListElements() {
    removeAllChildren(userList);
    removeAllChildren(chatList);
}

function readChannel(reader: BinaryReader) {
    users.length = 0;
    messages.length = 0;
    userById.clear();
    clearListElements();

    reader.array(reader => {
        const id = reader.uint32();
        const name = reader.string();
        const address = reader.string();
        const user = createUserItem(id, name, address);
        users.push(user);
    });

    reader.array(reader => {
        const type = reader.uint8();
        const userId = reader.uint32();
        switch (type) {
            case enums.MESSAGE_SYSTEM: {
                const event = reader.uint8();
                const name = reader.string();
                messages.push(createSystemMessageWithName(event, userId, name));
                break;
            }
            case enums.MESSAGE_SYSTEM_NAME_CHANGE: {
                const oldName = reader.string();
                const newName = reader.string();
                messages.push(createUserRenameMessage(userId, oldName, newName));
                break;
            }
            case enums.MESSAGE_TEXT: {
                const date = reader.date();
                const name = reader.string();
                const address = reader.string();
                const text = reader.string();
                messages.push(createChatMessageText(userId, name, address, date, text));
                break;
            }
            case enums.MESSAGE_IMAGE: {
                const date = reader.date();
                const name = reader.string();
                const address = reader.string();
                const image = reader.u8array();
                messages.push(createChatMessageImage(userId, name, address, date, image));
                break;
            }
        }
    });

    for (const user of users) {
        userById.set(user.id, user);
        userList.appendChild(user.node);
    }

    for (const message of messages) {
        chatList.appendChild(message.node);
    }

    setTimeout(() => chatList.scrollTop = chatList.scrollHeight, 100);
}

function readUserMessage(reader: BinaryReader) {
    const type = reader.uint8();
    const userId = reader.uint32();
    const address = reader.string();
    const date = reader.date();
    const user = userById.get(userId);
    switch (type) {
        case enums.MESSAGE_TEXT: {
            const text = reader.string();
            const message = createChatMessageText(userId, user?.name || DEFAULT_NAME, address, date, text);
            addMessage(message);
            break;
        }
        case enums.MESSAGE_IMAGE: {
            const image = reader.u8array();
            const message = createChatMessageImage(userId, user?.name || DEFAULT_NAME, address, date, image);
            addMessage(message);
            break;
        }
    }
}

function handleServerMessage(e: MessageEvent<ArrayBuffer | string>) {
    if (e.data instanceof ArrayBuffer) {
        const reader = new BinaryReader(new Uint8Array(e.data));
        const type = reader.uint8();
        switch (type) {
            case enums.SERVER_JOINED: {
                myId = reader.uint32();
                myToken = reader.string();
                myName = reader.string();
                myAddr = reader.string();
                channelId = reader.string();
                channelInput.value = channelId;
                updateUserName();
                readChannel(reader);
                localStorage.setItem('token', myToken);
                break;
            }
            case enums.SERVER_CHANNEL:
                readChannel(reader);
                break;
            case enums.SERVER_USER_JOIN: {
                const id = reader.uint32();
                const name = reader.string();
                const address = reader.string();
                const user = createUserItem(id, name, address);
                users.push(user);
                userById.set(user.id, user);
                userList.appendChild(user.node);
                const message = createUserJoinMessage(id, name);
                addMessage(message);
                break;
            }
            case enums.SERVER_USER_LEFT: {
                const id = reader.uint32();
                const user = userById.get(id);
                if (user) {
                    const userIndex = users.indexOf(user);
                    if (userIndex !== -1) {
                        users.splice(userIndex, 1);
                    }
                    userList.removeChild(user.node);
                    const message = createUserLeftMessage(id, user.name);
                    addMessage(message);
                }
                userById.delete(id);
                break;
            }
            case enums.SERVER_USER_NAME: {
                const id = reader.uint32();
                const oldName = reader.string();
                const newName = reader.string();
                const user = userById.get(id);
                if (user) {
                    user.name = newName;
                    user.node.textContent = newName;
                }
                for (const message of messages) {
                    if (message.userId === id) {
                        message.nameNode.textContent = newName;
                    }
                }
                if (id === myId) {
                    myName = newName;
                    updateUserName();
                }
                const message = createUserRenameMessage(id, oldName, newName);
                addMessage(message);
                break;
            }
            case enums.SERVER_USER_MESSAGE:
                readUserMessage(reader);
                break;
        }
    }
}

function onWsOpen() {
    connectDialog.close();
    clearListElements();
}

function onWsClose() {
    connectDialog.showModal();
    closeWs();
    setTimeout(() => {
        const ws = createWs(myToken);
        setupWs(ws);
    }, 5000);
}

function setupWs(ws: WebSocket) {
    ws.onopen = onWsOpen;
    ws.onclose = onWsClose;
    ws.onerror = onWsClose;
    ws.onmessage = handleServerMessage;
}

sidebarButton.addEventListener('click', () => {
    sidebar.classList.toggle('show');
});

content.addEventListener('click', () => {
    sidebar.classList.remove('show');
});

nameButton.addEventListener('click', () => {
    nameInput.value = myName;
    tokenInput.value = myToken;
    nameDialog.showModal();
    nameOkButton.focus();
});

nameOkButton.addEventListener('click', () => {
    const name = nameInput.value;
    const token = tokenInput.value;
    if (isWsCreated()) {
        wsSetName(name);
    } else {
        connectDialog.showModal();
        const ws = createWs(token, name);
        setupWs(ws);
    }
    nameDialog.close();
});

nameCancelButton.addEventListener('click', () => {
    nameDialog.close();
});

userInfoOkButton.addEventListener('click', () => {
    userInfoDialog.close();
});

channelInput.addEventListener('change', () => {
    wsSetChannel(channelInput.value);
});

function sendText() {
    const text = chatInput.value;
    if (text.trim()) {
        wsMessageText(text);
        chatInput.value = '';
    }
}

chatInput.addEventListener('keydown', e => {
    if (e.keyCode === 13) { // Enter
        e.preventDefault();
        sendText();
    }
});

chatInput.addEventListener('paste', function (event: ClipboardEvent) {
    const clipboardData = event.clipboardData;
    if (!clipboardData) return;

    const items = clipboardData.items;
    for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.type.indexOf('image') !== -1) {
            event.preventDefault();

            const file = item.getAsFile();
            
            if (file) {
                file.arrayBuffer()
                    .then(buffer => wsMessageImage(new Uint8Array(buffer)));
            }
            
            break; 
        }
    }
});

sendButton.addEventListener('click', () => {
    sendText();
});

imageInput.addEventListener('change', () => {
    const file = imageInput.files?.item(0);
    if (file) {
        file.arrayBuffer()
            .then(buffer => wsMessageImage(new Uint8Array(buffer)));
    }
    imageInput.value = '';
});

imageButton.addEventListener('click', async () => {
    imageInput.click();
});

const initToken = localStorage.getItem('token');
if (initToken) {
    connectDialog.showModal();
    const ws = createWs(initToken);
    setupWs(ws);
} else {
    nameDialog.showModal();
}
