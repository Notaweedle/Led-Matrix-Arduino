#include <WiFi.h>
#include <WebServer.h>

//////////////////// WIFI (AP MODE) ////////////////////
const char* AP_SSID = "ESP32-LED_Pest_Filled";
const char* AP_PASS = "Ghoti9870$$";

//////////////////// WEB SERVER ////////////////////
WebServer server(80);

//////////////////// SIMPLE FRAMEBUFFER ////////////////////
// Default grid size (change in UI or via /size?w=&h=)
int W = 16, H = 16;
// RGB framebuffer: bytes per pixel = 3
// We'll allocate after boot to max 64x64 (sane limit for RAM)
const int MAX_W = 64, MAX_H = 64;
uint8_t *fb = nullptr;

inline int idx(int x, int y) { return (y * W + x) * 3; }
bool inBounds(int x, int y) { return x>=0 && x<W && y>=0 && y<H; }

void allocFB(int w, int h) {
  if (fb) { free(fb); fb = nullptr; }
  W = constrain(w, 2, MAX_W);
  H = constrain(h, 2, MAX_H);
  fb = (uint8_t*)malloc(W*H*3);
  if (fb) memset(fb, 0, W*H*3);
}

//////////////////// HTML (served at "/") ////////////////////
const char PAGE[] PROGMEM = R"HTML(
<!doctype html><meta charset="utf-8">
<title>ESP32 LED Editor</title>
<meta name=viewport content="width=device-width,initial-scale=1">
<style>
  :root{color-scheme:dark}
  body{margin:0;display:flex;gap:12px;background:#0f1117;color:#e6e6e6;font-family:system-ui,Segoe UI,Roboto,Arial}
  #left{flex:1;display:flex;justify-content:center;align-items:center;min-height:100vh}
  #right{width:320px;padding:12px;background:#151826;border-left:1px solid #22263a}
  h2{font-size:14px;margin:10px 0;color:#9fb3ff}
  .row{display:flex;align-items:center;gap:8px;margin:8px 0}
  input[type=number]{width:70px;background:#1b1f34;color:#fff;border:1px solid #2a304f;border-radius:6px;padding:6px}
  input[type=range]{width:160px}
  button{background:#21264a;color:#fff;border:1px solid #2b3263;border-radius:8px;padding:6px 10px;cursor:pointer}
  #canvas{background:#000;box-shadow:0 0 0 1px #2a2f55 inset,0 8px 28px rgba(0,0,0,.5)}
  small{color:#9aa3ba}
</style>
<div id=left><canvas id=canvas width=900 height=700></canvas></div>
<div id=right>
  <h2>Display</h2>
  <div class=row><label>Pixel size</label><input id=px type=range min=6 max=36 value=18></div>
  <div class=row><label>Cols/Rows</label><input id=w type=number min=2 max=64 value=16><input id=h type=number min=2 max=64 value=16><button id=apply>Apply</button></div>
  <div class=row><label>Color</label><input id=col type=color value=#ff0080><button id=clear>Clear</button></div>
  <small>Left-click paints, right-click eyedrops color.</small>
</div>
<script>
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

let W=16,H=16, px=18, gap=1;
let color = [255,0,128];
let fb = []; // will be filled from /state

function rgbToHex([r,g,b]){return '#' + [r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('');}
function hexToRgb(hex){const n=parseInt(hex.slice(1),16);return [(n>>16)&255,(n>>8)&255,n&255];}
function fit() {
  const dpr = window.devicePixelRatio||1;
  const w = Math.min(1100, window.innerWidth-340-12), h = window.innerHeight-0;
  canvas.width = Math.floor(w*dpr); canvas.height = Math.floor(h*dpr);
  canvas.style.width=w+'px'; canvas.style.height=h+'px';
  ctx.setTransform(dpr,0,0,dpr,0,0);
  draw();
}
window.addEventListener('resize', fit);

function draw(){
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const imgW = W*px + (W-1)*gap, imgH = H*px + (H-1)*gap;
  const x0 = (canvas.clientWidth - imgW)/2;
  const y0 = (canvas.clientHeight - imgH)/2;

  for (let y=0;y<H;y++) for (let x=0;x<W;x++){
    const i=(y*W+x)*3;
    const r=fb[i]||0,g=fb[i+1]||0,b=fb[i+2]||0;
    const X=x0+x*(px+gap), Y=y0+y*(px+gap);
    ctx.fillStyle=`rgb(${r},${g},${b})`;
    ctx.fillRect(X,Y,px,px);
    ctx.strokeStyle='#22283a'; ctx.strokeRect(X+.5,Y+.5,px-1,px-1);
  }
}

function posToXY(cx,cy){
  const imgW=W*px+(W-1)*gap, imgH=H*px+(H-1)*gap;
  const x0=(canvas.clientWidth-imgW)/2, y0=(canvas.clientHeight-imgH)/2;
  const rx=cx-x0, ry=cy-y0;
  if(rx<0||ry<0) return null;
  const x=Math.floor(rx/(px+gap)), y=Math.floor(ry/(px+gap));
  if(x<0||x>=W||y<0||y>=H) return null;
  return [x,y];
}

canvas.addEventListener('contextmenu', e=>e.preventDefault());
canvas.addEventListener('mousedown', async e=>{
  const p=posToXY(e.offsetX,e.offsetY); if(!p) return;
  if(e.button===2){ // eyedrop
    const i=(p[1]*W+p[0])*3;
    color=[fb[i]||0,fb[i+1]||0,fb[i+2]||0];
    document.getElementById('col').value=rgbToHex(color);
    return;
  }
  await setPixel(p[0],p[1],color);
  await refresh();
});
canvas.addEventListener('mousemove', async e=>{
  if((e.buttons&1)===0) return;
  const p=posToXY(e.offsetX,e.offsetY); if(!p) return;
  await setPixel(p[0],p[1],color);
  await refresh();
});

async function refresh(){
  const r=await fetch('/state'); const j=await r.json();
  W=j.w; H=j.h; fb = j.fb ? Array.from(atob(j.fb),c=>c.charCodeAt(0)) : new Array(W*H*3).fill(0);
  document.getElementById('w').value=W; document.getElementById('h').value=H;
  draw();
}
async function setPixel(x,y,[r,g,b]){
  await fetch(`/set?x=${x}&y=${y}&rgb=${r},${g},${b}`);
}
async function clearAll(){
  await fetch('/clear'); await refresh();
}
async function applySize(){
  const w=+document.getElementById('w').value|0;
  const h=+document.getElementById('h').value|0;
  await fetch(`/size?w=${w}&h=${h}`); await refresh();
}

document.getElementById('px').oninput=e=>{px=+e.target.value; draw();}
document.getElementById('col').oninput=e=>{color=hexToRgb(e.target.value);}
document.getElementById('clear').onclick=clearAll;
document.getElementById('apply').onclick=applySize;

fit(); refresh();
</script>
)HTML";

//////////////////// ROUTES ////////////////////
String b64(const uint8_t* data, size_t len) {
  // minimal base64 for JSON payload; we only need encoding
  static const char* tbl="ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  String out; out.reserve((len*4)/3 + 4);
  size_t i=0;
  while(i<len){
    uint32_t a = i<len ? data[i++] : 0;
    uint32_t b = i<len ? data[i++] : 0;
    uint32_t c = i<len ? data[i++] : 0;
    uint32_t triple = (a<<16)|(b<<8)|c;
    out += tbl[(triple>>18)&63];
    out += tbl[(triple>>12)&63];
    out += (i-1<=len ? tbl[(triple>>6)&63] : '=');
    out += (i<=len ? tbl[triple&63] : '=');
  }
  return out;
}

void handleRoot(){
  server.send_P(200, "text/html; charset=utf-8", PAGE);
}

void handleState(){
  // Return JSON: {w,h, fb: base64-of-bytes}
  String j = "{";
  j += "\"w\":" + String(W) + ",\"h\":" + String(H) + ",";
  if (fb) {
    String enc = b64(fb, W*H*3);
    j += "\"fb\":\"" + enc + "\"";
  } else {
    j += "\"fb\":\"\"";
  }
  j += "}";
  server.send(200, "application/json", j);
}

void handleSet(){
  if (!server.hasArg("x") || !server.hasArg("y") || !server.hasArg("rgb")) { server.send(400,"text/plain","bad args"); return; }
  int x = server.arg("x").toInt();
  int y = server.arg("y").toInt();
  String rgb = server.arg("rgb");
  int r,g,b;
  if (sscanf(rgb.c_str(), "%d,%d,%d", &r,&g,&b) != 3) { server.send(400,"text/plain","bad rgb"); return; }
  if (!inBounds(x,y) || !fb) { server.send(400,"text/plain","oob"); return; }
  int i = idx(x,y);
  fb[i] = (uint8_t)constrain(r,0,255);
  fb[i+1] = (uint8_t)constrain(g,0,255);
  fb[i+2] = (uint8_t)constrain(b,0,255);
  server.send(200, "text/plain", "ok");
}

void handleClear(){
  if (fb) memset(fb, 0, W*H*3);
  server.send(200, "text/plain", "ok");
}

void handleSize(){
  int w = server.hasArg("w") ? server.arg("w").toInt() : W;
  int h = server.hasArg("h") ? server.arg("h").toInt() : H;
  allocFB(w,h);
  server.send(200,"text/plain","ok");
}

//////////////////// SETUP/LOOP ////////////////////
void setup() {
  Serial.begin(115200);
  delay(200);

  allocFB(W,H);

  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(IPAddress(192,168,4,1), IPAddress(192,168,4,1), IPAddress(255,255,255,0));
  WiFi.softAP(AP_SSID, AP_PASS, 6, false, 4);
  Serial.print("Connect to: "); Serial.println(AP_SSID);
  Serial.print("Password:  "); Serial.println(AP_PASS);
  Serial.print("Open:       http://"); Serial.println(WiFi.softAPIP());

  server.on("/", handleRoot);
  server.on("/state", handleState);
  server.on("/set", handleSet);
  server.on("/clear", handleClear);
  server.on("/size", handleSize);

  server.begin();
}

void loop() {
  server.handleClient();
}
