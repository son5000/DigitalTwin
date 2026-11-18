import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { SRGBColorSpace, TextureLoader } from "three";
import { disposeObject3D } from "./disposeObject3D.js";

export function validateGltfResources(data, memberNames = []) {
  const view = new DataView(data);
  let json;
  if (data.byteLength >= 4 && view.getUint32(0, true) === 0x46546c67) {
    if (data.byteLength < 20 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== data.byteLength
      || view.getUint32(16, true) !== 0x4e4f534a || view.getUint32(12, true) > data.byteLength - 20) throw new Error("GLB 모델의 헤더가 올바르지 않습니다.");
    json = new TextDecoder().decode(new Uint8Array(data, 20, view.getUint32(12, true)));
  } else json = new TextDecoder().decode(data);
  const model = JSON.parse(json);
  if (model.asset?.version !== "2.0") throw new Error("glTF 2.0 모델이 필요합니다.");
  for (const entry of [...(model.buffers ?? []), ...(model.images ?? [])]) {
    if (entry.uri != null && (typeof entry.uri !== "string"
      || (!entry.uri.startsWith("data:") && !memberNames.includes(entry.uri)))) {
      throw new Error("모델이 자산 명세에 없는 외부 파일을 참조합니다.");
    }
  }
  return model;
}

export async function loadStoredGltf(source, manager, displayMaterials = [], signal, memberNames = []) {
  signal?.throwIfAborted();
  const data = source instanceof Blob ? await source.arrayBuffer() : await (await fetch(source, { signal })).arrayBuffer();
  validateGltfResources(data, memberNames);
  const gltf = await new GLTFLoader(manager).parseAsync(data, "");
  try {
    signal?.throwIfAborted();
    for (const entry of displayMaterials) {
      const materials = new Set();
      gltf.scene.traverse((object) => {
        for (const material of (Array.isArray(object.material) ? object.material : [object.material])) {
          if (material && gltf.parser.associations.get(material)?.materials === entry.material_index) materials.add(material);
        }
      });
      if (!materials.size) throw new Error("표시 자산의 재질 번호를 모델에서 찾을 수 없습니다.");
      const texture = await new TextureLoader(manager).loadAsync(entry.texture_member);
      texture.flipY = false;
      texture.colorSpace = SRGBColorSpace;
      for (const material of materials) {
        material.map?.dispose();
        material.map = texture;
        material.needsUpdate = true;
      }
    }
    signal?.throwIfAborted();
    let vertices = 0;
    gltf.scene.traverse((object) => { vertices += object.geometry?.getAttribute("position")?.count ?? 0; });
    if (!vertices) throw new Error("EMPTY_MODEL");
    return gltf.scene;
  } catch (error) { disposeObject3D(gltf.scene); throw error; }
}
