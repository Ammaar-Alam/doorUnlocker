#include <ArduinoBLE.h>
#include <WiFiNINA.h>


#define IN3 2
#define IN4 3
#define ENB 9

BLEService settingsService("Alam's Door Arduino");
BLEByteCharacteristic doorCharacteristic("Open or Close Door", BLEWrite | BLERead);

bool doorOpen = false;
bool incomingDoor;
const unsigned long motorRunTime = 1000;

void onDoorOpenChange() {
    Serial.print("Door state changed to: ");
    Serial.println(doorOpen ? "Open" : "Closed");

    if (doorOpen) {
        digitalWrite(IN3, HIGH);
        digitalWrite(IN4, LOW);
        analogWrite(ENB, 255); // Full speed
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN3, LOW);
        digitalWrite(IN4, LOW);
        analogWrite(ENB, 0); // Stop the motor
    } else {
        digitalWrite(IN3, LOW);
        digitalWrite(IN4, HIGH);
        analogWrite(ENB, 255); // Full speed
        delay(motorRunTime); // Run motor for specified duration
        digitalWrite(IN3, LOW);
        digitalWrite(IN4, LOW);
        analogWrite(ENB, 0); // Stop the motor
    }
}

void setup() {
    unsigned long startMillis = millis();
    while (!Serial && (millis() - startMillis) < 3000) {
        // Wait for Serial to connect or timeout after 3 seconds
    }

    Serial.begin(9600);
    pinMode(IN3, OUTPUT);
    pinMode(IN4, OUTPUT);
    pinMode(ENB, OUTPUT);
    digitalWrite(IN3, LOW);
    digitalWrite(IN4, LOW);
    analogWrite(ENB, 0);

    if (!BLE.begin()) {
        Serial.println("starting Bluetooth® Low Energy module failed!");
        while (1);
    }

    BLE.setDeviceName("Smart Door");
    BLE.setLocalName("Smart Door");
    BLE.setAdvertisedService(settingsService);

    settingsService.addCharacteristic(doorCharacteristic);
    BLE.addService(settingsService);

    doorCharacteristic.writeValue(0);
    BLE.advertise();

    Serial.println("Project Door Online");
}

void loop() {
    BLEDevice central = BLE.central();

    if (central) {
        Serial.print("Connected to central: ");
        Serial.println(central.address());

        while (central.connected()) {
            if (doorCharacteristic.written()) {
                doorOpen = doorCharacteristic.value();
                onDoorOpenChange();
            }
            delay(1000);
        }

        Serial.print(F("Disconnected from central: "));
        Serial.println(central.address());
    }
}
