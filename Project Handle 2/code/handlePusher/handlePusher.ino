/**
Created by Varun Patel / BlueHandCoding
Last Modified: March 20, 2024

https://www.bluehandcoding.com/
**/

#include <ArduinoBLE.h>

#define IN3 14
#define IN4 15

BLEService settingsService("80e20db2-d7ea-4e86-818e-5301ad989396");
BLEByteCharacteristic doorCharacteristic("e87b5fd8-704b-4dff-8f05-2fb9b9ce4922", BLEWrite | BLERead);

bool openDoor = false;
bool incomingDoor;
int turningTime = 2500;

void setup() {
  Serial.begin(9600);
  pinMode(IN3, OUTPUT);
  pinMode(IN4, OUTPUT);

  if (!BLE.begin()) {
    Serial.println("starting Bluetooth® Low Energy module failed!");

    while (1);
  }

  BLE.setDeviceName("Project Door");
  BLE.setLocalName("Project Door");
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
        incomingDoor = doorCharacteristic.value();
        
        if (incomingDoor != openDoor) {
          openDoor = !openDoor;
          
          digitalWrite(IN3, !openDoor);
          digitalWrite(IN4, openDoor);
          delay(turningTime);
          digitalWrite(IN3, LOW);
          digitalWrite(IN4, LOW);
        }
      }

      delay(1000);
    }

    Serial.print(F("Disconnected from central: "));
    Serial.println(central.address());
  }
}