"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import {
  FileDown, AlertCircle, Loader2, Grid3x3, Box,
  Maximize, RotateCcw, Triangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip, TooltipTrigger, TooltipContent,
} from "@/components/ui/tooltip";
import { getFileName } from "@/lib/utils";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { VTKLoader } from "three/addons/loaders/VTKLoader.js";
import { FBXLoader } from "three/addons/loaders/FBXLoader.js";
import { ColladaLoader } from "three/addons/loaders/ColladaLoader.js";
import { TDSLoader } from "three/addons/loaders/TDSLoader.js";
import { ThreeMFLoader } from "three/addons/loaders/3MFLoader.js";
import { PCDLoader } from "three/addons/loaders/PCDLoader.js";

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
  fbx: "fbx",
  dae: "dae",
  "3ds": "3ds",
  "3mf": "3mf",
  pcd: "pcd",
};

/** Model statistics */
interface ModelStats {
  vertices: number;
  triangles: number;
}

/** Collect vertex/triangle counts from an object tree */
function collectStats(obj: THREE.Object3D): ModelStats {
  let vertices = 0;
  let triangles = 0;
  obj.traverse((child) => {
    if (child instanceof THREE.Mesh && child.geometry) {
      const geo = child.geometry;
      vertices += geo.attributes.position?.count ?? 0;
      if (geo.index) {
        triangles += geo.index.count / 3;
      } else {
        triangles += (geo.attributes.position?.count ?? 0) / 3;
      }
    } else if (child instanceof THREE.Points && child.geometry) {
      vertices += child.geometry.attributes.position?.count ?? 0;
    }
  });
  return { vertices: Math.round(vertices), triangles: Math.round(triangles) };
}

/** Format number with K/M suffix */
function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

/** Default material for single-geometry formats */
function createDefaultMaterial(doubleSide = false) {
  return new THREE.MeshStandardMaterial({
    color: 0x2194ce,
    metalness: 0.3,
    roughness: 0.6,
    flatShading: false,
    side: doubleSide ? THREE.DoubleSide : THREE.FrontSide,
  });
}

/** Dispose all GPU resources (geometries, materials, textures) from a scene */
function disposeSceneResources(scene: THREE.Scene) {
  scene.traverse((child) => {
    if (
      child instanceof THREE.Mesh ||
      child instanceof THREE.LineSegments ||
      child instanceof THREE.Line ||
      child instanceof THREE.Points
    ) {
      child.geometry?.dispose();
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      for (const mat of materials) {
        if (!(mat instanceof THREE.Material)) continue; // guard against null entries
        // Dispose textures attached to the material
        for (const value of Object.values(mat)) {
          if (value instanceof THREE.Texture) value.dispose();
        }
        mat.dispose();
      }
    }
  });
}

interface CadViewerProps {
  filePath: string;
}

export function CadViewer({ filePath }: CadViewerProps) {
  const t = useTranslations("files");
  const { theme, systemTheme } = useTheme();
  const containerRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const animFrameRef = useRef<number>(0);
  const modelRef = useRef<THREE.Object3D | null>(null);
  const wireframeRef = useRef(false);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [showGrid, setShowGrid] = useState(true);
  const [stats, setStats] = useState<ModelStats | null>(null);

  const rawUrl = `/api/files/raw?path=${encodeURIComponent(filePath)}`;
  const fileName = getFileName(filePath, "model");
  const ext = filePath.split(".").pop()?.toLowerCase() ?? "";
  const format = FORMAT_MAP[ext] ?? "stl";

  // Resolve effective theme
  const isDark = (theme === "system" ? systemTheme : theme) === "dark";

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
      wireframeRef.current = next;
      if (modelRef.current) {
        applyWireframe(modelRef.current, next);
      }
      return next;
    });
  }, [applyWireframe]);

  // Fit camera to model
  const fitToView = useCallback(() => {
    const model = modelRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!model || !camera || !controls) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 1.8;

    camera.position.set(
      center.x + dist * 0.7,
      center.y + dist * 0.6,
      center.z + dist * 0.9,
    );
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  }, []);

  // Reset to front view
  const resetView = useCallback(() => {
    const model = modelRef.current;
    const camera = cameraRef.current;
    const controls = controlsRef.current;
    if (!model || !camera || !controls) return;

    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z);
    const dist = maxDim * 2;

    camera.position.set(center.x, center.y, center.z + dist);
    camera.up.set(0, 1, 0);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
  }, []);

  // Respond to dark/light theme changes
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(isDark ? 0x1e1e2e : 0xf0f0f0);

    // Update grid colors for theme
    sceneRef.current.traverse((child) => {
      if (child instanceof THREE.GridHelper) {
        const colors = isDark
          ? { center: 0x555555, grid: 0x333333 }
          : { center: 0xcccccc, grid: 0xe0e0e0 };
        child.material.opacity = 1;
        // Re-create grid colors
        const colorAttr = child.geometry.getAttribute("color");
        if (colorAttr) {
          const centerColor = new THREE.Color(colors.center);
          const gridColor = new THREE.Color(colors.grid);
          for (let i = 0; i < colorAttr.count; i++) {
            const isCenter = i < 2;
            const c = isCenter ? centerColor : gridColor;
            colorAttr.setXYZ(i, c.r, c.g, c.b);
          }
          colorAttr.needsUpdate = true;
        }
      }
    });
  }, [isDark]);

  // Keyboard shortcuts — only active when our container has focus
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if an input/textarea/select is focused
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key.toLowerCase()) {
        case "f":
          e.preventDefault();
          fitToView();
          break;
        case "w":
          e.preventDefault();
          toggleWireframe();
          break;
        case "g":
          e.preventDefault();
          toggleGrid();
          break;
        case "r":
          e.preventDefault();
          resetView();
          break;
      }
    };
    container.addEventListener("keydown", handleKeyDown);
    return () => container.removeEventListener("keydown", handleKeyDown);
  }, [fitToView, toggleWireframe, toggleGrid, resetView]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Reset state for new file
    setLoading(true);
    setError(false);
    setStats(null);
    setWireframe(false);
    wireframeRef.current = false;
    setShowGrid(true);

    let disposed = false;

    // --- Scene setup ---
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDark ? 0x1e1e2e : 0xf0f0f0);
    sceneRef.current = scene;

    // --- Camera ---
    const width = container.clientWidth || 600;
    const height = container.clientHeight || 400;
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 10000);
    camera.position.set(2, 2, 3);
    cameraRef.current = camera;

    // --- Renderer ---
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true });
    } catch (err) {
      console.error("Failed to initialize WebGL renderer:", err);
      setError(true);
      setLoading(false);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
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
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.3);
    scene.add(hemiLight);

    // --- Grid & Axes (created with theme-aware colors) ---
    const gridColors = isDark
      ? { center: 0x555555, grid: 0x333333 }
      : { center: 0xcccccc, grid: 0xe0e0e0 };
    const gridHelper = new THREE.GridHelper(10, 20, gridColors.center, gridColors.grid);
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
      // Skip when panel is hidden/collapsed to avoid Infinity aspect ratio
      if (w <= 0 || h <= 0) return;
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
          object = new THREE.Mesh(geometry, createDefaultMaterial(true));
        } else if (format === "obj") {
          const text = await res.text();
          if (disposed) return;
          const loader = new OBJLoader();
          object = loader.parse(text);
          object.traverse((child) => {
            if (child instanceof THREE.Mesh) {
              if (!child.material) {
                child.material = createDefaultMaterial();
              }
              // Ensure OBJ meshes have computed normals
              child.geometry?.computeVertexNormals();
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
            side: THREE.DoubleSide,
          });
          object = new THREE.Mesh(geometry, material);
        } else if (format === "vtk") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new VTKLoader();
          const geometry = loader.parse(buf, "");
          geometry.computeVertexNormals();
          object = new THREE.Mesh(geometry, createDefaultMaterial(true));
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
        } else if (format === "fbx") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new FBXLoader();
          object = loader.parse(buf, "");
        } else if (format === "dae") {
          const text = await res.text();
          if (disposed) return;
          const loader = new ColladaLoader();
          const collada = loader.parse(text, "");
          if (!collada?.scene) throw new Error("Invalid Collada file");
          object = collada.scene;
        } else if (format === "3ds") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new TDSLoader();
          object = loader.parse(buf, "");
        } else if (format === "3mf") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new ThreeMFLoader();
          object = loader.parse(buf);
        } else if (format === "pcd") {
          const buf = await res.arrayBuffer();
          if (disposed) return;
          const loader = new PCDLoader();
          const points = loader.parse(buf);
          object = points;
        }

        if (disposed) return;
        if (object) {
          addObjectToScene(object);
        } else {
          setLoading(false);
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

      // Apply current wireframe state (may have been toggled during load)
      if (wireframeRef.current) {
        applyWireframe(object, true);
      }

      // Scale grid to match model size
      const finalBox = new THREE.Box3().setFromObject(object);
      const finalSize = finalBox.getSize(new THREE.Vector3());
      const maxFinal = Math.max(finalSize.x, finalSize.y, finalSize.z);
      const gridScale = Math.max(1, Math.ceil(maxFinal / 4) * 2);
      gridHelper.scale.set(gridScale, gridScale, gridScale);
      axesHelper.scale.set(gridScale * 0.5, gridScale * 0.5, gridScale * 0.5);

      // Adjust camera to fit
      const dist = maxFinal * 1.8;
      camera.position.set(dist * 0.7, dist * 0.6, dist * 0.9);
      camera.lookAt(0, 0, 0);
      controls.target.set(0, 0, 0);
      controls.update();

      // Collect model statistics
      setStats(collectStats(object));
      setLoading(false);
    }

    // --- Cleanup ---
    return () => {
      disposed = true;
      controller.abort();
      cancelAnimationFrame(animFrameRef.current);
      resizeObserver.disconnect();
      controls.dispose();

      // Dispose all GPU resources (geometries, materials, textures)
      disposeSceneResources(scene);

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
      <div className="flex items-center justify-between gap-2 px-2">
        {/* Model stats */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {stats && (
            <>
              <span className="flex items-center gap-1" title={t("cadVertices")}>
                <Triangle className="h-3 w-3" />
                {fmtNum(stats.vertices)} {t("cadVertices")}
              </span>
              {stats.triangles > 0 && (
                <span>
                  {fmtNum(stats.triangles)} {t("cadTriangles")}
                </span>
              )}
            </>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={wireframe ? "default" : "outline"}
                size="sm"
                onClick={toggleWireframe}
                className="h-8 w-8 p-0"
              >
                <Box className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("cadWireframe")} (W)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant={showGrid ? "default" : "outline"}
                size="sm"
                onClick={toggleGrid}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("cadGrid")} (G)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={fitToView}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <Maximize className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("cadFitView")} (F)</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={resetView}
                disabled={loading}
                className="h-8 w-8 p-0"
              >
                <RotateCcw className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">{t("cadResetView")} (R)</TooltipContent>
          </Tooltip>

          <div className="mx-1 h-5 w-px bg-border" />

          <a href={rawUrl} download={fileName}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 w-8 p-0">
                  <FileDown className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">{t("downloadFile")}</TooltipContent>
            </Tooltip>
          </a>
        </div>
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
          className="w-full h-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
          tabIndex={0}
          aria-label={`Interactive 3D visualization of ${fileName}`}
          role="img"
        />
      </div>
    </div>
  );
}
