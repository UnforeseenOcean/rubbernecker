var vid = document.getElementById('videoel');
var webGLCanvas = document.getElementById('webgl');
var imgCanvasEl = document.getElementById('img-canvas');
var newcanvas = document.getElementById('output');
var imageCtx = imgCanvasEl.getContext("2d");

var imageObj = new Image();
var imageIndex = 0, ready = false;
var mapping, ctrackBG, positions, animationRequest;

var ctrack = new clm.tracker({useWebGL : true});
ctrack.setResponseMode("cycle", ["lbp", "sobel"]);
ctrack.init(pModel);

imageObj.onload = function() {
  newcanvas.getContext('2d').clearRect(0, 0, newcanvas.width, newcanvas.height);
  videocanvas.getContext('2d').clearRect(0, 0, videocanvas.width, videocanvas.height);
  imageCtx.clearRect(0, 0, imgCanvasEl.width, imgCanvasEl.height);
  imageCtx.drawImage(imageObj, 0, 0);
  ready = true;
  var new_positions = ctrack.getCurrentPosition(vid);
  if (!new_positions && positions) new_positions = positions;
  if (new_positions) {
    positions = new_positions;
    //switchMasks(new_positions);
  }
  var coords = images[imageIndex].coords[0];
  var x = $(window).width()/2 - coords[0] * 2;
  var y = $(window).height()/2 - coords[1] * 2;

  console.log(coords[0], coords[1], x, y);
  $('#container').
    addClass('notransition').
    css('-webkit-transform', 'none')[0].offsetHeight
  $('#container').
    removeClass('notransition').
    css({opacity: 1, '-webkit-transform': 'translateX('+x+'px) translateY('+y+'px) scale(2)'});
  console.log(coords);
  console.log(images[imageIndex].name);
};

var fd = new faceDeformer();
fd.init(document.getElementById('webgl'));
var wc1 = document.getElementById('webgl').getContext('webgl')
wc1.clearColor(0,0,0,0);

var fd2 = new faceDeformer();
fd2.init(document.getElementById('webgl2'));
var wc2 = document.getElementById('webgl2').getContext('webgl')
wc2.clearColor(0,0,0,0);

// canvas for copying the warped face to
//var newcanvas = document.createElement('CANVAS');
//newcanvas.width = imgCanvasEl.width;
//newcanvas.height = imgCanvasEl.height;
//document.body.appendChild(newcanvas);

// canvas for copying videoframes to
var videocanvas = document.createElement('CANVAS');
videocanvas.width = imgCanvasEl.width;
videocanvas.height = imgCanvasEl.height;

// canvas for masking
var maskcanvas = document.createElement('CANVAS');
maskcanvas.width = imgCanvasEl.width;
maskcanvas.height = imgCanvasEl.height;

function switchImage(index) {
  ready = false;
  imageObj.src = images[index].name;
  mapping = images[index].coords;
}

function nextImage() {
  imageIndex ++;
  if (imageIndex >= images.length) imageIndex = 0;
  switchImage(imageIndex);
}


function startVideo() {
  switchImage(0);
  // start video
  vid.play();
  // start tracking
  ctrack.start(vid);
  // start loop to draw face
  //drawGridLoop();
  drawLoop();
}

function switchMasks(pos) {
  videocanvas.getContext('2d').drawImage(imgCanvasEl,0,0,videocanvas.width,videocanvas.height);

  // we need to extend the positions with new estimated points in order to get pixels immediately outside mask
  //var newMaskPos = mapping.slice(0);//masks[images[currentMask]].slice(0);
  //var newFacePos = pos.slice(0);
  var newMaskPos = pos.slice(0);
  var newFacePos = mapping.slice(0);
  var extInd = [0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,22,21,20,19];
  var newp;
  for (var i = 0;i < 23;i++) {
    newp = [];
    newp[0] = (newMaskPos[extInd[i]][0]*1.3) - (newMaskPos[62][0]*0.3);// short for ((newMaskPos[extInd[i]][0]-newMaskPos[62][0])*1.1)+newMaskPos[62][0]
    newp[1] = (newMaskPos[extInd[i]][1]*1.3) - (newMaskPos[62][1]*0.3);
    newMaskPos.push(newp);
    newp = [];
    newp[0] = (newFacePos[extInd[i]][0]*1.3) - (newFacePos[62][0]*0.3);
    newp[1] = (newFacePos[extInd[i]][1]*1.3) - (newFacePos[62][1]*0.3);
    newFacePos.push(newp);
  }

  // also need to make new vertices incorporating area outside mask
  var newVertices = pModel.path.vertices.concat(extended_vertices);

  // deform the mask we want to use to face form
  fd2.load(vid, newMaskPos, pModel, newVertices);
  fd2.draw(newFacePos);

  // and copy onto new canvas
  newcanvas.getContext('2d').drawImage(document.getElementById('webgl2'),0,0);

  // create masking
  var tempcoords = mapping.slice(0,18);
  tempcoords.push(mapping[21]);
  tempcoords.push(mapping[20]);
  tempcoords.push(mapping[19]);
  createMasking(maskcanvas, tempcoords);

  // do poisson blending
  Poisson.load(newcanvas, videocanvas, maskcanvas, function() {
    var result = Poisson.blend(30, 0, 0);

    // render to canvas
    newcanvas.getContext('2d').putImageData(result, 0, 0);

    // get mask
    //fd.load(newcanvas, pos, pModel);
    //fd.draw(mapping);
    //requestAnimationFrame(drawMaskLoop);
  });
}

function drawMaskLoop() {
  // get position of face
  positions = ctrack.getCurrentPosition();
  if (positions) {
    // draw mask on top of face
    //fd2.load(newcanvas, positions, pModel);
    //fd2.draw(mapping);

    //fd.load(newcanvas, positions, pModel);
    //fd.draw(mapping);
  }
  animationRequest = requestAnimationFrame(drawMaskLoop);
}

function drawGridLoop() {
  // get position of face
  positions = ctrack.getCurrentPosition(vid);

  // check whether mask has converged
  var pn = ctrack.getConvergence();
  if (pn < 0.4) {
    switchMasks(positions);
  } else {
    requestAnimationFrame(drawGridLoop);
  }
}

function drawLoop() {
  requestAnimationFrame(drawLoop);
  var positions = ctrack.getCurrentPosition();

  if (ready === true && positions && mapping && ctrack.getScore() > .1) {
    fd.load(vid, positions, pModel);
    fd.draw(mapping);
  }
}

function createMasking(canvas, modelpoints) {
  // fill canvas with black
  var cc = canvas.getContext('2d');
  cc.fillStyle="#000000";
  cc.fillRect(0,0,canvas.width, canvas.height);
  cc.beginPath();
  cc.moveTo(modelpoints[0][0], modelpoints[0][1]);
  for (var i = 1;i < modelpoints.length;i++) {
    cc.lineTo(modelpoints[i][0], modelpoints[i][1]);
  }
  cc.lineTo(modelpoints[0][0], modelpoints[0][1]);
  cc.closePath();
  cc.fillStyle="#ffffff";
  cc.fill();
}


navigator.getUserMedia = navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia;

if (navigator.getUserMedia) {
  navigator.getUserMedia({audio: false, video: true}, function(stream) {
    vid.src = window.URL.createObjectURL(stream);
    vid.play();
    startVideo();
  }, function(err){
    console.log(err);
  });
} else {
  console.log("Couldn't load webcam");
}

var i = setInterval(function(){
  $('#container').css('opacity', 0);
  setTimeout(function(){
    nextImage();
  }, 1000)
  //$('#container').fadeOut(function(){
    //nextImage();
  //});
}, 16000);

//var j = setInterval(function(){
  //if (positions) {
    //switchMasks(positions);
  //}
//}, 500);
