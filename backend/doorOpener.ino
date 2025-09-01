#include "thingProperties.h"

// -- NEW Profile w/ S-curve Power helper to lessen tension on door attachment --
// -- (Helps keep device attached to door by lessening command strip tension) --


// motor control pins
const int IN1 = 2;
const int IN2 = 3;
const int ENA = 9; // uses digital/pwn pins

// LED pins
#define RED_LED LED_GREEN  // correct pin values using nano esp32
#define GREEN_LED LED_RED  // 

// Legacy motor run duration in milliseconds (no longer used for open/close timing)
// const unsigned long motorRunTime = 2000;

// --- Ramp profile (tuned to complete open in ~1 second) ---
// Open PWM targets (with max of 185)
const int PWM_OPEN_PRETENSION = 110;   // gentle take-up to avoid snap
const int PWM_OPEN_STAGE1     = 170;   // progressive load
const int PWM_OPEN_PEAK       = 185;   // known-good maximum

// Open timing (milliseconds). Total ~= 970 ms
const unsigned long OPEN_PRET_MS      = 70;   // 0 -> 110
const unsigned long OPEN_RAMP1_MS     = 120;  // 110 -> 170
const unsigned long OPEN_RAMP2_MS     = 60;   // 170 -> 185
const unsigned long OPEN_CRUISE_MS    = 600;  // hold at 185
const unsigned long OPEN_SOFT_STOP_MS = 120;  // 185 -> 0 (soft stop)

// Close profile (~650ms total)
const int PWM_CLOSE_TARGET              = 100;
const unsigned long CLOSE_RAMP_UP_MS    = 100; // 0 -> 100
const unsigned long CLOSE_HOLD_MS       = 450; // hold at 100
const unsigned long CLOSE_RAMP_DOWN_MS  = 100; // 100 -> 0

// Smooth S-curve ramp helper (ease-in-out) using a simple cubic
// Runs PWM from 'from' to 'to' over 'ramp_ms' with ~20 steps and accurate total delay
static void rampPwm(int from, int to, unsigned long ramp_ms) {
  if (ramp_ms == 0) {
    analogWrite(ENA, to);
    return;
  }

  const int steps = 20; // number of increments (>=1)
  unsigned long step_delay = ramp_ms / steps; // integer division
  unsigned long accrued = 0;

  for (int i = 0; i <= steps; ++i) {
    float t = (float)i / (float)steps;        // 0..1
    float eased = t * t * (3.0f - 2.0f * t);  // cubic ease-in-out
    int val = from + (int)((to - from) * eased + 0.5f);
    if (val < 0) val = 0;
    if (val > 255) val = 255;
    analogWrite(ENA, val);
    if (i < steps) { // don't delay after the last set
      delay(step_delay);
      accrued += step_delay;
    }
  }

  // Make up any remainder to hit the requested total ramp time precisely
  if (accrued < ramp_ms) {
    delay(ramp_ms - accrued);
  }
}

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
  }

void onDoorOpenChange()  {
  Serial.print("Door state changed to: ");
  Serial.println(doorOpen ? "Open" : "Closed");

  if (doorOpen) {
      // Direction: OPEN
      digitalWrite(IN1, HIGH);
      digitalWrite(IN2, LOW);
      digitalWrite(RED_LED, HIGH);  // turn on RED led
      digitalWrite(GREEN_LED, LOW); // turn off GREEN led

      // Soft-start open sequence (~0.97 s total)
      rampPwm(0,   PWM_OPEN_PRETENSION, OPEN_PRET_MS);                 // 0 -> 110 (take up slack gently)
      rampPwm(PWM_OPEN_PRETENSION, PWM_OPEN_STAGE1, OPEN_RAMP1_MS);    // 110 -> 170
      rampPwm(PWM_OPEN_STAGE1,     PWM_OPEN_PEAK,   OPEN_RAMP2_MS);    // 170 -> 185
      delay(OPEN_CRUISE_MS);                                           // hold at 185
      rampPwm(PWM_OPEN_PEAK,       0,               OPEN_SOFT_STOP_MS); // soft stop 185 -> 0

      // Stop
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 0);
  } else {
      // Direction: CLOSE
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, HIGH);
      digitalWrite(RED_LED, LOW);    // turn off RED led
      digitalWrite(GREEN_LED, HIGH); // turn on GREEN led

      // Gentle close (~650 ms total) to preserve existing behavior without shock
      rampPwm(0,               PWM_CLOSE_TARGET,   CLOSE_RAMP_UP_MS);    // 0 -> 100
      delay(CLOSE_HOLD_MS);                                            // hold
      rampPwm(PWM_CLOSE_TARGET, 0,                 CLOSE_RAMP_DOWN_MS);  // 100 -> 0

      // Stop
      digitalWrite(IN1, LOW);
      digitalWrite(IN2, LOW);
      analogWrite(ENA, 0);
  }
}
