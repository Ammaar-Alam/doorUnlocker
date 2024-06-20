#include <WiFiNINA.h>
#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>

// Replace with your network credentials
const char SSID[] = "puvisitor";
const char PASS[] = ""; // No password for the network

// Replace with the authenticated device's MAC address (from your iPhone's WiFi details for puvisitor)

// Arduino IoT Cloud credentials
const char THING_ID[] = "3420f1e7-f743-4d7d-91df-ea746d4f01e0"; // Replace with your Thing ID
const char DEVICE_ID[] = "0f91b9e4-a0db-48b7-8bfd-83ebc031e134"; // Replace with your Device ID

// Declare a property to sync with Arduino Cloud
String doorCommand;

WiFiConnectionHandler ArduinoIoTPreferredConnection(SSID, PASS);

// Callback function to handle changes in doorCommand
void onDoorCommandChange() {
    Serial.print("Door command changed to: ");
    Serial.println(doorCommand);

    if (doorCommand == "open") {
        digitalWrite(LEDR, HIGH); // Turn on red LED
        digitalWrite(LEDG, LOW);  // Turn off green LED
    } else if (doorCommand == "close") {
        digitalWrite(LEDR, LOW);  // Turn off red LED
        digitalWrite(LEDG, HIGH); // Turn on green LED
    }
}

void setup() {
    Serial.begin(9600);
    while (!Serial) { }

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
    ArduinoCloud.addProperty(doorCommand, READWRITE, ON_CHANGE, onDoorCommandChange);

    // Initialize pins
    pinMode(LEDR, OUTPUT);
    pinMode(LEDG, OUTPUT);
    digitalWrite(LEDR, LOW); // Ensure LEDs are off initially
    digitalWrite(LEDG, LOW);
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
