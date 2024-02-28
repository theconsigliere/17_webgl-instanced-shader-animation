import * as THREE from "three"
import fragment from "./shader/fragment.glsl"
import vertex from "./shader/vertex.glsl"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js"
import gui from "lil-gui"
import gsap from "gsap"
import barModel from "../assets/bar.glb?url"
import barAmbientOcclusion from "../assets/ao.png"

export default class Sketch {
  constructor(options) {
    this.scene = new THREE.Scene()

    this.container = options.dom
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer = new THREE.WebGLRenderer()
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.renderer.setSize(this.width, this.height)
    this.renderer.setClearColor(0x08092d, 1)
    this.renderer.outputColorSpace = THREE.SRGBColorSpace

    this.container.appendChild(this.renderer.domElement)

    this.camera = new THREE.PerspectiveCamera(
      70,
      window.innerWidth / window.innerHeight,
      0.001,
      1000
    )

    let frustumSize = this.height
    let aspect = window.innerWidth / window.innerHeight
    this.camera = new THREE.OrthographicCamera(
      (frustumSize * aspect) / -2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      frustumSize / -2,
      -1000,
      1000
    )
    this.camera.position.set(0, 0, 2)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.time = 0

    this.isPlaying = true

    this.gltfLoader = new GLTFLoader()

    this.addObjects()
    this.resize()
    this.render()
    this.setupResize()
    this.addLights()
    // this.settings()
  }

  settings() {
    this.settings = {
      progress: 0,
    }
    this.gui = new gui()
    this.gui.add(this.settings, "progress", 0, 1, 0.01)
  }

  setupResize() {
    window.addEventListener("resize", this.resize.bind(this))
  }

  resize() {
    this.width = this.container.offsetWidth
    this.height = this.container.offsetHeight
    this.renderer.setSize(this.width, this.height)
    this.camera.aspect = this.width / this.height
    this.camera.updateProjectionMatrix()
  }

  addObjects() {
    this.material = new THREE.ShaderMaterial({
      extensions: {
        derivatives: "#extension GL_OES_standard_derivatives : enable",
      },
      side: THREE.DoubleSide,
      uniforms: {
        time: { type: "f", value: 0 },
        resolution: { type: "v4", value: new THREE.Vector4() },
        uvRate1: {
          value: new THREE.Vector2(1, 1),
        },
      },
      // wireframe: true,
      // transparent: true,
      vertexShader: vertex,
      fragmentShader: fragment,
    })

    this.aOTexture = new THREE.TextureLoader().load(barAmbientOcclusion)
    // set texture of the ambient occlusion
    this.aOTexture.flipY = false

    this.material = new THREE.MeshPhysicalMaterial({
      roughness: 0.65,
      map: this.aOTexture,
      aoMap: this.aOTexture,
      aoMapIntensity: 0.75,
    })

    this.gltfLoader.load(barModel, (gltf) => {
      this.barModel = gltf.scene.children[0]
      this.scene.add(this.barModel)
      this.barModel.material = this.material
      this.geometry = this.barModel.geometry
      this.geometry.scale(40, 40, 40)
    })
  }

  addLights() {
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.7)
    this.scene.add(this.ambientLight)

    this.directionalLight = new THREE.DirectionalLight(0xffffff, 0.5)
    this.directionalLight.position.set(0.5, 1, 0.86)
    this.scene.add(this.directionalLight)
  }

  stop() {
    this.isPlaying = false
  }

  play() {
    if (!this.isPlaying) {
      this.render()
      this.isPlaying = true
    }
  }

  render() {
    if (!this.isPlaying) return
    this.time += 0.05
    // this.material.uniforms.time.value = this.time
    requestAnimationFrame(this.render.bind(this))
    this.renderer.render(this.scene, this.camera)
  }
}

new Sketch({
  dom: document.getElementById("container"),
})
