/**
 * ContextFlow 3D Context Topology Visualization
 * Modern & Subtle Cybernetic Obsidian Design.
 * Features frosted crystalline nodes, delicate ethereal halos, and radiant transition beams.
 */

class ContextTopologyVisualization {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodes = new Map(); // topic_id -> { mesh, innerGlow, halo, labelSprite, ring, data }
    this.links = []; // Array of { lineMesh, startNode, endNode, curve }
    this.activePulseParticles = [];
    this.dust = null;

    // Camera Orbit State
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraDistance = 38;
    this.targetRotation = { x: 0.22, y: 0.35 };
    this.currentRotation = { x: 0.22, y: 0.35 };

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 360;
    const height = this.container.clientHeight || 380;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x040806);
    this.scene.fog = new THREE.FogExp2(0x040806, 0.016);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights - Subtle emerald & violet cyber ambient
    const ambientLight = new THREE.AmbientLight(0xd1fae5, 0.6);
    this.scene.add(ambientLight);

    const greenPointLight = new THREE.PointLight(0x00ff88, 1.4, 70);
    greenPointLight.position.set(15, 20, 15);
    this.scene.add(greenPointLight);

    const purplePointLight = new THREE.PointLight(0xa855f7, 1.2, 70);
    purplePointLight.position.set(-15, -15, -15);
    this.scene.add(purplePointLight);

    // 5. Delicate Celestial Grid
    const grid = new THREE.GridHelper(50, 25, 0x064e3b, 0x071b12);
    grid.position.y = -8;
    this.scene.add(grid);

    // 6. Ethereal ambient stardust
    this.createStardust();

    // 7. Event Handlers
    this.setupInteractions();
    window.addEventListener('resize', () => this.onWindowResize());

    // 8. Animation Loop
    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  updateCameraPosition() {
    this.camera.position.x = this.cameraDistance * Math.sin(this.currentRotation.y) * Math.cos(this.currentRotation.x);
    this.camera.position.y = this.cameraDistance * Math.sin(this.currentRotation.x);
    this.camera.position.z = this.cameraDistance * Math.cos(this.currentRotation.y) * Math.cos(this.currentRotation.x);
    this.camera.lookAt(0, 0, 0);
  }

  setupInteractions() {
    const el = this.renderer.domElement;

    el.addEventListener('mousedown', (e) => {
      this.isDragging = true;
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    window.addEventListener('mouseup', () => {
      this.isDragging = false;
    });

    el.addEventListener('mousemove', (e) => {
      if (!this.isDragging) return;
      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.targetRotation.y += deltaX * 0.006;
      this.targetRotation.x = Math.max(-1.4, Math.min(1.4, this.targetRotation.x + deltaY * 0.006));
      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(16, Math.min(70, this.cameraDistance + e.deltaY * 0.035));
    }, { passive: false });
  }

  onWindowResize() {
    if (!this.container || !this.renderer || !this.camera) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  createStardust() {
    const count = 160;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 60;
      positions[i + 1] = (Math.random() - 0.5) * 35;
      positions[i + 2] = (Math.random() - 0.5) * 60;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0x34d399,
      size: 0.28,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });

    this.dust = new THREE.Points(geometry, material);
    this.scene.add(this.dust);
  }

  createLabelSprite(text, isHighlight = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 30px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge outline
    const x = 30, y = 12, w = 196, h = 48, r = 12;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();

    ctx.fillStyle = isHighlight ? 'rgba(16, 185, 129, 0.22)' : 'rgba(168, 85, 247, 0.18)';
    ctx.strokeStyle = isHighlight ? '#00ff88' : '#a855f7';
    ctx.lineWidth = 2.5;
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f0fdf4';
    ctx.fillText(text, 128, 36);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(5.2, 1.46, 1);
    return sprite;
  }

  /**
   * Rebuilds topic nodes in 3D space
   */
  syncTopics(activeTopic, previousTopics = []) {
    // Clear old elements
    for (const [id, node] of this.nodes) {
      this.scene.remove(node.mesh);
      this.scene.remove(node.innerGlow);
      this.scene.remove(node.halo);
      this.scene.remove(node.labelSprite);
      if (node.ring) this.scene.remove(node.ring);
    }
    this.nodes.clear();

    for (const link of this.links) {
      this.scene.remove(link.lineMesh);
    }
    this.links = [];

    if (!activeTopic && previousTopics.length === 0) return;

    // 1. Active Topic at Center
    if (activeTopic) {
      this.createNode(activeTopic, new THREE.Vector3(0, 1.2, 0), true);
    }

    // 2. Previous topics orbiting around
    const radius = 13;
    const count = previousTopics.length;

    previousTopics.forEach((topic, idx) => {
      const angle = (idx / Math.max(1, count)) * Math.PI * 2 + 0.4;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(angle * 2) * 2.2 - 0.5;

      this.createNode(topic, new THREE.Vector3(x, y, z), false);
    });

    // 3. Elegant Bezier links
    const activeNode = activeTopic ? this.nodes.get(activeTopic.topic_id) : null;
    if (activeNode) {
      for (const topic of previousTopics) {
        const prevNode = this.nodes.get(topic.topic_id);
        if (prevNode) {
          this.createCurvedLink(activeNode, prevNode);
        }
      }
    }
  }

  createNode(topicData, position, isActive = false) {
    const radius = isActive ? 1.8 : 1.35;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    // Subtle modern frosted glass material
    const baseColor = isActive ? 0x00ff88 : 0xa855f7;
    const material = new THREE.MeshPhysicalMaterial({
      color: baseColor,
      roughness: 0.15,
      metalness: 0.1,
      transmission: 0.6,
      opacity: 0.85,
      transparent: true,
      emissive: baseColor,
      emissiveIntensity: isActive ? 0.35 : 0.15
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    this.scene.add(mesh);

    // Subtle inner glowing core
    const coreGeo = new THREE.SphereGeometry(radius * 0.55, 16, 16);
    const coreMat = new THREE.MeshBasicMaterial({
      color: isActive ? 0xffffff : 0xe9d5ff,
      transparent: true,
      opacity: 0.8
    });
    const innerGlow = new THREE.Mesh(coreGeo, coreMat);
    innerGlow.position.copy(position);
    this.scene.add(innerGlow);

    // Subtle outer wire halo
    const haloGeo = new THREE.SphereGeometry(radius * 1.3, 16, 16);
    const haloMat = new THREE.MeshBasicMaterial({
      color: baseColor,
      wireframe: true,
      transparent: true,
      opacity: isActive ? 0.18 : 0.08
    });
    const halo = new THREE.Mesh(haloGeo, haloMat);
    halo.position.copy(position);
    this.scene.add(halo);

    // Subtle ethereal dashed orbital ring for active topic
    let ring = null;
    if (isActive) {
      const ringGeo = new THREE.RingGeometry(radius * 1.6, radius * 1.8, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0x00ff88,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.35
      });
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.5;
      ring.position.copy(position);
      this.scene.add(ring);
    }

    // Label Sprite
    const labelSprite = this.createLabelSprite(topicData.topic_id, isActive);
    labelSprite.position.set(position.x, position.y + radius + 1.4, position.z);
    this.scene.add(labelSprite);

    this.nodes.set(topicData.topic_id, {
      mesh,
      innerGlow,
      halo,
      labelSprite,
      ring,
      data: topicData,
      basePos: position.clone(),
      isActive
    });
  }

  createCurvedLink(nodeA, nodeB) {
    const posA = nodeA.mesh.position;
    const posB = nodeB.mesh.position;

    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2 + 2.8;
    const midZ = (posA.z + posB.z) / 2;
    const mid = new THREE.Vector3(midX, midY, midZ);

    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
    const points = curve.getPoints(35);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: 0x0d3826,
      transparent: true,
      opacity: 0.6
    });

    const lineMesh = new THREE.Line(geometry, material);
    this.scene.add(lineMesh);

    this.links.push({ lineMesh, curve, nodeA, nodeB });
  }

  /**
   * Radiant Beam on RETURN
   */
  triggerReturnTransition(activeTopicId, returnedTopicId) {
    const targetNode = this.nodes.get(returnedTopicId);
    const activeNode = this.nodes.get(activeTopicId);
    if (!targetNode || !activeNode) return;

    // Illuminate target node with electric purple
    targetNode.mesh.material.emissive.setHex(0xa855f7);
    targetNode.mesh.material.emissiveIntensity = 0.9;
    targetNode.halo.material.opacity = 0.5;

    const matchingLink = this.links.find(
      l => (l.nodeA === activeNode && l.nodeB === targetNode) ||
           (l.nodeA === targetNode && l.nodeB === activeNode)
    );

    if (matchingLink) {
      matchingLink.lineMesh.material.color.setHex(0xc084fc);
      matchingLink.lineMesh.material.opacity = 1.0;

      for (let i = 0; i < 16; i++) {
        const pGeo = new THREE.SphereGeometry(0.26, 8, 8);
        const pMat = new THREE.MeshBasicMaterial({
          color: 0xf5d0fe,
          transparent: true,
          opacity: 0.95
        });
        const pMesh = new THREE.Mesh(pGeo, pMat);
        this.scene.add(pMesh);

        this.activePulseParticles.push({
          mesh: pMesh,
          curve: matchingLink.curve,
          progress: -(i * 0.05),
          speed: 0.025
        });
      }
    }
  }

  /**
   * Dynamic Expansion on SHIFT
   */
  triggerShiftTransition(newTopicId) {
    const node = this.nodes.get(newTopicId);
    if (!node) return;

    const ringGeo = new THREE.RingGeometry(0.8, 1.1, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xfbbf24,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.8
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(node.mesh.position);
    ringMesh.rotation.x = Math.PI / 2;
    this.scene.add(ringMesh);

    let scale = 1;
    const expandAnim = () => {
      scale += 0.22;
      ringMesh.scale.set(scale, scale, scale);
      ringMat.opacity -= 0.04;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(expandAnim);
      } else {
        this.scene.remove(ringMesh);
      }
    };
    expandAnim();
  }

  /**
   * Harmonic Breathing Pulse on CONTINUATION
   */
  triggerContinuationTransition(activeTopicId) {
    const node = this.nodes.get(activeTopicId);
    if (!node) return;

    node.mesh.material.emissive.setHex(0x00ff88);
    node.mesh.material.emissiveIntensity = 0.75;

    setTimeout(() => {
      if (node.isActive) {
        node.mesh.material.emissive.setHex(0x10b981);
        node.mesh.material.emissiveIntensity = 0.35;
      }
    }, 1500);
  }

  resetCamera() {
    this.targetRotation = { x: 0.22, y: 0.35 };
    this.cameraDistance = 38;
  }

  animate() {
    requestAnimationFrame(this.animate);
    const time = performance.now() * 0.001;

    // Smooth inertia
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;
    this.updateCameraPosition();

    // Floating idle oscillation
    for (const [id, node] of this.nodes) {
      const offset = (id.charCodeAt(id.length - 1) || 1) * 0.6;
      node.mesh.position.y = node.basePos.y + Math.sin(time * 1.4 + offset) * 0.28;
      node.innerGlow.position.y = node.mesh.position.y;
      node.halo.position.y = node.mesh.position.y;
      node.labelSprite.position.y = node.mesh.position.y + (node.isActive ? 3.3 : 2.8);

      if (node.ring) {
        node.ring.position.y = node.mesh.position.y;
        node.ring.rotation.z += 0.006;
      }
      node.halo.rotation.y += 0.004;
    }

    // Pulse beam animation
    for (let i = this.activePulseParticles.length - 1; i >= 0; i--) {
      const p = this.activePulseParticles[i];
      p.progress += p.speed;

      if (p.progress >= 0 && p.progress <= 1) {
        p.mesh.visible = true;
        const pos = p.curve.getPoint(p.progress);
        p.mesh.position.copy(pos);
      } else if (p.progress < 0) {
        p.mesh.visible = false;
      } else {
        this.scene.remove(p.mesh);
        this.activePulseParticles.splice(i, 1);
      }
    }

    if (this.dust) {
      this.dust.rotation.y = time * 0.015;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.ContextTopologyVisualization = ContextTopologyVisualization;
