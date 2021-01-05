import * as THREE from 'https://unpkg.com/three@0.121.1/build/three.module.js'
import { OBJLoader } from 'https://unpkg.com/three@0.121.1/examples/jsm/loaders/OBJLoader.js'

function spline(t, r, segment) {
    const t_vec = new THREE.Vector4(t * t * t, t * t, t, 1)
    t_vec.divideScalar(6.0)
    const matrix_coef = new THREE.Matrix4()
    matrix_coef.set(-1, 3, -3, 1, 3, -6, 0, 4, -3, 3, 3, 1, 1, 0, 0, 0)
    const matrix_r = new THREE.Matrix4()
    matrix_r.set(
        r[segment - 1].x,
        r[segment].x,
        r[segment + 1].x,
        r[segment + 2].x,
        r[segment - 1].y,
        r[segment].y,
        r[segment + 1].y,
        r[segment + 2].y,
        r[segment - 1].z,
        r[segment].z,
        r[segment + 1].z,
        r[segment + 2].z,
        0,
        0,
        0,
        0
    )
    let result = t_vec.applyMatrix4(matrix_coef).applyMatrix4(matrix_r)
    return [result.x, result.y, result.z]
}

function spline_tangent(t, r, segment) {
    // first derivation of the spline
    const t_vec = new THREE.Vector4(t * t, t, 1, 0)
    t_vec.divideScalar(2.0)
    const matrix_coef = new THREE.Matrix4()
    matrix_coef.set(-1, 2, -1, 0, 3, -4, 0, 0, -3, 2, 1, 0, 1, 0, 0, 0)
    const matrix_r = new THREE.Matrix4()
    matrix_r.set(
        r[segment - 1].x,
        r[segment].x,
        r[segment + 1].x,
        r[segment + 2].x,
        r[segment - 1].y,
        r[segment].y,
        r[segment + 1].y,
        r[segment + 2].y,
        r[segment - 1].z,
        r[segment].z,
        r[segment + 1].z,
        r[segment + 2].z,
        0,
        0,
        0,
        0
    )
    let result = t_vec.applyMatrix4(matrix_coef).applyMatrix4(matrix_r)

    return [result.x, result.y, result.z]
}

let spline_idx = 0
let direction = true
let material = new THREE.LineBasicMaterial({ color: 0xff0000 })
let prev_line = ''
let start = true
// frames function
function animate() {
    requestAnimationFrame(animate)

    if (current_obj) {
        let obj = scene.getObjectById(current_obj)
        if (obj) {
            if (spline_path.length > 0) {
                // previous step orientation
                let orient_origin = null
                if (start) {
                    start = false
                    orient_origin = new THREE.Vector3(0, 0, 1)
                } else if ((spline_idx == 0 && direction) || (spline_idx == spline_path.length - 1 && !direction)) {
                    orient_origin = new THREE.Vector3(...spline_tans[spline_idx])
                } else {
                    if (direction) {
                        orient_origin = new THREE.Vector3(...spline_tans[spline_idx - 1])
                    } else {
                        orient_origin = new THREE.Vector3(...spline_tans[spline_idx + 1])
                    }
                }

                // orientation we want to achieve
                let orient_goal = new THREE.Vector3(...spline_tans[spline_idx])

                // rotate object around axis by phi
                let axis = new THREE.Vector3().crossVectors(orient_origin, orient_goal)
                let cos = orient_origin.dot(orient_goal) / (orient_origin.length() * orient_goal.length())
                let sin = axis.length() / (orient_origin.length() * orient_goal.length())
                let phi = Math.atan2(sin, cos)

                axis.normalize()
                obj.rotateOnWorldAxis(axis, phi)

                // position the object
                obj.position.set(...spline_path[spline_idx])

                // drawn tangent
                let rot_origin = new THREE.Vector3(...spline_path[spline_idx])
                let rot_goal = new THREE.Vector3(...spline_tans[spline_idx]).add(rot_origin)
                // obj.lookAt(rot_goal)
                let geometry = new THREE.BufferGeometry().setFromPoints([rot_goal, rot_origin])
                let line = new THREE.Line(geometry, material)
                if (prev_line) {
                    scene.remove(scene.getObjectById(prev_line))
                }
                scene.add(line)
                prev_line = line.id

                // calculate direction and new spline path index
                if ((spline_idx == spline_path.length - 1 && direction) || (spline_idx == 0 && !direction)) {
                    direction = !direction
                }
                spline_idx += direction ? 1 : -1
            }
        }
    }
    renderer.render(scene, camera)
}

// rendering data
const renderer = new THREE.WebGLRenderer()
renderer.setSize(window.innerWidth / 2, window.innerHeight / 1.5, false)
document.getElementById('gl').appendChild(renderer.domElement)

const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 500)
camera.position.set(25, 30, 75)
camera.lookAt(5, 5, 30)

const scene = new THREE.Scene()
renderer.setClearColor(0xffffff, 1)
renderer.render(scene, camera)

// load object
const obj_loader = new OBJLoader()
let current_obj = ''
const original_obj_data = {}
function load_object(ev) {
    if (current_obj) {
        scene.remove(scene.getObjectById(current_obj))
        animate()
    }
    obj_loader.load(
        `models/${ev.target.files[0].name}`,
        // called when resource is loaded
        function (object) {
            if (prev_line) {
                scene.remove(scene.getObjectById(prev_line))
            }
            spline_idx = 0
            direction = true
            prev_line = ''
            start = true

            current_obj = object.id
            object.children[0].material = new THREE.LineBasicMaterial({ color: 0x0000ff })
            original_obj_data.orientation = new THREE.Vector3(0, 0, 1)
            scene.add(object)
            animate()
        }
    )
    animate()
}
document.getElementById('obj-file').addEventListener('change', load_object)

// load spline points
const spline_loader = new THREE.FileLoader()
const spline_path = []
const spline_tans = []
let current_spline = ''
function load_spline(ev) {
    if (current_spline) {
        scene.remove(scene.getObjectById(current_spline))
        animate()
    }
    spline_loader.load(
        `splines/${ev.target.files[0].name}`,
        // called when resource is loaded
        function (data) {
            if (prev_line) {
                scene.remove(scene.getObjectById(prev_line))
            }
            if (current_obj) {
                scene.getObjectById(current_obj).position.set(0, 0, 0)
                scene.getObjectById(current_obj).rotation.set(0, 0, 0)
            }
            spline_idx = 0
            direction = true
            prev_line = ''
            start = true

            let spline_points = []
            spline_path.length = 0
            spline_tans.length = 0
            for (let vertex of data.split('\n')) {
                spline_points.push(new THREE.Vector3(...vertex.split(' ')))
            }
            // generate spline path
            let spline_line = []
            for (let segment = 1; segment < 10; segment++) {
                for (let it = 0; it < 101; it++) {
                    let spline_val = spline(it * 0.01, spline_points, segment)
                    spline_path.push(spline_val)
                    spline_line.push(new THREE.Vector3(...spline_val))
                    spline_tans.push(spline_tangent(it * 0.01, spline_points, segment))
                }
            }
            //create the line from the file
            var material = new THREE.LineBasicMaterial({ color: 0x00ff00 })
            var geometry = new THREE.BufferGeometry().setFromPoints(spline_line)
            var line = new THREE.Line(geometry, material)
            current_spline = line.id
            scene.add(line)
        }
    )
    animate()
}
document.getElementById('spline-file').addEventListener('change', load_spline)

function change_camera(ev) {
    camera.position.set(...ev.target.value.split(' '))
    camera.lookAt(5, 5, 30)
}
document.getElementById('coordinates').placeholder = `${camera.position.x} ${camera.position.y} ${camera.position.z}`
document.getElementById('coordinates').addEventListener('change', change_camera)
