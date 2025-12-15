import { findOrCreateChannel, type Channel } from './channel.js';

function randomString(length: number) {
    const chars = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz1234567890';
    return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

export class User {
    static currentId = 1;
    readonly id: number;
    readonly token: string;
    name = '';
    address = '';
    channel: Channel;
    constructor() {
        this.id = User.currentId;
        User.currentId++;
        this.token = randomString(8);
        this.channel = findOrCreateChannel('');
    }
}

const users = new Map<string, User>();

export function findOrCreateUser(token: string) {
    let user = users.get(token);
    if (!user) {
        user = new User();
        users.set(user.token, user);
    }
    return user;
}
