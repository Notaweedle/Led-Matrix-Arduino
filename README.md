# ESP32 LED Control & LCD Display Project

This project uses an ESP32 development board to create a Wi-Fi–controlled LED + LCD display system.
It’s meant as a prototype for con projects, art displays, and experimenting with microcontrollers.

## Features

ESP32 Access Point (AP): ESP32 creates its own Wi-Fi hotspot, no external router required.

Web Control Page: Simple HTML + JavaScript frontend served directly by the ESP32.

Toggle LEDs on/off

Future: Pattern control, animations, etc.

## LCD (20x4 I²C):

Display text, scrolling messages, and status.

Uses GPIO21 (SDA) and GPIO22 (SCL).

Cross-Platform Frontend Options:

Option 1: Use the built-in ESP32 web page (HTML/JS).

Option 2: Make your own frontend app in .NET MAUI (C#) to control the ESP32 with prettier UI.

# Hardware

Board: ESP32-WROOM-32 (tested with AITRIP Type-C ESP32 with CP2102 chip).

LCD: 20x4 I²C LCD (SDA → GPIO21, SCL → GPIO22, VCC → 5V/3.3V, GND → GND).

LEDs: Basic on-board LED (GPIO2) or external WS2812 strip (future).

Power: Runs from USB or a power bank (recommend 10,000–20,000 mAh for con use).

### Software

Arduino IDE (latest ESP32 board definitions installed).

### Libraries:

WiFi.h (built-in ESP32 Wi-Fi support).

WebServer.h (serve pages).

LiquidCrystal_I2C.h (for LCD).

## Usage

Flash the ESP32 with this project code.

Connect to the ESP32 Wi-Fi network:

SSID: "" -Set Your own

Password: "" -Set Your own

Open http://192.168.4.1 in your browser.

Use the control page to toggle LEDs and test.

## Future Plans

LED art panel emulator (patterns, onion-skin animation, frames).

ESP32 as a wireless bridge → talk to a Teensy over Serial for heavier LED animations.

Optional MAUI frontend app (C#) for custom UI and controls.

## Notes

LCD rows are “paired” (0 with 2, 1 with 3) because of the controller design.

If LCD text looks scrambled → swap SDA/SCL pins.

If upload fails → install Silicon Labs CP2102 USB driver and check correct COM port.

License

MIT – do whatever you like, just don’t sue me if it breaks 😅
