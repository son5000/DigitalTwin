import * as THREE from "three";

export function createTextSprite(
  text,
  {
    background,
    border,
    color,
    scale = { x: 1.6, y: 0.4 },
  },
) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;
  const context = canvas.getContext("2d");

  context.fillStyle = background;
  context.strokeStyle = border;
  context.lineWidth = 5;
  context.beginPath();
  context.roundRect(4, 4, canvas.width - 8, canvas.height - 8, 12);
  context.fill();
  context.stroke();

  context.fillStyle = color;
  context.font = "600 38px Arial, sans-serif";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 36);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: true,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(scale.x, scale.y, 1);
  sprite.renderOrder = 4;

  return sprite;
}
