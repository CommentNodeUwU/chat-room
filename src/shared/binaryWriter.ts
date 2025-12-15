const textEncoder = new TextEncoder();

export class BinaryWriter {
    offset = 0;
    data = new Uint8Array(16);
    view = new DataView(this.data.buffer);
    private _resize(size: number) {
        const data = this.data;
        if (size <= data.byteLength) {
            return;
        }

        const newData = new Uint8Array(size);
        newData.set(data);
        this.data = newData;
        this.view = new DataView(newData.buffer);
    }
    private _checkResize(size: number) {
        if (this.offset + size > this.data.byteLength) {
            this._resize(this.data.byteLength * 2);
        }
    }
    int8(value: number) {
        this._checkResize(1);
        this.view.setInt8(this.offset, value);
        this.offset += 1;
        return this;
    }
    uint8(value: number) {
        this._checkResize(1);
        this.view.setUint8(this.offset, value);
        this.offset += 1;
        return this;
    }
    int16(value: number) {
        this._checkResize(2);
        this.view.setInt16(this.offset, value, true);
        this.offset += 2;
        return this;
    }
    uint16(value: number) {
        this._checkResize(2);
        this.view.setUint16(this.offset, value, true);
        this.offset += 2;
        return this;
    }
    int32(value: number) {
        this._checkResize(4);
        this.view.setInt32(this.offset, value, true);
        this.offset += 4;
        return this;
    }
    uint32(value: number) {
        this._checkResize(4);
        this.view.setUint32(this.offset, value, true);
        this.offset += 4;
        return this;
    }
    float32(value: number) {
        this._checkResize(4);
        this.view.setFloat32(this.offset, value, true);
        this.offset += 4;
        return this;
    }
    float64(value: number) {
        this._checkResize(8);
        this.view.setFloat64(this.offset, value, true);
        this.offset += 8;
        return this;
    }
    date(value: Date) {
        this.float64(value.getTime());
        return this;
    }
    u8array(value: Uint8Array) {
        const length = value.byteLength;
        this.uint32(length);
        this._resize(this.offset + length);
        this.data.set(value, this.offset);
        this.offset += length;
        return this;
    }
    string(value: string) {
        this.u8array(textEncoder.encode(value));
        return this;
    }
    array<T>(value: T[], action: (value: T) => void) {
        const length = value.length;
        this.uint32(length);
        for (let i = 0; i < length; i++) {
            action(value[i]);
        }
        return this;
    }
    getBuffer() {
        return this.data.slice(0, this.offset);
    }
}
