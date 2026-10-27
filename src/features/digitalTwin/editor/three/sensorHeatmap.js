import * as THREE from "three";
import { HEATMAP_PALETTES, normalizeHeatmap } from "../model/sensorHeatmap.js";
import { planeOrientation } from "../model/observationGeometry.js";

// Appearance only: no synthetic decibels, alarms, or telemetry are generated here.
export function createSensorHeatmap(settings, position, normal) {
  const config = normalizeHeatmap(settings);
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3,
    uniforms: { colors: { value: HEATMAP_PALETTES[config.palette].colors.map((color) => new THREE.Color(color)) },
      opacity: { value: config.opacity }, falloff: { value: config.falloff }, style: { value: { SOFT: 0, BANDS: 1, RINGS: 2 }[config.style] } },
    vertexShader: "varying vec2 vUv; void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}",
    fragmentShader: `varying vec2 vUv; uniform vec3 colors[4]; uniform float opacity; uniform float falloff; uniform float style;
      void main(){ float r=length(vUv*2.0-1.0); if(r>=1.0) discard;
        float t=pow(1.0-r,falloff); float band=style==1.0?floor(t*6.0)/5.0:t;
        float p=clamp(band,0.0,1.0)*3.0; vec3 color=p<1.0?mix(colors[0],colors[1],p):p<2.0?mix(colors[1],colors[2],p-1.0):mix(colors[2],colors[3],p-2.0);
        float alpha=opacity*smoothstep(0.0,0.18,1.0-r);
        if(style==2.0) alpha*=mix(0.15,1.0,1.0-smoothstep(0.05,0.13,abs(fract(r*5.0)-0.5)));
        gl_FragColor=vec4(color,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(config.radius * 2, config.radius * 2), material);
  mesh.position.copy(position instanceof THREE.Vector3 ? position : new THREE.Vector3(...position));
  mesh.quaternion.copy(planeOrientation(normal ?? config.normal));
  mesh.position.add(new THREE.Vector3(0, 0, .002).applyQuaternion(mesh.quaternion));
  mesh.userData.monitoringOverlay = true; mesh.userData.ownsGeometry = true; mesh.raycast = () => {}; mesh.renderOrder = 4;
  return mesh;
}
