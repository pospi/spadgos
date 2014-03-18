/**
 * Spadgos!
 * 	Why not just hose the poodle?
 * 	Looks like a bus with a tail.
 *
 * @author  Sam Pospischil <pospi@spadgos.com>
 * @author	Bezier math was taken from some very, very old AS2 code I found on my hard drive; author(s) unknown.
 *         	If you recognise bits of this code, tell me! :p Credit where it's due and all that.
 */

var SPADGOS = {
	BG_COLOR : '#41434B',
	DEFAULT_BG_COLOR : '#41434B',

	FPS_BASELINE : 1000 / 60,
	IMG_FLOWER_HEAD : 'flower-head.png',

	SPERMBORDER : 70,			// twice pixel-width of border to stay inside
	SPERMS : 20,				// number of sperms to swim around. only applies before activating the party

	SPERM_SPEED_MIN : 0.07,
	SPERM_SPEED_MAX : 0.38,
	PARTYSPEEDSCALE : 2.8,
	TAIL_BITS_MIN : 11,
	TAIL_BITS_MAX : 19,
	TAIL_COMPRESSION_MIN : 0.97,
	TAIL_COMPRESSION_MAX : 0.985,

	SPERMCOLOR : [173,173,173],
	TAILWIDTH : 3				// pixel width
};

(function() {

var DEGREES_TO_RADIANS = 0.01745329;

// we need this for efficient window watching
function debounce(func, threshold, execAsap)
{
	var timeout;

	return function debounced() {
		var obj = this, args = arguments;
		function delayed () {
			if (!execAsap)
				func.apply(obj, args);
			timeout = null;
		};

		if (timeout)
			clearTimeout(timeout);
		else if (execAsap)
			func.apply(obj, args);

		timeout = setTimeout(delayed, threshold || 300);
	};
}

//------------------------------------------------------------------------------
// CANVAS INTERFACE
//------------------------------------------------------------------------------

function Stage(canvasEl, renderLoop)
{
	// abort if not supported
	if (!canvasEl.getContext) {
		return;
	}

	this.dom = canvasEl;
	this.onResize();	// get initial size

	// init the js Canvas
	this.context = canvasEl.getContext('2d');
	this.initDrawingArgs();

	// listen for window resize events
	this.watchResize();

	// begin animation
	this.setAnimLoop(renderLoop, canvasEl);
};

Stage.prototype.initDrawingArgs = function()
{
	this.context.lineWidth = SPADGOS.TAILWIDTH;
	this.context.lineJoin = "round";
	this.context.lineCap = "round";
};

Stage.prototype.watchResize = function()
{
	var self = this,
		cb = debounce(function(e) {
				self.onResize();
				self.initDrawingArgs();
			});

	this.backupResizeEvt = window.onresize;

	window.onresize = function(e) {
		if (self.backupResizeEvt) {
			self.backupResizeEvt.apply(this, arguments);
		}
		cb.apply(this, arguments);
	};
};

Stage.prototype.clear = function()
{
	var oldFill = this.context.fillStyle;

	this.context.fillStyle = SPADGOS.BG_COLOR;
	this.context.fillRect(0, 0, this.width, this.height);

	this.context.fillStyle = oldFill;
};

Stage.prototype.onResize = function()
{
	this.dom.width = this.dom.parentNode.clientWidth;
	this.dom.height = this.dom.parentNode.clientHeight;
	this.width = this.dom.clientWidth;
	this.height = this.dom.clientHeight;

	if (!THE_SPERMS.length) {
		return;
	}

	var sx = 0.5 * this.width,
		sy = 0.5 * this.height,
		boxheight = this.height - SPADGOS.SPERMBORDER,
		boxwidth = this.width - SPADGOS.SPERMBORDER,
		i = 0;

	while (i < SPADGOS.SPERMS) {
		THE_SPERMS[i]._x = this.width * Math.random();
		THE_SPERMS[i]._y = this.height * Math.random();
		THE_SPERMS[i].bezierPath(boxwidth, boxheight, 20, 20, 20);
		++i;
	}
};

// animation mainloop (requestAnimationFrame with setTimeout fallback)

Stage.prototype.setAnimLoop = function(render, element)
{
	var running,
		lastFrame = +new Date;

	this.runLoop = function(now)
	{
		var deltaT,
			self = this,
			now = +new Date,
			run = function() {
				self.runLoop();
			};

		if (running !== false) {
			self.frameId = Stage.animMethod.call(window, run, element);

			deltaT = now - lastFrame;
			if (deltaT < SPADGOS.FPS_BASELINE) {
				return;	// don't run if framerate is smaller than our baseline
			}

			running = render.call(this, deltaT, now);
			lastFrame = now;
		}
	};
};

// cleanup

Stage.prototype.destruct = function()
{
	this.context = null;
	this.dom = null;
	window.onresize = this.backupResizeEvt;

	Stage.cancelMethod.call(window, this.frameId);
};

// feature testing

Stage.animMethod =	window.requestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					function(/* function */ callback, /* DOMElement */ element){
						return window.setTimeout(callback, 1000 / SPADGOS.FPS_BASELINE);
					};
Stage.cancelMethod = window.cancelAnimationFrame ||
					window.mozCancelRequestAnimationFrame ||
					window.webkitCancelRequestAnimationFrame ||
					window.msCancelRequestAnimationFrame ||
					window.oCancelRequestAnimationFrame ||
					clearTimeout;

//------------------------------------------------------------------------------
// BEZIER MATH (blegh)
//------------------------------------------------------------------------------

var bez = {};

bez.bezierQuadratic = function(t, a, b, c)
{
	return ((1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c);
};
bez.bezierControl = function(t1, t2, a, b, c)
{
	return (a + (t1 + t2) * (b - a) + t1 * t2 * (c - 2 * b + a));
};
bez.bezierAngle = function(t)
{
	return (Math.atan2(bez.bezierDerivative(t, this.y1, this.y2, this.y3), bez.bezierDerivative(t, this.x1, this.x2, this.x3)));
};
bez.bezierDerivative = function(t, a, b, c)
{
	return (2 * a * (t - 1) + 2 * b * (1 - 2 * t) + 2 * c * t);
};
bez.bezierSegment = function(t1, t2)
{
	this.bx1 = bez.bezierQuadratic.call(this, t1, this.x1, this.x2, this.x3);
	this.by1 = bez.bezierQuadratic.call(this, t1, this.y1, this.y2, this.y3);
	this.bx3 = bez.bezierQuadratic.call(this, t2, this.x1, this.x2, this.x3);
	this.by3 = bez.bezierQuadratic.call(this, t2, this.y1, this.y2, this.y3);
	this.bx2 = bez.bezierControl.call(this, t1, t2, this.x1, this.x2, this.x3);
	this.by2 = bez.bezierControl.call(this, t1, t2, this.y1, this.y2, this.y3);
};
bez.setBezierPoints = function(x1, y1, x2, y2, x3, y3)
{
	this.x1 = x1;
	this.y1 = y1;
	this.x2 = x2;
	this.y2 = y2;
	this.x3 = x3;
	this.y3 = y3;
};

//------------------------------------------------------------------------------
// SPERM TAILS
//------------------------------------------------------------------------------

function tail(canvas)
{
	var i, opt;

	this.canvas = canvas;
	this.context = canvas.context;

	this.bits =			15;
	this.comp =			0.98;
	this.a =			[];
	this.r =			[8];	// == largo
	this.x =			[0];
	this.y =			[0];
	this.mx =			[];
	this.my =			[];
	this.speed =		0.1;
	this.ang =			360 * Math.random();
	this._x =			this.canvas.width * Math.random();
	this._y =			this.canvas.height * Math.random();
	this.phase = 		6.283185 * Math.random();
	this.t = 			Math.random();
	this.fr = 			0;

	SPADGOS.randomiseSperm(this);

	this.color =		colorHex(SPADGOS.SPERMCOLOR);
	this.spriteImage =	SPADGOS.flowerHead;

	var i = 1;

	while (i < this.bits) {
		this.r[i] = this.r[i - 1] * this.comp;
		++i;
	}
}

tail.prototype.modulate = function(timeScale)
{
	var i = 1;

	while (i <= this.bits) {
		var deltax = ((this.x[i] || 0) - this.x[i - 1]) * timeScale;
		var deltay = ((this.y[i] || 0) - this.y[i - 1]) * timeScale;
		this.a[i] = Math.atan2(deltay, deltax);
		this.x[i] = this.x[i - 1] + this.r[i - 1] * Math.cos(this.a[i - 1]);
		this.y[i] = this.y[i - 1] + this.r[i - 1] * Math.sin(this.a[i - 1]);
		this.mx[i] = 0.5000000 * (this.x[i - 1] + this.x[i]);
		this.my[i] = 0.5000000 * (this.y[i - 1] + this.y[i]);
		++i;
	}
};

tail.prototype.drawCurve = function()
{
	this.context.strokeStyle = this.color

	this.context.moveTo(this._x + this.x[0], this._y + this.y[0]);
	this.context.beginPath();

	for (var i = 2; i < this.bits; i++) {
		this.context.quadraticCurveTo(this._x + this.x[i - 1], this._y + this.y[i - 1], this._x + this.mx[i], this._y + this.my[i]);
	}
	this.context.stroke();
};

tail.prototype.bezierPath = function(boxw, boxh, jump, fangle, vangle)
{
	var x1, y1, x2, y2, x3, y3, x4, y4, x4z, y4z, angle, anglez, r, q, k,
		xpos = this._x,
		ypos = this._y,
		totalH = this.canvas.height,
		totalW = this.canvas.width,
		top = (totalH - boxh) / 2,
		bottom = totalH - ((totalH - boxh) / 2),
		left = (totalW - boxw) / 2,
		right = totalW - ((totalW - boxw) / 2);

	angle = 360 * Math.random();
	r = jump + jump * (Math.random() - 0.5);
	(x2 = xpos + r * Math.cos(angle * DEGREES_TO_RADIANS), y2 = ypos + r * Math.sin(angle * DEGREES_TO_RADIANS));
	angle = angle + (Math.floor(Math.random() * 2) ? (1) : (-1)) * (90 + 90 * (Math.random() - 0.5));
	r = jump + jump * (Math.random() - 0.5);
	(x4 = x2 + r * Math.cos(angle * DEGREES_TO_RADIANS), y4 = y2 + r * Math.sin(angle * DEGREES_TO_RADIANS), x3 = 0.5 * (x2 + x4), y3 = 0.5 * (y2 + y4));

	bez.setBezierPoints.call(this, xpos, ypos, x2, y2, x3, y3);

	this.onRenderFrame = function(deltaTime)
	{
		var k = 0,
			loopCount = 0;

		bez.bezierSegment.call(this, 0, this.t);

		this._x = this.bx3;
		this._y = this.by3;
		this.a[0] = bez.bezierAngle.call(this, this.t) + 0.1570796 * Math.cos(this.phase + 30 * this.fr++ * DEGREES_TO_RADIANS) + Math.PI;

		this.modulate(deltaTime / SPADGOS.FPS_BASELINE);
		this.drawCurve();

		this.t = this.t + this.speed;
		if (this.t >= 1) {
			r = jump + jump * (Math.random() - 0.5);
			anglez = angle + (Math.floor(Math.random() * 2) ? (1) : (-1)) * (fangle + 2 * vangle * (Math.random() - 0.5));

			do {
				anglez = anglez + 15 * k++ * Math.pow(-1, k);
				x4z = x4 + r * Math.cos(anglez * DEGREES_TO_RADIANS);
				y4z = y4 + r * Math.sin(anglez * DEGREES_TO_RADIANS);
				loopCount++;
			} while ((x4z < left || x4z > right || y4z < top || y4z > bottom) && loopCount < 100)

			angle = anglez;
			(x1 = x3, y1 = y3, x2 = x4, y2 = y4, x4 = x4z, y4 = y4z, x3 = 0.5 * (x2 + x4), y3 = 0.5 * (y2 + y4));
			this.t = this.speed;

			bez.setBezierPoints.call(this, x1, y1, x2, y2, x3, y3);
		}

		// render graphic
		this.context.save();

		this.context.translate(this._x, this._y);
		this.context.rotate(Math.atan2(this.y[1], this.x[1]) - 90 * DEGREES_TO_RADIANS);
		this.context.drawImage(this.spriteImage, -20, -32);

		this.context.restore();
	};
};

/***********************************************************************************************************************************************
 * Spadgos party because yes.
 ***********************************************************************************************************************************************/

var HAS_PARTIED_LIKE_ITS_1984 = false,
	PARTYING = false,

	MIN_PARTY_SPERMS = 5,
	MAX_PARTY_SPERMS = 50,
	NEW_PARTY_PROB = 0.15,
	NEW_PARTY_TIMEOUT = 3 * 1000,

	// https://gist.github.com/maxogden/844879 great job!
	PARTY_COLORS = [[203,51,1], [255,0,102], [255,102,102],
					[254,255,153], [255,255,103],
					[204,255,102], [153,254,0],
					[236,142,237], [255,153,203],
					[254,52,154], [204,153,254],
					[101,153,255], [3,205,255], [255,255,255]],

	theParty = null,
	PARTY_SPRITES = {},		// tinted for each colour above
	spriteData;				// original grey tint

//------------------------------------------------------------------------------
// TINT IMAGERY
// http://www.playmycode.com/blog/2011/06/realtime-image-tinting-on-html5-canvas/
//------------------------------------------------------------------------------

function getImageChannels( img )
{
	var w = img.width;
	var h = img.height;
	var rgbks = [];

	var canvas = document.createElement("canvas");
	canvas.width = w;
	canvas.height = h;

	var ctx = canvas.getContext("2d");
	ctx.drawImage( img, 0, 0 );

	var pixels = ctx.getImageData( 0, 0, w, h ).data;

	// 4 is used to ask for 3 images: red, green, blue and
	// black in that order.
	for ( var rgbI = 0; rgbI < 4; rgbI++ ) {
		var canvas = document.createElement("canvas");
		canvas.width  = w;
		canvas.height = h;

		var ctx = canvas.getContext('2d');
		ctx.drawImage( img, 0, 0 );
		var to = ctx.getImageData( 0, 0, w, h );
		var toData = to.data;

		for (
				var i = 0, len = pixels.length;
				i < len;
				i += 4
		) {
			toData[i  ] = (rgbI === 0) ? pixels[i  ] : 0;
			toData[i+1] = (rgbI === 1) ? pixels[i+1] : 0;
			toData[i+2] = (rgbI === 2) ? pixels[i+2] : 0;
			toData[i+3] =                pixels[i+3]    ;
		}

		ctx.putImageData(to, 0, 0);

		// image is _slightly_ faster then canvas for this, so convert
		var imgComp = new Image();
		imgComp.src = canvas.toDataURL();

		rgbks.push( imgComp );
	}

	return rgbks;
}

function generateTintImage(img, rgbks, red, green, blue)
{
	var buff = document.createElement( "canvas" );
	buff.width  = img.width;
	buff.height = img.height;

	var ctx  = buff.getContext("2d");

	ctx.globalAlpha = 1;
	ctx.globalCompositeOperation = 'copy';
	ctx.drawImage( rgbks[3], 0, 0 );

	ctx.globalCompositeOperation = 'lighter';
	if ( red > 0 ) {
		ctx.globalAlpha = red   / 255.0;
		ctx.drawImage( rgbks[0], 0, 0 );
	}
	if ( green > 0 ) {
		ctx.globalAlpha = green / 255.0;
		ctx.drawImage( rgbks[1], 0, 0 );
	}
	if ( blue > 0 ) {
		ctx.globalAlpha = blue  / 255.0;
		ctx.drawImage( rgbks[2], 0, 0 );
	}

	return buff;
}

function colorHex(color)
{
	return '#' + color[0].toString(16) + color[1].toString(16) + color[2].toString(16);
}

//------------------------------------------------------------------------------
// PARTYING interaction & UI bindings
//------------------------------------------------------------------------------

function toggleParty(e)
{
	e.preventDefault();

	if (!PARTYING) {
		partyDown();
	} else {
		partyOver();
	}
	PARTYING = !PARTYING;
}

function partyDown(e)
{
	var targets, i, target, style;

	if (!HAS_PARTIED_LIKE_ITS_1984) {
		// create tinted sprites for leaves & petals
		for (i in PARTY_COLORS) {
			color = PARTY_COLORS[i];
			PARTY_SPRITES[colorHex(color)] = generateTintImage(SPADGOS.flowerHead, spriteData, color[0], color[1], color[2]);
		}

		// done with init
		HAS_PARTIED_LIKE_ITS_1984 = true;
	}

	document.body.className = 'disco';

	theParty = setInterval(partyOn, 250);
}

var LAST_RANDOM_SPERM = 0;

// randomise sprite instance colours
function partyOn()
{
	var sperms = SPADGOS.getSperms(),
		i = 0, l = sperms.length,
		color;

	// let's randomise counts sometimes too why not
	if (Math.random() <= NEW_PARTY_PROB && ((new Date) - LAST_RANDOM_SPERM > NEW_PARTY_TIMEOUT)) {
		SPADGOS.randomiseSperms(MIN_PARTY_SPERMS, MAX_PARTY_SPERMS);
		LAST_RANDOM_SPERM = new Date;
	}

	for (; i < l; ++i) {
		color = PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];

		sperms[i].spriteImage = PARTY_SPRITES[colorHex(color)];

		color = PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)];
		sperms[i].color = colorHex(color);
	}

	// and the background
	SPADGOS.BG_COLOR = colorHex(PARTY_COLORS[Math.floor(Math.random() * PARTY_COLORS.length)]);
}

function partyOver(e)
{
	var sperms = SPADGOS.getSperms(),
		i = 0, l = sperms.length;

	document.body.className = '';

	clearInterval(theParty);

	theParty = null;
	neighboursParty = null;
	upstairsParty = null;

	// adjust sprite instance attributes back
	for (; i < l; ++i) {
		sperms[i].color = colorHex(SPADGOS.SPERMCOLOR);
		sperms[i].spriteImage = SPADGOS.flowerHead;
	}

	// reset BG as well
	SPADGOS.BG_COLOR = SPADGOS.DEFAULT_BG_COLOR;
}

/***********************************************************************************************************************************************/

// MAIN PROGRAM
//------------------------------------------------------------------------------

var OLDLOAD = window.onload,
	assetsLoaded,
	THE_SPERMS = [], canvas;

function onWindowLoad()
{
	// run other init code when first bound to DOMready

	if (OLDLOAD) {
		OLDLOAD.apply(this, arguments);
		OLDLOAD = null;
	}

	// wait until we have the resources we need before doing anything...

	if (!assetsLoaded) {
		setTimeout(onWindowLoad, 300);
		return;
	}

	THE_SPERMS = [];

	// begin the animation loop
	SPADGOS.dosperm();

	// hookup the party
	document.getElementById('party').onclick = toggleParty;
}

// provide externally to allow tinkering with the options and reiniting (;

SPADGOS.randomiseSperms = function(min, max)
{
	SPADGOS.SPERMS = min + Math.floor(Math.random() * (max - min));
	SPADGOS.dosperm();
};

SPADGOS.randomiseSperm = function(sperm)
{
	sperm.speed = SPADGOS.SPERM_SPEED_MIN + Math.floor(Math.random() * (SPADGOS.SPERM_SPEED_MAX - SPADGOS.SPERM_SPEED_MIN));
	sperm.bits = SPADGOS.TAIL_BITS_MIN + Math.floor(Math.random() * (SPADGOS.TAIL_BITS_MAX - SPADGOS.TAIL_BITS_MIN));
	sperm.comp = SPADGOS.TAIL_COMPRESSION_MIN + Math.floor(Math.random() * (SPADGOS.TAIL_COMPRESSION_MAX - SPADGOS.TAIL_COMPRESSION_MIN));

	if (PARTYING) {	// :SHONK: 'evs
		sperm.speed *= SPADGOS.PARTYSPEEDSCALE;
	}
};

SPADGOS.dosperm = function()
{
	// create canvas

	if (canvas) {
		THE_SPERMS = [];
		canvas.destruct();
	}

	canvas = new Stage(document.getElementById('draw'), function(deltaTime, currentTime) {
		var i = 0;

		this.clear();

		while (i < SPADGOS.SPERMS) {
			THE_SPERMS[i].onRenderFrame(deltaTime);
			++i;
		}
	});

	// init globals

	var sx = 0.5 * canvas.width,
		sy = 0.5 * canvas.height,
		boxheight = canvas.height - SPADGOS.SPERMBORDER,
		boxwidth = canvas.width - SPADGOS.SPERMBORDER,
		i = 0;

	// build instances

	while (i < SPADGOS.SPERMS) {
		THE_SPERMS[i] = new tail(canvas);
		THE_SPERMS[i].bezierPath(boxwidth, boxheight, 20, 20, 20);
		++i;
	}

	// begin!

	canvas.runLoop();
}

SPADGOS.getSperms = function()
{
	return THE_SPERMS;
};

// load up the flower sprite
SPADGOS.flowerHead = new Image();
SPADGOS.flowerHead.onload = function()
{
	spriteData = getImageChannels(SPADGOS.flowerHead);

	// :IMPORTANT: if you don't defer this, the data won't *quite* be ready in the Image object yet on first load
	setTimeout(function() {
		SPADGOS.flowerHead = generateTintImage(SPADGOS.flowerHead, spriteData, SPADGOS.SPERMCOLOR[0], SPADGOS.SPERMCOLOR[1], SPADGOS.SPERMCOLOR[2]);
		assetsLoaded = true;
	}, 0);
};
SPADGOS.flowerHead.src = SPADGOS.IMG_FLOWER_HEAD;

// set window load event
window.onload = onWindowLoad;

})();
