import { HTTPError } from "./HttpError";

type BodyReader = {
    // the "Content-Length", -1 if unknown.
    length: number,
    // read data. returns an empty buffer after EOF.
    read: () => Promise<Buffer>,
};

type HTTPReq = {
    method: string,
    uri: Buffer,
    version: string,
    headers: Buffer[],
};

// an HTTP response
type HTTPRes = {
    code: number,
    headers: Buffer[],
    body: BodyReader,
};

function splitBuffer(buffer: Buffer, delimiter: string): Buffer[] {
    // let start: number = 0;
    let remainingLines = buffer;
    let lines: Buffer[] = [];
    while (remainingLines.length > 0) {
        let indexOfDelimiter = remainingLines.indexOf(delimiter);
        /** If no more deliminator, last line is the rest of the buffer */
        if (indexOfDelimiter === -1) { indexOfDelimiter = remainingLines.length - 1; }
        let line: Buffer = Buffer.from(remainingLines.subarray(0, indexOfDelimiter + 1));
        lines.push(line);
        // start = indexOfDelimiter + 1;
        remainingLines = remainingLines.subarray(indexOfDelimiter + 1, remainingLines.length);
    }
    return lines;
}

function validateHeader(line: Buffer): boolean {
    /** has a : somewhere in the middle */
    let indexOfColon = line.indexOf(":");
    if (indexOfColon === -1 || indexOfColon === 0 || indexOfColon === line.length - 1) { return false; }
    /** ends in a new line */
    if (line.indexOf('\n') !== line.length - 1) return false;
    return true;
}

function parseHTTPReq(data: Buffer): HTTPReq {
    // split the data into lines
    const lines: Buffer[] = splitBuffer(data, '\n');
    // the first line is `METHOD URI VERSION`
    const [method, uri, version]: Buffer[] = splitBuffer(lines[0], ' '); /** split line by spaces */
    // followed by header fields in the format of `Name: value`
    const headers: Buffer[] = [];
    for (let i = 1; i < lines.length - 1; i++) {
        const h = Buffer.from(lines[i]);    // copy
        if (!validateHeader(h)) {
            throw new HTTPError(400, 'bad field');
        }
        headers.push(h);
    }
    // the header ends by an empty line
    console.assert(lines[lines.length - 1].length === 0);
    return {
        method: method.toString(), uri: uri, version: version.toString(), headers: headers,
    };
}