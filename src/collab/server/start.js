const {createServer} = require("http")
const {handleCollabRequest} = require("./server")

const port = 8000

// The collaborative editing document server.
createServer((req, resp) => {
    resp.setHeader('Access-Control-Allow-Origin', '*');
	resp.setHeader('Access-Control-Request-Method', '*');
	resp.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
	resp.setHeader('Access-Control-Allow-Headers', '*');
  if (!handleCollabRequest(req, resp)) {
    resp.writeHead(404, {"Content-Type": "text/plain"})
    resp.end("Not found!!!")
  }
}).listen(port, "localhost")

console.log("Collab demo server listening on " + port)
