import { HTTPError } from "./HttpError";

const maxHeaderLen = 1024 * 8;
/** 
 * Dynamic Buffer that resizes exponentially when it would overflow.  
 * It does not shrink again. It also could be changed to not copy data around as often, but I don't feel like it. 
 * This isn't data structures class.
 * */
export class DynamicBuffer {
    buffer: Buffer;            //the buffer holding the data (may be larger than the data itself)
    dataLength: number = 0;    //the length of the data stored in the buffer
    constructor() { this.buffer = Buffer.alloc(0); }

    public push(newData: Buffer) {
        let newDataLength = newData.length + this.dataLength;
        //if buffer is too small, resize it 
        if (newDataLength > this.buffer.length) {
            let newBufferSize = this.getNewBufferSize(newDataLength);
            const grown = Buffer.alloc(newBufferSize);
            this.buffer.copy(grown, 0, 0);
            this.buffer = grown;
        }
        // copy new data to end of buffer
        newData.copy(this.buffer, this.dataLength, 0);
        this.dataLength = newDataLength;
    }

    public popHeader(): null | Buffer {
        //create message buffer
        /**  NOTE: subarray just creates a reference buffer from the original. it does not allocate new memory */
        let data: Buffer = this.buffer.subarray(0, this.dataLength);
        let newLineIndex: number = data.indexOf('\r\n\r\n');
        if (newLineIndex < 0) {
            if (this.buffer.length >= maxHeaderLen) {
                throw new HTTPError(413, 'Header Too Large');
            }
            return null;
        }
        let header: Buffer = this.pop(newLineIndex + 1);
        return header;
    }

    public pop(length: number): Buffer {
        if (length > this.dataLength) { throw new Error("Trying to pop more data from Dynamic Buffer than is in it."); }
        let header: Buffer = Buffer.from(this.buffer.subarray(0, length)); //allocates its own memory for the message
        //remove message from buffer
        this.buffer.copyWithin(0, length, this.dataLength);
        this.dataLength -= length;
        return header;
    }

    /** New buffer size is calculated exponentially */
    private getNewBufferSize(newDataLength: number) {
        let l = Math.max(this.buffer.length, 32);
        while (l < newDataLength) {
            l *= 2;
        }
        return l;
    }
}