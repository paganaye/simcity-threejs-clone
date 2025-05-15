import * as THREE from "three";
// @ts-ignore 
import { mergeMeshesWithGroups } from "./AssetManager"; // Assuming this path is correct
import GUI from "lil-gui";
// @ts-ignore 
import { random, setRandomSeed } from "../sim/Rng"; // Assuming this path is correct


interface IUV {
    u1: number;
    v1: number;
    u2: number;
    v2: number;
}

interface IPartUVs {
    front: IUV;
    left: IUV;
    back: IUV;
    right?: IUV; // Optional, will be mirrored from left if not provided
}

interface IAllPartsUVs {
    head: IPartUVs;
    torso: IPartUVs;
    arm: IPartUVs;
    leg: IPartUVs;
}


export function instancedMeshes(scene: THREE.Scene) {
    const gui = new GUI();
    const characterPartUVs = { // UV definitions for each body part
        head: {
            front: { u1: 0.6, v1: 0, u2: 0.7, v2: 0.5 },
            back: { u1: 0.7, v1: 0, u2: 0.8, v2: 0.5 },
            left: { u1: 0.8, v1: 0, u2: 0.9, v2: 0.5 },
        },
        torso: {
            front: { u1: 0.6, v1: 0.5, u2: 0.7, v2: 1 },
            back: { u1: 0.7, v1: 0.5, u2: 0.8, v2: 1 },
            left: { u1: 0.8, v1: 0.5, u2: 0.9, v2: 1 },
        },
        arm: {
            front: { u1: 0.3, v1: 0, u2: 0.4, v2: 0.5 },
            back: { u1: 0.4, v1: 0, u2: 0.5, v2: 0.5 },
            left: { u1: 0.5, v1: 0, u2: 0.6, v2: 0.5 },
        },
        leg: {
            front: { u1: 0.0, v1: 0, u2: 0.1, v2: 1 },
            back: { u1: 0.1, v1: 0, u2: 0.2, v2: 1 },
            left: { u1: 0.2, v1: 0, u2: 0.3, v2: 1 },
        }
    } as IAllPartsUVs;

    const guiControls = {
        speed: 0.5,
    };

    gui.add(guiControls, 'speed', 0, 2, 0.01).name('Character Speed').onChange(updateSpeedUniform);

    let instancedMaterialsArray: THREE.Material[] = [];
    let instancedCharacterMesh: THREE.InstancedMesh | null = null;

    const textureLoader = new THREE.TextureLoader();
    const femaleTexture = loadTexture("textures/female.png");

    function loadTexture(url: string, flipY = false): THREE.Texture {
        const texture = textureLoader.load(url);
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.flipY = flipY;
        texture.magFilter = THREE.NearestFilter;
        texture.minFilter = THREE.NearestFilter;
        return texture;
    }

    function updateSpeedUniform() {
        if (instancedMaterialsArray) {
            instancedMaterialsArray.forEach(material => {
                // @ts-ignore
                if (material.uniforms && material.uniforms.uSpeed) {
                    // @ts-ignore
                    material.uniforms.uSpeed.value = guiControls.speed;
                }
            });
        }
    }
    
    function mirrorUV(uv: IUV): IUV {
        return { u1: uv.u2, v1: uv.v1, u2: uv.u1, v2: uv.v2 };
    }

    function addSceneContent() {
        setRandomSeed(14_05_2025);

        const ambientLight = new THREE.AmbientLight(0xffffff, 1);
        if (!scene.getObjectByName("ambientLight")) {
            ambientLight.name = "ambientLight";
            scene.add(ambientLight);
        }

        let dummyMaterial = new THREE.MeshStandardMaterial({ name: "dummyMergeMat" });
        
        function createCrossedPlanesGeometry(
            size: { x: number; y: number; z: number; },
            _frontUV_placeholder?: IUV, 
            _leftUV_placeholder?: IUV,
            _backUV_placeholder?: IUV,
            _rightUV_placeholder?: IUV
        ): THREE.BufferGeometry {
            const partGroup = new THREE.Group();

            const planeFrontGeom = new THREE.PlaneGeometry(size.x, size.y); 
            const frontPlaneInfoArray = new Float32Array(planeFrontGeom.attributes.position.count).fill(0.0);
            planeFrontGeom.setAttribute('planeInfo', new THREE.BufferAttribute(frontPlaneInfoArray, 1));
            partGroup.add(new THREE.Mesh(planeFrontGeom, dummyMaterial));

            const planeLeftGeom = new THREE.PlaneGeometry(size.z, size.y); 
            planeLeftGeom.rotateY(Math.PI / 2);
            const leftPlaneInfoArray = new Float32Array(planeLeftGeom.attributes.position.count).fill(1.0);
            planeLeftGeom.setAttribute('planeInfo', new THREE.BufferAttribute(leftPlaneInfoArray, 1));
            partGroup.add(new THREE.Mesh(planeLeftGeom, dummyMaterial));
 
            // @ts-ignore 
            const { geometry: mergedPartGeometry } = mergeMeshesWithGroups(partGroup, false);
            mergedPartGeometry.translate(0, size.y / 2, 0);
            return mergedPartGeometry;
        }

        function customizeShader(
            shader: THREE.WebGLProgramParametersWithUniforms,
            materialUniforms: { [key: string]: THREE.IUniform<any>; }, 
            colorAttributeName: string, 
            varyingColorName: string,   
            animationConfig?: {
                type: 'leg' | 'arm';
                side: 'left' | 'right';
                geomHeight: number;
                walkSpeed: number;
                maxAngle: number;
                partBasePositionInDummyModel?: THREE.Vector3;
            }
        ) {
            // 1. Déclarations communes pour le Vertex Shader
            let commonVsDeclarations = `
        attribute vec3 ${colorAttributeName}; 
        varying vec3 ${varyingColorName}; 
        varying vec2 vUv; 
        uniform float uTime; 
        uniform float uSpeed;
        attribute float planeInfo; 
        
        uniform vec4 u_frontUV; 
        uniform vec4 u_backUV;  
        uniform vec4 u_leftUV;  
        uniform vec4 u_rightUV; 

        varying float v_shouldShow; // NOUVEAU: varying pour passer la visibilité au fragment shader
        `;
            shader.vertexShader = shader.vertexShader.replace(
                `#include <common>`,
                `#include <common>
        ${commonVsDeclarations}`
            );
        
            shader.vertexShader = shader.vertexShader.replace(
                `#include <uv_vertex>`,
                `// #include <uv_vertex> (Contenu original neutralisé)`
            );
        
            let animVsDefines = "";
            let animVsDeclarationsPart = "";
            if (animationConfig) {
                if (animationConfig.side === 'right') animVsDefines += "#define IS_RIGHT_SIDE\\n";
                if (animationConfig.type === 'arm') animVsDefines += "#define IS_ARM_TYPE\\n";
                animVsDeclarationsPart = `attribute float instanceAnimationOffset;\\n`;
                if (animationConfig.partBasePositionInDummyModel) {
                    animVsDeclarationsPart += `uniform vec3 u_partBasePositionInDummyModel;\\n`;
                }
                animVsDeclarationsPart += `
        mat4 rotationAroundX(float angle) {
            float s = sin(angle); float c = cos(angle);
            return mat4(1.0,0.0,0.0,0.0, 0.0,c,s,0.0, 0.0,-s,c,0.0, 0.0,0.0,0.0,1.0);
        }`;
                shader.vertexShader = shader.vertexShader.replace(
                    `#include <fog_pars_vertex>`, 
                    `#include <fog_pars_vertex>
        ${animVsDefines}
        ${animVsDeclarationsPart}`
                );
            }
        
            shader.uniforms.uTime = materialUniforms.uTime;
            shader.uniforms.uSpeed = materialUniforms.uSpeed;
            if (materialUniforms.u_frontUV) shader.uniforms.u_frontUV = materialUniforms.u_frontUV;
            if (materialUniforms.u_backUV) shader.uniforms.u_backUV = materialUniforms.u_backUV; 
            if (materialUniforms.u_leftUV) shader.uniforms.u_leftUV = materialUniforms.u_leftUV; 
            if (materialUniforms.u_rightUV) shader.uniforms.u_rightUV = materialUniforms.u_rightUV; 
            
            if (animationConfig && animationConfig.partBasePositionInDummyModel && materialUniforms.u_partBasePositionInDummyModel) {
                shader.uniforms.u_partBasePositionInDummyModel = materialUniforms.u_partBasePositionInDummyModel;
            }
        
            // Calculs de direction de vue et sélection d'UV (début de main())
            let mainStartInjection = `
            ${varyingColorName} = ${colorAttributeName}; 
        
            vec3 worldPosForUVSelection = (instanceMatrix * vec4(position, 1.0)).xyz; 
            vec3 instanceWorldDisplacement = vec3(0.0);
            vec3 instanceWorldForwardDir = instanceMatrix[2].xyz;
            if (length(instanceWorldForwardDir) > 0.00001) {
                instanceWorldDisplacement = normalize(instanceWorldForwardDir) * uTime * uSpeed;
            }
            worldPosForUVSelection += instanceWorldDisplacement;

            vec3 viewDirectionVec = cameraPosition - worldPosForUVSelection;
            vec3 viewDirWorldForUV = vec3(0.0, 0.0, 1.0); 
            if (length(viewDirectionVec) > 0.00001) {
                viewDirWorldForUV = normalize(viewDirectionVec);
            }

            vec3 instanceWorldForwardForUV = vec3(0.0, 0.0, 1.0); 
            if (length(instanceWorldForwardDir) > 0.00001) {
                 instanceWorldForwardForUV = normalize(instanceWorldForwardDir);
            }

            vec3 instanceWorldRightDir = instanceMatrix[0].xyz;
            vec3 instanceWorldRightForUV = vec3(1.0, 0.0, 0.0); 
            if (length(instanceWorldRightDir) > 0.00001) {
                instanceWorldRightForUV = normalize(instanceWorldRightDir);
            }

            float sdViewWithForward = dot(viewDirWorldForUV, instanceWorldForwardForUV);
            float sdViewWithRight   = dot(viewDirWorldForUV, instanceWorldRightForUV);

            vec2 base_uv_for_calc = uv; 
            vec4 currentUVRect;

            bool isViewingFrontOrBack = abs(sdViewWithForward) >= abs(sdViewWithRight);

            if (isViewingFrontOrBack) {
                if (sdViewWithForward > 0.0) { 
                    currentUVRect = u_frontUV;
                } else { 
                    currentUVRect = u_backUV;
                }
            } else { 
                if (sdViewWithRight > 0.0) { 
                    currentUVRect = u_leftUV;
                } else { 
                    currentUVRect = u_rightUV;
                }
            }
            vUv.x = mix(currentUVRect.x, currentUVRect.z, base_uv_for_calc.x);
            vUv.y = mix(currentUVRect.y, currentUVRect.w, base_uv_for_calc.y);

            // NOUVEAU: Déterminer si ce vertex doit être visible pour le fragment shader
            bool currentVertexIsOnFrontPlaneGeometry = planeInfo < 0.5; 
            bool showThisVertexForAlpha = (currentVertexIsOnFrontPlaneGeometry == isViewingFrontOrBack);
            v_shouldShow = showThisVertexForAlpha ? 1.0 : 0.0;
            `;

            shader.vertexShader = shader.vertexShader.replace(
                `void main() {`, 
                `void main() {
                    ${mainStartInjection}
                `
            );
        
            // MODIFIÉ: La logique de transformation principale NE MODIFIE PLUS `transformed *= 0.0;`
            let transformationLogic = `
        vec3 localForwardDirection = vec3(0.0, 0.0, 1.0);
        vec3 localDisplacementThisFrame = localForwardDirection * uTime * uSpeed; 
        transformed += localDisplacementThisFrame; 
        
        // La logique de 'showThisVertex' est maintenant utilisée pour v_shouldShow.
        // Il n'est plus nécessaire de modifier 'transformed' ici pour cacher le plan.
        // bool isViewingFrontBackPlane = abs(sdViewWithForward) >= abs(sdViewWithRight);
        // bool currentVertexIsOnFrontPlaneGeometry = planeInfo < 0.5; 
        // bool showThisVertex = (currentVertexIsOnFrontPlaneGeometry == isViewingFrontBackPlane);
        // if (!showThisVertex) {
        //   transformed *= 0.0;  // COMMENTÉ / SUPPRIMÉ
        // }
        `; 
        
            if (animationConfig) {
                let animLogic = `
            float phase = instanceAnimationOffset;`;
                if (animationConfig.side === 'right') { animLogic += `phase += 3.1415926535;`; }
                if (animationConfig.type === 'arm') { animLogic += `phase += 3.1415926535;`; }
                animLogic += `
            float cycleTime = uTime * uSpeed * ${animationConfig.walkSpeed.toFixed(2)} + phase; 
            float angle = sin(cycleTime) * ${animationConfig.maxAngle.toFixed(2)};
            vec3 localPivotPoint = vec3(0.0, ${animationConfig.geomHeight.toFixed(2)}, 0.0);
            vec3 finalPivot; 
            bool usePartBasePosition = abs(u_partBasePositionInDummyModel.x) > 0.0001 || abs(u_partBasePositionInDummyModel.y) > 0.0001 || abs(u_partBasePositionInDummyModel.z) > 0.0001;
            if (usePartBasePosition) { 
                finalPivot = u_partBasePositionInDummyModel + localPivotPoint; 
            } else { 
                finalPivot = localPivotPoint; 
            }
            vec3 p_rel_anim = transformed - finalPivot; 
            p_rel_anim = (rotationAroundX(angle) * vec4(p_rel_anim, 1.0)).xyz;
            transformed = p_rel_anim + finalPivot; 
        `;
                transformationLogic = animLogic + transformationLogic; 
            }
        
            shader.vertexShader = shader.vertexShader.replace(
                `#include <begin_vertex>`,
                `#include <begin_vertex> 
            ${transformationLogic}`
            );
        
            // MODIFIÉ: Fragment Shader pour utiliser v_shouldShow pour l'alpha
            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <common>`,
                `#include <common>
        varying vec3 ${varyingColorName}; 
        varying vec2 vUv; 
        varying float v_shouldShow; // NOUVEAU: recevoir la visibilité
        `
            );
        
            shader.fragmentShader = shader.fragmentShader.replace(
                `#include <color_fragment>`,
                `// #include <color_fragment> // Remplacé
                
                #ifdef USE_MAP
                    vec4 texelColor = texture2D( map, vUv ); 
                    // texelColor = mapTexelToLinear( texelColor ); 
                    diffuseColor *= texelColor; 
                #endif
        
                // L'astuce pour forcer l'utilisation de vUv peut être gardée ou enlevée
                // si u_...UV ne sont plus optimisés.
                // diffuseColor.r = mix(diffuseColor.r, diffuseColor.r + 0.000001, vUv.x);
                // diffuseColor.g = mix(diffuseColor.g, diffuseColor.g - 0.000001, vUv.y);

                diffuseColor.rgb *= ${varyingColorName}; // Appliquer la couleur d'instance AVANT l'alpha final

                // NOUVEAU: Appliquer l'alpha basé sur v_shouldShow
                // Si v_shouldShow est 0.0, alpha devient 0. Sinon, utilise l'alpha calculé.
                // L'alphaTest s'appliquera ensuite sur cette valeur.
                diffuseColor.a *= v_shouldShow; 

                #include <alphatest_fragment> // L'alphaTest va couper les pixels avec alpha < material.alphaTest
                `
            );
        }

        const dummyModel = new THREE.Object3D();
        const legSize = { x: 0.5, y: 1, z: 0.5 };
        const armSize = { x: 0.5, y: 1, z: 0.5 };
        const torsoSize = { x: 0.5, y: 0.5, z: 0.5 };
        const headSize = { x: 0.4, y: 0.4, z: 0.4 };

        const uvHead = characterPartUVs.head;
        const uvTorso = characterPartUVs.torso;
        const uvArm = characterPartUVs.arm;
        const uvLeg = characterPartUVs.leg;
        
        const headGeometry = createCrossedPlanesGeometry(headSize, uvHead.front, uvHead.left, uvHead.back, uvHead.right);
        const torsoGeometry = createCrossedPlanesGeometry(torsoSize, uvTorso.front, uvTorso.left, uvTorso.back, uvTorso.right);
        const armGeometry = createCrossedPlanesGeometry(armSize, uvArm.front, uvArm.left, uvArm.back, uvArm.right);
        const legGeometry = createCrossedPlanesGeometry(legSize, uvLeg.front, uvLeg.left, uvLeg.back, uvLeg.right);


        const commonMaterialParams = {
            map: femaleTexture,
            transparent: true, // Essentiel pour que l'alpha fonctionne
            alphaTest: 0.5,    // Coupera les pixels avec alpha < 0.5
            side: THREE.DoubleSide
        };
        const baseMaterials = {
            head: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseHeadMat' }),
            torso: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseTorsoMat' }),
            leftArm: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseLeftArmMat' }),
            rightArm: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseRightArmMat' }),
            leftLeg: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseLeftLegMat' }),
            rightLeg: new THREE.MeshStandardMaterial({ ...commonMaterialParams, name: 'BaseRightLegMat' }),
        };

        const headMesh = new THREE.Mesh(headGeometry, baseMaterials.head);
        const torsoMesh = new THREE.Mesh(torsoGeometry, baseMaterials.torso);
        const leftArmMesh = new THREE.Mesh(armGeometry, baseMaterials.leftArm);
        const rightArmMesh = new THREE.Mesh(armGeometry.clone(), baseMaterials.rightArm);
        const leftLegMesh = new THREE.Mesh(legGeometry, baseMaterials.leftLeg);
        const rightLegMesh = new THREE.Mesh(legGeometry.clone(), baseMaterials.rightLeg);

        const legBottomY = 0;
        leftLegMesh.position.set(-torsoSize.x / 4, legBottomY, 0);
        rightLegMesh.position.set(torsoSize.x / 4, legBottomY, 0);
        const torsoBaseY = legSize.y * 0.9;
        torsoMesh.position.set(0, torsoBaseY, 0);
        const shoulderHeight = torsoBaseY + torsoSize.y * 0.85;
        const armAttachPointY = shoulderHeight;
        leftArmMesh.position.set(-(torsoSize.x / 2 + armSize.x * 0.1), armAttachPointY - armSize.y, 0);
        rightArmMesh.position.set(torsoSize.x / 2 + armSize.x * 0.1, armAttachPointY - armSize.y, 0);
        const headBaseY = torsoBaseY + torsoSize.y;
        headMesh.position.set(0, headBaseY, 0);

        dummyModel.add(leftLegMesh); dummyModel.add(rightLegMesh); dummyModel.add(leftArmMesh);
        dummyModel.add(rightArmMesh); dummyModel.add(torsoMesh); dummyModel.add(headMesh);
        dummyModel.updateMatrixWorld(true);

        // @ts-ignore
        const { geometry: mergedDummyGeometry } = mergeMeshesWithGroups(dummyModel);


        const materialOrderForInstancing: THREE.MeshStandardMaterial[] = [
            baseMaterials.leftLeg, baseMaterials.rightLeg,
            baseMaterials.leftArm, baseMaterials.rightArm,
            baseMaterials.torso, baseMaterials.head
        ];

        const partUVConfigs: IPartUVs[] = [
            characterPartUVs.leg,
            characterPartUVs.leg,
            characterPartUVs.arm,
            characterPartUVs.arm,
            characterPartUVs.torso,
            characterPartUVs.head,
        ];

        instancedMaterialsArray = materialOrderForInstancing.map((mat, index) => {
            const clonedMat = mat.clone() as any;
            clonedMat.uniforms = THREE.UniformsUtils.clone(clonedMat.uniforms || {});
            clonedMat.uniforms.uTime = { value: 0.0 };
            clonedMat.uniforms.uSpeed = { value: guiControls.speed };
            clonedMat.uniforms.u_partBasePositionInDummyModel = { value: new THREE.Vector3() };

            const currentPartUVs = partUVConfigs[index];
            const frontUV = currentPartUVs.front;
            const backUV = currentPartUVs.back;
            const leftUV = currentPartUVs.left;
            const rightUV = currentPartUVs.right ? currentPartUVs.right : mirrorUV(currentPartUVs.left);

            clonedMat.uniforms.u_frontUV = { value: new THREE.Vector4(frontUV.u1, frontUV.v1, frontUV.u2, frontUV.v2) };
            clonedMat.uniforms.u_backUV = { value: new THREE.Vector4(backUV.u1, backUV.v1, backUV.u2, backUV.v2) };
            clonedMat.uniforms.u_leftUV = { value: new THREE.Vector4(leftUV.u1, leftUV.v1, leftUV.u2, leftUV.v2) };
            clonedMat.uniforms.u_rightUV = { value: new THREE.Vector4(rightUV.u1, rightUV.v1, rightUV.u2, rightUV.v2) };

            return clonedMat;
        });

        // @ts-ignore
        instancedMaterialsArray[0].uniforms.u_partBasePositionInDummyModel.value.copy(leftLegMesh.position);
        // @ts-ignore
        instancedMaterialsArray[1].uniforms.u_partBasePositionInDummyModel.value.copy(rightLegMesh.position);
        // @ts-ignore
        instancedMaterialsArray[2].uniforms.u_partBasePositionInDummyModel.value.copy(leftArmMesh.position);
        // @ts-ignore
        instancedMaterialsArray[3].uniforms.u_partBasePositionInDummyModel.value.copy(rightArmMesh.position);

        const walkSpeedFactor = 3.0;
        const legAngle = 0.6;
        const armAngle = 0.8;

        const legAnimConfigBase = { type: 'leg' as const, geomHeight: legSize.y, walkSpeed: walkSpeedFactor, maxAngle: legAngle };
        const armAnimConfigBase = { type: 'arm' as const, geomHeight: armSize.y, walkSpeed: walkSpeedFactor, maxAngle: armAngle };
        // @ts-ignore
        instancedMaterialsArray[0].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[0].uniforms, 'instancePartColor', 'vPartColor', { ...legAnimConfigBase, side: 'left', partBasePositionInDummyModel: leftLegMesh.position });
        // @ts-ignore
        instancedMaterialsArray[1].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[1].uniforms, 'instancePartColor', 'vPartColor', { ...legAnimConfigBase, side: 'right', partBasePositionInDummyModel: rightLegMesh.position });
        // @ts-ignore
        instancedMaterialsArray[2].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[2].uniforms, 'instancePartColor', 'vPartColor', { ...armAnimConfigBase, side: 'left', partBasePositionInDummyModel: leftArmMesh.position });
        // @ts-ignore
        instancedMaterialsArray[3].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[3].uniforms, 'instancePartColor', 'vPartColor', { ...armAnimConfigBase, side: 'right', partBasePositionInDummyModel: rightArmMesh.position });
        // @ts-ignore
        instancedMaterialsArray[4].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[4].uniforms, 'instancePartColor', 'vPartColor', undefined);
        // @ts-ignore
        instancedMaterialsArray[5].onBeforeCompile = (s) => customizeShader(s, instancedMaterialsArray[5].uniforms, 'instancePartColor', 'vPartColor', undefined);


        const numCharacters = 10_000;
        const SceneSize = Math.sqrt(numCharacters) * 3;
        const newInstancedCharacterMesh = new THREE.InstancedMesh(
            mergedDummyGeometry,
            instancedMaterialsArray,
            numCharacters
        );
        newInstancedCharacterMesh.castShadow = true;
        newInstancedCharacterMesh.receiveShadow = true;

        const instancePartColorArray = new Float32Array(numCharacters * 3);
        const instanceAnimationOffsetArray = new Float32Array(numCharacters);
        for (let i = 0; i < numCharacters; i++) {
            const color = new THREE.Color();
            color.setHSL(random(), 0.6, 0.7);
            instancePartColorArray[i * 3 + 0] = color.r;
            instancePartColorArray[i * 3 + 1] = color.g;
            instancePartColorArray[i * 3 + 2] = color.b;
            instanceAnimationOffsetArray[i] = random() * Math.PI * 2.0;
            const dummyPlacement = new THREE.Object3D();
            dummyPlacement.position.set(
                (random() - 0.5) * SceneSize,
                0,
                (random() - 0.5) * SceneSize
            );
            dummyPlacement.rotation.y = random() * Math.PI * 2;
            dummyPlacement.updateMatrix();
            newInstancedCharacterMesh.setMatrixAt(i, dummyPlacement.matrix);
        }
        newInstancedCharacterMesh.geometry.setAttribute('instancePartColor', new THREE.InstancedBufferAttribute(instancePartColorArray, 3));
        newInstancedCharacterMesh.geometry.setAttribute('instanceAnimationOffset', new THREE.InstancedBufferAttribute(instanceAnimationOffsetArray, 1));
        newInstancedCharacterMesh.instanceMatrix.needsUpdate = true;

        scene.add(newInstancedCharacterMesh);
        instancedCharacterMesh = newInstancedCharacterMesh; 
    }

    addSceneContent();

    return (elapsedTime: number) => {
        if (instancedMaterialsArray && instancedMaterialsArray.length > 0) {
            instancedMaterialsArray.forEach((material) => {
                // @ts-ignore
                if (material.uniforms && material.uniforms.uTime) {
                    // @ts-ignore
                    material.uniforms.uTime.value = elapsedTime;
                }
            });
        }
    };
}
