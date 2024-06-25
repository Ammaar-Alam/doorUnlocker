#include "thingProperties.h"

// Motor control pins
const int IN1 = 2;
const int IN2 = 3;
const int ENA = 9; // Note: PWM pins on ESP32 can be different

// LED pins
#define RED_LED LED_GREEN  // Adjust to the correct pin on your ESP32
#define GREEN_LED LED_RED  // Adjust to the correct pin on your ESP32

// Motor run duration in milliseconds
const unsigned long motorRunTime = 1500;

void setup() {
  // Initialize serial and wait for port to open:
  Serial.begin(9600);
  // This delay gives the chance to wait for a Serial Monitor without blocking if none is found
  delay(1500);

  // Defined in thingProperties.h
  initProperties();

  // Connect to Arduino IoT Cloud
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);

  /*
     The following function allows you to obtain more information
     related to the state of network and IoT Cloud connection and errors
     the higher number the more granular information you’ll get.
     The default is 0 (only errors).
     Maximum is 4
  */
  setDebugMessageLevel(2);
  ArduinoCloud.printDebugInfo();

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
}

void loop() {
  ArduinoCloud.update();
  // Your code here
}

/*
  Since DoorOpen is READ_WRITE variable, onDoorOpenChange() is
  executed every time a new value is received from IoT Cloud.
*/
void onDoorOpenChange()  {
  Serial.print("Door state changed to: ");
  Serial.println(doorOpen ? "Open" : "Closed");

  if (doorOpen) {
      digitalWrite(IN1, HIGH);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 150); // Full speed
      digitalWrite(RED_LED, HIGH); // Turn on red LED
      digitalWrite(GREEN_LED, LOW);  // Turn off green LED
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
