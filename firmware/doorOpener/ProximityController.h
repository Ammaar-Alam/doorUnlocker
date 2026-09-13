#pragma once
#include <stdint.h>

constexpr unsigned PROXIMITY_PHONE_LIMIT = 4;

struct ProximityController {
  bool connected = false;
  bool seen = false;
  bool armed = false;
  int lastRssi = -127;
  uint32_t disconnectedAt = 0;
  uint32_t firstNearAt = 0;
  bool nearPending = false;

  uint32_t interval() const { return lastRssi >= -80 ? 100 : 1000; }

  void connection(bool present, uint32_t now) {
    if (present == connected) return;
    if (present) {
      if (seen && uint32_t(now - disconnectedAt) >= 15000) armed = true;
      seen = true;
    } else {
      disconnectedAt = now;
    }
    connected = present;
    nearPending = false;
    lastRssi = -127;
  }

  bool sample(int rssi, uint32_t now) {
    if (rssi < -127 || rssi > 20) return false;
    lastRssi = rssi;
    if (!connected || !armed || rssi < -65) return false;
    if (nearPending && now != firstNearAt && uint32_t(now - firstNearAt) <= 1000) {
      armed = nearPending = false;
      return true;
    }
    firstNearAt = now;
    nearPending = true;
    return false;
  }
};
