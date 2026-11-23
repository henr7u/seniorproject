// is this bad practice? probably. but im not a professional lol

// global vars
var objects = [
	{ 
		title: 'Henry Yu\'s Senior Project Porfolio',
		desc: 'Welcome to my project portfolio! Click here to learn about my senior project!',
		object: 4,
		pos: [-4, 0, 6], 
		rot: [0, 0, 0],
		spin: [1.3, 1.2, .05, .85, -1.2, .5], // rate + offset
		idle: [.3, .2, .02, .1, -.2, .2], // rate + offset
		shape: [1],
		tcoef: .05,
		color: '#ff0000',
		content: 'Over the 2026 summer, I worked with a few grad students from the University of Maryland\'s Perception and Robotics Group to make a large event camera dataset for their machine learning research. Learn more about event cameras in the "What is this?" section. I built a simulator for these cameras directly into rendering process of the Unity game engine, allowing for significantly better performance and quality compared to alternative simulators that use preprocessed videos as inputs. The simulator, aptly named "DVSim" from the real sensor\'s alternative name "Dynamic Vision Sensor", was made mostly for the specific project of the grad students, but was programmed in such a way that it can easily be extended to general event-vision data generation purposes. Being a digital program, my simulator can make lots of synthetic event data that would otherwise be costly to capture in the real world, all without human input past the initial scene setup process. '
	},
	{
		title: 'Product',
		desc: 'What did I make? Click to learn more!',
		object: 0,
		pos: [3, 1, 6],
		rot: [0, 0, 0],
		spin: [.9, 1.2, .05, .85, -1.2, .5], // rate + offset
		idle: [.3, .2, .02, .1, -.2, .2], // rate + offset
		shape: [.2, .5, .2],
		tcoef: .2,
		color: '#ffff00',
		content: 'something?'
	},
	{
		title: 'What is this?',
		desc: 'Why does my website look like this? Click here to find out!',
		object: 1,
		pos: [0, 2, 10],
		rot: [0, 0, 0],
		spin: [.9, 1.2, .05, .85, -1.2, .5], // rate + offset
		idle: [.3, .2, .02, .1, -.2, .2], // rate + offset
		shape: [1, .5, 1],
		tcoef: .2,
		color: '#00ff00',
		content: 'something?'
	},
]

const baselinecornerwidth = 15;
const FOCALLENGTH = 2;
const CANVASDOWNSCALE = 4;

// temporary state storage for the on screen rectangles
var rects = Array.from({ length: objects.length}, () => (
	{ element: null, desc: null, pos: [0, 0], size: [0, 0], is: false, t: 0, start: -1,
		 corner: baselinecornerwidth, line: 0, chars: 0 }
));

const canvas = document.getElementById('canvas');
const mouse = { x: 0, y: 0, downX: 0, downY: 0, pressed: false, clicked: false };

// global helper funcs
function rotate(p, theta) {
	let s = Math.sin(theta);
	let c = Math.cos(theta);
	return [p[0] * c - p[1] * s, p[0] * s + p[1] * c];
}
function fract(x) { return x - Math.floor(x); }
function smoothstep(x) { return x * x * (3 - 2 * x) }

const rngConst = Math.random() * 1000.;
function rng(p) { return fract(Math.sin(p[1] + p[0] * 78.233 + rngConst) * 43758.5453) * 2 - 1; }
function mix(a, b, t) { return a + (b - a) * t; }
function perlin(p) {
	let f = fract(p);

	let a = rng([Math.floor(p), 1.0])
		+ rng([Math.floor(p), 2.0]) * f;

	let b = rng([Math.ceil(p), 1.0])
		+ rng([Math.ceil(p), 2.0]) * (f - 1.0);

	return mix(a, b, smoothstep(f));
}

function hashFloat(str) {
	let hash = 2166136261;
	for (let i = 0; i < str.length; i++) {
		hash ^= str.charCodeAt(i);
		hash = Math.imul(hash, 16777619);
	}
	return (hash >>> 0) / 4294967296;
}

// mouse helpers

function pointerPosition(event) {
	const rect = canvas.getBoundingClientRect();
	mouse.x = (event.clientX - rect.left) * canvas.width / rect.width;
	mouse.y = (rect.bottom - event.clientY) * canvas.height / rect.height;
}

canvas.addEventListener('pointermove', pointerPosition);
canvas.addEventListener('pointerdown', event => {
	pointerPosition(event);
	mouse.downX = mouse.x;
	mouse.downY = mouse.y;
	mouse.pressed = true;
	mouse.clicked = true;
	canvas.setPointerCapture(event.pointerId);
});
function releasePointer(event) {
	pointerPosition(event);
	mouse.pressed = false;
}
canvas.addEventListener('pointerup', releasePointer);
canvas.addEventListener('pointercancel', releasePointer);
