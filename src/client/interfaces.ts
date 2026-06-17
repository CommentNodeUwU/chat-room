export interface User {
    id: number;
    name: string;
    address: string;
    node: Node;
}

export interface Message {
    userId: number;
    type?: number;
    time?: number;
    nameNode: Node;
    node: Node;
}
