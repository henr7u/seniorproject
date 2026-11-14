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

let t = 0;

const canvas = document.getElementById('canvas');
const mouse = { x: 0, y: 0, downX: 0, downY: 0, pressed: false, clicked: false };
const mouseprev = { x: 0, y: 0, downX: 0, downY: 0, pressed: false, clicked: false };

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

const boxstates = Array(1).fill(0); // change the count depending on how many are added
function box(index, p, size) {
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

    let hovered = sdRotatedRect([mouse.x, mouse.y]) < 0;
    let hovert = mix(boxstates[index], hovered * 1, .2);
    boxstates[index] = hovert;

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
        center[0], center[1],
        size[0], size[1],
        angle
    ]
}

function update(timestamp) {
    t = timestamp * .001;

    let boxes = [];
    boxes.push(box(0, [200, 200], [300, 100]));

    window.boxdata = boxes;
    requestAnimationFrame(update);
}

requestAnimationFrame(update);