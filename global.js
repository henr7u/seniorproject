// is this bad practice? probably. but im not a professional lol

// global vars
const allrects = [
	{
		title: 'test',
		desc: 'testing description',
		pos: [300, 400],
		size: [200, 100],
		tcoef: .2,
		color: '#ffff00',
		content: 'something?'
	},
	{
		title: 'what is this?',
		desc: 'testing description',
		pos: [600, 400],
		size: [200, 100],
		tcoef: .2,
		color: '#00ff00',
		content: 'something?'
	},
	{ // the CUBE
		title: 'Henry Yu\'s Senior Project Porfolio',
		desc: 'testing description',
		pos: [-2, 0, 6], // camera position
		size: [.65, -2.5], // size of cube and then the perspective coef
		tcoef: .1,
		color: '#ff0000',
		content: 'something?'
	}
]

const baselinecornerwidth = 15;

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
