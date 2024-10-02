/** 
 * Dynamic Buffer that resizes exponentially when it would overflow.  
 * It does not shrink again. 
 * */
export class DynamicBuffer {
    buffer : Buffer;            //the buffer holding the data (may be larger than the data itself)
    dataLength : number = 0;    //the length of the data stored in the buffer
    constructor() { this.buffer = Buffer.alloc(0); }

    public push(newData : Buffer) {
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

    public popMessage() : null|Buffer{
        //create message buffer
        /**  NOTE: subarray just creates a reference buffer from the original. it does not allocate new memory */
        let data : Buffer = this.buffer.subarray(0, this.dataLength); 
        let newLineIndex : number = data.indexOf('\n');
        if (newLineIndex < 0) { return null; }
        let message : Buffer = Buffer.from(data.subarray(0, newLineIndex+1)); //allocates its own memory for the message
        //remove message from buffer
        this.buffer.copyWithin(0, newLineIndex+1, this.dataLength);
        this.dataLength -= newLineIndex+1;
        return message; 
    }

    /** New buffer size is calculated exponentially */
    private getNewBufferSize(newDataLength : number) {
        let l = Math.max(this.buffer.length, 32);
        while (l < newDataLength) {
            l *= 2;
        }
        return l;
    }
}