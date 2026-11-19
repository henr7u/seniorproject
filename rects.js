function sdRotatedRect(p, center, size, angle) {
	const c = Math.cos(angle);
	const s = Math.sin(angle);

	const x = p[0] - center[0];
	const y = p[1] - center[1];

	const q = [
		c * x + s * y,
		-s * x + c * y
	];

	const d = [
		Math.abs(q[0]) - size[0] * 0.5,
		Math.abs(q[1]) - size[1] * 0.5
	];

	const dist = Math.hypot(
		Math.max(d[0], 0),
		Math.max(d[1], 0)
	) + Math.min(Math.max(d[0], d[1]), 0);

	return dist;
}


function checkHover(index, center, size, angle) {
	let cur = rectstates[index];
	let hovered = sdRotatedRect([mouse.x, mouse.y], center, size, angle) < 0;
	let hovert = mix(cur.t, hovered * 1, allrects[index].tcoef);
	let start = cur.start;
	if (hovered != cur.is)
		start = time;

	rectstates[index] = {
		is: hovered,
		t: hovert,
		start: start, // start of either hover or dehover
		corner: cur.corner
	};
}

function rect(index, p, size) {
	let t = time + index * 1000; // could hash, too lazy. crude hack works

	let center = [
		p[0] + 20 * perlin(t + 1234),
		p[1] + 20 * perlin(t - 1234)];

	let angle = .15 * perlin(1.5 * t);

	// check hover
	checkHover(index, center, size, angle);
	let hovert = rectstates[index].t;

	// update visual with hover data
	center = [
		mix(center[0], p[0], hovert),
		mix(center[1], p[1], hovert)
	];
	angle = mix(angle, 0, hovert);
	size = [
		mix(size[0], size[0] + 20 + 10 * Math.sin(2 * t), hovert), // expanding amount
		mix(size[1], size[1] + 20 + 10 * Math.sin(2 * t + .5), hovert)
	];

	return [
		index,
		center[0], center[1],
		size[0], size[1],
		angle
	]
}

function lerpAngle(a, b, t) {
  const TAU = 2 * Math.PI;
  const delta = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return ((a + delta * t) % TAU + TAU) % TAU;
}

function updatecube() {
	let rot = [
		time * .9 + .85,
		time * 1.2 - 1.2,
		time * .05 + .5
	];

	let mousemotion = [
		-mouse.y / canvas.height * 3.,
		mouse.x / canvas.width * 3.,
		((mouse.x - mouse.y) / (canvas.width + canvas.height) * 1.) // a little flair
	];

	let idle = [
		time * .3 + .85,
		time * .2 - 1.2,
		time * .01 + .5
	];

	idle[0] += mousemotion[0]; 
	idle[1] += mousemotion[1]; 
	idle[2] += mousemotion[2]; 

	let t = rectstates[rectstates.length - 1].t;
	rot = [
		lerpAngle(rot[0], idle[0], t),
		lerpAngle(rot[1], idle[1], t),
		lerpAngle(rot[2], idle[2], t)
	];

	let size = allrects[allrects.length - 1].size[0];
	size = mix(size, size + .1, t);

	cubedata = [
		allrects[allrects.length - 1].pos,
		rot,
		[size, allrects[allrects.length - 1].size[1]]
	];
}

function cuberect() {
	const scale = Math.min(canvas.width, canvas.height);

	function rotate(a, b, angle) {
		const c = Math.cos(angle);
		const s = Math.sin(angle);

		return [
			c * a + s * b,
			-s * a + c * b
		];
	}

	let pos = cubedata[0];
	let rot = cubedata[1];
	let size = cubedata[2][0];
	let focalLength = cubedata[2][1];

	let minX = Infinity; let minY = Infinity;
	let maxX = -Infinity; let maxY = -Infinity;

	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			for (const sz of [-1, 1]) {
				let x = sx * size;
				let y = sy * size;
				let z = sz * size;

				// Inverse of the third rotation (YZ)
				[x, y] = rotate(x, y, -rot[2]);

				// Inverse of the second rotation (YZ)
				[x, z] = rotate(x, z, -rot[1]);

				// Inverse of the first rotation (XZ)
				[y, z] = rotate(y, z, -rot[0]);

				// World position relative to ray origin
				x -= pos[0];
				y -= pos[1];
				z -= pos[2];

				// Perspective projection:
				// rd = normalize(vec3(uv, focalLength))

				const u = focalLength * x / z;
				const v = focalLength * y / z;

				// Inverse of:
				// uv = (2 * fragCoord - resolution) / scale
				const screenX = (u * scale + canvas.width) / 2;
				const screenY = (v * scale + canvas.height) / 2;

				minX = Math.min(minX, screenX); minY = Math.min(minY, screenY); 
				maxX = Math.max(maxX, screenX); maxY = Math.max(maxY, screenY); 
			}
		}
	}

	return [
		allrects.length - 1,
		(minX + maxX) / 2, (minY + maxY) / 2,
		maxX - minX, maxY - minY,
		0
	];
}

let time = 0;
function updaterects(timestamp) {
	time = timestamp * .001;

	let rects = [];
	for (let i = 0; i < allrects.length - 1; i++)
		rects.push(rect(i, allrects[i].pos, allrects[i].size))

	updatecube();
	let cr = cuberect();
	rects.push(cr);
	
	checkHover(allrects.length - 1, [cr[1], cr[2]], [cr[3], cr[4]], 0);

	rectdata = rects;

	requestAnimationFrame(updaterects);
}

requestAnimationFrame(updaterects);