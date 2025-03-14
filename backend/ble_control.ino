// UPLOAD THIS SKETCH TO THE ARDUINO IF YOU WANNA USE BLE
// (but ble is not as cool as wifi, although MUCH easier to set up)
#include <NimBLEDevice.h>

// BLE service and characteristic UUIDs
#define SERVICE_UUID           "0000ffe0-0000-1000-8000-00805f9b34fb"
#define CHARACTERISTIC_UUID_TX "0000ffe1-0000-1000-8000-00805f9b34fb"  // To notify the client
#define CHARACTERISTIC_UUID_RX "0000ffe2-0000-1000-8000-00805f9b34fb"  // To receive data from client

// Motor control pins
const int IN1 = 2;
const int IN2 = 3;
const int ENA = 9; // Note: PWM pins on ESP32 can be different

// LED pins
#define RED_LED LED_GREEN  // Adjust to the correct pin on your ESP32
#define GREEN_LED LED_RED // Adjust to the correct pin on your ESP32

// Motor run duration in milliseconds
const unsigned long motorRunTime = 1500;

// Declare a property to sync with BLE
bool doorOpen = false;


void onDoorOpenChange() {
    Serial.print("Door state changed to: ");
    Serial.println(doorOpen ? "Open" : "Closed");

    if (doorOpen) {
        digitalWrite(IN1, HIGH);
        digitalWrite(IN2, LOW);
        analogWrite(ENA, 150); // Full speed
        digitalWrite(RED_LED, HIGH); // Turn on red LED
        digitalWrite(GREEN_LED, LOW) ;  // Turn off green LED
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN1, LOW);
        digitalWrite(IN2, LOW);
        analogWrite(ENA, 0); // Stop the motor
    } else {
        digitalWrite(IN1, LOW);
        digitalWrite(IN2, HIGH);
        analogWrite(ENA, 115); // Full speed
        digitalWrite(RED_LED, LOW);  // Turn off red LED
        digitalWrite(GREEN_LED, HIGH); // Turn on green LED
        delay(1000); // Run motor for specified duration
        digitalWrite(IN1, LOW);
        digitalWrite(IN2, LOW);
        analogWrite(ENA, 0); // Stop the motor
    }
}

class MyCallbacks: public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic *pCharacteristic) {
      std::string rxValue = pCharacteristic->getValue();

      if (rxValue.length() > 0) {
        Serial.println("*********");
        Serial.print("Received Value: ");

        for (int i = 0; i < rxValue.length(); i++)
          Serial.print(rxValue[i]);
        Serial.println();

        // Handle received value
        if (rxValue == "1") {
            doorOpen = true;
            onDoorOpenChange();
        } else if (rxValue == "0") {
            doorOpen = false;
            onDoorOpenChange();
        }

        Serial.println();
        Serial.println("*********");
      }
    }
};

void loop() {
    // Nothing to do here
}

void setup() {
    // Initialize motor control pins
    pinMode(IN1, OUTPUT);
    pinMode(IN2, OUTPUT);
    pinMode(ENA, OUTPUT);
    digitalWrite(IN1, LOW);
    digitalWrite(IN2, LOW);
    analogWrite(ENA, 0);

    // Initialize LED pins
    pinMode(RED_LED, OUTPUT);
    pinMode(GREEN_LED, OUTPUT);
    digitalWrite(RED_LED, LOW);
    digitalWrite(GREEN_LED, HIGH); // Default to door closed

    Serial.begin(115200);
    NimBLEDevice::init("Ammaar's DoorBot Arduino");

    // Create BLE Server
    NimBLEServer *pServer = NimBLEDevice::createServer();

    // Create BLE Service
    NimBLEService *pService = pServer->createService(SERVICE_UUID);

    // Create BLE Characteristic
    NimBLECharacteristic *pTxCharacteristic = pService->createCharacteristic(
                                            CHARACTERISTIC_UUID_TX,
                                            NIMBLE_PROPERTY::NOTIFY
                                          );
    NimBLECharacteristic *pRxCharacteristic = pService->createCharacteristic(
                                             CHARACTERISTIC_UUID_RX,
                                             NIMBLE_PROPERTY::WRITE
                                           );

    pRxCharacteristic->setCallbacks(new MyCallbacks());

    // Start the service
    pService->start();

    // Start advertising
    pServer->getAdvertising()->start();
    Serial.println("Waiting for a client connection to notify...");
}
