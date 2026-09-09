#include "../firmware/doorOpener/DoorController.h"
#include <assert.h>
#include <limits.h>

int main() {
  DoorController door;
  door.command(DoorAction::Pulse, 0);
  assert(door.moving && door.opening && !door.open);
  for (uint32_t t = 0; t < 970; ++t) {
    door.update(t);
    assert(door.pwm >= 0 && door.pwm <= PWM_OPEN_PEAK);
  }
  door.update(970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Pulse, 3000);
  door.command(DoorAction::Open, 4000);
  door.update(5969);
  assert(door.open && !door.moving);
  door.update(5970);
  assert(door.moving && !door.opening);
  door.update(6620);
  assert(!door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 6700);
  assert(!door.moving);

  door.command(DoorAction::Pulse, 7000);
  door.update(7970);
  door.command(DoorAction::Close, 8100);
  assert(door.moving && !door.opening);
  door.update(8750);
  door.update(14000);
  assert(!door.open && !door.moving);
  door.command(DoorAction::ForceClose, 15000);
  assert(door.moving && !door.opening);
  door.update(15650);
  door.command(DoorAction::ForceClose, 15651);
  assert(door.moving);
  door.update(16301);

  door.command(DoorAction::Open, 17000);
  door.command(DoorAction::Close, 17020);
  door.update(17970);
  assert(door.open && door.moving && !door.opening);
  door.update(18620);
  assert(!door.open && !door.moving);

  const uint32_t start = UINT32_MAX - 100;
  door.command(DoorAction::Pulse, start);
  door.update(uint32_t(start + 970));
  door.update(uint32_t(start + 5970));
  assert(door.moving && !door.opening);
  door.update(uint32_t(start + 6620));
  assert(!door.open && !door.moving);
}
