import * as THREE from 'three';
import { STLLoader } from '/vendor/loaders/STLLoader.js';
import { OrbitControls } from '/vendor/controls/OrbitControls.js';
import { controlWiring } from './wiring.js';

const view = document.getElementById('mechanism-view');
const canvas = document.getElementById('mechanism-canvas');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

async function createMechanism() {
  let pendingCommand;
  document.addEventListener('door-command', event => {
    const command = { ...event.detail, start: performance.now() };
    if (canvas.dataset.ready === 'true') applyCommand(command);
    else pendingCommand = command;
  });
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0xfafcfd, 0);
  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-150, 150, 115, -115, .1, 1500);
  camera.position.set(125, 80, 480);
  camera.lookAt(0, 24, 0);
  const controls = new OrbitControls(camera, canvas);
  canvas.style.touchAction = 'pan-y';
  controls.target.set(0, 24, 0);
  controls.enablePan = false;
  controls.enableZoom = false;
  controls.minPolarAngle = Math.PI * .23;
  controls.maxPolarAngle = Math.PI * .65;
  controls.minAzimuthAngle = -.55;
  controls.maxAzimuthAngle = .85;
  controls.update();
  controls.saveState();

  const silver = new THREE.MeshStandardMaterial({ color: 0xc5cdcf, metalness: .55, roughness: .51 });
  const bright = new THREE.MeshStandardMaterial({ color: 0xe0e5e4, metalness: .55, roughness: .37 });
  const black = new THREE.MeshStandardMaterial({ color: 0x303638, metalness: .38, roughness: .58 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x4f5a5f, metalness: .5, roughness: .62 });
  const print = new THREE.MeshStandardMaterial({ color: 0xc4424b, metalness: .02, roughness: .82 });
  const spool = new THREE.MeshStandardMaterial({ color: 0xe5535d, metalness: .02, roughness: .78 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe7e8e2, roughness: .86 });
  const redBoard = new THREE.MeshStandardMaterial({ color: 0xa33835, roughness: .72 });
  const greenBoard = new THREE.MeshStandardMaterial({ color: 0x26645b, roughness: .7 });
  const terminalBlue = new THREE.MeshStandardMaterial({ color: 0x327493, roughness: .65 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xad976b, metalness: .65, roughness: .4 });
  const edgeMaterial = new THREE.LineBasicMaterial({ color: 0x54626a, transparent: true, opacity: .32 });
  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0x668b9f, roughness: .8 });
  scene.add(new THREE.HemisphereLight(0xfaffff, 0x8e979c, 2.7));
  const key = new THREE.DirectionalLight(0xffffff, 3.1);
  key.position.set(-100, 170, 250);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -200, right: 200, top: 200, bottom: -200, near: 1, far: 700 });
  key.shadow.bias = -.0006;
  scene.add(key);
  const fill = new THREE.DirectionalLight(0xdceafb, 1.4);
  fill.position.set(120, -50, 150);
  scene.add(fill);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(700, 700), new THREE.ShadowMaterial({ opacity: .075 }));
  wall.position.z = -20;
  wall.receiveShadow = true;
  scene.add(wall);

  function mesh(geometry, material, parent, x = 0, y = 0, z = 0, outline = false) {
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    if (outline) object.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 35), edgeMaterial));
    parent.add(object);
    return object;
  }
  function cylinder(radius, length, material, parent, x, y, z) {
    const object = mesh(new THREE.CylinderGeometry(radius, radius, length, 48), material, parent, x, y, z);
    object.rotation.x = Math.PI / 2;
    return object;
  }
  function roundedBox(width, height, depth, radius = 2) {
    const shape = new THREE.Shape();
    const x = -width / 2, y = -height / 2;
    shape.moveTo(x + radius, y);
    shape.lineTo(x + width - radius, y);
    shape.quadraticCurveTo(x + width, y, x + width, y + radius);
    shape.lineTo(x + width, y + height - radius);
    shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    shape.lineTo(x + radius, y + height);
    shape.quadraticCurveTo(x, y + height, x, y + height - radius);
    shape.lineTo(x, y + radius);
    shape.quadraticCurveTo(x, y, x + radius, y);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .55, bevelThickness: .55, curveSegments: 5 });
    geometry.translate(0, 0, -depth / 2);
    return geometry;
  }
  function screw(parent, x, y, z, radius = 2) {
    cylinder(radius, 1.4, bright, parent, x, y, z);
    mesh(new THREE.BoxGeometry(radius * 1.15, .43, .3), dark, parent, x, y, z + .78);
  }
  function tube(points, radius, material, parent) {
    const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)));
    const wire = mesh(new THREE.TubeGeometry(curve, 40, radius, 5, false), material, parent);
    wire.userData.curve = curve;
    return wire;
  }
  function led(parent, x, y, z, color) {
    mesh(new THREE.BoxGeometry(2.1, 1.3, .45), silver, parent, x, y, z);
    mesh(new THREE.BoxGeometry(1.5, 1.3, .5), white, parent, x, y, z + .05);
    const light = new THREE.PointLight(color, 65, 12, 2);
    const lens = new THREE.MeshBasicMaterial();
    lens.color = light.color;
    mesh(new THREE.BoxGeometry(1.3, .9, .18), lens, parent, x, y, z + .4).castShadow = false;
    mesh(new THREE.BoxGeometry(.65, .4, .05), new THREE.MeshBasicMaterial({ color: 0xffffff }), parent, x, y, z + .52).castShadow = false;
    light.position.set(x, y, z + 1.6);
    parent.add(light);
    return light;
  }

  const loader = new STLLoader();
  const [geometry, baseGeometry] = await Promise.all([
    loader.loadAsync('/models/spindle.stl'), loader.loadAsync('/models/base.stl'),
  ]);
  const assembly = new THREE.Group();
  assembly.position.set(0, -22, -15);
  scene.add(assembly);
  const base = new THREE.Group();
  assembly.add(base);
  baseGeometry.translate(95.35, 92.625, 0);
  baseGeometry.rotateZ(Math.PI);
  mesh(baseGeometry, print, base, 0, 0, 0, true);
  for (const y of [39, -7, -43]) mesh(new THREE.BoxGeometry(18, 29, .6), black, base, -56, y, 10);

  // right-angle gearbox and offset output shaft from the motor reference
  const motor = new THREE.Group();
  motor.position.set(-18.25, 36.5, 28);
  assembly.add(motor);
  mesh(roundedBox(44, 58, 19), silver, motor, 0, -5, 0, true);
  mesh(roundedBox(43.5, 57.5, 1.3), bright, motor, 0, -5, 10, true);
  cylinder(10, 3, silver, motor, -5, 9, 12);
  cylinder(8.1, 1.2, dark, motor, -5, 9, 14);
  cylinder(6.8, 2.5, bright, motor, -5, 9, 15);
  cylinder(4, 19, silver, motor, -5, 9, 26);
  for (const [x, y] of [[-17, 19], [17, 19], [-17, -29], [17, -29]]) screw(motor, x, y, 11.6, 1.8);
  for (const [x, y] of [[-14, -5], [14, 7], [2, -24]]) {
    cylinder(3.4, 2, silver, motor, x, y, 12.2);
    cylinder(1.45, .5, dark, motor, x, y, 13.3);
  }
  for (const [x, y] of [[7, -7], [7, -16]]) cylinder(3, .8, silver, motor, x, y, 11.3);
  const can = mesh(new THREE.CylinderGeometry(15.5, 15.5, 54, 64), black, motor, 4, -61, -5.5);
  can.add(new THREE.LineSegments(new THREE.EdgesGeometry(can.geometry, 40), edgeMaterial));
  mesh(new THREE.CylinderGeometry(15.9, 15.9, 2.2, 64), silver, motor, 4, -88, -5.5);
  mesh(new THREE.CylinderGeometry(12.8, 12.8, 1.2, 48), dark, motor, 4, -90, -5.5);
  for (const x of [-3, 11]) mesh(new THREE.BoxGeometry(3, 4, 1), silver, motor, x, -93, -4.5);

  const spindle = new THREE.Group();
  spindle.position.set(-5, 9, 33);
  motor.add(spindle);
  geometry.computeVertexNormals();
  mesh(geometry, spool, spindle);
  // a small marker makes shaft rotation legible on the symmetric print
  mesh(new THREE.BoxGeometry(5.2, .7, .15), new THREE.MeshStandardMaterial({ color: 0xd3e6ed, roughness: .9 }), spindle, 8.8, 0, 13.1);
  const windingPoints = Array.from({ length: 121 }, (_, i) => {
    const angle = i / 120 * Math.PI * 5;
    return [Math.cos(angle) * 8.4, Math.sin(angle) * 8.4, 3.8 + i / 120 * 3.8];
  });
  tube(windingPoints, .24, lineMaterial, spindle);

  const driver = new THREE.Group();
  driver.position.set(30.2, 33.4, 16.8);
  assembly.add(driver);
  mesh(roundedBox(43, 43, 1.6, 1.4), redBoard, driver, 0, 0, 0, true);
  for (const x of [-18.5, 18.5]) for (const y of [-18.5, 18.5]) {
    cylinder(2.4, .25, gold, driver, x, y, 1);
    cylinder(1.35, .4, dark, driver, x, y, 1.2);
  }
  mesh(new THREE.BoxGeometry(24, 2.3, 22), black, driver, 0, 11, 12);
  mesh(new THREE.BoxGeometry(25, 12, 2), black, driver, 0, 15, 2);
  for (let x = -11; x <= 11; x += 3.7) mesh(new THREE.BoxGeometry(1.1, 11, 22), dark, driver, x, 16, 12);
  for (let i = 0; i < 15; i++) mesh(new THREE.BoxGeometry(.55, 4, .6), silver, driver, -10.5 + i * 1.5, 5.5, 2);
  for (const x of [-7, 7]) {
    cylinder(3.8, 8.5, black, driver, x, -4, 5.3);
    cylinder(3.6, .4, silver, driver, x, -4, 9.7);
    mesh(new THREE.BoxGeometry(4, .3, .2), dark, driver, x, -4, 10);
  }
  for (const [x, y, count] of [[-17, -4, 2], [17, -4, 2], [0, -14, 3]]) {
    mesh(new THREE.BoxGeometry(count * 5.1, 7.5, 8), terminalBlue, driver, x, y, 5);
    for (let i = 0; i < count; i++) screw(driver, x + (i - (count - 1) / 2) * 5.1, y, 9.2, 1.65);
  }
  mesh(new THREE.BoxGeometry(15, 2.8, 2.8), black, driver, 0, -21, 3);
  for (let i = 0; i < 6; i++) mesh(new THREE.BoxGeometry(.7, .7, 3.8), gold, driver, -6.35 + i * 2.54, -21, 6);
  led(driver, 0, -6, 3, 0xff3028);

  const breadboard = new THREE.Group();
  breadboard.position.set(30, -30, 9.5);
  assembly.add(breadboard);
  mesh(roundedBox(35, 47, 6, 1.3), white, breadboard, 0, 0, 0, true);
  mesh(new THREE.BoxGeometry(2.5, 43, .3), dark, breadboard, 0, 0, 3.65);
  const sockets = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, .25), dark, 170);
  const matrix = new THREE.Matrix4();
  let socket = 0;
  for (const side of [-1, 1]) for (let row = 0; row < 17; row++) for (let column = 0; column < 5; column++) {
    matrix.makeTranslation(side * (4.1 + column * 2.54), 20.32 - row * 2.54, 3.75);
    sockets.setMatrixAt(socket++, matrix);
  }
  breadboard.add(sockets);

  const nano = new THREE.Group();
  nano.position.set(30, -30, 20);
  assembly.add(nano);
  mesh(roundedBox(18, 45, 1.2, 1), greenBoard, nano, 0, 0, 0, true);
  for (const x of [-7.62, 7.62]) {
    mesh(new THREE.BoxGeometry(2.4, 38.1, 2.2), black, nano, x, 0, -1.7);
    for (let row = 0; row < 15; row++) {
      mesh(new THREE.BoxGeometry(.65, .65, 5.5), gold, nano, x, 17.78 - row * 2.54, -4.5);
      cylinder(.85, .3, gold, nano, x, 17.78 - row * 2.54, .8);
    }
  }
  mesh(new THREE.BoxGeometry(10, 14, 2.4), silver, nano, 0, 9, 1.8);
  mesh(new THREE.BoxGeometry(8, 5, .5), black, nano, 0, 19, 1);
  mesh(new THREE.BoxGeometry(5, 5, 1.3), black, nano, 0, -5, 1.3);
  mesh(new THREE.BoxGeometry(3.3, 2.4, 1.5), silver, nano, -4, -12, 1.4);
  mesh(new THREE.BoxGeometry(2, 1.2, .8), dark, nano, -4, -12, 2.5);
  for (const [x, y] of [[-4, -1], [4, -2], [4, -9], [-3, -17], [3, -15]]) mesh(new THREE.BoxGeometry(1.7, 2, .8), silver, nano, x, y, 1.2);
  mesh(new THREE.BoxGeometry(8.6, 5.5, 3.2), silver, nano, 0, -21, 2);
  mesh(new THREE.BoxGeometry(6.5, .3, 1.6), black, nano, 0, -23.9, 2);
  const statusLight = led(nano, 1, -12.5, 1.2, 0x19ec78);
  led(nano, -5.5, -17, 1.2, 0x8dff26);

  const usb = new THREE.Group();
  usb.position.set(30, -60, 22);
  assembly.add(usb);
  mesh(roundedBox(10, 13, 5, 2), black, usb);
  mesh(new THREE.BoxGeometry(8, 4, 2.8), silver, usb, 0, 8, 0);
  tube([[0, -6, 0], [0, -18, 0], [-4, -30, -4], [-4, -44, -6]], 1.25, black, usb);
  const power = new THREE.Group();
  power.position.set(63, -36, 18);
  assembly.add(power);
  mesh(new THREE.BoxGeometry(11, 18, 11), black, power);
  mesh(new THREE.CylinderGeometry(5.3, 5.3, 13, 32), black, power, 0, -14, 0);
  mesh(new THREE.BoxGeometry(10, 8, 8), greenBoard, power, 0, 12, 0);
  screw(power, -2.5, 12, 4.5, 1.5);
  screw(power, 2.5, 12, 4.5, 1.5);
  tube([[0, -20, 0], [2, -34, -1], [13, -45, -6], [15, -61, -7]], 1.3, black, power);

  const redWire = new THREE.MeshStandardMaterial({ color: 0xbc5550, roughness: .8 });
  const controlWires = controlWiring.map(connection => {
    const y = -30 + 17.78 - connection.row * 2.54;
    const end = connection.input === 'GND' ? [30.2, 19.4, 26] : [23.85 + connection.terminal * 2.54, 12.4, 23];
    mesh(new THREE.BoxGeometry(1.8, 2, 5), black, assembly, 15.74, y, 15.5);
    const wire = tube([[15.74, y, 18], ...connection.bends, end], .45, new THREE.MeshStandardMaterial({ color: connection.color, roughness: .8 }), assembly);
    wire.userData.part = 'nano';
    return wire;
  });
  // the two right-side jumpers disappear behind the driver in the reference photos
  for (const points of [
    [[44.26, -12.22, 18], [44, -7, 24], [28, 3, 30], [20, 2, 27], [20, 14, 15]],
    [[44.26, -14.76, 18], [47, -19, 26], [31, -33, 30], [26, -17, 32], [37, 6, 28], [37, 14, 15]],
  ]) {
    mesh(new THREE.BoxGeometry(1.8, 2, 5), black, assembly, points[0][0], points[0][1], 15.5);
    tube(points, .55, black, assembly).userData.part = 'breadboard';
  }
  const powerWire = tube([[65.5, -22, 20], [63, -2, 26], [51, 13, 28], [25.1, 19.4, 26]], .5, redWire, assembly);
  tube([[60.5, -22, 20], [59, -3, 24], [49, 11, 26], [30.2, 19.4, 26]], .5, black, assembly);
  const motorWire = tube([[10.65, 29.4, 26], [5, 16, 35], [5, -45, 28], [-7.25, -56.5, 23.5]], .5, redWire, assembly);
  tube([[15.75, 29.4, 26], [2, 14, 34], [1, -41, 27], [-21.25, -56.5, 23.5]], .5, black, assembly);

  const handle = new THREE.Group();
  handle.position.set(45, 151, 0);
  scene.add(handle);
  mesh(roundedBox(34, 83, 4, 15), silver, handle, 0, -11, -11, true);
  screw(handle, 0, 22, -8.6, 1.2);
  screw(handle, 0, -45, -8.6, 1.2);
  cylinder(6.5, 13, silver, handle, 0, 0, -1.5);
  const lever = new THREE.Group();
  lever.position.z = 5;
  handle.add(lever);
  tube([[0, 0, 0], [-15, 0, 2], [-46, 0, 2], [-65, 0, 0], [-73, 0, -5], [-76, 0, -12]], 4.5, bright, lever);
  tube([[-62, 0, .8], [-67, 0, -.8], [-71, 0, -3.4]], 4.9, black, lever);
  const tie = new THREE.Mesh(new THREE.TorusGeometry(5.1, .28, 6, 30), lineMaterial);
  tie.position.set(-68, 0, -1.4);
  tie.rotation.y = Math.PI / 2;
  lever.add(tie);

  let position = 0;
  let knownState = null;
  let motion = null;
  let frame = 0;
  let commandTarget = null;
  let commandTimer;
  const fishingLine = new THREE.Mesh(new THREE.BufferGeometry(), lineMaterial);
  fishingLine.castShadow = true;
  scene.add(fishingLine);
  const startPoint = new THREE.Vector3();
  const endPoint = new THREE.Vector3();
  let fishingCurve;
  let releasedLength;
  const flows = [...controlWires.slice(0, 3), powerWire, motorWire].map(wire => {
    const marker = mesh(new THREE.SphereGeometry(1.7, 10, 6), new THREE.MeshBasicMaterial({ color: 0x47aace }), assembly);
    marker.visible = false;
    marker.castShadow = false;
    return { curve: wire.userData.curve, marker };
  });
  const pullMarker = mesh(new THREE.SphereGeometry(1.2, 10, 6), new THREE.MeshBasicMaterial({ color: 0x47aace }), scene);
  pullMarker.visible = false;
  pullMarker.castShadow = false;
  function pose(value) {
    position = value;
    lever.rotation.z = value * .82;
    scene.updateMatrixWorld(true);
    endPoint.copy(new THREE.Vector3(-68, -5, -1.4)).applyMatrix4(lever.matrixWorld);
    const localEnd = motor.worldToLocal(endPoint.clone()).sub(spindle.position);
    const length = Math.hypot(localEnd.x, localEnd.y);
    startPoint.set(-5 + 8.6 * localEnd.y / length, 9 - 8.6 * localEnd.x / length, 39).applyMatrix4(motor.matrixWorld);
    const middle = startPoint.clone().lerp(endPoint, .5);
    middle.y -= (1 - value) * 15;
    middle.z += (1 - value) * 6;
    fishingCurve = new THREE.QuadraticBezierCurve3(startPoint.clone(), middle, endPoint.clone());
    // illustrate string take-up at the spindle radius, not measured shaft angle
    releasedLength ??= fishingCurve.getLength();
    spindle.rotation.z = (fishingCurve.getLength() - releasedLength) / 8.4;
    fishingLine.geometry.dispose();
    fishingLine.geometry = new THREE.TubeGeometry(fishingCurve, 36, .3, 5, false);
    canvas.dataset.position = value.toFixed(3);
  }

  const parts = [
    { id: 'handle', name: 'Door handle', description: 'A round turn and half hitches fasten the line to the lever, with duct tape wrapped over the knot. Winding the line pulls the handle down; releasing it lets the handle return.', specs: 'Tied, then taped · No handle modification', group: handle, point: [5, 6, 4], x: .65, y: .045 },
    { id: 'line', name: 'Fishing line', description: 'A light, flexible link between the motor and handle. An arbor knot anchors the spindle end; a round turn and half hitches secure the handle end under tape.', specs: 'Pulls to open · Slackens to release', group: fishingLine, x: .70, y: .20 },
    { id: 'spindle', name: 'Printed spindle', description: 'The arbor knot grips this custom spool as it gathers the line. Raised rims keep the winding in place, turning the motor’s rotation into a short pull on the handle.', specs: '25 mm diameter · 13 mm tall', group: spindle, point: [-12, 4, 13], x: .06, y: .34 },
    { id: 'driver', name: 'L298N driver', description: 'An H-bridge reverses the motor’s supply to wind or release the line. The Nano sets direction and ramps the drive signal for a gentler start and stop; the heat sink carries away heat.', specs: '2 motor channels · 1 in use', group: driver, point: [15, 0, 12], x: .77, y: .43 },
    { id: 'motor', name: 'Gearmotor', description: 'The BRINGSMART worm gearmotor trades speed for pulling torque through a right-angle gearbox. The calibrated opening stroke takes up the line; a shorter, gentler reverse stroke releases it.', specs: '24 V motor · 0.97 s open · 0.65 s release', group: motor, point: [-10, -61, 8], x: .06, y: .56 },
    { id: 'nano', name: 'Nano ESP32', description: 'Receives commands over Wi-Fi and times each motor stroke on the board. The shortcut’s five-second hold also runs here, so closing does not depend on a phone staying awake.', specs: 'ESP32-S3 · 16 MB flash · USB-C', group: nano, point: [8, 8, 3], x: .77, y: .62 },
    { id: 'breadboard', name: 'Mini breadboard', description: 'Metal strips connect each group of five holes without soldering. The center gap keeps the Nano’s two pin headers separate, while jumper wires connect the driver.', specs: '170 contacts · 2.54 mm pitch', group: breadboard },
    { id: 'base', name: 'Printed base', description: 'The motor cradle and mounting plate hold the moving parts and electronics together. Adhesive mounting strips secure the printed assembly to the door.', specs: '140.7 × 123.3 mm · Original print model', group: base, point: [-62, -42, 10], x: .06, y: .77 },
    { id: 'power', name: 'Barrel power', description: 'The barrel adapter brings the motor supply to screw terminals. The driver switches that supply, keeping motor current out of the Nano’s signal pins.', specs: 'Separate motor supply · Common ground', group: power, point: [5, 0, 5], x: .76, y: .82 },
    { id: 'usb', name: 'USB-C', description: 'Connects the Nano for power, programming and serial diagnostics. The motor draws its current through the driver’s separate supply.', specs: 'Power · Programming · Serial', group: usb, point: [0, -6, 3], x: .33, y: .94 },
  ];
  const partSelect = document.getElementById('part-select');
  const details = document.getElementById('part-details');
  details.addEventListener('transitionend', event => {
    if (event.propertyName === 'grid-template-rows' && details.dataset.open === 'true' && matchMedia('(max-width: 760px)').matches) {
      details.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  const wiringDetail = document.getElementById('wiring-detail');
  const wiringDiagram = document.getElementById('wiring-diagram');
  wiringDiagram.innerHTML = '<text class="board-name" x="0" y="13">NANO ESP32</text><text class="board-name" x="248" y="13" text-anchor="end">L298N</text>';
  for (const [index, connection] of controlWiring.entries()) {
    const y = 35 + index * 25;
    wiringDiagram.innerHTML += `<g data-pin="${connection.pin}" stroke="${connection.color}"><text x="0" y="${y + 4}">${connection.pin}</text><path d="M48 ${y} H190"/><circle cx="48" cy="${y}" r="3"/><circle cx="190" cy="${y}" r="3"/><text x="248" y="${y + 4}" text-anchor="end">${connection.input}</text></g>`;
  }
  const annotations = document.getElementById('annotations');
  for (const part of parts) part.group.userData.part = part.id;
  for (const [index, part] of parts.entries()) {
    part.glow = 0;
    part.materials = [];
    part.group.traverse(object => {
      if (!object.isMesh || !object.material.emissive) return;
      let owner = object;
      while (owner && !owner.userData.part) owner = owner.parent;
      if (owner !== part.group) return;
      object.material = object.material.clone();
      object.material.emissive.set(0x699aae);
      part.materials.push(object.material);
    });
    partSelect.add(new Option(part.name, part.id));
    if (part.x === undefined) continue;
    const button = document.createElement('button');
    button.className = 'part-label';
    button.type = 'button';
    button.setAttribute('aria-label', `Inspect ${part.name}`);
    button.setAttribute('aria-pressed', 'false');
    const number = document.createElement('span');
    number.className = 'part-index';
    number.textContent = String(index + 1).padStart(2, '0');
    button.append(number, document.createTextNode(part.name));
    button.addEventListener('click', () => selectPart(part));
    button.addEventListener('pointerenter', () => { hoveredPart = part; requestRender(); });
    button.addEventListener('pointerleave', () => { hoveredPart = null; requestRender(); });
    view.append(button);
    part.element = button;
    const leader = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    leader.innerHTML = '<path/><circle r="2"/>';
    annotations.append(leader);
    part.path = leader.firstElementChild;
    part.dot = leader.lastElementChild;
  }
  let selectedPart = null;
  let hoveredPart = null;
  let viewMotion = null;
  const overviewTarget = controls.target.clone();
  function selectPart(part) {
    selectedPart = part;
    partSelect.value = part?.id || '';
    details.dataset.open = String(Boolean(part));
    details.inert = !part;
    if (part && reducedMotion.matches && matchMedia('(max-width: 760px)').matches) requestAnimationFrame(() => details.scrollIntoView({ block: 'nearest' }));
    wiringDetail.hidden = !['nano', 'breadboard', 'driver'].includes(part?.id);
    if (part) {
      document.getElementById('part-name').textContent = part.name;
      document.getElementById('part-description').textContent = part.description;
      document.getElementById('part-specs').textContent = part.specs;
    }
    for (const item of parts) if (item.element) {
      item.element.dataset.active = String(item === part);
      item.element.setAttribute('aria-pressed', String(item === part));
    }
    const target = part ? new THREE.Box3().setFromObject(part.group).getCenter(new THREE.Vector3()) : overviewTarget;
    viewMotion = { from: controls.target.clone(), to: target, zoomFrom: camera.zoom, zoomTo: part ? (['nano', 'breadboard'].includes(part.id) ? 2.3 : 1.8) : 1, started: performance.now() };
    requestRender();
  }
  partSelect.addEventListener('change', () => selectPart(parts.find(part => part.id === partSelect.value)));
  document.getElementById('close-part').addEventListener('click', () => { selectPart(null); partSelect.focus(); });
  const raycaster = new THREE.Raycaster();
  function pick(event) {
    const rect = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, 1 - (event.clientY - rect.top) / rect.height * 2), camera);
    for (const hit of raycaster.intersectObjects([assembly, handle, fishingLine], true)) {
      let object = hit.object;
      while (object && !object.userData.part) object = object.parent;
      if (object) return parts.find(part => part.id === object.userData.part);
    }
    return null;
  }
  let pointerStart = null;
  canvas.addEventListener('pointermove', event => {
    if (event.buttons) return;
    const part = pick(event);
    if (part !== hoveredPart) { hoveredPart = part; requestRender(); }
    canvas.style.cursor = part ? 'pointer' : 'grab';
  });
  canvas.addEventListener('pointerleave', () => { hoveredPart = null; requestRender(); });
  canvas.addEventListener('pointerdown', event => { pointerStart = [event.clientX, event.clientY]; hoveredPart = null; requestRender(); });
  canvas.addEventListener('pointercancel', () => { pointerStart = null; });
  canvas.addEventListener('pointerup', event => {
    if (pointerStart && Math.hypot(event.clientX - pointerStart[0], event.clientY - pointerStart[1]) < 5) selectPart(pick(event));
    pointerStart = null;
  });
  function annotate() {
    const width = view.clientWidth, height = view.clientHeight;
    for (const label of parts) {
      if (!label.element) continue;
      const point = label.point ? label.group.localToWorld(new THREE.Vector3(...label.point)) : fishingCurve.getPoint(.57);
      point.project(camera);
      const visible = Math.abs(point.x) < .95 && Math.abs(point.y) < .95;
      label.element.hidden = !visible;
      label.path.parentNode.style.display = visible ? '' : 'none';
      const px = (point.x + 1) * width / 2, py = (1 - point.y) * height / 2;
      const x = Math.min(width - label.element.offsetWidth - 12, Math.max(12, width * label.x));
      const y = Math.min(height - label.element.offsetHeight - 6, height * label.y);
      label.element.style.left = `${x}px`;
      label.element.style.top = `${y}px`;
      const fromX = px > x + label.element.offsetWidth / 2 ? x + label.element.offsetWidth + 5 : x - 5;
      const fromY = y + 14;
      label.path.setAttribute('d', `M${fromX},${fromY} L${fromX + (px > fromX ? 12 : -12)},${fromY} L${px},${py}`);
      label.dot.setAttribute('cx', px);
      label.dot.setAttribute('cy', py);
    }
  }
  let lastFrame = performance.now();
  function render(now = performance.now()) {
    frame = 0;
    if (viewMotion) {
      const t = reducedMotion.matches ? 1 : THREE.MathUtils.clamp((now - viewMotion.started) / 380, 0, 1);
      const target = viewMotion.from.clone().lerp(viewMotion.to, 1 - (1 - t) ** 4);
      camera.position.add(target.clone().sub(controls.target));
      controls.target.copy(target);
      camera.zoom = THREE.MathUtils.lerp(viewMotion.zoomFrom, viewMotion.zoomTo, 1 - (1 - t) ** 4);
      camera.updateProjectionMatrix();
      controls.update();
      if (t === 1) viewMotion = null;
    }
    let highlighting = false;
    const blend = 1 - Math.exp(-THREE.MathUtils.clamp(now - lastFrame, 0, 32) / 48);
    lastFrame = now;
    const progress = motion ? THREE.MathUtils.clamp((now - motion.start) / motion.duration, 0, 1) : 0;
    const flowPart = motion && ['nano', 'driver', 'motor', 'spindle', 'handle'][Math.min(4, Math.floor(progress * 5))];
    for (const part of parts) {
      const target = part.id === flowPart ? .3 : part === selectedPart ? .22 : part === hoveredPart ? .10 : 0;
      part.glow = reducedMotion.matches || Math.abs(target - part.glow) < .003 ? target : part.glow + (target - part.glow) * blend;
      for (const material of part.materials) material.emissiveIntensity = part.glow;
      if (part.element) part.element.dataset.hovered = String(part === hoveredPart);
      highlighting ||= part.glow !== target;
    }
    if (motion) {
      const t = progress;
      const eased = t * t * (3 - 2 * t);
      pose(motion.from + (motion.to - motion.from) * eased);
      for (const [index, flow] of flows.entries()) flow.marker.position.copy(flow.curve.getPoint((t * 2 + index / 3) % 1));
      pullMarker.position.copy(fishingCurve.getPoint(motion.opening ? 1 - t : t));
      if (t === 1) motion = null;
    }
    for (const flow of flows) flow.marker.visible = Boolean(motion) && !reducedMotion.matches;
    pullMarker.visible = Boolean(motion) && !reducedMotion.matches;
    const flowState = motion ? 'active' : 'idle';
    if (canvas.dataset.flow !== flowState) {
      canvas.dataset.flow = flowState;
      document.dispatchEvent(new CustomEvent('door-motion', { detail: { active: Boolean(motion), opening: motion?.opening === true } }));
    }
    renderer.render(scene, camera);
    annotate();
    if (motion || highlighting || viewMotion) requestRender();
  }
  function requestRender() {
    if (!frame && !document.hidden) frame = requestAnimationFrame(render);
  }
  function animate(open, start = performance.now()) {
    motion = { from: position, to: open ? 1 : 0, opening: open, start, duration: open ? 970 : 650 };
    if (performance.now() - start >= motion.duration) motion = null;
    else if (reducedMotion.matches || document.hidden) { pose(motion.to); motion = null; }
    requestRender();
  }
  function resetCommand() {
    clearTimeout(commandTimer);
    commandTarget = null;
    motion = null;
    if (knownState !== null) pose(knownState ? 1 : 0);
    requestRender();
  }
  function setState(open) {
    if (open === null) {
      knownState = null;
      resetCommand();
      return;
    }
    if (commandTarget === open) { clearTimeout(commandTimer); commandTarget = null; }
    if (knownState === open) return;
    const target = open ? 1 : 0;
    const initial = knownState === null;
    knownState = open;
    statusLight.color.set(open ? 0xff3028 : 0x19ec78);
    if (initial || reducedMotion.matches || document.hidden) {
      motion = null;
      pose(target);
    } else if (motion?.to !== target && position !== target) animate(open);
    requestRender();
  }
  function resize() {
    const width = view.clientWidth, height = view.clientHeight;
    const aspect = width / height;
    const span = Math.max(175, 125 / aspect);
    camera.left = -span * aspect;
    camera.right = span * aspect;
    camera.top = span;
    camera.bottom = -span;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    // resizing clears the canvas after animation callbacks but before the browser paints
    cancelAnimationFrame(frame);
    render();
  }
  document.addEventListener('door-state', event => setState(event.detail.open));
  function applyCommand({ command, start }) {
    const remaining = 15000 - (performance.now() - start);
    if (!command || remaining <= 0) { resetCommand(); return; }
    if (knownState === null) return;
    clearTimeout(commandTimer);
    commandTarget = !command.includes('close');
    animate(commandTarget, start);
    // restore the reported pose if a command never receives confirmation
    commandTimer = setTimeout(resetCommand, remaining);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else requestRender();
  });
  reducedMotion.addEventListener('change', () => {
    if (motion && reducedMotion.matches) { pose(motion.to); motion = null; requestRender(); }
  });
  controls.addEventListener('change', requestRender);
  controls.addEventListener('start', () => { viewMotion = null; });
  document.fonts.ready.then(requestRender);
  document.getElementById('reset-view').addEventListener('click', () => { controls.reset(); selectPart(null); });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Escape') { selectPart(null); return; }
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') controls.reset();
    else {
      const offset = camera.position.clone().sub(controls.target);
      const spherical = new THREE.Spherical().setFromVector3(offset);
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') spherical.theta += event.key === 'ArrowLeft' ? -.08 : .08;
      else spherical.phi += event.key === 'ArrowUp' ? -.08 : .08;
      camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
      controls.update();
    }
  });
  new ResizeObserver(resize).observe(view);
  canvas.addEventListener('webglcontextlost', event => { event.preventDefault(); document.getElementById('model-error').hidden = false; });
  canvas.addEventListener('webglcontextrestored', () => { document.getElementById('model-error').hidden = true; requestRender(); });
  pose(0);
  const state = document.body.dataset.doorState;
  setState(state === 'open' ? true : state === 'closed' ? false : null);
  if (pendingCommand) applyCommand(pendingCommand);
  resize();
  view.classList.add('model-ready');
  canvas.dataset.ready = 'true';
}

createMechanism().catch(error => {
  console.error('Mechanism unavailable:', error);
  document.getElementById('model-loading').hidden = true;
  document.getElementById('model-error').hidden = false;
  document.getElementById('reset-view').disabled = true;
  document.getElementById('part-select').disabled = true;
});
