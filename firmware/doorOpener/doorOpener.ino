#include "thingProperties.h"
#include "DoorController.h"
#include <stdlib.h>
#include <atomic>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

const int IN1 = 2;
const int IN2 = 3;
const int ENA = 9;
#define RED_LED LED_GREEN
#define GREEN_LED LED_RED

QueueHandle_t commands;
std::atomic<bool> reportedOpen{false};
bool cloudSynced = false;
String lastCommand;

void onCloudSync() {
  lastCommand = doorCommand;
  doorOpen = reportedOpen.load();
  cloudSynced = true;
}

void onCloudDisconnect() {
  cloudSynced = false;
}

// motor timing runs independently of cloud and WiFi calls
void motorTask(void *) {
  DoorController motor;
  int direction = 0;
  while (true) {
    DoorAction action;
    if (xQueueReceive(commands, &action, 0) == pdTRUE) motor.command(action, millis());
    motor.update(millis());
    const int nextDirection = !motor.moving ? 0 : motor.opening ? 1 : -1;
    if (nextDirection != direction) {
      analogWrite(ENA, 0);
      digitalWrite(IN1, nextDirection == 1 ? HIGH : LOW);
      digitalWrite(IN2, nextDirection == -1 ? HIGH : LOW);
      direction = nextDirection;
      if (Serial) Serial.printf("%lu motor %s\n", millis(), direction > 0 ? "opening" : direction < 0 ? "closing" : "stopped");
    }
    analogWrite(ENA, motor.pwm);
    reportedOpen.store(motor.open);
    digitalWrite(RED_LED, motor.open ? HIGH : LOW);
    digitalWrite(GREEN_LED, motor.open ? LOW : HIGH);
    vTaskDelay(1);
  }
}

void setup() {
  pinMode(IN1, OUTPUT);
  pinMode(IN2, OUTPUT);
  pinMode(ENA, OUTPUT);
  digitalWrite(IN1, LOW);
  digitalWrite(IN2, LOW);
  analogWrite(ENA, 0);
  pinMode(RED_LED, OUTPUT);
  pinMode(GREEN_LED, OUTPUT);
  digitalWrite(RED_LED, LOW);
  digitalWrite(GREEN_LED, HIGH);
  Serial.begin(9600);
  commands = xQueueCreate(1, sizeof(DoorAction));
  if (!commands || xTaskCreate(motorTask, "door-motor", 4096, nullptr, 2, nullptr) != pdPASS) {
    Serial.println("Motor controller could not start");
    while (true) delay(1000);
  }
  initProperties();
  ArduinoCloud.addCallback(ArduinoIoTCloudEvent::SYNC, onCloudSync);
  ArduinoCloud.addCallback(ArduinoIoTCloudEvent::DISCONNECT, onCloudDisconnect);
  ArduinoCloud.begin(ArduinoIoTPreferredConnection);
}

void loop() {
  ArduinoCloud.update();
  doorOpen = reportedOpen.load();
}

void onDoorCommandChange() {
  if (!cloudSynced || doorCommand == lastCommand || doorCommand.length() > 100) return;
  lastCommand = doorCommand;
  const int separator = doorCommand.indexOf(':');
  const int end = doorCommand.indexOf(':', separator + 1);
  if (separator <= 0 || end <= separator + 1) return;
  const String expiryText = doorCommand.substring(separator + 1, end);
  char *tail;
  const unsigned long expiresAt = strtoul(expiryText.c_str(), &tail, 10);
  const unsigned long now = ArduinoCloud.getInternalTime();
  if (*tail || !now || expiresAt < now || expiresAt - now > 30) return;
  const String action = doorCommand.substring(0, separator);
  DoorAction command;
  if (action == "open") command = DoorAction::Open;
  else if (action == "close") command = DoorAction::Close;
  else if (action == "pulse") command = DoorAction::Pulse;
  else if (action == "force-open") command = DoorAction::ForceOpen;
  else if (action == "force-close") command = DoorAction::ForceClose;
  else return;
  if (Serial) Serial.printf("%lu command %s\n", millis(), action.c_str());
  xQueueOverwrite(commands, &command);
}
