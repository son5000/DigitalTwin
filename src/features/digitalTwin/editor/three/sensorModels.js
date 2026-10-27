import * as THREE from "three";

// Models are authored facing +Z, then oriented to the existing sensor -Y axis.
// Their longest dimension is one unit; markerDiameter remains the display size.
export function createSensorModel(appearance, selected = false) {
  const model = new THREE.Group();
  const materials = {
    body: new THREE.MeshStandardMaterial({ color: selected ? 0xe5b74d : 0xc7d3d9, metalness: .55, roughness: .32 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x263441, metalness: .5, roughness: .36 }),
    steel: new THREE.MeshStandardMaterial({ color: 0x8e9ea9, metalness: .85, roughness: .24 }),
    glass: new THREE.MeshStandardMaterial({ color: 0x123a55, metalness: .65, roughness: .12, emissive: 0x073047, emissiveIntensity: .35 }),
    led: new THREE.MeshStandardMaterial({ color: 0x4de0a8, emissive: 0x27b984, emissiveIntensity: .7, roughness: .3 }),
  };
  function mesh(geometry, material, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(geometry, materials[material]);
    object.position.set(x, y, z); model.add(object); return object;
  }
  const box = (w, h, d, material, x = 0, y = 0, z = 0) => mesh(new THREE.BoxGeometry(w, h, d), material, x, y, z);
  function cylinder(radius, length, material, x = 0, y = 0, z = 0, sides = 32, endRadius = radius) {
    const object = mesh(new THREE.CylinderGeometry(radius, endRadius, length, sides), material, x, y, z);
    object.rotation.x = Math.PI / 2; return object;
  }
  function ring(radius, tube, material, x = 0, y = 0, z = 0) {
    return mesh(new THREE.TorusGeometry(radius, tube, 6, 32), material, x, y, z);
  }
  function screw(x, y, z) {
    cylinder(.018, .012, "steel", x, y, z, 12);
    box(.022, .004, .003, "dark", x, y, z + .007);
  }
  function lens(radius, z, y = 0) {
    cylinder(radius, .12, "dark", 0, y, z);
    ring(radius * .92, .012, "steel", 0, y, z + .065);
    cylinder(radius * .75, .014, "glass", 0, y, z + .067);
    ring(radius * .54, .005, "dark", 0, y, z + .077);
  }
  function connector(x, y, z) {
    cylinder(.055, .10, "dark", x, y, z);
    ring(.05, .009, "steel", x, y, z - .035);
    cylinder(.025, .10, "dark", x, y, z - .09);
  }
  if (appearance === "BULLET_CAMERA") {
    box(.46, .32, .55, "body");
    box(.51, .035, .66, "steel", 0, .185, .035);
    box(.03, .10, .66, "body", -.245, .15, .035);
    box(.03, .10, .66, "body", .245, .15, .035);
    box(.43, .29, .025, "dark", 0, 0, .287);
    lens(.12, .33);
    for (const x of [-.18, .18]) for (const y of [-.10, .10]) screw(x, y, .306);
    for (let i = 0; i < 5; i++) box(.008, .14, .025, "dark", .235, 0, -.18 + i * .06);
    box(.09, .22, .12, "steel", 0, -.26, -.06);
    cylinder(.07, .16, "dark", 0, -.22, -.06);
    box(.36, .035, .28, "body", 0, -.38, -.06);
    connector(.12, -.06, -.32);
    cylinder(.018, .01, "led", .16, -.08, .31);
  } else if (appearance === "DOME_CAMERA") {
    cylinder(.38, .10, "body", 0, 0, -.15);
    ring(.35, .018, "steel", 0, 0, -.09);
    cylinder(.29, .10, "dark", 0, 0, -.06);
    mesh(new THREE.SphereGeometry(.29, 32, 20, 0, Math.PI * 2, 0, Math.PI / 2), "body").rotation.x = Math.PI / 2;
    lens(.135, .24);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      cylinder(.023, .018, "glass", Math.cos(angle) * .205, Math.sin(angle) * .205, .22);
    }
    for (const [x, y] of [[-.30, 0], [.30, 0], [0, .30], [0, -.30]]) screw(x, y, -.085);
    connector(0, -.26, -.20);
  } else if (appearance === "CYLINDER_SENSOR") {
    cylinder(.17, .62, "steel");
    for (let i = 0; i < 14; i++) ring(.173, .008, "steel", 0, 0, -.26 + i * .038);
    cylinder(.235, .065, "body", 0, 0, -.17, 6);
    cylinder(.235, .065, "body", 0, 0, .14, 6);
    cylinder(.18, .08, "dark", 0, 0, .33);
    cylinder(.154, .012, "glass", 0, 0, .376);
    ring(.14, .008, "steel", 0, 0, .386);
    connector(0, 0, -.36);
    cylinder(.018, .012, "led", .11, 0, .386);
  } else if (appearance === "RADAR") {
    // Parabolic reflector, with a closed rear shell and a metallic lip.
    const profile = Array.from({ length: 18 }, (_, i) => {
      const r = .38 * i / 17;
      return new THREE.Vector2(r, .9 * r * r);
    });
    const dish = mesh(new THREE.LatheGeometry(profile, 48), "body");
    dish.rotation.x = Math.PI / 2;
    materials.body.side = THREE.DoubleSide;
    ring(.38, .014, "steel", 0, 0, .9 * .38 * .38);
    cylinder(.095, .20, "dark", 0, 0, -.11);
    cylinder(.045, .18, "steel", 0, 0, .25);
    cylinder(.085, .08, "dark", 0, 0, .35, 24, .045);
    cylinder(.055, .012, "glass", 0, 0, .395);
    for (const sign of [-1, 1]) {
      const a = new THREE.Vector3(sign * .28, -.15, .10), b = new THREE.Vector3(0, 0, .31);
      const strut = mesh(new THREE.CylinderGeometry(.009, .009, a.distanceTo(b), 8), "steel");
      strut.position.copy(a).add(b).multiplyScalar(.5);
      strut.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.sub(a).normalize());
    }
    box(.10, .30, .13, "steel", 0, -.31, -.09);
    box(.38, .035, .28, "body", 0, -.47, -.09);
    for (const x of [-.13, .13]) screw(x, -.47, .06);
  } else {
    box(.46, .62, .24, "body");
    box(.42, .58, .025, "dark", 0, 0, .132);
    box(.30, .17, .012, "glass", 0, .13, .15);
    for (let i = 0; i < 4; i++) box(.032, .07, .005, "led", -.09 + i * .06, .13, .16);
    cylinder(.09, .02, "steel", 0, -.13, .16);
    cylinder(.069, .025, "glass", 0, -.13, .17);
    for (const x of [-.18, .18]) for (const y of [-.25, .25]) screw(x, y, .15);
    for (let i = 0; i < 6; i++) box(.012, .025, .16, "dark", .235, -.18 + i * .065, 0);
    connector(-.11, -.28, -.18); connector(.11, -.28, -.18);
    box(.56, .08, .04, "steel", 0, .23, -.145);
    box(.56, .08, .04, "steel", 0, -.23, -.145);
  }
  const bounds = new THREE.Box3().setFromObject(model), size = bounds.getSize(new THREE.Vector3());
  const scale = 1 / Math.max(size.x, size.y, size.z);
  const center = bounds.getCenter(new THREE.Vector3());
  for (const child of model.children) child.position.sub(center);
  model.scale.setScalar(scale);
  model.rotation.x = Math.PI / 2;
  // Unused materials do not belong to the scene disposal traversal.
  const used = new Set(model.children.map((child) => child.material));
  Object.values(materials).filter((material) => !used.has(material)).forEach((material) => material.dispose());
  return model;
}
