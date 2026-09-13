#pragma once
#include <BLEServer.h>
#include <BLEDevice.h>
#include <esp_gap_ble_api.h>
#include <freertos/queue.h>
#include "ProximityController.h"

namespace BluetoothProximity {
struct Peer {
  esp_bd_addr_t address{};
  bool connected = false;
  bool authenticated = false;
  bool reading = false;
  int rssi = 127;
  uint32_t generation = 0;
  uint32_t sampledAt = 0;
};
static_assert(PROXIMITY_PHONE_LIMIT <= CONFIG_BT_ACL_CONNECTIONS, "Too many Bluetooth phone slots");
Peer peers[PROXIMITY_PHONE_LIMIT];
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
QueueHandle_t commands;
struct Telemetry { char json[256]; };
QueueHandle_t telemetry;
bool advertise = false;
uint32_t passkey;

// caller holds lock
Peer *findPeer(const esp_bd_addr_t address) {
  for (auto &peer : peers) {
    if (peer.connected && memcmp(peer.address, address, sizeof(peer.address)) == 0) return &peer;
  }
  return nullptr;
}

class Connections : public BLEServerCallbacks {
  void onConnect(BLEServer *, esp_ble_gatts_cb_param_t *event) override {
    bool accepted = false;
    portENTER_CRITICAL(&lock);
    for (auto &peer : peers) {
      if (peer.connected) continue;
      const uint32_t generation = peer.generation + 1;
      peer = Peer{};
      peer.generation = generation;
      peer.connected = true;
      memcpy(peer.address, event->connect.remote_bda, sizeof(peer.address));
      accepted = true;
      break;
    }
    advertise = true;
    portEXIT_CRITICAL(&lock);
    if (!accepted) esp_ble_gap_disconnect(event->connect.remote_bda);
  }

  void onDisconnect(BLEServer *, esp_ble_gatts_cb_param_t *event) override {
    portENTER_CRITICAL(&lock);
    if (Peer *peer = findPeer(event->disconnect.remote_bda)) {
      peer->connected = peer->authenticated = peer->reading = false;
      ++peer->generation;
    }
    advertise = true;
    portEXIT_CRITICAL(&lock);
  }
};

class Security : public BLESecurityCallbacks {
  uint32_t onPassKeyRequest() override { return passkey; }
  void onPassKeyNotify(uint32_t code) override {
    if (Serial) Serial.printf("Bluetooth pairing code: %06lu\n", code);
  }
  bool onSecurityRequest() override { return true; }
  bool onConfirmPIN(uint32_t) override { return false; }
  void onAuthenticationComplete(esp_ble_auth_cmpl_t result) override {
    const bool authenticated = result.success &&
      (result.auth_mode & ESP_LE_AUTH_REQ_SC_MITM_BOND) == ESP_LE_AUTH_REQ_SC_MITM_BOND;
    portENTER_CRITICAL(&lock);
    if (Peer *peer = findPeer(result.bd_addr)) peer->authenticated = authenticated;
    portEXIT_CRITICAL(&lock);
    if (!authenticated) esp_ble_gap_disconnect(result.bd_addr);
  }
};
Connections connections;
Security securityCallbacks;

void onGap(esp_gap_ble_cb_event_t event, esp_ble_gap_cb_param_t *data) {
  if (event != ESP_GAP_BLE_READ_RSSI_COMPLETE_EVT) return;
  const auto &sample = data->read_rssi_cmpl;
  portENTER_CRITICAL(&lock);
  Peer *peer = findPeer(sample.remote_addr);
  if (peer && peer->authenticated) {
    peer->rssi = sample.status == ESP_BT_STATUS_SUCCESS ? sample.rssi : 127;
    peer->sampledAt = millis();
    peer->reading = true;
  }
  portEXIT_CRITICAL(&lock);
}

void task(void *) {
  ProximityGroup group;
  struct Poll {
    uint32_t generation = 0, requestedAt = 0, lastGoodAt = 0;
    bool pending = false;
  } polls[PROXIMITY_PHONE_LIMIT];
  uint32_t reportedAt = 0;
  unsigned reportedConnections = PROXIMITY_PHONE_LIMIT + 1;
  while (true) {
    Peer current[PROXIMITY_PHONE_LIMIT];
    portENTER_CRITICAL(&lock);
    memcpy(current, peers, sizeof(current));
    for (auto &peer : peers) peer.reading = false;
    const bool restartAdvertising = advertise;
    advertise = false;
    portEXIT_CRITICAL(&lock);
    const uint32_t now = millis();
    DoorAction action;
    unsigned connected = 0;
    for (unsigned i = 0; i < PROXIMITY_PHONE_LIMIT; ++i) {
      auto &peer = current[i];
      auto &poll = polls[i];
      auto &proximity = group.phones[i];
      connected += peer.connected;
      if (peer.generation != poll.generation) {
        proximity.disconnected(action);
        poll = Poll{};
        poll.generation = peer.generation;
        poll.lastGoodAt = now;
      }
      if (!peer.connected || !peer.authenticated) {
        proximity.disconnected(action);
        poll.pending = false;
        continue;
      }
      if (peer.reading && poll.pending) {
        poll.pending = false;
        const bool fresh = uint32_t(now - poll.requestedAt) < 1000;
        const int rssi = fresh ? peer.rssi : 127;
        if (rssi >= -127 && rssi <= 20) poll.lastGoodAt = peer.sampledAt;
        proximity.sample(rssi, action);
      }
      if (poll.pending && uint32_t(now - poll.requestedAt) >= 1000) {
        poll.pending = false;
        proximity.sample(127, action);
      }
      if (uint32_t(now - poll.lastGoodAt) >= 3000) proximity.disconnected(action);
      if (!poll.pending && uint32_t(now - poll.requestedAt) >= proximity.interval()) {
        poll.requestedAt = now;
        poll.pending = esp_ble_gap_read_rssi(peer.address) == ESP_OK;
        if (!poll.pending) proximity.sample(127, action);
      }
    }
    if (group.update(action)) xQueueOverwrite(commands, &action);
    if (restartAdvertising && connected < PROXIMITY_PHONE_LIMIT) BLEDevice::startAdvertising();
    if (telemetry && (connected != reportedConnections ||
        uint32_t(now - reportedAt) >= (connected ? 500 : 60000))) {
      reportedAt = now;
      reportedConnections = connected;
      Telemetry report{};
      int used = snprintf(report.json, sizeof(report.json),
        "{\"uptime_ms\":%lu,\"connected\":%u,\"phones\":[", now, connected);
      bool first = true;
      for (unsigned i = 0; i < PROXIMITY_PHONE_LIMIT; ++i) {
        const auto &peer = current[i];
        if (!peer.connected || !peer.authenticated) continue;
        char rssi[8] = "null";
        if (peer.rssi >= -127 && peer.rssi <= 20 && uint32_t(now - polls[i].lastGoodAt) < 3000 &&
            polls[i].lastGoodAt == peer.sampledAt) snprintf(rssi, sizeof(rssi), "%d", peer.rssi);
        used += snprintf(report.json + used, sizeof(report.json) - used,
          "%s{\"slot\":%u,\"rssi\":%s,\"near\":%s}", first ? "" : ",", i + 1, rssi,
          group.phones[i].active ? "true" : "false");
        first = false;
      }
      snprintf(report.json + used, sizeof(report.json) - used, "]}");
      xQueueOverwrite(telemetry, &report);
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void readTelemetry(String &value) {
  Telemetry report;
  if (telemetry && xQueueReceive(telemetry, &report, 0) == pdTRUE) value = report.json;
}

void begin(QueueHandle_t motorCommands) {
  commands = motorCommands;
  telemetry = xQueueCreate(1, sizeof(Telemetry));
  BLEDevice::init("Ammaar's Door Opener");
  BLEDevice::setSecurityCallbacks(&securityCallbacks);
  BLEDevice::setEncryptionLevel(ESP_BLE_SEC_ENCRYPT_MITM);
  BLEDevice::setCustomGapHandler(onGap);
  passkey = 100000 + esp_random() % 900000;
  BLESecurity security;
  security.setStaticPIN(passkey);
  security.setAuthenticationMode(ESP_LE_AUTH_REQ_SC_MITM_BOND);
  security.setRespEncryptionKey(ESP_BLE_ENC_KEY_MASK | ESP_BLE_ID_KEY_MASK);
  BLEServer *server = BLEDevice::createServer();
  server->setCallbacks(&connections);
  BLEService *service = server->createService(BLEUUID(uint16_t(0x180A)));
  service->createCharacteristic(BLEUUID(uint16_t(0x2A24)), BLECharacteristic::PROPERTY_READ)
    ->setValue("Door Opener");
  service->start();
  BLEDevice::getAdvertising()->addServiceUUID(service->getUUID());
  BLEDevice::getAdvertising()->setScanResponse(true);
  if (xTaskCreate(task, "door-bluetooth", 4096, nullptr, 1, nullptr) == pdPASS) {
    BLEDevice::startAdvertising();
  } else {
    Serial.println("Bluetooth task could not start");
    BLEDevice::deinit();
  }
}
}
