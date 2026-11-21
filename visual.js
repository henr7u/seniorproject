const rectexpansion = 5;
const smoothing = .1;

function sdBox(p, center, size) {
	const d = [
		Math.abs(p[0] - center[0]) - size[0] * 0.5,
		Math.abs(p[1] - center[1]) - size[1] * 0.5
	];

	const dist = Math.hypot(
		Math.max(d[0], 0),
		Math.max(d[1], 0)
	) + Math.min(Math.max(d[0], d[1]), 0);

	return dist;
}

const rectcontainer = document.getElementById('rectcontainer');
function generaterect(obj) {
	const rect = document.createElement('div');
	rect.className = 'rect';
	rect.style.setProperty('--borcorcol', obj.color)

	const title = document.createElement('span');
	title.textContent = obj.title;
	title.className = 'recttitle';

	rect.append(title);
	rectcontainer.append(rect);

	return rect;
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

// x, y, coefficient, for start and end
function arbitrarysmoothstep(x, sx, sy, sc, ex, ey, ec) {
	let t = (x - sx) / (ex - sx);
	let g = Math.min(Math.max(t, 0), 1); // clamp 01
	return sy + (ey - sy) * (Math.pow(g, sc) / (Math.pow(g, sc) + Math.pow(1 - g, ec)));
}

function sampleONanim(rect, t) {
	// anim config
	const blinkstartT = .2;
	const blinkdur = .07;
	const blinkpause = .14;

	const stepstart = .5;
	const stepdur = .7;
	const cin = 2;
	const cout = 1.4;

	if (t < stepstart) { // blink
		if ((t > blinkstartT && t < blinkstartT + blinkdur) ||
			(t > blinkstartT + blinkpause && t < blinkstartT + blinkdur + blinkpause))
			return 0;
		return baselinecornerwidth;
	}

	let full = Math.max(rect.size[0], rect.size[1]) / 2 * CANVASDOWNSCALE;

	return mix(baselinecornerwidth, full, arbitrarysmoothstep(t, stepstart, 0, cin, stepstart + stepdur, 1, cout));

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

	// for some reason the size is doubled? im so confused
	
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

function sampleOFFanim(rect, t) {
	return mix(rect.corner, baselinecornerwidth, .13);
}

function meshrect(points, pos, rot) {
    const scale = Math.min(canvas.width, canvas.height);

    function rotate(a, b, angle) {
        const c = Math.cos(angle);
        const s = Math.sin(angle);

        return [
            c * a - s * b,
            s * a + c * b
        ];
    }

    let minX = Infinity, minY = Infinity;
    let maxX = -Infinity, maxY = -Infinity;

    for (const point of points) {
        let [x, y, z] = point;

        // Forward rotation: X -> Y -> Z
        [y, z] = rotate(y, z,  rot[0]);
        [x, z] = rotate(x, z, -rot[1]);
        [x, y] = rotate(x, y,  rot[2]);

        // Local -> world
        x += pos[0];
        y += pos[1];
        z += pos[2];

        if (z <= 0) continue;

        // Perspective projection
        const u = FOCALLENGTH * x / z;
        const v = FOCALLENGTH * y / z;

        // Canvas coordinates
        const screenX = (u * scale + canvas.width) / 2;
        const screenY = (v * scale + canvas.height) / 2;

        minX = Math.min(minX, screenX);
        minY = Math.min(minY, screenY);
        maxX = Math.max(maxX, screenX);
        maxY = Math.max(maxY, screenY);
    }

    if (minX === Infinity) return null;

    return {
        pos: [(minX + maxX) / 2, (minY + maxY) / 2],
        size: [maxX - minX, maxY - minY]
    };
}


const phi = (1 + Math.sqrt(5)) / 2;

const icoPoints = [
    [0, 1, phi], [0, 1, -phi],
    [0, -1, phi], [0, -1, -phi],
    [1, phi, 0], [1, -phi, 0],
    [-1, phi, 0], [-1, -phi, 0],
    [phi, 0, 1], [phi, 0, -1],
    [-phi, 0, 1], [-phi, 0, -1]
];

// im not writing allat 
function calculateRect(object) {
    const { pos, rot, shape } = object;

    function fromMesh(points) {
        const rect = meshrect(points, pos, rot);
        return {
            center: rect.pos,
            size: rect.size
        };
    }

    function cylinderRect(radius, halfHeight) {
        const scale = Math.min(canvas.width, canvas.height);

        function rotate(a, b, angle) {
            const c = Math.cos(angle);
            const s = Math.sin(angle);
            return [
                c * a + s * b,
                -s * a + c * b
            ];
        }

        // Cylinder axis (local Y), rotated as in meshrect
        let [ax, ay, az] = [0, 1, 0];

        [ax, ay] = rotate(ax, ay, -rot[2]);
        [ax, az] = rotate(ax, az, -rot[1]);
        [ay, az] = rotate(ay, az, -rot[0]);

        const axis = [ax, ay, az];

        // Same position convention as meshrect
        const center = [-pos[0], -pos[1], -pos[2]];

        // Detect intersection with the camera plane
        const depthRadius =
            halfHeight * Math.abs(az) +
            radius * Math.hypot(ax, ay);

        if (Math.abs(center[2]) - depthRadius <= 0) {
            return {
                center: [canvas.width / 2, canvas.height / 2],
                size: [canvas.width, canvas.height]
            };
        }

        let minX = Infinity, minY = Infinity;
        let maxX = -Infinity, maxY = -Infinity;

        // Projected extrema occur on the two circular caps
        for (const sign of [-1, 1]) {
            const d = [
                center[0] + sign * halfHeight * ax,
                center[1] + sign * halfHeight * ay,
                center[2] + sign * halfHeight * az
            ];

            // Solve extrema of X/Z and Y/Z analytically
            for (let i = 0; i < 2; i++) {
                const ai = axis[i];
                const r2 = radius * radius;

                const A = d[2] * d[2] -
                    r2 * (1 - az * az);

                const B = -2 * (
                    d[i] * d[2] + r2 * ai * az
                );

                const C = d[i] * d[i] -
                    r2 * (1 - ai * ai);

                const discriminant = Math.sqrt(
                    Math.max(0, B * B - 4 * A * C)
                );

                const bounds = [
                    (-B - discriminant) / (2 * A),
                    (-B + discriminant) / (2 * A)
                ];

                for (const value of bounds) {
                    const screen = (
                        FOCALLENGTH * value * scale +
                        (i === 0 ? canvas.width : canvas.height)
                    ) / 2;

                    if (i === 0) {
                        minX = Math.min(minX, screen);
                        maxX = Math.max(maxX, screen);
                    } else {
                        minY = Math.min(minY, screen);
                        maxY = Math.max(maxY, screen);
                    }
                }
            }
        }

        return {
            center: [(minX + maxX) / 2, (minY + maxY) / 2],
            size: [maxX - minX, maxY - minY]
        };
    }

    switch (object.object) {
        // Box: shape = [halfWidth, halfHeight, halfDepth]
        case 0: {
            const [a, b, c] = shape.map(Math.abs);
            const points = [];

            for (const x of [-a, a])
                for (const y of [-b, b])
                    for (const z of [-c, c])
                        points.push([x, y, z]);

            return fromMesh(points);
        }

        // Torus: shape = [majorRadius, minorRadius]
        case 1: {
            const R = Math.abs(shape[0]);
            const r = Math.abs(shape[1]);

            // Enclosing cylinder approximation
            return cylinderRect(R + r, r);
        }

        // Capped cylinder: shape = [radius, halfHeight]
        case 2: {
            const r = Math.abs(shape[0]);
            const h = Math.abs(shape[1]);

            return cylinderRect(r, h);
        }

        // Octahedron: |x| + |y| + |z| <= s
        case 3: {
            const s = Math.abs(shape[0]);

            return fromMesh([
                [ s, 0, 0], [-s, 0, 0],
                [0,  s, 0], [0, -s, 0],
                [0, 0,  s], [0, 0, -s]
            ]);
        }

        // Icosahedron: radius is the circumradius
        case 4: {
			const s = Math.abs(shape[0]) / Math.sqrt(phi + 2);
			return fromMesh(icoPoints.map(p =>
				[p[0] * s, p[1] * s, p[2] * s]
			));
        }

        default:
            throw new Error("Unknown object type: " + object.object);
    }
}

function updatevisual(t) {
	let time = t * .001;

	for (let i = 0; i < objects.length; i++) {
		let obj = objects[i];
		let currect = rects[i];

		let rect = calculateRect(obj);
		rect.size[0] += rectexpansion;
		rect.size[1] += rectexpansion;

		rect.center = [
			mix(currect.pos[0], rect.center[0], smoothing),
			mix(currect.pos[1], rect.center[1], smoothing),
			mix(currect.pos[2], rect.center[2], smoothing)
		];

		rect.size = [
			mix(currect.size[0], rect.size[0], smoothing),
			mix(currect.size[1], rect.size[1], smoothing),
			mix(currect.size[2], rect.size[2], smoothing)
		];

		syncElement(canvas, currect.element, 
			rect.center[0] - rect.size[0] / 2, rect.center[1] - rect.size[1] / 2, rect.size[0], rect.size[1]);
		
		let hovered = sdBox([mouse.x, mouse.y], rect.center, rect.size) < 0;
		let hovert = mix(currect.t, hovered * 1, objects[i].tcoef);
		let start = currect.start;
		if (hovered != currect.is)
			start = time;
		
		let rt = time - start;
		let corner = hovered ? sampleONanim(currect, rt) : sampleOFFanim(currect, rt);
		currect.element.style.setProperty('--corner', corner + 'px');

		rects[i] = { 
			element: currect.element, 
			pos: rect.center, 
			size: rect.size, 
			is: hovered, 
			t: hovert,
			start: start, 
			corner: corner 
		};
	}
	requestAnimationFrame(updatevisual);
}

// generate dom elements
for (let i = 0; i < objects.length; i++) {
	let element = generaterect(objects[i]);
	rects[i].element = element;
}

requestAnimationFrame(updatevisual);