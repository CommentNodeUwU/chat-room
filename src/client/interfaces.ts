export interface User {
    id: number;
    name: string;
    address: string;
    node: Node;
}

export interface Message {
    userId: number;
    nameNode: Node;
    node: Node;
}
