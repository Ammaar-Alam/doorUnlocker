# Door Opener for iOS

Open `DoorOpener.xcodeproj` in Xcode. Select your signing team and an available bundle identifier in Signing & Capabilities. The app supports iPhone on iOS 17 or later. Archive for an iOS device to distribute through TestFlight; increment the build number for subsequent uploads.

The Door tab uses native controls and the existing HTTP API. The mechanism link opens the full 3D website in Safari. Door and Logs share the native login session; password protection follows the server rules. Status is reported by the controller, not measured by a position sensor. The Connection tab uses CoreBluetooth background central mode, state restoration and system auto-reconnect. Enable Auto-connect and select the door once. Initial pairing requires the six-digit code printed by the production firmware to USB Serial at 9600 baud. Pair near the controller with the mechanism ready to move. Turn Auto-connect off to cancel both the connection and pending reconnect. To replace a saved controller, choose Forget door, enable Auto-connect, and select the new door. This clears the app selection, not the iOS Bluetooth bond. The firmware protects the model read with authenticated encryption, so the app waits for pairing before showing Connected.

If iOS reports that the peer removed pairing information, the app stops automatic retries and displays pairing recovery instructions. Forget the accessory in iPhone Settings → Bluetooth, then select it again in the app and complete pairing. Forget door clears the app selection; it cannot remove the system Bluetooth bond. Ordinary link loss continues to use iOS auto-reconnect, with a retry when iOS is not already reconnecting.

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
