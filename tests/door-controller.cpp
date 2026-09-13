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
  for (uint32_t t = 5970; t < 6520; ++t) {
    door.update(t);
    assert(door.moving && !door.opening);
    assert(door.pwm >= 0 && door.pwm <= PWM_CLOSE_TARGET);
  }
  door.update(6520);
  assert(!door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, 6600);
  assert(door.moving && !door.opening);
  door.update(7149);
  assert(door.moving);
  door.update(7150);
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
  door.update(26520);
  assert(!door.open && !door.moving && door.pwm == 0);

  const uint32_t start = UINT32_MAX - 100;
  door.command(DoorAction::Open, start);
  door.update(uint32_t(start + 970));
  door.update(uint32_t(start + 5970));
  assert(door.open && !door.moving && door.pwm == 0);
  door.command(DoorAction::Close, uint32_t(start + 5970));
  assert(door.moving && !door.opening);
  door.update(uint32_t(start + 6520));
  assert(!door.open && !door.moving);

  const uint8_t owner[6] = {1, 2, 3, 4, 5, 6};
  const uint8_t visitor[6] = {6, 5, 4, 3, 2, 1};
  ProximityController remembered;
  remembered.authentication(false, visitor, 0);
  assert(!remembered.seen);
  remembered.authentication(true, owner, 100);
  remembered.connection(false, 200);
  remembered.authentication(false, visitor, 1000);
  remembered.connection(false, 2000);
  assert(remembered.remembers(owner) && !remembered.remembers(visitor));
  assert(remembered.disconnectedAt == 200);
  remembered.authentication(true, owner, 15200);
  assert(remembered.armed);
  remembered.connection(false, 15300);
  remembered.authentication(true, visitor, 31000);
  assert(remembered.remembers(visitor) && !remembered.remembers(owner));
  assert(!remembered.armed);

  ProximityController proximity;
  proximity.connection(true, 0);
  assert(!proximity.sample(-40, 100));
  assert(!proximity.sample(-40, 200));
  proximity.connection(false, 300);
  proximity.connection(true, 15299);
  assert(!proximity.armed);
  proximity.connection(false, 16000);
  proximity.connection(true, 31000);
  assert(proximity.armed);
  assert(!proximity.sample(-65, 31100));
  // a brief reconnect preserves the arrival but discards the old reading
  proximity.connection(false, 31200);
  proximity.connection(true, 31300);
  assert(proximity.armed);
  assert(!proximity.sample(-65, 31400));
  assert(!proximity.sample(-65, 31400));
  assert(!proximity.sample(-90, 31500));
  assert(!proximity.sample(127, 31600));
  assert(proximity.sample(-64, 32400));
  for (uint32_t t = 32500; t < 40000; t += 100) assert(!proximity.sample(-40, t));
  proximity.connection(false, 40000);
  proximity.connection(true, 54999);
  assert(!proximity.armed);
  proximity.connection(false, 55000);
  proximity.connection(true, 70000);
  assert(proximity.armed);
  assert(!proximity.sample(-65, 70100));
  assert(!proximity.sample(-65, 71101));
  assert(proximity.sample(-65, 71201));
  assert(proximity.interval() == 100);
  proximity.sample(-90, 72000);
  assert(proximity.interval() == 1000);

  ProximityController other;
  other.connection(true, 0);
  other.connection(false, 1);
  other.connection(true, 15001);
  assert(other.armed && !proximity.armed);
  other.connection(false, start);
  other.connection(true, uint32_t(start + 15000));
  assert(!other.sample(-65, uint32_t(start + 15100)));
  assert(other.sample(-65, uint32_t(start + 15200)));

  other.connection(false, UINT32_MAX - 16000);
  other.connection(true, UINT32_MAX - 1000);
  assert(!other.sample(-65, UINT32_MAX - 50));
  assert(other.sample(-65, 49));

  DoorController automatic;
  automatic.command(DoorAction::ProximityOpen, 0);
  automatic.command(DoorAction::ProximityOpen, 100);
  automatic.update(970);
  assert(automatic.open && !automatic.moving && automatic.pwm == 0);
  automatic.command(DoorAction::ProximityOpen, 1000);
  automatic.update(4969);
  assert(automatic.open && !automatic.moving);
  automatic.update(4970);
  assert(automatic.moving && !automatic.opening);
  automatic.command(DoorAction::ProximityOpen, 5000);
  automatic.update(5519);
  assert(automatic.moving);
  automatic.update(5520);
  assert(!automatic.open && !automatic.moving);
  automatic.update(20000);
  assert(!automatic.moving);

  // manual commands take ownership of the hold and preserve repeat strokes
  automatic.command(DoorAction::ProximityOpen, 21000);
  automatic.update(21970);
  automatic.command(DoorAction::Open, 22000);
  automatic.update(22970);
  automatic.update(30000);
  assert(automatic.open && !automatic.moving);
  automatic.command(DoorAction::ProximityOpen, 31000);
  automatic.update(36000);
  assert(automatic.open && !automatic.moving);
  automatic.command(DoorAction::Close, 37000);
  automatic.update(37550);
  automatic.command(DoorAction::ProximityOpen, 38000);
  automatic.command(DoorAction::Close, 38100);
  automatic.update(38970);
  assert(automatic.moving && !automatic.opening);
  automatic.update(39520);
  automatic.update(45000);
  assert(!automatic.open && !automatic.moving);

  // the hold starts at observed completion, not when opening was requested
  automatic.command(DoorAction::ProximityOpen, start);
  automatic.update(uint32_t(start + 1000));
  automatic.update(uint32_t(start + 4999));
  assert(automatic.open && !automatic.moving);
  automatic.update(uint32_t(start + 5000));
  assert(automatic.moving && !automatic.opening);
  automatic.update(uint32_t(start + 5550));
  assert(!automatic.open && !automatic.moving);
}
