#pragma once
#include "DoorController.h"

struct ProximityController {
  bool active = false;
  int lastRssi = -127;
  unsigned nearCount = 0;
  unsigned farCount = 0;

  uint32_t interval() const { return active || lastRssi >= -80 ? 100 : 1000; }

  bool sample(int rssi, DoorAction &action) {
    if (rssi < -127 || rssi > 20) {
      nearCount = farCount = 0;
      return false;
    }
    lastRssi = rssi;
    nearCount = !active && rssi >= -50 ? nearCount + 1 : 0;
    farCount = active && rssi <= -65 ? farCount + 1 : 0;
    if (nearCount == 2 || farCount == 5) {
      active = nearCount == 2;
      nearCount = farCount = 0;
      action = active ? DoorAction::ProximityOpen : DoorAction::ProximityClose;
      return true;
    }
    return false;
  }

  bool disconnected(DoorAction &action) {
    const bool wasActive = active;
    *this = ProximityController{};
    action = DoorAction::ProximityClose;
    return wasActive;
  }
};

constexpr unsigned PROXIMITY_PHONE_LIMIT = 4;

struct ProximityGroup {
  ProximityController phones[PROXIMITY_PHONE_LIMIT];
  bool active = false;

  bool update(DoorAction &action) {
    bool nearby = false;
    for (const auto &phone : phones) nearby |= phone.active;
    if (nearby == active) return false;
    active = nearby;
    action = active ? DoorAction::ProximityOpen : DoorAction::ProximityClose;
    return true;
  }
};
