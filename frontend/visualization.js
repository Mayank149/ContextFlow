/**
 * ContextFlow 3D Context Topology Visualization
 * Pure Three.js implementation with zero external orbit control dependencies.
 * Visualizes conversational topics as floating orbital nodes with radiant transition arcs.
 */

class ContextTopologyVisualization {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) {
      console.error("Canvas mount container not found:", containerId);
      return;
    }

    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.nodes = new Map(); // topic_id -> { mesh, glow, labelSprite, ring, data }
    this.links = []; // Array of { lineMesh, startNode, endNode, curve }
    this.activePulseParticles = [];
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2(-999, -999);

    // Orbit & Camera Interaction State
    this.isDragging = false;
    this.previousMousePosition = { x: 0, y: 0 };
    this.cameraDistance = 42;
    this.targetRotation = { x: 0.25, y: 0.4 };
    this.currentRotation = { x: 0.25, y: 0.4 };
    this.showGrid = true;
    this.gridHelper = null;

    this.init();
  }

  init() {
    const width = this.container.clientWidth || 600;
    const height = this.container.clientHeight || 450;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x090b0e);
    this.scene.fog = new THREE.FogExp2(0x090b0e, 0.015);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    this.updateCameraPosition();

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.65);
    this.scene.add(ambientLight);

    const pointLight = new THREE.PointLight(0xffeedd, 1.2, 100);
    pointLight.position.set(20, 30, 20);
    this.scene.add(pointLight);

    const blueLight = new THREE.PointLight(0x7c3aed, 0.9, 80);
    blueLight.position.set(-20, -10, -20);
    this.scene.add(blueLight);

    // 5. Delicate Celestial Grid
    this.gridHelper = new THREE.GridHelper(60, 30, 0x1f2430, 0x141822);
    this.gridHelper.position.y = -10;
    this.scene.add(this.gridHelper);

    // 6. Ambient Floating Dust Particles
    this.createDustParticles();

    // 7. Event Listeners
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
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / el.clientWidth) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / el.clientHeight) * 2 + 1;

      if (!this.isDragging) return;

      const deltaX = e.clientX - this.previousMousePosition.x;
      const deltaY = e.clientY - this.previousMousePosition.y;

      this.targetRotation.y += deltaX * 0.007;
      this.targetRotation.x = Math.max(-1.4, Math.min(1.4, this.targetRotation.x + deltaY * 0.007));

      this.previousMousePosition = { x: e.clientX, y: e.clientY };
    });

    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.cameraDistance = Math.max(15, Math.min(80, this.cameraDistance + e.deltaY * 0.04));
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

  createDustParticles() {
    const particleCount = 200;
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount * 3; i += 3) {
      positions[i] = (Math.random() - 0.5) * 80;
      positions[i + 1] = (Math.random() - 0.5) * 40;
      positions[i + 2] = (Math.random() - 0.5) * 80;
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = new THREE.PointsMaterial({
      color: 0xfaecd5,
      size: 0.35,
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
    canvas.height = 80;
    const ctx = canvas.getContext('2d');

    ctx.font = 'bold 32px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Badge pill background
    ctx.fillStyle = isHighlight ? 'rgba(245, 158, 11, 0.25)' : 'rgba(30, 35, 48, 0.7)';
    ctx.strokeStyle = isHighlight ? '#f59e0b' : 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 3;
    
    // Draw rounded pill
    const x = 28, y = 14, w = 200, h = 52, r = 14;
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
    ctx.fill();
    ctx.stroke();

    // Text
    ctx.fillStyle = isHighlight ? '#faecd5' : '#e2dfd7';
    ctx.fillText(text, 128, 40);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthTest: false
    });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.scale.set(6, 1.875, 1);
    return sprite;
  }

  /**
   * Rebuilds the 3D topic topology given active and previous topics
   */
  syncTopics(activeTopic, previousTopics = []) {
    // 1. Clear old topology meshes
    for (const [id, node] of this.nodes) {
      this.scene.remove(node.mesh);
      this.scene.remove(node.glow);
      this.scene.remove(node.labelSprite);
      if (node.ring) this.scene.remove(node.ring);
    }
    this.nodes.clear();

    for (const link of this.links) {
      this.scene.remove(link.lineMesh);
    }
    this.links = [];

    // 2. Position Active Topic at Center (slightly elevated)
    if (activeTopic) {
      this.createNode(activeTopic, new THREE.Vector3(0, 1.5, 0), true);
    }

    // 3. Position Previous Topics along an orbital ring
    const radius = 15;
    const count = previousTopics.length;

    previousTopics.forEach((topic, idx) => {
      const angle = (idx / Math.max(1, count)) * Math.PI * 2 + 0.5;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = Math.sin(angle * 2) * 3 - 0.5;

      this.createNode(topic, new THREE.Vector3(x, y, z), false);
    });

    // 4. Create Curved Celestial Links between Active Topic and Previous Topics
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
    const radius = isActive ? 2.2 : 1.6;
    const geometry = new THREE.SphereGeometry(radius, 32, 32);

    // Node Material
    const color = isActive ? 0xf59e0b : 0xa78bfa;
    const material = new THREE.MeshStandardMaterial({
      color: color,
      roughness: 0.25,
      metalness: 0.6,
      emissive: color,
      emissiveIntensity: isActive ? 0.45 : 0.2
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.userData = { topic: topicData, isActive: isActive };
    this.scene.add(mesh);

    // Outer Aura Glow Mesh
    const glowGeo = new THREE.SphereGeometry(radius * 1.35, 16, 16);
    const glowMat = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: isActive ? 0.25 : 0.1,
      wireframe: true
    });
    const glow = new THREE.Mesh(glowGeo, glowMat);
    glow.position.copy(position);
    this.scene.add(glow);

    // Planetary Ring for Active Topic
    let ring = null;
    if (isActive) {
      const ringGeo = new THREE.RingGeometry(radius * 1.8, radius * 2.2, 32);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xf59e0b,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.45
      });
      ring = new THREE.Mesh(ringGeo, ringMat);
      ring.rotation.x = Math.PI / 2.6;
      ring.position.copy(position);
      this.scene.add(ring);
    }

    // Label Sprite
    const labelSprite = this.createLabelSprite(topicData.topic_id, isActive);
    labelSprite.position.set(position.x, position.y + radius + 1.8, position.z);
    this.scene.add(labelSprite);

    this.nodes.set(topicData.topic_id, {
      mesh,
      glow,
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

    // Midpoint control point bowed slightly upward
    const midX = (posA.x + posB.x) / 2;
    const midY = (posA.y + posB.y) / 2 + 3.5;
    const midZ = (posA.z + posB.z) / 2;
    const mid = new THREE.Vector3(midX, midY, midZ);

    const curve = new THREE.QuadraticBezierCurve3(posA, mid, posB);
    const points = curve.getPoints(40);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
      color: 0x3b4254,
      transparent: true,
      opacity: 0.55
    });

    const lineMesh = new THREE.Line(geometry, material);
    this.scene.add(lineMesh);

    this.links.push({
      lineMesh,
      curve,
      nodeA,
      nodeB
    });
  }

  /**
   * Transition Effect: RETURN
   * Shoots an electric violet energy pulse along the curve to the target node
   */
  triggerReturnTransition(activeTopicId, returnedTopicId) {
    const targetNode = this.nodes.get(returnedTopicId);
    const activeNode = this.nodes.get(activeTopicId);

    if (!targetNode || !activeNode) return;

    // Highlight target node
    targetNode.mesh.material.emissive.setHex(0xa855f7);
    targetNode.mesh.material.emissiveIntensity = 0.9;
    targetNode.glow.material.color.setHex(0xc084fc);
    targetNode.glow.material.opacity = 0.6;

    // Spawn 16 pulsating beam particles travelling along the curve
    const matchingLink = this.links.find(
      l => (l.nodeA === activeNode && l.nodeB === targetNode) ||
           (l.nodeA === targetNode && l.nodeB === activeNode)
    );

    if (matchingLink) {
      matchingLink.lineMesh.material.color.setHex(0xa855f7);
      matchingLink.lineMesh.material.opacity = 1.0;

      for (let i = 0; i < 18; i++) {
        const particleGeo = new THREE.SphereGeometry(0.35, 8, 8);
        const particleMat = new THREE.MeshBasicMaterial({
          color: 0xe9d5ff,
          transparent: true,
          opacity: 0.95
        });
        const particleMesh = new THREE.Mesh(particleGeo, particleMat);
        this.scene.add(particleMesh);

        this.activePulseParticles.push({
          mesh: particleMesh,
          curve: matchingLink.curve,
          progress: -(i * 0.05), // Staggered entry
          speed: 0.02,
          targetNode: targetNode
        });
      }
    }
  }

  /**
   * Transition Effect: SHIFT
   * Blooms dynamic expanding ring on new topic
   */
  triggerShiftTransition(newTopicId) {
    const node = this.nodes.get(newTopicId);
    if (!node) return;

    node.mesh.material.emissive.setHex(0xf59e0b);
    node.mesh.material.emissiveIntensity = 0.85;

    // Bloom shockwave ring
    const ringGeo = new THREE.RingGeometry(1, 1.4, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
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
      scale += 0.2;
      ringMesh.scale.set(scale, scale, scale);
      ringMat.opacity -= 0.035;
      if (ringMat.opacity > 0) {
        requestAnimationFrame(expandAnim);
      } else {
        this.scene.remove(ringMesh);
      }
    };
    expandAnim();
  }

  /**
   * Transition Effect: CONTINUATION
   * Harmonically pulses active node with jade green glow
   */
  triggerContinuationTransition(activeTopicId) {
    const node = this.nodes.get(activeTopicId);
    if (!node) return;

    node.mesh.material.emissive.setHex(0x10b981);
    node.mesh.material.emissiveIntensity = 0.8;

    setTimeout(() => {
      if (node.isActive) {
        node.mesh.material.emissive.setHex(0xf59e0b);
        node.mesh.material.emissiveIntensity = 0.45;
      }
    }, 1800);
  }

  resetCamera() {
    this.targetRotation = { x: 0.25, y: 0.4 };
    this.cameraDistance = 42;
  }

  toggleGrid() {
    this.showGrid = !this.showGrid;
    if (this.gridHelper) {
      this.gridHelper.visible = this.showGrid;
    }
  }

  animate() {
    requestAnimationFrame(this.animate);

    const time = performance.now() * 0.001;

    // Smooth camera inertia
    this.currentRotation.x += (this.targetRotation.x - this.currentRotation.x) * 0.08;
    this.currentRotation.y += (this.targetRotation.y - this.currentRotation.y) * 0.08;
    this.updateCameraPosition();

    // Subtle idle floating & harmonic breathing
    for (const [id, node] of this.nodes) {
      const offset = (id.charCodeAt(id.length - 1) || 1) * 0.7;
      node.mesh.position.y = node.basePos.y + Math.sin(time * 1.5 + offset) * 0.35;
      node.glow.position.y = node.mesh.position.y;
      node.labelSprite.position.y = node.mesh.position.y + (node.isActive ? 4.0 : 3.4);

      if (node.ring) {
        node.ring.position.y = node.mesh.position.y;
        node.ring.rotation.z += 0.008;
      }
      node.glow.rotation.y += 0.005;
    }

    // Update Return Beam Particles
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
        // Particle completed path
        this.scene.remove(p.mesh);
        this.activePulseParticles.splice(i, 1);
      }
    }

    // Dust gentle drift
    if (this.dust) {
      this.dust.rotation.y = time * 0.02;
    }

    this.renderer.render(this.scene, this.camera);
  }
}

window.ContextTopologyVisualization = ContextTopologyVisualization;
