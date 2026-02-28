"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { FileDown, AlertCircle, Loader2, Grid3x3, Box } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFileName } from "@/lib/utils";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VTKLoader } from "three/addons/loaders/VTKLoader.js";

/** Maximum file size (in bytes) before showing a warning — 50 MB */
const MAX_CAD_FILE_SIZE = 50 * 1024 * 1024;

/** CAD format extensions mapped to loader type */
const FORMAT_MAP: Record<string, string> = {
  stl: "stl",
  obj: "obj",
  ply: "ply",
  vtk: "vtk",
  vtp: "vtk",
  gltf: "gltf",
  glb: "gltf",
};

interface CadViewerProps {
  filePath: string;
}

export function CadViewer({ filePath }: CadViewerProps) {
  const t = useTranslations("files");
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const modelRef = useRef<THREE.Object3D | null>(null);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName = getFileName(filePath, "model");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_MAP[ext] ?? "stl";

  // Toggle wireframe on the loaded model
  const applyWireframe = useCallback((obj: THREE.Object3D, enabled: boolean) => {
    obj.traverse((child) => {
      if (child instanceof THREE.Mesh && child.material) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        for (const mat of materials) {
          if (mat instanceof THREE.Material && "wireframe" in mat) {
            (mat as THREE.MeshStandardMaterial).wireframe = enabled;
          }
        }
      }
    });
  }, []);

  // Toggle grid visibility
  const toggleGrid = useCallback(() => {
    setShowGrid((prev) => {
      const next = !prev;
      if (sceneRef.current) {
        sceneRef.current.traverse((child) => {
          if (child instanceof THREE.GridHelper || child instanceof THREE.AxesHelper) {
            child.visible = next;
          }
        });
      }
      return next;
    });
  }, []);

  // Toggle wireframe
  const toggleWireframe = useCallback(() => {
    setWireframe((prev) => {
      const next = !prev;
      if (modelRef.current) {
        applyWireframe(modelRef.current, next);
      }
      return next;
    });
  }, [applyWireframe]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf0f0f0);
    sceneRef.current = scene;

    // --- Camera ---
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 10000);
    camera.position.set(2, 2, 3);
    cameraRef.current = camera;

    // --- Renderer ---
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // --- Controls ---
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.1;
    controls.enablePan = true;
    controlsRef.current = controls;

    // --- Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);
    const directionalLight1 = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight1.position.set(5, 10, 7);
    scene.add(directionalLight1);
    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4);
    directionalLight2.position.set(-5, -5, -5);
    scene.add(directionalLight2);

    // --- Grid & Axes ---
    const gridHelper = new THREE.GridHelper(10, 20, 0xcccccc, 0xe0e0e0);
    scene.add(gridHelper);
    const axesHelper = new THREE.AxesHelper(3);
    scene.add(axesHelper);

    // --- Animation loop ---
    const animate = () => {
      if (disposed) return;
      animFrameRef.current = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // --- Resize handler ---
    const handleResize = () => {
      if (disposed || !container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // --- Load model ---
    const controller = new AbortController();

    (async () => {
      try {
        const res = await fetch(rawUrl, { signal: controller.signal });
        if (!res.ok) throw new Error("Failed to fetch file");
        const contentLength = res.headers.get("content-length");
        if (contentLength && parseInt(contentLength, 10) > MAX_CAD_FILE_SIZE) {
          throw new Error("File too large for in-browser preview");
        }

        let object: THREE.Object3D | null = null;

        if (format === "stl") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new STLLoader();
          const geometry = loader.parse(buf);
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x2194ce,
            metalness: 0.3,
            roughness: 0.6,
            flatShading: false,
          });
          object = new THREE.Mesh(geometry, material);
        } else if (format === "obj") {
          const text = await res.text();
          if (disposed) return;
          const loader = new OBJLoader();
          object = loader.parse(text);
          // Apply default material to OBJ meshes that lack one
          object.traverse((child) => {
            if (child instanceof THREE.Mesh && !child.material) {
              child.material = new THREE.MeshStandardMaterial({
                color: 0x2194ce,
                metalness: 0.3,
                roughness: 0.6,
              });
            }
          });
        } else if (format === "ply") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new PLYLoader();
          const geometry = loader.parse(buf);
          geometry.computeVertexNormals();
          const hasColors = geometry.hasAttribute("color");
          const material = new THREE.MeshStandardMaterial({
            color: hasColors ? 0xffffff : 0x2194ce,
            vertexColors: hasColors,
            metalness: 0.3,
            roughness: 0.6,
            flatShading: false,
          });
          object = new THREE.Mesh(geometry, material);
        } else if (format === "vtk") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new VTKLoader();
          const geometry = loader.parse(buf, "");
          geometry.computeVertexNormals();
          const material = new THREE.MeshStandardMaterial({
            color: 0x2194ce,
            metalness: 0.3,
            roughness: 0.6,
            flatShading: false,
          });
          object = new THREE.Mesh(geometry, material);
        } else if (format === "gltf") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new GLTFLoader();
          object = await new Promise<THREE.Object3D>((resolve, reject) => {
            loader.parse(
              buf,
              "",
              (gltf) => resolve(gltf.scene),
              (err) => reject(err)
            );
          });
        }

        if (disposed) return;
        if (object) {
          addObjectToScene(object);
        }
      } catch (err: unknown) {
        if (disposed || (err instanceof DOMException && err.name === "AbortError")) return;
        console.error("Failed to load 3D model:", err);
        setError(true);
      }
    })();

    function addObjectToScene(object: THREE.Object3D) {
      // Center and scale the model to fit the view
      const box = new THREE.Box3().setFromObject(object);
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // Normalize size so the longest dimension is about 4 units
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 4 / maxDim;
        object.scale.multiplyScalar(scale);
        box.setFromObject(object);
        box.getCenter(center);
      }

      // Center the object
      object.position.sub(center);

      scene.add(object);
      modelRef.current = object;

      // Adjust camera to fit
      const finalBox = new THREE.Box3().setFromObject(object);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const maxFinal = Math.max(finalSize.x, finalSize.y, finalSize.z);
      const dist = maxFinal * 1.8;
      camera.position.set(dist * 0.7, dist * 0.6, dist * 0.9);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      setLoading(false);
    }

    // --- Cleanup ---
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();

      // Dispose geometries and materials
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry?.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else {
            child.material?.dispose();
          }
        }
      });

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }

      sceneRef.current = null;
      cameraRef.current = null;
      controlsRef.current = null;
      rendererRef.current = null;
      modelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filePath]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
        <AlertCircle className="h-8 w-8" />
        <p className="text-sm">{t("cadPreviewFailed")}</p>
        <a href={rawUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <FileDown className="mr-2 h-4 w-4" />
            {t("downloadFile")}
          </Button>
        </a>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-2 pt-2">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 px-2">
        <Button
          variant={wireframe ? "default" : "outline"}
          size="sm"
          onClick={toggleWireframe}
          title={t("cadWireframe")}
        >
          <Box className="mr-1 h-4 w-4" />
          {t("cadWireframe")}
        </Button>
        <Button
          variant={showGrid ? "default" : "outline"}
          size="sm"
          onClick={toggleGrid}
          title={t("cadGrid")}
        >
          <Grid3x3 className="mr-1 h-4 w-4" />
          {t("cadGrid")}
        </Button>
        <a href={rawUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <FileDown className="mr-1 h-4 w-4" />
            {t("downloadFile")}
          </Button>
        </a>
      </div>

      {/* 3D Canvas */}
      <div className="relative flex-1 rounded border overflow-hidden">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
        <div
          ref={containerRef}
          className="w-full h-full"
          aria-label={`Interactive 3D visualization of ${fileName}`}
          role="img"
        />
      </div>
    </div>
  );
}
