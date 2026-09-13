# Door Opener for iOS

Open `DoorOpener.xcodeproj` in Xcode. Select your signing team and an available bundle identifier in Signing & Capabilities. The app supports iPhone on iOS 18 or later. Archive for an iOS device to distribute through TestFlight; increment the build number for subsequent uploads.

The Door tab uses native controls and the existing HTTP API. The mechanism link opens the full 3D website in Safari. Door and Logs share the native login session, but private diagnostics and pairing-code access do not lock public door controls. Status is reported by the controller, not measured by a position sensor. Commands remain pending until a fresh target-state report arrives or confirmation times out. A repeated stroke in an already-reported state may time out because the boolean report does not change; check the handle before retrying.

In Connection, sign in and tap Show pairing code before Connect door. The code comes from the online controller through the authenticated server, so USB is not needed for normal pairing. The system accessory picker handles setup. Existing saved accessories migrate into AccessorySetupKit on the first Connect door action. Reconnect restarts the connection while preserving pairing; Forget door asks iOS to remove the managed accessory. If pairing information is lost, forget and set up the door again from this screen. The firmware protects the identity read with authenticated encryption, so the app waits for pairing before showing Connected.

The pairing-code feature requires the read-only String Cloud property `doorPairingCode` with On change updates and persistence disabled, plus the matching firmware and server deployment. The PIN is read only on request, is not added to diagnostics or ordinary server logs, and is cleared from the screen when hidden or backgrounded. USB Serial at 9600 baud remains an offline fallback. The code changes when the controller restarts.

Do not force-quit the app if you want background reconnection. Bluetooth must stay enabled. iOS controls connection scheduling; instant reconnection cannot be guaranteed. Verify a locked-phone walk out of range and back on a real iPhone. The simulator cannot validate BLE pairing or proximity actuation.

Logs shows up to 200 recent phone connection events in memory and the server's latest Arduino telemetry. Deploy the accompanying server change to enable `/api/diagnostics`. That endpoint requires a valid login at all times, serves one cached MQTT snapshot without extra Arduino requests, and stores no additional history. The app polls every 500 ms only while Logs is visible and active, backing off on errors. The timestamp shows how old a report is. The server's existing journal retention is unchanged. Phone identifiers in Arduino reports are connection slots, not stable phone identities.

The motor release and both animations take 550 ms; opening takes 970 ms. BLE RSSI cannot distinguish which side of a door a phone is on.

Checks (the native requests are intercepted and do not actuate hardware):

```sh
bash scripts/check-ios.sh
xcodebuild -project ios/DoorOpener.xcodeproj -scheme DoorOpener -sdk iphonesimulator -configuration Debug CODE_SIGNING_ALLOWED=NO build
```

## Xcode Cloud

The shared `DoorOpener` scheme is checked in. Configure cloud start conditions in Xcode or App Store Connect: pull requests targeting `main` and changes to `main`. Select a stable Xcode version, `ios/DoorOpener.xcodeproj`, and the `DoorOpener` scheme. A Build action validates compilation; TestFlight delivery requires an Archive action and a TestFlight post-action. Cloud workflows are managed by Apple, not GitHub Actions YAML.

The Xcode Cloud post-clone script runs the native command and Bluetooth recovery checks before building.
