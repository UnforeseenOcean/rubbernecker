var signText = "COME CLOSER RUBBERNECKER";
// var fonts = ["Arial", "monospace", "Impact", "Verdana", "Trebuchet MS"];
var fonts = ["Arial"];//, "Verdana", "Trebuchet MS"];
var colors = ["#fe0687", "#05e2fe", "#05e2fe", "#ff6403"]; //"#210fc"
var animateSignID;

var vid = document.getElementById('videoel');
var webGLCanvas = document.getElementById('webgl');
var imgCanvasEl = document.getElementById('img-canvas');
var imageCtx = imgCanvasEl.getContext("2d");

var buffer = document.getElementById('buffer');
var ouput = document.getElementById('output');
var bx = buffer.getContext('2d');
var ox = output.getContext('2d');

var faceCanvas = document.createElement('canvas');
faceCanvas.width = vid.width;
faceCanvas.height = vid.height;

var imageObj = new Image();
var imageIndex = 0, ready = false, wasDrawing = false, shouldDraw = false, local=true;
var mapping, ctrackBG, positions, animationRequest;

var ctrack = new clm.tracker({useWebGL : true});
//ctrack.setResponseMode("cycle", ["lbp", "sobel"]);
ctrack.init(pModel);
var rgb;

var autoplay = true;
var debug = false;

if (!debug) {
  shuffle(images);
}

imageObj.onload = function() {
  imageCtx.clearRect(0, 0, imgCanvasEl.width, imgCanvasEl.height);
  var w = imageObj.width;
  var h = imageObj.height;
  if (w > 2000) {
    w = 2000;
    var ratio = w / imageObj.width;
    h = imageObj.height * ratio;

    //redo mapping
    for (var i = 0; i < mapping.length; i ++){
      mapping[i][0] = mapping[i][0] * ratio;
      mapping[i][1] = mapping[i][1] * ratio;
    }
  }
  imgCanvasEl.width = w;
  imgCanvasEl.height = h;

  if (images[imageIndex].bw == true) {
    $('#container').css('-webkit-filter', 'grayscale(1)');
  } else {
    $('#container').css('-webkit-filter', 'none');
  }

  imageCtx.drawImage(imageObj, 0, 0, w, h);
  ready = true;

  // var coords = images[imageIndex].coords[0];
  var coords = mapping[0];
  var x = $(window).width()/2 - coords[0] * 2;
  var y = $(window).height()/2 - coords[1] * 2;

  if (debug) {
    $('h1').text(imageIndex + ': ' + images[imageIndex].name);
  }

  syncColors();

  if (!autoplay) return true;
  $('#container').
    addClass('notransition').
    css('-webkit-transform', 'none')[0].offsetHeight
  $('#container').
    removeClass('notransition').
    css({opacity: 1, '-webkit-transform': 'translateX('+x+'px) translateY('+y+'px) scale(2)'});
};

var fd = new faceDeformer();
fd.init(document.getElementById('webgl'));
var wc1 = document.getElementById('webgl').getContext('webgl')
wc1.clearColor(0,0,0,0);

function switchImage(index) {
  ready = false;
  imageObj.src = (local ? 'new_image/' : 'http://rubbernecker.s3.amazonaws.com/') + images[index].name;
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

function sendVidToCanvas() {
  ox.drawImage(vid, 0, 0, vid.width, vid.height);
  //if (rgb) {
    //tintVideo(rgb.r, rgb.g, rgb.b);
  //}
  setInterval(sendVidToCanvas, 30);
}

function drawLoop() {
  requestAnimationFrame(drawLoop);
  positions = ctrack.getCurrentPosition();

  wasDrawing = shouldDraw;
  shouldDraw = (ready === true && positions && mapping && ctrack.getScore() > .3);

  if (wasDrawing && !shouldDraw) {
    $('#webgl').hide();
    showSign();
  }

  if (!wasDrawing && shouldDraw) {
    $('#webgl').show();
    syncColors();
    hideSign();
  }

  if (shouldDraw) {
    fd.load(vid, positions, pModel);
    fd.draw(mapping);
  }

  if (debug && positions) {
    output.getContext('2d').clearRect(0, 0, output.width, output.height);
    ctrack.draw(output)
  }
}

function getImageStats(startx, starty, w, h, c) {
  var ctx = c.getContext("2d");

  var imageData = ctx.getImageData(startx, starty, w, h);
  var data = imageData.data;
  var r, g, b, avg, count=0, colorSum=0, rgb = {r: 0, g: 0, b: 0};

  for(var x = 0, len = data.length; x < len; x+=4) {
    ++ count;
    r = data[x];
    g = data[x+1];
    b = data[x+2];

    rgb.r += r;
    rgb.g += g;
    rgb.b += b;

    avg = Math.floor((r+g+b)/3);
    colorSum += avg;
  }

  rgb.r = ~~(rgb.r/count);
  rgb.g = ~~(rgb.g/count);
  rgb.b = ~~(rgb.b/count);

  rgb.brightness = Math.floor(colorSum / (w*h));
  rgb.range = Math.max(rgb.r, rgb.g, rgb.b) - Math.min(rgb.r, rgb.g, rgb.b)

  return rgb;
}

function tintVideo(r, g, b) {
  // fill offscreen buffer with the tint color
  bx.fillStyle = 'rgb(' + r + ', ' + g + ', ' + b + ')';
  bx.fillRect(0, 0, buffer.width, buffer.height);

  // destination atop makes a result with an alpha channel identical to fg, but with all pixels retaining their original color *as far as I can tell*
  bx.globalCompositeOperation = "destination-atop";
  bx.drawImage(vid, 0, 0);

  // to tint the image, draw it first
  ox.drawImage(vid, 0, 0);

  //then set the global alpha to the amound that you want to tint it, and draw the buffer directly on top of it.
  ox.globalAlpha = 0.2;
  ox.drawImage(buffer,0,0);
}

function syncColors() {
  return false;

  if (positions && local) {
    var newSaturation = '100%', newBrightness = '';

    var box = boundingBox(mapping);
    var imageStats = getImageStats(box.x, box.y, box.w, box.h, imgCanvasEl);

    faceCanvas.getContext('2d').drawImage(vid, 0, 0, vid.width, vid.height);
    box = boundingBox(positions);
    var videoStats = getImageStats(box.x, box.y, box.w, box.h, faceCanvas);

    if (imageStats.range > 0 && imageStats.range < videoStats.range) {
      newSaturation = (100 * imageStats.range / videoStats.range) + '%';
    }

    var brightnessRatio = imageStats.brightness / videoStats.brightness;
    if (brightnessRatio < .9) brightnessRatio = .9;
    if (brightnessRatio > 2) brightnessRatio = 2;

    newBrightness = (100 * brightnessRatio) + '%';


    $('#webgl').css('-webkit-filter', 'saturate('+newSaturation+') brightness('+newBrightness+')');
  } else {
    $('#webgl').css('-webkit-filter', 'none');
  }
}

function animateSign(){
  $('#sign').each(function(index){
    $(this).css({
      color: randomElement(colors),
      fontFamily: randomElement(fonts),
      textShadow: '0 0 30px ' + randomElement(colors),
      // 'text-stroke': '1px #000'// + randomElement(colors)
    });
  });
}

function showSign() {
  $('#sign').show();
  animateSignID = setInterval(animateSign, 400);
}

function hideSign() {
  $('#sign').hide();
  clearInterval(animateSignID);
}

function randomElement(a) {
 return a[Math.floor(Math.random() * a.length)];
}

function boundingBox(coordinates) {
  var w = 0, h = 0, x = 0, y = 0, x2 = 10000, y2 = 100000;

  for (var i = 0; i < coordinates.length; i ++){
    if (coordinates[i][0] > x) x = coordinates[i][0];
    if (coordinates[i][1] > y) y = coordinates[i][1];
    if (coordinates[i][0] < x2) x2 = coordinates[i][0];
    if (coordinates[i][1] < y2) y2 = coordinates[i][1];
  }

  w = x2 - x;
  h = y2 - y;

  return {w: w, h: h, x: x, y: y}

}

function shuffle(array) {
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
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

for (var i = 0; i < signText.length; i++) {
  var letter = $('<span>').text(signText[i]);
  if (signText[i] == ' ') letter.addClass('space');
  $('#sign').append(letter);
}

showSign();

if (autoplay == true) {
  var autoplayID = setInterval(function(){
    $('#container').css('opacity', 0);
    setTimeout(function(){
      nextImage();
    }, 3000)
  }, 16000);
}

if (debug) {
  $('#output, video').css({display: 'block'});
  $('#output').css({'z-index': '999'});
  $('video').css({'z-index': '998'});
}
