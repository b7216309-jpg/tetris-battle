import * as THREE from 'three';

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.particles = [];
    this.shakeTargets = [];
    this.cameraShakes = [];
    this.activeBeams = [];

    // Particle pool
    this.particleGeometry = new THREE.SphereGeometry(0.1, 6, 6);
    this.particlePool = [];
    this.activeParticles = [];

    // Beam geometry (reused)
    this.beamGeometry = new THREE.BoxGeometry(1, 0.15, 0.15);
  }

  spawnLineClearParticles(row, boardOffsetX, colors, count = 50) {
    for (let i = 0; i < count; i++) {
      const particle = this._getParticle();
      const col = Math.random() * 10;

      particle.position.set(
        boardOffsetX + col,
        row,
        0
      );

      particle.velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 10,
        Math.random() * 8 + 2,
        (Math.random() - 0.5) * 5
      );

      particle.lifetime = 0.6 + Math.random() * 0.5;
      particle.maxLifetime = particle.lifetime;
      particle.scale.setScalar(0.8 + Math.random() * 1.4);

      const color = colors[Math.floor(Math.random() * colors.length)] || 0xffffff;
      particle.material.color.setHex(color);
      particle.material.color.multiplyScalar(1.3);
      particle.material.opacity = 1;

      this.activeParticles.push(particle);
    }
  }

  spawnAttackEffect(fromX, toX, lineCount) {
    const count = lineCount * 12;
    for (let i = 0; i < count; i++) {
      const particle = this._getParticle();
      const startY = Math.random() * 5;

      particle.position.set(fromX + 5, startY, 0);
      particle.velocity = new THREE.Vector3(
        (toX - fromX) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );

      particle.lifetime = 0.3 + Math.random() * 0.2;
      particle.maxLifetime = particle.lifetime;
      particle.scale.setScalar(0.8 + Math.random() * 0.7);
      particle.material.color.setHex(0xff4400);
      particle.material.color.multiplyScalar(1.5);
      particle.material.opacity = 1;

      this.activeParticles.push(particle);
    }
  }

  spawnAttackBeam(fromX, toX, intensity = 1) {
    const midX = (fromX + toX) / 2 + 5;
    const length = Math.abs(toX - fromX) + 10;
    const color = new THREE.Color(0xff4400).multiplyScalar(3.0 * intensity);

    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.9,
      toneMapped: false
    });

    const mesh = new THREE.Mesh(this.beamGeometry, mat);
    mesh.scale.set(length, intensity * 1.2, intensity * 1.2);
    mesh.position.set(midX, 3 + Math.random() * 8, 0.5);
    this.scene.add(mesh);

    this.activeBeams.push({
      mesh,
      material: mat,
      lifetime: 0.25,
      maxLifetime: 0.25
    });
  }

  spawnBonusBurst(centerX, centerY, colors, count = 42) {
    for (let i = 0; i < count; i++) {
      const particle = this._getParticle();
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.15;
      const speed = 4 + Math.random() * 6;

      particle.position.set(
        centerX + (Math.random() - 0.5) * 1.5,
        centerY + (Math.random() - 0.5) * 1.5,
        0
      );

      particle.velocity = new THREE.Vector3(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        (Math.random() - 0.5) * 3
      );

      particle.lifetime = 0.5 + Math.random() * 0.45;
      particle.maxLifetime = particle.lifetime;
      particle.scale.setScalar(1.2 + Math.random() * 1.8);

      const color = colors[Math.floor(Math.random() * colors.length)] || 0xffffff;
      particle.material.color.setHex(color);
      particle.material.color.multiplyScalar(1.3);
      particle.material.opacity = 1;

      this.activeParticles.push(particle);
    }
  }

  shakeBoard(boardGroup, intensity = 0.3, duration = 300) {
    this.shakeTargets.push({
      group: boardGroup,
      intensity,
      duration,
      elapsed: 0,
      baseX: boardGroup.position.x,
      baseY: boardGroup.position.y
    });
  }

  shakeCamera(camera, intensity = 0.008, duration = 300) {
    this.cameraShakes.push({
      camera,
      intensity,
      duration,
      elapsed: 0,
      baseZ: camera.rotation.z
    });
  }

  update(deltaMs) {
    const dt = deltaMs / 1000;

    // Update particles
    for (let i = this.activeParticles.length - 1; i >= 0; i--) {
      const p = this.activeParticles[i];
      p.lifetime -= dt;

      if (p.lifetime <= 0) {
        this._releaseParticle(p);
        this.activeParticles.splice(i, 1);
        continue;
      }

      p.velocity.y -= 15 * dt;
      p.position.x += p.velocity.x * dt;
      p.position.y += p.velocity.y * dt;
      p.position.z += p.velocity.z * dt;

      p.material.opacity = p.lifetime / p.maxLifetime;
      const scale = Math.max(0.2, p.lifetime / p.maxLifetime);
      p.scale.setScalar(scale * 2.0);
    }

    // Update beams
    for (let i = this.activeBeams.length - 1; i >= 0; i--) {
      const b = this.activeBeams[i];
      b.lifetime -= dt;

      if (b.lifetime <= 0) {
        this.scene.remove(b.mesh);
        b.material.dispose();
        this.activeBeams.splice(i, 1);
        continue;
      }

      const progress = b.lifetime / b.maxLifetime;
      b.material.opacity = progress;
      b.mesh.scale.y = progress * 1.2;
      b.mesh.scale.z = progress * 1.2;
    }

    // Update board shakes
    for (let i = this.shakeTargets.length - 1; i >= 0; i--) {
      const s = this.shakeTargets[i];
      s.elapsed += deltaMs;

      if (s.elapsed >= s.duration) {
        s.group.position.x = s.baseX;
        s.group.position.y = s.baseY;
        this.shakeTargets.splice(i, 1);
        continue;
      }

      const progress = s.elapsed / s.duration;
      const decay = 1 - progress;
      s.group.position.x = s.baseX + Math.sin(s.elapsed * 0.05) * s.intensity * decay;
      s.group.position.y = s.baseY + Math.cos(s.elapsed * 0.07) * s.intensity * decay * 0.5;
    }

    // Update camera shakes
    for (let i = this.cameraShakes.length - 1; i >= 0; i--) {
      const c = this.cameraShakes[i];
      c.elapsed += deltaMs;

      if (c.elapsed >= c.duration) {
        c.camera.rotation.z = c.baseZ;
        this.cameraShakes.splice(i, 1);
        continue;
      }

      const progress = c.elapsed / c.duration;
      const decay = 1 - progress;
      c.camera.rotation.z = c.baseZ + Math.sin(c.elapsed * 0.06) * c.intensity * decay;
    }
  }

  _getParticle() {
    if (this.particlePool.length > 0) {
      const p = this.particlePool.pop();
      p.visible = true;
      return p;
    }

    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 1,
      toneMapped: false
    });
    const mesh = new THREE.Mesh(this.particleGeometry, mat);
    mesh.velocity = new THREE.Vector3();
    mesh.lifetime = 0;
    mesh.maxLifetime = 0;
    this.scene.add(mesh);
    return mesh;
  }

  _releaseParticle(p) {
    p.visible = false;
    this.particlePool.push(p);
  }

  dispose() {
    for (const p of this.activeParticles) {
      this.scene.remove(p);
      p.material.dispose();
    }
    for (const p of this.particlePool) {
      this.scene.remove(p);
      p.material.dispose();
    }
    for (const b of this.activeBeams) {
      this.scene.remove(b.mesh);
      b.material.dispose();
    }
    this.particleGeometry.dispose();
    this.beamGeometry.dispose();
  }
}
