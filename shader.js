
"use strict";

async function loadShader(path) {
    const response = await fetch(path);

    if (!response.ok) {
        throw new Error(
            `Failed to load ${path}: ${response.status}`
        );
    }

    return response.text();
}

async function main() {
    const canvas = document.getElementById("canvas");
    if (!canvas) {
        throw new Error("Canvas #canvas not found");
    }

    const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        stencil: false
    });

    if (!gl) {
        throw new Error("WebGL is not supported");
    }

    // Load GLSL files asynchronously
    const [vertexSource, fragmentSource] = await Promise.all([
        loadShader("./vert.glsl"),
        loadShader("./frag.glsl")
    ]);

    // Simple shader for copying a texture to the screen
    const displayFragmentSource = `
        precision highp float;

        uniform sampler2D u_texture;
        uniform vec2 u_resolution;

        void main() {
            vec2 uv = gl_FragCoord.xy / u_resolution;
            gl_FragColor = texture2D(u_texture, uv);
        }
    `;

    function createShader(type, source) {
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

    function createProgram(vertex, fragment) {
        const vs = createShader(gl.VERTEX_SHADER, vertex);
        const fs = createShader(gl.FRAGMENT_SHADER, fragment);

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

        return program;
    }

    // Main feedback shader and display shader
    const program = createProgram(
        vertexSource,
        fragmentSource
    );

    const displayProgram = createProgram(
        vertexSource,
        displayFragmentSource
    );

    // Fullscreen quad: two triangles
    const vertices = new Float32Array([
        -1, -1,
         1, -1,
        -1,  1,

        -1,  1,
         1, -1,
         1,  1
    ]);

    const vertexBuffer = gl.createBuffer();

    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(
        gl.ARRAY_BUFFER,
        vertices,
        gl.STATIC_DRAW
    );

    const mouse = { x: 0, y: 0 };

    window.addEventListener("pointermove", (event) => {
        const rect = canvas.getBoundingClientRect();

        mouse.x = (event.clientX - rect.left)
            * canvas.width / rect.width;

        mouse.y = (rect.bottom - event.clientY)
            * canvas.height / rect.height;
    });

    // Uniform and attribute locations
    const main = {
        program,
        position: gl.getAttribLocation(program, "a_position"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        time: gl.getUniformLocation(program, "u_time"),
        previousFrame: gl.getUniformLocation(program, "u_previousFrame"),
        mouse: gl.getUniformLocation(program, "u_mouse")
    };

    const display = {
        program: displayProgram,
        position: gl.getAttribLocation(
            displayProgram,
            "a_position"
        ),
        resolution: gl.getUniformLocation(
            displayProgram,
            "u_resolution"
        ),
        texture: gl.getUniformLocation(
            displayProgram,
            "u_texture"
        )
    };

    function bindGeometry(position) {
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);

        gl.enableVertexAttribArray(position);

        gl.vertexAttribPointer(
            position,
            2,
            gl.FLOAT,
            false,
            0,
            0
        );
    }

    // Create a texture attached to an offscreen framebuffer
    function createBuffer(width, height) {
        const texture = gl.createTexture();

        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA,
            width,
            height,
            0,
            gl.RGBA,
            gl.UNSIGNED_BYTE,
            null
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MIN_FILTER,
            gl.LINEAR
        );

        gl.texParameteri(
            gl.TEXTURE_2D,
            gl.TEXTURE_MAG_FILTER,
            gl.LINEAR
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
            throw new Error("Framebuffer incomplete");
        }

        // Initialize texture to black
        gl.viewport(0, 0, width, height);
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.bindFramebuffer(gl.FRAMEBUFFER, null);
        gl.bindTexture(gl.TEXTURE_2D, null);

        return { texture, framebuffer };
    }

    function destroyBuffer(buffer) {
        gl.deleteFramebuffer(buffer.framebuffer);
        gl.deleteTexture(buffer.texture);
    }

    // Ping-pong framebuffers
    let buffers = [];
    let readIndex = 0;
    let writeIndex = 1;

    function resize() {
        const dpr = Math.min(
            window.devicePixelRatio || 1,
            2
        );

        const maxSize = gl.getParameter(
            gl.MAX_TEXTURE_SIZE
        );

        const width = Math.max(
            1,
            Math.min(
                Math.round(canvas.clientWidth * dpr),
                maxSize
            )
        );

        const height = Math.max(
            1,
            Math.min(
                Math.round(canvas.clientHeight * dpr),
                maxSize
            )
        );

        if (
            canvas.width === width &&
            canvas.height === height &&
            buffers.length === 2
        ) {
            return;
        }

        canvas.width = width;
        canvas.height = height;

        // Delete old buffers
        for (const buffer of buffers) {
            destroyBuffer(buffer);
        }

        // Recreate buffers at new resolution
        buffers = [
            createBuffer(width, height),
            createBuffer(width, height)
        ];

        readIndex = 0;
        writeIndex = 1;

        gl.viewport(0, 0, width, height);
    }

    window.addEventListener("resize", resize);
    resize();

    // Render feedback into the next framebuffer
    function renderFeedback(time) {
        gl.bindFramebuffer(
            gl.FRAMEBUFFER,
            buffers[writeIndex].framebuffer
        );

        gl.viewport(
            0,
            0,
            canvas.width,
            canvas.height
        );

        gl.useProgram(main.program);
        bindGeometry(main.position);

        gl.uniform2f(
            main.resolution,
            canvas.width,
            canvas.height
        );

        gl.uniform1f(main.time, time);

        gl.uniform2f(main.mouse, mouse.x, mouse.y);

        // Previous frame is texture unit 0
        gl.activeTexture(gl.TEXTURE0);

        gl.bindTexture(
            gl.TEXTURE_2D,
            buffers[readIndex].texture
        );

        gl.uniform1i(main.previousFrame, 0);

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Copy the completed frame to the visible canvas
    function drawTextureToScreen(texture) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        gl.viewport(
            0,
            0,
            canvas.width,
            canvas.height
        );

        gl.useProgram(display.program);
        bindGeometry(display.position);

        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, texture);

        gl.uniform1i(display.texture, 0);

        gl.uniform2f(
            display.resolution,
            canvas.width,
            canvas.height
        );

        gl.drawArrays(gl.TRIANGLES, 0, 6);
    }

    // Animation
    const startTime = performance.now();

    function render(timestamp) {
        resize();

        const time = (timestamp - startTime) * 0.001;

        // Pass 1: previous frame -> next frame
        renderFeedback(time);

        // Pass 2: next frame -> screen
        drawTextureToScreen(
            buffers[writeIndex].texture
        );

        // Swap read/write buffers
        [readIndex, writeIndex] = [
            writeIndex,
            readIndex
        ];

        requestAnimationFrame(render);
    }

    requestAnimationFrame(render);
}

main().catch(console.error);
