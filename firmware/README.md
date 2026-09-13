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
| `doorTelemetry` | Character String | Read only | On change |

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

## Bluetooth proximity

The board advertises as **Ammaar's Door Opener** and supports up to four simultaneous phone connections. Use the iOS app's Show pairing code and Connect door actions to pair without USB while the controller is online. USB Serial Monitor at 9600 baud remains a fallback for other BLE clients. Pairing uses authenticated encryption and saved Bluetooth bonds; later connections do not need the laptop. Unpaired or unauthenticated connections cannot operate the motor. Keep the board powered after unplugging USB.

A known phone arms after at least **15 seconds continuously disconnected**. After reconnecting and authenticating, two fresh RSSI readings at or above **−65 dBm** within one second request an automatic opening. Weak readings between them are allowed; invalid or stale readings do not count. Sampling runs once per second below −80 dBm and every 100 ms at or above −80 dBm. These thresholds are in `ProximityController.h`.

Each remembered phone gets one automatic opening per arrival. Brief reconnects preserve an armed arrival but clear its pending reading; staying connected or fluctuations in RSSI cannot rearm it. The controller remembers up to four phone addresses resolved by the Bluetooth stack. Startup, newly seen phones, and replaced slots begin disarmed and need a connection followed by a 15-second absence. Arrival state is kept in RAM, so restarting the controller resets it.

An automatic opening completes the 970 ms stroke, holds with motor power off for **four seconds**, then releases for **550 ms**, regardless of subsequent RSSI or disconnection. Arrivals during an existing movement or while already open share that opening and do not repeat or extend it. Manual commands take precedence and cancel the automatic release; manual Open stays held until an explicit Close.

`doorTelemetry` reports a compact snapshot every 500 ms while phones are connected, on connection-count changes, and once per minute when none are connected. Each paired phone has a slot number, RSSI, and near flag (a current reading at or above −65 dBm); slot numbers can be reused for newly seen phones. A null RSSI indicates no valid current reading. The connected count includes phones still pairing. The existing Arduino Cloud MQTT subscription writes these snapshots to the server log with the prefix `Bluetooth RSSI:`. Network delays can reduce the observed update rate; motor decisions never wait for telemetry delivery.

Create the read-only `doorTelemetry` and `doorPairingCode` String properties with On change updates before deploying this firmware. Disable timeseries persistence for the pairing code; it is a credential, not diagnostic history. The firmware republishes its current PIN on Cloud synchronization, and the authenticated `/pairing-code` endpoint retrieves it on demand.

Disable Cloud timeseries persistence for `doorTelemetry` if the server journal is the intended history store. Only the latest outgoing snapshot is retained in a fixed 256-byte queue; old snapshots are replaced while the network is busy. The server drops diagnostic output if its log stream is backpressured. Pairing codes and phone addresses are not included in telemetry.

RSSI is not a distance or door-position sensor. A connection loss lasting 15 seconds can rearm a phone even inside the room. First pair with motor power disconnected, then test one supervised approach/departure cycle. Check operation with the phone pocketed, locked, and the BLE app in the background; the phone must maintain or re-establish the BLE connection for proximity to work. Initial opening still requires the full motor stroke after the signal threshold is confirmed.

## Timing and string adjustment

`DoorController.h` contains the motor power and timing calibration. Opening takes 970 ms and releasing takes 550 ms. A separate ESP32 task controls the motor, so WiFi and cloud calls cannot extend a powered stroke. Each stroke completes even if the network disconnects. A manual opening stays held until a Close command arrives; BLE arrivals use the four-second hold described above.

Each Open or Close received while idle runs a full stroke, regardless of the reported position. The controller completes a stroke before reversing so a partially wound string is not followed by a full release stroke. Force Open/Close also run a full stroke while idle and are ignored during movement.

Start with the string released. There is no encoder or position sensor, so firmware cannot determine string tension or its initial physical position after power loss. Test a single cycle while watching the mechanism before leaving it connected.

`npm test` includes a native C++ check of the calibrated timing, duplicate commands, early closing, and clock rollover.
