#include "thingProperties.h"

// motor control pins
const int IN1 = 2;
const int IN2 = 3;
const int ENA = 9; // uses digital/pwn pins

// LED pins
#define RED_LED LED_GREEN  // correct pin values using nano esp32
#define GREEN_LED LED_RED  //

// motor run duration in milliseconds
const unsigned long motorRunTime = 1000;

// keepAlive interval in milliseconds
const unsigned long keepAliveInterval = 300000; // 5 mins
unsigned long lastKeepAliveUpdate = 0;

void setup() {
  Serial.begin(9600);
  // delay necessary to avoid program getting hung while waiting for serial w/o PC connection
  delay(1500);

  // defined in thingProperties.h
  initProperties();

  // connecitng to Arduino IoT Cloud
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
  setDebugMessageLevel(4);
  ArduinoCloud.printDebugInfo();

  // initializing motor control pins
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 0);

  // intializing LED pins
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH); // defaults to door closed
}

void loop() {
  ArduinoCloud.update();

  // send keepAlive update to prevent low-activity mode on cloud
  if (millis() - lastKeepAliveUpdate  > keepAliveInterval) {
    keepAlive = !keepAlive;
    ArduinoCloud.update();
    lastKeepAliveUpdate = millis();
  }
}

void onDoorOpenChange()  {
  Serial.print("Door state changed to: ");
  Serial.println(doorOpen ? "Open" : "Closed");

  if (doorOpen) {
      digitalWrite(IN1, HIGH);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 165); // ADJUSTABLE speed; current speed works best as it doesn't allow the motor to overtorque the string
      digitalWrite(RED_LED, HIGH); // turn on RED led
      digitalWrite(GREEN_LED, LOW);  // turn off GREEN led
      delay(motorRunTime); // run motor for specified duration
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 0); // stop the motor
  } else {
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, HIGH);
      analogWrite(ENA, 115); // ADJUSTABLE speed; found to work well w/o allowing motor to over-tangle in opposite way
      digitalWrite(RED_LED, LOW);  // turn off RED led
      digitalWrite(GREEN_LED, HIGH); // turn on GREEN led
      delay(750); // runtime less than OPEN door to prevent string from un-furling (don't have a spool attachment rn)
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 0); // stop the motor
  }
}

void onKeepAliveChange()  {
  // nothing needs to be done; variable is just used to keep the IoT connection active /
  // stop it from entering a low-activity state
}
