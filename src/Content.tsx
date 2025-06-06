import React, { useEffect, useRef } from 'react';
import {
  Vector3,
  StandardMaterial,
  Texture,
  Color3,
  Mesh,
  InstancedMesh,
  MeshBuilder,
} from '@babylonjs/core';
import { useScene, useModel } from 'reactylon';
import '@babylonjs/loaders';

const Content: React.FC = () => {
  const scene = useScene();
  // ① Load the emitter glTF via useModel (Suspense-friendly)
  //    This returns an object containing the loaded meshes.
  const { meshes: loadedMeshes } = useModel('/meshes/leaf_emitter.glb');

  // ② Create a ref for our hidden “base leaf” plane
  const leafPlaneRef = useRef<Mesh>(null!);

  useEffect(() => {
    if (!scene || !leafPlaneRef.current || loadedMeshes.length === 0) {
      return;
    }
    const leafPlane = leafPlaneRef.current;

    // 1️⃣ Create & hide the base leaf plane (only do this once)
    //    If the plane doesn’t exist yet, build it now:
    if (!leafPlane) {
      // This block will actually never run because we set the ref on JSX below.
      return;
    }
    leafPlane.isVisible = false; // hide the “template” leaf

    // 2️⃣ Assign a cel-shaded, alpha-masked material to the base leaf
    const leafMat = new StandardMaterial('leafMat', scene);
    leafMat.diffuseTexture = new Texture('/textures/alphaleaf.png', scene);
    leafMat.diffuseTexture.hasAlpha = true;
    leafMat.backFaceCulling = true;
    leafMat.emissiveColor = new Color3(1, 1, 1);
    leafPlane.material = leafMat;

    // 3️⃣ Find the emitter mesh from loadedMeshes
    //    (Replace “LeafEmitter” with the actual name you exported from Blender,
    //     or simply take the first mesh if it’s the only one.)
    const emitter =
      loadedMeshes.find((m) => m.name === 'LeafEmitter') ?? loadedMeshes[0];
    emitter.isVisible = false; // hide the emitter itself

    // 4️⃣ Extract emitter geometry data:
    const positions = emitter.getVerticesData('position')!;
    const indices = emitter.getIndices()!;
    // We’ll recompute normals from the triangle vertices instead of reading “normal” data.

    // 5️⃣ Build arrays of face centers + face normals:
    const faceCenters: Vector3[] = [];
    const faceNormals: Vector3[] = [];
    for (let i = 0; i < indices.length; i += 3) {
      const i0 = indices[i] * 3;
      const i1 = indices[i + 1] * 3;
      const i2 = indices[i + 2] * 3;

      const v0 = new Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
      const v1 = new Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
      const v2 = new Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);

      // center = (v0 + v1 + v2) / 3
      const center = v0.add(v1).add(v2).scale(1 / 3);
      faceCenters.push(center);

      // normal = cross(v1 - v0, v2 - v0).normalize()
      const edge1 = v1.subtract(v0);
      const edge2 = v2.subtract(v0);
      const normal = Vector3.Cross(edge1, edge2).normalize();
      faceNormals.push(normal);
    }

    // 6️⃣ Instantiate one leaf per face
    const density = 0.2; // 20% of faces
    const instances: InstancedMesh[] = [];

    faceCenters.forEach((center, idx) => {
      // Only proceed for ~20% of faces:
      if (Math.random() > density) {
        return;
      }

      const normal = faceNormals[idx];
      const inst = leafPlane.createInstance(`leafInst_${idx}`);
      inst.position   = center.add(normal.scale(0.01));
      inst.billboardMode = Mesh.BILLBOARDMODE_ALL;

      const s = 0.5 + Math.random() * 0.7;
      inst.scaling    = new Vector3(s, s, s);
      inst.rotation.z = Math.random() * Math.PI * 2;
      instances.push(inst);
    });

    // 7️⃣ Simple wind sway via sine-wave on each instance
    const windObserver = scene.onBeforeRenderObservable.add(() => {
      const t = performance.now() * 0.001;
      instances.forEach((inst, i) => {
        inst.rotation.z = Math.sin(t + i * 0.1) * 0.05;
      });
    });

    // 8️⃣ Clean up when unmounting or rerendering:
    return () => {
      scene.onBeforeRenderObservable.remove(windObserver);
      instances.forEach((i) => i.dispose());
      leafMat.dispose();
      leafPlane.dispose();
    };
  }, [scene, loadedMeshes]);

  // 9️⃣ Render the “hidden” leaf template. We don’t render the emitter because it’s hidden above.
  return (
    <plane
      ref={leafPlaneRef}
      name="leafPlane"
      options={{ size: 1 }}
    />
  );
};

export default Content;
