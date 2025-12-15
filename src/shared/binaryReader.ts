const textDecoder = new TextDecoder();

export class BinaryReader {
    offset = 0;
    private readonly view: DataView;
    constructor(public readonly data: Uint8Array) {
        this.view = new DataView(data.buffer);
    }
    int8() {
        const value = this.view.getInt8(this.offset);
        this.offset += 1;
        return value;
    }
    uint8() {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }
    int16() {
        const value = this.view.getInt16(this.offset, true);
        this.offset += 2;
        return value;
    }
    uint16() {
        const value = this.view.getUint16(this.offset, true);
        this.offset += 2;
        return value;
    }
    int32() {
        const value = this.view.getInt32(this.offset, true);
        this.offset += 4;
        return value;
    }
    uint32() {
        const value = this.view.getUint32(this.offset, true);
        this.offset += 4;
        return value;
    }
    float32() {
        const value = this.view.getFloat32(this.offset, true);
        this.offset += 4;
        return value;
    }
    float64() {
        const value = this.view.getFloat64(this.offset, true);
        this.offset += 8;
        return value;
    }
    date() {
        return new Date(this.float64());
    }
    u8array() {
        const length = this.uint32();
        const buffer = this.data.slice(this.offset, this.offset + length);
        this.offset += length;
        return buffer;
    }
    string() {
        return textDecoder.decode(this.u8array());
    }
    array<T>(action: (reader: BinaryReader) => T) {
        const length = this.uint32();
        const items: T[] = [];
        for (let i = 0; i < length; i++) {
            items.push(action(this));
        }
        return items;
    }
}
