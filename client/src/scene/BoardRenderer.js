import * as THREE from 'three';
import { BOARD_WIDTH, BOARD_HEIGHT, PIECE_TYPES } from '@shared/constants.js';
import { PIECE_COLORS, PIECE_SHAPES } from '@shared/pieceData.js';

const MAX_BOARD_BLOCKS = BOARD_WIDTH * BOARD_HEIGHT + 8;
const PREVIEW_BLOCKS = 4;
const BLOCK_SIZE = 0.95;
const PREVIEW_SCALE = 0.7;
const PREVIEW_SPACING = 0.72;
const SOLO_HOLD_X = -3;
const SOLO_NEXT_X = BOARD_WIDTH + 1.5;
// Versus: same layout as solo for both boards
const VERSUS_LEFT_HOLD_X = SOLO_HOLD_X;
const VERSUS_LEFT_NEXT_X = SOLO_NEXT_X;
const VERSUS_RIGHT_HOLD_X = SOLO_HOLD_X;
const VERSUS_RIGHT_NEXT_X = SOLO_NEXT_X;

const PLAYER_COLOR = 0x00f0f0;
const OPPONENT_COLOR = 0xf040a0;

export class BoardRenderer {
  constructor(scene, offsetX, isOpponent = false, isVersus = false) {
    this.scene = scene;
    this.offsetX = offsetX;
    this.isOpponent = isOpponent;
    this.isVersus = isVersus;
    this.sideColor = isOpponent ? OPPONENT_COLOR : PLAYER_COLOR;
    this.group = new THREE.Group();
    this.group.position.x = offsetX;
    scene.add(this.group);

    this.blockGeometry = new THREE.BoxGeometry(BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
    this.blockGeometry.translate(0.5, 0.5, 0);

    this.materials = {};
    this.ghostMaterial = null;
    this.jammedMaterial = null;
    this._createMaterials();

    this.boardBlocks = this._createBlockPool(this.group, MAX_BOARD_BLOCKS);
    this.ghostBlocks = this._createBlockPool(this.group, PREVIEW_BLOCKS, this.ghostMaterial);

    this._frameGeometries = [];
    this._frameMaterials = [];
    this._createFrame();

    const holdX = this._getHoldOffsetX();
    const nextX = this._getNextOffsetX();

    this.holdGroup = new THREE.Group();
    this.holdGroup.position.set(holdX, BOARD_HEIGHT - 1, 0);
    this.group.add(this.holdGroup);
    this.holdBlocks = this._createBlockPool(this.holdGroup, PREVIEW_BLOCKS, null, PREVIEW_SCALE);

    this.nextGroups = [];
    this.nextBlocks = [];
    for (let i = 0; i < 5; i++) {
      const g = new THREE.Group();
      g.position.set(nextX, BOARD_HEIGHT - 1 - i * 3.5, 0);
      this.group.add(g);
      this.nextGroups.push(g);
      this.nextBlocks.push(this._createBlockPool(g, PREVIEW_BLOCKS, null, PREVIEW_SCALE));
    }

    this.garbageMeterGroup = new THREE.Group();
    this.garbageMeterGroup.position.set(this._getGarbageMeterOffsetX(), 0, 0);
    this.group.add(this.garbageMeterGroup);
    this.garbageMeterMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3300,
      emissive: 0xff2200,
      emissiveIntensity: 0.35,
      transparent: true,
      opacity: 0.7
    });
    this._garbageMeterGeo = new THREE.BoxGeometry(0.3, 1, 0.3);
    this.garbageMeterMesh = new THREE.Mesh(this._garbageMeterGeo, this.garbageMeterMaterial);
    this.garbageMeterMesh.visible = false;
    this.garbageMeterGroup.add(this.garbageMeterMesh);
    this._lastGarbageLines = -1;
  }

  _getHoldOffsetX() {
    if (!this.isVersus) return SOLO_HOLD_X;
    return this.isOpponent ? VERSUS_RIGHT_HOLD_X : VERSUS_LEFT_HOLD_X;
  }

  _getNextOffsetX() {
    if (!this.isVersus) return SOLO_NEXT_X;
    return this.isOpponent ? VERSUS_RIGHT_NEXT_X : VERSUS_LEFT_NEXT_X;
  }

  _getGarbageMeterOffsetX() {
    if (!this.isVersus || !this.isOpponent) return -0.7;
    return BOARD_WIDTH + 0.45;
  }

  _createMaterials() {
    const allTypes = [...PIECE_TYPES, 'garbage'];
    for (const type of allTypes) {
      const color = PIECE_COLORS[type];
      this.materials[type] = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.25,
        metalness: 0.2,
        emissive: color,
        emissiveIntensity: 0.18
      });
    }

    this.ghostMaterial = new THREE.MeshStandardMaterial({
      color: 0x00f0f0,
      emissive: 0x00f0f0,
      emissiveIntensity: 0.08,
      transparent: true,
      opacity: 0.22,
      roughness: 0.5,
      metalness: 0.0
    });

    this.jammedMaterial = new THREE.MeshStandardMaterial({
      color: 0xff3366,
      emissive: 0xa000f0,
      emissiveIntensity: 0.5,
      roughness: 0.35,
      metalness: 0.15
    });
  }

  _createBlockPool(parent, count, initialMaterial = null, scale = 1) {
    const blocks = [];
    const material = initialMaterial || this.materials.I;
    for (let i = 0; i < count; i++) {
      const mesh = new THREE.Mesh(this.blockGeometry, material);
      mesh.visible = false;
      mesh.scale.setScalar(scale);
      parent.add(mesh);
      blocks.push(mesh);
    }
    return blocks;
  }

  _createFrame() {
    const sc = new THREE.Color(this.sideColor);

    // Neon glowing frame
    const frameMaterial = new THREE.MeshStandardMaterial({
      color: sc,
      emissive: sc,
      emissiveIntensity: 0.3,
      roughness: 0.3,
      metalness: 0.4,
      transparent: true,
      opacity: 0.85
    });
    this._frameMaterials.push(frameMaterial);

    const thickness = 0.2;

    const leftGeo = new THREE.BoxGeometry(thickness, BOARD_HEIGHT + thickness, 0.6);
    this._frameGeometries.push(leftGeo);
    const leftWall = new THREE.Mesh(leftGeo, frameMaterial);
    leftWall.position.set(-thickness / 2, BOARD_HEIGHT / 2, 0);
    this.group.add(leftWall);

    const rightGeo = new THREE.BoxGeometry(thickness, BOARD_HEIGHT + thickness, 0.6);
    this._frameGeometries.push(rightGeo);
    const rightWall = new THREE.Mesh(rightGeo, frameMaterial);
    rightWall.position.set(BOARD_WIDTH + thickness / 2, BOARD_HEIGHT / 2, 0);
    this.group.add(rightWall);

    const bottomGeo = new THREE.BoxGeometry(BOARD_WIDTH + thickness * 2, thickness, 0.6);
    this._frameGeometries.push(bottomGeo);
    const bottom = new THREE.Mesh(bottomGeo, frameMaterial);
    bottom.position.set(BOARD_WIDTH / 2, -thickness / 2, 0);
    this.group.add(bottom);

    const topGeo = new THREE.BoxGeometry(BOARD_WIDTH + thickness * 2, thickness, 0.6);
    this._frameGeometries.push(topGeo);
    const topWall = new THREE.Mesh(topGeo, frameMaterial);
    topWall.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT + thickness / 2, 0);
    this.group.add(topWall);

    // Semi-transparent back panel with side color tint
    const backGeo = new THREE.PlaneGeometry(BOARD_WIDTH, BOARD_HEIGHT);
    const backColor = sc.clone().multiplyScalar(0.08);
    const backMat = new THREE.MeshStandardMaterial({
      color: backColor,
      roughness: 1.0,
      metalness: 0.0,
      transparent: true,
      opacity: 0.92,
      side: THREE.FrontSide
    });
    this._frameGeometries.push(backGeo);
    this._frameMaterials.push(backMat);
    const backPanel = new THREE.Mesh(backGeo, backMat);
    backPanel.position.set(BOARD_WIDTH / 2, BOARD_HEIGHT / 2, -0.5);
    this.group.add(backPanel);

    // Grid lines with side color
    const gridMaterial = new THREE.LineBasicMaterial({
      color: this.sideColor,
      transparent: true,
      opacity: 0.12
    });
    this._frameMaterials.push(gridMaterial);
    const gridLines = new THREE.Group();

    for (let x = 0; x <= BOARD_WIDTH; x++) {
      const points = [new THREE.Vector3(x, 0, -0.49), new THREE.Vector3(x, BOARD_HEIGHT, -0.49)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this._frameGeometries.push(geo);
      gridLines.add(new THREE.Line(geo, gridMaterial));
    }
    for (let y = 0; y <= BOARD_HEIGHT; y++) {
      const points = [new THREE.Vector3(0, y, -0.49), new THREE.Vector3(BOARD_WIDTH, y, -0.49)];
      const geo = new THREE.BufferGeometry().setFromPoints(points);
      this._frameGeometries.push(geo);
      gridLines.add(new THREE.Line(geo, gridMaterial));
    }

    this.group.add(gridLines);
  }

  update(boardState, currentPiece, ghostY, holdPiece, nextQueue, pendingGarbage, previewHidden = false) {
    let boardBlockIndex = 0;

    if (boardState) {
      for (let r = 0; r < boardState.length; r++) {
        for (let c = 0; c < BOARD_WIDTH; c++) {
          const cell = boardState[r][c];
          if (!cell) continue;
          boardBlockIndex = this._placeBlock(
            this.boardBlocks,
            boardBlockIndex,
            this.materials[cell],
            c,
            boardState.length - 1 - r,
            0
          );
        }
      }
    }

    if (currentPiece) {
      const shape = PIECE_SHAPES[currentPiece.type][currentPiece.rotation];
      const boardRows = boardState ? boardState.length : BOARD_HEIGHT;

      for (const [dc, dr] of shape) {
        const col = dc + currentPiece.col;
        const row = dr + currentPiece.row;
        if (row < 0 || row >= boardRows) continue;
        boardBlockIndex = this._placeBlock(
          this.boardBlocks,
          boardBlockIndex,
          this.materials[currentPiece.type],
          col,
          boardRows - 1 - row,
          0
        );
      }

      // Ghost piece — match active piece color
      const pieceColor = PIECE_COLORS[currentPiece.type];
      this.ghostMaterial.color.setHex(pieceColor);
      this.ghostMaterial.emissive.setHex(pieceColor);

      let ghostBlockIndex = 0;
      if (ghostY !== undefined && ghostY !== currentPiece.row) {
        for (const [dc, dr] of shape) {
          const col = dc + currentPiece.col;
          const row = dr + ghostY;
          if (row < 0 || row >= boardRows) continue;
          ghostBlockIndex = this._placeBlock(
            this.ghostBlocks,
            ghostBlockIndex,
            this.ghostMaterial,
            col,
            boardRows - 1 - row,
            0
          );
        }
      }
      this._hideUnused(this.ghostBlocks, ghostBlockIndex);
    } else {
      this._hideUnused(this.ghostBlocks, 0);
    }

    this._hideUnused(this.boardBlocks, boardBlockIndex);
    this._updatePreviewDisplay(this.holdBlocks, holdPiece);

    if (nextQueue) {
      for (let i = 0; i < 5; i++) {
        if (previewHidden) {
          this._updateMaskedPreviewDisplay(this.nextBlocks[i], i);
        } else {
          this._updatePreviewDisplay(this.nextBlocks[i], nextQueue[i] || null);
        }
      }
    }

    const lines = pendingGarbage || 0;
    if (lines !== this._lastGarbageLines) {
      this._updateGarbageMeter(lines);
      this._lastGarbageLines = lines;
    }
  }

  _placeBlock(pool, index, material, x, y, z) {
    if (index >= pool.length) return index;
    const mesh = pool[index];
    mesh.material = material;
    mesh.position.set(x, y, z);
    mesh.visible = true;
    return index + 1;
  }

  _hideUnused(pool, fromIndex) {
    for (let i = fromIndex; i < pool.length; i++) {
      pool[i].visible = false;
    }
  }

  _updatePreviewDisplay(pool, pieceType) {
    if (!pieceType) {
      this._hideUnused(pool, 0);
      return;
    }

    const shape = PIECE_SHAPES[pieceType][0];
    let minC = 4;
    let maxC = 0;
    let minR = 4;
    let maxR = 0;

    for (const [c, r] of shape) {
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
    }

    const cx = (minC + maxC) / 2;
    const cy = (minR + maxR) / 2;

    let index = 0;
    for (const [c, r] of shape) {
      index = this._placeBlock(
        pool,
        index,
        this.materials[pieceType],
        (c - cx) * PREVIEW_SPACING,
        -(r - cy) * PREVIEW_SPACING,
        0
      );
    }
    this._hideUnused(pool, index);
  }

  _updateMaskedPreviewDisplay(pool, variant = 0) {
    const patterns = [
      [[-0.9, 0.15], [-0.2, 0.35], [0.35, -0.15], [0.95, 0.05]],
      [[-0.8, 0.5], [-0.15, -0.1], [0.45, 0.25], [0.9, -0.35]],
      [[-0.9, -0.2], [-0.25, 0.25], [0.35, -0.4], [0.95, 0.2]]
    ];
    const pattern = patterns[variant % patterns.length];

    let index = 0;
    for (const [x, y] of pattern) {
      index = this._placeBlock(pool, index, this.jammedMaterial, x, y, 0);
    }
    this._hideUnused(pool, index);
  }

  _updateGarbageMeter(lines) {
    if (lines <= 0) {
      this.garbageMeterMesh.visible = false;
      return;
    }

    const height = Math.min(lines, BOARD_HEIGHT);
    this.garbageMeterMesh.visible = true;
    this.garbageMeterMesh.scale.set(1, height, 1);
    this.garbageMeterMesh.position.set(0, height / 2, 0);
  }

  dispose() {
    this.scene.remove(this.group);
    this.blockGeometry.dispose();
    for (const mat of Object.values(this.materials)) mat.dispose();
    this.ghostMaterial.dispose();
    this.jammedMaterial.dispose();
    for (const geo of this._frameGeometries) geo.dispose();
    for (const mat of this._frameMaterials) mat.dispose();
    this.garbageMeterMaterial.dispose();
    this._garbageMeterGeo.dispose();
  }
}
