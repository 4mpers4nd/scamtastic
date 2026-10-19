'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { avatarSvgDataUri } from '@/lib/avatar';
import {
  connectionIntensity,
  connectionRadius,
  focusCameraOffset,
  initialNeuralView,
} from '@/lib/neural/geometry.mjs';
import { createFrameLoop } from '@/lib/neural/frame-loop.mjs';
import { NEURAL_RENDERING, SYSTEM_NODE } from '@/lib/neural/rendering.mjs';
import type { NeuralConnection, NeuralSearchResult } from '@/lib/neural/types';

type CameraMode = 'orbit' | 'flight';

type Props = {
  nodes: NeuralSearchResult[];
  connections: NeuralConnection[];
  selectedId?: string | null;
  focusId?: string | null;
  maxStrength?: number;
  centralAvatar?: { nodeId: string; seed: string; version: number };
  focusScreenPosition?: { x: number; y: number };
  cameraMode?: CameraMode;
  autoRotate?: boolean;
  onSelect?: (node: NeuralSearchResult) => void;
  onSystemSelect?: () => void;
  className?: string;
  label?: string;
};

export default function NeuralCanvas({
  nodes,
  connections,
  selectedId = null,
  focusId = null,
  maxStrength = 20,
  centralAvatar,
  focusScreenPosition,
  cameraMode = 'orbit',
  autoRotate = false,
  onSelect,
  onSystemSelect,
  className,
  label = 'Interactive three-dimensional player neural network',
}: Props) {
  const focusScreenX = focusScreenPosition?.x;
  const focusScreenY = focusScreenPosition?.y;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selectRef = useRef(onSelect);
  const systemSelectRef = useRef(onSystemSelect);
  const [rendererError, setRendererError] = useState(false);
  selectRef.current = onSelect;
  systemSelectRef.current = onSystemSelect;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const canvasElement: HTMLCanvasElement = canvas;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas: canvasElement,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power',
      });
    } catch (error) {
      console.error('Neural network WebGL renderer is unavailable:', error);
      setRendererError(true);
      return;
    }

    setRendererError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setClearColor(NEURAL_RENDERING.background, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 10000);
    const ambient = new THREE.AmbientLight(0xffffff, 1.4);
    scene.add(ambient);

    const visibleNodes = nodes.filter(
      (node) =>
        Number.isFinite(node.x) && Number.isFinite(node.y) && Number.isFinite(node.z),
    );
    const nodeIndex = new Map(visibleNodes.map((node, index) => [node.id, index]));
    const initialView = initialNeuralView(
      focusId
        ? visibleNodes
        : [...visibleNodes, { id: SYSTEM_NODE.id, x: SYSTEM_NODE.x, y: SYSTEM_NODE.y, z: SYSTEM_NODE.z }],
      focusId,
    );
    const target = new THREE.Vector3(
      initialView.target.x,
      initialView.target.y,
      initialView.target.z,
    );
    const yawStart = 0;
    const pitchStart = 0.14;
    let yaw = yawStart;
    let pitch = pitchStart;
    let distance = initialView.distance;
    let previousFrame = performance.now();
    let needsRender = true;
    let frameLoop: ReturnType<typeof createFrameLoop> | null = null;
    let pointerMoved = false;
    let lastPointerUp = 0;
    let lastSelectedId: string | null = null;
    const pressedKeys = new Set<string>();
    const pointers = new Map<number, { x: number; y: number }>();
    let previousPinchDistance = 0;
    let previousCenter = { x: 0, y: 0 };

    function requestRender() {
      needsRender = true;
      frameLoop?.schedule();
    }

    const nodeGeometry = new THREE.SphereGeometry(0.48, 16, 12);
    const nodeMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
    });
    const nodeMesh = new THREE.InstancedMesh(
      nodeGeometry,
      nodeMaterial,
      Math.max(visibleNodes.length, 1),
    );
    nodeMesh.count = visibleNodes.length;
    const nodeTransform = new THREE.Object3D();
    visibleNodes.forEach((node, index) => {
      nodeTransform.position.set(node.x, node.y, node.z);
      nodeTransform.scale.setScalar(1);
      nodeTransform.updateMatrix();
      nodeMesh.setMatrixAt(index, nodeTransform.matrix);
      nodeMesh.setColorAt(index, new THREE.Color(NEURAL_RENDERING.playerCore));
    });
    nodeMesh.instanceMatrix.needsUpdate = true;
    if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
    nodeMesh.computeBoundingSphere();
    scene.add(nodeMesh);

    const systemCore = new THREE.Mesh(
      new THREE.SphereGeometry(NEURAL_RENDERING.systemRadius, 24, 18),
      new THREE.MeshBasicMaterial({ color: NEURAL_RENDERING.systemCore }),
    );
    systemCore.position.set(SYSTEM_NODE.x, SYSTEM_NODE.y, SYSTEM_NODE.z);
    scene.add(systemCore);

    const glowCanvas = document.createElement('canvas');
    glowCanvas.width = 128;
    glowCanvas.height = 128;
    const glowContext = glowCanvas.getContext('2d');
    if (glowContext) {
      const gradient = glowContext.createRadialGradient(64, 64, 2, 64, 64, 64);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.42)');
      gradient.addColorStop(0.28, 'rgba(255, 255, 255, 0.18)');
      gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
      glowContext.fillStyle = gradient;
      glowContext.fillRect(0, 0, 128, 128);
    }
    const systemGlowTexture = new THREE.CanvasTexture(glowCanvas);
    const systemGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: systemGlowTexture,
        color: NEURAL_RENDERING.systemCyan,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      }),
    );
    systemGlow.scale.setScalar(NEURAL_RENDERING.systemGlowSize);
    systemGlow.renderOrder = 1;
    scene.add(systemGlow);

    const cyanRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.45, 0.055, 8, 48),
      new THREE.MeshBasicMaterial({
        color: NEURAL_RENDERING.systemCyan,
        transparent: true,
        opacity: 0.52,
      }),
    );
    const magentaRing = new THREE.Mesh(
      new THREE.TorusGeometry(2.72, 0.035, 8, 48),
      new THREE.MeshBasicMaterial({
        color: NEURAL_RENDERING.systemMagenta,
        transparent: true,
        opacity: 0.32,
      }),
    );
    cyanRing.rotation.set(0.5, 0.25, 0.1);
    magentaRing.rotation.set(-0.35, 0.7, 0.3);
    scene.add(cyanRing, magentaRing);

    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 128;
    logoCanvas.height = 128;
    const logoContext = logoCanvas.getContext('2d');
    if (logoContext) {
      logoContext.fillStyle = '#ffffff';
      logoContext.font = '700 108px Arial, sans-serif';
      logoContext.textAlign = 'center';
      logoContext.textBaseline = 'middle';
      logoContext.fillText('S', 64, 67);
    }
    const logoTexture = new THREE.CanvasTexture(logoCanvas);
    logoTexture.colorSpace = THREE.SRGBColorSpace;
    const systemLogo = new THREE.Mesh(
      new THREE.PlaneGeometry(1.15, 1.15),
      new THREE.MeshBasicMaterial({
        map: logoTexture,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
      }),
    );
    systemLogo.renderOrder = 4;
    scene.add(systemLogo);

    const avatarPlayerId = centralAvatar?.nodeId;
    const avatarNode = visibleNodes.find((node) => node.id === avatarPlayerId);
    const avatarNodePosition = avatarNode
      ? new THREE.Vector3(avatarNode.x, avatarNode.y, avatarNode.z)
      : null;
    let avatarMesh: THREE.Mesh | null = null;
    let avatarRing: THREE.Mesh | null = null;
    if (avatarNode && avatarNodePosition && centralAvatar) {
      const texture = new THREE.TextureLoader().load(
        avatarSvgDataUri(centralAvatar.seed, centralAvatar.version),
        undefined,
        undefined,
        (error) => console.error('Procedural avatar texture could not be loaded:', error),
      );
      texture.colorSpace = THREE.SRGBColorSpace;
      const avatarGeometry = new THREE.PlaneGeometry(1.16, 1.16);
      const avatarMaterial = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.DoubleSide,
        depthWrite: false,
        depthTest: false,
      });
      avatarMesh = new THREE.Mesh(avatarGeometry, avatarMaterial);
      avatarMesh.position.copy(avatarNodePosition);
      avatarMesh.renderOrder = 2;
      scene.add(avatarMesh);

      const ringGeometry = new THREE.TorusGeometry(0.62, 0.025, 8, 40);
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: NEURAL_RENDERING.playerGlow,
        transparent: true,
        opacity: 0.82,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
      });
      avatarRing = new THREE.Mesh(ringGeometry, ringMaterial);
      avatarRing.position.copy(avatarMesh.position);
      avatarRing.renderOrder = 3;
      scene.add(avatarRing);
    }

    const glowGeometry = new THREE.SphereGeometry(1, 16, 12);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const glowMesh = new THREE.InstancedMesh(
      glowGeometry,
      glowMaterial,
      Math.max(visibleNodes.length, 1),
    );
    glowMesh.count = visibleNodes.length;
    visibleNodes.forEach((node, index) => {
      nodeTransform.position.set(node.x, node.y, node.z);
      nodeTransform.scale.setScalar(0.61);
      nodeTransform.updateMatrix();
      glowMesh.setMatrixAt(index, nodeTransform.matrix);
      glowMesh.setColorAt(index, new THREE.Color(NEURAL_RENDERING.playerGlow));
    });
    glowMesh.instanceMatrix.needsUpdate = true;
    if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
    glowMesh.computeBoundingSphere();
    scene.add(glowMesh);

    const validConnections = connections.filter(
      (connection) =>
        nodeIndex.has(connection.playerA) &&
        nodeIndex.has(connection.playerB) &&
        connection.playerA !== connection.playerB,
    );
    const linkGeometry = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true);
    const linkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      vertexColors: true,
      transparent: true,
      opacity: 0.44,
      depthWrite: false,
    });
    const linkMesh = new THREE.InstancedMesh(
      linkGeometry,
      linkMaterial,
      Math.max(validConnections.length, 1),
    );
    linkMesh.count = validConnections.length;
    const linkTransform = new THREE.Object3D();
    const direction = new THREE.Vector3();
    const midpoint = new THREE.Vector3();
    const unitY = new THREE.Vector3(0, 1, 0);
    validConnections.forEach((connection, index) => {
      const from = visibleNodes[nodeIndex.get(connection.playerA)!];
      const to = visibleNodes[nodeIndex.get(connection.playerB)!];
      const fromPoint = new THREE.Vector3(from.x, from.y, from.z);
      const toPoint = new THREE.Vector3(to.x, to.y, to.z);
      direction.subVectors(toPoint, fromPoint);
      const length = direction.length();
      midpoint.addVectors(fromPoint, toPoint).multiplyScalar(0.5);
      linkTransform.position.copy(midpoint);
      linkTransform.quaternion.setFromUnitVectors(unitY, direction.normalize());
      const thickness = connectionRadius(connection.strength, maxStrength) * 1.18;
      linkTransform.scale.set(thickness, length, thickness);
      linkTransform.updateMatrix();
      linkMesh.setMatrixAt(index, linkTransform.matrix);
      linkMesh.setColorAt(index, new THREE.Color(0xffffff));
    });
    linkMesh.instanceMatrix.needsUpdate = true;
    if (linkMesh.instanceColor) linkMesh.instanceColor.needsUpdate = true;
    linkMesh.computeBoundingSphere();
    scene.add(linkMesh);

    const selectedConnectionIndices: number[] = [];
    const pulseGeometry = new THREE.SphereGeometry(0.085, 8, 6);
    const pulseMaterial = new THREE.MeshBasicMaterial({
      color: NEURAL_RENDERING.activeConnection,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    const pulseMesh = new THREE.InstancedMesh(
      pulseGeometry,
      pulseMaterial,
      Math.max(validConnections.length, 1),
    );
    pulseMesh.count = 0;
    pulseMesh.renderOrder = 5;
    scene.add(pulseMesh);
    const pulseTransform = new THREE.Object3D();
    const pulsePosition = new THREE.Vector3();
    const pulseDestination = new THREE.Vector3();

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const worldDirection = new THREE.Vector3();
    const cameraRight = new THREE.Vector3();
    const cameraUp = new THREE.Vector3();
    const viewTarget = new THREE.Vector3();
    const avatarTowardCamera = new THREE.Vector3();
    const systemProjection = new THREE.Vector3(SYSTEM_NODE.x, SYSTEM_NODE.y, SYSTEM_NODE.z);
    const mobileViewport = window.matchMedia('(max-width: 700px)');

    function updateCamera() {
      if (cameraMode === 'orbit') {
        camera.position.set(
          target.x + Math.sin(yaw) * Math.cos(pitch) * distance,
          target.y + Math.sin(pitch) * distance,
          target.z + Math.cos(yaw) * Math.cos(pitch) * distance,
        );
        camera.lookAt(target);
        if (
          focusId &&
          focusScreenX !== undefined &&
          focusScreenY !== undefined
        ) {
          camera.updateMatrixWorld();
          camera.getWorldDirection(worldDirection);
          cameraRight.crossVectors(worldDirection, camera.up).normalize();
          cameraUp.set(0, 1, 0).applyQuaternion(camera.quaternion).normalize();
          const offset = focusCameraOffset(
            distance,
            camera.aspect,
            camera.fov,
            mobileViewport.matches ? 0.5 : focusScreenX,
            mobileViewport.matches ? 0.74 : focusScreenY,
          );
          viewTarget
            .copy(target)
            .addScaledVector(cameraRight, -offset.x)
            .addScaledVector(cameraUp, -offset.y);
          camera.lookAt(viewTarget);
        }
      } else {
        worldDirection.set(
          Math.sin(yaw) * Math.cos(pitch),
          Math.sin(pitch),
          Math.cos(yaw) * Math.cos(pitch),
        );
        camera.lookAt(camera.position.clone().add(worldDirection));
      }
    }

    function updateSelection() {
      const linkedIds = new Set<string>();
      if (selectedId) {
        for (const connection of validConnections) {
          if (connection.playerA === selectedId) linkedIds.add(connection.playerB);
          if (connection.playerB === selectedId) linkedIds.add(connection.playerA);
        }
      }

      visibleNodes.forEach((node, index) => {
        const color =
          !selectedId || node.id === selectedId
            ? new THREE.Color(NEURAL_RENDERING.playerCore)
            : linkedIds.has(node.id)
              ? new THREE.Color(NEURAL_RENDERING.activeConnection)
              : new THREE.Color(0xc6dbe5);
        nodeMesh.setColorAt(index, color);
        glowMesh.setColorAt(
          index,
          node.id === selectedId
            ? new THREE.Color(NEURAL_RENDERING.selectedNeuron)
            : new THREE.Color(NEURAL_RENDERING.playerGlow),
        );
      });
      selectedConnectionIndices.length = 0;
      validConnections.forEach((connection, index) => {
        const connected =
          selectedId !== null &&
          (connection.playerA === selectedId || connection.playerB === selectedId);
        if (connected) selectedConnectionIndices.push(index);
        const tint = new THREE.Color(NEURAL_RENDERING.inactiveConnection).lerp(
          new THREE.Color(NEURAL_RENDERING.activeConnection),
          connectionIntensity(connection.strength, maxStrength),
        );
        if (connected) tint.lerp(new THREE.Color(0xdffaff), 0.18);
        linkMesh.setColorAt(index, tint);
      });
      if (nodeMesh.instanceColor) nodeMesh.instanceColor.needsUpdate = true;
      if (glowMesh.instanceColor) glowMesh.instanceColor.needsUpdate = true;
      if (linkMesh.instanceColor) linkMesh.instanceColor.needsUpdate = true;
      pulseMesh.count = selectedConnectionIndices.length;
      linkMaterial.opacity = selectedId ? 0.58 : 0.44;
      scene.updateMatrixWorld();
      requestRender();
    }
    function resize() {
      const width = canvasElement.clientWidth;
      const height = canvasElement.clientHeight;
      if (width === 0 || height === 0) return;
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      updateCamera();
      requestRender();
    }
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const frameScene = (time: number) => {
      const elapsed = Math.min((time - previousFrame) / 1000, 0.05);
      previousFrame = time;
      const shouldRotate =
        autoRotate &&
        !reducedMotion.matches &&
        !pointerMoved &&
        pointers.size === 0 &&
        cameraMode === 'orbit';
      if (shouldRotate) {
        yaw += elapsed * 0.045;
        needsRender = true;
      }
      let movingInFlight = false;
      if (cameraMode === 'flight' && document.activeElement === canvasElement) {
        camera.getWorldDirection(worldDirection);
        const right = new THREE.Vector3().crossVectors(worldDirection, camera.up).normalize();
        const speed = Math.max(2, distance * 0.16) * elapsed;
        if (pressedKeys.has('w')) camera.position.addScaledVector(worldDirection, speed);
        if (pressedKeys.has('s')) camera.position.addScaledVector(worldDirection, -speed);
        if (pressedKeys.has('a')) camera.position.addScaledVector(right, -speed);
        if (pressedKeys.has('d')) camera.position.addScaledVector(right, speed);
        if (pressedKeys.has(' ')) camera.position.y += speed;
        if (pressedKeys.has('shift')) camera.position.y -= speed;
        movingInFlight = pressedKeys.size > 0;
        if (movingInFlight) needsRender = true;
      }
      updateCamera();
      camera.updateMatrixWorld();
      systemProjection.set(SYSTEM_NODE.x, SYSTEM_NODE.y, SYSTEM_NODE.z);
      systemProjection.project(camera);
      const systemVisible =
        systemProjection.z >= -1 &&
        systemProjection.z <= 1 &&
        Math.abs(systemProjection.x) <= 1.2 &&
        Math.abs(systemProjection.y) <= 1.2;
      if (avatarMesh && avatarNodePosition) {
        avatarTowardCamera.subVectors(camera.position, avatarNodePosition).normalize();
        avatarMesh.position
          .copy(avatarNodePosition)
          .addScaledVector(avatarTowardCamera, 0.54);
        avatarRing?.position
          .copy(avatarNodePosition)
          .addScaledVector(avatarTowardCamera, 0.56);
        avatarMesh.quaternion.copy(camera.quaternion);
        avatarRing?.quaternion.copy(camera.quaternion);
      }
      systemLogo.quaternion.copy(camera.quaternion);
      systemLogo.position.copy(camera.position).normalize().multiplyScalar(2.02);
      const animateSystem =
        systemVisible &&
        !reducedMotion.matches &&
        document.visibilityState === 'visible';
      if (animateSystem) {
        const pulse = 1 + Math.sin(time * 0.0015) * 0.025;
        systemGlow.scale.setScalar(NEURAL_RENDERING.systemGlowSize * pulse);
      }
      const animatePulses =
        selectedConnectionIndices.length > 0 &&
        !reducedMotion.matches &&
        document.visibilityState === 'visible';
      pulseMesh.visible = animatePulses;
      if (animatePulses) {
        selectedConnectionIndices.forEach((connectionIndex, pulseIndex) => {
          const connection = validConnections[connectionIndex];
          const from = visibleNodes[nodeIndex.get(connection.playerA)!];
          const to = visibleNodes[nodeIndex.get(connection.playerB)!];
          const phase = (time * 0.00022 + pulseIndex * 0.37) % 1;
          pulsePosition.set(from.x, from.y, from.z);
          pulseDestination.set(to.x, to.y, to.z);
          pulsePosition.lerp(pulseDestination, phase);
          pulseTransform.position.copy(pulsePosition);
          pulseTransform.scale.setScalar(1);
          pulseTransform.updateMatrix();
          pulseMesh.setMatrixAt(pulseIndex, pulseTransform.matrix);
        });
        pulseMesh.instanceMatrix.needsUpdate = true;
        needsRender = true;
      }
      if (needsRender) {
        renderer.render(scene, camera);
        needsRender = false;
      }
      return shouldRotate || movingInFlight || animateSystem || animatePulses;
    };
    frameLoop = createFrameLoop(
      frameScene,
      (callback) => requestAnimationFrame(callback),
      (frame) => cancelAnimationFrame(frame),
    );

    updateCamera();
    updateSelection();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(canvasElement);
    resize();

    function pointerPosition(event: PointerEvent) {
      const rect = canvasElement.getBoundingClientRect();
      pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    }
    function pointerDown(event: PointerEvent) {
      canvasElement.focus();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1) {
        canvasElement.setPointerCapture(event.pointerId);
        pointerMoved = false;
      } else if (pointers.size === 2) {
        const pair = [...pointers.values()];
        previousPinchDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        previousCenter = {
          x: (pair[0].x + pair[1].x) / 2,
          y: (pair[0].y + pair[1].y) / 2,
        };
      }
    }
    function pointerMove(event: PointerEvent) {
      const previous = pointers.get(event.pointerId);
      if (!previous) return;
      const dx = event.clientX - previous.x;
      const dy = event.clientY - previous.y;
      requestRender();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (Math.abs(dx) + Math.abs(dy) > 2) pointerMoved = true;

      if (pointers.size >= 2) {
        const pair = [...pointers.values()];
        const nextDistance = Math.hypot(pair[0].x - pair[1].x, pair[0].y - pair[1].y);
        const nextCenter = {
          x: (pair[0].x + pair[1].x) / 2,
          y: (pair[0].y + pair[1].y) / 2,
        };
        if (cameraMode === 'orbit') {
          distance = THREE.MathUtils.clamp(
            distance * (previousPinchDistance / Math.max(nextDistance, 1)),
            4,
            3000,
          );
          camera.updateMatrixWorld();
          camera.getWorldDirection(worldDirection);
          const right = new THREE.Vector3().crossVectors(worldDirection, camera.up).normalize();
          const panScale = distance * 0.0015;
          target.addScaledVector(right, -(nextCenter.x - previousCenter.x) * panScale);
          target.y += (nextCenter.y - previousCenter.y) * panScale;
        }
        previousPinchDistance = nextDistance;
        previousCenter = nextCenter;
      } else if (cameraMode === 'flight') {
        yaw -= dx * 0.004;
        pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -1.48, 1.48);
      } else if (event.buttons & 2) {
        camera.updateMatrixWorld();
        camera.getWorldDirection(worldDirection);
        const right = new THREE.Vector3().crossVectors(worldDirection, camera.up).normalize();
        const panScale = distance * 0.0015;
        target.addScaledVector(right, -dx * panScale);
        target.y += dy * panScale;
      } else {
        yaw -= dx * 0.004;
        pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, -1.48, 1.48);
      }
    }
    function pointerUp(event: PointerEvent) {
      pointers.delete(event.pointerId);
      if (!pointerMoved && event.button !== 2 && pointers.size === 0) {
        pointerPosition(event);
        raycaster.setFromCamera(pointer, camera);
        const hit = raycaster
          .intersectObjects(
            avatarMesh
              ? [systemCore, nodeMesh, avatarMesh]
              : [systemCore, nodeMesh],
            false,
          )
          .find(
            (intersection) =>
              intersection.object === avatarMesh ||
              intersection.object === systemCore ||
              (intersection.object === nodeMesh && intersection.instanceId !== undefined),
          );
        if (hit?.object === systemCore) {
          systemSelectRef.current?.();
          requestRender();
          return;
        }
        const nodeIndexHit =
          hit?.object === avatarMesh
            ? visibleNodes.findIndex((node) => node.id === avatarPlayerId)
            : hit?.instanceId;
        if (nodeIndexHit !== undefined && nodeIndexHit >= 0) {
          const node = visibleNodes[nodeIndexHit];
          selectRef.current?.(node);
          const now = performance.now();
          if (lastSelectedId === node.id && now - lastPointerUp < 350) {
            target.set(node.x, node.y, node.z);
            distance = Math.min(distance, 12);
          }
          lastSelectedId = node.id;
          lastPointerUp = now;
        }
      }
      if (pointers.size === 0) {
        previousPinchDistance = 0;
        pointerMoved = false;
      }
      requestRender();
    }
    function pointerCancel(event: PointerEvent) {
      pointers.delete(event.pointerId);
      pointerMoved = false;
      requestRender();
    }
    function wheel(event: WheelEvent) {
      event.preventDefault();
      const zoom = Math.exp(event.deltaY * 0.001);
      if (cameraMode === 'orbit') {
        distance = THREE.MathUtils.clamp(distance * zoom, 4, 3000);
      } else {
        camera.getWorldDirection(worldDirection);
        camera.position.addScaledVector(worldDirection, -event.deltaY * 0.018);
      }
      requestRender();
    }
    function keyDown(event: KeyboardEvent) {
      const key = event.key.toLowerCase();
      if (['w', 'a', 's', 'd', ' ', 'shift'].includes(key)) {
        event.preventDefault();
        pressedKeys.add(key);
        requestRender();
      }
    }
    function keyUp(event: KeyboardEvent) {
      pressedKeys.delete(event.key.toLowerCase());
    }
    function contextMenu(event: MouseEvent) {
      event.preventDefault();
    }

    canvasElement.addEventListener('pointerdown', pointerDown);
    canvasElement.addEventListener('pointermove', pointerMove);
    canvasElement.addEventListener('pointerup', pointerUp);
    canvasElement.addEventListener('pointercancel', pointerCancel);
    canvasElement.addEventListener('wheel', wheel, { passive: false });
    canvasElement.addEventListener('contextmenu', contextMenu);
    canvasElement.addEventListener('keydown', keyDown);
    window.addEventListener('keyup', keyUp);

    const contextLost = (event: Event) => {
      event.preventDefault();
      setRendererError(true);
    };
    canvasElement.addEventListener('webglcontextlost', contextLost);

    return () => {
      frameLoop?.dispose();
      resizeObserver.disconnect();
      canvasElement.removeEventListener('pointerdown', pointerDown);
      canvasElement.removeEventListener('pointermove', pointerMove);
      canvasElement.removeEventListener('pointerup', pointerUp);
      canvasElement.removeEventListener('pointercancel', pointerCancel);
      canvasElement.removeEventListener('wheel', wheel);
      canvasElement.removeEventListener('contextmenu', contextMenu);
      canvasElement.removeEventListener('keydown', keyDown);
      canvasElement.removeEventListener('webglcontextlost', contextLost);
      window.removeEventListener('keyup', keyUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) {
          object.geometry.dispose();
          if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose());
          else {
            object.material.map?.dispose();
            object.material.dispose();
          }
        } else if (object instanceof THREE.Sprite) {
          object.material.map?.dispose();
          object.material.dispose();
        }
      });
      renderer.dispose();
    };
  }, [
    nodes,
    connections,
    selectedId,
    focusId,
    focusScreenX,
    focusScreenY,
    maxStrength,
    cameraMode,
    autoRotate,
  ]);

  return (
    <div className={`neuralCanvasShell ${className ?? ''}`}>
      <canvas
        ref={canvasRef}
        className="neuralCanvas"
        tabIndex={0}
        aria-label={label}
      />
      {(rendererError || nodes.length === 0) && (
        <div className="neuralCanvasMessage" role="status">
          {rendererError
            ? 'Interactive rendering is unavailable in this browser.'
            : 'No active player neurons are available yet.'}
        </div>
      )}
    </div>
  );
}
