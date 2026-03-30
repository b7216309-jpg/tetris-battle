import * as THREE from 'three';

const GRID_VERTEX = /* glsl */ `
  varying vec2 vWorldPos;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorldPos = world.xz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const GRID_FRAGMENT = /* glsl */ `
  uniform float uTime;
  uniform vec3 uColor;
  varying vec2 vWorldPos;

  void main() {
    vec2 uv = vWorldPos;
    vec2 grid = abs(fract(uv) - 0.5);
    float line = step(0.46, max(grid.x, grid.y));
    float dist = length(vWorldPos) * 0.025;
    float fade = exp(-dist * dist);
    float alpha = line * fade * 0.35;
    gl_FragColor = vec4(uColor, alpha);
  }
`;

export function createScene() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x040410);
  scene.fog = new THREE.FogExp2(0x050510, 0.016);

  const camera = new THREE.PerspectiveCamera(
    50,
    window.innerWidth / window.innerHeight,
    0.1,
    120
  );
  camera.position.set(0, 10, 28);
  camera.lookAt(0, 10, 0);

  // Ambient — dimmer, bloom compensates
  const ambientLight = new THREE.AmbientLight(0x303050, 0.4);
  scene.add(ambientLight);

  // Main directional
  const directionalLight = new THREE.DirectionalLight(0xeeeeff, 0.9);
  directionalLight.position.set(5, 25, 15);
  scene.add(directionalLight);

  // Fill light — deeper blue
  const fillLight = new THREE.DirectionalLight(0x3050cc, 0.25);
  fillLight.position.set(-5, 10, 10);
  scene.add(fillLight);

  // Animated ground grid
  const groundMaterial = new THREE.ShaderMaterial({
    vertexShader: GRID_VERTEX,
    fragmentShader: GRID_FRAGMENT,
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(0x1a3a5a) }
    },
    transparent: true,
    side: THREE.DoubleSide,
    depthWrite: false
  });

  const groundPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(100, 100),
    groundMaterial
  );
  groundPlane.rotation.x = -Math.PI / 2;
  groundPlane.position.y = -1;
  scene.add(groundPlane);

  return { scene, camera, groundMaterial };
}
