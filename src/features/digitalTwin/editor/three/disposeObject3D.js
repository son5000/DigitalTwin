export function disposeObject3D(object) {
  object.traverse((child) => {
    child.geometry?.dispose();

    const materials = Array.isArray(child.material)
      ? child.material
      : [child.material];

    materials.filter(Boolean).forEach((material) => {
      material.map?.dispose();
      material.dispose();
    });
  });
}
