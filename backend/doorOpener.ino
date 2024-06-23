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
const int ENA = 9;

// LED pins
#define RED_LED LEDR
#define GREEN_LED LEDG

// Motor run duration in milliseconds
const unsigned long motorRunTime = 1000;

// Callback function to handle changes in doorOpen
void onDoorOpenChange() {
    Serial.print("Door state changed to: ");
    Serial.println(doorOpen ? "Open" : "Closed");

    if (doorOpen) {
        digitalWrite(IN2, HIGH);
        digitalWrite(IN3, LOW);
        analogWrite(ENA, 255); // Full speed
        digitalWrite(RED_LED, HIGH); // Turn on red LED
        digitalWrite(GREEN_LED, LOW);  // Turn off green LED
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW);
        analogWrite(ENA, 0); // Stop the motor
    } else {
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, HIGH);
        analogWrite(ENA, 255); // Full speed
        digitalWrite(RED_LED, LOW);  // Turn off red LED
        digitalWrite(GREEN_LED, HIGH); // Turn on green LED
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN2, LOW);
        digitalWrite(IN3, LOW);
        analogWrite(ENA, 0); // Stop the motor
    }
}

void setup() {
    // Initialize motor control pins
    pinMode(IN2, OUTPUT);
    pinMode(IN3, OUTPUT);
    pinMode(ENA, OUTPUT);
    digitalWrite(IN2, LOW);
    digitalWrite(IN3, LOW);
    analogWrite(ENA, 0);

    // Initialize LED pins
    pinMode(RED_LED, OUTPUT);
    pinMode(GREEN_LED, OUTPUT);
    digitalWrite(RED_LED, LOW);
    digitalWrite(GREEN_LED, HIGH); // Default to door closed

    unsigned long startMillis = millis();
    while (!Serial && (millis() - startMillis) < 3000) {
        // Wait for Serial to connect or timeout after 3 seconds
    }

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
