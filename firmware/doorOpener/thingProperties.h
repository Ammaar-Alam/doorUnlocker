#pragma once
#include "arduino_secrets.h"
#include <ArduinoIoTCloud.h>
#include <Arduino_ConnectionHandler.h>

const char DEVICE_LOGIN_NAME[] = "185a1726-9851-42bd-8c23-8ecd6f1e05ed";
void onDoorCommandChange();
bool doorOpen;
String doorCommand;

void initProperties() {
  ArduinoCloud.setBoardId(DEVICE_LOGIN_NAME);
  ArduinoCloud.setSecretDeviceKey(SECRET_DEVICE_KEY);
  ArduinoCloud.addProperty(doorOpen, READ, ON_CHANGE, NULL);
  ArduinoCloud.addProperty(doorCommand, READWRITE, ON_CHANGE, onDoorCommandChange);
}

WiFiConnectionHandler ArduinoIoTPreferredConnection(SECRET_SSID, SECRET_OPTIONAL_PASS);
