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
Peer peer;
portMUX_TYPE lock = portMUX_INITIALIZER_UNLOCKED;
QueueHandle_t commands;
uint32_t passkey;

class Connections : public BLEServerCallbacks {
  void onConnect(BLEServer *, esp_ble_gatts_cb_param_t *event) override {
    portENTER_CRITICAL(&lock);
    const uint32_t generation = peer.generation + 1;
    peer = Peer{};
    peer.generation = generation;
    peer.connected = true;
    memcpy(peer.address, event->connect.remote_bda, sizeof(peer.address));
    portEXIT_CRITICAL(&lock);
  }

  void onDisconnect(BLEServer *) override {
    portENTER_CRITICAL(&lock);
    peer.connected = peer.authenticated = peer.reading = false;
    ++peer.generation;
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
    if (peer.connected && memcmp(peer.address, result.bd_addr, sizeof(peer.address)) == 0) {
      peer.authenticated = authenticated;
    }
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
  if (peer.connected && peer.authenticated &&
      memcmp(peer.address, sample.remote_addr, sizeof(peer.address)) == 0) {
    peer.rssi = sample.status == ESP_BT_STATUS_SUCCESS ? sample.rssi : 127;
    peer.sampledAt = millis();
    peer.reading = true;
  }
  portEXIT_CRITICAL(&lock);
}

void task(void *) {
  ProximityController proximity;
  uint32_t generation = 0, requestedAt = 0, lastGoodAt = 0;
  bool pending = false;
  while (true) {
    portENTER_CRITICAL(&lock);
    Peer current = peer;
    peer.reading = false;
    portEXIT_CRITICAL(&lock);
    const uint32_t now = millis();
    DoorAction action;
    if (current.generation != generation) {
      if (proximity.disconnected(action)) xQueueOverwrite(commands, &action);
      generation = current.generation;
      pending = false;
      lastGoodAt = now;
      if (!current.connected) BLEDevice::startAdvertising();
    }
    if (current.connected && current.authenticated) {
      if (current.reading && pending) {
        pending = false;
        const bool fresh = uint32_t(now - requestedAt) < 1000;
        const int rssi = fresh ? current.rssi : 127;
        if (rssi >= -127 && rssi <= 20) lastGoodAt = current.sampledAt;
        if (proximity.sample(rssi, action)) xQueueOverwrite(commands, &action);
      }
      if (pending && uint32_t(now - requestedAt) >= 1000) {
        pending = false;
        proximity.sample(127, action);
      }
      if (uint32_t(now - lastGoodAt) >= 3000) {
        if (proximity.disconnected(action)) xQueueOverwrite(commands, &action);
      }
      if (!pending && uint32_t(now - requestedAt) >= proximity.interval()) {
        requestedAt = now;
        pending = esp_ble_gap_read_rssi(current.address) == ESP_OK;
        if (!pending) proximity.sample(127, action);
      }
    }
    vTaskDelay(pdMS_TO_TICKS(20));
  }
}

void begin(QueueHandle_t motorCommands) {
  commands = motorCommands;
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
