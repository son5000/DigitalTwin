import { Quaternion, Vector3 } from "three";

export function planeOrientation(normal = { x: 0, y: 0, z: 1 }, rotation = 0) {
  const n = new Vector3(normal.x, normal.y, normal.z);
  if (!Number.isFinite(n.lengthSq()) || n.lengthSq() < 1e-12) n.set(0, 0, 1);
  return new Quaternion().setFromUnitVectors(new Vector3(0, 0, 1), n.normalize())
    .multiply(new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), rotation));
}

export function observationPlane(point) {
  const center = new Vector3(point.localPosition.x, point.localPosition.y, point.localPosition.z);
  const width = point.planeWidth ?? .3, height = point.planeHeight ?? .3;
  const orientation = planeOrientation(point.targetNormal, point.planeRotation ?? 0);
  const vertices = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([x, y]) =>
    new Vector3(x * width / 2, y * height / 2, 0).applyQuaternion(orientation).add(center).toArray());
  return { type: "PLANE", center: center.toArray(), width, height, vertices, outline: [0, 1, 2, 3], triangles: [0, 1, 2, 0, 2, 3] };
}

// Derive editable plane axes from transmitted corners, including after a datum transform.
export function planeFields(surface) {
  const [a, b, , d] = surface.vertices.map((v) => new Vector3(...v));
  const x = b.clone().sub(a), y = d.clone().sub(a);
  const normal = x.clone().cross(y).normalize();
  const localX = x.clone().applyQuaternion(planeOrientation(normal).invert());
  return { planeWidth: x.length(), planeHeight: y.length(), targetNormal: { x: normal.x, y: normal.y, z: normal.z }, planeRotation: Math.atan2(localX.y, localX.x) };
}
