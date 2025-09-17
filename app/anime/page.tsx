"use client";
import React, { useEffect, useRef, useState } from "react";
// Import THREE.js and urdf-loaders
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
// @ts-ignore
import URDFLoader, { URDFRobot } from "@/lib/urdf-loaders/javascript/src/URDFLoader";

const getBasePath = () => {
  if (typeof window !== "undefined") {
    // Next.js exposes __NEXT_DATA__.assetPrefix at runtime
    // fallback to '' if not set
    // @ts-ignore
    return window.__NEXT_DATA__?.assetPrefix || "";
  }
  // On server, fallback to empty string (dev) or process.env.NEXT_PUBLIC_BASE_PATH (prod build)
  return process.env.NEXT_PUBLIC_BASE_PATH || "";
};

const URDF_PATH = `${getBasePath()}/altair.urdf`;
const RAD_TO_DEG = 180 / Math.PI;
const DEG_TO_RAD = Math.PI / 180;

export default function AnimatorPage() {
  const mountRef = useRef<HTMLDivElement>(null);
  const [upDirection, setUpDirection] = useState("+Z");
  const [joints, setJoints] = useState<Record<string, number>>({});
  const [useDegrees, setUseDegrees] = useState(true); // State to toggle between degrees and radians
  const urdfRobotRef = useRef<URDFRobot | null>(null);

  useEffect(() => {
    let renderer: THREE.WebGLRenderer;
    let scene: THREE.Scene;
    let camera: THREE.PerspectiveCamera;
    let controls: OrbitControls | null = null;

    if (mountRef.current) {
      // Set up THREE.js scene
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.shadowMap.enabled = true; // Enable shadow maps
      renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Use soft shadows
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
      mountRef.current.appendChild(renderer.domElement);

      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x87CEEB); // Set background to a brighter blue
      camera = new THREE.PerspectiveCamera(
        45,
        mountRef.current.clientWidth / mountRef.current.clientHeight,
        0.1,
        1000
      );
      camera.position.set(1, 1, 1); // Set the camera even closer to the model
      camera.lookAt(0, 0, 0);

      // Orbit controls
      controls = new OrbitControls(camera, renderer.domElement);
      controls.minDistance = 0.1; // Allow the camera to zoom extremely close
      controls.target.y = 0.5;
      controls.target.z = 0;
      controls.update();

      // Add ground
      const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(),
        new THREE.ShadowMaterial({ opacity: 0.25 })
      );
      ground.rotation.x = -Math.PI / 2;
      ground.scale.setScalar(30);
      ground.receiveShadow = true;
      scene.add(ground);

      // Add lights
      const light = new THREE.DirectionalLight(0xffffff, 1);
      light.position.set(5, 30, 5);
      light.castShadow = true;
      light.shadow.mapSize.setScalar(2048); // Increase shadow map resolution
      light.shadow.camera.near = 0.5;
      light.shadow.camera.far = 50;
      light.shadow.camera.left = -15;
      light.shadow.camera.right = 15;
      light.shadow.camera.top = 15;
      light.shadow.camera.bottom = -15;
      scene.add(light);

      const ambientLight = new THREE.AmbientLight(0xffffff, 0.4); // Increased ambient light for brightness
      scene.add(ambientLight);

      // Load URDF
      const manager = new THREE.LoadingManager();
      // Use setURLModifier to prepend basePath to all asset URLs
      manager.setURLModifier((url) => {
        const basePath = getBasePath();
        if (url.startsWith("/")) {
          return basePath + url;
        }
        return basePath + "/" + url;
      });
      const loader = new URDFLoader(manager);
      loader.load(
        URDF_PATH,
        (robot: URDFRobot) => {
          urdfRobotRef.current = robot;
        },
        undefined,
        (err: any) => {
          console.error("Failed to load URDF:", err);
        }
      );

      // Wait until all geometry has loaded to add the model to the scene
      manager.onLoad = () => {
        const urdfRobot = urdfRobotRef.current;
        if (!urdfRobot) return;

        switch (upDirection) {
          case "+X":
            urdfRobot.rotation.set(0, 0, -Math.PI / 2);
            break;
          case "-X":
            urdfRobot.rotation.set(0, 0, Math.PI / 2);
            break;
          case "+Y":
            urdfRobot.rotation.set(0, 0, 0);
            break;
          case "-Y":
            urdfRobot.rotation.set(Math.PI, 0, 0);
            break;
          case "+Z":
            urdfRobot.rotation.set(-Math.PI / 2, 0, 0);
            break;
          case "-Z":
            urdfRobot.rotation.set(Math.PI / 2, 0, 0);
            break;
        }

        urdfRobot.traverse((c: any) => {
          c.castShadow = true;
          c.receiveShadow = true; // Ensure all objects receive shadows
        });
        urdfRobot.updateMatrixWorld(true);

        // Position robot above ground
        const bb = new THREE.Box3();
        bb.setFromObject(urdfRobot);
        urdfRobot.position.y -= bb.min.y;
        scene.add(urdfRobot);

        // Extract joints and initialize their values, excluding fixed joints
        const jointMap: Record<string, number> = {};
        Object.keys(urdfRobot.joints).forEach((jointName) => {
          const joint = urdfRobot.joints[jointName];
          if (joint.jointType !== "fixed") {
            jointMap[jointName] = joint.angle || 0;
          }
        });
        setJoints(jointMap);
      };

      // Handle resize
      const handleResize = () => {
        renderer.setSize(mountRef.current!.clientWidth, mountRef.current!.clientHeight);
        renderer.setPixelRatio(window.devicePixelRatio);
        camera.aspect = mountRef.current!.clientWidth / mountRef.current!.clientHeight;
        camera.updateProjectionMatrix();
      };
      window.addEventListener("resize", handleResize);

      // Animation loop
      const animate = () => {
        requestAnimationFrame(animate);
        if (controls) controls.update();
        renderer.render(scene, camera);
      };
      animate();
    }

    // Cleanup
    return () => {
      if (renderer && mountRef.current) {
        mountRef.current.removeChild(renderer.domElement);
      }
      window.removeEventListener("resize", () => {});
    };
  }, [upDirection]);

  const updateJoint = (jointName: string, value: number) => {
    console.log(`Updating joint: ${jointName}, Value: ${value}, Mode: ${useDegrees ? "Degrees" : "Radians"}`);
    setJoints((prev) => {
      const updatedJoints = { ...prev, [jointName]: value };
      console.log("Updated joints state:", updatedJoints);
      return updatedJoints;
    });
    // Update the joint value in the URDF model
    const urdfRobot = urdfRobotRef.current;
    if (urdfRobot && urdfRobot.joints[jointName]) {
      urdfRobot.joints[jointName].setJointValue(value);
      console.log(`Joint ${jointName} set to ${value} in URDF model.`);
    }
  };

  return (
    <div style={{ width: "100vw", height: "100vh", background: "#222", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10, background: "rgba(30,30,30,0.8)", padding: "8px", borderRadius: "6px" }}>
        <label style={{ color: "#fff", marginRight: "8px" }}>Up Direction:</label>
        <select value={upDirection} onChange={(e) => setUpDirection(e.target.value)}>
          <option value="+X">+X</option>
          <option value="-X">-X</option>
          <option value="+Y">+Y</option>
          <option value="-Y">-Y</option>
          <option value="+Z">+Z</option>
          <option value="-Z">-Z</option>
        </select>
        <div style={{ marginTop: "16px", marginBottom: "24px" }}>
          <label style={{ color: "#fff", marginRight: "8px" }}>Angle Unit:</label>
          <select value={useDegrees ? "degrees" : "radians"} onChange={(e) => setUseDegrees(e.target.value === "degrees")}>
            <option value="degrees">Degrees</option>
            <option value="radians">Radians</option>
          </select>
        </div>
      </div>
      <div style={{ position: "absolute", top: 150, left: 20, zIndex: 10, background: "rgba(30,30,30,0.8)", padding: "8px", borderRadius: "6px", maxHeight: "70vh", overflowY: "auto" }}>
        <h3 style={{ color: "#fff" }}>Joints</h3>
        {Object.keys(joints).map((jointName) => (
          <div key={jointName} style={{ marginBottom: "16px" }}>
            <label style={{ color: "#fff", marginRight: "8px", display: "block" }}>{jointName}</label>
            <input
              type="range"
              min={useDegrees ? -180 : -Math.PI}
              max={useDegrees ? 180 : Math.PI}
              step={useDegrees ? 1 : 0.01}
              value={useDegrees ? joints[jointName] * RAD_TO_DEG : joints[jointName]}
              onChange={(e) => {
                const rawValue = parseFloat(e.target.value);
                const convertedValue = useDegrees ? rawValue * DEG_TO_RAD : rawValue;
                updateJoint(jointName, convertedValue);
              }}
              style={{ width: "100%", marginBottom: "4px" }}
            />
            <input
              type="number"
              step={useDegrees ? 1 : 0.01}
              value={useDegrees ? joints[jointName] * RAD_TO_DEG : joints[jointName]}
              onChange={(e) => {
                const rawValue = parseFloat(e.target.value);
                const convertedValue = useDegrees ? rawValue * DEG_TO_RAD : rawValue;
                updateJoint(jointName, convertedValue);
              }}
              style={{ width: "100%", padding: "4px", borderRadius: "4px", border: "1px solid #ccc" }}
            />
          </div>
        ))}
        <div style={{ marginTop: "16px" }}>
          <button
            onClick={() => {
              const zeroedJoints = Object.keys(joints).reduce((acc, jointName) => {
                acc[jointName] = 0;
                return acc;
              }, {} as Record<string, number>);
              setJoints(zeroedJoints);
              const urdfRobot = urdfRobotRef.current;
              if (urdfRobot) {
                Object.keys(urdfRobot.joints).forEach((jointName) => {
                  if (urdfRobot.joints[jointName]) {
                    urdfRobot.joints[jointName].setJointValue(0);
                  }
                });
              }
              console.log("All joint values reset to zero.");
            }}
            style={{
              padding: "8px 16px",
              backgroundColor: "#007BFF",
              color: "#fff",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            Zero All Joints
          </button>
        </div>
      </div>
      <div ref={mountRef} style={{ width: "100vw", height: "100vh" }} />
    </div>
  );
}
