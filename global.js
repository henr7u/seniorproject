// is this bad practice? probably. but im not a professional lol

// global vars
const allrects = [
	{
		title: 'Product',
		desc: 'What did I make? Click to learn more!',
		pos: [300, 400],
		size: [200, 100],
		tcoef: .2,
		color: '#ffff00',
		content: 'something?'
	},
	{
		title: 'What is this?',
		desc: 'This website looks very strange. What is this? Click here to find out!',
		pos: [600, 400],
		size: [200, 100],
		tcoef: .2,
		color: '#00ff00',
		content: 'something?'
	},
	{ // the CUBE
		title: 'Henry Yu\'s Senior Project Porfolio',
		desc: 'Welcome to my project portfolio! Click here to learn about my senior project!',
		pos: [-2, 0, 6], // camera position
		size: [.65, 2], // size of cube and then the perspective coef
		tcoef: .05,
		color: '#ff0000',
		content: 'Over the 2026 summer, I worked with a few grad students from the University of Maryland\'s Perception and Robotics Group to make a large event camera dataset for their machine learning research. Learn more about event cameras in the "What is this?" section. I built a simulator for these cameras directly into rendering process of the Unity game engine, allowing for significantly better performance and quality compared to alternative simulators that use preprocessed videos as inputs. The simulator, aptly named "DVSim" from the real sensor\'s alternative name "Dynamic Vision Sensor", was made mostly for the specific project of the grad students, but was programmed in such a way that it can easily be extended to general event-vision data generation purposes. Being a digital program, my simulator can make lots of synthetic event data that would otherwise be costly to capture in the real world, all without human input past the initial scene setup process. '
	}
]

const baselinecornerwidth = 15;
const perspective = 2;
const CANVASDOWNSCALE = 5;

var rectdata = [];
var cubedata = [allrects[allrects.length - 1].pos, [0,0,0], allrects[allrects.length - 1].size[0]];
// position, rotation, size, perspective coef 

var rectstates = Array(allrects.length).fill(
	{ is: false, t: 0, start: -1, corner: baselinecornerwidth }
); // change the count depending on how many are added

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
