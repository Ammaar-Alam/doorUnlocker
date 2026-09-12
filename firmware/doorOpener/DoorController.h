#pragma once
#include <stdint.h>

// calibrated for the existing motor and string travel
constexpr int PWM_OPEN_PRETENSION = 110;
constexpr int PWM_OPEN_STAGE1 = 170;
constexpr int PWM_OPEN_PEAK = 185;
constexpr uint32_t OPEN_PRET_MS = 70;
constexpr uint32_t OPEN_RAMP1_MS = 120;
constexpr uint32_t OPEN_RAMP2_MS = 60;
constexpr uint32_t OPEN_CRUISE_MS = 600;
constexpr uint32_t OPEN_SOFT_STOP_MS = 120;
constexpr int PWM_CLOSE_TARGET = 100;
constexpr uint32_t CLOSE_RAMP_UP_MS = 100;
constexpr uint32_t CLOSE_HOLD_MS = 450;
constexpr uint32_t CLOSE_RAMP_DOWN_MS = 100;

enum class DoorAction { Open, Close, ForceOpen, ForceClose };

struct DoorController {
  bool open = false;
  bool moving = false;
  bool opening = false;
  int pwm = 0;

  void command(DoorAction action, uint32_t now) {
    const bool force = action == DoorAction::ForceOpen || action == DoorAction::ForceClose;
    const bool wantOpen = action != DoorAction::Close && action != DoorAction::ForceClose;
    if (force && moving) return;
    requestedOpen = wantOpen;
    if (!moving && (open != wantOpen || force)) start(wantOpen, now);
  }

  void update(uint32_t now) {
    if (moving) {
      const uint32_t elapsed = now - startedAt;
      const uint32_t duration = opening
        ? OPEN_PRET_MS + OPEN_RAMP1_MS + OPEN_RAMP2_MS + OPEN_CRUISE_MS + OPEN_SOFT_STOP_MS
        : CLOSE_RAMP_UP_MS + CLOSE_HOLD_MS + CLOSE_RAMP_DOWN_MS;
      if (elapsed >= duration) {
        pwm = 0;
        moving = false;
        open = opening;
        // complete a stroke before reversing to preserve calibrated string travel
        if (requestedOpen != open) start(requestedOpen, now);
      } else {
        pwm = profile(elapsed);
      }
    }
  }

private:
  bool requestedOpen = false;
  uint32_t startedAt = 0;

  void start(bool wantOpen, uint32_t now) {
    moving = true;
    opening = wantOpen;
    startedAt = now;
    pwm = 0;
  }

  static int ramp(int from, int to, uint32_t elapsed, uint32_t duration) {
    if (!duration) return to;
    const float t = float(elapsed) / float(duration);
    const float value = from + (to - from) * t * t * (3 - 2 * t);
    return int(value + 0.5f);
  }

  int profile(uint32_t elapsed) const {
    if (opening) {
      if (elapsed < OPEN_PRET_MS) return ramp(0, PWM_OPEN_PRETENSION, elapsed, OPEN_PRET_MS);
      elapsed -= OPEN_PRET_MS;
      if (elapsed < OPEN_RAMP1_MS) return ramp(PWM_OPEN_PRETENSION, PWM_OPEN_STAGE1, elapsed, OPEN_RAMP1_MS);
      elapsed -= OPEN_RAMP1_MS;
      if (elapsed < OPEN_RAMP2_MS) return ramp(PWM_OPEN_STAGE1, PWM_OPEN_PEAK, elapsed, OPEN_RAMP2_MS);
      elapsed -= OPEN_RAMP2_MS;
      if (elapsed < OPEN_CRUISE_MS) return PWM_OPEN_PEAK;
      return ramp(PWM_OPEN_PEAK, 0, elapsed - OPEN_CRUISE_MS, OPEN_SOFT_STOP_MS);
    }
    if (elapsed < CLOSE_RAMP_UP_MS) return ramp(0, PWM_CLOSE_TARGET, elapsed, CLOSE_RAMP_UP_MS);
    elapsed -= CLOSE_RAMP_UP_MS;
    if (elapsed < CLOSE_HOLD_MS) return PWM_CLOSE_TARGET;
    return ramp(PWM_CLOSE_TARGET, 0, elapsed - CLOSE_HOLD_MS, CLOSE_RAMP_DOWN_MS);
  }
};
