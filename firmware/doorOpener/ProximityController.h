#pragma once
#include <stdint.h>
#include <string.h>

constexpr unsigned PROXIMITY_PHONE_LIMIT = 4;

struct ProximityController {
  uint8_t rememberedAddress[6]{};
  bool connected = false;
  bool seen = false;
  bool armed = false;
  int lastRssi = -127;
  uint32_t disconnectedAt = 0;
  uint32_t firstNearAt = 0;
  bool nearPending = false;
  int peak = -127;
  int previousPeak = -127;
  uint32_t peakSince = 0;

  // strongest reading over the last one to two seconds since fading and Wi-Fi sharing only pull RSSI down
  int steady() const { return peak > previousPeak ? peak : previousPeak; }

  uint32_t interval() const { return armed || lastRssi >= -80 ? 100 : 1000; }

  bool remembers(const uint8_t *address) const {
    return seen && memcmp(rememberedAddress, address, sizeof(rememberedAddress)) == 0;
  }

  void authentication(bool success, const uint8_t *address, uint32_t connectedAt) {
    if (!success) return;
    if (!remembers(address)) {
      *this = ProximityController{};
      memcpy(rememberedAddress, address, sizeof(rememberedAddress));
    }
    connection(true, connectedAt);
  }

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
    lastRssi = peak = previousPeak = -127;
  }

  bool sample(int rssi, uint32_t now) {
    if (rssi < -127 || rssi > 20) return false;
    lastRssi = rssi;
    if (uint32_t(now - peakSince) >= 1000) {
      previousPeak = uint32_t(now - peakSince) < 2000 ? peak : -127;
      peak = -127;
      peakSince = now;
    }
    if (rssi > peak) peak = rssi;
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
