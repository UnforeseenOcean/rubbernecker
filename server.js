var execFile = require('child_process').execFile;
var express = require('express');
var app = express();
app.use(express.static(__dirname + '/public'));

app.get('/screenshot', function(req, res){
  saveScreenshot();
  res.send('success');
});

app.listen(3000);

function saveScreenshot() {
  var d = new Date().getTime();
  var args = '-t jpg -x /Users/sam/Desktop/rubber_shots/' + d + '.jpg';
  execFile('screencapture', args.split(' '), function (error, stdout, stderr) {
    if (error !== null) {
      console.log('exec error: ' + error);
    }
  });
}

//var http = require('http');

//var server = http.createServer(function (request, response) {
  //saveScreenshot();
  //response.writeHead(200, {"Content-Type": "text/plain"});
  //response.end("success\n");
//});

//server.listen(3000);
