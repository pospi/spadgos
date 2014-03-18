/**
 * Spadgos!
 * 	Why not just hose the poodle?
 * 	Looks like a bus with a tail.
 *
 * @author  Sam Pospischil <pospi@spadgos.com>
 * @author	Core wiggling logic was taken from some very, very old code I found on my hard drive; author(s) unknown.
 *         	If you recognise bits of this code, tell me! :p Credit where it's due and all that.
 */

(function() {

var SPERMS = 10,			// number of sperms to swim around
	SPERMBORDER = 70,		// twice pixel-width of border to stay inside
	SPERMCOLOR = '#ADADAD',
	IMG_FLOWER_HEAD = 'img/flower-head.png',
	DEGREES_TO_RADIANS = 0.01745329;

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

		timeout = setTimeout(delayed, threshold || 100);
	};
}

//------------------------------------------------------------------------------
// CANVAS INTERFACE		(:NOTE: Flash AS2 compatible API)
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

	// listen for window resize events
	this.watchResize();

	// begin animation
	this.setAnimLoop(renderLoop, canvasEl);
};

Stage.prototype.watchResize = function()
{
	var self = this,
		RESIZE = window.onResize;

	window.onResize = debounce(function(e) {
		self.onResize();

		if (RESIZE) {
			RESIZE.apply(this, arguments);
		}
	});
};

Stage.prototype.clear = function()
{
	this.context.clearRect(0, 0, this.width, this.height);
};

Stage.prototype.onResize = function()
{
	this.width = this.dom.clientWidth;
	this.height = this.dom.clientHeight;
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
			run = function() {
				self.runLoop();
			};

		if (running !== false) {
			Stage.animMethod ? Stage.animMethod.call(window, run, element) : setTimeout(run, 1000 / 60);

			deltaT = now - lastFrame;

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
// BASE RENDERING		(:NOTE: Flash AS2 compatible API)
//------------------------------------------------------------------------------

function MovieClip(canvas)
{
	this.canvas = canvas;
}

// drawing state

MovieClip.prototype.beginFill = function(fillcolor, fillalpha)
{
	with (this.canvas.context) {
		fillStyle = fillcolor;
		beginPath();
	}
};

MovieClip.prototype.endFill = function()
{
	with (this.canvas.context) {
		fill();
	}
};

MovieClip.prototype.lineStyle = function(strokewidth, strokecolor, strokealpha)
{
	with (this.canvas.context) {
		strokeStyle = strokecolor;
		lineWidth = strokewidth;
		lineJoin = "round";
	}
};

MovieClip.prototype.moveTo = function(x, y)
{
	with (this.canvas.context) {
		moveTo(x, y);
	}
};

// drawing methods

MovieClip.prototype.lineTo = function(x, y)
{
	with (this.canvas.context) {
		beginPath();
		lineTo(x, y);
		stroke();
	}
};

MovieClip.prototype.curveTo = function(x1, y1, x2, y2)
{
	with (this.canvas.context) {
		beginPath();
		quadraticCurveTo(x1, y1, x2, y2);
		stroke();
	}
};

MovieClip.prototype.drawBoxZ = function(xpos, ypos, mywidth, myheight, strokewidth, strokecolor, strokealpha, fillcolor, fillalpha)
{
	this.beginFill(fillcolor, fillalpha);
	this.lineStyle(strokewidth, strokecolor, strokealpha);
	this.moveTo(xpos - mywidth / 2, ypos + myheight / 2);
	this.lineTo(xpos - mywidth / 2, ypos - myheight / 2);
	this.lineTo(xpos + mywidth / 2, ypos - myheight / 2);
	this.lineTo(xpos + mywidth / 2, ypos + myheight / 2);
	this.endFill();
};
MovieClip.prototype.bezierDrawZ = function(strokewidth, strokecolor, strokealpha)
{
	this.lineStyle(strokewidth, strokecolor, strokealpha);
	this.moveTo(this.bx1, this.by1);
	this.curveTo(this.bx2, this.by2, this.bx3, this.by3);
};

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
	with (this) {
		bx1 = bez.bezierQuadratic.call(this, t1, this.x1, this.x2, this.x3);
		by1 = bez.bezierQuadratic.call(this, t1, this.y1, this.y2, this.y3);
		bx3 = bez.bezierQuadratic.call(this, t2, this.x1, this.x2, this.x3);
		by3 = bez.bezierQuadratic.call(this, t2, this.y1, this.y2, this.y3);
		bx2 = bez.bezierControl.call(this, t1, t2, this.x1, this.x2, this.x3);
		by2 = bez.bezierControl.call(this, t1, t2, this.y1, this.y2, this.y3);
	}
};
bez.setBezierPoints = function(x1, y1, x2, y2, x3, y3)
{
	with (this) {
		(x1 = x1, y1 = y1, x2 = x2, y2 = y2, x3 = x3, y3 = y3);
	}
};

//------------------------------------------------------------------------------
// SPERM TAILS
//------------------------------------------------------------------------------

function tail(canvas, opts)
{
	var i, opt;

	MovieClip.call(this, canvas);

	this.phase = 6.283185 * Math.random();

	for (i in opts) {
		this[i] = opts[i];
	}
}
tail.prototype = new MovieClip();

tail.prototype.modulate = function()
{
	var i = 1;

	while (i <= this.bits) {
		var deltax = this.x[i] - this.x[i - 1];
		var deltay = this.y[i] - this.y[i - 1];
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
	this.lineStyle(this.strokewidth, this.strokecolor, this.strokealpha);
	this.moveTo(this.x[0], this.y[0]);

	for (i = 2; i < this.bits; i++) {
		this.curveTo(this.x[i - 1], this.y[i - 1], this.mx[i], this.my[i]);
	}
};

tail.prototype.bezierPath = function(xpos, ypos, boxw, boxh, speed, jump, fangle, vangle)
{
	this.fr = 0,
	this.jump = jump,
	this.fangle = fangle,
	this.vangle = vangle,
	this.x1,
	this.y1,
	this.x2,
	this.y2,
	this.x3,
	this.y3,
	this.x4,
	this.y4,
	this.x4z,
	this.y4z,
	this.angle,
	this.anglez,
	this.r,
	this.q,
	this.speed,
	this.k,
	this.top = ypos - 0.5000000 * boxh,
	this.bottom = ypos + 0.5000000 * boxh,
	this.left = xpos - 0.5000000 * boxw,
	this.right = xpos + 0.5000000 * boxw;

	this.angle = 360 * Math.random();
	this.r = jump + jump * (Math.random() - 0.5000000);
	this.x2 = xpos + this.r * Math.cos(this.angle * DEGREES_TO_RADIANS);
	this.y2 = ypos + this.r * Math.sin(this.angle * DEGREES_TO_RADIANS);

	this.angle = this.angle + (Math.random() ? 1 : -1) * (90 + 90 * (Math.random() - 0.5000000));
	this.r = this.jump + this.jump * (Math.random() - 0.5000000);
	this.x4 = this.x2 + this.r * Math.cos(this.angle * DEGREES_TO_RADIANS);
	this.y4 = this.y2 + this.r * Math.sin(this.angle * DEGREES_TO_RADIANS);
	this.x3 = 0.5000000 * (this.x2 + this.x4),
	this.y3 = 0.5000000 * (this.y2 + this.y4);

	this.t = Math.random();

	bez.setBezierPoints.call(this, xpos, ypos, this.x2, this.y2, this.x3, this.y3);
};

tail.prototype.onRenderFrame = function()
{
	// construct and draw tail
	bez.bezierSegment.call(this, 0, this.t);
	this._x = this.bx3;
	this._y = this.by3;
	this.a[0] = bez.bezierAngle.call(this, this.t) + 0.1570796 * Math.cos(this.phase + 30 * this.fr++ * DEGREES_TO_RADIANS) + 3.141593E+000;
	this.modulate();
	this.drawCurve();
	this.t = this.t + this.speed;

	if (this.t >= 1) {
		this.r = this.jump + this.jump * (Math.random() - 0.5000000);
		this.anglez = this.angle + (Math.random() ? 1 : -1) * (this.fangle + 2 * this.vangle * (Math.random() - 0.5000000));

		var k = 0,
			loopCount = 0;

		do {
			this.anglez = this.anglez + 15 * k++ * Math.pow(-1, k);
			this.x4z = this.x4 + this.r * Math.cos(this.anglez * DEGREES_TO_RADIANS);
			this.y4z = this.y4 + this.r * Math.sin(this.anglez * DEGREES_TO_RADIANS);
			loopCount++;
		} while ((this.x4z < this.left || this.x4z > this.right || this.y4z < this.top || this.y4z > this.bottom) && loopCount < 100)

		this.angle = this.anglez;
		this.x1 = this.x3;
		this.y1 = this.y3;
		this.x2 = this.x4;
		this.y2 = this.y4;
		this.x4 = this.x4z;
		this.y4 = this.y4z;
		this.x3 = 0.5000000 * (this.x2 + this.x4);
		this.y3 = 0.5000000 * (this.y2 + this.y4);
		this.t = this.speed;

		bez.setBezierPoints.call(this, this.x1, this.y1, this.x2, this.y2, this.x3, this.y3);
	}

	// :TODO: set graphic rotation
	// this.head._rotation = Math.atan2(this.y[1], this.x[1]) * 180 / Math.PI - 90;
};

//------------------------------------------------------------------------------
// MAIN PROGRAM
//------------------------------------------------------------------------------

function generateSpermOptions(canvas)
{
	var newobj = {
			bits :			15,
			comp :			0.98,
			easing :		10,
			largo :			8,
			a :				[],
			r :				[8],	// == newobj.largo
			x :				[0],
			y :				[0],
			mx :			[],
			my :			[],
			strokewidth :	4,
			strokecolor :	SPERMCOLOR,
			strokealpha :	100,
			agility :		15,
			speed :			5,
			ang :			360 * Math.random(),
			_x :			canvas.width * Math.random(),
			_y :			canvas.height * Math.random()
		},
		i = 1;

	while (i < newobj.bits) {
		newobj.r[i] = newobj.r[i - 1] * newobj.comp;
		++i;
	}

	return newobj;
}

var OLDLOAD = window.onload,
	sw, sh, sx, sy, boxheight, boxwidth, k, i;

window.onload = function()
{
	// create canvas

	var canvas = new Stage(document.getElementById('draw'), function(deltaTime, currentTime) {
		var i = 0;

		this.clear();
		while (i < SPERMS) {
			k[i].onRenderFrame();
			++i;
		}
	});

	// init globals

	sw = canvas.width;
	sh = canvas.height;
	sx = 0.5 * sw;
	sy = 0.5 * sh;
	boxheight = canvas.height - SPERMBORDER;
	boxwidth = canvas.width - SPERMBORDER;
	k = [];

	var i = 0;

	// build instances

	while (i < SPERMS) {
		k[i] = new tail(canvas, generateSpermOptions(canvas));
		k[i].bezierPath(sx, sy, boxwidth, boxheight, 0.1, 20, 20, 20);
		++i;
	}

	// begin!

	canvas.runLoop();

	// run potential 3rd party init stuff

	if (OLDLOAD) {
		OLDLOAD.apply(this, arguments);
	}
}

})();
