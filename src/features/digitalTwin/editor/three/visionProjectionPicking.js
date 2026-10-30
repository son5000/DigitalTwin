import * as THREE from "three";

export function isProjectionVisible(overlay) {
  for (let object = overlay; object; object = object.parent) if (!object.visible) return false;
  return overlay.material.uniforms.opacity.value > 0;
}

// Match the vision shader's surface, crop, perspective and interpolated-normal
// tests. Base scan materials can be single-sided or have different face normals.
export function pickVisionProjection(targets, raycaster, accepts = () => true) {
  const hits = [];
  for (const target of targets) {
    const { overlay } = target;
    if (!isProjectionVisible(overlay)) continue;
    overlay.updateWorldMatrix(true, false);
    const intersections = [];
    // Projection overlays deliberately opt out of ordinary scene picking.
    (overlay.isPoints ? THREE.Points : THREE.Mesh).prototype.raycast.call(overlay, raycaster, intersections);
    for (const hit of intersections) hits.push({ ...hit, target });
  }
  hits.sort((a,b)=>a.distance-b.distance);
  for (const hit of hits) {
    const { overlay, object } = hit.target, u = overlay.material.uniforms;
    const projected = new THREE.Vector4(hit.point.x,hit.point.y,hit.point.z,1).applyMatrix4(u.projectorMatrix.value);
    if (projected.w <= 0) continue;
    if (!u.surfaceMapped.value) {
      projected.multiplyScalar(1 / projected.w);
      projected.set(projected.x * .5 + .5, projected.y * .5 + .5, projected.z * .5 + .5, 1);
      if (projected.z < 0 || projected.z > 1) continue;
    }
    if (projected.x < 0 || projected.x > 1 || projected.y < 0 || projected.y > 1) continue;
    const mapped = new THREE.Vector3(projected.x,projected.y,1).applyMatrix3(u.imageTransform.value);
    if (Math.abs(mapped.z) < 1e-8) continue;
    mapped.divideScalar(mapped.z);
    if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) continue;
    if (u.perspectiveEnabled.value && u.sourceQuad.value.some((a,i,quad)=>{
      const b = quad[(i+1)%4];
      return (b.x-a.x)*(mapped.y-a.y)-(b.y-a.y)*(mapped.x-a.x) > 1e-7;
    })) continue;
    const crop = u.crop.value;
    if (crop.x+mapped.x*crop.z > 1 || crop.y+mapped.y*crop.w > 1) continue;
    if (!overlay.isPoints && u.restrictFace.value) {
      const normals = overlay.geometry.attributes.normal;
      const normal = new THREE.Vector3();
      if (normals && hit.face && hit.barycoord) {
        [hit.face.a,hit.face.b,hit.face.c].forEach((index,i)=>normal.addScaledVector(
          new THREE.Vector3().fromBufferAttribute(normals,index).applyMatrix3(u.worldNormalMatrix.value).normalize(),hit.barycoord.getComponent(i)));
      } else if (hit.face) normal.copy(hit.face.normal).applyMatrix3(u.worldNormalMatrix.value);
      if (normal.normalize().dot(u.faceNormal.value) < .9) continue;
    }
    const result = { ...hit, object, representation:hit.target.kind,
      sourceUv: [crop.x + mapped.x * crop.z, 1 - crop.y - mapped.y * crop.w] };
    if (accepts(result)) return result;
  }
  return null;
}
