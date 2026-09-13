# Door Opener

A gearmotor, a printed spindle, and a length of fishing line turn a regular door handle into one you can open from your phone. The website shows the mechanism in 3D, with live controller status and parts you can explore.

[Open the website](https://door.ammaaralam.com) · [Watch the demo](https://youtube.com/shorts/K_ev5bF7mhw)

<a href="https://youtube.com/shorts/K_ev5bF7mhw"><img src="https://i.ytimg.com/vi/K_ev5bF7mhw/hqdefault.jpg" alt="Watch the door opener in action on YouTube" width="480" /></a>

## The mechanism

The motor winds fishing line onto a custom spool to pull the handle down. Reversing the motor lets the handle return. An arbor knot anchors the line to the spindle; a round turn and half hitches attach it to the handle, secured under duct tape. The assembly mounts to the door with adhesive strips.

| Part | Purpose |
| --- | --- |
| Arduino Nano ESP32 | Receives commands over Wi-Fi and times each stroke |
| L298N driver | Controls motor direction and speed |
| BRINGSMART 24 V worm gearmotor | Winds and releases the line |
| Printed spindle and base | Gather the line and hold the assembly together |
| Mini breadboard and jumpers | Connect the controller and driver |
| Fishing line, duct tape, mounting strips | Attach the mechanism to the handle and door |

The [hardware guide](hardware/README.md) has part links and print files, including the original spindle STL. The [firmware guide](firmware/README.md) covers wiring, Arduino Cloud setup, uploading, and calibration.

## Try the interface

Use Node.js 22 and npm. No board or credentials are needed for the preview.

```sh
npm ci
npm run preview
```

Open [localhost:3107](http://localhost:3107). The preview uses a simulated controller and cannot move the real motor. Select a part to inspect it, drag to rotate the assembly, or use the door controls to see it move.

## Connect your own door

Set up the board using the [firmware guide](firmware/README.md), then configure the server:

```sh
cp .env.example .env
openssl rand -hex 32
```

Fill `.env` with your Arduino Cloud Thing ID, API credentials, door password, and the generated signing secret. `PROPERTY_ID` is the read-only `doorOpen` property; `COMMAND_PROPERTY_ID` is the writable `doorCommand` property.

```sh
npm test
npm start
```

Open [localhost:3000](http://localhost:3000). The website shares the controller’s reported state across connected browsers. See the [API guide](docs/API_GUIDE.md) for other clients and authentication settings.

Opening runs a calibrated 970 ms stroke; releasing runs for 550 ms. Each Open or Close received while idle runs a full stroke, including repeated commands in the same direction. Calibrate the timings for your own motor and handle.

There is no position sensor: status describes the controller’s state, not whether the physical door is shut. Start with the string released and watch the first powered cycle.

## iPhone app

The [iOS app](ios/README.md) provides native door controls, Bluetooth reconnection, and live diagnostics. Open `ios/DoorOpener.xcodeproj` in Xcode. It supports iPhone on iOS 18 or later.

## iPhone shortcut

In Shortcuts, send `POST /open`, wait five seconds, then send `POST /close`. Supply the door password with each request when authentication is required.

The phone owns the wait and the closing request. If that request does not arrive, the handle remains held. Older files in `shortcuts/` use the removed `/pulse` endpoint and must be updated before use.

[MIT license](LICENSE)
