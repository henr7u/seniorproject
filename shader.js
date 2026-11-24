
async function loadShader(path) {
	const response = await fetch(path);
	if (!response.ok) {
		throw new Error(`Failed to load ${path}: ${response.status}`);
	}
	return response.text();
}

function pad3(list) {
	while (list.length < 3) list.push(0);
	return list
}

function getObjectData() {
	return objects.map(o => [
		o.object, o.pos, o.rot, pad3(o.shape)
	]).flat(Infinity);
}

async function main() {
	const canvas = document.getElementById('canvas');
	if (!canvas) throw new Error('Canvas #canvas not found');

	const gl = canvas.getContext('webgl2', {
		alpha: false,
		antialias: false,
		depth: false,
		stencil: false
	});

	if (!gl) throw new Error('WebGL2 is not supported');

	const [vertexSource, baseSource, bufferSource, imageSource] =
		await Promise.all([
			loadShader('./vert.glsl'),
			loadShader('./base.glsl'),
			loadShader('./dvs.glsl'),
			loadShader('./frag.glsl')
		]);

	function compile(type, source) {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);

		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			const log = gl.getShaderInfoLog(shader);
			gl.deleteShader(shader);
			throw new Error(`Shader compilation failed:\n${log}`);
		}

		return shader;
	}

	function makePass(fragmentSource) {
		const vs = compile(gl.VERTEX_SHADER, vertexSource);
		const fs = compile(gl.FRAGMENT_SHADER, fragmentSource);

		const program = gl.createProgram();
		gl.attachShader(program, vs);
		gl.attachShader(program, fs);
		gl.linkProgram(program);

		gl.deleteShader(vs);
		gl.deleteShader(fs);

		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
			const log = gl.getProgramInfoLog(program);
			gl.deleteProgram(program);
			throw new Error(`Program linking failed:\n${log}`);
		}

		const uniform = name => gl.getUniformLocation(program, name);

		return {
			program,
			position: gl.getAttribLocation(program, 'a_position'),
			resolution: uniform('iResolution'),
			time: uniform('iTime'),
			delta: uniform('iTimeDelta'),
			frameRate: uniform('iFrameRate'),
			frame: uniform('iFrame'),
			mouse: uniform('iMouse'),
			mouseprev: uniform('iMousePrev'),
			channel0: uniform('iChannel0'),
			channel1: uniform('iChannel1'),
			objectdata: uniform('u_objectData'),
			focallength: uniform('u_focalLength'),
			downscale: uniform('u_downscale')
		};
	}

	const basePass = makePass(baseSource);
	const bufferPass = makePass(bufferSource);
	const imagePass = makePass(imageSource);

	const quad = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, quad);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([
			-1, -1,
			1, -1,
			-1, 1,
			-1, 1,
			1, -1,
			1, 1
		]),
		gl.STATIC_DRAW
	);

	const mouse = {
		x: 0, y: 0,
		downX: 0, downY: 0,
		pressed: false,
		clicked: false
	};

	const mouseprev = {
		x: 0, y: 0,
		downX: 0, downY: 0,
		pressed: false,
		clicked: false
	};

	function pointerPosition(event) {
		const rect = canvas.getBoundingClientRect();

		mouse.x = (event.clientX - rect.left) *
			canvas.width / rect.width;

		mouse.y = (rect.bottom - event.clientY) *
			canvas.height / rect.height;
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

	const ext = gl.getExtension('EXT_color_buffer_float');
	if (!ext) {
		throw new Error('EXT_color_buffer_float not supported');
	}

	if (gl.getParameter(gl.MAX_COMBINED_TEXTURE_IMAGE_UNITS) < 2) {
		throw new Error('At least two texture units are required');
	}

	function createTarget(width, height) {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);

		// 32-bit floating-point RGBA texture.
		gl.texImage2D(
			gl.TEXTURE_2D,
			0,
			gl.RGBA32F,
			width,
			height,
			0,
			gl.RGBA,
			gl.FLOAT,
			null
		);

		// Nearest-neighbor sampling.
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_MIN_FILTER,
			gl.NEAREST
		);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_MAG_FILTER,
			gl.NEAREST
		);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_S,
			gl.CLAMP_TO_EDGE
		);
		gl.texParameteri(
			gl.TEXTURE_2D,
			gl.TEXTURE_WRAP_T,
			gl.CLAMP_TO_EDGE
		);

		const framebuffer = gl.createFramebuffer();
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);

		gl.framebufferTexture2D(
			gl.FRAMEBUFFER,
			gl.COLOR_ATTACHMENT0,
			gl.TEXTURE_2D,
			texture,
			0
		);

		if (
			gl.checkFramebufferStatus(gl.FRAMEBUFFER) !==
			gl.FRAMEBUFFER_COMPLETE
		) {
			gl.deleteFramebuffer(framebuffer);
			gl.deleteTexture(texture);
			throw new Error('Framebuffer incomplete');
		}

		gl.viewport(0, 0, width, height);
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);

		return { texture, framebuffer };
	}

	function destroyTarget(target) {
		if (!target) return;

		gl.deleteFramebuffer(target.framebuffer);
		gl.deleteTexture(target.texture);
	}

	// Base pass has one output target.
	let baseTarget = null;

	// Buffer pass has two targets for previous-frame feedback.
	let bufferTargets = [];
	let readIndex = 0;
	let writeIndex = 1;

	let frame = 0;

	function resize() {
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const maxSize = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE));
		const width = Math.max(1, Math.min(Math.round(canvas.clientWidth * dpr / CANVASDOWNSCALE), maxSize));
		const height = Math.max(1, Math.min(Math.round(canvas.clientHeight * dpr / CANVASDOWNSCALE), maxSize));

		if (canvas.width === width && canvas.height === height && baseTarget !== null && bufferTargets.length === 2) return;

		canvas.width = width;
		canvas.height = height;

		destroyTarget(baseTarget);
		bufferTargets.forEach(destroyTarget);

		baseTarget = createTarget(width, height);
		bufferTargets = [createTarget(width, height), createTarget(width, height)];

		readIndex = 0;
		writeIndex = 1;

		// Feedback state was reset.
		frame = 0;
	}

	window.addEventListener('resize', resize);
	resize();

	function draw(pass, framebuffer, input0, input1, time, delta) {
		gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.useProgram(pass.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);

		if (pass.position >= 0) {
			gl.enableVertexAttribArray(pass.position);
			gl.vertexAttribPointer(pass.position, 2, gl.FLOAT, false, 0, 0);
		}

		// Common uniforms.
		gl.uniform3f(pass.resolution, canvas.width, canvas.height, 1);
		gl.uniform1f(pass.time, time);
		gl.uniform1f(pass.delta, delta);
		gl.uniform1f(pass.frameRate, delta > 0 ? 1 / delta : 0);
		gl.uniform1i(pass.frame, frame);

		gl.uniform4f(pass.mouse, mouse.x, mouse.y,
			mouse.clicked ? (mouse.pressed ? mouse.downX : -mouse.downX) : 0,
			mouse.clicked ? (mouse.pressed ? mouse.downY : -mouse.downY) : 0
		);

		gl.uniform4f(pass.mouseprev, mouseprev.x, mouseprev.y,
			mouseprev.clicked ? (mouseprev.pressed ? mouseprev.downX : -mouseprev.downX) : 0,
			mouseprev.clicked ? (mouseprev.pressed ? mouseprev.downY : -mouseprev.downY) : 0
		);

		gl.uniform1fv(pass.objectdata, getObjectData());
		gl.uniform1f(pass.focallength, FOCALLENGTH);
		gl.uniform1i(pass.downscale, CANVASDOWNSCALE);

		// iChannel0
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, input0);
		gl.uniform1i(pass.channel0, 0);

		// iChannel1
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, input1);
		gl.uniform1i(pass.channel1, 1);

		gl.drawArrays(gl.TRIANGLES, 0, 6);

		// Unbind inputs to avoid stale texture bindings.
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, null);
		gl.activeTexture(gl.TEXTURE0);
	}

	let startTime = null;
	let previousTime = null;

	function render(timestamp) {
		resize();

		if (startTime === null) {
			startTime = timestamp;
		}

		const delta = previousTime === null
			? 0
			: Math.max(0, (timestamp - previousTime) * 0.001);

		previousTime = timestamp;

		const time = (timestamp - startTime) * 0.001;

		// --------------------------------------------------
		// PASS 1: BASE
		//
		// base.glsl
		// No texture inputs.
		// Output: baseTarget.texture
		// --------------------------------------------------

		draw(
			basePass,
			baseTarget.framebuffer,
			null,
			null,
			time,
			delta
		);

		// --------------------------------------------------
		// PASS 2: BUFFER
		//
		// dvs.glsl
		// iChannel = previous buffer output
		// iChannel1 = current base output
		// Output: current buffer texture
		// --------------------------------------------------

		draw(
			bufferPass,
			bufferTargets[writeIndex].framebuffer,
			bufferTargets[readIndex].texture,
			baseTarget.texture,
			time,
			delta
		);

		// --------------------------------------------------
		// PASS 3: IMAGE
		//
		// frag.glsl
		// iChannel0 = current buffer output
		// Output: screen
		// --------------------------------------------------

		draw(
			imagePass,
			null,
			bufferTargets[writeIndex].texture,
			null,
			time,
			delta
		);

		// Update previous mouse state once per frame.
		Object.assign(mouseprev, mouse);

		// Swap buffer feedback textures.
		[readIndex, writeIndex] = [writeIndex, readIndex];

		frame++;

		requestAnimationFrame(render);
	}

	requestAnimationFrame(render);

	loaded = true;
}

main().catch(console.error);
