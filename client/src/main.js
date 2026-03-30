import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { createScene } from './scene/SceneSetup.js';
import { GameManager } from './game/GameManager.js';
import { UIManager } from './ui/UIManager.js';

const app = document.getElementById('app');

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
app.appendChild(renderer.domElement);

const { scene, camera, groundMaterial } = createScene();

// Post-processing: bloom pipeline
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  0.38,  // strength (halved)
  0.3,   // radius
  0.22   // threshold
);
composer.addPass(bloomPass);
composer.addPass(new OutputPass());

const game = new GameManager(scene, camera, renderer, groundMaterial);
const ui = new UIManager(game);

let lastTime = 0;
renderer.setAnimationLoop((time) => {
  const delta = lastTime ? time - lastTime : 16.67;
  lastTime = time;
  game.update(time, delta);
  composer.render();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});
