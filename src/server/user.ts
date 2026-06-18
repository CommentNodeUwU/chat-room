import fs from 'node:fs';
import path from 'node:path';
import { findOrCreateChannel, type Channel } from './channel.js';

const USER_METADATA_DIR = path.join('/tmp', 'chat-room');
const USER_METADATA_FILE = path.join(USER_METADATA_DIR, 'users.json');

type StoredUser = {
    token: string;
    name: string;
};

function randomString(length: number) {
    const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function ensureMetadataDir() {
    await fs.promises.mkdir(USER_METADATA_DIR, { recursive: true });
}

function loadStoredUsers(): StoredUser[] {
    try {
        if (!fs.existsSync(USER_METADATA_FILE)) {
            return [];
        }
        const content = fs.readFileSync(USER_METADATA_FILE, 'utf8');
        const parsed = JSON.parse(content) as StoredUser[];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load stored user metadata:', error);
        return [];
    }
}

async function saveAllUserMetadata() {
    try {
        await ensureMetadataDir();
        const filePath = USER_METADATA_FILE;
        const storedUsers: StoredUser[] = Array.from(users.values()).map(user => ({ token: user.token, name: user.name }));
        await fs.promises.writeFile(filePath, JSON.stringify(storedUsers, null, 2), 'utf8');
    } catch (error) {
        console.error('Failed to save user metadata:', error);
    }
}

export class User {
    static currentId = 1;
    readonly id: number;
    readonly token: string;
    name = '';
    address = '';
    channel: Channel;
    constructor(token?: string) {
        this.id = User.currentId;
        User.currentId++;
        this.token = token || randomString(8);
        this.channel = findOrCreateChannel('');
    }
}

export async function saveUserMetadata(user: User) {
    users.set(user.token, user);
    await saveAllUserMetadata();
}

const users = new Map<string, User>();

export function findOrCreateUser(token: string) {
    if (!token) {
        const user = new User();
        users.set(user.token, user);
        saveUserMetadata(user).catch(console.error);
        return user;
    }

    let user = users.get(token);
    if (user) {
        return user;
    }

    const storedUsers = loadStoredUsers();
    const stored = storedUsers.find(item => item.token === token);
    if (stored) {
        user = new User(stored.token);
        user.name = stored.name;
        users.set(user.token, user);
        return user;
    }

    user = new User(token);
    users.set(user.token, user);
    saveUserMetadata(user).catch(console.error);
    return user;
}
