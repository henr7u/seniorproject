function rect(index, p, size) {
	let t = time + index * 1000; // could hash, too lazy. crude hack works

	let center = [
		p[0] + 20 * perlin(t + 1234),
		p[1] + 20 * perlin(t - 1234)];

	let angle = .15 * perlin(1.5 * t);

	function sdRotatedRect(p) {
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

	// check hover
	let cur = rectstates[index];
	let hovered = sdRotatedRect([mouse.x, mouse.y]) < 0;
	let hovert = mix(cur.t, hovered * 1, .2);
	let start = cur.start;
	if (hovered != cur.is)
		start = time;

	rectstates[index] = {
		is: hovered,
		t: hovert,
		start: start, // start of either hover or dehover
        corner: baselinecornerwidth
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

let time = 0;
function updaterects(timestamp) {
	time = timestamp * .001;

	let rects = [];
	for (let i = 0; i < allrects.length; i++)
		rects.push(rect(i, allrects[i].pos, allrects[i].size))

	rectdata = rects;

	requestAnimationFrame(updaterects);
}

requestAnimationFrame(updaterects);