# Nano ESP32 firmware

Open `doorOpener/doorOpener.ino` in Arduino IDE or use Arduino CLI. This sketch targets the Arduino Nano ESP32, FQBN `arduino:esp32:nano_nora`.

## Wiring

| Nano pin | Connection |
| --- | --- |
| D2 | L298N IN1 |
| D3 | L298N IN2 |
| D9 | L298N ENA, with its enable jumper removed |
| GND | Common ground with the motor driver |

Power the motor driver from the motor's supply and power the Nano separately through USB or an appropriate regulated supply. Do not connect the 24 V motor supply to a Nano GPIO or 3.3 V pin.

## Arduino Cloud

Use these variables on the associated Thing:

| Variable | Type | Permission | Update |
| --- | --- | --- | --- |
| `doorOpen` | Boolean / Status | Read only | On change |
| `doorCommand` | Character String | Read and write | On change |

The server uses the property IDs in `.env`. `thingProperties.h` contains this project's device login ID; change it when pairing a different board.

Copy `doorOpener/arduino_secrets.example.h` to `doorOpener/arduino_secrets.h`, then enter the device secret and WiFi settings. The real header is ignored by Git. Arduino Cloud sketch downloads omit secret values, so a downloaded header must be configured before uploading.

## Build and upload

Validated with Arduino ESP32 Boards `2.0.18-arduino.5` and ArduinoIoTCloud `2.10.0`:

```sh
arduino-cli core install arduino:esp32@2.0.18-arduino.5
arduino-cli lib install ArduinoIoTCloud@2.10.0
arduino-cli compile --fqbn arduino:esp32:nano_nora firmware/doorOpener
arduino-cli board list
```

Select the Nano's detected USB port in Arduino IDE to upload. If it does not enter upload mode, double-press RESET quickly. Disconnect the motor or string for the first upload and software check.

## Automatic OTA uploads

The GitHub `Checks` workflow uploads firmware through Arduino Cloud after tests pass on `main` when firmware or its deployment configuration changes. Pull requests only run checks. Run `Checks` manually on `main` to retry an update without another code change.

Configure these GitHub environment secrets in `door-unlocker`:

- `ARDUINO_CLOUD_CLIENT` and `ARDUINO_CLOUD_SECRET`: an Arduino Cloud API key
- `ARDUINO_SECRETS_HEADER`: the complete configured `arduino_secrets.h` file

The device ID comes from `thingProperties.h`. The board must be online, already running OTA-capable Arduino Cloud firmware, and have an OTA-enabled Cloud plan. The workflow compiles with the private device/Wi-Fi configuration and waits for the specific OTA job to succeed. Firmware binaries contain credentials and are not published as GitHub artifacts.

OTA reboots the board. Keep the handle released and avoid motor commands during an update. The first upload may require USB if the installed firmware does not support OTA. The GitHub job summary records the deployed commit and OTA ID; an accepted upload request alone is not completion. After an upload timeout, inspect that OTA ID before retrying.

Uploading a binary does not synchronize the Cloud editor's source files. GitHub is the firmware source of truth; the editor can still show an older sketch after a successful OTA upload.

## Timing and string adjustment

`DoorController.h` contains the motor power and timing calibration. Opening takes 970 ms and releasing takes 400 ms. A separate ESP32 task controls the motor, so WiFi and cloud calls cannot extend a powered stroke. Each stroke completes even if the network disconnects. A completed opening stays held until a Close command arrives.

Normal Open and Close are idempotent. Force Open/Close intentionally run another full stroke, and should be used only while adjusting the string. The controller completes a stroke before reversing so a partially wound string is not followed by a full release stroke.

Start with the string released. There is no encoder or position sensor, so firmware cannot determine string tension or its initial physical position after power loss. Test a single cycle while watching the mechanism before leaving it connected.

`npm test` includes a native C++ check of the calibrated timing, duplicate commands, early closing, and clock rollover.
