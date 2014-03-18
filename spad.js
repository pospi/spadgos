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
	SPERMS : 10,			// number of sperms to swim around
	SPERMBORDER : 70,		// twice pixel-width of border to stay inside
	SPERMCOLOR : '#ADADAD',
	TAILWIDTH : 4,
	FPS_BASELINE : 1000 / 60,
	IMG_FLOWER_HEAD : 'flower-head.png'
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
	this.context.strokeStyle = SPADGOS.SPERMCOLOR;
	this.context.lineWidth = SPADGOS.TAILWIDTH;
	this.context.lineJoin = "round";
	this.context.lineCap = "round";
};

Stage.prototype.watchResize = function()
{
	var self = this,
		RESIZE = window.onresize,
		cb = debounce(function(e) {
				self.onResize();
				self.initDrawingArgs();
			});

	window.onresize = function(e) {
		if (RESIZE) {
			RESIZE.apply(this, arguments);
		}
		cb.apply(this, arguments);
	};
};

Stage.prototype.clear = function()
{
	this.context.clearRect(0, 0, this.width, this.height);
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
		THE_SPERMS[i].bezierPath(boxwidth, boxheight, 0.1, 20, 20, 20);
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
			now = +new Date;
			run = function() {
				self.runLoop();
			};

		if (running !== false) {
			Stage.animMethod ? Stage.animMethod.call(window, run, element) : setTimeout(run, SPADGOS.FPS_BASELINE);

			deltaT = now - lastFrame;
			if (deltaT < SPADGOS.FPS_BASELINE) {
				return;	// don't run if framerate is smaller than our baseline
			}

			running = render.call(this, deltaT, now);
			lastFrame = now;
		}
	};
};

// feature testing

Stage.animMethod =	window.requestAnimationFrame ||
					window.mozRequestAnimationFrame ||
					window.webkitRequestAnimationFrame ||
					window.msRequestAnimationFrame ||
					window.oRequestAnimationFrame ||
					false;

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
	this.easing =		10;
	this.largo =		8;
	this.a =			[];
	this.r =			[8];	// == largo
	this.x =			[0];
	this.y =			[0];
	this.mx =			[];
	this.my =			[];
	this.agility =		15;
	this.speed =		5;
	this.ang =			360 * Math.random();
	this._x =			this.canvas.width * Math.random();
	this._y =			this.canvas.height * Math.random();
	this.phase = 		6.283185 * Math.random();
	this.t = 			Math.random();
	this.fr = 			0;

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
	this.context.moveTo(this._x + this.x[0], this._y + this.y[0]);
	this.context.beginPath();

	for (var i = 2; i < this.bits; i++) {
		this.context.quadraticCurveTo(this._x + this.x[i - 1], this._y + this.y[i - 1], this._x + this.mx[i], this._y + this.my[i]);
	}
	this.context.stroke();
};

tail.prototype.bezierPath = function(boxw, boxh, speed, jump, fangle, vangle)
{
	var x1, y1, x2, y2, x3, y3, x4, y4, x4z, y4z, angle, anglez, r, q, speed, k,
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

		this.t = this.t + speed;
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
			this.t = speed;

			bez.setBezierPoints.call(this, x1, y1, x2, y2, x3, y3);
		}

		// render graphic
		this.context.save();

		this.context.translate(this._x, this._y);
		this.context.rotate(Math.atan2(this.y[1], this.x[1]) - 90 * DEGREES_TO_RADIANS);
		this.context.drawImage(flowerHead, -20, -32);

		this.context.restore();
	};
};

//------------------------------------------------------------------------------
// MAIN PROGRAM
//------------------------------------------------------------------------------

var OLDLOAD = window.onload,
	flowerHead, assetsLoaded,
	THE_SPERMS = [];

// load up the flower sprite
flowerHead = new Image();
flowerHead.onload = function() {
	assetsLoaded = true;
};
flowerHead.src = SPADGOS.IMG_FLOWER_HEAD;

function loadFlowers()
{
	// run potential 3rd party init stuff

	if (OLDLOAD) {
		OLDLOAD.apply(this, arguments);
		OLDLOAD = null;
	}

	// wait until we have the resources we need before doing anything...

	if (!assetsLoaded) {
		setTimeout(loadFlowers, 300);
		return;
	}

	// create canvas

	var canvas = new Stage(document.getElementById('draw'), function(deltaTime, currentTime) {
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
		THE_SPERMS[i].bezierPath(boxwidth, boxheight, 0.1, 20, 20, 20);
		++i;
	}

	// begin!

	canvas.runLoop();
}

window.onload = loadFlowers;

})();
