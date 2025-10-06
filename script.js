// this was ofc made with the help of ai
const lightFragmentShaderSource = `
#ifdef GL_ES
precision mediump float;
#endif

uniform float u_time;
uniform vec2 u_resolution;

// Function to generate pseudo-random numbers
float random(vec2 st) {
    return fract(sin(dot(st.xy,
                         vec2(12.9898,78.233)))*
        43758.5453123);
}

// Function to create a 2D noise field
float noise(vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);

    // Four corners in 2D space
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));

    // Smooth Interpolation
    vec2 u = f * f * (3.0 - 2.0 * f);

    return mix(a, b, u.x) +
            (c - a)* u.y * (1.0 - u.x) +
            (d - b) * u.x * u.y;
}

void main() {
    vec2 st = gl_FragCoord.xy / u_resolution.xy;
    st.x *= u_resolution.x / u_resolution.y; // Correct aspect ratio

    vec3 color = vec3(0.0);

    // Wave parameters
    float speed = 0.5;
    float frequency = 5.0;
    float amplitude = 0.1;
    float distortion = 0.5;

    // Create a wavy pattern using noise
    vec2 wavy_st = st;
    wavy_st.y += sin(st.x * frequency + u_time * speed) * amplitude;
    wavy_st.x += cos(st.y * frequency * 0.7 + u_time * speed * 0.8) * amplitude * 0.5;

    float n = noise(wavy_st * 10.0 + u_time * 0.1);

    // Add more layers of noise for complexity
    n += noise(wavy_st * 20.0 + u_time * 0.2) * 0.5;
    n += noise(wavy_st * 40.0 + u_time * 0.3) * 0.25;

    // Distort the noise based on time for movement
    vec2 distorted_st = st + vec2(n * distortion, n * distortion);
    float final_wave = noise(distorted_st * 15.0 + u_time * 0.5);

    // Ocean color based on wave height
    vec3 deep_blue = vec3(0.0, 0.2, 0.4);
    vec3 light_blue = vec3(0.2, 0.6, 0.8);
    vec3 foam_color = vec3(0.9, 0.95, 1.0);

    // Mix colors based on wave height
    color = mix(deep_blue, light_blue, final_wave);

    // Add foam at the peaks of the waves
    float foam_threshold = 0.8;
    float foam_intensity = smoothstep(foam_threshold - 0.1, foam_threshold + 0.1, final_wave);
    color = mix(color, foam_color, foam_intensity);

    // Add some subtle reflections/highlights
    float highlight = pow(final_wave, 5.0) * 2.0;
    color += highlight * vec3(0.8, 0.9, 1.0);

    gl_FragColor = vec4(color, 1.0);
}
`;

const darkFragmentShaderSource = `
precision mediump float;

uniform float iTime; // Time in seconds, for animation
uniform vec2 iResolution; // Viewport resolution (width, height)

// A simple hash function for pseudo-random numbers
// Source: https://www.shadertoy.com/view/4djSRW
float hash12(vec2 p) {
    vec3 p3  = fract(p.xyx * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

// Function to generate a single shooting star trail
vec3 shootingStarEffect(vec2 uv, float time, float seed) {
    vec3 color = vec3(0.0);

    // Properties for this star, derived from the seed
    float speed = 0.01 + hash12(vec2(seed, 0.1)) * 0.02; // Slower speed
    float yOffset = hash12(vec2(seed, 0.3)) * 1.5;

    // Animate the star's head position diagonally
    float starHeadX = fract(1.2 - time * speed);
    float starHeadY = fract(starHeadX + yOffset);
    vec2 starHeadPos = vec2(starHeadX, starHeadY);

    // Calculate trail length and shorten it near the edges
    float trailLength = (0.5 + hash12(vec2(seed, 0.2)) * 0.5) * smoothstep(0.0, 0.5, starHeadPos.x) * smoothstep(0.0, 0.5, starHeadPos.y);


    // Calculate the tail start position
    vec2 starTailStartPos = starHeadPos + vec2(trailLength, trailLength);

    // Calculate the distance from the current fragment to the line segment of the trail
    vec2 lineVec = starHeadPos - starTailStartPos;
    float lenSq = dot(lineVec, lineVec);
    float t = 0.0;
    if (lenSq > 0.00001) {
        t = dot(uv - starTailStartPos, lineVec) / lenSq;
    }
    t = clamp(t, 0.0, 1.0);
    vec2 closestPoint = starTailStartPos + t * lineVec;
    float dist = distance(uv, closestPoint);

    // Intensity based on distance and position along the trail
    float intensity = smoothstep(0.005, 0.0, dist);
    intensity *= smoothstep(0.0, 1.0, t);

    // Add some glow around the star/trail
    intensity += smoothstep(0.02, 0.0, dist) * 0.5 * smoothstep(0.0, 1.0, t);

    // Assign a warm white/yellow color to the shooting star
    color = vec3(1.0, 0.8, 0.6) * intensity;

    return color;
}

void main() {
    // Normalize fragment coordinates to [0, 1]
    vec2 uv = gl_FragCoord.xy / iResolution.xy;
    vec3 finalColor = vec3(0.0);

    // --- Galaxy Background -- -
    vec3 galaxyColor = vec3(0.0);
    vec2 st = uv * 100.0; // Scale up UV for more stars in the background

    // Basic starfield generation
    for (int i = 0; i < 100; ++i) {
        // Use hash function to place stars at pseudo-random positions
        vec2 p = st + hash12(st + float(i)) * 1000.0;
        float star = hash12(floor(p));
        if (star > 0.995) { // Only a small percentage of random values become bright stars
            galaxyColor += vec3(star * 0.5 + 0.5); // Brighter white stars
        }
    }

    // Add some nebulous background (simple noise-based clouds)
    float nebula = 0.0;
    // Combine multiple layers of noise for a more organic look
    nebula += hash12(uv * 5.0 + iTime * 0.1) * 0.2;
    nebula += hash12(uv * 10.0 - iTime * 0.05) * 0.1;
    nebula += hash12(uv * 20.0 + iTime * 0.02) * 0.05;
    // Color the nebula with a blueish tint
    galaxyColor += vec3(nebula * 0.5, nebula * 0.3, nebula * 0.7);

    finalColor += galaxyColor * 0.1; // Darker background

    // --- Shooting Stars ---
    // Generate multiple shooting stars by calling the function with different seeds
    // and time offsets to make them appear at different times and positions.
    finalColor += shootingStarEffect(uv, iTime, 1.0);
    finalColor += shootingStarEffect(uv, iTime + 10.0, 2.0);
    finalColor += shootingStarEffect(uv, iTime + 20.0, 3.0);
    finalColor += shootingStarEffect(uv, iTime + 30.0, 4.0);
    finalColor += shootingStarEffect(uv, iTime + 40.0, 5.0);
    finalColor += shootingStarEffect(uv, iTime + 50.0, 6.0);
    finalColor += shootingStarEffect(uv, iTime + 60.0, 7.0);
    finalColor += shootingStarEffect(uv, iTime + 70.0, 8.0);
    finalColor += shootingStarEffect(uv, iTime + 80.0, 9.0);
    finalColor += shootingStarEffect(uv, iTime + 90.0, 10.0);

    // Output the final color
    gl_FragColor = vec4(finalColor, 1.0);
}
`;

const canvas = document.getElementById('shader-bg');
let gl;
let program;
let positionBuffer;
let positionLocation;
let u_timeLocation;
let u_resolutionLocation;
let time = 0;
let currentAnimationRequest;

if (canvas) {
    gl = canvas.getContext('webgl');
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (gl) {
        gl.viewport(0, 0, canvas.width, canvas.height);
    }
}

function initShader(fragmentShaderSource, timeUniformName, resolutionUniformName) {
    if (currentAnimationRequest) {
        cancelAnimationFrame(currentAnimationRequest);
    }

    const vertexShaderSource = `
        attribute vec2 position;
        void main() {
            gl_Position = vec4(position, 0.0, 1.0);
        }
    `;

    function createShader(type, source) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        // TODO: check for compile errors
        return shader;
    }

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);

    program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    gl.useProgram(program);

    positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
    ]), gl.STATIC_DRAW);

    positionLocation = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    u_timeLocation = gl.getUniformLocation(program, timeUniformName);
    u_resolutionLocation = gl.getUniformLocation(program, resolutionUniformName);

    animate();
}

function animate() {
    time += 0.01;
    gl.uniform2f(u_resolutionLocation, canvas.width, canvas.height);
    gl.uniform1f(u_timeLocation, time);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    currentAnimationRequest = requestAnimationFrame(animate);
}

function toggleTheme() {
    const body = document.body;
    const btn = document.querySelector('.theme-toggle');
    
    if (body.classList.contains('light')) {
        body.classList.remove('light');
        body.classList.add('dark');
        btn.textContent = '☀';
        initShader(darkFragmentShaderSource, 'iTime', 'iResolution');
    } else {
        body.classList.remove('dark');
        body.classList.add('light');
        btn.textContent = '☾';
        initShader(lightFragmentShaderSource, 'u_time', 'u_resolution');
    }
}

// Initial shader setup
document.addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('light')) {
        initShader(lightFragmentShaderSource, 'u_time', 'u_resolution');
    } else {
        initShader(darkFragmentShaderSource, 'iTime', 'iResolution');
    }
});


// Toggle collapse functionality
document.addEventListener('DOMContentLoaded', () => {
    const toggleBtn = document.getElementById('toggle-collapse');
    const collapseSection = document.getElementById('collapse-section');

    toggleBtn.addEventListener('click', () => {
        const isVisible = collapseSection.classList.contains('show');
        if (isVisible) {
            collapseSection.classList.remove('show');
            toggleBtn.textContent = 'SHOW_MORE';
        } else {
            collapseSection.classList.add('show');
            toggleBtn.textContent = 'HIDE_MORE';
        }
    });

    // Modal functionality
    const openModalBtn = document.getElementById('open-modal-btn');
    const modal = document.getElementById('modal');
    const closeModalBtn = document.getElementById('close-modal-btn');

    if (openModalBtn) {
        openModalBtn.addEventListener('click', () => {
            modal.style.display = 'flex';
        });
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    // Close modal on outside click
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
});

// Get last commit info
async function getLastCommit() {
    try {
        const response = await fetch("https://api.github.com/repos/korrykatti/korrykatti.github.io/commits");
        const commits = await response.json();
        const lastCommitDate = new Date(commits[0].commit.committer.date);

        const now = new Date();
        const diffTime = Math.abs(now - lastCommitDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        document.getElementById('last-updated').textContent = 
            `LAST_UPDATE: ${diffDays} days ago (${lastCommitDate.toDateString()})`;
    } catch (error) {
        console.error("Error fetching last commit:", error);
        document.getElementById('last-updated').textContent = "SYSTEM_ERROR: update data unavailable";
    }
}

// Initialize
window.addEventListener('load', () => {
    getLastCommit();
});
