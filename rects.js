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

function rect(index, p, size) {
	let t = time + index * 1000; // could hash, too lazy. crude hack works

	let center = [
		p[0] + 20 * perlin(t + 1234),
		p[1] + 20 * perlin(t - 1234)];

	let angle = .15 * perlin(1.5 * t);

	// check hover
	let cur = rectstates[index];
	let hovered = sdRotatedRect([mouse.x, mouse.y], center, size, angle) < 0;
	let hovert = mix(cur.t, hovered * 1, .2);
	let start = cur.start;
	if (hovered != cur.is)
		start = time;

	rectstates[index] = {
		is: hovered,
		t: hovert,
		start: start, // start of either hover or dehover
		corner: cur.corner
	};

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

function updatecube() {
	let rot = [
		time * 1.7 + .85,
		time * 2.4 - 1.2,
		0
	];

	cubedata = [
		allrects[allrects.length - 1].pos,
		rot,
		allrects[allrects.length - 1].size
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
	let size = cubedata[2];
	let focalLength = allrects[allrects.length - 1].size[1];

	let minX = Infinity; let minY = Infinity;
	let maxX = -Infinity; let maxY = -Infinity;

	for (const sx of [-1, 1]) {
		for (const sy of [-1, 1]) {
			for (const sz of [-1, 1]) {
				let x = sx * size;
				let y = sy * size;
				let z = sz * size;

				// Inverse of the third rotation (YZ)
				[y, z] = rotate(y, z, -rot.yz2);

				// Inverse of the second rotation (YZ)
				[y, z] = rotate(y, z, -rot.yz1);

				// Inverse of the first rotation (XZ)
				[x, z] = rotate(x, z, -rot.xz);

				// World position relative to ray origin
				x -= pos.x;
				y -= pos.y;
				z -= pos.z;

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
		allrects.length,
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
	rects.push(cuberect());

	rectdata = rects;

	requestAnimationFrame(updaterects);
}

requestAnimationFrame(updaterects);