# Door Opener for iOS

Open `DoorOpener.xcodeproj` in Xcode. Select your signing team and an available bundle identifier in Signing & Capabilities. The app supports iPhone on iOS 17 or later. Archive for an iOS device to distribute through TestFlight; increment the build number for subsequent uploads.

The Door tab loads the existing website, including its controls and login. The Connection tab uses CoreBluetooth background central mode, state restoration and system auto-reconnect. Enable Auto-connect and select the door once. Initial pairing requires the six-digit code printed by the production firmware to USB Serial at 9600 baud. Pair near the controller with the mechanism ready to move. Turn Auto-connect off to cancel both the connection and pending reconnect. To replace a saved controller, choose Forget door, enable Auto-connect, and select the new door. This clears the app selection, not the iOS Bluetooth bond. The firmware protects the model read with authenticated encryption, so the app waits for pairing before showing Connected.

Do not force-quit the app if you want background reconnection. Bluetooth must stay enabled. iOS controls connection scheduling; instant reconnection cannot be guaranteed. Verify a locked-phone walk out of range and back on a real iPhone. The simulator cannot validate BLE pairing or proximity actuation.

Logs shows up to 200 recent phone connection events in memory and the server's latest Arduino telemetry. Deploy the accompanying server change to enable `/api/diagnostics`. That endpoint requires a valid login at all times, serves one cached MQTT snapshot without extra Arduino requests, and stores no additional history. The app polls every 500 ms only while Logs is visible and active, backing off on errors. The timestamp shows how old a report is. The server's existing journal retention is unchanged. Phone identifiers in Arduino reports are connection slots, not stable phone identities.

No location permission, GPS ranging, motor timing changes, or Shortcut logic is added. BLE RSSI cannot distinguish which side of a door a phone is on.

Build check:

```sh
xcodebuild -project ios/DoorOpener.xcodeproj -scheme DoorOpener -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## Xcode Cloud

The shared `DoorOpener` scheme is checked in. Configure cloud start conditions in Xcode or App Store Connect: pull requests targeting `main` and changes to `main`. Select a stable Xcode version, `ios/DoorOpener.xcodeproj`, and the `DoorOpener` scheme. A Build action validates compilation; TestFlight delivery requires an Archive action and a TestFlight post-action. Cloud workflows are managed by Apple, not GitHub Actions YAML.
