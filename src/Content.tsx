import React, { useEffect, useRef } from 'react';
import {
  Vector3,
  Color3,
  PostProcess,
  Effect,
  Texture,
  Mesh,
  InstancedMesh,
  StandardMaterial,
  CubeTexture,
  MeshBuilder,
  ArcRotateCamera,
  PBRMaterial,
  Tools
} from '@babylonjs/core';
import { CustomMaterial, CellMaterial } from '@babylonjs/materials';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { useScene, useModel } from 'reactylon';
import { SSAO2RenderingPipeline } from '@babylonjs/core/PostProcesses/RenderPipeline/Pipelines/ssao2RenderingPipeline';
import '@babylonjs/loaders';

// strip any trailing slash from PUBLIC_URL
const PUBLIC_URL = (process.env.PUBLIC_URL ?? "").replace(/\/$/, "");

// in prod we serve from /anime-foliage/, in dev from /
const baseUrl = process.env.NODE_ENV === "production"
  ? `${PUBLIC_URL}/`
  : "";

// tell Babylon to prefix _all_ asset requests with that
Tools.BaseUrl = baseUrl;
(window as any).__reactylon_base_url__ = baseUrl;
//(window as any).BABYLON_BASE_ASSETS_URL = baseUrl;

const BUSH_POSITIONS: Vector3[] = [
  new Vector3(0.065, 0.85, -0.78),
  new Vector3(0.58, 1.11, -0.92),
  new Vector3(0.40, 1.39, -0.80),
  new Vector3(0.33, 1.69, -0.70),
  new Vector3(0.60, 1.28, -0.61),
  new Vector3(-0.00, 1.93, -0.62),
  new Vector3(-0.05, 1.88, -0.32),
  new Vector3(-0.18, 1.91, -0.02),
  new Vector3(0.09, 1.84, 0.23),
  new Vector3(0.33, 1.89, 0.29),
  new Vector3(0.01, 1.63, 0.48),
  new Vector3(-0.02, 1.54, 0.78),
  new Vector3(-0.45, 1.48, 0.73),
  new Vector3(-0.43, 1.25, 0.69),
  new Vector3(-0.56, 1.15, 0.41),
  new Vector3(-0.23, 1.29, 0.25),
];

export const Content: React.FC = () => {
  const scene = useScene();

  const { meshes: leafMeshes } = useModel(`${baseUrl}/meshes/leaf_emitter.glb`);
  const { meshes: treeMeshes } = useModel(`${baseUrl}/meshes/SakuraTree.glb`);
  const { meshes: hillMeshes } = useModel(`${baseUrl}/meshes/Hill.glb`);
  const { meshes: grassEmitter } = useModel(`${baseUrl}/meshes/GrassEmitter.glb`);
  const { meshes: smallWallMeshes } = useModel(`${baseUrl}/meshes/SmallerWalls.glb`);

  const leafPlaneRef = useRef<Mesh>(null!);
  const grassPlaneRef = useRef<Mesh>(null!);

  useEffect(() => {
    if (!scene || !leafPlaneRef.current || !grassPlaneRef.current || leafMeshes.length === 0) return;

    const GLOBAL_SCALE = 0.3;
    const root = new TransformNode('SceneRoot', scene);
    root.position.set(0, -1, 0);
    root.scaling.set(1.8, 1.8, 1.8);

    const target = scene.getMeshByName('tree')?.position ?? Vector3.Zero();

    const camera = new ArcRotateCamera(
      'mainCamera',
      Tools.ToRadians(135), // alpha (horizontal angle)
      Tools.ToRadians(65),  // beta (vertical angle)
      10,                   // radius (distance from target)
      target,
      scene
    );

    // Orbit constraints
    camera.lowerBetaLimit = Tools.ToRadians(45);   // Prevent going too low
    camera.upperBetaLimit = Tools.ToRadians(98);   // Prevent flipping over
    camera.lowerRadiusLimit = 3;                  // Zoom-in limit
    camera.upperRadiusLimit = 7.2;                  // Zoom-out limit
    camera.allowUpsideDown = false;

    camera.attachControl(undefined, true);
    scene.activeCamera = camera;

    // Skybox
    const skybox = MeshBuilder.CreateBox("skyBox", {size:500.0}, scene);
    const skyboxMaterial = new StandardMaterial("skyBox", scene);
    skyboxMaterial.backFaceCulling = false;
    skyboxMaterial.reflectionTexture = new CubeTexture(`${baseUrl}/textures/skybox/skybox`, scene, ["_px.png", "_py.png", "_pz.png", "_nx.png", "_ny.png", "_nz.png"]);
    skyboxMaterial.reflectionTexture.coordinatesMode = Texture.SKYBOX_MODE;
    skyboxMaterial.diffuseColor = new Color3(0, 0, 0);
    skyboxMaterial.specularColor = new Color3(0, 0, 0);
    skybox.material = skyboxMaterial;

    // ─── Wall setup ─────────────────────────
    const walls = smallWallMeshes.find(m => m.name === 'LargeWalls') ?? smallWallMeshes[0];
    walls.position.set(0, -1.4, 0);
    walls.isVisible = true;

    // Load ground from height map
    const ground = MeshBuilder.CreateGroundFromHeightMap(
      "sandGround",
      `${baseUrl}/textures/sand_height_waves.png`, // ✅ your heightmap image
      {
        width: 15,             // Width of ground
        height: 15,            // Height of ground
        subdivisions: 1000,     // More subdivisions = smoother
        minHeight: 0,          // Lowest height
        maxHeight: 0.15          // Highest height
      },
      scene
    );

    // Adjust position if needed
    ground.position.y = -1.5;

    // Create PBR Material for sand
    const sandPBRMat = new PBRMaterial("sandPBRMat", scene);

    // Albedo (diffuse) texture for sand color
    const albedoTex = new Texture(`${baseUrl}/textures/sand_diffuse.png`, scene);
    albedoTex.uScale = 10; // Tile
    albedoTex.vScale = 10;
    sandPBRMat.albedoTexture = albedoTex;

    // Macro height details
    const normalTex = new Texture(`${baseUrl}/textures/sand_normal.png`, scene);
    normalTex.uScale = 10;
    normalTex.vScale = 10;
    sandPBRMat.bumpTexture = normalTex;

    // PBR settings
    sandPBRMat.metallic = 0;
    sandPBRMat.roughness = 0.8;

    // Apply material
    ground.material = sandPBRMat;

    // ─── Tree setup ─────────────────────────
    const treeRoot = treeMeshes[0];
    treeRoot.parent = root;
    const cellMat = new CellMaterial('treeCell', scene);
    const origMat = treeRoot.material!;
    if (origMat instanceof PBRMaterial) {
      cellMat.diffuseTexture = origMat.albedoTexture as Texture;
      cellMat.diffuseColor = origMat.albedoColor.clone();
    } else if (origMat instanceof StandardMaterial) {
      cellMat.diffuseTexture = origMat.diffuseTexture as Texture;
      cellMat.diffuseColor = origMat.diffuseColor.clone();
    } else {
      cellMat.diffuseColor = new Color3(0.8, 0.8, 0.8);
    }
    cellMat.computeHighLevel = true;
    treeRoot.material = cellMat;

    // ─── Leaf instancing ───────────────────────
    const leafPlane = leafPlaneRef.current;
    leafPlane.scaling.scaleInPlace(GLOBAL_SCALE);
    leafPlane.isVisible = false;
    leafPlane.registerInstancedBuffer('faceNormal', 3);
    leafPlane.registerInstancedBuffer('shadeOffset', 1);

    const leafMat = new CustomMaterial('leafMat', scene);
    leafMat.diffuseTexture = new Texture(`${baseUrl}/textures/alphaleaf.png`, scene);
    leafMat.diffuseTexture.hasAlpha = true;
    leafMat.alphaCutOff = 0.7;
    leafMat.emissiveTexture = new Texture(`${baseUrl}/textures/grass_ramp.png`, scene);
    leafMat.specularColor = new Color3(0.1, 0.3, 0.1);
    leafMat.specularPower = 128;

    leafMat.Vertex_Definitions(`
      #ifdef INSTANCES
        attribute vec3 faceNormal;
        attribute float shadeOffset;
        varying vec3 vFaceNormal;
        varying float vShadeOffset;
      #endif
      varying vec2 vUV;
    `);
    leafMat.Vertex_MainBegin(`vUV = uv;`);
    leafMat.Vertex_Before_PositionUpdated(`
      #ifdef INSTANCES
        vFaceNormal = normalize((world * vec4(faceNormal, 0.0)).xyz);
        vShadeOffset = shadeOffset;
      #endif
    `);
    leafMat.Fragment_Definitions(`
      varying vec3 vFaceNormal;
      varying vec2 vUV;
      varying float vShadeOffset;
      uniform sampler2D ambientSampler;
    `);
    leafMat.Fragment_Custom_Diffuse(`
      float a = texture2D(diffuseSampler, vUV).a;
      if (a < 0.5) discard;

      float ndl = max(dot(normalize(vFaceNormal), normalize(vec3(1.0,1.0,0.5))), 0.0);
      float u = clamp(ndl + vShadeOffset, 0.0, 1.0);
      vec3 rampCol = texture2D(emissiveSampler, vec2(u, 0.5)).rgb;
      float ao = texture2D(ambientSampler, vUV).r;
      rampCol *= ao;
      diffuseColor = rampCol;
    `);
    leafMat.Fragment_Custom_Alpha(`alpha = texture2D(diffuseSampler, vUV).a;`);
    leafPlane.material = leafMat;

    const emitter = leafMeshes.find(m => m.name === 'LeafEmitter') ?? leafMeshes[0];
    emitter.scaling.scaleInPlace(GLOBAL_SCALE);
    emitter.isVisible = false;
    const positions = emitter.getVerticesData('position')!;
    const indices = emitter.getIndices()!;
    const faceCenters: Vector3[] = [];
    const faceNormals: Vector3[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const [i0, i1, i2] = [indices[i], indices[i + 1], indices[i + 2]];
      const v0 = new Vector3(...positions.slice(i0 * 3, i0 * 3 + 3));
      const v1 = new Vector3(...positions.slice(i1 * 3, i1 * 3 + 3));
      const v2 = new Vector3(...positions.slice(i2 * 3, i2 * 3 + 3));
      faceCenters.push(v0.add(v1).add(v2).scale(1 / 3));
      faceNormals.push(Vector3.Cross(v1.subtract(v0), v2.subtract(v0)).normalize());
    }

    const allInstances: InstancedMesh[] = [];
    const allBushes = BUSH_POSITIONS.map((pos, bi) => {
      const bush = new TransformNode(`bush${bi}`, scene);
      bush.parent = root;
      bush.position.copyFrom(pos);
      bush.scaling.scaleInPlace(GLOBAL_SCALE);

      faceCenters.forEach((ctr, idx) => {
        if (Math.random() > 0.2) return;
        const n = faceNormals[idx];
        const inst = leafPlane.createInstance(`b${bi}_l${idx}`);
        inst.parent = bush;
        inst.position = ctr.add(n.scale(0.01));
        inst.billboardMode = Mesh.BILLBOARDMODE_ALL;
        const s = 0.5 + Math.random() * 0.7;
        inst.scaling = new Vector3(s, s, s);
        inst.rotation.z = Math.random() * Math.PI * 2;
        inst.instancedBuffers.faceNormal = [n.x, n.y, n.z];
        inst.instancedBuffers.shadeOffset = [Math.random() * 0.2 - 0.1];
        allInstances.push(inst);
      });

      return bush;
    });

    // ─── Grass instancing ─────────────────────────────
    const grassPlane = grassPlaneRef.current;
    const grassRoot = new TransformNode('GrassRoot', scene);
    grassRoot.position = new Vector3(0, -0.95, 0);
    grassRoot.parent = root;
    grassPlane.scaling.scaleInPlace(0.1);
    grassPlane.isVisible = false;
    grassPlane.registerInstancedBuffer('faceNormal', 3);
    grassPlane.registerInstancedBuffer('shadeOffset', 1);

    const grassMat = new CustomMaterial('grassMat', scene);
    grassMat.diffuseTexture = new Texture(`${baseUrl}/textures/grass_leaf.png`, scene);
    grassMat.diffuseTexture.hasAlpha = true;
    grassMat.alphaCutOff = 0.7;
    grassMat.emissiveTexture = new Texture(`${baseUrl}/textures/grass_ramp.png`, scene);
    grassMat.specularColor = new Color3(0.1, 0.3, 0.1);
    grassMat.specularPower = 128;

    grassMat.Vertex_Definitions(`
      #ifdef INSTANCES
        attribute vec3 faceNormal;
        attribute float shadeOffset;
        varying vec3 vFaceNormal;
        varying float vShadeOffset;
      #endif
      varying vec2 vUV;
    `);
    grassMat.Vertex_MainBegin(`vUV = uv;`);
    grassMat.Vertex_Before_PositionUpdated(`
      #ifdef INSTANCES
        vFaceNormal = normalize((world * vec4(faceNormal, 0.0)).xyz);
        vShadeOffset = shadeOffset;
      #endif
    `);
    grassMat.Fragment_Definitions(`
      varying vec3 vFaceNormal;
      varying vec2 vUV;
      varying float vShadeOffset;
      uniform sampler2D ambientSampler;
    `);
    grassMat.Fragment_Custom_Diffuse(`
      float a = texture2D(diffuseSampler, vUV).a;
      if (a < 0.5) discard;

      float ndl = max(dot(normalize(vFaceNormal), normalize(vec3(1.0,1.0,0.5))), 0.0);
      float u = clamp(ndl + vShadeOffset, 0.0, 1.0);
      vec3 rampCol = texture2D(emissiveSampler, vec2(u, 0.5)).rgb;
      float ao = texture2D(ambientSampler, vUV).r;
      rampCol *= ao;
      diffuseColor = rampCol;
    `);
    grassMat.Fragment_Custom_Alpha(`alpha = texture2D(diffuseSampler, vUV).a;`);
    grassPlane.material = grassMat;

    const hill = hillMeshes.find(m => m.name === 'Hill') ?? hillMeshes[0];
    hill.scaling = new Vector3(0.92, 0.445, 0.91);
    hill.parent = root;
    hill.isVisible = true;
    const hillMat = new StandardMaterial('hillCell', scene);
    hillMat.diffuseColor = Color3.FromHexString('#89EF00').toLinearSpace();
    hillMat.diffuseTexture = new Texture(`${baseUrl}/textures/HillBase.png`, scene);
    hillMat.emissiveTexture = new Texture(`${baseUrl}/textures/HillBase.png`, scene);
    hillMat.specularColor = new Color3(0, 0, 0);

    const baseEmitter = grassEmitter.find(m => m.name === 'GrassEmitt') ?? grassEmitter[0];
    baseEmitter.parent = root;
    baseEmitter.isVisible = false;

    const gPositions = baseEmitter.getVerticesData('position')!;
    const gIndices = baseEmitter.getIndices()!;
    const gFaceCenters: Vector3[] = [];
    const gFaceNormals: Vector3[] = [];
    for (let i = 0; i < gIndices.length; i += 3) {
      const [i0, i1, i2] = [gIndices[i], gIndices[i + 1], gIndices[i + 2]];
      const wm = baseEmitter.getWorldMatrix();
      const v0 = Vector3.TransformCoordinates(new Vector3(...gPositions.slice(i0 * 3, i0 * 3 + 3)), wm);
      const v1 = Vector3.TransformCoordinates(new Vector3(...gPositions.slice(i1 * 3, i1 * 3 + 3)), wm);
      const v2 = Vector3.TransformCoordinates(new Vector3(...gPositions.slice(i2 * 3, i2 * 3 + 3)), wm);
      const center = v0.add(v1).add(v2).scale(1 / 3);
      const normal = Vector3.Cross(v1.subtract(v0), v2.subtract(v0)).normalize();
      gFaceCenters.push(center);
      gFaceNormals.push(normal);
    }

    const grassInstances: InstancedMesh[] = [];

    gFaceCenters.forEach((center, idx) => {
      if (Math.random() > 0.4) return;
      const normal = gFaceNormals[idx];
      const inst = grassPlane.createInstance(`g_inst_${idx}`);
      inst.position = center.subtract(root.position); // compensate for root shift
      inst.parent = grassRoot;
      inst.billboardMode = Mesh.BILLBOARDMODE_ALL;
      const s = 0.15 + Math.random() * 0.15;
      inst.scaling = new Vector3(s, s, s);
      inst.rotation.z = Math.random() * Math.PI * 2;
      inst.instancedBuffers.faceNormal = [normal.x, normal.y, normal.z];
      inst.instancedBuffers.shadeOffset = [Math.random() * 0.2 - 0.1];
      grassInstances.push(inst);
    });

    const windObs = scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      allInstances.forEach((i, x) => {
        i.rotation.z = Math.sin(t + x * 0.15) * 0.05;
      });
      grassInstances.forEach((g, x) => {
        g.rotation.z = Math.cos(t + x * 0.11) * 0.08;
      });
    });

    // PostProcess: Watercolor Shader
    Effect.ShadersStore["watercolorFragmentShader"] = `
      precision highp float;
      varying vec2 vUV;
      uniform sampler2D textureSampler;

      void main(void) {
        vec4 color = texture2D(textureSampler, vUV);
        float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
        gray += (fract(sin(dot(vUV.xy, vec2(12.9898,78.233))) * 43758.5453123) - 0.5) * 0.05;
        vec3 finalColor = mix(color.rgb, vec3(gray), 0.3);
        gl_FragColor = vec4(finalColor, 1.0);
      }
    `;
    console.log("Shader loaded?", "watercolorFragmentShader" in Effect.ShadersStore);
    const watercolorPost = new PostProcess(
      "watercolor",
      "watercolor",
      [],
      null,
      1.0,
      camera
    );

    const ssao = new SSAO2RenderingPipeline("ssao", scene, 0.5, [scene.activeCamera!]);
    ssao.radius = 2;
    ssao.samples = 16;
    ssao.totalStrength = 2.0;
    ssao.expensiveBlur = true;

    return () => {
      scene.onBeforeRenderObservable.remove(windObs);
      allInstances.forEach(i => i.dispose());
      grassInstances.forEach(i => i.dispose());
      allBushes.forEach(b => b.dispose());
      leafMat.dispose();
      leafPlane.dispose();
      grassPlane.dispose();
      watercolorPost.dispose();
      camera.dispose();
      root.dispose();
    };
  }, [scene, leafMeshes, treeMeshes]);

  return (
    <>
      <plane ref={leafPlaneRef} name="leafPlane" options={{ size: 1 }} />
      <plane ref={grassPlaneRef} name="grassPlane" options={{ size: 1 }} />
    </>
  );
};

export default Content;
