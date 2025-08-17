#include <WiFi.h>
#include <WebServer.h>

// ==== Access Point (ESP32 makes its own Wi-Fi) ====
const char* AP_SSID = "ESP32-LED_Pest_Filled";
const char* AP_PASS = "Ghoti9870$$";   // change if you want

// Try these in order if yours doesn't blink on 2:
int LED_PIN = 5;   // common onboard LED (sometimes 2, 5, 13)
bool ledOn = false;

WebServer server(80);

const char* PAGE = R"HTML(
<!doctype html><meta name=viewport content="width=device-width,initial-scale=1">
<style>
  body{font-family:system-ui;margin:2rem}
  button{font-size:2rem;padding:1rem 2rem}
  .row{margin:.5rem 0}
</style>
<h1>ESP32 LED</h1>
<div class=row>Status: <b id=s>?</b></div>
<button onclick="fetch('/toggle').then(()=>refresh())">Toggle</button>
<script>
function refresh(){ fetch('/state').then(r=>r.text()).then(t=>s.textContent=t) }
refresh();
</script>
)HTML";

void setup() {
  Serial.begin(115200);
  delay(200);

  // LED
  pinMode(LED_PIN, OUTPUT);
  digitalWrite(LED_PIN, LOW);

  // Wi-Fi AP
  WiFi.mode(WIFI_AP);
  WiFi.softAP(AP_SSID, AP_PASS);
  Serial.print("Connect to Wi-Fi: "); Serial.println(AP_SSID);
  Serial.print("Password: "); Serial.println(AP_PASS);
  Serial.print("Open in browser: http://"); Serial.println(WiFi.softAPIP());

  // Routes
  server.on("/", [](){ server.send(200, "text/html", PAGE); });
  server.on("/toggle", [](){
    ledOn = !ledOn;
    digitalWrite(LED_PIN, ledOn ? HIGH : LOW);
    server.send(200, "text/plain", "ok");
  });
  server.on("/state", [](){ server.send(200, "text/plain", ledOn ? "ON" : "OFF"); });
  server.begin();
}

void loop() {
  server.handleClient();
}
