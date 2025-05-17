import * as THREE from "three";
import GUI from "lil-gui";

interface IPoint { x: number; y: number; z: number; }
interface IUV { u1: number; v1: number; u2: number; v2: number; }

interface IAnimatedMesh {
    side: 'top' | 'left' | 'front' | 'none'
    mesh: THREE.Mesh,
    config: IPartConfig

}
interface IPartConfig {
    name: string;
    origin: IPoint;
    offset: IPoint;
    size: IPoint;
    frontUv: IUV;
    backUv: IUV;
    leftUv: IUV;
    rightUv?: IUV;
    topUv: IUV;

    animSpeedFactor: number;
    maxAngle: number;
}

function getUv(colStart: number, rowStart: number, colSpan: number, rowSpan: number): IUV {
    return {
        u1: colStart / 10.0,
        v1: rowStart / 10.0,
        u2: (colStart + colSpan) / 10.0,
        v2: (rowStart + rowSpan) / 10.0,
    };
}



let torso: IPartConfig = {
    name: 'torso',
    size: { x: 2, y: 3, z: 2 },
    origin: { x: 0, y: 0, z: 0 },
    offset: { x: 0, y: 7, z: 0 },
    frontUv: getUv(4, 7, 2, 3), backUv: getUv(6, 7, 2, 3), leftUv: getUv(10, 7, -2, 3), topUv: getUv(0, 8, 2, -2),
    animSpeedFactor: 0, maxAngle: 0
};

let head: IPartConfig = {
    name: 'head',
    size: { x: 2, y: 3, z: 2 },
    origin: { x: 0, y: 10, z: 0 },
    offset: { x: 0, y: 0, z: 0 },
    frontUv: getUv(4, 4, 2, 3), backUv: getUv(6, 4, 2, 3), leftUv: getUv(10, 4, -2, 3), topUv: getUv(8, 2, 2, -2),
    animSpeedFactor: 0, maxAngle: 0
};

let rightLeg: IPartConfig = {
    name: 'rightLeg',
    size: { x: 1, y: 6, z: 2 },
    origin: { x: -0.5, y: 6, z: 0 },
    offset: { x: 0, y: -3, z: 0 },
    frontUv: getUv(1, 0, -1, 6), backUv: getUv(1, 0, 1, 6), leftUv: getUv(4, 0, -2, 6), topUv: getUv(10, 4, -1, -2),
    animSpeedFactor: 1.0, maxAngle: Math.PI / 7
};

let leftLeg: IPartConfig = {
    name: 'leftLeg',
    size: { x: 1, y: 6, z: 2 },
    origin: { x: +0.5, y: 6, z: 0 },
    offset: { x: 0, y: -3, z: 0 },
    frontUv: getUv(0, 0, 1, 6), backUv: getUv(2, 0, -1, 6), leftUv: getUv(4, 0, -2, 6), topUv: getUv(9, 4, 1, -2),
    animSpeedFactor: -1.0, maxAngle: Math.PI / 7
};

let rightArm: IPartConfig = {
    name: 'rightArm',
    size: { x: 1, y: 4, z: 2 },
    origin: { x: -1.25, y: 8.25, z: 0 },
    offset: { x: 0, y: -2, z: 0 },
    frontUv: getUv(5, 0, -1, 4), backUv: getUv(5, 0, 1, 4), leftUv: getUv(8, 0, -2, 4), topUv: getUv(9, 4, -1, -2),
    animSpeedFactor: -1.1, maxAngle: Math.PI / 5
};

let leftArm: IPartConfig = {
    name: 'leftarm',
    size: { x: 1, y: 4, z: 2 },
    origin: { x: +1.25, y: 8.25, z: 0 },
    offset: { x: 0, y: -2, z: 0 },
    frontUv: getUv(4, 0, 1, 4), backUv: getUv(6, 0, -1, 4), leftUv: getUv(8, 0, -2, 4), topUv: getUv(8, 4, 1, -2),
    animSpeedFactor: 1.1, maxAngle: Math.PI / 5
};

let characterParts: IPartConfig[] = [torso, head, leftLeg, rightLeg, rightArm, leftArm];

const gui = new GUI();
const guiControls = { speed: 0.5 };
gui.add(guiControls, 'speed', 0, 2, 0.01);

const textureLoader = new THREE.TextureLoader();
const mainTexture = loadTexture("textures/female.png", true);
const mainMaterial = new THREE.MeshStandardMaterial({
    map: mainTexture,
    side: THREE.DoubleSide,
    transparent: true
});


function loadTexture(url: string, flipY = false): THREE.Texture {
    const texture = textureLoader.load(url,
        () => { console.log(`Texture ${url} loaded successfully.`); },
        undefined,
        (err) => { console.error(`Error loading texture ${url}:`, err); }
    );
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.flipY = flipY;
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    return texture;
}

function mirrorUV(uv: IUV): IUV {
    return { u1: uv.u2, v1: uv.v1, u2: uv.u1, v2: uv.v2 };
}

function createCharacterPartMaterial(partConfig: IPartConfig, texture: THREE.Texture): THREE.Material[] {
    const { frontUv, backUv, leftUv, rightUv: rightUv, topUv } = partConfig;
    const actualRightUv = rightUv ? rightUv : mirrorUV(leftUv);
    const uvsInMaterialOrder = [actualRightUv, leftUv, topUv, undefined, frontUv, backUv];

    return uvsInMaterialOrder.map((uv, _index) => {
        if (!uv) {
            return new THREE.MeshBasicMaterial({ color: 0xcccccc, wireframe: false });
        }
        const mapClone = texture.clone();
        mapClone.needsUpdate = true;
        const uSpan = uv.u2 - uv.u1;
        const vSpan = uv.v2 - uv.v1;
        mapClone.offset.set(uv.u1, 1.0 - uv.v2);
        mapClone.repeat.set(uSpan, vSpan);
        return new THREE.MeshStandardMaterial({ map: mapClone });
    });
}

function makeBoxFigure(animatedMeshes: IAnimatedMesh[]) {
    const character = new THREE.Group();
    characterParts.forEach(partConfig => {
        const geometry = new THREE.BoxGeometry(partConfig.size.x, partConfig.size.y, partConfig.size.z);

        geometry.translate(partConfig.offset.x, partConfig.offset.y, partConfig.offset.z);

        const materials = createCharacterPartMaterial(partConfig, mainTexture);
        const mesh = new THREE.Mesh(geometry, materials);

        mesh.position.set(partConfig.origin.x, partConfig.origin.y, partConfig.origin.z);

        character.add(mesh);

        if (partConfig.animSpeedFactor != 0) {
            animatedMeshes.push({ mesh, config: partConfig, side: 'none' });
        }
    });
    return character;
}

function makePlaneFigure(animatedMeshes: IAnimatedMesh[], side: 'front' | 'left' | 'top') {
    const character = new THREE.Group();
    characterParts.forEach(part => {
        let uv: IUV;
        let sx: number, sy: number;

        switch (side) {
            case 'front':
                sx = part.size.x
                sy = part.size.y
                uv = part.frontUv;
                break;
            case 'left':
                sx = part.size.z
                sy = part.size.y
                uv = part.leftUv;
                break;
            case 'top':
                sx = part.size.x
                sy = part.size.z
                uv = part.topUv
                break;
        }

        const geometry: THREE.PlaneGeometry = new THREE.PlaneGeometry(sx, sy);

        switch (side) {
            case 'front':
                break;
            case 'left':
                geometry.rotateY(-Math.PI / 2);
                break;
            case 'top':
                geometry.rotateX(-Math.PI / 2);
                break;
        }

        geometry.translate(part.offset.x, part.offset.y, part.offset.z);

        if (uv) {
            const { u1, v1, u2, v2 } = uv;
            const uvs = geometry.attributes.uv;
            uvs.setXY(0, u1, 1 - v1);
            uvs.setXY(1, u2, 1 - v1);
            uvs.setXY(2, u1, 1 - v2);
            uvs.setXY(3, u2, 1 - v2);
            uvs.needsUpdate = true;
        } else {
            console.warn(`${side}Uv not defined for part ${part.name}`);
        }

        const mesh = new THREE.Mesh(geometry, mainMaterial);
        mesh.position.set(part.origin.x, part.origin.y, part.origin.z);
        character.add(mesh);

        if (part.animSpeedFactor != 0) {
            animatedMeshes.push({ mesh, config: part, side });
        }
    });
    return character;
}

export default function planedCharacterTest(scene: THREE.Scene): (elapsedTime: number) => void {

    const animatedMeshes: IAnimatedMesh[] = [];

    let char1 = makeBoxFigure(animatedMeshes); // Personnage en boîtes
    char1.position.set(12, 0, 0);
    scene.add(char1);

    let char2 = makePlaneFigure(animatedMeshes, 'front');
    char2.position.set(6, 0, 0);
    scene.add(char2);

    let char3 = makePlaneFigure(animatedMeshes, 'left');
    char3.position.set(0, 0, 0);
    scene.add(char3);

    let char4 = makePlaneFigure(animatedMeshes, 'top');
    char4.position.set(-6, 0, 0);
    scene.add(char4);

    // const ambientLight = new THREE.AmbientLight(0xffffff, 1.0);
    // scene.add(ambientLight);
    // const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
    // directionalLight.position.set(3, 10, 7);
    // directionalLight.target = char1; // La lumière cible le personnage du milieu
    // scene.add(directionalLight);
    // scene.add(directionalLight.target);

    return (elapsedTime: number) => {
        const overallSpeed = guiControls.speed;
        // Toutes les parties dans animatedMeshes (des 3 personnages) s'animeront.
        animatedMeshes.forEach(({ mesh, config }) => {
            let angle = Math.sin(elapsedTime * config.animSpeedFactor * overallSpeed * 5.0) * config.maxAngle;
            //if (side == 'top') angle += Math.PI / 2;
            mesh.rotation.x = angle;
        });
    };
}
