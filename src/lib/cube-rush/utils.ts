import * as THREE from 'three';

export function checkCollision(obj1: THREE.Mesh, obj2: THREE.Mesh): boolean {
  if (!obj1.visible) return false;
  const box1 = new THREE.Box3().setFromObject(obj1);
  const box2 = new THREE.Box3().setFromObject(obj2);
  return box1.intersectsBox(box2);
}