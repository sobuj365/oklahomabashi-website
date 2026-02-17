import React, { useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sphere, MeshDistortMaterial, Float, Stars } from '@react-three/drei';
import * as THREE from 'three';

// Fix for TypeScript not recognizing R3F elements in JSX
declare global {
  namespace JSX {
    interface IntrinsicElements {
      ambientLight: any;
      directionalLight: any;
      pointLight: any;
    }
  }
}

const AnimatedShape = () => {
  const meshRef = useRef<THREE.Mesh>(null!);
  
  useFrame((state) => {
    const t = state.clock.getElapsedTime();
    meshRef.current.rotation.x = t * 0.2;
    meshRef.current.rotation.y = t * 0.3;
  });

  return (
    <Float speed={2} rotationIntensity={1.5} floatIntensity={2}>
      <Sphere ref={meshRef} args={[1, 100, 200]} scale={2.4}>
        <MeshDistortMaterial 
          color="#16a34a" 
          attach="material" 
          distort={0.4} 
          speed={2} 
          roughness={0.2}
          metalness={0.8}
        />
      </Sphere>
    </Float>
  );
};

const Hero3D = () => {
  return (
    <div className="relative w-full h-[90vh] overflow-hidden">
      {/* 3D Canvas Background */}
      <div className="absolute inset-0 z-0">
        <Canvas camera={{ position: [0, 0, 5] }}>
          <ambientLight intensity={0.5} />
          <directionalLight position={[10, 10, 5]} intensity={1} color="#f43f5e" />
          <pointLight position={[-10, -10, -10]} intensity={0.5} color="#3b82f6" />
          <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />
          <AnimatedShape />
        </Canvas>
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 z-10 flex items-center justify-center pointer-events-none">
        <div className="text-center px-4">
          <h1 className="text-5xl md:text-8xl font-display font-black text-white mb-6 tracking-tighter mix-blend-overlay">
            OKLAHOMA<br/>BASHI
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-2xl mx-auto font-light mb-8">
            The future of the Bangladeshi community in Oklahoma.
            <br />
            <span className="text-okla-500 font-semibold">Connect. Celebrate. Innovate.</span>
          </p>
          <div className="pointer-events-auto flex flex-col sm:flex-row gap-4 justify-center">
            <button className="px-8 py-4 bg-okla-600 hover:bg-okla-500 text-white rounded-full font-bold transition-all shadow-[0_0_20px_rgba(22,163,74,0.5)]">
              Explore Events
            </button>
            <button className="px-8 py-4 bg-white/10 hover:bg-white/20 backdrop-blur-md text-white rounded-full font-bold transition-all border border-white/20">
              Become a Volunteer
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Hero3D;