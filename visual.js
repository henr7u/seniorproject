var rects = []

const rectexpansion = 10;

const rectcontainer = document.getElementById('rectcontainer');
function generaterect(data) {
	const rect = document.createElement('div');
	rect.className = 'rect';
	rect.style.setProperty('--borcorcol', data.color)

	const title = document.createElement('span');
	title.textContent = data.title;
	title.className = 'recttitle';

	rect.append(title);
	rectcontainer.append(rect);

	return rect
}

function syncElement(canvas, element, x, y, width, height) {
	const rect = canvas.getBoundingClientRect();

	const scaleX = rect.width / canvas.width;
	const scaleY = rect.height / canvas.height;

	Object.assign(element.style, {
		position: "fixed",
		left: `${rect.left + x * scaleX}px`,
		bottom: `${window.innerHeight - rect.bottom + y * scaleY}px`,
		width: `${width * scaleX}px`,
		height: `${height * scaleY}px`
	});
}

// i woulda spent far too long on this tbh
function rotatedBounds(center, size, theta) {
	const [cx, cy] = center;
	const [w, h] = size;

	const corners = [
		[-w / 2, -h / 2],
		[w / 2, -h / 2],
		[w / 2, h / 2],
		[-w / 2, h / 2]
	].map(p => {
		const [x, y] = rotate(p, theta);
		return [x + cx, y + cy];
	});

	const xs = corners.map(p => p[0]);
	const ys = corners.map(p => p[1]);

	const minX = Math.min(...xs) - rectexpansion;
	const maxX = Math.max(...xs) + rectexpansion;
	const minY = Math.min(...ys) - rectexpansion;
	const maxY = Math.max(...ys) + rectexpansion;

	return {
		leftbottom: [minX, minY],
		size: [maxX - minX, maxY - minY]
	};
}

// x, y, coefficient, for start and end
function arbitrarysmoothstep(x, sx, sy, sc, ex, ey, ec) {
	let t = (x - sx) / (ex - sx);
	let g = Math.min(Math.max(t, 0), 1); // clamp 01
	return sy + (ey - sy) * (Math.pow(g, sc) / (Math.pow(g, sc) + Math.pow(1 - g, ec)));
}

function sampleONanim(data, state, bounds, t) {
	// anim config
	const blinkstartT = .05;
	const blinkdur = .07;
	const blinkpause = .14;

	const introstart = .5;
	// https://www.desmos.com/calculator/eiys5rhpk4
	const startto = .2; // percent
	const starttoT = .5; // time till startto
	const inter = 1; // transition time;
	const snapat = .8; // percent
	const snapdoneT = .4;
	const startsc = 2;
	const startec = 1.4;
	const snapsc = 1.5;
	const snapec = 2.2;	
	
	if (t < introstart) { // blink
		if ((t > blinkstartT && t < blinkstartT + blinkdur) ||
			(t > blinkstartT + blinkpause && t < blinkstartT + blinkdur + blinkpause))
			return 0;
		return baselinecornerwidth;
	}

	// for some reason the size is doubled? im so confused
	let full = Math.max(bounds.size[0], bounds.size[1]) / 4;
	
	// 3 piece piecewise
	let per = 0;
	if (t >= introstart && t < introstart + starttoT) { // start ramp 
		per = arbitrarysmoothstep(t, introstart, 0, startsc, 
			introstart + starttoT, startto, startec
		);
	}
	let snappedt = introstart + starttoT + inter;
	if (t >= introstart + starttoT && t < snappedt) {
		per = mix((t - (introstart + starttoT)) / inter, startto, snapat);
	}
	if (t >= snappedt && t < snappedt + snapdoneT) {
		per = arbitrarysmoothstep(t, snappedt, snapat, snapsc,
			snappedt + snapdoneT, 1, snapec
		);
	}
	if (t >= snappedt + snapdoneT) {
		per = 1;
	}

	return mix(baselinecornerwidth, full, per);
}

function sampleOFFanim(data, state, t) {
	return baselinecornerwidth;
}

function updaterect(i, r, data, state) {
	// scale
	const bounds = rotatedBounds([data[1], data[2]], [data[3], data[4]], data[5])

	syncElement(canvas, r, bounds.leftbottom[0], bounds.leftbottom[1], bounds.size[0], bounds.size[1]);

	let rt = time - state.start;
	let corner = state.is ? sampleONanim(data, state, bounds, rt) : sampleOFFanim(data, state, bounds, rt);
	rectstates[i].corner = corner;
	r.style.setProperty('--corner', corner + 'px');
}

function updatedrawer() {
	state = rectstates;

	for (let i = 0; i < rects.length; i++)
		updaterect(i, rects[i], rectdata[i], state[i]);

	requestAnimationFrame(updatedrawer);
}

for (let i = 0; i < allrects.length; i++) {
	let newrect = generaterect(allrects[i]);
	rects.push(newrect);
}
requestAnimationFrame(updatedrawer);