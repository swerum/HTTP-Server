# HTTP Server
I followed [this Tutorial](https://build-your-own.org/webserver/) along with the 
[RFC Guide](https://www.rfc-editor.org/rfc/rfc9110.html) to create my own HTTP server using Node.js and TypeScript. 


It includes:
- setting up the socket connection
- reading from and writing to the socket using Promises and a DynamicBuffer
- parsing and writing HTTP


## Testing
While running the server, you can test it from them command line with:

`curl -s --data-binary hello http://127.0.0.1:1234/echo`

`curl -s http://127.0.0.1:1234`
