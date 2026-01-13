// ===== Config =====
let BASE_URL = ""; // set later via UI "Connect" if using ESP32

// ===== State =====
//#region State
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const $ = id => document.getElementById(id);

let panelCols = 16, panelRows = 16;
let activePanels = 1;             // 1..4 across a 2x2 layout
let pixelSize = 18;
let showGrid = true;

const BLACK = [0,0,0];
let tool = 'paint';
let currentColor = [255,0,128];

// frames: each frame is a "wall" = 4 panels, each panel = rows x cols RGB
let frames = [makeWall(panelCols, panelRows)];
let cur = 0;
let playing = false;
let fps = 12;
let lastTick = 0;

// onion skin
let onionPrev = true, onionNext = true, onionAlpha = 0.6;

// local working wall mirrors frames[cur]
let wall = cloneWall(frames[0]);
//#endregion

// ===== Helpers: wall/panel =====
//#region Walls/panels
function makePanel(c, r, fill=BLACK){ return Array.from({length:r},()=>Array.from({length:c},()=>[...fill])); }
function makeWall(c, r){ return [0,1,2,3].map(()=>makePanel(c,r)); }
function cloneWall(src){ return src.map(p=>p.map(row=>row.map(rgb=>[...rgb]))); }

function worldSize(){ return [panelCols, panelRows]; }

function setWorld(wx, wy, rgb) {
    if (wx<0 || wy<0 || wx>=panelCols || wy>=panelRows) return;
    const i = Math.floor(wx/panelCols) + Math.floor(wy/panelRows);
    if (i >= activePanels) return;
    wall[i][wy % panelRows][wx % panelCols] = rgb; // no cloning
}

function getWorld(wx, wy, src=wall) {
    if (wx<0 || wy<0 || wx>=panelCols || wy>=panelRows) return null;
    const i = Math.floor(wx/panelCols) + Math.floor(wy/panelRows);
    return src[i][wy % panelRows][wx % panelCols];
}

const rgbToHex = ([r,g,b]) => `#${(r<<16 | g<<8 | b).toString(16).padStart(6,'0')}`;
const hexToRgb = hex => {
    const m = /^#?([0-9a-f]{6})$/i.exec(hex);
    if(!m) return [255,0,0];
    const n = parseInt(m[1],16);
    return [(n>>16)&255,(n>>8)&255,n&255];
};

//#endregion

// ===== Render =====
//#region Render
function draw() {
    const px = pixelSize, gap = 1;
    const W = panelCols, H = panelRows;

    ctx.clearRect(0,0,canvas.width,canvas.height);

    const imgW = W*px + (W-1)*gap;
    const imgH = H*px + (H-1)*gap;
    const x0 = (canvas.clientWidth - imgW)/2;
    const y0 = (canvas.clientHeight - imgH)/2;

    function plot(wx, wy, [r,g,b], grid) {
        const colBlock = Math.floor(wx/W);
        const rowBlock = Math.floor(wy/H);
        const i = rowBlock*2 + colBlock;
        if (i >= activePanels) { r=g=b=Math.round((r+g+b)/12); } // dim inactive
        const x = x0 + wx*(px+gap), y = y0 + wy*(px+gap);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x,y,px,px);
        if (grid && showGrid) ctx.strokeRect(x+.5,y+.5,px-1,px-1);
    }

    function drawLayer(src, [tr,tg,tb], alpha) {
        for (let i=0;i<activePanels;i++) {
            const panel = src[i];
            for (let y=0;y<H;y++) {
                const row = panel[y];
                for (let x=0;x<W;x++) {
                    const [r,g,b] = row[x];
                    plot(x + (i%2)*W, y + Math.floor(i/2)*H, [
                        Math.round(r*(1-alpha)+tr*alpha),
                        Math.round(g*(1-alpha)+tg*alpha),
                        Math.round(b*(1-alpha)+tb*alpha)
                    ], false);
                }
            }
        }
    }

    if (onionPrev && cur>0) drawLayer(frames[cur-1],[40,40,140],1-onionAlpha);
    if (onionNext && cur<frames.length-1) drawLayer(frames[cur+1],[140,40,40],1-onionAlpha);

    // draw current
    drawLayer(wall,[0,0,0],0); // alpha=0 just draws actual colors

    // panel outlines
    for (let i=0;i<activePanels;i++) {
        const x = x0 + (i%2)*W*(px+gap);
        const y = y0 + Math.floor(i/2)*H*(px+gap);
        ctx.strokeStyle = (i<activePanels)? '#FFF080':'#000';
        ctx.strokeRect(x+.5,y+.5,W*(px+gap)-gap,H*(px+gap)-gap);
    }
}

//#endregion

// ===== Canvas =====
//#region Canvas

function fitCanvas(){
    const dpr = Math.max(1, window.devicePixelRatio||1);
    const editorElement = document.getElementById('editor');

    const w = editorElement.clientWidth;
    const h = editorElement.clientHeight;

    canvas.width = Math.floor(w*dpr);
    canvas.height = Math.floor(h*dpr);

    canvas.style.width = w+'px';
    canvas.style.height = h+'px';

    ctx.setTransform(dpr,0,0,dpr,0,0);
    draw();
}
window.addEventListener('resize', fitCanvas);

// ===== Mouse painting =====
let dragging=false;
canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('mousedown', e=>{ dragging=e.button===0; handlePointer(e); });
canvas.addEventListener('mousemove', e=>{ if(dragging) handlePointer(e); });
window.addEventListener('mouseup', ()=>{ if(dragging) { frames[cur]=cloneWall(wall); draw(); } dragging=false; });

function canvasToWorld(cx,cy){
    const px = pixelSize, gap = 1;
    const W = panelCols, H = panelRows;
    const imgW = W*px + (W-1)*gap;
    const imgH = H*px + (H-1)*gap;
    const x0 = (canvas.clientWidth - imgW)/2;
    const y0 = (canvas.clientHeight - imgH)/2;
    const rx = cx-x0, ry = cy-y0;
    if(rx<0||ry<0) return null;
    const wx = Math.floor(rx/(px+gap));
    const wy = Math.floor(ry/(px+gap));
    if(wx<0||wy<0||wx>=W||wy>=H) return null;
    return [wx,wy];
}

function handlePointer(e){
    const p = canvasToWorld(e.offsetX,e.offsetY); if(!p) return;
    const [wx,wy] = p;
    if(e.button===2){ // eyedrop
        const c = getWorld(wx,wy);
        if(c){ currentColor=[...c]; $('color').value=rgbToHex(c); }
        return;
    }
    setWorld(wx,wy, tool==='erase'? BLACK:currentColor);
    draw();
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


//#endregion

// ===== UI wiring =====
//#region UI Wiring
$('px').oninput = e => { pixelSize = +e.target.value; draw(); }
$('showGrid').onchange = e => { showGrid = e.target.checked; draw(); }
$('usePanels').oninput = e => { activePanels = +e.target.value; $('usePanelsVal').textContent = activePanels; draw(); }
$('applySize').onclick = () => {
    const c = Math.max(2, Math.min(128, +$('cols').value|0));
    const r = Math.max(2, Math.min(128, +$('rows').value|0));
    // resize all panels in current wall
    function resizePanel(p){
        return Array.from(
            {length: r},
            (_, yy) => Array.from({length: c},
            (_, xx) => (p[yy]?.[xx] ? [...p[yy][xx]] : [...BLACK])));
    }
    wall = [0,1,2,3].map(i=>resizePanel(wall[i]));
    frames[cur] = cloneWall(wall);
    panelCols = c; panelRows = r;
    draw();
}

document.querySelectorAll('input[name="tool"]').forEach(r => r.onchange = ()=> tool = r.value);
$('color').oninput = e => currentColor = hexToRgb(e.target.value);
$('clear').onclick = () => { wall = makeWall(panelCols, panelRows); frames[cur]=cloneWall(wall); draw(); }

// Frames
function updateFrameLabel(){ $('frameLabel').textContent = `${cur+1}/${frames.length}`; }
$('prev').onclick = ()=>{ if (cur>0){ frames[cur]=cloneWall(wall); cur--; wall=cloneWall(frames[cur]); updateFrameLabel(); draw(); } };
$('next').onclick = ()=>{ if (cur<frames.length-1){ frames[cur]=cloneWall(wall); cur++; wall=cloneWall(frames[cur]); updateFrameLabel(); draw(); } };
$('add').onclick  = ()=>{ frames.splice(cur+1,0,cloneWall(wall)); cur++; wall=cloneWall(frames[cur]); updateFrameLabel(); draw(); };
$('dup').onclick  = ()=>{ frames.splice(cur+1,0,cloneWall(frames[cur])); cur++; wall=cloneWall(frames[cur]); updateFrameLabel(); draw(); };
$('del').onclick  = ()=>{ if (frames.length<=1) return; frames.splice(cur,1); cur=Math.max(0,cur-1); wall=cloneWall(frames[cur]); updateFrameLabel(); draw(); };

$('fps').oninput = e => fps = Math.max(1, Math.min(60, +e.target.value|0));
$('onPrev').onchange = e => { onionPrev = e.target.checked; draw(); }
$('onNext').onchange = e => { onionNext = e.target.checked; draw(); }
$('onAlpha').oninput = e => { onionAlpha = +e.target.value; draw(); }

$('play').onclick = ()=>{ if (!playing){ playing=true; lastTick=0; requestAnimationFrame(tick); } };
$('stop').onclick = ()=>{ playing=false; };

function tick(now){
    if (!playing) return;
    const delay = 1000/Math.max(1,fps);
    if (!lastTick || now-lastTick >= delay) {
        frames[cur]=cloneWall(wall);
        cur = (cur+1) % frames.length;
        wall = cloneWall(frames[cur]);
        updateFrameLabel(); draw();
        lastTick = now;
    }
    requestAnimationFrame(tick);
}
//#endregion

// ===== Project save/load =====
//#region Save/Load
$('saveProj').onclick = () => {
    const proj = {
        version: 2,
        panelCols, panelRows, activePanels, pixelSize, showGrid,
        onionPrev, onionNext, onionAlpha, fps,
        frames
    };
    const blob = new Blob([JSON.stringify(proj)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'project.ledproj';
    a.click();
    URL.revokeObjectURL(a.href);
};

$('loadProj').onclick = async () => {
    const f = $('loadFile').files?.[0]; if (!f) return;
    const text = await f.text();
    const proj = JSON.parse(text);
    panelCols = proj.panelCols ?? panelCols;
    panelRows = proj.panelRows ?? panelRows;
    activePanels = proj.activePanels ?? activePanels;
    pixelSize = proj.pixelSize ?? pixelSize;
    showGrid = !!proj.showGrid;
    onionPrev = !!proj.onionPrev;
    onionNext = !!proj.onionNext;
    onionAlpha = proj.onionAlpha ?? onionAlpha;
    fps = proj.fps ?? fps;
    frames = proj.frames ?? frames;
    cur = 0; wall = cloneWall(frames[0]);
    updateFrameLabel(); draw();
};

//#endregion

// ===== Sprite export/import (single frame) =====
//#region Import/Export

$('exportSprite').onclick = () => {
    const sprite = { panelCols, panelRows, data: wall };
    const blob = new Blob([JSON.stringify(sprite)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sprite.json';
    a.click();
    URL.revokeObjectURL(a.href);
};

$('importSprite').onclick = async () => {
    const f = $('importSpriteFile').files?.[0]; if (!f) return;
    const text = await f.text();
    const sprite = JSON.parse(text);
    if (sprite.panelCols && sprite.panelRows && sprite.data) {
        // adopt sprite size; replace current frame
        panelCols = sprite.panelCols;
        panelRows = sprite.panelRows;
        wall = sprite.data;
        frames[cur] = cloneWall(wall);
        $('cols').value = panelCols; $('rows').value = panelRows;
        draw();
    }
};
//#endregion

// ===== Device (optional) =====
//#region Device Link
const statusEl = $('status');

$('connect').onclick = () => {
    BASE_URL = $('baseUrl').value.trim();
    if (!BASE_URL) { statusEl.textContent = "Local preview (no device)"; return; }
    refreshFromDevice().catch(e => statusEl.textContent = "Connect failed: "+(e.message||e));
};

async function api(path){
    const res = await fetch(BASE_URL + path, {cache:'no-store'});
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
}

// fetch /state from ESP32; otherwise keep local
async function refreshFromDevice(){
    const res = await api('/state'); const j = await res.json();
    // device speaks 1 panel (W,H) framebuffer; we’ll just show it in panel 0
    const W = j.w|0, H = j.h|0;
    if (W>0 && H>0) {
        panelCols = W; panelRows = H;
        wall = makeWall(panelCols, panelRows);
        const bytes = j.fb ? Array.from(atob(j.fb), c => c.charCodeAt(0)) : new Array(W*H*3).fill(0);
        // write into panel 0
        let k=0;
        for (let y=0;y<H;y++) for (let x=0;x<W;x++){
            wall[0][y][x] = [bytes[k++]||0, bytes[k++]||0, bytes[k++]||0];
        }
        frames = [cloneWall(wall)]; cur=0;
        $('cols').value = panelCols; $('rows').value = panelRows;
        statusEl.textContent = `Connected to ${BASE_URL}`;
        updateFrameLabel(); draw();
    }
}

// async function pushPixelToDevice(x,y,[r,g,b]){
//     if (!BASE_URL) return;
//     try { await api(`/set?x=${x}&y=${y}&rgb=${r},${g},${b}`); }
//     catch(e){ statusEl.textContent = `Set failed: ${e.message}`; }
// }
// TODO Update the code so that it will send info of the art to the esp32 and save it when the
//#endregion

// ===== Init =====
function boot(){
    $('cols').value = panelCols; $('rows').value = panelRows;
    $('usePanels').value = activePanels; $('usePanelsVal').textContent = activePanels;
    $('px').value = pixelSize; $('showGrid').checked = showGrid;
    $('onPrev').checked = onionPrev; $('onNext').checked = onionNext; $('onAlpha').value = onionAlpha;
    $('fps').value = fps;
    updateFrameLabel();
    fitCanvas();

    // keyboard: Space play/stop, arrows frame nav, Ctrl+C clear
    window.addEventListener('keydown', e=>{
        if (e.code==='Space'){ e.preventDefault(); playing? $('stop').click():$('play').click(); }
        if (e.key==='ArrowLeft') $('prev').click();
        if (e.key==='ArrowRight') $('next').click();
        if (e.ctrlKey && e.key.toLowerCase()==='c') $('clear').click();
    });
}


boot();
