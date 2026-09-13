#include "../firmware/doorOpener/DoorController.h"
#include "../firmware/doorOpener/ProximityController.h"
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
  assert(door.moving && door.opening);
  door.update(3969);
  assert(door.moving);
  door.update(3970);
  assert(!door.moving);
  door.command(DoorAction::Open, 4000);
  door.update(5969);
  assert(door.open && !door.moving);
  door.update(5970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 5970);
  assert(door.moving && !door.opening);
  for (uint32_t t = 5970; t < 6570; ++t) {
    door.update(t);
    assert(door.moving && !door.opening);
    assert(door.pwm >= 0 && door.pwm <= PWM_CLOSE_TARGET);
  }
  door.update(6570);
  assert(!door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 6600);
  assert(door.moving && !door.opening);
  door.update(7199);
  assert(door.moving);
  door.update(7200);
  assert(!door.moving);

  door.command(DoorAction::Open, 7300);
  door.update(8270);
  door.command(DoorAction::Close, 8300);
  assert(door.moving && !door.opening);
  door.update(8900);
  door.update(14000);
  assert(!door.open && !door.moving);
  door.command(DoorAction::ForceClose, 15000);
  assert(door.moving && !door.opening);
  door.update(15600);
  door.command(DoorAction::ForceClose, 15651);
  assert(door.moving);
  door.update(16251);

  door.command(DoorAction::Open, 17000);
  door.command(DoorAction::Close, 17020);
  door.update(17970);
  assert(door.open && door.moving && !door.opening);
  door.update(18570);
  assert(!door.open && !door.moving);

  door.command(DoorAction::Open, 20000);
  door.command(DoorAction::ForceClose, 20020);
  door.update(20970);
  assert(door.open && !door.moving);
  door.update(25970);
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 25970);
  assert(door.moving && !door.opening);
  door.update(26570);
  assert(!door.open && !door.moving && door.pwm == 0);

  const uint32_t start = UINT32_MAX - 100;
  door.command(DoorAction::Open, start);
  door.update(uint32_t(start + 970));
  door.update(uint32_t(start + 5970));
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, uint32_t(start + 5970));
  assert(door.moving && !door.opening);
  door.update(uint32_t(start + 6570));
  assert(!door.open && !door.moving);

  ProximityController proximity;
  DoorAction action;
  assert(proximity.interval() == 1000);
  assert(!proximity.sample(-80, action));
  assert(proximity.interval() == 100);
  assert(!proximity.sample(-50, action));
  assert(!proximity.sample(127, action));
  assert(!proximity.sample(-45, action));
  assert(!proximity.sample(-51, action));
  assert(!proximity.sample(-50, action));
  assert(proximity.sample(-45, action) && action == DoorAction::ProximityOpen);
  DoorController automatic;
  automatic.command(action, 0);
  automatic.command(action, 100);
  automatic.update(970);
  assert(automatic.open && !automatic.moving);
  automatic.command(action, 1000);
  assert(!automatic.moving);
  for (int i = 0; i < 20; ++i) assert(!proximity.sample(-40, action));
  for (int i = 0; i < 4; ++i) assert(!proximity.sample(-70, action));
  assert(!proximity.sample(-64, action));
  for (int i = 0; i < 4; ++i) assert(!proximity.sample(-65, action));
  assert(proximity.sample(-90, action) && action == DoorAction::ProximityClose);
  assert(proximity.interval() == 1000);
  automatic.command(action, 1000);
  automatic.update(1600);
  assert(!automatic.open && !automatic.moving);
  automatic.command(action, 1600);
  assert(!automatic.moving);
  assert(!proximity.disconnected(action));
  assert(!proximity.sample(-45, action));
  assert(proximity.sample(-45, action));
  assert(proximity.disconnected(action) && action == DoorAction::ProximityClose);
  assert(!proximity.disconnected(action));
  assert(!proximity.sample(-45, action));
  assert(proximity.sample(-45, action));

  ProximityGroup group;
  group.phones[0].sample(-45, action);
  group.phones[0].sample(-45, action);
  assert(group.update(action) && action == DoorAction::ProximityOpen);
  group.phones[1].sample(-40, action);
  group.phones[1].sample(-40, action);
  assert(!group.update(action));
  for (int i = 0; i < 5; ++i) group.phones[0].sample(-70, action);
  assert(!group.update(action));
  group.phones[0].disconnected(action);
  assert(!group.update(action));
  group.phones[1].disconnected(action);
  assert(group.update(action) && action == DoorAction::ProximityClose);
  assert(!group.update(action));
  group.phones[3].sample(-45, action);
  group.phones[3].sample(-45, action);
  assert(group.update(action) && action == DoorAction::ProximityOpen);
  for (int i = 0; i < 5; ++i) group.phones[3].sample(-65, action);
  assert(group.update(action) && action == DoorAction::ProximityClose);
}
