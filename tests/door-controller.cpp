#include "../firmware/doorOpener/DoorController.h"
#include <assert.h>
#include <limits.h>

int main() {
  DoorController door;
  door.command(DoorAction::Open, 0);
  assert(door.moving && door.opening && !door.open);
  for (uint32_t t = 0; t < 970; ++t) {
    door.update(t);
    assert(door.pwm >= 0 && door.pwm <= PWM_OPEN_PEAK);
  }
  door.update(970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Open, 3000);
  door.command(DoorAction::Open, 4000);
  door.update(5969);
  assert(door.open && !door.moving);
  door.update(5970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 5970);
  assert(door.moving && !door.opening);
  for (uint32_t t = 5970; t < 6370; ++t) {
    door.update(t);
    assert(door.moving && !door.opening);
    assert(door.pwm >= 0 && door.pwm <= PWM_CLOSE_TARGET);
  }
  door.update(6370);
  assert(!door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 6700);
  assert(!door.moving);

  door.command(DoorAction::Open, 7000);
  door.update(7970);
  door.command(DoorAction::Close, 8100);
  assert(door.moving && !door.opening);
  door.update(8500);
  door.update(14000);
  assert(!door.open && !door.moving);
  door.command(DoorAction::ForceClose, 15000);
  assert(door.moving && !door.opening);
  door.update(15400);
  door.command(DoorAction::ForceClose, 15651);
  assert(door.moving);
  door.update(16051);

  door.command(DoorAction::Open, 17000);
  door.command(DoorAction::Close, 17020);
  door.update(17970);
  assert(door.open && door.moving && !door.opening);
  door.update(18370);
  assert(!door.open && !door.moving);

  door.command(DoorAction::Open, 20000);
  door.command(DoorAction::ForceClose, 20020);
  door.update(20970);
  assert(door.open && !door.moving);
  door.update(25970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 25970);
  assert(door.moving && !door.opening);
  door.update(26370);
  assert(!door.open && !door.moving && door.pwm == 0);

  const uint32_t start = UINT32_MAX - 100;
  door.command(DoorAction::Open, start);
  door.update(uint32_t(start + 970));
  door.update(uint32_t(start + 5970));
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, uint32_t(start + 5970));
  assert(door.moving && !door.opening);
  door.update(uint32_t(start + 6370));
  assert(!door.open && !door.moving);
}
