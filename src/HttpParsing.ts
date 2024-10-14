// import { TCPConn } from "./connection";
import { DynamicBuffer } from "./DynamicBuffer";
import { HTTPError } from "./HttpError";
import * as Connection from "./Connection";

export {
    BodyReader,
    readerFromReq,
    HTTPRes,
    parseHTTPReq,
    handleReq,
    writeHTTPResp
}

/** --------------- Types ------------------- */
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
    // headers: Buffer[],
    headers: Map<string, string>,
};

// an HTTP response
type HTTPRes = {
    code: number,
    headers: Buffer[],
    body: BodyReader,
};

/** --------------- Read Header ------------------- */
function splitBuffer(buffer: Buffer, delimiter: string): Buffer[] {
    // let start: number = 0;
    let remainingLines = buffer;
    let lines: Buffer[] = [];
    while (remainingLines.length > 0) {
        let indexOfDelimiter = remainingLines.indexOf(delimiter);
        /** If no more deliminator, last line is the rest of the buffer */
        if (indexOfDelimiter === -1) { indexOfDelimiter = remainingLines.length; }
        let line: Buffer = Buffer.from(remainingLines.subarray(0, indexOfDelimiter));
        lines.push(line);
        // start = indexOfDelimiter + 1;
        remainingLines = remainingLines.subarray(indexOfDelimiter + delimiter.length, remainingLines.length);
    }
    return lines;
}

function parseHeaderField(line: Buffer): string[] | null {
    /** ends in a new line */
    // if (line.indexOf('\n') !== line.length - 1) return null;
    let parsedLine: Buffer[] = splitBuffer(line, ':');
    if (parsedLine.length < 2) return null;
    return [parsedLine[0].toString('latin1'), parsedLine[1].toString('latin1').substring(1)];
}

function parseHTTPReq(data: Buffer): HTTPReq {
    // split the data into lines
    console.log(JSON.stringify(data.toString()));
    const lines: Buffer[] = splitBuffer(data, '\r\n');
    // the first line is `METHOD URI VERSION`
    const [method, uri, version]: Buffer[] = splitBuffer(lines[0], ' '); /** split line by spaces */
    // followed by header fields in the format of `Name: value`
    const headers: Map<string, string> = new Map();
    for (let i = 1; i < lines.length - 2; i++) {
        const h = Buffer.from(lines[i]);    // copy
        let parsedLine: string[] | null = parseHeaderField(h);
        if (parsedLine === null) {
            throw new HTTPError(400, 'bad field');
        }
        headers.set(parsedLine[0], parsedLine[1]);
    }
    // the header ends by an empty line
    console.assert(lines[lines.length - 1].length === 0);
    return {
        method: method.toString(), uri: uri, version: version.toString(), headers: headers,
    };
}
/** ----------------- Read Body ----------------------- */

function readerFromConnLength(
    conn: Connection.TCPConn, dynamicBuff: DynamicBuffer, remain: number): BodyReader {
    return {
        length: remain,
        read: async (): Promise<Buffer> => {
            if (remain === 0) {
                return Buffer.from(''); // done
            }
            if (dynamicBuff.dataLength === 0) {
                // try to get some data if there is none
                let data: Buffer = await Connection.read(conn);
                dynamicBuff.push(data);
                if (data.length === 0) {
                    // expect more data!
                    throw new Error('Unexpected EOF from HTTP body');
                }
            }
            // consume data from the buffer
            const consume: number = Math.min(dynamicBuff.dataLength, remain);
            remain -= consume;
            const data = Buffer.from(dynamicBuff.buffer.subarray(0, consume));
            dynamicBuff.pop(consume);
            return data;
        }
    };
}

/** Checks Content Length and throws and error if there should not be a body
 * Checks encoding type and throws an error if it's chunked or body length is unspecified */
function readerFromReq(conn: Connection.TCPConn, buf: DynamicBuffer, req: HTTPReq): BodyReader {
    let bodyLen = -1;
    const contentLen = req.headers.get('Content-Length');
    if (contentLen) {
        bodyLen = parseFloat(contentLen);
        if (isNaN(bodyLen)) {
            throw new HTTPError(400, 'bad Content-Length.');
        }
    }
    const bodyAllowed = !(req.method === 'GET' || req.method === 'HEAD');
    let transferEncoding: string | null = req.headers.get('Transfer-Encoding') || null;
    const chunked = transferEncoding && transferEncoding === 'chunked';
    if (!bodyAllowed && (bodyLen > 0 || chunked)) {
        throw new HTTPError(400, 'HTTP body not allowed.');
    }
    if (!bodyAllowed) {
        bodyLen = 0;
    }

    if (bodyLen >= 0) {
        // "Content-Length" is present
        return readerFromConnLength(conn, buf, bodyLen);
    } else if (chunked) {
        // chunked encoding
        throw new HTTPError(501, 'This server does not support chunked encoding.');
    } else {
        // read the rest of the connection
        throw new HTTPError(501, 'This server does not support unspecified body length.');
    }
}

function readerFromMemory(data: Buffer): BodyReader {
    let done = false;
    return {
        length: data.length,
        read: async (): Promise<Buffer> => {
            if (done) {
                return Buffer.from(''); // no more data
            } else {
                done = true;
                return data;
            }
        },
    };
}

async function handleReq(req: HTTPReq, body: BodyReader): Promise<HTTPRes> {
    // act on the request URI
    let resp: BodyReader;
    switch (req.uri.toString('latin1')) {
        case '/echo':
            // http echo server
            resp = body;
            break;
        default:
            resp = readerFromMemory(Buffer.from('hello world.\n'));
            break;
    }

    return {
        code: 200,
        headers: [Buffer.from('Server: my_first_http_server')],
        body: resp,
    };
}

/** ---------------- Write Response ----------------------- */

function encodeHTTPResp(resp: HTTPRes): Buffer {
    let buff = new DynamicBuffer();
    let line: string = "HTTP/2.0 " + resp.code + " REASON\r\n";
    buff.push(Buffer.from(line));
    resp.headers.forEach(headerLine => {
        buff.push(headerLine);
        buff.push(Buffer.from("\r\n"));
    });
    buff.push(Buffer.from("\r\n"));
    return buff.pop(buff.dataLength);
}
async function writeHTTPResp(conn: Connection.TCPConn, resp: HTTPRes): Promise<void> {
    if (resp.body.length < 0) {
        throw new Error('TODO: chunked encoding');
    }
    // set the "Content-Length" field
    resp.headers.push(Buffer.from(`Content-Length: ${resp.body.length}`));
    // write the header
    let responseBuffer: Buffer = encodeHTTPResp(resp);
    await Connection.write(conn, responseBuffer);

    // write the body
    while (true) {
        const data = await resp.body.read();
        if (data.length === 0) {
            break;
        }
        await Connection.write(conn, data);
    }
}