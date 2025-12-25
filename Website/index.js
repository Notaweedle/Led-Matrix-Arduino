// ---- Config ----
// Set this to your ESP32 IP when testing against hardware.
// If left empty, the UI runs but will show "Not connected".
let BASE_URL = ""; // e.g. "http://192.168.4.1"

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W = 16, H = 16, px = 18, gap = 1;
let color = 1;
let fb = [];         // framebuffer (flat RGB bytes)
fb = new Uint8Array(W * H);

let connected = false;

const $ = (id) => document.getElementById(id);
const statusEl = $('status');
console.log("app.js loaded");

// Allow user to set BASE_URL from the UI
$('baseUrl').value = BASE_URL;
$('connect').onclick = () => {
    BASE_URL = $('baseUrl').value.trim();
    if (!BASE_URL) {
        connected = false;
        statusEl.textContent = "Disconnected (no BASE_URL).";
        return;
    }
    refresh().catch(err => {
        connected = false;
        statusEl.textContent = "Connect failed: " + (err?.message || err);
    });
};

// ---- Helpers ----


function hexToRgb(hex) {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if (!m) return [255, 0, 0];
    const n = parseInt(m[1], 16);
    return [(n >> 16) & 255, (n >> 8) & 255, (n) & 255];
}

function fit() {
    const dpr = window.devicePixelRatio || 1;
    const w = Math.min(1100, window.innerWidth - 340 - 12);
    const h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
}

function hexToPaletteIndex(hex) {
    let best = 0;
    let bestDist = Infinity;
    const [r, g, b] = hexToRgb(hex);

    palette32.forEach((p, i) => {
        const [pr, pg, pb] = hexToRgb(p);
        const d =
            (r - pr) ** 2 +
            (g - pg) ** 2 +
            (b - pb) ** 2;
        if (d < bestDist) {
            bestDist = d;
            best = i;
        }
    });
    return best;
}

window.addEventListener('resize', fit);

// region Drawing


function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const imgW = W * px + (W - 1) * gap;
    const imgH = H * px + (H - 1) * gap;
    const x0 = (canvas.clientWidth - imgW) / 2;
    const y0 = (canvas.clientHeight - imgH) / 2;

    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {

        const X = x0 + x * (px + gap);
        const Y = y0 + y * (px + gap);
        const idx = fb[y * W + x] || 0;
        ctx.fillStyle = palette32[idx];

        ctx.fillRect(X, Y, px, px);
        ctx.strokeStyle = '#22283a';
        ctx.strokeRect(X + .7, Y + .7, px - 1, px - 1);
    }
    console.log(canvas);
}

function setLocalPixel(x, y, idx) {
    fb[y * W + x] = idx & 31;
}


function posToXY(cx, cy) {
    const imgW = W * px + (W - 1) * gap;
    const imgH = H * px + (H - 1) * gap;
    const x0 = (canvas.clientWidth - imgW) / 2;
    const y0 = (canvas.clientHeight - imgH) / 2;
    const rx = cx - x0, ry = cy - y0;
    if (rx < 0 || ry < 0) return null;
    const x = Math.floor(rx / (px + gap));
    const y = Math.floor(ry / (px + gap));
    if (x < 0 || x >= W || y < 0 || y >= H) return null;
    return [x, y];
}

const palette32 = [
    "#000000","#202020","#404040","#606060",
    "#808080","#A0A0A0","#C0C0C0","#FFFFFF",
    "#FF0000","#FF8000","#FFFF00","#80FF00",
    "#00FF00","#00FF80","#00FFFF","#0080FF",
    "#0000FF","#8000FF","#FF00FF","#FF0080",
    "#804000","#C06000","#FFB000","#FFC0C0",
    "#C00000","#800000","#400000","#004000",
    "#008080","#004080","#808000","#404040"
];


// endregion

// region Mouse controls
canvas.addEventListener('contextmenu', e => e.preventDefault());

canvas.addEventListener('mousedown', async (e) => {
    const p = posToXY(e.offsetX, e.offsetY);
    if (!p) return;
    if (e.button === 2) { // eyedrop
        const idx = fb[p[1] * W + p[0]] || 0;
        colorIndex = idx;
        $('col').value = palette32[idx];
        return;
    }
    if (connected) {
        await setPixel(p[0], p[1], color);
        await refresh();
    } else {
        setLocalPixel(p[0], p[1], color);
        draw();
    }


    canvas.addEventListener('mousemove', async (e) => {
        if ((e.buttons & 1) === 0) return;
        const p = posToXY(e.offsetX, e.offsetY);
        if (!p) return;
        if (connected) {
            await setPixel(p[0], p[1], color);
            await refresh();
        } else {
            setLocalPixel(p[0], p[1], color);
            draw();
        }

    });


// ---- Network calls ----
    async function api(path) {
        if (!BASE_URL) return null;
        const res = await fetch(BASE_URL + path, {cache: 'no-store'});
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res;
    }


    async function refresh() {
        const res = await api('/state');
        const j = await res.json();
        W = j.w;
        H = j.h;
        fb = j.fb ? Array.from(atob(j.fb), c => c.charCodeAt(0)) : new Array(W * H * 3).fill(0);
        $('w').value = W;
        $('h').value = H;
        draw();
        connected = true;
        statusEl.textContent = `Connected to ${BASE_URL}`;
        //console.log("fb length:", fb.length, "W,H:", W, H);
    }

    async function setPixel(x, y, [r, g, b]) {
        try {
            await api(`/set?x=${x}&y=${y}&rgb=${r},${g},${b}`);
        } catch (e) {
            statusEl.textContent = `Set failed: ${e.message}`;
        }
    }

    async function clearAll() {
        if (connected) {
            try {
                await api('/clear');
                await refresh();
            } catch (e) {
                statusEl.textContent = `Clear failed: ${e.message}`;
            }
        } else {
            fb.fill(0);
            draw();
            statusEl.textContent = "Cleared locally (not connected)";
        }
    }


    async function applySize() {
        const w = +$('w').value | 0;
        const h = +$('h').value | 0;

        if (connected) {
            try {
                await api(`/size?w=${w}&h=${h}`);
                await refresh();
            } catch (e) {
                statusEl.textContent = `Resize failed: ${e.message}`;
            }
        } else {
            W = w;
            H = h;
            fb = new Uint8Array(W * H);

            draw();
            statusEl.textContent = "Resized locally (not connected)";
        }
    }


// ---- UI wiring ----
    $('px').oninput = (e) => {
        px = +e.target.value;
        draw();
    };
    $('col').oninput = (e) => {
        colorIndex = hexToPaletteIndex(e.target.value);
    };
    $('clear').onclick = clearAll;
    $('apply').onclick = applySize;

// ---- Boot ----
    fit();
// Optional: auto-try if you set BASE_URL in the file
    if (BASE_URL) {
        refresh().catch(err => {
            connected = false;
            statusEl.textContent = "Connect failed: " + (err?.message || err);
        });
    } else {
        statusEl.textContent = "Not connected (set BASE_URL and click Connect).";
    }
})


//endregion