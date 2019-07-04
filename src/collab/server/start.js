const {createServer} = require("http")
const {handleCollabRequest} = require("./server")
const fs = require('fs');

const port = 8000

// The collaborative editing document server.
createServer((req, resp) => {
    resp.setHeader('Access-Control-Allow-Origin', '*');
	resp.setHeader('Access-Control-Request-Method', '*');
	resp.setHeader('Access-Control-Allow-Methods', 'OPTIONS, GET, POST');
	resp.setHeader('Access-Control-Allow-Headers', '*');

	console.log("================ url : " + req.url);
    if( req.url.indexOf('deploy/')!=-1 || req.url.indexOf('dist/')!=-1){
        if( req.url.indexOf('deploy/')!=-1){
            fs.readFile('./deploy/index.html',(err,data)=>{
                if(err){
                    throw err;
                }
                console.log('파일응답!!! ')
                resp.end(data); //data에 담긴 버퍼를 브라우저(클라이언트)로 요청을 보냄
                return;
            });
        }
        if( req.url.indexOf('dist/')!=-1){
            fs.readFile('./dist/buptle_ProseMirror.js',(err,data)=>{
                if(err){
                    throw err;
                }
                console.log('파일응답!!! ')
                resp.end(data); //data에 담긴 버퍼를 브라우저(클라이언트)로 요청을 보냄
                return;
            });
        }
    }else{
        _rst = handleCollabRequest(req, resp);
        if (!_rst) {
            resp.writeHead(404, {"Content-Type": "text/plain"})
            resp.end("Not found!!!")
        }
    }
}).listen(port, "localhost")

console.log("Collab demo server listening on " + port)
