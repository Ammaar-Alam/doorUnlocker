# Door Opener

A motor pulls a fishing line attached to my door handle. Open it from a browser or an iPhone shortcut, with the same live status shared across every browser.

[Open the website](https://door.ammaaralam.com) · [Watch it work](https://youtube.com/shorts/K_ev5bF7mhw)

[![Add Door Opener to Shortcuts](https://img.shields.io/badge/Add_to_Shortcuts-Door_Opener-242424?style=for-the-badge&logo=apple&logoColor=white)](shortcuts/Door%20Opener%20%28Button%29.shortcut?raw=true)

The shortcut asks for the door password once during installation and keeps it in your private copy. One press opens the handle, holds it for five seconds, then releases it. The Arduino owns the timer, so the phone does not need to remain awake. The repository includes the [editable shortcut source](shortcuts/Door%20Opener%20%28Button%29.plist).

## How it works

```text
Browser / Shortcut → Node server → Arduino Cloud → Nano ESP32 → Motor
Browser            ← Live updates ← Reported handle state ← Arduino
```

- The website's switch opens or releases the handle until another command changes it
- The shortcut runs one five-second cycle; another Open does not extend an active cycle
- Close cancels the hold; repeated normal commands do not repeat motor strokes
- Force Open and Force Close deliberately run another calibrated stroke for string adjustment
- Password protection runs from midnight to 8 a.m. in New York, including daylight saving time

The status describes the controller's handle position. There is no sensor confirming that the physical door has closed. Always start with the string released; power cycling cannot measure its position.

## Run locally

Use Node.js 22 and npm.

```sh
npm ci
cp .env.example .env
```

Fill `.env` with the Thing and property IDs from Arduino Cloud, an Arduino API client, the door password, and a persistent signing secret. `PROPERTY_ID` identifies the reported `doorOpen` variable; `COMMAND_PROPERTY_ID` identifies `doorCommand`. Generate a signing secret with `openssl rand -hex 32`.

```sh
npm test
npm start
```

Open `http://localhost:3000`. Door control requires the configured board to be online. Every API response, including errors, is JSON. See the [API guide](docs/API_GUIDE.md).

## Hardware

- Arduino Nano ESP32
- L298N motor driver and 24 V DC motor
- Fishing line, mounting strips, and a printed spindle

The calibrated sketch and wiring are in [firmware/](firmware/README.md). The [print files](hardware/README.md) include the optimized spindle STL and Bambu Studio project.

## Hosting

The application is one Node process; it does not need a separate worker or database. [Hosting instructions](docs/HOSTING.md) describe an isolated service on an existing Linux machine, with memory and CPU limits and HTTPS through Caddy. Arduino status polling runs only while browsers are watching.

[MIT license](LICENSE)
