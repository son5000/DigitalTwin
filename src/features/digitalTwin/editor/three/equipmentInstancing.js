import * as THREE from "three";

import {
  createEquipmentObject,
  getEquipmentBatchKey,
} from "@/features/digitalTwin/editor/objects/EquipmentFactory";

const MIN_INSTANCE_COUNT = 3;

function createInstanceGroup(entries, options) {
  const exemplar = createEquipmentObject({
    ...entries[0].equipment,
    name: "",
    position: { x: 0, y: 0, z: 0 },
    rotation: { x: 0, y: 0, z: 0 },
  }, { ...options, selected: false, enableLod: false });
  exemplar.updateMatrixWorld(true);
  const sourceMeshes = [];
  exemplar.traverse((child) => {
    if (child.isMesh) sourceMeshes.push(child);
  });
  const group = new THREE.Group();
  group.userData.instancedEquipmentBatch = true;
  const instanceIds = entries.map(({ equipment }) => equipment.id);
  const instanceMatrix = new THREE.Matrix4();
  const objectMatrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(1, 1, 1);

  sourceMeshes.forEach((sourceMesh) => {
    const mesh = new THREE.InstancedMesh(sourceMesh.geometry, sourceMesh.material, entries.length);
    mesh.userData.equipmentInstanceIds = instanceIds;
    mesh.castShadow = sourceMesh.castShadow;
    mesh.receiveShadow = sourceMesh.receiveShadow;
    mesh.frustumCulled = true;
    entries.forEach(({ equipment, baseY }, index) => {
      position.set(equipment.position.x, equipment.position.y + baseY, equipment.position.z);
      quaternion.setFromEuler(new THREE.Euler(equipment.rotation.x, equipment.rotation.y, equipment.rotation.z));
      objectMatrix.compose(position, quaternion, scale);
      instanceMatrix.multiplyMatrices(objectMatrix, sourceMesh.matrixWorld);
      mesh.setMatrixAt(index, instanceMatrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    group.add(mesh);
  });
  return group;
}

export function createEquipmentRenderObjects(entries, options = {}) {
  const groups = new Map();
  entries.forEach((entry) => {
    const key = getEquipmentBatchKey(entry.equipment, options);
    const batch = groups.get(key) ?? [];
    batch.push(entry);
    groups.set(key, batch);
  });
  return [...groups.values()].flatMap((batch) => {
    if (!options.disableInstancing && batch.length >= MIN_INSTANCE_COUNT && batch.every(({ equipment }) => equipment.id !== options.selectedEquipmentId)) {
      return [createInstanceGroup(batch, options)];
    }
    return batch.map(({ equipment, baseY }) => {
      const object = createEquipmentObject(equipment, {
        selected: equipment.id === options.selectedEquipmentId,
        theme: options.theme,
        viewerTranslucent: options.viewerTranslucent,
      });
      object.position.y += baseY;
      object.userData.floorBaseY = baseY;
      return object;
    });
  });
}
