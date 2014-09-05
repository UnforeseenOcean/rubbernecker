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

var adjustedBrightness = 1, adjustedSaturation = 1, adjustedHue = 1;
var adjustedBlue = 1, adjustedRed = 1, adjustedGreen = 1;

var ctrack = new clm.tracker({useWebGL : true});
//ctrack.setResponseMode("cycle", ["lbp", "sobel"]);
ctrack.init(pModel);
var rgb;

var autoplay = true;
var debug = true;
var censored = true;

var fd = new faceDeformer();
fd.init(document.getElementById('webgl'));
var wc1 = document.getElementById('webgl').getContext('webgl')
wc1.clearColor(0,0,0,0);

if (censored) {
  for (var i = images.length - 1; i >= 0; i --) {
    var shouldCensor = false;
    for (var j = 0; j < images[i].tags.length; j++) {
      if (images[i].tags[j] == 'censored') shouldCensor = true;
    }
    if (shouldCensor) images.splice(i, 1);
  }
}

//if (!debug) {
  //shuffle(images);
//}

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

  //if (images[imageIndex].bw == true) {
    //$('#container').css('-webkit-filter', 'grayscale(1)');
  //} else {
    //$('#container').css('-webkit-filter', 'none');
  //}

  imageCtx.drawImage(imageObj, 0, 0, w, h);
  ready = true;

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

function prevImage() {
  imageIndex --;
  if (imageIndex < 0) imageIndex = images.length - 1;
  switchImage(imageIndex);
}


function startVideo() {
  switchImage(0);
  // start video
  vid.play();
  // start tracking
  ctrack.start(vid);
  // start loop to draw face
  drawLoop();
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
    fd.draw(mapping, adjustedBrightness, adjustedSaturation, adjustedRed, adjustedGreen, adjustedBlue);
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
  rgb.max = Math.max(rgb.r, rgb.g, rgb.b);
  rgb.min = Math.min(rgb.r, rgb.g, rgb.b);
  rgb.range = rgb.max - rgb.min

  var hsv = rgb2hsv(rgb.r, rgb.g, rgb.b);
  rgb.h = hsv.h;
  rgb.s = hsv.s;
  rgb.v = hsv.v;

  return rgb;
}

function syncColors() {
  if (positions && local) {
    var box = boundingBox(mapping);
    var imageStats = getImageStats(box.x, box.y, box.w, box.h, imgCanvasEl);

    faceCanvas.getContext('2d').drawImage(vid, 0, 0, vid.width, vid.height);
    box = boundingBox(positions);
    var videoStats = getImageStats(box.x, box.y, box.w, box.h, faceCanvas);

    if (imageStats.s < videoStats.s) {
      adjustedSaturation = images[imageIndex].bw ? 0 : imageStats.s / videoStats.s;
    } else {
      adjustedSaturation = 1;
    }

    var brightnessRatio = imageStats.brightness / videoStats.brightness;
    if (brightnessRatio < .7) brightnessRatio = .7;

    adjustedBrightness = brightnessRatio;

    adjustedRed = imageStats.r / videoStats.r;
    adjustedGreen = imageStats.g / videoStats.g;
    adjustedBlue = imageStats.b / videoStats.b;
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

function rgb2hsv () {
  var rr, gg, bb,
  r = arguments[0] / 255,
  g = arguments[1] / 255,
  b = arguments[2] / 255,
  h, s,
  v = Math.max(r, g, b),
  diff = v - Math.min(r, g, b),
  diffc = function(c){
    return (v - c) / 6 / diff + 1 / 2;
  };

  if (diff == 0) {
    h = s = 0;
  } else {
    s = diff / v;
    rr = diffc(r);
    gg = diffc(g);
    bb = diffc(b);

    if (r === v) {
      h = bb - gg;
    }else if (g === v) {
      h = (1 / 3) + rr - bb;
    }else if (b === v) {
      h = (2 / 3) + gg - rr;
    }
    if (h < 0) {
      h += 1;
    }else if (h > 1) {
      h -= 1;
    }
  }
  return {
    h: Math.round(h * 360),
    s: Math.round(s * 100),
    v: Math.round(v * 100)
  };
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
