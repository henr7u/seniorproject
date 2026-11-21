function lerpAngle(a, b, t) {
  const TAU = 2 * Math.PI;
  const delta = ((b - a + Math.PI) % TAU + TAU) % TAU - Math.PI;
  return ((a + delta * t) % TAU + TAU) % TAU;
}

function updateobjects(timestamp) {
	let time = timestamp * .001;

	for (let i = 0; i < objects.length; i++) {
		let spin = objects[i].spin;
		let rot = [
			time * spin[0] + spin[3],
			time * spin[1] + spin[4],
			time * spin[2] + spin[5]
		];

		let mousemotion = [
			-mouse.y / canvas.height * 3.,
			mouse.x / canvas.width * 3.,
			((mouse.x - mouse.y) / (canvas.width + canvas.height) * 1.) // a little flair
		];

		let idleco = objects[i].idle;
		let idle = [
			time * idleco[0] + idleco[3] + mousemotion[0],
			time * idleco[1] + idleco[4] + mousemotion[1],
			time * idleco[2] + idleco[5] + mousemotion[2]
		];

		let t = rects[i].t;
		rot = [
			lerpAngle(rot[0], idle[0], t),
			lerpAngle(rot[1], idle[1], t),
			lerpAngle(rot[2], idle[2], t)
		];

		objects[i].rot = rot;
	}

	requestAnimationFrame(updateobjects);
}

requestAnimationFrame(updateobjects);