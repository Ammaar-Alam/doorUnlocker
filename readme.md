# Smart Dorm Door Control System

This repository contains the code, schematics, and documentation for a smart dorm room door control system. The system uses an Arduino Nano RP2040 Connect, a motor driver (L298N), and a DC motor to remotely open and close a dorm room door. The project leverages Arduino IoT Cloud for remote control via WiFi and Bluetooth Low Energy (BLE).

## Table of Contents

- [Introduction](#introduction)
- [Features](#features)
- [Components](#components)
- [Hardware Setup](#hardware-setup)
- [Software Setup](#software-setup)
- [Arduino Code](#arduino-code)
- [Web Interface](#web-interface)
- [Usage](#usage)
- [Troubleshooting](#troubleshooting)
- [Future Work](#future-work)
- [Acknowledgements](#acknowledgements)

## Introduction

This project was developed to remotely control the opening and closing of a dorm room door using a DC motor and a motor driver. The system is integrated with Arduino IoT Cloud, enabling remote control through a web interface or BLE. The project showcases how IoT can be utilized for smart home automation, specifically for controlling door locks.

## Features

- Remote door control via Arduino IoT Cloud
- BLE support for local control
- Real-time status updates of the door
- Visual feedback with LEDs
- Modern and sleek web interface

## Components

- Arduino Nano RP2040 Connect
- L298N Motor Driver
- 24V DC Motor
- Power Supply (12V and 24V)
- Push Buttons [OPTIONAL]
- LEDs (Red and Green) [OPTIONAL]
- Jumper Wires
- Breadboard
- Fishing Line

## Hardware Setup

1. **Power Supply:**
   - Connect the 24V power supply to the L298N motor driver.
   - Ensure the 5V jumper on the L298N is removed.
   - Use a DC-DC buck converter to step down 24V to 5V for the Arduino Nano RP2040 Connect.

2. **Motor Driver Connections:**
   - Connect the 24V DC motor to the OUT1 and OUT2 terminals of the L298N.
   - Connect IN1 and IN2 on the L298N to digital pins 2 and 3 on the Arduino.
   - Connect the ENA pin to digital pin 9 on the Arduino.
   - Connect the 5V pin on the Arduino to the 5V input on the L298N.

3. **[OPTIONAL] LEDs:**
   - Connect the red LED to a digital pin (e.g., pin 10) with a current-limiting resistor.
   - Connect the green LED to another digital pin (e.g., pin 11) with a current-limiting resistor.

4. **[OPTIONAL] Push Buttons:**
   - Connect one side of the push button to the 5V rail.
   - Connect the other side to a digital pin (e.g., pin 4) with a pull-down resistor to ground.

## Software Setup

1. **Arduino IDE:**
   - Install the Arduino IDE from [here](https://www.arduino.cc/en/software).
   - Install the necessary libraries: WiFiNINA, ArduinoIoTCloud, Arduino_ConnectionHandler.

2. **Arduino IoT Cloud:**
   - Create an account on [Arduino IoT Cloud](https://create.arduino.cc/iot).
   - Define a new device and link it to your Arduino Nano RP2040 Connect.
   - Create a property named `doorOpen` of type `boolean` with read/write permissions.

3. **Web Interface:**
   - The web interface is located in the `public` folder.
   - Update `script.js` to include your Arduino IoT Cloud credentials.

## Arduino Code

The Arduino code is responsible for controlling the motor, updating the door status, and handling BLE connections. The main code is in `door_control.ino` and the BLE-specific code in `ble_control.ino`.

### Example Code Snippet
```cpp
#include <WiFiNINA.h>
#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>

// Replace with your network credentials
const char SSID[] = "puvisitor";
const char PASS[] = ""; // No password for the network

// Arduino IoT Cloud credentials
const char THING_ID[] = "3420f1e7-f743-4d7d-91df-ea746d4f01e0"; // Replace with your Thing ID
const char DEVICE_ID[] = "0f91b9e4-a0db-48b7-8bfd-83ebc031e134"; // Replace with your Device ID

// Declare a property to sync with Arduino Cloud
bool doorOpen;

WiFiConnectionHandler ArduinoIoTPreferredConnection(SSID, PASS);

// Motor control pins
const int IN2 = 2;
const int IN3 = 3;

// LED pins
#define RED_LED 10
#define GREEN_LED 11

// Motor run duration in milliseconds
const unsigned long motorRunTime = 1000;

// Callback function to handle changes in doorOpen
void onDoorOpenChange() {
    Serial.print("Door state changed to: ");
    Serial.println(doorOpen ? "Open" : "Closed");

    if (doorOpen) {
        digitalWrite(IN2, HIGH);
        digitalWrite(IN3, LOW);
        digitalWrite(RED_LED, HIGH); // Turn on red LED
        digitalWrite(GREEN_LED, LOW);  // Turn off green LED
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW);
    } else {
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, HIGH);
        digitalWrite(RED_LED, LOW);  // Turn off red LED
        digitalWrite(GREEN_LED, HIGH); // Turn on green LED
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW);
    }
}

void setup() {
    // Initialize motor control pins
    pinMode(IN2, OUTPUT);
    pinMode(IN3, OUTPUT);
    digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW);

    // Initialize LED pins
    pinMode(RED_LED, OUTPUT);
    pinMode(GREEN_LED, OUTPUT);
    digitalWrite(RED_LED, LOW);
    digitalWrite(GREEN_LED, HIGH); // Default to door closed

    Serial.begin(9600);

    // Connect to WiFi
    Serial.print("Attempting to connect to Network named: ");
    Serial.println(SSID);
    WiFi.begin(SSID);

    while (WiFi.status() != WL_CONNECTED) {
        delay(1000);
        Serial.print(".");
    }

    Serial.println();
    Serial.println("Connected to network");
    Serial.print("SSID: ");
    Serial.println(WiFi.SSID());
    Serial.print("IP Address: ");
    Serial.println(WiFi.localIP());
    Serial.print("Signal strength (RSSI):");
    Serial.print(WiFi.RSSI());
    Serial.println(" dBm");

    // Initialize Arduino IoT Cloud
    ArduinoCloud.begin(ArduinoIoTPreferredConnection);
    setDebugMessageLevel(2);
    ArduinoCloud.printDebugInfo();

    // Define Thing properties
    ArduinoCloud.addProperty(doorOpen, READWRITE, ON_CHANGE, onDoorOpenChange);
}

void loop() {
    ArduinoCloud.update();

    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("Wi-Fi connection lost. Reconnecting...");
        while (WiFi.status() != WL_CONNECTED) {
            delay(1000);
            Serial.print(".");
        }
        Serial.println();
        Serial.println("Reconnected to network");
    }
}
```

## Web Interface

The web interface is built using HTML, CSS, and JavaScript.

### Example `index.html`
```html
<!doctype html>
<html>
<head>
    <title>Smart Dorm Control</title>
    <link rel="stylesheet" href="styles.css">
    <script src="script.js" defer></script>
</head>
<body>
    <header>
        <h1>Ammaar's Dorm Room Controls</h1>
    </header>
    <main>
        <section id="door-control">
            <h2>Door Status</h2>
            <label class="switch">
                <input type="checkbox" id="doorSwitch" onclick="toggleSwitch()">
                <span class="slider"></span>
            </label>
            <div id="doorStatus">
                <span id="statusClosed">Closed</span>
                <span id="statusOpen">Open</span>
            </div>
        </section>
        <section id="about">
            <h2>About This Project</h2>
            <p>This is a personal project I worked on over the summer...</p>
        </section>
        <section id="contact">
            <h2>Connect with Me</h2>
            <p><a href="#">GitHub</a> | <a href="#">LinkedIn</a> | <a href="#">Photography Portfolio</a></p>
        </section>
    </main>
    <footer>
        <p>&copy; 2024-25 Ammaar Alam. All rights reserved.</p>
    </footer>
</body>
</html>
```

## Usage

1. **Power On:**
   - Connect the power supply to the motor driver and Arduino.


Sure, let's continue to build the README file for your project. Here’s the rest of the detailed and comprehensive README file:

---

## Usage

1. **Power On:**
   - Connect the power supply to the motor driver and Arduino.
   - Ensure that the jumper settings on the L298N motor driver are correct. If using the ENA pin, ensure the jumper is removed and connected to the Arduino.

2. **Control via Web Interface:**
   - Open the web interface by navigating to the server's IP address or domain.
   - Use the toggle switch to open or close the door. The status will be updated in real-time.

3. **Control via Bluetooth:**
   - Pair your phone with the Arduino using a Bluetooth terminal app.
   - Send commands (`0` or `1`) to control the door.

## Troubleshooting

1. **WiFi Connectivity Issues:**
   - Ensure that the correct SSID and password are used in the Arduino sketch.
   - Check if the Arduino is within the range of the WiFi network.
   - Verify if the WiFi network allows connections from IoT devices.

2. **Motor Not Spinning:**
   - Check the connections between the motor driver and the motor.
   - Ensure that the power supply voltage matches the motor's requirement.
   - Verify if the ENA pin is connected and not bypassed.

3. **Arduino Not Responding:**
   - Make sure the Arduino is properly powered.
   - Check if the sketch is correctly uploaded to the Arduino.
   - Ensure the serial monitor is closed when not in use to avoid interference.

4. **BLE Connectivity Issues:**
   - Ensure the BLE service is correctly set up in the sketch.
   - Use a reliable BLE terminal app to connect and send commands.

## Future Work

- **Integration with More Sensors:**
  - Add sensors to detect door status more automatically.
  - Integrate other home automation features like lighting control.

- **Enhanced Security:**
  - Implement user authentication for the web interface.
  - Add encryption to BLE communications.

- **Mobile App:**
  - Develop a mobile app for easier control and monitoring.

## Acknowledgements

This project was inspired by various IoT and home automation projects. Special thanks to the Arduino community for the extensive documentation and support.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## Troubleshooting and Problems Encountered

### 1. **Arduino Getting Stuck on `Serial.begin`**
   - **Issue:** The Arduino would get stuck on `Serial.begin` when not connected to a computer.
   - **Solution:** Ensure the Arduino has a proper power source and is not relying on the serial connection for power.

### 2. **Determining Correct Jumper Settings on L298N**
   - **Issue:** The motor was not spinning due to incorrect jumper settings.
   - **Solution:** Refer to the [L298N Motor Driver Module documentation](https://components101.com/modules/l293n-motor-driver-module) for correct jumper settings.

### 3. **Power Supply Issues**
   - **Issue:** Ensuring the Arduino and motor driver could share a power supply without causing voltage issues.
   - **Solution:** Use a DC-DC buck converter to step down voltage where necessary, and ensure all components are rated for the supplied voltage.

### 4. **Connecting to Eduroam WiFi**
   - **Issue:** Connecting the Arduino to the complex Eduroam WiFi network.
   - **Solution:** Use WPA2 Enterprise settings and ensure the correct identity and credentials are used. Refer to [Eduroam setup guides](https://www.eduroam.org).

### 5. **Motor and Driver Compatibility**
   - **Issue:** Motor driver overheating or not working with the motor.
   - **Solution:** Ensure the motor and driver are compatible in terms of voltage and current ratings. Use proper heat sinks if necessary.

### 6. **Soldering VUSB Pads**
   - **Issue:** Enabling 5V output on Arduino Nano RP2040 Connect.
   - **Solution:** Solder the VUSB pads as shown in the Arduino documentation. If soldering tools are not available, seek help from someone experienced.

### 7. **Miscellaneous Hardware Issues**
   - **Issue:** Broken wires, loose connections, and improper use of breadboards.
   - **Solution:** Regularly inspect and replace damaged wires. Ensure all connections are secure and use proper wire stripping and connection techniques.
